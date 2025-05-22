// src/core/turns/strategies/ITurnDirectiveStrategy.js

// ─────────────────────────────────────────────────────────────────────────────
//  ITurnDirectiveStrategy  – PTH-STRAT-001
// ─────────────────────────────────────────────────────────────────────────────

/** @typedef {import('./ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum */
/** @typedef {import('../../commands/commandProcessor.js').CommandResult} CommandResult */
// Removed: /** @typedef {import('../../../entities/entity.js').default} Entity */
// as the explicit 'actor' parameter of type Entity is no longer used.

/**
 * @interface ITurnDirectiveStrategy
 * @description
 * Implementations encapsulate the behaviour needed to react to a single TurnDirective.
 * Strategies receive ITurnContext to access actor (via turnContext.getActor()),
 * logger, services, and to request actions like ending the turn or transitioning state.
 */
export class ITurnDirectiveStrategy {
    /**
     * Execute the strategy.
     * The actor whose directive is being processed should be obtained via `turnContext.getActor()`.
     *
     * @abstract
     * @async
     * @param {ITurnContext} turnContext
     * The current turn's context, providing access to the current actor (via `turnContext.getActor()`),
     * logger, services, and methods like `endTurn()` or `requestTransition()`.
     * @param {TurnDirectiveEnum} directive
     * The directive that selected this strategy.
     * @param {CommandResult} [cmdProcResult]
     * Optional: the command-processing result that produced the directive.
     * @returns {Promise<void>} Resolved when the strategy’s work is complete.
     * @throws {Error} If the strategy cannot complete successfully, or if `turnContext.getActor()` returns null/undefined
     * when an actor is expected for the strategy's operation.
     */
    async execute(turnContext, directive, cmdProcResult) {
        throw new Error(
            "ITurnDirectiveStrategy.execute(turnContext, directive, cmdProcResult) " +
            "must be implemented by concrete strategy classes."
        );
    }
}