# GOAPSPECANA-006: Performance Requirements Specification

**Status**: Not Started
**Priority**: CRITICAL
**Estimated Effort**: 1-2 days
**Dependencies**: GOAPSPECANA-001 (refinement approach affects performance)
**Blocks**: GOAPSPECANA-013 (testing), all implementation

## Problem Statement

The specification contains zero measurable performance requirements. Without targets, cannot validate implementation, detect performance regressions, or determine production readiness.

## Objective

Define concrete, measurable performance requirements for all GOAP system components based on gameplay needs and technical constraints.

## Acceptance Criteria

- [ ] Planning time budgets defined (by task count)
- [ ] Memory overhead limits specified (per actor)
- [ ] Scalability targets set (max actors, max tasks)
- [ ] Success rate expectations defined
- [ ] Measurement methodology documented
- [ ] Requirements linked to user experience impact
- [ ] Performance test plan created

## Tasks

### 1. Analyze Gameplay Performance Constraints
- [ ] Determine player experience requirements:
  - Is planning synchronous (blocks UI) or asynchronous?
  - What's acceptable wait time for NPC decision?
  - How many NPCs act per turn?
- [ ] Identify technical constraints:
  - Browser memory limits
  - JavaScript execution budget
  - Frame rate requirements (if real-time)
- [ ] Document assumptions about world size:
  - Typical entity count (100-1000 entities?)
  - Typical task library size (20-200 tasks?)
  - Concurrent planning actors (1-50?)

### 2. Define Planning Time Requirements
- [ ] Specify time budgets by complexity:
  ```
  Planning Time Requirements:
  - For task libraries <20 tasks:
    - Planning SHALL complete within 100ms (90th percentile)
    - Planning SHALL complete within 200ms (99th percentile)

  - For task libraries 20-50 tasks:
    - Planning SHALL complete within 250ms (90th percentile)
    - Planning SHALL complete within 500ms (99th percentile)

  - For task libraries 50-100 tasks:
    - Planning SHALL complete within 500ms (90th percentile)
    - Planning SHALL complete within 1000ms (99th percentile)

  - For task libraries >100 tasks:
    - Planning SHOULD complete within 1000ms (90th percentile)
    - Planning MAY take up to 2000ms (99th percentile)
    - Consider task library filtering optimization
  ```
- [ ] Define timeout behavior:
  - Max planning time: 5 seconds (absolute)
  - On timeout: Return best partial plan or fallback behavior
- [ ] Link to user experience:
  - <100ms: Imperceptible delay
  - 100-300ms: Noticeable but acceptable
  - >500ms: Needs loading indicator
  - >2s: Poor user experience

### 3. Define Memory Requirements
- [ ] Specify memory overhead limits:
  ```
  Memory Overhead Requirements:
  - Per planning actor:
    - State snapshot: <5MB (SHALL NOT exceed)
    - Plan storage: <1MB (SHALL NOT exceed)
    - Task library: <2MB (SHALL NOT exceed)
    - Total per actor: <10MB

  - System-wide:
    - Knowledge graph: <50MB for 1000 entities
    - Cached plans: <20MB total
    - GOAP planner: <10MB overhead

  - Scalability target:
    - System SHALL support 50 concurrent planning actors
    - Total GOAP memory: <500MB
  ```
- [ ] Define memory monitoring:
  - Track peak memory usage
  - Log memory warnings at 80% of limits
  - Garbage collection strategy

### 4. Define Scalability Requirements
- [ ] Task library scaling:
  ```
  Task Library Scalability:
  - System SHALL support 500+ tasks across all mods
  - Per-mod limit: 200 tasks (RECOMMENDED)
  - Planning time SHALL scale linearly up to 200 tasks
  - Planning time MAY degrade beyond 200 tasks
  ```
- [ ] Actor scaling:
  ```
  Actor Scalability:
  - System SHALL support 50 concurrent planning actors
  - Planning SHALL be isolated (no interference)
  - Memory SHALL scale linearly with actor count
  - Plan caching SHALL reduce repeated planning cost
  ```
- [ ] World size scaling:
  ```
  World Size Scalability:
  - System SHALL support 1000 entities per world
  - Knowledge graph SHALL support 1000 entities
  - Scope resolution SHALL complete <50ms for 1000 entities
  - Pathfinding SHALL complete <100ms for typical locations
  ```

