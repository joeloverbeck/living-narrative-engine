# Specification: Lick Testicles (Lying Close) Action Implementation

## Overview

This specification defines the implementation requirements for a new action/rule combination that allows characters to lick their partner's testicles while both are lying down in close proximity on shared furniture. This action extends the existing testicle-licking mechanics to support lying positions, complementing the existing sitting and kneeling variants.

**Content Type**: Mature - Sexual Content

## Reference Actions

This implementation should follow established patterns from:
- **`lick_glans_lying_close.action.json`** - Template for lying-down close proximity sexual actions
- **`lick_testicles_sensually.action.json`** - Template for testicle-licking mechanics (kneeling variant)
- **`lick_testicles_sitting_close.action.json`** - Template for testicle-licking while sitting close
- **`sex-core:actors_lying_close_with_uncovered_penis.scope`** - Pattern for lying-down scope with anatomy checks
- **`sex-core:actors_sitting_close_with_uncovered_testicle.scope`** - Pattern for testicle coverage checks

## Implementation Files

### 1. Scope Definition

**File**: `data/mods/sex-core/scopes/actors_lying_close_with_uncovered_testicle.scope`

**Scope ID**: `sex-core:actors_lying_close_with_uncovered_testicle`

**Purpose**: Identify partners who are lying close together on the same furniture where the partner has at least one uncovered testicle and is not currently having sex with the actor.

**Structure**:
```
// Scope for lying-down partners sharing the same furniture where the target has uncovered testicles
// Used by actions requiring both actors to be lying down close together with exposed testicles
// Excludes targets who are currently fucking the actor to prevent impossible positioning
sex-core:actors_lying_close_with_uncovered_testicle := actor.components.positioning:closeness.partners[][{
  "and": [
    {"!!": {"var": "entity.components.positioning:lying_down"}},
    {"!!": {"var": "actor.components.positioning:lying_down"}},
    {
      "==": [
        {"var": "actor.components.positioning:lying_down.furniture_id"},
        {"var": "entity.components.positioning:lying_down.furniture_id"}
      ]
    },
    {"hasPartOfType": [".", "testicle"]},
    {
      "or": [
        {"not": {"isSocketCovered": [".", "left_testicle"]}},
        {"not": {"isSocketCovered": [".", "right_testicle"]}}
      ]
    },
    {
      "not": {
        "and": [
          {"!!": {"var": "entity.components.positioning:fucking_vaginally"}},
          {"==": [{"var": "entity.components.positioning:fucking_vaginally.targetId"}, {"var": "actor.id"}]}
        ]
      }
    }
  ]
}]
```

**Key Requirements**:
- Both actor and entity must have `positioning:lying_down` component
- Both must share the same `furniture_id` value
- Entity must have testicle anatomy (via `hasPartOfType`)
- At least one testicle (left or right) must be uncovered
- Entity must NOT be currently fucking the actor vaginally (prevents impossible positioning)
- Comments explain the scope's purpose and constraints

**Manifest Update**: Add scope file to `data/mods/sex-core/mod-manifest.json`:
```json
{
  "scopes": [
    "scopes/actors_lying_close_with_uncovered_testicle.scope"
  ]
}
```

### 2. Action Definition

**File**: `data/mods/sex-penile-oral/actions/lick_testicles_lying_close.action.json`

**Schema**: `schema://living-narrative-engine/action.schema.json`

**Action ID**: `sex-penile-oral:lick_testicles_lying_close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-penile-oral:lick_testicles_lying_close",
  "name": "Lick Testicles (Lying Close)",
  "description": "Lick a partner's testicles while both are lying close together. Requires both participants to be lying down on the same furniture with mutual closeness. The partner must have at least one exposed testicle.",
  "targets": {
    "primary": {
      "scope": "sex-core:actors_lying_close_with_uncovered_testicle",
      "placeholder": "target",
      "description": "Partner lying close with exposed testicles"
    }
  },
  "template": "lick {target}'s testicles sensually",
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
- Primary must have at least one uncovered testicle (validated by scope)
- Uses `target` as the placeholder (following pattern from `lick_testicles_sensually`)
- Visual properties match sex-penile-oral mod standards (purple theme)

**Manifest Update**: Add action file to `data/mods/sex-penile-oral/mod-manifest.json`:
```json
{
  "actions": [
    "actions/lick_testicles_lying_close.action.json"
  ]
}
```

### 3. Condition File

**File**: `data/mods/sex-penile-oral/conditions/event-is-action-lick-testicles-lying-close.condition.json`

**Critical**: Use hyphens in filename, even though action uses underscores

**Schema**: `schema://living-narrative-engine/condition.schema.json`

