# Ticket 3: Target Reference Resolution Enhancements

## Overview

Enhance the existing placeholder resolution functionality (implemented in tickets 01 and 02) with validation utilities, better error reporting, and optional performance monitoring. This ticket focuses on improving the robustness and observability of the placeholder resolution system without creating unnecessary architectural complexity.

## Current State

**Already Implemented** (from tickets 01 and 02):
- ✅ Event payload includes resolved target IDs (`primaryId`, `secondaryId`, `tertiaryId`)
- ✅ Placeholder resolution in `entityRefUtils.js` with `isPlaceholderName()` and `resolveTargetPlaceholder()`
- ✅ Integration with `resolveEntityId()` for seamless placeholder resolution in operation handlers
- ✅ Support for both comprehensive format (`targets` object) and flattened format

**What's Missing**:
- ❌ Validation utilities to ensure all required placeholders can be resolved
- ❌ Enhanced error messages when placeholder resolution fails
- ❌ Testing utilities for placeholder resolution scenarios
- ❌ Optional performance metrics for monitoring resolution patterns

## Problem Statement

**Current Issue**: While placeholder resolution works, there's no easy way to validate that all required placeholders for an action can be resolved before rule execution begins. Additionally, error messages could be more helpful when resolution fails.

**Root Cause**: The current implementation focuses on the happy path but lacks comprehensive validation and error handling utilities.

**Target Enhancement**: Add validation utilities and enhanced error reporting to the existing placeholder resolution system, making it more robust and developer-friendly.

## Dependencies

- **Ticket 1**: ✅ COMPLETED - Enhanced event payload structure with resolved target IDs
- **Ticket 2**: ✅ COMPLETED - Enhanced entity reference resolution logic in `entityRefUtils.js`
- **Existing Infrastructure**:
  - `entityRefUtils.js` - Contains current placeholder resolution implementation
  - Logging system - For enhanced error reporting
  - Testing framework - For new validation utilities

## Implementation Details

### 1. Validation Utilities Enhancement

**Step 1.1**: Add validation functions to `entityRefUtils.js`

```javascript
// Add to entityRefUtils.js

/**
 * Validate that all required placeholders can be resolved
 * @param {Array<string>} placeholders - Array of placeholder names to validate
 * @param {Object} eventPayload - Event payload to validate against
 * @returns {Object} Validation result with details
 */
export function validatePlaceholders(placeholders, eventPayload) {
  const result = {
    valid: true,
    resolved: [],
    missing: [],
    available: getAvailableTargets(eventPayload),
    errors: [],
  };

  if (!Array.isArray(placeholders)) {
    result.valid = false;
    result.errors.push({
      errorType: 'INVALID_INPUT',
      message: 'Placeholders must be an array',
    });
    return result;
  }

  // Check each placeholder
  placeholders.forEach((placeholder) => {
    if (!isPlaceholderName(placeholder)) {
      result.missing.push(placeholder);
      result.errors.push({
        placeholder,
        errorType: 'INVALID_PLACEHOLDER',
        message: `'${placeholder}' is not a valid placeholder name`,
        validNames: ['primary', 'secondary', 'tertiary'],
      });
      return;
    }

    const resolvedId = resolveTargetPlaceholder(placeholder, eventPayload);
    if (resolvedId) {
      result.resolved.push(placeholder);
    } else {
      result.missing.push(placeholder);
      result.errors.push({
        placeholder,
        errorType: 'PLACEHOLDER_NOT_RESOLVED',
        message: `Placeholder '${placeholder}' could not be resolved to entity ID`,
        available: result.available,
      });
    }
  });

  result.valid = result.missing.length === 0;
  return result;
}

/**
 * Resolve multiple placeholders in batch
 * @param {Array<string>} placeholders - Array of placeholder names
 * @param {Object} eventPayload - Event payload with target information
 * @returns {Map<string, string|null>} - Map of placeholder to entity ID
 */
export function resolvePlaceholdersBatch(placeholders, eventPayload) {
  const results = new Map();
  
  if (!Array.isArray(placeholders)) {
    return results;
  }

  placeholders.forEach((placeholder) => {
    const entityId = isPlaceholderName(placeholder)
      ? resolveTargetPlaceholder(placeholder, eventPayload)
      : null;
    results.set(placeholder, entityId);
  });

  return results;
}
```

### 2. Enhanced Error Reporting

**Step 2.1**: Update `resolveEntityId` with better error messages

