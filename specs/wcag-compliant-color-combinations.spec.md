# WCAG 2.1 AA Compliant Color Combinations Specification

## Overview

This specification provides a curated collection of pre-validated color combinations that meet WCAG 2.1 AA accessibility standards for the Living Narrative Engine action system. All combinations ensure a minimum contrast ratio of 4.5:1 between text and background colors, with many achieving AAA compliance (7:1+).

**Purpose**: Provide developers with a ready-to-use pool of accessible color combinations for action visual properties, eliminating the need for manual contrast validation.

**Requirements**:

- WCAG 2.1 AA: Minimum 4.5:1 contrast ratio for normal text
- WCAG 2.1 AAA: 7:1+ contrast ratio (marked with 🌟)
- All combinations tested for both normal and hover states

## Current Usage Overview

**Status**: 23 color schemes are actively implemented across mods (plus 1 reserved assignment) out of 42 defined combinations, leaving 18 available for future work.

### Active Mod Assignments

| Mod                      | Color Scheme       | Section | Background Color | State    |
| ------------------------ | ------------------ | ------- | ---------------- | -------- |
| Affection                | Soft Purple        | 3.1     | `#6a1b9a`        | Active   |
| Ballet                   | Indigo Professional| 10.1    | `#283593`        | Active   |
| Caressing                | Dark Purple        | 7.2     | `#311b92`        | Active   |
| Clothing                 | Earth Brown        | 4.2     | `#6d4c41`        | Active   |
| Companionship            | Deep Teal          | 3.3     | `#00695c`        | Active   |
| Core                     | Classic Blue-Grey  | 1.1     | `#455a64`        | Active   |
| Exercise                 | Orange Flame       | 2.3     | `#e65100`        | Active   |
| Gymnastics               | Journey Cobalt     | 9.1     | `#1a237e`        | Active   |
| Hugging                  | Warm Embrace       | 3.4     | `#7d2a50`        | Active   |
| Items                    | Aurora Depths      | 11.1    | `#004d61`        | Reserved |
| Kissing                  | Rose Pink          | 3.2     | `#ad1457`        | Active   |
| Movement                 | Explorer Cyan      | 9.3     | `#006064`        | Active   |
| Positioning              | Deep Orange Energy | 10.2    | `#bf360c`        | Active   |
| Seduction                | Golden Divine      | 5.2     | `#f57f17`        | Active   |
| Sex-Core                 | Mystic Purple      | 5.1     | `#4a148c`        | Active   |
| Sex-Breastplay           | Blush Amethyst     | 12.1    | `#7a1d58`        | Active   |
| Sex-Penile-Manual        | Ember Touch        | 12.2    | `#8a3b12`        | Active   |
| Sex-Penile-Oral          | Midnight Orchid    | 12.3    | `#2a1a5e`        | Active   |
| Sex-Dry-Intimacy         | Velvet Smoke       | 12.4    | `#4a2741`        | Active   |
| Sex-Vaginal-Penetration  | Crimson Embrace    | 12.5    | `#6c0f36`        | Active   |
| Sex-Anal-Penetration     | Obsidian Teal      | 12.6    | `#053b3f`        | Active   |
| Sex-Physical-Control     | Velvet Twilight    | 11.3    | `#2c0e37`        | Active   |
| Vampirism                | Crimson Embrace    | 12.5    | `#6c0f36`        | Active   |
| Violence                 | Dark Crimson       | 2.2     | `#8b0000`        | Active   |
| Physical-Control         | Ironclad Slate     | 11.2    | `#2f2f2f`        | Active   |

### Available Color Combinations

- **Neutral/System**: Slate Grey (1.2), Charcoal (1.3)
- **Action/Combat**: Bold Red (2.1)
- **Social/Intimacy**: _(all assigned — see Section 3 for active intimacy hues)_
- **Nature/Environment**: Forest Green (4.1), Ocean Blue (4.3)
- **Magic/Special**: _(none available)_
- **Warning/Alert**: Amber Warning (6.1), Dark Red Alert (6.2)
- **Dark Theme**: Deep Blue (7.1), Midnight Green (7.3)
- **High Contrast**: Pure Black & White (8.1), White & Black (8.2), Yellow on Black (8.3)
- **Additional Versatile**: Pathfinder Slate (9.2)
- **Professional/Modern**: Cool Grey Modern (10.3)
- **Expansion Set (Section 11)**: Starlight Navy (11.4), Evergreen Shadow (11.5), Molten Copper (11.6), Arctic Steel (11.8)

**Recommendation**: When creating new mods, select from the available combinations above to maintain visual consistency and avoid conflicts.

