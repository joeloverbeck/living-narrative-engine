# Specification: Pull Penis Out of Mouth in Revulsion Action

## Overview

This specification defines a new action/rule combo for the `sex-penile-oral` mod where an actor who is currently giving a blowjob pulls the target's penis out of their mouth in revulsion. This action represents an abrupt, negative reaction distinct from the existing `pull_penis_out_of_mouth` action which depicts a gentle, sensual withdrawal.

## Motivation

The current `sex-penile-oral:pull_penis_out_of_mouth` action portrays a controlled, sensual ending to oral sex with romantic imagery ("a thread of saliva linking the glans to {actor}'s lips"). This new action addresses scenarios where the actor experiences revulsion or disgust, requiring a distinct visual representation and narrative tone that reflects emotional discomfort or rejection.

## Action Definition

### File Location
`data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth_revulsion.action.json`

### Action Schema

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-penile-oral:pull_penis_out_of_mouth_revulsion",
  "name": "Pull Penis Out of Mouth in Revulsion",
  "description": "Abruptly withdraw your partner's penis from your mouth with a disgusted expression, ending the oral sex interaction.",
  "targets": {
    "primary": {
      "scope": "sex-penile-oral:receiving_blowjob_from_actor",
      "placeholder": "primary",
      "description": "Partner whose penis you are currently pleasuring"
    }
  },
  "required_components": {
    "actor": ["positioning:giving_blowjob", "positioning:closeness"]
  },
  "forbidden_components": {},
  "template": "pull {primary}'s penis out of your mouth in revulsion",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#4a1a1a",
    "textColor": "#ffcccc",
    "hoverBackgroundColor": "#6b2424",
    "hoverTextColor": "#ffffff"
  }
}
```

### Visual Properties Rationale
- **Background**: Dark red (#4a1a1a) - Represents distress/discomfort vs. the sensual purple (#2a1a5e) of the original
- **Text**: Light pink (#ffcccc) - Maintains readability while distinguishing from the romantic variant (#ede7f6)
- **Hover Background**: Deeper red (#6b2424) - Intensifies the negative emotional tone
- **Hover Text**: Pure white (#ffffff) - Ensures clear contrast on hover

## Rule Definition

### File Location
`data/mods/sex-penile-oral/rules/handle_pull_penis_out_of_mouth_revulsion.rule.json`

### Rule Schema

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_pull_penis_out_of_mouth_revulsion",
  "comment": "Handles the 'sex-penile-oral:pull_penis_out_of_mouth_revulsion' action. Removes reciprocal blowjob components from both participants with revulsion narrative.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex-penile-oral:event-is-action-pull-penis-out-of-mouth-revulsion"
  },
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
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} pulls out {context.primaryName}'s cock out of their mouth, face twisted in revulsion."
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

### Narrative Message
**Template**: `"{actor} pulls out {primary}'s cock out of their mouth, face twisted in revulsion."`

**Key Differences from Sensual Variant**:
- "pulls out" (abrupt) vs. "slowly pulls" (gradual)
- "face twisted in revulsion" (disgust) vs. "thread of saliva linking the glans to {primary}'s lips" (romantic imagery)
- No sensual details, focuses solely on emotional reaction and physical withdrawal
- Perceptible event message identical to successful action message for consistency

## Condition Definition

### File Location
`data/mods/sex-penile-oral/conditions/event-is-action-pull-penis-out-of-mouth-revulsion.condition.json`

### Condition Schema

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-penile-oral:event-is-action-pull-penis-out-of-mouth-revulsion",
  "description": "Condition to check if the event is an attempt to perform the pull_penis_out_of_mouth_revulsion action",
  "condition": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex-penile-oral:pull_penis_out_of_mouth_revulsion"
    ]
  }
}
```

## Mod Manifest Update

### File Location
`data/mods/sex-penile-oral/mod-manifest.json`

### Required Changes

