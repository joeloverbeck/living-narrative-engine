# GOAPIMPL-007: Create Complete Refinement Method Examples

**Status**: Ready
**Priority**: MEDIUM
**Estimated Effort**: 2 days
**Dependencies**: GOAPIMPL-001, GOAPIMPL-002, GOAPIMPL-003, GOAPIMPL-004, GOAPIMPL-005
**Blocks**: None
**Parent**: GOAPSPECANA-001

## Problem Statement

Complete, working examples are critical for:
1. Validating the refinement method design
2. Teaching modders how to author refinement methods
3. Providing templates for common patterns
4. Testing the implementation

The examples must cover all key features of the refinement system and represent realistic game scenarios.

## Objective

Create a comprehensive set of complete, validated refinement method examples that demonstrate all features of the refinement system and serve as templates for modders.

## Acceptance Criteria

- [ ] 5+ complete refinement method examples created
- [ ] All examples validate against schemas
- [ ] Examples cover all key features (conditionals, parameters, state, failure)
- [ ] Each example includes:
  - Task definition
  - One or more refinement methods
  - World state context
  - Expected execution flow
  - Edge cases and failure scenarios
- [ ] Examples are documented with inline comments
- [ ] Examples represent realistic game scenarios
- [ ] Examples serve as templates for modders

## Required Examples

### 1. Simple Sequential Refinement
**Example**: `task:consume_nourishing_item` (no conditionals)
- Actor already has item in inventory
- Single method: consume item directly
- Demonstrates: Basic action reference, parameter binding

### 2. Conditional Acquisition Refinement
**Example**: `task:consume_nourishing_item` (with conditionals)
- If item in inventory → consume directly
- Else if item in current location → pick up, then consume
- Else if item in known location → move to location, pick up, consume
- Demonstrates: Nested conditionals, multiple action sequences, parameter flow

### 3. Multi-Step Task with State Accumulation
**Example**: `task:secure_shelter`
- Move to shelter location
- Close door (store door ID as state)
- Lock door using stored door ID
- Demonstrates: State accumulation with `storeResultAs`, sequential dependencies

### 4. Multiple Methods for Different Scenarios
**Example**: `task:arm_self`
- Method 1: If weapon in inventory → equip weapon
- Method 2: If weapon in current location → pick up and equip
- Method 3: If no weapon available → fail and replan
- Demonstrates: Multiple methods per task, applicability conditions, fallback

### 5. Complex Conditional Flow
**Example**: `task:find_instrument_and_play`
- If actor knows instrument location → move to it
- If instrument in current location → pick it up
- If actor has instrument → start playing
- Demonstrates: Complex conditional flow, knowledge-based planning

### 6. Failure Handling and Replanning
**Example**: `task:consume_nourishing_item` (item disappeared)
- Expected: Item exists
- Reality: Item was consumed by another actor
- Result: Refinement fails, triggers replan
- Demonstrates: Failure detection, replanning trigger, error handling

## Tasks

### 1. Create Example: Simple Sequential Refinement
- [ ] Define task (`task:consume_nourishing_item`)
- [ ] Create refinement method (simple sequence)
- [ ] Create world state scenario (item in inventory)
- [ ] Document expected execution flow
- [ ] Validate against schemas
- [ ] Add inline documentation
- [ ] Place in `docs/goap/examples/consume-item-simple.example.json`

### 2. Create Example: Conditional Acquisition
- [ ] Define task (`task:consume_nourishing_item`)
- [ ] Create refinement method with nested conditionals
- [ ] Create three world state scenarios:
  - Item in inventory
  - Item in current location
  - Item in remote location
- [ ] Document expected execution for each scenario
- [ ] Validate against schemas
- [ ] Add inline documentation
- [ ] Place in `docs/goap/examples/consume-item-conditional.example.json`

### 3. Create Example: Multi-Step with State
- [ ] Define task (`task:secure_shelter`)
- [ ] Create refinement method with state accumulation
- [ ] Create world state scenario (actor at shelter entrance)
- [ ] Document expected execution flow
- [ ] Show state accumulation at each step
- [ ] Validate against schemas
- [ ] Add inline documentation
- [ ] Place in `docs/goap/examples/secure-shelter.example.json`

