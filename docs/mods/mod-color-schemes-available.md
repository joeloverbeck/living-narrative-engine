# Mod Color Schemes - Available for New Mods

## Overview

This document provides all available WCAG 2.1 AA compliant color schemes ready for use in new Living Narrative Engine mods. All color combinations are pre-validated for accessibility and ready for immediate use in action visual properties.

**Looking for existing assignments?** See [mod-color-schemes-used.md](./mod-color-schemes-used.md) for schemes currently in use.

## Requirements

- **WCAG 2.1 AA**: Minimum 4.5:1 contrast ratio for normal text
- **WCAG 2.1 AAA**: 7:1+ contrast ratio (marked with AAA)
- All combinations tested for both normal and hover states

## Current Status

**Total Schemes Defined**: 58
**In Use**: 48 schemes actively implemented
**Available**: 10 schemes ready for new mods

## Quick Reference: Available Schemes by Category

| Section | Scheme Name       | Background Color | Best For                                    |
| ------- | ----------------- | ---------------- | ------------------------------------------- |
| 1.2     | Slate Grey        | `#37474f`        | Administrative actions, settings            |
| 2.1     | Bold Red          | `#c62828`        | Combat, aggressive actions                  |
| 6.1     | Amber Warning     | `#ff6f00`        | Caution actions, moderate warnings          |
| 6.2     | Dark Red Alert    | `#b71c1c`        | Critical alerts, dangerous actions          |
| 8.1     | Pure Black & White| `#000000`        | Maximum accessibility                       |
| 8.2     | White & Black     | `#ffffff`        | Light theme high contrast                   |
| 8.3     | Yellow on Black   | `#000000`        | High visibility                             |
| 14.2    | Humble Bronze     | `#4b2f14`        | Reverent gestures, respectful submissions   |
| 17.2    | Hazy Smoke        | `#3d3a3f`        | Smoking, inhaling substances                |

## Available Color Scheme Definitions

### 1. Neutral/System Colors

#### 1.2 Slate Grey

