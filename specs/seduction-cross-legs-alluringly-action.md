# Specification: "Cross Legs Alluringly" Action for Seduction Mod

**Status**: Draft
**Created**: 2025-11-08
**Mod**: seduction
**Action Type**: Self-targeting seduction gesture

---

## Overview

This specification defines a new action/rule combination for the seduction mod that allows a seated actor to cross their legs in an alluring manner. This is a self-targeting action (no targets) that enhances role-playing opportunities for characters in seated positions.

---

## Action Definition

### File Location
`data/mods/seduction/actions/cross_legs_alluringly.action.json`

### Action Structure

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "seduction:cross_legs_alluringly",
  "name": "Cross Legs Alluringly",
  "description": "Cross your legs in a slow, deliberate motion that draws attention and creates an alluring pose. This gesture emphasizes grace and confidence while seated.",
  "targets": "none",
  "required_components": {
    "actor": ["positioning:sitting_on"]
  },
  "forbidden_components": {
    "actor": [
      "positioning:hugging",
      "positioning:doing_complex_performance"
    ]
  },
  "template": "cross your legs alluringly",
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["actor", "leg"]
      },
      "failure_message": "You need legs to cross them."
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

### Key Design Decisions

1. **Required Components**
   - `positioning:sitting_on`: Ensures actor is seated on furniture
   - This is the primary gating mechanism for action availability

2. **Forbidden Components**
   - `positioning:hugging`: Cannot perform gesture while embracing someone
   - `positioning:doing_complex_performance`: Cannot perform during complex actions
   - These are standard across all seduction mod actions

3. **Prerequisites**
   - Anatomy check: Actor must have legs (using `hasPartOfType` logic)
   - Single prerequisite with clear failure message

4. **Visual Scheme**
   - Uses standard seduction mod orange palette
   - Background: `#f57f17` (amber/orange)
   - Text: `#000000` (black)
   - Hover: `#f9a825` (lighter orange) / `#212121` (dark gray)
   - Consistent with all other seduction actions

5. **Template**
   - Lowercase format: `"cross your legs alluringly"`
   - Follows seduction mod conventions

---

## Rule Definition

### File Location
`data/mods/seduction/rules/cross_legs_alluringly.rule.json`

### Rule Structure

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "cross_legs_alluringly",
  "comment": "Handles the 'seduction:cross_legs_alluringly' action. When a seated actor crosses their legs in an alluring manner, this rule processes the gesture and creates a perceptible event for observers in the same location.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "seduction:event-is-action-cross-legs-alluringly"
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
        "value": "{context.actorName} crosses their legs alluringly."
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set the perception type for this self-targeting action.",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_self_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Set the location where this action is observable.",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "No target for this self-targeting action.",
      "parameters": {
        "variable_name": "targetId",
        "value": null
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn",
      "comment": "Log the success message and end the turn."
    }
  ]
}
```

### Message Formatting

- **Perceptible Event Message**: `"{context.actorName} crosses their legs alluringly."`
- **Successful Action Message**: Same as perceptible event message
- **Style**: Third-person, descriptive, focuses on visible body movement
- **Tone**: Evocative but not explicit, emphasizes intent and grace

### Operation Handler Pattern

The rule uses the standard 7-operation sequence for self-targeting seduction actions:

1. **GET_NAME** - Retrieve actor's name for message interpolation
2. **QUERY_COMPONENT** - Get actor's location for event scoping
3. **SET_VARIABLE** (logMessage) - Construct the perceptible message
4. **SET_VARIABLE** (perceptionType) - Set to `"action_self_general"`
5. **SET_VARIABLE** (locationId) - Set location for event visibility
6. **SET_VARIABLE** (targetId) - Set to `null` for self-targeting
7. **MACRO** (core:logSuccessAndEndTurn) - Finalize action and log success

---

## Condition Definition

### File Location
`data/mods/seduction/conditions/event-is-action-cross-legs-alluringly.condition.json`

### Condition Structure

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "seduction:event-is-action-cross-legs-alluringly",
  "description": "Checks if the event is an attempt to perform the 'seduction:cross_legs_alluringly' action.",
  "logic": {
    "and": [
      {
        "==": [
          { "var": "payload.actionId" },
          "seduction:cross_legs_alluringly"
        ]
      }
    ]
  }
}
```

