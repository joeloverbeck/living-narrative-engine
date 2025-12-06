# GOAPSPECANA-011: Knowledge System Feasibility Prototype

**Status**: Not Started
**Priority**: HIGH
**Estimated Effort**: 3-5 days
**Dependencies**: GOAPSPECANA-004 (planning scope extensions)
**Blocks**: Knowledge-aware planning implementation

## Problem Statement

Lines 139-142 propose `core:known_to` component without analyzing feasibility. Concerns:

- Performance: Potentially updating hundreds of entities each turn
- Memory: O(actors × entities) knowledge graph
- Scalability: 50 actors × 500 entities = 25,000 potential edges
- Integration: Who maintains this? How does it interact with visibility?

## Objective

Build performance spike to measure feasibility, identify bottlenecks, and specify complete knowledge system based on actual performance data.

## Acceptance Criteria

- [ ] Prototype built and tested with realistic data (50 actors, 500 entities)
- [ ] Update performance measured
- [ ] Memory overhead quantified
- [ ] Query performance assessed
- [ ] Feasibility determination made
- [ ] If feasible: Complete specification with optimizations
- [ ] If not feasible: Alternative approach designed

## Tasks

### 1. Design Knowledge System Architecture

- [ ] Define `core:known_to` component structure:
  ```json
  {
    "core:known_to": {
      "knownBy": ["actor_1", "actor_3", "actor_7"]
    }
  }
  ```
- [ ] Define update mechanism:
  - When: Each turn start, on visibility changes
  - Who: KnowledgeManager service
  - How: Scan visible entities, update known_to arrays
- [ ] Define forgetting mechanism:
  - Entities not seen for N turns removed from known_to
  - Prevent unbounded memory growth
  - Configurable forgetting threshold

### 2. Build Prototype Implementation

- [ ] Create `KnowledgeManager` service:

  ```javascript
  class KnowledgeManager {
    updateVisibility(actorId, visibleEntityIds) {
      // Add actorId to each visible entity's known_to
    }

    forgetUnseen(actorId, turnsSinceLastSeen) {
      // Remove actorId from entities not seen recently
    }

    isKnownTo(entityId, actorId) {
      // Query if actor knows about entity
    }
  }
  ```

- [ ] Integrate with turn system
- [ ] Integrate with visibility system
- [ ] Add instrumentation for performance measurement

### 3. Create Test Scenarios

- [ ] Scenario 1: Small world
  - 10 actors, 100 entities
  - Measure baseline performance

- [ ] Scenario 2: Medium world
  - 25 actors, 250 entities
  - Measure scaling behavior

- [ ] Scenario 3: Large world (target)
  - 50 actors, 500 entities
  - 10 visibility changes per turn
  - Measure at target scale

- [ ] Scenario 4: Stress test
  - 100 actors, 1000 entities
  - Identify breaking point

### 4. Performance Benchmarking

- [ ] Measure update performance:

  ```javascript
  const startTime = performance.now();
  knowledgeManager.updateVisibility(actorId, visibleEntities);
  const updateTime = performance.now() - startTime;
  ```

  - Target: <10ms per actor per turn
  - Measure: Mean, median, p95, p99, max

- [ ] Measure memory overhead:

  ```javascript
  const before = process.memoryUsage().heapUsed;
  // Build full knowledge graph
  const after = process.memoryUsage().heapUsed;
  const overhead = after - before;
  ```

  - Target: <50MB for 50 actors × 500 entities
  - Measure: Per-actor average, total overhead

- [ ] Measure query performance:

  ```javascript
  // Scope resolution with knowledge filter
  const start = performance.now();
  const knownItems = scope.resolve({
    filter: (entity) => knowledgeManager.isKnownTo(entity.id, actorId),
  });
  const queryTime = performance.now() - start;
  ```

  - Target: <50ms per scope resolution
  - Measure: Query complexity impact

- [ ] Measure forgetting performance:
  - Run forgetting every 10 turns
  - Measure cleanup time
  - Ensure no memory leaks

### 5. Identify Bottlenecks

- [ ] Profile with Node.js profiler
- [ ] Identify hot paths:
  - Array operations (includes checks)
  - Entity component updates
  - Scope resolution filters
- [ ] Quantify bottleneck impact
- [ ] Document optimization opportunities

### 6. Optimization Strategies

- [ ] Strategy A: Incremental updates
  - Only update changed visibility
  - Track visibility deltas
  - Avoid full rescan

- [ ] Strategy B: Spatial indexing
  - Group entities by location
  - Only scan relevant locations
  - Reduce O(all_entities) scans

- [ ] Strategy C: Known_to as Set
  - Use Set instead of Array for O(1) lookups
  - Measure memory trade-off

- [ ] Strategy D: Lazy evaluation
  - Don't maintain full graph
  - Query visibility on-demand
  - Cache results

- [ ] Strategy E: Actor-local knowledge graph
  - Store knowledge on actor, not entities
  - actor.knownEntities = Set<EntityId>
  - Reduces entity update overhead

- [ ] Test each strategy, measure impact

### 7. Feasibility Determination

- [ ] Compare results to targets:
  - Update performance: <10ms per actor ✓/✗
  - Memory overhead: <50MB total ✓/✗
  - Query performance: <50ms ✓/✗
  - Scalability: Linear to 50 actors ✓/✗

- [ ] Decision:
  - **If all targets met**: Proceed with specification
  - **If optimized targets met**: Specify with optimizations
  - **If targets not met**: Design alternative approach

### 8. Alternative Approach (if needed)

- [ ] Simplified knowledge model:
  - Track only last-seen location
  - Binary known/unknown (no full graph)
  - Entity discovery events

- [ ] Event-based learning:
  - Entities trigger "discovered" events
  - No continuous scanning
  - Actor maintains discovered set

- [ ] Bounded knowledge:
  - Limit knowledge to N most recent entities
  - LRU cache for known entities
  - Reduces memory overhead

### 9. Complete Specification

- [ ] Document chosen approach:
  - Architecture (component structure, update mechanism)
  - Performance characteristics (measured data)
  - Integration points (visibility, turn system, scope resolution)
  - Optimization strategies (if applied)
  - Limitations and trade-offs

- [ ] Update specification (lines 139-142 expanded):
  - Complete knowledge system specification
  - Feasibility validation
  - Performance requirements met
  - Integration guide

## Expected Outputs

1. **Prototype Code**: `src/goap/prototypes/knowledgeManager.js`
   - Working implementation
   - Instrumentation for measurement
   - Test scenarios

2. **Benchmark Report**: `docs/goap/knowledge-system-benchmarks.md`
   - Performance measurements
   - Memory profiling
   - Bottleneck analysis
   - Optimization results
   - Feasibility determination

3. **Specification Update** (lines 139-142 expanded):
   - Complete knowledge system specification
   - Performance characteristics documented
   - Integration guide
   - Alternative approach (if needed)

4. **Implementation Guide**: `docs/goap/knowledge-system-implementation.md`
   - Architecture details
   - Integration steps
   - Optimization recommendations
   - Testing strategy

## Success Metrics

- Performance measured with realistic data
- Bottlenecks identified and quantified
- Feasibility determined with data
- If feasible: Optimizations specified
- If not feasible: Alternative designed
- Complete specification based on measurements
