# Action Button Visual Customization

This guide explains how to add custom visual properties to action buttons in your mods.

## Overview

Visual customization allows modders to specify custom colors for action buttons, making it easier for players to quickly identify different types of actions. You can customize:

- Background color
- Text color
- Hover background color
- Hover text color

## Basic Usage

Add a `visual` property to your action definition:

```json
{
  "id": "my_action",
  "name": "My Action",
  "template": "perform my action",
  "visual": {
    "backgroundColor": "#ff0000",
    "textColor": "#ffffff"
  }
}
```

## Supported Color Formats

### Hexadecimal Colors

```json
{
  "backgroundColor": "#ff0000", // Red
  "textColor": "#fff" // White (3-digit shorthand)
}
```

### RGB Colors

```json
{
  "backgroundColor": "rgb(255, 0, 0)", // Red
  "textColor": "rgb(255, 255, 255)" // White
}
```

### RGBA Colors (with transparency)

```json
{
  "backgroundColor": "rgba(255, 0, 0, 0.8)", // Semi-transparent red
  "textColor": "rgba(255, 255, 255, 1.0)" // Opaque white
}
```

### Named Colors

```json
{
  "backgroundColor": "red",
  "textColor": "white",
  "hoverBackgroundColor": "darkred",
  "hoverTextColor": "lightgray"
}
```

## Complete Visual Properties

```json
{
  "visual": {
    "backgroundColor": "#2196f3", // Button background
    "textColor": "#ffffff", // Button text
    "hoverBackgroundColor": "#1976d2", // Background on hover
    "hoverTextColor": "#e3f2fd" // Text color on hover
  }
}
```

## Color Scheme Examples

### Combat Actions (Red Theme)

```json
{
  "visual": {
    "backgroundColor": "#d32f2f",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#f44336",
    "hoverTextColor": "#ffeb3b"
  }
}
```

### Magic Actions (Purple Theme)

```json
{
  "visual": {
    "backgroundColor": "#7b1fa2",
    "textColor": "#e1bee7",
    "hoverBackgroundColor": "#9c27b0",
    "hoverTextColor": "#ffffff"
  }
}
```

### Social Actions (Green Theme)

```json
{
  "visual": {
    "backgroundColor": "#4caf50",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#66bb6a",
    "hoverTextColor": "#e8f5e8"
  }
}
```

### Stealth Actions (Dark Theme)

```json
{
  "visual": {
    "backgroundColor": "#37474f",
    "textColor": "#b0bec5",
    "hoverBackgroundColor": "#455a64",
    "hoverTextColor": "#eceff1"
  }
}
```

## Best Practices

### Accessibility Guidelines

1. **Ensure Sufficient Contrast**
   - Maintain at least 4.5:1 contrast ratio between text and background
   - Test your colors with accessibility tools
   - Consider colorblind users - don't rely solely on color to convey meaning

2. **Use Semantic Colors**
   - Red: Dangerous or destructive actions
   - Green: Positive or healing actions
   - Blue: Neutral or informational actions
   - Yellow/Orange: Caution or special actions

3. **Consistent Color Schemes**
   - Use consistent colors for similar action types across your mod
   - Consider the game's overall theme and existing UI colors

### Performance Considerations

1. **Avoid Frequent Changes**
   - Visual properties are cached for performance
   - Avoid dynamically changing colors during gameplay

2. **Limit Color Complexity**
   - Simple hex colors perform best
   - Complex CSS functions may impact performance

### Theme Compatibility

Visual properties work with all game themes:

- **Light Theme**: Colors adapt automatically
- **Dark Theme**: Colors are preserved with theme-appropriate accents
- **High Contrast Theme**: Additional borders and emphasis are added

## Troubleshooting

### Common Issues

**Colors not appearing:**

- Check that color values are valid CSS colors
- Verify JSON syntax is correct
- Check browser console for validation errors

**Colors look different than expected:**

- Browser color rendering may vary slightly
- Theme system may add subtle overlays
- High contrast mode adds borders and emphasis

**Performance issues:**

- Limit to essential color customizations
- Use simple hex colors when possible
- Avoid changing colors dynamically

### Validation Errors

The system validates color formats and will:

- Log warnings for invalid colors
- Remove invalid visual properties
- Continue loading the action without visual customization

Check your browser console for validation messages.

## Migration Guide

### Adding Visual Properties to Existing Actions

1. **Backup your mod files**
2. **Add visual properties gradually**
   - Start with important actions
   - Test thoroughly before adding to all actions
3. **Maintain backward compatibility**
   - Visual properties are optional
   - Actions without visual properties continue to work normally

### Example Migration

Before:

```json
{
  "id": "attack",
  "name": "Attack",
  "template": "attack {target}"
}
```

After:

```json
{
  "id": "attack",
  "name": "Attack",
  "template": "attack {target}",
  "visual": {
    "backgroundColor": "#d32f2f",
    "textColor": "#ffffff"
  }
}
```

## Advanced Usage

### Conditional Visual Properties

Currently, visual properties are static. For dynamic styling based on game state, consider:

- Creating multiple action variants with different visuals
- Using the existing condition system to show/hide actions

### Integration with Other Systems

Visual properties work seamlessly with:

- Action conditions and effects
- Target resolution system
- Turn management
- Save/load system

## Examples

See the example mods in `data/examples/`:

- `visual-combat-actions/` - Combat action color schemes
- `visual-social-actions/` - Social interaction colors

## Technical Reference

### Schema Definition

Visual properties are defined in `data/schemas/action.schema.json`:

- All properties are optional
- Colors must be valid CSS color values
- Invalid colors are removed with warnings logged

### Implementation Details

The visual customization system:

1. Validates colors during action loading
2. Preserves visual properties through the action pipeline
3. Applies inline styles to rendered buttons
4. Manages hover states with event listeners
5. Integrates with the theme system

For technical implementation details, see the component documentation.
