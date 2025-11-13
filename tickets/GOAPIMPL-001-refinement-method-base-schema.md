# GOAPIMPL-001: Design Refinement Method Base Schema Structure

**Status**: Ready
**Priority**: CRITICAL
**Estimated Effort**: 2-3 days
**Dependencies**: None
**Blocks**: GOAPIMPL-002, GOAPIMPL-003, GOAPIMPL-004
**Parent**: GOAPSPECANA-001

## Problem Statement

The refinement method schema is the foundational format that defines how planning-tasks decompose into sequences of primitive actions. This schema must support:

1. Sequential step execution (ordered action sequences)
2. Multiple methods per task (for different world states)
3. Clear parameter passing from task to primitives
4. Integration with existing mod structure (actions, rules, scopes)
5. HTN-ready design for future expansion (spec lines 495-505)

Without a solid base schema, none of the other refinement components (conditionals, action references, parameter binding) can be properly designed.

## Objective

Design and implement the base JSON schema for refinement methods that defines the fundamental structure while remaining extensible for conditional logic and complex workflows.

## Acceptance Criteria

- [ ] Base refinement method schema created at `data/schemas/refinement-method.schema.json`
- [ ] Schema defines sequential step structure
- [ ] Schema supports multiple methods per task
- [ ] Schema includes metadata fields (id, description, applicability_conditions)
- [ ] Schema allows for future conditional branching extension
- [ ] Schema follows existing project conventions (similar to action/rule schemas)
- [ ] Schema includes comprehensive JSDoc-style comments
- [ ] Schema validates successfully with AJV (via npm run validate)
- [ ] Simple example refinement method validates successfully

## Design Requirements

### Core Structure

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/refinement-method.schema.json",
  "id": "modId:task_id.method_name",
  "taskId": "modId:task_id",
  "description": "Human-readable description of when and how this method applies",

  "applicability": {
    "description": "When this method should be selected",
    "condition": {
      "$ref": "./condition-container.schema.json#"
    }
  },

  "steps": [
    {
      "stepType": "primitive_action",
      "actionId": "modId:action_id",
      "targetBindings": { },
      "parameters": { }
    }
  ],

  "fallbackBehavior": "replan | fail | continue"
}
```

### Key Design Decisions

1. **ID Format**: `modId:task_id.method_name` (namespaced, unique per method)
2. **Step Types**: Initially support `primitive_action` only; extensible to `conditional`, `parallel`, `subtask` later
3. **Applicability**: JSON Logic expression (via condition-container.schema.json) evaluated before method selection
4. **Fallback**: Define what happens when method cannot complete

## Tasks

### 1. Analyze Existing Schema Patterns ✅ VALIDATED

**Current Schema Organization** (verified against `/data/schemas/`):
- [ ] Review `data/schemas/action.schema.json` structure
  - Uses `$schema: "http://json-schema.org/draft-07/schema#"`
  - Uses `$id: "schema://living-narrative-engine/action.schema.json"`
  - Has `id` field that references `common.schema.json#/definitions/BaseDefinition/properties/id`
  - Has `description` field from common definitions
  - Supports both legacy single-target and multi-target formats
  - Uses `$ref` for cross-schema references

- [ ] Review `data/schemas/rule.schema.json` structure
  - Uses same schema metadata pattern
  - Has `rule_id` (optional but recommended)
  - Has `event_type` using `namespacedId` reference
  - Has `condition` using `condition-container.schema.json#` reference
  - Has `actions` array referencing `operation.schema.json#/$defs/Action`
  - Simple, focused structure

- [ ] Review `data/schemas/component.schema.json` structure
  - Uses same metadata pattern
  - Has `dataSchema` object for component data structure
  - Includes `validationRules` for validator generation

- [ ] Review `data/schemas/common.schema.json` patterns
  - Defines `BaseDefinition` with `$schema`, `id`, `description`
  - Defines `namespacedId` pattern: `^[a-zA-Z0-9_:-]+$`
  - Provides reusable definitions for cross-schema consistency

