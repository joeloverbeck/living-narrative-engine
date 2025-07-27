# Ticket 10: Implement Backward Compatibility Layer

## Overview

Implement a comprehensive backward compatibility layer to ensure the enhanced CommandProcessor maintains 100% compatibility with existing single-target actions, legacy event formats, and current rule processing while providing a seamless transition path for future multi-target adoption.

## Dependencies

- Ticket 07: Implement Multi-Target Data Extraction (must be completed)
- Ticket 08: Update Attempt Action Payload Creation (must be completed)
- Ticket 09: Add Command Processor Unit Tests (must be completed)

## Blocks

- Phase 3: Rules System Integration (all tickets)
- Ticket 14: Comprehensive Integration Testing

## Priority: Critical

## Estimated Time: 6-8 hours

## Background

While the enhanced CommandProcessor supports multi-target actions, it must maintain perfect backward compatibility with existing single-target actions and legacy event formats. This ticket implements validation mechanisms, compatibility adapters, and monitoring to ensure seamless operation with existing game content.

## Implementation Details

### 1. Create Compatibility Validation Service

**File**: `src/services/backwardCompatibilityService.js`

```javascript
/**
 * @file Service for ensuring backward compatibility with legacy systems
 */

import { ensureValidLogger } from '../utils/loggerUtils.js';
import { validateAttemptActionPayload } from '../utils/multiTargetValidationUtils.js';

/**
 * Service for validating and ensuring backward compatibility
 */
export class BackwardCompatibilityService {
  #logger;
  #compatibilityMetrics;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
    this.#compatibilityMetrics = {
      totalValidations: 0,
      legacyFormatValidations: 0,
      enhancedFormatValidations: 0,
      compatibilityIssues: 0,
      performanceRegressions: 0
    };
  }

  /**
   * Validates payload for backward compatibility
   * @param {Object} payload - Event payload to validate
   * @param {Object} context - Validation context
   * @returns {Object} Compatibility validation result
   */
  validatePayloadCompatibility(payload, context = {}) {
    const startTime = performance.now();
    
    try {
      this.#compatibilityMetrics.totalValidations++;

      const validation = {
        isCompatible: true,
        formatType: this.#determineFormatType(payload),
        issues: [],
        warnings: [],
        recommendations: []
      };

      // Validate based on format type
      if (validation.formatType === 'legacy') {
        this.#compatibilityMetrics.legacyFormatValidations++;
        this.#validateLegacyFormat(payload, validation, context);
      } else {
        this.#compatibilityMetrics.enhancedFormatValidations++;
        this.#validateEnhancedFormat(payload, validation, context);
      }

      // Check for performance compatibility
      this.#validatePerformanceCompatibility(payload, validation, context);

      // Update metrics
      if (!validation.isCompatible) {
        this.#compatibilityMetrics.compatibilityIssues++;
      }

      const duration = performance.now() - startTime;
      this.#logValidationResult(validation, duration, context);

      return validation;

    } catch (error) {
      this.#logger.error('Compatibility validation failed', {
        error: error.message,
        payload: this.#sanitizePayload(payload),
        context
      });

      return {
        isCompatible: false,
        formatType: 'unknown',
        issues: [`Validation error: ${error.message}`],
        warnings: [],
        recommendations: ['Review payload structure and retry validation']
      };
    }
  }

  /**
   * Determines the format type of a payload
   * @param {Object} payload - Payload to analyze
   * @returns {string} Format type: 'legacy', 'enhanced', or 'unknown'
   */
  #determineFormatType(payload) {
    if (!payload || typeof payload !== 'object') {
      return 'unknown';
    }

    // Enhanced format has targets object and targetId
    if (payload.targets && typeof payload.targets === 'object' && payload.targetId) {
      return 'enhanced';
    }

    // Legacy format has only targetId (or null) and no targets
    if (payload.hasOwnProperty('targetId') && !payload.targets) {
      return 'legacy';
    }

    return 'unknown';
  }

  /**
   * Validates legacy format payload
   * @param {Object} payload - Legacy payload
   * @param {Object} validation - Validation result object
   * @param {Object} context - Validation context
   */
  #validateLegacyFormat(payload, validation, context) {
    const requiredFields = ['eventName', 'actorId', 'actionId', 'originalInput'];
    const optionalFields = ['targetId', 'timestamp'];
    const allowedFields = [...requiredFields, ...optionalFields];

    // Check required fields
    for (const field of requiredFields) {
      if (!payload.hasOwnProperty(field) || payload[field] === undefined) {
        validation.isCompatible = false;
        validation.issues.push(`Missing required field: ${field}`);
      }
    }

    // Check for unexpected fields
    const payloadFields = Object.keys(payload);
    const unexpectedFields = payloadFields.filter(field => !allowedFields.includes(field));
    
    if (unexpectedFields.length > 0) {
      validation.isCompatible = false;
      validation.issues.push(`Unexpected fields in legacy format: ${unexpectedFields.join(', ')}`);
    }

    // Validate field types
    this.#validateLegacyFieldTypes(payload, validation);

    // Validate eventName value
    if (payload.eventName !== 'core:attempt_action') {
      validation.isCompatible = false;
      validation.issues.push(`Invalid eventName: expected 'core:attempt_action', got '${payload.eventName}'`);
    }

    // Validate targetId format
    if (payload.targetId !== null && payload.targetId !== undefined) {
      if (typeof payload.targetId !== 'string' || payload.targetId.trim() === '') {
        validation.warnings.push('targetId should be a non-empty string or null');
      }
    }

    // Check for targets object (should not exist in legacy)
    if (payload.hasOwnProperty('targets')) {
      validation.isCompatible = false;
      validation.issues.push('Legacy format should not contain targets object');
    }
  }

  /**
   * Validates enhanced format payload
   * @param {Object} payload - Enhanced payload
   * @param {Object} validation - Validation result object
   * @param {Object} context - Validation context
   */
  #validateEnhancedFormat(payload, validation, context) {
    // Use existing validation utility
    const payloadValidation = validateAttemptActionPayload(payload);
    
    if (!payloadValidation.isValid) {
      validation.isCompatible = false;
      validation.issues.push(...payloadValidation.errors);
    }

    validation.warnings.push(...payloadValidation.warnings);

    // Additional enhanced format checks
    this.#validateEnhancedFormatSpecifics(payload, validation);

    // Check backward compatibility requirements
    this.#validateBackwardCompatibilityRequirements(payload, validation);
  }

  /**
   * Validates legacy field types
   * @param {Object} payload - Legacy payload
   * @param {Object} validation - Validation result object
   */
  #validateLegacyFieldTypes(payload, validation) {
    const typeChecks = [
      { field: 'eventName', type: 'string' },
      { field: 'actorId', type: 'string' },
      { field: 'actionId', type: 'string' },
      { field: 'originalInput', type: 'string' },
      { field: 'timestamp', type: 'number', optional: true }
    ];

    for (const check of typeChecks) {
      if (payload.hasOwnProperty(check.field)) {
        if (typeof payload[check.field] !== check.type) {
          validation.isCompatible = false;
          validation.issues.push(`Field ${check.field} must be ${check.type}, got ${typeof payload[check.field]}`);
        }
      }
    }

    // Special handling for targetId (can be string or null)
    if (payload.hasOwnProperty('targetId')) {
      const targetId = payload.targetId;
      if (targetId !== null && typeof targetId !== 'string') {
        validation.isCompatible = false;
        validation.issues.push(`targetId must be string or null, got ${typeof targetId}`);
      }
    }
  }

  /**
   * Validates enhanced format specific requirements
   * @param {Object} payload - Enhanced payload
   * @param {Object} validation - Validation result object
   */
  #validateEnhancedFormatSpecifics(payload, validation) {
    // Targets object validation
    if (payload.targets) {
      if (typeof payload.targets !== 'object' || Array.isArray(payload.targets)) {
        validation.isCompatible = false;
        validation.issues.push('targets must be a non-array object');
        return;
      }

      const targetCount = Object.keys(payload.targets).length;
      
      // Should have at least one target if targets object exists
      if (targetCount === 0) {
        validation.isCompatible = false;
        validation.issues.push('targets object cannot be empty');
      }

      // Validate target values
      for (const [key, value] of Object.entries(payload.targets)) {
        if (typeof value !== 'string' || value.trim() === '') {
          validation.isCompatible = false;
          validation.issues.push(`Target '${key}' must be a non-empty string`);
        }
      }

      // Performance warning for excessive targets
      if (targetCount > 10) {
        validation.warnings.push(`High target count (${targetCount}) may impact performance`);
      }
    }
  }

  /**
   * Validates backward compatibility requirements for enhanced format
   * @param {Object} payload - Enhanced payload
   * @param {Object} validation - Validation result object
   */
  #validateBackwardCompatibilityRequirements(payload, validation) {
    // Enhanced format must have targetId for backward compatibility
    if (payload.targets && !payload.hasOwnProperty('targetId')) {
      validation.isCompatible = false;
      validation.issues.push('Enhanced format must include targetId for backward compatibility');
    }

    // targetId should match one of the targets
    if (payload.targets && payload.targetId) {
      const targetValues = Object.values(payload.targets);
      if (!targetValues.includes(payload.targetId)) {
        validation.warnings.push('targetId does not match any target in targets object');
        validation.recommendations.push('Ensure targetId represents the primary target');
      }
    }

    // Recommend migration path for multi-target actions
    if (payload.targets && Object.keys(payload.targets).length > 1) {
      validation.recommendations.push('Consider updating rules to use enhanced target access patterns');
    }
  }

  /**
   * Validates performance compatibility
   * @param {Object} payload - Payload to validate
   * @param {Object} validation - Validation result object
   * @param {Object} context - Validation context
   */
  #validatePerformanceCompatibility(payload, validation, context) {
    // Check payload size
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > 10000) { // 10KB limit
      validation.warnings.push(`Large payload size (${payloadSize} bytes) may impact performance`);
    }

    // Check for performance regression indicators
    if (context.processingTime && context.processingTime > 10) {
      this.#compatibilityMetrics.performanceRegressions++;
      validation.warnings.push(`Processing time (${context.processingTime.toFixed(2)}ms) exceeds recommended limit`);
      validation.recommendations.push('Consider optimizing action or target resolution');
    }
  }

  /**
   * Creates compatibility adapter for legacy systems
   * @param {Object} enhancedPayload - Enhanced format payload
   * @returns {Object} Legacy format payload
   */
  createLegacyAdapter(enhancedPayload) {
    if (!enhancedPayload || typeof enhancedPayload !== 'object') {
      throw new Error('Invalid enhanced payload for legacy adaptation');
    }

    // Create legacy format payload
    const legacyPayload = {
      eventName: enhancedPayload.eventName,
      actorId: enhancedPayload.actorId,
      actionId: enhancedPayload.actionId,
      targetId: enhancedPayload.targetId,
      originalInput: enhancedPayload.originalInput
    };

    // Include timestamp if present
    if (enhancedPayload.timestamp) {
      legacyPayload.timestamp = enhancedPayload.timestamp;
    }

    this.#logger.debug('Created legacy adapter', {
      originalFormat: 'enhanced',
      adaptedFormat: 'legacy',
      hasTargets: !!enhancedPayload.targets,
      targetCount: enhancedPayload.targets ? Object.keys(enhancedPayload.targets).length : 0
    });

    return legacyPayload;
  }

  /**
   * Creates enhanced adapter from legacy payload
   * @param {Object} legacyPayload - Legacy format payload
   * @param {Object} options - Adaptation options
   * @returns {Object} Enhanced format payload
   */
  createEnhancedAdapter(legacyPayload, options = {}) {
    if (!legacyPayload || typeof legacyPayload !== 'object') {
      throw new Error('Invalid legacy payload for enhanced adaptation');
    }

    const enhancedPayload = { ...legacyPayload };

    // Convert single target to targets object if requested
    if (options.createTargetsObject && legacyPayload.targetId) {
      enhancedPayload.targets = {
        primary: legacyPayload.targetId
      };
    }

    this.#logger.debug('Created enhanced adapter', {
      originalFormat: 'legacy',
      adaptedFormat: 'enhanced',
      createdTargetsObject: options.createTargetsObject && !!legacyPayload.targetId
    });

    return enhancedPayload;
  }

  /**
   * Sanitizes payload for logging
   * @param {Object} payload - Payload to sanitize
   * @returns {Object} Sanitized payload info
   */
  #sanitizePayload(payload) {
    if (!payload) return null;

    return {
      eventName: payload.eventName,
      hasActorId: !!payload.actorId,
      hasActionId: !!payload.actionId,
      hasTargetId: payload.hasOwnProperty('targetId'),
      hasTargets: !!payload.targets,
      targetCount: payload.targets ? Object.keys(payload.targets).length : 0,
      fieldCount: Object.keys(payload).length
    };
  }

  /**
   * Logs validation result
   * @param {Object} validation - Validation result
   * @param {number} duration - Validation duration
   * @param {Object} context - Validation context
   */
  #logValidationResult(validation, duration, context) {
    const logData = {
      formatType: validation.formatType,
      isCompatible: validation.isCompatible,
      issueCount: validation.issues.length,
      warningCount: validation.warnings.length,
      validationTime: duration.toFixed(2),
      context
    };

    if (validation.isCompatible) {
      this.#logger.debug('Compatibility validation passed', logData);
    } else {
      this.#logger.warn('Compatibility validation failed', {
        ...logData,
        issues: validation.issues,
        warnings: validation.warnings
      });
    }
  }

  /**
   * Gets compatibility metrics
   * @returns {Object} Compatibility metrics
   */
  getCompatibilityMetrics() {
    const metrics = { ...this.#compatibilityMetrics };
    
    if (metrics.totalValidations > 0) {
      metrics.legacyFormatRate = metrics.legacyFormatValidations / metrics.totalValidations;
      metrics.enhancedFormatRate = metrics.enhancedFormatValidations / metrics.totalValidations;
      metrics.compatibilityRate = (metrics.totalValidations - metrics.compatibilityIssues) / metrics.totalValidations;
      metrics.performanceRegressionRate = metrics.performanceRegressions / metrics.totalValidations;
    } else {
      metrics.legacyFormatRate = 0;
      metrics.enhancedFormatRate = 0;
      metrics.compatibilityRate = 1;
      metrics.performanceRegressionRate = 0;
    }

    return metrics;
  }

  /**
   * Resets compatibility metrics
   */
  resetCompatibilityMetrics() {
    this.#compatibilityMetrics = {
      totalValidations: 0,
      legacyFormatValidations: 0,
      enhancedFormatValidations: 0,
      compatibilityIssues: 0,
      performanceRegressions: 0
    };
  }

  /**
   * Validates system-wide compatibility
   * @param {Array} payloads - Array of payloads to validate
   * @returns {Object} System compatibility report
   */
  validateSystemCompatibility(payloads) {
    const report = {
      totalPayloads: payloads.length,
      compatiblePayloads: 0,
      incompatiblePayloads: 0,
      legacyPayloads: 0,
      enhancedPayloads: 0,
      issues: [],
      warnings: [],
      recommendations: []
    };

    for (const payload of payloads) {
      const validation = this.validatePayloadCompatibility(payload);
      
      if (validation.isCompatible) {
        report.compatiblePayloads++;
      } else {
        report.incompatiblePayloads++;
        report.issues.push(...validation.issues);
      }

      if (validation.formatType === 'legacy') {
        report.legacyPayloads++;
      } else if (validation.formatType === 'enhanced') {
        report.enhancedPayloads++;
      }

      report.warnings.push(...validation.warnings);
      report.recommendations.push(...validation.recommendations);
    }

    // Calculate rates
    report.compatibilityRate = report.compatiblePayloads / report.totalPayloads;
    report.legacyRate = report.legacyPayloads / report.totalPayloads;
    report.enhancedRate = report.enhancedPayloads / report.totalPayloads;

    return report;
  }
}

export default BackwardCompatibilityService;
```

