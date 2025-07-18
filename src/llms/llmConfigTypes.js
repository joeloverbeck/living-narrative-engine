// --- FILE: src/llms/llmConfigTypes.js ------------------------------------
/**
 * Central JSDoc typedefs for LLM configuration artefacts.
 * Keeping them here prevents “interface ↔ implementation” import loops.
 *
 * NOTE: This module intentionally exports nothing at runtime.
 */

/**
 * @typedef {object} LLMJsonOutputStrategy
 * @property {string} method                   – Enforcement method.
 * @property {string=} toolName                – Required for "tool_calling".
 * @property {string=} grammar                 – Required for "gbnf_grammar".
 * @property {object=} jsonSchema              – Required for "openrouter_json_schema".
 */

/**
 * @typedef {object} LLMPromptFrame
 * @property {string=} system                  – Optional system-level wrapper.
 */

/**
 * @typedef {object} LLMConfiguration
 * @property {string}                     configId
 * @property {string}                     displayName
 * @property {string}                     modelIdentifier
 * @property {string}                     endpointUrl
 * @property {string}                     apiType
 * @property {string=}                    apiKeyEnvVar
 * @property {string=}                    apiKeyFileName
 * @property {LLMJsonOutputStrategy}      jsonOutputStrategy
 * @property {object=}                    defaultParameters
 * @property {Record<string,string>=}     providerSpecificHeaders
 * @property {number=}                    contextTokenLimit
 * @property {LLMPromptFrame=}            promptFrame
 */

/**
 * @typedef {object} LLMRootConfiguration
 * @property {string}                          defaultConfigId
 * @property {Record<string, LLMConfiguration>} configs
 */

export {}; // <-- keeps this file an ES module without exporting symbols
// -------------------------------------------------------------------------
