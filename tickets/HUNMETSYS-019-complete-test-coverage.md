# HUNMETSYS-019: Complete Test Coverage

**Status**: Not Started  
**Priority**: Medium  
**Estimated Effort**: 2-3 days  
**Dependencies**: HUNMETSYS-001 through HUNMETSYS-018

---

## Objective

Achieve comprehensive test coverage for the Hunger and Metabolism System, meeting project quality standards of 80%+ branch coverage and 90%+ function/line coverage through systematic identification and testing of uncovered code paths.

---

## Context

While implementation tickets (HUNMETSYS-001 through HUNMETSYS-018) include basic testing requirements, this ticket ensures complete test coverage across the entire system. The Living Narrative Engine project maintains strict quality standards requiring:

- **Branch Coverage**: ≥80%
- **Function Coverage**: ≥90%
- **Line Coverage**: ≥90%

This ticket focuses on filling coverage gaps through additional unit tests, integration tests, edge case tests, and validation tests, ensuring the hunger/metabolism system meets production quality standards.

From **specs/hunger-metabolism-system.md § Test Coverage Strategy**:

> "All components must meet or exceed project coverage thresholds. Coverage gaps should be systematically identified and filled with targeted tests focusing on error paths, edge cases, and integration scenarios."

---

## Files to Touch

### Test Files to Create/Expand

**Unit Tests** (expand existing or create new):
- `tests/unit/logic/operationHandlers/burnEnergyHandler.coverage.test.js`
- `tests/unit/logic/operationHandlers/digestFoodHandler.coverage.test.js`
- `tests/unit/logic/operationHandlers/consumeItemHandler.coverage.test.js`
- `tests/unit/logic/operationHandlers/updateHungerStateHandler.coverage.test.js`
- `tests/unit/logic/operationHandlers/updateBodyCompositionHandler.coverage.test.js`
- `tests/unit/logic/operators/isHungryOperator.coverage.test.js`
- `tests/unit/logic/operators/predictedEnergyOperator.coverage.test.js`
- `tests/unit/logic/operators/canConsumeOperator.coverage.test.js`

**Integration Tests** (expand existing or create new):
- `tests/integration/metabolism/multiActorScenarios.integration.test.js`
- `tests/integration/metabolism/stateTransitions.integration.test.js`
- `tests/integration/metabolism/componentInteractions.integration.test.js`
- `tests/integration/metabolism/ruleChaining.integration.test.js`

**Edge Case Tests** (create new):
- `tests/integration/metabolism/boundaryConditions.integration.test.js`
- `tests/integration/metabolism/invalidInputs.integration.test.js`
- `tests/integration/metabolism/concurrentOperations.integration.test.js`

**Validation Tests** (create new):
- `tests/integration/metabolism/schemaValidation.integration.test.js`
- `tests/integration/metabolism/componentIntegrity.integration.test.js`

---

## Implementation Details

### Step 1: Coverage Analysis

**Generate current coverage report**:

```bash
npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operationHandlers/*Energy*'
npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operationHandlers/*Digest*'
npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operationHandlers/*Consume*'
npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operationHandlers/*Hunger*'
npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operationHandlers/*Body*'
npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operators/*hungry*'
npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operators/*energy*'
npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operators/*consume*'
```

**Identify uncovered code paths**:
- Review coverage HTML reports in `coverage/lcov-report/`
- Document uncovered branches, functions, and lines
- Prioritize critical paths (error handling, validation, state transitions)

### Step 2: Operation Handler Coverage

**BurnEnergyHandler - Additional Test Cases**:

```javascript
// tests/unit/logic/operationHandlers/burnEnergyHandler.coverage.test.js

describe('BurnEnergyHandler - Coverage Gaps', () => {
  describe('Edge Cases', () => {
    it('should handle entity with no metabolic_store component', () => {
      const entity = testBed.createEntity('test_entity');
      
      expect(() => {
        handler.execute({
          entity_ref: 'test_entity',
          amount: 100,
          activity_multiplier: 1.0
        });
      }).toThrow('Entity test_entity missing required component');
    });

    it('should handle zero burn amount', () => {
      const entity = createEntityWithMetabolicStore(1000);
      
      handler.execute({
        entity_ref: entity.id,
        amount: 0,
        activity_multiplier: 1.0
      });
      
      const store = testBed.getComponent(entity.id, 'metabolism:metabolic_store');
      expect(store.current_energy).toBe(1000);
    });

    it('should handle negative multiplier (invalid)', () => {
      const entity = createEntityWithMetabolicStore(1000);
      
      expect(() => {
        handler.execute({
          entity_ref: entity.id,
          amount: 100,
          activity_multiplier: -1.0
        });
      }).toThrow('Invalid activity_multiplier');
    });

    it('should clamp energy at zero when burn exceeds available', () => {
      const entity = createEntityWithMetabolicStore(50);
      
      handler.execute({
        entity_ref: entity.id,
        amount: 100,
        activity_multiplier: 1.0
      });
      
      const store = testBed.getComponent(entity.id, 'metabolism:metabolic_store');
      expect(store.current_energy).toBe(0);
    });

    it('should handle concurrent burns on same entity', async () => {
      const entity = createEntityWithMetabolicStore(1000);
      
      await Promise.all([
        handler.execute({ entity_ref: entity.id, amount: 200, activity_multiplier: 1.0 }),
        handler.execute({ entity_ref: entity.id, amount: 300, activity_multiplier: 1.0 }),
        handler.execute({ entity_ref: entity.id, amount: 100, activity_multiplier: 1.0 })
      ]);
      
      const store = testBed.getComponent(entity.id, 'metabolism:metabolic_store');
      expect(store.current_energy).toBe(400); // 1000 - 200 - 300 - 100
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed metabolic_store component', () => {
      const entity = testBed.createEntity('test_entity');
      testBed.addComponent(entity.id, 'metabolism:metabolic_store', {
        // Missing required fields
      });
      
      expect(() => {
        handler.execute({
          entity_ref: entity.id,
          amount: 100,
          activity_multiplier: 1.0
        });
      }).toThrow('Malformed metabolic_store component');
    });

    it('should handle non-existent entity reference', () => {
      expect(() => {
        handler.execute({
          entity_ref: 'non_existent',
          amount: 100,
          activity_multiplier: 1.0
        });
      }).toThrow('Entity non_existent not found');
    });
  });

  describe('Logging and Events', () => {
    it('should log energy burn operation', () => {
      const mockLogger = testBed.createMockLogger();
      const entity = createEntityWithMetabolicStore(1000);
      
      handler.execute({
        entity_ref: entity.id,
        amount: 100,
        activity_multiplier: 1.5
      });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Burned 150 energy')
      );
    });

    it('should dispatch energy_depleted event when energy reaches zero', () => {
      const mockEventBus = testBed.createMockEventBus();
      const entity = createEntityWithMetabolicStore(50);
      
      handler.execute({
        entity_ref: entity.id,
        amount: 100,
        activity_multiplier: 1.0
      });
      
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'metabolism:energy_depleted',
        payload: { entityId: entity.id }
      });
    });
  });
});
```

**DigestFoodHandler - Additional Test Cases**:

```javascript
// tests/unit/logic/operationHandlers/digestFoodHandler.coverage.test.js

describe('DigestFoodHandler - Coverage Gaps', () => {
  describe('Buffer Overflow Scenarios', () => {
    it('should clamp buffer_storage at max_energy when overflow occurs', () => {
      const entity = createEntityWithMetabolicStore(800, 500, 1000); // current=800, buffer=500, max=1000
      
      handler.execute({ entity_ref: entity.id });
      
      const store = testBed.getComponent(entity.id, 'metabolism:metabolic_store');
      // buffer (500) * efficiency (0.8) = 400, but max is 1000
      // So current should be clamped: min(800 + 400, 1000) = 1000
      expect(store.current_energy).toBe(1000);
      expect(store.buffer_storage).toBe(100); // 500 - 400 transferred = 100
    });

    it('should handle zero efficiency in fuel_converter', () => {
      const entity = createEntityWithMetabolicStore(500);
      const converter = testBed.getComponent(entity.id, 'metabolism:fuel_converter');
      converter.efficiency = 0.0;
      testBed.updateComponent(entity.id, 'metabolism:fuel_converter', converter);
      
      handler.execute({ entity_ref: entity.id });
      
      const store = testBed.getComponent(entity.id, 'metabolism:metabolic_store');
      expect(store.current_energy).toBe(500); // No transfer with zero efficiency
    });
  });

  describe('Component State Validation', () => {
    it('should handle entity with buffer_storage but no fuel_converter', () => {
      const entity = testBed.createEntity('test_entity');
      testBed.addComponent(entity.id, 'metabolism:metabolic_store', {
        current_energy: 500,
        buffer_storage: 200,
        max_energy: 1000
      });
      // No fuel_converter component
      
      expect(() => {
        handler.execute({ entity_ref: entity.id });
      }).toThrow('Missing fuel_converter component');
    });

    it('should handle negative buffer_storage (data corruption)', () => {
      const entity = createEntityWithMetabolicStore(500, -100, 1000);
      
      handler.execute({ entity_ref: entity.id });
      
      const store = testBed.getComponent(entity.id, 'metabolism:metabolic_store');
      expect(store.buffer_storage).toBe(0); // Should clamp to zero
    });
  });
});
```

**ConsumeItemHandler - Additional Test Cases**:

```javascript
// tests/unit/logic/operationHandlers/consumeItemHandler.coverage.test.js

describe('ConsumeItemHandler - Coverage Gaps', () => {
  describe('Invalid Fuel Sources', () => {
    it('should reject item with no fuel_source component', () => {
      const consumer = createEntityWithFuelConverter();
      const item = testBed.createEntity('plain_item'); // No fuel_source
      
      expect(() => {
        handler.execute({
          consumer_ref: consumer.id,
          item_ref: item.id
        });
      }).toThrow('Item plain_item is not consumable');
    });

    it('should reject item with incompatible fuel_type', () => {
      const consumer = createEntityWithFuelConverter(['solid', 'liquid']);
      const item = createItemWithFuelSource('gaseous', 500); // Wrong type
      
      expect(() => {
        handler.execute({
          consumer_ref: consumer.id,
          item_ref: item.id
        });
      }).toThrow('Cannot consume fuel_type: gaseous');
    });

    it('should handle item with zero energy_value', () => {
      const consumer = createEntityWithFuelConverter();
      const item = createItemWithFuelSource('solid', 0); // No energy
      
      handler.execute({
        consumer_ref: consumer.id,
        item_ref: item.id
      });
      
      const store = testBed.getComponent(consumer.id, 'metabolism:metabolic_store');
      expect(store.buffer_storage).toBe(0);
    });
  });

  describe('Item State Management', () => {
    it('should properly destroy item after consumption', () => {
      const consumer = createEntityWithFuelConverter();
      const item = createItemWithFuelSource('solid', 500);
      
      handler.execute({
        consumer_ref: consumer.id,
        item_ref: item.id
      });
      
      expect(testBed.entityExists(item.id)).toBe(false);
    });

    it('should handle item destruction failure gracefully', () => {
      const consumer = createEntityWithFuelConverter();
      const item = createItemWithFuelSource('solid', 500);
      
      // Mock destroy to fail
      testBed.mockDestroyEntityFailure(item.id);
      
      expect(() => {
        handler.execute({
          consumer_ref: consumer.id,
          item_ref: item.id
        });
      }).toThrow('Failed to destroy consumed item');
    });
  });
});
```

### Step 3: JSON Logic Operator Coverage

**IsHungryOperator - Additional Test Cases**:

```javascript
// tests/unit/logic/operators/isHungryOperator.coverage.test.js

describe('IsHungryOperator - Coverage Gaps', () => {
  describe('State Edge Cases', () => {
    it('should return false for undefined state', () => {
      const entity = testBed.createEntity('test_entity');
      testBed.addComponent(entity.id, 'metabolism:hunger_state', {
        state: undefined,
        turns_in_state: 0
      });
      
      const result = operator.evaluate([entity.id]);
      expect(result).toBe(false);
    });

    it('should return false for empty string state', () => {
      const entity = testBed.createEntity('test_entity');
      testBed.addComponent(entity.id, 'metabolism:hunger_state', {
        state: '',
        turns_in_state: 0
      });
      
      const result = operator.evaluate([entity.id]);
      expect(result).toBe(false);
    });

    it('should be case-sensitive for state matching', () => {
      const entity = testBed.createEntity('test_entity');
      testBed.addComponent(entity.id, 'metabolism:hunger_state', {
        state: 'HUNGRY', // Uppercase
        turns_in_state: 5
      });
      
      const result = operator.evaluate([entity.id]);
      expect(result).toBe(false); // Should not match uppercase
    });
  });

  describe('Boundary States', () => {
    it('should return false for "neutral" state (boundary)', () => {
      const entity = createEntityWithHungerState('neutral', 10);
      expect(operator.evaluate([entity.id])).toBe(false);
    });

    it('should return true for "hungry" state (just crossed threshold)', () => {
      const entity = createEntityWithHungerState('hungry', 0);
      expect(operator.evaluate([entity.id])).toBe(true);
    });
  });
});
```

**PredictedEnergyOperator - Additional Test Cases**:

```javascript
// tests/unit/logic/operators/predictedEnergyOperator.coverage.test.js

describe('PredictedEnergyOperator - Coverage Gaps', () => {
  describe('Calculation Edge Cases', () => {
    it('should handle entity with only current_energy (no buffer)', () => {
      const entity = createEntityWithMetabolicStore(500, 0, 1000);
      
      const result = operator.evaluate([entity.id]);
      expect(result).toBe(500); // No buffer to add
    });

    it('should handle entity with zero efficiency', () => {
      const entity = createEntityWithMetabolicStore(500, 400, 1000);
      const converter = testBed.getComponent(entity.id, 'metabolism:fuel_converter');
      converter.efficiency = 0.0;
      testBed.updateComponent(entity.id, 'metabolism:fuel_converter', converter);
      
      const result = operator.evaluate([entity.id]);
      expect(result).toBe(500); // 500 + (400 * 0.0) = 500
    });

    it('should not exceed max_energy in prediction', () => {
      const entity = createEntityWithMetabolicStore(900, 500, 1000);
      // Efficiency 0.8: predicted = 900 + (500 * 0.8) = 1300
      // But should clamp to max_energy = 1000
      
      const result = operator.evaluate([entity.id]);
      expect(result).toBe(1000);
    });
  });

  describe('Component Validation', () => {
    it('should handle missing fuel_converter gracefully', () => {
      const entity = testBed.createEntity('test_entity');
      testBed.addComponent(entity.id, 'metabolism:metabolic_store', {
        current_energy: 500,
        buffer_storage: 200,
        max_energy: 1000
      });
      
      expect(() => {
        operator.evaluate([entity.id]);
      }).toThrow('Missing required component: fuel_converter');
    });

    it('should handle missing metabolic_store gracefully', () => {
      const entity = testBed.createEntity('test_entity');
      testBed.addComponent(entity.id, 'metabolism:fuel_converter', {
        fuel_types: ['solid'],
        efficiency: 0.8
      });
      
      expect(() => {
        operator.evaluate([entity.id]);
      }).toThrow('Missing required component: metabolic_store');
    });
  });
});
```

### Step 4: Integration Coverage

**Multi-Actor Scenarios**:

