import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Проверить авторизацию
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // 2. Получить входные данные
    const { text, types, params, additional_instructions } = await req.json();

    // 3. Валидация
    if (!text || text.length < 100) {
      throw new Error("Текст слишком короткий (минимум 100 символов)");
    }
    if (!types || !Array.isArray(types) || types.length === 0) {
      throw new Error("Укажите хотя бы один тип контента");
    }

    // 4. Заглушка — вернуть тестовые данные
    // TODO: Фаза 3 — заменить на реальный вызов Claude API
    const generation_id = crypto.randomUUID();

    const mockItems = types.map((type: string) => ({
      id: crypto.randomUUID(),
      generation_id,
      type,
      content: getMockContent(type),
      status: "draft",
      instructor_id: user.id,
      created_at: new Date().toISOString(),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        generation_id,
        items: mockItems,
        message: "ЗАГЛУШКА: тестовые данные. Claude API будет подключён в Фазе 3.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

function getMockContent(type: string) {
  switch (type) {
    case "question":
      return {
        text: "[ТЕСТ] Какой препарат является первой линией обезболивания в полевых условиях?",
        options: [
          { text: "Кеторолак 30 мг в/м", is_correct: false },
          { text: "Кетамин 50 мг в/м", is_correct: true },
          { text: "Морфин 10 мг в/в", is_correct: false },
          { text: "Парацетамол 1000 мг per os", is_correct: false },
        ],
        explanation: "Тестовое пояснение — заглушка",
        difficulty: 2,
        category: "Обезболивание",
        module: "Фармакология",
      };
    case "drug":
      return {
        name_ru: "[ТЕСТ] Кетамин",
        name_lat: "Ketaminum",
        drug_group: "Анестетики",
        form: "Раствор для инъекций 50 мг/мл",
        dosage: "В/м: 4 мг/кг",
        indications: "Обезболивание при травмах",
        contraindications: "ЧМТ с повышенным ВЧД",
        side_effects: "Галлюцинации, тошнота",
        field_notes: "Тестовая заглушка",
      };
    case "flashcard":
      return {
        item_type: "instrument",
        name_ru: "[ТЕСТ] Турникет CAT",
        name_lat: "CAT Tourniquet",
        drug_group: "Жгуты и турникеты",
        form: "Одноразовый, ленточный",
        dosage: "На 5-7 см выше раны",
        indications: "Массивное кровотечение конечностей",
        contraindications: "Не на шею/туловище",
        side_effects: "Ишемия > 2 часов",
        field_notes: "Тестовая заглушка",
      };
    case "scenario":
      return {
        situation: "[ТЕСТ] Ночь, лесистая местность. Осколочное ранение правого бедра.",
        question: "Определите приоритетные действия.",
        options: [
          { text: "Турникет → Обезболить → Повязка", is_correct: true },
          { text: "Обезболить → Повязка → Эвакуация", is_correct: false },
        ],
        rationale: "Тестовое обоснование — заглушка",
      };
    default:
      return { message: "Неизвестный тип: " + type };
  }
}
