# Action Button Visual Customization Analysis Report

## Executive Summary

This report analyzes the current implementation of action button rendering in the Living Narrative Engine and outlines the required changes to support modder-defined background and text colors for action buttons. The proposed enhancement will add visual customization properties to the action schema, allowing modders to create visually distinct action buttons that reflect the nature or importance of different actions.

## Current Implementation Analysis

### 1. Data Flow Overview

The action button rendering process follows this data flow:

1. **Action Definition** (`data/mods/*/actions/*.action.json`)
   - Loaded by `ActionLoader` class
   - Validated against `data/schemas/action.schema.json`
   - Stored in data registry

2. **Action Composite Creation** (`src/turns/dtos/actionComposite.js`)
   - Creates immutable action data transfer objects
   - Contains: `index`, `actionId`, `commandString`, `params`, `description`
   - No visual properties currently included

3. **UI Rendering** (`src/domUI/actionButtonsRenderer.js`)
   - Receives `ActionComposite` objects via event system
   - Creates HTML button elements with class `action-button`
   - Applies CSS classes for styling

### 2. Current CSS Implementation

#### Color Variables (defined in `css/themes/_default-theme.css`)

```css
--button-bg-color: #1abc9c (Teal/Cyan) --button-text-color: #ffffff (White)
  --button-hover-bg-color: #16a085 (Darker Teal)
  --button-selected-bg-color: #e67e22 (Orange)
  --button-selected-text-color: #ffffff (White);
```

#### Button Styling (from `css/components/_buttons.css`)

- All action buttons use the same base colors
- Selected state uses orange background
- No per-action customization capability

### 3. Key Components Using Action Data

#### ActionButtonsRenderer (`src/domUI/actionButtonsRenderer.js`)

- **Line 249**: Creates button element with `action-button` class
- **Lines 258-263**: Sets button attributes and data
- No color customization logic present

#### ActionComposite DTO (`src/turns/dtos/actionComposite.js`)

- Defines the data structure passed to UI
- Currently includes: `index`, `actionId`, `commandString`, `params`, `description`
- No visual properties

## Proposed Implementation

### 1. Schema Enhancement

**File to Modify**: `data/schemas/action.schema.json`

Add new optional properties:

```json
{
  "properties": {
    // ... existing properties ...
    "visual": {
      "type": "object",
      "description": "Visual customization options for action buttons",
      "properties": {
        "backgroundColor": {
          "type": "string",
          "description": "CSS color value for button background (hex, rgb, or CSS color name)",
          "pattern": "^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^rgb\\(|^rgba\\(|^[a-zA-Z]+$",
          "examples": ["#ff0000", "rgb(255, 0, 0)", "red", "#f00"]
        },
        "textColor": {
          "type": "string",
          "description": "CSS color value for button text (hex, rgb, or CSS color name)",
          "pattern": "^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^rgb\\(|^rgba\\(|^[a-zA-Z]+$",
          "examples": ["#ffffff", "rgb(255, 255, 255)", "white", "#fff"]
        },
        "hoverBackgroundColor": {
          "type": "string",
          "description": "Optional CSS color for button hover state background",
          "pattern": "^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^rgb\\(|^rgba\\(|^[a-zA-Z]+$"
        },
        "hoverTextColor": {
          "type": "string",
          "description": "Optional CSS color for button hover state text",
          "pattern": "^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^rgb\\(|^rgba\\(|^[a-zA-Z]+$"
        }
      },
      "additionalProperties": false
    }
  }
}
```

### 2. Files Requiring Modification

#### Core Files to Modify:

1. **`data/schemas/action.schema.json`**
   - Add visual properties schema definition
   - Update examples to show usage

2. **`src/turns/dtos/actionComposite.js`**
   - Add `visual` property to ActionComposite interface
   - Update `createActionComposite` function to accept visual data
   - Update validation logic

3. **`src/domUI/actionButtonsRenderer.js`**
   - Modify `_renderListItem` method (line 225)
   - Apply inline styles based on visual properties
   - Handle hover states with JavaScript

4. **`src/actions/pipeline/stages/ActionFormattingStage.js`**
   - Pass visual properties from action definition to composite
   - Ensure visual data flows through pipeline

