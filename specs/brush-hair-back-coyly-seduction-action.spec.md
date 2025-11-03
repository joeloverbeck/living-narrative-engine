# Specification: "Brush Hair Back Coyly" Seduction Action

**Mod**: `seduction`
**Action ID**: `seduction:brush_hair_back_coyly`
**Status**: Ready for Implementation
**Created**: 2025-11-02

---

## Overview

This specification defines a new self-targeting seduction action where the acting actor brushes their hair back in a coy, flirtatious gesture. The action follows established seduction mod patterns and visual design standards.

---

## Design Requirements

### Action Characteristics

- **Type**: Self-targeting (no target entity required)
- **Category**: Seduction / Flirtation
- **Visual Theme**: Seduction mod orange palette
- **Forbidden During**: Hugging
- **Body Part Requirement**: Hair

### User Experience

**Template**: `"brush your hair back coyly"`

**Description**: "Run your fingers through your hair and tuck it behind your ear in a coy, flirtatious gesture."

**Perceptible Event**: `"{actor} brushes their hair back coyly."`

**Success Message**: `"{actor} brushes their hair back coyly."`

---

## File Structure

### Critical Naming Conventions

⚠️ **IMPORTANT**: Condition files ALWAYS use hyphens, even when action names use underscores!

| File Type | Naming Pattern | File Path |
|-----------|----------------|-----------|
| **Action** | Underscores | `data/mods/seduction/actions/brush_hair_back_coyly.action.json` |
| **Rule** | Underscores | `data/mods/seduction/rules/brush_hair_back_coyly.rule.json` |
| **Condition** | **HYPHENS** | `data/mods/seduction/conditions/event-is-action-brush-hair-back-coyly.condition.json` |

### Files to Create

1. ✅ `brush_hair_back_coyly.action.json` (underscores)
2. ✅ `brush_hair_back_coyly.rule.json` (underscores)
3. ✅ `event-is-action-brush-hair-back-coyly.condition.json` (hyphens)
4. ✅ Update `mod-manifest.json`
5. ✅ `brush_hair_back_coyly_action_discovery.test.js`
6. ✅ `brush_hair_back_coyly_action.test.js`

---

## Implementation Details

### 1. Action File (`brush_hair_back_coyly.action.json`)

**Path**: `data/mods/seduction/actions/brush_hair_back_coyly.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "seduction:brush_hair_back_coyly",
  "name": "Brush Hair Back Coyly",
  "description": "Run your fingers through your hair and tuck it behind your ear in a coy, flirtatious gesture.",
  "targets": "none",
  "required_components": {},
  "forbidden_components": {
    "actor": ["positioning:hugging"]
  },
  "template": "brush your hair back coyly",
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["actor", "hair"]
      },
      "failure_message": "You need hair to perform this action."
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

**Key Elements**:
- `targets: "none"` - Self-targeting action
- `forbidden_components.actor`: `["positioning:hugging"]` - Cannot brush hair while hugging
- `prerequisites`: Hair body part required via `hasPartOfType` logic
- `visual`: Standard seduction mod orange theme (#f57f17 / #f9a825)

---

### 2. Rule File (`brush_hair_back_coyly.rule.json`)

**Path**: `data/mods/seduction/rules/brush_hair_back_coyly.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "brush_hair_back_coyly",
  "comment": "Handles the 'seduction:brush_hair_back_coyly' action. Generates descriptive text about the actor brushing their hair back coyly.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "seduction:event-is-action-brush-hair-back-coyly"
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
        "value": "{context.actorName} brushes their hair back coyly."
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

**Key Elements**:
- Standard seduction mod rule pattern: `GET_NAME` → `QUERY_COMPONENT` → `SET_VARIABLE` sequence
- `perceptionType: "action_self_general"` - Self-targeting action perception
- `targetId: null` - No target entity
- Uses `core:logSuccessAndEndTurn` macro for completion

---

### 3. Condition File (`event-is-action-brush-hair-back-coyly.condition.json`)

