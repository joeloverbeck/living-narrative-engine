# Specification: Pull Penis Out of Vagina Action/Rule

**Mod**: `sex-vaginal-penetration`
**Created**: 2025-01-09
**Status**: Approved for Implementation

## Overview

This specification defines a new action/rule combination that allows an actor to pull their penis out of a target's vagina, ending the vaginal penetration state between the two entities.

## Design Goals

1. **State Cleanup**: Properly remove reciprocal penetration components from both participants
2. **Scope Safety**: Only allow the action on entities currently being penetrated by the acting actor
3. **Defensive Validation**: Verify prerequisites even when they should already be satisfied
4. **Narrative Consistency**: Match the descriptive style of existing vaginal penetration actions
5. **Test Coverage**: Comprehensive integration and discovery test suites

## Technical Requirements

### 1. New Scope Definition

**File**: `data/mods/sex-vaginal-penetration/scopes/actors_being_fucked_vaginally_by_me.scope`

**Purpose**: Filter closeness partners who have the `being_fucked_vaginally` component with the acting actor as the referenced penetrator.

**Scope DSL**:
```javascript
// Scope for partners currently being vaginally penetrated by the actor
// Ensures the target has being_fucked_vaginally component with matching actorId reference
sex-vaginal-penetration:actors_being_fucked_vaginally_by_me := actor.components.positioning:closeness.partners[][
  {
    "and": [
      {"hasComponent": [".", "positioning:being_fucked_vaginally"]},
      {"==": [
        {"var": "components.positioning:being_fucked_vaginally.actorId"},
        {"var": "actorId"}
      ]}
    ]
  }
]
```

**Filter Logic**:
- Base collection: `actor.components.positioning:closeness.partners[]`
- Filter criteria:
  - Entity must have `positioning:being_fucked_vaginally` component
  - The `actorId` field in that component must match the acting actor's ID

**Edge Cases Handled**:
- Prevents targeting partners who are being penetrated by someone else
- Ensures only active penetration targets are selectable
- Works correctly in group scenarios with multiple penetrations

### 2. Action Definition

**File**: `data/mods/sex-vaginal-penetration/actions/pull_penis_out_of_vagina.action.json`

**Schema Compliance**: `schema://living-narrative-engine/action.schema.json`

**Action Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-vaginal-penetration:pull_penis_out_of_vagina",
  "name": "Pull Penis Out of Vagina",
  "description": "Withdraw your penis from your partner's vagina, ending the vaginal penetration.",
  "targets": {
    "primary": {
      "scope": "sex-vaginal-penetration:actors_being_fucked_vaginally_by_me",
      "placeholder": "primary",
      "description": "Partner whose vagina you are currently penetrating"
    }
  },
  "required_components": {
    "actor": [
      "positioning:closeness",
      "positioning:fucking_vaginally"
    ]
  },
  "template": "pull your penis out of {primary}'s vagina",
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["actor", "penis"]
      },
      "failure_message": "You need a penis to perform this action."
    },
    {
      "logic": {
        "not": {
          "isSocketCovered": ["actor", "penis"]
        }
      },
      "failure_message": "Your penis must be uncovered to perform this action."
    }
  ],
  "visual": {
    "backgroundColor": "#6c0f36",
    "textColor": "#ffe6ef",
    "hoverBackgroundColor": "#861445",
    "hoverTextColor": "#fff2f7"
  }
}
```

**Design Decisions**:

- **Required Components**:
  - `positioning:closeness`: Must be close to the partner
  - `positioning:fucking_vaginally`: Must be actively penetrating (this is the key state component)

- **No Forbidden Components**: Not needed because the action requires `fucking_vaginally`, which prevents duplicate discovery

- **Prerequisites**: Defensive checks for uncovered penis, even though this should already be true from the insertion action

- **Template**: Simple, direct language matching existing mod style

- **Visual Styling**: Matches the existing mod color scheme for consistency

### 3. Condition Definition

**File**: `data/mods/sex-vaginal-penetration/conditions/event-is-action-pull-penis-out-of-vagina.condition.json`

**Schema Compliance**: `schema://living-narrative-engine/condition.schema.json`

