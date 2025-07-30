# Complex Action Side Effects Propagation E2E Test Specification

## Overview

This specification defines requirements and implementation guidelines for comprehensive end-to-end testing of complex action side effects propagation in the Living Narrative Engine. The tests will validate how actions trigger cascading effects across multiple systems, ensure proper event chain management, prevent circular dependencies, and maintain system performance under complex effect scenarios.

### Purpose

The Living Narrative Engine uses an event-driven architecture where actions can trigger complex chains of side effects. These effects can cascade through multiple systems (combat → inventory → stats → AI), creating intricate state changes that must be properly tested to ensure system reliability and consistency.

### Scope

This specification covers:
- Multi-level effect chain testing
- Circular effect detection and prevention
- Cross-system effect propagation validation
- Performance monitoring for deep effect trees
- Transaction-like consistency for complex actions
- State synchronization across affected entities

## Architecture Overview

### Action Execution Flow

```
User Input → CommandProcessor → ATTEMPT_ACTION_ID Event
                                          ↓
                              SystemLogicInterpreter
                                          ↓
                                 Rule Matching & Execution
                                          ↓
                                 OperationInterpreter
                                          ↓
                            Operation Handlers (Side Effects)
                                          ↓
                              Event Dispatching → New Events → Loop
```

### Key Components

1. **CommandProcessor** (`src/commands/commandProcessor.js`)
   - Dispatches ATTEMPT_ACTION_ID events with action payload
   - Supports multi-target actions through enhanced payload creation

2. **SystemLogicInterpreter** (`src/logic/systemLogicInterpreter.js`)
   - Listens for all events including ATTEMPT_ACTION_ID
   - Matches events against registered rules
   - Executes rule actions through operation sequences

3. **Operation Handlers** (`src/logic/operationHandlers/`)
   - Execute specific operations (modify components, dispatch events)
   - Can trigger new events creating cascading effects
   - Examples: dispatchEventHandler, modifyComponentHandler

4. **Event Bus System**
   - Central event routing mechanism
   - Enables loose coupling between systems
   - Supports both synchronous and asynchronous event handling

## Test Scenarios

### 1. Multi-Level Effect Chains

#### 1.1 Explosion Chain Reaction
**Scenario**: Throwing an explosive triggers multiple levels of effects
```
Action: Throw Bomb
  → Event: EXPLOSION_TRIGGERED
    → Operation: Calculate area damage
      → Event: AREA_DAMAGE_APPLIED (per target)
        → Operation: Apply damage to entities
          → Event: ENTITY_KILLED (if lethal)
            → Operation: Drop loot
              → Event: ITEMS_DROPPED
                → Operation: Update location inventory
```

**Test Requirements**:
- Track all events in sequence
- Verify each level processes correctly
- Validate final state matches expected cascade
- Ensure no events are lost or duplicated

#### 1.2 Status Effect Propagation
**Scenario**: Poison spreads through contact
```
Action: Apply Poison
  → Event: STATUS_EFFECT_APPLIED
    → Operation: Add poison component
      → Event: ENTITY_STATUS_CHANGED
        → Rule: Check for contact spread
          → Event: POISON_SPREAD_CHECK
            → Operation: Apply to nearby entities
              → Recursive spread with decay
```

**Test Requirements**:
- Verify recursive spread with proper termination
- Validate effect strength decay over distance/time
- Ensure no infinite loops
- Monitor performance with many affected entities

### 2. Circular Effect Prevention

#### 2.1 Mutual Damage Reflection
**Scenario**: Two entities with damage reflection attacking each other
```
Entity A attacks Entity B
  → B reflects damage to A
    → A reflects damage to B
      → System must detect and break cycle
```

**Test Requirements**:
- Implement cycle detection mechanism
- Verify cycle is broken at appropriate point
- Validate partial effects are still applied
- Log cycle detection for debugging

#### 2.2 Follow Command Cycles
**Scenario**: Preventing circular follow relationships
```
A follows B → B follows C → C attempts to follow A
  → System must reject creating cycle
```

