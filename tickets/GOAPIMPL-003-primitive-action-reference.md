# GOAPIMPL-003: Design Primitive Action Reference Format

**Status**: Ready
**Priority**: HIGH
**Estimated Effort**: 2 days
**Dependencies**: GOAPIMPL-001 (Base Schema)
**Blocks**: GOAPIMPL-004 (Parameter Binding), GOAPIMPL-007 (Complete Examples)
**Parent**: GOAPSPECANA-001

## Problem Statement

Refinement methods must be able to reference and invoke primitive actions (existing execution-time actions) with proper target bindings and parameters. For example:

- Reference: `items:pick_up_item`
- Target binding: Bind `task.params.item` to action's `target` scope
- Parameters: Pass additional config like `force: true`

The action reference format must:
1. Reference actions by existing namespaced ID (`modId:actionId`)
2. Map task parameters to action target scopes
3. Support dynamic target resolution from task context
4. Pass action-specific parameters
5. Validate that referenced actions exist
6. Be clear and intuitive for modders

## Objective

Design and specify the primitive action reference format for refinement method steps, including target binding semantics, parameter passing, and validation rules.

## Acceptance Criteria

- [ ] Action reference schema defined (part of `primitive_action` step)
- [ ] Target binding format specified (parameter mapping)
- [ ] Action parameter override format specified
- [ ] Dynamic target resolution semantics documented
- [ ] Validation rules for action references created
- [ ] Examples cover all common action reference patterns
- [ ] Integration with existing action system is clear
- [ ] Documentation explains action referencing to modders

## Design Requirements

### Primitive Action Step Structure

```json
{
  "stepType": "primitive_action",
  "description": "Pick up the nourishing item",

  "actionId": "items:pick_up_item",

  "targetBindings": {
    "primary": {"var": "task.params.item"},
    "secondary": null,
    "tertiary": null
  },

  "parameters": {
    "force": true,
    "silent": false
  },

  "onFailure": "replan"
}
```

### Key Design Decisions

1. **Action Reference**: Use existing `modId:actionId` format (consistency)
2. **Target Bindings**: Explicit mapping for primary/secondary/tertiary targets
3. **Parameter Source**: json-logic expressions with `{"var": "..."}` syntax
4. **Parameter Override**: Direct parameter values override action defaults
5. **Validation**: Cross-reference validation (actionId must exist in loaded actions)

## Tasks

### 1. Define Action Reference Format
- [ ] Specify `actionId` field (namespaced string, required)
- [ ] Define format validation (must match `modId:actionId` pattern)
- [ ] Document how to find valid action IDs
- [ ] Create validation rule to check action exists
- [ ] Document error messages for invalid action references

### 2. Design Target Binding Structure
- [ ] Define `targetBindings` object schema
- [ ] Specify fields: `primary`, `secondary`, `tertiary` (align with existing action targets)
- [ ] Define binding value types: json-logic expression or null
- [ ] Document how bindings map to action's target scopes
- [ ] Define validation rules for target bindings

### 3. Design Target Resolution Semantics
- [ ] Document dynamic resolution from `{"var": "task.params.item"}`
- [ ] Specify when target resolution occurs (at refinement execution time)
- [ ] Define behavior when target variable is undefined
- [ ] Document nested property access (`{"var": "task.params.item.location"}`)
- [ ] Define validation for target resolution expressions

### 4. Design Parameter Passing
- [ ] Define `parameters` object schema (key-value pairs)
- [ ] Specify parameter value types (primitives, json-logic expressions)
- [ ] Document parameter inheritance (from task, from action defaults)
- [ ] Define parameter override semantics (refinement > task > action)
- [ ] Create examples of common parameter patterns

### 5. Design Failure Handling
- [ ] Define `onFailure` field for action step
- [ ] Specify failure scenarios:
  - Action not found
  - Target binding resolution fails
  - Action execution fails (gates not satisfied)
  - Action operation fails
- [ ] Define failure behaviors: `replan`, `skip`, `fail`
- [ ] Document failure propagation to refinement engine
- [ ] Create examples of failure handling

### 6. Integration with Existing Action System
- [ ] Document relationship to action scopes (target resolution)
- [ ] Specify how refinement bypasses execution-time gates (if needed)
- [ ] Define how action operations are executed
- [ ] Document action event dispatch integration
- [ ] Clarify difference between planning-time and execution-time targeting

### 7. Create Validation Rules
- [ ] Action ID exists in loaded action registry
- [ ] Target bindings match action's expected targets
- [ ] Parameters are valid for the referenced action
- [ ] json-logic expressions in bindings are valid
- [ ] Required bindings are provided
- [ ] Detect circular references (if subtasks are supported later)

### 8. Create Comprehensive Examples
- [ ] Example: Simple action reference (move_to_location)
- [ ] Example: Action with target binding (pick_up_item)
- [ ] Example: Action with multiple targets (give_item)
- [ ] Example: Action with parameters (consume_item with force)
- [ ] Example: Dynamic target resolution (item from task params)
- [ ] Example: Failure handling (target not found)
- [ ] Place examples in `docs/goap/examples/action-reference-*.json`

### 9. Documentation for Modders
- [ ] Write "Referencing Primitive Actions in Refinement Methods" guide
- [ ] Document how to find available actions
- [ ] Provide target binding patterns
- [ ] Document parameter override examples
- [ ] Create troubleshooting section (action not found, binding fails)

## Expected Outputs

1. **Schema Extension**: Update to `data/schemas/refinement-method.schema.json`
   - `primitive_action` step schema
   - Target binding schema
   - Parameter schema
   - Validation rules

2. **Action Reference Documentation**: `docs/goap/refinement-action-references.md`
   - Action reference format
   - Target binding semantics
   - Parameter passing
   - Validation rules

3. **Action Reference Examples**: `docs/goap/examples/`
   - `action-reference-simple.refinement.json`
   - `action-reference-bindings.refinement.json`
   - `action-reference-parameters.refinement.json`
   - `action-reference-failure.refinement.json`

4. **Modder Guide**: Section in modding documentation
   - How to reference actions
   - Common binding patterns
   - Parameter examples

## Success Metrics

- Action reference schema validates with AJV
- All example action references validate against schema
- Referenced actions can be resolved at runtime
- Target binding resolution works correctly
- Parameter passing integrates with action execution
- Modders can understand action referencing from documentation
- Validation catches invalid action references

## Notes

- Leverage existing action system infrastructure
- Action discovery should use existing action registry
- Target binding uses same json-logic as conditions
- Consider performance: action lookups should be fast
- Failure handling is critical for robust planning

## Key Spec References

- **Lines 24-31**: Existing primitive actions (move_to, pick_up, consume)
- **Lines 73-85**: Example refinement with action sequence
- **Lines 436-439**: Example refinement (secure_shelter → primitives)
- **Existing**: Action schema at `data/schemas/action.schema.json`
- **Existing**: Action loading in `src/loaders/actionLoader.js`
- **Existing**: Scope DSL for target resolution in `src/scopeDsl/`
