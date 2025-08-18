# BODDESCMIG-005: Add Body Descriptor Validation Logic

## Ticket ID

BODDESCMIG-005

## Title

Create centralized body descriptor validation utilities and error handling

## Status

READY FOR IMPLEMENTATION

## Priority

HIGH

## Estimated Effort

2-3 hours

## Dependencies

- BODDESCMIG-001: Update body component schema ✅
- BODDESCMIG-002: Update anatomy recipe schema ✅
- BODDESCMIG-004: Modify AnatomyGenerationWorkflow ✅

## Related Specs

- specs/body-descriptor-migration.spec.md (Section 4.3.2, Section 3.2 NFR-3)

## Description

Create centralized validation utilities for body descriptors that can be shared across multiple components (AnatomyGenerationWorkflow, RecipeLoader, BodyDescriptionComposer). This provides consistent validation, clear error handling, and reusable descriptor utilities throughout the system.

## Current State

**Validation Scattered Across Components**:

- AnatomyGenerationWorkflow has inline validation (from BODDESCMIG-004)
- RecipeLoader may have separate validation (from BODDESCMIG-003)
- No centralized constants for descriptor enums
- Inconsistent error messages across components

**Missing Infrastructure**:

- Centralized descriptor constants
- Reusable validation utilities
- Consistent error handling
- Descriptor metadata (labels, descriptions)

## Technical Requirements

### 1. Descriptor Constants and Metadata

**File**: `src/anatomy/constants/bodyDescriptorConstants.js`

```javascript
/**
 * @file Body descriptor constants and metadata
 * Centralized definitions for body-level descriptors used across the anatomy system
 */

/**
 * Valid body build types
 */
export const BODY_BUILD_TYPES = {
  SKINNY: 'skinny',
  SLIM: 'slim',
  TONED: 'toned',
  ATHLETIC: 'athletic',
  SHAPELY: 'shapely',
  THICK: 'thick',
  MUSCULAR: 'muscular',
  STOCKY: 'stocky',
};

/**
 * Valid body hair density levels
 */
export const BODY_HAIR_DENSITY = {
  HAIRLESS: 'hairless',
  SPARSE: 'sparse',
  LIGHT: 'light',
  MODERATE: 'moderate',
  HAIRY: 'hairy',
  VERY_HAIRY: 'very-hairy',
};

/**
 * Valid body composition types
 */
export const BODY_COMPOSITION_TYPES = {
  UNDERWEIGHT: 'underweight',
  LEAN: 'lean',
  AVERAGE: 'average',
  SOFT: 'soft',
  CHUBBY: 'chubby',
  OVERWEIGHT: 'overweight',
  OBESE: 'obese',
};

/**
 * Descriptor metadata including display labels and validation info
 */
export const DESCRIPTOR_METADATA = {
  build: {
    label: 'Build',
    validValues: Object.values(BODY_BUILD_TYPES),
    description: 'Body build type',
  },
  density: {
    label: 'Body hair',
    validValues: Object.values(BODY_HAIR_DENSITY),
    description: 'Body hair density level',
  },
  composition: {
    label: 'Body composition',
    validValues: Object.values(BODY_COMPOSITION_TYPES),
    description: 'Body composition type',
  },
  skinColor: {
    label: 'Skin color',
    validValues: null, // Free-form string
    description: 'Skin color descriptor',
  },
};

/**
 * All supported descriptor property names
 */
export const SUPPORTED_DESCRIPTOR_PROPERTIES = Object.keys(DESCRIPTOR_METADATA);
```

### 2. Validation Utilities

**File**: `src/anatomy/utils/bodyDescriptorValidator.js`

