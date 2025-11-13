# GOAPSPECANA-002: Task Schema Specification

**Status**: Not Started
**Priority**: CRITICAL
**Estimated Effort**: 2 days
**Dependencies**: GOAPSPECANA-001
**Blocks**: GOAPSPECANA-007, GOAPSPECANA-010

## Problem Statement

The specification shows task structure fragments (lines 111-136) but never provides a complete JSON schema. Critical elements are mentioned but not fully specified:
- Parameter definitions incomplete
- Structural gates format unclear
- Planning preconditions/effects partially shown
- Refinement specification missing (depends on GOAPSPECANA-001)

## Objective

Create complete, validated JSON schema for planning tasks that can be loaded via mods.

## Acceptance Criteria

- [ ] Complete `data/schemas/task.schema.json` created
- [ ] Schema validates against JSON Schema Draft 7
- [ ] All fields documented with descriptions
- [ ] Required vs optional fields clearly marked
- [ ] Validation rules specified (formats, patterns, ranges)
- [ ] Example task file validates successfully
- [ ] Schema integrated into validation system
- [ ] Documentation updated with task authoring guide

## Tasks

### 1. Schema Structure Definition
- [ ] Define top-level schema properties:
  - `id` (required, format: `modId:taskId`)
  - `version` (required, semver format)
  - `name` (required, human-readable)
  - `description` (optional, documentation)
  - `parameters` (required, object)
  - `structural_gates` (optional, object)
  - `planning_preconditions` (required, JSON Logic)
  - `planning_effects` (required, array of effects)
  - `refinement` (depends on GOAPSPECANA-001)

### 2. Parameters Schema
- [ ] Define parameter structure:
  ```json
  {
    "parameters": {
      "item": {
        "scope": "items:known_nourishing_items_anywhere",
        "type": "entity_id",
        "required": true,
        "description": "Target item to consume"
      }
    }
  }
  ```
- [ ] Specify allowed parameter types (entity_id, location_id, number, boolean)
- [ ] Define scope reference format
- [ ] Add validation for scope existence

### 3. Structural Gates Schema
- [ ] Define gate structure based on lines 131-132:
  ```json
  {
    "structural_gates": {
      "requires_components": ["biology:can_eat"],
      "knowledge_check": {
        "must_know_entities_matching": "items:nourishing_items"
      },
      "actor_must_not_have": ["core:immobilized"]
    }
  }
  ```
- [ ] Specify all supported gate types
- [ ] Add validation for component references

### 4. Planning Preconditions Schema
- [ ] Define JSON Logic precondition structure
- [ ] Specify allowed operations (based on existing JSON Logic operators)
- [ ] Add examples of common preconditions:
  - Actor state checks (hunger > threshold)
  - Entity availability (item exists and reachable)
  - Permission checks (can interact with target)

### 5. Planning Effects Schema
- [ ] Define effect structure based on lines 120-129:
  ```json
  {
    "planning_effects": [
      {
        "op": "decrease",
        "path": "actor.state.hunger",
        "amount": {"var": "item.components.food:nutrition_value"}
      },
      {
        "op": "add_component",
        "target": "actor",
        "component": "core:well_fed",
        "data": {"duration_turns": 10}
      }
    ]
  }
  ```
- [ ] Specify all supported operations (increase, decrease, set, add_component, remove_component)
- [ ] Define path resolution rules
- [ ] Add validation for operation parameters

### 6. Refinement Schema (Depends on GOAPSPECANA-001)
- [ ] If HTN chosen: Define HTN method structure
- [ ] If code-based: Define refinement strategy reference
- [ ] Add validation for refinement configuration

### 7. Create Example Task Files
- [ ] Create `consume_nourishing_item.task.json` (complete example)
- [ ] Create `heal_self.task.json` (second example)
- [ ] Validate examples against schema
- [ ] Add examples to specification

### 8. Integration with Loading System
- [ ] Create task loader (similar to existing loaders in `src/loaders/`)
- [ ] Add task schema to validation system
- [ ] Test loading tasks from mods
- [ ] Add error messages for validation failures

## Expected Outputs

1. **Schema File**: `data/schemas/task.schema.json`
   - Complete, validated JSON Schema
   - All fields documented
   - Validation rules specified

2. **Example Tasks**:
   - `data/mods/core/tasks/consume_nourishing_item.task.json`
   - `data/mods/core/tasks/heal_self.task.json`

3. **Task Loader**: `src/loaders/taskLoader.js`
   - Loads tasks from mod directories
   - Validates against schema
   - Integrates with mod loading system

4. **Documentation**: `docs/goap/task-authoring-guide.md`
   - How to create tasks
   - Schema field explanations
   - Common patterns and examples
   - Validation troubleshooting

5. **Updated Specification** (lines 111-136 expanded):
   - Link to complete schema
   - Reference to example files
   - Authoring guide reference

## Success Metrics

- Task schema validates successfully with AJV
- Example tasks load without errors
- All fields have clear descriptions
- Required vs optional clearly marked
- Integration tests pass for task loading
- Modder authoring guide is complete and clear

## Notes

- Schema must align with existing component/action schema patterns
- Use same validation patterns as other content types
- Ensure task IDs follow `modId:identifier` convention
- Add to `data/schemas/` alongside existing schemas
- Task loader should follow patterns from `actionLoader.js`, `ruleLoader.js`
