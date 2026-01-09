// src/turns/schemas/llmOutputSchemas.js

// -----------------------------------------------------------------------------
// Defines JSON‐Schemas for LLM turn outputs.
//
// Schema versions:
//   • v4 (LLM_TURN_ACTION_RESPONSE_SCHEMA): Combined mood/action response (legacy)
//   • v5 (LLM_TURN_ACTION_RESPONSE_SCHEMA_V5): Action-only response (no mood/sexual)
//   • v1 (LLM_MOOD_UPDATE_RESPONSE_SCHEMA): Mood/sexual update only
//
// The v5 + mood schemas support the two-phase emotional state update flow:
//   1. First LLM call: mood/sexual updates only → validated by mood schema
//   2. Second LLM call: action/speech/thoughts → validated by v5 schema
// -----------------------------------------------------------------------------

import { SUBJECT_TYPE_ENUM_VALUES } from '../../constants/subjectTypes.js';

// =============================================================================
// MOOD UPDATE RESPONSE SCHEMA (Phase 1 of two-phase flow)
// =============================================================================

/**
 * Schema ID for mood-only LLM responses.
 * Used in Phase 1 of the two-phase emotional state update flow.
 */
export const LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID = 'llmMoodUpdateResponseSchema/v1';

/**
 * JSON Schema for mood/sexual state update responses.
 * The LLM returns ONLY moodUpdate and sexualUpdate fields.
 */
export const LLM_MOOD_UPDATE_RESPONSE_SCHEMA = {
  $id: 'http://yourdomain.com/schemas/llmMoodUpdateResponse.schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  description:
    'Response schema for Phase 1 of two-phase emotional state update. Contains only mood and sexual state updates.',
  properties: {
    moodUpdate: {
      type: 'object',
      additionalProperties: false,
      description:
        'Mood axis updates. All 7 axes must be provided as absolute values.',
      properties: {
        valence: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Pleasant (+) to unpleasant (-)',
        },
        arousal: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Energized (+) to depleted (-)',
        },
        agency_control: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'In control (+) to helpless (-)',
        },
        threat: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Endangered (+) to safe (-)',
        },
        engagement: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Absorbed (+) to indifferent (-)',
        },
        future_expectancy: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Hopeful (+) to hopeless (-)',
        },
        self_evaluation: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Pride (+) to shame (-)',
        },
      },
      required: [
        'valence',
        'arousal',
        'agency_control',
        'threat',
        'engagement',
        'future_expectancy',
        'self_evaluation',
      ],
    },
    sexualUpdate: {
      type: 'object',
      additionalProperties: false,
      description:
        'Sexual state updates. Both fields must be provided as absolute values.',
      properties: {
        sex_excitation: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'Sexual response activation (accelerator)',
        },
        sex_inhibition: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'Sexual response suppression (brake)',
        },
      },
      required: ['sex_excitation', 'sex_inhibition'],
    },
  },
  required: ['moodUpdate', 'sexualUpdate'],
};

// =============================================================================
// ACTION RESPONSE SCHEMA V5 (Phase 2 of two-phase flow)
// =============================================================================

/**
 * Schema ID for action-only LLM responses.
 * Used in Phase 2 of the two-phase emotional state update flow.
 */
export const LLM_TURN_ACTION_RESPONSE_SCHEMA_V5_ID =
  'llmTurnActionResponseSchema/v5';

/**
 * JSON Schema for action decision responses (no mood/sexual updates).
 * The LLM returns chosenIndex, speech, thoughts, and optional notes.
 */
