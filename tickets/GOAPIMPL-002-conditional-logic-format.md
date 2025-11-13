# GOAPIMPL-002: Design Conditional Logic Format for Refinement Methods

**Status**: Ready
**Priority**: HIGH
**Estimated Effort**: 2-3 days
**Dependencies**: GOAPIMPL-001 (Base Schema)
**Blocks**: GOAPIMPL-007 (Complete Examples)
**Parent**: GOAPSPECANA-001

## Problem Statement

Refinement methods must support conditional branching to handle different world states. For example, `task:consume_nourishing_item` should:

- If item already in inventory → consume directly
- If item in current location → pick up then consume
- If item in known location → move to location, pick up, consume
- If no known items → fail and replan

This conditional logic must be:
1. Data-driven (no JavaScript code)
2. Leverage json-logic-js for consistency with existing systems
3. Support common patterns (has_item, in_location, knows_about, etc.)
4. Allow early termination when conditions aren't met
5. Be intuitive for modders to author

## Objective

Design and specify the conditional logic format for refinement method steps, including condition evaluation semantics, branching structures, and integration with existing json-logic infrastructure.

## Acceptance Criteria

- [ ] Conditional step schema defined (extends base step from GOAPIMPL-001)
- [ ] Condition evaluation context fully specified (available variables, state access)
- [ ] Branching structure defined (if-then-else, early exit patterns)
- [ ] Common condition helper patterns documented
- [ ] Schema supports nested conditionals (limited depth)
- [ ] Examples cover all common conditional patterns
- [ ] Integration with json-logic-js is clear and tested
- [ ] Documentation explains condition authoring to modders

## Design Requirements

### Conditional Step Structure

```json
{
  "stepType": "conditional",
  "description": "Check if item is in inventory",
  "condition": {
    "in": [
      {"var": "task.params.item"},
      {"var": "actor.components.items:inventory.items"}
    ]
  },
  "thenSteps": [
    {
      "stepType": "primitive_action",
      "actionId": "items:consume_item",
      "targetBindings": { "target": {"var": "task.params.item"} }
    }
  ],
  "elseSteps": [
    {
      "stepType": "primitive_action",
      "actionId": "world:move_to_location",
      "targetBindings": { "target": {"var": "task.params.item.location"} }
    },
    {
      "stepType": "primitive_action",
      "actionId": "items:pick_up_item",
      "targetBindings": { "target": {"var": "task.params.item"} }
    },
    {
      "stepType": "primitive_action",
      "actionId": "items:consume_item",
      "targetBindings": { "target": {"var": "task.params.item"} }
    }
  ],
  "onFailure": "replan"
}
```

### Key Design Decisions

1. **Condition Format**: Use json-logic-js for all conditions (consistency with rules)
2. **Context Variables**: `actor`, `world`, `task.params`, `task.state`
3. **Branching**: Support `thenSteps` and `elseSteps` arrays
4. **Nested Conditionals**: Allow nesting up to depth 3 (prevent complexity explosion)
5. **Early Exit**: `onFailure` behavior when condition cannot be evaluated

## Tasks

### 1. Define Condition Evaluation Context
- [ ] Document all available variables in condition evaluation
  - `actor` (full actor entity with components)
  - `world` (world state facts)
  - `task.params` (bound parameters from planning scope)
  - `task.state` (transient refinement state)
- [ ] Define scope of state access (what can conditions query?)
- [ ] Document timing of evaluation (before step execution)
- [ ] Define failure semantics when variables are undefined
- [ ] Create context schema documentation

### 2. Design Conditional Step Schema
- [ ] Extend base step schema with `conditional` stepType
- [ ] Define required fields (stepType, condition, thenSteps)
- [ ] Define optional fields (description, elseSteps, onFailure)
- [ ] Add validation rules (condition must be valid json-logic)
- [ ] Add recursive validation (thenSteps/elseSteps are valid step arrays)
- [ ] Define nesting depth limit (max 3 levels)