### Design Notes

- Standard action condition pattern
- Checks if `payload.actionId` matches the action ID
- Uses JSON Logic `and` wrapper for potential future expansion
- Follows seduction mod naming convention: `event-is-action-{action-name}` (note: hyphens in filename!)

---

## Test Requirements

### Test File Locations

1. **Action Discovery Tests**: `tests/integration/mods/seduction/cross_legs_alluringly_action_discovery.test.js`
2. **Rule Execution Tests**: `tests/integration/mods/seduction/cross_legs_alluringly_action.test.js`

### Action Discovery Test Suite

**File**: `cross_legs_alluringly_action_discovery.test.js`

**Test Coverage Requirements**:

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import action from '../../../../data/mods/seduction/actions/cross_legs_alluringly.action.json';

const ACTION_ID = 'seduction:cross_legs_alluringly';

describe('seduction:cross_legs_alluringly - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('seduction', ACTION_ID);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Metadata', () => {
    it('should have correct action ID', () => {
      expect(action.id).toBe(ACTION_ID);
    });

    it('should have correct template', () => {
      expect(action.template).toBe('cross your legs alluringly');
    });

    it('should have targets set to none', () => {
      expect(action.targets).toBe('none');
    });

    it('should have seduction visual styling', () => {
      expect(action.visual.backgroundColor).toBe('#f57f17');
      expect(action.visual.textColor).toBe('#000000');
      expect(action.visual.hoverBackgroundColor).toBe('#f9a825');
      expect(action.visual.hoverTextColor).toBe('#212121');
    });
  });

  describe('Component Requirements', () => {
    it('should require positioning:sitting_on component', () => {
      expect(action.required_components.actor).toContain('positioning:sitting_on');
    });

    it('should forbid positioning:hugging component', () => {
      expect(action.forbidden_components.actor).toContain('positioning:hugging');
    });

    it('should forbid positioning:doing_complex_performance component', () => {
      expect(action.forbidden_components.actor).toContain('positioning:doing_complex_performance');
    });
  });

  describe('Prerequisites', () => {
    it('should have anatomy prerequisite for legs', () => {
      const legPrereq = action.prerequisites.find(
        p => p.logic.hasPartOfType && p.logic.hasPartOfType[1] === 'leg'
      );
      expect(legPrereq).toBeDefined();
      expect(legPrereq.failure_message).toBe('You need legs to cross them.');
    });
  });

  describe('Action Discoverability - Positive Cases', () => {
    it('should be available when actor is sitting', async () => {
      const scenario = testFixture.createStandardActorTarget(['Seated Actor']);
      const actor = scenario.actor;

      // Add sitting_on component
      testFixture.addComponent(actor.id, 'positioning:sitting_on', {
        furniture_id: 'chair_1',
        spot_index: 0
      });

      const actions = await testFixture.discoverActions(actor.id);

      expect(actions).toContainAction(ACTION_ID);
    });

    it('should be available when sitting with legs anatomy', async () => {
      const scenario = testFixture.createStandardActorTarget(['Actor With Legs']);
      const actor = scenario.actor;

      // Add sitting and anatomy
      testFixture.addComponent(actor.id, 'positioning:sitting_on', {
        furniture_id: 'chair_1',
        spot_index: 0
      });
      testFixture.addAnatomyPart(actor.id, 'leg', { count: 2 });

      const actions = await testFixture.discoverActions(actor.id);

      expect(actions).toContainAction(ACTION_ID);
    });
  });

  describe('Action Discoverability - Negative Cases', () => {
    it('should NOT be available when actor is standing', async () => {
      const scenario = testFixture.createStandardActorTarget(['Standing Actor']);
      const actor = scenario.actor;

      // No sitting_on component

      const actions = await testFixture.discoverActions(actor.id);

      expect(actions).not.toContainAction(ACTION_ID);
    });

    it('should NOT be available when actor is hugging', async () => {
      const scenario = testFixture.createStandardActorTarget(['Hugging Actor', 'Partner']);
      const actor = scenario.actor;
      const partner = scenario.target;

      // Add sitting but also hugging
      testFixture.addComponent(actor.id, 'positioning:sitting_on', {
        furniture_id: 'chair_1',
        spot_index: 0
      });
      testFixture.addComponent(actor.id, 'positioning:hugging', {
        embraced_entity_id: partner.id,
        initiated: true
      });

      const actions = await testFixture.discoverActions(actor.id);

      expect(actions).not.toContainAction(ACTION_ID);
    });

    it('should NOT be available when actor is doing complex performance', async () => {
      const scenario = testFixture.createStandardActorTarget(['Performing Actor']);
      const actor = scenario.actor;

      // Add sitting but also complex performance
      testFixture.addComponent(actor.id, 'positioning:sitting_on', {
        furniture_id: 'chair_1',
        spot_index: 0
      });
      testFixture.addComponent(actor.id, 'positioning:doing_complex_performance', {});

      const actions = await testFixture.discoverActions(actor.id);

      expect(actions).not.toContainAction(ACTION_ID);
    });

    it('should NOT be available when actor lacks legs', async () => {
      const scenario = testFixture.createStandardActorTarget(['Legless Actor']);
      const actor = scenario.actor;

      // Add sitting but remove legs
      testFixture.addComponent(actor.id, 'positioning:sitting_on', {
        furniture_id: 'chair_1',
        spot_index: 0
      });
      // Explicitly ensure no leg anatomy
      testFixture.removeAnatomyPart(actor.id, 'leg');

      const actions = await testFixture.discoverActions(actor.id);

      expect(actions).not.toContainAction(ACTION_ID);
    });
  });
});
```

### Rule Execution Test Suite

**File**: `cross_legs_alluringly_action.test.js`

**Test Coverage Requirements**:

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import action from '../../../../data/mods/seduction/actions/cross_legs_alluringly.action.json';
import rule from '../../../../data/mods/seduction/rules/cross_legs_alluringly.rule.json';
import condition from '../../../../data/mods/seduction/conditions/event-is-action-cross-legs-alluringly.condition.json';

const ACTION_ID = 'seduction:cross_legs_alluringly';

describe('seduction:cross_legs_alluringly - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'seduction',
      ACTION_ID,
      rule,
      condition
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Metadata Validation', () => {
    it('should have correct action structure', () => {
      expect(action.id).toBe(ACTION_ID);
      expect(action.name).toBe('Cross Legs Alluringly');
      expect(action.targets).toBe('none');
    });

    it('should have seduction visual styling', () => {
      expect(action.visual).toMatchObject({
        backgroundColor: '#f57f17',
        textColor: '#000000',
        hoverBackgroundColor: '#f9a825',
        hoverTextColor: '#212121'
      });
    });
  });

  describe('Rule Structure Validation', () => {
    it('should have correct rule ID', () => {
      expect(rule.rule_id).toBe('cross_legs_alluringly');
    });

    it('should handle core:attempt_action event', () => {
      expect(rule.event_type).toBe('core:attempt_action');
    });

    it('should reference correct condition', () => {
      expect(rule.condition.condition_ref).toBe('seduction:event-is-action-cross-legs-alluringly');
    });
  });

  describe('Condition Validation', () => {
    it('should check for correct action ID', () => {
      expect(condition.id).toBe('seduction:event-is-action-cross-legs-alluringly');
      expect(condition.logic.and[0]['==']).toEqual([
        { var: 'payload.actionId' },
        ACTION_ID
      ]);
    });
  });

  describe('Successful Action Execution', () => {
    it('should successfully execute when actor is sitting', async () => {
      const scenario = testFixture.createStandardActorTarget(['Seated Actor']);
      const actor = scenario.actor;

      // Setup: Actor is sitting
      testFixture.addComponent(actor.id, 'positioning:sitting_on', {
        furniture_id: 'chair_1',
        spot_index: 0
      });

      // Execute action
      const result = await testFixture.executeAction(actor.id);

      // Verify success
      expect(result).toMatchObject({
        success: true,
        actionId: ACTION_ID
      });
    });

    it('should dispatch perceptible event with correct message', async () => {
      const scenario = testFixture.createStandardActorTarget(['Elena']);
      const actor = scenario.actor;

      testFixture.addComponent(actor.id, 'positioning:sitting_on', {
        furniture_id: 'chair_1',
        spot_index: 0
      });

      await testFixture.executeAction(actor.id);

      const perceptibleEvents = testFixture.getDispatchedEvents('PERCEPTIBLE_EVENT');

      expect(perceptibleEvents).toHaveLength(1);
      expect(perceptibleEvents[0].payload.message).toBe('Elena crosses their legs alluringly.');
    });

    it('should set correct perception type', async () => {
      const scenario = testFixture.createStandardActorTarget(['Actor']);
      const actor = scenario.actor;

      testFixture.addComponent(actor.id, 'positioning:sitting_on', {
        furniture_id: 'chair_1',
        spot_index: 0
      });

      await testFixture.executeAction(actor.id);

      const perceptibleEvents = testFixture.getDispatchedEvents('PERCEPTIBLE_EVENT');

      expect(perceptibleEvents[0].payload.perceptionType).toBe('action_self_general');
    });

    it('should set location ID from actor position', async () => {
      const scenario = testFixture.createStandardActorTarget(['Actor']);
      const actor = scenario.actor;
      const locationId = 'room_123';

      testFixture.addComponent(actor.id, 'positioning:sitting_on', {
        furniture_id: 'chair_1',
        spot_index: 0
      });
      testFixture.addComponent(actor.id, 'core:position', {
        locationId
      });

      await testFixture.executeAction(actor.id);

      const perceptibleEvents = testFixture.getDispatchedEvents('PERCEPTIBLE_EVENT');

      expect(perceptibleEvents[0].payload.locationId).toBe(locationId);
    });

    it('should set targetId to null for self-targeting action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Actor']);
      const actor = scenario.actor;

      testFixture.addComponent(actor.id, 'positioning:sitting_on', {
        furniture_id: 'chair_1',
        spot_index: 0
      });

      await testFixture.executeAction(actor.id);

      const perceptibleEvents = testFixture.getDispatchedEvents('PERCEPTIBLE_EVENT');

      expect(perceptibleEvents[0].payload.targetId).toBeNull();
    });
  });

  describe('Turn Management', () => {
    it('should end turn after successful execution', async () => {
      const scenario = testFixture.createStandardActorTarget(['Actor']);
      const actor = scenario.actor;

      testFixture.addComponent(actor.id, 'positioning:sitting_on', {
        furniture_id: 'chair_1',
        spot_index: 0
      });

      await testFixture.executeAction(actor.id);

      const turnEvents = testFixture.getDispatchedEvents('TURN_ENDED');

      expect(turnEvents).toHaveLength(1);
    });
  });
});
```