- [ ] Review `data/schemas/goal.schema.json` (existing GOAP schema)
  - Uses standard metadata pattern
  - Has `priority` (numeric, minimum 0)
  - Has `relevance` condition (via condition-container.schema.json)
  - Has `goalState` condition (via condition-container.schema.json)
  - **NOTE**: This schema exists from previous GOAP implementation and may need updates

- [ ] Identify json-logic-js integration patterns
  - JSON Logic integrated via `condition-container.schema.json#` reference
  - `json-logic.schema.json` defines logical operators (and, or, not)
  - Supports nested condition references and rule composition

**Key Findings**:
- All schemas use JSON Schema Draft 07
- Schema IDs follow pattern: `schema://living-narrative-engine/<schema-name>.schema.json`
- Content IDs use `namespacedId` pattern from common.schema.json
- JSON Logic integrated through condition-container.schema.json references
- Reusable definitions live in common.schema.json for cross-schema consistency

### 2. Define Base Schema Structure

- [ ] Create `data/schemas/refinement-method.schema.json` file
- [ ] Define schema metadata following existing pattern:
  - `$schema`: `"http://json-schema.org/draft-07/schema#"`
  - `$id`: `"schema://living-narrative-engine/refinement-method.schema.json"`
  - `title`: `"Refinement Method Schema"`
  - `description`: JSDoc-style documentation

- [ ] Define root object structure:
  - `id`: Reference `./common.schema.json#/definitions/namespacedId`
  - `taskId`: Reference `./common.schema.json#/definitions/namespacedId`
  - `description`: String field with documentation
  - `applicability`: Object with condition reference
  - `steps`: Array of step objects
  - `fallbackBehavior`: Enum string

- [ ] Create step union type using `oneOf` or discriminator pattern
  - Initially only `primitive_action` type
  - Design for extensibility (add `conditional`, `parallel`, `subtask` later)

- [ ] Define validation rules:
  - Required fields: `["id", "taskId", "description", "steps"]`
  - ID format validation via namespacedId pattern
  - `additionalProperties: false` for strict validation

### 3. Design Applicability Conditions

- [ ] Define applicability object schema:
  ```json
  "applicability": {
    "type": "object",
    "description": "Defines when this refinement method should be selected",
    "properties": {
      "description": {
        "type": "string",
        "description": "Human-readable explanation of applicability conditions"
      },
      "condition": {
        "$ref": "./condition-container.schema.json#"
      }
    },
    "additionalProperties": false
  }
  ```

- [ ] Document available context for condition evaluation:
  - Actor state (via entity components)
  - World state (via component queries)
  - Task parameters (bound targets from planning scope)
  - Knowledge-limited facts (via `core:known_to` component)

- [ ] Create examples of common applicability patterns:
  - "Item in inventory": Check for specific component on actor
  - "Item visible in world": Check for `core:visible` and location
  - "Actor in specific state": Check posture, status conditions

- [ ] Define default behavior when applicability is omitted:
  - If omitted or null, method is always applicable
  - Document this clearly in schema description

### 4. Design Fallback Behavior

- [ ] Define fallback behavior enum:
  ```json
  "fallbackBehavior": {
    "type": "string",
    "enum": ["replan", "fail", "continue"],
    "default": "replan",
    "description": "Action to take if refinement fails"
  }
  ```

- [ ] Document semantics of each fallback option:
  - **`replan`**: Invalidate current plan, ask GOAP to replan from current state (recommended default)
  - **`fail`**: Abort the current goal entirely, choose a new goal
  - **`continue`**: Skip this task and proceed to next task in plan (use with caution)

- [ ] Define default fallback behavior:
  - Default: `"replan"` (safest and most flexible)

- [ ] Document when each fallback type should be used:
  - **Use `replan`**: When world state changed unexpectedly (item moved, eaten by other actor)
  - **Use `fail`**: When goal is fundamentally impossible (no food exists anywhere)
  - **Use `continue`**: When task is optional in plan sequence (rare)

### 5. Design Step Type System

- [ ] Create base step schema with discriminator:
  ```json
  "stepDefinition": {
    "oneOf": [
      { "$ref": "#/$defs/PrimitiveActionStep" }
    ]
  }
  ```

