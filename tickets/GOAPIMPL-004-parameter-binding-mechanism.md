# GOAPIMPL-004: Design Parameter Binding Mechanism

**Status**: Ready
**Priority**: HIGH
**Estimated Effort**: 2-3 days
**Dependencies**: GOAPIMPL-001 (Base Schema), GOAPIMPL-003 (Action Reference)
**Blocks**: GOAPIMPL-005 (Task File Format), GOAPIMPL-007 (Complete Examples)
**Parent**: GOAPSPECANA-001

## Problem Statement

Parameters must flow correctly from planning tasks through refinement methods to primitive actions. For example:

- Task: `task:consume_nourishing_item(item=apple_7)`
- Refinement method receives: `task.params.item = apple_7`
- Action receives: `target = apple_7` (bound via targetBindings)

The parameter binding mechanism must:
1. Define how task parameters are passed to refinement methods
2. Define how parameters flow through conditional branches
3. Define how parameters are transformed/enriched during refinement
4. Support parameter validation at each stage
5. Be transparent and debuggable

## Objective

Design and specify the complete parameter binding mechanism, including parameter sources, transformation rules, scope, and validation semantics.

## Acceptance Criteria

- [ ] Parameter flow documented (task → refinement → action)
- [ ] Parameter scope rules defined (visibility, shadowing, inheritance)
- [ ] Parameter transformation format specified (compute derived values)
- [ ] Parameter validation rules defined (type checking, required params)
- [ ] State accumulation semantics specified (step results as params)
- [ ] Examples cover all parameter binding patterns
- [ ] Integration with json-logic expressions is clear
- [ ] Documentation explains parameter binding to modders

## Design Requirements

### Parameter Flow Structure

```json
{
  "task": {
    "params": {
      "item": { "entityId": "apple_7", "location": "room_12" }
    }
  },
  "refinement": {
    "localState": {},
    "steps": [
      {
        "stepType": "primitive_action",
        "actionId": "world:move_to_location",
        "targetBindings": {
          "primary": {"var": "task.params.item.location"}
        }
      },
      {
        "stepType": "primitive_action",
        "actionId": "items:pick_up_item",
        "targetBindings": {
          "primary": {"var": "task.params.item.entityId"}
        },
        "storeResultAs": "pickupResult"
      },
      {
        "stepType": "primitive_action",
        "actionId": "items:consume_item",
        "targetBindings": {
          "primary": {"var": "refinement.localState.pickupResult.item"}
        }
      }
    ]
  }
}
```

### Key Design Decisions

1. **Parameter Source**: `task.params` contains planning-bound parameters
2. **Local State**: `refinement.localState` accumulates step results
3. **Variable Access**: json-logic `{"var": "..."}` for all parameter resolution
4. **State Persistence**: Results stored with `storeResultAs` field
5. **Validation**: Type checking via json-logic + schema validation

## Tasks

### 1. Define Parameter Sources
- [ ] Document `task.params` (from planning scope binding)
- [ ] Document `refinement.localState` (accumulated step results)
- [ ] Document `actor` (actor entity and components)
- [ ] Document `world` (world state facts)
- [ ] Define parameter precedence rules (what shadows what)
- [ ] Create schema for parameter source documentation

### 2. Design Task Parameter Passing
- [ ] Specify how planning scope results become `task.params`
- [ ] Define parameter structure (entity IDs, components, metadata)
- [ ] Document parameter immutability (read-only from task)
- [ ] Define parameter validation at task execution time
- [ ] Create examples of task parameter structures

### 3. Design Local State Accumulation
- [ ] Define `refinement.localState` schema
- [ ] Specify `storeResultAs` field on steps
- [ ] Document how step results are stored
- [ ] Define result structure (success, data, error)
- [ ] Document state visibility (available to subsequent steps only)
- [ ] Create examples of state accumulation patterns

