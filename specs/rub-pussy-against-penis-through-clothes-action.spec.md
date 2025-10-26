# Rub Pussy Against Penis Through Clothes Action Specification

**Created:** 2025-01-20
**Status:** Design
**Mod:** sex
**Mature Content:** Yes - This action is designed for mature audiences only

## Table of Contents

1. [System Overview](#system-overview)
2. [Action Definition](#action-definition)
3. [Rule Implementation](#rule-implementation)
4. [Scope Definitions](#scope-definitions)
5. [Condition Definition](#condition-definition)
6. [Implementation Details](#implementation-details)
7. [Testing Strategy](#testing-strategy)
8. [References](#references)

---

## System Overview

### Purpose

Implement a sexual positioning action that allows a female actor who is straddling a sitting target's waist to rub her pussy sensually against the target's penis through the target's clothing. This action combines the straddling positioning system with intimate sexual interaction.

### Core Mechanics

This action introduces:

1. **Action**: `sex-dry-intimacy:rub_pussy_against_penis_through_clothes` - Multi-target action with primary (actor with penis) and secondary (clothing item)
2. **Rule**: `handle_rub_pussy_against_penis_through_clothes` - Processes the action and generates descriptive text
3. **New Scope**: `sex-dry-intimacy:actors_with_penis_facing_straddler_covered` - Filters for valid targets
4. **Condition**: `sex-dry-intimacy:event-is-action-rub-pussy-against-penis-through-clothes` - Action identification

### Design Principles

Following existing sex-dry-intimacy module patterns:

- **Multi-target structure** - Similar to `rub_penis_over_clothes` with primary/secondary targets
- **Clothing integration** - Secondary target resolves to topmost clothing item
- **Straddling requirement** - Requires actor to be straddling target's waist
- **Anatomy validation** - Checks for penis presence and coverage
- **Orientation awareness** - Validates facing orientation through scope
- **Sitting validation** - Ensures target is sitting (required for straddling)

### Context Requirements

This action requires a specific positioning context:

1. **Actor must be straddling target** - Has `positioning:straddling_waist` component
2. **Actors must be close** - Has `positioning:closeness` component
3. **Target must be sitting** - Has `positioning:sitting_on` component
4. **Target must have covered penis** - Anatomy + clothing validation
5. **Actors must be facing each other** - Not in `facing_away` orientation

---

## Action Definition

### `rub_pussy_against_penis_through_clothes.action.json`

**Purpose:** Allow female actor to rub against target's covered penis while straddling.

**Location:** `data/mods/sex-dry-intimacy/actions/rub_pussy_against_penis_through_clothes.action.json`

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-dry-intimacy:rub_pussy_against_penis_through_clothes",
  "name": "Rub Pussy Against Penis Through Clothes",
  "description": "Rub your pussy sensually against the target's penis through their clothing while straddling them.",
  "targets": {
    "primary": {
      "scope": "sex-dry-intimacy:actors_with_penis_facing_straddler_covered",
      "placeholder": "primary",
      "description": "Person with clothed penis to rub against"
    },
    "secondary": {
      "scope": "clothing:target_topmost_torso_lower_clothing_no_accessories",
      "placeholder": "secondary",
      "description": "Clothing item covering the penis",
      "contextFrom": "primary"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness", "positioning:straddling_waist"]
  },
  "template": "rub your pussy sensually against {primary}'s penis through the {secondary}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#4a2741",
    "textColor": "#fce8f5",
    "hoverBackgroundColor": "#5c2f51",
    "hoverTextColor": "#ffffff"
  }
}
```

**Design Notes:**

- **Multi-target structure**: Primary target is the actor with penis, secondary is their clothing
- **Required components**:
  - `positioning:closeness` - Must be in same closeness circle
  - `positioning:straddling_waist` - Must be actively straddling the target
- **No prerequisites**: Assumes positioning prerequisites already satisfied by straddling actions
- **Scope filters**: Primary scope handles all validation (penis, coverage, sitting, orientation)
- **Secondary contextFrom**: Clothing resolution happens in primary's context
- **Visual styling**: Matches other sex-dry-intimacy module actions (purple theme)

---

## Rule Implementation

### `handle_rub_pussy_against_penis_through_clothes.rule.json`

**Purpose:** Handles action execution, generates descriptive text, ends turn.

**Location:** `data/mods/sex-dry-intimacy/rules/handle_rub_pussy_against_penis_through_clothes.rule.json`

**Implementation:**

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_rub_pussy_against_penis_through_clothes",
  "comment": "Handles the 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes' action. Dispatches descriptive text about rubbing pussy against penis through clothes and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "sex-dry-intimacy:event-is-action-rub-pussy-against-penis-through-clothes"
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
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "secondary",
        "result_variable": "clothingName"
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
        "value": "{context.actorName} rubs her pussy sensually against {context.primaryName}'s penis through the {context.clothingName}, feeling the shape and size."
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
        "value": "{event.payload.primaryId}"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**Design Notes:**

- **Follows standard rule pattern**: GET_NAME operations for all entities, then SET_VARIABLE for message
- **Descriptive message**: Emphasizes sensuality and tactile feedback ("feeling the shape and size")
- **Perception type**: Uses `action_target_general` for general audience visibility
- **Location context**: Pulls from actor's position component
- **Target ID**: References primary target (the one with penis)
- **Macro usage**: Standard `core:logSuccessAndEndTurn` for consistent turn ending
- **No state changes**: Pure descriptive action, no component modifications

---

## Scope Definitions

### New Scope: `actors_with_penis_facing_straddler_covered.scope`

**Purpose:** Find actors in closeness circle who:
1. Have penis anatomy
2. Have penis covered by clothing
3. Are NOT facing away from straddler
4. Are currently sitting (have `sitting_on` component)

**Location:** `data/mods/sex-dry-intimacy/scopes/actors_with_penis_facing_straddler_covered.scope`

**Query:**

```
sex-dry-intimacy:actors_with_penis_facing_straddler_covered := actor.components.positioning:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "penis"]},
    {"condition_ref": "positioning:entity-not-in-facing-away"},
    {"isSocketCovered": [".", "penis"]},
    {
      "!!": {
        "var": "entity.components.positioning:sitting_on"
      }
    }
  ]
}]
```

**Design Notes:**

- **Starts with closeness partners**: Only considers actors in same closeness circle
- **Anatomy check**: `hasPartOfType` validates penis anatomy exists
- **Orientation check**: `condition_ref` to `positioning:entity-not-in-facing-away` ensures facing each other
- **Coverage check**: `isSocketCovered` validates penis socket is covered by clothing
- **Sitting check**: `!!` double-negation validates `sitting_on` component exists (truthy check)
- **Returns filtered array**: All actors meeting all four conditions

**Why New Scope Needed:**

Existing scope `sex-dry-intimacy:actors_with_penis_facing_each_other_covered` doesn't validate sitting status. This action specifically requires the target to be sitting (prerequisite for straddling). Creating a specialized scope keeps validation in the appropriate layer.

### Reused Scope: `target_topmost_torso_lower_clothing_no_accessories`

**Location:** `data/mods/clothing/scopes/target_topmost_torso_lower_clothing_no_accessories.scope`

**Purpose:** Resolves to the topmost clothing item in the `torso_lower` slot (pants, shorts, skirt) for the target entity.

**Usage:** Secondary target with `contextFrom: "primary"` means this scope executes in the primary target's context.

**Design Notes:**

- **Existing scope**: No modifications needed, reused as-is
- **Clothing layer priority**: Returns outer > base > underwear (whichever is topmost)
- **Excludes accessories**: Filters out belts and similar items
- **Context resolution**: When `contextFrom: "primary"`, resolves clothing for primary target entity

---

## Condition Definition

### `event-is-action-rub-pussy-against-penis-through-clothes.condition.json`

**Purpose:** Identifies when the event is attempting this specific action.

**Location:** `data/mods/sex-dry-intimacy/conditions/event-is-action-rub-pussy-against-penis-through-clothes.condition.json`

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-dry-intimacy:event-is-action-rub-pussy-against-penis-through-clothes",
  "description": "Checks if the triggering event is for the 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "sex-dry-intimacy:rub_pussy_against_penis_through_clothes"
    ]
  }
}
```

**Design Notes:**

- **Standard condition pattern**: Matches action ID exactly
- **Used by rule**: Ensures rule only fires for this specific action
- **JSON Logic syntax**: Simple equality check against action ID

---

## Implementation Details

### Component Dependencies

**Required Existing Components:**

- `core:actor` - Entity type for actors
- `core:position` - Location tracking for event context
- `positioning:closeness` - Closeness circle membership (required on actor)
- `positioning:straddling_waist` - Straddling state tracking (required on actor)
- `positioning:sitting_on` - Sitting state tracking (required on target, validated by scope)
- `anatomy:body` - Body part reference system for penis anatomy
- `clothing:equipment` - Clothing equipped in slots
- `clothing:slot_metadata` - Socket coverage information

**No New Components Required:** This action uses existing component infrastructure.

### State Requirements

#### Minimum Valid State

```
Actor (Straddler):
- core:actor
- core:position (same location as target)
- positioning:closeness (with target in partners array)
- positioning:straddling_waist (target_id = primary, facing_away = false)

Primary Target (Being Straddled):
- core:actor
- core:position (same location as actor)
- positioning:closeness (with actor in partners array)
- positioning:sitting_on (furniture_id = any valid furniture)
- anatomy:body (references groin entity)
- clothing:equipment (torso_lower slot has clothing)
- clothing:slot_metadata (torso_lower covers penis socket)

Groin Anatomy Entity:
- anatomy:part (subType = "groin", children includes penis)

Penis Anatomy Entity:
- anatomy:part (subType = "penis", parent = groin)

Clothing Entity (Pants/Shorts/etc):
- core:name (for display purposes)
```

#### Invalid States

**Action won't appear when:**

1. **Missing straddling_waist**: Actor not actively straddling target
2. **Missing closeness**: Actors not in same closeness circle
3. **Target not sitting**: Target missing `sitting_on` component
4. **Target no penis**: Target missing penis anatomy
5. **Penis exposed**: Penis socket not covered by clothing
6. **Facing away**: Actor has `facing_away` component targeting primary
7. **Missing clothing**: Target has no torso_lower clothing equipped

### Multi-Target Resolution Flow

```
1. Action Discovery Phase:
   ├─ Check actor has required_components (closeness, straddling_waist)
   ├─ Resolve primary scope: sex-dry-intimacy:actors_with_penis_facing_straddler_covered
   │  ├─ Filter actor.components.positioning:closeness.partners
   │  ├─ Check hasPartOfType(penis)
   │  ├─ Check condition_ref(entity-not-in-facing-away)
   │  ├─ Check isSocketCovered(penis)
   │  └─ Check entity.components.positioning:sitting_on exists
   │  → Result: [validPrimaryTargets]
   │
   └─ For each validPrimaryTarget:
      ├─ Set context to primaryTarget
      ├─ Resolve secondary scope: clothing:target_topmost_torso_lower_clothing_no_accessories
      │  └─ Find topmost torso_lower clothing in primaryTarget's equipment
      │  → Result: [clothingItem]
      │
      └─ Create action instance: (actor, primaryTarget, clothingItem)

2. Action Execution Phase:
   ├─ Dispatch core:attempt_action event
   ├─ Rule condition matches action ID
   ├─ GET_NAME operations for actor, primary, secondary
   ├─ QUERY_COMPONENT for actor position
   ├─ SET_VARIABLE for log message
   ├─ Macro: logSuccessAndEndTurn
   └─ Turn ends
```

### Validation Layers

**Layer 1: Action Schema** (JSON Schema validation)
- Validates action structure
- Validates required_components format
- Validates targets structure
- Validates visual styling

**Layer 2: Action Discovery** (Component requirements)
- Checks actor has `positioning:closeness`
- Checks actor has `positioning:straddling_waist`

**Layer 3: Scope Resolution** (Scope DSL filters)
- Validates primary target has penis anatomy
- Validates primary target penis is covered
- Validates primary target is not facing away
- Validates primary target is sitting
- Validates secondary target is valid clothing

**Layer 4: Rule Execution** (Operation handlers)
- Validates all entity references exist
- Validates component queries succeed
- Generates descriptive text
- Ends turn properly

### Straddling System Integration

**Relationship to Straddling:**

This action assumes the actor has already executed one of:
- `positioning:straddle_waist_facing` (creates `straddling_waist` with `facing_away: false`)
- `positioning:straddle_waist_facing_away` (creates `straddling_waist` with `facing_away: true`)

**Facing Orientation:**

The action only appears when straddling facing (not facing away) because:
1. Scope checks `condition_ref: positioning:entity-not-in-facing-away`
2. This condition returns false if actor has `facing_away` component with target in array
3. Facing away straddling prevents this action (correct behavior for intimate face-to-face action)

**State Cleanup:**

This action does NOT modify straddling state. Actor remains straddling after action completes. To end straddling, actor must use `positioning:dismount_from_straddling`.

### Performance Considerations

- **Scope efficiency**: Filters on component presence before expensive anatomy checks
- **Minimal operation overhead**: Only GET_NAME and QUERY_COMPONENT operations
- **No complex state changes**: Pure descriptive action with no component modifications
- **Reuses existing scopes**: Secondary target scope already optimized

---

## Testing Strategy

### Test Infrastructure

All tests follow the **Test Module Pattern** as documented in `docs/testing/mod-testing-guide.md`.

**Key Testing Tools:**

- `ModTestFixture` - Main test fixture for mod action/rule testing
- `ModEntityBuilder` - Fluent builder for creating test entities
- `ModAssertionHelpers` - Domain-specific assertion helpers

### Unit Tests

**Not applicable for this action** - Action/rule combos are tested at integration level. The action is a pure data structure validated by JSON Schema, and the rule uses only standard operation handlers.

### Integration Tests

#### Test File 1: Action Discovery

**File:** `tests/integration/mods/sex/rub_pussy_against_penis_through_clothes_action_discovery.test.js`

**Purpose:** Verify action appears only when all requirements are met.

**Test Structure:**

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import rubPussyAgainstPenisAction from '../../../../data/mods/sex-dry-intimacy/actions/rub_pussy_against_penis_through_clothes.action.json';

describe('sex-dry-intimacy:rub_pussy_against_penis_through_clothes action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex',
      'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    // Tests for JSON structure correctness
  });

  describe('Action discovery scenarios', () => {
    // Tests for when action should/shouldn't appear
  });
});
```

**Test Cases:**

1. **Action structure validation:**
   - ✅ Should have correct action ID
   - ✅ Should have correct action name and description
   - ✅ Should use multi-target structure with primary and secondary
   - ✅ Should have correct primary scope (`sex-dry-intimacy:actors_with_penis_facing_straddler_covered`)
   - ✅ Should have correct secondary scope (`clothing:target_topmost_torso_lower_clothing_no_accessories`)
   - ✅ Should have `contextFrom: "primary"` on secondary target
   - ✅ Should require `positioning:closeness` and `positioning:straddling_waist` on actor
   - ✅ Should have correct visual styling (purple sex-dry-intimacy module theme)

2. **Action discovery scenarios:**
   - ✅ Should appear when actor is straddling sitting target with covered penis
   - ✅ Should NOT appear when actor missing `straddling_waist` component
   - ✅ Should NOT appear when actor missing `closeness` component
   - ✅ Should NOT appear when target is not sitting
   - ✅ Should NOT appear when target has no penis anatomy
   - ✅ Should NOT appear when target's penis is exposed (uncovered)
   - ✅ Should NOT appear when actor is facing away from target
   - ✅ Should resolve secondary target to topmost torso_lower clothing
   - ✅ Should NOT appear when target has no torso_lower clothing
   - ✅ Should work with multiple valid targets in closeness circle

**Example Test Implementation:**

```javascript
it('should appear when actor is straddling sitting target with covered penis', async () => {
  // Setup: Create room, actor straddling target, target sitting with covered penis
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  const alice = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('bob')
    .asActor()
    .withComponent('positioning:straddling_waist', {
      target_id: 'bob',
      facing_away: false
    })
    .build();

  const bob = new ModEntityBuilder('bob')
    .withName('Bob')
    .atLocation('room1')
    .closeToEntity('alice')
    .withBody('groin1')
    .asActor()
    .withComponent('positioning:sitting_on', {
      furniture_id: 'chair1',
      spot_index: 0
    })
    .withComponent('clothing:equipment', {
      equipped: {
        torso_lower: {
          base: ['pants1']
        }
      }
    })
    .withComponent('clothing:slot_metadata', {
      slotMappings: {
        torso_lower: {
          coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
          allowedLayers: ['underwear', 'base', 'outer']
        }
      }
    })
    .build();

  const groin = new ModEntityBuilder('groin1')
    .asBodyPart({
      parent: null,
      children: ['penis1'],
      subType: 'groin'
    })
    .build();

  const penis = new ModEntityBuilder('penis1')
    .asBodyPart({
      parent: 'groin1',
      children: [],
      subType: 'penis'
    })
    .build();

  const pants = new ModEntityBuilder('pants1').withName('pants').build();

  const chair = new ModEntityBuilder('chair1')
    .withName('chair')
    .atLocation('room1')
    .build();

  testFixture.reset([room, alice, bob, groin, penis, pants, chair]);

  // Discover actions for alice
  const actions = await testFixture.discoverActions('alice');

  // Assert action appears
  expect(actions).toContainEqual(
    expect.objectContaining({
      actionId: 'sex-dry-intimacy:rub_pussy_against_penis_through_clothes',
      primaryId: 'bob',
      secondaryId: 'pants1'
    })
  );
});
```

#### Test File 2: Action Execution

**File:** `tests/integration/mods/sex/rub_pussy_against_penis_through_clothes_action.test.js`

**Purpose:** Verify rule executes correctly and generates proper events.

**Test Cases:**

1. **Successful execution:**
   - ✅ Performs action successfully with correct payload
   - ✅ Generates correct perceptible event message
   - ✅ Message includes actor name, target name, clothing name
   - ✅ Message includes "feeling the shape and size" descriptor
   - ✅ Action ends turn properly
   - ✅ Dispatches perceptible event with correct perception type

2. **Edge cases:**
   - ✅ Rule doesn't fire for different action
   - ✅ Handles missing target gracefully
   - ✅ Handles missing clothing gracefully
   - ✅ Rule structure matches expected pattern

**Example Test Implementation:**

```javascript
it('performs rub pussy against penis action successfully', async () => {
  // Setup entities (same as discovery test)
  const entities = setupStraddlingWithClothingScenario();
  testFixture.reset(Object.values(entities));

  // Execute action
  await testFixture.executeAction('alice', 'bob', {
    additionalPayload: {
      primaryId: 'bob',
      secondaryId: 'pants1'
    }
  });

  // Assert action success
  ModAssertionHelpers.assertActionSuccess(
    testFixture.events,
    "Alice rubs her pussy sensually against Bob's penis through the pants, feeling the shape and size.",
    {
      shouldEndTurn: true,
      shouldHavePerceptibleEvent: true
    }
  );
});
```

#### Test File 3: Scope Validation

**File:** `tests/integration/mods/sex/actors_with_penis_facing_straddler_covered_scope.test.js`

**Purpose:** Verify new scope filters correctly.

**Test Cases:**

1. **Scope filtering:**
   - ✅ Returns actors with penis anatomy
   - ✅ Filters out actors without penis
   - ✅ Returns only actors with covered penis
   - ✅ Filters out actors with exposed penis
   - ✅ Returns only sitting actors
   - ✅ Filters out standing/kneeling actors
   - ✅ Filters out actors in facing_away orientation
   - ✅ Returns actors facing straddler
   - ✅ Returns empty array when no valid actors
   - ✅ Works with multiple actors in closeness circle

### Edge Case Tests

**File:** `tests/integration/mods/sex/rub_pussy_against_penis_edge_cases.test.js`

**Test Cases:**

1. **Component state validation:**
   - ✅ Action unavailable when straddling component removed
   - ✅ Action unavailable when closeness broken
   - ✅ Action unavailable when target stands up (loses sitting_on)
   - ✅ Action unavailable when clothing removed from target
   - ✅ Action unavailable when actor turns to face away

2. **Multi-target scenarios:**
   - ✅ Multiple sitting targets generate multiple action instances
   - ✅ Each action instance has correct primary/secondary pairing
   - ✅ Clothing resolution happens in correct target context

3. **Orientation scenarios:**
   - ✅ Action appears when straddling facing (facing_away: false)
   - ✅ Action disappears when actor turns to face away
   - ✅ Action reappears when actor turns back around

### Performance Tests

**File:** `tests/performance/mods/sex/rub_pussy_against_penis_performance.test.js`

**Test Cases:**

1. **Action discovery performance:**
   - ✅ Scope resolution completes in <10ms with 100 actors
   - ✅ Anatomy checks scale linearly with closeness circle size
   - ✅ Coverage checks don't degrade with multiple clothing layers

2. **Action execution performance:**
   - ✅ Rule execution completes in <50ms
   - ✅ GET_NAME operations complete quickly
   - ✅ Event dispatching doesn't accumulate overhead

### Test Utilities

**Helper Functions:**

```javascript
/**
 * Creates standardized setup for straddling + covered penis scenarios.
 */
