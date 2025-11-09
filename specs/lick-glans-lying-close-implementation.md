# Specification: Lick Glans (Lying Close) Action/Rule Implementation

## Overview

This specification defines the implementation requirements for a new action/rule combination that allows characters to lick their partner's glans while both are lying down in close proximity. This action extends the existing glans-licking mechanics to support lying positions, complementing the existing sitting and kneeling variants.

## Implementation Files

### 1. Action Definition

**File**: `data/mods/sex-penile-oral/actions/lick_glans_lying_close.action.json`

**Schema**: `schema://living-narrative-engine/action.schema.json`

**Action ID**: `sex-penile-oral:lick_glans_lying_close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-penile-oral:lick_glans_lying_close",
  "name": "Lick glans (lying close)",
  "description": "Lick a partner's glans while both are lying close together. Requires both participants to be lying down with mutual closeness. The partner must have an exposed penis.",
  "targets": {
    "primary": {
      "scope": "sex-core:actors_lying_close_with_uncovered_penis",
      "placeholder": "primary",
      "description": "Partner lying close with an exposed penis"
    }
  },
  "template": "lick {primary}'s glans",
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
- Visual properties match sex-penile-oral mod standards

### 2. Condition File

**File**: `data/mods/sex-penile-oral/conditions/event-is-action-lick-glans-lying-close.condition.json`

**Critical**: Use hyphens in filename, even though action uses underscores

**Schema**: `schema://living-narrative-engine/condition.schema.json`

**Condition ID**: `sex-penile-oral:event-is-action-lick-glans-lying-close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-penile-oral:event-is-action-lick-glans-lying-close",
  "description": "Checks if the triggering event is for the 'sex-penile-oral:lick_glans_lying_close' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex-penile-oral:lick_glans_lying_close"
    ]
  }
}
```

**Key Requirements**:
- Filename uses hyphens (convention for condition files)
- Action ID in logic uses underscores (matches action definition)
- Standard event-matching pattern

### 3. Rule Definition

**File**: `data/mods/sex-penile-oral/rules/handle_lick_glans_lying_close.rule.json`

**Schema**: `schema://living-narrative-engine/rule.schema.json`

**Rule ID**: `sex-penile-oral:handle_lick_glans_lying_close`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "sex-penile-oral:handle_lick_glans_lying_close",
  "comment": "Handles the lick_glans_lying_close action: actor licks primary's glans while both are lying close together",
  "event_type": "core:attempt_action",
  "condition": "sex-penile-oral:event-is-action-lick-glans-lying-close",
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
        "value": "{context.actorName}, their head before {context.primaryName}'s crotch, licks {context.primaryName}'s glans sensually, coating it in warm saliva."
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
- Uses `primary` entity reference (not `target`) throughout
- Message: `"{actor}, their head before {primary}'s crotch, licks {primary}'s glans sensually, coating it in warm saliva."`
- Perception type: `action_target_general`
- Standard operation sequence: GET_NAME (actor), GET_NAME (primary), QUERY_COMPONENT (actor position), SET_VARIABLE (all needed variables), macro (logSuccessAndEndTurn)

**Message Rationale**:
- "their head before {primary}'s crotch" - establishes lying-down positioning context
- "licks {primary}'s glans sensually" - core action description
- "coating it in warm saliva" - sensory detail specific to this action

## Test Suite Specifications

### Test File 1: Action Discovery Tests

**File**: `tests/integration/mods/sex-penile-oral/lick_glans_lying_close_action_discovery.test.js`

**Purpose**: Verify the action appears in the discovery system only when all preconditions are met

