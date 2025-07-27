# Ticket 03: Add Multi-Target Validation Rules

## Overview

Implement comprehensive validation logic for multi-target events beyond basic schema validation. This includes consistency checks, business rules, and enhanced error reporting to ensure data integrity and provide helpful feedback to developers and modders.

## Dependencies

- Ticket 01: Update Event Schema (must be completed)
- Ticket 02: Create Schema Validation Tests (must be completed)

## Blocks

- Ticket 07: Implement Multi-Target Data Extraction
- Ticket 11: Create Multi-Target Rule Examples

## Priority: High

## Estimated Time: 6-8 hours

## Background

While the enhanced schema provides basic structural validation, we need additional validation rules to ensure:
1. Target consistency between `targets` object and `targetId`
2. Business logic validation for multi-target scenarios
3. Enhanced error messages with actionable guidance
4. Performance optimization for validation workflows
5. Integration with the existing validation pipeline

## Implementation Details

### 1. Create Multi-Target Validator Class

**File**: `src/validation/multiTargetEventValidator.js`

```javascript
/**
 * @file Multi-target event validation with enhanced business rules
 */

import { assertPresent, assertNonBlankString } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';

/**
 * Validates multi-target events with business rules and consistency checks
 */
export class MultiTargetEventValidator {
  #logger;
  #performanceMetrics;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
    this.#performanceMetrics = {
      validationCount: 0,
      totalTime: 0,
      errorCount: 0
    };
  }

  /**
   * Validates a multi-target event with comprehensive checks
   * @param {Object} event - Event payload to validate
   * @returns {Object} Validation result with errors and warnings
   */
  validateEvent(event) {
    const startTime = performance.now();
    
    try {
      assertPresent(event, 'Event payload is required');
      
      const result = this.#performValidation(event);
      
      this.#updateMetrics(startTime, result.errors.length > 0);
      
      return result;
    } catch (error) {
      this.#logger.error('Multi-target validation failed', error);
      this.#updateMetrics(startTime, true);
      
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        details: {}
      };
    }
  }

  /**
   * Performs comprehensive validation checks
   * @param {Object} event - Event to validate
   * @returns {Object} Validation result
   */
  #performValidation(event) {
    const errors = [];
    const warnings = [];
    const details = {
      hasMultipleTargets: false,
      targetCount: 0,
      primaryTarget: null,
      consistencyIssues: []
    };

    // Basic structure validation
    this.#validateBasicStructure(event, errors);
    
    // Multi-target specific validation
    if (event.targets && typeof event.targets === 'object') {
      this.#validateTargetsObject(event, errors, warnings, details);
      this.#validateTargetConsistency(event, warnings, details);
    }
    
    // Legacy compatibility validation
    this.#validateLegacyCompatibility(event, errors, warnings);
    
    // Business rule validation
    this.#validateBusinessRules(event, errors, warnings, details);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details
    };
  }

  /**
   * Validates basic event structure
   * @param {Object} event - Event to validate
   * @param {Array} errors - Error collection
   */
  #validateBasicStructure(event, errors) {
    // These should be caught by schema validation, but double-check
    if (!event.eventName || event.eventName !== 'core:attempt_action') {
      errors.push('Invalid event name - must be "core:attempt_action"');
    }

    if (!event.actorId || typeof event.actorId !== 'string' || !event.actorId.trim()) {
      errors.push('actorId must be a non-empty string');
    }

    if (!event.actionId || typeof event.actionId !== 'string' || !event.actionId.trim()) {
      errors.push('actionId must be a non-empty string');
    }

    if (!event.originalInput || typeof event.originalInput !== 'string' || !event.originalInput.trim()) {
      errors.push('originalInput must be a non-empty string');
    }

    // Must have either targets or targetId
    if (!event.targets && !event.targetId) {
      errors.push('Event must have either targets object or targetId field');
    }
  }

  /**
   * Validates targets object structure and content
   * @param {Object} event - Event to validate
   * @param {Array} errors - Error collection
   * @param {Array} warnings - Warning collection
   * @param {Object} details - Validation details
   */
  #validateTargetsObject(event, errors, warnings, details) {
    const targets = event.targets;
    
    // Check if targets object is empty
    const targetKeys = Object.keys(targets);
    if (targetKeys.length === 0) {
      errors.push('targets object cannot be empty');
      return;
    }

    details.targetCount = targetKeys.length;
    details.hasMultipleTargets = targetKeys.length > 1;

    // Validate each target
    for (const [key, targetId] of Object.entries(targets)) {
      if (!this.#isValidTargetKey(key)) {
        warnings.push(`Target key "${key}" should follow naming conventions (alphanumeric with underscores)`);
      }

      if (!targetId || typeof targetId !== 'string' || !targetId.trim()) {
        errors.push(`Target "${key}" must have a non-empty string value`);
        continue;
      }

      if (!this.#isValidEntityId(targetId)) {
        warnings.push(`Target "${key}" ID "${targetId}" should follow entity ID format (letters, numbers, underscore, colon)`);
      }
    }

    // Determine primary target
    details.primaryTarget = this.#determinePrimaryTarget(targets);
  }

  /**
   * Validates consistency between targets object and targetId
   * @param {Object} event - Event to validate
   * @param {Array} warnings - Warning collection
   * @param {Object} details - Validation details
   */
  #validateTargetConsistency(event, warnings, details) {
    if (!event.targets || !event.targetId) {
      return;
    }

    const targets = event.targets;
    const targetId = event.targetId;
    
    // Check if targetId matches any target in targets object
    const targetValues = Object.values(targets);
    if (!targetValues.includes(targetId)) {
      warnings.push(`targetId "${targetId}" does not match any target in targets object`);
      details.consistencyIssues.push('targetId_mismatch');
    }

    // Check if targetId matches expected primary target
    const expectedPrimary = details.primaryTarget;
    if (expectedPrimary && targetId !== expectedPrimary) {
      warnings.push(`targetId "${targetId}" does not match expected primary target "${expectedPrimary}"`);
      details.consistencyIssues.push('primary_target_mismatch');
    }

    // Check for duplicate targets
    const uniqueTargets = new Set(targetValues);
    if (uniqueTargets.size !== targetValues.length) {
      warnings.push('targets object contains duplicate target IDs');
      details.consistencyIssues.push('duplicate_targets');
    }
  }

  /**
   * Validates legacy compatibility requirements
   * @param {Object} event - Event to validate
   * @param {Array} errors - Error collection
   * @param {Array} warnings - Warning collection
   */
  #validateLegacyCompatibility(event, errors, warnings) {
    // If using targets object, must also have targetId for backward compatibility
    if (event.targets && Object.keys(event.targets).length > 0 && !event.targetId) {
      errors.push('targetId is required for backward compatibility when targets object is present');
    }

    // Legacy events should work unchanged
    if (event.targetId && !event.targets) {
      // This is a legacy event - ensure it's properly structured
      if (event.targetId === null || event.targetId === '') {
        // Null targetId is allowed for actions without targets (like emotes)
        return;
      }

      if (typeof event.targetId !== 'string') {
        errors.push('Legacy targetId must be a string or null');
      }
    }
  }

  /**
   * Validates business rules for multi-target events
   * @param {Object} event - Event to validate
   * @param {Array} errors - Error collection
   * @param {Array} warnings - Warning collection
   * @param {Object} details - Validation details
   */
  #validateBusinessRules(event, errors, warnings, details) {
    // Check for reasonable target limits
    if (details.targetCount > 10) {
      warnings.push(`Event has ${details.targetCount} targets - consider if this is necessary for performance`);
    }

    // Validate common target naming patterns
    if (event.targets) {
      this.#validateTargetNamingPatterns(event.targets, warnings);
    }

    // Check for potential target relationship issues
    if (event.actorId && details.primaryTarget && event.actorId === details.primaryTarget) {
      warnings.push('Actor and primary target are the same entity - verify this is intentional');
    }

    // Validate action-target compatibility (if we have action definitions available)
    this.#validateActionTargetCompatibility(event, warnings);
  }

  /**
   * Validates target naming patterns and conventions
   * @param {Object} targets - Targets object
   * @param {Array} warnings - Warning collection
   */
  #validateTargetNamingPatterns(targets, warnings) {
    const commonPatterns = {
      'primary': 'Primary target',
      'secondary': 'Secondary target', 
      'item': 'Item being used',
      'target': 'Target of action',
      'recipient': 'Recipient of action',
      'location': 'Location reference',
      'tool': 'Tool being used',
      'container': 'Container reference'
    };

    const targetKeys = Object.keys(targets);
    
    // Check for good naming patterns
    const hasDescriptiveNames = targetKeys.some(key => 
      key.length > 2 && !key.match(/^(t1|t2|t3|obj|tgt)$/i)
    );

    if (!hasDescriptiveNames && targetKeys.length > 1) {
      warnings.push('Consider using descriptive target names (e.g., "item", "recipient") instead of generic names');
    }

    // Check for conflicting primary/target patterns
    if (targets.primary && targets.target && targets.primary === targets.target) {
      warnings.push('primary and target refer to the same entity - consider using just one');
    }
  }

  /**
   * Validates action-target compatibility
   * @param {Object} event - Event to validate
   * @param {Array} warnings - Warning collection
   */
  #validateActionTargetCompatibility(event, warnings) {
    // This is a placeholder for future action-specific validation
    // When action definitions are available, we can validate:
    // - Required target types for specific actions
    // - Valid target combinations
    // - Action-specific target naming conventions
    
    this.#logger.debug('Action-target compatibility validation not yet implemented', {
      actionId: event.actionId,
      targetCount: event.targets ? Object.keys(event.targets).length : 0
    });
  }

  /**
   * Determines the primary target from targets object
   * @param {Object} targets - Targets object
   * @returns {string|null} Primary target ID
   */
  #determinePrimaryTarget(targets) {
    // Prefer explicit 'primary' key
    if (targets.primary) {
      return targets.primary;
    }

    // Common primary target key patterns
    const primaryPatterns = ['target', 'recipient', 'item', 'person'];
    for (const pattern of primaryPatterns) {
      if (targets[pattern]) {
        return targets[pattern];
      }
    }

    // Fallback to first target
    const firstKey = Object.keys(targets)[0];
    return firstKey ? targets[firstKey] : null;
  }

  /**
   * Validates target key naming conventions
   * @param {string} key - Target key to validate
   * @returns {boolean} True if key follows conventions
   */
  #isValidTargetKey(key) {
    // Allow alphanumeric characters and underscores
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(key);
  }

  /**
   * Validates entity ID format
   * @param {string} entityId - Entity ID to validate
   * @returns {boolean} True if ID follows conventions
   */
  #isValidEntityId(entityId) {
    // Allow letters, numbers, underscores, and colons (for namespaced IDs)
    return /^[a-zA-Z0-9_:]+$/.test(entityId);
  }

  /**
   * Updates performance metrics
   * @param {number} startTime - Validation start time
   * @param {boolean} hasErrors - Whether validation had errors
   */
  #updateMetrics(startTime, hasErrors) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.#performanceMetrics.validationCount++;
    this.#performanceMetrics.totalTime += duration;
    
    if (hasErrors) {
      this.#performanceMetrics.errorCount++;
    }

    // Log performance warnings
    if (duration > 10) {
      this.#logger.warn('Multi-target validation took longer than expected', {
        duration: duration.toFixed(2),
        target: '< 10ms'
      });
    }
  }

  /**
   * Gets performance metrics for monitoring
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    const metrics = { ...this.#performanceMetrics };
    
    if (metrics.validationCount > 0) {
      metrics.averageTime = metrics.totalTime / metrics.validationCount;
      metrics.errorRate = metrics.errorCount / metrics.validationCount;
    } else {
      metrics.averageTime = 0;
      metrics.errorRate = 0;
    }

    return metrics;
  }

  /**
   * Resets performance metrics
   */
  resetPerformanceMetrics() {
    this.#performanceMetrics = {
      validationCount: 0,
      totalTime: 0,
      errorCount: 0
    };
  }
}

export default MultiTargetEventValidator;
```

