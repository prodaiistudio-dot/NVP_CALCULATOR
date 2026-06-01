// ============================================================
//  i18n.js — мови та тема
// ============================================================

const TRANSLATIONS = {
  uk: {
    // Viewer
    viewer_hint:      'Перетягніть для повороту · Scroll = zoom',
    expand_normal:    'Розширити перегляд',
    expand_wide:      'Максимум',
    expand_full:      'Згорнути',
    fullscreen_on:    'Повний екран',
    fullscreen_off:   'Вийти з повного екрану',
    // Left panel
    sel_empty:        'Виберіть комплектацію →',
    total_no_vat:     'Без ПДВ',
    total_with_vat:   'З ПДВ 20%',
    // Buttons
    btn_share:        'Поділитись',
    btn_pdf:          'Зберегти PDF',
    btn_reset:        'Скинути конфігурацію',
    // Contact form
    cf_title:         'Ваші контакти (необов\'язково)',
    cf_name:          'Ім\'я та прізвище',
    cf_company:       'Назва компанії',
    cf_phone:         'Телефон',
    cf_email:         'Email',
    btn_generate:     'Сформувати PDF',
    btn_skip:         'Пропустити та скачати',
    // Right panel badges
    badge_req:        'Обов\'язково',
    badge_opt:        'Необов\'язково',
    badge_multi:      'Можна вибрати кілька',
    // Cards
    detail_btn:       'Детальніше →',
    art:              'Арт.',
    included:         'Включено',
    included_long:    'Включено до комплекту',
    incompat:         'Несумісно',
    // Validation
    val_missing:      'Потрібно вибрати:',
    val_ok:           '✓ Готово до збереження',
    // Modal
    modal_add:        'Додати до комплектації',
    modal_remove:     'Прибрати з комплектації',
    modal_incompat:   'Несумісно з вибраним',
    specs_title:      'Характеристики',
    // Toast
    toast_copied:     'Посилання скопійовано! Надішліть клієнту.',
    toast_copy_hint:  'Скопіюйте посилання з адресного рядка',
    // PDF
    pdf_spec:         'СПЕЦИФІКАЦІЯ',
    pdf_client:       'Замовник:',
    pdf_tel:          'Тел.:',
    pdf_col_cat:      'Категорія',
    pdf_col_name:     'Найменування',
    pdf_col_sku:      'Артикул',
    pdf_col_price:    'Ціна',
    pdf_included:     'Включено',
    pdf_no_vat:       'Разом без ПДВ:',
    pdf_vat:          'ПДВ 20%:',
    pdf_with_vat:     'Разом з ПДВ:',
    pdf_footer:       'Специфікація від',
    // Theme
    theme_light:      'Світла тема',
    theme_dark:       'Темна тема',
  },

  ru: {
    viewer_hint:      'Перетащите для поворота · Scroll = зум',
    expand_normal:    'Расширить просмотр',
    expand_wide:      'Максимум',
    expand_full:      'Свернуть',
    fullscreen_on:    'Полный экран',
    fullscreen_off:   'Выйти из полного экрана',
    sel_empty:        'Выберите комплектацию →',
    total_no_vat:     'Без НДС',
    total_with_vat:   'С НДС 20%',
    btn_share:        'Поделиться',
    btn_pdf:          'Сохранить PDF',
    btn_reset:        'Сбросить конфигурацию',
    cf_title:         'Ваши контакты (необязательно)',
    cf_name:          'Имя и фамилия',
    cf_company:       'Название компании',
    cf_phone:         'Телефон',
    cf_email:         'Email',
    btn_generate:     'Сформировать PDF',
    btn_skip:         'Пропустить и скачать',
    badge_req:        'Обязательно',
    badge_opt:        'Необязательно',
    badge_multi:      'Можно выбрать несколько',
    detail_btn:       'Подробнее →',
    art:              'Арт.',
    included:         'Включено',
    included_long:    'Включено в комплект',
    incompat:         'Несовместимо',
    val_missing:      'Нужно выбрать:',
    val_ok:           '✓ Готово к сохранению',
    modal_add:        'Добавить в комплектацию',
    modal_remove:     'Убрать из комплектации',
    modal_incompat:   'Несовместимо с выбранным',
    specs_title:      'Характеристики',
    toast_copied:     'Ссылка скопирована! Отправьте клиенту.',
    toast_copy_hint:  'Скопируйте ссылку из адресной строки',
    pdf_spec:         'СПЕЦИФИКАЦИЯ',
    pdf_client:       'Заказчик:',
    pdf_tel:          'Тел.:',
    pdf_col_cat:      'Категория',
    pdf_col_name:     'Наименование',
    pdf_col_sku:      'Артикул',
    pdf_col_price:    'Цена',
    pdf_included:     'Включено',
    pdf_no_vat:       'Итого без НДС:',
    pdf_vat:          'НДС 20%:',
    pdf_with_vat:     'Итого с НДС:',
    pdf_footer:       'Спецификация от',
    theme_light:      'Светлая тема',
    theme_dark:       'Тёмная тема',
  },

  en: {
    viewer_hint:      'Drag to rotate · Scroll = zoom',
    expand_normal:    'Expand view',
    expand_wide:      'Maximum',
    expand_full:      'Collapse',
    fullscreen_on:    'Fullscreen',
    fullscreen_off:   'Exit fullscreen',
    sel_empty:        'Select configuration →',
    total_no_vat:     'Excl. VAT',
    total_with_vat:   'Incl. 20% VAT',
    btn_share:        'Share',
    btn_pdf:          'Save PDF',
    btn_reset:        'Reset configuration',
    cf_title:         'Your contacts (optional)',
    cf_name:          'Full name',
    cf_company:       'Company name',
    cf_phone:         'Phone',
    cf_email:         'Email',
    btn_generate:     'Generate PDF',
    btn_skip:         'Skip and download',
    badge_req:        'Required',
    badge_opt:        'Optional',
    badge_multi:      'Multiple selection',
    detail_btn:       'Details →',
    art:              'SKU',
    included:         'Included',
    included_long:    'Included in package',
    incompat:         'Incompatible',
    val_missing:      'Please select:',
    val_ok:           '✓ Ready to save',
    modal_add:        'Add to configuration',
    modal_remove:     'Remove from configuration',
    modal_incompat:   'Incompatible with selection',
    specs_title:      'Specifications',
    toast_copied:     'Link copied! Send to client.',
    toast_copy_hint:  'Copy the link from the address bar',
    pdf_spec:         'SPECIFICATION',
    pdf_client:       'Client:',
    pdf_tel:          'Tel.:',
    pdf_col_cat:      'Category',
    pdf_col_name:     'Item',
    pdf_col_sku:      'SKU',
    pdf_col_price:    'Price',
    pdf_included:     'Included',
    pdf_no_vat:       'Total excl. VAT:',
    pdf_vat:          'VAT 20%:',
    pdf_with_vat:     'Total incl. VAT:',
    pdf_footer:       'Specification dated',
    theme_light:      'Light theme',
    theme_dark:       'Dark theme',
  },
};

