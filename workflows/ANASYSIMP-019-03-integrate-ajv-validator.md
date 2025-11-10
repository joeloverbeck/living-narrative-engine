# ANASYSIMP-019-03: Integrate with AjvSchemaValidator

**Phase:** 2 (Integration)
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-01, ANASYSIMP-019-02
**Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)

## Overview

Integrate the `ValidatorGenerator` with the existing `AjvSchemaValidator` to provide enhanced validation with custom error messages and suggestions. This integration must maintain backward compatibility with schemas that do not have `validationRules`.

## Objectives

1. Modify `AjvSchemaValidator` to use `ValidatorGenerator`
2. Support two-stage validation: AJV first, then generated validator
3. Merge validation results from both validators
4. Ensure backward compatibility with existing validation
5. Cache generated validators for performance
6. Add runtime validator generation support
7. Provide unified error reporting

## Technical Details

### 1. Enhanced AjvSchemaValidator

**File to Update:** `src/validation/ajvSchemaValidator.js`

Add support for generated validators:

```javascript
/**
 * @file AJV-based schema validator with generated validator support
 */

import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';
import { string } from '../utils/validationCore.js';

class AjvSchemaValidator {
  #logger;
  #ajv;
  #validatorGenerator;
  #schemaLoader;
  #generatedValidators; // Cache for generated validators

  constructor({ logger, ajv, validatorGenerator, schemaLoader }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(validatorGenerator, 'IValidatorGenerator', logger, {
      requiredMethods: ['generate'],
    });
    validateDependency(schemaLoader, 'ISchemaLoader', logger, {
      requiredMethods: ['getSchema'],
    });

    this.#logger = logger;
    this.#ajv = ajv;
    this.#validatorGenerator = validatorGenerator;
    this.#schemaLoader = schemaLoader;
    this.#generatedValidators = new Map();
  }

  /**
   * Validates data against a schema with enhanced validation
   * @param {*} data - Data to validate
   * @param {string} schemaId - Schema identifier
   * @returns {Object} Validation result with errors
   */
  validate(data, schemaId) {
    assertPresent(data, 'Data is required for validation');
    string.assertNonBlank(schemaId, 'schemaId', 'validate', this.#logger);

    try {
      // Stage 1: Standard AJV validation
      const ajvResult = this.#validateWithAjv(data, schemaId);

      if (!ajvResult.valid) {
        // AJV validation failed, return immediately
        return ajvResult;
      }

      // Stage 2: Generated validator (if available)
      const generatedResult = this.#validateWithGenerated(data, schemaId);

      if (!generatedResult) {
        // No generated validator, return AJV result
        return ajvResult;
      }

      // Merge results
      return this.#mergeValidationResults(ajvResult, generatedResult);
    } catch (error) {
      this.#logger.error(`Validation failed for schema ${schemaId}`, error);
      return {
        valid: false,
        errors: [
          {
            message: `Validation error: ${error.message}`,
            schemaId,
          },
        ],
      };
    }
  }

  /**
   * Validates data using AJV
   * @private
   */
  #validateWithAjv(data, schemaId) {
    const validateFn = this.#ajv.getSchema(schemaId);

    if (!validateFn) {
      this.#logger.warn(`Schema not found: ${schemaId}`);
      return {
        valid: false,
        errors: [
          {
            message: `Schema not found: ${schemaId}`,
            schemaId,
          },
        ],
      };
    }

    const valid = validateFn(data);

    if (!valid) {
      return {
        valid: false,
        errors: this.#formatAjvErrors(validateFn.errors, schemaId),
      };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validates data using generated validator
   * @private
   */
  #validateWithGenerated(data, schemaId) {
    // Check cache first
    if (this.#generatedValidators.has(schemaId)) {
      const validator = this.#generatedValidators.get(schemaId);

      // null means no validator needed for this schema
      if (validator === null) {
        return null;
      }

      return validator(data);
    }

    // Generate validator on first use
    const componentSchema = this.#schemaLoader.getSchema(schemaId);

    if (!componentSchema) {
      this.#logger.warn(`Component schema not found: ${schemaId}`);
      this.#generatedValidators.set(schemaId, null);
      return null;
    }

    const validator = this.#validatorGenerator.generate(componentSchema);

    // Cache the result (including null)
    this.#generatedValidators.set(schemaId, validator);

    if (!validator) {
      return null;
    }

    return validator(data);
  }

  /**
   * Merges validation results from AJV and generated validator
   * @private
   */
  #mergeValidationResults(ajvResult, generatedResult) {
    if (ajvResult.valid && generatedResult.valid) {
      return { valid: true, errors: [] };
    }

    const allErrors = [
      ...(ajvResult.errors || []),
      ...(generatedResult.errors || []),
    ];

    return {
      valid: false,
      errors: allErrors,
    };
  }

  /**
   * Formats AJV errors for consistent output
   * @private
   */
  #formatAjvErrors(ajvErrors, schemaId) {
    if (!ajvErrors) {
      return [];
    }

    return ajvErrors.map((error) => ({
      type: 'ajvError',
      property: error.instancePath || error.dataPath,
      keyword: error.keyword,
      message: error.message,
      params: error.params,
      schemaId,
    }));
  }

  /**
   * Clears the generated validator cache
   * Useful for testing or when schemas are reloaded
   */
  clearCache() {
    this.#generatedValidators.clear();
    this.#logger.debug('Generated validator cache cleared');
  }

  /**
   * Pre-generates validators for all component schemas
   * Call during initialization for better first-run performance
   */
  preGenerateValidators(componentSchemas) {
    assertPresent(componentSchemas, 'Component schemas required');

    this.#logger.info(
      `Pre-generating validators for ${componentSchemas.length} schemas`
    );

    let generated = 0;

    for (const schema of componentSchemas) {
      if (schema.validationRules?.generateValidator) {
        const validator = this.#validatorGenerator.generate(schema);
        this.#generatedValidators.set(schema.id, validator);
        generated++;
      }
    }

    this.#logger.info(`Pre-generated ${generated} validators`);
  }
}

export default AjvSchemaValidator;
```