export const LLM_TURN_ACTION_RESPONSE_SCHEMA_V5 = {
  $id: 'http://yourdomain.com/schemas/llmTurnActionResponseV5.schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  description:
    'Response schema for Phase 2 of two-phase emotional state update. Contains action decision, speech, thoughts, and optional notes. No mood/sexual updates.',
  properties: {
    // Index of the chosen action (1-based)
    chosenIndex: {
      type: 'integer',
      minimum: 1,
      description: 'Index of the chosen action (1-based)',
    },
    // Dialogue or speech content
    speech: {
      type: 'string',
      description: 'What the character says aloud (may be empty)',
    },
    // Inner thoughts or monologue
    thoughts: {
      type: 'string',
      description: "Character's internal thoughts and reasoning",
    },
    // Optional notes or annotations; structured format only
    notes: {
      type: 'array',
      description: 'Optional notes the character records',
      items: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            minLength: 1,
            description: 'The note content',
          },
          subject: {
            type: 'string',
            minLength: 1,
            description:
              'Primary subject of the note (entity, location, concept)',
          },
          subjectType: {
            type: 'string',
            enum: SUBJECT_TYPE_ENUM_VALUES,
            description: "Explicit categorization of the note's subject type",
          },
          context: {
            type: 'string',
            description: 'Where/how this was observed (optional)',
          },
        },
        required: ['text', 'subject', 'subjectType'],
        additionalProperties: false,
      },
    },
  },
  required: ['chosenIndex', 'speech', 'thoughts'],
};

// =============================================================================
// LEGACY COMBINED RESPONSE SCHEMA V4 (Single-prompt flow)
// =============================================================================

/**
 * v4 schema – chosenIndex is the only required selector now.
 * Notes/speech/thoughts are still allowed so we don’t lose data,
 * but only thoughts is required by the prompt contract.
 */
export const LLM_TURN_ACTION_RESPONSE_SCHEMA_ID =
  'llmTurnActionResponseSchema/v4';

export const LLM_TURN_ACTION_RESPONSE_SCHEMA = {
  $id: 'http://yourdomain.com/schemas/llmTurnActionResponse.schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  // No other properties allowed at the root level
  additionalProperties: false,
  properties: {
    // Index of the chosen action (1-based)
    chosenIndex: {
      type: 'integer',
      minimum: 1,
    },
    // Dialogue or speech content
    speech: {
      type: 'string',
    },
    // Inner thoughts or monologue
    thoughts: {
      type: 'string',
    },
    // Optional notes or annotations; structured format only
    notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            minLength: 1,
            description: 'The note content',
          },
          subject: {
            type: 'string',
            minLength: 1,
            description:
              'Primary subject of the note (entity, location, concept)',
          },
          subjectType: {
            type: 'string',
            enum: SUBJECT_TYPE_ENUM_VALUES,
            description: "Explicit categorization of the note's subject type",
          },
          context: {
            type: 'string',
            description: 'Where/how this was observed (optional)',
          },
        },
        required: ['text', 'subject', 'subjectType'],
        additionalProperties: false,
      },
    },
    // Optional mood axis updates (all 7 axes must be provided if present)
    moodUpdate: {
      type: 'object',
      additionalProperties: false,
      description:
        'Optional mood axis updates. All 7 axes must be provided if present.',
      properties: {
        valence: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Pleasant (+) to unpleasant (-)',
        },
        arousal: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Energized (+) to depleted (-)',
        },
        agency_control: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'In control (+) to helpless (-)',
        },
        threat: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Endangered (+) to safe (-)',
        },
        engagement: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Absorbed (+) to indifferent (-)',
        },
        future_expectancy: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Hopeful (+) to hopeless (-)',
        },
        self_evaluation: {
          type: 'integer',
          minimum: -100,
          maximum: 100,
          description: 'Pride (+) to shame (-)',
        },
      },
      required: [
        'valence',
        'arousal',
        'agency_control',
        'threat',
        'engagement',
        'future_expectancy',
        'self_evaluation',
      ],
    },
    // Optional sexual state updates (both fields must be provided if present)
    sexualUpdate: {
      type: 'object',
      additionalProperties: false,
      description:
        'Optional sexual state updates. Both fields must be provided if present.',
      properties: {
        sex_excitation: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'Sexual response activation (accelerator)',
        },
        sex_inhibition: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'Sexual response suppression (brake)',
        },
      },
      required: ['sex_excitation', 'sex_inhibition'],
    },
  },
  // These fields are mandatory
  required: ['chosenIndex', 'speech', 'thoughts', 'moodUpdate', 'sexualUpdate'],
};
