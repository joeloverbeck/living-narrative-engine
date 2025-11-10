# ANASYSIMP-019-02: Create ValidatorGenerator Class

**Phase:** 1 (Foundation)
**Timeline:** 1-2 days
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-01 (Extend component.schema.json)
**Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)

## Overview

Implement the `ValidatorGenerator` class that automatically generates validation functions from component schemas with `validationRules`. This class will support enum validation, type validation, required field validation, and provide helpful error messages with suggestions.

## Objectives

1. Create `ValidatorGenerator` class with dependency injection
2. Implement enum validator generation
3. Implement type validator generation
4. Implement required field validator generation
5. Implement error message templating system
6. Implement similarity-based suggestion algorithm
7. Support validator composition (combine multiple validators)
8. Integration with existing validation pipeline

## Technical Details

### 1. ValidatorGenerator Class

**File to Create:** `src/validation/validatorGenerator.js`

```javascript
/**
 * @file Generates validators from component schemas
 * Supports automatic generation of validation functions with custom error messages
 */

import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';
import { string } from '../utils/validationCore.js';

/**
 * Generates validators from component schemas with validationRules
 */
class ValidatorGenerator {
  #logger;
  #similarityCalculator;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.logger - Logger instance
   * @param {Object} params.similarityCalculator - String similarity calculator
   */
  constructor({ logger, similarityCalculator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(similarityCalculator, 'ISimilarityCalculator', logger, {
      requiredMethods: ['calculateDistance', 'findClosest'],
    });

    this.#logger = logger;
    this.#similarityCalculator = similarityCalculator;
  }

  /**
   * Generates a validator function from a component schema
   * @param {Object} componentSchema - Component schema with dataSchema and validationRules
   * @returns {Function} Validator function that takes data and returns validation result
   */
  generate(componentSchema) {
    assertPresent(componentSchema, 'Component schema is required');
    assertPresent(componentSchema.dataSchema, 'Component schema must have dataSchema');

    // Check if validator generation is enabled
    if (!componentSchema.validationRules?.generateValidator) {
      this.#logger.debug(`Validator generation disabled for ${componentSchema.id}`);
      return null;
    }

    this.#logger.debug(`Generating validator for ${componentSchema.id}`);

    const validators = [];
    const dataSchema = componentSchema.dataSchema;
    const validationRules = componentSchema.validationRules;

    // Generate validators for each property
    for (const [propName, propSchema] of Object.entries(dataSchema.properties || {})) {
      // Enum validation
      if (propSchema.enum) {
        validators.push(
          this.#generateEnumValidator(propName, propSchema, validationRules)
        );
      }

      // Type validation
      if (propSchema.type) {
        validators.push(
          this.#generateTypeValidator(propName, propSchema, validationRules)
        );
      }
    }

    // Required field validation
    if (dataSchema.required && dataSchema.required.length > 0) {
      validators.push(
        this.#generateRequiredValidator(dataSchema.required, validationRules)
      );
    }

    // Combine all validators
    return this.#combineValidators(validators, componentSchema.id);
  }

  /**
   * Generates an enum validator for a property
   * @private
   */
  #generateEnumValidator(propertyName, schema, validationRules) {
    const validValues = schema.enum;
    const errorTemplate =
      validationRules?.errorMessages?.invalidEnum ||
      "Invalid {{property}}: {{value}}. Valid options: {{validValues}}";
    const enableSuggestions = validationRules?.suggestions?.enableSimilarity !== false;
    const maxDistance = validationRules?.suggestions?.maxDistance || 3;

    return (data) => {
      const value = data[propertyName];

      // Skip if value not present (handled by required validator)
      if (value === undefined || value === null) {
        return { valid: true };
      }

      if (!validValues.includes(value)) {
        let suggestion = null;

        if (enableSuggestions && typeof value === 'string') {
          suggestion = this.#similarityCalculator.findClosest(
            value,
            validValues,
            maxDistance
          );
        }

        const message = this.#formatErrorMessage(errorTemplate, {
          property: propertyName,
          value: value,
          validValues: validValues.join(', '),
        });

        return {
          valid: false,
          error: {
            type: 'invalidEnum',
            property: propertyName,
            value,
            validValues,
            message,
            suggestion,
          },
        };
      }

      return { valid: true };
    };
  }

  /**
   * Generates a type validator for a property
   * @private
   */
  #generateTypeValidator(propertyName, schema, validationRules) {
    const expectedType = schema.type;
    const errorTemplate =
      validationRules?.errorMessages?.invalidType ||
      "Invalid type for {{field}}: expected {{expected}}, got {{actual}}";

    return (data) => {
      const value = data[propertyName];

      // Skip if value not present (handled by required validator)
      if (value === undefined || value === null) {
        return { valid: true };
      }

      const actualType = this.#getJavaScriptType(value);

      if (!this.#isTypeValid(value, expectedType)) {
        const message = this.#formatErrorMessage(errorTemplate, {
          field: propertyName,
          expected: expectedType,
          actual: actualType,
        });

        return {
          valid: false,
          error: {
            type: 'invalidType',
            property: propertyName,
            expectedType,
            actualType,
            message,
          },
        };
      }

      return { valid: true };
    };
  }

  /**
   * Generates a required field validator
   * @private
   */
  #generateRequiredValidator(requiredFields, validationRules) {
    const errorTemplate =
      validationRules?.errorMessages?.missingRequired ||
      "Missing required field: {{field}}";

    return (data) => {
      const errors = [];

      for (const field of requiredFields) {
        const value = data[field];

        if (value === undefined || value === null || value === '') {
          const message = this.#formatErrorMessage(errorTemplate, {
            field,
          });

          errors.push({
            type: 'missingRequired',
            property: field,
            message,
          });
        }
      }

      if (errors.length > 0) {
        return {
          valid: false,
          errors,
        };
      }

      return { valid: true };
    };
  }

  /**
   * Combines multiple validators into a single validator function
   * @private
   */
  #combineValidators(validators, schemaId) {
    return (data) => {
      assertPresent(data, 'Data is required for validation');

      const allErrors = [];

      for (const validator of validators) {
        const result = validator(data);

        if (!result.valid) {
          if (result.error) {
            allErrors.push(result.error);
          }
          if (result.errors) {
            allErrors.push(...result.errors);
          }
        }
      }

      return {
        valid: allErrors.length === 0,
        errors: allErrors,
        schemaId,
      };
    };
  }

  /**
   * Formats an error message template with variables
   * @private
   */
  #formatErrorMessage(template, variables) {
    let message = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      message = message.replace(new RegExp(placeholder, 'g'), value);
    }

    return message;
  }

  /**
   * Gets the JavaScript type of a value
   * @private
   */
  #getJavaScriptType(value) {
    if (Array.isArray(value)) {
      return 'array';
    }
    if (value === null) {
      return 'null';
    }
    return typeof value;
  }

  /**
   * Checks if a value matches the expected JSON Schema type
   * @private
   */
  #isTypeValid(value, expectedType) {
    const actualType = this.#getJavaScriptType(value);

    switch (expectedType) {
      case 'string':
        return actualType === 'string';
      case 'number':
      case 'integer':
        return actualType === 'number' && !Number.isNaN(value);
      case 'boolean':
        return actualType === 'boolean';
      case 'array':
        return actualType === 'array';
      case 'object':
        return actualType === 'object' && value !== null;
      case 'null':
        return value === null;
      default:
        this.#logger.warn(`Unknown type: ${expectedType}`);
        return true; // Unknown types pass validation
    }
  }
}

export default ValidatorGenerator;
```

