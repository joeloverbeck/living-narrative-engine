# Specification: Take Penis In Mouth (Lying Close) Action Implementation

## Overview

This specification defines the implementation requirements for a new action/rule combination that allows characters to take their partner's penis in their mouth while both are lying down in close proximity, initiating oral sex. This action extends the existing take_penis_in_mouth mechanics to support lying positions, complementing the existing sitting and kneeling variants.

**Content Type**: Mature - Sexual Content

## Reference Actions

This implementation should follow established patterns from:
- **`lick_glans_lying_close.action.json`** - Template for lying-down close proximity penis actions
- **`take_penis_in_mouth_kneeling.action.json`** - Template for taking penis in mouth while kneeling
- **`take_penis_in_mouth.action.json`** - Template for taking penis in mouth while sitting close
- **`sex-core:actors_lying_close_with_uncovered_penis.scope`** - Scope for lying-down with penis exposure checks
- **`handle_take_penis_in_mouth_kneeling.rule.json`** - Pattern for blowjob component management

## Implementation Files

### 1. Action Definition

**File**: `data/mods/sex-penile-oral/actions/take_penis_in_mouth_lying_close.action.json`

**Schema**: `schema://living-narrative-engine/action.schema.json`

**Action ID**: `sex-penile-oral:take_penis_in_mouth_lying_close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-penile-oral:take_penis_in_mouth_lying_close",
  "name": "Take Penis In Mouth (Lying Close)",
  "description": "Take your partner's penis in your mouth while both are lying close together, initiating oral sex. Requires both participants to be lying down with mutual closeness. The partner must have an exposed penis.",
  "targets": {
    "primary": {
      "scope": "sex-core:actors_lying_close_with_uncovered_penis",
      "placeholder": "primary",
      "description": "Partner lying close with an exposed penis"
    }
  },
  "template": "take {primary}'s cock in your mouth",
  "prerequisites": [],
  "required_components": {
    "actor": ["positioning:lying_down", "positioning:closeness"],
    "primary": ["positioning:lying_down", "positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["positioning:giving_blowjob"]
  },
  "visual": {
    "backgroundColor": "#2a1a5e",
    "textColor": "#ede7f6",
    "hoverBackgroundColor": "#372483",
    "hoverTextColor": "#ffffff"
  }
}
```

**Key Requirements**:
- Both actor and primary must have `positioning:lying_down` component
- Both actor and primary must have `positioning:closeness` component with mutual partner references
- Actor must NOT have `positioning:giving_blowjob` component (prevents conflicting states)
- Primary must have an uncovered penis (validated by scope)
- Uses `primary` as the placeholder (following pattern from other penile-oral actions)
- Visual properties match sex-penile-oral mod standards (purple theme)

**Manifest Update**: Add action file to `data/mods/sex-penile-oral/mod-manifest.json`:
```json
{
  "actions": [
    "actions/take_penis_in_mouth_lying_close.action.json"
  ]
}
```

### 2. Condition File

**File**: `data/mods/sex-penile-oral/conditions/event-is-action-take-penis-in-mouth-lying-close.condition.json`

**Critical**: Use hyphens in filename, even though action uses underscores

**Schema**: `schema://living-narrative-engine/condition.schema.json`

**Condition ID**: `sex-penile-oral:event-is-action-take-penis-in-mouth-lying-close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-penile-oral:event-is-action-take-penis-in-mouth-lying-close",
  "description": "Checks if the triggering event is for the 'sex-penile-oral:take_penis_in_mouth_lying_close' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex-penile-oral:take_penis_in_mouth_lying_close"
    ]
  }
}
```

**Key Requirements**:
- Filename uses hyphens (convention for condition files)
- Action ID in logic uses underscores (matches action definition)
- Standard event-matching pattern

**Manifest Update**: Add condition file to `data/mods/sex-penile-oral/mod-manifest.json`:
```json
{
  "conditions": [
    "conditions/event-is-action-take-penis-in-mouth-lying-close.condition.json"
  ]
}
```

### 3. Rule Definition

**File**: `data/mods/sex-penile-oral/rules/handle_take_penis_in_mouth_lying_close.rule.json`

**Schema**: `schema://living-narrative-engine/rule.schema.json`