```javascript
// Update resolveEntityId function in entityRefUtils.js

export function resolveEntityId(ref, executionContext) {
  const ec = executionContext?.evaluationContext ?? {};
  const logger = executionContext?.logger;

  if (typeof ref === 'string') {
    const trimmed = ref.trim();
    if (!trimmed) return null;

    // Existing keyword support
    if (trimmed === 'actor') return ec.actor?.id ?? null;
    if (trimmed === 'target') return ec.target?.id ?? null;

    // Enhanced placeholder support with detailed logging
    if (isPlaceholderName(trimmed)) {
      const resolvedId = resolveTargetPlaceholder(trimmed, ec.event?.payload);
      
      if (logger) {
        if (resolvedId) {
          logger.debug(
            `Resolved placeholder '${trimmed}' to entity ID '${resolvedId}'`
          );
        } else {
          // Enhanced error message with available targets
          const availableTargets = getAvailableTargets(ec.event?.payload);
          logger.warn(
            `Failed to resolve placeholder '${trimmed}' - no matching target in event payload`,
            {
              placeholder: trimmed,
              availableTargets,
              eventType: ec.event?.payload?.type,
              actionId: ec.event?.payload?.actionId,
              suggestion: availableTargets.length > 0 
                ? `Available targets: ${availableTargets.join(', ')}`
                : 'No targets available in event payload',
            }
          );
        }
      }

      return resolvedId;
    }

    return trimmed; // Direct entity ID
  }

  // Existing object reference support
  if (
    ref &&
    typeof ref === 'object' &&
    typeof ref.entityId === 'string' &&
    ref.entityId.trim()
  ) {
    return ref.entityId.trim();
  }

  return null;
}
```

### 3. Testing Utilities

**Step 3.1**: Create test helper functions

```javascript
/**
 * @file test/helpers/placeholderTestUtils.js
 * @description Test utilities for placeholder resolution
 */

export class PlaceholderTestUtils {
  /**
   * Create mock event payload with target information
   * @param {Object} options - Payload configuration
   * @returns {Object} - Mock event payload
   */
  static createMockEventPayload(options = {}) {
    const defaults = {
      type: 'core:attempt_action',
      actorId: 'test_actor',
      actionId: 'test:action',
      primaryId: 'test_primary_entity',
      secondaryId: 'test_secondary_entity',
      tertiaryId: null,
      targets: {
        primary: {
          entityId: 'test_primary_entity',
          placeholder: 'primary',
          description: 'Test Primary Entity',
        },
        secondary: {
          entityId: 'test_secondary_entity',
          placeholder: 'secondary',
          description: 'Test Secondary Entity',
        },
      },
    };

    return { ...defaults, ...options };
  }

  /**
   * Assert validation results
   * @param {Object} result - Validation result
   * @param {Object} expectations - Expected validation outcome
   */
  static assertValidationResult(result, expectations) {
    expect(result.valid).toBe(expectations.valid);
    expect(result.resolved).toEqual(
      expect.arrayContaining(expectations.resolved || [])
    );
    expect(result.missing).toEqual(
      expect.arrayContaining(expectations.missing || [])
    );

    if (expectations.errorCount !== undefined) {
      expect(result.errors).toHaveLength(expectations.errorCount);
    }
  }

  /**
   * Create execution context with mock logger
   * @param {Object} eventPayload - Event payload
   * @returns {Object} - Execution context
   */
  static createExecutionContext(eventPayload) {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    return {
      evaluationContext: {
        event: { payload: eventPayload },
        actor: { id: eventPayload.actorId },
        target: { id: eventPayload.targetId },
      },
      logger: mockLogger,
    };
  }
}
```

### 4. Optional Performance Monitoring

**Step 4.1**: Add lightweight metrics collection (optional)

