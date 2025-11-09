# Breathe Teasingly on Penis (Lying Close) Specification

## Overview

Introduce a lying-down variation of the teasing breath interaction so partners who are already lying close together can engage without requiring a kneeling or sitting position. The new action should mirror the existing `sex-penile-oral:breathe_teasingly_on_penis` flow while adopting the lying-down requirements and proximity checks for shared furniture.

## Reference Patterns and Constraints

- **Current teasing actions** – Use `sex-penile-oral:breathe_teasingly_on_penis` as the baseline for schema layout, visual palette, and narrative structure.【F:data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis.action.json†L1-L27】【F:data/mods/sex-penile-oral/rules/handle_breathe_teasingly_on_penis.rule.json†L1-L56】
- **Sitting close variant** – Reference `sex-penile-oral:breathe_teasingly_on_penis_sitting_close` for the pattern of checking shared positioning state and uncovered anatomy.【F:data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_sitting_close.action.json†L1-L28】【F:data/mods/sex-penile-oral/rules/handle_breathe_teasingly_on_penis_sitting_close.rule.json†L1-L63】
- **Lying down component** – Examine `positioning:lying_down` to understand the `furniture_id` property that tracks which furniture entity the actor is lying upon.【F:data/mods/positioning/components/lying_down.component.json†L1-L45】
- **Closeness checking** – Follow the closeness partner filtering used by `sex-core:actors_sitting_close_with_uncovered_penis` to ensure both actors share a closeness bond.【F:data/mods/sex-core/scopes/actors_sitting_close_with_uncovered_penis.scope†L1-L12】
- **Component field comparison** – Use the pattern from `sex-core:actor_kneeling_before_target_with_penis` which checks `actor.components.positioning:kneeling_before.entityId` against `id` for positional validation.【F:data/mods/sex-core/scopes/actor_kneeling_before_target_with_penis.scope†L7-L12】
- **Uncovered penis checks** – Follow the uncovered anatomy gating implemented by `sex-core:actor_kneeling_before_target_with_penis` to ensure the primary target both has a penis and that it is exposed.【F:data/mods/sex-core/scopes/actor_kneeling_before_target_with_penis.scope†L4-L6】

## Scope Requirements

Create `data/mods/sex-core/scopes/actors_lying_close_with_uncovered_penis.scope` (final name may vary but must stay within the sex namespace) to supply the action's `targets.primary.scope` value.

1. Start from `actor.components.positioning:closeness.partners` to filter through close partners.
2. Require that **both** the actor and the partner own `positioning:lying_down` components, mirroring the pattern used in `positioning:actors_both_sitting_close`.
3. Add a check to ensure both actors are lying on the **same furniture** by comparing:
   ```
   {
     "==": [
       {"var": "actor.components.positioning:lying_down.furniture_id"},
       {"var": "entity.components.positioning:lying_down.furniture_id"}
     ]
   }
   ```
4. Add `hasPartOfType` and `not isSocketCovered` predicates for a penis on the partner, copying the structure used in `sex-core:actor_kneeling_before_target_with_penis`.
5. Include concise comments documenting that the scope is for lying-down, close partners where the partner's penis is exposed and both share the same furniture.
6. Register the new scope file in `data/mods/sex-core/mod-manifest.json`.

### Expected Scope Structure

```
// Scope for lying-down partners sharing the same furniture where the target has an uncovered penis
// Used by actions requiring both actors to be lying down close together with exposed anatomy
sex-core:actors_lying_close_with_uncovered_penis := actor.components.positioning:closeness.partners[][{
  "and": [
    {"!!": {"var": "entity.components.positioning:lying_down"}},
    {"!!": {"var": "actor.components.positioning:lying_down"}},
    {
      "==": [
        {"var": "actor.components.positioning:lying_down.furniture_id"},
        {"var": "entity.components.positioning:lying_down.furniture_id"}
      ]
    },
    {"hasPartOfType": [".", "penis"]},
    {"not": {"isSocketCovered": [".", "penis"]}}
  ]
}]
```

## Action Requirements

Author `data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_lying_close.action.json` (final ID should be `sex-penile-oral:breathe_teasingly_on_penis_lying_close`).

- `$schema`: `schema://living-narrative-engine/action.schema.json`.
- `id`: `sex-penile-oral:breathe_teasingly_on_penis_lying_close`.
- `name`: "Breathe Teasingly on Penis (Lying Close)".
- `description`: Emphasize breathing teasingly on the partner's penis while lying down close together on shared furniture.
- `targets.primary`: Reference the new lying-down scope (`sex-core:actors_lying_close_with_uncovered_penis`), use placeholder `primary`, and describe the lying-down, penis-bearing partner requirement.
- `required_components`:
  - `actor`: `["positioning:lying_down", "positioning:closeness"]`
  - `primary`: `["positioning:lying_down", "positioning:closeness"]`