### Test Execution Commands

```bash
# Run action discovery tests
NODE_ENV=test npx jest tests/integration/mods/seduction/cross_legs_alluringly_action_discovery.test.js --no-coverage --verbose

# Run rule execution tests
NODE_ENV=test npx jest tests/integration/mods/seduction/cross_legs_alluringly_action.test.js --no-coverage --verbose

# Run both test suites
NODE_ENV=test npx jest tests/integration/mods/seduction/cross_legs_alluringly*.test.js --no-coverage --silent

# Run all seduction mod tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/seduction/ --silent
```

### Test Utilities Reference

**From `docs/testing/mod-testing-guide.md`:**

- Use `ModTestFixture.forAction()` for action tests
- Import domain matchers: `import '../../../common/mods/domainMatchers.js'`
- Use `createStandardActorTarget()` for entity setup
- Use `addComponent()`, `removeComponent()` for component management
- Use `addAnatomyPart()`, `removeAnatomyPart()` for anatomy setup
- Use `executeAction()` for rule execution
- Use `discoverActions()` for action discovery validation
- Use `getDispatchedEvents()` to verify event dispatching
- Always call `testFixture.cleanup()` in `afterEach` blocks

---

## Implementation Checklist

### Phase 1: Create Action Definition

- [ ] Create file: `data/mods/seduction/actions/cross_legs_alluringly.action.json`
- [ ] Add action ID: `seduction:cross_legs_alluringly`
- [ ] Set targets to `"none"`
- [ ] Add required component: `positioning:sitting_on`
- [ ] Add forbidden components: `positioning:hugging`, `positioning:doing_complex_performance`
- [ ] Add leg anatomy prerequisite
- [ ] Set template: `"cross your legs alluringly"`
- [ ] Apply seduction visual scheme
- [ ] Validate JSON structure: `npm run validate`