### 2. Schema Loader Interface

Ensure the schema loader can retrieve component schemas for validator generation.

**File to Check/Update:** `src/loaders/schemaLoader.js`

Add method if not present:

```javascript
/**
 * Gets a component schema by ID
 * @param {string} schemaId - Schema identifier
 * @returns {Object|null} Component schema or null
 */
getSchema(schemaId) {
  string.assertNonBlank(schemaId, 'schemaId', 'getSchema', this.#logger);

  // Implementation depends on existing schema loading mechanism
  // This is a placeholder - adapt to existing code

  return this.#schemaCache.get(schemaId) || null;
}
```

## Files to Create

- [ ] `tests/integration/validation/ajvValidatorGeneratorIntegration.integration.test.js`

## Files to Update

- [ ] `src/validation/ajvSchemaValidator.js` - Add generated validator support
- [ ] `src/loaders/schemaLoader.js` - Ensure getSchema method exists (if needed)
- [ ] `tests/unit/validation/ajvSchemaValidator.test.js` - Add tests for new functionality

## Testing Requirements

### Unit Tests

**File to Update:** `tests/unit/validation/ajvSchemaValidator.test.js`

Add test cases:
- Validate with AJV only (no validationRules)
- Validate with AJV + generated validator (both pass)
- Validate with AJV pass + generated validator fail
- Validate with AJV fail (skip generated validator)
- Cache generated validators
- Clear validator cache
- Pre-generate validators
- Handle missing component schema
- Handle schema without generateValidator flag
- Merge validation errors from both sources

**Coverage Target:** 90% branches, 95% functions/lines

### Integration Tests

**File:** `tests/integration/validation/ajvValidatorGeneratorIntegration.integration.test.js`

Test cases:
- End-to-end validation with real component schema
- Validate descriptor component data
- Generate helpful error message for invalid enum
- Provide suggestions for typo in enum value
- Validate type errors with custom messages
- Validate required field errors
- Two-stage validation pipeline works correctly
- Pre-generation improves performance
- Cache prevents redundant generation
- Backward compatibility with schemas without validationRules

## Acceptance Criteria

- [ ] `AjvSchemaValidator` integrates with `ValidatorGenerator`
- [ ] Two-stage validation (AJV → Generated) implemented
- [ ] Validation results merged correctly
- [ ] Generated validators are cached for performance
- [ ] Pre-generation support implemented
- [ ] Cache can be cleared for testing/reloading
- [ ] Backward compatible with existing schemas
- [ ] All unit tests pass with 90%+ coverage
- [ ] Integration tests demonstrate end-to-end functionality
- [ ] No breaking changes to existing validation
- [ ] ESLint passes
- [ ] TypeScript type checking passes

## Validation Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/validation/ajvSchemaValidator.test.js

# Run integration tests
npm run test:integration -- tests/integration/validation/ajvValidatorGeneratorIntegration.integration.test.js

# Full validation suite
npm run test:integration -- tests/integration/validation/

# Check types
npm run typecheck

# Lint
npx eslint src/validation/ajvSchemaValidator.js
```

## Success Metrics

- ✅ Validation pipeline handles both AJV and generated validators
- ✅ No performance degradation for schemas without validationRules
- ✅ Generated validators improve error messages
- ✅ Cache reduces validation overhead
- ✅ Backward compatibility maintained
- ✅ All existing validation tests still pass

## Implementation Notes

### Validation Pipeline Flow

```
Data + Schema ID
    ↓
Stage 1: AJV Validation
    ↓
  Valid? ──No──→ Return AJV Errors
    ↓ Yes
Stage 2: Check for Generated Validator
    ↓
  Exists? ──No──→ Return Valid
    ↓ Yes
Stage 3: Run Generated Validator
    ↓
  Valid? ──No──→ Return Enhanced Errors
    ↓ Yes
Return Valid
```

### Caching Strategy

- Cache key: Schema ID
- Cache value: Generated validator function or null
- Clear cache when schemas reload
- Pre-generate during initialization for better performance

### Error Message Priority

When both AJV and generated validator produce errors:
1. Include all errors in result
2. Generated validator errors have more context (suggestions, templates)
3. AJV errors provide schema-level validation

## Performance Considerations

- **First Validation:** Generates validator (one-time cost)
- **Subsequent Validations:** Uses cached validator (fast)
- **Pre-generation:** Optional upfront cost for faster runtime
- **Target:** < 1ms overhead per validation

## Related Tickets

- **Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)
- **Depends on:** ANASYSIMP-019-01 (Extend component.schema.json)
- **Depends on:** ANASYSIMP-019-02 (Create ValidatorGenerator class)
- **Blocks:** ANASYSIMP-019-05 (Pilot with Descriptor Components)
- **Related:** ANASYSIMP-017 (Validation Result Caching) - cache complements generated validators

## References

- **Current AJV Validator:** `src/validation/ajvSchemaValidator.js`
- **Schema Loader:** `src/loaders/schemaLoader.js`
- **Validation Testing Guide:** `docs/testing/validation-testing.md` (if exists)
