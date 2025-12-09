# Mod Color Schemes - Complete Reference

## Overview

This document provides the complete collection of WCAG 2.1 AA compliant color schemes for the Living Narrative Engine mod system. All color combinations are pre-validated for accessibility and ready for immediate use in action visual properties.

**Purpose**: Serve as the single source of truth for color scheme selection when creating or updating mods.

**Requirements**:

- WCAG 2.1 AA: Minimum 4.5:1 contrast ratio for normal text
- WCAG 2.1 AAA: 7:1+ contrast ratio (marked with 🌟)
- All combinations tested for both normal and hover states

## Current Status

**Total Schemes**: 50 defined color combinations
**In Use**: 36 schemes actively implemented across mods
**Available**: 14 schemes ready for future mods

## Quick Reference: Mod Assignments

| Mod                     | Color Scheme        | Section | Background Color | Status |
| ----------------------- | ------------------- | ------- | ---------------- | ------ |
| Affection               | Soft Purple         | 3.1     | `#6a1b9a`        | Active |
| Ballet                  | Indigo Professional | 10.1    | `#283593`        | Active |
| Caressing               | Dark Purple         | 7.2     | `#311b92`        | Active |
| Clothing                | Earth Brown         | 4.2     | `#6d4c41`        | Active |
| Companionship           | Deep Teal           | 3.3     | `#00695c`        | Active |
| Core                    | Classic Blue-Grey   | 1.1     | `#455a64`        | Active |
| Deference               | Ceremonial Midnight | 14.1    | `#1f2d3d`        | Active |
| Distress                | Obsidian Frost      | 11.7    | `#0b132b`        | Active |
| First-Aid               | Forest Green        | 4.1     | `#1b5e20`        | Active |
| Exercise                | Orange Flame        | 2.3     | `#e65100`        | Active |
| Gymnastics              | Journey Cobalt      | 9.1     | `#1a237e`        | Active |
| Hugging                 | Warm Embrace        | 3.4     | `#7d2a50`        | Active |
| Hexing                  | Hexed Nightshade    | 16.1    | `#1f0d2a`        | Active |
| Items                   | Aurora Depths       | 11.1    | `#004d61`        | Active |
| Kissing                 | Rose Pink           | 3.2     | `#ad1457`        | Active |
| Movement                | Explorer Cyan       | 9.3     | `#006064`        | Active |
| Music                   | Starlight Navy      | 11.4    | `#1a2332`        | Active |
| Observation             | Ocean Blue          | 4.3     | `#01579b`        | Active |
| Physical-Control        | Ironclad Slate      | 11.2    | `#2f2f2f`        | Active |
| Positioning             | Deep Orange Energy  | 10.2    | `#bf360c`        | Active |
| Seduction               | Golden Divine       | 5.2     | `#f57f17`        | Active |
| Sex-Anal-Penetration    | Obsidian Teal       | 12.6    | `#053b3f`        | Active |
| Sex-Breastplay          | Blush Amethyst      | 12.1    | `#7a1d58`        | Active |
| Sex-Core                | Mystic Purple       | 5.1     | `#4a148c`        | Active |
| Sex-Dry-Intimacy        | Velvet Smoke        | 12.4    | `#4a2741`        | Active |
| Sex-Penile-Manual       | Ember Touch         | 12.2    | `#8a3b12`        | Active |
| Sex-Penile-Oral         | Midnight Orchid     | 12.3    | `#2a1a5e`        | Active |
| Sex-Physical-Control    | Velvet Twilight     | 11.3    | `#2c0e37`        | Active |
| Sex-Vaginal-Penetration | Crimson Embrace     | 12.5    | `#6c0f36`        | Active |
| Vampirism               | Crimson Embrace     | 12.5    | `#6c0f36`        | Active |
| Violence                | Dark Crimson        | 2.2     | `#8b0000`        | Active |
| Warding                 | Cool Grey Modern    | 10.3    | `#424242`        | Active |
| Weapons                 | Arctic Steel        | 11.8    | `#112a46`        | Active |
| Item-Transfer           | Trade Amber         | 13.1    | `#7d5a00`        | Active |
| Personal-Space          | Molten Copper       | 11.6    | `#7c2d12`        | Active |
| Ranged                  | Archer's Focus      | 15.1    | `#2a4a3f`        | Active |
| Recovery                | Evergreen Shadow    | 11.5    | `#123524`        | Active |
| Intoxicants             | Tavern Amber        | 17.1    | `#5c3d1e`        | Active |

