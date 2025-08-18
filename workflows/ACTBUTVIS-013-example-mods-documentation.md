# ACTBUTVIS-013: Create Example Mods and Documentation

## Status
**Status**: Not Started  
**Priority**: Low  
**Type**: Documentation & Examples  
**Estimated Effort**: 3 hours  

## Dependencies
- **Requires**: All ACTBUTVIS-001 through ACTBUTVIS-012 (Complete implementation)
- **Blocks**: None (Final ticket)

## Context
Create comprehensive documentation and example mods to help modders understand and use the visual customization feature. This includes practical examples, best practices, and troubleshooting guidance.

## Objectives
1. Create example mod demonstrating visual customization
2. Write comprehensive documentation for modders
3. Provide best practices and accessibility guidelines
4. Document troubleshooting common issues
5. Update existing modding documentation
6. Create migration guide for existing mods

## Implementation Details

### Example Mod Creation

#### 1. Combat Actions Visual Mod
**New Directory**: `data/examples/visual-combat-actions/`

**File**: `data/examples/visual-combat-actions/mod-manifest.json`
```json
{
  "id": "visual_combat_actions",
  "version": "1.0.0",
  "name": "Visual Combat Actions Example",
  "description": "Demonstrates visual customization for combat actions",
  "author": "Living Narrative Engine Team",
  "dependencies": ["core"],
  "loadOrder": 100,
  "category": "example"
}
```

**File**: `data/examples/visual-combat-actions/actions/power_attack.action.json`
```json
{
  "id": "power_attack",
  "name": "Power Attack",
  "description": "A powerful attack that deals extra damage but costs stamina",
  "template": "perform a power attack on {target}",
  "visual": {
    "backgroundColor": "#d32f2f",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#f44336",
    "hoverTextColor": "#ffeb3b"
  },
  "conditions": [
    {
      "type": "hasStamina",
      "minValue": 15
    }
  ],
  "effects": [
    {
      "type": "dealDamage",
      "amount": "1.5 * baseDamage",
      "target": "target"
    },
    {
      "type": "consumeStamina", 
      "amount": 15,
      "target": "actor"
    }
  ],
  "category": "combat",
  "priority": 80
}
```

**File**: `data/examples/visual-combat-actions/actions/defensive_stance.action.json`
```json
{
  "id": "defensive_stance",
  "name": "Defensive Stance",
  "description": "Adopt a defensive posture to reduce incoming damage",
  "template": "assume a defensive stance",
  "visual": {
    "backgroundColor": "#2e7d32",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#4caf50",
    "hoverTextColor": "#e8f5e8"
  },
  "conditions": [],
  "effects": [
    {
      "type": "addStatusEffect",
      "effect": "defensive_stance",
      "duration": 3,
      "target": "actor"
    }
  ],
  "category": "combat",
  "priority": 60
}
```

**File**: `data/examples/visual-combat-actions/actions/magic_missile.action.json`
```json
{
  "id": "magic_missile",
  "name": "Magic Missile",
  "description": "Launch a magical projectile at your target",
  "template": "cast magic missile at {target}",
  "visual": {
    "backgroundColor": "#7b1fa2",
    "textColor": "#e1bee7",
    "hoverBackgroundColor": "#9c27b0",
    "hoverTextColor": "#ffffff"
  },
  "conditions": [
    {
      "type": "hasMana",
      "minValue": 10
    }
  ],
  "effects": [
    {
      "type": "dealDamage",
      "damageType": "magical",
      "amount": "intelligence * 2",
      "target": "target"
    },
    {
      "type": "consumeMana",
      "amount": 10,
      "target": "actor"
    }
  ],
  "category": "magic",
  "priority": 70
}
```

#### 2. Social Interaction Visual Mod
**New Directory**: `data/examples/visual-social-actions/`

**File**: `data/examples/visual-social-actions/actions/friendly_greeting.action.json`
```json
{
  "id": "friendly_greeting",
  "name": "Greet Warmly",
  "description": "Offer a warm, friendly greeting",
  "template": "greet {target} with a warm smile",
  "visual": {
    "backgroundColor": "#4caf50",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#66bb6a",
    "hoverTextColor": "#e8f5e8"
  },
  "conditions": [],
  "effects": [
    {
      "type": "modifyRelationship",
      "amount": 5,
      "target": "target"
    }
  ],
  "category": "social",
  "priority": 50
}
```

**File**: `data/examples/visual-social-actions/actions/intimidate.action.json`
```json
{
  "id": "intimidate",
  "name": "Intimidate",
  "description": "Attempt to intimidate your target into submission",
  "template": "attempt to intimidate {target}",
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#d84315",
    "hoverTextColor": "#ffccbc"
  },
  "conditions": [
    {
      "type": "attributeCheck",
      "attribute": "strength",
      "difficulty": 12
    }
  ],
  "effects": [
    {
      "type": "addStatusEffect",
      "effect": "intimidated",
      "duration": 2,
      "target": "target"
    }
  ],
  "category": "social",
  "priority": 60
}
```

