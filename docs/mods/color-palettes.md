# Recommended Color Palettes

## Action Type Color Schemes

### Combat Actions

- **Aggressive**: `#d32f2f` (red) background, `#ffffff` text
- **Defensive**: `#2e7d32` (green) background, `#ffffff` text
- **Special**: `#f57c00` (orange) background, `#ffffff` text

### Magic Actions

- **Arcane**: `#7b1fa2` (purple) background, `#e1bee7` text
- **Divine**: `#ffc107` (gold) background, `#333333` text
- **Nature**: `#388e3c` (forest green) background, `#ffffff` text

### Social Actions

- **Friendly**: `#4caf50` (green) background, `#ffffff` text
- **Hostile**: `#f44336` (red) background, `#ffffff` text
- **Neutral**: `#607d8b` (blue-grey) background, `#ffffff` text

### Utility Actions

- **Information**: `#2196f3` (blue) background, `#ffffff` text
- **Movement**: `#9e9e9e` (grey) background, `#ffffff` text
- **Inventory**: `#795548` (brown) background, `#ffffff` text

## Accessibility-Safe Combinations

All combinations below meet WCAG 2.1 AA contrast requirements:

- `#000000` background + `#ffffff` text (21:1 ratio)
- `#0066cc` background + `#ffffff` text (5.74:1 ratio)
- `#d32f2f` background + `#ffffff` text (5.25:1 ratio)
- `#2e7d32` background + `#ffffff` text (5.37:1 ratio)
- `#7b1fa2` background + `#ffffff` text (8.59:1 ratio)

## Theme-Specific Recommendations

### Dark Theme Optimized

```json
{
  "backgroundColor": "#1976d2",
  "textColor": "#e3f2fd",
  "hoverBackgroundColor": "#2196f3",
  "hoverTextColor": "#ffffff"
}
```

### Light Theme Optimized

```json
{
  "backgroundColor": "#4caf50",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#388e3c",
  "hoverTextColor": "#e8f5e8"
}
```

### High Contrast Compatible

```json
{
  "backgroundColor": "#000000",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#333333",
  "hoverTextColor": "#ffff00"
}
```

## Color Psychology Guidelines

### Red Spectrum

- **Use for**: Danger, combat, warnings, critical actions
- **Avoid for**: Healing, peaceful actions, positive feedback

### Green Spectrum

- **Use for**: Success, healing, growth, positive actions
- **Avoid for**: Danger, stopping actions, warnings

### Blue Spectrum

- **Use for**: Information, navigation, communication, calm actions
- **Avoid for**: Urgent actions, combat, warnings

### Purple Spectrum

- **Use for**: Magic, mystery, special abilities, rare actions
- **Avoid for**: Common actions, physical abilities

### Orange/Yellow Spectrum

- **Use for**: Caution, attention, special moves, energy
- **Avoid for**: Stealth, calm actions, rest

### Grey/Black Spectrum

- **Use for**: Stealth, neutral actions, utility, system actions
- **Avoid for**: Primary player actions, important choices

## Complete Palette Examples

### Fantasy RPG Palette

```json
// Physical Attack
{
  "backgroundColor": "#c62828",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#d32f2f",
  "hoverTextColor": "#ffcdd2"
}

// Magic Spell
{
  "backgroundColor": "#6a1b9a",
  "textColor": "#f3e5f5",
  "hoverBackgroundColor": "#7b1fa2",
  "hoverTextColor": "#ffffff"
}

// Healing
{
  "backgroundColor": "#2e7d32",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#388e3c",
  "hoverTextColor": "#c8e6c9"
}
```

### Sci-Fi Palette

```json
// Tech Ability
{
  "backgroundColor": "#01579b",
  "textColor": "#e1f5fe",
  "hoverBackgroundColor": "#0277bd",
  "hoverTextColor": "#ffffff"
}

// Energy Weapon
{
  "backgroundColor": "#ff6f00",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#ff8f00",
  "hoverTextColor": "#fff3e0"
}

// Shield
{
  "backgroundColor": "#00838f",
  "textColor": "#e0f7fa",
  "hoverBackgroundColor": "#00acc1",
  "hoverTextColor": "#ffffff"
}
```

### Modern Setting Palette

```json
// Dialogue Option
{
  "backgroundColor": "#37474f",
  "textColor": "#eceff1",
  "hoverBackgroundColor": "#455a64",
  "hoverTextColor": "#ffffff"
}

// Investigation
{
  "backgroundColor": "#5d4037",
  "textColor": "#efebe9",
  "hoverBackgroundColor": "#6d4c41",
  "hoverTextColor": "#ffffff"
}

// Action
{
  "backgroundColor": "#b71c1c",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#c62828",
  "hoverTextColor": "#ffcdd2"
}
```

## Testing Your Colors

### Online Tools

1. [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
2. [Colorable](https://colorable.jxnblk.com/)
3. [Contrast Ratio](https://contrast-ratio.com/)

### Browser DevTools

- Chrome/Edge: Inspect element → Color picker shows contrast ratio
- Firefox: Accessibility Inspector → Check contrast issues

### Colorblind Simulation

- Use browser extensions to simulate different types of colorblindness
- Ensure actions are distinguishable by more than just color

## Quick Reference

| Action Type | Background | Text      | Contrast Ratio |
| ----------- | ---------- | --------- | -------------- |
| Attack      | `#d32f2f`  | `#ffffff` | 5.25:1 ✅      |
| Defense     | `#2e7d32`  | `#ffffff` | 5.37:1 ✅      |
| Magic       | `#7b1fa2`  | `#ffffff` | 8.59:1 ✅      |
| Healing     | `#4caf50`  | `#ffffff` | 5.71:1 ✅      |
| Social      | `#2196f3`  | `#ffffff` | 4.67:1 ✅      |
| Stealth     | `#37474f`  | `#b0bec5` | 4.51:1 ✅      |
| Warning     | `#ff6f00`  | `#ffffff` | 4.77:1 ✅      |
| Info        | `#607d8b`  | `#ffffff` | 4.54:1 ✅      |