**Test Requirements**:
- Validate cycle prevention logic
- Ensure clear error messaging
- Verify existing relationships remain intact
- Test with longer chains (A→B→C→D→A)

### 3. Cross-System Effect Propagation

#### 3.1 Combat to Economy Chain
**Scenario**: Defeating merchant affects trade prices
```
Action: Kill Merchant
  → Event: ENTITY_KILLED
    → Rule: Check if merchant
      → Event: MERCHANT_KILLED
        → Operation: Update market prices
          → Event: MARKET_PRICES_CHANGED
            → Operation: Notify all traders
              → Event: TRADER_PRICES_UPDATED
                → Operation: Update UI displays
```

**Test Requirements**:
- Verify effects cross system boundaries correctly
- Validate all dependent systems update
- Ensure consistency across all affected entities
- Test with multiple merchants/markets

#### 3.2 Environmental Chain Reaction
**Scenario**: Fire spreading through environment
```
Action: Cast Fireball
  → Event: FIRE_DAMAGE_APPLIED
    → Rule: Check flammable objects
      → Event: OBJECT_IGNITED
        → Operation: Spread fire to adjacent
          → Event: FIRE_SPREAD
            → Rule: Check structural damage
              → Event: STRUCTURE_COLLAPSED
                → Operation: Damage entities below
```

**Test Requirements**:
- Model environmental propagation accurately
- Validate spatial calculations
- Ensure performance with many objects
- Test termination conditions

### 4. Performance Validation

#### 4.1 Deep Effect Trees
**Scenario**: Actions creating effects 10+ levels deep
```
Initial Action
  → Level 1: 5 effects
    → Level 2: 25 effects (5 each)
      → Level 3: 125 effects
        → ... up to Level 10
```

**Test Requirements**:
- Measure execution time at each level
- Monitor memory usage growth
- Validate all effects execute correctly
- Set performance benchmarks:
  - < 100ms for depth 5
  - < 500ms for depth 10
  - Linear time complexity preferred

#### 4.2 Broad Effect Trees
**Scenario**: Single action affecting 100+ entities
```
Action: Area spell hitting dense crowd
  → 100 simultaneous DAMAGE_APPLIED events
    → Each triggers status effects
      → Each updates UI
```

**Test Requirements**:
- Measure total execution time
- Verify no race conditions
- Validate consistent state updates
- Benchmark: < 1 second for 100 entities

### 5. Transaction Consistency

#### 5.1 All-or-Nothing Execution
**Scenario**: Complex trade with multiple conditions
```
Action: Complex Trade
  → Check all prerequisites
    → If any fail, rollback all changes
    → If all pass, commit atomically
```

**Test Requirements**:
- Verify complete rollback on failure
- Ensure no partial state changes
- Validate rollback events are dispatched
- Test with concurrent actions

## Implementation Guidelines

### Test Structure

```javascript
describe('Complex Action Side Effects Propagation E2E', () => {
  let facades;
  let turnExecutionFacade;
  let eventTracker;
  let stateCapture;

  beforeEach(async () => {
    facades = createMockFacades({}, jest.fn);
    turnExecutionFacade = facades.turnExecutionFacade;
    
    // Initialize event tracking
    eventTracker = new CascadingEventTracker(facades.eventBus);
    
    // Initialize state capture
    stateCapture = new GameStateCapture(facades.entityManager);
  });

  describe('Multi-Level Effect Chains', () => {
    test('should propagate explosion effects through multiple levels', async () => {
      // Setup test scenario
      const testEnv = await createExplosionScenario(facades);
      
      // Capture initial state
      const stateBefore = await stateCapture.capture();
      
      // Execute action
      const result = await turnExecutionFacade.executeAction(
        testEnv.actor,
        'throw bomb at enemy group'
      );
      
      // Track cascading events
      const eventChain = eventTracker.getCascadeChain('EXPLOSION_TRIGGERED');
      
      // Validate effect propagation
      expect(eventChain).toMatchEffectPattern({
        root: 'EXPLOSION_TRIGGERED',
        branches: [
          {
            event: 'AREA_DAMAGE_APPLIED',
            count: '>=3',
            children: [
              {
                event: 'ENTITY_DAMAGED',
                validator: (e) => e.payload.damage > 0
              }
            ]
          }
        ]
      });
      
      // Verify final state
      const stateAfter = await stateCapture.capture();
      validateExplosionOutcome(stateBefore, stateAfter, testEnv);
    });
  });
});
```