### 4. Design Parameter Transformation
- [ ] Specify json-logic transformation expressions
- [ ] Document common transformations:
  - Property access: `{"var": "task.params.item.location"}`
  - Computed values: `{"if": [...], "then": ..., "else": ...}`
  - Aggregation: `{"map": [...], ...}`
- [ ] Define validation for transformation expressions
- [ ] Create transformation pattern library
- [ ] Document performance considerations

### 5. Design Parameter Scope Rules
- [ ] Define variable visibility per step type
- [ ] Specify shadowing rules (local overrides global)
- [ ] Document namespace collision handling
- [ ] Define scope for conditional branches (isolated or shared)
- [ ] Create scope diagram showing visibility

### 6. Design Parameter Validation
- [ ] Specify validation timing (before step execution)
- [ ] Define validation rules:
  - Required parameters present
  - Types match expected (via json-logic type checking)
  - References resolve successfully
- [ ] Document validation error messages
- [ ] Define validation failure behavior
- [ ] Create validation helper utilities

### 7. Integration with json-logic
- [ ] Document `{"var": "..."}` syntax for parameter access
- [ ] Specify custom operators for parameter operations (if needed)
- [ ] Define error handling for undefined variables
- [ ] Document performance of parameter resolution
- [ ] Create json-logic parameter evaluation tests

### 8. Design Debugging Support
- [ ] Define parameter tracing format (for debugging)
- [ ] Specify parameter snapshot at each step
- [ ] Document how to inspect parameter flow
- [ ] Create debugging tools specification
- [ ] Design error messages for parameter issues

### 9. Create Comprehensive Examples
- [ ] Example: Simple parameter passing (task → action)
- [ ] Example: Parameter transformation (computed values)
- [ ] Example: State accumulation (step results)
- [ ] Example: Conditional parameter flow (branch-specific params)
- [ ] Example: Parameter validation failure
- [ ] Example: Complex parameter flow (multi-step with transformations)
- [ ] Place examples in `docs/goap/examples/parameter-binding-*.json`

### 10. Documentation for Modders
- [ ] Write "Understanding Parameter Binding" guide
- [ ] Document parameter sources and scope
- [ ] Provide transformation pattern examples
- [ ] Document state accumulation patterns
- [ ] Create troubleshooting section (undefined variables, type mismatches)

## Expected Outputs

1. **Schema Extension**: Update to `data/schemas/refinement-method.schema.json`
   - Parameter source documentation
   - `storeResultAs` field specification
   - Parameter validation rules

2. **Parameter Binding Documentation**: `docs/goap/refinement-parameter-binding.md`
   - Parameter flow diagram
   - Scope rules
   - Transformation patterns
   - Validation semantics

3. **Parameter Examples**: `docs/goap/examples/`
   - `parameter-simple.refinement.json`
   - `parameter-transformation.refinement.json`
   - `parameter-state.refinement.json`
   - `parameter-validation.refinement.json`

4. **Modder Guide**: Section in modding documentation
   - Parameter access patterns
   - Common transformations
   - State management
   - Debugging parameter issues

## Success Metrics

- Parameter flow is fully documented and unambiguous
- All examples validate against schema
- Parameter resolution works correctly in all cases
- State accumulation integrates with refinement execution
- Modders can understand parameter binding from documentation
- Validation catches parameter errors early
- Debugging support makes parameter issues easy to diagnose

## Notes

- Parameter binding is critical for task-to-action translation
- json-logic provides consistent parameter access syntax
- State accumulation allows complex multi-step flows
- Validation should fail fast with clear error messages
- Consider performance: parameter resolution is hot path

## Key Spec References

- **Lines 113-129**: Task parameter example (item with component access)
- **Lines 73-85**: Parameter flow example (task → refinement → action)
- **Lines 195**: "method table: planning-task → decomposition into primitives"
- **Existing**: json-logic parameter access in rules (`src/logic/`)
- **Existing**: Scope DSL parameter binding in actions