```javascript
/**
 * @file Body descriptor validation utilities
 * Centralized validation logic for body-level descriptors
 */

import {
  DESCRIPTOR_METADATA,
  SUPPORTED_DESCRIPTOR_PROPERTIES,
} from '../constants/bodyDescriptorConstants.js';
import { BodyDescriptorValidationError } from '../errors/bodyDescriptorValidationError.js';

export class BodyDescriptorValidator {
  /**
   * Validates a complete body descriptors object
   * @param {Object|null|undefined} bodyDescriptors - The descriptors to validate
   * @param {string} context - Context for error messages (e.g., recipe ID)
   * @throws {BodyDescriptorValidationError} If validation fails
   */
  static validate(bodyDescriptors, context = 'unknown') {
    if (!bodyDescriptors) {
      return; // null/undefined is valid (optional field)
    }

    if (typeof bodyDescriptors !== 'object') {
      throw new BodyDescriptorValidationError(
        `Body descriptors must be an object in ${context}`
      );
    }

    // Validate each descriptor property
    for (const [property, value] of Object.entries(bodyDescriptors)) {
      this.validateDescriptorProperty(property, value, context);
    }

    // Check for unknown properties
    this.validateNoUnknownProperties(bodyDescriptors, context);
  }

  /**
   * Validates a single descriptor property
   * @param {string} property - The property name
   * @param {*} value - The property value
   * @param {string} context - Context for error messages
   * @throws {BodyDescriptorValidationError} If validation fails
   */
  static validateDescriptorProperty(property, value, context = 'unknown') {
    const metadata = DESCRIPTOR_METADATA[property];

    if (!metadata) {
      throw new BodyDescriptorValidationError(
        `Unknown body descriptor property '${property}' in ${context}. Supported properties: ${SUPPORTED_DESCRIPTOR_PROPERTIES.join(', ')}`
      );
    }

    // Validate value type
    if (typeof value !== 'string') {
      throw new BodyDescriptorValidationError(
        `Body descriptor '${property}' must be a string in ${context}, got ${typeof value}`
      );
    }

    // Validate enum values (skip skinColor as it's free-form)
    if (metadata.validValues && !metadata.validValues.includes(value)) {
      throw new BodyDescriptorValidationError(
        `Invalid ${property} descriptor '${value}' in ${context}. Must be one of: ${metadata.validValues.join(', ')}`
      );
    }
  }

  /**
   * Validates that no unknown properties are present
   * @param {Object} bodyDescriptors - The descriptors object
   * @param {string} context - Context for error messages
   * @throws {BodyDescriptorValidationError} If unknown properties found
   */
  static validateNoUnknownProperties(bodyDescriptors, context = 'unknown') {
    const unknownProperties = Object.keys(bodyDescriptors).filter(
      (prop) => !SUPPORTED_DESCRIPTOR_PROPERTIES.includes(prop)
    );

    if (unknownProperties.length > 0) {
      throw new BodyDescriptorValidationError(
        `Unknown body descriptor properties in ${context}: ${unknownProperties.join(', ')}. Supported properties: ${SUPPORTED_DESCRIPTOR_PROPERTIES.join(', ')}`
      );
    }
  }

  /**
   * Validates a specific descriptor type
   * @param {'build'|'density'|'composition'|'skinColor'} descriptorType - The descriptor type
   * @param {string} value - The value to validate
   * @param {string} context - Context for error messages
   * @throws {BodyDescriptorValidationError} If validation fails
   */
  static validateDescriptorType(descriptorType, value, context = 'unknown') {
    this.validateDescriptorProperty(descriptorType, value, context);
  }

  /**
   * Gets display label for a descriptor property
   * @param {string} property - The property name
   * @returns {string} The display label
   */
  static getDescriptorLabel(property) {
    const metadata = DESCRIPTOR_METADATA[property];
    return metadata ? metadata.label : property;
  }

  /**
   * Gets valid values for a descriptor property
   * @param {string} property - The property name
   * @returns {string[]|null} Array of valid values or null if free-form
   */
  static getValidValues(property) {
    const metadata = DESCRIPTOR_METADATA[property];
    return metadata ? metadata.validValues : null;
  }

  /**
   * Checks if a descriptor property supports enum validation
   * @param {string} property - The property name
   * @returns {boolean} True if property has enum validation
   */
  static hasEnumValidation(property) {
    return Boolean(DESCRIPTOR_METADATA[property]?.validValues);
  }
}
```

### 3. Custom Error Classes

**File**: `src/anatomy/errors/bodyDescriptorValidationError.js`