```json
{
  "backgroundColor": "#37474f",
  "textColor": "#eceff1",
  "hoverBackgroundColor": "#546e7a",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 10.34:1 AAA
- **Hover Contrast**: 5.92:1 AA
- **Use Cases**: Administrative actions, settings, configuration
- **Theme**: Modern, sophisticated, calm

### 2. Action/Combat Colors

#### 2.1 Bold Red

```json
{
  "backgroundColor": "#c62828",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#d32f2f",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 7.13:1 AAA
- **Hover Contrast**: 5.25:1 AA
- **Use Cases**: Combat, aggressive actions, critical alerts
- **Theme**: Danger, power, intensity

### 6. Warning/Alert Colors

#### 6.1 Amber Warning

```json
{
  "backgroundColor": "#ff6f00",
  "textColor": "#000000",
  "hoverBackgroundColor": "#ff8f00",
  "hoverTextColor": "#000000"
}
```

- **Normal Contrast**: 5.94:1 AA
- **Hover Contrast**: 7.28:1 AAA
- **Use Cases**: Caution actions, moderate warnings, attention
- **Theme**: Alert, attention, caution

#### 6.2 Dark Red Alert

```json
{
  "backgroundColor": "#b71c1c",
  "textColor": "#ffebee",
  "hoverBackgroundColor": "#c62828",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 8.41:1 AAA
- **Hover Contrast**: 7.13:1 AAA
- **Use Cases**: Critical alerts, dangerous actions, urgent
- **Theme**: Urgent, critical, immediate

### 8. High Contrast Options

#### 8.1 Pure Black & White

```json
{
  "backgroundColor": "#000000",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#212121",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 21:1 AAA
- **Hover Contrast**: 15.54:1 AAA
- **Use Cases**: Maximum accessibility, vision impairment support
- **Theme**: Ultimate clarity, maximum contrast

#### 8.2 White & Black

```json
{
  "backgroundColor": "#ffffff",
  "textColor": "#000000",
  "hoverBackgroundColor": "#f5f5f5",
  "hoverTextColor": "#212121"
}
```

- **Normal Contrast**: 21:1 AAA
- **Hover Contrast**: 15.54:1 AAA
- **Use Cases**: Light theme high contrast
- **Theme**: Clean, clear, accessible

#### 8.3 Yellow on Black

```json
{
  "backgroundColor": "#000000",
  "textColor": "#ffeb3b",
  "hoverBackgroundColor": "#212121",
  "hoverTextColor": "#fff59d"
}
```

- **Normal Contrast**: 17.75:1 AAA
- **Hover Contrast**: 15.42:1 AAA
- **Use Cases**: High visibility, attention grabbing
- **Theme**: Maximum visibility, alertness

### 14. Honor/Deference Colors

#### 14.2 Humble Bronze

```json
{
  "backgroundColor": "#4b2f14",
  "textColor": "#fff3e0",
  "hoverBackgroundColor": "#3b230f",
  "hoverTextColor": "#ffe7c2"
}
```

- **Normal Contrast**: 11.16:1 AAA
- **Hover Contrast**: 12.18:1 AAA
- **Use Cases**: Quiet reverence, service oaths, humble acknowledgements of hierarchy
- **Theme**: Warm bronze and cream palette that keeps focus on respectful intent

### 17. Intoxicants/Vice Colors

#### 17.2 Hazy Smoke

```json
{
  "backgroundColor": "#3d3a3f",
  "textColor": "#e8e5eb",
  "hoverBackgroundColor": "#504c52",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.18:1 AAA
- **Hover Contrast**: 6.82:1 AA
- **Use Cases**: Smoking, inhaling substances, drug-related actions
- **Theme**: Smoky purple-gray evoking haze, pipe smoke, and altered states

## Implementation Guide

### Using in Action Files

Add the `visual` property to your action definition:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "your_mod:action_name",
  "name": "Action Name",
  "visual": {
    "backgroundColor": "#455a64",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#37474f",
    "hoverTextColor": "#ffffff"
  }
}
```

### Selection Guidelines

1. **Match action intent**: Choose colors that reflect the action's nature
   - Combat/Violence: Reds, dark crimsons
   - Healing/Nature: Greens
   - Social/Trust: Teals, blues
   - Magic/Mystery: Purples
   - Energy/Excitement: Oranges

2. **Maintain mod consistency**: Use the same scheme throughout a mod when possible

3. **Prioritize accessibility**: All schemes meet WCAG AA; prefer AAA when possible

4. **Test in context**: Verify colors work with your UI and other visual elements

### Validation

Validate your color schemes using the project's validation script:

```bash
node scripts/validateVisualContrast.js
```

## Color Psychology Reference

### By Color Family

| Color Family  | Psychological Association           | Best Used For                                  |
| ------------- | ----------------------------------- | ---------------------------------------------- |
| Red tones     | Danger, urgency, power, passion     | Combat, violence, critical actions             |
| Blue tones    | Trust, calm, information, stability | Social actions, information, navigation        |
| Green tones   | Growth, success, nature, healing    | Environmental actions, healing, success states |
| Purple tones  | Magic, mystery, luxury, creativity  | Arcane abilities, special powers, intimacy     |
| Orange/Yellow | Energy, attention, warmth, caution  | Energy actions, warnings, excitement           |
| Grey/Black    | Neutral, professional, balanced     | System actions, utilities, backgrounds         |
| Brown tones   | Earthy, stable, practical, reliable | Crafting, items, physical objects              |
| Teal/Cyan     | Discovery, exploration, precision   | Navigation, exploration, focused actions       |

### Design Principles

- **Contrast is critical**: Never rely on color alone to differentiate actions
- **Context matters**: Same color can evoke different feelings based on saturation and surrounding elements
- **Cultural awareness**: Color meanings vary across cultures; document intent clearly
- **Accessibility first**: Always verify contrast ratios before implementation

## Additional Color Suggestions

The following are alternative color suggestions that may be useful for specific contexts but are not part of the validated scheme set. **Use with caution and validate contrast ratios.**

### General Purpose Alternatives

```json
// Defensive Green (alternative to Forest Green)
{
  "backgroundColor": "#2e7d32",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#388e3c",
  "hoverTextColor": "#c8e6c9"
}

// Tech Blue (alternative to Ocean Blue)
{
  "backgroundColor": "#01579b",
  "textColor": "#e1f5fe",
  "hoverBackgroundColor": "#0277bd",
  "hoverTextColor": "#ffffff"
}

// Investigation Brown (alternative to Earth Brown)
{
  "backgroundColor": "#5d4037",
  "textColor": "#efebe9",
  "hoverBackgroundColor": "#6d4c41",
  "hoverTextColor": "#ffffff"
}
```

**Note**: These alternatives should be validated for WCAG compliance before use in production.

## When You've Chosen a Scheme

After selecting an available scheme for your mod:

1. Update this document to mark the scheme as "IN USE"
2. Move the scheme definition to [mod-color-schemes-used.md](./mod-color-schemes-used.md)
3. Add your mod to the Quick Reference table in that document
4. Run validation: `node scripts/validateVisualContrast.js`

## Adding New Schemes

When adding new color schemes:

1. Validate WCAG compliance (minimum AA 4.5:1)
2. Add to appropriate category section
3. Include contrast ratios and use cases
4. Update status tables
5. Run validation script

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/#contrast-minimum)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Project validation script: `/scripts/validateVisualContrast.js`