**Condition Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-vaginal-penetration:event-is-action-pull-penis-out-of-vagina",
  "description": "Checks if the event attempts the 'sex-vaginal-penetration:pull_penis_out_of_vagina' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex-vaginal-penetration:pull_penis_out_of_vagina"
    ]
  }
}
```

**Pattern**: Standard equality check following existing mod conventions.

### 4. Rule Definition

**File**: `data/mods/sex-vaginal-penetration/rules/handle_pull_penis_out_of_vagina.rule.json`

**Schema Compliance**: `schema://living-narrative-engine/rule.schema.json`

**Rule Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_pull_penis_out_of_vagina",
  "comment": "Handles the 'sex-vaginal-penetration:pull_penis_out_of_vagina' action by removing penetration state components from both the actor and target, then logging a perceptible event.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex-vaginal-penetration:event-is-action-pull-penis-out-of-vagina"
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
        "entity_ref": "primary",
        "result_variable": "primaryName"
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
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:fucking_vaginally"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "primary",
        "component_type": "positioning:being_fucked_vaginally"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} pulls out their wet penis out of {context.primaryName}'s vagina."
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
        "variable_name": "actorId",
        "value": "{event.payload.actorId}"
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
        "value": "{event.payload.primaryId}"
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Operation Flow**:

1. **Name Resolution** (GET_NAME):
   - Retrieve actor and primary target names for narrative text

2. **Position Query** (QUERY_COMPONENT):
   - Get actor's position component to extract locationId for event broadcasting

3. **State Cleanup** (REMOVE_COMPONENT):
   - Remove `positioning:fucking_vaginally` from actor (clears penetrator state)
   - Remove `positioning:being_fucked_vaginally` from target (clears penetrated state)

4. **Variable Setup** (SET_VARIABLE):
   - `logMessage`: Narrative description of the action
   - `perceptionType`: Event perception category
   - `actorId`, `locationId`, `targetId`: Required for macro

5. **Finalization** (macro):
   - Invoke `core:logSuccessAndEndTurn` to log the action and end turn

**Design Decisions**:

- **REMOVE_COMPONENT Operations**: Mirror the ADD_COMPONENT operations from the insertion action, ensuring complete state cleanup
- **Narrative Message**: Matches specification exactly: `"{actor} pulls out their wet penis out of {primary}'s vagina."`
- **Perception Type**: Uses `action_target_general` for consistent event broadcasting
- **Macro Invocation**: Follows standard pattern for action finalization

### 5. File Naming Conventions

**CRITICAL**: The mod uses different naming conventions for different file types:

| File Type | Convention | Example |
|-----------|------------|---------|
| Actions | `{action_name}.action.json` | `pull_penis_out_of_vagina.action.json` |
| Rules | `handle_{action_name}.rule.json` | `handle_pull_penis_out_of_vagina.rule.json` |
| Conditions | `event-is-action-{action-name}.condition.json` | `event-is-action-pull-penis-out-of-vagina.condition.json` |
| Scopes | `{scope_name}.scope` | `actors_being_fucked_vaginally_by_me.scope` |

**Note**: Conditions use **hyphens**, while actions/rules/scopes use **underscores**.

## Testing Requirements

### 1. Integration Test Suite

**File**: `tests/integration/mods/sex-vaginal-penetration/pull_penis_out_of_vagina_action.test.js`

**Test Framework**: Jest with ModTestFixture pattern

**Required Test Cases**:

#### Test 1: Successful Execution
```javascript
it('performs the pull-out action successfully', async () => {
  // Setup: Two actors with active vaginal penetration
  const scenario = createPenetrationScenario();
  testFixture.reset(scenario);

  // Execute: Actor pulls out
  await testFixture.executeAction('alice', 'beth', {
    additionalPayload: { primaryId: 'beth' },
  });

  // Assert: Success message matches specification
  ModAssertionHelpers.assertActionSuccess(
    testFixture.events,
    "Alice pulls out their wet penis out of Beth's vagina.",
    {
      shouldEndTurn: true,
      shouldHavePerceptibleEvent: true,
    }
  );
});
```

**Validation**:
- Action executes without errors
- Perceptible event is dispatched
- Message matches exact specification
- Turn ends after action