Add to `content.actions` array (maintain alphabetical order):
```json
"pull_penis_out_of_mouth_revulsion.action.json"
```

Add to `content.conditions` array (maintain alphabetical order):
```json
"event-is-action-pull-penis-out-of-mouth-revulsion.condition.json"
```

Add to `content.rules` array (maintain alphabetical order):
```json
"handle_pull_penis_out_of_mouth_revulsion.rule.json"
```

## Test Suite Requirements

### Test File Structure

1. **Action Discovery Tests**: `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_revulsion_action_discovery.test.js`
2. **Rule Execution Tests**: `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_revulsion_action.test.js`

### Discovery Test Coverage

#### Required Test Cases

**TC-D1: Positive - Action appears when actor is giving blowjob to partner**
```javascript
it('appears when actor is giving blowjob to partner', async () => {
  // Setup: Actor has giving_blowjob + closeness, target has receiving_blowjob
  // Execute: Discover actions for actor
  // Assert: Action discovered with correct template
  expect(discovered).toBeDefined();
  expect(discovered.template).toBe("pull {primary}'s penis out of your mouth in revulsion");
});
```

**TC-D2: Negative - No action without giving_blowjob component**
```javascript
it('does not appear when actor lacks giving_blowjob component', async () => {
  // Setup: Actor missing positioning:giving_blowjob
  // Execute: Discover actions for actor
  // Assert: Action not discovered
  expect(discovered).toBeUndefined();
});
```

**TC-D3: Negative - No action without closeness**
```javascript
it('does not appear when closeness is not established', async () => {
  // Setup: Actor has giving_blowjob but no closeness
  // Execute: Discover actions for actor
  // Assert: Action not discovered
  expect(discovered).toBeUndefined();
});
```

**TC-D4: Negative - No action with mismatched entity references**
```javascript
it('does not appear when entity references are mismatched', async () => {
  // Setup: actor.giving_blowjob.receiving_entity_id !== primary.id
  // Execute: Discover actions for actor
  // Assert: Action not discovered
  expect(discovered).toBeUndefined();
});
```

**TC-D5: Negative - No action when target lacks receiving_blowjob**
```javascript
it('does not appear when target lacks receiving_blowjob component', async () => {
  // Setup: Primary missing positioning:receiving_blowjob
  // Execute: Discover actions for actor
  // Assert: Action not discovered
  expect(discovered).toBeUndefined();
});
```

**TC-D6: Positive - Action works when actor is kneeling (regression test)**
```javascript
it('DOES appear when actor is kneeling before target (regression test for #7585)', async () => {
  // Setup: Actor kneeling before primary with blowjob components
  // Execute: Discover actions for actor
  // Assert: Action discovered (proves raw closeness.partners works correctly)
  expect(discovered).toBeDefined();
  expect(discovered.template).toBe("pull {primary}'s penis out of your mouth in revulsion");
});
```

#### Test Implementation Pattern

See full implementation code examples in Implementation Checklist section below.

### Rule Execution Test Coverage

#### Required Test Cases

**TC-R1: Narrative - Dispatches correct message and perceptible event**

Uses `ModAssertionHelpers` to verify:
- Success message matches expected revulsion narrative
- Perceptible event dispatched with correct structure
- Turn ended properly

**TC-R2: State Termination - Removes blowjob components from both actor and primary**

Verifies that both `giving_blowjob` and `receiving_blowjob` components are removed after action execution.

**TC-R3: Isolation - Does not affect other entities when removing blowjob state**

Creates two blowjob pairs, executes action on first pair, verifies second pair's components unchanged.

**TC-R4: Specificity - Does not fire rule for different action**

Dispatches different action event, verifies rule doesn't execute and components remain intact.

**TC-R5: Workflow - Completes full workflow from initiation to completion**

Verifies complete workflow: components exist ’ action executes ’ components removed ’ success event dispatched.

## Implementation Checklist

