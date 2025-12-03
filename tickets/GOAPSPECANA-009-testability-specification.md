# GOAPSPECANA-009: Testability Specification with Gherkin Scenarios

**Status**: Not Started
**Priority**: HIGH
**Estimated Effort**: 2-3 days
**Dependencies**: GOAPSPECANA-001 through GOAPSPECANA-007
**Blocks**: Test-driven development, implementation validation

## Problem Statement

Specification lacks acceptance criteria and test strategies. Without testability specifications, teams cannot use TDD and production bugs increase by ~60%.

## Objective

Create comprehensive Gherkin scenarios (GIVEN/WHEN/THEN) for all GOAP features, enabling test-driven development and clear validation criteria.

## Acceptance Criteria

- [ ] 40+ Gherkin test scenarios written
- [ ] All major features covered
- [ ] Edge cases identified
- [ ] Failure scenarios included
- [ ] Test data requirements specified
- [ ] Scenarios enable TDD approach

## Task Categories

### 1. Task Loading & Validation (5 scenarios)
```gherkin
Scenario: Successfully load valid task from mod
  Given a mod with task file "consume_nourishing_item.task.json"
  And the task schema is valid
  When the GOAP system initializes
  Then the task "survival:consume_nourishing_item" should be loaded
  And it should be available in the task library

Scenario: Reject task with invalid schema
  Given a mod with malformed task file
  And the task is missing required "planning_effects" field
  When the GOAP system attempts to load tasks
  Then loading should fail with error "INVALID_TASK_SCHEMA"
  And error message should specify missing field

Scenario: Handle cross-mod task dependencies
  Given mod "survival" depends on mod "core"
  And task references scope "core:items"
  When loading "survival" tasks
  Then cross-mod references should resolve correctly

Scenario: Validate planning effects operation types
  Given a task with unknown operation type "invalid_op"
  When validating task schema
  Then validation should fail with "UNKNOWN_OPERATION_TYPE"

Scenario: Load multiple tasks with parameter variations
  Given tasks "consume_item" and "heal_self"
  And both use different parameter scopes
  When loading tasks
  Then both should coexist in library
  And parameters should not conflict
```

### 2. Structural Gates Evaluation (8 scenarios)
```gherkin
Scenario: Exclude task when actor missing required component
  Given actor without "biology:can_eat" component
  And task "consume_nourishing_item" requires "biology:can_eat"
  When evaluating structural gates
  Then task should be EXCLUDED from library
  And reason logged as "missing_required_component"

Scenario: Include task when actor has required components
  Given actor with "biology:can_eat" component
  And task requires "biology:can_eat"
  When evaluating structural gates
  Then task should be INCLUDED in library

Scenario: Knowledge check passes when entities exist
  Given actor knows about 3 nourishing items
  And task requires knowledge of "items:nourishing_items"
  When evaluating knowledge gate
  Then gate should PASS
  And task included in library

Scenario: Knowledge check fails when no entities known
  Given actor knows about 0 nourishing items
  And task requires knowledge of "items:nourishing_items"
  When evaluating knowledge gate
  Then gate should FAIL
  And task excluded from library
  And reason logged as "no_known_entities_matching"

Scenario: Evaluate forbidden component gate
  Given actor has "core:immobilized" component
  And task forbids "core:immobilized"
  When evaluating gates
  Then task should be EXCLUDED

Scenario: Multiple gates - all must pass
  Given task with 3 structural gates
  And actor satisfies 2 of 3 gates
  When evaluating gates
  Then task should be EXCLUDED
  And all failing gates logged

Scenario: Musician-specific task for non-musician
  Given actor without "music:musician" component
  And task requires "music:musician"
  When building task library
  Then music tasks excluded
  And only applicable tasks included

Scenario: Reevaluate gates after component added
  Given actor initially without "biology:can_eat"
  And task library built (task excluded)
  When actor gains "biology:can_eat" component
  And library rebuilt next turn
  Then task should now be INCLUDED
```

### 3. Planning Scope Resolution (6 scenarios)
```gherkin
Scenario: Resolve world-wide scope with knowledge filter
  Given actor knows about apple in room_12
  And actor does NOT know about pear in room_15
  And scope "items:known_nourishing_items_anywhere"
  When resolving scope
  Then result should include apple
  And result should NOT include pear
  And query should complete in <50ms

Scenario: Resolve empty scope gracefully
  Given no entities match scope criteria
  When resolving scope for task parameter
  Then return empty set
  And log "no_matching_entities"

Scenario: Resolve scope with reachability filter
  Given actor in room_8
  And room_12 is reachable via path
  And room_99 is unreachable (locked door)
  And scope "locations:reachable_safe_locations"
  When resolving scope
  Then room_12 included
  And room_99 excluded

Scenario: Handle scope resolution timeout
  Given scope with complex pathfinding
  And resolution exceeds 100ms timeout
  When resolving scope
  Then return partial results
  And log timeout warning

Scenario: Cache scope results for performance
  Given scope resolved for actor_1
  When resolving same scope again within 5 seconds
  Then cached result should be used
  And resolution should complete in <5ms

Scenario: Invalidate scope cache on world change
  Given cached scope result for "items:nourishing_items"
  When item added to world
  Then cache should be invalidated
  And next resolution should query fresh
```