#### Test 2: Component Removal from Actor
```javascript
it('removes fucking_vaginally component from actor', async () => {
  // Setup: Actor has fucking_vaginally component
  const scenario = createPenetrationScenario();
  testFixture.reset(scenario);

  // Verify prerequisite
  expect(
    testFixture.entityManager.hasComponent('alice', 'positioning:fucking_vaginally')
  ).toBe(true);

  // Execute: Pull out action
  await testFixture.executeAction('alice', 'beth', {
    additionalPayload: { primaryId: 'beth' },
  });

  // Assert: Component is removed
  expect(
    testFixture.entityManager.hasComponent('alice', 'positioning:fucking_vaginally')
  ).toBe(false);
});
```

**Validation**:
- Component exists before action
- Component is removed after action
- No residual component data remains

#### Test 3: Component Removal from Target
```javascript
it('removes being_fucked_vaginally component from target', async () => {
  // Setup: Target has being_fucked_vaginally component
  const scenario = createPenetrationScenario();
  testFixture.reset(scenario);

  // Verify prerequisite
  expect(
    testFixture.entityManager.hasComponent('beth', 'positioning:being_fucked_vaginally')
  ).toBe(true);

  // Execute: Pull out action
  await testFixture.executeAction('alice', 'beth', {
    additionalPayload: { primaryId: 'beth' },
  });

  // Assert: Component is removed
  expect(
    testFixture.entityManager.hasComponent('beth', 'positioning:being_fucked_vaginally')
  ).toBe(false);
});
```

**Validation**:
- Component exists before action
- Component is removed after action
- No residual component data remains

#### Test 4: Perceptible Event Validation
```javascript
it('dispatches perceptible event with correct payload', async () => {
  const scenario = createPenetrationScenario();
  testFixture.reset(scenario);

  await testFixture.executeAction('alice', 'beth', {
    additionalPayload: { primaryId: 'beth' },
  });

  const perceptibleEvent = ModAssertionHelpers.findPerceptibleEvent(
    testFixture.events
  );

  expect(perceptibleEvent).toBeDefined();
  expect(perceptibleEvent.payload.perceptionType).toBe('action_target_general');
  expect(perceptibleEvent.payload.actorId).toBe('alice');
  expect(perceptibleEvent.payload.targetId).toBe('beth');
  expect(perceptibleEvent.payload.message).toBe(
    "Alice pulls out their wet penis out of Beth's vagina."
  );
});
```

**Validation**:
- Event type is correct
- Perception type matches specification
- Entity IDs are correct
- Message is exact

#### Test 5: State Cleanup Verification
```javascript
it('fully cleans up penetration state between entities', async () => {
  const scenario = createPenetrationScenario();
  testFixture.reset(scenario);

  // Verify initial state
  const initialActorComponent = testFixture.entityManager.getComponentData(
    'alice',
    'positioning:fucking_vaginally'
  );
  expect(initialActorComponent).toEqual({ targetId: 'beth' });

  const initialTargetComponent = testFixture.entityManager.getComponentData(
    'beth',
    'positioning:being_fucked_vaginally'
  );
  expect(initialTargetComponent).toEqual({ actorId: 'alice' });

  // Execute action
  await testFixture.executeAction('alice', 'beth', {
    additionalPayload: { primaryId: 'beth' },
  });

  // Verify complete cleanup
  expect(
    testFixture.entityManager.hasComponent('alice', 'positioning:fucking_vaginally')
  ).toBe(false);
  expect(
    testFixture.entityManager.hasComponent('beth', 'positioning:being_fucked_vaginally')
  ).toBe(false);
});
```

**Validation**:
- Both reciprocal components are removed
- No orphaned state remains
- Entities can engage in new penetration

**Scenario Builder**:
```javascript
function createPenetrationScenario() {
  return {
    entities: {
      alice: {
        id: 'alice',
        components: {
          'core:name': { firstName: 'Alice', surname: 'Smith' },
          'core:position': { locationId: 'bedroom' },
          'positioning:closeness': { partners: ['beth'] },
          'positioning:fucking_vaginally': { targetId: 'beth' },
          'anatomy:body': { /* Full anatomy with penis socket */ },
        },
      },
      beth: {
        id: 'beth',
        components: {
          'core:name': { firstName: 'Beth', surname: 'Jones' },
          'core:position': { locationId: 'bedroom' },
          'positioning:closeness': { partners: ['alice'] },
          'positioning:being_fucked_vaginally': { actorId: 'alice' },
          'anatomy:body': { /* Full anatomy with vagina socket */ },
        },
      },
    },
  };
}
```

