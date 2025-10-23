# Pull Penis Out of Mouth Action Specification

## Overview

This specification defines a new action and rule combo for the sex-penile-oral mod that allows an actor currently performing oral sex to slowly withdraw their partner's penis from their mouth, ending the blowjob interaction.

## Action Definition

### Basic Properties

```json
{
  "id": "sex-penile-oral:pull_penis_out_of_mouth",
  "name": "Pull Penis Out of Mouth",
  "description": "Slowly withdraw your partner's penis from your mouth, ending the oral sex interaction with a sensual release.",
  "template": "slowly pull {primary}'s cock out of your mouth"
}
```

### Target Configuration

**Primary Target Scope**: `sex-penile-oral:receiving_blowjob_from_actor`

This is a new scope that must be created. It will resolve to the single entity whose ID matches the reference stored in the actor's `giving_blowjob` component.

```javascript
// Scope definition: sex-penile-oral:receiving_blowjob_from_actor
// Pattern: Similar to hugging_actor.scope
sex-penile-oral:receiving_blowjob_from_actor := positioning:close_actors[{
  "and": [
    {"!!": {"var": "actor.components.positioning:giving_blowjob"}},
    {"!!": {"var": "entity.components.positioning:receiving_blowjob"}},
    {"==": [
      {"var": "actor.components.positioning:giving_blowjob.receiving_entity_id"},
      {"var": "entity.id"}
    ]},
    {"==": [
      {"var": "entity.components.positioning:receiving_blowjob.giving_entity_id"},
      {"var": "actor.id"}
    ]}
  ]
}]
```

**Scope Rationale**: This scope ensures bidirectional validation:
1. Actor must have `giving_blowjob` component
2. Entity must have `receiving_blowjob` component
3. Actor's `receiving_entity_id` must match the entity's ID
4. Entity's `giving_entity_id` must match the actor's ID

This prevents mismatched references and ensures only the correct partner is targeted.

### Component Requirements

```json
{
  "required_components": {
    "actor": [
      "positioning:giving_blowjob",
      "positioning:closeness"
    ]
  },
  "forbidden_components": {},
  "prerequisites": []
}
```

**Component Rationale**:
- `giving_blowjob`: Actor must be actively performing oral sex
- `closeness`: Ensures physical proximity is established (standard for intimate actions)
- No forbidden components: The action should always be available when giving a blowjob
- No prerequisites: Component requirements are sufficient validation

### Visual Scheme

Matches the existing sex-penile-oral action theme:

```json
{
  "visual": {
    "backgroundColor": "#2a1a5e",
    "textColor": "#ede7f6",
    "hoverBackgroundColor": "#372483",
    "hoverTextColor": "#ffffff"
  }
}
```

## Rule Definition

### Rule Properties

```json
{
  "rule_id": "handle_pull_penis_out_of_mouth",
  "comment": "Handles the 'sex-penile-oral:pull_penis_out_of_mouth' action. Removes reciprocal blowjob components from both participants, dispatches descriptive narrative, and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex-penile-oral:event-is-action-pull-penis-out-of-mouth"
  }
}
```

### Rule Operations Sequence

1. **Query Entity Names**
   - Get actor name → `actorName`
   - Get primary name → `primaryName`

2. **Query Actor Position**
   - Get `core:position` component → `actorPosition` (for location ID)

3. **Remove Blowjob State**
   - Remove `positioning:giving_blowjob` from actor
   - Remove `positioning:receiving_blowjob` from primary

4. **Generate Narrative Message**
   - Set `logMessage`: "{actorName} slowly pulls {primaryName}'s cock out of {actorName}'s mouth, a thread of saliva linking the glans to {primaryName}'s lips."

5. **Set Event Metadata**
   - `perceptionType`: "action_target_general"
   - `locationId`: from `actorPosition.locationId`
   - `actorId`: from `event.payload.actorId`
   - `targetId`: from `event.payload.primaryId`

6. **Log Success and End Turn**
   - Use `core:logSuccessAndEndTurn` macro

### Rule Operations (JSON Format)