### 2. Create Validation Integration

**File**: `src/validation/eventValidationService.js`

```javascript
/**
 * @file Enhanced event validation service with multi-target support
 */

import { validateDependency } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import MultiTargetEventValidator from './multiTargetEventValidator.js';

/**
 * Service for validating events with schema and business rule validation
 */
export class EventValidationService {
  #logger;
  #schemaValidator;
  #multiTargetValidator;

  constructor({ logger, schemaValidator }) {
    this.#logger = ensureValidLogger(logger);
    validateDependency(schemaValidator, 'IAjvSchemaValidator');
    
    this.#schemaValidator = schemaValidator;
    this.#multiTargetValidator = new MultiTargetEventValidator({ logger });
  }

  /**
   * Validates an event with comprehensive checks
   * @param {Object} event - Event to validate
   * @param {string} schemaId - Schema ID for validation
   * @returns {Object} Complete validation result
   */
  async validateEvent(event, schemaId = 'core:attempt_action') {
    try {
      // Step 1: Schema validation
      const schemaResult = await this.#schemaValidator.validate(schemaId, event);
      
      // If schema validation fails, return early
      if (!schemaResult.isValid) {
        return {
          isValid: false,
          errors: schemaResult.errors || [],
          warnings: [],
          source: 'schema',
          details: {}
        };
      }

      // Step 2: Multi-target business rule validation
      const businessResult = this.#multiTargetValidator.validateEvent(event);
      
      // Combine results
      return {
        isValid: businessResult.isValid,
        errors: [...(schemaResult.errors || []), ...businessResult.errors],
        warnings: [...(schemaResult.warnings || []), ...businessResult.warnings],
        source: businessResult.isValid ? 'complete' : 'business_rules',
        details: businessResult.details
      };

    } catch (error) {
      this.#logger.error('Event validation failed', error);
      
      return {
        isValid: false,
        errors: [`Validation service error: ${error.message}`],
        warnings: [],
        source: 'service',
        details: {}
      };
    }
  }

  /**
   * Validates multiple events in batch
   * @param {Array} events - Events to validate
   * @param {string} schemaId - Schema ID for validation
   * @returns {Array} Validation results for each event
   */
  async validateEvents(events, schemaId = 'core:attempt_action') {
    const results = [];
    
    for (let i = 0; i < events.length; i++) {
      try {
        const result = await this.validateEvent(events[i], schemaId);
        results.push({
          index: i,
          event: events[i],
          ...result
        });
      } catch (error) {
        this.#logger.error(`Failed to validate event at index ${i}`, error);
        results.push({
          index: i,
          event: events[i],
          isValid: false,
          errors: [`Validation error: ${error.message}`],
          warnings: [],
          source: 'batch_error',
          details: {}
        });
      }
    }

    return results;
  }

  /**
   * Gets validation performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      schema: this.#schemaValidator.getPerformanceMetrics?.() || {},
      multiTarget: this.#multiTargetValidator.getPerformanceMetrics()
    };
  }

  /**
   * Resets validation performance metrics
   */
  resetPerformanceMetrics() {
    this.#schemaValidator.resetPerformanceMetrics?.();
    this.#multiTargetValidator.resetPerformanceMetrics();
  }
}

export default EventValidationService;
```

