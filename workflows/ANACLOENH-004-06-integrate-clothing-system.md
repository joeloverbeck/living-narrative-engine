# ANACLOENH-004-06: Integrate Clothing System with Error Framework

## Overview
Integrate the existing ClothingErrorHandler with the new centralized error handling framework, ensuring all clothing errors flow through the central system.

## Parent Ticket
- ANACLOENH-004: Establish Error Handling Framework

## Depends On
- ANACLOENH-004-01: Create BaseError Class
- ANACLOENH-004-02: Update Existing Error Classes
- ANACLOENH-004-03: Create Central Error Handler
- ANACLOENH-004-04: Create Recovery Strategy Manager

## Current State
- ClothingErrorHandler exists with its own recovery strategies
- ClothingError classes exist but don't extend BaseError
- Circuit breaker exists in clothing/monitoring/

## Objectives
1. Update clothing error classes to extend BaseError
2. Integrate ClothingErrorHandler with CentralErrorHandler
3. Register clothing-specific recovery strategies
4. Maintain existing functionality

## Technical Requirements

### Update Clothing Error Classes
```javascript
// src/clothing/errors/clothingErrors.js
import BaseError from '../../errors/BaseError.js';

export class ClothingError extends BaseError {
  constructor(message, context = {}) {
    super(message, 'CLOTHING_ERROR', context);
    this.timestamp = new Date().toISOString(); // Backward compatibility
  }

  getSeverity() { return 'warning'; }
  isRecoverable() { return true; }
}

export class ClothingAccessibilityError extends BaseError {
  constructor(message, entityId, itemId, context = {}) {
    super(message, 'CLOTHING_ACCESSIBILITY_ERROR', {
      entityId,
      itemId,
      ...context
    });
    this.entityId = entityId; // Backward compatibility
    this.itemId = itemId; // Backward compatibility
  }

  getSeverity() { return 'warning'; }
  isRecoverable() { return true; }
}

export class CoverageAnalysisError extends BaseError {
  constructor(message, equipmentState, context = {}) {
    super(message, 'COVERAGE_ANALYSIS_ERROR', {
      equipmentState,
      ...context
    });
    this.equipmentState = equipmentState; // Backward compatibility
  }

  getSeverity() { return 'warning'; }
  isRecoverable() { return true; }
}

export class PriorityCalculationError extends BaseError {
  constructor(message, layer, context, modifiers) {
    super(message, 'PRIORITY_CALCULATION_ERROR', {
      layer,
      modifiers,
      ...context
    });
    this.layer = layer; // Backward compatibility
    this.modifiers = modifiers; // Backward compatibility
  }

  getSeverity() { return 'warning'; }
  isRecoverable() { return true; }
}

export class ClothingServiceError extends BaseError {
  constructor(message, serviceName, operation, context = {}) {
    super(message, 'CLOTHING_SERVICE_ERROR', {
      serviceName,
      operation,
      ...context
    });
    this.serviceName = serviceName; // Backward compatibility
    this.operation = operation; // Backward compatibility
  }

  getSeverity() { return 'error'; }
  isRecoverable() { return true; }
}

export class ClothingValidationError extends BaseError {
  constructor(message, field, value, expectedType, context = {}) {
    super(message, 'CLOTHING_VALIDATION_ERROR', {
      field,
      value,
      expectedType,
      ...context
    });
    this.field = field; // Backward compatibility
    this.value = value; // Backward compatibility
    this.expectedType = expectedType; // Backward compatibility
  }

  getSeverity() { return 'warning'; }
  isRecoverable() { return true; }
}
```

