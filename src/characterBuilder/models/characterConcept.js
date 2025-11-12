/**
 * @file CharacterConcept data model with validation
 * @see ../services/characterBuilderService.js
 */

import { v4 as uuidv4 } from 'uuid';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('./thematicDirection.js').ThematicDirection} ThematicDirection
 */

/**
 * @typedef {object} CharacterConcept
 * @property {string} id - Unique identifier (UUID)
 * @property {string} concept - User-provided character concept text
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last modification timestamp
 * @property {string} status - Current processing status: 'draft', 'processing', 'completed', 'error'
 * @property {ThematicDirection[]} thematicDirections - Generated thematic directions
 * @property {object} metadata - Additional metadata for future steps
 */

/**
 * Character concept status constants
 */
export const CHARACTER_CONCEPT_STATUS = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
};

/**
 * Creates a new character concept instance
 *
 * @param {string} concept - User-provided character concept text
 * @param {object} [options] - Creation options
 * @param {string} [options.id] - Custom ID (generates UUID if not provided)
 * @param {string} [options.status] - Initial status (defaults to 'draft')
 * @param {ThematicDirection[]} [options.thematicDirections] - Thematic directions
 * @param {object} [options.metadata] - Additional metadata
 * @returns {CharacterConcept} New character concept instance
 */
export function createCharacterConcept(concept, options = {}) {
  if (!concept || typeof concept !== 'string' || concept.trim().length === 0) {
    throw new Error('CharacterConcept: concept must be a non-empty string');
  }

  if (concept.length < 10) {
    throw new Error(
      'CharacterConcept: concept must be at least 10 characters long'
    );
  }

  if (concept.length > 6000) {
    throw new Error(
      'CharacterConcept: concept must be no more than 6000 characters long'
    );
  }

  const now = new Date();

  return {
    id: options.id || uuidv4(),
    concept: concept.trim(),
    status: options.status || CHARACTER_CONCEPT_STATUS.DRAFT,
    createdAt: now,
    updatedAt: now,
    thematicDirections: options.thematicDirections || [],
    metadata: options.metadata || {},
  };
}

/**
 * Updates an existing character concept
 *
 * @param {CharacterConcept} existingConcept - Existing character concept
 * @param {object} updates - Fields to update
 * @param {string} [updates.concept] - New concept text
 * @param {string} [updates.status] - New status
 * @param {ThematicDirection[]} [updates.thematicDirections] - New thematic directions
 * @param {object} [updates.metadata] - New metadata
 * @returns {CharacterConcept} Updated character concept
 */
export function updateCharacterConcept(existingConcept, updates) {
  if (!existingConcept || typeof existingConcept !== 'object') {
    throw new Error('CharacterConcept: existingConcept must be a valid object');
  }

  if (!updates || typeof updates !== 'object') {
    throw new Error('CharacterConcept: updates must be a valid object');
  }

  const updatedConcept = {
    ...existingConcept,
    ...updates,
    updatedAt: new Date(),
  };

  // Validate updated concept if provided
  if (updates.concept !== undefined) {
    if (
      !updates.concept ||
      typeof updates.concept !== 'string' ||
      updates.concept.trim().length === 0
    ) {
      throw new Error('CharacterConcept: concept must be a non-empty string');
    }
    if (updates.concept.length < 10 || updates.concept.length > 6000) {
      throw new Error(
        'CharacterConcept: concept must be between 10 and 6000 characters'
      );
    }
    updatedConcept.concept = updates.concept.trim();
  }

  // Validate status if provided
  if (updates.status !== undefined) {
    const validStatuses = Object.values(CHARACTER_CONCEPT_STATUS);
    if (!validStatuses.includes(updates.status)) {
      throw new Error(
        `CharacterConcept: invalid status '${updates.status}'. Must be one of: ${validStatuses.join(', ')}`
      );
    }
  }

  return updatedConcept;
}

/**
 * Validates a character concept object
 *
 * @param {CharacterConcept} concept - Character concept to validate
 * @param {ISchemaValidator} schemaValidator - Schema validator instance
 * @returns {Promise<boolean>} True if valid, throws error if invalid
 */
export async function validateCharacterConcept(concept, schemaValidator) {
  validateDependency(schemaValidator, 'ISchemaValidator', console, {
    requiredMethods: ['validate'],
  });

  if (!concept || typeof concept !== 'object') {
    throw new Error('CharacterConcept: concept must be a valid object');
  }

  // Convert dates to ISO strings for schema validation
  const conceptForValidation = {
    ...concept,
    createdAt:
      concept.createdAt instanceof Date
        ? concept.createdAt.toISOString()
        : concept.createdAt,
    updatedAt:
      concept.updatedAt instanceof Date
        ? concept.updatedAt.toISOString()
        : concept.updatedAt,
  };

  const result = schemaValidator.validate(
    'schema://living-narrative-engine/character-concept.schema.json',
    conceptForValidation
  );

  if (!result.isValid) {
    const errorMessages = result.errors
      .map((error) => `${error.instancePath || 'root'}: ${error.message}`)
      .join(', ');
    throw new Error(`CharacterConcept validation failed: ${errorMessages}`);
  }

  return true;
}

/**
 * Serializes a character concept for storage
 *
 * @param {CharacterConcept} concept - Character concept to serialize
 * @returns {object} Serialized character concept
 */
export function serializeCharacterConcept(concept) {
  if (!concept || typeof concept !== 'object') {
    throw new Error('CharacterConcept: concept must be a valid object');
  }

  return {
    ...concept,
    createdAt:
      concept.createdAt instanceof Date && !isNaN(concept.createdAt.getTime())
        ? concept.createdAt.toISOString()
        : concept.createdAt,
    updatedAt:
      concept.updatedAt instanceof Date && !isNaN(concept.updatedAt.getTime())
        ? concept.updatedAt.toISOString()
        : concept.updatedAt,
  };
}

/**
 * Deserializes a character concept from storage
 *
 * @param {object} data - Serialized character concept data
 * @returns {CharacterConcept} Deserialized character concept
 */
export function deserializeCharacterConcept(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('CharacterConcept: data must be a valid object');
  }

  return {
    ...data,
    createdAt:
      typeof data.createdAt === 'string'
        ? new Date(data.createdAt)
        : data.createdAt,
    updatedAt:
      typeof data.updatedAt === 'string'
        ? new Date(data.updatedAt)
        : data.updatedAt,
  };
}
