// src/llms/constants/llmConstants.js
// -----------------------------------------------------------------------------
// Central constants for LLM-related integrations, including schema IDs.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Central constants for LLM-related integrations, including schema IDs.
// Now points to the consolidated v3 schema instead of v2.
// -----------------------------------------------------------------------------

import { LLM_TURN_ACTION_RESPONSE_SCHEMA } from '../../turns/schemas/llmOutputSchemas.js';

/**
 * Default fallback action if the LLM cannot produce a valid structured response.
 */
export const DEFAULT_FALLBACK_ACTION = {
  actionDefinitionId: 'core:wait',
  commandString: 'wait',
  speech: 'I am having trouble thinking right now.',
};

/**
 * Recognized “cloud” API types; used elsewhere for key-retrieval logic, etc.
 */
export const CLOUD_API_TYPES = ['openrouter', 'openai', 'anthropic'];

/**
 * Strip out `$id` and `$schema` so the LLM sees only the “properties/required/…”
 * portion of the JSON Schema. If we leave `$id` in there, many LLMs will either
 * echo it back or get confused about what to output.
 */
const {
  $id: _,
  $schema: __,
  ...LLM_PROVIDER_TURN_ACTION_SCHEMA
} = LLM_TURN_ACTION_RESPONSE_SCHEMA;

/**
 * When using OpenRouter’s tool-calling API, this object describes
 * the schema (without `$id`/`$schema`) that the model should validate against.
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
  "Extracts the character's game action, speech, thoughts, and optional notes based on the current situation. All fields except `notes` are required.";
