/**
 * @file Subject type constants for notes categorization system
 * @see src/ai/notesService.js
 * @see data/mods/core/components/notes.component.json
 * @version 2.0 - Simplified taxonomy (LLMROLPROARCANA-002)
 */

/**
 * Enumeration of all valid subject types for note categorization.
 * Simplified from 19 to 6 types to reduce LLM decision complexity.
 *
 * @version 2.0 - Simplified taxonomy (2025-01-24)
 */
export const SUBJECT_TYPES = {
  ENTITY: 'entity',
  EVENT: 'event',
  PLAN: 'plan',
  KNOWLEDGE: 'knowledge',
  STATE: 'state',
  OTHER: 'other',
};

/**
 * Human-readable descriptions for each subject type.
 * Used for documentation, validation messages, and UI tooltips.
 */
export const SUBJECT_TYPE_DESCRIPTIONS = {
  [SUBJECT_TYPES.ENTITY]:
    'People, places, things, creatures, organizations - describing who/what/where',
  [SUBJECT_TYPES.EVENT]: 'Past occurrences - things that already happened',
  [SUBJECT_TYPES.PLAN]:
    'Future intentions - what you intend to do (not yet executed)',
  [SUBJECT_TYPES.KNOWLEDGE]:
    'Information, theories, observations, concepts - what you know, noticed, or theorize',
  [SUBJECT_TYPES.STATE]:
    'Mental, emotional, psychological conditions - feelings or complex mental states',
  [SUBJECT_TYPES.OTHER]: 'Fallback for uncertain or abstract concepts',
};

/**
 * Migration mapping from old 19-type taxonomy to new 6-type taxonomy.
 * Used for backward compatibility with existing notes.
 *
 * @deprecated Use new taxonomy directly. This exists only for migration.
 */
export const LEGACY_TYPE_MIGRATION = {
  // Entity types
  character: 'entity',
  location: 'entity',
  item: 'entity',
  creature: 'entity',
  organization: 'entity',

  // Event/temporal types
  event: 'event',
  timeline: 'event',

  // Plan types
  plan: 'plan',
  quest: 'plan',

  // Knowledge types
  theory: 'knowledge',
  observation: 'knowledge',
  knowledge_state: 'knowledge',
  concept: 'knowledge',
  philosophy: 'knowledge',

  // State types
  emotion: 'state',
  psychological_state: 'state',
  relationship: 'state',
  skill: 'state',
  habit: 'state',

  // Fallback
  other: 'other',
};

/**
 * Array of all valid subject type enum values.
 * Used for schema validation and iteration.
 */
export const SUBJECT_TYPE_ENUM_VALUES = Object.values(SUBJECT_TYPES);

/**
 * Default subject type for migration and fallback scenarios.
 */
export const DEFAULT_SUBJECT_TYPE = SUBJECT_TYPES.OTHER;

/**
 * Validates if a given value is a valid subject type.
 *
 * @param {string} subjectType - The subject type to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
export function isValidSubjectType(subjectType) {
  return SUBJECT_TYPE_ENUM_VALUES.includes(subjectType);
}

/**
 * Gets the description for a given subject type.
 *
 * @param {string} subjectType - The subject type to get description for.
 * @returns {string} The description or a fallback message.
 */
export function getSubjectTypeDescription(subjectType) {
  return SUBJECT_TYPE_DESCRIPTIONS[subjectType] || 'Unknown subject type';
}