```javascript
// tests/integration/metabolism/multiActorScenarios.integration.test.js

describe('Metabolism System - Multi-Actor Integration', () => {
  it('should handle multiple actors eating simultaneously', async () => {
    const actor1 = createActorWithMetabolism('Actor1');
    const actor2 = createActorWithMetabolism('Actor2');
    const food1 = createFood('bread', 500);
    const food2 = createFood('apple', 300);
    
    await Promise.all([
      executeEatAction(actor1.id, food1.id),
      executeEatAction(actor2.id, food2.id)
    ]);
    
    const store1 = testBed.getComponent(actor1.id, 'metabolism:metabolic_store');
    const store2 = testBed.getComponent(actor2.id, 'metabolism:metabolic_store');
    
    expect(store1.buffer_storage).toBe(500);
    expect(store2.buffer_storage).toBe(300);
  });

  it('should process turn-based digestion for 100 actors in <100ms', () => {
    const actors = [];
    for (let i = 0; i < 100; i++) {
      actors.push(createActorWithMetabolism(`Actor${i}`));
    }
    
    const startTime = performance.now();
    
    // Trigger turn-based processing
    testBed.eventBus.dispatch({ type: 'core:turn_ended', payload: {} });
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(100);
  });

  it('should maintain data integrity across concurrent operations', async () => {
    const actor = createActorWithMetabolism('Actor');
    const food = createFood('steak', 1000);
    
    // Concurrent: eat + burn + digest
    await Promise.all([
      executeEatAction(actor.id, food.id),
      burnEnergy(actor.id, 200),
      digestFood(actor.id)
    ]);
    
    const store = testBed.getComponent(actor.id, 'metabolism:metabolic_store');
    
    // Verify final state is consistent
    expect(store.current_energy).toBeGreaterThanOrEqual(0);
    expect(store.buffer_storage).toBeGreaterThanOrEqual(0);
    expect(store.current_energy).toBeLessThanOrEqual(store.max_energy);
  });
});
```

**State Transition Coverage**:

```javascript
// tests/integration/metabolism/stateTransitions.integration.test.js

describe('Metabolism System - State Transitions', () => {
  it('should transition through all hunger states correctly', async () => {
    const actor = createActorWithMetabolism('Actor', 1000); // Start at max
    
    const expectedStates = [
      'satiated',   // 75-100%
      'neutral',    // 30-75%
      'hungry',     // 10-30%
      'starving',   // 0.1-10%
      'critical'    // 0-0.1%
    ];
    
    for (const expectedState of expectedStates) {
      // Burn energy to reach next state
      await burnEnergyToState(actor.id, expectedState);
      
      const hungerState = testBed.getComponent(actor.id, 'metabolism:hunger_state');
      expect(hungerState.state).toBe(expectedState);
    }
  });

  it('should reset turns_in_state when state changes', () => {
    const actor = createActorWithMetabolism('Actor');
    setHungerState(actor.id, 'hungry', 15);
    
    // Eat to change state
    const food = createFood('bread', 800);
    executeEatAction(actor.id, food.id);
    
    // Process turn to update hunger state
    testBed.eventBus.dispatch({ type: 'core:turn_ended', payload: {} });
    
    const hungerState = testBed.getComponent(actor.id, 'metabolism:hunger_state');
    expect(hungerState.state).not.toBe('hungry');
    expect(hungerState.turns_in_state).toBe(0); // Reset
  });

  it('should maintain state when energy changes within same threshold', () => {
    const actor = createActorWithMetabolism('Actor', 600); // Neutral state (30-75%)
    setHungerState(actor.id, 'neutral', 10);
    
    // Burn small amount, stay in neutral range
    burnEnergy(actor.id, 50); // 600 - 50 = 550 (still 55%, neutral)
    
    testBed.eventBus.dispatch({ type: 'core:turn_ended', payload: {} });
    
    const hungerState = testBed.getComponent(actor.id, 'metabolism:hunger_state');
    expect(hungerState.state).toBe('neutral');
    expect(hungerState.turns_in_state).toBe(11); // Incremented
  });
});
```

