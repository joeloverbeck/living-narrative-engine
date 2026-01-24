// src/llms/constants/llmConstants.js
// -----------------------------------------------------------------------------
// Central constants for LLM-related integrations.
// -----------------------------------------------------------------------------

/**
 * Default fallback action if the LLM cannot produce a valid structured response.
 */
export const DEFAULT_FALLBACK_ACTION = {
  actionDefinitionId: 'core:wait',
  commandString: 'wait',
  speech: 'I am having trouble thinking right now.',
};

/**
 * Recognized "cloud" API types; used elsewhere for key-retrieval logic, etc.
 */
export const CLOUD_API_TYPES = ['openrouter', 'openai', 'anthropic'];

/**
 * Default description shown when the "OpenRouter" tool is invoked.
 */
export const OPENROUTER_DEFAULT_TOOL_DESCRIPTION =
  "Extracts the character's game action, speech, thoughts, and optional notes based on the current situation. All fields except `notes` are required.";