### 2. Discovery Test Suite

**File**: `tests/integration/mods/sex-vaginal-penetration/pull_penis_out_of_vagina_action_discovery.test.js`

**Test Framework**: Jest with ModTestFixture and custom scope resolvers

**Required Test Cases**:

#### Test 1: Action Appears During Penetration
```javascript
it('appears when actor is actively penetrating the target', async () => {
  const scenario = createPenetrationScenario();
  testFixture.reset(scenario);
  configureActionDiscovery();

  const actions = await testFixture.discoverActions('alice');
  const foundAction = actions.find(
    (action) => action.id === 'sex-vaginal-penetration:pull_penis_out_of_vagina'
  );

  expect(foundAction).toBeDefined();
  expect(foundAction.targets.primary).toEqual(['beth']);
});
```

**Validation**:
- Action is discovered when in penetration state
- Target list includes the penetrated partner
- Action metadata is complete

#### Test 2: Action Doesn't Appear Without Penetration
```javascript
it('does not appear when actor is not penetrating anyone', async () => {
  const scenario = createNonPenetrationScenario();
  testFixture.reset(scenario);
  configureActionDiscovery();

  const actions = await testFixture.discoverActions('alice');
  const foundAction = actions.find(
    (action) => action.id === 'sex-vaginal-penetration:pull_penis_out_of_vagina'
  );

  expect(foundAction).toBeUndefined();
});
```

**Validation**:
- Action is not discovered without penetration state
- Required component check prevents discovery

#### Test 3: Scope Filters Correct Target
```javascript
it('only targets the entity being penetrated by the actor', async () => {
  // Scenario: Alice penetrating Beth, close to Carol (not penetrating)
  const scenario = createMultiPartnerScenario();
  testFixture.reset(scenario);
  configureActionDiscovery();

  const actions = await testFixture.discoverActions('alice');
  const foundAction = actions.find(
    (action) => action.id === 'sex-vaginal-penetration:pull_penis_out_of_vagina'
  );

  expect(foundAction).toBeDefined();
  expect(foundAction.targets.primary).toEqual(['beth']);
  expect(foundAction.targets.primary).not.toContain('carol');
});
```

**Validation**:
- Scope correctly filters by actorId reference
- Only the actively penetrated entity is included
- Close but non-penetrated partners are excluded

#### Test 4: Multiple Penetrations Scenario
```javascript
it('handles multiple simultaneous penetrations correctly', async () => {
  // Scenario: Alice penetrating Beth, Dave penetrating Emily
  const scenario = createGroupScenario();
  testFixture.reset(scenario);
  configureActionDiscovery();

  // Alice should only see Beth as target
  const aliceActions = await testFixture.discoverActions('alice');
  const aliceAction = aliceActions.find(
    (action) => action.id === 'sex-vaginal-penetration:pull_penis_out_of_vagina'
  );
  expect(aliceAction.targets.primary).toEqual(['beth']);

  // Dave should only see Emily as target
  const daveActions = await testFixture.discoverActions('dave');
  const daveAction = daveActions.find(
    (action) => action.id === 'sex-vaginal-penetration:pull_penis_out_of_vagina'
  );
  expect(daveAction.targets.primary).toEqual(['emily']);
});
```

**Validation**:
- Scope filtering works correctly in group scenarios
- Each actor only sees their own penetration targets
- No cross-contamination of targets

#### Test 5: Prerequisites Validation
```javascript
it('validates uncovered penis prerequisite', async () => {
  const scenario = createPenetrationScenario();
  // Add clothing covering penis
  scenario.entities.alice.components['clothing:clothing'] = {
    items: [
      {
        id: 'underwear',
        socketsCovered: ['penis'],
      },
    ],
  };

  testFixture.reset(scenario);

  // Action should still be discovered (has required components)
  const actions = await testFixture.discoverActions('alice');
  const foundAction = actions.find(
    (action) => action.id === 'sex-vaginal-penetration:pull_penis_out_of_vagina'
  );
  expect(foundAction).toBeDefined();

  // But execution should fail prerequisite check
  await expect(
    testFixture.executeAction('alice', 'beth', {
      additionalPayload: { primaryId: 'beth' },
    })
  ).rejects.toThrow(/penis must be uncovered/i);
});
```

