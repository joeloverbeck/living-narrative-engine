/**
 * @file Validation utilities for cliché generation
 *
 * Provides comprehensive validation functions for all cliché-related operations:
 * - Input validation for direction selection and prerequisites
 * - LLM response validation with detailed error reporting
 * - Data sanitization and security measures
 * - Schema compliance validation
 * @see ../../errors/clicheErrors.js
 * @see ../services/clicheErrorHandler.js
 */

import {
  ClicheValidationError,
  ClicheDataIntegrityError,
  ClichePrerequisiteError,
} from '../../errors/clicheErrors.js';
import { assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Required categories for LLM cliché response validation
 */
const REQUIRED_CLICHE_CATEGORIES = [
  'names',
  'physicalDescriptions',
  'personalityTraits',
  'skillsAbilities',
  'typicalLikes',
  'typicalDislikes',
  'commonFears',
  'genericGoals',
  'backgroundElements',
  'overusedSecrets',
  'speechPatterns',
];

/**
 * Configuration for category validation
 */
const CATEGORY_VALIDATION_CONFIG = {
  minItems: 3,
  maxItems: 5,
  minTropes: 3,
  maxTropes: 10,
};

/**
 * Validates direction selection parameters
 *
 * Ensures the selected direction ID is valid and exists in the available data.
 *
 * @param {string} directionId - Direction ID to validate
 * @param {Array<object>} directionsData - Available directions data
 * @returns {object} The validated direction object
 * @throws {ClicheValidationError} If direction is invalid or not found
 * @throws {ClicheDataIntegrityError} If directions data is corrupted
 */
export function validateDirectionSelection(directionId, directionsData) {
  // Validate direction ID parameter
  try {
    string.assertNonBlank(directionId, 'directionId', 'direction selection');
  } catch (error) {
    throw new ClicheValidationError(
      'Direction ID is required for selection',
      ['Direction ID must be a non-empty string'],
      {
        invalidData: directionId,
        validator: 'validateDirectionSelection',
      }
    );
  }

  // Validate directions data structure
  if (!Array.isArray(directionsData) || directionsData.length === 0) {
    throw new ClicheDataIntegrityError(
      'Directions data is missing or invalid',
      'directions',
      {
        expectedData: 'Array of direction objects',
        actualData: directionsData,
        source: 'direction selection validation',
      }
    );
  }

  // Find the selected direction
  let direction = null;
  let concept = null;

  // Search through organized directions data structure
  for (const conceptGroup of directionsData) {
    if (!conceptGroup.directions || !Array.isArray(conceptGroup.directions)) {
      continue;
    }

    const foundDirection = conceptGroup.directions.find(
      (d) => d.id === directionId
    );
    if (foundDirection) {
      direction = foundDirection;
      concept = {
        id: conceptGroup.conceptId,
        text: conceptGroup.conceptText,
        title: conceptGroup.conceptTitle,
      };
      break;
    }
  }

  if (!direction) {
    throw new ClicheValidationError(
      'Selected direction not found',
      [
        `Direction with ID '${directionId}' does not exist in available options`,
      ],
      {
        directionId,
        availableIds: directionsData
          .flatMap((group) => group.directions || [])
          .map((d) => d.id)
          .slice(0, 10), // Limit for error message readability
        validator: 'validateDirectionSelection',
      }
    );
  }

  // Validate direction structure
  const directionErrors = [];
  if (!direction.id)
    directionErrors.push('Direction missing required field: id');
  if (!direction.title)
    directionErrors.push('Direction missing required field: title');
  if (!direction.description)
    directionErrors.push('Direction missing required field: description');

  if (directionErrors.length > 0) {
    throw new ClicheDataIntegrityError(
      'Selected direction has invalid structure',
      'direction',
      {
        expectedData: { id: 'string', title: 'string', description: 'string' },
        actualData: direction,
        source: 'direction selection validation',
      }
    );
  }

  return { direction, concept };
}

/**
 * Validates prerequisites for cliché generation
 *
 * Ensures all required conditions are met before starting generation.
 *
 * @param {object} direction - Selected direction object
 * @param {object} concept - Associated concept object
 * @param {boolean} isGenerating - Whether generation is currently in progress
 * @param {object} [additionalChecks] - Additional validation checks
 * @throws {ClichePrerequisiteError} If prerequisites are not met
 * @throws {ClicheValidationError} If generation is already in progress
 */
export function validateGenerationPrerequisites(
  direction,
  concept,
  isGenerating,
  additionalChecks = {}
) {
  const missingPrerequisites = [];
  const validationErrors = [];

  // Check if generation is already in progress
  if (isGenerating) {
    throw new ClicheValidationError(
      'Generation already in progress',
      ['Cannot start new generation while another is running'],
      {
        operation: 'cliche generation',
        validator: 'validateGenerationPrerequisites',
      }
    );
  }

  // Validate direction
  try {
    assertPresent(direction, 'Direction must be selected');

    if (!direction.id || !direction.title) {
      validationErrors.push('Direction missing required fields (id, title)');
      missingPrerequisites.push('valid direction');
    }
  } catch (error) {
    missingPrerequisites.push('direction selection');
    validationErrors.push('Direction must be selected before generation');
  }

  // Validate concept
  try {
    assertPresent(concept, 'Concept must be available');

    if (!concept.id || !concept.text) {
      validationErrors.push('Concept missing required fields (id, text)');
      missingPrerequisites.push('valid concept');
    }
  } catch (error) {
    missingPrerequisites.push('concept data');
    validationErrors.push('Concept must be available before generation');
  }

  // Additional checks (extensible for future requirements)
  if (
    additionalChecks.requiresLLMAvailability &&
    !additionalChecks.llmAvailable
  ) {
    missingPrerequisites.push('LLM service availability');
    validationErrors.push('LLM service must be available for generation');
  }

  if (
    additionalChecks.requiresStorageAccess &&
    !additionalChecks.storageAvailable
  ) {
    missingPrerequisites.push('storage access');
    validationErrors.push('Storage system must be accessible for generation');
  }

  // Throw error if any prerequisites are missing
  if (missingPrerequisites.length > 0 || validationErrors.length > 0) {
    throw new ClichePrerequisiteError(
      'Prerequisites for cliché generation are not met',
      missingPrerequisites,
      {
        operation: 'cliche generation',
        validationErrors,
        direction: direction?.id,
        concept: concept?.id,
      }
    );
  }
}

/**
 * Validates LLM response structure and content
 *
 * Ensures the LLM response contains all required categories with proper
 * structure and content validation.
 *
 * @param {object} response - LLM response to validate
 * @returns {boolean} True if validation passes
 * @throws {ClicheValidationError} If response validation fails
 */
export function validateLLMResponse(response) {
  const errors = [];

  // Basic structure validation
  if (!response || typeof response !== 'object') {
    throw new ClicheValidationError(
      'Invalid LLM response format',
      ['Response must be a valid JSON object'],
      {
        invalidData: response,
        validator: 'validateLLMResponse',
      }
    );
  }

  // Validate categories exist and are structured correctly
  const categories = response.categories || {};

  if (typeof categories !== 'object' || categories === null) {
    throw new ClicheValidationError(
      'LLM response missing categories object',
      ['Response must contain a "categories" object'],
      {
        invalidData: response,
        validator: 'validateLLMResponse',
      }
    );
  }

  // Validate each required category
  for (const category of REQUIRED_CLICHE_CATEGORIES) {
    if (!Array.isArray(categories[category])) {
      errors.push(`Category '${category}' must be an array`);
      continue;
    }

    const items = categories[category];

    // Validate item count
    if (items.length < CATEGORY_VALIDATION_CONFIG.minItems) {
      errors.push(
        `Category '${category}' must have at least ${CATEGORY_VALIDATION_CONFIG.minItems} items (found ${items.length})`
      );
    }

    if (items.length > CATEGORY_VALIDATION_CONFIG.maxItems) {
      errors.push(
        `Category '${category}' must have no more than ${CATEGORY_VALIDATION_CONFIG.maxItems} items (found ${items.length})`
      );
    }

    // Validate item content
    const invalidItems = items.filter((item, index) => {
      if (typeof item !== 'string') {
        return true;
      }
      const trimmed = item.trim();
      if (trimmed === '') {
        return true;
      }
      // Check for reasonable length (not too short or too long)
      if (trimmed.length < 2 || trimmed.length > 200) {
        return true;
      }
      return false;
    });

    if (invalidItems.length > 0) {
      errors.push(
        `Category '${category}' contains ${invalidItems.length} invalid items (must be non-empty strings with reasonable length)`
      );
    }

    // Check for duplicates within category
    const uniqueItems = new Set(
      items.map((item) =>
        typeof item === 'string' ? item.trim().toLowerCase() : item
      )
    );
    if (uniqueItems.size !== items.length) {
      errors.push(`Category '${category}' contains duplicate items`);
    }
  }

  // Validate tropes and stereotypes
  const tropes = response.tropesAndStereotypes;
  if (!Array.isArray(tropes)) {
    errors.push('tropesAndStereotypes must be an array');
  } else {
    if (tropes.length < CATEGORY_VALIDATION_CONFIG.minTropes) {
      errors.push(
        `tropesAndStereotypes must have at least ${CATEGORY_VALIDATION_CONFIG.minTropes} items (found ${tropes.length})`
      );
    }

    if (tropes.length > CATEGORY_VALIDATION_CONFIG.maxTropes) {
      errors.push(
        `tropesAndStereotypes must have no more than ${CATEGORY_VALIDATION_CONFIG.maxTropes} items (found ${tropes.length})`
      );
    }

    const invalidTropes = tropes.filter(
      (trope) =>
        typeof trope !== 'string' ||
        trope.trim() === '' ||
        trope.trim().length < 5
    );

    if (invalidTropes.length > 0) {
      errors.push(
        `tropesAndStereotypes contains ${invalidTropes.length} invalid items (must be non-empty strings with meaningful content)`
      );
    }
  }

  // Throw validation error if any issues found
  if (errors.length > 0) {
    throw new ClicheValidationError('LLM response validation failed', errors, {
      invalidData: response,
      validator: 'validateLLMResponse',
      categoriesFound: Object.keys(categories),
      requiredCategories: REQUIRED_CLICHE_CATEGORIES,
    });
  }

  return true;
}

/**
 * Validates cliché data before storage
 *
 * Ensures cliché data has all required fields and valid structure
 * before attempting to persist it.
 *
 * @param {object} cliche - Cliché data to validate
 * @returns {boolean} True if validation passes
 * @throws {ClicheValidationError} If cliché data is invalid
 */
export function validateClicheData(cliche) {
  const errors = [];

  if (!cliche || typeof cliche !== 'object') {
    throw new ClicheValidationError(
      'Invalid cliché data format',
      ['Cliché data must be a valid object'],
      {
        invalidData: cliche,
        validator: 'validateClicheData',
      }
    );
  }

  // Validate required fields
  const requiredFields = [
    { field: 'id', type: 'string', description: 'Cliché ID' },
    { field: 'directionId', type: 'string', description: 'Direction ID' },
    { field: 'conceptId', type: 'string', description: 'Concept ID' },
    { field: 'categories', type: 'object', description: 'Categories object' },
    {
      field: 'tropesAndStereotypes',
      type: 'object',
      description: 'Tropes array',
    },
    { field: 'createdAt', type: 'string', description: 'Creation timestamp' },
  ];

  for (const { field, type, description } of requiredFields) {
    if (cliche[field] === undefined || cliche[field] === null) {
      errors.push(`${description} is required`);
      continue;
    }

    if (
      type === 'string' &&
      (typeof cliche[field] !== 'string' || cliche[field].trim() === '')
    ) {
      errors.push(`${description} must be a non-empty string`);
    } else if (
      type === 'object' &&
      (typeof cliche[field] !== 'object' ||
        Array.isArray(cliche[field]) !== (field === 'tropesAndStereotypes'))
    ) {
      errors.push(`${description} must be a valid ${type}`);
    }
  }

  // Validate timestamp format
  if (cliche.createdAt && typeof cliche.createdAt === 'string') {
    const date = new Date(cliche.createdAt);
    if (isNaN(date.getTime())) {
      errors.push('Creation timestamp must be a valid ISO date string');
    }
  }

  // Validate categories structure if present
  if (cliche.categories && typeof cliche.categories === 'object') {
    try {
      validateLLMResponse({
        categories: cliche.categories,
        tropesAndStereotypes: Array.isArray(cliche.tropesAndStereotypes)
          ? cliche.tropesAndStereotypes
          : [],
      });
    } catch (validationError) {
      if (validationError instanceof ClicheValidationError) {
        errors.push(...validationError.validationErrors);
      } else {
        errors.push('Categories validation failed: ' + validationError.message);
      }
    }
  }

  if (errors.length > 0) {
    throw new ClicheValidationError('Invalid cliché data structure', errors, {
      invalidData: cliche,
      validator: 'validateClicheData',
    });
  }

  return true;
}

/**
 * Sanitizes user input to prevent XSS and other security issues
 *
 * Removes potentially dangerous content while preserving legitimate text.
 *
 * @param {*} input - Input value to sanitize
 * @returns {*} Sanitized input (strings are cleaned, other types passed through)
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove script tags and their content
  let sanitized = input.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ''
  );

  // Remove iframe tags and their content
  sanitized = sanitized.replace(
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    ''
  );

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  // Remove data: URLs (can contain executable content)
  sanitized = sanitized.replace(/data:\s*[^,]*,/gi, '');

  // Remove vbscript: protocol
  sanitized = sanitized.replace(/vbscript:/gi, '');

  // Clean up excessive whitespace but preserve formatting
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Validates and sanitizes direction selection input from user
 *
 * Combined validation and sanitization for direction selection workflow.
 *
 * @param {*} rawDirectionId - Raw direction ID from user input
 * @param {Array<object>} directionsData - Available directions data
 * @returns {object} Validated and sanitized selection result
 * @throws {ClicheValidationError} If input is invalid
 */
export function validateAndSanitizeDirectionSelection(
  rawDirectionId,
  directionsData
) {
  // Sanitize input first
  const sanitizedId = sanitizeInput(rawDirectionId);

  // Then validate
  const result = validateDirectionSelection(sanitizedId, directionsData);

  // Return both the validation result and sanitized input
  return {
    ...result,
    sanitizedDirectionId: sanitizedId,
  };
}

/**
 * Configuration object for validation settings
 *
 * Allows external configuration of validation parameters.
 */
export const VALIDATION_CONFIG = {
  categories: CATEGORY_VALIDATION_CONFIG,
  requiredCategories: REQUIRED_CLICHE_CATEGORIES,

  // Update configuration at runtime
  updateConfig(newConfig) {
    Object.assign(CATEGORY_VALIDATION_CONFIG, newConfig.categories || {});

    if (newConfig.requiredCategories) {
      REQUIRED_CLICHE_CATEGORIES.length = 0;
      REQUIRED_CLICHE_CATEGORIES.push(...newConfig.requiredCategories);
    }
  },
};
