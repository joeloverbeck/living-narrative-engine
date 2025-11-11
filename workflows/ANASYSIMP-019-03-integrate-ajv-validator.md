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

**Important:** This file is located at `src/validation/ajvSchemaValidator.js` (NOT `src/services/ajvSchemaValidator.js` as the file header comment incorrectly states).

Add support for generated validators:

```javascript
/**
 * @file AJV-based schema validator with generated validator support
 * @description Integrates ValidatorGenerator for enhanced validation with custom error messages
 */

import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';
import { string } from '../utils/validationCore.js';

class AjvSchemaValidator {
  #logger;
  #ajv;
  #validatorGenerator;
  #dataRegistry; // Access to component definitions (which contain dataSchemas)
  #generatedValidators; // Cache for generated validators

  constructor({ logger, ajvInstance, validatorGenerator, dataRegistry, preloadSchemas }) {
    // Note: Constructor parameter is 'ajvInstance', not 'ajv'
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(validatorGenerator, 'IValidatorGenerator', logger, {
      requiredMethods: ['generate'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getComponentDefinition', 'getAllComponentDefinitions'],
    });

    this.#logger = logger;
    this.#ajv = ajvInstance; // Store as #ajv internally
    this.#validatorGenerator = validatorGenerator;
    this.#dataRegistry = dataRegistry; // Use data registry to retrieve component schemas
    this.#generatedValidators = new Map();

    // ... existing initialization code (Ajv instance creation, preloadSchemas, etc.)
  }

  /**
   * Validates data against a schema with enhanced validation
   * @param {string} schemaId - Schema identifier
   * @param {*} data - Data to validate
   * @returns {Object} Validation result with errors
   *
   * IMPORTANT: Parameter order is (schemaId, data) NOT (data, schemaId)
   * This matches the existing implementation
   */
  validate(schemaId, data) {
    // Note: Parameters are in the order: schemaId, data (existing implementation)
    string.assertNonBlank(schemaId, 'schemaId', 'validate', this.#logger);
    assertPresent(data, 'Data is required for validation');

    try {
      // Stage 1: Standard AJV validation
      const ajvResult = this.#validateWithAjv(schemaId, data);

      if (!ajvResult.isValid) {
        // AJV validation failed, return immediately
        return ajvResult;
      }

      // Stage 2: Generated validator (if available)
      const generatedResult = this.#validateWithGenerated(schemaId, data);

      if (!generatedResult) {
        // No generated validator, return AJV result
        return ajvResult;
      }

      // Merge results
      return this.#mergeValidationResults(ajvResult, generatedResult);
    } catch (error) {
      this.#logger.error(`Validation failed for schema ${schemaId}`, error);
      return {
        isValid: false, // Note: Property is 'isValid' not 'valid' in existing implementation
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
   * @returns {ValidationResult} Result with isValid property
   */
  #validateWithAjv(schemaId, data) {
    const validateFn = this.#ajv.getSchema(schemaId);

    if (!validateFn) {
      this.#logger.warn(`Schema not found: ${schemaId}`);
      return {
        isValid: false, // Note: Property is 'isValid' not 'valid'
        errors: [
          {
            message: `Schema not found: ${schemaId}`,
            schemaId,
          },
        ],
      };
    }

    const isValid = validateFn(data);

    if (!isValid) {
      return {
        isValid: false,
        errors: this.#formatAjvErrors(validateFn.errors, schemaId),
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Validates data using generated validator
   * @private
   * @param {string} schemaId - Schema identifier (component schema ID)
   * @param {*} data - Data to validate
   * @returns {Object|null} Validation result or null if no validator
   */
  #validateWithGenerated(schemaId, data) {
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
    // Note: Use IDataRegistry to retrieve component definition
    // Component definitions contain the dataSchema needed by ValidatorGenerator
    const componentDefinition = this.#dataRegistry.getComponentDefinition(schemaId);

    if (!componentDefinition) {
      this.#logger.debug(`Component definition not found: ${schemaId} (may not be a component schema)`);
      this.#generatedValidators.set(schemaId, null);
      return null;
    }

    // ValidatorGenerator.generate() expects a component schema with dataSchema property
    const validator = this.#validatorGenerator.generate(componentDefinition);

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
   * @returns {ValidationResult} Merged validation result
   */
  #mergeValidationResults(ajvResult, generatedResult) {
    // Note: Check 'isValid' property, not 'valid'
    if (ajvResult.isValid && generatedResult.valid) {
      return { isValid: true, errors: [] };
    }

    const allErrors = [
      ...(ajvResult.errors || []),
      ...(generatedResult.errors || []),
    ];

    return {
      isValid: false,
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

### 2. Data Registry Interface for Component Schemas

**Important Clarification:** Component schemas are NOT retrieved via SchemaLoader. Instead, they are stored in the IDataRegistry.

**File to Check:** `src/data/inMemoryDataRegistry.js`

The IDataRegistry already has the necessary methods:

```javascript
/**
 * Gets a component definition by ID
 * Component definitions include the dataSchema property needed by ValidatorGenerator
 * @param {string} id - Component identifier (e.g., "core:actor")
 * @returns {Object|undefined} Component definition or undefined
 */
