# GOAPSPECANA-008: Complete End-to-End Examples

**Status**: Not Started
**Priority**: HIGH
**Estimated Effort**: 2-3 days
**Dependencies**: GOAPSPECANA-001, GOAPSPECANA-002, GOAPSPECANA-003, GOAPSPECANA-005
**Blocks**: Implementation validation

## Problem Statement

Specification shows fragments throughout but never provides complete end-to-end scenarios. This leads to 40% more design misunderstandings and makes it difficult to validate design coherence.

## Objective

Create 5 complete worked examples demonstrating the GOAP system from initial state through planning, refinement, execution, and outcomes.

## Acceptance Criteria

- [ ] 5 complete scenarios documented (simple → complex → failure)
- [ ] Each scenario includes: initial state, goal, planning process, final plan, execution, outcomes
- [ ] Examples validate design coherence
- [ ] Examples added to specification
- [ ] Examples cross-reference specification concepts

## Tasks

### Example 1: Simple Refinement (Item in Inventory)

```
Initial State:
- Actor: id=actor_1, location=room_8, hunger=75
  - inventory: [apple_5]
  - components: {biology:can_eat, core:actor}
- Apple: id=apple_5, location=actor_1_inventory
  - components: {food:nutrition_value=30, core:item}

Goal: survival:reduce_hunger (satisfaction: hunger < 30)

Planning Process:
1. Task library built (structural gates evaluated)
   - task:consume_nourishing_item: INCLUDED (has biology:can_eat)
2. GOAP search:
   - Initial state: {actor.hunger: 75}
   - Available tasks: [consume_nourishing_item]
   - Scope resolution: items:known_nourishing_items → [apple_5]
   - Bind parameters: {item: apple_5}
   - Apply effects: hunger 75 → 45
   - Goal satisfied? NO (45 >= 30)
   - Continue search...

Final Plan: [task:consume_nourishing_item(apple_5)]

Refinement:
- Input: task=consume_nourishing_item, item=apple_5, worldState
- Check: apple_5 in actor inventory? YES
- Output: [items:consume_item(target=apple_5)]

Execution:
- Turn 1: Execute items:consume_item(target=apple_5)
  - Operation: DECREASE actor.state.hunger by 30
  - Result: hunger 75 → 45
  - Goal satisfied? NO

Replan triggered (hunger still > 30), finds second item...
```

### Example 2: Complex Refinement (Requires Movement)

```
Initial State:
- Actor: id=actor_1, location=room_8, hunger=80, inventory=[]
- Bread: id=bread_7, location=room_15
  - components: {food:nutrition_value=50, core:known_to=[actor_1]}
- Room_8 → Room_12 → Room_15 (navigation path)

Goal: survival:reduce_hunger

Planning Process:
[Complete step-by-step with state snapshots]

Final Plan: [task:consume_nourishing_item(bread_7)]

Refinement:
- Check: bread_7 in inventory? NO
- Check: bread_7 location known? YES (room_15)
- Generate sequence:
  1. world:move_to_location(target=room_15)
  2. items:pick_up_item(target=bread_7)
  3. items:consume_item(target=bread_7)

Execution:
- Turn 1: Move room_8 → room_12
- Turn 2: Move room_12 → room_15
- Turn 3: Pick up bread_7
- Turn 4: Consume bread_7, hunger satisfied
```

### Example 3: Failed Refinement (No Valid Target)

```
Initial State:
- Actor: id=actor_1, hunger=85, inventory=[]
- No known nourishing items in world

Goal: survival:reduce_hunger

Planning:
- Task library: [consume_nourishing_item]
- Scope resolution: items:known_nourishing_items → []
- Cannot bind parameters (no items)
- Planning fails: "no_valid_binding"

Fallback Behavior:
- Abandon goal
- Activate fallback: "search_for_food" task
- Or: Idle behavior
```

### Example 4: Plan Invalidation (Concurrent Actor)

```
Timeline:
T=0: Actor_A plans to consume apple_5 (in room_12)
T=1: Actor_A starts moving toward room_12
T=2: Actor_B arrives at room_12, takes apple_5
T=3: Actor_A arrives at room_12
T=4: Actor_A attempts pick_up(apple_5) → FAILS (not here)
T=5: Precondition check fails, plan invalidated
T=6: Actor_A replans (finds bread_7 instead)
```

### Example 5: Knowledge-Limited Planning (Omniscience Prevention)

```
Initial State:
- Actor: id=actor_1, location=room_8, hunger=80
- Apple: id=apple_5, location=room_12
  - components: {core:known_to=[]} (actor doesn't know about it)
- Bread: id=bread_7, location=room_15
  - components: {core:known_to=[actor_1]}

Planning:
- Scope: items:known_nourishing_items_anywhere
- Filter: must have actor_1 in core:known_to
- Result: [bread_7] (apple_5 excluded - not known)
- Plans with bread_7 (not apple_5, even though closer)

Later:
- Actor discovers apple_5 (enters room_12)
- core:known_to updated: [actor_1]
- Future planning now includes apple_5
```

## Expected Outputs

1. **Examples Document**: `docs/goap/complete-examples.md`
   - All 5 scenarios fully worked out
   - State transitions shown
   - Decision points explained
   - Cross-references to specification

2. **Specification Update**: Examples section added
   - Links to detailed examples
   - Summary of each scenario
   - Key concepts demonstrated

3. **Test Data**: `tests/fixtures/goap/`
   - JSON files for each scenario's initial state
   - Can be used for integration tests

## Success Metrics

- All examples are complete (no "..." or TBD)
- Examples validate specification coherence
- Examples demonstrate all key concepts
- Examples can be used as basis for tests
