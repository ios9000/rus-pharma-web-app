/**
 * ═══════════════════════════════════════════════════════════════════════════
 * APPS SCRIPT - ФАРМАКОЛОГИЯ WEB APP
 * Версия 2.2 - Исправлен парсинг multiple-choice (correct: [0,2,3])
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ИНСТРУКЦИЯ ПО ОБНОВЛЕНИЮ:
 * 1. Откройте https://script.google.com/u/0/home/projects/1_KggqzoYaMSE1uWJkH88zFvJF96tLd6f3CGTUzIs7gbT2NcxTgR_AipV/edit
 * 2. ПОЛНОСТЬЮ замените содержимое файла Code.gs этим кодом
 * 3. Сохраните (Ctrl+S)
 * 4. Разверните: Развертывание → Управление развертываниями → Изменить → Новая версия → Развернуть
 */

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ - ОБРАБОТЧИК ЗАПРОСОВ
// ============================================================================

/**
 * Обработка GET запросов (включая JSONP для обхода CORS)
 */
/**
 * Обработка GET запросов (включая JSONP для обхода CORS)
 */

function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback;
  
  let result;
  
  try {
    switch (action) {
      // === ДАННЫЕ ===
      case 'getDrugs':
        result = JSON.parse(getDrugs());
        break;
        
      case 'getQuestions':
        result = JSON.parse(getQuestions());
        break;
        
      case 'getScenarios':
        result = JSON.parse(getScenarios());
        break;
        
      case 'getCards':
        result = JSON.parse(getCards());
        break;
        
      case 'getAllData':
        result = JSON.parse(getAllData());
        break;

      case 'getAll':
        result = JSON.parse(getAllData());
        break;  
      
      // === АВТОРИЗАЦИЯ ===
      case 'getGroup':
        result = getGroupByCode(e.parameter.code);
        break;
        
      case 'quickLogin':
        result = quickLogin(e.parameter.cadetId);
        break;
        
      case 'loadProgress':
        result = loadProgress(e.parameter.cadetId, e.parameter.lastSync);
        break;
        
      case 'getGroupCadets':
        result = getGroupCadets(e.parameter.code);
        break;
      
      case 'register':
        result = registerCadet(e.parameter.groupCode, e.parameter.fullName);
        break;
        
      case 'login':
        result = loginCadet(e.parameter.cadetId, e.parameter.pinCode);
        break;
        
      case 'saveProgress':
        const progressData = JSON.parse(e.parameter.progress || '[]');
        result = saveProgress(e.parameter.cadetId, progressData);
        break;
        
      case 'fullSync':
        const localProgress = JSON.parse(e.parameter.localProgress || '[]');
        result = fullSync(e.parameter.cadetId, localProgress, e.parameter.lastSyncTime);
        break;
        
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  const jsonOutput = JSON.stringify(result);
  
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonOutput + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  
  return ContentService.createTextOutput(jsonOutput)
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================================
// ОСНОВНАЯ ФУНКЦИЯ - ПОЛУЧЕНИЕ ВСЕХ ДАННЫХ
// ============================================================================

function getAllData() {
  try {
    const questionsResult = JSON.parse(getQuestionsWithCompetencies());
    const drugsResult = JSON.parse(getDrugs());
    const scenariosResult = JSON.parse(getCases());
    const competenciesResult = JSON.parse(getCompetencies());
    
    return JSON.stringify({
      questions: questionsResult.success ? questionsResult.data : [],
      drugs: drugsResult.success ? drugsResult.data : [],
      scenarios: scenariosResult.success ? scenariosResult.data : [],
      competencies: competenciesResult.success ? competenciesResult.data : [],
      settings: {
        version: '2.1',
        lastUpdate: new Date().toISOString()
      }
    });
    
  } catch (error) {
    return JSON.stringify({
      error: error.toString(),
      questions: [],
      drugs: [],
      scenarios: [],
      competencies: [],
      settings: {}
    });
  }
}


// ============================================================================
// КЛИНИЧЕСКИЕ КЕЙСЫ / СЦЕНАРИИ (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ============================================================================

/**
 * Получение сценариев с узлами для интерактивных кейсов
 * 
 * Структура листа "Сценарии":
 * Сценарий_ID | Узел_ID | Тип_узла | Заголовок | Описание | Картинка_URL | 
 * Состояние | АД | ЧСС | Доп_симптомы | 
 * Вариант_1 | Переход_1 | Эффект_1 | Вариант_2 | Переход_2 | Эффект_2 | Вариант_3 | Переход_3 | Эффект_3 |
 * Случайное_событие | Вероятность | Время_ограничение | Подсказка | Обучающий_материал
 */
function getCases() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Сценарии') || ss.getSheetByName('Кейсы') || ss.getSheetByName('Cases') || ss.getSheetByName('Scenarios');
    
    if (!sheet) {
      return JSON.stringify({ success: true, data: [], message: 'Лист сценариев не найден' });
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return JSON.stringify({ success: true, data: [] });
    }
    
    const headers = data[0].map(h => h.toString().toLowerCase().trim().replace(/\s+/g, '_'));
    
    // Маппинг колонок (поддержка разных названий)
    const colIdx = {
      scenarioId: findColumnIndex(headers, ['сценарий_id', 'scenario_id', 'сценарий', 'id_сценария']),
      nodeId: findColumnIndex(headers, ['узел_id', 'node_id', 'узел', 'id_узла']),
      nodeType: findColumnIndex(headers, ['тип_узла', 'node_type', 'тип']),
      title: findColumnIndex(headers, ['заголовок', 'title', 'название']),
      description: findColumnIndex(headers, ['описание', 'description', 'текст']),
      imageUrl: findColumnIndex(headers, ['картинка_url', 'image_url', 'картинка', 'изображение', 'image']),
      patientState: findColumnIndex(headers, ['состояние', 'state', 'patient_state']),
      bp: findColumnIndex(headers, ['ад', 'bp', 'давление']),
      hr: findColumnIndex(headers, ['чсс', 'hr', 'пульс']),
      symptoms: findColumnIndex(headers, ['доп_симптомы', 'symptoms', 'симптомы']),
      
      // Варианты выбора (до 3 вариантов)
      choice1Text: findColumnIndex(headers, ['вариант_1', 'choice_1', 'выбор_1']),
      choice1Next: findColumnIndex(headers, ['переход_1', 'next_1', 'goto_1']),
      choice1Effect: findColumnIndex(headers, ['эффект_1', 'effect_1']),
      
      choice2Text: findColumnIndex(headers, ['вариант_2', 'choice_2', 'выбор_2']),
      choice2Next: findColumnIndex(headers, ['переход_2', 'next_2', 'goto_2']),
      choice2Effect: findColumnIndex(headers, ['эффект_2', 'effect_2']),
      
      choice3Text: findColumnIndex(headers, ['вариант_3', 'choice_3', 'выбор_3']),
      choice3Next: findColumnIndex(headers, ['переход_3', 'next_3', 'goto_3']),
      choice3Effect: findColumnIndex(headers, ['эффект_3', 'effect_3']),
      
      // Дополнительные поля
      randomEvent: findColumnIndex(headers, ['случайное_событие', 'random_event', 'событие']),
      eventProbability: findColumnIndex(headers, ['вероятность', 'probability', 'шанс']),
      timeLimit: findColumnIndex(headers, ['время_ограничение', 'time_limit', 'таймер', 'время']),
      hint: findColumnIndex(headers, ['подсказка', 'hint']),
      material: findColumnIndex(headers, ['обучающий_материал', 'material', 'материал'])
    };
    
    // Группируем строки по Сценарий_ID
    const scenariosMap = {};
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      const scenarioId = colIdx.scenarioId !== -1 ? String(row[colIdx.scenarioId]).trim() : '';
      const nodeId = colIdx.nodeId !== -1 ? String(row[colIdx.nodeId]).trim() : '';
      
      // Пропускаем пустые строки
      if (!scenarioId || !nodeId) continue;
      
      // Создаём сценарий если не существует
      if (!scenariosMap[scenarioId]) {
        scenariosMap[scenarioId] = {
          id: scenarioId,
          nodes: {}
        };
      }
      
      // Собираем варианты выбора
      const choices = [];
      
      // Вариант 1
      if (colIdx.choice1Text !== -1 && row[colIdx.choice1Text]) {
        const text = String(row[colIdx.choice1Text]).trim();
        if (text) {
          choices.push({
            text: text,
            nextNode: colIdx.choice1Next !== -1 ? String(row[colIdx.choice1Next]).trim() : '',
            effect: colIdx.choice1Effect !== -1 ? parseNumber(row[colIdx.choice1Effect]) : 0
          });
        }
      }
      
      // Вариант 2
      if (colIdx.choice2Text !== -1 && row[colIdx.choice2Text]) {
        const text = String(row[colIdx.choice2Text]).trim();
        if (text) {
          choices.push({
            text: text,
            nextNode: colIdx.choice2Next !== -1 ? String(row[colIdx.choice2Next]).trim() : '',
            effect: colIdx.choice2Effect !== -1 ? parseNumber(row[colIdx.choice2Effect]) : 0
          });
        }
      }
      
      // Вариант 3
      if (colIdx.choice3Text !== -1 && row[colIdx.choice3Text]) {
        const text = String(row[colIdx.choice3Text]).trim();
        if (text) {
          choices.push({
            text: text,
            nextNode: colIdx.choice3Next !== -1 ? String(row[colIdx.choice3Next]).trim() : '',
            effect: colIdx.choice3Effect !== -1 ? parseNumber(row[colIdx.choice3Effect]) : 0
          });
        }
      }
      
      // Собираем витальные показатели
      const vitals = {};
      if (colIdx.bp !== -1 && row[colIdx.bp]) {
        vitals.bp = String(row[colIdx.bp]).trim();
      }
      if (colIdx.hr !== -1 && row[colIdx.hr]) {
        vitals.hr = parseNumber(row[colIdx.hr]);
      }
      if (colIdx.symptoms !== -1 && row[colIdx.symptoms]) {
        vitals.symptoms = String(row[colIdx.symptoms]).trim();
      }
      
      // Создаём узел
      const node = {
        id: nodeId,
        type: colIdx.nodeType !== -1 ? String(row[colIdx.nodeType]).trim() : '',
        title: colIdx.title !== -1 ? String(row[colIdx.title]).trim() : nodeId,
        description: colIdx.description !== -1 ? String(row[colIdx.description]).trim() : '',
        imageUrl: colIdx.imageUrl !== -1 ? String(row[colIdx.imageUrl]).trim() : '',
        patientState: colIdx.patientState !== -1 ? String(row[colIdx.patientState]).trim() : 'stable',
        vitals: vitals,
        choices: choices,
        randomEvent: colIdx.randomEvent !== -1 ? String(row[colIdx.randomEvent]).trim() : '',
        eventProbability: colIdx.eventProbability !== -1 ? parseNumber(row[colIdx.eventProbability]) : 0,
        timeLimit: colIdx.timeLimit !== -1 ? parseNumber(row[colIdx.timeLimit]) : 0,
        hint: colIdx.hint !== -1 ? String(row[colIdx.hint]).trim() : '',
        material: colIdx.material !== -1 ? String(row[colIdx.material]).trim() : ''
      };
      
      // Добавляем узел в сценарий
      scenariosMap[scenarioId].nodes[nodeId] = node;
    }
    
    // Преобразуем в массив
    const scenarios = Object.values(scenariosMap);
    
    return JSON.stringify({ 
      success: true, 
      data: scenarios,
      count: scenarios.length
    });
    
  } catch (error) {
    return JSON.stringify({ 
      success: false, 
      error: error.toString(), 
      data: [] 
    });
  }
}