### Data Files
- [ ] Create `data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth_revulsion.action.json`
- [ ] Create `data/mods/sex-penile-oral/conditions/event-is-action-pull-penis-out-of-mouth-revulsion.condition.json`
- [ ] Create `data/mods/sex-penile-oral/rules/handle_pull_penis_out_of_mouth_revulsion.rule.json`
- [ ] Update `data/mods/sex-penile-oral/mod-manifest.json` with new content entries (maintain alphabetical order)

### Test Files

Both test files require these helper functions (see full implementation in code examples below):

**Helper Functions Required:**
- `buildRevulsionPullOutScenario(options)` - Creates test entities with configurable components
- `installReceivingBlowjobFromActorScopeOverride(fixture)` - Implements scope resolution logic
- `configureActionDiscovery(fixture)` - Registers action for discovery

#### Discovery Test File
- [ ] Create `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_revulsion_action_discovery.test.js`
- [ ] Implement all 6 discovery test cases (TC-D1 through TC-D6)

#### Rule Execution Test File
- [ ] Create `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_revulsion_action.test.js`
- [ ] Implement all 5 rule execution test cases (TC-R1 through TC-R5)

### Test Coverage Requirements
- [ ] All 6 discovery test cases passing
- [ ] All 5 rule execution test cases passing
- [ ] Tests use `ModTestFixture.forAction()` for discovery
- [ ] Tests use `ModTestFixture.forActionAutoLoad()` for rule execution
- [ ] Scope resolver override implemented correctly
- [ ] Domain matchers imported and used (`domainMatchers.js`, `actionMatchers.js`)
- [ ] No hard-coded entity IDs (use scenario builders)

### Validation Steps
- [ ] Run `npm run test:integration -- tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_revulsion*.test.js`
- [ ] Verify both test suites pass completely
- [ ] Run `npx eslint` on all modified files
- [ ] Verify action appears in game when conditions met
- [ ] Verify narrative message displays correctly
- [ ] Verify components are properly removed

## Full Test Implementation Examples

### Discovery Test Complete Implementation

