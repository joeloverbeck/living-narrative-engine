# Draw Attention to Ass Seduction Action Specification

## Overview

This specification defines a new self-targeting seduction action that allows actors to draw attention to their ass, similar to the existing `draw_attention_to_breasts` action. The action enables actors to angle and position themselves to flatter their buttocks in an alluring manner.

### Design Philosophy

- **Pattern Consistency**: Follows the exact structure of `seduction:draw_attention_to_breasts`
- **Self-Targeting**: No external targets required (targets: "none")
- **Anatomy-Based Prerequisites**: Requires `ass_cheek` body parts
- **Clothing Requirement**: Must be wearing clothing in `torso_lower` slot
- **Visual Consistency**: Uses same orange color scheme as other seduction actions

## Requirements

### Functional Requirements

1. **Action Availability**: Action appears when actor has:
   - At least one `ass_cheek` body part
   - Clothing equipped in `torso_lower` slot

2. **Action Execution**: When executed, generates perceptible message about drawing attention to ass

3. **Visual Feedback**: Uses distinctive orange color scheme matching seduction mod theme

4. **State Requirements**: No special positional states required (can be standing, sitting, etc.)

### Non-Functional Requirements

1. **Consistency**: Match existing seduction mod patterns and conventions
2. **Testability**: Comprehensive test coverage for action discovery and rule behavior
3. **Accessibility**: WCAG 2.1 AA compliant color contrast
4. **Schema Compliance**: All JSON files must validate against schemas

## Component Files

### 1. Action Definition

**File:** `data/mods/seduction/actions/draw_attention_to_ass.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "seduction:draw_attention_to_ass",
  "name": "Draw Attention to Ass",
  "description": "Angle and position yourself to flatter your buttocks, drawing attention to your ass in an alluring manner.",
  "targets": "none",
  "required_components": {},
  "template": "draw attention to your ass",
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["actor", "ass_cheek"]
      },
      "failure_message": "You need ass cheeks to perform this action."
    },
    {
      "logic": {
        "hasClothingInSlot": ["actor", "torso_lower"]
      },
      "failure_message": "You need to be wearing clothing on your lower torso to draw attention to your ass."
    }
  ],
  "visual": {
    "backgroundColor": "#f57f17",
    "textColor": "#000000",
    "hoverBackgroundColor": "#f9a825",
    "hoverTextColor": "#212121"
  }
}
```

**Key Design Decisions:**

