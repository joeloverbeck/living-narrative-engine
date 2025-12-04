# Specification: Quickly Wield Weapon from Location

## Status: ✅ COMPLETED

**Completed**: 2025-12-04

---

## Outcome

### Implementation Summary

All files were created exactly as specified:

1. **Scope File**: `data/mods/weapons/scopes/grabbable_weapons_at_location.scope`
   - Resolves weapons at actor's location that can be grabbed
   - Uses `canActorGrabItem` and `isItemBeingGrabbed` custom operators

2. **Action File**: `data/mods/weapons/actions/quickly_wield_weapon.action.json`
   - Action ID: `weapons:quickly_wield_weapon`
   - Template: `"quickly wield {target}"`
   - Uses Arctic Steel color scheme (#112a46)
   - Required: `items:inventory` on actor
   - Forbidden: closeness, fallen, being_restrained, restraining
   - Prerequisite: `anatomy:actor-has-free-grabbing-appendage`

3. **Condition File**: `data/mods/weapons/conditions/event-is-action-quickly-wield-weapon.condition.json`
   - Standard event payload action ID check

4. **Rule File**: `data/mods/weapons/rules/handle_quickly_wield_weapon.rule.json`
   - Locks grabbing appendages based on weapon's `anatomy:requires_grabbing`
   - Removes weapon's `core:position` component (picked up from ground)
   - Adds/appends to `positioning:wielding` component
   - Regenerates actor description
   - Uses `core:logSuccessAndEndTurn` macro

5. **Manifest Update**: `data/mods/weapons/mod-manifest.json`
   - Added all 4 new files to appropriate arrays

### Test Coverage

Created comprehensive integration tests:

1. **Action Discovery Tests** (`tests/integration/mods/weapons/quickly_wield_weapon_action_discovery.test.js`):
   - 16 test cases covering action structure, required/forbidden components, prerequisites, target configuration, visual configuration, and schema compliance

2. **Rule Execution Tests** (`tests/integration/mods/weapons/quickly_wield_weapon_action.test.js`):
   - 6 test cases covering successful execution, position component removal, wielding component addition, perceptible events, message formatting, and appending to existing wielded items

### Test Results

```
Test Suites: 2 passed, 2 total (new tests)
Test Suites: 30 passed, 30 total (all weapons mod tests)
Tests:       435 passed, 435 total (all weapons mod tests)
```

### Validation Results

- ✅ Scope file parses correctly
- ✅ Action JSON validates against schema
- ✅ Condition JSON validates against schema
- ✅ Rule JSON validates against schema
- ✅ Manifest updated with all new files
- ✅ All discovery tests pass
- ✅ All rule execution tests pass
- ✅ `npm run validate` passes
- ✅ ESLint passes on new test files

### Files Created/Modified

**Created**:
- `data/mods/weapons/scopes/grabbable_weapons_at_location.scope`
- `data/mods/weapons/actions/quickly_wield_weapon.action.json`
- `data/mods/weapons/conditions/event-is-action-quickly-wield-weapon.condition.json`
- `data/mods/weapons/rules/handle_quickly_wield_weapon.rule.json`
- `tests/integration/mods/weapons/quickly_wield_weapon_action_discovery.test.js`
- `tests/integration/mods/weapons/quickly_wield_weapon_action.test.js`

**Modified**:
- `data/mods/weapons/mod-manifest.json` (added 4 entries)

### Notes on Implementation

1. **Test Pattern Adaptation**: The spec proposed helper functions for tests but the actual project pattern uses `ModEntityBuilder` directly in each test. The implementation followed the established project conventions.

2. **Test File Naming**: The spec proposed `quickly_wield_weapon_rule_execution.test.js` but the implementation used `quickly_wield_weapon_action.test.js` to match the existing pattern (e.g., `wield_threateningly_action.test.js`).

3. **No Issues Encountered**: All assumptions in the spec were accurate regarding:
   - Scope DSL syntax
   - Action schema structure
   - Condition format
   - Rule operations and macros
   - Manifest format

---

## Overview

This specification defines a new action/rule combo in the `weapons` mod that allows an actor to quickly grab a weapon from their current location and wield it immediately. This simulates the urgency of someone hurrying to scoop up a weapon from the ground or a nearby surface to wield it in response to a threat.

## Use Case

A weapon lies on the ground or in the actor's current location. The actor needs to quickly arm themselves by grabbing the weapon and wielding it in a single action, rather than picking it up first and then wielding it separately.

---

## Files to Create

### 1. Scope File

**Path**: `data/mods/weapons/scopes/grabbable_weapons_at_location.scope`

**Purpose**: Resolves to weapons located at the actor's current location that can be grabbed.

**Content**:
```
weapons:grabbable_weapons_at_location := entities(core:position)[][{"and": [
  {"!!": {"var": "entity.components.weapons:weapon"}},
  {"!!": {"var": "entity.components.items:portable"}},
  {"==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]},
  {"canActorGrabItem": ["actor", "entity"]},
  {"not": {"isItemBeingGrabbed": ["actor", "entity"]}}
]}]
```

**Pattern Derivation**:
- Base pattern from `items:items_at_location` scope (location matching)
- Filter additions from `weapons:grabbable_weapons_in_inventory` scope (`canActorGrabItem`, `isItemBeingGrabbed` checks)
- Filters for `weapons:weapon` component instead of `items:item`
- Retains `items:portable` check to ensure weapon can be moved

---

### 2. Action File

**Path**: `data/mods/weapons/actions/quickly_wield_weapon.action.json`

**Content**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:quickly_wield_weapon",
  "name": "Quickly Wield Weapon",
  "description": "Quickly grab a weapon from the ground and wield it",
  "generateCombinations": true,
  "required_components": {
    "actor": [
      "items:inventory"
    ]
  },
  "forbidden_components": {
    "actor": [
      "positioning:closeness",
      "positioning:fallen",
      "positioning:being_restrained",
      "positioning:restraining"
    ]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need at least one free hand or appendage to wield a weapon."
    }
  ],
  "targets": {
    "primary": {
      "scope": "weapons:grabbable_weapons_at_location",
      "placeholder": "target",
      "description": "Weapon to quickly wield"
    }
  },
  "template": "quickly wield {target}",
  "visual": {
    "backgroundColor": "#112a46",
    "textColor": "#e6f1ff",
    "hoverBackgroundColor": "#0b3954",
    "hoverTextColor": "#f0f4f8"
  }
}
```

**Configuration Notes**:
- `required_components.actor`: `["items:inventory"]` - Actor must have inventory capability
- `forbidden_components.actor`: Identical to `wield_threateningly.action.json`
- `prerequisites`: Identical to `wield_threateningly.action.json` - requires free grabbing appendage
- `targets.primary.scope`: Uses the new `weapons:grabbable_weapons_at_location` scope
- `template`: `"quickly wield {target}"` as specified
- `visual`: Identical dark blue scheme from `wield_threateningly.action.json`
- `generateCombinations`: `true` to enable action variants for each available weapon

---

### 3. Condition File

**Path**: `data/mods/weapons/conditions/event-is-action-quickly-wield-weapon.condition.json`

**Content**:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "weapons:event-is-action-quickly-wield-weapon",
  "description": "Checks if the current event is a quickly_wield_weapon action",
  "logic": {
    "==": [
      {"var": "event.payload.actionId"},
      "weapons:quickly_wield_weapon"
    ]
  }
}
```

