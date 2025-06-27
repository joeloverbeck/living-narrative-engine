// src/turns/interfaces/IDirectiveStrategyResolver.js

/** @typedef {import('./ITurnDirectiveStrategy.js').ITurnDirectiveStrategy} ITurnDirectiveStrategy */

/**
 * @interface IDirectiveStrategyResolver
 * @description Provides a method to resolve an {@link ITurnDirectiveStrategy}
 * implementation for a given directive.
 */
export class IDirectiveStrategyResolver {
  /**
   * Resolves the strategy for the supplied directive.
   *
   * @param {string} directive - Directive requesting a strategy.
   * @returns {ITurnDirectiveStrategy} The resolved strategy implementation.
   */
  resolveStrategy(directive) {
    throw new Error(
      'IDirectiveStrategyResolver.resolveStrategy method not implemented.'
    );
  }
}