```javascript
/**
 * @file Integration tests for sex-penile-oral:pull_penis_out_of_mouth_revulsion action discovery.
 * @description Validates that the action appears when actor is giving blowjob to partner.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import pullPenisOutRevulsionAction from '../../../../data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth_revulsion.action.json';

const ACTION_ID = 'sex-penile-oral:pull_penis_out_of_mouth_revulsion';

/**
 * Builds a scenario where the ACTOR is giving a blowjob to PRIMARY.
 */
function buildRevulsionPullOutScenario(options = {}) {
  const {
    includeGivingBlowjob = true,
    includeCloseness = true,
    mismatchedReferences = false,
    targetHasReceivingBlowjob = true,
  } = options;

  const ACTOR_ID = 'ava';
  const PRIMARY_ID = 'nolan';
  const ROOM_ID = 'bedroom1';

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Bedroom')
    .asRoom('Private Bedroom')
    .build();

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Ava')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (includeGivingBlowjob) {
    actorBuilder.withComponent('positioning:giving_blowjob', {
      receiving_entity_id: mismatchedReferences ? 'someone_else' : PRIMARY_ID,
      initiated: true,
    });
  }

  if (includeCloseness) {
    actorBuilder.closeToEntity(PRIMARY_ID);
  }

  const primaryBuilder = new ModEntityBuilder(PRIMARY_ID)
    .withName('Nolan')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor();

  if (targetHasReceivingBlowjob) {
    primaryBuilder.withComponent('positioning:receiving_blowjob', {
      giving_entity_id: mismatchedReferences ? 'someone_else' : ACTOR_ID,
      consented: true,
    });
  }

  if (includeCloseness) {
    primaryBuilder.closeToEntity(ACTOR_ID);
  }

  return {
    entities: [room, actorBuilder.build(), primaryBuilder.build()],
    actorId: ACTOR_ID,
    primaryId: PRIMARY_ID,
  };
}

/**
 * Installs a scope resolver override for receiving_blowjob_from_actor.
 */
function installReceivingBlowjobFromActorScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-penile-oral:receiving_blowjob_from_actor') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const givingBlowjob = actor?.components?.['positioning:giving_blowjob'];
      const closenessPartners = actor?.components?.['positioning:closeness']?.partners;

      // IMPORTANT: No kneeling filter here
      if (!givingBlowjob || !Array.isArray(closenessPartners)) {
        return { success: true, value: new Set() };
      }

      const receivingEntityId = givingBlowjob.receiving_entity_id;
      if (!receivingEntityId) {
        return { success: true, value: new Set() };
      }

      const receivingEntity = fixture.entityManager.getEntityInstance(receivingEntityId);
      if (!receivingEntity) {
        return { success: true, value: new Set() };
      }

      const receivingBlowjob = receivingEntity.components?.['positioning:receiving_blowjob'];
      if (!receivingBlowjob) {
        return { success: true, value: new Set() };
      }

      if (
        receivingBlowjob.giving_entity_id === actorId &&
        closenessPartners.includes(receivingEntityId)
      ) {
        return { success: true, value: new Set([receivingEntityId]) };
      }

      return { success: true, value: new Set() };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}

/**
 * Registers the action for discovery.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullPenisOutRevulsionAction]);
}

describe('sex-penile-oral:pull_penis_out_of_mouth_revulsion action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installReceivingBlowjobFromActorScopeOverride(testFixture);
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

  it('appears when actor is giving blowjob to partner', async () => {
    const { entities, actorId } = buildRevulsionPullOutScenario();

    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("pull {primary}'s penis out of your mouth in revulsion");
  });

  it('does not appear when actor lacks giving_blowjob component', async () => {
    const { entities, actorId } = buildRevulsionPullOutScenario({
      includeGivingBlowjob: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when closeness is not established', async () => {
    const { entities, actorId } = buildRevulsionPullOutScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when entity references are mismatched', async () => {
    const { entities, actorId } = buildRevulsionPullOutScenario({
      mismatchedReferences: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when target lacks receiving_blowjob component', async () => {
    const { entities, actorId } = buildRevulsionPullOutScenario({
      targetHasReceivingBlowjob: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('DOES appear when actor is kneeling before target (regression test for #7585)', async () => {
    const ACTOR_ID = 'ava';
    const PRIMARY_ID = 'nolan';
    const ROOM_ID = 'bedroom1';

    const room = new ModEntityBuilder(ROOM_ID)
      .withName('Private Bedroom')
      .asRoom('Private Bedroom')
      .build();

    const actorBuilder = new ModEntityBuilder(ACTOR_ID)
      .withName('Ava')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .kneelingBefore(PRIMARY_ID)
      .closeToEntity(PRIMARY_ID)
      .withComponent('positioning:giving_blowjob', {
        receiving_entity_id: PRIMARY_ID,
        initiated: true,
      });

    const primaryBuilder = new ModEntityBuilder(PRIMARY_ID)
      .withName('Nolan')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .closeToEntity(ACTOR_ID)
      .withComponent('positioning:receiving_blowjob', {
        giving_entity_id: ACTOR_ID,
        consented: true,
      });

    const entities = [room, actorBuilder.build(), primaryBuilder.build()];
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("pull {primary}'s penis out of your mouth in revulsion");
  });
});
```

### Rule Execution Test Complete Implementation

