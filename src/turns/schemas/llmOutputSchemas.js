// src/turns/schemas/llmOutputSchemas.js
// --- NEW FILE START ---

/**
 * @file Defines the JSON schema for the expected output from the LLM
 * when generating an AI character's turn action.
 */

/**
 * The unique identifier used to register and retrieve this schema
 * with the AjvSchemaValidator.
 * @type {string}
 */
export const LLM_TURN_ACTION_SCHEMA_ID = 'llmTurnActionResponseSchema/v1';

/**
 * JSON Schema for the LLM's response.
 * This schema dictates the structure the LLM must follow.
 * - `actionDefinitionId`: The system identifier for the chosen action.
 * - `commandString`: The game-parsable command. This string must be self-contained
 * and include all necessary details previously handled by `resolvedParameters`.
 * - `speech`: The character's spoken dialogue.
 */
export const LLM_TURN_ACTION_SCHEMA = {
    $id: LLM_TURN_ACTION_SCHEMA_ID, // Self-referential ID for Ajv
    type: "object",
    properties: {
        actionDefinitionId: {
            type: "string",
            description: "The unique System Identifier for the action to be performed (e.g., 'core:wait', 'core:go', 'app:take_item'). This MUST be one of the 'System ID' values provided in the 'Your available actions are:' section.",
            minLength: 1 // Ensure not an empty string
        },
        commandString: {
            type: "string",
            description: "The actual command string that will be processed by the game's command parser (e.g., 'wait', 'go north', 'take a_torch from sconce', 'say Hello there'). This should be based on the 'Base Command' from the available actions list and MUST be augmented with all necessary details (e.g., specific targets, directions, items) to be a complete, parsable command. If the action implies speech, it might also be part of this string (e.g., 'say Hello'). This field is MANDATORY and must be self-sufficient.",
            minLength: 1 // Ensure not an empty string
        },
        speech: {
            type: "string", // Empty string "" is allowed for no speech
            description: "The exact words the character will say aloud. Provide an empty string (\"\") if the character chooses not to speak this turn. This speech might also be incorporated into the 'commandString' if appropriate for the game's parser (e.g., a 'say' command). This field is MANDATORY."
        }
    },
    required: ["actionDefinitionId", "commandString", "speech"],
    additionalProperties: false // Disallow any properties not explicitly defined at the top level
};

// --- NEW FILE END ---