## Color Combination Sets

### 1. Neutral/System Colors

#### 1.1 Classic Blue-Grey

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
- ✅ **USED BY**: Core mod (core utility actions)

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
- **Hover Contrast**: 7.04:1 🌟 AAA
- **Use Cases**: Intimacy actions, romantic interactions
- **Theme**: Romance, mystery, elegance
- ✅ **USED BY**: Affection mod (gentle touch actions)

#### 3.2 Rose Pink

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
- ✅ **USED BY**: Kissing mod (all kissing progression actions)

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
- ✅ **USED BY**: Companionship mod (follow, stop_following, dismiss)

#### 3.4 Warm Embrace

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
- ✅ **USED BY**: Hugging mod (hug_tight and related hugging actions)

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
- ✅ **USED BY**: Clothing mod (remove and adjust clothing)

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
- ✅ **USED BY**: Sex-Core mod (shared sexual scaffolding)

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
- **Use Cases**: Divine magic, holy abilities, blessings, seductive actions
- **Theme**: Sacred, radiant, powerful, alluring
- ✅ **USED BY**: Seduction mod (seductive actions, attention-drawing gestures)

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
- **Use Cases**: Sensual touch actions, premium special abilities in dark themes
- **Theme**: Premium, special, unique
- ✅ **USED BY**: Caressing mod (sensual touch actions)

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

#### 9.1 Journey Cobalt

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
- ✅ **USED BY**: Gymnastics mod (tumbling fundamentals and cartwheels)

#### 9.2 Pathfinder Slate

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
- 🟢 **AVAILABLE**

#### 9.3 Explorer Cyan

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
- ✅ **USED BY**: Movement mod (go, enter, exit, navigate, traverse, explore)

### 10. Professional & Modern Options

#### 10.1 Indigo Professional

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
- ✅ **USED BY**: Ballet mod (classical ballet movements and techniques)

#### 10.2 Deep Orange Energy

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
- ✅ **USED BY**: Positioning mod (get_close, step_back, turn_around, kneel_before, etc.)

#### 10.3 Cool Grey Modern

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

### 11. Expansion Set – High Contrast Additions

#### 11.1 Aurora Depths

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
- 🔒 **RESERVED FOR**: Items mod (inventory interactions – implementation pending)

#### 11.2 Ironclad Slate

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
- ✅ **USED BY**: Physical-Control mod (physical restraint actions)

#### 11.3 Velvet Twilight

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
- ✅ **USED BY**: Sex-Physical-Control mod (sexual physical guidance actions)

#### 11.4 Starlight Navy

```json
{
  "backgroundColor": "#0f172a",
  "textColor": "#e2e8f0",
  "hoverBackgroundColor": "#1e293b",
  "hoverTextColor": "#f8fafc"
}
```

- **Normal Contrast**: 14.48:1 🌟 AAA
- **Hover Contrast**: 13.98:1 🌟 AAA
- **Use Cases**: Strategic planning, late-night operations, investigative mods
- **Theme**: Cosmic clarity, disciplined calm
- 🟢 **AVAILABLE**

#### 11.5 Evergreen Shadow

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
- **Use Cases**: Stealth exploration, nature attunement, healing rituals
- **Theme**: Quiet resilience, verdant focus
- 🟢 **AVAILABLE**

#### 11.6 Molten Copper

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
- 🟢 **AVAILABLE**

#### 11.7 Obsidian Frost

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
- ✅ **USED BY**: Distress mod (distress gestures)

#### 11.8 Arctic Steel

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
- 🟢 **AVAILABLE**

### 12. Intimacy Spectrum Colors

#### 12.1 Blush Amethyst

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
- ✅ **USED BY**: Sex-Breastplay mod (breast-centric actions)

#### 12.2 Ember Touch

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
- ✅ **USED BY**: Sex-Penile-Manual mod (hand-based penis actions)

#### 12.3 Midnight Orchid

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
- ✅ **USED BY**: Sex-Penile-Oral mod (oral-focused penis/testicle actions)

#### 12.4 Velvet Smoke

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
- ✅ **USED BY**: Sex-Dry-Intimacy mod (grinding and frottage actions)

#### 12.5 Crimson Embrace

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
- ✅ **USED BY**: Sex-Vaginal-Penetration mod (penetrative vaginal actions), Vampirism mod (vampiric threat displays)

#### 12.6 Obsidian Teal

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
- ✅ **USED BY**: Sex-Anal-Penetration mod (anal teasing and penetration prep)

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
    "hoverBackgroundColor": "#37474f",
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
