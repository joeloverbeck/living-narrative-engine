# ANACLOENH-004-07: Integrate Anatomy System with Error Framework

## Overview
Integrate the existing AnatomyErrorHandler with the new centralized error handling framework, ensuring all anatomy errors flow through the central system.

## Parent Ticket
- ANACLOENH-004: Establish Error Handling Framework

## Depends On
- ANACLOENH-004-01: Create BaseError Class
- ANACLOENH-004-02: Update Existing Error Classes
- ANACLOENH-004-03: Create Central Error Handler
- ANACLOENH-004-04: Create Recovery Strategy Manager

## Current State
- AnatomyErrorHandler exists with custom error types
- Anatomy error classes (AnatomyGenerationError, etc.) don't extend BaseError
- No recovery strategies for anatomy errors

## Objectives
1. Update anatomy error classes to extend BaseError
2. Integrate AnatomyErrorHandler with CentralErrorHandler
3. Add recovery strategies for anatomy operations
4. Maintain context preservation

## Technical Requirements

### Update Anatomy Error Classes
```javascript
// src/anatomy/orchestration/anatomyErrorHandler.js
import BaseError from '../../errors/BaseError.js';

export class AnatomyGenerationError extends BaseError {
  constructor(message, entityId = null, recipeId = null, cause = null) {
    super(message, 'ANATOMY_GENERATION_ERROR', {
      entityId,
      recipeId,
      cause: cause ? {
        name: cause.name,
        message: cause.message
      } : null
    });
    // Backward compatibility
    this.entityId = entityId;
    this.recipeId = recipeId;
    this.cause = cause;
  }

  getSeverity() { return 'error'; }
  isRecoverable() { return true; } // Can retry generation
}

export class DescriptionGenerationError extends BaseError {
  constructor(message, entityId = null, partIds = null, cause = null) {
    super(message, 'DESCRIPTION_GENERATION_ERROR', {
      entityId,
      partIds,
      cause: cause ? {
        name: cause.name,
        message: cause.message
      } : null
    });
    // Backward compatibility
    this.entityId = entityId;
    this.partIds = partIds;
    this.cause = cause;
  }

  getSeverity() { return 'warning'; }
  isRecoverable() { return true; } // Can regenerate descriptions
}

export class GraphBuildingError extends BaseError {
  constructor(message, rootId = null, cause = null) {
    super(message, 'GRAPH_BUILDING_ERROR', {
      rootId,
      cause: cause ? {
        name: cause.name,
        message: cause.message
      } : null
    });
    // Backward compatibility
    this.rootId = rootId;
    this.cause = cause;
  }

  getSeverity() { return 'error'; }
  isRecoverable() { return false; } // Graph structure errors are critical
}

export class AnatomyErrorHandler {
  #logger;
  #centralErrorHandler;
  #recoveryStrategyManager;

  constructor({ logger, centralErrorHandler, recoveryStrategyManager }) {
    this.#logger = logger;
    this.#centralErrorHandler = centralErrorHandler;
    this.#recoveryStrategyManager = recoveryStrategyManager;

    if (this.#centralErrorHandler && this.#recoveryStrategyManager) {
      this.#registerRecoveryStrategies();
    }
  }

  // Updated handle method to use central system
  async handle(error, context = {}) {
    // Determine operation type from context
    const errorName = error.name || 'UnknownError';
    const errorMessage = error.message || 'Unknown error occurred';

    // Log locally for debugging
    this.#logger.error(
      `AnatomyErrorHandler: ${errorName} occurred during anatomy operation`,
      {
        error: errorMessage,
        stack: error.stack,
        context,
        ...this.#extractErrorContext(error),
      }
    );

    // If central handler exists, delegate to it
    if (this.#centralErrorHandler) {
      try {
        // Wrap error if needed
        const wrappedError = this.#wrapError(error, context);

        return await this.#centralErrorHandler.handle(wrappedError, {
          ...context,
          domain: 'anatomy'
        });
      } catch (centralError) {
        this.#logger.warn('Central error handler failed, using local handling', {
          error: centralError.message
        });
      }
    }

    // Local handling (backward compatibility)
    return this.#handleLocally(error, context);
  }

  // Wrap error in appropriate anatomy error type
  #wrapError(error, context) {
    // Already wrapped
    if (
      error instanceof AnatomyGenerationError ||
      error instanceof DescriptionGenerationError ||
      error instanceof GraphBuildingError
    ) {
      return error;
    }

    // Determine the appropriate error type based on context
    if (context.operation === 'generation') {
      return new AnatomyGenerationError(
        `Anatomy generation failed: ${error.message}`,
        context.entityId,
        context.recipeId,
        error
      );
    } else if (context.operation === 'description') {
      return new DescriptionGenerationError(
        `Description generation failed: ${error.message}`,
        context.entityId,
        context.partIds,
        error
      );
    } else if (context.operation === 'graphBuilding') {
      return new GraphBuildingError(
        `Graph building failed: ${error.message}`,
        context.rootId,
        error
      );
    }

    // Default to AnatomyGenerationError
    return new AnatomyGenerationError(
      `Anatomy operation failed: ${error.message}`,
      context.entityId,
      context.recipeId,
      error
    );
  }

  // Register anatomy-specific recovery strategies
  #registerRecoveryStrategies() {
    // Strategy for anatomy generation errors
    this.#recoveryStrategyManager.registerStrategy('AnatomyGenerationError', {
      retry: {
        maxRetries: 2,
        backoff: 'exponential'
      },
      fallback: async (error, operation) => {
        this.#logger.warn('Using default anatomy fallback');
        return this.#getDefaultAnatomyData(error.context);
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 120000 // 2 minutes
      }
    });

    // Strategy for description generation errors
    this.#recoveryStrategyManager.registerStrategy('DescriptionGenerationError', {
      retry: {
        maxRetries: 3,
        backoff: 'linear'
      },
      fallback: async (error, operation) => {
        this.#logger.warn('Using generic description fallback');
        return this.#getGenericDescription(error.context);
      }
    });

    // Strategy for graph building errors
    this.#recoveryStrategyManager.registerStrategy('GraphBuildingError', {
      retry: {
        maxRetries: 1,
        backoff: 'constant'
      },
      fallback: async (error, operation) => {
        this.#logger.warn('Using minimal graph structure fallback');
        return this.#getMinimalGraphStructure(error.context);
      }
    });

    this.#logger.info('Anatomy recovery strategies registered with central system');
  }

  // Fallback methods for anatomy operations
  #getDefaultAnatomyData(context) {
    return {
      type: 'fallback',
      entityId: context.entityId,
      parts: [
        { id: 'head', type: 'head', description: 'head' },
        { id: 'torso', type: 'torso', description: 'torso' },
        { id: 'leftArm', type: 'arm', description: 'left arm' },
        { id: 'rightArm', type: 'arm', description: 'right arm' },
        { id: 'leftLeg', type: 'leg', description: 'left leg' },
        { id: 'rightLeg', type: 'leg', description: 'right leg' }
      ]
    };
  }

  #getGenericDescription(context) {
    return {
      type: 'fallback',
      entityId: context.entityId,
      description: 'A standard humanoid form.',
      parts: context.partIds ? context.partIds.map(id => ({
        id,
        description: `${id} part`
      })) : []
    };
  }

  #getMinimalGraphStructure(context) {
    return {
      type: 'fallback',
      rootId: context.rootId,
      nodes: [{ id: context.rootId, type: 'root' }],
      edges: []
    };
  }

  // Local handling for backward compatibility
  #handleLocally(error, context) {
    const wrappedError = this.#wrapError(error, context);

    // Return wrapped error
    return wrappedError;
  }

  // Extract context from known error types
  #extractErrorContext(error) {
    const context = {};

    if (error instanceof AnatomyGenerationError) {
      context.entityId = error.entityId;
      context.recipeId = error.recipeId;
    } else if (error instanceof DescriptionGenerationError) {
      context.entityId = error.entityId;
      context.partIds = error.partIds;
    } else if (error instanceof GraphBuildingError) {
      context.rootId = error.rootId;
    }

    if (error.cause) {
      context.causedBy = {
        name: error.cause.name,
        message: error.cause.message,
      };
    }

    return context;
  }
}
```