### Step 5: Edge Case and Validation Coverage

**Boundary Conditions**:

```javascript
// tests/integration/metabolism/boundaryConditions.integration.test.js

describe('Metabolism System - Boundary Conditions', () => {
  describe('Energy Thresholds', () => {
    it('should handle exactly 0 energy', () => {
      const actor = createActorWithMetabolism('Actor', 0);
      
      const hungerState = testBed.getComponent(actor.id, 'metabolism:hunger_state');
      expect(hungerState.state).toBe('critical');
    });

    it('should handle exactly max_energy', () => {
      const actor = createActorWithMetabolism('Actor', 1000);
      
      const hungerState = testBed.getComponent(actor.id, 'metabolism:hunger_state');
      expect(hungerState.state).toBe('satiated');
    });

    it('should handle energy at state boundary (30% exactly)', () => {
      const actor = createActorWithMetabolism('Actor', 300); // Exactly 30%
      
      const hungerState = testBed.getComponent(actor.id, 'metabolism:hunger_state');
      expect(['neutral', 'hungry']).toContain(hungerState.state);
    });
  });

  describe('Component Value Limits', () => {
    it('should handle max_energy of 1', () => {
      const actor = createActorWithMetabolism('Actor', 1, 1);
      
      burnEnergy(actor.id, 0.5);
      
      const store = testBed.getComponent(actor.id, 'metabolism:metabolic_store');
      expect(store.current_energy).toBe(0.5);
    });

    it('should handle efficiency of 1.0 (100%)', () => {
      const actor = createActorWithMetabolism('Actor');
      const converter = testBed.getComponent(actor.id, 'metabolism:fuel_converter');
      converter.efficiency = 1.0;
      testBed.updateComponent(actor.id, 'metabolism:fuel_converter', converter);
      
      const food = createFood('perfect_food', 500);
      executeEatAction(actor.id, food.id);
      digestFood(actor.id);
      
      const store = testBed.getComponent(actor.id, 'metabolism:metabolic_store');
      expect(store.current_energy).toBe(500); // No loss
    });

    it('should handle turns_in_state at exactly required threshold', () => {
      const actor = createActorWithMetabolism('Actor');
      setHungerState(actor.id, 'critical', 20); // Exactly at threshold
      
      updateBodyComposition(actor.id);
      
      const body = testBed.getComponent(actor.id, 'anatomy:body');
      expect(body.composition).toBe('desiccated');
    });
  });
});
```

**Invalid Input Handling**:

```javascript
// tests/integration/metabolism/invalidInputs.integration.test.js

describe('Metabolism System - Invalid Input Handling', () => {
  describe('Operation Parameter Validation', () => {
    it('should reject BURN_ENERGY with missing amount', () => {
      const actor = createActorWithMetabolism('Actor');
      
      expect(() => {
        testBed.executeOperation({
          type: 'BURN_ENERGY',
          parameters: {
            entity_ref: actor.id
            // Missing amount
          }
        });
      }).toThrow('Missing required parameter: amount');
    });

    it('should reject CONSUME_ITEM with invalid consumer_ref', () => {
      const food = createFood('bread', 500);
      
      expect(() => {
        testBed.executeOperation({
          type: 'CONSUME_ITEM',
          parameters: {
            consumer_ref: 'non_existent',
            item_ref: food.id
          }
        });
      }).toThrow('Entity non_existent not found');
    });

    it('should reject UPDATE_HUNGER_STATE with malformed component', () => {
      const actor = testBed.createEntity('Actor');
      testBed.addComponent(actor.id, 'metabolism:metabolic_store', {
        // Missing required fields
        current_energy: 500
      });
      
      expect(() => {
        testBed.executeOperation({
          type: 'UPDATE_HUNGER_STATE',
          parameters: { entity_ref: actor.id }
        });
      }).toThrow('Malformed metabolic_store component');
    });
  });

  describe('Schema Validation Errors', () => {
    it('should reject fuel_converter with invalid fuel_types', () => {
      expect(() => {
        testBed.addComponent('actor', 'metabolism:fuel_converter', {
          fuel_types: 'solid', // Should be array
          efficiency: 0.8
        });
      }).toThrow('Schema validation failed');
    });

    it('should reject metabolic_store with negative max_energy', () => {
      expect(() => {
        testBed.addComponent('actor', 'metabolism:metabolic_store', {
          current_energy: 500,
          buffer_storage: 0,
          max_energy: -1000 // Invalid
        });
      }).toThrow('Schema validation failed');
    });
  });
});
```