// ============================================================================
// ВОПРОСЫ
// ============================================================================

function getQuestions() {
  return getQuestionsWithCompetencies();
}

function getQuestionsWithCompetencies() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Вопросы') || ss.getSheetByName('Questions');
    
    if (!sheet) {
      return JSON.stringify({ success: false, error: 'Лист "Вопросы" не найден', data: [] });
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return JSON.stringify({ success: true, data: [] });
    }
    
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    const colIdx = {
      id: findColumnIndex(headers, ['id', 'номер', '№']),
      question: findColumnIndex(headers, ['вопрос', 'question', 'текст', 'text']),
      answers: findColumnIndex(headers, ['ответы', 'answers', 'варианты', 'options']),
      correct: findColumnIndex(headers, ['правильный', 'correct', 'верный', 'answer']),
      image: findColumnIndex(headers, ['изображение', 'image', 'картинка', 'фото', 'img']),
      explanation: findColumnIndex(headers, ['пояснение', 'explanation', 'объяснение', 'комментарий']),
      competency: findColumnIndex(headers, ['компетенция', 'competency', 'навык']),
      section: findColumnIndex(headers, ['раздел', 'section', 'модуль']),
      difficulty: findColumnIndex(headers, ['сложность', 'difficulty', 'уровень', 'level']),
      category: findColumnIndex(headers, ['категория', 'category', 'тема'])
    };
    
    const questions = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      const questionText = colIdx.question !== -1 ? row[colIdx.question] : row[1];
      if (!questionText || questionText.toString().trim() === '') continue;
      
      const answersRaw = colIdx.answers !== -1 ? row[colIdx.answers] : row[2];
      const answers = parseAnswers(answersRaw);
      
      let correctAnswer = parseCorrectField(
        colIdx.correct !== -1 ? row[colIdx.correct] : row[3]
      );
      
      const question = {
        id: colIdx.id !== -1 ? (row[colIdx.id] || i) : i,
        question: questionText.toString().trim(),
        answers: answers,
        correct: correctAnswer,
        imageUrl: colIdx.image !== -1 ? (row[colIdx.image] || null) : null,
        explanation: colIdx.explanation !== -1 ? (row[colIdx.explanation] || '').toString().trim() : '',
        competency: colIdx.competency !== -1 ? (row[colIdx.competency] || '').toString().toUpperCase().trim() : '',
        section: colIdx.section !== -1 ? (parseInt(row[colIdx.section]) || null) : null,
        difficulty: colIdx.difficulty !== -1 ? (parseInt(row[colIdx.difficulty]) || 1) : 1,
        category: colIdx.category !== -1 ? (row[colIdx.category] || '') : ''
      };
      
      questions.push(question);
    }
    
    return JSON.stringify({ success: true, data: questions });
    
  } catch (error) {
    return JSON.stringify({ success: false, error: error.toString(), data: [] });
  }
}

