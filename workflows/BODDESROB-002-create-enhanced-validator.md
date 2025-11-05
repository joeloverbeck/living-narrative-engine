# BODDESROB-002: Create Enhanced Body Descriptor Validator

**Status**: TODO
**Priority**: HIGH
**Phase**: 1 (Foundation)
**Estimated Effort**: 1 day
**Dependencies**: BODDESROB-001

## Overview

Create an enhanced validator that uses the centralized registry to validate body descriptor consistency across the system. This validator will check recipe descriptors, formatting configuration, and overall system consistency to detect configuration drift and missing descriptors.

## Problem Context

The current system has no automated validation to ensure that:
1. Body descriptors defined in recipes are valid
2. All registered descriptors are included in formatting configuration
3. Schema, code, and configuration are synchronized

This led to the recent issue where `skinColor` and `smell` descriptors were defined but missing from the formatting config, causing silent failures.

## Acceptance Criteria

- [ ] Validator class created at `src/anatomy/validators/bodyDescriptorValidator.js`
- [ ] Constructor accepts logger dependency
- [ ] Implements `validateRecipeDescriptors(bodyDescriptors)` method
  - Validates descriptor values against registry
  - Detects unknown descriptors
  - Returns structured result with errors and warnings
- [ ] Implements `validateFormattingConfig(formattingConfig)` method
  - Checks for missing descriptors in descriptionOrder
  - Validates config structure
  - Returns structured result with errors and warnings
- [ ] Implements `validateSystemConsistency({ dataRegistry })` method
  - Validates formatting config against registry
  - Validates sample recipes
  - Returns comprehensive validation report
- [ ] All methods return consistent result structure: `{ valid, errors, warnings, info? }`
- [ ] Clear, actionable error and warning messages
- [ ] Comprehensive unit tests with 90%+ coverage
- [ ] No breaking changes to existing validation

## Technical Details

### Class Structure

```javascript
// src/anatomy/validators/bodyDescriptorValidator.js

import {
  BODY_DESCRIPTOR_REGISTRY,
  validateDescriptorValue,
  getAllDescriptorNames,
} from '../registries/bodyDescriptorRegistry.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Validator for body descriptor system consistency
 * Ensures descriptors are properly configured across schema, code, and config
 */
export class BodyDescriptorValidator {
  #logger;

  /**
   * @param {Object} options
   * @param {Object} [options.logger] - Logger instance
   */
  constructor({ logger = null } = {}) {
    this.#logger = ensureValidLogger(logger, 'BodyDescriptorValidator');
  }

  /**
   * Validate recipe body descriptors against registry
   * @param {Object} bodyDescriptors - Body descriptors from recipe
   * @returns {{valid: boolean, errors: string[], warnings: string[]}}
   */
  validateRecipeDescriptors(bodyDescriptors) {
    const errors = [];
    const warnings = [];

    if (!bodyDescriptors) {
      return { valid: true, errors: [], warnings: [] };
    }

    // Check for unknown descriptors
    const registeredNames = getAllDescriptorNames();
    for (const key of Object.keys(bodyDescriptors)) {
      if (!registeredNames.includes(key)) {
        warnings.push(`Unknown body descriptor '${key}' (not in registry)`);
      }
    }

    // Validate values for known descriptors
    for (const [key, value] of Object.entries(bodyDescriptors)) {
      const result = validateDescriptorValue(key, value);
      if (!result.valid) {
        errors.push(result.error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate formatting config against registry
   * Ensures descriptionOrder includes all registered descriptors
   * @param {Object} formattingConfig - Formatting configuration
   * @returns {{valid: boolean, errors: string[], warnings: string[]}}
   */
  validateFormattingConfig(formattingConfig) {
    const errors = [];
    const warnings = [];

    if (!formattingConfig?.descriptionOrder) {
      errors.push('Formatting config missing descriptionOrder');
      return { valid: false, errors, warnings };
    }

    const registeredDisplayKeys = Object.values(BODY_DESCRIPTOR_REGISTRY)
      .map(meta => meta.displayKey);

    const orderSet = new Set(formattingConfig.descriptionOrder);

    // Check for missing descriptors in formatting config
    for (const displayKey of registeredDisplayKeys) {
      if (!orderSet.has(displayKey)) {
        warnings.push(
          `Body descriptor '${displayKey}' defined in registry but missing from descriptionOrder. ` +
          `Descriptor will not appear in generated descriptions.`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Comprehensive validation: check schema, code, and config consistency
   * @param {Object} options
   * @param {Object} options.dataRegistry - Data registry instance
   * @returns {Promise<{errors: string[], warnings: string[], info: string[]}>}
   */
  async validateSystemConsistency({ dataRegistry }) {
    const issues = {
      errors: [],
      warnings: [],
      info: [],
    };

    // 1. Validate formatting config
    const formattingConfig = dataRegistry.get('anatomyFormatting', 'default');
    if (formattingConfig) {
      const configResult = this.validateFormattingConfig(formattingConfig);
      issues.errors.push(...configResult.errors);
      issues.warnings.push(...configResult.warnings);
    } else {
      issues.errors.push('Formatting config not found: anatomy:default');
    }

    // 2. Load and validate sample recipes
    const sampleRecipes = ['anatomy:human_male', 'anatomy:human_female'];
    for (const recipeId of sampleRecipes) {
      const recipe = dataRegistry.get('anatomyRecipes', recipeId);
      if (recipe?.bodyDescriptors) {
        const recipeResult = this.validateRecipeDescriptors(recipe.bodyDescriptors);
        if (!recipeResult.valid) {
          issues.warnings.push(`Recipe ${recipeId}: ${recipeResult.errors.join(', ')}`);
        }
      }
    }

    // 3. Info: report registered descriptors
    issues.info.push(`Total registered descriptors: ${getAllDescriptorNames().length}`);
    issues.info.push(`Registered: ${getAllDescriptorNames().join(', ')}`);

    return issues;
  }
}
```