- **Body Part Type**: Uses `ass_cheek` (validated from existing anatomy definitions)
- **Clothing Slot**: Uses `torso_lower` which covers the buttocks area
- **Prerequisites Order**: Body part check first, clothing check second (matches breasts pattern)
- **Visual Styling**: Orange theme (#f57f17) consistent with `draw_attention_to_breasts`

### 2. Condition Definition

**File:** `data/mods/seduction/conditions/event-is-action-draw-attention-to-ass.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "seduction:event-is-action-draw-attention-to-ass",
  "description": "Checks if the triggering event is for the 'seduction:draw_attention_to_ass' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "seduction:draw_attention_to_ass"
    ]
  }
}
```

**Purpose:** Standard event type check for rule triggering.

### 3. Rule Definition

**File:** `data/mods/seduction/rules/draw_attention_to_ass.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "draw_attention_to_ass",
  "comment": "Handles the 'seduction:draw_attention_to_ass' action. Generates descriptive text about the actor drawing attention to their ass.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "seduction:event-is-action-draw-attention-to-ass"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "comment": "Get actor name for the messages.",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get location for the perceptible event.",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Construct the perceptible log message for observers.",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} angles to flatter their ass, drawing attention to the curve of the ass cheeks."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_self_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": null
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**Key Design Decisions:**

- **Message Wording**: "{actor} angles to flatter their ass, drawing attention to the curve of the ass cheeks."
  - Uses gender-neutral "their" instead of "her"
  - Describes both the action ("angles to flatter") and the body part focus ("curve of the ass cheeks")
- **Perception Type**: `action_self_general` (self-directed, observable by others)
- **No Target ID**: Self-targeting action has `targetId: null`

### 4. Mod Manifest Updates

**File:** `data/mods/seduction/mod-manifest.json`

Add the following entries to respective arrays within the `content` object:

```json
{
  "content": {
    "actions": [
      "draw_attention_to_ass.action.json"
    ],
    "conditions": [
      "event-is-action-draw-attention-to-ass.condition.json"
    ],
    "rules": [
      "draw_attention_to_ass.rule.json"
    ]
  }
}
```

## Test Requirements

### 1. Action Discovery Test

**File:** `tests/integration/mods/seduction/draw_attention_to_ass_action_discovery.test.js`

**Test Scenarios:**

1. **Action Structure Validation**
   - Verify action ID, name, description, template
   - Verify targets is "none" (self-targeting)
   - Verify visual styling (orange theme)
   - Verify schema compliance

2. **Discovery with Valid Prerequisites**
   - Setup: Actor with ass_cheek parts and torso_lower clothing
   - Expected: Action appears in available actions list
   - Verify: Action is properly instantiated and selectable

3. **Discovery Blocked - Missing Body Part**
   - Setup: Actor without ass_cheek parts (has torso_lower clothing)
   - Expected: Action does not appear or shows failure message
   - Verify: Prerequisite logic blocks action

4. **Discovery Blocked - Missing Clothing**
   - Setup: Actor with ass_cheek parts but no torso_lower clothing
   - Expected: Action does not appear or shows failure message
   - Verify: Clothing requirement enforced

5. **Discovery Blocked - Both Missing**
   - Setup: Actor without ass_cheek parts and no torso_lower clothing
   - Expected: Action does not appear
   - Verify: Both prerequisites must be met

**Test Implementation Pattern:**

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import drawAttentionToAssAction from '../../../../data/mods/seduction/actions/draw_attention_to_ass.action.json';

describe('seduction:draw_attention_to_ass action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'seduction',
      'seduction:draw_attention_to_ass'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  // Test scenarios here...
});
```

### 2. Action Behavior Test

**File:** `tests/integration/mods/seduction/draw_attention_to_ass_action.test.js`

**Test Scenarios:**

1. **Action Properties Validation**
   - Verify all required action properties present
   - Verify correct ID format (`seduction:draw_attention_to_ass`)
   - Verify name is human-readable
   - Verify description is descriptive and clear
   - Verify template format and grammar

2. **Visual Styling Validation**
   - Verify orange theme colors match specifications
   - Verify WCAG 2.1 AA contrast requirements met
   - Verify hover colors provide adequate feedback
   - Use `validateVisualStyling` helper
   - Use `validateAccessibilityCompliance` helper

3. **Prerequisites Logic Validation**
   - Verify `hasPartOfType` logic for ass_cheek
   - Verify `hasClothingInSlot` logic for torso_lower
   - Verify failure messages are descriptive
   - Verify prerequisite count and order

4. **Component Requirements**
   - Verify no required components (empty object)
   - Verify no forbidden components
   - Use `validateComponentRequirements` helper

5. **Schema Compliance**
   - Verify action validates against action schema
   - Verify all required fields present
   - Verify template uses lowercase start
   - Use `validateRequiredActionProperties` helper

**Test Implementation Pattern:**

```javascript
import { describe, it, expect } from '@jest/globals';
import drawAttentionToAssAction from '../../../../data/mods/seduction/actions/draw_attention_to_ass.action.json';
import {
  validateActionProperties,
  validateVisualStyling,
  validatePrerequisites,
  validateComponentRequirements,
  validateRequiredActionProperties,
  validateAccessibilityCompliance,
} from '../../../common/mods/actionPropertyHelpers.js';

describe('Seduction Mod: Draw Attention to Ass Action', () => {
  describe('Action Properties', () => {
    it('should have correct action properties', () => {
      validateActionProperties(drawAttentionToAssAction, {
        id: 'seduction:draw_attention_to_ass',
        name: 'Draw Attention to Ass',
        targets: 'none',
        template: 'draw attention to your ass',
        $schema: 'schema://living-narrative-engine/action.schema.json',
      });
    });

    // More tests...
  });
});
```

### 3. Rule Behavior Test

**File:** `tests/integration/mods/seduction/draw_attention_to_ass_rule.test.js`

**Test Scenarios:**

1. **Rule Triggering**
   - Verify rule triggers on correct event type
   - Verify condition checks correct action ID
   - Verify rule processes when condition matches

2. **Message Generation**
   - Verify perceptible log message format
   - Verify actor name substitution works
   - Verify message contains expected text about ass cheeks
   - Verify message is gender-neutral

3. **Turn Management**
   - Verify action ends turn after execution
   - Verify success state is set correctly
   - Verify macro `core:logSuccessAndEndTurn` is called

4. **Event Broadcasting**
   - Verify perceptible event is dispatched
   - Verify observers in same location can perceive action
   - Verify perception type is `action_self_general`

## Implementation Checklist

### Phase 1: File Creation
- [ ] Create `data/mods/seduction/actions/draw_attention_to_ass.action.json`
- [ ] Create `data/mods/seduction/conditions/event-is-action-draw-attention-to-ass.condition.json`
- [ ] Create `data/mods/seduction/rules/draw_attention_to_ass.rule.json`
- [ ] Update `data/mods/seduction/mod-manifest.json`

### Phase 2: Test Suite - Action Discovery
- [ ] Create `tests/integration/mods/seduction/draw_attention_to_ass_action_discovery.test.js`
- [ ] Implement action structure validation tests
- [ ] Implement discovery with valid prerequisites test
- [ ] Implement discovery blocked without body part test
- [ ] Implement discovery blocked without clothing test
- [ ] Verify all discovery tests pass

### Phase 3: Test Suite - Action Behavior
- [ ] Create `tests/integration/mods/seduction/draw_attention_to_ass_action.test.js`
- [ ] Implement action properties validation tests
- [ ] Implement visual styling validation tests
- [ ] Implement prerequisites logic validation tests
- [ ] Implement component requirements tests
- [ ] Implement schema compliance tests
- [ ] Verify all behavior tests pass

### Phase 4: Test Suite - Rule Behavior
- [ ] Create `tests/integration/mods/seduction/draw_attention_to_ass_rule.test.js`
- [ ] Implement rule triggering tests
- [ ] Implement message generation tests
- [ ] Implement turn management tests
- [ ] Implement event broadcasting tests
- [ ] Verify all rule tests pass

### Phase 5: Integration & Validation
- [ ] Run `npm run scope:lint` to validate scope DSL (if applicable)
- [ ] Run `npm run test:integration` to verify all integration tests
- [ ] Verify action appears in game UI with correct styling
- [ ] Manual testing: Execute action and verify message output
- [ ] Verify action properly ends turn
- [ ] Update mod documentation if needed

## Validation Criteria

### Code Quality
- All JSON files validate against their schemas
- No ESLint errors or warnings
- Code follows project conventions and patterns

### Test Coverage
- Action discovery test: >90% coverage
- Action behavior test: >90% coverage
- Rule behavior test: >80% coverage
- All edge cases and failure scenarios covered

### Functional Validation
- Action appears when prerequisites met
- Action blocked when prerequisites not met
- Proper failure messages displayed
- Message generation works correctly
- Turn management functions properly
- Visual styling renders correctly in UI

### Accessibility
- Color contrast meets WCAG 2.1 AA standards
- Action is keyboard accessible
- Screen reader compatible descriptions

## Reference Documentation

### Related Files Analyzed
- `data/mods/seduction/actions/draw_attention_to_breasts.action.json` - Pattern reference
- `data/mods/seduction/rules/draw_attention_to_breasts.rule.json` - Rule structure reference
- `data/mods/anatomy/entities/definitions/human_ass_cheek.entity.json` - Body part validation
- `data/mods/anatomy/libraries/humanoid.slot-library.json` - Clothing slot validation
- `tests/integration/mods/seduction/draw_attention_to_breasts_action.test.js` - Test pattern reference
- `tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js` - Discovery test pattern

### Key Findings
- `ass_cheek` is a valid body part subType (confirmed in anatomy mod)
- `torso_lower` is a valid equipment slot (confirmed in slot library)
- Orange theme colors are consistent across seduction mod
- Test patterns use `ModTestFixture` for action discovery
- Test patterns use validation helpers from `actionPropertyHelpers.js`

## Notes

- **Gender Neutrality**: This action intentionally uses gender-neutral pronouns ("their") instead of gendered pronouns ("her"), deviating from the `draw_attention_to_breasts` pattern. This is because having buttocks is universal to all body types, unlike breasts which are more specifically gendered. This ensures the action is inclusive and appropriate for all characters regardless of gender presentation.
- **Rule Naming Convention**: Following the seduction mod's established pattern, the rule file uses `draw_attention_to_ass.rule.json` (without "handle_" prefix), matching `draw_attention_to_breasts.rule.json`. This differs from other mods (sex, intimacy, positioning) which use the "handle_" prefix.
- **Message Consistency**: Follows pattern of "{actor} {action verb}, {result/focus}"
- **Clothing Requirement**: Ensures modesty/context for the seduction action
- **No Complex Prerequisites**: Intentionally simple to maximize availability
- **Self-Targeting Design**: Allows solo character expression without requiring targets