function getTestQuestions(testType, sectionId) {
  try {
    const allQuestionsResult = JSON.parse(getQuestionsWithCompetencies());
    
    if (!allQuestionsResult.success) {
      return JSON.stringify(allQuestionsResult);
    }
    
    let questions = allQuestionsResult.data;
    
    if (testType === 'DIAGNOSTIC' || testType === 'FINAL') {
      // Все вопросы
    } else if (testType.startsWith('SECTION_')) {
      const targetSection = parseInt(testType.replace('SECTION_', ''));
      const competenciesForSection = getCompetenciesForSection(targetSection);
      
      questions = questions.filter(q => {
        return q.section === targetSection || 
               competenciesForSection.includes(q.competency);
      });
    } else if (testType === 'PRACTICE' && sectionId) {
      const targetCompetencies = sectionId.toString().split(',');
      questions = questions.filter(q => targetCompetencies.includes(q.competency));
    }
    
    return JSON.stringify({ 
      success: true, 
      data: questions,
      testType: testType,
      totalCount: questions.length
    });
    
  } catch (error) {
    return JSON.stringify({ success: false, error: error.toString(), data: [] });
  }
}


// ============================================================================
// ПРЕПАРАТЫ
// ============================================================================

function getDrugs() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Препараты') || ss.getSheetByName('Drugs') || ss.getSheetByName('Лекарства');
    
    if (!sheet) {
      return JSON.stringify({ success: true, data: [] });
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return JSON.stringify({ success: true, data: [] });
    }
    
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    const colIdx = {
      id: findColumnIndex(headers, ['id', 'номер', '№']),
      name: findColumnIndex(headers, ['название', 'name', 'препарат', 'drug']),
      category: findColumnIndex(headers, ['категория', 'category', 'группа', 'class']),
      dosage: findColumnIndex(headers, ['дозировка', 'dosage', 'доза', 'dose']),
      route: findColumnIndex(headers, ['путь', 'route', 'введение', 'способ']),
      indication: findColumnIndex(headers, ['показания', 'indication', 'применение']),
      contraindication: findColumnIndex(headers, ['противопоказания', 'contraindication']),
      sideEffects: findColumnIndex(headers, ['побочные', 'side effects', 'эффекты']),
      notes: findColumnIndex(headers, ['примечания', 'notes', 'заметки', 'комментарий']),
      image: findColumnIndex(headers, ['изображение', 'image', 'фото', 'фото_url', 'photo_url', 'картинка'])
    };
    
    const drugs = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = colIdx.name !== -1 ? row[colIdx.name] : row[1];
      
      if (!name || name.toString().trim() === '') continue;
      
      drugs.push({
        id: colIdx.id !== -1 ? (row[colIdx.id] || i) : i,
        name: name.toString().trim(),
        category: colIdx.category !== -1 ? (row[colIdx.category] || '') : '',
        dosage: colIdx.dosage !== -1 ? (row[colIdx.dosage] || '') : '',
        route: colIdx.route !== -1 ? (row[colIdx.route] || '') : '',
        indication: colIdx.indication !== -1 ? (row[colIdx.indication] || '') : '',
        contraindication: colIdx.contraindication !== -1 ? (row[colIdx.contraindication] || '') : '',
        sideEffects: colIdx.sideEffects !== -1 ? (row[colIdx.sideEffects] || '') : '',
        notes: colIdx.notes !== -1 ? (row[colIdx.notes] || '') : '',
        image: colIdx.image !== -1 ? (row[colIdx.image] || null) : null
      });
    }
    
    return JSON.stringify({ success: true, data: drugs });
    
  } catch (error) {
    return JSON.stringify({ success: false, error: error.toString(), data: [] });
  }
}