### Update Anatomy Data Error Classes
```javascript
// src/errors/anatomyDataError.js
import BaseError from './BaseError.js';

export class AnatomyDataError extends BaseError {
  constructor(message, context = {}) {
    super(message, 'ANATOMY_DATA_ERROR', context);
  }

  getSeverity() { return 'error'; }
  isRecoverable() { return true; }
}

// src/errors/anatomyStateError.js
export class AnatomyStateError extends BaseError {
  constructor(message, context = {}) {
    super(message, 'ANATOMY_STATE_ERROR', context);
  }

  getSeverity() { return 'error'; }
  isRecoverable() { return false; }
}

// src/errors/anatomyVisualizationError.js
export class AnatomyVisualizationError extends BaseError {
  constructor(message, context = {}) {
    super(message, 'ANATOMY_VISUALIZATION_ERROR', context);
  }

  getSeverity() { return 'warning'; }
  isRecoverable() { return true; }
}

// src/errors/anatomyRenderError.js
export class AnatomyRenderError extends BaseError {
  constructor(message, context = {}) {
    super(message, 'ANATOMY_RENDER_ERROR', context);
  }

  getSeverity() { return 'warning'; }
  isRecoverable() { return true; }
}
```

## Implementation Steps

1. **Update anatomy error classes**
   - Extend BaseError
   - Add severity and recoverability
   - Maintain backward compatibility

