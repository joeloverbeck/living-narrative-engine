// src/llms/constants/llmConstants.js
// --- FILE START ---

// MODIFICATION START (Schema Consistency Ticket)
// Import the canonical schema definition
import {LLM_TURN_ACTION_SCHEMA} from '../../turns/schemas/llmOutputSchemas.js'; // Adjust path if necessary

// Create a version of the canonical schema suitable for LLM providers by omitting the '$id' property.
// This version retains all other constraints like minLength and additionalProperties.
const {$id: _, ...LLM_PROVIDER_TURN_ACTION_SCHEMA} = LLM_TURN_ACTION_SCHEMA;
// MODIFICATION END (Schema Consistency Ticket)

export const DEFAULT_FALLBACK_ACTION = {
    actionDefinitionId: "core:wait",
    commandString: "wait",
    speech: "I am having trouble thinking right now."
};

export const CLOUD_API_TYPES = ['openrouter', 'openai', 'anthropic'];

// MODIFICATION START (Ticket 2.2 & Schema Consistency Ticket)
export const OPENAI_TOOL_NAME = "game_ai_action_speech";
export const ANTHROPIC_TOOL_NAME = "get_game_ai_action_speech";
export const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

// Now uses the LLM_PROVIDER_TURN_ACTION_SCHEMA, ensuring consistency
// with LLM_TURN_ACTION_SCHEMA (minus $id).
export const GAME_AI_ACTION_SPEECH_TOOL_PARAMETERS_SCHEMA = LLM_PROVIDER_TURN_ACTION_SCHEMA;
// MODIFICATION END (Ticket 2.2 & Schema Consistency Ticket)

// MODIFICATION START (Ticket 2.3 & Schema Consistency Ticket)
export const OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA = {
    name: "game_ai_action_speech_output", // A descriptive name for the schema
    strict: true, // Enforces strict adherence, disallowing additional properties at the OpenRouter API level
    // The 'schema' property now references the LLM_PROVIDER_TURN_ACTION_SCHEMA,
    // ensuring it's consistent with the canonical definition (minus $id).
    schema: LLM_PROVIDER_TURN_ACTION_SCHEMA
};
// MODIFICATION END (Ticket 2.3 & Schema Consistency Ticket)

// MODIFICATION START (Ticket 3)
export const OPENROUTER_DEFAULT_TOOL_DESCRIPTION = "Extracts the character's game action and speech based on the current situation. Both action and speech are required.";
// MODIFICATION END (Ticket 3)

// --- FILE END ---