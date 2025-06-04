// src/turns/schemas/llmOutputSchemas.js
// -----------------------------------------------------------------------------
// Defines the JSON-Schema(s) that describe the shape of an LLM’s turn output.
// -----------------------------------------------------------------------------

/**
 * The unique identifier used to register and retrieve the v1 schema
 * with the AjvSchemaValidator.
 *
 * @type {string}
 */
export const LLM_TURN_ACTION_SCHEMA_ID = 'llmTurnActionResponseSchema/v1';

/**
 * JSON Schema (v1) for the LLM's response.
 * This schema dictates the structure the LLM must follow.
 * - `actionDefinitionId`: The system identifier for the chosen action.
 * - `commandString`: The game-parsable command string (must be self-contained).
 * - `speech`: The character's spoken dialogue.
 */
export const LLM_TURN_ACTION_SCHEMA = {
  $id: LLM_TURN_ACTION_SCHEMA_ID, // Self-referential ID for Ajv
  type: 'object',
  properties: {
    actionDefinitionId: {
      type: 'string',
      description:
        "The unique System Identifier for the action to be performed (e.g., 'core:wait', 'core:go', 'app:take_item'). " +
        "This MUST be one of the 'System ID' values provided in the 'Your available actions are:' section.",
      minLength: 1,
    },
    commandString: {
      type: 'string',
      description:
        "The exact command string that will be processed by the game's command parser (e.g., 'wait', 'go north', " +
        "'take a_torch from sconce', 'say Hello there'). This value MUST be a complete, parsable command.",
      minLength: 1,
    },
    speech: {
      type: 'string',
      description:
        'The exact words the character will say aloud. Use an empty string ("") if the character chooses not to speak.',
    },
  },
  required: ['actionDefinitionId', 'commandString', 'speech'],
  additionalProperties: false, // Disallow undeclared top-level keys
};

/* ──────────────────────────────────────────────────────────────────────────── */
/*  NEW v2 SCHEMA WITH SHORT-TERM “THOUGHTS” MEMORY                           */
/* ──────────────────────────────────────────────────────────────────────────── */

/**
 * The unique identifier used to register and retrieve the v2 schema
 * (includes `thoughts`) with the AjvSchemaValidator.
 *
 * @type {string}
 */
export const LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID =
  'llmTurnActionResponseSchema/v2';

/**
 * JSON Schema (v2) for the LLM's response.
 * Adds a required `thoughts` field: a short, first-person internal monologue
 * paragraph suitable for short-term memory or chain-of-thought logging.
 */
export const LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA = {
  $id: LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID,
  type: 'object',
  properties: {
    actionDefinitionId: LLM_TURN_ACTION_SCHEMA.properties.actionDefinitionId,
    commandString: LLM_TURN_ACTION_SCHEMA.properties.commandString,
    speech: LLM_TURN_ACTION_SCHEMA.properties.speech,
    thoughts: {
      type: 'string',
      description:
        'First-person internal monologue; one short paragraph in character voice.',
    },
  },
  required: ['actionDefinitionId', 'commandString', 'speech', 'thoughts'],
  additionalProperties: false,
};
