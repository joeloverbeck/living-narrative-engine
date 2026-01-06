/**
 * @file Expression Registry - Storage and retrieval for expression definitions.
 */

import { BaseService } from '../utils/serviceBase.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

class ExpressionRegistry extends BaseService {
  /** @type {IDataRegistry} */
  #dataRegistry;
  /** @type {ILogger} */
  #logger;
  /** @type {Map<string, object> | null} */
  #expressionCache;
  /** @type {Map<string, Set<string>> | null} */
  #tagIndex;
  /** @type {object[] | null} */
  #priorityCache;

  /**
   * @param {{dataRegistry: IDataRegistry, logger: ILogger}} params
   */
  constructor({ dataRegistry, logger }) {
    super();
    this.#logger = this._init('ExpressionRegistry', logger, {
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['getAll'],
      },
    });

    this.#dataRegistry = dataRegistry;
    this.#expressionCache = null;
    this.#tagIndex = null;
    this.#priorityCache = null;
  }

  /**
   * Get all loaded expressions.
   * @returns {object[]}
   */
  getAllExpressions() {
    this.#ensureCache();
    return Array.from(this.#expressionCache?.values() ?? []);
  }

  /**
   * Get expression by ID.
   * @param {string} expressionId
   * @returns {object | null}
   */
  getExpression(expressionId) {
    this.#ensureCache();

    if (typeof expressionId !== 'string' || expressionId.trim() === '') {
      return null;
    }

    return this.#expressionCache?.get(expressionId) ?? null;
  }

  /**
   * Get expressions by tag for pre-filtering.
   * @param {string} tag
   * @returns {object[]}
   */
  getExpressionsByTag(tag) {
    this.#ensureCache();

    if (typeof tag !== 'string' || tag.trim() === '') {
      return [];
    }

    const ids = this.#tagIndex?.get(tag);
    if (!ids || ids.size === 0) {
      return [];
    }

    const expressions = [];
    for (const id of ids) {
      const expression = this.#expressionCache?.get(id);
      if (expression) {
        expressions.push(expression);
      }
    }

    return expressions;
  }

  /**
   * Get expressions sorted by priority (descending).
   * @returns {object[]}
   */
  getExpressionsByPriority() {
    this.#ensureCache();
    return this.#priorityCache ? [...this.#priorityCache] : [];
  }

  #ensureCache() {
    if (this.#expressionCache) {
      return;
    }

    const expressions = this.#dataRegistry.getAll('expressions');

    if (!Array.isArray(expressions) || expressions.length === 0) {
      this.#logger.warn(
        'ExpressionRegistry: No expressions found in data registry.'
      );

      this.#expressionCache = new Map();
      this.#tagIndex = new Map();
      this.#priorityCache = [];
      return;
    }

    const cache = new Map();
    for (const expression of expressions) {
      if (!expression || typeof expression.id !== 'string') {
        this.#logger.warn(
          'ExpressionRegistry: Skipping expression without a valid id.',
          {
            expression,
          }
        );
        continue;
      }

      cache.set(expression.id, expression);
    }

    this.#expressionCache = cache;
    this.#buildTagIndex();
    this.#priorityCache = this.#buildPriorityList();
    this.#logger.info(`loaded ${this.#expressionCache.size} expressions`);
  }

  /**
   * Build/rebuild tag index for efficient filtering.
   */
  #buildTagIndex() {
    const tagIndex = new Map();

    for (const expression of this.#expressionCache?.values() ?? []) {
      const tags = expression?.tags;
      if (!Array.isArray(tags) || tags.length === 0) {
        continue;
      }

      for (const tag of tags) {
        if (typeof tag !== 'string' || tag.trim() === '') {
          continue;
        }

        let tagSet = tagIndex.get(tag);
        if (!tagSet) {
          tagSet = new Set();
          tagIndex.set(tag, tagSet);
        }
        tagSet.add(expression.id);
      }
    }

    this.#tagIndex = tagIndex;
  }

  #buildPriorityList() {
    const expressions = Array.from(this.#expressionCache?.values() ?? []);

    expressions.sort((left, right) => {
      const leftPriority =
        typeof left.priority === 'number' && Number.isFinite(left.priority)
          ? left.priority
          : 0;
      const rightPriority =
        typeof right.priority === 'number' && Number.isFinite(right.priority)
          ? right.priority
          : 0;

      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      const leftId = typeof left.id === 'string' ? left.id : '';
      const rightId = typeof right.id === 'string' ? right.id : '';
      return leftId.localeCompare(rightId);
    });

    return expressions;
  }
}

export default ExpressionRegistry;
