# 3D Models — GLB format

## Format: GLB (binary glTF 2.0)

GLB — це стандарт "JPEG для 3D". Один файл = геометрія + матеріали + текстури.

## Naming convention

Назва файлу = ID позиції з data.js + `.glb`

### Базова мийка (завжди видима)
| Файл | Що це |
|------|-------|
| `sink-base.glb` | Основна мийка — countertop + чаша |

### Компоненти (з'являються при виборі)
| Файл | Категорія | Позиція в data.js |
|------|-----------|------------------|
| `bowl-compact.glb` | Чаша | bowl-compact |
| `bowl-standard.glb` | Чаша | bowl-standard |
| `bowl-xl.glb` | Чаша | bowl-xl |
| `faucet-classic.glb` | Змішувач | faucet-classic |
| `faucet-tall.glb` | Змішувач | faucet-tall |
| `faucet-sensor.glb` | Змішувач | faucet-sensor |
| `drain-standard.glb` | Злив | drain-standard |
| `drain-popup.glb` | Злив | drain-popup |
| `drain-slot.glb` | Злив | drain-slot |
| `acc-soap.glb` | Аксесуар | acc-soap |
| `acc-basket.glb` | Аксесуар | acc-basket |
| `acc-mirror.glb` | Аксесуар | acc-mirror |
| `inst-self.glb` | Монтаж | inst-self |
| `inst-standard.glb` | Монтаж | inst-standard |
| `inst-premium.glb` | Монтаж | inst-premium |

> Покриття (finish-chrome, finish-brushed, finish-black) не потребують GLB —
> вони тільки змінюють колір основної мийки.

## Scale (масштаб сцени)

Координатна система: **1 unit ≈ 0.16 м**

Основна мийка в сцені займає **~3.8 × 0.32 × 2.2 units**, що відповідає
реальному countertop приблизно **60 × 5 × 35 см**.

Рекомендований workflow:
1. Моделюйте в реальному масштабі (см або мм) у Blender
2. Під час експорту оберіть Scale = 0.0063 (якщо модель в мм) або 0.063 (якщо в см)
3. Або просто підберіть scale вручну в `data.js` через поле `c3d.modelScale`

## Як експортувати GLB

### Blender (рекомендовано, безкоштовно)
1. File → Export → glTF 2.0 (.glb/.gltf)
2. Format: **GLB**
3. Include: Mesh, Materials, Apply Modifiers ✓
4. Transform: Y Up ✓ (Three.js використовує Y-up)

### Інші програми
- **Fusion 360** → File → Export → `.glb`  
- **SketchUp** → плагін glTF Exporter  
- **Rhino** → плагін glTF-BinExporter  
- **Cinema 4D** → плагін GLTF Exporter  
- **3ds Max / Maya** → Autodesk glTF Exporter  

## Локальний запуск (обов'язково для GLB!)

Браузер блокує завантаження файлів через `file://`.
Для роботи GLB потрібен локальний сервер:

```bash
# Python (вбудований)
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code → встановіть "Live Server" extension
```

Після запуску відкрийте: **http://localhost:8080**

## Якщо GLB файл не знайдено

Viewer автоматично показує кольоровий 3D-блок (placeholder).
Замініть файл — і наступного завантаження з'явиться ваша модель.