// ============================================================================
// ФЛЭШ-КАРТОЧКИ
// ============================================================================

function getCards() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Карточки') || ss.getSheetByName('Cards') || ss.getSheetByName('Флэшкарты');
    
    if (!sheet) {
      return JSON.stringify({ success: true, data: [] });
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return JSON.stringify({ success: true, data: [] });
    }
    
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    const colIdx = {
      id: findColumnIndex(headers, ['id', 'номер', '№']),
      front: findColumnIndex(headers, ['вопрос', 'front', 'лицевая', 'термин']),
      back: findColumnIndex(headers, ['ответ', 'back', 'оборотная', 'определение']),
      category: findColumnIndex(headers, ['категория', 'category', 'тема']),
      image: findColumnIndex(headers, ['изображение', 'image', 'фото']),
      competency: findColumnIndex(headers, ['компетенция', 'competency'])
    };
    
    const cards = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const front = colIdx.front !== -1 ? row[colIdx.front] : row[1];
      
      if (!front || front.toString().trim() === '') continue;
      
      cards.push({
        id: colIdx.id !== -1 ? (row[colIdx.id] || i) : i,
        front: front.toString().trim(),
        back: colIdx.back !== -1 ? (row[colIdx.back] || '') : (row[2] || ''),
        category: colIdx.category !== -1 ? (row[colIdx.category] || 'Общее') : 'Общее',
        image: colIdx.image !== -1 ? (row[colIdx.image] || null) : null,
        competency: colIdx.competency !== -1 ? (row[colIdx.competency] || '') : ''
      });
    }
    
    return JSON.stringify({ success: true, data: cards });
    
  } catch (error) {
    return JSON.stringify({ success: false, error: error.toString(), data: [] });
  }
}


// ============================================================================
// КОМПЕТЕНЦИИ
// ============================================================================

