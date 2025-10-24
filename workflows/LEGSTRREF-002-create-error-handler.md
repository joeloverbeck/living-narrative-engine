# LEGSTRREF-002: Create Error Handler

## Metadata
- **Ticket ID**: LEGSTRREF-002
- **Phase**: 1 - Foundation
- **Priority**: High
- **Effort**: 0.5-1 day
- **Status**: Not Started
- **Dependencies**: None
- **Blocks**: LEGSTRREF-004, LEGSTRREF-005, LEGSTRREF-006

## Problem Statement

### Current Issue
The `LegacyStrategy` class uses three different error handling patterns inconsistently:

**Pattern 1: Silent Skip** (lines 175-179):
```javascript
if (!actionSpecificTargets || Object.keys(actionSpecific

Targets).length === 0) {
  this.#logger.warn(...);
  continue; // Silent skip, no error recorded
}
```

**Pattern 2: Error Collection** (lines 214-224):
```javascript
if (normalizationResult.error) {
  errors.push(
    this.#createError(...)
  );
  continue;
}
```

**Pattern 3: Try-Catch with Error Collection** (lines 311-330):
```javascript
try {
  const formatResult = this.#commandFormatter.format(...);
  // ...
} catch (error) {
  errors.push(
    this.#createError(...)
  );
}
```

**Issues**:
- Inconsistent error handling strategy
- Silent failures (pattern 1) vs recorded failures (patterns 2-3)
- No centralized error handling logic
- Different patterns for similar error conditions
- Duplicated error logging and creation logic

### Impact
- Hard to ensure error handling completeness
- Difficult to trace error paths
- Inconsistent error reporting
- Testing requires mocking error creation in multiple places

## Solution Overview

Create a `FormattingErrorHandler` class that centralizes all error handling logic, providing consistent error creation, logging, and recovery patterns.

### Benefits
- ✅ Consistent error handling across all paths
- ✅ Centralized error logging logic
- ✅ Easier to change error handling strategy
- ✅ Testable in isolation
- ✅ Reduces code duplication in error paths

## Implementation Steps

### Step 1: Create FormattingErrorHandler Class

**File**: `src/actions/pipeline/stages/actionFormatting/legacy/FormattingErrorHandler.js`

```javascript
/**
 * @file FormattingErrorHandler - Centralizes error handling for action formatting
 */

/**
 * Centralized error handling strategy for action formatting operations.
 * Provides consistent error creation, logging, and reporting.
 */
class FormattingErrorHandler {
  #logger;
  #createErrorFn;

  /**
   * Creates a new formatting error handler.
   * @param {Object} logger - Logger instance with warn/error/debug methods
   * @param {Function} createErrorFn - Error factory function
   */
  constructor(logger, createErrorFn) {
    this.#logger = logger;
    this.#createErrorFn = createErrorFn;
  }

  /**
   * Handles formatting errors with consistent logging and error creation.
   * @param {Object} params - Error handling parameters
   * @param {Error|Object} params.error - The error that occurred
   * @param {Object} params.actionDef - Action definition being formatted
   * @param {string} params.actorId - Actor ID performing the action
   * @param {Object} params.targetContext - Target context (if applicable)
   * @param {Object} params.trace - Trace object (if applicable)
   * @param {Object} params.context - Additional context for logging
   * @returns {Object} Formatted error object
   */
  handleFormattingError({
    error,
    actionDef,
    actorId,
    targetContext,
    trace,
    context = {},
  }) {
    const targetId = this.#resolveTargetId(error, targetContext);

    this.#logger.warn(
      `Failed to format command for action '${actionDef.id}' with target '${targetId}'`,
      { error, actionDef, targetContext, ...context }
    );

    return this.#createErrorFn(
      error,
      actionDef,
      actorId,
      trace,
      targetContext?.entityId
    );
  }

  /**
   * Handles normalization errors with consistent error creation.
   * @param {Object} params - Error handling parameters
   * @param {Object} params.error - The normalization error
   * @param {Object} params.actionDef - Action definition being formatted
   * @param {string} params.actorId - Actor ID performing the action
   * @param {Object} params.trace - Trace object (if applicable)
   * @returns {Object} Formatted error object
   */
  handleNormalizationError({ error, actionDef, actorId, trace }) {
    this.#logger.warn(
      `Normalization failed for action '${actionDef.id}'`,
      { error, actionDef }
    );

    return this.#createErrorFn(error, actionDef, actorId, trace);
  }

  /**
   * Handles validation errors (e.g., missing targets).
   * Logs warning but does not create error object.
   * @param {Object} params - Validation error parameters
   * @param {string} params.message - Error message
   * @param {Object} params.actionDef - Action definition
   * @param {Object} params.context - Additional context
   */
  handleValidationError({ message, actionDef, context = {} }) {
    this.#logger.warn(
      `Validation failed for action '${actionDef.id}': ${message}`,
      { actionDef, ...context }
    );
  }

  /**
   * Handles unexpected exceptions during formatting.
   * @param {Object} params - Exception parameters
   * @param {Error} params.exception - The exception that occurred
   * @param {Object} params.actionDef - Action definition
   * @param {string} params.actorId - Actor ID
   * @param {Object} params.targetContext - Target context
   * @param {Object} params.trace - Trace object
   * @param {string} params.operation - Operation being performed
   * @returns {Object} Formatted error object
   */
  handleException({
    exception,
    actionDef,
    actorId,
    targetContext,
    trace,
    operation = 'formatting',
  }) {
    const targetId = this.#resolveTargetId(exception, targetContext);

    this.#logger.error(
      `Unexpected exception during ${operation} for action '${actionDef.id}' with target '${targetId}'`,
      { exception, actionDef, targetContext, operation }
    );

    return this.#createErrorFn(
      exception,
      actionDef,
      actorId,
      trace,
      null,
      targetContext?.entityId
    );
  }

  /**
   * Resolves target ID from error or context.
   * @private
   * @param {Error|Object} error - The error object
   * @param {Object} targetContext - Target context
   * @returns {string} Resolved target ID or 'unknown'
   */
  #resolveTargetId(error, targetContext) {
    return (
      error?.target?.entityId ||
      error?.entityId ||
      targetContext?.entityId ||
      'unknown'
    );
  }
}

export default FormattingErrorHandler;
```

