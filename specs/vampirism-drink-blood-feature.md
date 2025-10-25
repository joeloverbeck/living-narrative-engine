# Vampirism: Drink Blood Feature Specification

## Overview

This specification defines a new action/rule combination for the vampirism mod that allows a vampire actor to drink blood from a target whose neck they are currently biting. This action represents the natural continuation of the neck-biting sequence and maintains the existing state relationships without modification.

## Feature Summary

- **Feature Name**: Drink Blood
- **Mod**: vampirism
- **Action ID**: `vampirism:drink_blood`
- **Purpose**: Allow vampire to consume blood from an already-bitten victim
- **State Impact**: None (preserves existing bite relationship)

## Component Architecture

### Existing Components Used

#### positioning:biting_neck
```json
{
  "bitten_entity_id": "string",
  "initiated": "boolean",
  "consented": "boolean (optional)"
}
```

**Purpose**: Marks the vampire as actively biting another entity's neck.

#### positioning:being_bitten_in_neck
```json
{
  "biting_entity_id": "string",
  "consented": "boolean (optional)"
}
```

**Purpose**: Marks the victim whose neck is currently being bitten.

### Relationship Diagram

```
Vampire Entity                    Victim Entity
┌─────────────────┐              ┌──────────────────┐
│ positioning:    │              │ positioning:     │
│ biting_neck     │◄────────────►│ being_bitten_    │
│                 │              │ in_neck          │
│ bitten_entity_id├──────────────┤ biting_entity_id │
│ = victim.id     │              │ = vampire.id     │
└─────────────────┘              └──────────────────┘
```

**Constraint**: The action is only available when this reciprocal relationship exists and IDs match correctly.

## Scope Definitions

### 1. actor_being_bitten_by_me.scope

**Purpose**: Returns the entity whose neck the actor is currently biting.

**Pattern**: Based on `sex-penile-oral:receiving_blowjob_from_actor.scope`

**Scope DSL Syntax**:
```
// Returns the entity being bitten by the acting vampire
// Validates reciprocal component relationship for safety
positioning:actor_being_bitten_by_me := actor.components.positioning:closeness.partners[][{
  "and": [
    {"!!": {"var": "actor.components.positioning:biting_neck"}},
    {"!!": {"var": "entity.components.positioning:being_bitten_in_neck"}},
    {"==": [
      {"var": "actor.components.positioning:biting_neck.bitten_entity_id"},
      {"var": "entity.id"}
    ]},
    {"==": [
      {"var": "entity.components.positioning:being_bitten_in_neck.biting_entity_id"},
      {"var": "actor.id"}
    ]}
  ]
}]
```

**Resolution Logic**:
1. Start with actor's closeness partners
2. Iterate through each partner entity
3. Verify actor has `positioning:biting_neck` component
4. Verify entity has `positioning:being_bitten_in_neck` component
5. Validate actor's `bitten_entity_id` matches entity's ID
6. Validate entity's `biting_entity_id` matches actor's ID
7. Return entity if all conditions pass

**Expected Results**:
- Returns single entity ID when valid bite relationship exists
- Returns empty set when no `biting_neck` component on actor
- Returns empty set when partner lacks `being_bitten_in_neck` component
- Returns empty set when ID references don't match reciprocally

### 2. actor_biting_my_neck.scope

**Purpose**: Returns the entity currently biting the actor's neck.

**Pattern**: Based on `sex-penile-oral:actor_giving_blowjob_to_me.scope`

**Scope DSL Syntax**:
```
// Returns the vampire currently biting the acting entity's neck
// Validates reciprocal component relationship for safety
positioning:actor_biting_my_neck := actor.components.positioning:closeness.partners[][{
  "and": [
    {"!!": {"var": "actor.components.positioning:being_bitten_in_neck"}},
    {"!!": {"var": "entity.components.positioning:biting_neck"}},
    {"==": [
      {"var": "actor.components.positioning:being_bitten_in_neck.biting_entity_id"},
      {"var": "entity.id"}
    ]},
    {"==": [
      {"var": "entity.components.positioning:biting_neck.bitten_entity_id"},
      {"var": "actor.id"}
    ]}
  ]
}]
```

