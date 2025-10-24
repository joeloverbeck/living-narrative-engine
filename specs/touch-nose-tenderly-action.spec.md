# Touch Nose Tenderly Action & Rule Specification

## Overview

Design and implement a new affectionate interaction where the actor touches the tip of the target's nose tenderly. This builds on the existing `affection:pat_head_affectionately` action, reusing its proximity scope, component requirements, and visual palette to maintain mod consistency.

## Action Implementation Requirements

Create `data/mods/affection/actions/touch_nose_tenderly.action.json` with the following schema-aligned fields:

- `$schema`: `schema://living-narrative-engine/action.schema.json`
- `id`: `affection:touch_nose_tenderly`
- `name`: "Touch nose tenderly"
- `description`: Briefly conveys a tender nose touch (e.g., "Touch the tip of the target's nose in a tender gesture.")
- `targets`: `positioning:close_actors_or_entity_kneeling_before_actor` (matches the pat head reference)
- `required_components.actor`: `["positioning:closeness"]`
- `template`: **exactly** `touch the tip of {target}'s nose tenderly`
- `prerequisites`: keep an empty array unless discovery tests surface mandatory gating
- `visual`: copy the affection palette from the reference action (background `#6a1b9a`, text `#f3e5f5`, hover background `#8e24aa`, hover text `#ffffff`)

**Example JSON structure:**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "affection:touch_nose_tenderly",
  "name": "Touch nose tenderly",
  "description": "Touch the tip of the target's nose in a tender gesture.",
  "targets": "positioning:close_actors_or_entity_kneeling_before_actor",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "template": "touch the tip of {target}'s nose tenderly",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#6a1b9a",
    "textColor": "#f3e5f5",
    "hoverBackgroundColor": "#8e24aa",
    "hoverTextColor": "#ffffff"
  }
}
```

Update `data/mods/affection/mod-manifest.json` to register the new action.

## Rule Implementation Requirements

Add `data/mods/affection/rules/handle_touch_nose_tenderly.rule.json` that follows the affection resolver pattern:

- `rule_id`: `handle_touch_nose_tenderly` with a clarifying `comment` describing the handled action
- `event_type`: `core:attempt_action`
- Single `condition`: `{ "condition_ref": "affection:event-is-action-touch-nose-tenderly" }`
- Action sequence should:
  1. Resolve actor and target display names into `actorName` / `targetName` variables
  2. Retrieve the actor's `core:position` component (store in `actorPosition`)
  3. Set `logMessage` to **exactly** `{actor} touches the tip of {target}'s nose tenderly.` via the templated context variables
  4. Provide `perceptionType`, `locationId`, and `targetId` consistent with other affection touch rules before invoking the standard success macro (`core:logSuccessAndEndTurn`)
- The emitted successful action event and the perceptible event must both use the exact string `{actor} touches the tip of {target}'s nose tenderly.`

**Example JSON structure:**

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_touch_nose_tenderly",
  "comment": "Handles the 'affection:touch_nose_tenderly' action and ends the turn with a tender log.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "affection:event-is-action-touch-nose-tenderly"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "targetName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} touches the tip of {context.targetName}'s nose tenderly."
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
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
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

## Condition Implementation Requirements

Create the matching condition file `data/mods/affection/conditions/event-is-action-touch-nose-tenderly.condition.json`:

**Example JSON structure:**

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "affection:event-is-action-touch-nose-tenderly",
  "description": "Checks if the triggering event is for the 'affection:touch_nose_tenderly' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "affection:touch_nose_tenderly"
    ]
  }
}
```

Register both the rule and condition in `data/mods/affection/mod-manifest.json` alongside the new action.

## Testing Requirements

Author comprehensive integration coverage in `tests/integration/mods/affection/`:

### 1. Action Discovery Test Suite

**File**: `tests/integration/mods/affection/touch_nose_tenderly_action_discovery.test.js`

Mirror the existing `pat_head_affectionately_action_discovery.test.js` structure to ensure the action surfaces only when closeness requirements are satisfied and the target meets the kneeling-or-close scope.

#### Required Test Coverage

**Action Structure Validation:**
- Verify action matches expected schema
- Verify action ID is `affection:touch_nose_tenderly`
- Verify template is exactly `touch the tip of {target}'s nose tenderly`
- Verify targets scope is `positioning:close_actors_or_entity_kneeling_before_actor`
- Verify required components includes `positioning:closeness`
- Verify visual palette matches affection mod colors

**Positive Discovery Scenarios:**
- Action is available for close actors facing each other
- Action is available when the target kneels before the actor
- Action is available when actor stands behind target

**Negative Discovery Scenarios:**
- Action is NOT available when actors are not in closeness
- Action is NOT available when actor faces away from target
- Action is NOT available when closeness component is missing
- Action is NOT available when actor is kneeling before target

#### Testing Utilities to Use

- `createActionDiscoveryBed()` from `tests/common/actions/actionDiscoveryServiceTestBed.js`
- `SimpleEntityManager` from `tests/common/entities/simpleEntityManager.js`
- Import action matchers: `tests/common/actionMatchers.js`
- `ActionResult` and `ActionTargetContext` for mock implementations

#### Example Test Structure

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import touchNoseTenderlyAction from '../../../../data/mods/affection/actions/touch_nose_tenderly.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'affection:touch_nose_tenderly';