### Implementation Steps

1. Create `src/anatomy/validators/bodyDescriptorValidator.js`
2. Implement BodyDescriptorValidator class with constructor
3. Implement `validateRecipeDescriptors()` method
4. Implement `validateFormattingConfig()` method
5. Implement `validateSystemConsistency()` method
6. Add comprehensive JSDoc documentation
7. Export class

## Files to Create/Modify

### Create
- `src/anatomy/validators/bodyDescriptorValidator.js` (NEW)

### Modify
None (this is a new validator, doesn't modify existing code)

## Testing Requirements

### Unit Tests

**File**: `tests/unit/anatomy/validators/bodyDescriptorValidator.test.js`

Test cases:

1. Constructor
   - Accepts logger dependency
   - Uses ensureValidLogger for fallback
   - Stores logger privately

2. `validateRecipeDescriptors()`
   - Returns valid:true for null/undefined input
   - Returns valid:true for valid descriptors
   - Returns errors for invalid descriptor values
   - Returns warnings for unknown descriptors
   - Validates all descriptor values against registry
   - Error messages are clear and actionable
   - Handles edge cases (empty object, null values)

3. `validateFormattingConfig()`
   - Returns valid:false if descriptionOrder missing
   - Returns valid:true if all descriptors present
   - Returns warnings for missing descriptors
   - Identifies specific missing descriptors by displayKey
   - Warning messages are clear and actionable
   - Handles edge cases (empty array, null config)

4. `validateSystemConsistency()`
   - Validates formatting config from dataRegistry
   - Validates sample recipes from dataRegistry
   - Returns comprehensive validation report
   - Handles missing formatting config
   - Handles missing recipes gracefully
   - Returns info about registered descriptors
   - Aggregates errors and warnings correctly
   - Uses async/await properly

### Test Template

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyDescriptorValidator } from '../../../src/anatomy/validators/bodyDescriptorValidator.js';

describe('BodyDescriptorValidator', () => {
  let validator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    validator = new BodyDescriptorValidator({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should accept logger dependency', () => {
      expect(() => new BodyDescriptorValidator({ logger: mockLogger })).not.toThrow();
    });

    it('should work without logger (uses fallback)', () => {
      expect(() => new BodyDescriptorValidator()).not.toThrow();
    });
  });

  describe('validateRecipeDescriptors', () => {
    it('should return valid:true for null input', () => {
      const result = validator.validateRecipeDescriptors(null);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should validate valid descriptors', () => {
      const descriptors = {
        height: 'tall',
        skinColor: 'tan',
        build: 'athletic',
      };
      const result = validator.validateRecipeDescriptors(descriptors);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid descriptor values', () => {
      const descriptors = {
        height: 'invalid-height',
      };
      const result = validator.validateRecipeDescriptors(descriptors);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid value');
    });

    it('should return warnings for unknown descriptors', () => {
      const descriptors = {
        unknownDescriptor: 'value',
      };
      const result = validator.validateRecipeDescriptors(descriptors);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Unknown body descriptor');
    });
  });

  describe('validateFormattingConfig', () => {
    it('should return error if descriptionOrder missing', () => {
      const config = {};
      const result = validator.validateFormattingConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('missing descriptionOrder');
    });

    it('should return valid:true if all descriptors present', () => {
      const config = {
        descriptionOrder: [
          'height', 'skin_color', 'build', 'body_composition', 'body_hair', 'smell'
        ],
      };
      const result = validator.validateFormattingConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('should return warnings for missing descriptors', () => {
      const config = {
        descriptionOrder: ['height', 'build'], // Missing skin_color, etc.
      };
      const result = validator.validateFormattingConfig(config);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('missing from descriptionOrder');
    });
  });

  describe('validateSystemConsistency', () => {
    it('should validate formatting config from dataRegistry', async () => {
      const mockDataRegistry = {
        get: jest.fn((type, id) => {
          if (type === 'anatomyFormatting') {
            return { descriptionOrder: ['height'] };
          }
          return null;
        }),
      };

      const result = await validator.validateSystemConsistency({
        dataRegistry: mockDataRegistry,
      });

      expect(mockDataRegistry.get).toHaveBeenCalledWith('anatomyFormatting', 'default');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('info');
    });
  });
});
```

### Integration Test

**File**: `tests/integration/anatomy/bodyDescriptorValidation.test.js`

Test complete validation flow with real data registry and configuration.

## Success Criteria

- [ ] Validator class compiles without errors
- [ ] All unit tests pass with 90%+ coverage
- [ ] All integration tests pass
- [ ] ESLint passes with no errors
- [ ] TypeScript type checking passes (JSDoc types)
- [ ] Can detect missing descriptors in formatting config
- [ ] Can validate recipe descriptors
- [ ] Error messages are clear and actionable
- [ ] No existing code is broken
- [ ] Code follows project conventions

## Related Tickets

- Depends on: BODDESROB-001 (Centralized Registry)
- Blocks: BODDESROB-004 (Bootstrap Validation)
- Blocks: BODDESROB-005 (Recipe Validation)
- Related to: Spec Section 3.4 "Validation Layer"

## Notes

- Focus on clear, actionable error messages
- Validator should never throw - always return structured results
- Consider performance for large-scale validation
- Keep validation logic separate from correction logic
- Validator is read-only - doesn't modify data
- Design for extensibility (future: custom validators, rules)