**Resolution Logic**:
1. Start with actor's closeness partners
2. Iterate through each partner entity
3. Verify actor has `positioning:being_bitten_in_neck` component
4. Verify entity has `positioning:biting_neck` component
5. Validate actor's `biting_entity_id` matches entity's ID
6. Validate entity's `bitten_entity_id` matches actor's ID
7. Return entity if all conditions pass

**Expected Results**:
- Returns single entity ID when actor is being bitten
- Returns empty set when no `being_bitten_in_neck` component on actor
- Returns empty set when partner lacks `biting_neck` component
- Returns empty set when ID references don't match reciprocally

## Action Definition

### drink_blood.action.json

**Location**: `data/mods/vampirism/actions/drink_blood.action.json`

**Schema Compliance**: `schema://living-narrative-engine/action.schema.json`

**Action Specification**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "vampirism:drink_blood",
  "name": "Drink Blood",
  "description": "Drink blood from the target whose neck you are currently biting",
  "targets": "positioning:actor_being_bitten_by_me",
  "required_components": {
    "actor": ["positioning:biting_neck"]
  },
  "forbidden_components": {
    "actor": ["positioning:being_bitten_in_neck"]
  },
  "template": "drink {target}'s blood",
  "visual": {
    "backgroundColor": "#6c0f36",
    "textColor": "#ffe6ef",
    "hoverBackgroundColor": "#861445",
    "hoverTextColor": "#fff2f7"
  }
}
```

**Component Validation**:
- **Actor Required**: `positioning:biting_neck` - Must be actively biting
- **Actor Forbidden**: `positioning:being_bitten_in_neck` - Cannot be the victim
- **Target Scope**: Resolves to the entity being bitten via scope validation

**Visual Theme**: Matches existing vampirism actions (dark crimson with pink highlights)

## Rule Definition

### handle_drink_blood.rule.json

**Location**: `data/mods/vampirism/rules/handle_drink_blood.rule.json`

**Schema Compliance**: `schema://living-narrative-engine/rule.schema.json`

**Rule Specification**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_drink_blood",
  "comment": "Handles the 'vampirism:drink_blood' action. Generates descriptive messaging without modifying bite relationship components.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "vampirism:event-is-action-drink-blood"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "target", "result_variable": "targetName" }
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
        "value": "{context.actorName} drinks {context.targetName}'s blood through the wound in {context.targetName}'s neck."
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
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**Rule Behavior**:
1. Retrieve actor and target display names
2. Query actor's position for location context
3. Set perceptible event message
4. Set perception type as `action_target_general`
5. Configure location and target IDs
6. Dispatch success event and end turn via macro

**Critical Design Decision**: This rule **DOES NOT** modify the `positioning:biting_neck` or `positioning:being_bitten_in_neck` components. The bite relationship persists unchanged, allowing repeated blood drinking actions.

## Condition Definition

### event-is-action-drink-blood.condition.json

**Location**: `data/mods/vampirism/conditions/event-is-action-drink-blood.condition.json`

**Schema Compliance**: `schema://living-narrative-engine/condition.schema.json`