### Documentation

#### 1. Modder Documentation
**New File**: `docs/mods/action-visual-customization.md`

```markdown
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
  "backgroundColor": "#ff0000",     // Red
  "textColor": "#fff"              // White (3-digit shorthand)
}
```

### RGB Colors
```json
{
  "backgroundColor": "rgb(255, 0, 0)",      // Red
  "textColor": "rgb(255, 255, 255)"        // White
}
```

### RGBA Colors (with transparency)
```json
{
  "backgroundColor": "rgba(255, 0, 0, 0.8)", // Semi-transparent red
  "textColor": "rgba(255, 255, 255, 1.0)"   // Opaque white
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
    "backgroundColor": "#2196f3",        // Button background
    "textColor": "#ffffff",              // Button text
    "hoverBackgroundColor": "#1976d2",   // Background on hover
    "hoverTextColor": "#e3f2fd"          // Text color on hover
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
```

#### 2. README Updates
**Update File**: `README.md`

Add section about visual customization:

```markdown
## 🎨 Visual Customization

Actions can now be visually customized with custom colors! Modders can specify:

- Custom background and text colors for action buttons
- Hover state colors for interactive feedback
- Full integration with the theme system
- Accessibility-compliant color validation

See [Action Visual Customization Guide](docs/mods/action-visual-customization.md) for details.

### Quick Example

```json
{
  "id": "power_attack",
  "name": "Power Attack", 
  "template": "deliver a powerful attack to {target}",
  "visual": {
    "backgroundColor": "#d32f2f",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#f44336"
  }
}
```
```

#### 3. Modding Guide Updates
**Update File**: `docs/mods/creating-actions.md`

Add visual properties section:

```markdown
## Visual Customization

Actions can include visual properties to customize button appearance:

```json
{
  "visual": {
    "backgroundColor": "#ff6b35",     // Button background color
    "textColor": "#ffffff",           // Text color
    "hoverBackgroundColor": "#e55a2b", // Hover background
    "hoverTextColor": "#f0f0f0"       // Hover text color
  }
}
```

All visual properties are optional. For detailed guidance, see the [Visual Customization Guide](action-visual-customization.md).
```

### Example Screenshots and Assets

#### 1. Visual Guide Images
**Directory**: `docs/images/visual-customization/`

Create example screenshots showing:
- Default vs. customized action buttons
- Different color schemes in action
- Theme compatibility examples
- Accessibility examples (high contrast mode)

#### 2. Color Palette Reference
**New File**: `docs/mods/color-palettes.md`

```markdown
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
```

## Testing Guide

Create a simple test to verify the examples work:

**New File**: `tests/examples/visualCustomizationExamples.test.js`

```javascript
describe('Visual Customization Examples', () => {
  it('should load combat actions example mod', async () => {
    const testBed = new IntegrationTestBed();
    await testBed.initialize();
    
    // Load the example mod
    await testBed.loadMod('visual_combat_actions');
    
    // Verify actions loaded with visual properties
    const powerAttack = testBed.dataRegistry.get('actions.visual_combat_actions:power_attack');
    expect(powerAttack.visual).toBeDefined();
    expect(powerAttack.visual.backgroundColor).toBe('#d32f2f');
    
    await testBed.cleanup();
  });
  
  it('should render example actions with correct colors', async () => {
    // Integration test to verify visual examples render correctly
    // ... test implementation
  });
});
```

## Acceptance Criteria

1. ✅ Example combat actions mod created with diverse color schemes
2. ✅ Example social actions mod demonstrating different visual styles  
3. ✅ Comprehensive modder documentation with examples
4. ✅ Best practices and accessibility guidelines provided
5. ✅ Troubleshooting guide for common issues
6. ✅ Migration guide for existing mods
7. ✅ README.md updated with feature overview
8. ✅ Color palette reference with accessibility information
9. ✅ Example mods load and render correctly
10. ✅ Documentation is clear and easy to follow

## Notes

- Examples should demonstrate best practices
- Documentation should be accessible to novice modders
- Include both simple and advanced examples
- Provide clear troubleshooting guidance
- Ensure examples meet accessibility standards

## Related Tickets
- **Completes**: The entire ACTBUTVIS feature implementation
- **Documents**: All functionality from ACTBUTVIS-001 through ACTBUTVIS-012

## References
- Example Mods: `data/examples/visual-*-actions/`
- Documentation: `docs/mods/action-visual-customization.md`
- Color Reference: `docs/mods/color-palettes.md`
- Original Spec: `specs/action-button-visual-customization.spec.md`