**Condition ID**: `sex-penile-oral:event-is-action-lick-testicles-lying-close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-penile-oral:event-is-action-lick-testicles-lying-close",
  "description": "Checks if the triggering event is for the 'sex-penile-oral:lick_testicles_lying_close' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex-penile-oral:lick_testicles_lying_close"
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
    "conditions/event-is-action-lick-testicles-lying-close.condition.json"
  ]
}
```

### 4. Rule Definition

**File**: `data/mods/sex-penile-oral/rules/handle_lick_testicles_lying_close.rule.json`

**Schema**: `schema://living-narrative-engine/rule.schema.json`

**Rule ID**: `sex-penile-oral:handle_lick_testicles_lying_close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "sex-penile-oral:handle_lick_testicles_lying_close",
  "comment": "Handles the lick_testicles_lying_close action: actor licks primary's testicles while both are lying close together",
  "event_type": "core:attempt_action",
  "condition": "sex-penile-oral:event-is-action-lick-testicles-lying-close",
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
        "value": "{context.actorName} licks {context.targetName}'s testicles slowly and sensually, coating them with hot saliva."
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
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Key Requirements**:
- Uses `primary` entity reference for GET_NAME but stores in `targetName` variable (matches placeholder pattern)
- Message: `"{actor} licks {target}'s testicles slowly and sensually, coating them with hot saliva."`
- Perception type: `action_target_general`
- Standard operation sequence: GET_NAME (actor), GET_NAME (primary/target), QUERY_COMPONENT (actor position), SET_VARIABLE (all needed variables), macro (logSuccessAndEndTurn)
- `targetId` set to `{event.payload.primaryId}` (matches the primary target reference)

**Message Rationale**:
- "licks {target}'s testicles slowly and sensually" - core action description
- "coating them with hot saliva" - sensory detail specific to this action
- Matches the user's requested message format exactly

**Manifest Update**: Add rule file to `data/mods/sex-penile-oral/mod-manifest.json`:
```json
{
  "rules": [
    "rules/handle_lick_testicles_lying_close.rule.json"
  ]
}
```

## Test Suite Specifications

### Test File 1: Test Fixtures

**File**: `tests/common/mods/sex-penile-oral/lickTesticlesLyingCloseFixtures.js`

**Purpose**: Provide reusable scenario builders and scope override functions for testing

**Structure**:
```javascript
/**
 * @file Shared fixtures for the lick testicles (lying close) action suites.
 * @description Provides reusable builders and scope overrides for lying-down testicle licking scenarios
 * where partners share close proximity on the same furniture and the target's testicles must be exposed.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

/**
 * Builds a complete scenario for testing lick_testicles_lying_close action.
 * Creates two characters (Ava and Nolan) lying on the same bed with proper components.
 *
 * @param {Object} options - Configuration options
 * @param {boolean} [options.coverLeftTesticle=false] - If true, covers target's left testicle with clothing
 * @param {boolean} [options.coverRightTesticle=false] - If true, covers target's right testicle with clothing
 * @param {boolean} [options.includeActorLying=true] - If false, omits actor's lying_down component
 * @param {boolean} [options.includePrimaryLying=true] - If false, omits primary's lying_down component
 * @param {boolean} [options.includeCloseness=true] - If false, omits mutual closeness components
 * @param {boolean} [options.useDifferentFurniture=false] - If true, places participants on different furniture
 * @param {boolean} [options.actorGivingBlowjob=false] - If true, adds giving_blowjob component to actor
 * @param {boolean} [options.targetFuckingActor=false] - If true, adds fucking_vaginally component to target
 * @returns {Object} Scenario data with entities, IDs, and metadata
 */