```javascript
/**
 * @file Integration tests for sex-penile-oral:pull_penis_out_of_mouth_revulsion action and rule.
 * @description Verifies blowjob termination with revulsion narrative, perceptible event wiring, component removal, and state isolation.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import pullPenisOutRevulsionAction from '../../../../data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth_revulsion.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-penile-oral:pull_penis_out_of_mouth_revulsion';
const EXPECTED_MESSAGE =
  "Ava pulls out Nolan's cock out of their mouth, face twisted in revulsion.";

function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullPenisOutRevulsionAction]);
}

function buildRevulsionPullOutScenario() {
  const ACTOR_ID = 'ava';
  const PRIMARY_ID = 'nolan';
  const ROOM_ID = 'bedroom1';

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Bedroom')
    .asRoom('Private Bedroom')
    .build();

  const actor = new ModEntityBuilder(ACTOR_ID)
    .withName('Ava')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .closeToEntity(PRIMARY_ID)
    .withComponent('positioning:giving_blowjob', {
      receiving_entity_id: PRIMARY_ID,
      initiated: true,
    })
    .build();

  const primary = new ModEntityBuilder(PRIMARY_ID)
    .withName('Nolan')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .closeToEntity(ACTOR_ID)
    .withComponent('positioning:receiving_blowjob', {
      giving_entity_id: ACTOR_ID,
      consented: true,
    })
    .build();

  return {
    entities: [room, actor, primary],
    actorId: ACTOR_ID,
    primaryId: PRIMARY_ID,
    roomId: ROOM_ID,
  };
}

function installReceivingBlowjobFromActorScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-penile-oral:receiving_blowjob_from_actor') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const givingBlowjob = actor?.components?.['positioning:giving_blowjob'];
      const closenessPartners = actor?.components?.['positioning:closeness']?.partners;

      if (!givingBlowjob || !Array.isArray(closenessPartners)) {
        return { success: true, value: new Set() };
      }

      const receivingEntityId = givingBlowjob.receiving_entity_id;
      if (!receivingEntityId) {
        return { success: true, value: new Set() };
      }

      const receivingEntity = fixture.entityManager.getEntityInstance(receivingEntityId);
      if (!receivingEntity) {
        return { success: true, value: new Set() };
      }

      const receivingBlowjob = receivingEntity.components?.['positioning:receiving_blowjob'];
      if (!receivingBlowjob) {
        return { success: true, value: new Set() };
      }

      if (
        receivingBlowjob.giving_entity_id === actorId &&
        closenessPartners.includes(receivingEntityId)
      ) {
        return { success: true, value: new Set([receivingEntityId]) };
      }

      return { success: true, value: new Set() };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}

describe('sex-penile-oral:pull_penis_out_of_mouth_revulsion action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installReceivingBlowjobFromActorScopeOverride(testFixture);
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

  // eslint-disable-next-line jest/expect-expect -- Uses ModAssertionHelpers which internally uses expect
  it('dispatches correct narrative message and perceptible event', async () => {
    const { entities, actorId, primaryId, roomId } = buildRevulsionPullOutScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    ModAssertionHelpers.assertActionSuccess(testFixture.events, EXPECTED_MESSAGE, {
      shouldEndTurn: true,
      shouldHavePerceptibleEvent: true,
    });

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: roomId,
      actorId,
      targetId: primaryId,
      perceptionType: 'action_target_general',
    });
  });

  it('removes blowjob components from both actor and primary', async () => {
    const { entities, actorId, primaryId } = buildRevulsionPullOutScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    const primaryBefore = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorBefore.components['positioning:giving_blowjob']).toBeDefined();
    expect(primaryBefore.components['positioning:receiving_blowjob']).toBeDefined();

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorAfter.components['positioning:giving_blowjob']).toBeUndefined();
    expect(primaryAfter.components['positioning:receiving_blowjob']).toBeUndefined();
  });

  it('does not affect other entities when removing blowjob state', async () => {
    const { entities, actorId, primaryId } = buildRevulsionPullOutScenario();

    const SECONDARY_ACTOR_ID = 'other_actor';
    const SECONDARY_PRIMARY_ID = 'other_primary';

    const secondaryActor = new ModEntityBuilder(SECONDARY_ACTOR_ID)
      .withName('Other Actor')
      .atLocation('bedroom1')
      .withLocationComponent('bedroom1')
      .asActor()
      .withComponent('positioning:giving_blowjob', {
        receiving_entity_id: SECONDARY_PRIMARY_ID,
        initiated: true,
      })
      .build();

    const secondaryPrimary = new ModEntityBuilder(SECONDARY_PRIMARY_ID)
      .withName('Other Primary')
      .atLocation('bedroom1')
      .withLocationComponent('bedroom1')
      .asActor()
      .withComponent('positioning:receiving_blowjob', {
        giving_entity_id: SECONDARY_ACTOR_ID,
        consented: true,
      })
      .build();

    entities.push(secondaryActor, secondaryPrimary);

    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const secondaryActorAfter = testFixture.entityManager.getEntityInstance(SECONDARY_ACTOR_ID);
    const secondaryPrimaryAfter =
      testFixture.entityManager.getEntityInstance(SECONDARY_PRIMARY_ID);
    expect(secondaryActorAfter.components['positioning:giving_blowjob']).toBeDefined();
    expect(secondaryPrimaryAfter.components['positioning:receiving_blowjob']).toBeDefined();
  });

  it('does not fire rule for different action', async () => {
    const { entities, actorId, primaryId } = buildRevulsionPullOutScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    expect(actorBefore.components['positioning:giving_blowjob']).toBeDefined();

    testFixture.testEnv.eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actorId,
        primaryId,
        actionId: 'some:other_action',
      },
    });

    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    expect(actorAfter.components['positioning:giving_blowjob']).toBeDefined();

    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBe(0);
  });

  it('completes full workflow from initiation to completion', async () => {
    const { entities, actorId, primaryId } = buildRevulsionPullOutScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actorMid = testFixture.entityManager.getEntityInstance(actorId);
    const primaryMid = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorMid.components['positioning:giving_blowjob']).toBeDefined();
    expect(primaryMid.components['positioning:receiving_blowjob']).toBeDefined();

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const actorFinal = testFixture.entityManager.getEntityInstance(actorId);
    const primaryFinal = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorFinal.components['positioning:giving_blowjob']).toBeUndefined();
    expect(primaryFinal.components['positioning:receiving_blowjob']).toBeUndefined();

    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBe(1);
    expect(successEvents[0].payload.message).toBe(EXPECTED_MESSAGE);
  });
});
```