**Validation**:
- Prerequisites are checked at execution time
- Defensive validation catches edge cases
- Appropriate error message is shown

**Custom Scope Resolver**:
```javascript
function configureActionDiscovery() {
  const resolver = testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync;

  resolver.resolveSync = (scopeName, context) => {
    if (
      scopeName ===
      'sex-vaginal-penetration:actors_being_fucked_vaginally_by_me'
    ) {
      return resolveBeingFuckedVaginallyScope(context);
    }
    return originalResolveSync.call(resolver, scopeName, context);
  };

  restoreScopeResolver = () => {
    resolver.resolveSync = originalResolveSync;
  };
}

function resolveBeingFuckedVaginallyScope(context) {
  const actor = context.actor;
  const closenessPartners = actor.components['positioning:closeness']?.partners || [];

  return closenessPartners.filter((partnerId) => {
    const partner = context.entityManager.getEntity(partnerId);
    const beingFuckedComponent = partner.components['positioning:being_fucked_vaginally'];

    return (
      beingFuckedComponent &&
      beingFuckedComponent.actorId === actor.id
    );
  });
}
```

**Cleanup**:
```javascript
afterEach(() => {
  if (restoreScopeResolver) {
    restoreScopeResolver();
  }
  if (testFixture) {
    testFixture.cleanup();
  }
});
```

### Test Helpers & Utilities

