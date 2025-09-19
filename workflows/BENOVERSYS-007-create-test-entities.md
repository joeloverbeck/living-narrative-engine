# BENOVERSYS-007: Create Test Entities

## Overview
Create example surface entities that support the bending over system for testing and demonstration purposes. These entities will include various types of surfaces (counters, sofas, tables, desks) with appropriate components to validate the system functionality.

## Prerequisites
- BENOVERSYS-001 through BENOVERSYS-006 completed
- Understanding of entity definition structure
- Knowledge of existing entity patterns in positioning mod

## Acceptance Criteria
1. Create at least 5 different surface entities with bending capability
2. Include dual-purpose furniture (both sittable and bendable)
3. Entities distributed across different locations for testing
4. All entities validate against entity schema
5. Clear naming and descriptions for testing purposes
6. Include variety of surface types (kitchen, living room, office)

## Implementation Steps

### Step 1: Create Kitchen Counter Entity
Create `data/mods/positioning/entities/test/kitchen_counter.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "positioning:test_kitchen_counter",
  "components": {
    "core:name": {
      "value": "kitchen counter"
    },
    "core:description": {
      "value": "A clean granite kitchen counter with plenty of space."
    },
    "core:position": {
      "locationId": "positioning:test_kitchen"
    },
    "positioning:allows_bending_over": {}
  }
}
```

### Step 2: Create Living Room Sofa Entity (Dual-Purpose)
Create `data/mods/positioning/entities/test/living_sofa.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "positioning:test_living_sofa",
  "components": {
    "core:name": {
      "value": "comfortable sofa"
    },
    "core:description": {
      "value": "A large, plush sofa that can seat three people comfortably."
    },
    "core:position": {
      "locationId": "positioning:test_living_room"
    },
    "positioning:allows_sitting": {
      "spots": [null, null, null]
    },
    "positioning:allows_bending_over": {}
  }
}
```

### Step 3: Create Office Desk Entity
Create `data/mods/positioning/entities/test/office_desk.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "positioning:test_office_desk",
  "components": {
    "core:name": {
      "value": "wooden desk"
    },
    "core:description": {
      "value": "A sturdy wooden desk with papers and a computer on top."
    },
    "core:position": {
      "locationId": "positioning:test_office"
    },
    "positioning:allows_bending_over": {}
  }
}
```

### Step 4: Create Dining Table Entity
Create `data/mods/positioning/entities/test/dining_table.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "positioning:test_dining_table",
  "components": {
    "core:name": {
      "value": "dining table"
    },
    "core:description": {
      "value": "A large oak dining table that seats six."
    },
    "core:position": {
      "locationId": "positioning:test_dining_room"
    },
    "positioning:allows_sitting": {
      "spots": [null, null, null, null, null, null]
    },
    "positioning:allows_bending_over": {}
  }
}
```

### Step 5: Create Bathroom Counter Entity
Create `data/mods/positioning/entities/test/bathroom_counter.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "positioning:test_bathroom_counter",
  "components": {
    "core:name": {
      "value": "bathroom counter"
    },
    "core:description": {
      "value": "A marble bathroom counter with a sink and mirror above."
    },
    "core:position": {
      "locationId": "positioning:test_bathroom"
    },
    "positioning:allows_bending_over": {}
  }
}
```

### Step 6: Create Test Location Entities
Create supporting location entities for testing:

`data/mods/positioning/entities/test/locations.entity.json`:

```json
{
  "entities": [
    {
      "$schema": "schema://living-narrative-engine/entity.schema.json",
      "id": "positioning:test_kitchen",
      "components": {
        "core:name": { "value": "Test Kitchen" },
        "core:location": { "locationType": "room" }
      }
    },
    {
      "$schema": "schema://living-narrative-engine/entity.schema.json",
      "id": "positioning:test_living_room",
      "components": {
        "core:name": { "value": "Test Living Room" },
        "core:location": { "locationType": "room" }
      }
    },
    {
      "$schema": "schema://living-narrative-engine/entity.schema.json",
      "id": "positioning:test_office",
      "components": {
        "core:name": { "value": "Test Office" },
        "core:location": { "locationType": "room" }
      }
    },
    {
      "$schema": "schema://living-narrative-engine/entity.schema.json",
      "id": "positioning:test_dining_room",
      "components": {
        "core:name": { "value": "Test Dining Room" },
        "core:location": { "locationType": "room" }
      }
    },
    {
      "$schema": "schema://living-narrative-engine/entity.schema.json",
      "id": "positioning:test_bathroom",
      "components": {
        "core:name": { "value": "Test Bathroom" },
        "core:location": { "locationType": "room" }
      }
    }
  ]
}
```

### Step 7: Create Test Actor Entities
Create `data/mods/positioning/entities/test/test_actors.entity.json`:

```json
{
  "entities": [
    {
      "$schema": "schema://living-narrative-engine/entity.schema.json",
      "id": "positioning:test_actor_1",
      "components": {
        "core:name": { "value": "Alice" },
        "core:actor": { "actorType": "npc" },
        "core:position": { "locationId": "positioning:test_kitchen" },
        "core:movement": { "locked": false }
      }
    },
    {
      "$schema": "schema://living-narrative-engine/entity.schema.json",
      "id": "positioning:test_actor_2",
      "components": {
        "core:name": { "value": "Bob" },
        "core:actor": { "actorType": "npc" },
        "core:position": { "locationId": "positioning:test_living_room" },
        "core:movement": { "locked": false }
      }
    },
    {
      "$schema": "schema://living-narrative-engine/entity.schema.json",
      "id": "positioning:test_actor_3",
      "components": {
        "core:name": { "value": "Charlie" },
        "core:actor": { "actorType": "npc" },
        "core:position": { "locationId": "positioning:test_kitchen" },
        "core:movement": { "locked": false }
      }
    }
  ]
}
```

## Testing Requirements

### Unit Tests

1. **Entity Loading Tests**:
```javascript
describe('Test entity loading', () => {
  it('should load all test surface entities', async () => {
    const entities = [
      'positioning:test_kitchen_counter',
      'positioning:test_living_sofa',
      'positioning:test_office_desk',
      'positioning:test_dining_table',
      'positioning:test_bathroom_counter'
    ];

    for (const entityId of entities) {
      const entity = await entityLoader.load(entityId);
      expect(entity).toBeDefined();
      expect(entity.components['positioning:allows_bending_over']).toBeDefined();
    }
  });

  it('should validate dual-purpose furniture', async () => {
    const sofa = await entityLoader.load('positioning:test_living_sofa');
    expect(sofa.components['positioning:allows_sitting']).toBeDefined();
    expect(sofa.components['positioning:allows_bending_over']).toBeDefined();
  });
});
```

2. **Schema Validation Tests**:
```javascript
describe('Entity schema validation', () => {
  it('should validate all test entities against schema', () => {
    const testEntities = loadTestEntities();

    testEntities.forEach(entity => {
      const isValid = validateEntitySchema(entity);
      expect(isValid).toBe(true);
    });
  });
});
```

### Integration Tests

1. **Complete Scenario Test**:
```javascript
describe('Bending over scenarios', () => {
  it('should support multiple actors at kitchen counter', async () => {
    const alice = getEntity('positioning:test_actor_1');
    const charlie = getEntity('positioning:test_actor_3');
    const counter = getEntity('positioning:test_kitchen_counter');

    // Both actors bend over counter
    await performAction(alice, 'positioning:bend_over', counter);
    await performAction(charlie, 'positioning:bend_over', counter);

    // Verify both are bending
    expect(alice.components['positioning:bending_over'].surface_id).toBe(counter.id);
    expect(charlie.components['positioning:bending_over'].surface_id).toBe(counter.id);

    // Verify closeness established
    const aliceCloseness = getClosenessRelationships(alice.id);
    expect(aliceCloseness).toContain(charlie.id);
  });

  it('should handle mixed positioning on dual furniture', async () => {
    const alice = getEntity('positioning:test_actor_1');
    const bob = getEntity('positioning:test_actor_2');
    const sofa = getEntity('positioning:test_living_sofa');

    // Alice sits
    await performAction(alice, 'positioning:sit_down', sofa);

    // Bob tries to bend over (should work - different positioning)
    await performAction(bob, 'positioning:bend_over', sofa);

    expect(alice.components['positioning:sitting_on']).toBeDefined();
    expect(bob.components['positioning:bending_over']).toBeDefined();
  });
});
```

## Test Scenarios

### Scenario 1: Single Actor Bending
1. Actor enters kitchen
2. Actor bends over counter
3. Verify movement locked
4. Actor straightens up
5. Verify movement restored

### Scenario 2: Multiple Actors Same Surface
1. Actor A bends over counter
2. Actor B bends over same counter
3. Verify closeness established
4. Actor A straightens up
5. Verify Actor A no longer close to B
6. Verify Actor B still bending

### Scenario 3: Dual-Purpose Furniture
1. Actor A sits on sofa
2. Actor B bends over sofa
3. Verify both states valid
4. Actor C tries to sit (should work if spots available)
5. Actor D tries to bend (should work - unlimited)

### Scenario 4: Location-Based Filtering
1. Actors in different rooms
2. Verify only see surfaces in their location
3. Move actor to new room
4. Verify surface availability updates

## Notes
- Test entities use `positioning:` namespace for isolation
- Dual-purpose furniture tests system flexibility
- Variety of surface types ensures broad coverage
- Test actors enable multi-actor scenarios
- Location entities support scope testing

## Dependencies
- Blocks: BENOVERSYS-008 (integration testing needs test entities)
- Blocked by: BENOVERSYS-001 through BENOVERSYS-006 (requires complete system)

## Estimated Effort
- 30 minutes implementation
- 15 minutes validation

## Risk Assessment
- **Very Low Risk**: Test entities don't affect production
- **Mitigation**: Clear test namespace prevents conflicts
- **Recovery**: Simple deletion if not needed

## Success Metrics
- All test entities created and validated
- Entities cover variety of scenarios
- Dual-purpose furniture works correctly
- Test actors enable comprehensive testing
- Clear documentation for test scenarios