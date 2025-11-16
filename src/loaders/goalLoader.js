/**
 * @file Defines the GoalLoader class, responsible for loading
 * GOAP goal definitions from mods.
 */

// --- Base Class Import ---
import { SimpleItemLoader } from './simpleItemLoader.js';

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads GOAP goal definitions from mods.
 *
 * Goals define world-state targets that GOAP actors will pursue. Each goal
 * specifies a priority, relevance conditions, and desired goal state conditions.
 *
 * Goals are loaded from 'goals/' folders in mods and are evaluated against
 * actor state to determine which goals are currently relevant.
 *
 * @class
 * @augments SimpleItemLoader
 */
class GoalLoader extends SimpleItemLoader {
  /**
   * Creates a new GoalLoader instance for loading GOAP goal definitions.
   *
   * @param {IConfiguration} config - Configuration service instance.
   * @param {IPathResolver} pathResolver - Path resolution service instance.
   * @param {IDataFetcher} dataFetcher - Data fetching service instance.
   * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
   * @param {IDataRegistry} dataRegistry - Data registry service instance.
   * @param {ILogger} logger - Logging service instance.
   */
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'goals',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Override to add goal-specific validation and logging
   *
   * @protected
   * @override
   * @async
   * @param {string} modId - Mod identifier
   * @param {string} filename - Name of the file
   * @param {string} resolvedPath - Resolved path to the file
   * @param {object} data - Parsed goal data
   * @param {string} registryKey - Registry key for storing
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} Result object
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    // Validate goal-specific requirements
    this._validateGoalStructure(data, modId, filename);

    // Call parent implementation for standard processing
    const result = await super._processFetchedItem(
      modId,
      filename,
      resolvedPath,
      data,
      registryKey
    );

    // Log goal details for debugging
    this._logger.debug('Loaded goal: ' + data.id, {
      priority: data.priority,
      hasRelevance: !!data.relevance,
      hasGoalState: !!data.goalState,
    });

    return result;
  }

  /**
   * Validate goal-specific structure requirements
   *
   * @private
   * @param {object} data - Goal data
   * @param {string} modId - Mod identifier
   * @param {string} filename - Filename
   * @throws {Error} If validation fails
   */
  _validateGoalStructure(data, modId, filename) {
    const context = modId + '/' + filename;

    // Validate priority
    if (typeof data.priority !== 'number') {
      throw new Error(
        'Goal ' + context + ': priority must be a number, got ' + typeof data.priority
      );
    }

    if (data.priority < 0) {
      throw new Error(
        'Goal ' + context + ': priority must be non-negative, got ' + data.priority
      );
    }

    // Validate relevance condition
    if (!data.relevance || typeof data.relevance !== 'object') {
      throw new Error(
        'Goal ' + context + ': relevance condition is required and must be an object'
      );
    }

    // Validate goalState condition
    if (!data.goalState || typeof data.goalState !== 'object') {
      throw new Error(
        'Goal ' + context + ': goalState condition is required and must be an object'
      );
    }

    this._logger.debug('Validated goal structure for ' + context, {
      priority: data.priority,
    });
  }
}

export default GoalLoader;