### 2. Integrate Compatibility Service with CommandProcessor

**File**: `src/commands/commandProcessor.js` (additions)

Add compatibility validation to the CommandProcessor:

```javascript
// Add import
import BackwardCompatibilityService from '../services/backwardCompatibilityService.js';

// Add to constructor
constructor({ logger, eventBus }) {
  // ... existing initialization ...
  
  this.#backwardCompatibilityService = new BackwardCompatibilityService({ logger });
}

/**
 * Enhanced createAttemptActionPayload with compatibility validation
 */
async #createAttemptActionPayload(actor, turnAction) {
  const startTime = performance.now();
  let extractionResult = null;
  let isFallback = false;
  
  try {
    // ... existing payload creation logic ...
    
    const payload = eventBuilder.build();
    const duration = performance.now() - startTime;

    // Validate backward compatibility
    const compatibilityValidation = this.#backwardCompatibilityService.validatePayloadCompatibility(
      payload, 
      { 
        processingTime: duration,
        isMultiTarget: extractionResult.hasMultipleTargets(),
        source: 'enhanced_creation'
      }
    );

    // Log compatibility warnings
    if (compatibilityValidation.warnings.length > 0) {
      this.#logger.warn('Payload compatibility warnings', {
        warnings: compatibilityValidation.warnings,
        recommendations: compatibilityValidation.recommendations
      });
    }

    // Handle compatibility issues
    if (!compatibilityValidation.isCompatible) {
      this.#logger.error('Payload compatibility validation failed', {
        issues: compatibilityValidation.issues,
        payload: this.#sanitizePayload(payload)
      });
      
      // Try to create compatible fallback
      if (compatibilityValidation.formatType === 'enhanced') {
        const legacyPayload = this.#backwardCompatibilityService.createLegacyAdapter(payload);
        this.#logger.info('Created legacy adapter for compatibility');
        return legacyPayload;
      }
    }

    // Update metrics and log
    this.#updatePayloadMetrics(payload, extractionResult, duration, false);
    this.#logPayloadCreation(payload, extractionResult, duration);

    return payload;

  } catch (error) {
    // ... existing error handling ...
  }
}

/**
 * Validates system-wide compatibility
 * @returns {Object} System compatibility report
 */
validateSystemCompatibility() {
  // This would be called during system initialization or health checks
  const samplePayloads = this.#generateSamplePayloads();
  return this.#backwardCompatibilityService.validateSystemCompatibility(samplePayloads);
}

/**
 * Gets compatibility metrics for monitoring
 * @returns {Object} Compatibility metrics
 */
getCompatibilityMetrics() {
  return this.#backwardCompatibilityService.getCompatibilityMetrics();
}

/**
 * Generates sample payloads for compatibility testing
 * @returns {Array} Sample payloads
 */
#generateSamplePayloads() {
  return [
    // Legacy format samples
    {
      eventName: 'core:attempt_action',
      actorId: 'sample_actor',
      actionId: 'core:follow',
      targetId: 'sample_target',
      originalInput: 'follow target',
      timestamp: Date.now()
    },
    {
      eventName: 'core:attempt_action',
      actorId: 'sample_actor',
      actionId: 'core:emote',
      targetId: null,
      originalInput: 'smile',
      timestamp: Date.now()
    },
    // Enhanced format samples
    {
      eventName: 'core:attempt_action',
      actorId: 'sample_actor',
      actionId: 'combat:throw',
      targets: {
        item: 'sample_knife',
        target: 'sample_goblin'
      },
      targetId: 'sample_knife',
      originalInput: 'throw knife at goblin',
      timestamp: Date.now()
    }
  ];
}
```