### 4. Create Example: Multiple Methods
- [ ] Define task (`task:arm_self`)
- [ ] Create three refinement methods with different applicability
- [ ] Create three world state scenarios (weapon in inventory, nearby, unavailable)
- [ ] Document method selection for each scenario
- [ ] Show fallback behavior
- [ ] Validate against schemas
- [ ] Add inline documentation
- [ ] Place in `docs/goap/examples/arm-self-multiple-methods.example.json`

### 5. Create Example: Complex Conditional Flow
- [ ] Define task (`task:find_instrument_and_play`)
- [ ] Create refinement method with complex conditionals
- [ ] Create world state scenario (actor knows instrument location)
- [ ] Document expected execution flow
- [ ] Show knowledge-based decision making
- [ ] Validate against schemas
- [ ] Add inline documentation
- [ ] Place in `docs/goap/examples/find-instrument.example.json`

### 6. Create Example: Failure and Replanning
- [ ] Define task (`task:consume_nourishing_item`)
- [ ] Create refinement method (expects item exists)
- [ ] Create two world states:
  - Before: Item exists at known location
  - After: Item disappeared (consumed by another actor)
- [ ] Document expected failure detection
- [ ] Show replanning trigger
- [ ] Validate against schemas
- [ ] Add inline documentation
- [ ] Place in `docs/goap/examples/consume-item-failure.example.json`

### 7. Create Example Template Library
- [ ] Create template: Simple sequential task
- [ ] Create template: Conditional acquisition task
- [ ] Create template: Multi-step with state
- [ ] Create template: Multiple methods pattern
- [ ] Annotate templates with customization points
- [ ] Place templates in `docs/goap/templates/`

### 8. Validate All Examples
- [ ] Run schema validation on all examples
- [ ] Verify all action references exist
- [ ] Verify all scope references exist
- [ ] Verify all json-logic conditions are valid
- [ ] Test parameter resolution logic
- [ ] Check for any inconsistencies

### 9. Create Example Documentation
- [ ] Write overview of example collection
- [ ] Document structure of each example
- [ ] Provide usage guidance
- [ ] Create cross-reference to specification
- [ ] Add troubleshooting tips
- [ ] Create `docs/goap/examples/README.md`

### 10. Create Edge Case Examples
- [ ] Example: Empty inventory conditional
- [ ] Example: Unreachable target location
- [ ] Example: Missing required component
- [ ] Example: Invalid parameter type
- [ ] Example: Condition evaluation failure
- [ ] Document error messages for each
- [ ] Place in `docs/goap/examples/edge-cases/`

## Expected Outputs

1. **Main Examples**: `docs/goap/examples/`
   - `consume-item-simple.example.json`
   - `consume-item-conditional.example.json`
   - `secure-shelter.example.json`
   - `arm-self-multiple-methods.example.json`
   - `find-instrument.example.json`
   - `consume-item-failure.example.json`

2. **Templates**: `docs/goap/templates/`
   - `simple-sequential-task.template.json`
   - `conditional-acquisition-task.template.json`
   - `multi-step-state-task.template.json`
   - `multiple-methods-task.template.json`

3. **Edge Cases**: `docs/goap/examples/edge-cases/`
   - 5+ edge case examples with error documentation

4. **Example Documentation**: `docs/goap/examples/README.md`
   - Overview of example collection
   - Usage guidance
   - Template library

## Success Metrics

- All examples validate against schemas
- Examples cover all refinement features
- Each example has clear documentation
- World state scenarios are realistic
- Execution flows are clearly documented
- Edge cases demonstrate error handling
- Templates are ready for modder customization
- Examples can be used for implementation testing

## Notes

- Examples should be realistic, not contrived
- Inline comments should explain "why", not just "what"
- World state scenarios should be complete (not partial)
- Execution flows should be step-by-step
- Edge cases should show both error and recovery
- Templates should be minimal but complete

## Key Spec References

- **Lines 73-85**: Example conditional refinement (consume item with acquisition)
- **Lines 436-439**: Example refinement (secure_shelter decomposition)
- **Original ticket tasks**: All example requests from GOAPSPECANA-001