- `forbidden_components`:
  - `actor`: `["positioning:giving_blowjob"]`
- `template`: **Exactly** `breathe teasingly on {primary}'s penis` (note the `{primary}` placeholder).
- `prerequisites`: Keep an empty array consistent with other variants unless additional blockers emerge.
- `visual`: Reuse the purple palette from the other variants for continuity:
  ```json
  {
    "backgroundColor": "#2a1a5e",
    "textColor": "#ede7f6",
    "hoverBackgroundColor": "#372483",
    "hoverTextColor": "#ffffff"
  }
  ```
- Add the action file path to `data/mods/sex-penile-oral/mod-manifest.json`.

## Rule Requirements

Implement `data/mods/sex-penile-oral/rules/handle_breathe_teasingly_on_penis_lying_close.rule.json` alongside a matching condition file `data/mods/sex-penile-oral/conditions/event-is-action-breathe-teasingly-on-penis-lying-close.condition.json`.

1. Base the rule on the sitting variant: `event_type` is `core:attempt_action`, and the single condition ensures the rule only triggers for the new action ID.【F:data/mods/sex-penile-oral/rules/handle_breathe_teasingly_on_penis_sitting_close.rule.json†L1-L63】
2. Retrieve `actorName` and `primaryName` via `GET_NAME` calls (`entity_ref` values `actor` and `primary` respectively).
3. Query the actor's `core:position` component into `actorPosition` for logging metadata.
4. Set `logMessage` to:
   ```
   {actor} moves their head to {primary}'s crotch and breathes teasingly on {primary}'s penis, the hot breath ghosting against the delicate skin.
   ```
   **Note**: Use this exact string with placeholders `{context.actorName}` and `{context.primaryName}`.
5. Set `perceptionType` to `action_target_general`, copy the location resolution, and populate `actorId` / `targetId` using `{event.payload.actorId}` and `{event.payload.primaryId}` to align with the `{primary}` placeholder conventions.
6. Finish with the `core:logSuccessAndEndTurn` macro.
7. Add both the new rule and condition files to the `sex-penile-oral` mod manifest.

### Condition File Structure

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-penile-oral:event-is-action-breathe-teasingly-on-penis-lying-close",
  "description": "Checks if the triggering event is for the 'sex-penile-oral:breathe_teasingly_on_penis_lying_close' action.",
  "logic": {
    "==": [
      {
        "var": "event.payload.actionId"
      },
      "sex-penile-oral:breathe_teasingly_on_penis_lying_close"
    ]
  }
}
```

### Rule File Structure

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_breathe_teasingly_on_penis_lying_close",
  "comment": "Handles the 'sex-penile-oral:breathe_teasingly_on_penis_lying_close' action. Dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex-penile-oral:event-is-action-breathe-teasingly-on-penis-lying-close"
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} moves their head to {context.primaryName}'s crotch and breathes teasingly on {context.primaryName}'s penis, the hot breath ghosting against the delicate skin."
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

## Testing Requirements

Develop comprehensive integration coverage under `tests/integration/mods/sex/` using the practices from the Mod Testing Guide.【F:docs/testing/mod-testing-guide.md†L1-L198】 Reference the sitting close variant tests for consistency.【F:tests/integration/mods/sex/breathe_teasingly_on_penis_sitting_close_action_discovery.test.js†L1-L95】【F:tests/integration/mods/sex/breathe_teasingly_on_penis_sitting_close_action.test.js†L1-L73】

### Test Files to Create

1. **`tests/common/mods/sex/breatheTeasinglyOnPenisLyingCloseFixtures.js`** - Shared fixture module containing:
   - Constant definitions for action ID, actor ID, primary ID, room ID, and furniture ID
   - `buildBreatheTeasinglyOnPenisLyingCloseScenario(options)` function that creates:
     - Room entity
     - Furniture entity with `positioning:allows_lying` component
     - Actor entity with configurable `positioning:lying_down` component
     - Primary entity with configurable `positioning:lying_down` component, body parts (torso, groin, penis), and optional clothing
     - Both actors with `positioning:closeness` to each other
   - Scenario options should include:
     - `coverPrimaryPenis` (default: false) - adds clothing covering the penis socket
     - `includeActorLying` (default: true) - adds lying_down component to actor
     - `includePrimaryLying` (default: true) - adds lying_down component to primary
     - `includeCloseness` (default: true) - adds mutual closeness components
     - `useDifferentFurniture` (default: false) - makes primary lie on different furniture
   - `installLyingCloseUncoveredPenisScopeOverride(testFixture)` function that provides a mock scope resolver for testing

2. **`tests/integration/mods/sex/breathe_teasingly_on_penis_lying_close_action_discovery.test.js`** - Action discovery suite covering:

   **Positive Cases:**
   - ✅ Action appears when both participants are lying close on the same furniture with an uncovered penis
   - Should use the correct template: `"breathe teasingly on {primary}'s penis"`

   **Negative Cases:**
   - ❌ Does not appear when the primary's penis is covered by clothing
   - ❌ Does not appear when the actor is not lying down (missing `lying_down` component)
   - ❌ Does not appear when the primary is not lying down
   - ❌ Does not appear without mutual closeness
   - ❌ Does not appear when actors are lying on different furniture (different `furniture_id` values)
   - ❌ Does not appear when the primary doesn't have a penis
   - ❌ Does not appear when the actor has the `positioning:giving_blowjob` forbidden component

3. **`tests/integration/mods/sex/breathe_teasingly_on_penis_lying_close_action.test.js`** - Rule execution suite covering:

   **Rule Behavior:**
   - ✅ Dispatches the correct narration and perceptible event
   - ✅ Expected message matches: `"{actorName} moves their head to {primaryName}'s crotch and breathes teasingly on {primaryName}'s penis, the hot breath ghosting against the delicate skin."`
   - ✅ Perceptible event contains correct metadata:
     - `descriptionText`: Matches the expected message
     - `locationId`: References the room location
     - `actorId`: References the acting actor
     - `targetId`: References the primary target
     - `perceptionType`: Set to `'action_target_general'`
   - ✅ Turn ends after successful action execution (`shouldEndTurn: true`)

### Test Implementation Guidelines

**Fixture Module Pattern:**

```javascript
/**
 * @file Shared fixtures for the breathe teasingly on penis (lying close) action suites.
 * @description Provides reusable builders and scope overrides for lying-down teasing scenarios
 * where partners share close proximity on the same furniture and the primary's penis must be exposed.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

export const BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ACTION_ID =
  'sex-penile-oral:breathe_teasingly_on_penis_lying_close';

export const BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ACTOR_ID = 'ava';
export const BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_PRIMARY_ID = 'nolan';
export const BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ROOM_ID = 'bedroom1';
export const BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_FURNITURE_ID = 'bed1';

/**
 * @typedef {object} BreatheTeasinglyLyingScenarioOptions
 * @property {boolean} [coverPrimaryPenis=false] - Whether clothing should cover the primary's penis.
 * @property {boolean} [includeActorLying=true] - Whether the actor should have a lying_down component.
 * @property {boolean} [includePrimaryLying=true] - Whether the primary should have a lying_down component.
 * @property {boolean} [includeCloseness=true] - Whether both actors should have closeness toward each other.
 * @property {boolean} [useDifferentFurniture=false] - Whether the primary should lie on different furniture.
 */

