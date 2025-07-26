/**
 * @file Shared constants and types for pipeline testing
 */

/**
 * @typedef {object} DependencySpecEntry
 * @property {RegExp} error - Expected error when dependency is missing.
 * @property {string[]} methods - Methods required on the dependency.
 */

/**
 * @description Defines how {@link module:src/prompting/AIPromptPipeline~AIPromptPipeline} constructor dependencies
 * should be validated within tests. Each property specifies the expected error
 * regex and required method names for that dependency.
 * @type {Object<string, DependencySpecEntry>}
 */
export const AIPromptPipelineDependencySpec = {
  llmAdapter: {
    error: /AIPromptPipeline: llmAdapter/,
    methods: ['getAIDecision', 'getCurrentActiveLlmId'],
  },
  gameStateProvider: {
    error: /AIPromptPipeline: gameStateProvider/,
    methods: ['buildGameState'],
  },
  promptContentProvider: {
    error: /AIPromptPipeline: promptContentProvider/,
    methods: ['getPromptData'],
  },
  promptBuilder: {
    error: /AIPromptPipeline: promptBuilder/,
    methods: ['build'],
  },
  logger: { error: /AIPromptPipeline: logger/, methods: ['info'] },
};