### 3. Create Validation Tests

**File**: `tests/unit/validation/multiTargetEventValidator.test.js`

```javascript
/**
 * @file Tests for multi-target event validator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../common/testbed.js';
import MultiTargetEventValidator from '../../../src/validation/multiTargetEventValidator.js';
import { createValidLegacyEvent, createValidMultiTargetEvent } from '../../common/schemaTestHelpers.js';

describe('MultiTargetEventValidator', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = new TestBedClass();
    const logger = testBed.createMockLogger();
    validator = new MultiTargetEventValidator({ logger });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Basic Validation', () => {
    it('should validate correct legacy events', () => {
      const event = createValidLegacyEvent();
      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details.hasMultipleTargets).toBe(false);
    });

    it('should validate correct multi-target events', () => {
      const event = createValidMultiTargetEvent({
        item: 'knife_123',
        target: 'goblin_456'
      });
      
      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details.hasMultipleTargets).toBe(true);
      expect(result.details.targetCount).toBe(2);
    });

    it('should reject events with empty targets object', () => {
      const event = createValidMultiTargetEvent({}, {
        targets: {}
      });
      
      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('targets object cannot be empty');
    });
  });

  describe('Target Consistency Validation', () => {
    it('should warn when targetId does not match any target', () => {
      const event = createValidMultiTargetEvent({
        item: 'knife_123',
        target: 'goblin_456'
      }, {
        targetId: 'different_id'
      });
      
      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('targetId "different_id" does not match any target in targets object');
      expect(result.details.consistencyIssues).toContain('targetId_mismatch');
    });

    it('should warn about duplicate targets', () => {
      const event = createValidMultiTargetEvent({
        item: 'same_id',
        target: 'same_id'
      });
      
      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('targets object contains duplicate target IDs');
      expect(result.details.consistencyIssues).toContain('duplicate_targets');
    });

    it('should determine primary target correctly', () => {
      const event = createValidMultiTargetEvent({
        primary: 'primary_target',
        secondary: 'secondary_target'
      });
      
      const result = validator.validateEvent(event);

      expect(result.details.primaryTarget).toBe('primary_target');
    });

    it('should fallback to first target when no primary', () => {
      const event = createValidMultiTargetEvent({
        item: 'item_id',
        recipient: 'recipient_id'
      });
      
      const result = validator.validateEvent(event);

      expect(result.details.primaryTarget).toBe('item_id');
    });
  });

  describe('Business Rule Validation', () => {
    it('should warn about excessive target count', () => {
      const targets = {};
      for (let i = 1; i <= 12; i++) {
        targets[`target${i}`] = `id_${i}`;
      }
      
      const event = createValidMultiTargetEvent(targets);
      const result = validator.validateEvent(event);

      expect(result.warnings).toContain('Event has 12 targets - consider if this is necessary for performance');
    });

    it('should warn when actor and primary target are the same', () => {
      const event = createValidMultiTargetEvent({
        primary: 'actor_123'
      }, {
        actorId: 'actor_123'
      });
      
      const result = validator.validateEvent(event);

      expect(result.warnings).toContain('Actor and primary target are the same entity - verify this is intentional');
    });

    it('should validate target key naming patterns', () => {
      const event = createValidMultiTargetEvent({
        'invalid-key': 'target_1',
        '123numeric': 'target_2'
      });
      
      const result = validator.validateEvent(event);

      expect(result.warnings).toContain('Target key "invalid-key" should follow naming conventions (alphanumeric with underscores)');
      expect(result.warnings).toContain('Target key "123numeric" should follow naming conventions (alphanumeric with underscores)');
    });

    it('should suggest descriptive target names', () => {
      const event = createValidMultiTargetEvent({
        t1: 'target_1',
        t2: 'target_2',
        obj: 'target_3'
      });
      
      const result = validator.validateEvent(event);

      expect(result.warnings).toContain('Consider using descriptive target names (e.g., "item", "recipient") instead of generic names');
    });
  });

  describe('Legacy Compatibility', () => {
    it('should require targetId when targets object exists', () => {
      const event = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {
          item: 'item_123'
        },
        originalInput: 'test action'
        // Missing targetId
      };
      
      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('targetId is required for backward compatibility when targets object is present');
    });

    it('should handle null targetId for actions without targets', () => {
      const event = createValidLegacyEvent({
        targetId: null,
        actionId: 'core:emote'
      });
      
      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track validation performance metrics', () => {
      const event = createValidLegacyEvent();
      
      // Perform several validations
      for (let i = 0; i < 5; i++) {
        validator.validateEvent(event);
      }
      
      const metrics = validator.getPerformanceMetrics();
      
      expect(metrics.validationCount).toBe(5);
      expect(metrics.totalTime).toBeGreaterThan(0);
      expect(metrics.averageTime).toBeGreaterThan(0);
      expect(metrics.errorRate).toBe(0);
    });

    it('should reset performance metrics', () => {
      const event = createValidLegacyEvent();
      validator.validateEvent(event);
      
      validator.resetPerformanceMetrics();
      const metrics = validator.getPerformanceMetrics();
      
      expect(metrics.validationCount).toBe(0);
      expect(metrics.totalTime).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', () => {
      const result = validator.validateEvent(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Validation error: Event payload is required');
    });

    it('should handle malformed event objects', () => {
      const result = validator.validateEvent({});

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
```