function getCompetencies() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Компетенции') || ss.getSheetByName('Competencies');
    
    if (!sheet) {
      return JSON.stringify({ 
        success: true, 
        data: getDefaultCompetencies(),
        source: 'default'
      });
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return JSON.stringify({ 
        success: true, 
        data: getDefaultCompetencies(),
        source: 'default'
      });
    }
    
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    const colIdx = {
      id: findColumnIndex(headers, ['id', 'код', 'идентификатор']),
      name: findColumnIndex(headers, ['название', 'name', 'наименование']),
      shortName: findColumnIndex(headers, ['краткое', 'short', 'сокращение']),
      icon: findColumnIndex(headers, ['иконка', 'icon', 'эмодзи']),
      sections: findColumnIndex(headers, ['разделы', 'sections', 'раздел']),
      color: findColumnIndex(headers, ['цвет', 'color']),
      description: findColumnIndex(headers, ['описание', 'description'])
    };
    
    const competencies = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const id = colIdx.id !== -1 ? row[colIdx.id] : '';
      
      if (!id || id.toString().trim() === '') continue;
      
      let sections = [];
      if (colIdx.sections !== -1 && row[colIdx.sections]) {
        const sectionsStr = row[colIdx.sections].toString();
        sections = sectionsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      }
      
      competencies.push({
        id: id.toString().toUpperCase().trim(),
        name: colIdx.name !== -1 ? (row[colIdx.name] || id) : id,
        shortName: colIdx.shortName !== -1 ? (row[colIdx.shortName] || id) : id,
        icon: colIdx.icon !== -1 ? (row[colIdx.icon] || '📌') : '📌',
        sections: sections,
        color: colIdx.color !== -1 ? (row[colIdx.color] || '#666666') : '#666666',
        description: colIdx.description !== -1 ? (row[colIdx.description] || '') : ''
      });
    }
    
    if (competencies.length === 0) {
      return JSON.stringify({ 
        success: true, 
        data: getDefaultCompetencies(),
        source: 'default'
      });
    }
    
    return JSON.stringify({ 
      success: true, 
      data: competencies,
      source: 'sheet'
    });
    
  } catch (error) {
    return JSON.stringify({ 
      success: false, 
      error: error.toString(),
      data: getDefaultCompetencies(),
      source: 'default'
    });
  }
}

function getDefaultCompetencies() {
  return [
    { id: 'HEMOSTASIS', name: 'Остановка кровотечений', shortName: 'Гемостаз', icon: '🩸', sections: [1, 2], color: '#dc3545', description: 'Методы остановки кровотечений' },
    { id: 'AIRWAY', name: 'Проходимость дыхательных путей', shortName: 'Дых. пути', icon: '🫁', sections: [1, 3], color: '#17a2b8', description: 'Восстановление проходимости ДП' },
    { id: 'ANALGESIA', name: 'Обезболивание', shortName: 'Анальгезия', icon: '💊', sections: [2, 4], color: '#6f42c1', description: 'Методы обезболивания' },
    { id: 'SHOCK', name: 'Противошоковая терапия', shortName: 'Шок', icon: '⚡', sections: [2, 3], color: '#fd7e14', description: 'Лечение травматического шока' },
    { id: 'WOUND_CARE', name: 'Обработка ран', shortName: 'Раны', icon: '🩹', sections: [3, 4], color: '#20c997', description: 'Обработка и уход за ранами' },
    { id: 'ANTIBIOTICS', name: 'Антибиотикотерапия', shortName: 'Антибиотики', icon: '💉', sections: [4], color: '#e83e8c', description: 'Антибиотикотерапия при ранениях' },
    { id: 'EVACUATION', name: 'Эвакуация', shortName: 'Эвакуация', icon: '🚑', sections: [1, 4], color: '#6c757d', description: 'Медицинская эвакуация' },
    { id: 'HYPOTHERMIA', name: 'Профилактика гипотермии', shortName: 'Гипотермия', icon: '🌡️', sections: [2, 3], color: '#007bff', description: 'Профилактика переохлаждения' }
  ];
}


// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

