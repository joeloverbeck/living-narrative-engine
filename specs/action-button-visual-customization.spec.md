# Action Button Visual Customization Specification (PROPOSED)

> ⚠️ **IMPORTANT: This is a PROPOSED FEATURE that has NOT been implemented yet.**  
> This document describes a planned feature for visual customization of action buttons.  
> The current system does not support any of the visual properties described below.

## Implementation Status

### Current State (As of 2025-01-18)

**NOT IMPLEMENTED** - The visual customization feature described in this specification does not exist in the current codebase.

#### What Currently Exists:

- Basic action button rendering using `action-button` CSS class
- Actions are displayed as plain buttons with default styling
- No support for custom colors or visual properties
- No `visual` field in action schemas or DTOs

#### What This Document Proposes:

- Extension of action system to support visual customization
- Custom colors for action buttons (background, text, hover states)
- Full backward compatibility with existing actions

### Prerequisites for Implementation

The following components exist and would need to be modified:

- `data/schemas/action.schema.json` - Action schema definition
- `src/turns/dtos/actionComposite.js` - Action data transfer object
- `src/actions/pipeline/stages/ActionFormattingStage.js` - Action processing pipeline
- `src/domUI/actionButtonsRenderer.js` - Button rendering logic

---

## 1. Overview

### 1.1 Feature Summary

This specification defines the implementation of modder-defined visual customization for action buttons in the Living Narrative Engine. The feature will allow modders to specify custom background and text colors for individual actions, enabling visual differentiation based on action type, importance, or narrative context.

### 1.2 Business Value

- **Enhanced Visual Communication**: Modders can use color to convey action importance, danger level, or type (e.g., red for aggressive actions, green for peaceful)
- **Improved User Experience**: Players can quickly identify action types through visual cues
- **Greater Creative Control**: Modders gain fine-grained control over the visual presentation of their content
- **Theme Flexibility**: Actions can maintain distinct visual identity across different UI themes

### 1.3 Technical Objectives

- Extend action schema to support visual properties
- Maintain backward compatibility with existing actions
- Ensure efficient rendering with minimal performance impact
- Preserve accessibility standards and theme system integration

## 2. Requirements

### 2.1 Functional Requirements

#### FR-1: Color Customization Properties

- Modders SHALL be able to specify background color for action buttons
- Modders SHALL be able to specify text color for action buttons
- Modders MAY specify hover state background color
- Modders MAY specify hover state text color
- All color properties SHALL be optional

#### FR-2: Color Format Support

The system SHALL accept the following color formats:

- Hexadecimal: `#RGB`, `#RRGGBB`
- RGB/RGBA: `rgb(r, g, b)`, `rgba(r, g, b, a)`
- CSS color names: `red`, `blue`, `darkgreen`, etc.

#### FR-3: Visual Property Inheritance

- Actions without visual properties SHALL use theme defaults
- Partially specified visual properties SHALL merge with defaults
- Custom colors SHALL override theme colors

### 2.2 Non-Functional Requirements

#### NFR-1: Performance

- Color application SHALL add <5ms to button rendering time
- System SHALL handle 100+ custom-colored buttons without lag
- Inline styles SHALL be optimized for browser rendering

#### NFR-2: Accessibility

- System SHALL maintain WCAG 2.1 AA compliance
- Custom colors SHALL NOT override user accessibility preferences
- System SHOULD warn about poor color contrast choices (future enhancement)

#### NFR-3: Backward Compatibility

- Existing actions without visual properties SHALL continue to work
- Schema changes SHALL be additive only
- No breaking changes to existing mod content

#### NFR-4: Theme Integration

- Custom colors SHALL work with all existing themes
- Selected state styling SHALL be preserved
- Animations and transitions SHALL work with custom colors

### 2.3 Constraints

- Colors must be valid CSS color values
- Visual properties are display-only (no gameplay impact)
- Maximum of 4 color properties per action

## 3. Technical Design

### 3.1 Schema Modifications

#### 3.1.1 Action Schema Enhancement

File: `data/schemas/action.schema.json`

**PROPOSED ADDITION:**

