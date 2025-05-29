// src/turns/interfaces/IAIPlayerStrategyFactory.js
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('./ILLMAdapter.js').ILLMAdapter} ILLMAdapter
 * @typedef {import('./IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider
 * @typedef {import('../../services/AIPromptContentProvider.js').AIPromptContentProvider} IAIPromptContentProvider // Or an IAIPromptContentProvider interface if defined
 * @typedef {import('../../services/promptBuilder.js').PromptBuilder} IPromptBuilder // Interface for PromptBuilder
 * @typedef {import('./ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('./IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 */

/**
 * @class IAIPlayerStrategyFactory
 * @interface
 * @description
 * Defines the interface for a factory that creates AI player turn strategies.
 */
export class IAIPlayerStrategyFactory {
    /**
     * Creates an AI player strategy instance.
     * @param {object} dependencies - The dependencies required by the AI player strategy.
     * @param {ILLMAdapter} dependencies.llmAdapter - Adapter for LLM communication.
     * @param {IAIGameStateProvider} dependencies.gameStateProvider - Provider for AI game state.
     * @param {IAIPromptContentProvider} dependencies.promptContentProvider - Provider for prompt content pieces.
     * @param {IPromptBuilder} dependencies.promptBuilder - Builder for assembling the final prompt string.
     * @param {ILLMResponseProcessor} dependencies.llmResponseProcessor - Processor for LLM responses.
     * @param {ILogger} dependencies.logger - Logger instance.
     * @returns {IActorTurnStrategy} The created AI player strategy.
     * @throws {Error} If the method is not implemented by a concrete class.
     */
    create({
               llmAdapter,
               gameStateProvider,
               promptContentProvider,
               promptBuilder,
               llmResponseProcessor,
               logger
           }) {
        throw new Error("IAIPlayerStrategyFactory.create must be implemented by concrete classes.");
    }
}

// --- FILE END ---