function setupStraddlingWithClothingScenario() {
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('bob')
    .asActor()
    .withComponent('positioning:straddling_waist', {
      target_id: 'bob',
      facing_away: false
    })
    .build();

  const target = new ModEntityBuilder('bob')
    .withName('Bob')
    .atLocation('room1')
    .closeToEntity('alice')
    .withBody('groin1')
    .asActor()
    .withComponent('positioning:sitting_on', {
      furniture_id: 'chair1',
      spot_index: 0
    })
    .withComponent('clothing:equipment', {
      equipped: {
        torso_lower: {
          base: ['pants1']
        }
      }
    })
    .withComponent('clothing:slot_metadata', {
      slotMappings: {
        torso_lower: {
          coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
          allowedLayers: ['underwear', 'base', 'outer']
        }
      }
    })
    .build();

  const groin = new ModEntityBuilder('groin1')
    .asBodyPart({
      parent: null,
      children: ['penis1'],
      subType: 'groin'
    })
    .build();

  const penis = new ModEntityBuilder('penis1')
    .asBodyPart({
      parent: 'groin1',
      children: [],
      subType: 'penis'
    })
    .build();

  const pants = new ModEntityBuilder('pants1').withName('pants').build();

  const chair = new ModEntityBuilder('chair1')
    .withName('chair')
    .atLocation('room1')
    .build();

  return { room, actor, target, groin, penis, pants, chair };
}
```

### Testing Checklist

**Before Implementation:**
- [ ] Review `ModTestFixture` API in `tests/common/mods/ModTestFixture.js`
- [ ] Review `ModEntityBuilder` patterns in `tests/common/mods/ModEntityBuilder.js`
- [ ] Review `ModAssertionHelpers` in `tests/common/mods/ModAssertionHelpers.js`
- [ ] Review similar test: `fondle_breasts_over_clothes_action_discovery.test.js`
- [ ] Review similar test: `rub_penis_over_clothes_action.test.js`

**During Implementation:**
- [ ] Create action discovery test file
- [ ] Create action execution test file
- [ ] Create scope validation test file
- [ ] Create edge case test file
- [ ] Create performance test file (if needed)
- [ ] Run all tests: `npm run test:integration -- tests/integration/mods/sex/rub_pussy_against_penis*`
- [ ] Verify 100% coverage for new scope and action

**After Implementation:**
- [ ] All tests passing
- [ ] No console warnings or errors
- [ ] Test execution time reasonable (<2s for all files)
- [ ] Code coverage meets standards (>80% branches)

---

## References

### Similar Actions

This specification draws patterns from:

1. **`rub_penis_over_clothes`** - Multi-target clothing interaction template
2. **`fondle_breasts_over_clothes`** - Covered anatomy + clothing pattern
3. **`straddle_waist_facing`** - Straddling positioning requirement
4. **`sit_on_lap_from_sitting_facing`** - Sitting + closeness + facing validation

### Similar Scopes

1. **`sex-dry-intimacy:actors_with_penis_facing_each_other_covered`** - Penis + coverage + facing template
2. **`positioning:actors_sitting_close`** - Sitting + closeness filter pattern
3. **`clothing:target_topmost_torso_lower_clothing_no_accessories`** - Clothing resolution

### Operation Handlers Referenced

No new operation handlers needed! Existing handlers cover all requirements:

- `GET_NAME` - Entity name retrieval
- `QUERY_COMPONENT` - Component data retrieval
- `SET_VARIABLE` - Context variable setting
- Standard macro: `core:logSuccessAndEndTurn`

### Component Dependencies

**Positioning System:**
- `positioning:closeness` - Closeness circle tracking
- `positioning:straddling_waist` - Straddling state
- `positioning:sitting_on` - Sitting state
- `positioning:facing_away` - Orientation tracking

**Anatomy System:**
- `anatomy:body` - Body part references
- `anatomy:part` - Individual anatomy entities

**Clothing System:**
- `clothing:equipment` - Equipped clothing tracking
- `clothing:slot_metadata` - Socket coverage information

**Core Systems:**
- `core:actor` - Actor entity type
- `core:position` - Location tracking
- `core:name` - Entity naming

### Documentation References

- `docs/testing/mod-testing-guide.md` - Test Module Pattern documentation
- `docs/testing/mod-testing-guide.md#action-discovery-harness#domain-matchers` - Domain-specific assertion helpers
- `specs/straddling-waist-system.spec.md` - Straddling system architecture
- `CLAUDE.md` - Project conventions and patterns