```javascript
// Add to entityRefUtils.js if performance monitoring is needed

// Simple metrics object (no external dependencies)
const placeholderMetrics = {
  resolutionCount: 0,
  successCount: 0,
  failureCount: 0,
  
  recordResolution(success) {
    this.resolutionCount++;
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
  },
  
  getMetrics() {
    return {
      total: this.resolutionCount,
      success: this.successCount,
      failure: this.failureCount,
      successRate: this.resolutionCount > 0 
        ? this.successCount / this.resolutionCount 
        : 0,
    };
  },
  
  reset() {
    this.resolutionCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
  }
};

// Update resolveTargetPlaceholder to include metrics
function resolveTargetPlaceholder(placeholder, eventPayload) {
  if (!eventPayload) {
    placeholderMetrics.recordResolution(false);
    return null;
  }

  // Try comprehensive format first (from Ticket 1)
  if (eventPayload.targets && eventPayload.targets[placeholder]) {
    const targetInfo = eventPayload.targets[placeholder];
    // Handle both string IDs and object entries
    if (typeof targetInfo === 'string') {
      placeholderMetrics.recordResolution(true);
      return targetInfo;
    }
    if (targetInfo.entityId) {
      placeholderMetrics.recordResolution(true);
      return targetInfo.entityId;
    }
  }

  // Fall back to flattened format (primaryId, secondaryId, tertiaryId)
  const fieldName = `${placeholder}Id`;
  if (eventPayload[fieldName]) {
    placeholderMetrics.recordResolution(true);
    return eventPayload[fieldName];
  }

  // No resolution found
  placeholderMetrics.recordResolution(false);
  return null;
}

// Export metrics for monitoring
export { placeholderMetrics };
```

## Acceptance Criteria

### Core Functionality Criteria

1. ✅ **Validation Functions**: Add `validatePlaceholders()` and `resolvePlaceholdersBatch()` to entityRefUtils.js
2. ✅ **Enhanced Error Messages**: Improve error reporting in `resolveEntityId()` with helpful context
3. ✅ **Available Target Detection**: Leverage existing `getAvailableTargets()` function
4. ✅ **Placeholder Recognition**: Use existing `isPlaceholderName()` function
5. ✅ **Batch Resolution**: Support for resolving multiple placeholders efficiently

### Enhancement Criteria

6. ✅ **Detailed Error Context**: Error messages include available targets and suggestions
7. ✅ **Validation Result Structure**: Clear structure with resolved/missing arrays and error details
8. ✅ **Testing Utilities**: Helper functions for creating test scenarios
9. ✅ **Optional Metrics**: Lightweight performance monitoring (if needed)
10. ✅ **No Breaking Changes**: All enhancements are additive, no existing functionality changes

### Quality Criteria

11. ✅ **Input Validation**: Validate array inputs and placeholder names
12. ✅ **Clear Documentation**: JSDoc comments for all new functions
13. ✅ **Test Coverage**: Unit tests for new validation functions
14. ✅ **Backward Compatibility**: Works with both event payload formats
15. ✅ **Simple Implementation**: No unnecessary complexity or dependencies

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/utils/entityRefUtils.placeholders.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validatePlaceholders,
  resolvePlaceholdersBatch,
  resolveEntityId,
} from '../../../src/utils/entityRefUtils.js';
import { PlaceholderTestUtils } from '../../helpers/placeholderTestUtils.js';