function findColumnIndex(headers, possibleNames) {
  for (let name of possibleNames) {
    const idx = headers.indexOf(name.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Парсинг поля "Правильный" (колонка E).
 *   Ячейка "2"     → 2          (число, single-choice)
 *   Ячейка "0,2,3" → [0, 2, 3]  (массив, multiple-choice)
 *   Ячейка  0      → 0          (число, если Sheets авто-конвертировал)
 */
function parseCorrectField(value) {
  if (value === null || value === undefined || value === '') return 0;

  var str = String(value).trim();

  if (str.indexOf(',') !== -1) {
    return str.split(',').map(function(s) { return Number(s.trim()); });
  }

  return Number(str);
}

function parseAnswers(answersRaw) {
  if (!answersRaw) return [];
  
  const str = answersRaw.toString();
  
  if (str.includes('|')) {
    return str.split('|').map(a => a.trim()).filter(a => a);
  }
  if (str.includes(';')) {
    return str.split(';').map(a => a.trim()).filter(a => a);
  }
  if (str.includes('\n')) {
    return str.split('\n').map(a => a.trim()).filter(a => a);
  }
  
  return [str.trim()];
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

function getCompetenciesForSection(section) {
  const sectionMap = {
    1: ['HEMOSTASIS', 'AIRWAY', 'EVACUATION'],
    2: ['HEMOSTASIS', 'ANALGESIA', 'SHOCK', 'HYPOTHERMIA'],
    3: ['AIRWAY', 'SHOCK', 'WOUND_CARE', 'HYPOTHERMIA'],
    4: ['ANALGESIA', 'WOUND_CARE', 'ANTIBIOTICS', 'EVACUATION']
  };
  
  return sectionMap[section] || [];
}


// ============================================================================
// ТЕСТОВАЯ ФУНКЦИЯ
// ============================================================================

function testAPI() {
  console.log('=== Тест API v2.1 ===');
  
  const allData = JSON.parse(getAllData());
  console.log('getAll:', {
    questions: allData.questions.length,
    drugs: allData.drugs.length,
    scenarios: allData.scenarios.length,
    competencies: allData.competencies.length
  });
  
  if (allData.scenarios.length > 0) {
    const firstScenario = allData.scenarios[0];
    console.log('Первый сценарий:', firstScenario.id);
    console.log('Узлы:', Object.keys(firstScenario.nodes));
    console.log('Есть START:', !!firstScenario.nodes['START']);
  }
  
  console.log('=== Тест завершён ===');
}

// ============================================
// МОДУЛЬ АВТОРИЗАЦИИ И СИНХРОНИЗАЦИИ
// Добавить в существующий Apps Script проект
// ============================================

// ID вашей таблицы (замените на свой)
const SPREADSHEET_ID = '13gFfDfpXoJmM-_UYt6WlylZtI4drqzIfk1a9k9mPoL4';

// Имена листов
const SHEETS = {
  GROUPS: 'Группы',
  CADETS: 'Курсанты', 
  PROGRESS: 'Прогресс',
  SYNC_LOG: 'СинхронизацияЛог'
};

// ============================================
// ИНИЦИАЛИЗАЦИЯ ЛИСТОВ
// ============================================

/**
 * Создаёт необходимые листы если их нет
 * Запустите эту функцию один раз для инициализации
 */
function initAuthSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Лист "Группы"
  let groupsSheet = ss.getSheetByName(SHEETS.GROUPS);
  if (!groupsSheet) {
    groupsSheet = ss.insertSheet(SHEETS.GROUPS);
    groupsSheet.getRange(1, 1, 1, 6).setValues([[
      'group_code', 'group_name', 'instructor', 'created_at', 'is_active', 'max_cadets'
    ]]);
    groupsSheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    groupsSheet.setFrozenRows(1);
  }
  
  // Лист "Курсанты"
  let cadetsSheet = ss.getSheetByName(SHEETS.CADETS);
  if (!cadetsSheet) {
    cadetsSheet = ss.insertSheet(SHEETS.CADETS);
    cadetsSheet.getRange(1, 1, 1, 8).setValues([[
      'cadet_id', 'group_code', 'full_name', 'pin_code', 'created_at', 'last_login', 'last_sync', 'is_active'
    ]]);
    cadetsSheet.getRange(1, 1, 1, 8).setFontWeight('bold');
    cadetsSheet.setFrozenRows(1);
  }
  
  // Лист "Прогресс"
  let progressSheet = ss.getSheetByName(SHEETS.PROGRESS);
  if (!progressSheet) {
    progressSheet = ss.insertSheet(SHEETS.PROGRESS);
    progressSheet.getRange(1, 1, 1, 9).setValues([[
      'id', 'cadet_id', 'data_type', 'data_key', 'data_value', 'timestamp', 'device_id', 'synced_at', 'version'
    ]]);
    progressSheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    progressSheet.setFrozenRows(1);
  }
  
  // Лист "СинхронизацияЛог"
  let logSheet = ss.getSheetByName(SHEETS.SYNC_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEETS.SYNC_LOG);
    logSheet.getRange(1, 1, 1, 5).setValues([[
      'timestamp', 'cadet_id', 'action', 'details', 'status'
    ]]);
    logSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    logSheet.setFrozenRows(1);
  }
  
  return { success: true, message: 'Листы инициализированы' };
}

// ============================================
// УПРАВЛЕНИЕ ГРУППАМИ (для Инструктора)
// ============================================

/**
 * Создание новой группы
 * @param {string} groupName - Название группы
 * @param {string} instructor - ФИО инструктора
 * @param {number} maxCadets - Максимум курсантов (по умолчанию 30)
 */
function createGroup(groupName, instructor, maxCadets = 30) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.GROUPS);
  
  // Генерируем уникальный код группы (6 символов)
  const groupCode = generateGroupCode();
  
  // Проверяем уникальность
  const existingCodes = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues().flat();
  if (existingCodes.includes(groupCode)) {
    return createGroup(groupName, instructor, maxCadets); // Рекурсивно генерируем новый
  }
  
  // Добавляем группу
  sheet.appendRow([
    groupCode,
    groupName,
    instructor,
    new Date().toISOString(),
    true,
    maxCadets
  ]);
  
  logAction('SYSTEM', 'CREATE_GROUP', `Создана группа: ${groupName}, код: ${groupCode}`);
  
  return {
    success: true,
    groupCode: groupCode,
    groupName: groupName,
    message: `Группа "${groupName}" создана. Код для курсантов: ${groupCode}`
  };
}