**Note**: Condition file uses hyphens in filename per project conventions.

---

### 4. Rule File

**Path**: `data/mods/weapons/rules/handle_quickly_wield_weapon.rule.json`

**Content**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_quickly_wield_weapon",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "weapons:event-is-action-quickly-wield-weapon"
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
        "entity_ref": "target",
        "result_variable": "targetName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get target's grabbing requirements to know how many appendages to lock",
      "parameters": {
        "entity_ref": "target",
        "component_type": "anatomy:requires_grabbing",
        "result_variable": "targetGrabbingReqs",
        "missing_value": { "handsRequired": 1 }
      }
    },
    {
      "type": "LOCK_GRABBING",
      "comment": "Lock the required number of grabbing appendages for this weapon",
      "parameters": {
        "actor_id": "{event.payload.actorId}",
        "count": "{context.targetGrabbingReqs.handsRequired}",
        "item_id": "{event.payload.targetId}"
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
        "value": "{context.actorName} quickly grabs {context.targetName} from the location and wields it."
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
    {
      "type": "REMOVE_COMPONENT",
      "comment": "Remove weapon from world position (it's now being held)",
      "parameters": {
        "entity_ref": "target",
        "component_type": "core:position"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Check if actor already has wielding component",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:wielding",
        "result_variable": "existingWielding",
        "missing_value": null
      }
    },
    {
      "type": "IF",
      "comment": "Add to existing array or create new component",
      "parameters": {
        "condition": { "var": "context.existingWielding" },
        "then_actions": [
          {
            "type": "MODIFY_ARRAY_FIELD",
            "comment": "Append weapon to existing wielded_item_ids array",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "positioning:wielding",
              "field": "wielded_item_ids",
              "mode": "push_unique",
              "value": "{event.payload.targetId}"
            }
          }
        ],
        "else_actions": [
          {
            "type": "ADD_COMPONENT",
            "comment": "Create new wielding component with weapon in array",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "positioning:wielding",
              "value": {
                "wielded_item_ids": ["{event.payload.targetId}"]
              }
            }
          }
        ]
      }
    },
    {
      "type": "REGENERATE_DESCRIPTION",
      "comment": "Update actor description to include wielding activity",
      "parameters": { "entity_ref": "actor" }
    },
    {
      "comment": "Log success and end turn",
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Key Differences from `handle_wield_threateningly.rule.json`**:
1. **Log message**: Changed to `"{context.actorName} quickly grabs {context.targetName} from the location and wields it."`
2. **REMOVE_COMPONENT operation**: Added to remove the weapon's `core:position` component since the weapon is being picked up from the location (unlike wielding from inventory where the weapon is already "held")
3. **Condition reference**: Points to `weapons:event-is-action-quickly-wield-weapon`

---

### 5. Manifest Update

**Path**: `data/mods/weapons/mod-manifest.json`

**Required Additions**:
- Add `"quickly_wield_weapon.action.json"` to the `actions` array
- Add `"handle_quickly_wield_weapon.rule.json"` to the `rules` array
- Add `"event-is-action-quickly-wield-weapon.condition.json"` to the `conditions` array
- Add `"grabbable_weapons_at_location.scope"` to the `scopes` array

---

## Test Specifications

### Test File Locations

Following project conventions from `docs/testing/mod-testing-guide.md`:

1. **Action Discovery Tests**: `tests/integration/mods/weapons/quickly_wield_weapon_action_discovery.test.js`
2. **Rule Execution Tests**: `tests/integration/mods/weapons/quickly_wield_weapon_rule_execution.test.js`

---

### Action Discovery Test Specification

**File**: `tests/integration/mods/weapons/quickly_wield_weapon_action_discovery.test.js`

**Test Cases**:

#### 1. Action Structure Validation
```javascript
describe('weapons:quickly_wield_weapon action definition', () => {
  it('should have correct action ID', () => {
    expect(actionJson.id).toBe('weapons:quickly_wield_weapon');
  });

  it('should have generateCombinations enabled', () => {
    expect(actionJson.generateCombinations).toBe(true);
  });

  it('should require items:inventory component on actor', () => {
    expect(actionJson.required_components.actor).toContain('items:inventory');
  });

  it('should forbid positioning:closeness on actor', () => {
    expect(actionJson.forbidden_components.actor).toContain('positioning:closeness');
  });

  it('should forbid positioning:fallen on actor', () => {
    expect(actionJson.forbidden_components.actor).toContain('positioning:fallen');
  });

  it('should forbid positioning:being_restrained on actor', () => {
    expect(actionJson.forbidden_components.actor).toContain('positioning:being_restrained');
  });

  it('should forbid positioning:restraining on actor', () => {
    expect(actionJson.forbidden_components.actor).toContain('positioning:restraining');
  });

  it('should have free grabbing appendage prerequisite', () => {
    expect(actionJson.prerequisites[0].logic.condition_ref).toBe('anatomy:actor-has-free-grabbing-appendage');
  });

  it('should use weapons:grabbable_weapons_at_location scope', () => {
    expect(actionJson.targets.primary.scope).toBe('weapons:grabbable_weapons_at_location');
  });

  it('should have correct template', () => {
    expect(actionJson.template).toBe('quickly wield {target}');
  });

  it('should use dark blue visual scheme', () => {
    expect(actionJson.visual.backgroundColor).toBe('#112a46');
  });
});
```

#### 2. Action Discoverability Tests
```javascript
describe('weapons:quickly_wield_weapon discoverability', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'weapons',
      'weapons:quickly_wield_weapon',
      null,
      null,
      { autoRegisterScopes: true, scopeCategories: ['positioning', 'weapons'] }
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should be discoverable when weapon exists at actor location', async () => {
    // Arrange: Actor at location with weapon on ground
    const scenario = createWeaponAtLocationScenario();
    testFixture.reset(scenario.entities);

    // Act
    const actions = testFixture.discoverActions(scenario.actor.id);

    // Assert
    expect(actions).toContainAction('weapons:quickly_wield_weapon');
  });

  it('should NOT be discoverable when no weapons at location', async () => {
    // Arrange: Actor at location with no weapons
    const scenario = createActorOnlyScenario();
    testFixture.reset(scenario.entities);

    // Act
    const actions = testFixture.discoverActions(scenario.actor.id);

    // Assert
    expect(actions).not.toContainAction('weapons:quickly_wield_weapon');
  });

  it('should NOT be discoverable when actor has positioning:fallen', async () => {
    // Arrange: Fallen actor with weapon at location
    const scenario = createWeaponAtLocationScenario({ actorFallen: true });
    testFixture.reset(scenario.entities);

    // Act
    const actions = testFixture.discoverActions(scenario.actor.id);

    // Assert
    expect(actions).not.toContainAction('weapons:quickly_wield_weapon');
  });

  it('should NOT be discoverable when actor has positioning:closeness', async () => {
    // Arrange: Actor in close contact with someone
    const scenario = createWeaponAtLocationScenario({ actorInCloseness: true });
    testFixture.reset(scenario.entities);

    // Act
    const actions = testFixture.discoverActions(scenario.actor.id);

    // Assert
    expect(actions).not.toContainAction('weapons:quickly_wield_weapon');
  });

  it('should NOT be discoverable when actor has no free grabbing appendage', async () => {
    // Arrange: Actor with all hands occupied
    const scenario = createWeaponAtLocationScenario({ handsOccupied: true });
    testFixture.reset(scenario.entities);

    // Act
    const actions = testFixture.discoverActions(scenario.actor.id);

    // Assert
    expect(actions).not.toContainAction('weapons:quickly_wield_weapon');
  });

  it('should NOT be discoverable when weapon is at different location', async () => {
    // Arrange: Actor at location A, weapon at location B
    const scenario = createWeaponAtDifferentLocationScenario();
    testFixture.reset(scenario.entities);

    // Act
    const actions = testFixture.discoverActions(scenario.actor.id);

    // Assert
    expect(actions).not.toContainAction('weapons:quickly_wield_weapon');
  });

  it('should NOT be discoverable when weapon is already being grabbed', async () => {
    // Arrange: Weapon at location but already held by someone
    const scenario = createWeaponAlreadyGrabbedScenario();
    testFixture.reset(scenario.entities);

    // Act
    const actions = testFixture.discoverActions(scenario.actor.id);

    // Assert
    expect(actions).not.toContainAction('weapons:quickly_wield_weapon');
  });
});
```

---

### Rule Execution Test Specification

**File**: `tests/integration/mods/weapons/quickly_wield_weapon_rule_execution.test.js`

**Test Cases**:

#### 1. Successful Execution
```javascript
describe('weapons:quickly_wield_weapon rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'weapons',
      'weapons:quickly_wield_weapon',
      handleQuicklyWieldWeaponRule,
      eventIsActionQuicklyWieldWeapon
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should successfully wield weapon from location', async () => {
    // Arrange
    const scenario = createWeaponAtLocationScenario();
    testFixture.reset(scenario.entities);

    // Act
    await testFixture.executeAction(scenario.actor.id, scenario.weapon.id);

    // Assert
    const actor = testFixture.entityManager.getEntityInstance(scenario.actor.id);
    expect(actor).toHaveComponent('positioning:wielding');
    expect(actor.components['positioning:wielding'].wielded_item_ids).toContain(scenario.weapon.id);
  });

  it('should remove weapon position component after wielding', async () => {
    // Arrange
    const scenario = createWeaponAtLocationScenario();
    testFixture.reset(scenario.entities);

    // Act
    await testFixture.executeAction(scenario.actor.id, scenario.weapon.id);

    // Assert
    const weapon = testFixture.entityManager.getEntityInstance(scenario.weapon.id);
    expect(weapon).not.toHaveComponent('core:position');
  });

  it('should dispatch correct log message', async () => {
    // Arrange
    const scenario = createWeaponAtLocationScenario({ actorName: 'Alice', weaponName: 'Iron Sword' });
    testFixture.reset(scenario.entities);

    // Act
    await testFixture.executeAction(scenario.actor.id, scenario.weapon.id);

    // Assert
    expect(testFixture.events).toHaveActionSuccess('Alice quickly grabs Iron Sword from the location and wields it.');
  });

  it('should lock grabbing appendages for the weapon', async () => {
    // Arrange
    const scenario = createWeaponAtLocationScenario({ handsRequired: 2 });
    testFixture.reset(scenario.entities);

    // Act
    await testFixture.executeAction(scenario.actor.id, scenario.weapon.id);

    // Assert: Verify grabbing appendages are locked
    // Implementation depends on anatomy system checks
  });

  it('should append to existing wielded items array', async () => {
    // Arrange: Actor already wielding one weapon
    const scenario = createWeaponAtLocationScenario({ alreadyWielding: 'existing-weapon-id' });
    testFixture.reset(scenario.entities);

    // Act
    await testFixture.executeAction(scenario.actor.id, scenario.weapon.id);

    // Assert
    const actor = testFixture.entityManager.getEntityInstance(scenario.actor.id);
    expect(actor.components['positioning:wielding'].wielded_item_ids).toContain('existing-weapon-id');
    expect(actor.components['positioning:wielding'].wielded_item_ids).toContain(scenario.weapon.id);
  });

  it('should regenerate actor description after wielding', async () => {
    // Arrange
    const scenario = createWeaponAtLocationScenario();
    testFixture.reset(scenario.entities);

    // Act
    await testFixture.executeAction(scenario.actor.id, scenario.weapon.id);

    // Assert: REGENERATE_DESCRIPTION was called
    // Verify through event dispatch or component state
  });

  it('should end turn after successful wielding', async () => {
    // Arrange
    const scenario = createWeaponAtLocationScenario();
    testFixture.reset(scenario.entities);

    // Act
    await testFixture.executeAction(scenario.actor.id, scenario.weapon.id);

    // Assert
    expect(testFixture.events).toDispatchEvent('core:turn_ended');
  });
});
```

---

### Test Helper Functions

Create helper functions in test files or add to `tests/common/mods/weapons/quicklyWieldWeaponFixtures.js`:

```javascript
function createWeaponAtLocationScenario(options = {}) {
  const {
    actorName = 'TestActor',
    weaponName = 'TestSword',
    locationId = 'test:location1',
    actorFallen = false,
    actorInCloseness = false,
    handsOccupied = false,
    handsRequired = 1,
    alreadyWielding = null
  } = options;

  const location = new ModEntityBuilder()
    .withId(`test:${locationId}`)
    .withComponent('core:name', { name: 'Test Room' })
    .build();

  const actorBuilder = new ModEntityBuilder()
    .withId('test:actor1')
    .withComponent('core:name', { name: actorName })
    .withComponent('core:position', { locationId })
    .withComponent('items:inventory', { items: [], capacity: { maxWeight: 50, maxItems: 10 } })
    .withComponent('anatomy:grabbing_appendages', {
      appendages: [
        { id: 'left-hand', locked: handsOccupied, lockedBy: handsOccupied ? 'something' : null },
        { id: 'right-hand', locked: false, lockedBy: null }
      ]
    });

  if (actorFallen) {
    actorBuilder.withComponent('positioning:fallen', {});
  }

  if (actorInCloseness) {
    actorBuilder.withComponent('positioning:closeness', { partnerId: 'someone' });
  }

  if (alreadyWielding) {
    actorBuilder.withComponent('positioning:wielding', { wielded_item_ids: [alreadyWielding] });
  }

  const weapon = new ModEntityBuilder()
    .withId('test:weapon1')
    .withComponent('core:name', { name: weaponName })
    .withComponent('core:position', { locationId })
    .withComponent('weapons:weapon', { type: 'sword' })
    .withComponent('items:portable', { weight: 2.0 })
    .withComponent('anatomy:requires_grabbing', { handsRequired })
    .build();

  return {
    entities: [location, actorBuilder.build(), weapon],
    actor: { id: 'test:actor1' },
    weapon: { id: 'test:weapon1' },
    location: { id: `test:${locationId}` }
  };
}

function createActorOnlyScenario() {
  // Actor at location with no weapons
}

function createWeaponAtDifferentLocationScenario() {
  // Actor at location A, weapon at location B
}

function createWeaponAlreadyGrabbedScenario() {
  // Weapon is being held by another actor
}
```

---

## Validation Checklist

Before implementation is complete, verify:

- [x] Scope file parses correctly and returns expected entities
- [x] Action JSON validates against `action.schema.json`
- [x] Condition JSON validates against `condition.schema.json`
- [x] Rule JSON validates against `rule.schema.json`
- [x] Manifest updated with all new files
- [x] All discovery tests pass
- [x] All rule execution tests pass
- [x] `npm run validate` passes
- [x] `npm run test:integration -- tests/integration/mods/weapons/quickly_wield_weapon*.test.js` passes
- [x] ESLint passes on new test files

---

## Dependencies

This feature depends on:

1. **Existing Components**:
   - `items:inventory`
   - `items:portable`
   - `weapons:weapon`
   - `positioning:wielding`
   - `positioning:closeness`
   - `positioning:fallen`
   - `positioning:being_restrained`
   - `positioning:restraining`
   - `anatomy:requires_grabbing`
   - `core:position`
   - `core:name`

2. **Existing Conditions**:
   - `anatomy:actor-has-free-grabbing-appendage`

3. **Existing Operations**:
   - `GET_NAME`
   - `QUERY_COMPONENT`
   - `LOCK_GRABBING`
   - `SET_VARIABLE`
   - `REMOVE_COMPONENT`
   - `IF`
   - `MODIFY_ARRAY_FIELD`
   - `ADD_COMPONENT`
   - `REGENERATE_DESCRIPTION`

4. **Existing Macros**:
   - `core:logSuccessAndEndTurn`

---

## Notes

1. **Difference from `wield_threateningly`**: The key difference is that this action targets weapons at the actor's location (on the ground) rather than in inventory. This requires:
   - A new scope that queries location-based entities
   - An additional `REMOVE_COMPONENT` operation to remove the weapon's position (since it's being picked up)

2. **No inventory addition**: Unlike `pick_up_item`, this action does NOT add the weapon to the actor's inventory. The weapon goes directly to being wielded. This is intentional for the "quick grab and use" scenario.

3. **File naming**: Per project conventions:
   - Action/rule/scope files use underscores: `quickly_wield_weapon.action.json`
   - Condition files use hyphens: `event-is-action-quickly-wield-weapon.condition.json`
