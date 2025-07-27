# Ticket 07: Implement Multi-Target Data Extraction

## Overview

Implement the core multi-target data extraction logic in the CommandProcessor. This is the critical component that extracts multi-target data from the action formatting stage and converts it into standardized target structures for event creation. This addresses the core bottleneck identified in the specification.

## Dependencies

- Ticket 01: Update Event Schema (must be completed)
- Ticket 06: Create Multi-Target Data Structures (must be completed)

## Blocks

- Ticket 08: Update Attempt Action Payload Creation
- Ticket 09: Add Command Processor Unit Tests

## Priority: Critical

## Estimated Time: 8-10 hours

## Background

The specification identifies that multi-target data flows through the formatting pipeline but is lost at the command processor bottleneck. The CommandProcessor currently only extracts a single `targetId` from `resolvedParameters`, discarding the rich multi-target data from the `ActionFormattingStage`. This ticket implements the missing extraction logic.

## Implementation Details

### 1. Enhance CommandProcessor with Multi-Target Extraction

**File**: `src/commands/commandProcessor.js`

Add the multi-target data extraction method to the existing CommandProcessor class:

```javascript
// Add these imports at the top of the file
import TargetManager from '../entities/multiTarget/targetManager.js';
import TargetExtractionResult from '../entities/multiTarget/targetExtractionResult.js';

/**
 * Extracts multi-target data from resolved parameters
 * @param {Object} resolvedParameters - Parameters from action formatting stage
 * @returns {TargetExtractionResult} Structured target data
 */
#extractMultiTargetData(resolvedParameters) {
  const startTime = performance.now();

  try {
    // Validate input
    if (!resolvedParameters) {
      this.#logger.debug('No resolved parameters provided for target extraction');
      return TargetExtractionResult.createEmpty(this.#logger);
    }

    // Multi-target path: Check for multi-target formatting data
    if (resolvedParameters.isMultiTarget && resolvedParameters.targetIds) {
      return this.#processMultiTargetData(resolvedParameters);
    }

    // Legacy single-target path
    return this.#processLegacyTargetData(resolvedParameters);

  } catch (error) {
    this.#logger.error('Multi-target data extraction failed', {
      error: error.message,
      resolvedParameters: this.#sanitizeForLogging(resolvedParameters)
    });

    // Return empty result on error rather than throwing
    return TargetExtractionResult.createEmpty(this.#logger);
  } finally {
    const duration = performance.now() - startTime;
    if (duration > 5) {
      this.#logger.warn('Multi-target extraction took longer than expected', {
        duration: duration.toFixed(2),
        target: '< 5ms'
      });
    }
  }
}

/**
 * Processes multi-target data from formatting stage
 * @param {Object} resolvedParameters - Resolved parameters with multi-target data
 * @returns {TargetExtractionResult} Multi-target extraction result
 */
#processMultiTargetData(resolvedParameters) {
  this.#logger.debug('Processing multi-target data', {
    isMultiTarget: resolvedParameters.isMultiTarget,
    targetIdsKeys: Object.keys(resolvedParameters.targetIds || {})
  });

  const targetManager = new TargetManager({ logger: this.#logger });
  const extractionMetadata = {
    source: 'multi_target_formatting',
    isMultiTarget: true,
    originalTargetIds: resolvedParameters.targetIds,
    extractionTime: Date.now()
  };

  try {
    // Process targetIds object from formatting stage
    const targets = this.#convertTargetIdsToTargets(resolvedParameters.targetIds);

    if (Object.keys(targets).length === 0) {
      this.#logger.warn('Multi-target formatting produced no valid targets', {
        originalTargetIds: resolvedParameters.targetIds
      });
      return TargetExtractionResult.createEmpty(this.#logger);
    }

    targetManager.setTargets(targets);

    // Add extraction statistics
    extractionMetadata.targetCount = Object.keys(targets).length;
    extractionMetadata.primaryTarget = targetManager.getPrimaryTarget();
    extractionMetadata.targetCategories = Object.keys(resolvedParameters.targetIds);

    this.#logger.debug('Multi-target data extracted successfully', {
      targetCount: extractionMetadata.targetCount,
      primaryTarget: extractionMetadata.primaryTarget,
      targets: targets
    });

    return new TargetExtractionResult({
      targetManager,
      extractionMetadata
    });

  } catch (error) {
    this.#logger.error('Failed to process multi-target data', {
      error: error.message,
      targetIds: resolvedParameters.targetIds
    });

    extractionMetadata.error = error.message;
    extractionMetadata.success = false;

    return new TargetExtractionResult({
      targetManager,
      extractionMetadata
    });
  }
}

/**
 * Processes legacy single-target data
 * @param {Object} resolvedParameters - Resolved parameters with legacy target data
 * @returns {TargetExtractionResult} Legacy target extraction result
 */
#processLegacyTargetData(resolvedParameters) {
  this.#logger.debug('Processing legacy single-target data', {
    hasTargetId: !!resolvedParameters.targetId,
    targetId: resolvedParameters.targetId
  });

  const targetManager = new TargetManager({ logger: this.#logger });
  const extractionMetadata = {
    source: 'legacy_single_target',
    isMultiTarget: false,
    extractionTime: Date.now()
  };

  // Handle legacy single target
  if (resolvedParameters.targetId && resolvedParameters.targetId.trim()) {
    try {
      targetManager.addTarget('primary', resolvedParameters.targetId);

      extractionMetadata.targetId = resolvedParameters.targetId;
      extractionMetadata.primaryTarget = resolvedParameters.targetId;

      this.#logger.debug('Legacy target data extracted', {
        targetId: resolvedParameters.targetId
      });
    } catch (error) {
      this.#logger.error('Failed to process legacy target data', {
        error: error.message,
        targetId: resolvedParameters.targetId
      });

      extractionMetadata.error = error.message;
    }
  } else {
    // No target (e.g., emote actions)
    this.#logger.debug('No target required for this action');
    extractionMetadata.reason = 'no_target_required';
  }

  return new TargetExtractionResult({
    targetManager,
    extractionMetadata
  });
}

/**
 * Converts targetIds object from formatting stage to flat targets object
 * @param {Object} targetIds - Target IDs from formatting stage
 * @returns {Object} Flat targets object
 */
#convertTargetIdsToTargets(targetIds) {
  const targets = {};

  if (!targetIds || typeof targetIds !== 'object') {
    return targets;
  }

  for (const [category, targetList] of Object.entries(targetIds)) {
    try {
      // Validate category name
      if (!category || typeof category !== 'string') {
        this.#logger.warn('Invalid target category', { category });
        continue;
      }

      // Handle different target list formats
      let targetId = null;

      if (Array.isArray(targetList)) {
        // Take first target from array (combination generation may produce multiple)
        if (targetList.length > 0 && targetList[0]) {
          targetId = targetList[0];
        }
      } else if (typeof targetList === 'string' && targetList.trim()) {
        // Handle single target as string
        targetId = targetList.trim();
      }

      if (targetId) {
        targets[category] = targetId;
        this.#logger.debug('Target extracted from category', {
          category,
          targetId,
          originalList: targetList
        });
      } else {
        this.#logger.warn('No valid target found in category', {
          category,
          targetList
        });
      }
    } catch (error) {
      this.#logger.error('Error processing target category', {
        category,
        error: error.message,
        targetList
      });
    }
  }

  return targets;
}

/**
 * Sanitizes resolved parameters for safe logging
 * @param {Object} resolvedParameters - Parameters to sanitize
 * @returns {Object} Sanitized parameters
 */
#sanitizeForLogging(resolvedParameters) {
  if (!resolvedParameters || typeof resolvedParameters !== 'object') {
    return { type: typeof resolvedParameters };
  }

  return {
    isMultiTarget: resolvedParameters.isMultiTarget,
    hasTargetIds: !!resolvedParameters.targetIds,
    targetIdsKeys: resolvedParameters.targetIds ? Object.keys(resolvedParameters.targetIds) : [],
    hasTargetId: !!resolvedParameters.targetId,
    targetId: resolvedParameters.targetId,
    parameterKeys: Object.keys(resolvedParameters)
  };
}

/**
 * Gets multi-target extraction statistics for monitoring
 * @returns {Object} Extraction statistics
 */
#getExtractionStatistics() {
  // This would be implemented with actual metrics collection
  // For now, return placeholder data
  return {
    totalExtractions: 0,
    multiTargetExtractions: 0,
    legacyExtractions: 0,
    errorCount: 0,
    averageExtractionTime: 0
  };
}
```