describe('affection:touch_nose_tenderly action discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
    // Setup test bed with SimpleEntityManager and mock implementations
  });

  afterEach(async () => {
    if (testBed?.cleanup) {
      await testBed.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected affection action schema', () => {
      expect(touchNoseTenderlyAction).toBeDefined();
      expect(touchNoseTenderlyAction.id).toBe(ACTION_ID);
      expect(touchNoseTenderlyAction.template).toBe(
        "touch the tip of {target}'s nose tenderly"
      );
      // ... additional validations
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors facing each other', async () => {
      // Test implementation
    });
    // ... additional scenario tests
  });
});
```

### 2. Rule Behavior Test Suite

**File**: `tests/integration/mods/affection/touch_nose_tenderly_action.test.js`

Use `ModTestFixture.forAction` (auto-loading the new rule) to execute the action and assert the success event, perceptible event payload, and target bindings all reflect the tender nose-touch messaging.

#### Required Test Coverage

**Successful Execution:**
- Emits matching success and perceptible messages when executed
- Success message is exactly `{actor} touches the tip of {target}'s nose tenderly.`
- Perceptible event message matches success message
- Perceptible event has correct `perceptionType` (`action_target_general`)
- Perceptible event has correct `locationId` (actor's location)
- Perceptible event has correct `targetId` (target entity ID)

**Component State:**
- Actor maintains closeness component after action
- Target maintains their positioning components
- No unexpected component mutations occur

**Event Validation:**
- Success event is dispatched with correct action ID
- Perceptible event is dispatched with proper payload structure
- Turn ending events are dispatched correctly

#### Testing Utilities to Use

- `ModTestFixture.forAction()` from `tests/common/mods/ModTestFixture.js`
- Import domain matchers: `tests/common/mods/domainMatchers.js`
- Use `createCloseActors()` helper for scenario setup
- Use `executeAction()` for action execution
- Use event matchers like `toHaveActionSuccess()` and `toDispatchEvent()`

#### Example Test Structure

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';

const ACTION_ID = 'affection:touch_nose_tenderly';

describe('affection:touch_nose_tenderly action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('emits matching success and perceptible messages when executed', async () => {
    const scenario = testFixture.createCloseActors(['Avery', 'Rowan'], {
      location: 'conservatory',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const expectedMessage = "Avery touches the tip of Rowan's nose tenderly.";

    expect(testFixture.events).toHaveActionSuccess(expectedMessage);

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
    expect(perceptibleEvent.payload.perceptionType).toBe('action_target_general');
    expect(perceptibleEvent.payload.locationId).toBe('conservatory');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
  });
});
```

### 3. Additional Test Scenarios

#### Edge Cases to Cover

**Kneeling Scenarios:**
- Action available when target kneels before actor
- Action NOT available when actor kneels before target
- Proper message formatting when target is kneeling

**Positioning Edge Cases:**
- Mixed facing states (one facing away, one facing toward)
- Actor standing behind target
- Multiple potential targets with different positioning states

**Component Requirements:**
- Missing closeness component prevents discovery
- Closeness component with empty partners array prevents discovery
- Closeness component validation during action execution

#### Diagnostic Testing

Include diagnostic helpers sparingly and only during failure investigation:
- Use `testBed.discoverActionsWithDiagnostics()` for resolver debugging
- Use `testFixture.enableDiagnostics()` for execution tracing
- Guard diagnostic output with environment checks to keep standard runs quiet
- Clean up diagnostic enablement in `afterEach` blocks

### Test Organization Guidelines

Following the mod testing guide recommendations:

1. **File Naming**:
   - Discovery tests: `touch_nose_tenderly_action_discovery.test.js`
   - Behavior tests: `touch_nose_tenderly_action.test.js`

2. **Test Structure**:
   - Use `describe` blocks to group related scenarios
   - Use clear, descriptive test names with `it` blocks
   - Follow Arrange-Act-Assert pattern in each test

3. **Lifecycle Management**:
   - Initialize fixtures/test beds in `beforeEach`
   - Clean up resources in `afterEach`
   - Avoid reusing fixtures across tests without explicit reset

4. **Assertion Quality**:
   - Use domain-specific matchers for readable failures
   - Verify exact message strings (no partial matches)
   - Check both success events and perceptible events
   - Validate all relevant payload fields

5. **Test Independence**:
   - Each test should run independently
   - No shared state between tests
   - Clear setup and teardown for isolation

## Reference Documentation

The test suites should adhere to patterns documented in:
- **Mod Testing Guide**: `docs/testing/mod-testing-guide.md` (canonical reference)
- **Action Discovery Toolkit**: `docs/testing/action-discovery-testing-toolkit.md` (migration checklists)
- **Reference Implementation**: `tests/integration/mods/affection/pat_head_affectionately_action*.test.js`

## Out of Scope

- New animations, audio, or UI assets beyond the reused visual palette
- Changes to global positioning scopes or component schemas
- Alterations to existing affection actions beyond manifest registration
- Custom positioning components or scope definitions
- Performance testing or memory leak detection (unless issues surface during integration testing)

## Implementation Checklist

- [ ] Create action JSON file with correct schema and properties
- [ ] Create rule JSON file following affection pattern
- [ ] Create condition JSON file for action matching
- [ ] Update mod manifest to register action, rule, and condition
- [ ] Implement action discovery test suite with comprehensive coverage
- [ ] Implement rule behavior test suite with message validation
- [ ] Verify all tests pass with proper cleanup
- [ ] Validate exact message strings in both test suites
- [ ] Ensure test coverage includes positive and negative scenarios
- [ ] Run full test suite to verify no regressions

## Success Criteria

Implementation is complete when:
1. All JSON files are created and properly registered in the mod manifest
2. Action discovery test suite passes with 100% success rate
3. Rule behavior test suite validates exact message strings
4. Both test suites follow the mod testing guide patterns
5. No test failures or regressions in existing affection mod tests
6. Code coverage remains above 80% for modified modules
7. ESLint and type checking pass for all test files