5. **`src/turns/factories/turnActionFactory.js`**
   - Include visual properties when creating turn actions
   - Preserve visual data through factory

#### Supporting Files to Modify:

6. **`src/data/providers/availableActionsProvider.js`**
   - Ensure visual properties are included in available actions

7. **`src/turns/adapters/actionIndexerAdapter.js`**
   - Pass visual properties through adapter layer

8. **Test Files** (multiple):
   - Update unit tests for actionComposite
   - Update integration tests for action rendering
   - Add tests for visual customization

### 3. Implementation Details

#### Button Rendering Changes

In `actionButtonsRenderer.js`, modify the button creation:

```javascript
// Line 249 area - enhanced button creation
const button = this.domElementFactory.button(buttonText, 'action-button');

// Apply custom visual styles if provided
if (actionComposite.visual) {
  const { backgroundColor, textColor, hoverBackgroundColor, hoverTextColor } =
    actionComposite.visual;

  if (backgroundColor) {
    button.style.backgroundColor = backgroundColor;
  }
  if (textColor) {
    button.style.color = textColor;
  }

  // Store hover colors as data attributes for JavaScript handling
  if (hoverBackgroundColor) {
    button.dataset.hoverBg = hoverBackgroundColor;
  }
  if (hoverTextColor) {
    button.dataset.hoverText = hoverTextColor;
  }
}
```

#### CSS Considerations

- Custom colors should override theme defaults
- Maintain accessibility with contrast checking
- Preserve selected state styling (orange glow)
- Ensure animations work with custom colors

### 4. Example Usage

After implementation, modders could define actions like:

```json
{
  "id": "combat:critical_strike",
  "name": "Critical Strike",
  "description": "A devastating attack with increased damage",
  "visual": {
    "backgroundColor": "#cc0000",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#ff0000",
    "hoverTextColor": "#ffff00"
  },
  "template": "critical strike {target}",
  "targets": "combat:enemies"
}
```

## Implementation Risks & Considerations

### 1. Accessibility

- Custom colors may not meet WCAG contrast requirements
- Consider adding validation or warnings for poor contrast choices
- May need to provide accessibility override option

### 2. Theme Compatibility

- Custom colors may clash with user-selected themes
- Consider priority system: custom colors > theme colors > defaults

### 3. Performance

- Inline styles on many buttons could impact rendering performance
- Consider CSS variable approach for frequently used color combinations

### 4. Backward Compatibility

- All visual properties should be optional
- Actions without visual properties use existing theme defaults
- No breaking changes to existing mod content

## Recommended Implementation Order

1. **Phase 1**: Schema and Data Model
   - Update action.schema.json
   - Modify ActionComposite DTO
   - Update factories and adapters

2. **Phase 2**: UI Implementation
   - Modify actionButtonsRenderer.js
   - Add hover state handling
   - Test with sample actions

3. **Phase 3**: Testing and Documentation
   - Create comprehensive test suite
   - Update documentation for modders
   - Create example mod with visual customization

## Testing Requirements

### Unit Tests

- ActionComposite creation with visual properties
- Schema validation for visual properties
- Button rendering with custom colors

### Integration Tests

- End-to-end action loading with visual data
- UI rendering with various color combinations
- Theme switching with custom colors

### Manual Testing

- Visual verification of custom colors
- Accessibility testing with screen readers
- Performance testing with many custom-colored buttons

## Conclusion

The proposed enhancement to add visual customization for action buttons is technically feasible and aligns well with the engine's modding-first philosophy. The implementation requires changes across 8-10 core files, with the main complexity being in ensuring the visual data flows correctly from action definitions to the UI layer.

The enhancement would provide modders with powerful visual customization capabilities while maintaining backward compatibility and theme system integration. With proper implementation and testing, this feature would significantly enhance the visual variety and expressiveness of game actions.

## Next Steps

1. Review and approve the proposed schema changes
2. Implement Phase 1 (data model changes)
3. Create proof-of-concept with test actions
4. Implement Phase 2 (UI changes)
5. Comprehensive testing
6. Documentation and examples for modders