### 3. Design Branching Semantics
- [ ] Specify `thenSteps` execution when condition evaluates to truthy
- [ ] Specify `elseSteps` execution when condition evaluates to falsy
- [ ] Define behavior when `elseSteps` is omitted (skip, continue)
- [ ] Define early termination on condition evaluation failure
- [ ] Document execution order within branches
- [ ] Define state changes visible to subsequent steps

### 4. Design Failure Handling
- [ ] Define `onFailure` enum values:
  - `replan`: Invalidate plan and trigger replanning
  - `skip`: Skip this conditional block, continue
  - `fail`: Fail entire refinement, trigger fallback
- [ ] Specify when failure is triggered (condition eval error, missing variables)
- [ ] Define default `onFailure` behavior (likely `replan`)
- [ ] Document failure propagation to refinement engine
- [ ] Create examples of each failure mode

### 5. Create Common Condition Patterns
- [ ] Document "item in inventory" pattern
- [ ] Document "item in current location" pattern
- [ ] Document "knows about entity" pattern
- [ ] Document "has component with value" pattern
- [ ] Document "distance less than" pattern
- [ ] Document "entity is visible" pattern
- [ ] Create reusable condition template library

### 6. Integration with json-logic-js
- [ ] Verify json-logic-js supports all required operations
- [ ] Document custom operators needed (if any)
- [ ] Test condition evaluation with existing json-logic infrastructure
- [ ] Document how to extend with custom operators
- [ ] Create validation helper for condition syntax

### 7. Design Nested Conditional Limits
- [ ] Define maximum nesting depth (3 levels recommended)
- [ ] Create validation rule to enforce depth limit
- [ ] Document rationale (prevent complexity explosion)
- [ ] Provide alternative patterns for deep nesting (split into multiple methods)
- [ ] Create examples showing depth limits

### 8. Create Comprehensive Examples
- [ ] Example: Simple if-then (item in inventory)
- [ ] Example: If-then-else (item in inventory vs elsewhere)
- [ ] Example: Nested conditional (item state checks)
- [ ] Example: Multiple conditions with logical operators (AND/OR)
- [ ] Example: Condition evaluation failure handling
- [ ] Place examples in `docs/goap/examples/conditional-refinement-*.json`

### 9. Documentation for Modders
- [ ] Write "Authoring Conditional Refinement Methods" guide
- [ ] Document common patterns and templates
- [ ] Provide debugging tips (condition not evaluating as expected)
- [ ] Document condition testing strategies
- [ ] Create troubleshooting section

## Expected Outputs

1. **Schema Extension**: Update to `data/schemas/refinement-method.schema.json`
   - Conditional step type definition
   - Validation rules for conditionals
   - Nesting depth enforcement

2. **Condition Context Documentation**: `docs/goap/refinement-condition-context.md`
   - All available variables
   - State access semantics
   - Evaluation timing
   - Failure handling

3. **Conditional Examples**: `docs/goap/examples/`
   - `conditional-simple.refinement.json`
   - `conditional-nested.refinement.json`
   - `conditional-failure.refinement.json`
   - `conditional-patterns.refinement.json`

4. **Modder Guide**: Section in modding documentation
   - Pattern library
   - Common use cases
   - Debugging conditionals

## Success Metrics

- Conditional schema validates with AJV
- All example conditionals validate against schema
- Common patterns (inventory check, location check) work correctly
- Nesting depth limit is enforced
- Modders can understand conditional syntax from documentation
- json-logic integration is seamless

## Notes

- Leverage existing json-logic-js infrastructure from rules system
- Keep conditions readable; avoid overly complex logic in single condition
- Provide clear error messages when conditions fail
- Consider performance: condition evaluation happens at runtime
- Early exit behavior is critical for planning efficiency

## Key Spec References

- **Lines 73-85**: Example conditional refinement (if has item → consume, else → acquire + consume)
- **Line 291**: "This refinement is data-driven, in mods, not in JavaScript"
- **Existing**: json-logic-js usage in `src/logic/` for rules
- **Existing**: Condition evaluation in `src/loaders/ruleLoader.js`