**Import Statements**:
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/modTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/modAssertionHelpers.js';
import '../../common/mods/domainMatchers.js'; // For custom matchers
```

**Scenario Builders**:
- `createPenetrationScenario()`: Two actors with active vaginal penetration
- `createNonPenetrationScenario()`: Two actors close but not penetrating
- `createMultiPartnerScenario()`: Actor close to multiple partners, penetrating one
- `createGroupScenario()`: Multiple pairs of penetrations

**Test Organization**:
```
describe('sex-vaginal-penetration:pull_penis_out_of_vagina', () => {
  describe('Action Execution', () => {
    // Integration tests
  });

  describe('Action Discovery', () => {
    // Discovery tests
  });
});
```

## Validation Checklist

Before considering the implementation complete, verify:

### Schema Validation
- [ ] All JSON files validate against their schemas
- [ ] Action ID matches condition reference exactly
- [ ] Component types are correctly namespaced
- [ ] Scope name is correctly referenced in action

### File Naming
- [ ] Action file uses underscores: `pull_penis_out_of_vagina.action.json`
- [ ] Rule file uses underscores: `handle_pull_penis_out_of_vagina.rule.json`
- [ ] Condition file uses hyphens: `event-is-action-pull-penis-out-of-vagina.condition.json`
- [ ] Scope file uses underscores: `actors_being_fucked_vaginally_by_me.scope`

### Functional Requirements
- [ ] Scope correctly filters by actorId reference
- [ ] Action requires both closeness and fucking_vaginally components
- [ ] Rule removes both reciprocal components
- [ ] Perceptible event message matches specification exactly
- [ ] Visual styling matches mod color scheme

### Test Coverage
- [ ] Integration test: Successful execution
- [ ] Integration test: Component removal from actor
- [ ] Integration test: Component removal from target
- [ ] Integration test: Perceptible event payload
- [ ] Integration test: Complete state cleanup
- [ ] Discovery test: Action appears during penetration
- [ ] Discovery test: Action doesn't appear without state
- [ ] Discovery test: Scope filters correct targets
- [ ] Discovery test: Multiple penetrations handled correctly
- [ ] Discovery test: Prerequisites validated

### Code Quality
- [ ] All tests pass: `npm run test:integration`
- [ ] Schema validation passes: `npm run validate`
- [ ] Scope DSL linting passes: `npm run scope:lint`
- [ ] No ESLint errors: `npx eslint <modified-files>`
- [ ] Test coverage meets thresholds (80%+ branches)

## Implementation Order

Follow this order to minimize circular dependencies:

1. **Scope Definition** (`actors_being_fucked_vaginally_by_me.scope`)
   - Can be tested in isolation
   - No dependencies on other new files

2. **Condition Definition** (`event-is-action-pull-penis-out-of-vagina.condition.json`)
   - Simple file, no dependencies
   - Required by rule

3. **Action Definition** (`pull_penis_out_of_vagina.action.json`)
   - References scope
   - Required for rule testing

4. **Rule Definition** (`handle_pull_penis_out_of_vagina.rule.json`)
   - References condition
   - References action indirectly
   - Core logic implementation

5. **Integration Tests** (`pull_penis_out_of_vagina_action.test.js`)
   - Tests rule behavior
   - Validates component removal

6. **Discovery Tests** (`pull_penis_out_of_vagina_action_discovery.test.js`)
   - Tests action discovery
   - Validates scope resolution

## Edge Cases & Considerations

### Edge Case 1: Covered Penis After Penetration
**Scenario**: Somehow penis becomes covered during penetration (shouldn't happen, but defensive)

**Handling**: Prerequisites check for uncovered penis, action execution fails gracefully

**Test**: Prerequisites validation test in discovery suite

### Edge Case 2: Multiple Simultaneous Penetrations
**Scenario**: Actor is close to multiple partners, penetrating only one

**Handling**: Scope filters by exact actorId match, only returns the specific target

**Test**: Multiple penetrations test in discovery suite

### Edge Case 3: Component Removal Failure
**Scenario**: Component doesn't exist during removal (race condition or state desync)

**Handling**: REMOVE_COMPONENT operation should handle gracefully (implementation detail)

**Test**: Not explicitly tested, relies on operation handler robustness

### Edge Case 4: Group Sex Scenarios
**Scenario**: Multiple actors penetrating multiple targets in same location

**Handling**: Each actor's scope resolver independently filters their specific target(s)

**Test**: Group scenario test in discovery suite

### Edge Case 5: Mid-Action State Changes
**Scenario**: Penetration state changes between action discovery and execution

**Handling**: Rule validates components exist before removal, macro handles gracefully

**Test**: Covered in integration tests, state validation implicit

## References

### Existing Implementations
- **Reference Action**: `insert_penis_into_vagina.action.json` (initiation pattern)
- **Reference Rule**: `handle_insert_penis_into_vagina.rule.json` (component management)
- **Reference Scope**: `actors_with_uncovered_vagina_facing_each_other_or_target_facing_away.scope` (filtering pattern)

### Documentation
- **Mod Testing Guide**: `docs/testing/mod-testing-guide.md`
- **Action Schema**: `data/schemas/action.schema.json`
- **Rule Schema**: `data/schemas/rule.schema.json`
- **Condition Schema**: `data/schemas/condition.schema.json`
- **Scope DSL Guide**: Project CLAUDE.md (Scope DSL Syntax section)

### Test Patterns
- **Integration Tests**: `tests/integration/mods/sex-vaginal-penetration/insert_penis_into_vagina_action.test.js`
- **Discovery Tests**: `tests/integration/mods/sex-vaginal-penetration/insert_penis_into_vagina_action_discovery.test.js`
- **Test Helpers**: `tests/common/mods/modTestFixture.js`, `tests/common/mods/modAssertionHelpers.js`

## Success Criteria

Implementation is complete when:

1. ✅ All 6 files created with correct naming conventions
2. ✅ Schema validation passes for all JSON files
3. ✅ All 10 test cases pass (5 integration + 5 discovery)
4. ✅ Test coverage meets 80%+ threshold
5. ✅ ESLint validation passes on all modified files
6. ✅ Scope DSL linting passes
7. ✅ Perceptible event message matches specification exactly
8. ✅ Component cleanup is complete (no orphaned state)
9. ✅ Action is discoverable only when in penetration state
10. ✅ Manual testing confirms expected behavior

## Notes

- This action is the **inverse** of `insert_penis_into_vagina`, removing components instead of adding them
- The scope is **more restrictive** than insertion scopes, filtering by exact actorId match
- Prerequisites are **defensive** - they validate conditions that should already be true
- The narrative message includes **"wet penis"** detail for descriptive consistency
- Test suite is **comprehensive** to catch edge cases in group scenarios
- Implementation follows **existing patterns** from the sex-vaginal-penetration mod

---

**End of Specification**
