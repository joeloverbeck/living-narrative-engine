# Multi-Target Action E2E Test Suites Implementation Specification

## Version 1.0 - Comprehensive E2E Testing for Multi-Target Actions

### Executive Summary

This specification addresses critical gaps in end-to-end (e2e) test coverage for the Living Narrative Engine's multi-target action system. While the engine has implemented sophisticated multi-target action capabilities, significant testing gaps exist in three critical areas: actual execution with operation handlers, context dependencies between targets, and action side effects with state mutations. This specification provides implementation requirements and guidance for three high-priority e2e test suites that will ensure the reliability and correctness of multi-target actions.

**Core Goal**: Achieve comprehensive e2e test coverage for multi-target actions, ensuring all production workflows are properly validated from action discovery through execution and state changes.

### Table of Contents

1. [Current Testing Gaps](#current-testing-gaps)
2. [Test Suite Architecture](#test-suite-architecture)
3. [Multi-Target Execution E2E Suite](#multi-target-execution-e2e-suite)
4. [Context Dependencies E2E Suite](#context-dependencies-e2e-suite)
5. [Action Side Effects E2E Suite](#action-side-effects-e2e-suite)
6. [Implementation Guide](#implementation-guide)
7. [Test Data Requirements](#test-data-requirements)
8. [Success Criteria](#success-criteria)
9. [Migration Strategy](#migration-strategy)
10. [Performance Considerations](#performance-considerations)

## Current Testing Gaps

### Critical Coverage Gaps

Based on the analysis report, the following critical gaps exist in e2e testing:

1. **Action Execution with Operation Handlers**
   - No tests for actual operation execution (dispatchEvent, modifyComponent, etc.)
   - Missing tests for operation sequencing
   - No coverage for conditional operations
   - Missing tests for operation rollback on failure

2. **Multi-Target Context Dependencies**
   - Limited testing of contextFrom relationships
   - No tests for nested context dependencies
   - Missing tests for circular dependency detection
   - No coverage for context validation failures

3. **Action Side Effects and State Mutations**
   - No tests verifying actual component changes after action execution
   - Missing tests for cascading effects
   - No coverage for transaction-like behavior
   - Missing tests for partial execution scenarios

### Impact on System Reliability

These gaps are particularly concerning because:
- Multi-target actions introduce complexity that requires thorough testing
- Operation handlers are the core execution mechanism for all actions
- Context dependencies can create subtle bugs if not properly validated
- Side effects and state mutations are critical for game state consistency

## Test Suite Architecture

### Testing Framework

All test suites will follow the established patterns in the project:

```javascript
// Standard test structure
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestModuleBuilder } from '../../common/builders/TestModuleBuilder.js';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';
```

### Common Test Infrastructure

Each test suite will utilize:
- **TestModuleBuilder**: For creating test game modules with multi-target actions
- **EntityManagerTestBed**: For managing test entities and state
- **Mock Facades**: For simulating system components
- **Performance Monitoring**: For tracking execution times

### Test Data Organization

```
tests/e2e/actions/fixtures/
├── multiTargetActions/
│   ├── basicThrowAction.json
│   ├── contextDependentAction.json
│   ├── complexSideEffectAction.json
│   └── circularDependencyAction.json
├── testEntities/
│   ├── actors.json
│   ├── items.json
│   └── locations.json
└── expectedResults/
    ├── stateChanges.json
    └── eventSequences.json
```

## Multi-Target Execution E2E Suite

### Test File: `tests/e2e/actions/multiTargetExecution.e2e.test.js`

### Purpose

Validate the complete execution flow of multi-target actions from command processing through operation handler execution, ensuring all targets are properly processed and state changes occur correctly.

### Test Scenarios

#### 1. Basic Multi-Target Execution

```javascript
describe('Basic Multi-Target Action Execution', () => {
  it('should execute a throw action with item and target', async () => {
    // Setup: Create actor with throwable item, target in same location
    const { actor, item, target } = await setupThrowScenario();
    
    // Execute: Process multi-target throw command
    const result = await processCommand(actor, 'throw rock at goblin');
    
    // Verify: Operation handlers executed in correct sequence
    expect(result.operations).toEqual([
      { type: 'modifyComponent', entityId: actor.id, componentId: 'core:inventory' },
      { type: 'modifyComponent', entityId: target.id, componentId: 'core:health' },
      { type: 'dispatchEvent', eventName: 'core:item_thrown' }
    ]);
    
    // Verify: State changes occurred for all entities
    expect(getEntityComponent(actor, 'core:inventory').items).not.toContain(item.id);
    expect(getEntityComponent(target, 'core:health').current).toBeLessThan(initialHealth);
  });
});
```

#### 2. Complex Multi-Target with Three+ Targets

```javascript
describe('Complex Multi-Target Execution', () => {
  it('should handle actions with three or more targets', async () => {
    // Test: "enchant sword with fire using scroll"
    const { actor, weapon, element, catalyst } = await setupEnchantmentScenario();
    
    const result = await processCommand(actor, 'enchant sword with fire using scroll');
    
    // Verify all three targets processed
    expect(result.processedTargets).toEqual({
      item: weapon.id,
      element: 'fire',
      catalyst: catalyst.id
    });
    
    // Verify complex state changes
    expect(getEntityComponent(weapon, 'core:enchantment')).toEqual({
      type: 'fire',
      power: 5,
      source: catalyst.id
    });
    expect(getEntityComponent(actor, 'core:inventory').items).not.toContain(catalyst.id);
  });
});
```

#### 3. Operation Handler Sequencing

```javascript
describe('Operation Handler Sequencing', () => {
  it('should execute operations in correct dependency order', async () => {
    const { actor, container, items } = await setupTransferScenario();
    
    // Track operation execution order
    const operationLog = [];
    mockOperationHandler.on('execute', (op) => operationLog.push(op));
    
    await processCommand(actor, 'transfer all items to chest');
    
    // Verify operations executed in correct order
    expect(operationLog).toMatchSequence([
      { type: 'validateContainer', target: container.id },
      { type: 'checkCapacity', items: items.length },
      ...items.map(item => ({ type: 'transferItem', itemId: item.id })),
      { type: 'updateInventory', entityId: actor.id },
      { type: 'updateContainer', entityId: container.id }
    ]);
  });
});
```

#### 4. Conditional Operation Execution

```javascript
describe('Conditional Operation Execution', () => {
  it('should handle conditional operations based on target state', async () => {
    const { actor, targets } = await setupConditionalScenario();
    
    // Some targets meet conditions, others don't
    const result = await processCommand(actor, 'heal all wounded allies');
    
    // Verify only wounded allies were healed
    const healedTargets = result.operations
      .filter(op => op.type === 'modifyComponent' && op.changes.health)
      .map(op => op.entityId);
    
    expect(healedTargets).toEqual(['wounded_ally_1', 'wounded_ally_2']);
    expect(healedTargets).not.toContain('healthy_ally');
  });
});
```

#### 5. Operation Failure and Rollback

```javascript
describe('Operation Failure and Rollback', () => {
  it('should rollback all changes when an operation fails', async () => {
    const { actor, items, container } = await setupFailureScenario();
    
    // Make container too small for all items
    await modifyComponent(container, 'core:capacity', { max: 2 });
    
    // Capture initial state
    const initialState = captureGameState();
    
    // Attempt transfer that will fail partway through
    const result = await processCommand(actor, 'transfer 5 items to small container');
    
    // Verify rollback occurred
    expect(result.error).toBe('Container capacity exceeded');
    expect(result.rolledBack).toBe(true);
    
    // Verify state restored to initial
    const finalState = captureGameState();
    expect(finalState).toEqual(initialState);
  });
});
```

### Key Testing Areas

1. **Operation Handler Integration**
   - Verify all operation types execute correctly
   - Test operation parameter passing
   - Validate operation results

2. **State Consistency**
   - Ensure all affected entities are updated
   - Verify no partial state changes on failure
   - Test state persistence after execution

3. **Error Scenarios**
   - Invalid target combinations
   - Missing required targets
   - Operation handler failures
   - Resource constraints

## Context Dependencies E2E Suite

### Test File: `tests/e2e/actions/contextDependencies.e2e.test.js`

### Purpose

Validate the complex context dependency system where targets can depend on properties and states of other targets, ensuring proper resolution and validation of these relationships.

### Test Scenarios

#### 1. Basic Context Dependencies

```javascript
describe('Basic Context Dependencies', () => {
  it('should resolve targets based on contextFrom relationships', async () => {
    // Action: "bandage Alice's wounded arm"
    // Context: arm selection depends on Alice's wounds
    const { actor, alice } = await setupWoundedScenario();
    
    // Give Alice specific wounds
    await modifyComponent(alice, 'core:body', {
      parts: {
        left_arm: { wounded: true },
        right_arm: { wounded: false }
      }
    });
    
    const result = await processCommand(actor, 'bandage Alice\'s wounded arm');
    
    // Verify correct context-dependent target selected
    expect(result.resolvedTargets).toEqual({
      person: alice.id,
      bodyPart: 'left_arm' // Should select wounded arm
    });
  });
});
```

#### 2. Nested Context Dependencies

```javascript
describe('Nested Context Dependencies', () => {
  it('should handle multi-level context dependencies', async () => {
    // Action: "repair Alice's equipped weapon's enchantment"
    // Context chain: enchantment → weapon → Alice
    const { actor, alice, weapon, enchantment } = await setupNestedContextScenario();
    
    const result = await processCommand(actor, 'repair Alice\'s equipped weapon\'s enchantment');
    
    // Verify nested resolution
    expect(result.contextResolution).toEqual({
      level1: { person: alice.id },
      level2: { weapon: weapon.id, resolvedFrom: 'person.equipped' },
      level3: { enchantment: enchantment.id, resolvedFrom: 'weapon.enchantments[0]' }
    });
    
    // Verify final targets
    expect(result.resolvedTargets).toEqual({
      person: alice.id,
      item: weapon.id,
      enchantment: enchantment.id
    });
  });
});
```

#### 3. Dynamic Context Resolution

```javascript
describe('Dynamic Context Resolution', () => {
  it('should resolve contexts based on runtime conditions', async () => {
    // Action: "steal from richest merchant"
    // Context: merchant selection based on wealth comparison
    const { actor, merchants } = await setupMerchantScenario();
    
    // Set varying wealth levels
    await Promise.all([
      modifyComponent(merchants[0], 'core:wealth', { gold: 100 }),
      modifyComponent(merchants[1], 'core:wealth', { gold: 500 }),
      modifyComponent(merchants[2], 'core:wealth', { gold: 200 })
    ]);
    
    const result = await processCommand(actor, 'steal from richest merchant');
    
    // Verify dynamic selection
    expect(result.resolvedTargets.target).toBe(merchants[1].id);
    expect(result.contextCriteria).toEqual({
      selector: 'max',
      property: 'wealth.gold',
      value: 500
    });
  });
});
```

#### 4. Circular Dependency Detection

```javascript
describe('Circular Dependency Detection', () => {
  it('should detect and handle circular context dependencies', async () => {
    // Create circular dependency: A depends on B, B depends on C, C depends on A
    const circularAction = {
      id: 'test:circular_action',
      targets: {
        first: {
          scope: 'test:entities',
          contextFrom: 'third.related'
        },
        second: {
          scope: 'test:entities',
          contextFrom: 'first.connected'
        },
        third: {
          scope: 'test:entities',
          contextFrom: 'second.linked'
        }
      }
    };
    
    const result = await processCommand(actor, 'test circular action');
    
    // Verify circular dependency detected
    expect(result.error).toBe('Circular dependency detected');
    expect(result.dependencyCycle).toEqual(['first', 'third', 'second', 'first']);
  });
});
```

#### 5. Context Validation Failures

```javascript
describe('Context Validation Failures', () => {
  it('should handle invalid context resolutions gracefully', async () => {
    const { actor, alice } = await setupValidationScenario();
    
    // Test various failure modes
    const failureCases = [
      {
        command: 'heal Alice\'s missing limb',
        expectedError: 'Context resolution failed: No wounded body part found',
        reason: 'bodyPart context cannot resolve to non-existent part'
      },
      {
        command: 'enchant nobody\'s weapon',
        expectedError: 'Context resolution failed: Primary target "nobody" not found',
        reason: 'Base context entity does not exist'
      },
      {
        command: 'modify Alice\'s non-existent property',
        expectedError: 'Context resolution failed: Property path "non-existent" not found on entity',
        reason: 'Context path is invalid'
      }
    ];
    
    for (const testCase of failureCases) {
      const result = await processCommand(actor, testCase.command);
      expect(result.error).toBe(testCase.expectedError);
      expect(result.validationDetails.reason).toBe(testCase.reason);
    }
  });
});
```

### Key Testing Areas

1. **Context Resolution Patterns**
   - Simple property access
   - Array iteration and filtering
   - Conditional selection
   - Aggregation functions

2. **Dependency Chains**
   - Linear dependencies
   - Branching dependencies
   - Circular dependency detection
   - Maximum depth handling

3. **Validation Coverage**
   - Missing context sources
   - Invalid property paths
   - Type mismatches
   - Scope violations

## Action Side Effects E2E Suite

### Test File: `tests/e2e/actions/actionSideEffects.e2e.test.js`

### Purpose

Validate that multi-target actions properly trigger all side effects including component modifications, event dispatching, cascading effects, and maintain transaction-like consistency.

### Test Scenarios

#### 1. Component Modification Side Effects

```javascript
describe('Component Modification Side Effects', () => {
  it('should apply all component changes from multi-target action', async () => {
    const { actor, weapon, armor } = await setupEquipmentScenario();
    
    // Capture initial state
    const initialStats = getEntityComponent(actor, 'core:stats');
    
    // Execute dual-equip action
    const result = await processCommand(actor, 'equip sword and shield');
    
    // Verify primary component changes
    expect(getEntityComponent(actor, 'core:equipment')).toEqual({
      mainHand: weapon.id,
      offHand: armor.id
    });
    
    // Verify calculated side effects
    const finalStats = getEntityComponent(actor, 'core:stats');
    expect(finalStats.attack).toBe(initialStats.attack + weapon.attackBonus);
    expect(finalStats.defense).toBe(initialStats.defense + armor.defenseBonus);
    
    // Verify inventory updates
    const inventory = getEntityComponent(actor, 'core:inventory');
    expect(inventory.items).not.toContain(weapon.id);
    expect(inventory.items).not.toContain(armor.id);
  });
});
```

#### 2. Event Dispatching and Propagation

```javascript
describe('Event Dispatching Side Effects', () => {
  it('should dispatch all events for multi-target actions', async () => {
    const { actor, target, item } = await setupCombatScenario();
    
    // Setup event tracking
    const dispatchedEvents = [];
    eventBus.on('*', (event) => dispatchedEvents.push(event));
    
    // Execute combat action
    await processCommand(actor, 'throw dagger at orc');
    
    // Verify event sequence
    expect(dispatchedEvents).toMatchSequence([
      {
        type: 'core:item_removed',
        payload: { entityId: actor.id, itemId: item.id }
      },
      {
        type: 'combat:projectile_thrown',
        payload: { 
          attackerId: actor.id, 
          projectileId: item.id,
          targetId: target.id 
        }
      },
      {
        type: 'combat:damage_dealt',
        payload: {
          attackerId: actor.id,
          targetId: target.id,
          damage: expect.any(Number),
          damageType: 'piercing'
        }
      },
      {
        type: 'core:entity_damaged',
        payload: { entityId: target.id, remainingHealth: expect.any(Number) }
      }
    ]);
  });
});
```

#### 3. Cascading Effects

```javascript
describe('Cascading Side Effects', () => {
  it('should handle effects that trigger other effects', async () => {
    const { actor, explosive, targets } = await setupExplosiveScenario();
    
    // Execute action that triggers cascade
    const result = await processCommand(actor, 'throw bomb at enemy group');
    
    // Verify primary effect
    expect(result.primaryEffects).toContainEqual({
      type: 'explosion',
      center: targets[0].position,
      radius: 5
    });
    
    // Verify cascading damage to nearby targets
    const cascadeEffects = result.cascadingEffects;
    expect(cascadeEffects).toHaveLength(3); // 3 enemies in blast radius
    
    cascadeEffects.forEach((effect, index) => {
      expect(effect).toMatchObject({
        type: 'area_damage',
        targetId: targets[index].id,
        damage: expect.any(Number),
        distance: expect.any(Number)
      });
      
      // Damage decreases with distance
      if (index > 0) {
        expect(effect.damage).toBeLessThan(cascadeEffects[index - 1].damage);
      }
    });
    
    // Verify all entities updated
    targets.forEach((target, index) => {
      const health = getEntityComponent(target, 'core:health');
      expect(health.current).toBeLessThan(health.max);
    });
  });
});
```

#### 4. Transaction-like Behavior

```javascript
describe('Transaction-like Behavior', () => {
  it('should maintain consistency with all-or-nothing execution', async () => {
    const { actor, vendor, items } = await setupTradeScenario();
    
    // Setup partial failure condition
    await modifyComponent(actor, 'core:wealth', { gold: 50 }); // Not enough for all items
    
    // Capture state before transaction
    const stateBefore = {
      actorGold: getEntityComponent(actor, 'core:wealth').gold,
      actorItems: [...getEntityComponent(actor, 'core:inventory').items],
      vendorGold: getEntityComponent(vendor, 'core:wealth').gold,
      vendorItems: [...getEntityComponent(vendor, 'core:inventory').items]
    };
    
    // Attempt transaction that should fail
    const result = await processCommand(actor, 'buy sword and shield from merchant');
    
    // Verify transaction rolled back
    expect(result.error).toBe('Insufficient funds for complete transaction');
    
    // Verify no partial changes
    const stateAfter = {
      actorGold: getEntityComponent(actor, 'core:wealth').gold,
      actorItems: [...getEntityComponent(actor, 'core:inventory').items],
      vendorGold: getEntityComponent(vendor, 'core:wealth').gold,
      vendorItems: [...getEntityComponent(vendor, 'core:inventory').items]
    };
    
    expect(stateAfter).toEqual(stateBefore);
  });
});
```

#### 5. Complex State Synchronization

```javascript
describe('Complex State Synchronization', () => {
  it('should maintain consistency across multiple related entities', async () => {
    const { actor, followers } = await setupFormationScenario();
    
    // Execute formation change affecting multiple entities
    await processCommand(actor, 'order defensive formation');
    
    // Verify leader state
    expect(getEntityComponent(actor, 'combat:formation')).toEqual({
      type: 'defensive',
      role: 'leader',
      members: followers.map(f => f.id)
    });
    
    // Verify all followers updated correctly
    followers.forEach((follower, index) => {
      const formation = getEntityComponent(follower, 'combat:formation');
      expect(formation).toEqual({
        type: 'defensive',
        role: 'member',
        leader: actor.id,
        position: index
      });
      
      // Verify stat modifications applied
      const stats = getEntityComponent(follower, 'core:stats');
      expect(stats.defense).toBe(stats.baseDefense * 1.5); // 50% defense bonus
    });
    
    // Verify spatial positions updated
    const positions = followers.map(f => getEntityComponent(f, 'core:position'));
    expect(positions).toFormValidPattern('defensive_circle', actor.position);
  });
});
```

### Key Testing Areas

1. **State Mutation Verification**
   - Direct component changes
   - Calculated/derived changes
   - Related entity updates
   - Spatial state changes

2. **Event System Integration**
   - Event generation
   - Event ordering
   - Event data completeness
   - Handler execution

3. **Consistency Guarantees**
   - Atomicity of operations
   - Isolation between actions
   - Durability of changes
   - Consistency validation

## Implementation Guide

### Phase 1: Test Infrastructure Setup (Week 1)

#### 1.1 Create Test Fixtures

```javascript
// tests/e2e/actions/fixtures/multiTargetTestData.js
export const multiTargetActions = {
  basicThrow: {
    id: 'test:throw_item',
    targets: {
      item: {
        scope: 'actor.inventory[]',
        filter: { throwable: true }
      },
      target: {
        scope: 'location.actors[]',
        filter: { conscious: true }
      }
    },
    operations: [
      {
        type: 'removeFromInventory',
        params: { itemId: '{targets.item}' }
      },
      {
        type: 'dealDamage',
        params: { 
          targetId: '{targets.target}',
          damage: '{item.damage}'
        }
      }
    ]
  }
};
```

#### 1.2 Create Test Builders

```javascript
// tests/e2e/actions/builders/MultiTargetTestBuilder.js
export class MultiTargetTestBuilder {
  constructor() {
    this.testModule = new TestModuleBuilder();
    this.entityTestBed = new EntityManagerTestBed();
  }
  
  async buildScenario(scenarioType) {
    switch (scenarioType) {
      case 'throw':
        return this.buildThrowScenario();
      case 'context':
        return this.buildContextScenario();
      case 'sideEffects':
        return this.buildSideEffectsScenario();
    }
  }
  
  async buildThrowScenario() {
    // Create entities and relationships
    const actor = await this.entityTestBed.createActor({
      stats: { strength: 10, dexterity: 15 }
    });
    
    const item = await this.entityTestBed.createItem({
      throwable: true,
      damage: 5
    });
    
    const target = await this.entityTestBed.createActor({
      health: { current: 20, max: 20 }
    });
    
    // Setup relationships
    await this.entityTestBed.addToInventory(actor, item);
    await this.entityTestBed.placeInLocation([actor, target], 'test_room');
    
    return { actor, item, target };
  }
}
```

### Phase 2: Core Test Implementation (Week 2-3)

#### 2.1 Test Execution Helpers

```javascript
// tests/e2e/actions/helpers/multiTargetExecutionHelper.js
export class MultiTargetExecutionHelper {
  constructor(commandProcessor, eventBus) {
    this.commandProcessor = commandProcessor;
    this.eventBus = eventBus;
    this.operationLog = [];
    this.eventLog = [];
  }
  
  async executeAndTrack(actor, command) {
    // Setup tracking
    this.setupOperationTracking();
    this.setupEventTracking();
    
    // Execute command
    const result = await this.commandProcessor.process(actor, command);
    
    // Return comprehensive result
    return {
      result,
      operations: [...this.operationLog],
      events: [...this.eventLog],
      stateChanges: this.captureStateChanges()
    };
  }
  
  setupOperationTracking() {
    // Mock or spy on operation handlers
  }
  
  setupEventTracking() {
    this.eventBus.on('*', (event) => {
      this.eventLog.push({
        type: event.type,
        payload: event.payload,
        timestamp: Date.now()
      });
    });
  }
}
```

#### 2.2 Assertion Helpers

```javascript
// tests/e2e/actions/helpers/multiTargetAssertions.js
export const multiTargetAssertions = {
  expectTargetsProcessed(result, expectedTargets) {
    Object.entries(expectedTargets).forEach(([key, value]) => {
      expect(result.resolvedTargets[key]).toBe(value);
      expect(result.processedTargets).toContain(value);
    });
  },
  
  expectOperationSequence(operations, expectedSequence) {
    expect(operations.length).toBe(expectedSequence.length);
    expectedSequence.forEach((expected, index) => {
      expect(operations[index]).toMatchObject(expected);
    });
  },
  
  expectStateConsistency(beforeState, afterState, expectedChanges) {
    // Verify only expected changes occurred
    Object.keys(afterState).forEach(entityId => {
      if (expectedChanges[entityId]) {
        expect(afterState[entityId]).toMatchObject(expectedChanges[entityId]);
      } else {
        expect(afterState[entityId]).toEqual(beforeState[entityId]);
      }
    });
  }
};
```

### Phase 3: Test Execution and Validation (Week 4)

#### 3.1 Test Runner Configuration

```javascript
// jest.config.e2e.multiTarget.js
module.exports = {
  displayName: 'Multi-Target E2E Tests',
  testMatch: [
    '<rootDir>/tests/e2e/actions/multiTarget*.e2e.test.js',
    '<rootDir>/tests/e2e/actions/contextDependencies.e2e.test.js',
    '<rootDir>/tests/e2e/actions/actionSideEffects.e2e.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/actions/setup/multiTargetSetup.js'],
  testTimeout: 30000 // Longer timeout for complex scenarios
};
```

#### 3.2 Performance Monitoring

```javascript
// tests/e2e/actions/performance/multiTargetPerformance.js
export class MultiTargetPerformanceMonitor {
  trackExecution(testName, executionFn) {
    const start = performance.now();
    const memBefore = process.memoryUsage();
    
    const result = executionFn();
    
    const duration = performance.now() - start;
    const memAfter = process.memoryUsage();
    
    this.recordMetrics({
      test: testName,
      duration,
      memoryDelta: memAfter.heapUsed - memBefore.heapUsed,
      timestamp: Date.now()
    });
    
    return result;
  }
  
  assertPerformanceBudget(metrics, budgets) {
    expect(metrics.duration).toBeLessThan(budgets.maxDuration);
    expect(metrics.memoryDelta).toBeLessThan(budgets.maxMemory);
  }
}
```

## Test Data Requirements

### Entity Templates

```json
{
  "actors": {
    "warrior": {
      "components": {
        "core:actor": { "name": "Test Warrior", "type": "humanoid" },
        "core:stats": { "strength": 15, "dexterity": 10 },
        "core:inventory": { "items": [], "capacity": 20 },
        "core:position": { "locationId": null }
      }
    },
    "merchant": {
      "components": {
        "core:actor": { "name": "Test Merchant", "type": "humanoid" },
        "core:wealth": { "gold": 1000 },
        "core:inventory": { "items": [], "capacity": 50 },
        "merchant:shop": { "prices": {}, "buybackRate": 0.5 }
      }
    }
  }
}
```

### Action Definitions

```json
{
  "multiTargetActions": {
    "throw": {
      "id": "test:throw",
      "targets": {
        "item": {
          "scope": "actor.inventory[{\"throwable\": true}]",
          "required": true
        },
        "target": {
          "scope": "location.actors[{\"conscious\": true}]",
          "required": true
        }
      },
      "template": "throw {item} at {target}",
      "operations": ["removeItem", "projectileAttack"]
    }
  }
}
```

## Success Criteria

### Test Coverage Metrics

1. **Code Coverage**
   - Line coverage: ≥95% for multi-target action code
   - Branch coverage: ≥90% for all conditional paths
   - Function coverage: 100% for public APIs

2. **Scenario Coverage**
   - All identified gap scenarios tested
   - Edge cases and error conditions covered
   - Performance benchmarks established

3. **Quality Metrics**
   - All tests pass consistently
   - No flaky tests
   - Execution time <30 seconds per suite

### Validation Checklist

#### Multi-Target Execution Suite
- [ ] Basic multi-target actions execute correctly
- [ ] Complex 3+ target actions work properly
- [ ] Operation sequencing is correct
- [ ] Conditional operations evaluated properly
- [ ] Failures trigger proper rollback

#### Context Dependencies Suite
- [ ] Simple contextFrom resolution works
- [ ] Nested dependencies resolve correctly
- [ ] Dynamic context selection functions
- [ ] Circular dependencies detected
- [ ] Validation failures handled gracefully

#### Action Side Effects Suite
- [ ] Component modifications applied correctly
- [ ] Events dispatched in proper order
- [ ] Cascading effects triggered appropriately
- [ ] Transaction consistency maintained
- [ ] Complex state synchronization works

## Migration Strategy

### From Existing Tests

1. **Identify Reusable Components**
   - Extract common setup from `multiTargetFullPipeline.e2e.test.js`
   - Reuse entity creation patterns
   - Leverage existing mock facades

2. **Incremental Migration**
   - Start with simpler tests
   - Add complexity gradually
   - Maintain backward compatibility

3. **Test Organization**
   ```
   tests/e2e/actions/
   ├── existing/
   │   └── multiTargetFullPipeline.e2e.test.js
   ├── multiTargetExecution.e2e.test.js (new)
   ├── contextDependencies.e2e.test.js (new)
   ├── actionSideEffects.e2e.test.js (new)
   └── helpers/
       ├── multiTargetTestBuilder.js
       └── multiTargetAssertions.js
   ```

### Continuous Integration

```yaml
# .github/workflows/multi-target-e2e.yml
name: Multi-Target E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run test:e2e:multiTarget
      - uses: actions/upload-artifact@v2
        with:
          name: coverage-report
          path: coverage/
```

## Performance Considerations

### Test Execution Performance

1. **Parallel Execution**
   - Run independent test suites in parallel
   - Use worker threads for heavy scenarios
   - Implement test sharding for CI

2. **Resource Management**
   - Clean up entities after each test
   - Reset event bus subscriptions
   - Clear operation handler mocks

3. **Performance Budgets**
   - Single test: <1 second
   - Test suite: <30 seconds
   - Memory usage: <500MB per suite

### Monitoring and Metrics

```javascript
// Track test performance over time
const performanceBaseline = {
  'throw action': { p95: 100, p99: 150 },
  'complex context': { p95: 200, p99: 300 },
  'cascading effects': { p95: 250, p99: 400 }
};

// Alert on regression
if (currentMetrics.p95 > baseline.p95 * 1.2) {
  console.warn(`Performance regression detected: ${testName}`);
}
```

## Conclusion

This specification provides a comprehensive guide for implementing three critical e2e test suites that will close the identified gaps in multi-target action testing. By following this implementation guide, the Living Narrative Engine will achieve:

1. **Comprehensive Coverage**: All critical multi-target action workflows tested end-to-end
2. **Reliability**: Confidence that multi-target actions work correctly in all scenarios
3. **Maintainability**: Clear test structure and patterns for future expansion
4. **Performance**: Benchmarks and monitoring to prevent regressions

The implementation should proceed in phases, starting with basic infrastructure and progressing to complex scenarios, ensuring each phase builds upon the previous one while maintaining test quality and performance standards.