# Cup Chin Action/Rule Combo Specification

**Status**: Design Specification
**Target Mod**: `caressing`
**Created**: 2025-01-17
**Version**: 1.0.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Mod Placement Analysis](#mod-placement-analysis)
3. [Action Specification](#action-specification)
4. [Rule Specification](#rule-specification)
5. [Condition Specification](#condition-specification)
6. [Test Suite Requirements](#test-suite-requirements)
7. [Implementation Checklist](#implementation-checklist)
8. [References](#references)

---

## Executive Summary

This specification defines a new action/rule combo for cupping an actor's chin in a tender gesture. After analyzing both the `affection` and `caressing` mods, **the action will be placed in the `caressing` mod** due to its intimate, face-to-face nature that aligns with the sensual touch theme of that mod.

### Key Identifiers

- **Action ID**: `caressing:cup_chin`
- **Rule ID**: `handle_cup_chin`
- **Condition ID**: `caressing:event-is-action-cup-chin`
- **Scope**: `caressing:close_actors_facing_each_other` (existing)

### Core Behavior

The action allows an actor to cup a target's chin in a tender, romantic gesture, requiring close proximity with actors facing each other and prohibiting simultaneous kissing.

---

## Mod Placement Analysis

### Comparison Matrix

| Aspect | Affection Mod | Caressing Mod | Decision |
|--------|---------------|---------------|----------|
| **Theme** | Caring, supportive touch (platonic/romantic) | Flirtatious, sensual touch (romantic tension) | ✅ Caressing |
| **Intimacy Level** | General caring gestures | Facial/intimate touches | ✅ Caressing |
| **Visual Palette** | Purple (#6a1b9a) | Deep Indigo (#311b92) | ✅ Caressing |
| **Similar Actions** | Hand holding, shoulder touching | Thumb across lips, wipe cheek | ✅ Caressing |
| **Forbidden Components** | Varies | `kissing:kissing` (standard) | ✅ Caressing |

### Rationale

**Why Caressing Mod:**

1. **Facial Intimacy**: Cupping someone's chin is an intimate facial gesture similar to existing caressing actions:
   - `thumb_wipe_cheek` - gentle facial touch
   - `run_thumb_across_lips` - tender lip contact

2. **Romantic Context**: The gesture commonly appears in romantic contexts (pre-kiss moments, tender conversations)

3. **Scope Alignment**: The required scope `caressing:close_actors_facing_each_other` already exists in the caressing mod

4. **Forbidden Components**: Matches caressing pattern of prohibiting `kissing:kissing` to prevent action spam during kissing

5. **Visual Consistency**: The deep indigo palette (#311b92) is used for all caressing facial touches

**Why Not Affection Mod:**

- Affection mod focuses on broader caring gestures (hugs, hand holding, shoulder touches)
- The purple palette (#6a1b9a) is used for less intimate contact
- No existing facial touch actions in affection mod

---

## Action Specification

### File Location
`data/mods/caressing/actions/cup_chin.action.json`

### Complete JSON Definition

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "caressing:cup_chin",
  "name": "Cup Chin",
  "description": "Cup the target's chin in a tender gesture.",
  "targets": "caressing:close_actors_facing_each_other",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["kissing:kissing"]
  },
  "template": "cup {target}'s chin",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#311b92",
    "textColor": "#d1c4e9",
    "hoverBackgroundColor": "#4527a0",
    "hoverTextColor": "#ede7f6"
  }
}
```

### Field Breakdown

| Field | Value | Justification |
|-------|-------|---------------|
| **id** | `caressing:cup_chin` | Follows mod namespace pattern |
| **name** | `Cup Chin` | Clear, concise action name |
| **description** | `Cup the target's chin in a tender gesture.` | Matches caressing description style |
| **targets** | `caressing:close_actors_facing_each_other` | Existing scope, requires face-to-face |
| **required_components.actor** | `["positioning:closeness"]` | Standard proximity requirement |
| **forbidden_components.actor** | `["kissing:kissing"]` | Prevent during kissing (standard pattern) |
| **template** | `cup {target}'s chin` | Per user specification |
| **visual.backgroundColor** | `#311b92` | Caressing mod deep indigo |
| **visual.textColor** | `#d1c4e9` | Caressing mod light purple text |
| **visual.hoverBackgroundColor** | `#4527a0` | Caressing mod hover indigo |
| **visual.hoverTextColor** | `#ede7f6` | Caressing mod hover light purple |

---

## Rule Specification

### File Location
`data/mods/caressing/rules/cup_chin.rule.json`

### Complete JSON Definition

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_cup_chin",
  "comment": "Handles the 'caressing:cup_chin' action. This rule generates descriptive text for the event, dispatches it for others to see and for the actor's UI, and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "caressing:event-is-action-cup-chin"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "comment": "Get the actor's name for the observer message.",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get the target's name for all messages.",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "targetName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get the actor's position component data.",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Extract locationId to a simple context variable for robustness.",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Construct the descriptive message before dispatching.",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} cups {context.targetName}'s chin in a tender gesture."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

### Rule Logic Breakdown

1. **Event Trigger**: `core:attempt_action` with condition checking for `caressing:cup_chin`
2. **Name Resolution**: Get actor and target names for message formatting
3. **Location Extraction**: Query actor's position component for location context
4. **Message Construction**: Build message: `{actorName} cups {targetName}'s chin in a tender gesture.`
5. **Perception Configuration**: Set perception type as `action_target_general`
6. **Turn Management**: Use `core:logSuccessAndEndTurn` macro to dispatch events and end turn

### Message Format

- **Perceptible Event**: `{actor} cups {target}'s chin in a tender gesture.`
- **Successful Action**: `{actor} cups {target}'s chin in a tender gesture.`
- **Note**: Both messages are identical per user specification

---

## Condition Specification

### File Location
`data/mods/caressing/conditions/event-is-action-cup-chin.condition.json`

### Complete JSON Definition

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "caressing:event-is-action-cup-chin",
  "description": "Checks if the event is a 'caressing:cup_chin' action attempt",
  "logic": {
    "==": [
      {
        "var": "event.payload.actionId"
      },
      "caressing:cup_chin"
    ]
  }
}
```

### Condition Logic

Simple equality check matching the pattern used by all other caressing actions:
- Checks `event.payload.actionId === "caressing:cup_chin"`
- Used by the rule to filter relevant events

---

## Test Suite Requirements

### Overview

Two comprehensive test suites are required following established patterns in the codebase:

1. **Action Discovery Tests** - Verify action appears in correct scenarios
2. **Rule Execution Tests** - Verify rule behavior and message formatting

### Test Suite 1: Action Discovery

**File Location**: `tests/integration/mods/caressing/cup_chin_action_discovery.test.js`

**Reference Pattern**: `tests/integration/mods/affection/tickle_target_playfully_action_discovery.test.js`

#### Required Test Cases

```javascript
describe('caressing:cup_chin action discovery', () => {

  describe('Action structure validation', () => {
    it('matches the expected caressing action schema')
    it('requires actor closeness and uses the caressing color palette')
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors facing each other')
    it('is not available when actors are not in closeness')
    it('is not available when the actor faces away from the target')
    it('is not available when target faces away from actor')
    it('is not available when actors are kissing')
  });
});
```

#### Test Scenarios

| Scenario | Expected Result | Rationale |
|----------|-----------------|-----------|
| Close actors facing each other | ✅ Action available | Meets all requirements |
| Actors not in closeness | ❌ Action unavailable | Missing required component |
| Actor faces away from target | ❌ Action unavailable | Not in scope |
| Target faces away from actor | ❌ Action unavailable | Not in scope |
| Actors currently kissing | ❌ Action unavailable | Forbidden component present |

#### Test Structure

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import cupChinAction from '../../../../data/mods/caressing/actions/cup_chin.action.json';

const ACTION_ID = 'caressing:cup_chin';

describe('caressing:cup_chin action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('caressing', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) return;

      testEnv.actionIndex.buildIndex([cupChinAction]);

      // Configure scope resolver for close_actors_facing_each_other
      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve = scopeResolver.__cupChinOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__cupChinOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'caressing:close_actors_facing_each_other') {
          // Implementation matching tickle_target_playfully pattern
          // ... (scope resolution logic)
        }
        return originalResolve(scopeName, context);
      };
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  // Test cases implementation...
});
```

### Test Suite 2: Rule Execution

**File Location**: `tests/integration/mods/caressing/cup_chin_action.test.js`

**Reference Pattern**: `tests/integration/mods/caressing/thumb_wipe_cheek_action.test.js`

#### Required Test Cases

```javascript
describe('caressing:cup_chin action integration', () => {
  it('successfully executes cup chin action')
  it('validates perceptible event message matches action success message')
  it('dispatches perceptible event to location')
  it('dispatches successful action result to actor')
  it('ends turn after action execution')
});
```

#### Test Scenarios

| Test Case | Validates | Expected Behavior |
|-----------|-----------|-------------------|
| **Successfully executes** | Basic execution | Action completes without errors |
| **Message matching** | Message consistency | Perceptible event = success message |
| **Perceptible event dispatch** | Event system | Event dispatched to location |
| **Success result dispatch** | UI feedback | Success message sent to actor |
| **Turn ending** | Turn management | Turn properly ends after action |

#### Test Structure

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import cupChinRule from '../../../../data/mods/caressing/rules/cup_chin.rule.json';
import eventIsActionCupChin from '../../../../data/mods/caressing/conditions/event-is-action-cup-chin.condition.json';

describe('caressing:cup_chin action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'caressing',
      'caressing:cup_chin',
      cupChinRule,
      eventIsActionCupChin
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes cup chin action', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1'
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      e => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
  });

  it('validates perceptible event message matches action success message', async () => {
    const scenario = testFixture.createCloseActors(['Diana', 'Victor'], {
      location: 'library'
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      e => e.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      e => e.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      perceptibleEvent.payload.descriptionText
    );
    expect(successEvent.payload.message).toBe(
      "Diana cups Victor's chin in a tender gesture."
    );
  });
});
```

### Test Coverage Requirements

- **Action Discovery**: 100% branch coverage
- **Rule Execution**: 100% branch coverage
- **Integration**: All event dispatching paths
- **Edge Cases**: Forbidden components, missing closeness, facing away scenarios

### Test Utilities

Both test suites use the `ModTestFixture` helper from `tests/common/mods/ModTestFixture.js`:

- `ModTestFixture.forAction()` - Sets up test environment
- `createCloseActors()` - Creates scenario with close actors
- `executeAction()` - Triggers action execution
- `events` - Captures all dispatched events
- `cleanup()` - Tears down test environment

---

## Implementation Checklist

### Phase 1: File Creation

- [ ] Create `data/mods/caressing/actions/cup_chin.action.json`
- [ ] Create `data/mods/caressing/rules/cup_chin.rule.json`
- [ ] Create `data/mods/caressing/conditions/event-is-action-cup-chin.condition.json`

### Phase 2: Manifest Updates

- [ ] Update `data/mods/caressing/mod-manifest.json`:
  ```json
  {
    "content": {
      "actions": [
        "cup_chin.action.json"  // Add to actions array
      ],
      "rules": [
        "cup_chin.rule.json"  // Add to rules array
      ],
      "conditions": [
        "event-is-action-cup-chin.condition.json"  // Add to conditions array
      ]
    }
  }
  ```

### Phase 3: Test Suite Creation

- [ ] Create `tests/integration/mods/caressing/cup_chin_action_discovery.test.js`
- [ ] Create `tests/integration/mods/caressing/cup_chin_action.test.js`

### Phase 4: Validation

- [ ] Run action discovery tests: `npm run test:integration -- cup_chin_action_discovery.test.js`
- [ ] Run rule execution tests: `npm run test:integration -- cup_chin_action.test.js`
- [ ] Verify all tests pass with 100% coverage
- [ ] Run full caressing mod test suite: `npm run test:integration -- tests/integration/mods/caressing/`

### Phase 5: Code Quality

- [ ] Run ESLint on test files: `npx eslint tests/integration/mods/caressing/cup_chin*.test.js`
- [ ] Run type checking: `npm run typecheck`
- [ ] Validate JSON schemas: Automatic during test execution
- [ ] Review test output for clarity

### Phase 6: Integration Testing

- [ ] Load game and verify action appears in action menu
- [ ] Test action execution in-game
- [ ] Verify message formatting matches specification
- [ ] Test forbidden component behavior (kissing scenario)
- [ ] Test scope filtering (facing away scenarios)

---

## References

### Similar Actions in Caressing Mod

| Action | Similarity | Reference File |
|--------|-----------|----------------|
| **thumb_wipe_cheek** | Facial touch, same scope | `data/mods/caressing/actions/thumb_wipe_cheek.action.json` |
| **run_thumb_across_lips** | Tender facial gesture | `data/mods/caressing/actions/run_thumb_across_lips.action.json` |
| **nuzzle_face_into_neck** | Close intimate contact | `data/mods/caressing/actions/nuzzle_face_into_neck.action.json` |

### Test References

| Test Type | Reference File | Pattern Used |
|-----------|---------------|--------------|
| **Action Discovery** | `tests/integration/mods/affection/tickle_target_playfully_action_discovery.test.js` | Scope resolver mocking, action availability testing |
| **Rule Execution** | `tests/integration/mods/caressing/thumb_wipe_cheek_action.test.js` | Event validation, message verification |

### Schema References

- **Action Schema**: `data/schemas/action.schema.json`
- **Rule Schema**: `data/schemas/rule.schema.json`
- **Condition Schema**: `data/schemas/condition.schema.json`
- **Mod Manifest Schema**: `data/schemas/mod-manifest.schema.json`

### Scope Reference

- **Scope File**: `data/mods/caressing/scopes/close_actors_facing_each_other.scope`
- **Scope Definition**:
  ```
  caressing:close_actors_facing_each_other :=
    actor.components.positioning:closeness.partners[][{
      "condition_ref": "positioning:both-actors-facing-each-other"
    }]
  ```

---

## Appendix A: Visual Color Palette

### Caressing Mod Colors

```css
/* Primary Colors */
--caressing-bg: #311b92;           /* Deep Indigo Background */
--caressing-text: #d1c4e9;         /* Light Purple Text */
--caressing-hover-bg: #4527a0;     /* Lighter Indigo Hover */
--caressing-hover-text: #ede7f6;   /* Very Light Purple Hover */
```

### Comparison with Affection Mod

```css
/* Affection Mod Colors (for reference) */
--affection-bg: #6a1b9a;           /* Purple Background */
--affection-text: #f3e5f5;         /* Light Purple Text */
--affection-hover-bg: #8e24aa;     /* Lighter Purple Hover */
--affection-hover-text: #ffffff;   /* White Hover Text */
```

**Key Difference**: Caressing uses deeper, more intense indigo (#311b92) vs affection's brighter purple (#6a1b9a), reflecting the more intimate/sensual nature of caressing actions.

---

## Appendix B: Message Template Examples

### Expected Output Scenarios

| Actor | Target | Expected Message |
|-------|--------|------------------|
| Alice | Bob | `Alice cups Bob's chin in a tender gesture.` |
| Diana | Victor | `Diana cups Victor's chin in a tender gesture.` |
| Maya | Liam | `Maya cups Liam's chin in a tender gesture.` |

### Message Consistency

- **Perceptible Event Message**: `{actorName} cups {targetName}'s chin in a tender gesture.`
- **Successful Action Message**: `{actorName} cups {targetName}'s chin in a tender gesture.`
- **Template Placeholders**: `{actor}` → actorName, `{target}` → targetName

---

## Appendix C: Implementation Notes

### Dependencies

This action depends on existing game systems:

- **Core Systems**: Event bus, entity manager, component mutation service
- **Positioning Mod**: `positioning:closeness` component, facing conditions
- **Kissing Mod**: `kissing:kissing` component (for forbidden check)
- **Core Macros**: `core:logSuccessAndEndTurn` macro

### No New Components Required

This action **does not** create or modify any components. It purely:
1. Checks existing components (`positioning:closeness`, `kissing:kissing`)
2. Resolves scope (`caressing:close_actors_facing_each_other`)
3. Dispatches events (`core:perceptible_event`, `core:display_successful_action_result`)
4. Ends turn (via macro)

### Mod Load Order

Ensure `caressing` mod is loaded after its dependencies:
1. `core`
2. `positioning`
3. `kissing`
4. `caressing` ← Cup chin action here

This is already configured in `data/mods/caressing/mod-manifest.json` dependencies.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-17 | Initial specification |

---

## Approval

- [ ] Design approved by project lead
- [ ] Mod placement confirmed (caressing)
- [ ] Test requirements validated
- [ ] Ready for implementation

---

**End of Specification**
