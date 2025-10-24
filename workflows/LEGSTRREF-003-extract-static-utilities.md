# LEGSTRREF-003: Extract Static Utilities

## Metadata
- **Ticket ID**: LEGSTRREF-003
- **Phase**: 1 - Foundation
- **Priority**: Medium
- **Effort**: 0.5 days
- **Status**: Not Started
- **Dependencies**: None
- **Blocks**: LEGSTRREF-004, LEGSTRREF-010

## Problem Statement

Two utility functions in `LegacyStrategy` can be extracted as static utilities:
- `validateVisualProperties` (called 2 times)
- `createError` (called 10+ times)

Moving these to static utilities reduces constructor dependencies and improves testability.

## Implementation Steps

### Step 1: Create FormattingUtils Class

**File**: `src/actions/pipeline/stages/actionFormatting/legacy/FormattingUtils.js`

```javascript
/**
 * Static utility functions for action formatting.
 */
class FormattingUtils {
  /**
   * Validates visual properties of an action.
   * @param {Object|null} visual - Visual properties to validate
   * @param {string} actionId - Action ID for error messages
   * @throws {Error} If visual properties are invalid
   */
  static validateVisualProperties(visual, actionId) {
    if (!visual) {
      return; // Visual properties are optional
    }

    if (typeof visual !== 'object') {
      throw new Error(
        `Invalid visual properties for action '${actionId}': must be an object`
      );
    }

    // Add specific validation rules as needed
    const validKeys = ['icon', 'color', 'description', 'category'];
    const invalidKeys = Object.keys(visual).filter(
      (key) => !validKeys.includes(key)
    );

    if (invalidKeys.length > 0) {
      throw new Error(
        `Invalid visual property keys for action '${actionId}': ${invalidKeys.join(', ')}`
      );
    }
  }

  /**
   * Creates a formatted error object for action formatting failures.
   * @param {Error|Object} payload - Error payload
   * @param {Object} action - Action definition
   * @param {string} actorId - Actor ID
   * @param {Object} trace - Trace object
   * @param {string} resolvedTargetId - Resolved target ID
   * @param {string} originalTargetId - Original target ID
   * @returns {Object} Formatted error object
   */
  static createError(
    payload,
    action,
    actorId,
    trace,
    resolvedTargetId = null,
    originalTargetId = null
  ) {
    const errorMessage =
      payload?.message || payload?.error || 'Unknown error during formatting';

    return {
      type: 'ACTION_FORMATTING_ERROR',
      actionId: action.id,
      actionName: action.name,
      actorId,
      targetId: resolvedTargetId || originalTargetId || 'unknown',
      error: errorMessage,
      timestamp: Date.now(),
      trace: trace ? 'enabled' : 'disabled',
    };
  }
}

export default FormattingUtils;
```

### Step 2: Create Unit Tests

**File**: `tests/unit/actions/pipeline/stages/actionFormatting/legacy/FormattingUtils.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import FormattingUtils from '../../../../../../src/actions/pipeline/stages/actionFormatting/legacy/FormattingUtils.js';

describe('FormattingUtils', () => {
  describe('validateVisualProperties', () => {
    it('should accept null visual properties', () => {
      expect(() => {
        FormattingUtils.validateVisualProperties(null, 'test_action');
      }).not.toThrow();
    });

    it('should accept undefined visual properties', () => {
      expect(() => {
        FormattingUtils.validateVisualProperties(undefined, 'test_action');
      }).not.toThrow();
    });

    it('should accept valid visual properties', () => {
      const visual = { icon: 'sword', color: 'red' };
      expect(() => {
        FormattingUtils.validateVisualProperties(visual, 'test_action');
      }).not.toThrow();
    });

    it('should reject non-object visual properties', () => {
      expect(() => {
        FormattingUtils.validateVisualProperties('invalid', 'test_action');
      }).toThrow('must be an object');
    });

    it('should reject invalid property keys', () => {
      const visual = { invalidKey: 'value' };
      expect(() => {
        FormattingUtils.validateVisualProperties(visual, 'test_action');
      }).toThrow('Invalid visual property keys');
    });
  });

  describe('createError', () => {
    it('should create error object with all parameters', () => {
      const payload = new Error('Test error');
      const action = { id: 'test_action', name: 'Test Action' };
      const actorId = 'actor1';
      const trace = { captureActionData: jest.fn() };

      const error = FormattingUtils.createError(
        payload,
        action,
        actorId,
        trace,
        'target1',
        'original_target1'
      );

      expect(error).toMatchObject({
        type: 'ACTION_FORMATTING_ERROR',
        actionId: 'test_action',
        actionName: 'Test Action',
        actorId: 'actor1',
        targetId: 'target1',
        error: 'Test error',
        trace: 'enabled',
      });
      expect(error.timestamp).toBeDefined();
    });

    it('should handle payload with error property', () => {
      const payload = { error: 'Custom error message' };
      const action = { id: 'test_action', name: 'Test Action' };

      const error = FormattingUtils.createError(payload, action, 'actor1', null);

      expect(error.error).toBe('Custom error message');
    });

    it('should use default error message for invalid payload', () => {
      const payload = {};
      const action = { id: 'test_action', name: 'Test Action' };

      const error = FormattingUtils.createError(payload, action, 'actor1', null);

      expect(error.error).toBe('Unknown error during formatting');
    });

    it('should handle missing target IDs', () => {
      const payload = new Error('Test');
      const action = { id: 'test_action', name: 'Test Action' };

      const error = FormattingUtils.createError(payload, action, 'actor1', null);

      expect(error.targetId).toBe('unknown');
    });

    it('should prefer resolvedTargetId over originalTargetId', () => {
      const payload = new Error('Test');
      const action = { id: 'test_action', name: 'Test Action' };

      const error = FormattingUtils.createError(
        payload,
        action,
        'actor1',
        null,
        'resolved',
        'original'
      );

      expect(error.targetId).toBe('resolved');
    });

    it('should use originalTargetId when resolvedTargetId is null', () => {
      const payload = new Error('Test');
      const action = { id: 'test_action', name: 'Test Action' };

      const error = FormattingUtils.createError(
        payload,
        action,
        'actor1',
        null,
        null,
        'original'
      );

      expect(error.targetId).toBe('original');
    });
  });
});
```

## Acceptance Criteria

- ✅ `FormattingUtils` class created with static methods
- ✅ `validateVisualProperties` validates visual properties
- ✅ `createError` creates formatted error objects
- ✅ Test coverage >95%
- ✅ All tests passing
- ✅ No ESLint violations

## Validation Steps

```bash
npm run test:unit -- tests/unit/actions/pipeline/stages/actionFormatting/legacy/FormattingUtils.test.js
npx eslint src/actions/pipeline/stages/actionFormatting/legacy/FormattingUtils.js
```

## Files Affected

### New Files
- `src/actions/pipeline/stages/actionFormatting/legacy/FormattingUtils.js`
- `tests/unit/actions/pipeline/stages/actionFormatting/legacy/FormattingUtils.test.js`

## Related Tickets
- **Blocks**: LEGSTRREF-004, LEGSTRREF-010
- **Part of**: Phase 1 - Foundation