/**
 * Генерация кода группы (6 символов, буквы и цифры)
 */
function generateGroupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Без похожих символов (0,O,1,I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Получение информации о группе по коду
 */
function getGroupByCode(groupCode) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.GROUPS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupCode.toUpperCase()) {
      return {
        success: true,
        group: {
          code: data[i][0],
          name: data[i][1],
          instructor: data[i][2],
          createdAt: data[i][3],
          isActive: data[i][4],
          maxCadets: data[i][5]
        }
      };
    }
  }
  
  return { success: false, error: 'Группа не найдена' };
}

/**
 * Получение списка курсантов группы
 */
function getGroupCadets(groupCode) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CADETS);
  const data = sheet.getDataRange().getValues();
  
  const cadets = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === groupCode.toUpperCase() && data[i][7] === true) {
      cadets.push({
        id: data[i][0],
        name: data[i][2],
        lastLogin: data[i][5],
        lastSync: data[i][6]
      });
    }
  }
  
  return { success: true, cadets: cadets, count: cadets.length };
}

// ============================================
// РЕГИСТРАЦИЯ И АВТОРИЗАЦИЯ КУРСАНТА
// ============================================

/**
 * Регистрация нового курсанта
 * @param {string} groupCode - Код группы
 * @param {string} fullName - ФИО курсанта
 */
function registerCadet(groupCode, fullName) {
  // Проверяем группу
  const groupResult = getGroupByCode(groupCode);
  if (!groupResult.success) {
    return { success: false, error: 'Неверный код группы' };
  }
  
  if (!groupResult.group.isActive) {
    return { success: false, error: 'Группа неактивна' };
  }
  
  // Проверяем лимит курсантов
  const cadetsResult = getGroupCadets(groupCode);
  if (cadetsResult.count >= groupResult.group.maxCadets) {
    return { success: false, error: 'Достигнут лимит курсантов в группе' };
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CADETS);
  
  // Проверяем, нет ли уже такого курсанта в этой группе
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === groupCode.toUpperCase() && 
        data[i][2].toLowerCase() === fullName.toLowerCase().trim() &&
        data[i][7] === true) {
      return { 
        success: false, 
        error: 'Курсант с таким именем уже зарегистрирован в этой группе' 
      };
    }
  }
  
  // Генерируем ID и PIN
  const cadetId = generateCadetId();
  const pinCode = generatePinCode();
  const now = new Date().toISOString();
  
  // Добавляем курсанта
  sheet.appendRow([
    cadetId,
    groupCode.toUpperCase(),
    fullName.trim(),
    pinCode,
    now,
    now,
    null,
    true
  ]);
  
  logAction(cadetId, 'REGISTER', `Регистрация в группе ${groupCode}`);
  
  return {
    success: true,
    cadetId: cadetId,
    pinCode: pinCode,
    fullName: fullName.trim(),
    groupCode: groupCode.toUpperCase(),
    groupName: groupResult.group.name,
    message: `Регистрация успешна! Ваш PIN-код: ${pinCode}. Запомните его для входа.`
  };
}

/**
 * Авторизация курсанта по ID и PIN
 */
function loginCadet(cadetId, pinCode) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CADETS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === cadetId && String(data[i][3]) === String(pinCode) && data[i][7] === true) {
      // Обновляем время последнего входа
      sheet.getRange(i + 1, 6).setValue(new Date().toISOString());
      
      // Получаем информацию о группе
      const groupResult = getGroupByCode(data[i][1]);
      
      logAction(cadetId, 'LOGIN', 'Успешный вход');
      
      return {
        success: true,
        cadet: {
          id: data[i][0],
          groupCode: data[i][1],
          fullName: data[i][2],
          groupName: groupResult.success ? groupResult.group.name : 'Неизвестно',
          lastSync: data[i][6]
        }
      };
    }
  }
  
  return { success: false, error: 'Неверный ID или PIN-код' };
}

/**
 * Быстрый вход по ID (для автологина с сохранённым ID)
 */
function quickLogin(cadetId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CADETS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === cadetId && data[i][7] === true) {
      // Обновляем время последнего входа
      sheet.getRange(i + 1, 6).setValue(new Date().toISOString());
      
      const groupResult = getGroupByCode(data[i][1]);
      
      return {
        success: true,
        cadet: {
          id: data[i][0],
          groupCode: data[i][1],
          fullName: data[i][2],
          groupName: groupResult.success ? groupResult.group.name : 'Неизвестно',
          lastSync: data[i][6]
        }
      };
    }
  }
  
  return { success: false, error: 'Курсант не найден' };
}

/**
 * Генерация ID курсанта
 */