```javascript
/**
 * @file Body descriptor validation error
 * Custom error class for body descriptor validation failures
 */

import { ValidationError } from '../../errors/validationError.js';

export class BodyDescriptorValidationError extends ValidationError {
  constructor(message, descriptorProperty = null, invalidValue = null) {
    super(message);
    this.name = 'BodyDescriptorValidationError';
    this.descriptorProperty = descriptorProperty;
    this.invalidValue = invalidValue;

    // Capture stack trace
    Error.captureStackTrace(this, BodyDescriptorValidationError);
  }

  /**
   * Creates error for invalid enum value
   * @param {string} property - The descriptor property
   * @param {string} value - The invalid value
   * @param {string[]} validValues - Array of valid values
   * @param {string} context - Context for error
   * @returns {BodyDescriptorValidationError}
   */
  static invalidEnumValue(property, value, validValues, context = 'unknown') {
    const message = `Invalid ${property} descriptor '${value}' in ${context}. Must be one of: ${validValues.join(', ')}`;
    return new BodyDescriptorValidationError(message, property, value);
  }

  /**
   * Creates error for unknown property
   * @param {string} property - The unknown property
   * @param {string[]} supportedProperties - Array of supported properties
   * @param {string} context - Context for error
   * @returns {BodyDescriptorValidationError}
   */
  static unknownProperty(property, supportedProperties, context = 'unknown') {
    const message = `Unknown body descriptor property '${property}' in ${context}. Supported properties: ${supportedProperties.join(', ')}`;
    return new BodyDescriptorValidationError(message, property, null);
  }
}
```

### 4. Utility Functions

**File**: `src/anatomy/utils/bodyDescriptorUtils.js`

```javascript
/**
 * @file Body descriptor utility functions
 * Helper functions for working with body descriptors
 */

import { DESCRIPTOR_METADATA } from '../constants/bodyDescriptorConstants.js';

/**
 * Formats a descriptor value for display
 * @param {string} property - The descriptor property
 * @param {string} value - The descriptor value
 * @returns {string} Formatted display string
 */
export function formatDescriptorForDisplay(property, value) {
  const metadata = DESCRIPTOR_METADATA[property];
  const label = metadata ? metadata.label : property;
  return `${label}: ${value}`;
}

/**
 * Filters out empty or null descriptor values
 * @param {Object} bodyDescriptors - The descriptors object
 * @returns {Object} Filtered descriptors with only truthy values
 */
export function filterValidDescriptors(bodyDescriptors) {
  if (!bodyDescriptors) return {};

  const filtered = {};
  for (const [key, value] of Object.entries(bodyDescriptors)) {
    if (value && typeof value === 'string' && value.trim()) {
      filtered[key] = value.trim();
    }
  }
  return filtered;
}

/**
 * Merges descriptor objects with override precedence
 * @param {Object} baseDescriptors - Base descriptors
 * @param {Object} overrideDescriptors - Override descriptors
 * @returns {Object} Merged descriptors
 */
export function mergeDescriptors(baseDescriptors, overrideDescriptors) {
  return {
    ...filterValidDescriptors(baseDescriptors),
    ...filterValidDescriptors(overrideDescriptors),
  };
}

/**
 * Gets all descriptor properties that have values
 * @param {Object} bodyDescriptors - The descriptors object
 * @returns {string[]} Array of property names with values
 */
export function getActiveDescriptorProperties(bodyDescriptors) {
  const filtered = filterValidDescriptors(bodyDescriptors);
  return Object.keys(filtered);
}

/**
 * Converts descriptors to display format array
 * @param {Object} bodyDescriptors - The descriptors object
 * @returns {string[]} Array of formatted display strings
 */
export function descriptorsToDisplayArray(bodyDescriptors) {
  const filtered = filterValidDescriptors(bodyDescriptors);
  return Object.entries(filtered).map(([property, value]) =>
    formatDescriptorForDisplay(property, value)
  );
}
```

## Implementation Steps

1. **Create Constants File**
   - Define all descriptor enum constants
   - Create metadata structure with labels and validation info
   - Export supported property names

2. **Implement Validation Utilities**
   - Create BodyDescriptorValidator class with static methods
   - Implement comprehensive validation logic
   - Add specific validation methods for different use cases

3. **Create Custom Error Classes**
   - Implement BodyDescriptorValidationError
   - Add factory methods for common error scenarios
   - Ensure proper error inheritance

4. **Add Utility Functions**
   - Create helper functions for descriptor manipulation
   - Add formatting and display utilities
   - Implement filtering and merging functions

5. **Update Existing Components**
   - Refactor AnatomyGenerationWorkflow to use centralized validation
   - Update RecipeLoader validation to use new utilities
   - Replace inline validation with reusable utilities

6. **Add Integration Tests**
   - Test validation utilities with various inputs
   - Test error handling and messages
   - Test integration with existing components

