/**
 * @file Defines the RefinementMethodLoader class, responsible for loading
 * refinement method definitions from mods for the GOAP system.
 */

// --- Base Class Import ---
import { SimpleItemLoader } from '../../loaders/simpleItemLoader.js';

/** @typedef {import('../../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads refinement method definitions from mods for the GOAP system.
 *
 * Refinement methods define how planning-tasks decompose into sequences of
 * primitive actions. Each method specifies applicability conditions and
 * sequential steps to execute. Methods are referenced from task definitions
 * via $ref paths.
 *
 * @class
 * @augments SimpleItemLoader
 */
class RefinementMethodLoader extends SimpleItemLoader {
  /**
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
      'refinement-methods',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Override to add refinement method-specific validation and logging
   *
   * @protected
   * @override
   * @async
   * @param {string} modId - Mod identifier
   * @param {string} filename - Name of the file
   * @param {string} resolvedPath - Resolved path to the file
   * @param {object} data - Parsed refinement method data
   * @param {string} registryKey - Registry key for storing
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} Result object
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    // Validate refinement method-specific requirements
    this._validateRefinementMethodStructure(data, modId, filename);

    // Call parent implementation for standard processing
    const result = await super._processFetchedItem(
      modId,
      filename,
      resolvedPath,
      data,
      registryKey
    );

    // Log refinement method details for debugging
    this._logRefinementMethodDetails(data, result.qualifiedId);

    return result;
  }

  /**
   * Validate refinement method-specific structural requirements
   *
   * @private
   * @param {object} data - Refinement method data to validate
   * @param {string} modId - Mod identifier
   * @param {string} filename - File name for error reporting
   * @throws {Error} If validation fails
   */
  _validateRefinementMethodStructure(data, modId, filename) {
    // Validate method ID format (modId:task_id.method_name)
    if (!this._isValidRefinementMethodId(data.id)) {
      throw new Error(
        `Refinement method in ${filename}: ID '${data.id}' must follow format 'modId:task_id.method_name'`
      );
    }

    // Validate taskId format (modId:task_id)
    if (!this._isValidTaskId(data.taskId)) {
      throw new Error(
        `Refinement method ${data.id} in ${filename}: taskId '${data.taskId}' must follow format 'modId:task_id'`
      );
    }

    // Validate that method ID's task portion matches taskId
    const [_methodModId, taskAndMethod] = data.id.split(':');
    const [methodTaskId] = taskAndMethod.split('.');
    const [_taskModId, taskBaseName] = data.taskId.split(':');

    if (methodTaskId !== taskBaseName) {
      throw new Error(
        `Refinement method ${data.id} in ${filename}: Task portion of method ID ('${methodTaskId}') must match taskId base name ('${taskBaseName}')`
      );
    }

    // Validate steps array
    if (!data.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
      throw new Error(
        `Refinement method ${data.id} in ${filename}: Must have at least one step`
      );
    }

    // Validate each step has stepType
    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i];
      if (!step.stepType) {
        throw new Error(
          `Refinement method ${data.id} in ${filename}: Step ${i} must have a 'stepType' property`
        );
      }

      // Validate primitive_action steps have actionId
      if (step.stepType === 'primitive_action' && !step.actionId) {
        throw new Error(
          `Refinement method ${data.id} in ${filename}: Primitive action step ${i} must have 'actionId' property`
        );
      }

      // Validate conditional steps have condition and thenSteps
      if (step.stepType === 'conditional') {
        if (!step.condition) {
          throw new Error(
            `Refinement method ${data.id} in ${filename}: Conditional step ${i} must have 'condition' property`
          );
        }
        if (
          !step.thenSteps ||
          !Array.isArray(step.thenSteps) ||
          step.thenSteps.length === 0
        ) {
          throw new Error(
            `Refinement method ${data.id} in ${filename}: Conditional step ${i} must have at least one 'thenSteps' entry`
          );
        }
      }
    }
  }

  /**
   * Check if a refinement method ID is valid
   *
   * @private
   * @param {string} methodId - Method ID to validate
   * @returns {boolean} True if valid
   */
  _isValidRefinementMethodId(methodId) {
    // Format: modId:task_id.method_name
    const pattern = /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+\.[a-zA-Z0-9_]+$/;
    return pattern.test(methodId);
  }

  /**
   * Check if a task ID is valid
   *
   * @private
   * @param {string} taskId - Task ID to validate
   * @returns {boolean} True if valid
   */
  _isValidTaskId(taskId) {
    // Format: modId:task_id
    const pattern = /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/;
    return pattern.test(taskId);
  }

  /**
   * Log refinement method details for debugging and monitoring
   *
   * @private
   * @param {object} data - Refinement method data
   * @param {string} qualifiedId - Fully qualified method ID
   */
  _logRefinementMethodDetails(data, qualifiedId) {
    const stepCount = data.steps?.length || 0;
    const hasApplicability = !!data.applicability;
    const fallbackBehavior = data.fallbackBehavior || 'replan';

    this._logger.debug(
      `Refinement method ${qualifiedId} loaded: ${stepCount} step(s), ` +
        `applicability: ${hasApplicability ? 'conditional' : 'always'}, ` +
        `fallback: ${fallbackBehavior}`,
      {
        methodId: qualifiedId,
        taskId: data.taskId,
        stepCount,
        hasApplicability,
        fallbackBehavior,
      }
    );
  }

  /**
   * Override to provide summary of loaded refinement methods
   *
   * @param {string} modId - Mod identifier
   * @param {object} modManifest - Mod manifest data
   * @param {string} contentKey - Content key in manifest
   * @param {string} diskFolder - Disk folder path
   * @param {string} registryKey - Registry key for storing
   * @public
   * @async
   * @returns {Promise<{loaded: number, overridden: number}>} Load statistics
   */
  async loadItemsForMod(
    modId,
    modManifest,
    contentKey,
    diskFolder,
    registryKey
  ) {
    const result = await super.loadItemsForMod(
      modId,
      modManifest,
      contentKey,
      diskFolder,
      registryKey
    );

    // Get loaded refinement methods for summary statistics
    const methodsKey = `${registryKey}.${modId}`;
    const methods = this._dataRegistry.getAll(methodsKey) || [];

    if (methods.length > 0) {
      // Count total steps across all methods
      const totalSteps = methods.reduce((sum, method) => {
        return sum + (method.steps?.length || 0);
      }, 0);

      this._logger.info(
        `Mod '${modId}' loaded ${methods.length} refinement method(s) with ${totalSteps} total step(s)`
      );
    }

    return result;
  }
}

export default RefinementMethodLoader;