export function buildBreatheTeasinglyOnPenisLyingCloseScenario(options = {}) {
  // Implementation similar to sitting close fixture
  // Build entities with lying_down components instead of sitting_on
  // Check furniture_id values for same/different furniture scenarios
}

export function installLyingCloseUncoveredPenisScopeOverride(testFixture) {
  // Override scope resolver to filter for:
  // - Both actors have lying_down components
  // - Same furniture_id values
  // - Target has uncovered penis
}
```

**Discovery Test Pattern:**

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ACTION_ID as ACTION_ID,
  BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ACTOR_ID as ACTOR_ID,
  buildBreatheTeasinglyOnPenisLyingCloseScenario,
  installLyingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex/breatheTeasinglyOnPenisLyingCloseFixtures.js';
import breatheTeasinglyOnPenisLyingCloseAction from '../../../../data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_lying_close.action.json';

describe('sex-penile-oral:breathe_teasingly_on_penis_lying_close action discovery', () => {
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

  // Test cases here
});
```

**Rule Execution Test Pattern:**

```javascript
import { describe, it, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ACTION_ID as ACTION_ID,
  BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ACTOR_ID as ACTOR_ID,
  BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_PRIMARY_ID as PRIMARY_ID,
  BREATHE_TEASINGLY_ON_PENIS_LYING_CLOSE_ROOM_ID as ROOM_ID,
  buildBreatheTeasinglyOnPenisLyingCloseScenario,
  installLyingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex/breatheTeasinglyOnPenisLyingCloseFixtures.js';

const EXPECTED_MESSAGE =
  "Ava moves their head to Nolan's crotch and breathes teasingly on Nolan's penis, the hot breath ghosting against the delicate skin.";

describe('sex-penile-oral:breathe_teasingly_on_penis_lying_close action integration', () => {
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

  it('dispatches the lying-down teasing narration and perceptible event', async () => {
    const { entities } = buildBreatheTeasinglyOnPenisLyingCloseScenario();
    testFixture.reset(entities);

    await testFixture.executeAction(ACTOR_ID, PRIMARY_ID, {
      additionalPayload: { primaryId: PRIMARY_ID },
    });

    ModAssertionHelpers.assertActionSuccess(testFixture.events, EXPECTED_MESSAGE, {
      shouldEndTurn: true,
      shouldHavePerceptibleEvent: true,
    });

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: ROOM_ID,
      actorId: ACTOR_ID,
      targetId: PRIMARY_ID,
      perceptionType: 'action_target_general',
    });
  });
});
```

