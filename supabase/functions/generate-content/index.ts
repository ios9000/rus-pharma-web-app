import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
const CLAUDE_MODEL = "claude-sonnet-4-5-20250514";
const MAX_TOKENS = 4096;
const MAX_TEXT_LENGTH = 100_000;
const CLAUDE_TIMEOUT_MS = 90_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  let generationId = crypto.randomUUID();

  try {
    // ── 1. Авторизация ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // ── 2. Входные данные ──
    const { text, types, params, additional_instructions } = await req.json();

    // ── 3. Валидация ──
    if (!text || typeof text !== "string" || text.length < 100) {
      throw new Error("Текст слишком короткий (минимум 100 символов)");
    }
    if (!types || !Array.isArray(types) || types.length === 0) {
      throw new Error("Укажите хотя бы один тип контента");
    }
    const validTypes = ["question", "drug", "flashcard", "scenario"];
    for (const t of types) {
      if (!validTypes.includes(t))
        throw new Error(`Неизвестный тип контента: ${t}`);
    }

    const truncatedText =
      text.length > MAX_TEXT_LENGTH
        ? text.substring(0, MAX_TEXT_LENGTH)
        : text;

    // ── 4. Генерация для каждого типа ──
    const allItems: Record<string, unknown>[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const contentType of types) {
      const prompt = buildPrompt(
        contentType,
        truncatedText,
        params,
        additional_instructions
      );

      // Вызов Claude API с таймаутом
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CLAUDE_TIMEOUT_MS
      );

      let claudeResponse: Response;
      try {
        claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": CLAUDE_API_KEY!,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: MAX_TOKENS,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        });
      } catch (err) {
        if (err.name === "AbortError") {
          throw new Error(
            "Генерация заняла слишком много времени. Попробуйте с меньшим объёмом текста или меньшим количеством типов контента."
          );
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!claudeResponse.ok) {
        const status = claudeResponse.status;
        if (status === 429) {
          throw new Error(
            "Превышен лимит запросов к Claude API, подождите минуту"
          );
        }
        const errBody = await claudeResponse.text();
        throw new Error(`Claude API error (${status}): ${errBody}`);
      }

      const claudeResult = await claudeResponse.json();

      totalInputTokens += claudeResult.usage?.input_tokens || 0;
      totalOutputTokens += claudeResult.usage?.output_tokens || 0;

      // Извлечение текста из ответа
      const responseText =
        claudeResult.content
          ?.filter((c: { type: string }) => c.type === "text")
          .map((c: { text: string }) => c.text)
          .join("") || "";

      const parsed = parseClaudeJSON(responseText);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error(
          `Claude вернул некорректный ответ для типа «${contentType}», попробуйте ещё раз`
        );
      }

      for (const item of parsed) {
        allItems.push({
          generation_id: generationId,
          type: contentType,
          content: item,
          status: "draft",
          source_text_hash: simpleHash(truncatedText),
          competency_id: params?.competency_id || null,
          instructor_id: user.id,
        });
      }
    }

    // ── 5. Сохранение в generated_content ──
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: savedItems, error: insertError } = await adminClient
      .from("generated_content")
      .insert(allItems)
      .select();

    if (insertError) {
      throw new Error(`Ошибка сохранения: ${insertError.message}`);
    }

    // ── 6. Логирование ──
    const durationMs = Date.now() - startTime;

    await adminClient.from("generation_log").insert({
      generation_id: generationId,
      instructor_id: user.id,
      source_text_length: truncatedText.length,
      source_text_hash: simpleHash(truncatedText),
      types_requested: types,
      params: params || {},
      additional_instructions: additional_instructions || null,
      tokens_input: totalInputTokens,
      tokens_output: totalOutputTokens,
      model: CLAUDE_MODEL,
      duration_ms: durationMs,
      status: "success",
    });

    // ── 7. Ответ клиенту ──
    return new Response(
      JSON.stringify({
        success: true,
        generation_id: generationId,
        items: savedItems,
        usage: {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          duration_ms: durationMs,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    // Логируем ошибку (best-effort)
    try {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await adminClient.from("generation_log").insert({
        generation_id: generationId,
        source_text_length: 0,
        types_requested: [],
        params: {},
        model: CLAUDE_MODEL,
        duration_ms: Date.now() - startTime,
        status: "error",
        error_message: error.message,
      });
    } catch (_) {
      /* не падаем при ошибке логирования */
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

// ═══════════════════════════════════════════════════
//  ПРОМПТЫ
// ═══════════════════════════════════════════════════

const SYSTEM_CONTEXT = `Ты — эксперт по тактической медицине и фармакологии. Ты создаёшь учебные материалы для курса «Фармакология и обработка ран в боевых условиях в отдалённой местности».

Правила:
1. Все материалы — на русском языке.
2. Медицинская терминология должна быть точной и соответствовать российским стандартам.
3. Сценарии должны быть реалистичными для боевых условий.
4. Препараты — только из реального арсенала тактической медицины.
5. Ответы отдавай СТРОГО в формате JSON (без markdown-обёрток).
6. Каждый вопрос должен иметь одно чёткое пояснение правильного ответа.`;

function buildPrompt(
  contentType: string,
  lectureText: string,
  params: { competency_id?: string; difficulty?: number; count?: number } | null,
  additionalInstructions: string | null
): string {
  const count = params?.count || 5;
  const difficulty = params?.difficulty || 2;
  const competencyName = params?.competency_id || "Не указана";

  let typePrompt: string;

  switch (contentType) {
    case "question":
      typePrompt = `На основе текста лекции ниже создай ${count} тестовых вопросов с множественным выбором.

Параметры:
- Компетенция: ${competencyName}
- Сложность: ${difficulty} (1 = базовый, 2 = средний, 3 = продвинутый)

Формат ответа — JSON массив:
[
  {
    "text": "Текст вопроса",
    "options": [
      { "text": "Вариант A", "is_correct": false },
      { "text": "Вариант B", "is_correct": true }
    ],
    "explanation": "Почему правильный ответ именно такой",
    "difficulty": ${difficulty},
    "category": "Категория",
    "module": "Модуль"
  }
]

Требования:
- 4-6 вариантов ответа на каждый вопрос
- Дистракторы (неправильные ответы) должны быть правдоподобными
- Может быть 1 или несколько правильных ответов
- Вопросы должны проверять понимание, а не запоминание`;
      break;

    case "drug":
      typePrompt = `На основе текста лекции ниже извлеки информацию о препаратах и создай карточки.
Если в тексте упомянуто менее ${count} препаратов, создай карточки только для тех, что есть.

Формат ответа — JSON массив:
[
  {
    "name_ru": "Название на русском",
    "name_lat": "Латинское / МНН",
    "drug_group": "Фармакологическая группа",
    "form": "Форма выпуска",
    "dosage": "Дозировка и способ введения",
    "indications": "Показания к применению",
    "contraindications": "Противопоказания",
    "side_effects": "Побочные эффекты",
    "field_notes": "Особенности применения в полевых/боевых условиях"
  }
]

Требования:
- Заполни ВСЕ поля для каждого препарата
- field_notes — конкретика для полевых условий (хранение, введение без медоборудования)`;
      break;

    case "flashcard":
      typePrompt = `На основе текста лекции создай ${count} flash-карточек для заучивания.

Карточки могут описывать:
- Препараты (item_type: "drug")
- Медицинские приборы (item_type: "device")
- Инструменты (item_type: "instrument")
- Приспособления и оборудование (item_type: "equipment")

Формат ответа — JSON массив. Каждая карточка содержит ВСЕ поля:
[
  {
    "item_type": "drug|device|instrument|equipment",
    "name_ru": "Название на русском",
    "name_lat": "Латинское / международное название",
    "drug_group": "Группа / категория внутри типа",
    "form": "Форма выпуска (для препаратов) или конструкция/тип (для инструментов)",
    "dosage": "Дозировка (для препаратов) или способ применения/характеристики (для инструментов)",
    "indications": "Показания к применению",
    "contraindications": "Противопоказания / когда НЕ применять",
    "side_effects": "Побочные эффекты (для препаратов) или риски/ограничения (для инструментов)",
    "field_notes": "Особенности применения в полевых/боевых условиях"
  }
]

Правила:
- Для каждого элемента заполни ВСЕ поля, даже если кратко
- Для инструментов: form → конструкция, dosage → применение, side_effects → риски
- field_notes — самое важное поле: конкретика для полевых условий`;
      break;

    case "scenario":
      typePrompt = `На основе текста лекции создай ${count} ситуационных задач (сценариев).

Параметры:
- Компетенция: ${competencyName}
- Сложность: ${difficulty}

Формат ответа — JSON массив:
[
  {
    "situation": "Описание боевой ситуации: обстановка, тип ранения, состояние бойца, условия",
    "question": "Что нужно сделать?",
    "options": [
      { "text": "Вариант действий A", "is_correct": true },
      { "text": "Вариант действий B", "is_correct": false }
    ],
    "rationale": "Обоснование правильного ответа с привязкой к протоколам"
  }
]

Требования:
- Ситуации реалистичны для боевых условий в отдалённой местности
- Указаны конкретные витальные показатели (АД, ЧСС, SpO2)
- Время до эвакуации — ограничено
- Правильный ответ — по протоколам TCCC / тактической медицины
- 3-5 вариантов ответа на каждый сценарий`;
      break;

    default:
      typePrompt = `Создай ${count} учебных элементов на основе текста лекции. Формат: JSON массив.`;
  }

  let fullPrompt = SYSTEM_CONTEXT + "\n\n" + typePrompt;

  if (additionalInstructions && additionalInstructions.trim()) {
    fullPrompt += `\n\nДополнительные пожелания инструктора:\n${additionalInstructions.trim()}`;
  }

  fullPrompt += `\n\nТЕКСТ ЛЕКЦИИ:\n${lectureText}`;

  return fullPrompt;
}

// ═══════════════════════════════════════════════════
//  УТИЛИТЫ
// ═══════════════════════════════════════════════════

/**
 * Парсинг JSON из ответа Claude.
 * Claude может обернуть JSON в ```json ... ``` или добавить пояснения до/после.
 */
function parseClaudeJSON(text: string): unknown[] {
  let cleaned = text.trim();

  // Убираем markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```\s*$/i, "");
  cleaned = cleaned.trim();

  // Пробуем парсить напрямую
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (_) {
    // продолжаем
  }

  // Ищем JSON-массив в тексте
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const jsonStr = cleaned.substring(firstBracket, lastBracket + 1);
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (_) {
      // продолжаем
    }
  }

  // Ищем JSON-объект
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonStr);
      return [parsed];
    } catch (_) {
      // ничего не нашли
    }
  }

  return [];
}

/**
 * Простой хэш строки для дедупликации (не криптографический).
 */
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(text.length, 10000); i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}