- [ ] Define `PrimitiveActionStep` schema:
  ```json
  "PrimitiveActionStep": {
    "type": "object",
    "description": "References a primitive action to execute",
    "properties": {
      "stepType": {
        "const": "primitive_action"
      },
      "actionId": {
        "$ref": "./common.schema.json#/definitions/namespacedId",
        "description": "Reference to primitive action (e.g., 'items:pick_up_item')"
      },
      "targetBindings": {
        "type": "object",
        "description": "Maps action target placeholders to entities",
        "additionalProperties": { "type": "string" }
      },
      "parameters": {
        "type": "object",
        "description": "Additional parameters for action execution",
        "additionalProperties": true
      }
    },
    "required": ["stepType", "actionId"],
    "additionalProperties": false
  }
  ```

- [ ] Document step execution semantics:
  - Steps execute sequentially in array order
  - Each step must complete before next step begins
  - Step failure triggers fallbackBehavior

- [ ] Design for future extensibility:
  - Add `ConditionalStep` type later (if/then/else branches)
  - Add `ParallelStep` type later (concurrent primitive actions)
  - Add `SubtaskStep` type later (nested planning-task reference)
  - Keep `oneOf` array in stepDefinition for easy extension

### 6. Create Validation Rules

**Integration with Existing Validation Infrastructure** (verified):
- Validation handled by `src/validation/ajvSchemaValidator.js`
- Uses Ajv library with format support (`ajv-formats`)
- Schemas loaded via `schemaLoader.js` in mod loading pipeline
- Cross-reference validation possible via AJV's `loadSchema` function

- [ ] Add format validation for IDs:
  - Use `namespacedId` pattern from common.schema.json
  - Pattern: `^[a-zA-Z0-9_:-]+$`
  - Format: `modId:task_id.method_name` for refinement method IDs

- [ ] Add cross-reference validation (via schema $ref):
  - `taskId` must reference valid task definition (future: when task schema exists)
  - `actionId` must reference valid primitive action (can validate against action registry)
  - Note: Cross-registry validation may need custom validator in future

- [ ] Add parameter validation:
  - `targetBindings` should map valid placeholder names to entity references
  - `parameters` object should be extensible (no strict schema yet)
  - Future: validate parameters match action schema requirements

- [ ] Add required field validation:
  - Root: `["id", "taskId", "description", "steps"]`
  - Step: `["stepType", "actionId"]`
  - Applicability: `["condition"]` (if applicability object present)

- [ ] Test validation:
  - Run `npm run validate` after schema creation
  - Run `npm run validate:strict` for comprehensive validation
  - Verify AJV compiles schema without errors

### 7. Create Simple Example

**Example Storage Location** (adjusted from original):
- Original plan: `docs/goap/examples/refinement-method-simple.json`
- **Current Reality**: No `docs/goap/` directory exists yet
- **Recommendation**: Create example in temporary location first, move to docs/ when directory structure is created

- [ ] Create example refinement method for `task:consume_nourishing_item`:
  ```json
  {
    "$schema": "schema://living-narrative-engine/refinement-method.schema.json",
    "id": "core:consume_nourishing_item.simple_consume",
    "taskId": "core:consume_nourishing_item",
    "description": "Simple refinement for consuming food item already in inventory",

    "applicability": {
      "description": "Actor has nourishing item in inventory",
      "condition": {
        "hasComponent": {
          "entity": "target",
          "componentType": "items:nourishing"
        }
      }
    },

    "steps": [
      {
        "stepType": "primitive_action",
        "actionId": "items:consume_item",
        "targetBindings": {
          "item": "target"
        }
      }
    ],

    "fallbackBehavior": "replan"
  }
  ```

- [ ] Create example with single sequential step (no conditionals yet)
- [ ] Validate example against schema using AJV
- [ ] Document example with inline comments explaining each field
- [ ] Place example in temporary location first:
  - Suggestion: `data/examples/refinement-method-simple.json`
  - Or: Root level `examples/refinement-method-simple.json`
  - Move to `docs/goap/examples/` when docs structure created

### 8. Integration with Mod Structure