### 5. Define Success Rate Requirements
- [ ] Planning success rate:
  ```
  Plan Success Requirements:
  - In typical scenarios (clear path to goal):
    - Planning SHALL succeed ≥80% of attempts
    - Plans SHALL be valid and executable

  - In constrained scenarios (limited resources):
    - Planning SHALL succeed ≥60% of attempts
    - Fallback behavior SHALL activate on repeated failure

  - In impossible scenarios (no valid path):
    - Planning SHALL detect impossibility within 500ms
    - System SHALL return "no plan" vs timeout
  ```
- [ ] Refinement success rate:
  ```
  Refinement Success Requirements:
  - When valid target exists and is reachable:
    - Refinement SHALL succeed ≥85% of attempts
    - Failure SHALL trigger replan with different target

  - Max replan attempts: 3 per goal
  - Backoff strategy: 1 turn wait between replans
  ```

### 6. Define Measurement Methodology
- [ ] Specify how to measure:
  ```
  Performance Measurement Methodology:

  Planning Time:
  - Start: Task library constructed
  - End: Valid plan returned or failure
  - Exclude: Refinement time (measured separately)
  - Report: Mean, median, 90th, 99th percentile

  Memory Overhead:
  - Measure: Before/after planning session
  - Tool: Node.js process.memoryUsage()
  - Track: Heap used, external memory
  - Report: Peak, average, per-actor

  Success Rate:
  - Track: Successful plans / total attempts
  - Segment: By scenario type (typical, constrained, impossible)
  - Window: Rolling 100 attempts
  - Report: Percentage with confidence interval
  ```
- [ ] Define performance test scenarios:
  - Scenario 1: Simple goal (1-2 tasks)
  - Scenario 2: Complex goal (5-10 tasks)
  - Scenario 3: Resource constrained (multiple actors competing)
  - Scenario 4: Large task library (100+ tasks)
  - Scenario 5: Large world (1000+ entities)

### 7. Define Non-Functional Requirements
- [ ] Specify latency requirements:
  ```
  Latency Requirements:
  - State snapshot creation: <50ms
  - Scope resolution: <50ms per scope
  - Structural gate evaluation: <10ms per task
  - Plan validation: <20ms
  - Refinement: <100ms per task
  ```
- [ ] Specify throughput requirements:
  ```
  Throughput Requirements:
  - Planning operations per second: ≥10 (per core)
  - Concurrent planning actors: ≥50
  - Plans cached: ≥100 recent plans
  ```

### 8. Create Performance Test Plan
- [ ] Define test suite structure:
  - Unit tests: Individual component performance
  - Integration tests: End-to-end planning scenarios
  - Load tests: Multiple concurrent actors
  - Stress tests: Beyond normal operating limits
  - Regression tests: Track performance over time
- [ ] Specify test data:
  - Small world (100 entities, 20 tasks)
  - Medium world (500 entities, 100 tasks)
  - Large world (1000 entities, 200 tasks)
- [ ] Define success criteria for tests
- [ ] Create benchmark harness specification

### 9. Document in Specification
- [ ] Add complete "Performance Requirements" section
- [ ] Include all numeric targets
- [ ] Link to user experience impact
- [ ] Reference measurement methodology
- [ ] Add performance test plan appendix

## Expected Outputs

1. **Specification Update** (new section):
   ```markdown
   ## Performance Requirements

   ### Planning Time
   [Complete time budget specification]

   ### Memory Overhead
   [Complete memory limit specification]

   ### Scalability
   [Complete scaling requirements]

   ### Success Rate
   [Complete success metrics]

   ### Measurement Methodology
   [How to validate requirements]
   ```

2. **Performance Test Plan**: `docs/goap/performance-test-plan.md`
   - Test scenarios
   - Test data specifications
   - Success criteria
   - Benchmark harness design

3. **Performance Monitoring Guide**: `docs/goap/performance-monitoring.md`
   - How to measure performance
   - Tools and instrumentation
   - Interpreting results
   - Optimization strategies

4. **Benchmark Harness Spec**: `tests/performance/goap/README.md`
   - Test structure
   - Running benchmarks
   - Reporting format
   - Regression tracking

## Success Metrics

- All requirements have numeric targets
- Targets linked to user experience impact
- Measurement methodology is unambiguous
- Performance tests can validate all requirements
- Targets are achievable (not arbitrary)
- Requirements cover all system components

## Notes

- Consult with game designers about acceptable NPC decision latency
- Consider browser performance variance (mobile vs desktop)
- Planning time requirements may be async-friendly (non-blocking)
- Memory requirements critical for browser-based game
- Success rate requirements must account for dynamic world
- Performance targets should be validated with prototypes
- Consider adding performance budgets to CI/CD pipeline