## References

### Existing Implementation
- **Sensual Variant Action**: `data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth.action.json`
- **Sensual Variant Rule**: `data/mods/sex-penile-oral/rules/handle_pull_penis_out_of_mouth.rule.json`
- **Scope Definition**: `data/mods/sex-penile-oral/scopes/receiving_blowjob_from_actor.scope`

### Test References
- **Discovery Test Pattern**: `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action_discovery.test.js`
- **Rule Test Pattern**: `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action.test.js`

### Documentation
- **Mod Testing Guide**: `docs/testing/mod-testing-guide.md`
- **Action Discovery Toolkit**: `docs/testing/action-discovery-testing-toolkit.md`
- **Project Context**: `CLAUDE.md`

## Design Rationale

### Why a Separate Action?

1. **Distinct Emotional Context**: Revulsion vs. sensual pleasure requires different narrative tone
2. **Visual Differentiation**: Different color scheme (dark red vs. purple) helps players identify emotional context at a glance
3. **AI Behavior**: LLM-driven NPCs may choose between actions based on relationship state, trust levels, and circumstances
4. **Player Agency**: Provides explicit choice between reactions with clear emotional implications
5. **Narrative Depth**: Enriches the range of emotional responses available in intimate scenarios

### Component Removal Strategy

Both actions remove the same components (`positioning:giving_blowjob`, `positioning:receiving_blowjob`) because the mechanical outcome is identicalthe oral sex interaction ends. The distinction lies purely in narrative and emotional context, not game state.

### Scope Reuse

Both actions use the same `sex-penile-oral:receiving_blowjob_from_actor` scope because the targeting requirements are identicalthe distinction is narrative, not structural.

---

**Specification Version**: 1.0
**Created**: 2025-10-24
**Author**: Claude Code
**Status**: Ready for Implementation