export function buildLickTesticlesLyingCloseScenario(options = {}) {
  const {
    coverLeftTesticle = false,
    coverRightTesticle = false,
    includeActorLying = true,
    includePrimaryLying = true,
    includeCloseness = true,
    useDifferentFurniture = false,
    actorGivingBlowjob = false,
    targetFuckingActor = false,
  } = options;

  const actorId = 'actor-ava';
  const primaryId = 'primary-nolan';
  const roomId = 'room-bedroom';
  const bedId = 'furniture-bed';
  const secondBedId = 'furniture-bed-2';
  const leftTesticleId = 'body-part-nolan-left-testicle';
  const rightTesticleId = 'body-part-nolan-right-testicle';
  const clothingId = 'clothing-underwear';

  const entities = {
    [actorId]: {
      id: actorId,
      components: {
        'core:name': { name: 'Ava' },
        'core:position': { locationId: roomId },
        ...(includeActorLying && {
          'positioning:lying_down': {
            furniture_id: bedId,
            state: 'lying_on_back'
          }
        }),
        ...(includeCloseness && {
          'positioning:closeness': { partners: [primaryId] }
        }),
        ...(actorGivingBlowjob && {
          'positioning:giving_blowjob': { target_id: primaryId }
        }),
      },
    },
    [primaryId]: {
      id: primaryId,
      components: {
        'core:name': { name: 'Nolan' },
        'core:position': { locationId: roomId },
        'anatomy:body': {
          slots: {
            left_testicle: {
              part_id: leftTesticleId,
              ...(coverLeftTesticle && { covered_by: [clothingId] }),
            },
            right_testicle: {
              part_id: rightTesticleId,
              ...(coverRightTesticle && { covered_by: [clothingId] }),
            },
          },
        },
        ...(includePrimaryLying && {
          'positioning:lying_down': {
            furniture_id: useDifferentFurniture ? secondBedId : bedId,
            state: 'lying_on_back'
          }
        }),
        ...(includeCloseness && {
          'positioning:closeness': { partners: [actorId] }
        }),
        ...(targetFuckingActor && {
          'positioning:fucking_vaginally': { targetId: actorId }
        }),
      },
    },
    [roomId]: {
      id: roomId,
      components: {
        'core:name': { name: 'Bedroom' },
      },
    },
    [bedId]: {
      id: bedId,
      components: {
        'core:name': { name: 'Bed' },
        'furniture:allows_lying': {},
      },
    },
    ...(useDifferentFurniture && {
      [secondBedId]: {
        id: secondBedId,
        components: {
          'core:name': { name: 'Second Bed' },
          'furniture:allows_lying': {},
        },
      },
    }),
    [leftTesticleId]: {
      id: leftTesticleId,
      components: {
        'anatomy:body_part': { type: 'testicle' },
      },
    },
    [rightTesticleId]: {
      id: rightTesticleId,
      components: {
        'anatomy:body_part': { type: 'testicle' },
      },
    },
    ...(coverLeftTesticle || coverRightTesticle) && {
      [clothingId]: {
        id: clothingId,
        components: {
          'items:clothing': { slot: 'groin' },
        },
      },
    }),
  };

  return {
    entities,
    actorId,
    primaryId,
    roomId,
    furnitureId: bedId,
    leftTesticleId,
    rightTesticleId,
    ...(coverLeftTesticle || coverRightTesticle) && { clothingId }),
  };
}

/**
 * Installs a scope resolver override for the actors_lying_close_with_uncovered_testicle scope.
 * This enables testing without requiring the full scope resolution system.
 *
 * @param {ModTestFixture} testFixture - The test fixture instance
 * @returns {Function} Cleanup function to restore original scope resolver
 */
