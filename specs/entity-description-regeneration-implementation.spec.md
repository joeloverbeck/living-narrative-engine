# Entity Description Regeneration - Technical Specification

## Implementation Status

**Status**: NOT IMPLEMENTED  
**Type**: ENHANCEMENT TO EXISTING FEATURE  
**Priority**: HIGH  
**Current Production State**:

- Clothing system successfully removes items via `UNEQUIP_CLOTHING` operation
- Entity descriptions remain stale after clothing changes
- `BodyDescriptionComposer` service exists and functions correctly
- No operation handler exists for description regeneration
- Integration point identified in `handle_remove_clothing.rule.json`

This specification describes adding description regeneration capability to the existing clothing system.

## 1. Feature Overview

### 1.1 Problem Statement

The Living Narrative Engine's clothing system successfully removes clothing items but fails to update entity descriptions afterward. This results in stale descriptions where other characters continue to perceive removed clothing as still worn.

**Current Behavior**:

- Player removes clothing → Item successfully unequipped ✅
- Entity description remains unchanged → Other characters see stale appearance ❌

**Expected Behavior**:

- Player removes clothing → Item successfully unequipped ✅
- Entity description automatically updated → Other characters see current appearance ✅

### 1.2 Root Cause Analysis

**Location**: `data/mods/clothing/rules/handle_remove_clothing.rule.json`

The rule processes `clothing:remove_clothing` actions by:

1. Getting actor and target names ✅
2. Querying actor position ✅
3. Unequipping the clothing item ✅
4. Setting log messages and dispatching events ✅
5. **Missing: Regenerating entity description** ❌

### 1.3 Solution Overview

Implement a new `REGENERATE_DESCRIPTION` operation handler that:

- Leverages existing `BodyDescriptionComposer` service
- Updates the `core:description` component with current appearance
- Integrates seamlessly into existing clothing workflows
- Provides robust error handling and graceful degradation

## 2. Architecture & Design

### 2.1 System Integration

```
Clothing Removal Flow (Enhanced):

clothing:remove_clothing action
  ↓
handle_remove_clothing.rule.json
  ↓
Operations:
  1. GET_NAME (actor) ✅
  2. GET_NAME (target) ✅
  3. QUERY_COMPONENT (actor position) ✅
  4. UNEQUIP_CLOTHING ✅
  5. REGENERATE_DESCRIPTION ← NEW
  6. SET_VARIABLE (log message) ✅
  7. MACRO: core:logSuccessAndEndTurn ✅
```

### 2.2 Core Components

#### New Operation Handler: `RegenerateDescriptionHandler`

**Purpose**: Regenerate an entity's `core:description` component using current anatomy and equipment state

**Dependencies**:

- `EntityManager`: Entity data access and component updates
- `BodyDescriptionComposer`: Full body description generation
- `Logger`: Operation logging and debugging
- `ISafeEventDispatcher`: Error handling and event dispatch

**Handler Pattern**: Extends `ComponentOperationHandler` following project conventions

### 2.3 Operation Schema

```json
{
  "type": "REGENERATE_DESCRIPTION",
  "parameters": {
    "entity_ref": "actor" | "target" | string | EntityRefObject
  }
}
```

**Parameter Details**:

- `entity_ref`: Required. The entity to regenerate description for
- Supports all standard entity reference formats used in other operations

## 3. Implementation Requirements

### 3.1 Phase 1: Schema Definition

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

**Schema Registration**: Update `data/schemas/operation.schema.json` after line 138:

```json
,
{
  "$ref": "./operations/regenerateDescription.schema.json"
}
```

### 3.2 Phase 2: Operation Handler Implementation

**File**: `src/logic/operationHandlers/regenerateDescriptionHandler.js`

#### Class Structure

```javascript
import ComponentOperationHandler from '../baseOperationHandler/componentOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

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
        requiredMethods: ['getEntityInstance', 'addComponent'],
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
    // Implementation details below
  }
}

export default RegenerateDescriptionHandler;
```

#### Execution Flow Implementation