getComponentDefinition(id) {
  return this.get('components', id);
}

/**
 * Gets all component definitions
 * Useful for pre-generating validators during initialization
 * @returns {Object[]} Array of all component definitions
 */
getAllComponentDefinitions() {
  return this.getAll('components');
}
```

**No changes needed** - the IDataRegistry already provides the necessary interface.

Component definitions retrieved via `getComponentDefinition(id)` contain:
- `id` - Component identifier
- `dataSchema` - JSON Schema for component data (used by ValidatorGenerator)
- `validationRules` - Optional validation configuration (used by ValidatorGenerator)
- Other component metadata

### 3. Dependency Injection Registration

**File to Update:** `src/dependencyInjection/registrations/loadersRegistrations.js`

Current registration (lines ~168-195):

```javascript
registrar.singletonFactory(
  tokens.ISchemaValidator,
  (c) =>
    new AjvSchemaValidator({
      logger: c.resolve(tokens.ILogger),
      preloadSchemas: [
        // ... schema preloads
      ],
    })
);
```

**Update to:**

```javascript
registrar.singletonFactory(
  tokens.ISchemaValidator,
  (c) =>
    new AjvSchemaValidator({
      logger: c.resolve(tokens.ILogger),
      ajvInstance: undefined, // Let AjvSchemaValidator create its own instance
      validatorGenerator: c.resolve(tokens.IValidatorGenerator),
      dataRegistry: c.resolve(tokens.IDataRegistry),
      preloadSchemas: [
        // ... existing schema preloads
      ],
    })
);
```

**Important Notes:**
- `IValidatorGenerator` is already registered (line ~219-223 of same file)
- `IDataRegistry` is already registered (line ~196-198 of same file)
- Registration order is correct (dependencies are registered before ISchemaValidator)
- No circular dependencies exist

## Files to Create

- [ ] `tests/integration/validation/ajvValidatorGeneratorIntegration.integration.test.js`

## Files to Update

- [ ] `src/validation/ajvSchemaValidator.js` - Add generated validator support
  - Update file header comment (currently says `src/services/` but file is at `src/validation/`)
  - Add `validatorGenerator` dependency to constructor
  - Add `dataRegistry` dependency to constructor (for accessing component definitions)
  - Add `#generatedValidators` cache field
  - Implement two-stage validation (AJV → Generated)
  - Add `#validateWithGenerated` method
  - Add `#mergeValidationResults` method
  - Add `clearCache` method
  - Add `preGenerateValidators` method
- [ ] `src/dependencyInjection/registrations/loadersRegistrations.js` - Update DI registration
  - Add `validatorGenerator` parameter to AjvSchemaValidator factory
  - Add `dataRegistry` parameter to AjvSchemaValidator factory
- [ ] `tests/unit/validation/ajvSchemaValidator.*.test.js` - Add tests for new functionality
  - Create new test file or update existing ones

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

## Key Corrections from Original Assumptions

### ⚠️ Critical Corrections

1. **File Location**: File is at `src/validation/ajvSchemaValidator.js`, but header comment incorrectly says `src/services/ajvSchemaValidator.js`

2. **Parameter Names**:
   - Constructor uses `ajvInstance` NOT `ajv`
   - Constructor uses `dataRegistry` NOT `schemaLoader`

3. **Method Signature**:
   - `validate(schemaId, data)` NOT `validate(data, schemaId)`
   - Parameters are REVERSED from workflow's original assumption

4. **Return Value Property**:
   - Use `isValid` property NOT `valid`
   - Existing implementation uses `isValid` throughout

