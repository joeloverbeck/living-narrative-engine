/**
 * @file LayoutEngine for anatomy visualization with pluggable layout strategies
 * @see layouts/RadialLayoutStrategy.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./types/AnatomyNode.js').default} AnatomyNode */
/** @typedef {import('./types/AnatomyEdge.js').default} AnatomyEdge */
/** @typedef {import('./types/RenderContext.js').default} RenderContext */

/**
 * Interface for layout strategies
 *
 * @interface ILayoutStrategy
 */
/**
 * @typedef {object} ILayoutStrategy
 * @property {function(Map<string, AnatomyNode>, Array<AnatomyEdge>, RenderContext): void} calculate - Calculate layout positions
 * @property {function(object): void} configure - Configure strategy-specific options
 * @property {function(): {width: number, height: number}} getRequiredSpace - Get required space for layout
 * @property {function(): string} getName - Get strategy name
 */

/**
 * Layout engine that manages different layout strategies for anatomy visualization.
 * Implements the Strategy pattern to allow pluggable layout algorithms.
 */
class LayoutEngine {
  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });

    this.#logger = logger;
    this.#strategies = new Map();
    this.#currentStrategy = null;
    this.#currentStrategyName = null;
  }

  /** @type {ILogger} */
  #logger;

  /** @type {Map<string, ILayoutStrategy>} */
  #strategies;

  /** @type {ILayoutStrategy|null} */
  #currentStrategy;

  /** @type {string|null} */
  #currentStrategyName;

  /**
   * Register a layout strategy
   *
   * @param {string} name - Strategy name
   * @param {ILayoutStrategy} strategy - Strategy implementation
   */
  registerStrategy(name, strategy) {
    assertNonBlankString(name, 'Strategy name', 'LayoutEngine.registerStrategy', this.#logger);

    // Validate strategy interface
    if (!strategy || typeof strategy !== 'object') {
      throw new Error('Strategy must be an object');
    }

    const requiredMethods = [
      'calculate',
      'configure',
      'getRequiredSpace',
      'getName',
    ];
    for (const method of requiredMethods) {
      if (typeof strategy[method] !== 'function') {
        throw new Error(`Strategy must implement method: ${method}`);
      }
    }

    this.#strategies.set(name, strategy);
    this.#logger.debug(`LayoutEngine: Registered strategy '${name}'`);

    // Set as current if it's the first strategy
    if (this.#strategies.size === 1) {
      this.setStrategy(name);
    }
  }

  /**
   * Set the active layout strategy
   *
   * @param {string} name - Strategy name
   */
  setStrategy(name) {
    assertNonBlankString(name, 'Strategy name', 'LayoutEngine.setStrategy', this.#logger);

    const strategy = this.#strategies.get(name);
    if (!strategy) {
      throw new Error(`Unknown layout strategy: ${name}`);
    }

    this.#currentStrategy = strategy;
    this.#currentStrategyName = name;
    this.#logger.info(`LayoutEngine: Active strategy set to '${name}'`);
  }

  /**
   * Get the current strategy name
   *
   * @returns {string|null} Current strategy name
   */
  getCurrentStrategyName() {
    return this.#currentStrategyName;
  }

  /**
   * Get list of available strategy names
   *
   * @returns {Array<string>} Available strategy names
   */
  getAvailableStrategies() {
    return Array.from(this.#strategies.keys());
  }

  /**
   * Calculate layout for nodes and edges using current strategy
   *
   * @param {Map<string, AnatomyNode>} nodes - Nodes to layout
   * @param {Array<AnatomyEdge>} edges - Edges between nodes
   * @param {RenderContext} renderContext - Rendering context
   * @throws {Error} If no strategy is set
   */
  calculateLayout(nodes, edges, renderContext) {
    if (!this.#currentStrategy) {
      throw new Error('No layout strategy set');
    }

    this.#logger.debug(
      `LayoutEngine: Calculating layout with strategy '${this.#currentStrategyName}'`,
      {
        nodeCount: nodes.size,
        edgeCount: edges.length,
      }
    );

    const startTime = performance.now();

    try {
      // Delegate to current strategy
      this.#currentStrategy.calculate(nodes, edges, renderContext);

      const endTime = performance.now();
      const layoutTime = endTime - startTime;

      renderContext.updatePerformance({ layoutTime });

      this.#logger.debug(
        `LayoutEngine: Layout calculation completed in ${layoutTime.toFixed(2)}ms`
      );
    } catch (error) {
      this.#logger.error('LayoutEngine: Layout calculation failed', error);
      throw error;
    }
  }

  /**
   * Configure the current layout strategy
   *
   * @param {object} options - Strategy-specific options
   * @throws {Error} If no strategy is set
   */
  configure(options) {
    if (!this.#currentStrategy) {
      throw new Error('No layout strategy set');
    }

    this.#logger.debug(
      `LayoutEngine: Configuring strategy '${this.#currentStrategyName}'`,
      options
    );

    this.#currentStrategy.configure(options);
  }

  /**
   * Get required space for current layout
   *
   * @returns {{width: number, height: number}} Required space
   * @throws {Error} If no strategy is set
   */
  getRequiredSpace() {
    if (!this.#currentStrategy) {
      throw new Error('No layout strategy set');
    }

    return this.#currentStrategy.getRequiredSpace();
  }

  /**
   * Check if a strategy is registered
   *
   * @param {string} name - Strategy name
   * @returns {boolean} True if strategy is registered
   */
  hasStrategy(name) {
    return this.#strategies.has(name);
  }

  /**
   * Remove a registered strategy
   *
   * @param {string} name - Strategy name to remove
   * @throws {Error} If trying to remove current strategy
   */
  removeStrategy(name) {
    if (name === this.#currentStrategyName) {
      throw new Error('Cannot remove current strategy');
    }

    this.#strategies.delete(name);
    this.#logger.debug(`LayoutEngine: Removed strategy '${name}'`);
  }

  /**
   * Clear all strategies
   */
  clearStrategies() {
    this.#strategies.clear();
    this.#currentStrategy = null;
    this.#currentStrategyName = null;
    this.#logger.debug('LayoutEngine: Cleared all strategies');
  }
}

export default LayoutEngine;
