// src/turns/schemas/llmOutputSchemas.js

// -----------------------------------------------------------------------------
// Defines the consolidated (v3) JSON‐Schema that describes the shape of an LLM’s turn output.
// Replaces both v1 and v2 schemas. Enforces exactly:
//   • actionDefinitionId: non‐empty string
//   • commandString: non‐empty string
//   • speech: string (may be empty)
//   • thoughts: string
//   • notes (optional): array of { text: string (minLength:1), timestamp: date‐time }, no extra props
// -----------------------------------------------------------------------------

/**
 * The unique identifier used to register and retrieve the v3 schema
 * with the AjvSchemaValidator.
 *
 * @type {string}
 */
export const LLM_TURN_ACTION_RESPONSE_SCHEMA_ID =
  'llmTurnActionResponseSchema/v3';

/**
 * JSON Schema (v3) for the LLM's response.
 * Consolidated: replaces v1 and v2. Adds optional `notes` array on top of the v2 fields.
 */
export const LLM_TURN_ACTION_RESPONSE_SCHEMA = {
  $id: LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    actionDefinitionId: { type: 'string', minLength: 1 },
    commandString: { type: 'string', minLength: 1 },
    speech: { type: 'string' },
    thoughts: { type: 'string' },
    notes: {
      type: 'array',
      minItems: 0,
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1 },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['text', 'timestamp'],
        additionalProperties: false,
      },
    },
  },
  required: ['actionDefinitionId', 'commandString', 'speech', 'thoughts'],
  additionalProperties: false,
};