### Event Tracking Helper

```javascript
class CascadingEventTracker {
  constructor(eventBus) {
    this.events = [];
    this.eventChains = new Map();
    
    // Intercept all events
    this.originalDispatch = eventBus.dispatch;
    eventBus.dispatch = async (type, payload) => {
      this.trackEvent({ type, payload, timestamp: Date.now() });
      return this.originalDispatch.call(eventBus, type, payload);
    };
  }
  
  trackEvent(event) {
    this.events.push(event);
    this.buildEventChains(event);
  }
  
  buildEventChains(event) {
    // Logic to build parent-child relationships between events
    // Based on correlation IDs or temporal proximity
  }
  
  getCascadeChain(rootEventType) {
    // Return tree structure of cascading events
  }
}
```

### State Validation Helpers

```javascript
class GameStateCapture {
  async capture() {
    return {
      entities: await this.captureAllEntities(),
      timestamp: Date.now(),
      eventCount: this.getEventCount()
    };
  }
  
  compareStates(before, after, expectations) {
    // Deep comparison with expected changes
  }
}
```

### Performance Monitoring

```javascript
class EffectPerformanceMonitor {
  constructor() {
    this.metrics = {
      eventCounts: new Map(),
      executionTimes: new Map(),
      memorySnapshots: []
    };
  }
  
  async measureEffectChain(actionFn) {
    const startMemory = process.memoryUsage();
    const startTime = performance.now();
    
    const result = await actionFn();
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    return {
      result,
      metrics: {
        duration: endTime - startTime,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        eventCount: this.getEventCount()
      }
    };
  }
}
```

## Validation Requirements

### Event Chain Validation
- All events in a chain must be correlated
- Parent events must complete before children start
- No events should be lost or duplicated
- Circular references must be detected and logged

### State Consistency Validation
- Entity states must be internally consistent
- Cross-entity relationships must be valid
- No partial updates should remain after completion
- Rollbacks must restore exact previous state

### Performance Validation
- Effect chains must complete within time bounds
- Memory usage must scale linearly with effect count
- No memory leaks from circular references
- Performance degradation must be gradual, not cliff-like

### Error Handling Validation
- Errors at any level must not break the chain
- Partial successes must be handled gracefully
- Error events must be dispatched for observability
- Recovery mechanisms must engage automatically

## Success Criteria

The implementation will be considered complete when:

1. **Coverage**: All identified scenarios have comprehensive tests
2. **Reliability**: Tests pass consistently without flakes
3. **Performance**: All benchmarks are met or exceeded
4. **Maintainability**: Tests are well-documented and easy to modify
5. **Observability**: Failures provide clear diagnostic information

## Performance Benchmarks

| Scenario | Target | Maximum |
|----------|--------|---------|
| 5-level effect chain | 50ms | 100ms |
| 10-level effect chain | 200ms | 500ms |
| 100 entity area effect | 500ms | 1000ms |
| Circular detection | 5ms | 10ms |
| State rollback | 20ms | 50ms |

## Testing Best Practices

1. **Isolation**: Each test should set up its own scenario
2. **Determinism**: Use controlled random seeds for reproducibility
3. **Clarity**: Test names should describe the scenario clearly
4. **Assertions**: Use custom matchers for complex validations
5. **Debugging**: Include detailed logs for failure diagnosis
6. **Performance**: Run performance tests separately from functional tests

## References

- `/reports/action-pipeline-e2e-coverage-analysis.md` - Gap analysis
- `/src/logic/systemLogicInterpreter.js` - Core event handling
- `/src/commands/commandProcessor.js` - Action dispatching
- `/tests/e2e/actions/actionSideEffects.e2e.test.js` - Existing patterns
- `/tests/common/facades/` - Facade testing patterns