describe('entityRefUtils - Placeholder Enhancements', () => {
  let mockEventPayload;
  let executionContext;

  beforeEach(() => {
    mockEventPayload = PlaceholderTestUtils.createMockEventPayload();
    executionContext = PlaceholderTestUtils.createExecutionContext(mockEventPayload);
  });

  describe('validatePlaceholders', () => {
    it('should validate successful placeholder resolution', () => {
      const result = validatePlaceholders(
        ['primary', 'secondary'],
        mockEventPayload
      );

      PlaceholderTestUtils.assertValidationResult(result, {
        valid: true,
        resolved: ['primary', 'secondary'],
        missing: [],
        errorCount: 0,
      });
    });

    it('should detect missing placeholders', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        primaryId: null,
        targets: {},
      });

      const result = validatePlaceholders(['primary'], eventPayload);

      PlaceholderTestUtils.assertValidationResult(result, {
        valid: false,
        resolved: [],
        missing: ['primary'],
        errorCount: 1,
      });

      expect(result.errors[0].errorType).toBe('PLACEHOLDER_NOT_RESOLVED');
    });

    it('should handle invalid placeholder names', () => {
      const result = validatePlaceholders(
        ['invalid_placeholder'],
        mockEventPayload
      );

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('invalid_placeholder');
      expect(result.errors[0].errorType).toBe('INVALID_PLACEHOLDER');
    });

    it('should handle non-array input gracefully', () => {
      const result = validatePlaceholders('not-an-array', mockEventPayload);

      expect(result.valid).toBe(false);
      expect(result.errors[0].errorType).toBe('INVALID_INPUT');
    });
  });

  describe('resolvePlaceholdersBatch', () => {
    it('should resolve multiple placeholders efficiently', () => {
      const results = resolvePlaceholdersBatch(
        ['primary', 'secondary', 'tertiary'],
        mockEventPayload
      );

      expect(results.size).toBe(3);
      expect(results.get('primary')).toBe('test_primary_entity');
      expect(results.get('secondary')).toBe('test_secondary_entity');
      expect(results.get('tertiary')).toBeNull();
    });

    it('should handle invalid placeholders in batch', () => {
      const results = resolvePlaceholdersBatch(
        ['primary', 'invalid'],
        mockEventPayload
      );

      expect(results.get('primary')).toBe('test_primary_entity');
      expect(results.get('invalid')).toBeNull();
    });

    it('should return empty map for non-array input', () => {
      const results = resolvePlaceholdersBatch('not-an-array', mockEventPayload);
      expect(results.size).toBe(0);
    });
  });

  describe('Enhanced Error Reporting', () => {
    it('should log detailed error with available targets', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        primaryId: null,
        targets: {},
      });
      const context = PlaceholderTestUtils.createExecutionContext(eventPayload);

      const result = resolveEntityId('primary', context);

      expect(result).toBeNull();
      expect(context.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve placeholder'),
        expect.objectContaining({
          placeholder: 'primary',
          availableTargets: [],
          suggestion: 'No targets available in event payload',
        })
      );
    });

    it('should suggest available targets when resolution fails', () => {
      const eventPayload = PlaceholderTestUtils.createMockEventPayload({
        primaryId: null,
        secondaryId: 'entity_2',
        targets: {},
      });
      const context = PlaceholderTestUtils.createExecutionContext(eventPayload);

      resolveEntityId('primary', context);

      expect(context.logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          availableTargets: ['secondary'],
          suggestion: 'Available targets: secondary',
        })
      );
    });
  });
});
```

### Integration Tests

```javascript
// tests/integration/placeholder-resolution.integration.test.js
describe('Placeholder Resolution Integration', () => {
  it('should work with operation handlers', async () => {
    const testBed = new IntegrationTestBed();
    const eventPayload = {
      type: 'core:attempt_action',
      actorId: 'actor_123',
      primaryId: 'target_456',
      actionId: 'test:action',
      targets: {
        primary: { entityId: 'target_456' },
      },
    };

    // Test that GET_NAME operation resolves placeholders correctly
    const getNameHandler = testBed.getOperationHandler('GET_NAME');
    const result = await getNameHandler.execute(
      { entity_ref: 'primary' },
      { evaluationContext: { event: { payload: eventPayload } } }
    );

    expect(result).toBeDefined();
    expect(result).not.toBe('Unnamed Character');
  });

  it('should validate placeholders before rule execution', async () => {
    const eventPayload = {
      type: 'core:attempt_action',
      actorId: 'amaia_id',
      actionId: 'intimacy:adjust_clothing',
      primaryId: 'iker_id',
      secondaryId: 'jacket_id',
    };

    // Validate required placeholders
    const validation = validatePlaceholders(
      ['primary', 'secondary'],
      eventPayload
    );

    expect(validation.valid).toBe(true);
    expect(validation.resolved).toEqual(['primary', 'secondary']);
  });
});
```

## Performance Benchmarks

- Single placeholder resolution: <0.1ms (already in memory)
- Batch resolution (3 placeholders): <0.3ms
- Validation function: <1ms
- Enhanced error logging: Negligible overhead

## Dependencies and Prerequisites

### Completed Dependencies

- **Ticket 1**: ✅ Enhanced event payload structure with resolved target IDs
- **Ticket 2**: ✅ Placeholder resolution in `entityRefUtils.js`

### Existing Infrastructure

- `entityRefUtils.js` - Current implementation location
- Jest testing framework - For unit tests
- Logging system - Already integrated

## Notes and Considerations

### Implementation Order

1. **Phase 1**: Add validation functions to `entityRefUtils.js`
2. **Phase 2**: Enhance error messages in `resolveEntityId()`
3. **Phase 3**: Create test utilities
4. **Phase 4**: Add unit tests
5. **Phase 5**: Optional: Add lightweight metrics

### Key Benefits

- **No Breaking Changes**: All enhancements are additive
- **Simple Implementation**: Builds on existing code
- **Better Developer Experience**: Clear error messages and validation
- **Testability**: Easy to test placeholder resolution scenarios

### Future Considerations

- Custom placeholder names could be added if needed
- Performance metrics could be expanded if monitoring is required
- Could be extracted to a service later if complexity grows

This ticket transforms from creating a new service to enhancing the existing placeholder resolution with practical utilities that improve developer experience and system robustness.
