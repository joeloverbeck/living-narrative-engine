// src/turns/strategies/turnDirectiveStrategyResolver.js
// ────────────────────────────────────────────────────────────────────────────
//  TurnDirectiveStrategyResolver  – PTH-STRAT-006
// ────────────────────────────────────────────────────────────────────────────
//  Responsible for returning the correct ITurnDirectiveStrategy implementation
//  for a given TurnDirective enum value.  Falls back to a sensible default
//  (WAIT_FOR_EVENT → WaitForTurnEndEventStrategy) when the directive is null,
//  undefined, or unrecognised.
//
//  Strategies are injected via the constructor allowing callers to substitute
//  alternative implementations. Instances are cached lazily as they are first
//  requested. A `clearCache` method is provided for test isolation.
//
//  NOTE: This project is plain JavaScript – we rely on JSDoc for intellisense.
// ────────────────────────────────────────────────────────────────────────────

/** @typedef {import('../handlers/actorTurnHandler.js').default} ActorTurnHandler */
/** @typedef {import('../../entities/entity.js').default}        Entity */
/** @typedef {import('../constants/turnDirectives.js').default}   TurnDirectiveEnum */
/** @typedef {import('../interfaces/ITurnDirectiveStrategy.js').ITurnDirectiveStrategy} ITurnDirectiveStrategy */

import TurnDirective from '../constants/turnDirectives.js';
import RepromptStrategy from './repromptStrategy.js';
import EndTurnSuccessStrategy from './endTurnSuccessStrategy.js';
import EndTurnFailureStrategy from './endTurnFailureStrategy.js';
import WaitForTurnEndEventStrategy from './waitForTurnEndEventStrategy.js';
import { ITurnDirectiveResolver } from '../interfaces/ITurnDirectiveResolver.js';

export const DEFAULT_STRATEGY_MAP = {
  [TurnDirective.RE_PROMPT]: RepromptStrategy,
  [TurnDirective.END_TURN_SUCCESS]: EndTurnSuccessStrategy,
  [TurnDirective.END_TURN_FAILURE]: EndTurnFailureStrategy,
  [TurnDirective.WAIT_FOR_EVENT]: WaitForTurnEndEventStrategy,
};

/**
 * @description Resolver that maps turn directives to concrete strategy instances.
 * @implements {ITurnDirectiveResolver}
 */
export default class TurnDirectiveStrategyResolver extends ITurnDirectiveResolver {
  /** @type {Map<string, Function|ITurnDirectiveStrategy>} */
  #strategyMap;
  /** @type {Map<string, ITurnDirectiveStrategy>} */
  #instances = new Map();

  /**
   * @param {Record<string, Function|ITurnDirectiveStrategy>} strategyMap
   *        Map of directives to strategy classes, factory functions or instances.
   */
  constructor(strategyMap) {
    super();
    if (!strategyMap) {
      throw new Error('TurnDirectiveStrategyResolver: strategyMap is required');
    }
    this.#strategyMap = new Map(Object.entries(strategyMap));
  }

  /**
   * @private
   * @param {string} directive
   * @returns {ITurnDirectiveStrategy}
   */
  #getInstance(directive) {
    if (!this.#instances.has(directive)) {
      const creator = this.#strategyMap.get(directive);
      let instance = creator;
      if (typeof creator === 'function') {
        try {
          instance = new creator();
        } catch (e) {
          instance = creator();
        }
      }
      this.#instances.set(directive, instance);
    }
    return this.#instances.get(directive);
  }

  /**
   * @override
   * @param {TurnDirectiveEnum|string|null|undefined} directive - Directive requesting a strategy.
   * @returns {ITurnDirectiveStrategy} The resolved strategy implementation.
   */
  resolveStrategy(directive) {
    const key = this.#strategyMap.has(directive)
      ? directive
      : TurnDirective.WAIT_FOR_EVENT;

    if (key !== directive && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        `${this.constructor.name}: Unrecognised TurnDirective (` +
          `"${directive}"). Falling back to WAIT_FOR_EVENT.`
      );
    }

    return this.#getInstance(key);
  }

  /**
   * Clears cached strategy instances. Useful for tests.
   */
  clearCache() {
    this.#instances.clear();
  }
}
