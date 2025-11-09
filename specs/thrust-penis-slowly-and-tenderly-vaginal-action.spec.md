# Specification: Thrust Penis Slowly and Tenderly (Vaginal) Action/Rule

**Mod**: `sex-vaginal-penetration`
**Created**: 2025-11-09
**Status**: Approved for Implementation

## Overview

This specification defines a new action/rule combination that allows an actor to thrust their penis slowly and tenderly inside a target's vagina during active vaginal penetration. This action represents a gentle, intimate continuation of existing vaginal sex, emphasizing sensuality and connection.

## Design Goals

1. **State Preservation**: Maintain existing penetration state (no component changes)
2. **Narrative Intimacy**: Emphasize slow, tender, sensual movement
3. **Scope Safety**: Only allow during active vaginal penetration by the acting actor
4. **Defensive Validation**: Verify prerequisites even when they should already be satisfied
5. **Narrative Consistency**: Match the descriptive style of existing vaginal penetration actions
6. **Test Coverage**: Comprehensive integration and discovery test suites

## Technical Requirements

### 1. Existing Scope (No New Scope Needed)

**Scope**: `sex-vaginal-penetration:actors_being_fucked_vaginally_by_me`

**File**: `data/mods/sex-vaginal-penetration/scopes/actors_being_fucked_vaginally_by_me.scope` (already exists)

**Purpose**: Filter closeness partners who have the `being_fucked_vaginally` component with the acting actor as the referenced penetrator.

**Scope DSL**:
```javascript
// Scope for partners currently being vaginally penetrated by the actor
// Ensures the target has being_fucked_vaginally component with matching actorId reference
sex-vaginal-penetration:actors_being_fucked_vaginally_by_me := actor.components.positioning:closeness.partners[][
  {
    "and": [
      {"!!": {"var": "entity.components.positioning:being_fucked_vaginally"}},
      {"==": [
        {"var": "entity.components.positioning:being_fucked_vaginally.actorId"},
        {"var": "actor.id"}
      ]}
    ]
  }
]
```

**Edge Cases Handled**:
- Prevents targeting partners who are being penetrated by someone else
- Ensures only active penetration targets are selectable
- Works correctly in group scenarios with multiple penetrations

### 2. Action Definition

**File**: `data/mods/sex-vaginal-penetration/actions/thrust_penis_slowly_and_tenderly.action.json`

**Schema Compliance**: `schema://living-narrative-engine/action.schema.json`

**Action Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-vaginal-penetration:thrust_penis_slowly_and_tenderly",
  "name": "Thrust Penis Slowly and Tenderly",
  "description": "Thrust your penis slowly and tenderly inside your partner's vagina, making them feel every inch and every vein.",
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
  "template": "thrust your penis inside {primary} slowly and tenderly",
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
  - `positioning:fucking_vaginally`: Must be actively penetrating (key state component for this action)

- **No Forbidden Components**: Not needed because the action requires `fucking_vaginally`, which prevents duplicate discovery with insertion actions

- **Prerequisites**: Defensive checks for uncovered penis, mirroring pull_penis_out_of_vagina pattern

- **Template**: Simple, direct language matching user specification: "thrust your penis inside {primary} slowly and tenderly"

- **Visual Styling**: Matches the existing mod color scheme for consistency (same palette as pull_penis_out_of_vagina)

### 3. Condition Definition

**File**: `data/mods/sex-vaginal-penetration/conditions/event-is-action-thrust-penis-slowly-and-tenderly.condition.json`

**Schema Compliance**: `schema://living-narrative-engine/condition.schema.json`

**Condition Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-vaginal-penetration:event-is-action-thrust-penis-slowly-and-tenderly",
  "description": "Checks if the event attempts the 'sex-vaginal-penetration:thrust_penis_slowly_and_tenderly' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex-vaginal-penetration:thrust_penis_slowly_and_tenderly"
    ]
  }
}
```

**Pattern**: Standard equality check following existing mod conventions.

### 4. Rule Definition

**File**: `data/mods/sex-vaginal-penetration/rules/handle_thrust_penis_slowly_and_tenderly.rule.json`

**Schema Compliance**: `schema://living-narrative-engine/rule.schema.json`

