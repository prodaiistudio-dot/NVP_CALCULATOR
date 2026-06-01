// ============================================================
//  data.js — дані конфігуратора з перекладами
//  _i18n: { ru: {...}, en: {...} }  ← перекриває uk-поля
// ============================================================

const COMPANY = {
  name: "Aqua Design Studio",
  logo: "images/logo.png",
  phone: "+380 44 123-45-67",
  email: "info@aquadesign.ua",
  website: "www.aquadesign.ua",
  currency: "₴",
  currencyName: "грн",
};

const CATEGORIES = [
  {
    id: "bowl",
    name: "Чаша мийки",
    icon: "🚿",
    color: "#3b82f6",
    description: "Розмір та тип чаші раковини",
    required: true,
    multiSelect: false,
    _i18n: {
      ru: { name: "Чаша мойки",   description: "Размер и тип чаши раковины" },
      en: { name: "Sink Bowl",     description: "Basin size and type" },
    },
    items: [
      {
        id: "bowl-compact",
        name: "Compact 400",
        sku: "BW-400",
        description: "Компактна вбудована мийка для невеликих ванних кімнат. Кераміка преміум-класу, глибина чаші 16 см.",
        specs: { "Розмір": "400×300 мм", "Глибина": "160 мм", "Матеріал": "Санітарна кераміка", "Монтаж": "Накладний" },
        _i18n: {
          ru: {
            description: "Компактная встраиваемая мойка для небольших ванных комнат. Керамика премиум-класса, глубина чаши 16 см.",
            specs: { "Размер": "400×300 мм", "Глубина": "160 мм", "Материал": "Санитарная керамика", "Монтаж": "Накладной" },
          },
          en: {
            description: "Compact built-in sink for small bathrooms. Premium ceramic, basin depth 16 cm.",
            specs: { "Size": "400×300 mm", "Depth": "160 mm", "Material": "Sanitary ceramic", "Installation": "Surface-mount" },
          },
        },
        price: 3800,
        image: "images/bowl-compact.jpg",
        c3d: { role: "model", model: "models/bowl-compact.glb", position: [0, 0.4, 0], size: [100, 0.44, 1.55], color: 0x3b82f6 },
        incompatible: [],
      },
      {
        id: "bowl-standard",
        name: "Standard 600",
        sku: "BW-600",
        description: "Класична прямокутна раковина. Оптимальні розміри, переливний отвір.",
        specs: { "Розмір": "600×450 мм", "Глибина": "185 мм", "Матеріал": "Вітрифікована кераміка", "Монтаж": "Накладний" },
        _i18n: {
          ru: {
            description: "Классическая прямоугольная раковина. Оптимальные размеры, перелив.",
            specs: { "Размер": "600×450 мм", "Глубина": "185 мм", "Материал": "Витрифицированная керамика", "Монтаж": "Накладной" },
          },
          en: {
            description: "Classic rectangular sink. Optimal dimensions, overflow hole.",
            specs: { "Size": "600×450 mm", "Depth": "185 mm", "Material": "Vitrified ceramic", "Installation": "Surface-mount" },
          },
        },
        price: 5600,
        image: "images/bowl-standard.jpg",
        c3d: { role: "model", model: "models/bowl-standard.glb", position: [0, 0.4, 0], size: [100.0, 1.44, 1.85], color: 0x3b82f6 },
        incompatible: [],
      },
      {
        id: "bowl-xl",
        name: "XL Double 800",
        sku: "BW-800",
        description: "Широка подвійна мийка з двома чашами. Ідеально для сімейних ванних кімнат.",
        specs: { "Розмір": "800×500 мм", "Глибина": "200 мм", "Матеріал": "Кераміка + кварц", "Монтаж": "Вбудований" },
        _i18n: {
          ru: {
            description: "Широкая двойная мойка с двумя чашами. Идеально для семейных ванных комнат.",
            specs: { "Размер": "800×500 мм", "Глубина": "200 мм", "Материал": "Керамика + кварц", "Монтаж": "Встраиваемый" },
          },
          en: {
            description: "Wide double sink with two basins. Perfect for family bathrooms.",
            specs: { "Size": "800×500 mm", "Depth": "200 mm", "Material": "Ceramic + quartz", "Installation": "Undermount" },
          },
        },
        price: 9200,
        image: "images/bowl-xl.jpg",
        c3d: { role: "model", model: "models/bowl-xl.glb", position: [0, 0.4, 0], size: [100.0, 0.44, 2.1], color: 0x3b82f6 },
        incompatible: [],
      },
    ],
  },

  {
    id: "faucet",
    name: "Змішувач",
    icon: "🚰",
    color: "#8b5cf6",
    description: "Тип та стиль змішувача",
    required: true,
    multiSelect: false,
    _i18n: {
      ru: { name: "Смеситель",  description: "Тип и стиль смесителя" },
      en: { name: "Faucet",     description: "Faucet type and style" },
    },
    items: [
      {
        id: "faucet-classic",
        name: "Classic Single",
        sku: "FC-CLS",
        description: "Однорукоятковий змішувач у класичному стилі. Хромоване покриття, кераміковий картридж 40 мм.",
        specs: { "Тип": "Однорукоятковий", "Покриття": "Хром", "Картридж": "Кераміковий 40 мм", "Тиск": "1–5 бар" },
        _i18n: {
          ru: {
            description: "Однорычажный смеситель в классическом стиле. Хромированное покрытие, керамический картридж 40 мм.",
            specs: { "Тип": "Однорычажный", "Покрытие": "Хром", "Картридж": "Керамический 40 мм", "Давление": "1–5 бар" },
          },
          en: {
            description: "Single-lever faucet in classic style. Chrome finish, ceramic cartridge 40 mm.",
            specs: { "Type": "Single-lever", "Finish": "Chrome", "Cartridge": "Ceramic 40 mm", "Pressure": "1–5 bar" },
          },
        },
        price: 2400,
        image: "images/faucet-classic.jpg",
        c3d: { role: "addon", shape: "cylinder", position: [0, 0.58, -0.92], size: [0.22, 0.8, 0.22], color: 0x8b5cf6 },
        incompatible: [],
      },
      {
        id: "faucet-tall",
        name: "Tower Tall",
        sku: "FC-TWR",
        description: "Високий змішувач-вежа у скандинавському стилі. Матовий нікель, поворот 360°.",
        specs: { "Тип": "Високий (310 мм)", "Покриття": "Матовий нікель", "Поворот": "360°", "Тиск": "0.5–8 бар" },
        _i18n: {
          ru: {
            description: "Высокий смеситель-башня в скандинавском стиле. Матовый никель, поворот 360°.",
            specs: { "Тип": "Высокий (310 мм)", "Покрытие": "Матовый никель", "Поворот": "360°", "Давление": "0.5–8 бар" },
          },
          en: {
            description: "Tall tower faucet in Scandinavian style. Brushed nickel, 360° swivel.",
            specs: { "Type": "Tall (310 mm)", "Finish": "Brushed nickel", "Swivel": "360°", "Pressure": "0.5–8 bar" },
          },
        },
        price: 4900,
        image: "images/faucet-tall.jpg",
        c3d: { role: "addon", shape: "cylinder", position: [0, 0.8, -0.92], size: [0.16, 1.3, 0.16], color: 0x8b5cf6 },
        incompatible: [],
      },
      {
        id: "faucet-sensor",
        name: "Sensor Touch",
        sku: "FC-SNS",
        description: "Сенсорний безконтактний змішувач. Живлення від батарейок AA або мережі 220В.",
        specs: { "Тип": "Сенсорний", "Покриття": "Хром + чорний матовий", "Живлення": "4×AA / 220В", "Захист": "IP67" },
        _i18n: {
          ru: {
            description: "Сенсорный бесконтактный смеситель. Питание от батареек AA или сети 220В.",
            specs: { "Тип": "Сенсорный", "Покрытие": "Хром + чёрный матовый", "Питание": "4×AA / 220В", "Защита": "IP67" },
          },
          en: {
            description: "Touchless sensor faucet. Powered by AA batteries or 220V mains.",
            specs: { "Type": "Touchless sensor", "Finish": "Chrome + matte black", "Power": "4×AA / 220V", "Rating": "IP67" },
          },
        },
        price: 8700,
        image: "images/faucet-sensor.jpg",
        c3d: { role: "addon", shape: "box", position: [0, 0.38, -0.9], size: [0.52, 0.44, 0.32], color: 0x8b5cf6 },
        incompatible: [],
      },
    ],
  },

  {
    id: "drain",
    name: "Зливна система",
    icon: "⬇️",
    color: "#f59e0b",
    description: "Зливний клапан та сифон",
    required: true,
    multiSelect: false,
    _i18n: {
      ru: { name: "Сливная система", description: "Сливной клапан и сифон" },
      en: { name: "Drain System",    description: "Drain valve and trap" },
    },
    items: [
      {
        id: "drain-standard",
        name: "Стандартний злив",
        sku: "DR-STD",
        description: "Класичний пробковий злив із накидною гайкою. Нержавіюча сталь.",
        specs: { "Тип": "Пробковий", "Матеріал": "Нержавіюча сталь", "Діаметр": "32 мм", "Сифон": "У комплекті" },
        _i18n: {
          ru: {
            name: "Стандартный слив",
            description: "Классический пробковый слив с накидной гайкой. Нержавеющая сталь.",
            specs: { "Тип": "Пробковый", "Материал": "Нержавеющая сталь", "Диаметр": "32 мм", "Сифон": "В комплекте" },
          },
          en: {
            name: "Standard Drain",
            description: "Classic plug drain with union nut. Stainless steel.",
            specs: { "Type": "Plug drain", "Material": "Stainless steel", "Diameter": "32 mm", "Trap": "Included" },
          },
        },
        price: 650,
        image: "images/drain-standard.jpg",
        c3d: { role: "addon", shape: "cylinder", position: [0, -0.34, 0.14], size: [0.28, 0.1, 0.28], color: 0xf59e0b },
        incompatible: [],
      },
      {
        id: "drain-popup",
        name: "Pop-Up автоматичний",
        sku: "DR-POP",
        description: "Автоматичний підйомний зливний клапан. Відкривається натисканням.",
        specs: { "Тип": "Pop-up (click-clack)", "Матеріал": "Латунь хром", "Діаметр": "32 мм", "Керування": "Натисканням" },
        _i18n: {
          ru: {
            name: "Pop-Up автоматический",
            description: "Автоматический подъёмный сливной клапан. Открывается нажатием.",
            specs: { "Тип": "Pop-up (click-clack)", "Материал": "Латунь хром", "Диаметр": "32 мм", "Управление": "Нажатием" },
          },
          en: {
            name: "Pop-Up Automatic",
            description: "Automatic click-clack drain valve. Opens by pressing.",
            specs: { "Type": "Pop-up (click-clack)", "Material": "Chrome brass", "Diameter": "32 mm", "Control": "Push" },
          },
        },
        price: 1200,
        image: "images/drain-popup.jpg",
        c3d: { role: "addon", shape: "cylinder", position: [0, -0.3, 0.14], size: [0.22, 0.2, 0.22], color: 0xf59e0b },
        incompatible: [],
      },
      {
        id: "drain-slot",
        name: "Slot Linear Drain",
        sku: "DR-SLT",
        description: "Лінійний слотовий злив — невидимий ефект. Мінімалістичний вигляд.",
        specs: { "Тип": "Лінійний прихований", "Матеріал": "Нержавіюча сталь AISI 316", "Пропускна здатність": "25 л/хв" },
        _i18n: {
          ru: {
            description: "Линейный слотовый слив — невидимый эффект. Минималистичный вид.",
            specs: { "Тип": "Линейный скрытый", "Материал": "Нержавеющая сталь AISI 316", "Пропускная способность": "25 л/мин" },
          },
          en: {
            description: "Linear slot drain — invisible effect. Minimalist look.",
            specs: { "Type": "Linear hidden", "Material": "Stainless steel AISI 316", "Flow rate": "25 l/min" },
          },
        },
        price: 2800,
        image: "images/drain-slot.jpg",
        c3d: { role: "addon", shape: "box", position: [0, -0.36, 0.14], size: [0.8, 0.07, 0.16], color: 0xf59e0b },
        incompatible: [],
      },
    ],
  },

  {
    id: "finish",
    name: "Покриття",
    icon: "✨",
    color: "#10b981",
    description: "Колір та матеріал поверхні",
    required: false,
    multiSelect: false,
    _i18n: {
      ru: { name: "Покрытие",  description: "Цвет и материал поверхности" },
      en: { name: "Finish",    description: "Surface color and material" },
    },
    items: [
      {
        id: "finish-chrome",
        name: "Хром глянець",
        sku: "FN-CHR",
        description: "Класичне дзеркальне хромування. Підходить до будь-якого інтер'єру.",
        specs: { "Покриття": "PVD хром", "Блиск": "Дзеркальний", "Гарантія": "15 років" },
        _i18n: {
          ru: {
            name: "Хром глянец",
            description: "Классическое зеркальное хромирование. Подходит к любому интерьеру.",
            specs: { "Покрытие": "PVD хром", "Блеск": "Зеркальный", "Гарантия": "15 лет" },
          },
          en: {
            name: "Chrome gloss",
            description: "Classic mirror chrome finish. Fits any interior style.",
            specs: { "Finish": "PVD chrome", "Gloss": "Mirror", "Warranty": "15 years" },
          },
        },
        price: 0,
        image: "images/finish-chrome.jpg",
        c3d: { role: "finish", sinkColor: 0xe8ecf2, bowlColor: 0xd4d8e0 },
        incompatible: [],
      },
      {
        id: "finish-brushed",
        name: "Нікель матовий",
        sku: "FN-NBR",
        description: "Матове сатинове покриття нікелем. Не залишає відбитків пальців.",
        specs: { "Покриття": "PVD нікель матовий", "Блиск": "Матовий", "Гарантія": "15 років" },
        _i18n: {
          ru: {
            name: "Никель матовый",
            description: "Матовое сатиновое покрытие никелем. Не оставляет отпечатков пальцев.",
            specs: { "Покрытие": "PVD никель матовый", "Блеск": "Матовый", "Гарантия": "15 лет" },
          },
          en: {
            name: "Brushed nickel",
            description: "Matte satin nickel finish. Fingerprint-resistant.",
            specs: { "Finish": "PVD brushed nickel", "Gloss": "Matte", "Warranty": "15 years" },
          },
        },
        price: 1800,
        image: "images/finish-brushed.jpg",
        c3d: { role: "finish", sinkColor: 0xd4c89a, bowlColor: 0xc2b480 },
        incompatible: [],
      },
      {
        id: "finish-black",
        name: "Чорний матовий",
        sku: "FN-BLK",
        description: "Елегантне чорне матове покриття. Трендовий вибір дизайнерів.",
        specs: { "Покриття": "PVD чорний матовий", "Блиск": "Матовий", "Гарантія": "10 років" },
        _i18n: {
          ru: {
            name: "Чёрный матовый",
            description: "Элегантное чёрное матовое покрытие. Трендовый выбор дизайнеров.",
            specs: { "Покрытие": "PVD чёрный матовый", "Блеск": "Матовый", "Гарантия": "10 лет" },
          },
          en: {
            name: "Matte black",
            description: "Elegant matte black finish. A trendy designer choice.",
            specs: { "Finish": "PVD matte black", "Gloss": "Matte", "Warranty": "10 years" },
          },
        },
        price: 2400,
        image: "images/finish-black.jpg",
        c3d: { role: "finish", sinkColor: 0x2d3038, bowlColor: 0x1e2228 },
        incompatible: [],
      },
    ],
  },

  {
    id: "accessories",
    name: "Аксесуари",
    icon: "🧴",
    color: "#ef4444",
    description: "Додаткові опції — дозатор, кошик, дзеркало",
    required: false,
    multiSelect: true,
    _i18n: {
      ru: { name: "Аксессуары", description: "Дополнительные опции — дозатор, корзина, зеркало" },
      en: { name: "Accessories", description: "Add-ons — dispenser, basket, mirror" },
    },
    items: [
      {
        id: "acc-soap",
        name: "Дозатор для мила",
        sku: "AC-SOAP",
        description: "Вбудований дозатор рідкого мила. Ємність 300 мл.",
        specs: { "Ємність": "300 мл", "Матеріал": "Латунь + ABS", "Монтаж": "Вбудований" },
        _i18n: {
          ru: {
            name: "Дозатор для мыла",
            description: "Встроенный дозатор жидкого мыла. Ёмкость 300 мл.",
            specs: { "Ёмкость": "300 мл", "Материал": "Латунь + ABS", "Монтаж": "Встроенный" },
          },
          en: {
            name: "Soap dispenser",
            description: "Built-in liquid soap dispenser. Capacity 300 ml.",
            specs: { "Capacity": "300 ml", "Material": "Brass + ABS", "Installation": "Built-in" },
          },
        },
        price: 1100,
        image: "images/acc-soap.jpg",
        c3d: { role: "addon", shape: "cylinder", position: [1.6, 0.36, -0.55], size: [0.2, 0.5, 0.2], color: 0xef4444 },
        incompatible: [],
      },
      {
        id: "acc-basket",
        name: "Кошик для губки",
        sku: "AC-BSKT",
        description: "Навісний кошик із нержавіючої сталі. Кріпиться без свердління.",
        specs: { "Матеріал": "Нержавіюча сталь AISI 304", "Навантаження": "до 2 кг", "Монтаж": "Без свердління" },
        _i18n: {
          ru: {
            name: "Корзина для губки",
            description: "Навесная корзина из нержавеющей стали. Крепится без сверления.",
            specs: { "Материал": "Нержавеющая сталь AISI 304", "Нагрузка": "до 2 кг", "Монтаж": "Без сверления" },
          },
          en: {
            name: "Sponge basket",
            description: "Wall-mounted stainless steel basket. No-drill installation.",
            specs: { "Material": "Stainless steel AISI 304", "Load": "up to 2 kg", "Installation": "No-drill" },
          },
        },
        price: 680,
        image: "images/acc-basket.jpg",
        c3d: { role: "addon", shape: "wireframe", position: [1.72, -0.06, 0.22], size: [0.2, 0.28, 0.48], color: 0xef4444 },
        incompatible: [],
      },
      {
        id: "acc-mirror",
        name: "Дзеркало з підсвіткою",
        sku: "AC-MIR",
        description: "Кругле LED-дзеркало ∅600 мм з сенсорним вимикачем та антизапотіванням.",
        specs: { "Діаметр": "600 мм", "Підсвітка": "LED 24W", "Температура": "3000–6000K", "Функція": "Антизапотівання" },
        _i18n: {
          ru: {
            name: "Зеркало с подсветкой",
            description: "Круглое LED-зеркало ∅600 мм с сенсорным выключателем и антизапотеванием.",
            specs: { "Диаметр": "600 мм", "Подсветка": "LED 24W", "Температура": "3000–6000K", "Функция": "Антизапотевание" },
          },
          en: {
            name: "LED mirror",
            description: "Round LED mirror ∅600 mm with touch switch and anti-fog function.",
            specs: { "Diameter": "600 mm", "Backlight": "LED 24W", "Color temp": "3000–6000K", "Feature": "Anti-fog" },
          },
        },
        price: 3400,
        image: "images/acc-mirror.jpg",
        c3d: { role: "addon", shape: "box", position: [0, 2.3, -1.18], size: [1.7, 1.7, 0.07], color: 0xef4444 },
        incompatible: [],
      },
    ],
  },

  {
    id: "installation",
    name: "Встановлення",
    icon: "🔧",
    color: "#6366f1",
    description: "Тип монтажу та сервісний пакет",
    required: false,
    multiSelect: false,
    _i18n: {
      ru: { name: "Установка",    description: "Тип монтажа и сервисный пакет" },
      en: { name: "Installation", description: "Installation type and service package" },
    },
    items: [
      {
        id: "inst-self",
        name: "Без встановлення",
        sku: "IN-SELF",
        description: "Тільки комплект обладнання з інструкцією та всіма кріпленнями.",
        specs: { "Послуга": "Лише постачання", "Інструкція": "UA/RU/EN", "Кріплення": "У комплекті", "Гарантія": "12 місяців" },
        _i18n: {
          ru: {
            name: "Без установки",
            description: "Только комплект оборудования с инструкцией и всеми крепежами.",
            specs: { "Услуга": "Только поставка", "Инструкция": "UA/RU/EN", "Крепёж": "В комплекте", "Гарантия": "12 месяцев" },
          },
          en: {
            name: "No installation",
            description: "Equipment kit only with manual and all fixings included.",
            specs: { "Service": "Supply only", "Manual": "UA/RU/EN", "Fixings": "Included", "Warranty": "12 months" },
          },
        },
        price: 0,
        image: "images/inst-self.jpg",
        c3d: { role: "addon", shape: "box", position: [0, -0.8, 0], size: [4.0, 0.1, 2.35], color: 0x6366f1 },
        incompatible: [],
      },
      {
        id: "inst-standard",
        name: "Стандартне встановлення",
        sku: "IN-STD",
        description: "Монтаж майстром протягом 1–3 днів. Підключення, регулювання, перевірка.",
        specs: { "Термін": "1–3 дні", "Включає": "Монтаж + підключення", "Гарантія": "24 місяці" },
        _i18n: {
          ru: {
            name: "Стандартная установка",
            description: "Монтаж мастером за 1–3 дня. Подключение, регулировка, проверка.",
            specs: { "Срок": "1–3 дня", "Включает": "Монтаж + подключение", "Гарантия": "24 месяца" },
          },
          en: {
            name: "Standard installation",
            description: "Installation by a technician in 1–3 days. Connection, adjustment, testing.",
            specs: { "Lead time": "1–3 days", "Includes": "Fitting + connection", "Warranty": "24 months" },
          },
        },
        price: 2200,
        image: "images/inst-standard.jpg",
        c3d: { role: "addon", shape: "box", position: [0, -0.78, 0], size: [4.3, 0.16, 2.5], color: 0x6366f1 },
        incompatible: [],
      },
      {
        id: "inst-premium",
        name: "Преміум монтаж",
        sku: "IN-PRM",
        description: "Встановлення дизайнером з підготовкою ніші та прибиранням після монтажу.",
        specs: { "Термін": "1 день", "Включає": "Весь комплекс", "Гарантія": "36 місяців", "Прибирання": "Включено" },
        _i18n: {
          ru: {
            name: "Премиум монтаж",
            description: "Установка дизайнером с подготовкой ниши и уборкой после монтажа.",
            specs: { "Срок": "1 день", "Включает": "Весь комплекс", "Гарантия": "36 месяцев", "Уборка": "Включена" },
          },
          en: {
            name: "Premium installation",
            description: "Designer installation with niche preparation and post-install cleanup.",
            specs: { "Lead time": "1 day", "Includes": "Full scope", "Warranty": "36 months", "Cleanup": "Included" },
          },
        },
        price: 5500,
        image: "images/inst-premium.jpg",
        c3d: { role: "addon", shape: "box", position: [0, -0.76, 0], size: [4.6, 0.22, 2.65], color: 0x6366f1 },
        incompatible: [],
      },
    ],
  },
];