```json
{
  "properties": {
    "visual": {
      "type": "object",
      "description": "Visual customization options for action buttons",
      "properties": {
        "backgroundColor": {
          "type": "string",
          "description": "CSS color value for button background",
          "pattern": "^(#([0-9A-Fa-f]{3}){1,2}|rgb\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*\\)|rgba\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*[\\d.]+\\s*\\)|[a-zA-Z]+)$",
          "examples": ["#ff0000", "rgb(255, 0, 0)", "red"]
        },
        "textColor": {
          "type": "string",
          "description": "CSS color value for button text",
          "pattern": "^(#([0-9A-Fa-f]{3}){1,2}|rgb\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*\\)|rgba\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*[\\d.]+\\s*\\)|[a-zA-Z]+)$",
          "examples": ["#ffffff", "rgb(255, 255, 255)", "white"]
        },
        "hoverBackgroundColor": {
          "type": "string",
          "description": "CSS color for button hover state background (optional)",
          "pattern": "^(#([0-9A-Fa-f]{3}){1,2}|rgb\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*\\)|rgba\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*[\\d.]+\\s*\\)|[a-zA-Z]+)$"
        },
        "hoverTextColor": {
          "type": "string",
          "description": "CSS color for button hover state text (optional)",
          "pattern": "^(#([0-9A-Fa-f]{3}){1,2}|rgb\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*\\)|rgba\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*[\\d.]+\\s*\\)|[a-zA-Z]+)$"
        }
      },
      "additionalProperties": false
    }
  }
}
```

### 3.2 Data Flow Architecture

```
Action Definition (JSON)
    ↓ [includes visual properties]
ActionLoader
    ↓ [validates against schema]
ActionFormattingStage
    ↓ [preserves visual data]
ActionComposite DTO
    ↓ [contains visual property]
ActionButtonsRenderer
    ↓ [applies inline styles]
HTML Button Element
```

### 3.3 Component Modifications

#### 3.3.1 ActionComposite DTO

File: `src/turns/dtos/actionComposite.js`

**PROPOSED MODIFICATION:**

```javascript
class ActionComposite {
  constructor({
    index,
    actionId,
    commandString,
    params,
    description,
    visual = null, // NEW: Optional visual properties
  }) {
    this.index = index;
    this.actionId = actionId;
    this.commandString = commandString;
    this.params = params;
    this.description = description;
    this.visual = visual; // NEW: Store visual configuration
  }
}
```

#### 3.3.2 ActionButtonsRenderer

File: `src/domUI/actionButtonsRenderer.js`

**PROPOSED** modification points:

- Line ~249: Button creation
- Add visual style application logic
- Implement hover state handling

## 4. Implementation Guidelines

### 4.1 Phase 1: Data Model (Backend)

#### Step 1.1: Update Action Schema

**File**: `data/schemas/action.schema.json`

- Add visual property definition as specified in section 3.1.1
- Ensure validation patterns correctly match CSS color formats
- Update schema version if versioning is used

#### Step 1.2: Modify ActionComposite DTO

**File**: `src/turns/dtos/actionComposite.js`

**PROPOSED CODE:**

```javascript
// In createActionComposite function
export function createActionComposite({
  index,
  actionId,
  commandString,
  params = {},
  description = '',
  visual = null, // NEW parameter
}) {
  // Validation
  assertNonBlankString(actionId, 'ActionComposite requires actionId');
  assertPresent(commandString, 'ActionComposite requires commandString');

  // NEW: Validate visual properties if provided
  if (visual) {
    validateVisualProperties(visual);
  }

  return Object.freeze({
    index,
    actionId,
    commandString,
    params: Object.freeze(params),
    description,
    visual: visual ? Object.freeze(visual) : null, // NEW
  });
}

// NEW: Visual properties validation helper
function validateVisualProperties(visual) {
  const validColorPattern =
    /^(#([0-9A-Fa-f]{3}){1,2}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|[a-zA-Z]+)$/;

  if (
    visual.backgroundColor &&
    !validColorPattern.test(visual.backgroundColor)
  ) {
    throw new Error(`Invalid backgroundColor: ${visual.backgroundColor}`);
  }
  if (visual.textColor && !validColorPattern.test(visual.textColor)) {
    throw new Error(`Invalid textColor: ${visual.textColor}`);
  }
  // Validate hover colors similarly...
}
```

#### Step 1.3: Update ActionFormattingStage

**File**: `src/actions/pipeline/stages/ActionFormattingStage.js`

**PROPOSED CODE:**

```javascript
// In execute method, when creating action composite
const actionComposite = createActionComposite({
  index: context.index,
  actionId: context.actionId,
  commandString: formattedCommand,
  params: context.formattedParams || {},
  description: context.description || '',
  visual: context.actionData?.visual || null, // NEW: Pass visual data
});
```

#### Step 1.4: Update TurnActionFactory

**File**: `src/turns/factories/turnActionFactory.js`

**PROPOSED CODE:**

```javascript
// Ensure visual properties flow through factory
// In createTurnAction or similar method
const turnAction = {
  ...baseAction,
  visual: actionDefinition.visual || null, // NEW
};
```

### 4.2 Phase 2: UI Implementation (Frontend)

#### Step 2.1: Modify ActionButtonsRenderer

**File**: `src/domUI/actionButtonsRenderer.js`