function generateCadetId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `C${timestamp}${random}`.toUpperCase();
}

/**
 * Генерация PIN-кода (4 цифры)
 */
function generatePinCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// ============================================
// СИНХРОНИЗАЦИЯ ПРОГРЕССА
// ============================================

/**
 * Сохранение прогресса курсанта
 * @param {string} cadetId - ID курсанта
 * @param {Array} progressData - Массив данных прогресса
 */
function saveProgress(cadetId, progressData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.PROGRESS);
  const now = new Date().toISOString();
  
  let savedCount = 0;
  
  for (const item of progressData) {
    // Проверяем, есть ли уже такая запись
    const existingRow = findProgressRow(sheet, cadetId, item.dataType, item.dataKey);
    
    if (existingRow > 0) {
      // Обновляем существующую запись если версия новее
      const existingVersion = sheet.getRange(existingRow, 9).getValue() || 0;
      if (item.version > existingVersion) {
        sheet.getRange(existingRow, 5).setValue(item.dataValue);
        sheet.getRange(existingRow, 6).setValue(item.timestamp);
        sheet.getRange(existingRow, 7).setValue(item.deviceId || 'unknown');
        sheet.getRange(existingRow, 8).setValue(now);
        sheet.getRange(existingRow, 9).setValue(item.version);
        savedCount++;
      }
    } else {
      // Добавляем новую запись
      const id = Utilities.getUuid();
      sheet.appendRow([
        id,
        cadetId,
        item.dataType,
        item.dataKey,
        item.dataValue,
        item.timestamp,
        item.deviceId || 'unknown',
        now,
        item.version || 1
      ]);
      savedCount++;
    }
  }
  
  // Обновляем время последней синхронизации курсанта
  updateCadetLastSync(cadetId, now);
  
  logAction(cadetId, 'SYNC_SAVE', `Сохранено записей: ${savedCount}`);
  
  return { 
    success: true, 
    savedCount: savedCount,
    syncTime: now
  };
}

/**
 * Загрузка прогресса курсанта
 * @param {string} cadetId - ID курсанта
 * @param {string} lastSyncTime - Время последней синхронизации (опционально)
 */
function loadProgress(cadetId, lastSyncTime = null) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.PROGRESS);
  const data = sheet.getDataRange().getValues();
  
  const progress = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === cadetId) {
      // Если указано время последней синхронизации, берём только новые записи
      if (lastSyncTime) {
        const recordTime = new Date(data[i][7]);
        const lastSync = new Date(lastSyncTime);
        if (recordTime <= lastSync) continue;
      }
      
      progress.push({
        dataType: data[i][2],
        dataKey: data[i][3],
        dataValue: data[i][4],
        timestamp: data[i][5],
        version: data[i][8]
      });
    }
  }
  
  logAction(cadetId, 'SYNC_LOAD', `Загружено записей: ${progress.length}`);
  
  return {
    success: true,
    progress: progress,
    count: progress.length,
    serverTime: new Date().toISOString()
  };
}

/**
 * Полная синхронизация (загрузка + сохранение)
 */
function fullSync(cadetId, localProgress, lastSyncTime) {
  // Сначала сохраняем локальные данные
  const saveResult = saveProgress(cadetId, localProgress);
  
  // Затем загружаем серверные данные
  const loadResult = loadProgress(cadetId, lastSyncTime);
  
  return {
    success: true,
    saved: saveResult.savedCount,
    loaded: loadResult.count,
    serverProgress: loadResult.progress,
    syncTime: new Date().toISOString()
  };
}

/**
 * Поиск строки прогресса
 */
function findProgressRow(sheet, cadetId, dataType, dataKey) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === cadetId && data[i][2] === dataType && data[i][3] === dataKey) {
      return i + 1; // Номер строки (1-based)
    }
  }
  return -1;
}

/**
 * Обновление времени последней синхронизации курсанта
 */
function updateCadetLastSync(cadetId, syncTime) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CADETS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === cadetId) {
      sheet.getRange(i + 1, 7).setValue(syncTime);
      break;
    }
  }
}

// ============================================
// ЛОГИРОВАНИЕ
// ============================================

function logAction(cadetId, action, details) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEETS.SYNC_LOG);
    sheet.appendRow([
      new Date().toISOString(),
      cadetId,
      action,
      details,
      'OK'
    ]);
  } catch (e) {
    console.error('Ошибка логирования:', e);
  }
}

// ============================================
// WEB API (doPost)
// ============================================


/**
 * Обработка POST запросов
 */
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  
  let result;
  
  try {
    switch (action) {
      case 'register':
        result = registerCadet(data.groupCode, data.fullName);
        break;
        
      case 'login':
        result = loginCadet(data.cadetId, data.pinCode);
        break;
        
      case 'saveProgress':
        result = saveProgress(data.cadetId, data.progress);
        break;
        
      case 'fullSync':
        result = fullSync(data.cadetId, data.localProgress, data.lastSyncTime);
        break;
        
      case 'createGroup':
        result = createGroup(data.groupName, data.instructor, data.maxCadets);
        break;
        
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