### File Checklist

**Total files to create: 6**

#### Actions (1)
- [ ] `data/mods/sex-dry-intimacy/actions/rub_pussy_against_penis_through_clothes.action.json`

#### Rules (1)
- [ ] `data/mods/sex-dry-intimacy/rules/handle_rub_pussy_against_penis_through_clothes.rule.json`

#### Scopes (1)
- [ ] `data/mods/sex-dry-intimacy/scopes/actors_with_penis_facing_straddler_covered.scope`

#### Conditions (1)
- [ ] `data/mods/sex-dry-intimacy/conditions/event-is-action-rub-pussy-against-penis-through-clothes.condition.json`

#### Tests (2)
- [ ] `tests/integration/mods/sex/rub_pussy_against_penis_through_clothes_action_discovery.test.js`
- [ ] `tests/integration/mods/sex/rub_pussy_against_penis_through_clothes_action.test.js`

#### Optional Tests (3)
- [ ] `tests/integration/mods/sex/actors_with_penis_facing_straddler_covered_scope.test.js`
- [ ] `tests/integration/mods/sex/rub_pussy_against_penis_edge_cases.test.js`
- [ ] `tests/performance/mods/sex/rub_pussy_against_penis_performance.test.js`

---

## Future Enhancements

### Potential Variations