**Schema Validation Integration**:

```javascript
// tests/integration/metabolism/schemaValidation.integration.test.js

describe('Metabolism System - Schema Validation', () => {
  it('should validate all component schemas against AJV', () => {
    const componentSchemas = [
      'metabolism:fuel_converter',
      'metabolism:fuel_source',
      'metabolism:metabolic_store',
      'metabolism:hunger_state'
    ];
    
    componentSchemas.forEach(schemaId => {
      const schema = testBed.getSchema(schemaId);
      expect(schema).toBeDefined();
      expect(testBed.validateSchema(schema)).toBe(true);
    });
  });

  it('should validate all operation schemas against AJV', () => {
    const operationSchemas = [
      'BURN_ENERGY',
      'DIGEST_FOOD',
      'CONSUME_ITEM',
      'UPDATE_HUNGER_STATE',
      'UPDATE_BODY_COMPOSITION'
    ];
    
    operationSchemas.forEach(operationType => {
      const schema = testBed.getOperationSchema(operationType);
      expect(schema).toBeDefined();
      expect(testBed.validateSchema(schema)).toBe(true);
    });
  });

  it('should validate all action definitions against schema', () => {
    const actions = ['metabolism:eat', 'metabolism:drink', 'metabolism:rest'];
    
    actions.forEach(actionId => {
      const actionDef = testBed.getActionDefinition(actionId);
      expect(testBed.validateActionSchema(actionDef)).toBe(true);
    });
  });

  it('should validate all rule definitions against schema', () => {
    const rules = [
      'metabolism:handle_eat',
      'metabolism:handle_drink',
      'metabolism:handle_rest',
      'metabolism:process_turn_digestion',
      'metabolism:process_turn_burn',
      'metabolism:process_turn_hunger_update'
    ];
    
    rules.forEach(ruleId => {
      const ruleDef = testBed.getRuleDefinition(ruleId);
      expect(testBed.validateRuleSchema(ruleDef)).toBe(true);
    });
  });
});
```

### Step 6: Coverage Metrics Verification

**Generate final coverage report**:

```bash
npm run test:unit -- --coverage
npm run test:integration -- --coverage
```

**Verify thresholds met**:

```javascript
// tests/helpers/coverageVerification.js

export function verifyCoverageThresholds(coverageData) {
  const { branches, functions, lines } = coverageData;
  
  const assertions = [
    { metric: 'branches', actual: branches, threshold: 80 },
    { metric: 'functions', actual: functions, threshold: 90 },
    { metric: 'lines', actual: lines, threshold: 90 }
  ];
  
  const failures = assertions.filter(a => a.actual < a.threshold);
  
  if (failures.length > 0) {
    throw new Error(`Coverage thresholds not met: ${JSON.stringify(failures)}`);
  }
  
  console.log('✅ All coverage thresholds met');
  return true;
}
```

---

## Out of Scope

- **Performance optimization** beyond coverage requirements (handled in HUNMETSYS-017)
- **New feature development** - this ticket focuses solely on testing existing features
- **Refactoring** of implementation code unless required to make it testable
- **Visual regression testing** - UI testing is minimal for this system
- **Load testing** beyond multi-actor scenarios already specified

---

## Acceptance Criteria

### Coverage Metrics

