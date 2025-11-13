# GOAPSPECANA-005: State Management Strategy

**Status**: Not Started
**Priority**: CRITICAL
**Estimated Effort**: 3-4 days
**Dependencies**: None
**Blocks**: GOAPSPECANA-007, GOAPSPECANA-013

## Problem Statement

Lines 232-234 mention using "existing operation handlers" to simulate state changes during planning, but operation handlers are designed for execution and may mutate global state. Critical questions unanswered:
- Does planning mutate real world state? (Must be NO)
- How is state isolated? (Deep copy? COW? Abstract?)
- What's the memory cost?
- Can multiple actors plan simultaneously?
- What's the performance impact?

## Objective

Design, prototype, and specify complete state management strategy that prevents planning from mutating game state while maintaining acceptable performance.

## Acceptance Criteria

- [ ] State isolation strategy chosen (deep copy, COW, or abstract state)
- [ ] Prototype built and performance measured
- [ ] Memory overhead quantified
- [ ] Concurrent planning safety guaranteed
- [ ] Integration with operation handlers specified
- [ ] Performance meets requirements (<5MB per actor, <100ms planning time)
- [ ] Complete specification documented

## Tasks

### 1. Define Requirements
- [ ] Must-haves:
  - Planning MUST NOT mutate real world state
  - Multiple actors MUST plan concurrently without interference
  - State isolation MUST be complete (no leakage)
- [ ] Performance targets:
  - Memory overhead SHOULD NOT exceed 5MB per planning actor
  - State snapshot creation MUST complete <50ms
  - State queries SHOULD be O(1) or O(log n)
- [ ] Functional requirements:
  - Support all existing operation handlers
  - Enable "what-if" queries for effects simulation
  - Allow rollback/cleanup after planning

### 2. Approach A: Deep Copy Prototype
- [ ] Design deep copy mechanism:
  - What to copy: All entities? Actor-local? Relevant entities only?
  - Copy depth: Full recursive? Shallow for some components?
  - Exclusions: What NOT to copy (UI state, logging, etc.)
- [ ] Build prototype:
  ```javascript
  class DeepCopyWorldState {
    constructor(realWorldState, actorId) {
      this.snapshot = deepClone(realWorldState.getRelevantEntities(actorId));
    }

    getComponent(entityId, componentId) {
      return this.snapshot[entityId]?.[componentId];
    }

    // ... other query methods
  }
  ```
- [ ] Measure performance:
  - Snapshot creation time (50 actors, 500 entities)
  - Memory overhead per snapshot
  - Query performance vs real world state
- [ ] Document pros/cons:
  - ✅ Simple, safe, clear isolation
  - ❌ Memory intensive, slow for large worlds

### 3. Approach B: Copy-on-Write Prototype
- [ ] Design COW mechanism:
  - Track modified entities during planning
  - Copy only on write, read from real state
  - Cleanup modified entities after planning
- [ ] Build prototype:
  ```javascript
  class CopyOnWriteWorldState {
    constructor(realWorldState) {
      this.realState = realWorldState;
      this.modifications = new Map();  // entityId -> components
    }

    getComponent(entityId, componentId) {
      if (this.modifications.has(entityId)) {
        return this.modifications.get(entityId)[componentId];
      }
      return this.realState.getComponent(entityId, componentId);
    }

    setComponent(entityId, componentId, data) {
      if (!this.modifications.has(entityId)) {
        this.modifications.set(entityId, deepClone(this.realState.getEntity(entityId)));
      }
      this.modifications.get(entityId)[componentId] = data;
    }
  }
  ```
- [ ] Measure performance:
  - Overhead per read (should be minimal)
  - Memory growth during planning
  - Cleanup time
- [ ] Document pros/cons:
  - ✅ Memory efficient, fast reads
  - ❌ Complex, requires careful write tracking

### 4. Approach C: Abstract Planning State Prototype
- [ ] Design abstract state:
  - Planning uses symbolic state representation
  - Facts extracted from real world state
  - Effects modify facts, not entities