### 3. Create Compatibility Tests

**File**: `tests/unit/services/backwardCompatibilityService.test.js`

```javascript
/**
 * @file Tests for BackwardCompatibilityService
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../common/testbed.js';
import BackwardCompatibilityService from '../../../src/services/backwardCompatibilityService.js';

describe('BackwardCompatibilityService', () => {
  let testBed;
  let service;
  let logger;

  beforeEach(() => {
    testBed = new TestBedClass();
    logger = testBed.createMockLogger();
    service = new BackwardCompatibilityService({ logger });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Format Type Detection', () => {
    it('should detect legacy format correctly', () => {
      const legacyPayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice'
      };

      const validation = service.validatePayloadCompatibility(legacyPayload);

      expect(validation.formatType).toBe('legacy');
      expect(validation.isCompatible).toBe(true);
    });

    it('should detect enhanced format correctly', () => {
      const enhancedPayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'combat:throw',
        targets: {
          item: 'knife_123',
          target: 'goblin_456'
        },
        targetId: 'knife_123',
        originalInput: 'throw knife at goblin'
      };

      const validation = service.validatePayloadCompatibility(enhancedPayload);

      expect(validation.formatType).toBe('enhanced');
      expect(validation.isCompatible).toBe(true);
    });

    it('should detect unknown format', () => {
      const unknownPayload = {
        randomField: 'value'
      };

      const validation = service.validatePayloadCompatibility(unknownPayload);

      expect(validation.formatType).toBe('unknown');
      expect(validation.isCompatible).toBe(false);
    });
  });

  describe('Legacy Format Validation', () => {
    it('should validate correct legacy format', () => {
      const legacyPayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice',
        timestamp: Date.now()
      };

      const validation = service.validatePayloadCompatibility(legacyPayload);

      expect(validation.isCompatible).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should reject legacy format with extra fields', () => {
      const invalidPayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice',
        targets: { item: 'item_123' } // Should not exist in legacy
      };

      const validation = service.validatePayloadCompatibility(invalidPayload);

      expect(validation.isCompatible).toBe(false);
      expect(validation.issues).toContain('Legacy format should not contain targets object');
    });

    it('should validate legacy format with null targetId', () => {
      const emotePayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:emote',
        targetId: null,
        originalInput: 'smile'
      };

      const validation = service.validatePayloadCompatibility(emotePayload);

      expect(validation.isCompatible).toBe(true);
    });

    it('should reject legacy format missing required fields', () => {
      const incompletePayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123'
        // Missing actionId and originalInput
      };

      const validation = service.validatePayloadCompatibility(incompletePayload);

      expect(validation.isCompatible).toBe(false);
      expect(validation.issues).toContain('Missing required field: actionId');
      expect(validation.issues).toContain('Missing required field: originalInput');
    });
  });

  describe('Enhanced Format Validation', () => {
    it('should validate correct enhanced format', () => {
      const enhancedPayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'combat:throw',
        targets: {
          item: 'knife_123',
          target: 'goblin_456'
        },
        targetId: 'knife_123',
        originalInput: 'throw knife at goblin',
        timestamp: Date.now()
      };

      const validation = service.validatePayloadCompatibility(enhancedPayload);

      expect(validation.isCompatible).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should require targetId for backward compatibility', () => {
      const payloadWithoutTargetId = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'combat:throw',
        targets: {
          item: 'knife_123',
          target: 'goblin_456'
        },
        originalInput: 'throw knife at goblin'
      };

      const validation = service.validatePayloadCompatibility(payloadWithoutTargetId);

      expect(validation.isCompatible).toBe(false);
      expect(validation.issues).toContain('Enhanced format must include targetId for backward compatibility');
    });

    it('should warn about targetId mismatch', () => {
      const mismatchedPayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'combat:throw',
        targets: {
          item: 'knife_123',
          target: 'goblin_456'
        },
        targetId: 'different_id',
        originalInput: 'throw knife at goblin'
      };

      const validation = service.validatePayloadCompatibility(mismatchedPayload);

      expect(validation.isCompatible).toBe(true);
      expect(validation.warnings).toContain('targetId does not match any target in targets object');
    });

    it('should reject empty targets object', () => {
      const emptyTargetsPayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        targets: {},
        targetId: 'target_123',
        originalInput: 'test action'
      };

      const validation = service.validatePayloadCompatibility(emptyTargetsPayload);

      expect(validation.isCompatible).toBe(false);
      expect(validation.issues).toContain('targets object cannot be empty');
    });
  });

  describe('Compatibility Adapters', () => {
    it('should create legacy adapter from enhanced payload', () => {
      const enhancedPayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'combat:throw',
        targets: {
          item: 'knife_123',
          target: 'goblin_456'
        },
        targetId: 'knife_123',
        originalInput: 'throw knife at goblin',
        timestamp: Date.now()
      };

      const legacyPayload = service.createLegacyAdapter(enhancedPayload);

      expect(legacyPayload).toEqual({
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'combat:throw',
        targetId: 'knife_123',
        originalInput: 'throw knife at goblin',
        timestamp: enhancedPayload.timestamp
      });

      // Verify no targets object
      expect(legacyPayload.targets).toBeUndefined();
    });

    it('should create enhanced adapter from legacy payload', () => {
      const legacyPayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice'
      };

      const enhancedPayload = service.createEnhancedAdapter(legacyPayload, {
        createTargetsObject: true
      });

      expect(enhancedPayload).toEqual({
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice',
        targets: {
          primary: 'target_456'
        }
      });
    });
  });

  describe('Performance Compatibility', () => {
    it('should warn about large payload sizes', () => {
      const largePayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:large',
        targetId: 'target_123',
        originalInput: 'large payload test',
        // Add large amount of data
        largeData: 'x'.repeat(15000)
      };

      const validation = service.validatePayloadCompatibility(largePayload);

      expect(validation.warnings).toContain(
        expect.stringContaining('Large payload size')
      );
    });

    it('should warn about processing time regressions', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:slow',
        targetId: 'target_123',
        originalInput: 'slow processing test'
      };

      const validation = service.validatePayloadCompatibility(payload, {
        processingTime: 15 // Exceeds 10ms limit
      });

      expect(validation.warnings).toContain(
        expect.stringContaining('Processing time')
      );
    });
  });

  describe('System Compatibility', () => {
    it('should validate system-wide compatibility', () => {
      const payloads = [
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_1',
          actionId: 'core:follow',
          targetId: 'target_1',
          originalInput: 'follow'
        },
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_2',
          actionId: 'combat:throw',
          targets: { item: 'item_1', target: 'target_2' },
          targetId: 'item_1',
          originalInput: 'throw'
        },
        {
          eventName: 'invalid:format'
          // Missing required fields
        }
      ];

      const report = service.validateSystemCompatibility(payloads);

      expect(report.totalPayloads).toBe(3);
      expect(report.compatiblePayloads).toBe(2);
      expect(report.incompatiblePayloads).toBe(1);
      expect(report.legacyPayloads).toBe(1);
      expect(report.enhancedPayloads).toBe(1);
      expect(report.compatibilityRate).toBeCloseTo(2/3);
    });
  });

  describe('Metrics Tracking', () => {
    it('should track compatibility metrics', () => {
      const payloads = [
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_1',
          actionId: 'core:follow',
          targetId: 'target_1',
          originalInput: 'follow'
        },
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_2',
          actionId: 'combat:throw',
          targets: { item: 'item_1', target: 'target_2' },
          targetId: 'item_1',
          originalInput: 'throw'
        }
      ];

      // Validate multiple payloads
      payloads.forEach(payload => {
        service.validatePayloadCompatibility(payload);
      });

      const metrics = service.getCompatibilityMetrics();

      expect(metrics.totalValidations).toBe(2);
      expect(metrics.legacyFormatValidations).toBe(1);
      expect(metrics.enhancedFormatValidations).toBe(1);
      expect(metrics.compatibilityIssues).toBe(0);
      expect(metrics.compatibilityRate).toBe(1);
    });

    it('should reset metrics correctly', () => {
      // Validate a payload
      service.validatePayloadCompatibility({
        eventName: 'core:attempt_action',
        actorId: 'actor_1',
        actionId: 'core:follow',
        targetId: 'target_1',
        originalInput: 'follow'
      });

      // Reset metrics
      service.resetCompatibilityMetrics();
      const metrics = service.getCompatibilityMetrics();

      expect(metrics.totalValidations).toBe(0);
      expect(metrics.compatibilityRate).toBe(1);
    });
  });
});
```

