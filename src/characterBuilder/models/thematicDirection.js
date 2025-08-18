/**
 * @file ThematicDirection data model with validation
 * @see ../services/thematicDirectionGenerator.js
 */

import { v4 as uuidv4 } from 'uuid';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 */

/**
 * @typedef {object} ThematicDirection
 * @property {string} id - Unique identifier (UUID)
 * @property {string} conceptId - Reference to parent CharacterConcept
 * @property {string} title - Brief title/summary of the direction
 * @property {string} description - Detailed description of the thematic direction
 * @property {string} coreTension - Core tension or conflict this direction embodies
 * @property {string} uniqueTwist - Suggested unique twist or deeper archetype
 * @property {string} narrativePotential - Description of narrative possibilities
 * @property {string} createdAt - Creation timestamp (ISO string)
 * @property {object} llmMetadata - LLM response metadata (model, tokens, etc.)
 */

/**
 * Creates a new thematic direction instance
 *
 * @param {string} conceptId - Reference to parent CharacterConcept
 * @param {object} data - Thematic direction data
 * @param {string} data.title - Brief title/summary of the direction
 * @param {string} data.description - Detailed description
 * @param {string} data.coreTension - Core tension or conflict
 * @param {string} data.uniqueTwist - Unique twist or archetype
 * @param {string} data.narrativePotential - Narrative possibilities
 * @param {object} [options] - Creation options
 * @param {string} [options.id] - Custom ID (generates UUID if not provided)
 * @param {object} [options.llmMetadata] - LLM metadata
 * @returns {ThematicDirection} New thematic direction instance
 */
export function createThematicDirection(conceptId, data, options = {}) {
  // Validate required parameters
  if (
    !conceptId ||
    typeof conceptId !== 'string' ||
    conceptId.trim().length === 0
  ) {
    throw new Error('ThematicDirection: conceptId must be a non-empty string');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('ThematicDirection: data must be a valid object');
  }

  // Validate required fields
  const requiredFields = [
    'title',
    'description',
    'coreTension',
    'uniqueTwist',
    'narrativePotential',
  ];
  for (const field of requiredFields) {
    if (
      !data[field] ||
      typeof data[field] !== 'string' ||
      data[field].trim().length === 0
    ) {
      throw new Error(`ThematicDirection: ${field} must be a non-empty string`);
    }
  }

  // Validate field lengths
  const fieldConstraints = {
    title: { min: 5, max: 200 },
    description: { min: 20, max: 2000 },
    coreTension: { min: 10, max: 500 },
    uniqueTwist: { min: 10, max: 1000 },
    narrativePotential: { min: 10, max: 1000 },
  };

  for (const [field, constraints] of Object.entries(fieldConstraints)) {
    const value = data[field].trim();
    if (value.length < constraints.min || value.length > constraints.max) {
      throw new Error(
        `ThematicDirection: ${field} must be between ${constraints.min} and ${constraints.max} characters`
      );
    }
  }

  return {
    id: options.id || uuidv4(),
    conceptId: conceptId.trim(),
    title: data.title.trim(),
    description: data.description.trim(),
    coreTension: data.coreTension.trim(),
    uniqueTwist: data.uniqueTwist.trim(),
    narrativePotential: data.narrativePotential.trim(),
    createdAt: new Date().toISOString(),
    llmMetadata: options.llmMetadata || {},
  };
}

/**
 * Creates multiple thematic directions from LLM response data
 *
 * @param {string} conceptId - Reference to parent CharacterConcept
 * @param {object[]} directionsData - Array of direction data from LLM
 * @param {object} [llmMetadata] - Common LLM metadata for all directions
 * @returns {ThematicDirection[]} Array of thematic directions
 */
export function createThematicDirectionsFromLLMResponse(
  conceptId,
  directionsData,
  llmMetadata = {}
) {
  if (!Array.isArray(directionsData)) {
    throw new Error('ThematicDirection: directionsData must be an array');
  }

  if (directionsData.length === 0) {
    throw new Error('ThematicDirection: directionsData cannot be empty');
  }

  return directionsData.map((data) => {
    return createThematicDirection(conceptId, data, { llmMetadata });
  });
}

/**
 * Validates a thematic direction object
 *
 * @param {ThematicDirection} direction - Thematic direction to validate
 * @param {ISchemaValidator} schemaValidator - Schema validator instance
 * @returns {Promise<boolean>} True if valid, throws error if invalid
 */
export async function validateThematicDirection(direction, schemaValidator) {
  validateDependency(schemaValidator, 'ISchemaValidator', console, {
    requiredMethods: ['validate'],
  });

  if (!direction || typeof direction !== 'object') {
    throw new Error('ThematicDirection: direction must be a valid object');
  }

  // createdAt is already an ISO string, no conversion needed
  const directionForValidation = {
    ...direction,
  };

  const result = schemaValidator.validate(
    'thematic-direction.schema.json',
    directionForValidation
  );

  if (!result.isValid) {
    const errorMessages = result.errors
      .map((error) => `${error.instancePath || 'root'}: ${error.message}`)
      .join(', ');
    throw new Error(`ThematicDirection validation failed: ${errorMessages}`);
  }

  return true;
}

/**
 * Serializes a thematic direction for storage
 *
 * @param {ThematicDirection} direction - Thematic direction to serialize
 * @returns {object} Serialized thematic direction
 */
export function serializeThematicDirection(direction) {
  if (!direction || typeof direction !== 'object') {
    throw new Error('ThematicDirection: direction must be a valid object');
  }

  // createdAt is now always a string (ISO format)
  return {
    ...direction,
  };
}

/**
 * Deserializes a thematic direction from storage
 *
 * @param {object} data - Serialized thematic direction data
 * @returns {ThematicDirection} Deserialized thematic direction
 */
export function deserializeThematicDirection(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('ThematicDirection: data must be a valid object');
  }

  // createdAt remains as string (ISO format) for schema compatibility
  return {
    ...data,
  };
}

/**
 * Validates an array of thematic directions
 *
 * @param {ThematicDirection[]} directions - Array of thematic directions
 * @param {ISchemaValidator} schemaValidator - Schema validator instance
 * @returns {Promise<boolean>} True if all valid, throws error if any invalid
 */
export async function validateThematicDirections(directions, schemaValidator) {
  if (!Array.isArray(directions)) {
    throw new Error('ThematicDirection: directions must be an array');
  }

  for (let i = 0; i < directions.length; i++) {
    try {
      await validateThematicDirection(directions[i], schemaValidator);
    } catch (error) {
      throw new Error(
        `ThematicDirection validation failed at index ${i}: ${error.message}`
      );
    }
  }

  return true;
}
