# Entity Description Regeneration System Analysis

## Executive Summary

The Living Narrative Engine's clothing system successfully removes clothing items via the `UNEQUIP_CLOTHING` operation, but fails to update entity descriptions afterward. This results in stale descriptions where other characters continue to perceive removed clothing as still worn. This report analyzes the current architecture and proposes a `REGENERATE_DESCRIPTION` operation handler to solve this issue by leveraging existing description generation services.

## Problem Analysis

### Current Issue

- **Location**: `data/mods/clothing/rules/handle_remove_clothing.rule.json`
- **Behavior**: Successfully removes clothing using `UNEQUIP_CLOTHING` operation
- **Gap**: Does not update the entity's `core:description` component
- **Impact**: Stale descriptions persist, misleading other characters about the entity's appearance

### Root Cause

The `handle_remove_clothing.rule.json` processes the `clothing:remove_clothing` action by:

1. Getting actor and target names
2. Querying actor position
3. **Unequipping the clothing item** ✅
4. Setting log messages and dispatching events ✅
5. **Missing: Regenerating entity description** ❌

### Evidence from Code Analysis

```json
// Current handle_remove_clothing.rule.json (line 31-37)
{
  "type": "UNEQUIP_CLOTHING",
  "parameters": {
    "entity_ref": "actor",
    "clothing_item_id": "{event.payload.targetId}",
    "cascade_unequip": false,
    "destination": "ground"
  }
}
// No description regeneration follows
```

## Architecture Analysis

### Current System Components

#### 1. Clothing Management Services (`src/clothing/`)

- **`EquipmentDescriptionService`**: Generates equipment descriptions for worn clothing
- **`ClothingManagementService`**: Manages equipping/unequipping operations
- **`EquipmentOrchestrator`**: Coordinates equipment operations
- **Validation services**: Ensure clothing compatibility and slot validation

#### 2. Description Generation System

- **`BodyDescriptionComposer`** (`src/anatomy/bodyDescriptionComposer.js`): Composes full body descriptions including anatomy and equipment
- **`AnatomyFormattingService`** (`src/services/anatomyFormattingService.js`): Provides formatting configuration for descriptions
- **`DescriptorFormatter`**: Formats individual descriptors with proper grammar

#### 3. Operation Handler Architecture

- **Base Pattern**: All handlers extend `BaseOperationHandler` or `ComponentOperationHandler`
- **Location**: `src/logic/operationHandlers/`
- **Dependencies**: EntityManager, logging, event dispatching
- **Execution**: Follow async `execute(params, executionContext)` pattern

#### 4. Entity Component System

- **`core:description`**: Stores entity appearance descriptions
- **`anatomy:body`**: Contains body structure and part information
- **`clothing:equipment`**: Manages equipped clothing items
- **Component updates**: Handled through EntityManager with validation

### Integration Points

#### Current Operation Flow

```
Action: clothing:remove_clothing
  ↓
Event: core:attempt_action
  ↓
Rule: handle_remove_clothing.rule.json
  ↓
Operations:
  1. GET_NAME (actor)
  2. GET_NAME (target)
  3. QUERY_COMPONENT (actor position)
  4. UNEQUIP_CLOTHING ✅
  5. SET_VARIABLE (log message)
  6. SET_VARIABLE (perception type)
  7. SET_VARIABLE (location ID)
  8. SET_VARIABLE (target ID)
  9. MACRO: core:logSuccessAndEndTurn
```

#### Missing Integration

No operation exists to regenerate the `core:description` component after clothing changes.

## Proposed Solution

### New Operation Handler: `REGENERATE_DESCRIPTION`

#### Design Specification

**Handler Location**: `src/logic/operationHandlers/regenerateDescriptionHandler.js`

**Operation Type**: `REGENERATE_DESCRIPTION`

**Purpose**: Regenerate an entity's `core:description` component using current anatomy and equipment state

**Dependencies**:

- `EntityManager`: Entity data access and component updates
- `BodyDescriptionComposer`: Full body description generation
- `Logger`: Operation logging and debugging
- `ISafeEventDispatcher`: Error handling and event dispatch

#### Parameter Schema

```json
{
  "type": "REGENERATE_DESCRIPTION",
  "parameters": {
    "entity_ref": "actor" | "target" | string | EntityRefObject
  }
}
```

#### Handler Implementation Pattern

```javascript
class RegenerateDescriptionHandler extends ComponentOperationHandler {
  #entityManager;
  #bodyDescriptionComposer;
  #dispatcher;

  constructor({
    entityManager,
    bodyDescriptionComposer,
    logger,
    safeEventDispatcher,
  }) {
    super('RegenerateDescriptionHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent', 'hasComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      bodyDescriptionComposer: {
        value: bodyDescriptionComposer,
        requiredMethods: ['composeDescription'],
      },
    });
    this.#entityManager = entityManager;
    this.#bodyDescriptionComposer = bodyDescriptionComposer;
    this.#dispatcher = safeEventDispatcher;
  }

  async execute(params, executionContext) {
    // 1. Validate parameters
    // 2. Resolve entity reference to entity ID
    // 3. Get entity instance from EntityManager
    // 4. Generate new description using BodyDescriptionComposer
    // 5. Update core:description component
    // 6. Handle errors gracefully
  }
}
```

#### Execution Flow

1. **Parameter Validation**: Ensure `entity_ref` is valid reference type using `assertParamsObject`
2. **Entity Resolution**: Convert entity_ref to actual entity ID using execution context entity resolution
3. **Entity Retrieval**: Get entity instance from EntityManager using resolved entity ID
4. **Description Generation**: Call `await this.#bodyDescriptionComposer.composeDescription(entity)` with entity instance
5. **Component Update**: Update `core:description` component with `{ text: newDescription }` structure
6. **Error Handling**: Use `safeDispatchError` for critical failures, log warnings for graceful degradation

#### Error Handling Strategy

- **Missing Entity**: Return early from `validateEntityAndType()` following `ComponentOperationHandler` pattern
- **No anatomy:body Component**: Call `composeDescription()` and let it return empty string gracefully
- **Description Generation Failure**: Catch exception, log error, preserve existing description
- **Component Update Failure**: Use try-catch around `addComponent()`, call `safeDispatchError()` on failure
- **Parameter Validation**: Use `assertParamsObject()` pattern, return early on validation failure

## Implementation Plan

### Phase 1: Schema Definition

**File**: `data/schemas/operations/regenerateDescription.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/regenerateDescription.schema.json",
  "title": "REGENERATE_DESCRIPTION Operation",
  "allOf": [
    {
      "$ref": "../base-operation.schema.json"
    },
    {
      "properties": {
        "type": {
          "const": "REGENERATE_DESCRIPTION"
        },
        "parameters": {
          "$ref": "#/$defs/Parameters"
        }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "description": "Parameters for the REGENERATE_DESCRIPTION operation, which updates entity descriptions",
      "properties": {
        "entity_ref": {
          "$ref": "../common.schema.json#/definitions/entityReference",
          "description": "Required. The entity to regenerate description for."
        }
      },
      "required": ["entity_ref"],
      "additionalProperties": false
    }
  }
}
```

**Update**: `data/schemas/operation.schema.json` (after line 138, before the final closing bracket at line 141)

```json
,
{
  "$ref": "./operations/regenerateDescription.schema.json"
}
```

### Phase 2: Operation Handler Implementation

**File**: `src/logic/operationHandlers/regenerateDescriptionHandler.js`

**Key Implementation Details**:

- Extend `ComponentOperationHandler` with proper dependency validation structure
- Use `assertParamsObject` for parameter validation following `unequipClothingHandler.js` pattern
- Import required utilities: `assertParamsObject` from `../../utils/handlerUtils/paramsUtils.js`
- Use `safeDispatchError` from `../../utils/safeDispatchErrorUtils.js` for error handling
- Call entity resolution using execution context patterns from existing handlers
- Update component using `await this.#entityManager.addComponent(entityId, 'core:description', { text: newDescription })`
- Use entity resolution pattern: `this.validateEntityAndType()` from `ComponentOperationHandler`

### Phase 3: Dependency Injection Registration

**File**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

**Import Addition**:

```javascript
import RegenerateDescriptionHandler from '../../logic/operationHandlers/regenerateDescriptionHandler.js';
```

**Handler Registration**:

```javascript
[
  tokens.RegenerateDescriptionHandler,
  RegenerateDescriptionHandler,
  (c, Handler) =>
    new Handler({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      bodyDescriptionComposer: c.resolve(tokens.BodyDescriptionComposer),
    }),
],
```

**Token Addition**: `src/dependencyInjection/tokens/tokens-core.js`

```javascript
RegenerateDescriptionHandler: 'RegenerateDescriptionHandler',
```

### Phase 4: Rule Integration

**File**: `data/mods/clothing/rules/handle_remove_clothing.rule.json`
**Modification**: Add new operation after `UNEQUIP_CLOTHING`

```json
{
  "type": "UNEQUIP_CLOTHING",
  "parameters": {
    "entity_ref": "actor",
    "clothing_item_id": "{event.payload.targetId}",
    "cascade_unequip": false,
    "destination": "ground"
  }
},
{
  "type": "REGENERATE_DESCRIPTION",
  "parameters": {
    "entity_ref": "actor"
  }
}
```

## Testing Strategy

### Unit Tests

**Location**: `tests/unit/logic/operationHandlers/regenerateDescriptionHandler.test.js`

**Test Cases**:

1. **Valid execution**: Entity with anatomy:body component
2. **Entity resolution**: Various entity_ref formats (actor, target, ID, object)
3. **Missing entity**: Non-existent entity ID
4. **No anatomy component**: Entity without anatomy:body
5. **Description generation failure**: BodyDescriptionComposer errors
6. **Component update failure**: EntityManager update errors
7. **Parameter validation**: Invalid parameters and edge cases

### Integration Tests

**Location**: `tests/integration/clothing/clothingDescriptionIntegration.test.js`

**Scenarios**:

1. **Full clothing removal workflow**: Remove item → verify description update
2. **Multiple items removal**: Remove several items → verify combined description
3. **Mixed operations**: Clothing operations with other entity modifications
4. **Rule execution**: Full rule processing with new operation

### End-to-End Tests

**Location**: `tests/e2e/actions/clothingActions.e2e.test.js`

**User Stories**:

1. **Player removes clothing**: Action execution → other characters see updated description
2. **NPC clothing changes**: Automated clothing changes → player sees updates
3. **Complex scenarios**: Multiple characters changing clothing simultaneously

## Risk Assessment and Mitigation

### Technical Risks

#### Risk 1: Performance Impact

**Description**: Description generation is computationally expensive
**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:

- Implement async execution to prevent blocking
- Consider caching strategies for repeated generations
- Monitor performance in testing

#### Risk 2: Description Generation Failures

**Description**: BodyDescriptionComposer might fail or return empty descriptions
**Likelihood**: Low
**Impact**: Medium
**Mitigation**:

- Implement fallback to preserve existing descriptions
- Comprehensive error logging for debugging
- Graceful degradation without breaking action flow

#### Risk 3: Dependency Availability

**Description**: Required services might not be available in all contexts
**Likelihood**: Low
**Impact**: High
**Mitigation**:

- Robust dependency validation in constructor
- Clear error messages for missing dependencies
- Optional dependency handling where appropriate

### Integration Risks

#### Risk 1: Rule Processing Interruption

**Description**: New operation might break existing rule execution
**Likelihood**: Low
**Impact**: High
**Mitigation**:

- Non-critical operation design (continues on failure)
- Comprehensive integration testing
- Backward compatibility verification

#### Risk 2: Schema Validation Issues

**Description**: New operation schema might conflict with existing validation
**Likelihood**: Low
**Impact**: Medium
**Mitigation**:

- Follow existing schema patterns exactly
- Validate schema changes against existing content
- Test schema loading and validation processes

## Success Metrics

### Functional Requirements

- [ ] Entity descriptions update correctly after clothing removal
- [ ] No performance degradation in clothing operations
- [ ] Graceful handling of edge cases (missing components, etc.)
- [ ] Full backward compatibility with existing actions

### Quality Requirements

- [ ] 95%+ unit test coverage for new handler
- [ ] All integration tests pass
- [ ] No regressions in existing clothing functionality
- [ ] Clear error messages and logging

### Documentation Requirements

- [ ] Operation handler follows project code conventions
- [ ] Schema properly documents parameters and validation
- [ ] Integration examples provided for mod creators
- [ ] Error handling patterns documented

## Future Considerations

### Extensibility Opportunities

1. **Generic Description Updates**: Extend beyond clothing to other appearance changes
2. **Batch Operations**: Update multiple entities efficiently
3. **Conditional Updates**: Only update if description actually changed
4. **Event Notifications**: Notify other systems of description changes

### Performance Optimizations

1. **Description Caching**: Cache generated descriptions temporarily
2. **Incremental Updates**: Only regenerate changed description parts
3. **Lazy Loading**: Generate descriptions only when needed by other characters
4. **Background Processing**: Async description updates for non-critical scenarios

## Conclusion

The proposed `REGENERATE_DESCRIPTION` operation handler addresses the critical gap in the clothing system by ensuring entity descriptions remain accurate after clothing changes. The solution leverages existing infrastructure, follows established patterns, and provides robust error handling. Implementation requires careful testing but poses minimal risk to existing functionality.

The design is extensible for future enhancements while maintaining backward compatibility and performance standards. Success depends on thorough testing and proper integration with the existing rule system.

## Report Corrections (Aug 25, 2025)

### Architectural Assumptions Updated

The following assumptions in the original report were corrected based on current production code analysis:

#### 1. **Schema Structure Pattern**

- **Original**: Assumed direct schema structure without inheritance
- **Corrected**: Uses `allOf` pattern with `base-operation.schema.json` inheritance and `$defs` structure matching `unequipClothing.schema.json`

#### 2. **Handler Inheritance**

- **Original**: Suggested extending `BaseOperationHandler`
- **Corrected**: Must extend `ComponentOperationHandler` with proper dependency validation structure

#### 3. **Dependency Injection**

- **Original**: Generic dependency injection description
- **Corrected**: Specific token usage (`ISafeEventDispatcher`, `BodyDescriptionComposer`) and registration patterns matching `operationHandlerRegistrations.js`

#### 4. **Service Integration**

- **Original**: Assumed `SafeEventDispatcher` service
- **Corrected**: Uses `ISafeEventDispatcher` interface with `safeDispatchError` utility function

#### 5. **Component Update Pattern**

- **Original**: Generic component update description
- **Corrected**: Specific `await this.#entityManager.addComponent(entityId, 'core:description', { text: newDescription })` pattern with proper error handling

#### 6. **Parameter Validation**

- **Original**: Generic parameter validation
- **Corrected**: Uses `assertParamsObject` from `../../utils/handlerUtils/paramsUtils.js` and entity resolution via `this.validateEntityAndType()`

All corrections ensure the implementation guidance accurately reflects the current Living Narrative Engine architecture and coding patterns.

---

_Report generated for Living Narrative Engine clothing system enhancement_
_Analysis covers architecture review, solution design, and implementation planning_
_Updated: August 25, 2025 - Corrected architectural assumptions based on production code analysis_