// ── Language ──────────────────────────────────────────────
let _lang = localStorage.getItem('cfg_lang') || 'uk';

function t(key) {
  return TRANSLATIONS[_lang]?.[key] ?? TRANSLATIONS.uk[key] ?? key;
}

function getLang()    { return _lang; }
function setLang(l)   {
  if (!TRANSLATIONS[l]) return;
  _lang = l;
  localStorage.setItem('cfg_lang', l);
}

// ── Theme ─────────────────────────────────────────────────
let _theme = 'light';

function getTheme() { return _theme; }

function applyTheme(theme) {
  _theme = theme;
  localStorage.setItem('cfg_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

function initTheme() {
  const saved   = localStorage.getItem('cfg_theme');
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (sysDark ? 'dark' : 'light'));
}

function toggleTheme() {
  applyTheme(_theme === 'dark' ? 'light' : 'dark');
}

// Категорія: отримати назву/опис у поточній мові
function catName(cat) {
  return cat._i18n?.[_lang]?.name ?? cat.name;
}
function catDesc(cat) {
  return cat._i18n?.[_lang]?.description ?? cat.description;
}

// Позиція: назва / опис / specs у поточній мові
function itemName(item) {
  return item._i18n?.[_lang]?.name ?? item.name;
}
function itemDesc(item) {
  return item._i18n?.[_lang]?.description ?? item.description;
}
function itemSpecs(item) {
  return item._i18n?.[_lang]?.specs ?? item.specs ?? {};
}