**Rule ID**: `sex-penile-oral:handle_take_penis_in_mouth_lying_close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "sex-penile-oral:handle_take_penis_in_mouth_lying_close",
  "comment": "Handles the 'sex-penile-oral:take_penis_in_mouth_lying_close' action. Cleans up existing blowjob state, adds reciprocal giving/receiving components, dispatches descriptive text, regenerates descriptions, and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "sex-penile-oral:event-is-action-take-penis-in-mouth-lying-close" },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "primary", "result_variable": "primaryName" }
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
      "type": "QUERY_COMPONENTS",
      "parameters": {
        "entity_ref": "actor",
        "pairs": [
          {
            "component_type": "positioning:giving_blowjob",
            "result_variable": "actorExistingGivingBlowjobComponent"
          },
          {
            "component_type": "positioning:receiving_blowjob",
            "result_variable": "actorExistingReceivingBlowjobComponent"
          }
        ]
      }
    },
    {
      "type": "QUERY_COMPONENTS",
      "parameters": {
        "entity_ref": "primary",
        "pairs": [
          {
            "component_type": "positioning:giving_blowjob",
            "result_variable": "primaryExistingGivingBlowjobComponent"
          },
          {
            "component_type": "positioning:receiving_blowjob",
            "result_variable": "primaryExistingReceivingBlowjobComponent"
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": { "var": "context.actorExistingGivingBlowjobComponent" },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "{context.actorExistingGivingBlowjobComponent.receiving_entity_id}",
              "component_type": "positioning:receiving_blowjob"
            }
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": { "var": "context.actorExistingReceivingBlowjobComponent" },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "{context.actorExistingReceivingBlowjobComponent.giving_entity_id}",
              "component_type": "positioning:giving_blowjob"
            }
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": { "var": "context.primaryExistingGivingBlowjobComponent" },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "{context.primaryExistingGivingBlowjobComponent.receiving_entity_id}",
              "component_type": "positioning:receiving_blowjob"
            }
          }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": { "var": "context.primaryExistingReceivingBlowjobComponent" },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "{context.primaryExistingReceivingBlowjobComponent.giving_entity_id}",
              "component_type": "positioning:giving_blowjob"
            }
          }
        ]
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:giving_blowjob"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:receiving_blowjob"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "primary",
        "component_type": "positioning:giving_blowjob"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "primary",
        "component_type": "positioning:receiving_blowjob"
      }
    },
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:giving_blowjob",
        "value": {
          "receiving_entity_id": "{event.payload.primaryId}",
          "initiated": true
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "primary",
        "component_type": "positioning:receiving_blowjob",
        "value": {
          "giving_entity_id": "{event.payload.actorId}",
          "consented": true
        }
      }
    },
    {
      "type": "REGENERATE_DESCRIPTION",
      "parameters": { "entity_ref": "actor" }
    },
    {
      "type": "REGENERATE_DESCRIPTION",
      "parameters": { "entity_ref": "primary" }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} takes {context.primaryName}'s cock in the mouth, bathing it in hot saliva."
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
        "variable_name": "actorId",
        "value": "{event.payload.actorId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.primaryId}"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**Key Requirements**:
- Uses `primary` entity reference and stores in `primaryName` variable
- Message: `"{context.actorName} takes {context.primaryName}'s cock in the mouth, bathing it in hot saliva."`
- Perception type: `action_target_general`
- **Cleanup existing blowjob states**: Queries both actor and primary for existing giving_blowjob and receiving_blowjob components, removes them from both entities and their partners
- **Add new blowjob components**: Adds giving_blowjob to actor with receiving_entity_id set to primary, adds receiving_blowjob to primary with giving_entity_id set to actor
- **Regenerate descriptions**: Calls REGENERATE_DESCRIPTION for both actor and primary to update their descriptions with the new activity
- Standard operation sequence: GET_NAME (actor, primary), QUERY_COMPONENT (actor position), QUERY_COMPONENTS (existing blowjob states), cleanup IF blocks, REMOVE_COMPONENT operations, ADD_COMPONENT operations, REGENERATE_DESCRIPTION operations, SET_VARIABLE (all needed variables), macro (logSuccessAndEndTurn)
- `targetId` set to `{event.payload.primaryId}` (matches the primary target reference)

**Message Rationale**:
- "{actor} takes {primary}'s cock in the mouth" - establishes the core action of initiating oral sex
- "bathing it in hot saliva" - adds sensory detail specific to this action
- Follows user's exact specification for the message format

**Manifest Update**: Add rule file to `data/mods/sex-penile-oral/mod-manifest.json`:
```json
{
  "rules": [
    "rules/handle_take_penis_in_mouth_lying_close.rule.json"
  ]
}
```

## Test Suite Specifications

### Test File 1: Test Fixtures

**File**: `tests/common/mods/sex-penile-oral/takePenisInMouthLyingCloseFixtures.js`

**Purpose**: Provide reusable scenario builders and scope override functions for testing

**Note**: This implementation reuses the `lickGlansLyingCloseFixtures.js` file, as both actions share identical scope requirements and test scenarios. The fixture function names remain generic (e.g., `buildLickGlansLyingCloseScenario`) and are suitable for testing both lick_glans and take_penis_in_mouth actions.

**Reuse Strategy**:
```javascript
// Import existing fixtures from lick glans lying close
import {
  buildLickGlansLyingCloseScenario,
  installLyingCloseUncoveredPenisScopeOverride,
} from './lickGlansLyingCloseFixtures.js';