**Path**: `data/mods/seduction/conditions/event-is-action-brush-hair-back-coyly.condition.json`

⚠️ **Critical**: File name uses HYPHENS, not underscores!

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "seduction:event-is-action-brush-hair-back-coyly",
  "description": "Checks if the triggering event is for the 'seduction:brush_hair_back_coyly' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "seduction:brush_hair_back_coyly"
    ]
  }
}
```

**Key Elements**:
- Simple equality check: `event.payload.actionId == "seduction:brush_hair_back_coyly"`
- Must match fully-qualified action ID

---

### 4. Mod Manifest Update

**File**: `data/mods/seduction/mod-manifest.json`

Add the following entries to the `content` object:

```json
{
  "content": {
    "actions": [
      "actions/brush_hair_back_coyly.action.json"
    ],
    "rules": [
      "rules/brush_hair_back_coyly.rule.json"
    ],
    "conditions": [
      "conditions/event-is-action-brush-hair-back-coyly.condition.json"
    ]
  }
}
```

---

## Testing Requirements

### Test Suite 1: Action Discovery Test

**File**: `tests/integration/mods/seduction/brush_hair_back_coyly_action_discovery.test.js`

**Purpose**: Validate action metadata, visual styling, prerequisites, and execution scenarios.

**Test Coverage**:

1. **Action Metadata Validation**
   - Verify action ID: `seduction:brush_hair_back_coyly`
   - Verify action name: `"Brush Hair Back Coyly"`
   - Verify description matches specification
   - Verify template: `"brush your hair back coyly"`

2. **Self-Targeting Configuration**
   - Verify `targets: "none"`
   - Verify `required_components: {}`
   - Verify `forbidden_components.actor: ["positioning:hugging"]`

3. **Visual Styling Validation**
   - Verify `backgroundColor: "#f57f17"` (seduction orange)
   - Verify `textColor: "#000000"` (black)
   - Verify `hoverBackgroundColor: "#f9a825"` (hover orange)
   - Verify `hoverTextColor: "#212121"` (dark gray)

4. **Prerequisite Handling**
   - Verify prerequisites array has length 1
   - Verify hair prerequisite uses `hasPartOfType` logic
   - Verify logic parameters: `["actor", "hair"]`
   - Verify failure message: `"You need hair to perform this action."`

5. **Action Discoverability Scenarios**
   - **Success Case**: Actor with hair can execute action
   - **Forbidden Case**: Actor hugging someone cannot execute action
   - Verify perceptible event message format

**Reference Implementation**:

```javascript
/**
 * @file Integration tests for seduction:brush_hair_back_coyly action discovery.
 * @description Ensures the brush hair back coyly action is available when actor has hair
 * and advertises expected styling.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import brushHairBackCoylyAction from '../../../../data/mods/seduction/actions/brush_hair_back_coyly.action.json';
import brushHairBackCoylyRule from '../../../../data/mods/seduction/rules/brush_hair_back_coyly.rule.json';
import eventIsActionBrushHairBackCoyly from '../../../../data/mods/seduction/conditions/event-is-action-brush-hair-back-coyly.condition.json';

const ACTION_ID = 'seduction:brush_hair_back_coyly';

describe('seduction:brush_hair_back_coyly action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'seduction',
      ACTION_ID,
      brushHairBackCoylyRule,
      eventIsActionBrushHairBackCoyly
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action metadata validation', () => {
    it('should define the correct core metadata', () => {
      expect(brushHairBackCoylyAction).toBeDefined();
      expect(brushHairBackCoylyAction.id).toBe(ACTION_ID);
      expect(brushHairBackCoylyAction.name).toBe('Brush Hair Back Coyly');
      expect(brushHairBackCoylyAction.description).toBe(
        'Run your fingers through your hair and tuck it behind your ear in a coy, flirtatious gesture.'
      );
      expect(brushHairBackCoylyAction.template).toBe('brush your hair back coyly');
    });

    it('should be a self-targeting action', () => {
      expect(brushHairBackCoylyAction.targets).toBe('none');
      expect(brushHairBackCoylyAction.required_components).toEqual({});
      expect(brushHairBackCoylyAction.forbidden_components).toEqual({
        actor: ['positioning:hugging'],
      });
    });
  });

  describe('Visual styling validation', () => {
    it('should reuse the seduction orange palette', () => {
      expect(brushHairBackCoylyAction.visual).toBeDefined();
      expect(brushHairBackCoylyAction.visual.backgroundColor).toBe('#f57f17');
      expect(brushHairBackCoylyAction.visual.textColor).toBe('#000000');
      expect(brushHairBackCoylyAction.visual.hoverBackgroundColor).toBe('#f9a825');
      expect(brushHairBackCoylyAction.visual.hoverTextColor).toBe('#212121');
    });
  });

  describe('Prerequisite handling', () => {
    it('should require hair body part', () => {
      expect(brushHairBackCoylyAction.prerequisites).toBeDefined();
      expect(Array.isArray(brushHairBackCoylyAction.prerequisites)).toBe(true);
      expect(brushHairBackCoylyAction.prerequisites).toHaveLength(1);

      const hairPrerequisite = brushHairBackCoylyAction.prerequisites[0];
      expect(hairPrerequisite.logic.hasPartOfType).toEqual(['actor', 'hair']);
      expect(hairPrerequisite.failure_message).toBe(
        'You need hair to perform this action.'
      );
    });
  });

  describe('Action discoverability scenarios', () => {
    it('should be executable when actor has hair', async () => {
      const scenario = testFixture.createStandardActorTarget(['Ava', 'Marcus']);

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertActionSuccess('Ava brushes their hair back coyly.');
    });

    it('rejects execution when the actor is currently hugging someone', async () => {
      const scenario = testFixture.createStandardActorTarget(['Dana', 'Elliot'], {
        includeRoom: false,
      });

      scenario.actor.components['positioning:hugging'] = {
        embraced_entity_id: scenario.target.id,
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await expect(
        testFixture.executeAction(scenario.actor.id, null)
      ).rejects.toThrow(/forbidden component/i);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actorInstance.components['positioning:hugging']).toEqual({
        embraced_entity_id: scenario.target.id,
        initiated: true,
      });
    });
  });
});
```

---

### Test Suite 2: Action Execution Test

**File**: `tests/integration/mods/seduction/brush_hair_back_coyly_action.test.js`

**Purpose**: Validate action properties, schema compliance, accessibility, and forbidden component restrictions.

**Test Coverage**:

1. **Action Properties Validation**
   - Validate using `validateActionProperties()` helper
   - Verify all required fields present
   - Verify correct values for id, name, targets, template

2. **Visual Design Validation**
   - Validate using `validateVisualStyling()` helper
   - Verify orange theme colors
   - Validate accessibility compliance (WCAG contrast ratios)

3. **Schema Compliance**
   - Validate using `validateRequiredActionProperties()` helper
   - Verify all required action properties present
   - Verify proper description formatting
   - Verify self-targeting configuration
   - Verify template format (lowercase start)

4. **Prerequisites Logic Validation**
   - Verify hair prerequisite uses `hasPartOfType` logic
   - Verify logic parameters correct
   - Verify meaningful failure message

5. **Forbidden Component Restrictions**
   - Validate using `validateComponentRequirements()` helper
   - Test hugging restriction scenario
   - Verify rejection when actor is hugging

**Reference Implementation**:

```javascript
/**
 * @file Integration tests for the seduction:brush_hair_back_coyly action.
 * @description Tests basic action properties and structure validation using the action
 * property helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import brushHairBackCoylyAction from '../../../../data/mods/seduction/actions/brush_hair_back_coyly.action.json';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import brushHairBackCoylyRule from '../../../../data/mods/seduction/rules/brush_hair_back_coyly.rule.json';
import eventIsActionBrushHairBackCoyly from '../../../../data/mods/seduction/conditions/event-is-action-brush-hair-back-coyly.condition.json';
import {
  validateActionProperties,
  validateVisualStyling,
  validatePrerequisites,
  validateComponentRequirements,
  validateRequiredActionProperties,
  validateAccessibilityCompliance,
} from '../../../common/mods/actionPropertyHelpers.js';

describe('Seduction Mod: Brush Hair Back Coyly Action', () => {
  describe('Action Properties', () => {
    it('should have correct action properties', () => {
      validateActionProperties(brushHairBackCoylyAction, {
        id: 'seduction:brush_hair_back_coyly',
        name: 'Brush Hair Back Coyly',
        targets: 'none',
        template: 'brush your hair back coyly',
        $schema: 'schema://living-narrative-engine/action.schema.json',
      });
    });

    it('should use correct orange visual styling', () => {
      validateVisualStyling(brushHairBackCoylyAction.visual, 'Orange Theme', {
        backgroundColor: '#f57f17',
        textColor: '#000000',
        hoverBackgroundColor: '#f9a825',
        hoverTextColor: '#212121',
      });
    });

    it('should require actor to not be hugging anyone', () => {
      validateComponentRequirements(brushHairBackCoylyAction, {
        required: {},
        forbidden: { actor: ['positioning:hugging'] },
      });
    });

    it('should have prerequisite for hair', () => {
      validatePrerequisites(brushHairBackCoylyAction.prerequisites, {
        count: 1,
      });
    });
  });

  describe('Visual Design and Accessibility', () => {
    it('should meet accessibility contrast requirements', () => {
      validateAccessibilityCompliance(
        brushHairBackCoylyAction.visual,
        'Orange color scheme'
      );
    });
  });

  describe('Schema Compliance', () => {
    it('should have all required action properties', () => {
      validateRequiredActionProperties(brushHairBackCoylyAction);
    });

    it('should have properly formatted description', () => {
      expect(brushHairBackCoylyAction.description).toBe(
        'Run your fingers through your hair and tuck it behind your ear in a coy, flirtatious gesture.'
      );
      expect(brushHairBackCoylyAction.description.length).toBeGreaterThan(0);
    });

    it('should be self-targeting action', () => {
      expect(brushHairBackCoylyAction.targets).toBe('none');
    });

    it('should have appropriate action template', () => {
      expect(brushHairBackCoylyAction.template).toBe('brush your hair back coyly');
      expect(brushHairBackCoylyAction.template).toMatch(/^[a-z]/); // starts with lowercase
    });
  });

  describe('Prerequisites Logic Validation', () => {
    it('should require hair body part', () => {
      const hairPrerequisite = brushHairBackCoylyAction.prerequisites[0];
      expect(hairPrerequisite.logic.hasPartOfType).toBeDefined();
      expect(hairPrerequisite.logic.hasPartOfType).toEqual(['actor', 'hair']);
    });

    it('should have meaningful failure message', () => {
      const hairFailure = brushHairBackCoylyAction.prerequisites[0].failure_message;
      expect(hairFailure).toContain('hair');
      expect(hairFailure.length).toBeGreaterThan(20);
    });
  });
});

describe('Seduction Mod: Brush Hair Back Coyly hugging restrictions', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'seduction',
      'seduction:brush_hair_back_coyly',
      brushHairBackCoylyRule,
      eventIsActionBrushHairBackCoyly
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('rejects the action when the actor is currently hugging someone', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alex', 'Jordan'], {
      includeRoom: false,
    });

    scenario.actor.components['positioning:hugging'] = {
      embraced_entity_id: scenario.target.id,
      initiated: true,
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await expect(
      testFixture.executeAction(scenario.actor.id, null)
    ).rejects.toThrow(/forbidden component/i);

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    expect(actorInstance.components['positioning:hugging']).toEqual({
      embraced_entity_id: scenario.target.id,
      initiated: true,
    });
  });
});
```

---

## Testing Helpers & Utilities

### ModTestFixture Usage

```javascript
// Create test fixture for action
const testFixture = await ModTestFixture.forAction(
  'seduction',                        // mod ID
  'seduction:brush_hair_back_coyly', // action ID
  brushHairBackCoylyRule,            // rule object
  eventIsActionBrushHairBackCoyly    // condition object
);

// Create standard actor/target scenario
const scenario = testFixture.createStandardActorTarget(['Ava', 'Marcus']);

// Execute action
await testFixture.executeAction(scenario.actor.id, null);

// Assert success
testFixture.assertActionSuccess('Ava brushes their hair back coyly.');

// Cleanup
testFixture.cleanup();
```

### Action Property Validation Helpers

```javascript
import {
  validateActionProperties,
  validateVisualStyling,
  validatePrerequisites,
  validateComponentRequirements,
  validateRequiredActionProperties,
  validateAccessibilityCompliance,
} from '../../../common/mods/actionPropertyHelpers.js';

// Validate action properties
validateActionProperties(actionObject, {
  id: 'seduction:brush_hair_back_coyly',
  name: 'Brush Hair Back Coyly',
  targets: 'none',
  template: 'brush your hair back coyly',
});

// Validate visual styling
validateVisualStyling(actionObject.visual, 'Orange Theme', {
  backgroundColor: '#f57f17',
  textColor: '#000000',
  hoverBackgroundColor: '#f9a825',
  hoverTextColor: '#212121',
});

// Validate component requirements
validateComponentRequirements(actionObject, {
  required: {},
  forbidden: { actor: ['positioning:hugging'] },
});

// Validate prerequisites
validatePrerequisites(actionObject.prerequisites, { count: 1 });

// Validate accessibility
validateAccessibilityCompliance(actionObject.visual, 'Orange color scheme');

// Validate required properties
validateRequiredActionProperties(actionObject);
```

### Scenario Builders

```javascript
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';

// Create standard actor/target
const scenario = testFixture.createStandardActorTarget(['Actor', 'Target']);

// Create room
const room = ModEntityScenarios.createRoom('room1', 'Test Room');

// Reset test with entities
testFixture.reset([room, scenario.actor, scenario.target]);
```

---

## Implementation Checklist

### File Creation

- [ ] Create `data/mods/seduction/actions/brush_hair_back_coyly.action.json` (underscores)
- [ ] Create `data/mods/seduction/rules/brush_hair_back_coyly.rule.json` (underscores)
- [ ] Create `data/mods/seduction/conditions/event-is-action-brush-hair-back-coyly.condition.json` (HYPHENS)
- [ ] Update `data/mods/seduction/mod-manifest.json` with all three files

### Test Creation

- [ ] Create `tests/integration/mods/seduction/brush_hair_back_coyly_action_discovery.test.js`
- [ ] Create `tests/integration/mods/seduction/brush_hair_back_coyly_action.test.js`

### Validation

- [ ] Verify action file uses underscores in filename
- [ ] Verify rule file uses underscores in filename
- [ ] Verify condition file uses HYPHENS in filename (critical!)
- [ ] Verify orange theme colors match seduction mod standard
- [ ] Verify hugging forbidden component is included
- [ ] Verify hair prerequisite uses `hasPartOfType` logic
- [ ] Verify template is lowercase
- [ ] Verify perceptible event message format

### Testing

- [ ] Run `npm run test:integration -- tests/integration/mods/seduction/brush_hair_back_coyly_action_discovery.test.js`
- [ ] Run `npm run test:integration -- tests/integration/mods/seduction/brush_hair_back_coyly_action.test.js`
- [ ] Verify all tests pass
- [ ] Run `npx eslint` on test files
- [ ] Verify 80%+ test coverage

### Code Quality

- [ ] Run `npx eslint tests/integration/mods/seduction/brush_hair_back_coyly_action_discovery.test.js`
- [ ] Run `npx eslint tests/integration/mods/seduction/brush_hair_back_coyly_action.test.js`
- [ ] Fix any ESLint issues
- [ ] Verify JSON files are valid
- [ ] Run `npm run validate:mod:seduction` if available

---

## Reference Files

### Seduction Mod Examples

- `data/mods/seduction/actions/draw_attention_to_ass.action.json`
- `data/mods/seduction/actions/stretch_sexily.action.json`
- `data/mods/seduction/rules/draw_attention_to_ass.rule.json`
- `data/mods/seduction/rules/stretch_sexily.rule.json`
- `data/mods/seduction/conditions/event-is-action-draw-attention-to-ass.condition.json`
- `data/mods/seduction/conditions/event-is-action-stretch-sexily.condition.json`

### Test Examples

- `tests/integration/mods/seduction/draw_attention_to_ass_action_discovery.test.js`
- `tests/integration/mods/seduction/draw_attention_to_ass_action.test.js`
- `tests/integration/mods/seduction/stretch_sexily_action_discovery.test.js`

### Documentation

- `docs/testing/mod-testing-guide.md` - Comprehensive mod testing guide
- `docs/testing/scope-resolver-registry.md` - Scope resolver reference
- `tests/common/mods/domainMatchers.js` - Domain-specific matchers
- `tests/common/actionMatchers.js` - Action validation matchers

---

## Design Rationale

### Why This Design?

1. **Consistency**: Follows established seduction mod patterns (orange theme, self-targeting, hugging restriction)
2. **Realism**: Hair prerequisite ensures only characters with hair can perform this action
3. **Simplicity**: Self-targeting action with no complex component interactions
4. **Visual Cohesion**: Uses standard seduction mod color palette for UI consistency
5. **Testability**: Clear success/failure scenarios with comprehensive test coverage

### Color Palette Justification

The seduction mod uses a consistent orange palette:
- **Primary**: `#f57f17` (Orange 800) - Warm, inviting, seductive
- **Hover**: `#f9a825` (Orange 700) - Slightly lighter for interaction feedback
- **Text**: `#000000` / `#212121` - High contrast for accessibility (WCAG AA compliant)

This palette visually distinguishes seduction actions from other action categories while maintaining accessibility standards.

### Prerequisites Logic

The `hasPartOfType` prerequisite ensures:
- Only characters with hair can perform the action
- Failure message provides clear feedback
- Consistent with other anatomy-based prerequisites in the engine

---

## Notes for Implementers

### Critical Naming Convention

⚠️ **DO NOT FORGET**: Condition files use HYPHENS, not underscores!

```bash
# ✅ CORRECT
event-is-action-brush-hair-back-coyly.condition.json

# ❌ WRONG
event-is-action-brush_hair_back_coyly.condition.json
```

This is the most common mistake when creating new actions. Always verify file naming before testing.

### Testing Best Practices

1. **Use ModTestFixture**: Always use `ModTestFixture.forAction()` for action tests
2. **Import JSON Files**: Import action, rule, and condition JSON files directly
3. **Use Helpers**: Leverage validation helpers from `actionPropertyHelpers.js`
4. **Test Forbidden Components**: Always test forbidden component restrictions
5. **Clean Up**: Always call `testFixture.cleanup()` in `afterEach()`

### Common Issues

**Issue**: Tests fail with "Cannot find module" error
**Solution**: Verify JSON file paths are correct and files exist

**Issue**: Tests fail with "forbidden component" error when they shouldn't
**Solution**: Verify test scenario doesn't add hugging component unintentionally

**Issue**: Visual styling tests fail
**Solution**: Verify exact color hex values match seduction mod standard

**Issue**: Condition file not loading
**Solution**: Verify condition filename uses HYPHENS, not underscores

---

## Completion Criteria

The implementation is complete when:

1. ✅ All three JSON files created with correct naming conventions
2. ✅ Mod manifest updated with new content entries
3. ✅ Both test suites created with comprehensive coverage
4. ✅ All tests pass successfully
5. ✅ ESLint passes on all test files
6. ✅ Action appears in game UI with correct orange styling
7. ✅ Action executes successfully for characters with hair
8. ✅ Action is correctly rejected when actor is hugging
9. ✅ Perceptible event displays correct message

---

**End of Specification**