### 2. Create Target Extraction Service

**File**: `src/services/targetExtractionService.js`

Create a dedicated service for target extraction that can be used by the CommandProcessor:

```javascript
/**
 * @file Service for extracting target data from various sources
 */

import { validateDependency } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import TargetManager from '../entities/multiTarget/targetManager.js';
import TargetExtractionResult from '../entities/multiTarget/targetExtractionResult.js';

/**
 * Service for extracting and processing target data from action formatting
 */
export class TargetExtractionService {
  #logger;
  #performanceMetrics;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
    this.#performanceMetrics = {
      extractionCount: 0,
      multiTargetCount: 0,
      legacyCount: 0,
      errorCount: 0,
      totalTime: 0,
    };
  }

  /**
   * Extracts target data from resolved parameters
   * @param {Object} resolvedParameters - Parameters from action formatting
   * @returns {TargetExtractionResult} Extraction result
   */
  async extractTargets(resolvedParameters) {
    const startTime = performance.now();

    try {
      this.#performanceMetrics.extractionCount++;

      // Create extraction result based on parameter type
      let result;

      if (this.#isMultiTargetParameters(resolvedParameters)) {
        this.#performanceMetrics.multiTargetCount++;
        result = await this.#extractMultiTargetData(resolvedParameters);
      } else {
        this.#performanceMetrics.legacyCount++;
        result = await this.#extractLegacyTargetData(resolvedParameters);
      }

      // Add performance metadata
      const duration = performance.now() - startTime;
      result.addMetadata('extractionTime', duration);
      result.addMetadata('extractionMethod', result.getMetadata('source'));

      this.#performanceMetrics.totalTime += duration;

      this.#logger.debug('Target extraction completed', {
        hasMultipleTargets: result.hasMultipleTargets(),
        targetCount: result.getTargetCount(),
        primaryTarget: result.getPrimaryTarget(),
        extractionTime: duration.toFixed(2),
      });

      return result;
    } catch (error) {
      this.#performanceMetrics.errorCount++;

      this.#logger.error('Target extraction failed', {
        error: error.message,
        resolvedParameters: this.#sanitizeParameters(resolvedParameters),
      });

      // Return empty result with error metadata
      const errorResult = TargetExtractionResult.createEmpty(this.#logger);
      errorResult.addMetadata('error', error.message);
      errorResult.addMetadata('extractionTime', performance.now() - startTime);

      return errorResult;
    }
  }

  /**
   * Checks if parameters contain multi-target data
   * @param {Object} resolvedParameters - Parameters to check
   * @returns {boolean} True if multi-target parameters
   */
  #isMultiTargetParameters(resolvedParameters) {
    return !!(
      resolvedParameters &&
      resolvedParameters.isMultiTarget &&
      resolvedParameters.targetIds &&
      typeof resolvedParameters.targetIds === 'object' &&
      Object.keys(resolvedParameters.targetIds).length > 0
    );
  }

  /**
   * Extracts multi-target data
   * @param {Object} resolvedParameters - Multi-target parameters
   * @returns {TargetExtractionResult} Extraction result
   */
  async #extractMultiTargetData(resolvedParameters) {
    const targetManager = new TargetManager({ logger: this.#logger });

    // Process each target category
    const targets = {};
    const categoryMetadata = {};

    for (const [category, targetList] of Object.entries(
      resolvedParameters.targetIds
    )) {
      const extractedTarget = this.#extractTargetFromList(category, targetList);

      if (extractedTarget) {
        targets[category] = extractedTarget.targetId;
        categoryMetadata[category] = extractedTarget.metadata;
      }
    }

    // Set all targets at once
    if (Object.keys(targets).length > 0) {
      targetManager.setTargets(targets);
    }

    const extractionMetadata = {
      source: 'multi_target_formatting',
      isMultiTarget: true,
      originalTargetIds: resolvedParameters.targetIds,
      categoryMetadata,
      targetCount: Object.keys(targets).length,
      primaryTarget: targetManager.getPrimaryTarget(),
    };

    return new TargetExtractionResult({
      targetManager,
      extractionMetadata,
    });
  }

  /**
   * Extracts legacy single-target data
   * @param {Object} resolvedParameters - Legacy parameters
   * @returns {TargetExtractionResult} Extraction result
   */
  async #extractLegacyTargetData(resolvedParameters) {
    const targetManager = new TargetManager({ logger: this.#logger });
    const extractionMetadata = {
      source: 'legacy_single_target',
      isMultiTarget: false,
    };

    if (resolvedParameters && resolvedParameters.targetId) {
      const targetId = resolvedParameters.targetId.trim();

      if (targetId) {
        targetManager.addTarget('primary', targetId);
        extractionMetadata.targetId = targetId;
        extractionMetadata.primaryTarget = targetId;
      }
    } else {
      extractionMetadata.reason = 'no_target_required';
    }

    return new TargetExtractionResult({
      targetManager,
      extractionMetadata,
    });
  }

  /**
   * Extracts a single target from a target list
   * @param {string} category - Target category name
   * @param {*} targetList - Target list from formatting
   * @returns {Object|null} Extracted target with metadata
   */
  #extractTargetFromList(category, targetList) {
    try {
      let targetId = null;
      const metadata = {
        originalFormat: Array.isArray(targetList) ? 'array' : typeof targetList,
        originalValue: targetList,
      };

      if (Array.isArray(targetList)) {
        // Take first valid target from array
        for (const target of targetList) {
          if (target && typeof target === 'string' && target.trim()) {
            targetId = target.trim();
            metadata.selectedIndex = targetList.indexOf(target);
            metadata.totalOptions = targetList.length;
            break;
          }
        }
      } else if (typeof targetList === 'string' && targetList.trim()) {
        targetId = targetList.trim();
      }

      if (!targetId) {
        this.#logger.warn('No valid target found in category', {
          category,
          targetList,
        });
        return null;
      }

      return { targetId, metadata };
    } catch (error) {
      this.#logger.error('Error extracting target from list', {
        category,
        targetList,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Sanitizes parameters for logging
   * @param {Object} resolvedParameters - Parameters to sanitize
   * @returns {Object} Sanitized parameters
   */
  #sanitizeParameters(resolvedParameters) {
    if (!resolvedParameters) {
      return null;
    }

    return {
      isMultiTarget: resolvedParameters.isMultiTarget,
      hasTargetIds: !!resolvedParameters.targetIds,
      targetIdsKeys: resolvedParameters.targetIds
        ? Object.keys(resolvedParameters.targetIds)
        : [],
      hasTargetId: !!resolvedParameters.targetId,
      targetIdType: typeof resolvedParameters.targetId,
      parameterCount: Object.keys(resolvedParameters).length,
    };
  }

  /**
   * Gets performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    const metrics = { ...this.#performanceMetrics };

    if (metrics.extractionCount > 0) {
      metrics.averageTime = metrics.totalTime / metrics.extractionCount;
      metrics.multiTargetRate =
        metrics.multiTargetCount / metrics.extractionCount;
      metrics.errorRate = metrics.errorCount / metrics.extractionCount;
    } else {
      metrics.averageTime = 0;
      metrics.multiTargetRate = 0;
      metrics.errorRate = 0;
    }

    return metrics;
  }

  /**
   * Resets performance metrics
   */
  resetPerformanceMetrics() {
    this.#performanceMetrics = {
      extractionCount: 0,
      multiTargetCount: 0,
      legacyCount: 0,
      errorCount: 0,
      totalTime: 0,
    };
  }

  /**
   * Validates extracted targets against action requirements
   * @param {TargetExtractionResult} extractionResult - Extraction result
   * @param {Object} actionDefinition - Action definition (optional)
   * @returns {Object} Validation result
   */
  validateExtractedTargets(extractionResult, actionDefinition = null) {
    const validation = extractionResult.getValidationResult();
    const warnings = [...validation.warnings];
    const errors = [...validation.errors];

    // Additional validation can be added here when action definitions are available
    if (actionDefinition) {
      // TODO: Implement action-specific target validation
      this.#logger.debug(
        'Action-specific target validation not yet implemented',
        {
          actionId: actionDefinition.id,
          targetCount: extractionResult.getTargetCount(),
        }
      );
    }

    // Check for common issues
    if (extractionResult.getTargetCount() === 0) {
      warnings.push(
        'No targets extracted - verify this is expected for the action'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export default TargetExtractionService;
```