export function installLyingCloseUncoveredTesticleScopeOverride(testFixture) {
  const originalResolver = testFixture.testEnv.scopeResolver.resolve.bind(
    testFixture.testEnv.scopeResolver
  );

  testFixture.testEnv.scopeResolver.resolve = (scopeId, context) => {
    if (scopeId === 'sex-core:actors_lying_close_with_uncovered_testicle') {
      const { actor } = context;
      const actorEntity = testFixture.entityManager.getEntity(actor);

      // Get actor's lying position
      const actorLying = actorEntity?.components['positioning:lying_down'];
      if (!actorLying) return [];

      // Get actor's closeness partners
      const actorCloseness = actorEntity?.components['positioning:closeness'];
      if (!actorCloseness?.partners) return [];

      // Filter partners by criteria
      const validPartners = actorCloseness.partners.filter((partnerId) => {
        const partnerEntity = testFixture.entityManager.getEntity(partnerId);
        if (!partnerEntity) return false;

        // Check lying position
        const partnerLying = partnerEntity.components['positioning:lying_down'];
        if (!partnerLying) return false;

        // Check same furniture
        if (actorLying.furniture_id !== partnerLying.furniture_id) return false;

        // Check mutual closeness
        const partnerCloseness = partnerEntity.components['positioning:closeness'];
        if (!partnerCloseness?.partners?.includes(actor)) return false;

        // Check for testicle anatomy
        const partnerBody = partnerEntity.components['anatomy:body'];
        if (!partnerBody?.slots) return false;

        const hasLeftTesticle = !!partnerBody.slots.left_testicle;
        const hasRightTesticle = !!partnerBody.slots.right_testicle;
        if (!hasLeftTesticle && !hasRightTesticle) return false;

        // Check at least one testicle is uncovered
        const leftUncovered = hasLeftTesticle &&
          (!partnerBody.slots.left_testicle.covered_by ||
           partnerBody.slots.left_testicle.covered_by.length === 0);
        const rightUncovered = hasRightTesticle &&
          (!partnerBody.slots.right_testicle.covered_by ||
           partnerBody.slots.right_testicle.covered_by.length === 0);

        if (!leftUncovered && !rightUncovered) return false;

        // Check not currently fucking actor vaginally
        const fuckingVaginally = partnerEntity.components['positioning:fucking_vaginally'];
        if (fuckingVaginally?.targetId === actor) return false;

        return true;
      });

      return validPartners;
    }

    return originalResolver(scopeId, context);
  };

  // Return cleanup function
  return () => {
    testFixture.testEnv.scopeResolver.resolve = originalResolver;
  };
}
```

**Key Requirements**:
- Default scenario: Valid state with all preconditions met
- Options for negative test scenarios (toggle each precondition)
- Supports both testicles with independent coverage control
- Scope override implements same logic as actual scope file
- Includes test for `fucking_vaginally` constraint
- Cleanup function for proper test teardown

### Test File 2: Action Discovery Tests

**File**: `tests/integration/mods/sex-penile-oral/lick_testicles_lying_close_action_discovery.test.js`

**Purpose**: Verify the action appears in the discovery system only when all preconditions are met

**Test Structure**:
```javascript
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildLickTesticlesLyingCloseScenario,
  installLyingCloseUncoveredTesticleScopeOverride,
} from '../../../common/mods/sex-penile-oral/lickTesticlesLyingCloseFixtures.js';
import lickTesticlesLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/lick_testicles_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:lick_testicles_lying_close';