### Step 2: Create Comprehensive Unit Tests

**File**: `tests/unit/actions/pipeline/stages/actionFormatting/legacy/FormattingErrorHandler.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import FormattingErrorHandler from '../../../../../../src/actions/pipeline/stages/actionFormatting/legacy/FormattingErrorHandler.js';

describe('FormattingErrorHandler', () => {
  let mockLogger;
  let mockCreateError;
  let handler;

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockCreateError = jest.fn((error, actionDef, actorId, trace, targetId) => ({
      type: 'formatted_error',
      error,
      actionDef,
      actorId,
      trace,
      targetId,
    }));

    handler = new FormattingErrorHandler(mockLogger, mockCreateError);
  });

  describe('handleFormattingError', () => {
    it('should log warning and create error object', () => {
      const error = new Error('Format failed');
      const actionDef = { id: 'test_action', name: 'Test Action' };
      const actorId = 'actor1';
      const targetContext = { entityId: 'target1' };
      const trace = { captureActionData: jest.fn() };

      const result = handler.handleFormattingError({
        error,
        actionDef,
        actorId,
        targetContext,
        trace,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to format command for action 'test_action' with target 'target1'",
        expect.objectContaining({ error, actionDef, targetContext })
      );

      expect(mockCreateError).toHaveBeenCalledWith(
        error,
        actionDef,
        actorId,
        trace,
        'target1'
      );

      expect(result).toEqual({
        type: 'formatted_error',
        error,
        actionDef,
        actorId,
        trace,
        targetId: 'target1',
      });
    });

    it('should resolve target ID from error object', () => {
      const error = { target: { entityId: 'error_target' }, message: 'Failed' };
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';

      handler.handleFormattingError({
        error,
        actionDef,
        actorId,
        targetContext: null,
        trace: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('error_target'),
        expect.anything()
      );
    });

    it('should use "unknown" when target ID cannot be resolved', () => {
      const error = new Error('Failed');
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';

      handler.handleFormattingError({
        error,
        actionDef,
        actorId,
        targetContext: null,
        trace: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
        expect.anything()
      );
    });

    it('should include additional context in logging', () => {
      const error = new Error('Failed');
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';
      const context = { attemptNumber: 2, reason: 'timeout' };

      handler.handleFormattingError({
        error,
        actionDef,
        actorId,
        targetContext: null,
        trace: null,
        context,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining(context)
      );
    });
  });

  describe('handleNormalizationError', () => {
    it('should log warning and create error object', () => {
      const error = { message: 'Normalization failed' };
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';
      const trace = { captureActionData: jest.fn() };

      const result = handler.handleNormalizationError({
        error,
        actionDef,
        actorId,
        trace,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Normalization failed for action 'test_action'",
        expect.objectContaining({ error, actionDef })
      );

      expect(mockCreateError).toHaveBeenCalledWith(
        error,
        actionDef,
        actorId,
        trace
      );
    });
  });

  describe('handleValidationError', () => {
    it('should log warning without creating error object', () => {
      const message = 'Missing required targets';
      const actionDef = { id: 'test_action' };
      const context = { targetCount: 0 };

      handler.handleValidationError({ message, actionDef, context });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Validation failed for action 'test_action': Missing required targets",
        expect.objectContaining({ actionDef, targetCount: 0 })
      );

      expect(mockCreateError).not.toHaveBeenCalled();
    });

    it('should work without additional context', () => {
      const message = 'Invalid action';
      const actionDef = { id: 'test_action' };

      handler.handleValidationError({ message, actionDef });

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('handleException', () => {
    it('should log error and create error object', () => {
      const exception = new Error('Unexpected error');
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';
      const targetContext = { entityId: 'target1' };
      const trace = { captureActionData: jest.fn() };

      const result = handler.handleException({
        exception,
        actionDef,
        actorId,
        targetContext,
        trace,
        operation: 'multi-target formatting',
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Unexpected exception during multi-target formatting for action 'test_action' with target 'target1'",
        expect.objectContaining({ exception, actionDef, targetContext })
      );

      expect(mockCreateError).toHaveBeenCalledWith(
        exception,
        actionDef,
        actorId,
        trace,
        null,
        'target1'
      );
    });

    it('should use default operation name', () => {
      const exception = new Error('Error');
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';

      handler.handleException({
        exception,
        actionDef,
        actorId,
        targetContext: null,
        trace: null,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('formatting'),
        expect.anything()
      );
    });
  });

  describe('target ID resolution', () => {
    it('should prioritize error.target.entityId', () => {
      const error = {
        target: { entityId: 'priority1' },
        entityId: 'priority2',
      };
      const targetContext = { entityId: 'priority3' };

      handler.handleFormattingError({
        error,
        actionDef: { id: 'test' },
        actorId: 'actor1',
        targetContext,
        trace: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('priority1'),
        expect.anything()
      );
    });

    it('should fallback to error.entityId', () => {
      const error = { entityId: 'priority2' };
      const targetContext = { entityId: 'priority3' };

      handler.handleFormattingError({
        error,
        actionDef: { id: 'test' },
        actorId: 'actor1',
        targetContext,
        trace: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('priority2'),
        expect.anything()
      );
    });

    it('should fallback to targetContext.entityId', () => {
      const error = new Error('No entity ID');
      const targetContext = { entityId: 'priority3' };

      handler.handleFormattingError({
        error,
        actionDef: { id: 'test' },
        actorId: 'actor1',
        targetContext,
        trace: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('priority3'),
        expect.anything()
      );
    });
  });
});
```