### 3. Create Unit Tests

**File**: `tests/unit/services/targetExtractionService.test.js`

```javascript
/**
 * @file Tests for TargetExtractionService
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../common/testbed.js';
import TargetExtractionService from '../../../src/services/targetExtractionService.js';
import TargetExtractionResult from '../../../src/entities/multiTarget/targetExtractionResult.js';

describe('TargetExtractionService', () => {
  let testBed;
  let service;
  let logger;

  beforeEach(() => {
    testBed = new TestBedClass();
    logger = testBed.createMockLogger();
    service = new TargetExtractionService({ logger });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Multi-Target Extraction', () => {
    it('should extract multi-target data correctly', async () => {
      const resolvedParameters = {
        isMultiTarget: true,
        targetIds: {
          item: ['knife_123'],
          target: ['goblin_456'],
        },
      };

      const result = await service.extractTargets(resolvedParameters);

      expect(result).toBeInstanceOf(TargetExtractionResult);
      expect(result.hasMultipleTargets()).toBe(true);
      expect(result.getTargetCount()).toBe(2);
      expect(result.getTarget('item')).toBe('knife_123');
      expect(result.getTarget('target')).toBe('goblin_456');
      expect(result.getPrimaryTarget()).toBe('goblin_456'); // 'target' preferred over 'item'
    });

    it('should handle multiple targets in array', async () => {
      const resolvedParameters = {
        isMultiTarget: true,
        targetIds: {
          item: ['knife_123', 'sword_456', 'bow_789'],
          target: ['goblin_012'],
        },
      };

      const result = await service.extractTargets(resolvedParameters);

      expect(result.getTarget('item')).toBe('knife_123'); // Takes first item
      expect(result.getTarget('target')).toBe('goblin_012');
      expect(result.getMetadata('categoryMetadata')).toBeDefined();
    });

    it('should handle string targets in targetIds', async () => {
      const resolvedParameters = {
        isMultiTarget: true,
        targetIds: {
          item: 'knife_123',
          target: 'goblin_456',
        },
      };

      const result = await service.extractTargets(resolvedParameters);

      expect(result.hasMultipleTargets()).toBe(true);
      expect(result.getTarget('item')).toBe('knife_123');
      expect(result.getTarget('target')).toBe('goblin_456');
    });

    it('should handle empty target arrays', async () => {
      const resolvedParameters = {
        isMultiTarget: true,
        targetIds: {
          item: [],
          target: ['goblin_456'],
        },
      };

      const result = await service.extractTargets(resolvedParameters);

      expect(result.getTargetCount()).toBe(1);
      expect(result.getTarget('item')).toBe(null);
      expect(result.getTarget('target')).toBe('goblin_456');
    });
  });

  describe('Legacy Target Extraction', () => {
    it('should extract legacy single target', async () => {
      const resolvedParameters = {
        targetId: 'target_123',
      };

      const result = await service.extractTargets(resolvedParameters);

      expect(result.hasMultipleTargets()).toBe(false);
      expect(result.getTargetCount()).toBe(1);
      expect(result.getPrimaryTarget()).toBe('target_123');
      expect(result.getTarget('primary')).toBe('target_123');
    });

    it('should handle null legacy target', async () => {
      const resolvedParameters = {
        targetId: null,
      };

      const result = await service.extractTargets(resolvedParameters);

      expect(result.getTargetCount()).toBe(0);
      expect(result.getPrimaryTarget()).toBe(null);
      expect(result.getMetadata('reason')).toBe('no_target_required');
    });

    it('should handle empty string legacy target', async () => {
      const resolvedParameters = {
        targetId: '   ',
      };

      const result = await service.extractTargets(resolvedParameters);

      expect(result.getTargetCount()).toBe(0);
      expect(result.getMetadata('reason')).toBe('no_target_required');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null resolved parameters', async () => {
      const result = await service.extractTargets(null);

      expect(result.getTargetCount()).toBe(0);
      expect(result.isValid()).toBe(true);
      expect(result.getMetadata('error')).toBeUndefined();
    });

    it('should handle undefined resolved parameters', async () => {
      const result = await service.extractTargets(undefined);

      expect(result.getTargetCount()).toBe(0);
      expect(result.isValid()).toBe(true);
    });

    it('should handle malformed targetIds object', async () => {
      const resolvedParameters = {
        isMultiTarget: true,
        targetIds: 'invalid_string',
      };

      const result = await service.extractTargets(resolvedParameters);

      expect(result.getTargetCount()).toBe(0);
      expect(result.getMetadata('error')).toBeDefined();
    });

    it('should handle extraction errors gracefully', async () => {
      const resolvedParameters = {
        isMultiTarget: true,
        targetIds: {
          item: [null, undefined, '', 'valid_target'],
        },
      };

      const result = await service.extractTargets(resolvedParameters);

      expect(result.getTarget('item')).toBe('valid_target');
      expect(result.isValid()).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    it('should track extraction metrics', async () => {
      // Perform multiple extractions
      await service.extractTargets({ targetId: 'target1' });
      await service.extractTargets({
        isMultiTarget: true,
        targetIds: { item: ['item1'], target: ['target1'] },
      });
      await service.extractTargets({ targetId: 'target2' });

      const metrics = service.getPerformanceMetrics();

      expect(metrics.extractionCount).toBe(3);
      expect(metrics.multiTargetCount).toBe(1);
      expect(metrics.legacyCount).toBe(2);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.averageTime).toBeGreaterThan(0);
      expect(metrics.multiTargetRate).toBeCloseTo(1 / 3);
    });

    it('should reset metrics', async () => {
      await service.extractTargets({ targetId: 'target1' });

      service.resetPerformanceMetrics();
      const metrics = service.getPerformanceMetrics();

      expect(metrics.extractionCount).toBe(0);
      expect(metrics.totalTime).toBe(0);
    });
  });

  describe('Target Validation', () => {
    it('should validate extracted targets', async () => {
      const resolvedParameters = {
        isMultiTarget: true,
        targetIds: {
          item: ['knife_123'],
          target: ['goblin_456'],
        },
      };

      const result = await service.extractTargets(resolvedParameters);
      const validation = service.validateExtractedTargets(result);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should warn about no targets extracted', async () => {
      const result = await service.extractTargets({});
      const validation = service.validateExtractedTargets(result);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain(
        'No targets extracted - verify this is expected for the action'
      );
    });
  });
});
```