**Condition Specification**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "vampirism:event-is-action-drink-blood",
  "description": "Validates that the event is an attempt to execute the drink_blood action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "vampirism:drink_blood"
    ]
  }
}
```

**Validation Logic**: Standard action ID matcher for rule activation.

## Test Coverage Requirements

### Test Suite 1: Action Discovery

**File**: `tests/integration/mods/vampirism/drink_blood_action_discovery.test.js`

**Test Framework**: ModTestFixture with Action Discovery Bed

**Positive Discovery Cases**:
1. ✅ Discovers action when vampire has `positioning:biting_neck` component
2. ✅ Discovers action when target has matching `positioning:being_bitten_in_neck` component
3. ✅ Discovers action with correct ID matching between components
4. ✅ Discovers action when vampire is biting target in close proximity

**Negative Discovery Cases**:
1. ❌ Does NOT discover when actor lacks `positioning:biting_neck` component
2. ❌ Does NOT discover when actor has `positioning:being_bitten_in_neck` (actor is victim)
3. ❌ Does NOT discover when target lacks `positioning:being_bitten_in_neck` component
4. ❌ Does NOT discover when component IDs don't match reciprocally
5. ❌ Does NOT discover when no bite relationship exists
6. ❌ Does NOT discover when actors lack closeness

**Discovery Diagnostics**:
- Validate diagnostic information when discovery fails
- Verify scope resolution traces for debugging

### Test Suite 2: Action Execution

**File**: `tests/integration/mods/vampirism/drink_blood_action.test.js`

**Test Framework**: ModTestFixture

**Component Preservation Tests**:
1. ✅ `positioning:biting_neck` component unchanged after action execution
2. ✅ `positioning:being_bitten_in_neck` component unchanged after action execution
3. ✅ Component data matches exactly before and after execution
4. ✅ Reciprocal ID references remain valid after execution

**Event Generation Tests**:
1. ✅ Generates correct perceptible event message format
2. ✅ Message template: `"{actor} drinks {target}'s blood through the wound in {target}'s neck."`
3. ✅ Success action message matches perceptible event message
4. ✅ Event includes correct metadata (locationId, actorId, targetId)
5. ✅ Perception type is `action_target_general`

**Turn Management Tests**:
1. ✅ Ends turn with success status
2. ✅ `core:turn_ended` event dispatched with correct entityId
3. ✅ Turn success flag is `true`

**Multiple Execution Scenarios**:
1. ✅ Handles different vampire/victim name combinations correctly
2. ✅ Supports repeated execution (drink blood multiple times)
3. ✅ Maintains component integrity across multiple executions
4. ✅ Message substitution works for various entity names

**Rule Isolation**:
1. ✅ Does not fire for different action IDs
2. ✅ Only triggers for `vampirism:drink_blood` events

### Test Suite 3: actor_being_bitten_by_me Scope

**File**: `tests/integration/mods/vampirism/actor_being_bitten_by_me_scope.test.js`

**Test Framework**: Scope resolution integration tests

**Positive Resolution Tests**:
1. ✅ Returns correct entity when vampire has `biting_neck` component
2. ✅ Returns correct entity when victim has `being_bitten_in_neck` component
3. ✅ Validates reciprocal component ID matching
4. ✅ Returns single entity ID when relationship exists
5. ✅ Requires closeness between vampire and victim

**Negative Resolution Tests**:
1. ❌ Returns empty set when actor lacks `positioning:biting_neck` component
2. ❌ Returns empty set when `bitten_entity_id` references non-existent entity
3. ❌ Returns empty set when target lacks `positioning:being_bitten_in_neck` component
4. ❌ Returns empty set when reciprocal ID references don't match
5. ❌ Returns empty set when entities lack closeness relationship

**Edge Cases**:
1. ✅ Handles null/undefined component values gracefully
2. ✅ Validates entity existence before returning ID
3. ✅ Filters out invalid closeness partner references

### Test Suite 4: actor_biting_my_neck Scope

**File**: `tests/integration/mods/vampirism/actor_biting_my_neck_scope.test.js`

**Test Framework**: Scope resolution integration tests

**Positive Resolution Tests**:
1. ✅ Returns correct entity when actor is being bitten
2. ✅ Returns correct entity when vampire has `biting_neck` component
3. ✅ Validates reciprocal component ID matching
4. ✅ Returns single entity ID when relationship exists
5. ✅ Requires closeness between victim and vampire

**Negative Resolution Tests**:
1. ❌ Returns empty set when actor lacks `positioning:being_bitten_in_neck` component
2. ❌ Returns empty set when `biting_entity_id` references non-existent entity
3. ❌ Returns empty set when vampire lacks `positioning:biting_neck` component
4. ❌ Returns empty set when reciprocal ID references don't match
5. ❌ Returns empty set when entities lack closeness relationship

**Edge Cases**:
1. ✅ Handles null/undefined component values gracefully
2. ✅ Validates entity existence before returning ID
3. ✅ Filters out invalid closeness partner references

## Implementation Checklist

### Phase 1: Scope Implementation
- [ ] Create `data/mods/vampirism/scopes/actor_being_bitten_by_me.scope`
- [ ] Create `data/mods/vampirism/scopes/actor_biting_my_neck.scope`
- [ ] Validate scope DSL syntax against `docs/scopeDsl/` reference
- [ ] Test scope resolution manually via engine console

### Phase 2: Action/Rule/Condition Implementation
- [ ] Create `data/mods/vampirism/actions/drink_blood.action.json`
- [ ] Create `data/mods/vampirism/rules/handle_drink_blood.rule.json`
- [ ] Create `data/mods/vampirism/conditions/event-is-action-drink-blood.condition.json`
- [ ] Validate JSON schema compliance for all files
- [ ] Run `npm run validate:mod:vampirism` to verify mod integrity

### Phase 3: Test Suite Implementation
- [ ] Create `tests/integration/mods/vampirism/drink_blood_action_discovery.test.js`
- [ ] Create `tests/integration/mods/vampirism/drink_blood_action.test.js`
- [ ] Create `tests/integration/mods/vampirism/actor_being_bitten_by_me_scope.test.js`
- [ ] Create `tests/integration/mods/vampirism/actor_biting_my_neck_scope.test.js`
- [ ] Import required test helpers and matchers
- [ ] Implement all positive and negative test cases

### Phase 4: Validation
- [ ] Run `NODE_ENV=test npm run test:integration -- tests/integration/mods/vampirism/drink_blood*.test.js`
- [ ] Verify 100% test pass rate
- [ ] Run `NODE_ENV=test npm run test:integration -- tests/integration/mods/vampirism/*scope.test.js`
- [ ] Verify scope resolution tests pass
- [ ] Run `npx eslint` on all modified files
- [ ] Run `npm run typecheck` for TypeScript compliance
- [ ] Manual gameplay testing in browser

### Phase 5: Documentation
- [ ] Update vampirism mod README (if exists)
- [ ] Document new scopes in scope reference
- [ ] Update this specification with any implementation discoveries
- [ ] Create migration notes if needed

## Design Rationale

### Why Not Modify Components?

The decision to **preserve** the `positioning:biting_neck` and `positioning:being_bitten_in_neck` components unchanged during blood drinking is intentional:

1. **State Preservation**: The bite relationship represents a positional/physical state that persists while drinking occurs
2. **Repeated Actions**: Allows vampire to drink multiple times from same wound without re-biting
3. **Narrative Consistency**: Drinking blood is a consequence of biting, not a state change itself
4. **Component Separation**: Follows ECS principle - drinking is an action/event, not a positional component

### Why Use Closeness Partners Array?

Both scopes filter through `actor.components.positioning:closeness.partners[]` because:

1. **Physical Proximity**: Biting requires close physical contact
2. **Performance**: Limits scope resolution to nearby entities only
3. **Safety**: Prevents invalid long-range bite relationships
4. **Consistency**: Matches pattern from `sex-penile-oral` mod scopes

### Message Template Design

The message `"{actor} drinks {target}'s blood through the wound in {target}'s neck."` is specific because:

1. **Clarity**: Explicitly references the existing neck wound
2. **Continuity**: Links to prior bite action narrative
3. **Anatomical Accuracy**: Specifies how blood is being consumed
4. **Consistency**: Matches style of `bite_neck_carefully` messaging

## Future Enhancements

Potential extensions (not in current scope):

1. **Blood Tracking**: Add component to track blood consumed/remaining
2. **Health Impact**: Drain victim's health during drinking
3. **Vampire Sustenance**: Restore vampire's vitality/stats
4. **Consent Mechanics**: Integrate with existing `consented` fields
5. **Release Actions**: Allow vampire to release bite or victim to break free
6. **Drinking Intensity**: Multiple drinking action variants (gentle, aggressive)

## References

- **Pattern Sources**:
  - `data/mods/sex-penile-oral/scopes/actor_giving_blowjob_to_me.scope`
  - `data/mods/sex-penile-oral/scopes/receiving_blowjob_from_actor.scope`
  - `data/mods/vampirism/actions/bite_neck_carefully.action.json`
  - `data/mods/vampirism/rules/handle_bite_neck_carefully.rule.json`

- **Documentation**:
  - `docs/scopeDsl/README.md` - Scope DSL syntax reference
  - `docs/scopeDsl/quick-reference.md` - Scope operator quick reference
  - `docs/testing/mod-testing-guide.md` - Test suite patterns
  - `docs/testing/action-discovery-testing-toolkit.md` - Discovery test patterns

- **Test Examples**:
  - `tests/integration/mods/vampirism/bite_neck_carefully_action_discovery.test.js`
  - `tests/integration/mods/vampirism/bite_neck_carefully_action.test.js`

---

**Specification Version**: 1.0
**Author**: Generated via /sc:design
**Date**: 2025-10-25
**Status**: Ready for Implementation