**Test Structure**:
```javascript
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildLickGlansLyingCloseScenario,
  installLyingCloseUncoveredPenisScopeOverride
} from '../../../common/mods/sex-penile-oral/lickGlansLyingCloseFixtures.js';
import lickGlansLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/lick_glans_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:lick_glans_lying_close';

function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([lickGlansLyingCloseAction]);
}

describe('sex-penile-oral:lick_glans_lying_close action discovery', () => {
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
    expect(discovered.template).toBe("lick {primary}'s glans");
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
1. ✅ **Positive**: Action appears when all preconditions met
2. ❌ **Penis covered**: Action blocked when primary penis is covered
3. ❌ **Actor not lying**: Action blocked when actor lacks lying_down component
4. ❌ **Primary not lying**: Action blocked when primary lacks lying_down component
5. ❌ **No closeness**: Action blocked when mutual closeness not established
6. ❌ **Different furniture**: Action blocked when on different furniture pieces
7. ❌ **Forbidden component**: Action blocked when actor has giving_blowjob component

### Test File 2: Action Execution Tests

**File**: `tests/integration/mods/sex-penile-oral/lick_glans_lying_close_action.test.js`

**Purpose**: Verify the rule executes correctly, dispatches proper events, and produces expected narrative output

**Test Structure**:
```javascript
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildLickGlansLyingCloseScenario,
  installLyingCloseUncoveredPenisScopeOverride
} from '../../../common/mods/sex-penile-oral/lickGlansLyingCloseFixtures.js';
import lickGlansLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/lick_glans_lying_close.action.json';

const ACTION_ID = 'sex-penile-oral:lick_glans_lying_close';
const EXPECTED_MESSAGE = "Ava, their head before Nolan's crotch, licks Nolan's glans sensually, coating it in warm saliva.";

function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([lickGlansLyingCloseAction]);
}