### 4. Refinement Success & Failure (10 scenarios)
```gherkin
Scenario: Refine with item in inventory (simple)
  Given actor has apple in inventory
  And task "consume_nourishing_item" bound to apple
  When refining task
  Then output should be [items:consume_item(apple)]
  And refinement should succeed in <50ms

Scenario: Refine requiring movement (complex)
  Given actor in room_8
  And bread in room_15
  And path exists from room_8 to room_15
  When refining "consume_nourishing_item(bread)"
  Then output should be:
    - world:move_to_location(room_15)
    - items:pick_up_item(bread)
    - items:consume_item(bread)

Scenario: Refinement fails - no valid target
  Given actor in room_8
  And apple in room_12 behind locked door
  When refining "consume_nourishing_item(apple)"
  Then refinement should FAIL
  And reason should be "target_unreachable"

Scenario: Refinement fails - entity disappeared
  Given task bound to apple_5
  And apple_5 consumed by another actor
  When refining task
  Then refinement should FAIL
  And reason should be "entity_not_found"

Scenario: Refinement with prerequisites
  Given task requires actor standing
  And actor currently sitting
  When refining task
  Then output should include "deference:stand_up"
  Followed by main task actions

Scenario: Max refinement steps enforced
  Given refinement produces >10 primitive actions
  When refining task
  Then fail with "max_refinement_steps_exceeded"

Scenario: Refinement exception handling
  Given refinement logic throws error
  When refining task
  Then catch exception
  And return refinement failure
  And log error for debugging

Scenario: Concurrent refinement isolation
  Given actor_1 refining task_A
  And actor_2 refining task_B simultaneously
  When both refinements access world state
  Then no interference should occur
  And both should succeed independently

Scenario: Refinement caching for common patterns
  Given refinement for "consume apple"
  When same task refined again (different turn)
  Then cached refinement template should be reused
  And only parameters updated

Scenario: Refinement respects permissions
  Given task bound to item owned by other actor
  And actor lacks permission to take item
  When refining task
  Then fail with "permission_denied"
```

### 5. Plan Invalidation (5 scenarios)
```gherkin
Scenario: Detect invalidation - entity moved
  Given plan includes "pick_up_item(apple)" in room_12
  And actor currently executing "move_to(room_12)"
  When another actor moves apple to room_15
  And actor reaches room_12
  Then precondition check should FAIL
  And plan should be INVALIDATED
  And replan should trigger

Scenario: Detect invalidation - concurrent actor
  Given actor_A planning to use shared resource
  And actor_B takes resource first
  When actor_A attempts to execute
  Then detect resource unavailable
  And invalidate plan
  And replan with alternative

Scenario: Continue plan when unaffected by changes
  Given plan to consume actor's own inventory item
  When another actor performs unrelated action
  Then plan should remain VALID
  And execution should continue

Scenario: Max replan limit prevents infinite loop
  Given plan invalidated 3 times
  When attempting 4th replan
  Then abandon goal
  And log "max_replan_attempts_exceeded"

Scenario: Replan backoff prevents thrashing
  Given plan invalidated
  When replanning
  Then wait 1 turn before executing new plan
  And prevent rapid replan cycles
```

### 6. Performance Requirements (5 scenarios)
```gherkin
Scenario: Planning completes within time budget - small library
  Given task library with 15 tasks
  And typical goal scenario
  When planning starts
  Then planning should complete within 100ms
  And return valid plan

Scenario: Planning completes within time budget - large library
  Given task library with 150 tasks
  When planning starts
  Then planning should complete within 1000ms

Scenario: Memory overhead within limits
  Given actor begins planning
  When state snapshot created
  Then memory overhead should be <5MB
  And peak memory tracked

Scenario: Concurrent planning scales linearly
  Given 50 actors planning simultaneously
  When all actors plan
  Then total memory should be <250MB (50 * 5MB)
  And no memory leaks
  And all plans complete

Scenario: Planning success rate meets target
  Given 100 typical scenarios
  When actors plan
  Then success rate should be ≥80%
  And failures should be valid (impossible scenarios)
```

### 7. Test Data Requirements
```yaml
test_worlds:
  small:
    entities: 100
    tasks: 20
    actors: 5

  medium:
    entities: 500
    tasks: 100
    actors: 25

  large:
    entities: 1000
    tasks: 200
    actors: 50

scenario_types:
  - typical: Clear path to goal
  - constrained: Limited resources
  - impossible: No valid solution
  - concurrent: Multiple actors interfering
  - dynamic: World changing during planning
```

## Expected Outputs

1. **Test Scenarios Document**: `docs/goap/test-scenarios.md`
   - All 40+ Gherkin scenarios
   - Organized by feature area
   - Cross-referenced to requirements

2. **Specification Update**: Testability section added
   - Link to test scenarios
   - Acceptance criteria for each feature
   - Test data requirements

3. **Test Implementation Plan**: `docs/goap/test-implementation-plan.md`
   - How to implement each scenario
   - Test framework recommendations
   - Test data generation strategy

## Success Metrics

- All features have test scenarios
- Scenarios are unambiguous and executable
- Edge cases and failures covered
- Enables TDD from day one
- Provides clear acceptance criteria