**PROPOSED CODE:**

```javascript
// Around line 225 - in _renderListItem method
_renderListItem(actionComposite, container) {
  // ... existing code ...

  // Around line 249 - button creation
  const button = this.domElementFactory.button(buttonText, 'action-button');

  // NEW: Apply custom visual styles
  this._applyVisualStyles(button, actionComposite.visual);

  // ... rest of existing code ...
}

// NEW: Visual styles application method
_applyVisualStyles(button, visual) {
  if (!visual) return;

  // Apply base colors
  if (visual.backgroundColor) {
    button.style.backgroundColor = visual.backgroundColor;
  }
  if (visual.textColor) {
    button.style.color = visual.textColor;
  }

  // Store original colors for hover restoration
  if (visual.hoverBackgroundColor || visual.hoverTextColor) {
    const originalBg = visual.backgroundColor || '';
    const originalText = visual.textColor || '';

    button.dataset.originalBg = originalBg;
    button.dataset.originalText = originalText;
    button.dataset.hoverBg = visual.hoverBackgroundColor || originalBg;
    button.dataset.hoverText = visual.hoverTextColor || originalText;

    // Add hover event listeners
    button.addEventListener('mouseenter', this._handleCustomHover.bind(this));
    button.addEventListener('mouseleave', this._handleCustomHoverEnd.bind(this));
  }
}

// NEW: Hover handlers
_handleCustomHover(event) {
  const button = event.target;
  if (button.dataset.hoverBg) {
    button.style.backgroundColor = button.dataset.hoverBg;
  }
  if (button.dataset.hoverText) {
    button.style.color = button.dataset.hoverText;
  }
}

_handleCustomHoverEnd(event) {
  const button = event.target;
  if (button.dataset.originalBg !== undefined) {
    button.style.backgroundColor = button.dataset.originalBg;
  }
  if (button.dataset.originalText !== undefined) {
    button.style.color = button.dataset.originalText;
  }
}
```

### 4.3 Phase 3: Testing

#### Unit Tests Required

1. **ActionComposite Tests** (`tests/unit/turns/dtos/actionComposite.test.js`)
   - Test creation with visual properties
   - Test validation of invalid color formats
   - Test immutability of visual object

2. **ActionButtonsRenderer Tests** (`tests/unit/domUI/actionButtonsRenderer.test.js`)
   - Test button rendering with custom colors
   - Test hover state application
   - Test fallback to defaults when no visual props

3. **Schema Validation Tests** (`tests/unit/validation/actionSchema.test.js`)
   - Test valid color formats acceptance
   - Test invalid color formats rejection
   - Test optional nature of visual properties

#### Integration Tests Required

1. **End-to-End Action Loading** (`tests/integration/actions/actionLoading.test.js`)
   - Test loading action with visual properties from JSON
   - Test visual data preservation through pipeline
   - Test rendering in simulated DOM

2. **Theme Compatibility** (`tests/integration/ui/themeCompatibility.test.js`)
   - Test custom colors work with different themes
   - Test selected state preservation
   - Test animation compatibility

## 5. Validation & Constraints

### 5.1 Color Validation Rules

1. **Valid Formats**:
   - Hex: `#RGB`, `#RRGGBB` (case-insensitive)
   - RGB: `rgb(0-255, 0-255, 0-255)`
   - RGBA: `rgba(0-255, 0-255, 0-255, 0-1)`
   - Named: Any valid CSS color name

2. **Invalid Formats** (should be rejected):
   - Invalid hex: `#GGG`, `#12345`
   - Out of range RGB: `rgb(300, 0, 0)`
   - Malformed: `rgb(0,0,0)`, `#`

### 5.2 Accessibility Considerations

1. **Contrast Requirements**:
   - Text should maintain 4.5:1 contrast ratio (WCAG AA)
   - Consider implementing contrast checking utility (future)

2. **User Preferences**:
   - Respect system high-contrast mode
   - Allow user to disable custom colors (future)

3. **Colorblind Considerations**:
   - Recommend not relying solely on color for information
   - Suggest using icons or patterns in addition to color

### 5.3 Performance Constraints

1. **Rendering Limits**:
   - Maximum 200 inline styles per page
   - Batch DOM updates when possible
   - Use CSS variables for frequently repeated colors

2. **Memory Management**:
   - Clean up event listeners on button removal
   - Avoid creating new style objects repeatedly

## 6. Examples & Usage Patterns

### 6.1 Basic Color Customization

**PROPOSED EXAMPLE:**

```json
{
  "id": "dialogue:friendly_greeting",
  "name": "Greet Friendly",
  "description": "Offer a warm greeting",
  "visual": {
    "backgroundColor": "#4CAF50",
    "textColor": "#ffffff"
  },
  "template": "greet {target} warmly"
}
```

