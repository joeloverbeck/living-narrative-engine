# Mod Color Schemes - Used Assignments

## Overview

This document tracks which color schemes are actively used by mods in the Living Narrative Engine. Use this as a reference when checking existing assignments or updating mod color schemes.

**Looking for available schemes?** See [mod-color-schemes-available.md](./mod-color-schemes-available.md) for schemes ready for new mods.

## Current Status

**Total Schemes Defined**: 56
**In Use**: 45 schemes actively implemented across mods
**Available**: 11 schemes ready for future mods

## Quick Reference: Mod Assignments

| Mod                     | Color Scheme        | Section | Background Color | Status |
| ----------------------- | ------------------- | ------- | ---------------- | ------ |
| Affection               | Soft Purple         | 3.1     | `#6a1b9a`        | Active |
| Ballet                  | Indigo Professional | 10.1    | `#283593`        | Active |
| Bending                 | Yielding Posture    | 21.1    | `#5a4033`        | Active |
| Caressing               | Dark Purple         | 7.2     | `#311b92`        | Active |
| Clothing                | Earth Brown         | 4.2     | `#6d4c41`        | Active |
| Companionship           | Deep Teal           | 3.3     | `#00695c`        | Active |
| Containers              | Depot Olive         | 18.3    | `#354230`        | Active |
| Core                    | Classic Blue-Grey   | 1.1     | `#455a64`        | Active |
| Deference               | Ceremonial Midnight | 14.1    | `#1f2d3d`        | Active |
| Distress                | Obsidian Frost      | 11.7    | `#0b132b`        | Active |
| Exercise                | Orange Flame        | 2.3     | `#e65100`        | Active |
| Facing                  | Pathfinder Slate    | 9.2     | `#2e3f47`        | Active |
| First-Aid               | Forest Green        | 4.1     | `#1b5e20`        | Active |
| Gymnastics              | Journey Cobalt      | 9.1     | `#1a237e`        | Active |
| Hexing                  | Hexed Nightshade    | 16.1    | `#1f0d2a`        | Active |
| Hugging                 | Warm Embrace        | 3.4     | `#7d2a50`        | Active |
| Intoxicants             | Tavern Amber        | 17.1    | `#5c3d1e`        | Active |
| Item-Handling           | Tactile Brown       | 18.1    | `#5d4037`        | Active |
| Item-Placement          | Foundation Earth    | 18.2    | `#3e2723`        | Active |
| Item-Transfer           | Trade Amber         | 13.1    | `#7d5a00`        | Active |
| Items                   | Aurora Depths       | 11.1    | `#004d61`        | Active |
| Kissing                 | Rose Pink           | 3.2     | `#ad1457`        | Active |
| Lying                   | Deep Blue           | 7.1     | `#0d47a1`        | Active |
| Maneuvering             | Midnight Green      | 7.3     | `#004d40`        | Active |
| Movement                | Explorer Cyan       | 9.3     | `#006064`        | Active |
| Music                   | Starlight Navy      | 11.4    | `#1a2332`        | Active |
| Observation             | Ocean Blue          | 4.3     | `#01579b`        | Active |
| Personal-Space          | Molten Copper       | 11.6    | `#7c2d12`        | Active |
| Physical-Control        | Ironclad Slate      | 11.2    | `#2f2f2f`        | Active |
| Positioning             | Deep Orange Energy  | 10.2    | `#bf360c`        | Active |
| Ranged                  | Archer's Focus      | 15.1    | `#2a4a3f`        | Active |
| Recovery                | Evergreen Shadow    | 11.5    | `#123524`        | Active |
| Seduction               | Golden Divine       | 5.2     | `#f57f17`        | Active |
| Sex-Anal-Penetration    | Obsidian Teal       | 12.6    | `#053b3f`        | Active |
| Sex-Breastplay          | Blush Amethyst      | 12.1    | `#7a1d58`        | Active |
| Sex-Core                | Mystic Purple       | 5.1     | `#4a148c`        | Active |
| Sex-Dry-Intimacy        | Velvet Smoke        | 12.4    | `#4a2741`        | Active |
| Sex-Penile-Manual       | Ember Touch         | 12.2    | `#8a3b12`        | Active |
| Sex-Penile-Oral         | Midnight Orchid     | 12.3    | `#2a1a5e`        | Active |
| Sex-Physical-Control    | Velvet Twilight     | 11.3    | `#2c0e37`        | Active |
| Sex-Vaginal-Penetration | Crimson Embrace     | 12.5    | `#6c0f36`        | Active |
| Sitting                 | Charcoal            | 1.3     | `#263238`        | Active |
| Straddling              | Intimate Embrace    | 20.1    | `#5e2750`        | Active |
| Vampirism               | Crimson Embrace     | 12.5    | `#6c0f36`        | Active |
| Violence                | Dark Crimson        | 2.2     | `#8b0000`        | Active |
| Warding                 | Cool Grey Modern    | 10.3    | `#424242`        | Active |
| Weapons                 | Arctic Steel        | 11.8    | `#112a46`        | Active |
| Writing                 | Scribe's Ink        | 19.1    | `#1c2833`        | Active |

