// src/llms/constants/llmConstants.js
// --- FILE START ---

// Import the canonical schema definition
import {LLM_TURN_ACTION_SCHEMA} from '../../turns/schemas/llmOutputSchemas.js'; // Adjust path if necessary

const {$id: _, ...LLM_PROVIDER_TURN_ACTION_SCHEMA} = LLM_TURN_ACTION_SCHEMA;

export const DEFAULT_FALLBACK_ACTION = {
    actionDefinitionId: "core:wait",
    commandString: "wait",
    speech: "I am having trouble thinking right now."
};

export const CLOUD_API_TYPES = ['openrouter', 'openai', 'anthropic'];

export const OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA = {
    name: "game_ai_action_speech_output", // A descriptive name for the schema
    strict: true, // Enforces strict adherence, disallowing additional properties at the OpenRouter API level
    // The 'schema' property now references the LLM_PROVIDER_TURN_ACTION_SCHEMA,
    // ensuring it's consistent with the canonical definition (minus $id).
    schema: LLM_PROVIDER_TURN_ACTION_SCHEMA
};

export const OPENROUTER_DEFAULT_TOOL_DESCRIPTION = "Extracts the character's game action and speech based on the current situation. Both action and speech are required.";

// --- FILE END ---