// src/llms/constants/llmConstants.js
// -----------------------------------------------------------------------------
// Central constants for LLM-related integrations, including schema IDs.
// -----------------------------------------------------------------------------

// Import both v1 and v2 schema IDs if needed (we’ll only export v2 here)
import {
    LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA,
    LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID,
} from '../../turns/schemas/llmOutputSchemas.js';

// Strip the `$id` off the imported v1 schema so downstream tools can embed it without re‐exposing `$id`.
const {$id: _, ...LLM_PROVIDER_TURN_ACTION_SCHEMA} = LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA;

/**
 * The new schema ID (v2) that includes `thoughts` for short‐term memory.
 * All modules retrieving “turn action” schema IDs should now import this.
 */
export const TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID = LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID;

/**
 * Default fallback action if the LLM cannot produce a valid structured response.
 */
export const DEFAULT_FALLBACK_ACTION = {
    actionDefinitionId: 'core:wait',
    commandString: 'wait',
    speech: 'I am having trouble thinking right now.',
};

/**
 * Recognized “cloud” API types; used elsewhere for key‐retrieval logic, etc.
 */
export const CLOUD_API_TYPES = ['openrouter', 'openai', 'anthropic'];

/**
 * When using OpenRouter’s tool‐calling API, this object describes
 * the schema (based on the canonical turn‐action schema minus `$id`).
 */
export const OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA = {
    name: 'game_ai_action_speech_output',
    strict: true,
    schema: LLM_PROVIDER_TURN_ACTION_SCHEMA,
};

/**
 * Default description shown when the “OpenRouter” tool is invoked.
 */
export const OPENROUTER_DEFAULT_TOOL_DESCRIPTION =
    "Extracts the character's game action and speech based on the current situation. Both action and speech are required.";