**Not included in this specification** but recommended for future implementation:

1. **Intensity variations** - Different pressure/speed actions
2. **Rhythm-based actions** - Grinding with different rhythms
3. **Orientation variations** - Similar action for facing away straddling
4. **Clothing removal integration** - Progressive undressing during action
5. **Arousal system integration** - Track and respond to arousal states

### Integration Opportunities

- **AI response system** - Generate contextual NPC reactions
- **Relationship system** - Affect intimacy scores
- **Stamina system** - Action costs based on intensity
- **Consent system** - Validate participant consent states

---

## Conclusion

This specification provides a complete design for implementing a mature sexual action in the Living Narrative Engine's sex-dry-intimacy module. The design:

- ✅ Follows existing sex-dry-intimacy module patterns consistently
- ✅ Reuses existing operation handlers (no new handlers needed)
- ✅ Integrates cleanly with straddling and clothing systems
- ✅ Validates all requirements through scope filters
- ✅ Provides comprehensive testing strategy using Test Module Pattern
- ✅ Maintains proper separation of concerns
- ✅ Uses multi-target action pattern effectively

**Total Implementation Scope:** 6 core files + optional test files

**No code modifications required to existing systems** - purely additive implementation.

**Mature Content Notice:** This action is designed for mature audiences only. All actions in the sex-dry-intimacy module are consensual interactions between adult characters in a fictional narrative context.

---

**End of Specification**
