// ─────────────────────────────────────────────────────────────────────────────
//  ITurnDirectiveStrategy  – PTH-STRAT-001
// ─────────────────────────────────────────────────────────────────────────────
//
//  Defines the contract that every “turn-directive” strategy must fulfil.
//  Concrete strategy classes (RePromptStrategy, EndTurnSuccessStrategy, …)
//  will extend this class and implement `execute()`.
//
//  NOTE:  This project is pure JavaScript – we use JSDoc `@interface` tags
//  so IDEs / the TS language-server can still provide intellisense & checks.
// ─────────────────────────────────────────────────────────────────────────────

/** @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler */
/** @typedef {import('../../../entities/entity.js').default} Entity */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirective */

/** @typedef {import('../../commandProcessor.js').CommandResult} CommandResult */

/**
 * @interface ITurnDirectiveStrategy
 *
 * @description
 * Implementations encapsulate the behaviour needed to react to a single
 * {@link TurnDirective} (e.g. `RE_PROMPT`, `END_TURN_SUCCESS`, …).
 *
 * Strategies receive the entire {@link PlayerTurnHandler} *context* so they can:
 * • log via `context.logger`
 * • read the current actor with `context.getCurrentActor()`
 * • trigger state transitions through `context._transitionToState(newState)`
 * • call helper services (`context.playerPromptService`, `context.safeEventDispatcher`, …)
 *
 * They **must** return a `Promise<void>` – any result is ignored by the caller.
 *
 * @example
 * class EndTurnSuccessStrategy extends ITurnDirectiveStrategy {
 *   async execute(context, actor, directive) {
 *     await context._handleTurnEnd(actor.id, null);
 *   }
 * }
 */
export class ITurnDirectiveStrategy {
    /**
     * Execute the strategy.
     *
     * @abstract
     * @async
     * @param {PlayerTurnHandler} context
     *        The handler orchestrating the current turn (provides logger,
     *        services, state-transition helpers, etc.).
     * @param {Entity}           actor
     *        The actor whose directive is being processed.
     * @param {TurnDirective}    directive
     *        The directive that selected this strategy.
     * @param {CommandResult}   [cmdProcResult]
     *        Optional: the command-processing result that produced the directive
     *        (included so strategies can use any embedded error/data).
     * @returns {Promise<void>}  Resolved when the strategy’s work is complete.
     * @throws  {Error}          If the strategy cannot complete successfully.
     */

    /* eslint-disable no-unused-vars */
    async execute(context, actor, directive, cmdProcResult) { // eslint-disable-line require-await
        throw new Error(
            "ITurnDirectiveStrategy.execute(context, actor, directive, cmdProcResult) " +
            "must be implemented by concrete strategy classes."
        );
    }

    /* eslint-enable no-unused-vars */
}