## Available Color Schemes by Category

### Neutral/System

- **Slate Grey** (1.2) - Administrative actions, settings
- **Charcoal** (1.3) - Dark theme default, low-energy actions

### Action/Combat

- **Bold Red** (2.1) - Combat, aggressive actions

### Nature/Environment

- _none available — Forest Green (4.1) assigned to First-Aid_

### Warning/Alert

- **Amber Warning** (6.1) - Caution actions, moderate warnings
- **Dark Red Alert** (6.2) - Critical alerts, dangerous actions

### Dark Theme Optimized

- **Deep Blue** (7.1) - Primary actions in dark themes
- **Midnight Green** (7.3) - Success actions in dark themes

### High Contrast

- **Pure Black & White** (8.1) - Maximum accessibility
- **White & Black** (8.2) - Light theme high contrast
- **Yellow on Black** (8.3) - High visibility

### Additional Versatile

- **Pathfinder Slate** (9.2) - Navigation, wayfinding

### Honor/Deference

- **Humble Bronze** (14.2) - Reverent gestures, respectful submissions

### Professional/Modern

(No available schemes - all in use)

### Expansion Set

- _(none available — all assigned)_

### Hex/Corruption

- **Blighted Moss** (16.2) - Hexcraft rituals, entropic nature magic (available)

## Complete Color Scheme Definitions

### 1. Neutral/System Colors

#### 1.1 Classic Blue-Grey ✅ IN USE: Core