/**
 * Configures action discovery for test scenarios.
 *
 * @param {import('../../../common/mods/ModTestFixture.js').ModTestFixture} fixture - Test fixture instance
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([lickTesticlesLyingCloseAction]);
}

describe('sex-penile-oral:lick_testicles_lying_close action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installLyingCloseUncoveredTesticleScopeOverride(testFixture);
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
  it('appears when both participants are lying close with uncovered testicles', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe("lick {target}'s testicles sensually");
  });

  // Positive test case - only one testicle uncovered
  it('appears when only one testicle remains uncovered', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      coverLeftTesticle: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
  });

  // Negative test cases
  it('does NOT appear when both testicles are covered', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      coverLeftTesticle: true,
      coverRightTesticle: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when actor is not lying down', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      includeActorLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when primary is not lying down', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      includePrimaryLying: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when mutual closeness is not established', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when participants are on different furniture', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      useDifferentFurniture: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when actor has giving_blowjob component', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      actorGivingBlowjob: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does NOT appear when target is fucking actor vaginally', async () => {
    const { entities, actorId } = buildLickTesticlesLyingCloseScenario({
      targetFuckingActor: true,
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
1. ✅ **Positive**: Action appears when all preconditions met (both testicles uncovered)
2. ✅ **Positive**: Action appears when only one testicle uncovered
3. ❌ **Both testicles covered**: Action blocked when both testicles are covered
4. ❌ **Actor not lying**: Action blocked when actor lacks lying_down component
5. ❌ **Primary not lying**: Action blocked when primary lacks lying_down component
6. ❌ **No closeness**: Action blocked when mutual closeness not established
7. ❌ **Different furniture**: Action blocked when on different furniture pieces
8. ❌ **Forbidden component**: Action blocked when actor has giving_blowjob component
9. ❌ **Sexual conflict**: Action blocked when target is fucking actor vaginally

### Test File 3: Action Execution Tests

**File**: `tests/integration/mods/sex-penile-oral/lick_testicles_lying_close_action.test.js`

**Purpose**: Verify the rule executes correctly, dispatches proper events, and produces expected narrative output

**Test Structure**:
```javascript
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildLickTesticlesLyingCloseScenario,
  installLyingCloseUncoveredTesticleScopeOverride,
} from '../../../common/mods/sex-penile-oral/lickTesticlesLyingCloseFixtures.js';
import lickTesticlesLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/lick_testicles_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:lick_testicles_lying_close';
const EXPECTED_MESSAGE =
  "Ava licks Nolan's testicles slowly and sensually, coating them with hot saliva.";

/**
 * Configures action discovery for test scenarios.
 *
 * @param {import('../../../common/mods/ModTestFixture.js').ModTestFixture} fixture - Test fixture instance
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([lickTesticlesLyingCloseAction]);
}

describe('sex-penile-oral:lick_testicles_lying_close action execution', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-penile-oral',
      ACTION_ID
    );
    restoreScopeResolver =
      installLyingCloseUncoveredTesticleScopeOverride(testFixture);
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

  it('successfully executes lying-down testicle licking action', async () => {
    expect.hasAssertions();
    const { entities, actorId, primaryId, roomId } =
      buildLickTesticlesLyingCloseScenario();
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
});
```

**Required Test Cases**:
1. ✅ **Success message**: Verifies correct narrative message dispatched
2. ✅ **Perceptible event**: Verifies perceptible event with correct structure
3. ✅ **Turn ended**: Verifies turn_ended event dispatched
4. ✅ **Entity references**: Verifies correct actorId, targetId, locationId in events

## Implementation Checklist

### Phase 1: File Creation (Order Matters)

- [ ] **Step 1**: Create scope file `actors_lying_close_with_uncovered_testicle.scope`
  - Location: `data/mods/sex-core/scopes/`
  - Validate: Logic checks for lying_down, same furniture_id, testicle anatomy, coverage, and sexual conflict
  - Update `sex-core` mod manifest

- [ ] **Step 2**: Create condition file `event-is-action-lick-testicles-lying-close.condition.json`
  - ⚠️ Critical: Use hyphens in filename
  - Validate: Action ID in logic uses underscores
  - Update `sex-penile-oral` mod manifest

- [ ] **Step 3**: Create action file `lick_testicles_lying_close.action.json`
  - Validate: All component namespaces correct
  - Validate: Scope reference matches new scope file
  - Validate: Uses `target` placeholder
  - Validate: Visual properties match mod standards
  - Update `sex-penile-oral` mod manifest

- [ ] **Step 4**: Create rule file `handle_lick_testicles_lying_close.rule.json`
  - Validate: Condition reference uses hyphens
  - Validate: Uses `primary` entity reference but stores in `targetName`
  - Validate: Message matches exactly: "{actor} licks {target}'s testicles slowly and sensually, coating them with hot saliva."
  - Update `sex-penile-oral` mod manifest

### Phase 2: Test Infrastructure

- [ ] **Step 5**: Create fixture file `lickTesticlesLyingCloseFixtures.js`
  - Location: `tests/common/mods/sex-penile-oral/`
  - Implement `buildLickTesticlesLyingCloseScenario()` with all options
  - Implement `installLyingCloseUncoveredTesticleScopeOverride()`
  - Test fixture returns all required IDs
  - Support independent testicle coverage control

- [ ] **Step 6**: Create action discovery test file
  - Location: `tests/integration/mods/sex-penile-oral/lick_testicles_lying_close_action_discovery.test.js`
  - Import fixture functions
  - Implement 9 test cases (2 positive, 7 negative)
  - Verify cleanup in afterEach

- [ ] **Step 7**: Create action execution test file
  - Location: `tests/integration/mods/sex-penile-oral/lick_testicles_lying_close_action.test.js`
  - Import ModAssertionHelpers
  - Implement 1+ test case (success message and perceptible event)
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
  npx eslint tests/integration/mods/sex-penile-oral/lick_testicles_lying_close_*.test.js tests/common/mods/sex-penile-oral/lickTesticlesLyingCloseFixtures.js
  ```
  - Fixes code style issues
  - Ensures test file conventions

- [ ] **Step 10**: Run tests
  ```bash
  NODE_ENV=test npm run test:integration -- tests/integration/mods/sex-penile-oral/lick_testicles_lying_close_action_discovery.test.js --no-coverage --silent
  NODE_ENV=test npm run test:integration -- tests/integration/mods/sex-penile-oral/lick_testicles_lying_close_action.test.js --no-coverage --silent
  ```
  - Verifies all test cases pass
  - Checks coverage meets requirements

### Phase 4: Final Verification

- [ ] **Step 11**: Verify naming conventions
  - Scope file: underscores ✅
  - Action file: underscores ✅
  - Rule file: underscores ✅
  - Condition file: hyphens ✅
  - Test files: underscores ✅
  - Fixture file: camelCase ✅

- [ ] **Step 12**: Verify ID consistency
  - Action ID same across action, rule, tests
  - Condition ID uses hyphens in file reference
  - Scope reference matches new scope file
  - Placeholder uses `target` consistently

- [ ] **Step 13**: Visual consistency check
  - Colors match other sex-penile-oral actions
  - Template format matches existing patterns
  - Message style consistent with mod voice

## Common Pitfalls & Solutions

### Pitfall 1: Filename Convention Mismatch
**Problem**: Using underscores in condition filename
**Solution**: Always use hyphens for condition files, even when action uses underscores
**Example**: ❌ `event-is-action-lick_testicles_lying_close.condition.json` → ✅ `event-is-action-lick-testicles-lying-close.condition.json`

### Pitfall 2: Placeholder vs Entity Reference Confusion
**Problem**: Mismatching placeholder `{target}` with entity ref `primary`
**Solution**: Action uses `{target}` placeholder, but internally references `primary` entity, storing name in `targetName` variable
**Example**:
- Action template: `lick {target}'s testicles sensually`
- Rule GET_NAME: `entity_ref: "primary", result_variable: "targetName"`
- Rule SET_VARIABLE for targetId: `{event.payload.primaryId}`

### Pitfall 3: Testicle Coverage Logic Incomplete
**Problem**: Only checking one testicle or missing the OR logic
**Solution**: Must check BOTH testicles exist and that AT LEAST ONE is uncovered using OR logic
**Example**:
```json
{
  "or": [
    {"not": {"isSocketCovered": [".", "left_testicle"]}},
    {"not": {"isSocketCovered": [".", "right_testicle"]}}
  ]
}
```

### Pitfall 4: Missing Sexual Conflict Check
**Problem**: Not checking if target is currently having sex with actor
**Solution**: Add check to exclude targets with `fucking_vaginally` component targeting the actor
**Example**: See scope structure above with `fucking_vaginally` check

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

### Pitfall 6: Furniture ID Comparison Missing
**Problem**: Not checking that both actors are on the same furniture
**Solution**: Compare `furniture_id` values between actor and target lying_down components
**Example**: See scope structure with furniture_id equality check

## Reference Documentation

### Related Files to Review
- **Glans lying variant**: `lick_glans_lying_close.action.json` and corresponding rule/tests
- **Testicle sitting variant**: `lick_testicles_sitting_close.action.json` and corresponding rule/tests
- **Testicle kneeling variant**: `lick_testicles_sensually.action.json` and corresponding rule/tests
- **Penis lying scope**: `sex-core:actors_lying_close_with_uncovered_penis.scope`
- **Testicle sitting scope**: `sex-core:actors_sitting_close_with_uncovered_testicle.scope`
- **Test guide**: `docs/testing/mod-testing-guide.md`

### Key Patterns
- **lying_close actions**: Require same furniture_id, more complex scope logic
- **sitting_close actions**: No furniture matching, simpler scope
- **testicle anatomy**: Requires checking BOTH left and right testicles with OR logic
- **Component namespacing**: Always use `modId:componentName` format
- **Test fixtures**: One fixture file per action, reusable scenario builders

## Success Criteria

✅ **Implementation Complete When**:
1. Scope file created with furniture matching and testicle checks
2. All 4 JSON files created and schema-valid
3. All 9 discovery test cases pass
4. All execution test cases pass
5. Naming conventions verified correct
6. Linting passes with no errors
7. Visual properties match mod standards
8. Message formatting matches user specification exactly

✅ **Quality Metrics**:
- Test coverage: 100% of action/rule logic
- Schema validation: All files pass
- Integration tests: All scenarios covered (2 positive + 7 negative)
- Code style: ESLint compliant
- Documentation: Inline comments explain complex logic

## Maintenance Notes

### Future Considerations
- If positioning system changes, update scope logic and tests
- If new forbidden states added, add corresponding negative test cases
- If message formatting changes, update EXPECTED_MESSAGE constant
- Keep fixture scenario builder in sync with actual component schemas
- If new testicle-related components added, update scope and tests

### Related Systems
- **Positioning System**: `data/mods/positioning/` - defines lying_down, closeness components
- **Anatomy System**: `data/mods/anatomy/` - defines testicle body parts and coverage
- **Furniture System**: `data/mods/furniture/` - defines allows_lying property
- **Perception System**: `src/perception/` - handles perceptible_event dispatching
- **Sexual Positioning**: Various `positioning:` components track sexual interactions

---

**Specification Version**: 1.0
**Created**: 2025-11-09
**Status**: Ready for Implementation
