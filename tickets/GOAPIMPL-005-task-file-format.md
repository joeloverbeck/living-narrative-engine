# GOAPIMPL-005: Design Task File Format and Mod Integration

**Status**: Ready
**Priority**: HIGH
**Estimated Effort**: 2-3 days
**Dependencies**: GOAPIMPL-001 (Base Schema), GOAPIMPL-004 (Parameter Binding)
**Blocks**: GOAPIMPL-008 (Implementation Guide)
**Parent**: GOAPSPECANA-001

## Problem Statement

Planning tasks must be loaded from mods alongside actions, rules, and other content. The task file format must define:

1. Task structure (structural_gates, planning_preconditions, planning_effects, planning_scope)
2. Associated refinement methods (how task decomposes to primitives)
3. Mod integration (where tasks live, how they're loaded)
4. Validation rules (schema validation, cross-references)

The task system is the foundation of the GOAP planner and must integrate seamlessly with the existing mod architecture.

## Objective

Design and specify the complete task file format, including task schema, refinement method integration, mod structure, and loading process.

## Acceptance Criteria

- [ ] Task schema created at `data/schemas/task.schema.json`
- [ ] Refinement method integration with tasks specified
- [ ] Task directory structure in mods defined
- [ ] Task loading process specified (similar to action/rule loaders)
- [ ] Mod manifest integration defined
- [ ] Validation rules for tasks created
- [ ] Examples cover common task patterns
- [ ] Documentation for task authoring complete

## Design Requirements

### Task File Structure

```json
{
  "$schema": "schema://living-narrative-engine/task.schema.json",
  "id": "modId:task_id",
  "description": "Consume a nourishing item to reduce hunger",

  "structuralGates": {
    "description": "Actor must be capable of eating and know about food",
    "condition": {
      "and": [
        {"!!": [{"var": "actor.components.biology:can_eat"}]},
        {"!!": [{"var": "actor.components.core:knowledge.knows_nourishing_items"}]}
      ]
    }
  },

  "planningScope": "items:known_nourishing_items_anywhere",

  "planningPreconditions": [
    {
      "description": "Actor must be hungry",
      "condition": {">": [{"var": "actor.components.biology:hunger"}, 30]}
    }
  ],

  "planningEffects": [
    {
      "op": "DECREASE_COMPONENT_VALUE",
      "path": "actor.components.biology:hunger",
      "amount": {"var": "task.params.item.components.food:nutrition_value"}
    }
  ],

  "refinementMethods": [
    {
      "methodId": "modId:task_id.method_name",
      "$ref": "./refinement-methods/task_id.method_name.refinement.json"
    }
  ],

  "cost": 10,
  "priority": 50
}
```

### Key Design Decisions

1. **Task Location**: `mods/modId/tasks/` directory
2. **Refinement Methods**: External files referenced via `$ref`
3. **Planning Scope**: Reference existing scopeDsl files
4. **Effects**: Use existing operation handler types
5. **Validation**: AJV schema with cross-reference validation

## Tasks

### 1. Define Task Schema Structure
- [ ] Create `data/schemas/task.schema.json` file
- [ ] Define schema metadata ($schema, $id, title, description)
- [ ] Define task root object (id, description, gates, scope, preconditions, effects)
- [ ] Define structural gates schema (condition + description)
- [ ] Define planning preconditions array schema
- [ ] Define planning effects array schema
- [ ] Define refinement methods reference array

### 2. Design Structural Gates Format
- [ ] Define structural gates as json-logic condition
- [ ] Document purpose (coarse "is this task relevant?")
- [ ] Specify evaluation context (actor, world knowledge)
- [ ] Define difference from planning preconditions
- [ ] Create examples of common gate patterns:
  - Actor capability checks (can_eat, is_musician)
  - Knowledge checks (knows_about_instruments)
  - World state checks (world_has_electricity)
- [ ] Document gate evaluation timing (during task library building)

### 3. Design Planning Scope Integration
- [ ] Define planning scope field (reference to scopeDsl file)
- [ ] Specify scope resolution semantics (knowledge-limited)
- [ ] Document parameter binding from scope results
- [ ] Define scope file location (`mods/modId/scopes/`)
- [ ] Create examples of planning scopes:
  - `items:known_nourishing_items_anywhere`
  - `actors:known_friendly_actors`
  - `locations:known_safe_shelters`

### 4. Design Planning Preconditions Format
- [ ] Define preconditions as array of condition objects
- [ ] Specify condition structure (description + json-logic condition)
- [ ] Document precondition evaluation context (state facts, task params)
- [ ] Define when preconditions are checked (during planning, during execution)
- [ ] Create precondition pattern library:
  - State checks (hunger > threshold)
  - Possession checks (has_weapon)
  - Location checks (in_safe_area)

### 5. Design Planning Effects Format
- [ ] Define effects as array of operation objects
- [ ] Specify operation types (use existing operation handlers):
  - `ADD_COMPONENT`
  - `REMOVE_COMPONENT`
  - `SET_COMPONENT_VALUE`
  - `INCREASE_COMPONENT_VALUE`
  - `DECREASE_COMPONENT_VALUE`
- [ ] Document effect simulation semantics (for planning)
- [ ] Define parameter access in effects (`{"var": "task.params.item.components.food:nutrition"}`)
- [ ] Create effect pattern library

### 6. Design Refinement Method Integration
- [ ] Define refinement methods array in task schema
- [ ] Specify method reference structure (methodId + $ref)
- [ ] Define $ref resolution rules (relative path from task file)
- [ ] Document multiple methods per task (fallback mechanism)
- [ ] Define refinement method file naming (`task_id.method_name.refinement.json`)
- [ ] Create examples of method references

### 7. Define Task Directory Structure in Mods
- [ ] Specify task directory: `mods/modId/tasks/`
- [ ] Specify task file naming: `task_id.task.json`
- [ ] Specify refinement methods subdirectory: `tasks/refinement-methods/`
- [ ] Define relationship to other mod directories (actions, rules, scopes)
- [ ] Document task discovery process

### 8. Design Task Loader
- [ ] Specify task loader architecture (similar to actionLoader, ruleLoader)
- [ ] Define loader location: `src/loaders/taskLoader.js`
- [ ] Document loading order (after scopes, before planner initialization)
- [ ] Define validation during loading (schema + cross-references)
- [ ] Specify error handling for invalid tasks
- [ ] Create loader interface contract

### 9. Mod Manifest Integration
- [ ] Define mod-manifest.json task section (if needed)
- [ ] Specify task registration format
- [ ] Document task dependency resolution (between mods)
- [ ] Define task override mechanism (for mod extensions)
- [ ] Create mod manifest examples with tasks

### 10. Create Task Validation Rules
- [ ] Validate task ID format (namespace:identifier)
- [ ] Validate planning scope exists
- [ ] Validate refinement method $refs resolve
- [ ] Validate operation types in effects
- [ ] Validate json-logic conditions in gates/preconditions
- [ ] Create comprehensive validation test suite

### 11. Create Comprehensive Examples
- [ ] Example: Simple task (consume_nourishing_item)
- [ ] Example: Complex task (secure_shelter with multiple methods)
- [ ] Example: Task with knowledge gates (find_instrument_and_play)
- [ ] Example: Task with multiple preconditions (arm_self)
- [ ] Example: Task with complex effects (heal_self)
- [ ] Place examples in `docs/goap/examples/task-*.json`

### 12. Documentation for Modders
- [ ] Write "Authoring Planning Tasks" guide
- [ ] Document task file structure
- [ ] Provide structural gate patterns
- [ ] Document scope integration
- [ ] Provide precondition/effect examples
- [ ] Document refinement method integration
- [ ] Create troubleshooting section

## Expected Outputs

1. **Task Schema**: `data/schemas/task.schema.json`
   - Complete task structure definition
   - Validation rules
   - Cross-reference schemas

2. **Task Loader Specification**: `docs/goap/task-loading.md`
   - Loader architecture
   - Loading process
   - Validation rules
   - Error handling

3. **Task Examples**: `docs/goap/examples/`
   - `task-consume-nourishing-item.task.json`
   - `task-secure-shelter.task.json`
   - `task-find-instrument.task.json`
   - `task-arm-self.task.json`

4. **Modder Guide**: `docs/modding/authoring-planning-tasks.md`
   - Complete task authoring guide
   - Pattern library
   - Troubleshooting

5. **Mod Structure Documentation**: Update existing mod structure docs
   - Add `tasks/` directory
   - Add `tasks/refinement-methods/` subdirectory
   - Document loading order

## Success Metrics

- Task schema validates with AJV
- All example tasks validate against schema
- Task directory structure integrates with existing mod architecture
- Task loader specification is implementable
- Modders can author tasks from documentation
- Validation catches all structural errors
- Loading process is clear and unambiguous

## Notes

- Tasks are the foundation of the GOAP planner
- Integration with existing mod structure is critical
- Leverage existing operation handlers for effects
- Leverage existing scopeDsl for planning scope
- Task loading must be performant (many tasks per mod)

## Key Spec References

- **Lines 107-109**: Tasks loaded via mods in 'tasks/' folder
- **Lines 111-135**: Task structure example (structural_gates, planning_preconditions, planning_effects, planning_scope)
- **Lines 195**: "method table: planning-task → decomposition into primitives"
- **Lines 271-280**: Task components (gates, preconditions, effects, scope)
- **Existing**: Action schema at `data/schemas/action.schema.json` (pattern reference)
- **Existing**: Rule schema at `data/schemas/rule.schema.json` (pattern reference)
- **Existing**: Scope DSL files in `data/mods/*/scopes/`