**Current Mod Structure** (verified against `/data/mods/core/`):
- Existing directories: `actions/`, `components/`, `conditions/`, `events/`, `goals/`, `macros/`, `rules/`, `scopes/`
- **No `tasks/` or `refinement-methods/` directories exist yet**
- Pattern: Each content type has dedicated directory
- Manifest pattern: `mod-manifest.json` lists files under `content.<type>`

**Loading Infrastructure** (verified against `/src/loaders/`):
- Existing loaders: `actionLoader.js`, `goalLoader.js`, `ruleLoader.js`, `componentLoader.js`, etc.
- Base class: `SimpleItemLoader` (extends `BaseManifestItemLoader`)
- Pattern: Each loader handles one content type from manifest
- **No task loader or refinement method loader exists yet**

- [ ] Define where refinement methods live in mods:
  - **Decision Required**: `tasks/` or `refinement-methods/` directory?
  - **Recommendation**: Use `refinement-methods/` for clarity (separate from planning-tasks)
  - Location: `data/mods/<modId>/refinement-methods/`

- [ ] Document file naming convention:
  - Pattern: `<task_name>.<method_name>.refinement.json`
  - Example: `consume_nourishing_item.simple_consume.refinement.json`
  - Alternative: `<task_name>.method.<method_name>.json`

- [ ] Define integration with mod-manifest.json:
  - Add new manifest section: `"content.refinementMethods": [...]`
  - Example:
    ```json
    "content": {
      "refinementMethods": [
        "consume_nourishing_item.simple_consume.refinement.json",
        "consume_nourishing_item.acquire_then_consume.refinement.json"
      ]
    }
    ```

- [ ] Document loading order considerations:
  - Refinement methods should load AFTER primitive actions (dependency)
  - Refinement methods should load AFTER tasks (dependency - when tasks exist)
  - Refinement methods should load BEFORE planning system initialization
  - Update `ContentLoadManager.js` to include refinement method loading phase

- [ ] **Future Work**: Create `RefinementMethodLoader.js`
  - Extend `SimpleItemLoader` (like `GoalLoader` does)
  - Handle schema validation via `schemaValidator`
  - Register in data registry under `"refinementMethods"` category
  - Integrate with `ContentLoadManager` loading phases

### 9. Documentation

- [ ] Create schema documentation in JSDoc-style comments:
  - Document each field with `"description"` in schema
  - Include examples in descriptions where helpful
  - Document constraints and validation rules

- [ ] Document field-by-field:
  - **`id`**: Unique identifier for this refinement method (format: modId:taskId.methodName)
  - **`taskId`**: Reference to the planning-task this method refines
  - **`description`**: Human-readable explanation for modders
  - **`applicability`**: When this method should be selected (optional, default: always applicable)
  - **`steps`**: Sequential array of steps to execute
  - **`fallbackBehavior`**: What to do if refinement fails (default: replan)

- [ ] Create schema changelog for versioning:
  - Version 1.0.0: Initial base schema
  - Format: Keep changelog in schema file as `$comment` or separate CHANGELOG.md

- [ ] Document schema extension points:
  - Step types extensible via `oneOf` discriminator
  - Future step types: `conditional`, `parallel`, `subtask`
  - Applicability conditions extensible via condition-container.schema.json
  - Parameters object extensible for future needs

- [ ] Create schema design rationale document:
  - Section in refinement specification doc (GOAPIMPL-006)
  - Explain key design decisions (ID format, step types, fallback behavior)
  - Justify chosen patterns (why `oneOf`, why condition-container reference)

## Expected Outputs

1. **Schema File**: `data/schemas/refinement-method.schema.json`
   - Complete JSON schema with validation rules
   - Comprehensive JSDoc-style documentation in `"description"` fields
   - Extension points for future features
   - Follows existing project conventions

2. **Simple Example**: `data/examples/refinement-method-simple.json` (temporary location)
   - Complete working example for `task:consume_nourishing_item`
   - Inline documentation via comments (if JSON5 used) or separate README
   - Validates successfully against schema
   - Will move to `docs/goap/examples/` when directory structure created

