// src/turns/interfaces/ITurnDirectiveResolver.js

/** @typedef {import('./ITurnDirectiveStrategy.js').ITurnDirectiveStrategy} ITurnDirectiveStrategy */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum */

/**
 * @interface ITurnDirectiveResolver
 * @description Provides a method to resolve an {@link ITurnDirectiveStrategy}
 * implementation for a given turn directive.
 */
export class ITurnDirectiveResolver {
  /**
   * Resolves the strategy for the supplied directive.
   *
   * @param {TurnDirectiveEnum|string} directive - Directive requesting a strategy.
   * @returns {ITurnDirectiveStrategy} The resolved strategy implementation.
   */
  resolveStrategy(directive) {
    throw new Error(
      'ITurnDirectiveResolver.resolveStrategy method not implemented.'
    );
  }
}