### Test Coverage Goals

- **Action Discovery**: 8+ test cases covering all positive and negative scenarios
- **Rule Execution**: 1+ test case verifying correct message formatting and event metadata
- **Fixture Reusability**: Scenario builder should support all edge cases through options
- **Scope Override**: Mock resolver should accurately simulate the real scope behavior

### Test Execution

Run the following commands to verify test coverage:

```bash
# Run integration tests for this action
NODE_ENV=test npm run test:integration -- tests/integration/mods/sex/breathe_teasingly_on_penis_lying_close*.test.js --no-coverage --silent

# Run all sex mod integration tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/sex/ --silent

# Full integration test suite
npm run test:integration
```

## Acceptance Criteria

- ✅ Scope guarantees both actors are lying down close together on the **same furniture** and that the primary's penis is uncovered before exposing the action.
- ✅ Scope correctly compares `furniture_id` values between actor and primary to ensure shared furniture.
- ✅ Action, condition, and rule JSON validate against their schemas, reuse the required component patterns, and deliver the specified narrative template/message.
- ✅ Action requires `positioning:lying_down` and `positioning:closeness` for both actor and primary.
- ✅ Action forbids `positioning:giving_blowjob` on the actor.
- ✅ Rule produces the exact message: `"{actor} moves their head to {primary}'s crotch and breathes teasingly on {primary}'s penis, the hot breath ghosting against the delicate skin."`
- ✅ Sex mod manifest registers the new assets so discovery and execution pipelines can load them.
- ✅ Integration suites cover discovery gating (including furniture matching) and rule execution behaviors using the modern testing fixtures.
- ✅ All integration tests pass with proper cleanup in `afterEach` blocks.
- ✅ Fixture module provides reusable scenario builders with comprehensive options for edge case testing.
- ✅ Scope override accurately mocks the real scope behavior for testing purposes.

## File Checklist

**Content Files:**
- [ ] `data/mods/sex-core/scopes/actors_lying_close_with_uncovered_penis.scope`
- [ ] `data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_lying_close.action.json`
- [ ] `data/mods/sex-penile-oral/conditions/event-is-action-breathe-teasingly-on-penis-lying-close.condition.json`
- [ ] `data/mods/sex-penile-oral/rules/handle_breathe_teasingly_on_penis_lying_close.rule.json`

**Test Files:**
- [ ] `tests/common/mods/sex/breatheTeasinglyOnPenisLyingCloseFixtures.js`
- [ ] `tests/integration/mods/sex/breathe_teasingly_on_penis_lying_close_action_discovery.test.js`
- [ ] `tests/integration/mods/sex/breathe_teasingly_on_penis_lying_close_action.test.js`

**Manifest Updates:**
- [ ] Add scope to `data/mods/sex-core/mod-manifest.json`
- [ ] Add action, condition, and rule to `data/mods/sex-penile-oral/mod-manifest.json`

## Implementation Notes

1. **Furniture ID Matching**: The critical differentiator from the sitting variant is the furniture_id comparison ensuring both actors are on the same furniture entity. This prevents the action from appearing when actors are merely close but lying on different beds/furniture.

2. **Closeness Component**: The `positioning:closeness` component establishes the social bond and proximity, while the furniture_id check ensures physical co-location.

3. **Forbidden Components**: The `positioning:giving_blowjob` forbidden component prevents the action from appearing during more advanced oral interactions, maintaining action progression hierarchy.

4. **Message Specificity**: The rule message is more explicit than the sitting variant, describing the head movement and breath sensation to convey the intimacy of the lying-down position.

5. **Visual Consistency**: Maintaining the purple palette (`#2a1a5e` background) across all teasing variants ensures visual cohesion in the action UI.

6. **Test Isolation**: Each test should create a fresh scenario and properly clean up in `afterEach` to prevent state leakage between tests.

## Related Specifications

- [Breathe Teasingly on Penis (Sitting Close) Specification](./breathe-teasingly-on-penis-sitting-close-action.spec.md) - Original sitting variant
- [Mod Testing Guide](../docs/testing/mod-testing-guide.md) - Comprehensive testing patterns
- [Scope Resolver Registry](../docs/testing/scope-resolver-registry.md) - Available scope factories

## Validation Commands

```bash
# Validate schemas and mod structure
npm run validate

# Type check
npm run typecheck

# Run integration tests
npm run test:integration -- tests/integration/mods/sex/breathe_teasingly_on_penis_lying_close*.test.js

# Full test suite
npm run test:ci
```