// These fixtures support all lying-close penis actions:
// - Both actions require same positioning (lying_down, closeness)
// - Both actions use same scope (actors_lying_close_with_uncovered_penis)
// - Both actions have same forbidden components (giving_blowjob)
// - Scenario builder options work for both actions
```

**Shared Fixture Capabilities**:
- Default scenario: Valid state with all preconditions met
- Options for negative test scenarios (toggle each precondition)
- Scope override implements same logic as actual scope file
- Includes test for `fucking_vaginally` constraint
- Cleanup function for proper test teardown

### Test File 2: Action Discovery Tests

**File**: `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_lying_close_action_discovery.test.js`

**Purpose**: Verify the action appears in the discovery system only when all preconditions are met

**Test Structure**:
```javascript
/**
 * @file Integration tests for sex-penile-oral:take_penis_in_mouth_lying_close action discovery.
 * @description Ensures the lying-down take_penis_in_mouth action only appears when both partners are lying close with an uncovered penis.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildLickGlansLyingCloseScenario,
  installLyingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex-penile-oral/lickGlansLyingCloseFixtures.js';
import takePenisInMouthLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/take_penis_in_mouth_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:take_penis_in_mouth_lying_close';

/**
 * Configures action discovery for test scenarios.
 *
 * @param {import('../../../common/mods/ModTestFixture.js').ModTestFixture} fixture - Test fixture instance
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([takePenisInMouthLyingCloseAction]);
}

describe('sex-penile-oral:take_penis_in_mouth_lying_close action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installLyingCloseUncoveredPenisScopeOverride(testFixture);
  });

  afterEach(() => {
    if (restoreScopeResolver) {
      restoreScopeResolver();
      restoreScopeResolver = null;
    }
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  // Positive test case
  it('appears when both participants are lying close with uncovered penis', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("take {primary}'s cock in your mouth");
  });

  // Negative test cases
  it('does NOT appear when primary penis is covered', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      coverPrimaryPenis: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when actor is not lying down', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      includeActorLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when primary is not lying down', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      includePrimaryLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when mutual closeness is not established', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when participants are on different furniture', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      useDifferentFurniture: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when actor has giving_blowjob component', async () => {
    const { entities, actorId } = buildLickGlansLyingCloseScenario({
      actorGivingBlowjob: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
```

**Required Test Cases**:
1. ✅ **Positive**: Action appears when all preconditions met (penis uncovered)
2. ❌ **Penis covered**: Action blocked when primary penis is covered
3. ❌ **Actor not lying**: Action blocked when actor lacks lying_down component
4. ❌ **Primary not lying**: Action blocked when primary lacks lying_down component
5. ❌ **No closeness**: Action blocked when mutual closeness not established
6. ❌ **Different furniture**: Action blocked when on different furniture pieces
7. ❌ **Forbidden component**: Action blocked when actor has giving_blowjob component

### Test File 3: Action Execution Tests

**File**: `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_lying_close_action.test.js`

**Purpose**: Verify the rule executes correctly, dispatches proper events, adds/removes components correctly, regenerates descriptions, and produces expected narrative output

**Test Structure**:
```javascript
/**
 * @file Integration tests for sex-penile-oral:take_penis_in_mouth_lying_close action execution.
 * @description Validates rule execution produces correct narrative output, events, and component changes.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildLickGlansLyingCloseScenario,
  installLyingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex-penile-oral/lickGlansLyingCloseFixtures.js';
import takePenisInMouthLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/take_penis_in_mouth_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:take_penis_in_mouth_lying_close';
const EXPECTED_MESSAGE =
  "Ava takes Nolan's cock in the mouth, bathing it in hot saliva.";

/**
 * Configures action discovery for test scenarios.
 *
 * @param {import('../../../common/mods/ModTestFixture.js').ModTestFixture} fixture - Test fixture instance
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([takePenisInMouthLyingCloseAction]);
}

describe('sex-penile-oral:take_penis_in_mouth_lying_close action execution', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-penile-oral',
      ACTION_ID
    );
    restoreScopeResolver =
      installLyingCloseUncoveredPenisScopeOverride(testFixture);
  });

  afterEach(() => {
    if (restoreScopeResolver) {
      restoreScopeResolver();
      restoreScopeResolver = null;
    }
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('successfully executes lying-down take penis in mouth action', async () => {
    expect.hasAssertions();
    const { entities, actorId, primaryId, roomId } =
      buildLickGlansLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      EXPECTED_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: roomId,
      actorId,
      targetId: primaryId,
      perceptionType: 'action_target_general',
    });
  });

  it('adds giving_blowjob component to actor with correct data', async () => {
    const { entities, actorId, primaryId } =
      buildLickGlansLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const actorEntity = testFixture.entityManager.getEntity(actorId);
    const givingBlowjobComponent = actorEntity.components['positioning:giving_blowjob'];

    expect(givingBlowjobComponent).toBeDefined();
    expect(givingBlowjobComponent.receiving_entity_id).toBe(primaryId);
    expect(givingBlowjobComponent.initiated).toBe(true);
  });

  it('adds receiving_blowjob component to primary with correct data', async () => {
    const { entities, actorId, primaryId } =
      buildLickGlansLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const primaryEntity = testFixture.entityManager.getEntity(primaryId);
    const receivingBlowjobComponent = primaryEntity.components['positioning:receiving_blowjob'];

    expect(receivingBlowjobComponent).toBeDefined();
    expect(receivingBlowjobComponent.giving_entity_id).toBe(actorId);
    expect(receivingBlowjobComponent.consented).toBe(true);
  });

  it('dispatches description regeneration events for both participants', async () => {
    const { entities, actorId, primaryId } =
      buildLickGlansLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const descriptionRegenerationEvents = testFixture.events.filter(
      (e) => e.type === 'core:description_regeneration_requested'
    );

    expect(descriptionRegenerationEvents.length).toBeGreaterThanOrEqual(2);

    const actorRegenEvent = descriptionRegenerationEvents.find(
      (e) => e.payload.entityId === actorId
    );
    const primaryRegenEvent = descriptionRegenerationEvents.find(
      (e) => e.payload.entityId === primaryId
    );

    expect(actorRegenEvent).toBeDefined();
    expect(primaryRegenEvent).toBeDefined();
  });
});
```

**Required Test Cases**:
1. ✅ **Success message**: Verifies correct narrative message dispatched
2. ✅ **Perceptible event**: Verifies perceptible event with correct structure
3. ✅ **Turn ended**: Verifies turn_ended event dispatched (via ModAssertionHelpers)
4. ✅ **Entity references**: Verifies correct actorId, targetId, locationId in events (via ModAssertionHelpers)
5. ✅ **Component addition - actor**: Verifies giving_blowjob component added to actor with correct data
6. ✅ **Component addition - primary**: Verifies receiving_blowjob component added to primary with correct data
7. ✅ **Description regeneration**: Verifies description_regeneration_requested events dispatched for both entities

## Implementation Checklist

### Phase 1: File Creation (Order Matters)

- [ ] **Step 1**: Verify scope file exists
  - Location: `data/mods/sex-core/scopes/actors_lying_close_with_uncovered_penis.scope`
  - This scope should already exist and is shared with lick_glans_lying_close
  - No changes required

- [ ] **Step 2**: Create condition file `event-is-action-take-penis-in-mouth-lying-close.condition.json`
  - ⚠️ Critical: Use hyphens in filename
  - Validate: Action ID in logic uses underscores
  - Update `sex-penile-oral` mod manifest

- [ ] **Step 3**: Create action file `take_penis_in_mouth_lying_close.action.json`
  - Validate: All component namespaces correct
  - Validate: Scope reference matches existing scope file
  - Validate: Uses `primary` placeholder
  - Validate: Visual properties match mod standards
  - Update `sex-penile-oral` mod manifest

- [ ] **Step 4**: Create rule file `handle_take_penis_in_mouth_lying_close.rule.json`
  - Validate: Condition reference uses hyphens
  - Validate: Uses `primary` entity reference and stores in `primaryName`
  - Validate: Message matches exactly: "{context.actorName} takes {context.primaryName}'s cock in the mouth, bathing it in hot saliva."
  - Validate: Includes blowjob component cleanup logic
  - Validate: Adds giving_blowjob to actor, receiving_blowjob to primary
  - Validate: Includes REGENERATE_DESCRIPTION for both entities
  - Update `sex-penile-oral` mod manifest

### Phase 2: Test Infrastructure

- [ ] **Step 5**: Verify fixture file exists
  - Location: `tests/common/mods/sex-penile-oral/lickGlansLyingCloseFixtures.js`
  - This fixture should already exist from lick_glans_lying_close implementation
  - Supports all required test scenarios
  - No changes required - reuse existing fixtures

- [ ] **Step 6**: Create action discovery test file
  - Location: `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_lying_close_action_discovery.test.js`
  - Import fixture functions from lickGlansLyingCloseFixtures.js
  - Implement 7 test cases (1 positive, 6 negative)
  - Verify cleanup in afterEach

- [ ] **Step 7**: Create action execution test file
  - Location: `tests/integration/mods/sex-penile-oral/take_penis_in_mouth_lying_close_action.test.js`
  - Import ModAssertionHelpers
  - Implement 4 test cases (success message, component additions, description regeneration)
  - Verify cleanup in afterEach

### Phase 3: Validation

- [ ] **Step 8**: Run schema validation
  ```bash
  npm run validate
  ```
  - Verifies all JSON files are valid
  - Checks schema references resolve
  - Validates component namespacing

- [ ] **Step 9**: Run linting
  ```bash
  npx eslint tests/integration/mods/sex-penile-oral/take_penis_in_mouth_lying_close_*.test.js
  ```
  - Fixes code style issues
  - Ensures test file conventions

- [ ] **Step 10**: Run tests
  ```bash
  NODE_ENV=test npm run test:integration -- tests/integration/mods/sex-penile-oral/take_penis_in_mouth_lying_close_action_discovery.test.js --no-coverage --silent
  NODE_ENV=test npm run test:integration -- tests/integration/mods/sex-penile-oral/take_penis_in_mouth_lying_close_action.test.js --no-coverage --silent
  ```
  - Verifies all test cases pass
  - Checks coverage meets requirements

### Phase 4: Final Verification

- [ ] **Step 11**: Verify naming conventions
  - Action file: underscores ✅
  - Rule file: underscores ✅
  - Condition file: hyphens ✅
  - Test files: underscores ✅
  - Fixture file: camelCase (reused from existing) ✅

- [ ] **Step 12**: Verify ID consistency
  - Action ID same across action, rule, tests
  - Condition ID uses hyphens in file reference
  - Scope reference matches existing scope file
  - Placeholder uses `primary` consistently

- [ ] **Step 13**: Visual consistency check
  - Colors match other sex-penile-oral actions
  - Template format matches existing patterns
  - Message style consistent with mod voice

## Common Pitfalls & Solutions

### Pitfall 1: Filename Convention Mismatch
**Problem**: Using underscores in condition filename
**Solution**: Always use hyphens for condition files, even when action uses underscores
**Example**: ❌ `event-is-action-take_penis_in_mouth_lying_close.condition.json` → ✅ `event-is-action-take-penis-in-mouth-lying-close.condition.json`

### Pitfall 2: Placeholder Consistency
**Problem**: Mixing `target` and `primary` placeholders
**Solution**: This action uses `primary` placeholder consistently (following other take_penis_in_mouth actions)
**Example**:
- Action template: `take {primary}'s cock in your mouth`
- Rule GET_NAME: `entity_ref: "primary", result_variable: "primaryName"`
- Rule SET_VARIABLE for targetId: `{event.payload.primaryId}`

### Pitfall 3: Reusing Wrong Fixtures
**Problem**: Creating duplicate fixtures when existing ones work
**Solution**: Reuse `lickGlansLyingCloseFixtures.js` - it supports all lying-close penis actions
**Rationale**: Both lick_glans and take_penis_in_mouth actions share identical positioning requirements, scope, and preconditions

### Pitfall 4: Message Format Inconsistency
**Problem**: Deviating from specified message format
**Solution**: Use exact message format from spec
**Correct**: `"{context.actorName} takes {context.primaryName}'s cock in the mouth, bathing it in hot saliva."`

### Pitfall 5: Test Cleanup Missing
**Problem**: Tests leave dirty state affecting subsequent tests
**Solution**: Always call `fixture.cleanup()` in afterEach, restore scope resolver
**Example**:
```javascript
afterEach(() => {
  if (restoreScopeResolver) {
    restoreScopeResolver();
    restoreScopeResolver = null;
  }
  if (testFixture) {
    testFixture.cleanup();
    testFixture = null;
  }
});
```

### Pitfall 6: Scope Already Exists
**Problem**: Attempting to create scope that already exists
**Solution**: Verify `sex-core:actors_lying_close_with_uncovered_penis` scope exists and reuse it
**Check**: `data/mods/sex-core/scopes/actors_lying_close_with_uncovered_penis.scope`

### Pitfall 7: Missing Blowjob Component Management
**Problem**: Not properly cleaning up existing blowjob states before adding new ones
**Solution**: Follow the pattern from `handle_take_penis_in_mouth_kneeling.rule.json`:
- Query existing giving_blowjob and receiving_blowjob components on both entities
- Remove reciprocal components from partners if they exist
- Remove both components from both entities (cleanup)
- Add new components with correct entity references

### Pitfall 8: Forgetting Description Regeneration
**Problem**: Not regenerating entity descriptions after adding blowjob components
**Solution**: Call REGENERATE_DESCRIPTION for both actor and primary after adding components
**Rationale**: The activity metadata in the blowjob components needs to be reflected in entity descriptions

## Reference Documentation

### Related Files to Review
- **Lick glans lying variant**: `lick_glans_lying_close.action.json` and corresponding rule/tests
- **Take penis in mouth sitting variant**: `take_penis_in_mouth.action.json` and corresponding rule/tests
- **Take penis in mouth kneeling variant**: `take_penis_in_mouth_kneeling.action.json` and corresponding rule/tests
- **Shared scope**: `sex-core:actors_lying_close_with_uncovered_penis.scope`
- **Shared fixtures**: `lickGlansLyingCloseFixtures.js`
- **Test guide**: `docs/testing/mod-testing-guide.md`

### Key Patterns
- **lying_close actions**: Require same furniture_id, reuse shared scope and fixtures
- **sitting_close actions**: No furniture matching, simpler scope
- **penis anatomy**: Requires checking penis slot with coverage validation
- **Component namespacing**: Always use `modId:componentName` format
- **Test fixtures**: Reuse existing fixtures when scope requirements match
- **Placeholder consistency**: Follow the pattern of the closest sibling action
- **Blowjob component management**: Always clean up existing states before adding new ones
- **Description regeneration**: Always regenerate after significant component changes

## Success Criteria

✅ **Implementation Complete When**:
1. Scope file verified to exist (already exists)
2. All 3 new JSON files created and schema-valid (action, condition, rule)
3. All 7 discovery test cases pass
4. All 4 execution test cases pass
5. Naming conventions verified correct
6. Linting passes with no errors
7. Visual properties match mod standards
8. Message formatting matches user specification exactly
9. Blowjob components added correctly with proper cleanup
10. Description regeneration events dispatched for both entities

✅ **Quality Metrics**:
- Test coverage: 100% of action/rule logic
- Schema validation: All files pass
- Integration tests: All scenarios covered (1 positive + 6 negative discovery, 4 execution)
- Code style: ESLint compliant
- Documentation: Inline comments explain test structure
- Fixture reuse: No duplicate test infrastructure
- Component management: Proper cleanup and addition
- Event dispatching: All required events present

## Maintenance Notes

### Future Considerations
- If positioning system changes, verify scope logic still works (shared with lick_glans action)
- If new forbidden states added, add corresponding negative test cases
- If message formatting changes, update EXPECTED_MESSAGE constant
- Keep fixture scenario builder in sync with actual component schemas (already handled by shared fixtures)
- If blowjob component schema changes, update rule operations and test assertions
- If description regeneration behavior changes, update test expectations

### Related Systems
- **Positioning System**: `data/mods/positioning/` - defines lying_down, closeness, giving_blowjob, receiving_blowjob components
- **Anatomy System**: `data/mods/anatomy/` - defines penis body part and coverage
- **Furniture System**: `data/mods/furniture/` - defines allows_lying property
- **Perception System**: `src/perception/` - handles perceptible_event dispatching
- **Sexual Positioning**: Various `positioning:` components track sexual interactions
- **Description System**: `src/entities/` - handles entity description regeneration

### Related Implementations
- **lick_glans_lying_close**: Shares the same scope and fixtures that this action reuses

---

**Specification Version**: 1.0
**Created**: 2025-11-09
**Status**: Ready for Implementation
**Related Specs**: lick-glans-lying-close-implementation.md (provides the shared scope and fixtures)