```javascript
async execute(params, executionContext) {
  const log = this.getLogger(executionContext);

  try {
    // 1. Parameter Validation
    if (!assertParamsObject(params, log, 'REGENERATE_DESCRIPTION')) {
      return;
    }

    const { entity_ref } = params;

    // 2. Entity Resolution
    const entityId = this.validateEntityRef(
      entity_ref,
      log,
      'REGENERATE_DESCRIPTION',
      executionContext
    );

    if (!entityId) {
      return; // validateEntityRef handles logging
    }

    // 3. Entity Retrieval
    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      log.warn('Entity not found for description regeneration', {
        entityId,
        operation: 'REGENERATE_DESCRIPTION'
      });
      return;
    }

    // 4. Description Generation
    const newDescription = await this.#bodyDescriptionComposer.composeDescription(entity);

    // 5. Component Update
    await this.#entityManager.addComponent(entityId, 'core:description', {
      text: newDescription
    });

    log.info('Successfully regenerated entity description', {
      entityId,
      descriptionLength: newDescription?.length || 0
    });

  } catch (error) {
    log.error('Failed to regenerate entity description', {
      params,
      error: error.message,
      stack: error.stack
    });

    safeDispatchError(this.#dispatcher, error, 'REGENERATE_DESCRIPTION operation failed', log);
  }
}
```

#### Error Handling Strategy

1. **Missing Entity**: Return early from `validateEntityAndType()` - follows `ComponentOperationHandler` pattern
2. **No anatomy:body Component**: Let `composeDescription()` handle gracefully (returns empty string)
3. **Description Generation Failure**: Catch exception, log error, preserve existing description
4. **Component Update Failure**: Use try-catch around `addComponent()`, call `safeDispatchError()` on critical failure
5. **Parameter Validation**: Use `assertParamsObject()` pattern, return early on validation failure

### 3.3 Phase 3: Dependency Injection Registration

**File**: `src/dependencyInjection/tokens/tokens-core.js`

Add token:

```javascript
RegenerateDescriptionHandler: 'RegenerateDescriptionHandler',
```

**File**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

Add import:

```javascript
import RegenerateDescriptionHandler from '../../logic/operationHandlers/regenerateDescriptionHandler.js';
```

Add registration in handlers array:

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

### 3.4 Phase 4: Rule Integration

**File**: `data/mods/clothing/rules/handle_remove_clothing.rule.json`

**Modification**: Add new operation after `UNEQUIP_CLOTHING` (around line 38):

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

## 4. Testing Strategy

### 4.1 Unit Tests

**Location**: `tests/unit/logic/operationHandlers/regenerateDescriptionHandler.test.js`

**Required Test Cases**:

#### Happy Path Tests

```javascript
describe('RegenerateDescriptionHandler - Happy Path', () => {
  it('should successfully regenerate description for valid entity', async () => {
    // Test with entity that has anatomy:body component
    // Verify BodyDescriptionComposer.composeDescription called
    // Verify EntityManager.addComponent called with correct params
    // Verify success logging
  });

  it('should handle different entity_ref formats', async () => {
    // Test with "actor", "target", entity ID string, entity reference object
    // Verify all formats resolve correctly
  });
});
```

#### Edge Case Tests

```javascript
describe('RegenerateDescriptionHandler - Edge Cases', () => {
  it('should handle entity without anatomy:body component gracefully', async () => {
    // Verify composeDescription returns empty/minimal description
    // Verify component still gets updated
    // Verify no errors thrown
  });

  it('should handle missing entity gracefully', async () => {
    // Test with non-existent entity ID
    // Verify early return with warning log
    // Verify no component update attempted
  });
});
```

#### Error Handling Tests

```javascript
describe('RegenerateDescriptionHandler - Error Handling', () => {
  it('should handle description generation failure', async () => {
    // Mock BodyDescriptionComposer to throw error
    // Verify error logged and dispatched
    // Verify existing description preserved
  });

  it('should handle component update failure', async () => {
    // Mock EntityManager.addComponent to throw error
    // Verify safeDispatchError called
    // Verify proper error logging
  });

  it('should validate parameters correctly', async () => {
    // Test missing entity_ref parameter
    // Test invalid parameter types
    // Verify assertParamsObject usage
  });
});
```