```json
{
  "backgroundColor": "#455a64",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#37474f",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 7.24:1 🌟 AAA
- **Hover Contrast**: 9.65:1 🌟 AAA
- **Use Cases**: System actions, navigation, utilities
- **Theme**: Professional, neutral, non-intrusive

#### 1.2 Slate Grey 🟢 AVAILABLE

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

#### 1.3 Charcoal 🟢 AVAILABLE

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

### 2. Action/Combat Colors

#### 2.1 Bold Red 🟢 AVAILABLE

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

#### 2.2 Dark Crimson ✅ IN USE: Violence

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

#### 2.3 Orange Flame ✅ IN USE: Exercise

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

### 3. Social/Intimacy Colors

#### 3.1 Soft Purple ✅ IN USE: Affection

```json
{
  "backgroundColor": "#6a1b9a",
  "textColor": "#f3e5f5",
  "hoverBackgroundColor": "#8e24aa",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 10.89:1 🌟 AAA
- **Hover Contrast**: 7.04:1 🌟 AAA
- **Use Cases**: Intimacy actions, romantic interactions
- **Theme**: Romance, mystery, elegance

#### 3.2 Rose Pink ✅ IN USE: Kissing

```json
{
  "backgroundColor": "#ad1457",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#c2185b",
  "hoverTextColor": "#fce4ec"
}
```

- **Normal Contrast**: 6.97:1 ✅ AA
- **Hover Contrast**: 4.88:1 ✅ AA
- **Use Cases**: Romantic escalation, kissing, emotional intensity
- **Theme**: Warmth, tenderness, passion

#### 3.3 Deep Teal ✅ IN USE: Companionship

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

#### 3.4 Warm Embrace ✅ IN USE: Hugging

```json
{
  "backgroundColor": "#7d2a50",
  "textColor": "#fbeaf2",
  "hoverBackgroundColor": "#a13a6a",
  "hoverTextColor": "#fff3f9"
}
```

- **Normal Contrast**: 7.83:1 🌟 AAA
- **Hover Contrast**: 5.84:1 ✅ AA
- **Use Cases**: Comforting hugs, supportive reassurance, nurturing contact
- **Theme**: Cozy warmth, heartfelt closeness, gentle reassurance

### 4. Nature/Environment Colors

#### 4.1 Forest Green ✅ IN USE: First-Aid

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
- **Use Cases**: Nature magic, outdoor actions, environmental, healing/first aid, triage
- **Theme**: Growth, natural, organic; reassuring clinical green suited to care contexts

#### 4.2 Earth Brown ✅ IN USE: Clothing

```json
{
  "backgroundColor": "#6d4c41",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#795548",
  "hoverTextColor": "#efebe9"
}
```

- **Normal Contrast**: 7.61:1 🌟 AAA
- **Hover Contrast**: 5.53:1 ✅ AA
- **Use Cases**: Clothing interactions, crafting, physical items
- **Theme**: Stability, reliability, groundedness

#### 4.3 Ocean Blue ✅ IN USE: Observation

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
- **Use Cases**: Examining items, observing environment, perception-based actions
- **Theme**: Clarity, perception, discovery

### 5. Magic/Special Colors

#### 5.1 Mystic Purple ✅ IN USE: Sex-Core

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

#### 5.2 Golden Divine ✅ IN USE: Seduction

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
- **Use Cases**: Divine magic, holy abilities, blessings, seductive actions
- **Theme**: Sacred, radiant, powerful, alluring

### 6. Warning/Alert Colors

#### 6.1 Amber Warning 🟢 AVAILABLE

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

#### 6.2 Dark Red Alert 🟢 AVAILABLE

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

### 7. Dark Theme Optimized

#### 7.1 Deep Blue 🟢 AVAILABLE

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

#### 7.2 Dark Purple ✅ IN USE: Caressing

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
- **Use Cases**: Sensual touch actions, premium special abilities in dark themes
- **Theme**: Premium, special, unique

#### 7.3 Midnight Green 🟢 AVAILABLE

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

### 8. High Contrast Options

#### 8.1 Pure Black & White 🟢 AVAILABLE

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

#### 8.2 White & Black 🟢 AVAILABLE

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

#### 8.3 Yellow on Black 🟢 AVAILABLE

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

### 9. Additional Versatile Options

#### 9.1 Journey Cobalt ✅ IN USE: Gymnastics

```json
{
  "backgroundColor": "#1a237e",
  "textColor": "#e8eaf6",
  "hoverBackgroundColor": "#283593",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 13.5:1 🌟 AAA
- **Hover Contrast**: 10.5:1 🌟 AAA
- **Use Cases**: Travel actions, long-distance movement, exploration, precision athletics
- **Theme**: Journey, vast distances, adventure, disciplined motion

#### 9.2 Pathfinder Slate 🟢 AVAILABLE

```json
{
  "backgroundColor": "#2e3f47",
  "textColor": "#ecf0f1",
  "hoverBackgroundColor": "#4a5f6a",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 11.8:1 🌟 AAA
- **Hover Contrast**: 6.5:1 ✅ AA
- **Use Cases**: Navigation, wayfinding, path selection
- **Theme**: Roads, paths, neutral guidance

#### 9.3 Explorer Cyan ✅ IN USE: Movement

```json
{
  "backgroundColor": "#006064",
  "textColor": "#e0f7fa",
  "hoverBackgroundColor": "#00838f",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 12.3:1 🌟 AAA
- **Hover Contrast**: 5.8:1 ✅ AA
- **Use Cases**: Discovery, navigation, movement freedom
- **Theme**: Exploration, discovery, spatial awareness

### 10. Professional & Modern Options

#### 10.1 Indigo Professional ✅ IN USE: Ballet

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
- **Use Cases**: Professional actions, ballet techniques, disciplined artistic performance
- **Theme**: Professional, disciplined, artistic, graceful

#### 10.2 Deep Orange Energy ✅ IN USE: Positioning

```json
{
  "backgroundColor": "#bf360c",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#8d2c08",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 5.60:1 ✅ AA
- **Hover Contrast**: 8.41:1 🌟 AAA
- **Use Cases**: Energy actions, positioning, movement
- **Theme**: Dynamic, energetic, active

#### 10.3 Cool Grey Modern ✅ IN USE: Warding

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
- **Use Cases**: Warding actions, protective magic, salt boundaries
- **Theme**: Neutral salt aesthetic, contemporary, balanced

### 11. Expansion Set – High Contrast Additions

#### 11.1 Aurora Depths ✅ IN USE: Items

```json
{
  "backgroundColor": "#004d61",
  "textColor": "#e0f7fa",
  "hoverBackgroundColor": "#006978",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 8.44:1 🌟 AAA
- **Hover Contrast**: 6.38:1 ✅ AA
- **Use Cases**: Inventory and item management, calm focus states
- **Theme**: Aquatic depth, precise utility, trustworthy teal

#### 11.2 Ironclad Slate ✅ IN USE: Physical-Control

```json
{
  "backgroundColor": "#2f2f2f",
  "textColor": "#f8f9fa",
  "hoverBackgroundColor": "#3f3d56",
  "hoverTextColor": "#f8f9ff"
}
```

- **Normal Contrast**: 12.70:1 🌟 AAA
- **Hover Contrast**: 9.93:1 🌟 AAA
- **Use Cases**: Crafting menus, defensive stances, engineering tools
- **Theme**: Industrial precision, fortified neutrality

#### 11.3 Velvet Twilight ✅ IN USE: Sex-Physical-Control

```json
{
  "backgroundColor": "#2c0e37",
  "textColor": "#ffebf0",
  "hoverBackgroundColor": "#451952",
  "hoverTextColor": "#f3e5f5"
}
```

- **Normal Contrast**: 15.01:1 🌟 AAA
- **Hover Contrast**: 11.45:1 🌟 AAA
- **Use Cases**: Elegant social actions, mysterious story beats, sexual physical control
- **Theme**: Luxurious nightfall, refined intrigue, sensual control

#### 11.4 Starlight Navy ✅ IN USE: Music

```json
{
  "backgroundColor": "#1a2332",
  "textColor": "#d1d5db",
  "hoverBackgroundColor": "#2d3748",
  "hoverTextColor": "#f3f4f6"
}
```

- **Normal Contrast**: 11.8:1 🌟 AAA
- **Hover Contrast**: 9.2:1 🌟 AAA
- **Use Cases**: Musical performance actions, artistic performances, creative expression
- **Theme**: Artistic sophistication and creative expression with calm, focused aesthetic

#### 11.5 Evergreen Shadow ✅ IN USE: Recovery

```json
{
  "backgroundColor": "#123524",
  "textColor": "#e8f5e9",
  "hoverBackgroundColor": "#1b5e20",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 11.96:1 🌟 AAA
- **Hover Contrast**: 7.87:1 🌟 AAA
- **Use Cases**: Stealth exploration, nature attunement, healing rituals, physical recovery/support
- **Theme**: Quiet resilience, verdant focus for restorative actions

#### 11.6 Molten Copper ✅ IN USE: Personal-Space

```json
{
  "backgroundColor": "#7c2d12",
  "textColor": "#fef3c7",
  "hoverBackgroundColor": "#9a3412",
  "hoverTextColor": "#fffbeb"
}
```

- **Normal Contrast**: 8.42:1 🌟 AAA
- **Hover Contrast**: 7.05:1 🌟 AAA
- **Use Cases**: Forging, high-heat abilities, charismatic performances
- **Theme**: Liquid metal, artisan warmth

#### 11.7 Obsidian Frost ✅ IN USE: Distress

```json
{
  "backgroundColor": "#0b132b",
  "textColor": "#f2f4f8",
  "hoverBackgroundColor": "#1c2541",
  "hoverTextColor": "#e0e7ff"
}
```

- **Normal Contrast**: 16.70:1 🌟 AAA
- **Hover Contrast**: 12.26:1 🌟 AAA
- **Use Cases**: High-clarity command centers, tactical overviews
- **Theme**: Frozen night sky, crystalline focus

#### 11.8 Arctic Steel ✅ IN USE: Weapons

```json
{
  "backgroundColor": "#112a46",
  "textColor": "#e6f1ff",
  "hoverBackgroundColor": "#0b3954",
  "hoverTextColor": "#f0f4f8"
}
```

- **Normal Contrast**: 12.74:1 🌟 AAA
- **Hover Contrast**: 11.00:1 🌟 AAA
- **Use Cases**: High-tech interfaces, precision ranged actions, frost magic
- **Theme**: Tempered steel, arctic clarity

### 12. Intimacy Spectrum Colors

#### 12.1 Blush Amethyst ✅ IN USE: Sex-Breastplay

```json
{
  "backgroundColor": "#7a1d58",
  "textColor": "#fde6f2",
  "hoverBackgroundColor": "#8d2465",
  "hoverTextColor": "#fff2f9"
}
```

- **Normal Contrast**: 8.92:1 🌟 AAA
- **Hover Contrast**: 7.41:1 🌟 AAA
- **Use Cases**: Breast play interactions, tender chest-to-chest scenes
- **Theme**: Warm blush intimacy with luxurious accents

#### 12.2 Ember Touch ✅ IN USE: Sex-Penile-Manual

```json
{
  "backgroundColor": "#8a3b12",
  "textColor": "#fff4e6",
  "hoverBackgroundColor": "#a04a1b",
  "hoverTextColor": "#fffaf2"
}
```

- **Normal Contrast**: 9.77:1 🌟 AAA
- **Hover Contrast**: 7.86:1 🌟 AAA
- **Use Cases**: Manual penis stimulation, warming tactile contact
- **Theme**: Smoldering copper glow evoking heated touch

#### 12.3 Midnight Orchid ✅ IN USE: Sex-Penile-Oral

```json
{
  "backgroundColor": "#2a1a5e",
  "textColor": "#ede7f6",
  "hoverBackgroundColor": "#372483",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.64:1 🌟 AAA
- **Hover Contrast**: 8.19:1 🌟 AAA
- **Use Cases**: Oral penis/testicle play, low-light teasing
- **Theme**: Velvet-night indigo with soft lavender highlights

#### 12.4 Velvet Smoke ✅ IN USE: Sex-Dry-Intimacy

```json
{
  "backgroundColor": "#4a2741",
  "textColor": "#fce8f5",
  "hoverBackgroundColor": "#5c2f51",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.11:1 🌟 AAA
- **Hover Contrast**: 7.59:1 🌟 AAA
- **Use Cases**: Grinding, frottage, clothed intimacy loops
- **Theme**: Smoky plum aura reflecting close, rhythmic motion

#### 12.5 Crimson Embrace ✅ IN USE: Sex-Vaginal-Penetration, Vampirism

```json
{
  "backgroundColor": "#6c0f36",
  "textColor": "#ffe6ef",
  "hoverBackgroundColor": "#861445",
  "hoverTextColor": "#fff2f7"
}
```

- **Normal Contrast**: 9.84:1 🌟 AAA
- **Hover Contrast**: 7.62:1 🌟 AAA
- **Use Cases**: Vaginal penetration, straddling rhythms, labia teasing, vampiric menace displays
- **Theme**: Deep crimson passion with luminous highlights

#### 12.6 Obsidian Teal ✅ IN USE: Sex-Anal-Penetration

```json
{
  "backgroundColor": "#053b3f",
  "textColor": "#e0f7f9",
  "hoverBackgroundColor": "#075055",
  "hoverTextColor": "#f1feff"
}
```

- **Normal Contrast**: 11.47:1 🌟 AAA
- **Hover Contrast**: 9.56:1 🌟 AAA
- **Use Cases**: Anal teasing, exploratory penetration build-up
- **Theme**: Cool, deliberate teal-black depth for focused exploration

### 13. Exchange/Transaction Colors

#### 13.1 Trade Amber ✅ IN USE: Item-Transfer

```json
{
  "backgroundColor": "#7d5a00",
  "textColor": "#fff8e1",
  "hoverBackgroundColor": "#9a7000",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 8.7:1 🌟 AAA
- **Hover Contrast**: 6.2:1 ✅ AA
- **Use Cases**: Item exchange between characters, gift giving, trade actions
- **Theme**: Warm amber evoking commerce and exchange

### 14. Honor/Deference Colors

#### 14.1 Ceremonial Midnight ✅ IN USE: Deference

```json
{
  "backgroundColor": "#1f2d3d",
  "textColor": "#f7f9ff",
  "hoverBackgroundColor": "#152133",
  "hoverTextColor": "#e8edf7"
}
```

- **Normal Contrast**: 13.29:1 🌟 AAA
- **Hover Contrast**: 13.79:1 🌟 AAA
- **Use Cases**: Kneeling, formal vows, visible acts of submission or respect
- **Theme**: Deep midnight navy with cool highlights for solemn, ceremonial deference

#### 14.2 Humble Bronze 🟢 AVAILABLE

```json
{
  "backgroundColor": "#4b2f14",
  "textColor": "#fff3e0",
  "hoverBackgroundColor": "#3b230f",
  "hoverTextColor": "#ffe7c2"
}
```

- **Normal Contrast**: 11.16:1 🌟 AAA
- **Hover Contrast**: 12.18:1 🌟 AAA
- **Use Cases**: Quiet reverence, service oaths, humble acknowledgements of hierarchy
- **Theme**: Warm bronze and cream palette that keeps focus on respectful intent

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
   - Combat/Violence → Reds, dark crimsons
   - Healing/Nature → Greens
   - Social/Trust → Teals, blues
   - Magic/Mystery → Purples
   - Energy/Excitement → Oranges

2. **Maintain mod consistency**: Use the same scheme throughout a mod when possible

3. **Check availability**: Verify the scheme isn't already used by another mod (unless intentional)

4. **Prioritize accessibility**: All schemes meet WCAG AA; prefer AAA (🌟) when possible

5. **Test in context**: Verify colors work with your UI and other visual elements

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

## Maintenance

### Adding New Schemes

When adding new color schemes:

1. Validate WCAG compliance (minimum AA 4.5:1)
2. Add to appropriate category section
3. Include contrast ratios and use cases
4. Update status tables
5. Document in mod files where used
6. Run validation script

### Updating Existing Schemes

When modifying schemes:

1. Check all mods currently using the scheme
2. Re-validate contrast ratios
3. Update all documentation
4. Notify affected mod maintainers
5. Test visual changes in-game

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/#contrast-minimum)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Project validation script: `/scripts/validateVisualContrast.js`

### 15. Ranged/Projectile Colors

#### 15.1 Archer's Focus ✅ IN USE: Ranged

```json
{
  "backgroundColor": "#2a4a3f",
  "textColor": "#e8f5f0",
  "hoverBackgroundColor": "#3a5f52",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.1:1 🌟 AAA
- **Hover Contrast**: 7.55:1 🌟 AAA
- **Use Cases**: Thrown projectiles, ranged attacks, aimed actions
- **Theme**: Deep forest-olive teal evoking hunter's concentration and precise aim

### 16. Hex/Corruption Colors

#### 16.1 Hexed Nightshade ✅ IN USE: Hexing

```json
{
  "backgroundColor": "#1f0d2a",
  "textColor": "#e8ffd5",
  "hoverBackgroundColor": "#2f1837",
  "hoverTextColor": "#f5ffe7"
}
```

- **Normal Contrast**: 17.14:1 🌟 AAA
- **Hover Contrast**: 15.57:1 🌟 AAA
- **Use Cases**: Hexcraft, corrupting gazes, occult debuffs
- **Theme**: Eldritch violet base with a toxic glow, evoking creeping corruption and hypnotic danger

#### 16.2 Blighted Moss 🟢 AVAILABLE

```json
{
  "backgroundColor": "#1a1f14",
  "textColor": "#d8ffd6",
  "hoverBackgroundColor": "#23301c",
  "hoverTextColor": "#e8ffe5"
}
```

- **Normal Contrast**: 15.36:1 🌟 AAA
- **Hover Contrast**: 13.15:1 🌟 AAA
- **Use Cases**: Hexcraft rituals, entropic nature magic, lingering curses
- **Theme**: Muted bog-green palette suggesting decay, blight, and creeping vines

### 17. Intoxicants/Vice Colors

#### 17.1 Tavern Amber ✅ IN USE: Intoxicants

```json
{
  "backgroundColor": "#5c3d1e",
  "textColor": "#fff3e0",
  "hoverBackgroundColor": "#704b2a",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.52:1 🌟 AAA
- **Hover Contrast**: 7.81:1 🌟 AAA
- **Use Cases**: Drinking alcohol, tavern interactions, general intoxicant consumption
- **Theme**: Warm whiskey/amber tones evoking tavern firelight and aged spirits

#### 17.2 Hazy Smoke 🟢 AVAILABLE

```json
{
  "backgroundColor": "#3d3a3f",
  "textColor": "#e8e5eb",
  "hoverBackgroundColor": "#504c52",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.18:1 🌟 AAA
- **Hover Contrast**: 6.82:1 ✅ AA
- **Use Cases**: Smoking, inhaling substances, drug-related actions
- **Theme**: Smoky purple-gray evoking haze, pipe smoke, and altered states

## Version History

- **2025-12**: Added Section 17 (Intoxicants/Vice Colors) with Tavern Amber (17.1) for Intoxicants mod and Hazy Smoke (17.2) available
- **2026-02**: Added Hexed Nightshade (16.1) for Hexing mod and Blighted Moss (16.2) to the available pool
- **2025-12**: Added Archer's Focus (15.1) for Ranged mod
- **2025-11**: Consolidated from multiple sources into single reference document
- Original spec: `specs/wcag-compliant-color-combinations.spec.md` (removed)
- Original guide: `docs/mods/color-palettes.md` (removed)
