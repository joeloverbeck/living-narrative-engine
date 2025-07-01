/**
 * @file Helper class that resolves the strategy class for given apiType and method.
 */

import { ILLMStrategyResolver } from '../interfaces/ILLMStrategyResolver.js';

/**
 * @class LLMStrategyResolver
 * @description Maps apiType and jsonOutputStrategy.method pairs to strategy classes.
 * @implements {ILLMStrategyResolver}
 */
export class LLMStrategyResolver extends ILLMStrategyResolver {
  /** @type {Record<string, Record<string, Function>>} */
  #strategyMap;

  /**
   * @param {Record<string, Record<string, Function>>} strategyMap
   */
  constructor(strategyMap) {
    super();
    this.#strategyMap = strategyMap || {};
  }

  /**
   * Resolves the strategy class for the provided identifiers.
   *
   * @param {string} apiType - Normalized API type.
   * @param {string} method - Normalized jsonOutputStrategy method.
   * @returns {Function | undefined} Matching strategy class, if any.
   */
  resolveStrategy(apiType, method) {
    const apiTypeStrategies = this.#strategyMap[apiType];
    return apiTypeStrategies ? apiTypeStrategies[method] : undefined;
  }
}