5. **Schema Source**:
   - Component schemas come from `IDataRegistry.getComponentDefinition(id)`
   - NOT from `SchemaLoader.getSchema(id)` (which doesn't exist)
   - SchemaLoader only loads JSON Schema files, not component definitions

6. **ValidatorGenerator**:
   - Already exists at `src/validation/validatorGenerator.js`
   - Already registered in DI as `IValidatorGenerator`
   - No new creation needed

7. **Dependencies Already Exist**:
   - `IValidatorGenerator` - already registered
   - `IDataRegistry` - already registered
   - Just need to wire them into AjvSchemaValidator

### Validation Pipeline Flow

```
Schema ID + Data
    ↓
Stage 1: AJV Validation (existing logic)
    ↓
  isValid? ──No──→ Return AJV Errors
    ↓ Yes
Stage 2: Check for Generated Validator (NEW)
    ↓
  Component? ──No──→ Return Valid (not a component schema)
    ↓ Yes
  Has validationRules.generateValidator? ──No──→ Return Valid
    ↓ Yes
Stage 3: Run Generated Validator (NEW)
    ↓
  valid? ──No──→ Return Enhanced Errors
    ↓ Yes
Return Valid
```

### Important: Preserve Existing Methods

The AjvSchemaValidator has many existing methods that MUST be preserved:

- `addSchema(schemaData, schemaId)` - Add single schema
- `addSchemas(schemasArray)` - Batch add schemas
- `removeSchema(schemaId)` - Remove schema
- `preloadSchemas(schemas)` - Preload schemas during construction
- `getValidator(schemaId)` - Get AJV validator function
- `isSchemaLoaded(schemaId)` - Check if schema is loaded
- `validateSchemaRefs(schemaId)` - Validate $refs are resolvable
- `getLoadedSchemaIds()` - Get all loaded schema IDs
- `loadSchemaObject(schemaId, schemaData)` - Alias for addSchema
- `validateAgainstSchema(data, schemaId, context)` - Utility method
- `formatAjvErrors(errors, data)` - Format errors
- `_setAjvInstanceForTesting(ajvInstance)` - Test-only method
- `_validateAddSchemaInput(schemaData, schemaId)` - Protected validation
- `_validateBatchInput(schemasArray)` - Protected validation

**Only modify the `validate(schemaId, data)` method** to add two-stage validation.

### Caching Strategy

- Cache key: Schema ID (component ID like "core:actor")
- Cache value: Generated validator function or null
- Clear cache when schemas reload (new `clearCache()` method)
- Pre-generate during initialization for better performance (new `preGenerateValidators()` method)
- Cache is separate from AJV's internal schema cache

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

## Summary of Required Changes

### Code Changes

1. **src/validation/ajvSchemaValidator.js**:
   - Fix file header comment (`src/services/` → `src/validation/`)
   - Add `#validatorGenerator` and `#dataRegistry` fields
   - Add `#generatedValidators` Map for caching
   - Update constructor to accept new dependencies
   - Modify `validate()` method for two-stage validation
   - Add `#validateWithGenerated()` private method
   - Add `#mergeValidationResults()` private method
   - Add `clearCache()` public method
   - Add `preGenerateValidators()` public method

2. **src/dependencyInjection/registrations/loadersRegistrations.js**:
   - Update ISchemaValidator factory
   - Add `validatorGenerator: c.resolve(tokens.IValidatorGenerator)`
   - Add `dataRegistry: c.resolve(tokens.IDataRegistry)`

### Testing Changes

1. **New file**: `tests/integration/validation/ajvValidatorGeneratorIntegration.integration.test.js`
2. **Update**: Existing unit test files for ajvSchemaValidator

### No Changes Needed

- `src/validation/validatorGenerator.js` - Already exists ✓
- `src/data/inMemoryDataRegistry.js` - Already has required methods ✓
- `src/dependencyInjection/tokens/tokens-core.js` - IValidatorGenerator already registered ✓

## References

- **Current AJV Validator:** `src/validation/ajvSchemaValidator.js` (line 1: incorrect header comment)
- **Validator Generator:** `src/validation/validatorGenerator.js` (already implemented)
- **Data Registry:** `src/data/inMemoryDataRegistry.js` (has getComponentDefinition method)
- **DI Registration:** `src/dependencyInjection/registrations/loadersRegistrations.js` (lines ~168-195)
- **DI Tokens:** `src/dependencyInjection/tokens/tokens-core.js` (IValidatorGenerator at line ~47)
- **Schema Loader:** `src/loaders/schemaLoader.js` (loads JSON Schemas only, NOT component definitions)
- **Validation Testing Guide:** `docs/testing/validation-testing.md` (if exists)