## Validation Criteria

### Validation Logic Tests

- [ ] Valid descriptor objects pass validation
- [ ] Invalid enum values trigger appropriate errors
- [ ] Unknown properties are caught and reported
- [ ] Free-form skinColor values pass validation
- [ ] Null/undefined descriptor objects are handled correctly
- [ ] Empty descriptor objects are valid

### Error Handling Tests

- [ ] BodyDescriptorValidationError provides clear messages
- [ ] Error includes context information (recipe ID, etc.)
- [ ] Factory methods create appropriate error instances
- [ ] Error inheritance works correctly

### Utility Function Tests

- [ ] Descriptor formatting produces correct display strings
- [ ] Filtering removes empty/null values correctly
- [ ] Merging preserves override precedence
- [ ] Display array conversion works properly

### Integration Tests

- [ ] AnatomyGenerationWorkflow uses centralized validation
- [ ] RecipeLoader integrates with validation utilities
- [ ] Error messages are consistent across components
- [ ] Performance impact is minimal

## Testing Requirements

### Unit Tests

**File**: `tests/unit/anatomy/utils/bodyDescriptorValidator.test.js`

- Test all validation methods
- Test error conditions and messages
- Test edge cases (null, empty objects, invalid types)

**File**: `tests/unit/anatomy/utils/bodyDescriptorUtils.test.js`

- Test utility functions
- Test formatting and display functions
- Test filtering and merging logic

**File**: `tests/unit/anatomy/errors/bodyDescriptorValidationError.test.js`

- Test error class behavior
- Test factory methods
- Test error properties and inheritance

### Integration Tests

**File**: `tests/integration/anatomy/descriptorValidationIntegration.test.js`

- Test integration with AnatomyGenerationWorkflow
- Test integration with RecipeLoader
- Test end-to-end validation workflow

## Files Created

### New Files

- `src/anatomy/constants/bodyDescriptorConstants.js`
- `src/anatomy/utils/bodyDescriptorValidator.js`
- `src/anatomy/utils/bodyDescriptorUtils.js`
- `src/anatomy/errors/bodyDescriptorValidationError.js`

### Test Files

- `tests/unit/anatomy/utils/bodyDescriptorValidator.test.js`
- `tests/unit/anatomy/utils/bodyDescriptorUtils.test.js`
- `tests/unit/anatomy/errors/bodyDescriptorValidationError.test.js`
- `tests/integration/anatomy/descriptorValidationIntegration.test.js`

## Files Modified

- `src/anatomy/workflows/anatomyGenerationWorkflow.js` (to use centralized validation)
- Recipe validation components (to use centralized validation)
- Import statements in various components

## Integration Points

### With Previous Tickets

- Uses constants matching schema definitions from BODDESCMIG-001 & 002
- Replaces inline validation from BODDESCMIG-004
- Enhances recipe validation from BODDESCMIG-003

### With Future Tickets

- Validation utilities will be used by BODDESCMIG-006 & 007
- Error classes will be used throughout descriptor system
- Constants will be referenced by description generation

### With Existing Systems

- Integrates with existing error handling patterns
- Uses project's validation architecture
- Maintains compatibility with ECS system

## Risk Assessment

**Low Risk** - Utility/infrastructure enhancement:

- Creates reusable validation infrastructure
- Consolidates existing scattered validation logic
- Clear error handling improves debugging
- No breaking changes to existing APIs

**Benefits**:

- Consistent validation across all components
- Better error messages for debugging
- Reduced code duplication
- Easier maintenance and updates

## Success Criteria

1. **Centralized Validation**:
   - All descriptor validation uses centralized utilities
   - Consistent error messages across components
   - No duplication of validation logic

2. **Error Handling**:
   - Clear, actionable error messages
   - Proper error inheritance and properties
   - Context-aware error reporting

3. **Code Quality**:
   - Reusable, well-tested utility functions
   - Consistent constants across the system
   - Reduced complexity in consuming components

## Next Steps

After completion:

- BODDESCMIG-006: Update BodyDescriptionComposer methods
- BODDESCMIG-007: Implement description generation with body descriptors

## Notes

- This ticket focuses on infrastructure and utilities
- Provides foundation for consistent descriptor handling
- Validation logic should be performant for frequent use
- Consider caching validation results if needed for performance
- Constants should be easily extensible for future descriptor types