#### Dependency Validation Tests

```javascript
describe('RegenerateDescriptionHandler - Constructor', () => {
  it('should validate all required dependencies', () => {
    // Test missing entityManager
    // Test missing bodyDescriptionComposer
    // Test missing required methods
    // Verify proper error messages
  });
});
```

**Coverage Requirements**: 95%+ branch coverage, 100% function coverage

### 4.2 Integration Tests

**Location**: `tests/integration/clothing/clothingDescriptionIntegration.test.js`

**Test Scenarios**:

```javascript
describe('Clothing Description Integration', () => {
  it('should update description after removing single clothing item', async () => {
    // Setup: Entity with clothing equipped and initial description
    // Action: Execute clothing:remove_clothing action
    // Verify: Description updated to reflect removed item
    // Verify: Other components remain unchanged
  });

  it('should update description after removing multiple items', async () => {
    // Setup: Entity with multiple clothing items
    // Action: Remove several items in sequence
    // Verify: Final description reflects all changes
  });

  it('should integrate with other entity modifications', async () => {
    // Setup: Complex entity state with multiple components
    // Action: Mixed operations including clothing changes
    // Verify: Description updates don't interfere with other changes
  });

  it('should execute full rule processing correctly', async () => {
    // Setup: Complete game context with rules loaded
    // Action: Execute full clothing removal rule
    // Verify: All rule operations execute successfully
    // Verify: Description regeneration occurs in correct sequence
  });
});
```

### 4.3 End-to-End Tests

**Location**: `tests/e2e/actions/clothingActions.e2e.test.js`

**User Story Tests**:

```javascript
describe('Clothing Actions E2E', () => {
  it('should update appearance visible to other characters', async () => {
    // Setup: Two characters in same location
    // Action: Character A removes clothing
    // Verify: Character B sees updated description of Character A
  });

  it('should handle NPC clothing changes automatically', async () => {
    // Setup: NPC with automated clothing behavior
    // Action: Trigger NPC clothing change
    // Verify: Player sees updated NPC description
  });

  it('should maintain consistency across multiple clothing operations', async () => {
    // Setup: Complex scenario with multiple characters
    // Action: Multiple characters change clothing simultaneously
    // Verify: All descriptions remain consistent and accurate
  });
});
```

## 5. Quality Requirements & Success Metrics

### 5.1 Functional Requirements

**Core Functionality**:

- ✅ Entity descriptions update correctly after clothing removal
- ✅ Integration works seamlessly with existing clothing system
- ✅ Supports all standard entity reference formats
- ✅ Maintains backward compatibility with existing actions

**Error Handling**:

- ✅ Graceful handling of missing entities
- ✅ Resilient to description generation failures
- ✅ Non-disruptive to existing rule execution flow
- ✅ Clear error messages and comprehensive logging

### 5.2 Performance Requirements

**Execution Performance**:

- Description regeneration adds <100ms to clothing operations
- No memory leaks from repeated description updates
- Efficient handling of complex entity hierarchies
- Minimal impact on overall game performance

**Scalability**:

- Handles entities with 20+ equipped items efficiently
- Supports concurrent description updates for multiple entities
- Maintains performance with complex anatomy configurations

### 5.3 Code Quality Standards

**Test Coverage**:

- 95%+ unit test coverage for new operation handler
- 100% coverage of error handling paths
- Integration test coverage for all major scenarios
- E2E test coverage for user-visible behavior changes

**Code Quality**:

- Follows project coding conventions and patterns
- Proper dependency injection and validation
- Clear documentation and inline comments for complex logic
- No ESLint violations or TypeScript errors

**Documentation**:

- Operation handler follows established architectural patterns
- Schema properly documents parameters and validation rules
- Clear integration examples for mod creators
- Comprehensive error handling documentation

### 5.4 Regression Prevention

**Backward Compatibility**:

- All existing clothing functionality remains unchanged
- No performance degradation in existing operations
- Existing rule files continue to work without modification
- All existing tests continue to pass

**Validation Requirements**:

- Schema validation passes for all existing content
- Rule processing continues without interruption
- Entity component updates don't conflict with existing systems
- Event dispatching maintains existing patterns

## 6. Implementation Risks & Mitigation

### 6.1 Technical Risks

**Risk: Performance Impact**

- **Description**: Description generation is computationally expensive
- **Likelihood**: Medium | **Impact**: Medium
- **Mitigation**:
  - Implement async execution to prevent blocking
  - Monitor performance in testing with complex entities
  - Consider caching strategies for repeated generations

**Risk: Description Generation Failures**

- **Description**: BodyDescriptionComposer might fail or return empty descriptions
- **Likelihood**: Low | **Impact**: Medium
- **Mitigation**:
  - Preserve existing descriptions on generation failure
  - Comprehensive error logging for debugging
  - Graceful degradation without breaking action flow

**Risk: Dependency Availability**

- **Description**: Required services might not be available in all contexts
- **Likelihood**: Low | **Impact**: High
- **Mitigation**:
  - Robust dependency validation in constructor
  - Clear error messages for missing dependencies
  - Optional dependency handling where appropriate

### 6.2 Integration Risks

**Risk: Rule Processing Interruption**

- **Description**: New operation might break existing rule execution
- **Likelihood**: Low | **Impact**: High
- **Mitigation**:
  - Non-critical operation design (continues on failure)
  - Comprehensive integration testing with existing rules
  - Backward compatibility verification

**Risk: Schema Validation Conflicts**

- **Description**: New operation schema might conflict with existing validation
- **Likelihood**: Low | **Impact**: Medium
- **Mitigation**:
  - Follow existing schema patterns exactly
  - Validate schema changes against existing content
  - Test schema loading and validation processes

### 6.3 User Experience Risks

**Risk: Inconsistent Descriptions**

- **Description**: Race conditions might cause description inconsistencies
- **Likelihood**: Low | **Impact**: Medium
- **Mitigation**:
  - Atomic component update operations
  - Clear ordering in rule operation sequences
  - Integration testing for concurrent scenarios

## 7. Future Extensibility Considerations

### 7.1 Generic Description Updates

- **Opportunity**: Extend beyond clothing to other appearance changes
- **Examples**: Injury states, magical transformations, aging effects
- **Implementation**: Parameterize description triggers and contexts

### 7.2 Batch Operations

- **Opportunity**: Update multiple entities efficiently
- **Use Case**: Mass clothing changes in groups or events
- **Implementation**: Batch processing with optimized description generation

### 7.3 Conditional Updates

- **Opportunity**: Only update if description actually changed
- **Benefit**: Reduce unnecessary computation and event noise
- **Implementation**: Hash comparison of previous vs new descriptions

### 7.4 Event Notifications

- **Opportunity**: Notify other systems of description changes
- **Use Case**: UI updates, AI attention systems, logging enhancements
- **Implementation**: Dispatch events on successful description updates

## 8. Validation Checklist

### Pre-Implementation Validation

- [ ] All existing tests pass before starting implementation
- [ ] Project builds successfully without errors
- [ ] Schema validation system working correctly
- [ ] BodyDescriptionComposer service functioning as expected

### Implementation Validation

- [ ] New schema file validates correctly
- [ ] Operation handler follows ComponentOperationHandler pattern
- [ ] Dependency injection registration works correctly
- [ ] Rule integration doesn't break existing functionality

### Post-Implementation Validation

- [ ] All unit tests pass with required coverage
- [ ] Integration tests demonstrate correct behavior
- [ ] E2E tests show user-visible improvements
- [ ] Performance benchmarks meet requirements
- [ ] No regressions in existing functionality

### Quality Assurance

- [ ] ESLint passes with zero violations
- [ ] TypeScript type checking passes
- [ ] Code review completed and approved
- [ ] Documentation updated and accurate

---

**Implementation Priority**: HIGH  
**Estimated Effort**: 2-3 development days  
**Dependencies**: None (uses existing services)  
**Breaking Changes**: None  
**Database Migration**: None required

This specification provides complete implementation guidance for adding entity description regeneration to the Living Narrative Engine's clothing system, ensuring accurate character descriptions after clothing changes.