## Color Scheme Definitions (In Use)

All schemes are WCAG 2.1 AA compliant (minimum 4.5:1 contrast ratio).
Schemes with 7:1+ contrast ratio (WCAG AAA) are marked with a star.

### 1. Neutral/System Colors

#### 1.1 Classic Blue-Grey - Core

```json
{
  "backgroundColor": "#455a64",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#37474f",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 7.24:1 AAA
- **Hover Contrast**: 9.65:1 AAA
- **Use Cases**: System actions, navigation, utilities
- **Theme**: Professional, neutral, non-intrusive

#### 1.3 Charcoal - Sitting

```json
{
  "backgroundColor": "#263238",
  "textColor": "#cfd8dc",
  "hoverBackgroundColor": "#37474f",
  "hoverTextColor": "#eceff1"
}
```

- **Normal Contrast**: 11.17:1 AAA
- **Hover Contrast**: 10.34:1 AAA
- **Use Cases**: Dark theme default, low-energy actions, sitting mechanics
- **Theme**: Minimal, elegant, understated, restful

### 2. Action/Combat Colors

#### 2.2 Dark Crimson - Violence

```json
{
  "backgroundColor": "#8b0000",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#b71c1c",
  "hoverTextColor": "#ffebee"
}
```

- **Normal Contrast**: 15.30:1 AAA
- **Hover Contrast**: 8.41:1 AAA
- **Use Cases**: Berserker actions, blood magic, violence
- **Theme**: Brutal, serious, high-stakes

#### 2.3 Orange Flame - Exercise

```json
{
  "backgroundColor": "#e65100",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#ff6f00",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 5.13:1 AA
- **Hover Contrast**: 4.56:1 AA
- **Use Cases**: Fire attacks, energy bursts, special moves
- **Theme**: Energy, excitement, dynamism

### 3. Social/Intimacy Colors

#### 3.1 Soft Purple - Affection

```json
{
  "backgroundColor": "#6a1b9a",
  "textColor": "#f3e5f5",
  "hoverBackgroundColor": "#8e24aa",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 10.89:1 AAA
- **Hover Contrast**: 7.04:1 AAA
- **Use Cases**: Intimacy actions, romantic interactions
- **Theme**: Romance, mystery, elegance

#### 3.2 Rose Pink - Kissing

```json
{
  "backgroundColor": "#ad1457",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#c2185b",
  "hoverTextColor": "#fce4ec"
}
```

- **Normal Contrast**: 6.97:1 AA
- **Hover Contrast**: 4.88:1 AA
- **Use Cases**: Romantic escalation, kissing, emotional intensity
- **Theme**: Warmth, tenderness, passion

#### 3.3 Deep Teal - Companionship

```json
{
  "backgroundColor": "#00695c",
  "textColor": "#e0f2f1",
  "hoverBackgroundColor": "#00897b",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 10.42:1 AAA
- **Hover Contrast**: 5.42:1 AA
- **Use Cases**: Calming interactions, trust-building
- **Theme**: Trust, stability, depth

#### 3.4 Warm Embrace - Hugging

```json
{
  "backgroundColor": "#7d2a50",
  "textColor": "#fbeaf2",
  "hoverBackgroundColor": "#a13a6a",
  "hoverTextColor": "#fff3f9"
}
```

- **Normal Contrast**: 7.83:1 AAA
- **Hover Contrast**: 5.84:1 AA
- **Use Cases**: Comforting hugs, supportive reassurance, nurturing contact
- **Theme**: Cozy warmth, heartfelt closeness, gentle reassurance

### 4. Nature/Environment Colors

#### 4.1 Forest Green - First-Aid

```json
{
  "backgroundColor": "#1b5e20",
  "textColor": "#e8f5e9",
  "hoverBackgroundColor": "#2e7d32",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 12.07:1 AAA
- **Hover Contrast**: 5.37:1 AA
- **Use Cases**: Nature magic, outdoor actions, environmental, healing/first aid, triage
- **Theme**: Growth, natural, organic; reassuring clinical green suited to care contexts

#### 4.2 Earth Brown - Clothing

```json
{
  "backgroundColor": "#6d4c41",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#795548",
  "hoverTextColor": "#efebe9"
}
```

- **Normal Contrast**: 7.61:1 AAA
- **Hover Contrast**: 5.53:1 AA
- **Use Cases**: Clothing interactions, crafting, physical items
- **Theme**: Stability, reliability, groundedness

#### 4.3 Ocean Blue - Observation

```json
{
  "backgroundColor": "#01579b",
  "textColor": "#e1f5fe",
  "hoverBackgroundColor": "#0277bd",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 11.25:1 AAA
- **Hover Contrast**: 6.26:1 AA
- **Use Cases**: Examining items, observing environment, perception-based actions
- **Theme**: Clarity, perception, discovery

### 5. Magic/Special Colors

#### 5.1 Mystic Purple - Sex-Core

```json
{
  "backgroundColor": "#4a148c",
  "textColor": "#e1bee7",
  "hoverBackgroundColor": "#6a1b9a",
  "hoverTextColor": "#f3e5f5"
}
```

- **Normal Contrast**: 12.41:1 AAA
- **Hover Contrast**: 10.89:1 AAA
- **Use Cases**: Arcane magic, psychic abilities, enchantments
- **Theme**: Mystical, powerful, otherworldly

#### 5.2 Golden Divine - Seduction

```json
{
  "backgroundColor": "#f57f17",
  "textColor": "#000000",
  "hoverBackgroundColor": "#f9a825",
  "hoverTextColor": "#212121"
}
```

- **Normal Contrast**: 8.59:1 AAA
- **Hover Contrast**: 10.07:1 AAA
- **Use Cases**: Divine magic, holy abilities, blessings, seductive actions
- **Theme**: Sacred, radiant, powerful, alluring

### 7. Dark Theme Optimized

#### 7.1 Deep Blue - Lying

```json
{
  "backgroundColor": "#0d47a1",
  "textColor": "#bbdefb",
  "hoverBackgroundColor": "#1565c0",
  "hoverTextColor": "#e3f2fd"
}
```

- **Normal Contrast**: 10.89:1 AAA
- **Hover Contrast**: 9.23:1 AAA
- **Use Cases**: Lying down mechanics, restful states, primary actions in dark themes
- **Theme**: Professional, focused, reliable, calm rest

#### 7.2 Dark Purple - Caressing

```json
{
  "backgroundColor": "#311b92",
  "textColor": "#d1c4e9",
  "hoverBackgroundColor": "#4527a0",
  "hoverTextColor": "#ede7f6"
}
```

- **Normal Contrast**: 11.62:1 AAA
- **Hover Contrast**: 11.45:1 AAA
- **Use Cases**: Sensual touch actions, premium special abilities in dark themes
- **Theme**: Premium, special, unique

#### 7.3 Midnight Green - Maneuvering

```json
{
  "backgroundColor": "#004d40",
  "textColor": "#b2dfdb",
  "hoverBackgroundColor": "#00695c",
  "hoverTextColor": "#e0f2f1"
}
```

- **Normal Contrast**: 10.12:1 AAA
- **Hover Contrast**: 10.42:1 AAA
- **Use Cases**: Maneuvering, tactical advantage
- **Theme**: Success, achievement, progress

### 9. Additional Versatile Options

#### 9.1 Journey Cobalt - Gymnastics

```json
{
  "backgroundColor": "#1a237e",
  "textColor": "#e8eaf6",
  "hoverBackgroundColor": "#283593",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 13.5:1 AAA
- **Hover Contrast**: 10.5:1 AAA
- **Use Cases**: Travel actions, long-distance movement, exploration, precision athletics
- **Theme**: Journey, vast distances, adventure, disciplined motion

#### 9.2 Pathfinder Slate - Facing

```json
{
  "backgroundColor": "#2e3f47",
  "textColor": "#ecf0f1",
  "hoverBackgroundColor": "#4a5f6a",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 11.8:1 AAA
- **Hover Contrast**: 6.5:1 AA
- **Use Cases**: Turning to face or away from actors
- **Theme**: Spatial orientation, navigation

#### 9.3 Explorer Cyan - Movement

```json
{
  "backgroundColor": "#006064",
  "textColor": "#e0f7fa",
  "hoverBackgroundColor": "#00838f",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 12.3:1 AAA
- **Hover Contrast**: 5.8:1 AA
- **Use Cases**: Discovery, navigation, movement freedom
- **Theme**: Exploration, discovery, spatial awareness

### 10. Professional & Modern Options

#### 10.1 Indigo Professional - Ballet

```json
{
  "backgroundColor": "#283593",
  "textColor": "#c5cae9",
  "hoverBackgroundColor": "#3949ab",
  "hoverTextColor": "#e8eaf6"
}
```

- **Normal Contrast**: 10.58:1 AAA
- **Hover Contrast**: 9.89:1 AAA
- **Use Cases**: Professional actions, ballet techniques, disciplined artistic performance
- **Theme**: Professional, disciplined, artistic, graceful

#### 10.2 Deep Orange Energy - Positioning

```json
{
  "backgroundColor": "#bf360c",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#8d2c08",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 5.60:1 AA
- **Hover Contrast**: 8.41:1 AAA
- **Use Cases**: Energy actions, positioning, movement
- **Theme**: Dynamic, energetic, active

#### 10.3 Cool Grey Modern - Warding

```json
{
  "backgroundColor": "#424242",
  "textColor": "#fafafa",
  "hoverBackgroundColor": "#616161",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 11.58:1 AAA
- **Hover Contrast**: 7.04:1 AAA
- **Use Cases**: Warding actions, protective magic, salt boundaries
- **Theme**: Neutral salt aesthetic, contemporary, balanced

### 11. Expansion Set - High Contrast Additions

#### 11.1 Aurora Depths - Items

```json
{
  "backgroundColor": "#004d61",
  "textColor": "#e0f7fa",
  "hoverBackgroundColor": "#006978",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 8.44:1 AAA
- **Hover Contrast**: 6.38:1 AA
- **Use Cases**: Inventory and item management, calm focus states
- **Theme**: Aquatic depth, precise utility, trustworthy teal

#### 11.2 Ironclad Slate - Physical-Control

```json
{
  "backgroundColor": "#2f2f2f",
  "textColor": "#f8f9fa",
  "hoverBackgroundColor": "#3f3d56",
  "hoverTextColor": "#f8f9ff"
}
```

- **Normal Contrast**: 12.70:1 AAA
- **Hover Contrast**: 9.93:1 AAA
- **Use Cases**: Crafting menus, defensive stances, engineering tools
- **Theme**: Industrial precision, fortified neutrality

#### 11.3 Velvet Twilight - Sex-Physical-Control

```json
{
  "backgroundColor": "#2c0e37",
  "textColor": "#ffebf0",
  "hoverBackgroundColor": "#451952",
  "hoverTextColor": "#f3e5f5"
}
```

- **Normal Contrast**: 15.01:1 AAA
- **Hover Contrast**: 11.45:1 AAA
- **Use Cases**: Elegant social actions, mysterious story beats, sexual physical control
- **Theme**: Luxurious nightfall, refined intrigue, sensual control

#### 11.4 Starlight Navy - Music

```json
{
  "backgroundColor": "#1a2332",
  "textColor": "#d1d5db",
  "hoverBackgroundColor": "#2d3748",
  "hoverTextColor": "#f3f4f6"
}
```

- **Normal Contrast**: 11.8:1 AAA
- **Hover Contrast**: 9.2:1 AAA
- **Use Cases**: Musical performance actions, artistic performances, creative expression
- **Theme**: Artistic sophistication and creative expression with calm, focused aesthetic

#### 11.5 Evergreen Shadow - Recovery

```json
{
  "backgroundColor": "#123524",
  "textColor": "#e8f5e9",
  "hoverBackgroundColor": "#1b5e20",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 11.96:1 AAA
- **Hover Contrast**: 7.87:1 AAA
- **Use Cases**: Stealth exploration, nature attunement, healing rituals, physical recovery/support
- **Theme**: Quiet resilience, verdant focus for restorative actions

#### 11.6 Molten Copper - Personal-Space

```json
{
  "backgroundColor": "#7c2d12",
  "textColor": "#fef3c7",
  "hoverBackgroundColor": "#9a3412",
  "hoverTextColor": "#fffbeb"
}
```

- **Normal Contrast**: 8.42:1 AAA
- **Hover Contrast**: 7.05:1 AAA
- **Use Cases**: Forging, high-heat abilities, charismatic performances
- **Theme**: Liquid metal, artisan warmth

#### 11.7 Obsidian Frost - Distress

```json
{
  "backgroundColor": "#0b132b",
  "textColor": "#f2f4f8",
  "hoverBackgroundColor": "#1c2541",
  "hoverTextColor": "#e0e7ff"
}
```

- **Normal Contrast**: 16.70:1 AAA
- **Hover Contrast**: 12.26:1 AAA
- **Use Cases**: High-clarity command centers, tactical overviews
- **Theme**: Frozen night sky, crystalline focus

#### 11.8 Arctic Steel - Weapons

```json
{
  "backgroundColor": "#112a46",
  "textColor": "#e6f1ff",
  "hoverBackgroundColor": "#0b3954",
  "hoverTextColor": "#f0f4f8"
}
```

- **Normal Contrast**: 12.74:1 AAA
- **Hover Contrast**: 11.00:1 AAA
- **Use Cases**: High-tech interfaces, precision ranged actions, frost magic
- **Theme**: Tempered steel, arctic clarity

### 12. Intimacy Spectrum Colors

#### 12.1 Blush Amethyst - Sex-Breastplay

```json
{
  "backgroundColor": "#7a1d58",
  "textColor": "#fde6f2",
  "hoverBackgroundColor": "#8d2465",
  "hoverTextColor": "#fff2f9"
}
```

- **Normal Contrast**: 8.92:1 AAA
- **Hover Contrast**: 7.41:1 AAA
- **Use Cases**: Breast play interactions, tender chest-to-chest scenes
- **Theme**: Warm blush intimacy with luxurious accents

#### 12.2 Ember Touch - Sex-Penile-Manual

```json
{
  "backgroundColor": "#8a3b12",
  "textColor": "#fff4e6",
  "hoverBackgroundColor": "#a04a1b",
  "hoverTextColor": "#fffaf2"
}
```

- **Normal Contrast**: 9.77:1 AAA
- **Hover Contrast**: 7.86:1 AAA
- **Use Cases**: Manual penis stimulation, warming tactile contact
- **Theme**: Smoldering copper glow evoking heated touch

#### 12.3 Midnight Orchid - Sex-Penile-Oral

```json
{
  "backgroundColor": "#2a1a5e",
  "textColor": "#ede7f6",
  "hoverBackgroundColor": "#372483",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.64:1 AAA
- **Hover Contrast**: 8.19:1 AAA
- **Use Cases**: Oral penis/testicle play, low-light teasing
- **Theme**: Velvet-night indigo with soft lavender highlights

#### 12.4 Velvet Smoke - Sex-Dry-Intimacy

```json
{
  "backgroundColor": "#4a2741",
  "textColor": "#fce8f5",
  "hoverBackgroundColor": "#5c2f51",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.11:1 AAA
- **Hover Contrast**: 7.59:1 AAA
- **Use Cases**: Grinding, frottage, clothed intimacy loops
- **Theme**: Smoky plum aura reflecting close, rhythmic motion

#### 12.5 Crimson Embrace - Sex-Vaginal-Penetration, Vampirism

```json
{
  "backgroundColor": "#6c0f36",
  "textColor": "#ffe6ef",
  "hoverBackgroundColor": "#861445",
  "hoverTextColor": "#fff2f7"
}
```

- **Normal Contrast**: 9.84:1 AAA
- **Hover Contrast**: 7.62:1 AAA
- **Use Cases**: Vaginal penetration, straddling rhythms, labia teasing, vampiric menace displays
- **Theme**: Deep crimson passion with luminous highlights

#### 12.6 Obsidian Teal - Sex-Anal-Penetration

```json
{
  "backgroundColor": "#053b3f",
  "textColor": "#e0f7f9",
  "hoverBackgroundColor": "#075055",
  "hoverTextColor": "#f1feff"
}
```

- **Normal Contrast**: 11.47:1 AAA
- **Hover Contrast**: 9.56:1 AAA
- **Use Cases**: Anal teasing, exploratory penetration build-up
- **Theme**: Cool, deliberate teal-black depth for focused exploration

### 13. Exchange/Transaction Colors

#### 13.1 Trade Amber - Item-Transfer

```json
{
  "backgroundColor": "#7d5a00",
  "textColor": "#fff8e1",
  "hoverBackgroundColor": "#9a7000",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 8.7:1 AAA
- **Hover Contrast**: 6.2:1 AA
- **Use Cases**: Item exchange between characters, gift giving, trade actions
- **Theme**: Warm amber evoking commerce and exchange

### 14. Honor/Deference Colors

#### 14.1 Ceremonial Midnight - Deference

```json
{
  "backgroundColor": "#1f2d3d",
  "textColor": "#f7f9ff",
  "hoverBackgroundColor": "#152133",
  "hoverTextColor": "#e8edf7"
}
```

- **Normal Contrast**: 13.29:1 AAA
- **Hover Contrast**: 13.79:1 AAA
- **Use Cases**: Kneeling, formal vows, visible acts of submission or respect
- **Theme**: Deep midnight navy with cool highlights for solemn, ceremonial deference

### 15. Ranged/Projectile Colors

#### 15.1 Archer's Focus - Ranged

```json
{
  "backgroundColor": "#2a4a3f",
  "textColor": "#e8f5f0",
  "hoverBackgroundColor": "#3a5f52",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.1:1 AAA
- **Hover Contrast**: 7.55:1 AAA
- **Use Cases**: Thrown projectiles, ranged attacks, aimed actions
- **Theme**: Deep forest-olive teal evoking hunter's concentration and precise aim

### 16. Hex/Corruption Colors

#### 16.1 Hexed Nightshade - Hexing

```json
{
  "backgroundColor": "#1f0d2a",
  "textColor": "#e8ffd5",
  "hoverBackgroundColor": "#2f1837",
  "hoverTextColor": "#f5ffe7"
}
```

- **Normal Contrast**: 17.14:1 AAA
- **Hover Contrast**: 15.57:1 AAA
- **Use Cases**: Hexcraft, corrupting gazes, occult debuffs
- **Theme**: Eldritch violet base with a toxic glow, evoking creeping corruption and hypnotic danger

### 17. Intoxicants/Vice Colors

#### 17.1 Tavern Amber - Intoxicants

```json
{
  "backgroundColor": "#5c3d1e",
  "textColor": "#fff3e0",
  "hoverBackgroundColor": "#704b2a",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.52:1 AAA
- **Hover Contrast**: 7.81:1 AAA
- **Use Cases**: Drinking alcohol, tavern interactions, general intoxicant consumption
- **Theme**: Warm whiskey/amber tones evoking tavern firelight and aged spirits

### 18. Physical/Interaction Colors

#### 18.1 Tactile Brown - Item-Handling

```json
{
  "backgroundColor": "#5d4037",
  "textColor": "#efebe9",
  "hoverBackgroundColor": "#6d4c41",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 7.61:1 AAA
- **Hover Contrast**: 5.53:1 AA
- **Use Cases**: Item manipulation, picking up and dropping items, physical object handling
- **Theme**: Earthy tactile feel evoking hands-on interaction with physical objects

#### 18.2 Foundation Earth - Item-Placement

```json
{
  "backgroundColor": "#3e2723",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#4e342e",
  "hoverTextColor": "#efebe9"
}
```

- **Normal Contrast**: 13.82:1 AAA
- **Hover Contrast**: 9.56:1 AAA
- **Use Cases**: On-surface item staging, tidying, and retrieving items from nearby furniture while seated
- **Theme**: Grounded stability and surfaces, emphasizing steadiness and intentional placement

#### 18.3 Depot Olive - Containers

```json
{
  "backgroundColor": "#354230",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#455740",
  "hoverTextColor": "#f0f4f0"
}
```

- **Normal Contrast**: 10.64:1 AAA
- **Hover Contrast**: 7.03:1 AAA
- **Use Cases**: Storage and logistics interactions, container management actions
- **Theme**: Depot-inspired olive tones conveying sturdy storage and organized shelving

### 19. Literary/Scholarly Colors

#### 19.1 Scribe's Ink - Writing

```json
{
  "backgroundColor": "#1c2833",
  "textColor": "#f5ecd7",
  "hoverBackgroundColor": "#273746",
  "hoverTextColor": "#faf6eb"
}
```

- **Normal Contrast**: 11.8:1 AAA
- **Hover Contrast**: 10.2:1 AAA
- **Use Cases**: Writing actions, note-taking, document signing, scholarly activities
- **Theme**: Deep ink blue-black with warm parchment text, evoking manuscripts, quills, and scholarly work

### 20. Intimate Positioning Colors

#### 20.1 Intimate Embrace - Straddling

```json
{
  "backgroundColor": "#5e2750",
  "textColor": "#fce4f1",
  "hoverBackgroundColor": "#732f62",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 10.5:1 AAA
- **Hover Contrast**: 8.8:1 AAA
- **Use Cases**: Straddling, lap-sitting, intimate seated positioning, bodily closeness
- **Theme**: Deep plum-magenta suggesting intimate proximity and sensual bodily contact

### 21. Posture/Position Colors

#### 21.1 Yielding Posture - Bending

```json
{
  "backgroundColor": "#5a4033",
  "textColor": "#fff3e0",
  "hoverBackgroundColor": "#6d4c41",
  "hoverTextColor": "#ffffff"
}
```

- **Normal Contrast**: 9.47:1 AAA
- **Hover Contrast**: 7.61:1 AAA
- **Use Cases**: Bending over, physical submission postures, vulnerable positioning
- **Theme**: Warm earth-brown suggesting grounded vulnerability and physical yielding

## Maintenance

### Assigning a New Scheme to a Mod

1. Choose an available scheme from [mod-color-schemes-available.md](./mod-color-schemes-available.md)
2. Update that document to mark the scheme as "IN USE"
3. Move the scheme definition to this document
4. Add the mod to the Quick Reference table above
5. Run validation: `node scripts/validateVisualContrast.js`

### Updating an Existing Assignment

1. Update the scheme definition in this document
2. Re-validate contrast ratios
3. Notify affected mod maintainers
4. Test visual changes in-game

## Version History

- **2025-12**: Added Section 21 (Posture/Position Colors) with Yielding Posture (21.1) for Bending mod
- **2025-12**: Assigned Pathfinder Slate (9.2) to Facing mod
- **2025-12**: Assigned Deep Blue (7.1) to Lying mod
- **2025-12**: Assigned Charcoal (1.3) to Sitting mod
- **2025-12**: Added Section 20 (Intimate Positioning Colors) with Intimate Embrace (20.1) for Straddling mod
- **2025-12**: Added Scribe's Ink (19.1) for Writing mod
- **2025-12**: Added Depot Olive (18.3) for Containers mod
- **2025-12**: Added Foundation Earth (18.2) for Item-Placement mod
- **2025-12**: Added Section 18 (Physical/Interaction Colors) with Tactile Brown (18.1) for Item-Handling mod
- **2025-12**: Added Section 17 (Intoxicants/Vice Colors) with Tavern Amber (17.1) for Intoxicants mod
- **2025-12**: Added Hexed Nightshade (16.1) for Hexing mod
- **2025-12**: Added Archer's Focus (15.1) for Ranged mod
- **2025-11**: Original consolidated document created