### 2. String Similarity Calculator

**File to Create:** `src/validation/stringSimilarityCalculator.js`

```javascript
/**
 * @file String similarity calculator using Levenshtein distance
 * Used for providing helpful suggestions in validation errors
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * Calculates string similarity and finds closest matches
 */
class StringSimilarityCalculator {
  #logger;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
  }

  /**
   * Calculates Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  calculateDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create distance matrix
    const matrix = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Calculate distances
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // Deletion
          matrix[i][j - 1] + 1, // Insertion
          matrix[i - 1][j - 1] + cost // Substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Finds the closest match from a list of valid values
   * @param {string} input - Input string to match
   * @param {Array<string>} validValues - List of valid values
   * @param {number} maxDistance - Maximum edit distance to consider
   * @returns {string|null} Closest match or null
   */
  findClosest(input, validValues, maxDistance = 3) {
    if (!input || !validValues || validValues.length === 0) {
      return null;
    }

    const inputLower = input.toLowerCase();
    let closest = null;
    let minDistance = Infinity;

    for (const value of validValues) {
      const valueLower = value.toLowerCase();
      const distance = this.calculateDistance(inputLower, valueLower);

      if (distance < minDistance && distance <= maxDistance) {
        minDistance = distance;
        closest = value;
      }
    }

    return closest;
  }
}

export default StringSimilarityCalculator;
```

### 3. Dependency Injection Token Definition

**File to Update:** `src/dependencyInjection/tokens/tokens-core.js`

Add new tokens to the `coreTokens` object (keep alphabetically sorted):

```javascript
export const coreTokens = freeze({
  // ... existing tokens ...
  ISchemaValidator: 'ISchemaValidator',
  IStringSimilarityCalculator: 'IStringSimilarityCalculator',  // ADD THIS
  IValidatorGenerator: 'IValidatorGenerator',                  // ADD THIS
  // ... remaining tokens ...
});
```

### 4. Dependency Injection Registration

**File to Update:** `src/dependencyInjection/registrations/loadersRegistrations.js`

Add registrations for the new classes in the appropriate section (near the validation services):

```javascript
import ValidatorGenerator from '../../validation/validatorGenerator.js';
import StringSimilarityCalculator from '../../validation/stringSimilarityCalculator.js';

// Add after ISchemaValidator registration (around line 193)
registrar.singletonFactory(
  tokens.IStringSimilarityCalculator,
  (c) => new StringSimilarityCalculator({
    logger: c.resolve(tokens.ILogger)
  })
);

registrar.singletonFactory(
  tokens.IValidatorGenerator,
  (c) => new ValidatorGenerator({
    logger: c.resolve(tokens.ILogger),
    similarityCalculator: c.resolve(tokens.IStringSimilarityCalculator)
  })
);
```