**Rule Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_thrust_penis_slowly_and_tenderly",
  "comment": "Handles the 'sex-vaginal-penetration:thrust_penis_slowly_and_tenderly' action by maintaining penetration state and narrating a slow, tender thrust.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex-vaginal-penetration:event-is-action-thrust-penis-slowly-and-tenderly"
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} thrusts slowly and tenderly inside {context.primaryName}'s vagina, making her feel every inch and every vein of the penis."
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

3. **No State Changes**:
   - Unlike pull_penis_out or insert actions, this action maintains existing penetration state
   - No ADD_COMPONENT or REMOVE_COMPONENT operations needed
   - The action represents a continuation of existing sexual activity

4. **Variable Setup** (SET_VARIABLE):
   - `logMessage`: Narrative description matching specification exactly
   - `perceptionType`: Event perception category
   - `actorId`, `locationId`, `targetId`: Required for macro

5. **Finalization** (macro):
   - Invoke `core:logSuccessAndEndTurn` to log the action and end turn

**Design Decisions**:

- **No Component Changes**: This action represents ongoing activity, not state transition
- **Narrative Message**: Matches user specification exactly: `"{actor} thrusts slowly and tenderly inside {primary}'s vagina, making her feel every inch and every vein of the penis."`
- **Perception Type**: Uses `action_target_general` for consistent event broadcasting
- **Macro Invocation**: Follows standard pattern for action finalization
- **Gender-Neutral Naming**: Action name is gender-neutral, but narrative uses "her" as specified by user

### 5. Mod Manifest Updates

**File**: `data/mods/sex-vaginal-penetration/mod-manifest.json`

**Required Changes**:

Add to the `content.actions` array:
```json
"thrust_penis_slowly_and_tenderly.action.json"
```

Add to the `content.conditions` array:
```json
"event-is-action-thrust-penis-slowly-and-tenderly.condition.json"
```

Add to the `content.rules` array:
```json
"handle_thrust_penis_slowly_and_tenderly.rule.json"
```

**Alphabetical Ordering**: Maintain alphabetical order within each array to match existing convention.

### 6. File Naming Conventions

**CRITICAL**: The mod uses different naming conventions for different file types:

| File Type | Convention | Example |
|-----------|------------|---------|
| Actions | `{action_name}.action.json` | `thrust_penis_slowly_and_tenderly.action.json` |
| Rules | `handle_{action_name}.rule.json` | `handle_thrust_penis_slowly_and_tenderly.rule.json` |
| Conditions | `event-is-action-{action-name}.condition.json` | `event-is-action-thrust-penis-slowly-and-tenderly.condition.json` |

**Note**: Conditions use **hyphens**, while actions/rules use **underscores**.

## Testing Requirements

### 1. Integration Test Suite (Rule Behavior)

**File**: `tests/integration/mods/sex-vaginal-penetration/thrust_penis_slowly_and_tenderly_action.test.js`

**Test Framework**: Jest with ModTestFixture pattern

**Required Test Cases**:

#### Test 1: Successful Execution
```javascript
it('performs the thrust action successfully', async () => {
  // Setup: Two actors with active vaginal penetration
  const scenario = buildPenetrationScenario();
  testFixture.reset(scenario);

  // Execute: Actor thrusts slowly and tenderly
  await testFixture.executeAction('alice', 'beth', {
    additionalPayload: { primaryId: 'beth' },
  });

  // Assert: Success message matches specification
  ModAssertionHelpers.assertActionSuccess(
    testFixture.events,
    "Alice thrusts slowly and tenderly inside Beth's vagina, making her feel every inch and every vein of the penis.",
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

#### Test 2: State Preservation (Components Unchanged)
```javascript
it('maintains penetration components without changes', async () => {
  // Setup: Actor has fucking_vaginally component, target has being_fucked_vaginally
  const scenario = buildPenetrationScenario();
  testFixture.reset(scenario);

  // Verify prerequisites
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

  // Execute: Thrust action
  await testFixture.executeAction('alice', 'beth', {
    additionalPayload: { primaryId: 'beth' },
  });

  // Assert: Components remain unchanged (state preserved)
  const finalActorComponent = testFixture.entityManager.getComponentData(
    'alice',
    'positioning:fucking_vaginally'
  );
  expect(finalActorComponent).toEqual({ targetId: 'beth' });

  const finalTargetComponent = testFixture.entityManager.getComponentData(
    'beth',
    'positioning:being_fucked_vaginally'
  );
  expect(finalTargetComponent).toEqual({ actorId: 'alice' });
});
```

**Validation**:
- Components exist before action
- Components remain unchanged after action
- State data matches exactly before and after

#### Test 3: Perceptible Event Validation
```javascript
it('dispatches perceptible event with correct payload', async () => {
  const scenario = buildPenetrationScenario();
  testFixture.reset(scenario);

  await testFixture.executeAction('alice', 'beth', {
    additionalPayload: { primaryId: 'beth' },
  });

  ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
    descriptionText: "Alice thrusts slowly and tenderly inside Beth's vagina, making her feel every inch and every vein of the penis.",
    locationId: 'bedroom',
    actorId: 'alice',
    targetId: 'beth',
    perceptionType: 'action_target_general',
  });
});
```

**Validation**:
- Event type is correct
- Perception type matches specification
- Entity IDs are correct
- Message is exact
- Location is correct

#### Test 4: Multiple Consecutive Thrusts
```javascript
it('allows multiple consecutive thrust actions without state corruption', async () => {
  const scenario = buildPenetrationScenario();
  testFixture.reset(scenario);

  // Execute thrust multiple times
  for (let i = 0; i < 3; i++) {
    testFixture.events.length = 0; // Clear events

    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: { primaryId: 'beth' },
    });

    // Verify each execution succeeds
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      "Alice thrusts slowly and tenderly inside Beth's vagina, making her feel every inch and every vein of the penis.",
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );

    // Verify state remains consistent
    const actorComponent = testFixture.entityManager.getComponentData(
      'alice',
      'positioning:fucking_vaginally'
    );
    expect(actorComponent).toEqual({ targetId: 'beth' });
  }
});
```

**Validation**:
- Action can be executed multiple times consecutively
- State remains consistent across executions
- No component corruption or leakage

#### Test 5: Turn Ending Behavior
```javascript
it('ends the turn after successful execution', async () => {
  const scenario = buildPenetrationScenario();
  testFixture.reset(scenario);

  await testFixture.executeAction('alice', 'beth', {
    additionalPayload: { primaryId: 'beth' },
  });

  const endTurnEvent = testFixture.events.find(
    (event) => event.type === 'core:turn_ended'
  );

  expect(endTurnEvent).toBeDefined();
  expect(endTurnEvent.payload.actorId).toBe('alice');
});
```

**Validation**:
- Turn ends after action execution
- Turn end event includes correct actor ID

**Shared Scenario Builder**:

**File**: `tests/common/mods/sex-vaginal-penetration/thrustPenisSlowlyAndTenderlyFixtures.js`

```javascript
/**
 * @file Shared fixtures for thrust_penis_slowly_and_tenderly action tests.
 * @description Provides reusable builders and helpers for slow, tender thrusting scenarios.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

export const ACTION_ID = 'sex-vaginal-penetration:thrust_penis_slowly_and_tenderly';
export const SCOPE_NAME = 'sex-vaginal-penetration:actors_being_fucked_vaginally_by_me';

/**
 * @typedef {object} PenetrationScenarioOptions
 * @property {boolean} [includeCloseness=true] - Whether partners are close
 * @property {boolean} [includePenetrationComponents=true] - Whether to add fucking/being_fucked components
 * @property {boolean} [includePenis=true] - Whether actor has penis
 * @property {boolean} [includeVagina=true] - Whether target has vagina
 * @property {boolean} [coverPenis=false] - Whether penis is covered
 * @property {string} [actorId='alice'] - Actor entity ID
 * @property {string} [targetId='beth'] - Target entity ID
 * @property {string} [roomId='bedroom'] - Room entity ID
 */

/**
 * Builds a penetration scenario with alice penetrating beth.
 * @param {PenetrationScenarioOptions} [options] - Scenario options
 * @returns {Array<object>} Array of entities
 */
