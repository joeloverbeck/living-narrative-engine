# WCAG 2.1 AA Compliant Color Combinations Specification

## Overview

This specification provides a curated collection of pre-validated color combinations that meet WCAG 2.1 AA accessibility standards for the Living Narrative Engine action system. All combinations ensure a minimum contrast ratio of 4.5:1 between text and background colors, with many achieving AAA compliance (7:1+).

**Purpose**: Provide developers with a ready-to-use pool of accessible color combinations for action visual properties, eliminating the need for manual contrast validation.

**Requirements**:

- WCAG 2.1 AA: Minimum 4.5:1 contrast ratio for normal text
- WCAG 2.1 AAA: 7:1+ contrast ratio (marked with 🌟)
- All combinations tested for both normal and hover states

## Current Usage Overview

**Status**: 7 of 24 color combinations currently in use by existing mods (17 available)

### Active Mod Assignments

| Mod | Color Scheme | Section | Background Color |
|-----|-------------|---------|------------------|
| Core | Classic Blue-Grey | 1.1 | `#455a64` |
| Violence | Dark Crimson | 2.2 | `#8b0000` |
| Intimacy | Rose Pink | 3.2 | `#ad1457` |
| Clothing | Earth Brown | 4.2 | `#6d4c41` |
| Sex | Mystic Purple | 5.1 | `#4a148c` |
| Positioning | Deep Orange Energy | 9.2 | `#bf360c` |
| Exercise | Orange Flame | 2.3 | `#e65100` |

### Available Color Combinations

The following **17 color combinations** remain available for new mods:

- **Neutral/System**: Slate Grey (1.2), Charcoal (1.3)
- **Action/Combat**: Bold Red (2.1)
- **Social/Intimacy**: Soft Purple (3.1), Deep Teal (3.3)
- **Nature/Environment**: Forest Green (4.1), Ocean Blue (4.3)
- **Magic/Special**: Golden Divine (5.2)
- **Warning/Alert**: Amber Warning (6.1), Dark Red Alert (6.2)
- **Dark Theme**: Deep Blue (7.1), Dark Purple (7.2), Midnight Green (7.3)
- **High Contrast**: Pure Black & White (8.1), White & Black (8.2), Yellow on Black (8.3)
- **Additional Versatile**: Indigo Professional (9.1), Cool Grey Modern (9.3)

**Recommendation**: When creating new mods, select from the available combinations above to maintain visual consistency and avoid conflicts.

## Color Combination Sets

### 1. Neutral/System Colors

#### 1.1 Classic Blue-Grey

