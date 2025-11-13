# GOAPSPECANA-001: Design Data-Driven Refinement Method Format

**Status**: Not Started
**Priority**: CRITICAL
**Estimated Effort**: 3-4 days
**Dependencies**: None
**Blocks**: GOAPSPECANA-002, GOAPSPECANA-006

## Problem Statement

The GOAP specification has committed to data-driven HTN-style refinement (line 291: "This refinement is data-driven, in mods, not in JavaScript"). However, the detailed format and semantics of refinement methods need to be specified to enable implementation.

The refinement layer translates abstract planning tasks (e.g., `task:consume_nourishing_item`) into sequences of primitive actions (e.g., `[move_to, pick_up, consume]`). This translation must be:
1. Fully data-driven and mod-defined (no hardcoded JavaScript logic)
2. Support conditional branching (e.g., "if item in inventory, skip acquisition")
3. Reference primitive actions from the existing action system
4. Be simple to author for modders while remaining flexible

## Objective

Design and fully specify the data-driven refinement method format, including schema structure, conditional logic semantics, and primitive action referencing mechanisms.

## Acceptance Criteria

- [ ] Refinement method schema fully specified with JSON schema
- [ ] Conditional branching semantics defined (how to express "if item in inventory")
- [ ] Primitive action reference format specified (how refinement methods call actions)
- [ ] Parameter binding mechanism defined (how task params flow to primitives)
- [ ] Failure handling semantics specified (what happens when refinement fails)
- [ ] Complete examples provided for common refinement patterns
- [ ] Schema is modder-friendly and aligns with existing action/rule formats
- [ ] Implementation guidance document created for developers

## Tasks

### 1. Review Existing Systems and Constraints
- [ ] Analyze existing action schema format (`data/schemas/action.schema.json`)
- [ ] Review existing rule format and operation handlers (`src/logic/operationHandlers/`)
- [ ] Study scopeDsl capabilities for target resolution
- [ ] Understand json-logic-js capabilities for conditional logic
- [ ] Document modder familiarity with current formats

### 2. Design Refinement Method Schema
- [ ] Define refinement method structure (sequences, steps, branches)
- [ ] Specify how methods reference primitive actions (by ID, with params)
- [ ] Design conditional branching format (likely json-logic-based)
- [ ] Define parameter passing from task to primitive actions
- [ ] Specify multiple methods per task (for different world states)
- [ ] Create base refinement method JSON schema

### 3. Design Conditional Logic Semantics
- [ ] Specify condition evaluation contexts (what data is available?)
- [ ] Define supported condition types (has_item, in_location, etc.)
- [ ] Design branching structures (if-then-else, case statements)
- [ ] Specify early termination semantics (when to skip remaining steps)
- [ ] Document how conditions access world state and task parameters
- [ ] Create examples: "if item in inventory" vs "if item in world"

### 4. Design Primitive Action Reference Format
- [ ] Specify action reference structure (action_id, target bindings, params)
- [ ] Define how task parameters map to action targets
- [ ] Design dynamic target resolution (from task scope results)
- [ ] Specify action parameter inheritance and overrides
- [ ] Define validation rules for action references
- [ ] Document how refinement methods call sequences of actions

### 5. Design Failure Handling and Validation
- [ ] Specify refinement failure scenarios (no valid method, action fails, etc.)
- [ ] Define failure propagation to planner (when to replan)
- [ ] Design pre-execution validation (can this method succeed?)
- [ ] Specify fallback method selection (multiple methods per task)
- [ ] Define error reporting format for debugging
- [ ] Document replanning triggers

### 6. Create Complete Examples
- [ ] Example: consume_nourishing_item (conditional acquisition)
- [ ] Example: secure_shelter (multi-step sequence)
- [ ] Example: arm_self (multiple methods for different item types)
- [ ] Example: find_instrument_and_play (complex conditional flow)
- [ ] Example: failure case (item disappeared, needs replan)
- [ ] Document each example with explanation

### 7. Design Task File Format
- [ ] Extend or create task schema including refinement methods
- [ ] Specify task file location in mods (`tasks/` folder)
- [ ] Define task manifest integration with mod-manifest.json
- [ ] Design task loading process (similar to action/rule loaders)
- [ ] Specify task validation rules
- [ ] Document task file structure for modders

### 8. Create Implementation Guidance
- [ ] Document refinement execution algorithm (step-by-step)
- [ ] Specify refinement engine architecture (components, flow)
- [ ] Define integration points with existing systems (planner, action executor)
- [ ] Create refinement method authoring guide for modders
- [ ] Document testing strategy for refinement methods
- [ ] Provide debugging/troubleshooting guidance

## Expected Outputs

1. **Refinement Method Schema** (`data/schemas/refinement-method.schema.json`):
   - JSON schema defining refinement method structure
   - Conditional branching format specification
   - Primitive action reference format
   - Parameter binding rules
   - Validation constraints

2. **Task Schema Extension** (`data/schemas/task.schema.json` updated):
   - Task definition including refinement methods
   - Planning preconditions/effects (from existing spec)
   - Structural gates (from existing spec)
   - Planning scope (from existing spec)
   - Refinement methods array

3. **Refinement Specification Document** (`docs/goap/refinement-methods-specification.md`):
   - Complete semantic description of refinement execution
   - Conditional logic evaluation rules
   - Parameter binding and resolution mechanics
   - Failure handling and replanning triggers
   - Method selection algorithm
   - Integration with planner and action executor

4. **Complete Examples** (`docs/goap/refinement-examples.md`):
   - 5+ fully documented refinement method examples
   - Each with: task definition, world state, method logic, resulting primitives
   - Edge cases and failure scenarios
   - Best practices for modders

5. **Implementation Guide** (`docs/goap/implementing-refinement-engine.md`):
   - Architecture overview (components, data flow)
   - Refinement execution algorithm (pseudocode)
   - Integration points with existing systems
   - Testing strategy
   - Debugging and troubleshooting

6. **Modder Authoring Guide** (`docs/modding/authoring-refinement-methods.md`):
   - How to write refinement methods for tasks
   - Common patterns and templates
   - Testing refinement methods
   - Debugging failed refinements

## Success Metrics

- Refinement method format is completely specified with no ambiguities
- Schema is implementable by developers without additional clarification
- Modders can understand how to author refinement methods from documentation
- Format aligns with existing project conventions (action/rule patterns)
- All examples are complete and executable
- Implementation team has clear architecture guidance

## Notes

- Refinement approach is already decided: data-driven HTN-style (spec line 291)
- Must align with modding-first philosophy (no JavaScript hardcoding)
- Should leverage existing json-logic-js for conditional logic
- Should follow scopeDsl patterns for target resolution
- Start simple (sequences + branches) but be HTN-ready for future expansion (spec lines 495-505)
- Examples from spec (lines 73-85, 436-439) should guide design
- Integration with `src/turns/providers/goapDecisionProvider.js` required

## Key Spec References

- **Line 291**: "This refinement is data-driven, in mods, not in JavaScript"
- **Lines 87-93**: Refinement can be HTN-style or code; preference for data-driven
- **Lines 73-85**: Example conditional refinement (if has item → consume, else → acquire + consume)
- **Lines 195**: "method table: planning-task → decomposition into primitives"
- **Lines 348-350**: "GOAP with parametric tasks + data-driven HTN-style refinement"
- **Lines 486-492**: "sequences of primitive actions, maybe with simple branches"
- **Lines 436-439**: Example task refinement (secure_shelter → primitives)
