# GOAPSPECANA-010: Comprehensive Failure Mode Analysis

**Status**: Not Started
**Priority**: HIGH
**Estimated Effort**: 2 days
**Dependencies**: GOAPSPECANA-001 through GOAPSPECANA-007
**Blocks**: Robust implementation

## Problem Statement

Lines 189-230 list some failure triggers but don't specify detection mechanisms, response strategies, fallback behaviors, or retry limits. Missing comprehensive failure mode coverage risks 50% more edge case failures.

## Objective

Document complete failure mode analysis with detection, response, fallback, retry limits, and logging for all failure scenarios.

## Acceptance Criteria

- [ ] 20+ failure modes documented
- [ ] Each has: detection method, response strategy, fallback behavior, retry limits
- [ ] Planning, refinement, and execution failures covered
- [ ] Concurrent actor conflicts addressed
- [ ] Infinite loop prevention specified
- [ ] Error visibility and logging defined

## Failure Categories

### 1. Planning Failures
```
FM-P1: No Valid Plan Found
- Detection: GOAP search exhausted, no path to goal
- Response: Log "no_plan_found", check for impossible goal
- Fallback: Activate fallback behavior tree (idle, wander)
- Retry: Max 2 replans with relaxed constraints
- Logging: Goal, world state snapshot, why no plan

FM-P2: Planning Timeout
- Detection: Planning exceeds 5s absolute limit
- Response: Return best partial plan or fail gracefully
- Fallback: Use simpler planning algorithm or fallback behavior
- Retry: No retry (timeout indicates problem)
- Logging: Task count, complexity metrics, performance data

FM-P3: Planning Exception
- Detection: Unhandled exception in GOAP algorithm
- Response: Catch exception, log stack trace
- Fallback: Fallback behavior tree
- Retry: No retry (indicates bug)
- Logging: Full exception, world state, task library
- Alert: Trigger error monitoring system
```

### 2. Refinement Failures
```
FM-R1: No Valid Target
- Detection: Scope resolution returns empty set
- Response: Return refinement failure with reason
- Fallback: Replan with different task/goal
- Retry: Max 3 replans, backoff 1 turn between
- Logging: Task, scope, world state

FM-R2: Entity Disappeared
- Detection: Bound entity not found in world state
- Response: Refinement fails, trigger replan
- Fallback: Search for alternative entity matching scope
- Retry: Max 3 replans
- Logging: Entity ID, task, when disappeared

FM-R3: Unreachable Target
- Detection: Pathfinding returns no path
- Response: Refinement fails with "unreachable"
- Fallback: Replan with reachable target
- Retry: Max 3 replans
- Logging: Source/target locations, obstacles

FM-R4: Permission Denied
- Detection: Actor lacks permission for action
- Response: Refinement fails, try alternative approach
- Fallback: Replan with permitted actions
- Retry: Max 2 replans
- Logging: Actor, target, permission check failed

FM-R5: Refinement Logic Error
- Detection: Exception in refinement code
- Response: Catch exception, treat as refinement failure
- Fallback: Replan immediately
- Retry: Max 1 replan (likely indicates bug)
- Logging: Full stack trace, task, parameters
- Alert: Trigger error monitoring
```

### 3. Execution Failures (Plan Invalidation)
```
FM-E1: Precondition Failed
- Detection: Precondition check before action execution fails
- Response: Invalidate remaining plan
- Fallback: Replan from current state
- Retry: Max 3 replans for this goal
- Logging: Action, failed precondition, world state

FM-E2: World State Changed
- Detection: Event indicating relevant entity changed
- Response: Validate plan still valid, invalidate if not
- Fallback: Replan with updated world state
- Retry: Max 3 replans
- Logging: Changed entity, plan impact

FM-E3: Concurrent Actor Interference
- Detection: Another actor modified shared resource
- Response: Detect on precondition check
- Fallback: Replan with updated resource availability
- Retry: Max 3 replans with backoff
- Logging: Interfering actor, resource, timing

FM-E4: Action Execution Failed
- Detection: Action returns failure result
- Response: Invalidate plan, analyze failure reason
- Fallback: Replan or abandon goal (if repeated failure)
- Retry: Max 2 action retries, then replan
- Logging: Action, failure reason, context
```

### 4. Resource Conflicts
```
FM-C1: Unique Resource Contention
- Detection: Multiple actors want same unique item
- Response: First-come-first-served based on plan timestamp
- Fallback: Loser replans with alternative
- Retry: Max 3 replans with backoff
- Logging: Actors, resource, resolution
- Prevention: Consider reservation system (future)

FM-C2: Deadlock Risk
- Detection: Circular wait on resources (rare)
- Response: Random backoff for one actor
- Fallback: One actor abandons goal
- Retry: Max 1 retry with different goal
- Logging: Actors involved, resources, resolution
- Prevention: Resource ordering protocol
```

### 5. System Errors
```
FM-S1: State Isolation Failure
- Detection: Planning mutates real world (sanity check)
- Response: Abort planning, restore state
- Fallback: Log critical error, disable planning
- Retry: No retry (critical bug)
- Logging: Full state diff, stack trace
- Alert: Critical error notification

FM-S2: Memory Overflow
- Detection: Memory usage exceeds 80% of limit
- Response: Cancel low-priority planning
- Fallback: Reduce planning actors, simplify tasks
- Retry: Retry when memory available
- Logging: Memory stats, active planners

FM-S3: Invalid Task Data
- Detection: Malformed task at runtime
- Response: Skip task, log validation error
- Fallback: Continue with other tasks
- Retry: Fix task data, reload
- Logging: Task ID, validation errors
```

## Retry & Backoff Strategy

```yaml
max_replans_per_goal: 3
backoff_turns_between_replans: 1
max_action_retries: 2

replan_triggers:
  - refinement_failed
  - precondition_failed
  - world_state_invalidated
  - resource_unavailable

abandon_goal_triggers:
  - max_replans_exceeded
  - repeated_failures (3+ same failure)
  - impossible_goal_detected
  - critical_error
```

## Logging Requirements

```yaml
failure_logging:
  level: WARN for expected failures, ERROR for unexpected
  include:
    - Failure mode ID (FM-P1, FM-R2, etc.)
    - Actor ID
    - Goal/task context
    - World state summary
    - Retry count
    - Timestamp
  exclude:
    - PII or sensitive data
    - Full world state (too large)

error_monitoring:
  alert_on:
    - Planning exceptions (FM-P3)
    - Refinement logic errors (FM-R5)
    - State isolation failures (FM-S1)
  aggregate_metrics:
    - Failure rates by type
    - Replan frequency
    - Goal abandonment rate
```

## Expected Outputs

1. **Failure Mode Matrix**: `docs/goap/failure-modes.md`
   - All failure modes documented
   - Detection + Response + Fallback + Retry specified
   - Organized by category

2. **Specification Update**: Failure handling section added
   - Reference to failure mode matrix
   - Retry/backoff strategy
   - Logging requirements

3. **Error Handling Guide**: `docs/goap/error-handling-guide.md`
   - How to handle each failure type
   - Code patterns for error handling
   - Testing failure scenarios

## Success Metrics

- All failure modes have complete specifications
- No gaps in failure coverage
- Retry limits prevent infinite loops
- Logging enables debugging
- System degrades gracefully under failure