## Testing Requirements

### 1. Unit Test Coverage

- **Basic validation** for legacy and multi-target events
- **Target consistency** checks and warnings
- **Business rule validation** including edge cases
- **Performance monitoring** and metrics tracking
- **Error handling** for malformed input

### 2. Integration Testing

- Integration with existing validation pipeline
- Performance testing with realistic event volumes
- Memory usage validation

### 3. Performance Requirements

- Validation time < 10ms per event
- Memory overhead < 100KB for validator instance
- Metrics collection overhead < 1ms per validation

## Success Criteria

1. **Validation Accuracy**: >99% correct classification of valid/invalid events
2. **Performance**: All validation performance targets met
3. **Coverage**: >95% code coverage for validation logic
4. **Integration**: Seamless integration with existing validation pipeline
5. **Documentation**: Clear error messages and warnings for all scenarios

## Files Created

- `src/validation/multiTargetEventValidator.js`
- `src/validation/eventValidationService.js`
- `tests/unit/validation/multiTargetEventValidator.test.js`

## Files Modified

- None (new validation layer)

## Validation Steps

1. Run all unit tests for multi-target validation
2. Test integration with existing schema validation
3. Verify performance requirements are met
4. Test with various event formats and edge cases
5. Validate error message quality and clarity

## Notes

- Validation rules are designed to be non-breaking for existing events
- Performance metrics enable monitoring of validation overhead
- Business rules can be extended for action-specific validation
- Warning system provides guidance without breaking compatibility

## Risk Assessment

**Low Risk**: Additive validation layer that enhances existing functionality without breaking changes. Performance monitoring ensures no degradation.

## Next Steps

After this ticket completion:
1. Move to Phase 2: Command Processor Enhancement
2. Begin Ticket 07: Implement Multi-Target Data Extraction
3. Integrate validation with command processing pipeline