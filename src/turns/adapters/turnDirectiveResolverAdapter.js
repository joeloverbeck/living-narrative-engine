// src/turns/adapters/turnDirectiveResolverAdapter.js

import { ITurnDirectiveResolver } from '../interfaces/ITurnDirectiveResolver.js';
import TurnDirectiveStrategyResolver from '../strategies/turnDirectiveStrategyResolver.js';

/**
 * @class TurnDirectiveResolverAdapter
 * @implements {ITurnDirectiveResolver}
 * @description Adapts the static {@link TurnDirectiveStrategyResolver}
 * so it can be supplied where an {@link ITurnDirectiveResolver} instance
 * is expected.
 */
export class TurnDirectiveResolverAdapter extends ITurnDirectiveResolver {
  /**
   * @override
   * @param {string} directive
   * @returns {import('../interfaces/ITurnDirectiveStrategy.js').ITurnDirectiveStrategy}
   */
  resolveStrategy(directive) {
    return TurnDirectiveStrategyResolver.resolveStrategy(directive);
  }
}

// Singleton instance, as the resolver is stateless
export default new TurnDirectiveResolverAdapter();