### Update ClothingErrorHandler
```javascript
// src/clothing/errors/clothingErrorHandler.js
import { validateDependency } from '../../utils/dependencyUtils.js';

export class ClothingErrorHandler {
  #logger;
  #eventBus;
  #centralErrorHandler;
  #recoveryStrategyManager;
  #localRecoveryStrategies;

  constructor({ logger, eventBus, centralErrorHandler, recoveryStrategyManager }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['error', 'warn', 'info', 'debug']
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch']
    });

    // New dependencies
    if (centralErrorHandler) {
      validateDependency(centralErrorHandler, 'ICentralErrorHandler', logger, {
        requiredMethods: ['handle', 'registerRecoveryStrategy']
      });
    }

    if (recoveryStrategyManager) {
      validateDependency(recoveryStrategyManager, 'IRecoveryStrategyManager', logger, {
        requiredMethods: ['executeWithRecovery', 'registerStrategy']
      });
    }

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#centralErrorHandler = centralErrorHandler;
    this.#recoveryStrategyManager = recoveryStrategyManager;
    this.#localRecoveryStrategies = new Map();

    this.#initializeRecoveryStrategies();
    this.#registerWithCentralHandler();
  }

  // Updated error handling to use central system
  async handleError(error, context = {}) {
    // If central handler exists, delegate to it
    if (this.#centralErrorHandler) {
      try {
        return await this.#centralErrorHandler.handle(error, {
          ...context,
          domain: 'clothing'
        });
      } catch (centralError) {
        // Fall back to local handling if central fails
        this.#logger.warn('Central error handler failed, using local handling', {
          error: centralError.message
        });
      }
    }

    // Local handling (backward compatibility)
    return this.#handleLocally(error, context);
  }

  // Register clothing-specific strategies with central system
  #registerWithCentralHandler() {
    if (!this.#centralErrorHandler || !this.#recoveryStrategyManager) {
      return;
    }

    // Register clothing-specific recovery strategies
    this.#recoveryStrategyManager.registerStrategy('ClothingServiceError', {
      retry: {
        maxRetries: 3,
        backoff: 'exponential'
      },
      fallback: (error, operation) => {
        return this.#fallbackToLegacyClothingLogic({ operation });
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 60000
      }
    });

    this.#recoveryStrategyManager.registerStrategy('CoverageAnalysisError', {
      retry: {
        maxRetries: 2,
        backoff: 'linear'
      },
      fallback: (error, operation) => {
        return this.#fallbackToLayerPriorityOnly({ operation });
      }
    });

    this.#recoveryStrategyManager.registerStrategy('PriorityCalculationError', {
      retry: {
        maxRetries: 1,
        backoff: 'constant'
      },
      fallback: (error, operation) => {
        return this.#fallbackToDefaultPriorities({ operation });
      }
    });

    this.#recoveryStrategyManager.registerStrategy('ClothingValidationError', {
      retry: {
        maxRetries: 2,
        backoff: 'exponential'
      },
      fallback: (error, operation) => {
        return this.#sanitizeAndRetry(error, { operation });
      }
    });

    this.#recoveryStrategyManager.registerStrategy('ClothingAccessibilityError', {
      retry: {
        maxRetries: 2,
        backoff: 'linear'
      },
      fallback: (error, operation) => {
        return this.#fallbackToSimpleAccessibility({ operation });
      }
    });

    this.#logger.info('Clothing recovery strategies registered with central system');
  }

  // Existing fallback methods remain unchanged
  #fallbackToLegacyClothingLogic(context) {
    this.#logger.warn('Falling back to legacy clothing logic');
    return { mode: 'legacy', items: [], accessible: true };
  }

  #fallbackToLayerPriorityOnly(context) {
    this.#logger.warn('Coverage analysis failed, using layer priority only');
    return { mode: 'layer_only', blockingDisabled: true };
  }

  #fallbackToDefaultPriorities(context) {
    this.#logger.warn('Priority calculation failed, using default priorities');
    return {
      mode: 'default_priorities',
      priorities: {
        outer: 1,
        base: 2,
        underwear: 3,
        accessories: 4
      }
    };
  }

  #sanitizeAndRetry(error, context) {
    this.#logger.warn('Validation error, attempting data sanitization');
    return {
      mode: 'sanitized',
      retryable: true,
      sanitizedField: error.field,
      sanitizedValue: null
    };
  }

  #fallbackToSimpleAccessibility(context) {
    this.#logger.warn('Accessibility check failed, using simple fallback');
    return {
      mode: 'simple_accessibility',
      allAccessible: true
    };
  }

  // Local handling for backward compatibility
  #handleLocally(error, context) {
    const errorId = this.#generateErrorId();

    this.#logError(error, context, errorId);
    this.#dispatchErrorEvent(error, context, errorId);

    const recovery = this.#attemptLocalRecovery(error, context);

    return {
      errorId,
      recovered: recovery.success,
      fallbackData: recovery.data,
      recoveryStrategy: recovery.strategy
    };
  }

  // ... rest of existing methods remain ...
}
```

## Implementation Steps

1. **Update clothing error classes**
   - Extend BaseError
   - Add severity and recoverability
   - Maintain backward compatibility

2. **Update ClothingErrorHandler**
   - Add central handler integration
   - Register recovery strategies
   - Maintain fallback to local handling

3. **Update circuit breaker integration**
   - Ensure compatibility with MonitoringCoordinator
   - Register with central system

4. **Update service integrations**
   - Wrap service methods with new error handling
   - Ensure errors flow to central system

## File Changes

### Modified Files
- `src/clothing/errors/clothingErrors.js` - Update to extend BaseError
- `src/clothing/errors/clothingErrorHandler.js` - Integrate with central system
- `src/clothing/services/*.js` - Update error handling in services

## Dependencies
- **Prerequisites**: All previous tickets (ANACLOENH-004-01 through 004-05)
- **External**: CentralErrorHandler, RecoveryStrategyManager

## Acceptance Criteria
1. ✅ Clothing errors extend BaseError
2. ✅ ClothingErrorHandler integrates with central system
3. ✅ Recovery strategies registered centrally
4. ✅ Backward compatibility maintained
5. ✅ All existing tests pass
6. ✅ Errors flow through central system

## Testing Requirements

### Unit Tests
Update existing clothing error tests:
- Verify errors extend BaseError
- Test central handler integration
- Test fallback to local handling
- Verify recovery strategies work

### Integration Tests
- Test end-to-end error flow
- Test recovery execution
- Test circuit breaker integration

## Estimated Effort
- **Development**: 2 hours
- **Testing**: 1 hour
- **Total**: 3 hours

## Risk Assessment
- **Low Risk**: Incremental changes with fallback
- **Mitigation**: Maintain backward compatibility
- **Mitigation**: Test thoroughly before removing old code

## Success Metrics
- All clothing errors handled centrally
- No regression in existing functionality
- Recovery strategies work as before
- Performance unchanged

## Notes
- Keep local handling as fallback initially
- Can remove local handling in future iteration
- Document migration path for other systems
- Consider creating migration helper utilities