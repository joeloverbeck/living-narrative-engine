// src/turns/schemas/llmOutputSchemas.js

// -----------------------------------------------------------------------------
// Defines the consolidated (v3) JSON‐Schema that describes the shape of an LLM's turn output.
// Replaces both v1 and v2 schemas. Enforces exactly:
//   • actionDefinitionId: non‐empty string
//   • commandString: non‐empty string
//   • speech: string (may be empty)
//   • thoughts: string
//   • notes (optional): array of strings (minLength: 1)
// -----------------------------------------------------------------------------

import { SUBJECT_TYPE_ENUM_VALUES } from '../../constants/subjectTypes.js';

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
  },
  // These fields are mandatory
  required: ['chosenIndex', 'speech', 'thoughts'],
};
