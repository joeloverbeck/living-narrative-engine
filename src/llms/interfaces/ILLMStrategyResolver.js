// src/llms/interfaces/ILLMStrategyResolver.js

/**
 * @interface ILLMStrategyResolver
 * @description Provides a method to resolve a strategy class for a given
 * apiType and json output method.
 */
export class ILLMStrategyResolver {
  /**
   * Resolves the strategy class for the supplied identifiers.
   *
   * @param {string} apiType - Normalized API type.
   * @param {string} method - Normalized jsonOutputStrategy method.
   * @returns {Function|undefined} The matching strategy class.
   */
  resolveStrategy(apiType, method) {
    throw new Error(
      'ILLMStrategyResolver.resolveStrategy method not implemented.'
    );
  }
}