3. **Schema Documentation**: Section in refinement specification doc (GOAPIMPL-006)
   - Field-by-field explanation
   - Design rationale
   - Extension guidelines
   - Integration instructions

## Success Metrics

- Schema validates successfully with AJV (`npm run validate` passes)
- Simple example method validates against schema
- Schema structure is comprehensible to modders (clear descriptions, logical organization)
- Schema follows existing project patterns (consistent with action/rule/component schemas)
- Schema is extensible for future features (conditionals, parallel execution, subtasks)
- All required validation rules are enforced by AJV
- Schema integrates with existing validation infrastructure (ajvSchemaValidator.js)

## Notes

### Schema Design Principles
- Keep schema simple initially; extensibility is more important than completeness
- Follow existing naming conventions: camelCase for schema fields (verified against existing schemas)
- Use json-logic-js for all conditional expressions via condition-container.schema.json (consistency)
- Ensure schema can be loaded by existing validation infrastructure (ajvSchemaValidator.js)
- Consider future HTN expansion: schema should allow `subtask` step type

### Current Codebase Context
- **Validation Infrastructure**: Uses `ajvSchemaValidator.js` with Ajv library
- **Schema Pattern**: All schemas follow JSON Schema Draft 07 with `schema://living-narrative-engine/` URIs
- **JSON Logic Integration**: Via `condition-container.schema.json` reference (not direct json-logic.schema.json)
- **Common Definitions**: Reusable patterns in `common.schema.json` (namespacedId, entityReference, etc.)
- **Goal Schema Exists**: `goal.schema.json` is a holdout from previous GOAP implementation
- **No Task Schema Yet**: Task schema will be defined in separate ticket (GOAPIMPL-005)
- **No Loader Yet**: `RefinementMethodLoader.js` will be created in future ticket after schema is stable

### Future Work (Out of Scope for This Ticket)
- Creating `RefinementMethodLoader.js` class
- Updating `ContentLoadManager.js` to load refinement methods
- Creating `task.schema.json` for planning-task definitions
- Creating `docs/goap/` directory structure
- Cross-reference validation between tasks and refinement methods
- Parameter validation matching action schema requirements

### Potential Issues to Address
1. **Goal Schema Status**: Existing `goal.schema.json` may need updates for new GOAP system (separate ticket)
2. **Task Schema Dependency**: Refinement methods reference tasks, but task schema doesn't exist yet
3. **Cross-Registry Validation**: Validating actionId references against action registry may need custom validator
4. **Directory Structure**: Need to decide between `tasks/` vs `refinement-methods/` directory name
5. **docs/goap/ Missing**: Example storage location needs adjustment until docs directory created

## Key Spec References

- **Lines 87-93**: Refinement can be HTN-style or code; preference for data-driven
- **Line 291**: "This refinement is data-driven, in mods, not in JavaScript"
- **Lines 486-492**: "sequences of primitive actions, maybe with simple branches"
- **Lines 495-505**: Design HTN-ready format for future expansion
- **Lines 73-85**: Example conditional refinement (guides applicability design)
- **Lines 108-109**: Tasks loaded via mods in 'tasks/' folder (structural guidance)
- **Lines 131-141**: Structural gates and knowledge-limited scopes (context for applicability conditions)

## Validation Checklist

Before marking this ticket complete, verify:

- [ ] Schema file created at correct location with correct naming
- [ ] Schema uses JSON Schema Draft 07 (`$schema` field correct)
- [ ] Schema ID follows URI pattern: `schema://living-narrative-engine/refinement-method.schema.json`
- [ ] All fields have clear `"description"` documentation
- [ ] References to common.schema.json use correct paths (`./common.schema.json#/definitions/...`)
- [ ] Reference to condition-container.schema.json uses correct path
- [ ] `namespacedId` pattern used for all ID fields
- [ ] `additionalProperties: false` set where appropriate for strict validation
- [ ] Required fields arrays are correct and complete
- [ ] Step type discriminator uses `oneOf` or similar extensible pattern
- [ ] Example validates successfully: `npm run validate` passes
- [ ] Example file has clear documentation explaining each field
- [ ] Schema design rationale documented (inline or separate doc)