```json
{
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
        "value": "{context.actorName} slowly pulls {context.primaryName}'s cock out of {context.actorName}'s mouth, a thread of saliva linking the glans to {context.primaryName}'s lips."
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

**Note**: Unlike `handle_take_penis_in_mouth_kneeling`, this rule does NOT need cleanup operations for existing blowjob state on other entities, because it's ending the current interaction, not starting a new one.

## Condition Definition

Create a condition file to filter the action event:

**File**: `data/mods/sex-penile-oral/conditions/event-is-action-pull-penis-out-of-mouth.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-penile-oral:event-is-action-pull-penis-out-of-mouth",
  "description": "Checks if the event is an attempt_action event for pull_penis_out_of_mouth",
  "logic": {
    "and": [
      { "==": [{ "var": "event.type" }, "core:attempt_action"] },
      { "==": [{ "var": "event.payload.actionId" }, "sex-penile-oral:pull_penis_out_of_mouth"] }
    ]
  }
}
```

## Scope File

**File**: `data/mods/sex-penile-oral/scopes/receiving_blowjob_from_actor.scope`

```
// Scope restricting potential targets to the entity currently receiving oral sex from the acting entity
sex-penile-oral:receiving_blowjob_from_actor := positioning:close_actors[{
  "and": [
    {"!!": {"var": "actor.components.positioning:giving_blowjob"}},
    {"!!": {"var": "entity.components.positioning:receiving_blowjob"}},
    {"==": [
      {"var": "actor.components.positioning:giving_blowjob.receiving_entity_id"},
      {"var": "entity.id"}
    ]},
    {"==": [
      {"var": "entity.components.positioning:receiving_blowjob.giving_entity_id"},
      {"var": "actor.id"}
    ]}
  ]
}]
```

## Testing Strategy

### Test Suite 1: Action Discovery

**File**: `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action_discovery.test.js`

#### Test Scenarios

1. **Positive Case: Action Appears When Actor Giving Blowjob**
   - Setup: Actor with `giving_blowjob` component, primary with `receiving_blowjob` component, reciprocal references
   - Expected: Action discovered with correct template

2. **Negative Case: Action Does Not Appear Without giving_blowjob Component**
   - Setup: Actor without `giving_blowjob` component
   - Expected: Action not discovered

3. **Negative Case: Action Does Not Appear Without Closeness**
   - Setup: Actor has `giving_blowjob` but no `closeness` component
   - Expected: Action not discovered

4. **Negative Case: Action Does Not Appear With Mismatched References**
   - Setup: Actor's `giving_blowjob.receiving_entity_id` points to different entity
   - Expected: Action not discovered (scope filter excludes target)

5. **Edge Case: Action Does Not Appear When Target Lacks receiving_blowjob**
   - Setup: Actor has `giving_blowjob` but target missing `receiving_blowjob`
   - Expected: Action not discovered (scope requires both components)

#### Test Structure Template

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import pullPenisOutOfMouthAction from '../../../../data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth.action.json';

const ACTION_ID = 'sex-penile-oral:pull_penis_out_of_mouth';

/**
 * Builds a scenario where the ACTOR is giving a blowjob to PRIMARY.
 *
 * @param {object} options - Configuration options.
 * @param {boolean} options.includeGivingBlowjob - Whether actor has giving_blowjob component.
 * @param {boolean} options.includeCloseness - Whether closeness is established.
 * @param {boolean} options.mismatchedReferences - Whether entity references don't match.
 * @param {boolean} options.targetHasReceivingBlowjob - Whether target has receiving_blowjob.
 * @returns {{entities: Array, actorId: string, primaryId: string}} Scenario data.
 */
function buildPullPenisOutOfMouthScenario(options = {}) {
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

describe('sex-penile-oral:pull_penis_out_of_mouth action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  // Test implementations...
});
```

### Test Suite 2: Action Execution

**File**: `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action.test.js`

#### Test Scenarios

1. **Narrative and Events: Dispatches Correct Message**
   - Setup: Actor giving blowjob to primary
   - Execute: Action
   - Verify:
     - Success event with exact message
     - Perceptible event with correct structure
     - Turn ends

2. **Component Management: Removes Blowjob Components**
   - Setup: Actor with `giving_blowjob`, primary with `receiving_blowjob`
   - Execute: Action
   - Verify:
     - Actor no longer has `giving_blowjob` component
     - Primary no longer has `receiving_blowjob` component

3. **State Isolation: Does Not Affect Other Entities**
   - Setup: Actor giving blowjob to primary, another pair also engaged
   - Execute: Action
   - Verify: Other pair's components unchanged

4. **Event Filtering: Does Not Fire For Different Actions**
   - Setup: Standard blowjob scenario
   - Execute: Different action (e.g., `breathe_teasingly_on_penis`)
   - Verify: No component changes, no narrative dispatch