## Testing Requirements

### 1. Unit Test Coverage

- **Target extraction**: Multi-target and legacy paths
- **Error handling**: Invalid inputs and edge cases
- **Performance**: Timing and metrics collection
- **Data validation**: Extracted target validation

### 2. Integration Testing

- Integration with existing CommandProcessor
- End-to-end target extraction flow
- Performance under realistic loads

### 3. Performance Requirements

- Extraction time < 5ms for typical multi-target scenarios
- Memory usage < 5KB per extraction operation
- No performance regression for legacy single-target actions

## Success Criteria

1. **Functionality**: Multi-target data extracted correctly from formatting stage
2. **Performance**: All performance targets met consistently
3. **Compatibility**: Legacy single-target extraction unchanged
4. **Error Handling**: Graceful handling of all edge cases
5. **Testing**: >95% code coverage with comprehensive test cases

## Files Created

- `src/services/targetExtractionService.js`
- `tests/unit/services/targetExtractionService.test.js`

## Files Modified

- `src/commands/commandProcessor.js` (add extraction methods)

## Validation Steps

1. Run all unit tests for target extraction
2. Test integration with CommandProcessor
3. Verify performance requirements with realistic data
4. Test edge cases and error conditions
5. Validate metrics collection and reporting

## Notes

- Extraction logic handles both multi-target and legacy formats
- Performance metrics enable monitoring of extraction efficiency
- Error handling ensures system continues operating even with invalid data
- Service pattern allows for easy testing and future enhancements

## Risk Assessment

**Medium Risk**: Core functionality change in CommandProcessor, but with comprehensive testing and backward compatibility preservation. Extensive error handling minimizes risk of system failures.

## Next Steps

After this ticket completion:

1. Move to Ticket 08: Update Attempt Action Payload Creation
2. Integrate extraction service with command processor
3. Test complete end-to-end multi-target flow
