# ENTDESCREG-002: Implement Operation Handler

**Priority**: High  
**Dependencies**: ENTDESCREG-001 (Operation Schema)  
**Estimated Effort**: 1.5 days

## Overview

Implement the `RegenerateDescriptionHandler` class that will execute the `REGENERATE_DESCRIPTION` operation. This handler will integrate with the existing `BodyDescriptionComposer` service to update entity descriptions automatically.

## Background

The core functionality for entity description regeneration involves creating an operation handler that follows the project's `ComponentOperationHandler` pattern. This handler will leverage existing services to regenerate descriptions when entities undergo appearance changes.

## Acceptance Criteria

- [ ] Create `RegenerateDescriptionHandler` class extending `ComponentOperationHandler`
- [ ] Implement proper dependency injection with validation
- [ ] Execute description regeneration using `BodyDescriptionComposer`
- [ ] Update entity's `core:description` component with new description
- [ ] Implement comprehensive error handling and logging
- [ ] Follow project coding conventions and patterns
- [ ] Handle all entity reference formats (actor, target, ID string, reference object)

## Technical Requirements

### Files to Create

**`src/logic/operationHandlers/regenerateDescriptionHandler.js`**

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
    // Implementation required
  }
}

export default RegenerateDescriptionHandler;
```

#### Execute Method Implementation

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

## Error Handling Strategy

### Required Error Scenarios

1. **Missing Entity**: Return early with warning log
2. **Parameter Validation Failure**: Use `assertParamsObject` pattern
3. **Entity Reference Resolution Failure**: Use `validateEntityRef` pattern
4. **Description Generation Failure**: Catch exception, preserve existing description
5. **Component Update Failure**: Use `safeDispatchError` for critical failures

### Error Handling Pattern

- Use project's established error handling utilities
- Preserve existing descriptions on failure
- Non-disruptive to rule execution flow
- Comprehensive logging for debugging
- Proper error event dispatching

## Definition of Done

- [ ] Handler class created following `ComponentOperationHandler` pattern
- [ ] All dependencies properly validated in constructor
- [ ] Entity reference validation using existing project utilities
- [ ] Description generation integrated with `BodyDescriptionComposer`
- [ ] Component update using `EntityManager.addComponent`
- [ ] Comprehensive error handling for all failure scenarios
- [ ] Proper logging for success and failure cases
- [ ] Code follows project conventions (camelCase, private fields with #)
- [ ] JSDoc comments for complex logic
- [ ] Async/await pattern used consistently

## Integration Requirements

- [ ] Handler extends `ComponentOperationHandler` base class
- [ ] Uses existing validation utilities (`assertParamsObject`, `validateEntityRef`)
- [ ] Integrates with `BodyDescriptionComposer` service
- [ ] Uses `EntityManager` for component updates
- [ ] Proper error dispatching with `safeDispatchError`
- [ ] Follows existing operation handler patterns

## Performance Considerations

- [ ] Async execution to prevent blocking
- [ ] Efficient error handling without excessive try-catch nesting
- [ ] Minimal memory allocation in hot paths
- [ ] Proper cleanup of resources

## Related Specification Sections

- **Section 3.2**: Phase 2 - Operation Handler Implementation
- **Section 2.2**: Core Components - RegenerateDescriptionHandler
- **Section 6.1**: Technical Risks - Performance Impact
- **Section 5.1**: Functional Requirements - Error Handling

## Next Steps

After completion, proceed to **ENTDESCREG-003** to register this handler in the dependency injection container.