## Files to Create

- [ ] `src/validation/validatorGenerator.js`
- [ ] `src/validation/stringSimilarityCalculator.js`
- [ ] `tests/unit/validation/validatorGenerator.test.js`
- [ ] `tests/unit/validation/stringSimilarityCalculator.test.js`

## Files to Update

- [ ] `src/dependencyInjection/registrations/loadersRegistrations.js` - Register new classes
- [ ] `src/dependencyInjection/tokens/tokens-core.js` - Add new tokens for validation services

## Testing Requirements

### Unit Tests

**File:** `tests/unit/validation/validatorGenerator.test.js`

Test cases:
- Generate validator from schema with validationRules
- Generate enum validator with custom error message
- Generate type validator for string, number, object, array
- Generate required field validator
- Combine multiple validators
- Format error messages with template variables
- Provide suggestions for similar enum values
- Handle schema without validationRules (returns null)
- Handle schema with generateValidator: false
- Validate real component data

**File:** `tests/unit/validation/stringSimilarityCalculator.test.js`

Test cases:
- Calculate Levenshtein distance (identical strings)
- Calculate Levenshtein distance (1 substitution)
- Calculate Levenshtein distance (1 insertion)
- Calculate Levenshtein distance (1 deletion)
- Calculate Levenshtein distance (multiple operations)
- Find closest match within max distance
- Find closest match (multiple candidates)
- Return null when no match within max distance
- Handle empty inputs
- Case-insensitive matching

**Coverage Target:** 90% branches, 95% functions/lines

### Integration Tests

**File:** `tests/integration/validation/generatedValidators.integration.test.js`

Test cases:
- Generate validator from real component schema
- Validate valid component data
- Validate invalid component data (enum)
- Validate invalid component data (type)
- Validate missing required fields
- Receive helpful error messages
- Receive suggestions for typos
- Validate descriptor component schemas

## Acceptance Criteria

- [ ] `ValidatorGenerator` class implemented with full functionality
- [ ] `StringSimilarityCalculator` class implemented
- [ ] Enum validation with suggestions working
- [ ] Type validation working for all JSON Schema types
- [ ] Required field validation working
- [ ] Error message templating working
- [ ] Validator composition working correctly
- [ ] All dependencies properly injected
- [ ] All unit tests pass with 90%+ coverage
- [ ] Integration tests demonstrate end-to-end validation
- [ ] ESLint passes
- [ ] TypeScript type checking passes

## Validation Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/validation/validatorGenerator.test.js
npm run test:unit -- tests/unit/validation/stringSimilarityCalculator.test.js

# Run integration tests
npm run test:integration -- tests/integration/validation/generatedValidators.integration.test.js

# Check types
npm run typecheck

# Lint
npx eslint src/validation/validatorGenerator.js src/validation/stringSimilarityCalculator.js
```

## Success Metrics

- ✅ Validators correctly identify invalid enum values
- ✅ Validators correctly identify type mismatches
- ✅ Validators correctly identify missing required fields
- ✅ Error messages are clear and helpful
- ✅ Suggestions help users fix typos
- ✅ Performance is acceptable (< 1ms per validation)

## Notes

- **Dependency Status:** The dependency ticket ANASYSIMP-019-01 is COMPLETE. The `validationRules` schema extension already exists in `data/schemas/component.schema.json` and is ready to use.
- **Example Component:** See `data/mods/descriptors/components/texture-with-validation.component.json` for a working example of the `validationRules` usage.
- **Levenshtein Distance:** Standard algorithm for measuring string similarity
- **Template Variables:** Use `{{variable}}` syntax for consistency
- **Performance:** Cache similarity calculations if performance becomes an issue
- **Extensibility:** Design allows adding more validator types (pattern, range, etc.)
- **Token Import:** Tokens are imported in loadersRegistrations.js via `import { tokens } from '../tokens.js';` which aggregates all token files including tokens-core.js. No additional import changes needed.

## Alternative Approaches

If runtime generation proves too slow:
- **Build-time generation:** Generate validator code during build
- **Caching:** Cache generated validators per schema
- **Lazy generation:** Only generate validators when first needed

## Related Tickets

- **Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)
- **Depends on:** ANASYSIMP-019-01 (Extend component.schema.json)
- **Blocks:** ANASYSIMP-019-03 (Integrate with AjvSchemaValidator)
- **Related:** ANASYSIMP-017 (Validation Result Caching) - can cache generated validators

## References

- **Levenshtein Distance:** [Wikipedia](https://en.wikipedia.org/wiki/Levenshtein_distance)
- **JSON Schema Types:** [JSON Schema Specification](https://json-schema.org/understanding-json-schema/reference/type.html)
- **Body Descriptor Validator:** `src/anatomy/validators/bodyDescriptorValidator.js` (reference implementation)