export function buildPenetrationScenario(options = {}) {
  const {
    includeCloseness = true,
    includePenetrationComponents = true,
    includePenis = true,
    includeVagina = true,
    coverPenis = false,
    actorId = 'alice',
    targetId = 'beth',
    roomId = 'bedroom',
  } = options;

  const room = new ModEntityBuilder(roomId).asRoom('Bedroom').build();

  const actorBuilder = new ModEntityBuilder(actorId)
    .withName('Alice', 'Smith')
    .atLocation(roomId)
    .asActor();

  const targetBuilder = new ModEntityBuilder(targetId)
    .withName('Beth', 'Jones')
    .atLocation(roomId)
    .asActor();

  if (includeCloseness) {
    actorBuilder.closeToEntity(targetId);
    targetBuilder.closeToEntity(actorId);
  }

  if (includePenetrationComponents) {
    actorBuilder.withComponent('positioning:fucking_vaginally', {
      targetId: targetId,
    });
    targetBuilder.withComponent('positioning:being_fucked_vaginally', {
      actorId: actorId,
    });
  }

  const entities = [room, actorBuilder.build(), targetBuilder.build()];

  // Add anatomy parts if requested
  if (includePenis) {
    const actorGroinId = `${actorId}Groin`;
    const actorPenisId = `${actorId}Penis`;

    actorBuilder.withBody(actorGroinId);

    const actorGroin = new ModEntityBuilder(actorGroinId)
      .asBodyPart({ parent: null, children: [actorPenisId], subType: 'groin' })
      .build();

    const actorPenis = new ModEntityBuilder(actorPenisId)
      .asBodyPart({ parent: actorGroinId, children: [], subType: 'penis' })
      .build();

    entities.push(actorGroin, actorPenis);
  }

  if (includeVagina) {
    const targetPelvisId = `${targetId}Pelvis`;
    const targetVaginaId = `${targetId}Vagina`;

    targetBuilder.withBody(targetPelvisId);

    const targetPelvis = new ModEntityBuilder(targetPelvisId)
      .asBodyPart({ parent: null, children: [targetVaginaId], subType: 'pelvis' })
      .build();

    const targetVagina = new ModEntityBuilder(targetVaginaId)
      .asBodyPart({ parent: targetPelvisId, children: [], subType: 'vagina' })
      .build();

    entities.push(targetPelvis, targetVagina);
  }

  if (coverPenis && includePenis) {
    actorBuilder
      .withComponent('clothing:equipment', {
        equipped: { torso_lower: { base: [`${actorId}_underwear`] } },
      })
      .withComponent('clothing:slot_metadata', {
        slotMappings: {
          torso_lower: { coveredSockets: ['penis'] },
        },
      });
  }

  // Rebuild actor and target with updated components
  entities[1] = actorBuilder.build();
  entities[2] = targetBuilder.build();

  return entities;
}
```

### 2. Discovery Test Suite (Action Discoverability)

**File**: `tests/integration/mods/sex-vaginal-penetration/thrust_penis_slowly_and_tenderly_action_discovery.test.js`

**Test Framework**: Jest with ModTestFixture

**Required Test Cases**:

#### Test 1: Action Appears During Penetration
```javascript
it('appears when actor is actively penetrating the target', async () => {
  const scenario = buildPenetrationScenario();
  testFixture.reset(scenario);
  configureActionDiscovery();

  const actions = await testFixture.discoverActions('alice');
  const foundAction = actions.find((action) => action.id === ACTION_ID);

  expect(foundAction).toBeDefined();
});
```

**Validation**:
- Action is discovered when in active penetration state
- Target list includes the penetrated partner
- Action metadata is complete

#### Test 2: Action Doesn't Appear Without Penetration
```javascript
it('does not appear when actor is not penetrating anyone', async () => {
  const scenario = buildPenetrationScenario({ includePenetrationComponents: false });
  testFixture.reset(scenario);
  configureActionDiscovery();

  const actions = await testFixture.discoverActions('alice');
  const foundAction = actions.find((action) => action.id === ACTION_ID);

  expect(foundAction).toBeUndefined();
});
```

**Validation**:
- Action is not discovered without penetration state
- Required component check prevents discovery

#### Test 3: Action Doesn't Appear Without Closeness
```javascript
it('does not appear without closeness', async () => {
  const scenario = buildPenetrationScenario({ includeCloseness: false });
  testFixture.reset(scenario);
  configureActionDiscovery();

  const actions = await testFixture.discoverActions('alice');
  const foundAction = actions.find((action) => action.id === ACTION_ID);

  expect(foundAction).toBeUndefined();
});
```

**Validation**:
- Closeness is required for discovery
- Required components check works correctly

#### Test 4: Action Doesn't Appear When Actor Lacks Penis
```javascript
it('does not appear when actor lacks penis', async () => {
  const scenario = buildPenetrationScenario({ includePenis: false });
  testFixture.reset(scenario);
  configureActionDiscovery();

  const actions = await testFixture.discoverActions('alice');
  const foundAction = actions.find((action) => action.id === ACTION_ID);

  expect(foundAction).toBeUndefined();
});
```

**Validation**:
- Prerequisites check prevents discovery without penis
- Anatomy validation works correctly

#### Test 5: Action Doesn't Appear When Penis Is Covered
```javascript
it('does not appear when penis is covered', async () => {
  const scenario = buildPenetrationScenario({ coverPenis: true });
  testFixture.reset(scenario);
  configureActionDiscovery();

  const actions = await testFixture.discoverActions('alice');
  const foundAction = actions.find((action) => action.id === ACTION_ID);

  expect(foundAction).toBeUndefined();
});
```

**Validation**:
- Covered penis prevents discovery
- Socket coverage prerequisite check works

#### Test 6: Multiple Partners Scenario (Only Penetrated Partner Shows)
```javascript
it('only targets the entity being penetrated by the actor', async () => {
  // Scenario: Alice penetrating Beth, close to Carol (not penetrating)
  const room = new ModEntityBuilder('bedroom').asRoom('Bedroom').build();

  const alice = new ModEntityBuilder('alice')
    .withName('Alice', 'Smith')
    .atLocation('bedroom')
    .withBody('aliceGroin')
    .closeToEntity('beth')
    .closeToEntity('carol')
    .withComponent('positioning:fucking_vaginally', { targetId: 'beth' })
    .asActor()
    .build();

  const beth = new ModEntityBuilder('beth')
    .withName('Beth', 'Jones')
    .atLocation('bedroom')
    .withBody('bethPelvis')
    .closeToEntity('alice')
    .withComponent('positioning:being_fucked_vaginally', { actorId: 'alice' })
    .asActor()
    .build();

  const carol = new ModEntityBuilder('carol')
    .withName('Carol', 'Davis')
    .atLocation('bedroom')
    .closeToEntity('alice')
    .asActor()
    .build();

  // Add anatomy for Alice and Beth (similar to buildPenetrationScenario)
  const aliceGroin = new ModEntityBuilder('aliceGroin')
    .asBodyPart({ parent: null, children: ['alicePenis'], subType: 'groin' })
    .build();

  const alicePenis = new ModEntityBuilder('alicePenis')
    .asBodyPart({ parent: 'aliceGroin', children: [], subType: 'penis' })
    .build();

  const bethPelvis = new ModEntityBuilder('bethPelvis')
    .asBodyPart({ parent: null, children: ['bethVagina'], subType: 'pelvis' })
    .build();

  const bethVagina = new ModEntityBuilder('bethVagina')
    .asBodyPart({ parent: 'bethPelvis', children: [], subType: 'vagina' })
    .build();

  const scenario = [room, alice, beth, carol, aliceGroin, alicePenis, bethPelvis, bethVagina];
  testFixture.reset(scenario);
  configureActionDiscovery();

  const actions = await testFixture.discoverActions('alice');
  const foundAction = actions.find((action) => action.id === ACTION_ID);

  expect(foundAction).toBeDefined();
  // The specific target assertion depends on how the test framework returns targets
  // Adjust based on actual ModTestFixture API
});
```

**Validation**:
- Scope correctly filters by actorId reference
- Only the actively penetrated entity is included
- Close but non-penetrated partners are excluded

**Test Suite Structure**:
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import {
  buildPenetrationScenario,
  ACTION_ID,
} from '../../../common/mods/sex-vaginal-penetration/thrustPenisSlowlyAndTenderlyFixtures.js';
import thrustPenisSlowlyAndTenderlyAction from '../../../../data/mods/sex-vaginal-penetration/actions/thrust_penis_slowly_and_tenderly.action.json' assert { type: 'json' };

describe('sex-vaginal-penetration:thrust_penis_slowly_and_tenderly - Action Discovery', () => {
  let testFixture;

  function configureActionDiscovery() {
    testFixture.testEnv.actionIndex.buildIndex([thrustPenisSlowlyAndTenderlyAction]);
  }

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-vaginal-penetration',
      ACTION_ID
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  // Test cases here...
});
```