### Phase 2: Create Condition Definition

- [ ] Create file: `data/mods/seduction/conditions/event-is-action-cross-legs-alluringly.condition.json`
- [ ] Add condition ID: `seduction:event-is-action-cross-legs-alluringly`
- [ ] Add action ID check logic
- [ ] Validate JSON structure: `npm run validate`

### Phase 3: Create Rule Definition

- [ ] Create file: `data/mods/seduction/rules/cross_legs_alluringly.rule.json`
- [ ] Set rule_id: `"cross_legs_alluringly"`
- [ ] Set event_type: `"core:attempt_action"`
- [ ] Reference condition: `seduction:event-is-action-cross-legs-alluringly`
- [ ] Implement 7-operation sequence:
  - [ ] GET_NAME operation
  - [ ] QUERY_COMPONENT operation
  - [ ] SET_VARIABLE (logMessage) with message: `"{context.actorName} crosses their legs alluringly."`
  - [ ] SET_VARIABLE (perceptionType): `"action_self_general"`
  - [ ] SET_VARIABLE (locationId)
  - [ ] SET_VARIABLE (targetId): `null`
  - [ ] MACRO: `core:logSuccessAndEndTurn`
- [ ] Validate JSON structure: `npm run validate`

### Phase 4: Create Action Discovery Tests