## Testing Requirements

### 1. Comprehensive Compatibility Testing

- **Legacy format validation**: All legacy payload variations
- **Enhanced format validation**: Multi-target payload compatibility
- **Adapter functionality**: Bidirectional payload conversion
- **Performance compatibility**: No regression for legacy actions
- **System-wide validation**: Batch compatibility assessment

### 2. Integration Testing

- **CommandProcessor integration**: Compatibility service integration
- **Event dispatch compatibility**: Legacy event format preservation
- **Performance monitoring**: Metrics collection and reporting

### 3. Edge Case Testing

- **Malformed payloads**: Invalid data handling
- **Missing fields**: Required field validation
- **Large payloads**: Performance impact assessment
- **Error conditions**: Graceful failure handling

## Success Criteria

1. **100% Backward Compatibility**: All existing legacy actions work unchanged
2. **Performance Parity**: No regression in legacy action processing
3. **Seamless Migration**: Clear path from legacy to enhanced format
4. **Comprehensive Validation**: All format combinations properly validated
5. **Monitoring**: Complete visibility into compatibility status

## Files Created

- `src/services/backwardCompatibilityService.js`
- `tests/unit/services/backwardCompatibilityService.test.js`

## Files Modified

- `src/commands/commandProcessor.js` (add compatibility integration)

## Validation Steps

1. Run all compatibility service tests and verify 100% pass rate
2. Test CommandProcessor integration with compatibility validation
3. Verify legacy format preservation under all conditions
4. Test performance impact of compatibility checking
5. Validate system-wide compatibility reporting

## Notes

- Compatibility service provides comprehensive validation and monitoring
- Adapters enable seamless migration between formats
- Performance monitoring ensures no regression for legacy actions
- System-wide validation enables operational confidence

## Risk Assessment

**Low Risk**: Additive compatibility layer that preserves all existing functionality. Comprehensive testing ensures no breaking changes while providing enhanced capabilities.

## Next Steps

After this ticket completion:
1. Complete Phase 2 with full backward compatibility assurance
2. Move to Phase 3: Rules System Integration
3. Begin rule enhancement for multi-target support