### Test Helpers & Utilities

**Import Statements** (for integration tests):
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import '../../../common/mods/domainMatchers.js';
```

**Test Organization**:
```
tests/integration/mods/sex-vaginal-penetration/
├── thrust_penis_slowly_and_tenderly_action.test.js (Rule behavior tests)
└── thrust_penis_slowly_and_tenderly_action_discovery.test.js (Discovery tests)

tests/common/mods/sex-vaginal-penetration/
└── thrustPenisSlowlyAndTenderlyFixtures.js (Shared scenario builders)
```

## Validation Checklist

Before considering the implementation complete, verify:

### Schema Validation
- [ ] All JSON files validate against their schemas
- [ ] Action ID matches condition reference exactly
- [ ] Component types are correctly namespaced
- [ ] Scope name is correctly referenced in action

### File Naming
- [ ] Action file uses underscores: `thrust_penis_slowly_and_tenderly.action.json`
- [ ] Rule file uses underscores: `handle_thrust_penis_slowly_and_tenderly.rule.json`
- [ ] Condition file uses hyphens: `event-is-action-thrust-penis-slowly-and-tenderly.condition.json`
- [ ] Manifest updated with all three files

### Functional Requirements
- [ ] Scope correctly filters by actorId reference (uses existing scope)
- [ ] Action requires both closeness and fucking_vaginally components
- [ ] Rule maintains penetration state (no component changes)
- [ ] Perceptible event message matches specification exactly
- [ ] Visual styling matches mod color scheme

### Test Coverage
- [ ] Integration test: Successful execution
- [ ] Integration test: State preservation (components unchanged)
- [ ] Integration test: Perceptible event payload
- [ ] Integration test: Multiple consecutive thrusts
- [ ] Integration test: Turn ending behavior
- [ ] Discovery test: Action appears during penetration
- [ ] Discovery test: Action doesn't appear without state
- [ ] Discovery test: Action doesn't appear without closeness
- [ ] Discovery test: Action doesn't appear without penis
- [ ] Discovery test: Action doesn't appear with covered penis
- [ ] Discovery test: Multiple partners scenario

### Code Quality
- [ ] All tests pass: `npm run test:integration`
- [ ] Schema validation passes: `npm run validate`
- [ ] Scope DSL linting passes: `npm run scope:lint`
- [ ] No ESLint errors: `npx eslint <modified-files>`
- [ ] Test coverage meets thresholds (80%+ branches)

## Implementation Order

Follow this order to minimize circular dependencies:

1. **Condition Definition** (`event-is-action-thrust-penis-slowly-and-tenderly.condition.json`)
   - Simple file, no dependencies
   - Required by rule

2. **Action Definition** (`thrust_penis_slowly_and_tenderly.action.json`)
   - References existing scope (no new scope needed)
   - Required for rule testing

3. **Rule Definition** (`handle_thrust_penis_slowly_and_tenderly.rule.json`)
   - References condition
   - References action indirectly
   - Core logic implementation

4. **Manifest Updates** (`mod-manifest.json`)
   - Add all three files to appropriate arrays
   - Maintain alphabetical ordering

5. **Test Fixtures** (`thrustPenisSlowlyAndTenderlyFixtures.js`)
   - Shared scenario builders
   - Can leverage existing fixture patterns

6. **Integration Tests** (`thrust_penis_slowly_and_tenderly_action.test.js`)
   - Tests rule behavior
   - Validates state preservation
   - Validates narrative output

7. **Discovery Tests** (`thrust_penis_slowly_and_tenderly_action_discovery.test.js`)
   - Tests action discovery
   - Validates scope resolution
   - Validates prerequisites

## Edge Cases & Considerations

### Edge Case 1: Covered Penis During Penetration
**Scenario**: Penis becomes covered during penetration (shouldn't happen normally)

**Handling**: Prerequisites check for uncovered penis, action execution fails gracefully

**Test**: Prerequisites validation test in discovery suite (Test 5)

### Edge Case 2: Multiple Simultaneous Penetrations
**Scenario**: Actor is close to multiple partners, penetrating only one

**Handling**: Scope filters by exact actorId match, only returns the specific target

**Test**: Multiple partners test in discovery suite (Test 6)

### Edge Case 3: State Corruption from Repeated Actions
**Scenario**: Multiple consecutive thrusts could potentially corrupt state

**Handling**: No state changes means no opportunity for corruption; components remain stable

**Test**: Multiple consecutive thrusts test in integration suite (Test 4)

### Edge Case 4: Action Execution After Pullout
**Scenario**: Actor attempts to thrust after pulling out

**Handling**: Required components check prevents discovery; scope returns empty set

**Test**: Action doesn't appear without penetration test (Discovery Test 2)

### Edge Case 5: Group Sex Scenarios
**Scenario**: Multiple actors penetrating multiple targets in same location

**Handling**: Each actor's scope resolver independently filters their specific target(s)

**Test**: Multiple partners scenario (Discovery Test 6)

## References

### Existing Implementations
- **Reference Action (State-Preserving)**: `ride_penis_greedily.action.json` (maintains penetration state)
- **Reference Action (State-Changing)**: `pull_penis_out_of_vagina.action.json` (removes state)
- **Reference Rule**: `handle_ride_penis_greedily.rule.json` (component reinforcement pattern)
- **Reference Scope**: `actors_being_fucked_vaginally_by_me.scope` (filtering pattern)

### Documentation
- **Mod Testing Guide**: `docs/testing/mod-testing-guide.md`
- **Action Schema**: `data/schemas/action.schema.json`
- **Rule Schema**: `data/schemas/rule.schema.json`
- **Condition Schema**: `data/schemas/condition.schema.json`
- **Scope DSL Guide**: Project CLAUDE.md (Scope DSL Syntax section)

### Test Patterns
- **Integration Tests**: `tests/integration/mods/sex-vaginal-penetration/pull_penis_out_of_vagina_action.test.js`
- **Discovery Tests**: `tests/integration/mods/sex-vaginal-penetration/pull_penis_out_of_vagina_action_discovery.test.js`
- **Test Helpers**: `tests/common/mods/ModTestFixture.js`, `tests/common/mods/ModAssertionHelpers.js`
- **Fixtures**: `tests/common/mods/sex-vaginal-penetration/pullPenisOutOfVaginaFixtures.js`

## Success Criteria

Implementation is complete when:

1. ✅ All 4 files created/updated (3 new files + 1 manifest update)
2. ✅ Schema validation passes for all JSON files
3. ✅ All 11 test cases pass (5 integration + 6 discovery)
4. ✅ Test coverage meets 80%+ threshold
5. ✅ ESLint validation passes on all modified files
6. ✅ Scope DSL linting passes
7. ✅ Perceptible event message matches specification exactly
8. ✅ Component state is preserved (no changes)
9. ✅ Action is discoverable only when in active penetration state
10. ✅ Manual testing confirms expected behavior
11. ✅ Action can be executed multiple times consecutively without issues

## Key Differences from Pull-Out Action

This action differs from `pull_penis_out_of_vagina` in critical ways:

| Aspect | Pull Out | Thrust Slowly |
|--------|----------|---------------|
| **Purpose** | End penetration | Continue penetration |
| **State Change** | Removes components | Maintains components |
| **Narrative Focus** | Withdrawal | Ongoing intimacy |
| **Component Operations** | REMOVE_COMPONENT × 2 | None (state-preserving) |
| **Repeatability** | One-time ending | Multiple consecutive uses |
| **Similar To** | `insert_penis_into_vagina` (state transition) | `ride_penis_greedily` (ongoing action) |

## Notes

- This action is **state-preserving**, maintaining existing penetration rather than changing it
- The scope is **reused** from existing actions (`actors_being_fucked_vaginally_by_me`)
- Prerequisites are **defensive** - they validate conditions that should already be true
- The narrative message includes **detailed sensory description** ("every inch and every vein")
- Test suite is **comprehensive** to ensure state stability across multiple executions
- Implementation follows **existing patterns** from the sex-vaginal-penetration mod
- The action uses **gender-specific language** in the narrative ("her") as specified by user
- Rule is **simpler** than state-changing actions (no component manipulation)

---

**End of Specification**