- [ ] Create file: `tests/integration/mods/seduction/cross_legs_alluringly_action_discovery.test.js`
- [ ] Import ModTestFixture and domain matchers
- [ ] Implement metadata validation tests
- [ ] Implement component requirement tests
- [ ] Implement prerequisite tests
- [ ] Implement positive discoverability tests (sitting scenarios)
- [ ] Implement negative discoverability tests (standing, hugging, performing, no legs)
- [ ] Run tests: `NODE_ENV=test npx jest tests/integration/mods/seduction/cross_legs_alluringly_action_discovery.test.js --no-coverage`
- [ ] Verify all tests pass

### Phase 5: Create Rule Execution Tests

- [ ] Create file: `tests/integration/mods/seduction/cross_legs_alluringly_action.test.js`
- [ ] Import action, rule, condition JSON files
- [ ] Implement metadata validation tests
- [ ] Implement rule structure validation tests
- [ ] Implement condition validation tests
- [ ] Implement successful execution tests
- [ ] Implement perceptible event validation tests
- [ ] Implement turn management tests
- [ ] Run tests: `NODE_ENV=test npx jest tests/integration/mods/seduction/cross_legs_alluringly_action.test.js --no-coverage`
- [ ] Verify all tests pass

### Phase 6: Final Validation

