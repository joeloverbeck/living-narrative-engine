// src/turns/strategies/turnDirectiveStrategyResolver.js
// ────────────────────────────────────────────────────────────────────────────
//  TurnDirectiveStrategyResolver  – PTH-STRAT-006
// ────────────────────────────────────────────────────────────────────────────
//  Responsible for returning the correct ITurnDirectiveStrategy implementation
//  for a given TurnDirective enum value.  Falls back to a sensible default
//  (WAIT_FOR_EVENT → WaitForTurnEndEventStrategy) when the directive is null,
//  undefined, or unrecognised.
//
//  The resolver keeps **singletons** of each strategy because all concrete
//  strategy classes in this code‑base are stateless.  Creating them once avoids
//  needless GC churn while still playing nicely with unit tests.
//
//  Usage:
//      import TurnDirectiveStrategyResolver from './turnDirectiveStrategyResolver.js';
//      const strategy = TurnDirectiveStrategyResolver.resolveStrategy(directive);
//      await strategy.execute(context, actor, directive, cmdProcResult);
//
//  NOTE: This project is plain JavaScript – we rely on JSDoc for intellisense.
// ────────────────────────────────────────────────────────────────────────────

/** @typedef {import('../handlers/actorTurnHandler.js').default} ActorTurnHandler */
/** @typedef {import('../../entities/entity.js').default}        Entity */
/** @typedef {import('../constants/turnDirectives.js').default}    TurnDirective */
/** @typedef {import('../interfaces/ITurnDirectiveStrategy.js').ITurnDirectiveStrategy} ITurnDirectiveStrategy */

// Enum & concrete strategy imports -------------------------------------------------------
import TurnDirective from '../constants/turnDirectives.js';
import RepromptStrategy from './repromptStrategy.js';
import EndTurnSuccessStrategy from './endTurnSuccessStrategy.js';
import EndTurnFailureStrategy from './endTurnFailureStrategy.js';
import WaitForTurnEndEventStrategy from './waitForTurnEndEventStrategy.js';

// Helper: lazily instantiate strategies exactly once -------------------------------------
/** @type {Map<string, ITurnDirectiveStrategy>} */
const STRATEGY_SINGLETONS = new Map();

/**
 * Retrieves a singleton instance for the provided strategy class, creating it
 * on first use.
 *
 * @param {Constructor<ITurnDirectiveStrategy>} strategyClass - The class to
 *        instantiate.
 * @returns {ITurnDirectiveStrategy} The cached instance for the class.
 */
function getOrCreate(strategyClass) {
  const key = strategyClass.name;
  if (!STRATEGY_SINGLETONS.has(key)) {
    STRATEGY_SINGLETONS.set(key, new strategyClass());
  }
  return STRATEGY_SINGLETONS.get(key);
}

// The actual resolver --------------------------------------------------------------------
export default class TurnDirectiveStrategyResolver {
  // We expose a *static* API because the resolver itself has no instance‑level state.

  /**
   * Returns the appropriate ITurnDirectiveStrategy instance for the supplied directive.
   * If the directive is null / undefined / unknown it falls back to
   * WaitForTurnEndEventStrategy as a safe default.
   *
   * @param {TurnDirective|string|null|undefined} directive – The directive to resolve.
   * @returns {ITurnDirectiveStrategy} – Concrete strategy ready to execute.
   */
  static resolveStrategy(directive) {
    switch (directive) {
      case TurnDirective.RE_PROMPT:
        return getOrCreate(RepromptStrategy);

      case TurnDirective.END_TURN_SUCCESS:
        return getOrCreate(EndTurnSuccessStrategy);

      case TurnDirective.END_TURN_FAILURE:
        return getOrCreate(EndTurnFailureStrategy);

      case TurnDirective.WAIT_FOR_EVENT:
        return getOrCreate(WaitForTurnEndEventStrategy);

      default: {
        // Unknown, null, or undefined directive – choose a safe default.
        // Design choice: We treat it as WAIT_FOR_EVENT because that mirrors
        // the legacy behaviour of the previous turn handlers.

        /* istanbul ignore next */
        if (
          typeof globalThis !== 'undefined' &&
          globalThis.process &&
          globalThis.process.env.NODE_ENV !== 'production'
        ) {
          // Helpful debug log when running tests or dev builds.
          // We **do not** throw because production should keep rolling.
          // The caller retains ultimate responsibility for safe execution.
          //  – If that is undesirable, swap the console.warn() for an Error.
          // eslint-disable-next-line no-console
          console.warn(
            `${this.name}: Unrecognised TurnDirective (\u201c${directive}\u201d). Falling back to WAIT_FOR_EVENT.`
          );
        }

        return getOrCreate(WaitForTurnEndEventStrategy);
      }
    }
  }
}
