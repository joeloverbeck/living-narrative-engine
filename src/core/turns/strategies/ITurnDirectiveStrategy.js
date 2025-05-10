// src/core/turns/strategies/ITurnDirectiveStrategy.js

// ─────────────────────────────────────────────────────────────────────────────
//  ITurnDirectiveStrategy  – PTH-STRAT-001
// ─────────────────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../../entities/entity.js').default} Entity */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum */

/** @typedef {import('../../commandProcessor.js').CommandResult} CommandResult */

/**
 * @interface ITurnDirectiveStrategy
 * @description
 * Implementations encapsulate the behaviour needed to react to a single TurnDirective.
 * Strategies receive ITurnContext to access actor, logger, services, and to request
 * actions like ending the turn or transitioning state.
 */
export class ITurnDirectiveStrategy {
    /**
     * Execute the strategy.
     *
     * @abstract
     * @async
     * @param {ITurnContext} turnContext
     * The current turn's context, providing access to actor, logger,
     * services, and methods like endTurn() or requestTransition().
     * @param {Entity}           actor
     * The actor whose directive is being processed (available via turnContext.getActor()).
     * Passed explicitly for convenience and verification.
     * @param {TurnDirectiveEnum}    directive
     * The directive that selected this strategy.
     * @param {CommandResult}   [cmdProcResult]
     * Optional: the command-processing result that produced the directive.
     * @returns {Promise<void>}  Resolved when the strategy’s work is complete.
     * @throws  {Error}          If the strategy cannot complete successfully.
     */
    async execute(turnContext, actor, directive, cmdProcResult) {
        throw new Error(
            "ITurnDirectiveStrategy.execute(turnContext, actor, directive, cmdProcResult) " +
            "must be implemented by concrete strategy classes."
        );
    }
}