2. **Update AnatomyErrorHandler**
   - Add central handler integration
   - Register recovery strategies
   - Add fallback methods

3. **Update anatomy services**
   - Wrap operations with error handling
   - Ensure errors flow to central system

## File Changes

### Modified Files
- `src/anatomy/orchestration/anatomyErrorHandler.js` - Update errors and handler
- `src/errors/anatomyDataError.js` - Extend BaseError
- `src/errors/anatomyStateError.js` - Extend BaseError
- `src/errors/anatomyVisualizationError.js` - Extend BaseError
- `src/errors/anatomyRenderError.js` - Extend BaseError

## Dependencies
- **Prerequisites**: All previous tickets (ANACLOENH-004-01 through 004-05)
- **External**: CentralErrorHandler, RecoveryStrategyManager

## Acceptance Criteria
1. ✅ Anatomy errors extend BaseError
2. ✅ AnatomyErrorHandler integrates with central system
3. ✅ Recovery strategies work for anatomy operations
4. ✅ Fallback data generated correctly
5. ✅ Context preserved through error chain
6. ✅ All existing tests pass

## Testing Requirements

### Unit Tests
Update anatomy error tests:
- Verify errors extend BaseError
- Test central handler integration
- Test recovery strategies
- Test fallback generation

### Integration Tests
- Test anatomy generation with errors
- Test description generation with errors
- Test graph building with errors
- Verify recovery and fallbacks work

## Estimated Effort
- **Development**: 2 hours
- **Testing**: 1 hour
- **Total**: 3 hours

## Risk Assessment
- **Low Risk**: Similar pattern to clothing integration
- **Consideration**: Graph errors may be non-recoverable
- **Mitigation**: Careful testing of fallback data

## Success Metrics
- All anatomy errors handled centrally
- Recovery strategies reduce failures by 50%
- Fallback data prevents system crashes
- No regression in anatomy generation

## Notes
- Consider caching successful anatomy data
- Monitor which errors occur most frequently
- May need to adjust retry counts based on usage
- Document fallback data structure clearly