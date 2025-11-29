/**
 * @file Structured notes test helper utilities
 * @description Provides standardized functions for creating structured notes in tests
 * This helper ensures consistent note formats across all test suites following
 * the Living Narrative Engine's structured notes migration.
 */

import { v4 as uuid } from 'uuid';

/**
 * Valid subject types for structured notes
 * Must match exactly with common.schema.json structuredNote definition
 *
 * @type {string[]}
 */
const VALID_SUBJECT_TYPES = [
  'entity',
  'event',
  'plan',
  'knowledge',
  'state',
  'other',
];

/**
 * Creates a valid structured note with all required fields
 *
 * @param {string} text - The note content (required, min 1 character)
 * @param {string} subject - The subject of the note (required)
 * @param {string} subjectType - The type of subject (required, must be valid enum value)
 * @param {object} [options] - Optional additional fields
 * @param {string} [options.context] - Contextual information about the note
 * @param {string} [options.timestamp] - ISO timestamp for the note
 * @returns {object} A valid structured note object
 * @throws {Error} If required parameters are invalid
 * @example
 * const note = createValidNote(
 *   'Player is acting suspicious',
 *   'player-001',
 *   'entity',
 *   { context: 'dialogue' }
 * );
 */
export function createValidNote(text, subject, subjectType, options = {}) {
  // Validate required parameters
  if (!text || typeof text !== 'string' || text.length < 1) {
    throw new Error('Note text must be a non-empty string');
  }

  if (!subject || typeof subject !== 'string') {
    throw new Error('Note subject must be a non-empty string');
  }

  if (!subjectType || typeof subjectType !== 'string') {
    throw new Error('Note subjectType must be a non-empty string');
  }

  if (!VALID_SUBJECT_TYPES.includes(subjectType)) {
    throw new Error(
      `Invalid subjectType: ${subjectType}. Must be one of: ${VALID_SUBJECT_TYPES.join(', ')}`
    );
  }

  const note = {
    text,
    subject,
    subjectType,
  };

  // Add optional fields if provided
  if (options.context && typeof options.context === 'string') {
    note.context = options.context;
  }

  if (options.timestamp && typeof options.timestamp === 'string') {
    note.timestamp = options.timestamp;
  }

  return note;
}

/**
 * Creates a minimal structured note with only required fields
 *
 * @param {string} text - The note content (required)
 * @param {string} [subjectType] - The type of subject (defaults to 'other')
 * @param {string} [subject] - The subject (auto-generated if not provided)
 * @returns {object} A minimal structured note object
 * @example
 * const minimalNote = createMinimalNote('Quick observation');
 * // Returns: { text: 'Quick observation', subject: 'auto-generated-id', subjectType: 'other' }
 */
export function createMinimalNote(text, subjectType = 'other', subject = null) {
  if (!text || typeof text !== 'string' || text.length < 1) {
    throw new Error('Note text must be a non-empty string');
  }

  if (!VALID_SUBJECT_TYPES.includes(subjectType)) {
    throw new Error(
      `Invalid subjectType: ${subjectType}. Must be one of: ${VALID_SUBJECT_TYPES.join(', ')}`
    );
  }

  return createValidNote(
    text,
    subject || `test-subject-${uuid().slice(0, 8)}`,
    subjectType
  );
}

/**
 * Creates an array of structured notes
 *
 * @param {number} [count] - Number of notes to create
 * @param {object} [template] - Template for note creation
 * @param {string} [template.textPrefix] - Prefix for note text
 * @param {string} [template.subjectPrefix] - Prefix for note subjects
 * @param {string} [template.subjectType] - Subject type for all notes
 * @param {object} [template.options] - Options passed to createValidNote
 * @returns {object[]} Array of structured note objects
 * @example
 * const notes = createNotesArray(3, {
 *   textPrefix: 'Observation',
 *   subjectType: 'entity',
 *   options: { context: 'test-scenario' }
 * });
 * // Returns array with 3 notes: "Observation 1", "Observation 2", "Observation 3"
 */
export function createNotesArray(count = 1, template = {}) {
  const {
    textPrefix = 'Test note',
    subjectPrefix = 'test-subject',
    subjectType = 'other',
    options = {},
  } = template;

  if (typeof count !== 'number' || count < 1) {
    throw new Error('Count must be a positive number');
  }

  const notes = [];
  for (let i = 1; i <= count; i++) {
    notes.push(
      createValidNote(
        `${textPrefix} ${i}`,
        `${subjectPrefix}-${i}`,
        subjectType,
        options
      )
    );
  }

  return notes;
}

/**
 * Creates structured notes for common test scenarios
 *
 * @type {object}
 */
export const NOTE_TEMPLATES = {
  /**
   * Creates a character observation note
   *
   * @param {string} characterId - The character being observed
   * @param {string} observation - The observation text
   * @returns {object} Structured note for character observation
   */
  characterObservation: (characterId, observation) =>
    createValidNote(observation, characterId, 'entity', {
      context: 'character observation',
    }),

  /**
   * Creates a location description note
   *
   * @param {string} locationId - The location being described
   * @param {string} description - The description text
   * @returns {object} Structured note for location description
   */
  locationDescription: (locationId, description) =>
    createValidNote(description, locationId, 'entity', {
      context: 'environmental description',
    }),

  /**
   * Creates an event note
   *
   * @param {string} eventDescription - Description of the event
   * @param {string} eventId - Optional event identifier
   * @returns {object} Structured note for event documentation
   */
  eventNote: (eventDescription, eventId = null) =>
    createValidNote(
      eventDescription,
      eventId || `event-${uuid().slice(0, 8)}`,
      'event',
      {
        context: 'event documentation',
        timestamp: new Date().toISOString(),
      }
    ),

  /**
   * Creates a dialogue note
   *
   * @param {string} speakerId - The character who spoke
   * @param {string} dialogueContext - Context about the dialogue
   * @returns {object} Structured note for dialogue context
   */
  dialogueNote: (speakerId, dialogueContext) =>
    createValidNote(dialogueContext, speakerId, 'entity', {
      context: 'dialogue interaction',
    }),
};

/**
 * Validates that an object is a properly structured note
 *
 * @param {any} note - The object to validate
 * @returns {boolean} True if the object is a valid structured note
 * @example
 * const note = { text: 'Test', subject: 'test', subjectType: 'other' };
 * const isValid = isValidStructuredNote(note); // true
 */
export function isValidStructuredNote(note) {
  if (!note || typeof note !== 'object') {
    return false;
  }

  // Check required fields
  if (!note.text || typeof note.text !== 'string' || note.text.length < 1) {
    return false;
  }

  if (!note.subject || typeof note.subject !== 'string') {
    return false;
  }

  if (!note.subjectType || typeof note.subjectType !== 'string') {
    return false;
  }

  if (!VALID_SUBJECT_TYPES.includes(note.subjectType)) {
    return false;
  }

  // Check optional fields if present
  if (note.context && typeof note.context !== 'string') {
    return false;
  }

  if (note.timestamp && typeof note.timestamp !== 'string') {
    return false;
  }

  return true;
}

/**
 * Export constants for use in tests
 */
export { VALID_SUBJECT_TYPES };