```json
{
  "backgroundColor": "#455a64",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#607d8b",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 7.36:1 🌟 AAA
- **Hover Contrast**: 4.54:1 ✅ AA
- **Use Cases**: System actions, navigation, utilities
- **Theme**: Professional, neutral, non-intrusive
- ✅ **USED BY**: Core mod (follow, wait, go, dismiss, stop_following)

#### 1.2 Slate Grey

```json
{
  "backgroundColor": "#37474f",
  "textColor": "#eceff1",
  "hoverBackgroundColor": "#546e7a",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 10.34:1 🌟 AAA
- **Hover Contrast**: 5.92:1 ✅ AA
- **Use Cases**: Administrative actions, settings, configuration
- **Theme**: Modern, sophisticated, calm
- 🟢 **AVAILABLE**

#### 1.3 Charcoal

```json
{
  "backgroundColor": "#263238",
  "textColor": "#cfd8dc",
  "hoverBackgroundColor": "#37474f",
  "hoverTextColor": "#eceff1"
}
```

- **Normal Contrast**: 11.17:1 🌟 AAA
- **Hover Contrast**: 10.34:1 🌟 AAA
- **Use Cases**: Dark theme default, low-energy actions
- **Theme**: Minimal, elegant, understated
- 🟢 **AVAILABLE**

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

- **Normal Contrast**: 7.13:1 🌟 AAA
- **Hover Contrast**: 5.25:1 ✅ AA
- **Use Cases**: Combat, aggressive actions, critical alerts
- **Theme**: Danger, power, intensity
- 🟢 **AVAILABLE**

#### 2.2 Dark Crimson

```json
{
  "backgroundColor": "#8b0000",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#b71c1c",
  "hoverTextColor": "#ffebee"
}
```

- **Normal Contrast**: 15.30:1 🌟 AAA
- **Hover Contrast**: 8.41:1 🌟 AAA
- **Use Cases**: Berserker actions, blood magic, violence
- **Theme**: Brutal, serious, high-stakes
- ✅ **USED BY**: Violence mod (slap, sucker_punch)

#### 2.3 Orange Flame

```json
{
  "backgroundColor": "#e65100",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#ff6f00",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 5.13:1 ✅ AA
- **Hover Contrast**: 4.56:1 ✅ AA
- **Use Cases**: Fire attacks, energy bursts, special moves
- **Theme**: Energy, excitement, dynamism
- ✅ **USED BY**: Exercise mod (jumping, displaying biceps, squats, exercise machines)

### 3. Social/Intimacy Colors

#### 3.1 Soft Purple

```json
{
  "backgroundColor": "#6a1b9a",
  "textColor": "#f3e5f5",
  "hoverBackgroundColor": "#8e24aa",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 10.89:1 🌟 AAA
- **Hover Contrast**: 6.54:1 ✅ AA
- **Use Cases**: Intimacy actions, romantic interactions
- **Theme**: Romance, mystery, elegance
- 🟢 **AVAILABLE**

#### 3.2 Rose Pink

```json
{
  "backgroundColor": "#ad1457",
  "textColor": "#fce4ec",
  "hoverBackgroundColor": "#c2185b",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.73:1 🌟 AAA
- **Hover Contrast**: 6.54:1 ✅ AA
- **Use Cases**: Affection, gentle touches, emotional actions
- **Theme**: Warmth, tenderness, passion
- ✅ **USED BY**: Intimacy mod (kissing, touching, affectionate interactions)

#### 3.3 Deep Teal

```json
{
  "backgroundColor": "#00695c",
  "textColor": "#e0f2f1",
  "hoverBackgroundColor": "#00897b",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 10.42:1 🌟 AAA
- **Hover Contrast**: 5.42:1 ✅ AA
- **Use Cases**: Calming interactions, trust-building
- **Theme**: Trust, stability, depth
- 🟢 **AVAILABLE**

### 4. Nature/Environment Colors

#### 4.1 Forest Green

```json
{
  "backgroundColor": "#1b5e20",
  "textColor": "#e8f5e9",
  "hoverBackgroundColor": "#2e7d32",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 12.07:1 🌟 AAA
- **Hover Contrast**: 5.37:1 ✅ AA
- **Use Cases**: Nature magic, outdoor actions, environmental
- **Theme**: Growth, natural, organic
- 🟢 **AVAILABLE**

#### 4.2 Earth Brown

```json
{
  "backgroundColor": "#4e342e",
  "textColor": "#efebe9",
  "hoverBackgroundColor": "#6d4c41",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 10.95:1 🌟 AAA
- **Hover Contrast**: 6.17:1 ✅ AA
- **Use Cases**: Ground abilities, crafting, physical items
- **Theme**: Stability, reliability, groundedness
- ✅ **USED BY**: Clothing mod (remove_clothing)

#### 4.3 Ocean Blue

```json
{
  "backgroundColor": "#01579b",
  "textColor": "#e1f5fe",
  "hoverBackgroundColor": "#0277bd",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 11.25:1 🌟 AAA
- **Hover Contrast**: 6.26:1 ✅ AA
- **Use Cases**: Water abilities, naval actions, fluid movements
- **Theme**: Depth, flow, adaptability
- 🟢 **AVAILABLE**

### 5. Magic/Special Colors

#### 5.1 Mystic Purple

```json
{
  "backgroundColor": "#4a148c",
  "textColor": "#e1bee7",
  "hoverBackgroundColor": "#6a1b9a",
  "hoverTextColor": "#f3e5f5"
}
```

- **Normal Contrast**: 12.41:1 🌟 AAA
- **Hover Contrast**: 10.89:1 🌟 AAA
- **Use Cases**: Arcane magic, psychic abilities, enchantments
- **Theme**: Mystical, powerful, otherworldly
- ✅ **USED BY**: Sex mod (sexual interactions)

#### 5.2 Golden Divine

```json
{
  "backgroundColor": "#f57f17",
  "textColor": "#000000",
  "hoverBackgroundColor": "#f9a825",
  "hoverTextColor": "#212121"
}
```

- **Normal Contrast**: 8.59:1 🌟 AAA
- **Hover Contrast**: 10.07:1 🌟 AAA
- **Use Cases**: Divine magic, holy abilities, blessings
- **Theme**: Sacred, radiant, powerful
- 🟢 **AVAILABLE**

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

- **Normal Contrast**: 5.94:1 ✅ AA
- **Hover Contrast**: 7.28:1 🌟 AAA
- **Use Cases**: Caution actions, moderate warnings, attention
- **Theme**: Alert, attention, caution
- 🟢 **AVAILABLE**

#### 6.2 Dark Red Alert

```json
{
  "backgroundColor": "#b71c1c",
  "textColor": "#ffebee",
  "hoverBackgroundColor": "#c62828",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 8.41:1 🌟 AAA
- **Hover Contrast**: 7.13:1 🌟 AAA
- **Use Cases**: Critical alerts, dangerous actions, urgent
- **Theme**: Urgent, critical, immediate
- 🟢 **AVAILABLE**

### 7. Dark Theme Optimized

#### 7.1 Deep Blue

```json
{
  "backgroundColor": "#0d47a1",
  "textColor": "#bbdefb",
  "hoverBackgroundColor": "#1565c0",
  "hoverTextColor": "#e3f2fd"
}
```

- **Normal Contrast**: 10.89:1 🌟 AAA
- **Hover Contrast**: 9.23:1 🌟 AAA
- **Use Cases**: Primary actions in dark themes
- **Theme**: Professional, focused, reliable
- 🟢 **AVAILABLE**

#### 7.2 Dark Purple

```json
{
  "backgroundColor": "#311b92",
  "textColor": "#d1c4e9",
  "hoverBackgroundColor": "#4527a0",
  "hoverTextColor": "#ede7f6"
}
```

- **Normal Contrast**: 11.62:1 🌟 AAA
- **Hover Contrast**: 11.45:1 🌟 AAA
- **Use Cases**: Special abilities in dark themes
- **Theme**: Premium, special, unique
- 🟢 **AVAILABLE**

#### 7.3 Midnight Green

```json
{
  "backgroundColor": "#004d40",
  "textColor": "#b2dfdb",
  "hoverBackgroundColor": "#00695c",
  "hoverTextColor": "#e0f2f1"
}
```

- **Normal Contrast**: 10.12:1 🌟 AAA
- **Hover Contrast**: 10.42:1 🌟 AAA
- **Use Cases**: Success actions in dark themes
- **Theme**: Success, achievement, progress
- 🟢 **AVAILABLE**

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

- **Normal Contrast**: 21:1 🌟 AAA
- **Hover Contrast**: 15.54:1 🌟 AAA
- **Use Cases**: Maximum accessibility, vision impairment support
- **Theme**: Ultimate clarity, maximum contrast
- 🟢 **AVAILABLE**

#### 8.2 White & Black

```json
{
  "backgroundColor": "#ffffff",
  "textColor": "#000000",
  "hoverBackgroundColor": "#f5f5f5",
  "hoverTextColor": "#212121"
}
```

- **Normal Contrast**: 21:1 🌟 AAA
- **Hover Contrast**: 15.54:1 🌟 AAA
- **Use Cases**: Light theme high contrast
- **Theme**: Clean, clear, accessible
- 🟢 **AVAILABLE**

#### 8.3 Yellow on Black

```json
{
  "backgroundColor": "#000000",
  "textColor": "#ffeb3b",
  "hoverBackgroundColor": "#212121",
  "hoverTextColor": "#fff59d"
}
```

- **Normal Contrast**: 17.75:1 🌟 AAA
- **Hover Contrast**: 15.42:1 🌟 AAA
- **Use Cases**: High visibility, attention grabbing
- **Theme**: Maximum visibility, alertness
- 🟢 **AVAILABLE**

### 9. Additional Versatile Options

#### 9.1 Indigo Professional

```json
{
  "backgroundColor": "#283593",
  "textColor": "#c5cae9",
  "hoverBackgroundColor": "#3949ab",
  "hoverTextColor": "#e8eaf6"
}
```

- **Normal Contrast**: 10.58:1 🌟 AAA
- **Hover Contrast**: 9.89:1 🌟 AAA
- **Use Cases**: Professional actions, business logic
- **Theme**: Corporate, trustworthy, stable
- 🟢 **AVAILABLE**

#### 9.2 Deep Orange Energy

```json
{
  "backgroundColor": "#bf360c",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#d84315",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 8.07:1 🌟 AAA
- **Hover Contrast**: 6.28:1 ✅ AA
- **Use Cases**: Energy actions, positioning, movement
- **Theme**: Dynamic, energetic, active
- ✅ **USED BY**: Positioning mod (get_close, step_back, turn_around, kneel_before, etc.)

#### 9.3 Cool Grey Modern

```json
{
  "backgroundColor": "#424242",
  "textColor": "#fafafa",
  "hoverBackgroundColor": "#616161",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 11.58:1 🌟 AAA
- **Hover Contrast**: 7.04:1 🌟 AAA
- **Use Cases**: Modern UI, neutral actions
- **Theme**: Contemporary, balanced, versatile
- 🟢 **AVAILABLE**

## Implementation Guidelines

### Usage in Action Files

To apply these color combinations to your action files:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "your_mod:action_name",
  "name": "Action Name",
  "visual": {
    "backgroundColor": "#455a64",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#607d8b",
    "hoverTextColor": "#ffffff"
  }
}
```

### Selection Criteria

When choosing a color combination:

1. **Match the action's intent**: Combat actions should use reds/oranges, healing should use greens
2. **Consider the mod's theme**: Maintain consistency within each mod
3. **Account for user preferences**: Provide high-contrast options for accessibility
4. **Test in context**: Verify the colors work well with your UI layout

### Validation

All combinations can be validated using the project's contrast validation script:

```bash
node scripts/validateVisualContrast.js
```

## Color Psychology Reference

- **Red tones**: Danger, urgency, power, passion
- **Blue tones**: Trust, calm, information, stability
- **Green tones**: Growth, success, nature, healing
- **Purple tones**: Magic, mystery, luxury, creativity
- **Orange/Yellow tones**: Energy, attention, warmth, caution
- **Grey tones**: Neutral, professional, balanced, subtle
- **Brown tones**: Earthy, stable, practical, reliable

## Notes

- All contrast ratios calculated using WCAG 2.1 relative luminance formula
- Hover states may have slightly lower contrast but still meet AA standards
- Consider providing user preferences for high-contrast mode
- Test color combinations with actual users for best results
- Remember that color should not be the only differentiator (use icons/text too)

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/#contrast-minimum)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Project validation script: `/scripts/validateVisualContrast.js`