5. **Integration: Full Workflow**
   - Setup: Start with `take_penis_in_mouth_kneeling` action
   - Verify: Components added correctly
   - Execute: `pull_penis_out_of_mouth` action
   - Verify: Components removed, workflow completes

#### Test Structure Template

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import pullPenisOutOfMouthAction from '../../../../data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-penile-oral:pull_penis_out_of_mouth';
const EXPECTED_MESSAGE =
  "Ava slowly pulls Nolan's cock out of Ava's mouth, a thread of saliva linking the glans to Nolan's lips.";

describe('sex-penile-oral:pull_penis_out_of_mouth action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad('sex-penile-oral', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  // Test implementations...
});
```

## Implementation Checklist

### Files to Create

- [ ] `data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth.action.json`
- [ ] `data/mods/sex-penile-oral/rules/handle_pull_penis_out_of_mouth.rule.json`
- [ ] `data/mods/sex-penile-oral/scopes/receiving_blowjob_from_actor.scope`
- [ ] `data/mods/sex-penile-oral/conditions/event-is-action-pull-penis-out-of-mouth.condition.json`
- [ ] `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action_discovery.test.js`
- [ ] `tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action.test.js`

### Files to Update

- [ ] `data/mods/sex-penile-oral/mod-manifest.json` - Add new action, rule, scope, and condition to manifest

### Validation Steps

- [ ] Run `npm run scope:lint` to validate scope syntax
- [ ] Run `npx eslint` on new test files
- [ ] Run discovery test suite: `NODE_ENV=test npx jest tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action_discovery.test.js`
- [ ] Run execution test suite: `NODE_ENV=test npx jest tests/integration/mods/sex-penile-oral/pull_penis_out_of_mouth_action.test.js`
- [ ] Verify all tests pass with coverage

## Design Rationale

### Scope Design Choice

The scope `receiving_blowjob_from_actor` follows the established pattern from `hugging_actor.scope` because:
1. It resolves to a single, specific entity (not a general filter)
2. It validates bidirectional component references
3. It prevents action discovery when references are mismatched
4. It's semantically clear about the relationship being targeted

### Component Requirements Rationale

**Why only `giving_blowjob` and `closeness`?**
- `giving_blowjob`: Core requirement - actor must be performing oral sex to pull out
- `closeness`: Standard for all intimate actions, ensures physical proximity
- No `kneeling_before` requirement: Actor might be in various positions during oral sex
- No prerequisites: Component presence is sufficient validation

### Rule Simplicity

The rule is simpler than `handle_take_penis_in_mouth_kneeling` because:
- No cleanup of existing blowjob state needed (we're ending, not starting)
- No conditional logic required
- Just removes two components and dispatches narrative
- Follows the "do one thing well" principle

## Integration Points

### Mod Manifest Updates

Add to `data/mods/sex-penile-oral/mod-manifest.json`:

```json
{
  "actions": [
    "sex-penile-oral:pull_penis_out_of_mouth"
  ],
  "rules": [
    "handle_pull_penis_out_of_mouth"
  ],
  "scopes": [
    "sex-penile-oral:receiving_blowjob_from_actor"
  ],
  "conditions": [
    "sex-penile-oral:event-is-action-pull-penis-out-of-mouth"
  ]
}
```

### Related Actions

This action complements:
- `take_penis_in_mouth_kneeling` - Initiation action
- `pull_head_to_bare_penis` - Alternative initiation
- Other oral sex continuation actions (licking, sucking, etc.)

### Component Lifecycle

```
Initial State: No blowjob components
     ↓
Execute: take_penis_in_mouth_kneeling
     ↓
State: Actor has giving_blowjob, Primary has receiving_blowjob
     ↓
Execute: pull_penis_out_of_mouth
     ↓
Final State: Components removed, interaction ended
```

## Success Criteria

- [ ] Action appears only when actor is giving blowjob
- [ ] Scope correctly filters to receiving partner
- [ ] Rule removes both blowjob components
- [ ] Narrative message displays correctly
- [ ] Perceptible event dispatched to location
- [ ] Turn ends after execution
- [ ] All test scenarios pass
- [ ] Code coverage ≥80% for new code
- [ ] Linting passes without errors
- [ ] Scope syntax validates correctly

## Future Enhancements

Potential expansions (not in current scope):
- Variations for different positions (sitting, standing, etc.)
- Consent checking mechanisms
- Mood/reaction variations based on relationship
- Audio/visual feedback in UI
- Integration with satisfaction/arousal systems