- [ ] Run full seduction mod test suite: `NODE_ENV=test npm run test:integration -- tests/integration/mods/seduction/ --silent`
- [ ] Run schema validation: `npm run validate:strict`
- [ ] Run type checking: `npm run typecheck`
- [ ] Run ESLint on test files: `npx eslint tests/integration/mods/seduction/cross_legs_alluringly*.test.js`
- [ ] Verify no console errors in test output
- [ ] Manual verification: Load game and test action in-game

### Phase 7: Documentation

- [ ] Update seduction mod documentation (if applicable)
- [ ] Add entry to changelog (if applicable)
- [ ] Mark specification as "Implemented"

---

## Design Rationale

### Why This Design?

1. **Consistency**: Follows exact patterns from existing seduction actions (brush_hair_back_coyly, stretch_sexily, draw_attention_to_ass)
2. **Simplicity**: Single required component (sitting_on) makes action easy to discover and use
3. **Realism**: Requires legs anatomy, preventing impossible actions
4. **Safety**: Forbidden components prevent conflicting states (hugging, performing)
5. **Self-Targeting**: No targets needed, focuses on actor's own gesture
6. **Clear Feedback**: Simple, evocative message that describes the action clearly

### Alternative Designs Considered

1. **Require specific clothing**: Considered requiring lower body clothing for visibility
   - **Rejected**: Would limit action availability unnecessarily; crossing legs is noticeable regardless of clothing

2. **Different message styles**: Considered more elaborate descriptions
   - **Rejected**: Kept message concise and consistent with seduction mod style

3. **Add duration or cooldown**: Considered making this a temporary state
   - **Rejected**: Keeps action simple; player can "uncross" by standing or performing other actions

### Known Limitations

1. **No visual state change**: Action creates perceptible event but doesn't modify actor's visual representation
2. **No mechanical effects**: Action is purely narrative; doesn't affect stats or relationships
3. **No clothing interaction**: Doesn't check or interact with clothing system
4. **Single-use gesture**: Cannot maintain "crossed legs" state across multiple turns

These limitations are consistent with other seduction mod actions and maintain simplicity.

---

## References

### Analyzed Files

**Seduction Mod Actions:**
- `data/mods/seduction/actions/brush_hair_back_coyly.action.json`
- `data/mods/seduction/actions/stretch_sexily.action.json`
- `data/mods/seduction/actions/draw_attention_to_ass.action.json`

**Seduction Mod Rules:**
- `data/mods/seduction/rules/brush_hair_back_coyly.rule.json`
- `data/mods/seduction/rules/stretch_sexily.rule.json`
- `data/mods/seduction/rules/draw_attention_to_ass.rule.json`

**Component Definitions:**
- `data/mods/positioning/components/sitting_on.component.json`
- `data/mods/positioning/components/hugging.component.json`
- `data/mods/positioning/components/doing_complex_performance.component.json`

**Testing Documentation:**
- `docs/testing/mod-testing-guide.md`

**Existing Test Patterns:**
- `tests/integration/mods/seduction/brush_hair_back_coyly_action_discovery.test.js`
- `tests/integration/mods/seduction/brush_hair_back_coyly_action.test.js`

---

## Appendix: JSON Schemas

### Action Schema Reference
- Location: `data/schemas/action.schema.json`
- Required fields: `id`, `name`, `description`, `targets`, `template`, `visual`
- Optional fields: `required_components`, `forbidden_components`, `prerequisites`

### Rule Schema Reference
- Location: `data/schemas/rule.schema.json`
- Required fields: `rule_id`, `event_type`, `condition`, `actions`
- Operation types: `GET_NAME`, `QUERY_COMPONENT`, `SET_VARIABLE`, macros

### Condition Schema Reference
- Location: `data/schemas/condition.schema.json`
- Required fields: `id`, `description`, `logic`
- Uses JSON Logic format

---

**End of Specification**