- [ ] **Branch coverage ≥80%** for all operation handlers
- [ ] **Function coverage ≥90%** for all operation handlers
- [ ] **Line coverage ≥90%** for all operation handlers
- [ ] **Branch coverage ≥80%** for all JSON Logic operators
- [ ] **Function coverage ≥90%** for all JSON Logic operators
- [ ] **Line coverage ≥90%** for all JSON Logic operators

### Test Quality

- [ ] All error paths have dedicated test cases
- [ ] All edge cases identified in spec are tested
- [ ] All boundary conditions are tested (0, max, thresholds)
- [ ] All component validation scenarios are tested
- [ ] All concurrent operation scenarios are tested

### Test Organization

- [ ] Coverage tests follow naming convention: `*.coverage.test.js`
- [ ] Edge case tests follow naming convention: `*EdgeCases.integration.test.js`
- [ ] All tests use `createTestBed()` helper
- [ ] All tests include descriptive test names
- [ ] All test files include proper documentation

### Documentation

- [ ] Coverage gaps documented before filling
- [ ] Test rationale documented for complex scenarios
- [ ] Coverage report archived in `docs/testing/coverage-reports/`
- [ ] Summary of coverage improvements documented

---

## Testing Strategy

### Self-Testing

This ticket is meta-level: it ensures all other tickets are properly tested.

**Coverage verification**:
```bash
# Generate coverage reports
npm run test:unit -- --coverage --coverageDirectory=coverage/unit
npm run test:integration -- --coverage --coverageDirectory=coverage/integration

# Verify thresholds
npm run verify:coverage
```

**Quality checks**:
- All new tests must pass
- Coverage must meet or exceed thresholds
- No regressions in existing test pass rates

---

## References

### Specification Sections

- **specs/hunger-metabolism-system.md § Test Coverage Strategy** (Lines 1450-1490)
- **specs/hunger-metabolism-system.md § Edge Cases** (Lines 1310-1450)
- **specs/hunger-metabolism-system.md § Error Handling** (Lines 1270-1310)

### Related Tickets

- **HUNMETSYS-001 through HUNMETSYS-018**: All tickets this one ensures are properly tested
- **HUNMETSYS-017**: Performance & Integration Tests (complementary testing focus)

### Project Standards

- **CLAUDE.md § Testing Strategy**: Project-wide testing requirements and patterns
- **CLAUDE.md § Testing Requirements**: Coverage thresholds and quality standards
- **docs/testing/**: Testing guides and best practices

---

## Implementation Notes

### Coverage Analysis Workflow

1. **Baseline**: Generate coverage report before starting
2. **Gap Analysis**: Identify uncovered code paths systematically
3. **Prioritize**: Focus on critical paths (error handling, state transitions)
4. **Implement**: Add tests incrementally, verifying coverage after each addition
5. **Validate**: Ensure all thresholds met before completing ticket

### Testing Best Practices

- **Use descriptive test names**: Clearly state what is being tested and expected outcome
- **Arrange-Act-Assert pattern**: Structure all tests consistently
- **One assertion per test**: Focus tests on single behaviors
- **Mock external dependencies**: Use `createTestBed()` for isolated testing
- **Test error paths**: Don't just test happy paths

### Common Pitfalls

- **Focusing on line coverage only**: Ensure branch coverage (conditionals) is thorough
- **Ignoring error handlers**: Error paths are often untested but critical
- **Over-mocking**: Balance between isolation and integration testing
- **Brittle tests**: Avoid implementation details, test behaviors

---

## Completion Checklist

- [ ] Coverage analysis completed and gaps documented
- [ ] Unit test coverage gaps filled (operation handlers, operators)
- [ ] Integration test coverage gaps filled (multi-actor, state transitions)
- [ ] Edge case tests created and passing
- [ ] Validation tests created and passing
- [ ] All coverage thresholds verified and met
- [ ] Coverage reports archived
- [ ] Documentation updated
- [ ] All tests passing in CI/CD pipeline