describe('sex-penile-oral:lick_glans_lying_close action execution', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad('sex-penile-oral', ACTION_ID);
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

  it('dispatches the lying-down glans licking narration and perceptible event', async () => {
    const { entities, actorId, primaryId, roomId } = buildLickGlansLyingCloseScenario();
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

  it('ends the turn after execution', async () => {
    const { entities, actorId, primaryId } = buildLickGlansLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const turnEndedEvent = testFixture.events.find(
      (e) => e.type === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
  });

  it('includes correct entity references in perceptible event', async () => {
    const { entities, actorId, primaryId, roomId } = buildLickGlansLyingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.type === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.actorId).toBe(actorId);
    expect(perceptibleEvent.payload.targetId).toBe(primaryId);
    expect(perceptibleEvent.payload.locationId).toBe(roomId);
  });
});
```

**Required Test Cases**:
1. ✅ **Success message**: Verifies correct narrative message dispatched
2. ✅ **Perceptible event**: Verifies perceptible event with correct structure
3. ✅ **Turn ended**: Verifies turn_ended event dispatched
4. ✅ **Entity references**: Verifies correct actorId, targetId, locationId in events

### Test Fixture File

**File**: `tests/common/mods/sex-penile-oral/lickGlansLyingCloseFixtures.js`

**Purpose**: Provide reusable scenario builders and scope override functions for testing

**Structure**:
```javascript
/**
 * Builds a complete scenario for testing lick_glans_lying_close action.
 * Creates two characters (Ava and Nolan) lying on the same bed with proper components.
 *
 * @param {Object} options - Configuration options
 * @param {boolean} [options.coverPrimaryPenis=false] - If true, covers primary's penis with clothing
 * @param {boolean} [options.includeActorLying=true] - If false, omits actor's lying_down component
 * @param {boolean} [options.includePrimaryLying=true] - If false, omits primary's lying_down component
 * @param {boolean} [options.includeCloseness=true] - If false, omits mutual closeness components
 * @param {boolean} [options.useDifferentFurniture=false] - If true, places participants on different furniture
 * @param {boolean} [options.actorGivingBlowjob=false] - If true, adds giving_blowjob component to actor
 * @returns {Object} Scenario data with entities, IDs, and metadata
 */
export function buildLickGlansLyingCloseScenario(options = {}) {
  const {
    coverPrimaryPenis = false,
    includeActorLying = true,
    includePrimaryLying = true,
    includeCloseness = true,
    useDifferentFurniture = false,
    actorGivingBlowjob = false,
  } = options;

  const actorId = 'actor-ava';
  const primaryId = 'primary-nolan';
  const roomId = 'room-bedroom';
  const bedId = 'furniture-bed';
  const secondBedId = 'furniture-bed-2';
  const primaryPenisId = 'body-part-nolan-penis';
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
            penis: {
              part_id: primaryPenisId,
              ...(coverPrimaryPenis && { covered_by: [clothingId] }),
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
    [primaryPenisId]: {
      id: primaryPenisId,
      components: {
        'anatomy:body_part': { type: 'penis' },
      },
    },
    ...(coverPrimaryPenis && {
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
    primaryPenisId,
    ...(coverPrimaryPenis && { clothingId }),
  };
}

/**
 * Installs a scope resolver override for the actors_lying_close_with_uncovered_penis scope.
 * This enables testing without requiring the full scope resolution system.
 *
 * @param {ModTestFixture} testFixture - The test fixture instance
 * @returns {Function} Cleanup function to restore original scope resolver
 */
export function installLyingCloseUncoveredPenisScopeOverride(testFixture) {
  const originalResolver = testFixture.testEnv.scopeResolver.resolve.bind(
    testFixture.testEnv.scopeResolver
  );

  testFixture.testEnv.scopeResolver.resolve = (scopeId, context) => {
    if (scopeId === 'sex-core:actors_lying_close_with_uncovered_penis') {
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

        // Check for penis anatomy
        const partnerBody = partnerEntity.components['anatomy:body'];
        if (!partnerBody?.slots?.penis) return false;

        // Check penis is uncovered
        const penisSlot = partnerBody.slots.penis;
        if (penisSlot.covered_by && penisSlot.covered_by.length > 0) return false;

        // Check not currently fucking actor vaginally
        const fuckingVaginally = partnerEntity.components['positioning:fucking_vaginally'];
        if (fuckingVaginally?.target_id === actor) return false;

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
- Scope override implements same logic as actual `actors_lying_close_with_uncovered_penis.scope` file
- Cleanup function for proper test teardown

## Implementation Checklist

### Phase 1: File Creation (Order Matters)

- [ ] **Step 1**: Create condition file `event-is-action-lick-glans-lying-close.condition.json`
  - ⚠️ Critical: Use hyphens in filename
  - Validate: Action ID in logic uses underscores

- [ ] **Step 2**: Create action file `lick_glans_lying_close.action.json`
  - Validate: All component namespaces correct
  - Validate: Scope reference matches existing scope file
  - Validate: Visual properties match mod standards

- [ ] **Step 3**: Create rule file `handle_lick_glans_lying_close.rule.json`
  - Validate: Condition reference uses hyphens
  - Validate: Uses `primary` entity reference (not `target`)
  - Validate: Message interpolates actor/primary names correctly

### Phase 2: Test Infrastructure

- [ ] **Step 4**: Create fixture file `lickGlansLyingCloseFixtures.js`
  - Location: `tests/common/mods/sex-penile-oral/`
  - Implement `buildLickGlansLyingCloseScenario()` with all options
  - Implement `installLyingCloseUncoveredPenisScopeOverride()`
  - Test fixture returns all required IDs

- [ ] **Step 5**: Create action discovery test file
  - Location: `tests/integration/mods/sex-penile-oral/lick_glans_lying_close_action_discovery.test.js`
  - Import fixture functions
  - Implement 7 test cases (1 positive, 6 negative)
  - Verify cleanup in afterEach

- [ ] **Step 6**: Create action execution test file
  - Location: `tests/integration/mods/sex-penile-oral/lick_glans_lying_close_action.test.js`
  - Import ModAssertionHelpers
  - Implement 4 test cases (success message, perceptible event, turn end, entity refs)
  - Verify cleanup in afterEach

### Phase 3: Validation

- [ ] **Step 7**: Run schema validation
  ```bash
  npm run validate
  ```
  - Verifies all JSON files are valid
  - Checks schema references resolve
  - Validates component namespacing

- [ ] **Step 8**: Run linting
  ```bash
  npx eslint tests/integration/mods/sex-penile-oral/lick_glans_lying_close_*.test.js tests/common/mods/sex-penile-oral/lickGlansLyingCloseFixtures.js
  ```
  - Fixes code style issues
  - Ensures test file conventions

- [ ] **Step 9**: Run tests
  ```bash
  npm run test:integration -- tests/integration/mods/sex-penile-oral/lick_glans_lying_close_action_discovery.test.js
  npm run test:integration -- tests/integration/mods/sex-penile-oral/lick_glans_lying_close_action.test.js
  ```
  - Verifies all test cases pass
  - Checks coverage meets requirements

### Phase 4: Final Verification

- [ ] **Step 10**: Verify naming conventions
  - Action file: underscores ✅
  - Rule file: underscores ✅
  - Condition file: hyphens ✅
  - Test files: underscores ✅
  - Fixture file: camelCase ✅

- [ ] **Step 11**: Verify ID consistency
  - Action ID same across action, rule, tests
  - Condition ID uses hyphens in file reference
  - Scope reference matches existing scope file

- [ ] **Step 12**: Visual consistency check
  - Colors match other sex-penile-oral actions
  - Template format matches existing patterns
  - Message style consistent with mod voice

## Common Pitfalls & Solutions

### Pitfall 1: Filename Convention Mismatch
**Problem**: Using underscores in condition filename
**Solution**: Always use hyphens for condition files, even when action uses underscores
**Example**: ❌ `event-is-action-lick_glans_lying_close.condition.json` → ✅ `event-is-action-lick-glans-lying-close.condition.json`

### Pitfall 2: Entity Reference Confusion
**Problem**: Using `target` instead of `primary` in rules
**Solution**: Check action definition - if it uses `primary` target, rule must use `primary` entity ref
**Example**: ✅ `event.payload.primaryId` not ❌ `event.payload.targetId`

### Pitfall 3: Scope Override Logic Incomplete
**Problem**: Scope override doesn't match actual scope file logic
**Solution**: Review `actors_lying_close_with_uncovered_penis.scope` and implement all checks:
- Same furniture_id
- Mutual closeness partners
- Penis anatomy present
- Penis uncovered
- Not fucking vaginally

### Pitfall 4: Test Cleanup Missing
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

### Pitfall 5: Message Interpolation Errors
**Problem**: Using wrong context variable names in messages
**Solution**: Use `{context.actorName}` and `{context.primaryName}`, not bare `{actor}` or `{primary}`
**Example**: ✅ `{context.actorName}` not ❌ `{actorName}`

## Reference Documentation

### Related Files to Review
- **Sitting variant**: `lick_glans_sitting_close.action.json` and corresponding rule/tests
- **Lying variant example**: `breathe_teasingly_on_penis_lying_close.action.json` and tests
- **Scope definition**: `sex-core:actors_lying_close_with_uncovered_penis.scope`
- **Test guide**: `docs/testing/mod-testing-guide.md`

### Key Patterns
- **lying_close actions**: Require same furniture_id, more complex scope logic
- **sitting_close actions**: No furniture matching, simpler scope
- **Component namespacing**: Always use `modId:componentName` format
- **Test fixtures**: One fixture file per action, reusable scenario builders

## Success Criteria

✅ **Implementation Complete When**:
1. All 3 JSON files created and schema-valid
2. All 7 discovery test cases pass
3. All 4 execution test cases pass
4. Naming conventions verified correct
5. Linting passes with no errors
6. Visual properties match mod standards
7. Message formatting consistent with mod voice

✅ **Quality Metrics**:
- Test coverage: 100% of action/rule logic
- Schema validation: All files pass
- Integration tests: All scenarios covered (positive + 6 negative)
- Code style: ESLint compliant
- Documentation: Inline comments explain complex logic

## Maintenance Notes

### Future Considerations
- If positioning system changes, update scope logic and tests
- If new forbidden states added, add corresponding negative test cases
- If message formatting changes, update EXPECTED_MESSAGE constant
- Keep fixture scenario builder in sync with actual component schemas

### Related Systems
- **Positioning System**: `data/mods/positioning/` - defines lying_down, closeness components
- **Anatomy System**: `data/mods/anatomy/` - defines penis body part and coverage
- **Furniture System**: `data/mods/furniture/` - defines allows_lying property
- **Perception System**: `src/perception/` - handles perceptible_event dispatching

---

**Specification Version**: 1.0
**Created**: 2025-11-09
**Last Updated**: 2025-11-09
**Status**: Ready for Implementation
