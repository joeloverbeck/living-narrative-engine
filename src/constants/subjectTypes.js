/**
 * @file Subject type constants for notes categorization system
 * @see src/ai/notesService.js
 * @see data/mods/core/components/notes.component.json
 */

/**
 * Enumeration of all valid subject types for note categorization.
 * These values provide explicit typing to eliminate pattern-based inference.
 */
export const SUBJECT_TYPES = {
  CHARACTER: 'character',
  LOCATION: 'location',
  ITEM: 'item',
  CREATURE: 'creature',
  EVENT: 'event',
  CONCEPT: 'concept',
  RELATIONSHIP: 'relationship',
  ORGANIZATION: 'organization',
  QUEST: 'quest',
  SKILL: 'skill',
  EMOTION: 'emotion',
  PLAN: 'plan',
  TIMELINE: 'timeline',
  THEORY: 'theory',
  OBSERVATION: 'observation',
  KNOWLEDGE_STATE: 'knowledge_state',
  PSYCHOLOGICAL_STATE: 'psychological_state',
  OTHER: 'other',
};

/**
 * Human-readable descriptions for each subject type.
 * Used for documentation, validation messages, and UI tooltips.
 */
export const SUBJECT_TYPE_DESCRIPTIONS = {
  [SUBJECT_TYPES.CHARACTER]: 'Named individuals, NPCs, players',
  [SUBJECT_TYPES.LOCATION]: 'Physical places and areas',
  [SUBJECT_TYPES.ITEM]: 'Objects, tools, artifacts',
  [SUBJECT_TYPES.CREATURE]: 'Animals, monsters, entities',
  [SUBJECT_TYPES.EVENT]: 'Incidents, meetings, occurrences',
  [SUBJECT_TYPES.CONCEPT]: 'Ideas, theories, abstract notions',
  [SUBJECT_TYPES.RELATIONSHIP]: 'Social connections, dynamics',
  [SUBJECT_TYPES.ORGANIZATION]: 'Groups, factions, institutions',
  [SUBJECT_TYPES.QUEST]: 'Tasks, missions, objectives',
  [SUBJECT_TYPES.SKILL]: 'Abilities, talents, behaviors',
  [SUBJECT_TYPES.EMOTION]: 'Feelings, mood states, reactions',
  [SUBJECT_TYPES.PLAN]: 'Future intentions, strategies, decisions not yet executed',
  [SUBJECT_TYPES.TIMELINE]: 'Temporal sequences, deadlines, schedules (e.g., "Must do X by date Y")',
  [SUBJECT_TYPES.THEORY]: 'Hypotheses, models, explanations about how things work',
  [SUBJECT_TYPES.OBSERVATION]: 'Behavioral patterns, tendencies, habits noticed in characters or situations',
  [SUBJECT_TYPES.KNOWLEDGE_STATE]: 'What is known/unknown, areas of uncertainty, epistemic states',
  [SUBJECT_TYPES.PSYCHOLOGICAL_STATE]: 'Complex mental states beyond simple emotions (existential crises, identity conflicts)',
  [SUBJECT_TYPES.OTHER]: 'Uncategorized subjects',
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