- [ ] Build prototype:
  ```javascript
  class AbstractPlanningState {
    constructor(realWorldState, actorId) {
      this.facts = extractFacts(realWorldState, actorId);
      // facts = { "actor.hunger": 80, "item_5.location": "room_12", ... }
    }

    getFact(path) {
      return this.facts[path];
    }

    setFact(path, value) {
      this.facts[path] = value;
    }

    // Map back to entities when needed
    resolveEntity(entityId) {
      // Build entity representation from facts
    }
  }
  ```
- [ ] Measure performance:
  - Fact extraction time
  - Memory overhead (facts vs full entities)
  - Query performance
- [ ] Document pros/cons:
  - ✅ Most flexible, enables advanced reasoning
  - ❌ Most complex, requires fact extraction/mapping

### 5. Performance Benchmarking
- [ ] Create test scenario:
  - 50 actors planning concurrently
  - 500 entities in world
  - 10 turns of simulation per plan
  - Measure: memory, CPU, timing
- [ ] Benchmark each approach:
  - Snapshot creation time
  - Memory overhead per actor
  - Query performance (1000 queries)
  - Cleanup time
- [ ] Compare against targets:
  - <5MB memory per actor
  - <50ms snapshot creation
  - <100ms total planning time

### 6. Choose Strategy
- [ ] Create decision matrix:
  | Criteria | Deep Copy | Copy-on-Write | Abstract State | Weight |
  |----------|-----------|---------------|----------------|--------|
  | Simplicity | 5 | 3 | 2 | 3x |
  | Memory efficiency | 2 | 4 | 5 | 2x |
  | Performance | 3 | 5 | 4 | 2x |
  | Safety/isolation | 5 | 4 | 5 | 3x |
  | Complexity | 5 | 3 | 2 | 1x |
- [ ] Score each approach
- [ ] Choose winner based on weighted scores
- [ ] Document rationale

### 7. Integration Specification
- [ ] Document how operation handlers interact with planning state:
  ```javascript
  // Operation handler adapted for planning
  async function increaseComponentHandler(operation, context) {
    const { entityId, component, path, amount } = operation;
    const currentValue = context.worldState.getComponent(entityId, component)[path];
    context.worldState.setComponent(entityId, component, {
      ...context.worldState.getComponent(entityId, component),
      [path]: currentValue + amount
    });
  }
  ```
- [ ] Specify operation handler modifications needed
- [ ] Define `WorldState` interface contract
- [ ] Document concurrent planning safety guarantees

### 8. Document in Specification
- [ ] Replace lines 232-234 with complete state management specification
- [ ] Document chosen approach with rationale
- [ ] Include performance characteristics
- [ ] Specify WorldState interface
- [ ] Add integration guide for operation handlers

## Expected Outputs

1. **Benchmark Report**: `docs/goap/state-management-benchmarks.md`
   - Performance measurements for all 3 approaches
   - Memory profiling results
   - Recommendation with rationale

2. **Prototype Code**: `src/goap/prototypes/`
   - `deepCopyWorldState.js`
   - `copyOnWriteWorldState.js`
   - `abstractPlanningState.js`
   - Benchmark harness

3. **Specification Update** (lines 232-234 expanded):
   - Complete state management specification
   - Chosen approach documented
   - Performance characteristics
   - WorldState interface contract
   - Operation handler integration

4. **Implementation Plan**: `docs/goap/state-management-implementation.md`
   - Step-by-step implementation guide
   - Integration points
   - Testing strategy
   - Performance optimization tips

5. **WorldState Interface**: `src/goap/types/worldStateTypes.js`
   ```javascript
   /**
    * @typedef {Object} WorldState
    * Interface for querying world state during planning
    */
   ```

## Success Metrics

- Strategy chosen based on measured performance data
- Memory overhead meets <5MB per actor target
- Planning state never mutates real world
- Concurrent planning proven safe (no race conditions)
- Operation handlers integrate cleanly
- Performance meets all requirements
- Complete specification with no ambiguity

## Notes

- Real world state is in `src/entities/entityManager.js` - review current architecture
- Operation handlers in `src/logic/operationHandlers/` - assess mutation risk
- Consider using existing cloning utilities from project
- Benchmark on realistic world sizes (not toy examples)
- Concurrent planning critical for multi-actor gameplay
- May need to add memory profiling tools to project
- Consider trade-offs: simplicity vs performance vs flexibility