### 6.2 Combat Action with Hover

**PROPOSED EXAMPLE:**

```json
{
  "id": "combat:power_attack",
  "name": "Power Attack",
  "description": "A powerful but risky attack",
  "visual": {
    "backgroundColor": "#d32f2f",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#f44336",
    "hoverTextColor": "#ffeb3b"
  },
  "template": "power attack {target}",
  "cost": { "stamina": 15 }
}
```

### 6.3 Stealth Action

**PROPOSED EXAMPLE:**

```json
{
  "id": "stealth:sneak",
  "name": "Sneak",
  "description": "Move silently",
  "visual": {
    "backgroundColor": "#37474f",
    "textColor": "#b0bec5",
    "hoverBackgroundColor": "#455a64",
    "hoverTextColor": "#eceff1"
  },
  "template": "sneak past {target}"
}
```

### 6.4 Magic/Special Action

**PROPOSED EXAMPLE:**

```json
{
  "id": "magic:cast_fireball",
  "name": "Fireball",
  "description": "Cast a fireball spell",
  "visual": {
    "backgroundColor": "#ff6f00",
    "textColor": "#fff3e0",
    "hoverBackgroundColor": "#ff8f00",
    "hoverTextColor": "#ffffff"
  },
  "template": "cast fireball at {target}",
  "cost": { "mana": 25 }
}
```

## 7. Migration & Rollout

### 7.1 Rollout Strategy

1. **Phase 1**: Deploy schema and backend changes (backward compatible)
2. **Phase 2**: Deploy UI rendering changes
3. **Phase 3**: Provide example mod with visual customizations
4. **Phase 4**: Update documentation and modding guides

### 7.2 Migration Guide for Modders

- No migration required for existing actions
- Visual properties are completely optional
- Can be added incrementally to existing actions

### 7.3 Testing Checklist

- [ ] Schema validation works for all color formats
- [ ] Actions load correctly with visual properties
- [ ] Buttons render with custom colors
- [ ] Hover states work correctly
- [ ] Theme switching doesn't break custom colors
- [ ] Performance is acceptable with 100+ colored buttons
- [ ] Existing actions without visual props still work
- [ ] Selected state styling is preserved

## 8. Future Enhancements

### 8.1 Potential Future Features

1. **Gradient Support**: Allow gradient backgrounds
2. **Icon Support**: Custom icons for actions
3. **Animation Properties**: Custom animation speeds/types
4. **Conditional Styling**: Colors based on game state
5. **Color Presets**: Named color schemes for consistency
6. **Accessibility Warnings**: Automatic contrast checking

### 8.2 Optimization Opportunities

1. **CSS Variable Generation**: Convert frequently used colors to CSS variables
2. **Style Deduplication**: Share styles between identical visual configs
3. **Lazy Loading**: Only apply styles to visible buttons
4. **Theme Integration**: Allow themes to modify custom colors

## 9. Success Criteria

The implementation will be considered successful when:

1. **Functionality**:
   - Modders can specify all four color properties
   - Colors render correctly in all supported browsers
   - Hover states work as specified

2. **Performance**:
   - No noticeable lag with 100+ custom buttons
   - Page load time increase <50ms

3. **Quality**:
   - All tests pass (unit, integration, e2e)
   - No regression in existing functionality
   - Code coverage maintained at 80%+

4. **Documentation**:
   - Modding guide updated with examples
   - Schema documentation includes visual properties
   - Migration guide available for modders

## 10. Appendices

### Appendix A: CSS Color Name Reference

Standard CSS color names that will be supported:

- Basic: black, white, red, green, blue, yellow, etc.
- Extended: crimson, forestgreen, midnightblue, goldenrod, etc.
- Full list: https://www.w3.org/TR/css-color-3/#svg-color

### Appendix B: Testing Data Sets

Recommended test cases for validation:

- Valid hex: `#f00`, `#ff0000`, `#FF0000`
- Valid rgb: `rgb(255, 0, 0)`, `rgb(255,0,0)`
- Valid rgba: `rgba(255, 0, 0, 0.5)`, `rgba(255,0,0,1)`
- Valid names: `red`, `darkblue`, `mediumseagreen`
- Invalid: `#gg0000`, `rgb(256, 0, 0)`, `notacolor`

### Appendix C: Browser Compatibility

Feature support requirements:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

All use standard CSS color properties and JavaScript event handling.

---

**Document Version**: 1.0.1  
**Date**: 2025-01-18  
**Status**: PROPOSED FEATURE - Not Implemented  
**Implementation Status**: Design Phase  
**Author**: System Architecture Team