## Acceptance Criteria

### Functional Requirements
- ✅ `FormattingErrorHandler` class created with all specified methods
- ✅ Handles formatting, normalization, validation, and exception errors
- ✅ Consistent logging for all error types
- ✅ Target ID resolution logic handles all fallback cases
- ✅ Error factory function integration

### Quality Requirements
- ✅ Test coverage >95% (branches and lines)
- ✅ All error handling patterns tested
- ✅ JSDoc documentation complete
- ✅ No ESLint violations
- ✅ Passes TypeScript type checking

### Non-Functional Requirements
- ✅ No changes to `LegacyStrategy.js` yet
- ✅ Zero impact on existing functionality
- ✅ All existing tests still pass

## Testing Requirements

### Unit Tests
- **Coverage Target**: 95%+ branches, 100% functions/lines
- **Test Scenarios**:
  - All error handling methods
  - Target ID resolution priority order
  - Logging calls with correct parameters
  - Error creation with correct parameters
  - Additional context inclusion
  - Default parameter handling

## Validation Steps

```bash
# Run unit tests
npm run test:unit -- tests/unit/actions/pipeline/stages/actionFormatting/legacy/FormattingErrorHandler.test.js

# Verify coverage
npm run test:unit -- tests/unit/actions/pipeline/stages/actionFormatting/legacy/FormattingErrorHandler.test.js --coverage

# Run linter
npx eslint src/actions/pipeline/stages/actionFormatting/legacy/FormattingErrorHandler.js

# Run type checker
npm run typecheck
```

## Files Affected

### New Files
- `src/actions/pipeline/stages/actionFormatting/legacy/FormattingErrorHandler.js`
- `tests/unit/actions/pipeline/stages/actionFormatting/legacy/FormattingErrorHandler.test.js`

### Modified Files
None

## Risk Assessment

### Risk Level: Low

**Mitigation**:
- Comprehensive unit tests
- No integration with existing code yet
- Well-defined error handling patterns

## Related Tickets
- **Blocks**: LEGSTRREF-004, LEGSTRREF-005, LEGSTRREF-006
- **Part of**: Phase 1 - Foundation
- **Related**: LEGSTRREF-000, LEGSTRREF-001
