/**
 * @file Defines the TaskLoader class, responsible for loading
 * planning-task definitions from mods for the GOAP system.
 */

// --- Base Class Import ---
import { SimpleItemLoader } from './simpleItemLoader.js';
import { SCOPES_KEY } from '../constants/dataRegistryKeys.js';

const REFINEMENT_METHODS_FOLDER = 'refinement-methods';
const REFINEMENT_METHODS_PREFIX = `${REFINEMENT_METHODS_FOLDER}/`;

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads planning-task definitions from mods for the GOAP system.
 *
 * Tasks define high-level goals that can be decomposed into sequences of
 * primitive actions via refinement methods. Each task specifies structural
 * gates, planning preconditions, planning effects, and refinement methods.
 *
 * @class
 * @augments SimpleItemLoader
 */
class TaskLoader extends SimpleItemLoader {
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
      'tasks',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );

    /** @private @type {Map<string, {id: string, taskId: string}>} */
    this._refinementMethodCache = new Map();
  }

  /**
   * Override to add task-specific validation and logging
   *
   * @protected
   * @override
   * @async
   * @param {string} modId - Mod identifier
   * @param {string} filename - Name of the file
   * @param {string} resolvedPath - Resolved path to the file
   * @param {object} data - Parsed task data
   * @param {string} registryKey - Registry key for storing
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} Result object
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    // Apply default values if not specified
    if (data.cost === undefined) {
      data.cost = 10;
    }
    if (data.priority === undefined) {
      data.priority = 50;
    }

    // Validate task-specific requirements
    await this._validateTaskStructure(data, modId, filename);

    // Call parent implementation for standard processing
    const result = await super._processFetchedItem(
      modId,
      filename,
      resolvedPath,
      data,
      registryKey
    );

    // Log task details for debugging
    this._logTaskDetails(data, result.qualifiedId);

    return result;
  }

  /**
   * Validate task-specific structural requirements
   *
   * @private
   * @param {object} data - Task data to validate
   * @param {string} modId - Mod identifier
   * @param {string} filename - File name for error reporting
   * @throws {Error} If validation fails
   */
  async _validateTaskStructure(data, modId, filename) {
    if (data.planningScope) {
      this._validatePlanningScopeReference(data, filename);
    }

    // Validate refinement method references
    if (data.refinementMethods && Array.isArray(data.refinementMethods)) {
      for (const method of data.refinementMethods) {
        if (!method.methodId || !method.$ref) {
          throw new Error(
            `Task ${data.id} in ${filename}: Each refinement method must have methodId and $ref properties`
          );
        }

        // Validate method ID format (modId:task_id.method_name)
        if (!this._isValidRefinementMethodId(method.methodId)) {
          throw new Error(
            `Task ${data.id} in ${filename}: Refinement method ID '${method.methodId}' must follow format 'modId:task_id.method_name'`
          );
        }

        // Validate that method ID's task portion matches task ID
        const [_methodModId, taskAndMethod] = method.methodId.split(':');
        const [methodTaskId] = taskAndMethod.split('.');
        const [_taskModId, taskBaseName] = data.id.split(':');

        if (methodTaskId !== taskBaseName) {
          throw new Error(
            `Task ${data.id} in ${filename}: Refinement method '${method.methodId}' task portion must match task ID base name '${taskBaseName}'`
          );
        }

        await this._validateRefinementMethodReference(
          data.id,
          modId,
          method,
          filename
        );
      }
    }

    // Validate planning effects contain valid operations
    if (data.planningEffects && Array.isArray(data.planningEffects)) {
      for (const effect of data.planningEffects) {
        if (!effect.type) {
          throw new Error(
            `Task ${data.id} in ${filename}: Each planning effect must have a 'type' property`
          );
        }
      }
    }
  }

  /**
   * Validate that a refinement method reference resolves to a file inside the mod's
   * refinement-methods directory and that the file's metadata matches the task declaration.
   *
   * @private
   * @async
   * @param {string} taskId - Fully qualified task identifier.
   * @param {string} modId - Owning mod identifier.
   * @param {{methodId: string, $ref: string}} method - Refinement method reference.
   * @param {string} filename - Source filename for context.
   */
  async _validateRefinementMethodReference(taskId, modId, method, filename) {
    const normalizedRef = this._normalizeRefinementMethodRef(
      method.$ref,
      taskId,
      filename
    );

    const cacheKey = `${modId}:${normalizedRef}`;
    let cachedMethod = this._refinementMethodCache.get(cacheKey);

    if (!cachedMethod) {
      const relativePath = normalizedRef.slice(REFINEMENT_METHODS_PREFIX.length);
      const resolvedPath = this._pathResolver.resolveModContentPath(
        modId,
        REFINEMENT_METHODS_FOLDER,
        relativePath
      );

      let methodData;
      try {
        methodData = await this._dataFetcher.fetch(resolvedPath);
      } catch (error) {
        throw new Error(
          `Task ${taskId} in ${filename}: Failed to load refinement method '${method.methodId}' from '${method.$ref}'. ${error?.message || ''}`.trim()
        );
      }

      if (!methodData || typeof methodData !== 'object') {
        throw new Error(
          `Task ${taskId} in ${filename}: Refinement method '${method.methodId}' referenced by '${method.$ref}' did not return a JSON object`
        );
      }

      const { id, taskId: methodTaskId } = methodData;
      cachedMethod = { id, taskId: methodTaskId };
      this._refinementMethodCache.set(cacheKey, cachedMethod);
    }

    if (!cachedMethod.id || typeof cachedMethod.id !== 'string') {
      throw new Error(
        `Task ${taskId} in ${filename}: Refinement method file '${method.$ref}' must declare an 'id'`
      );
    }

    if (cachedMethod.id !== method.methodId) {
      throw new Error(
        `Task ${taskId} in ${filename}: Refinement method '${method.methodId}' points to '${method.$ref}', but the file declares id '${cachedMethod.id}'`
      );
    }

    if (!cachedMethod.taskId || typeof cachedMethod.taskId !== 'string') {
      throw new Error(
        `Task ${taskId} in ${filename}: Refinement method file '${method.$ref}' must declare a taskId`
      );
    }

    if (cachedMethod.taskId !== taskId) {
      throw new Error(
        `Task ${taskId} in ${filename}: Refinement method '${method.methodId}' referenced by '${method.$ref}' declares taskId '${cachedMethod.taskId}', expected '${taskId}'`
      );
    }
  }

  /**
   * Normalize and validate a refinement-method $ref string.
   *
   * @private
   * @param {string} refPath - Raw $ref string from the task file.
   * @param {string} taskId - Task identifier for error context.
   * @param {string} filename - Source filename for error context.
   * @returns {string} Normalized path rooted at `refinement-methods/`.
   */
  _normalizeRefinementMethodRef(refPath, taskId, filename) {
    if (typeof refPath !== 'string' || refPath.trim() === '') {
      throw new Error(
        `Task ${taskId} in ${filename}: Refinement method $ref must be a non-empty string`
      );
    }

    let normalized = refPath.trim().replace(/\\/g, '/');
    while (normalized.startsWith('./')) {
      normalized = normalized.slice(2);
    }

    if (normalized.startsWith('/')) {
      throw new Error(
        `Task ${taskId} in ${filename}: Refinement method $ref '${refPath}' must be relative to the mod and cannot start with '/'`
      );
    }

    normalized = normalized.replace(/\/{2,}/g, '/');

    if (!normalized.startsWith(REFINEMENT_METHODS_PREFIX)) {
      throw new Error(
        `Task ${taskId} in ${filename}: Refinement method $ref '${refPath}' must begin with '${REFINEMENT_METHODS_PREFIX}'`
      );
    }

    const segments = normalized.split('/');
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
      throw new Error(
        `Task ${taskId} in ${filename}: Refinement method $ref '${refPath}' contains invalid path segments`
      );
    }

    if (!normalized.endsWith('.refinement.json')) {
      throw new Error(
        `Task ${taskId} in ${filename}: Refinement method $ref '${refPath}' must point to a .refinement.json file`
      );
    }

    if (normalized.length <= REFINEMENT_METHODS_PREFIX.length) {
      throw new Error(
        `Task ${taskId} in ${filename}: Refinement method $ref '${refPath}' must include a file location inside '${REFINEMENT_METHODS_FOLDER}/'`
      );
    }

    return normalized;
  }

  /**
   * Validate the planning scope string and ensure the referenced scope exists.
   *
   * @private
   * @param {object} data - Task data being validated
   * @param {string} filename - Source filename (for error context)
   */
  _validatePlanningScopeReference(data, filename) {
    const { planningScope } = data;

    if (!this._isValidScopeReference(planningScope)) {
      throw new Error(
        `Task ${data.id} in ${filename}: planningScope '${planningScope}' must be a valid scope reference (modId:scopeName)`
      );
    }

    if (planningScope === 'none' || planningScope === 'self') {
      return;
    }

    const scopeDefinition = this._dataRegistry.get(SCOPES_KEY, planningScope);
    if (!scopeDefinition) {
      throw new Error(
        `Task ${data.id} in ${filename}: planningScope '${planningScope}' references a scope that is not loaded. Ensure the scope exists and dependencies are declared.`
      );
    }
  }

  /**
   * Check if a scope reference is valid (modId:scopeName or special scopes)
   *
   * @private
   * @param {string} scopeRef - Scope reference to validate
   * @returns {boolean} True if valid
   */
  _isValidScopeReference(scopeRef) {
    // Allow special scopes
    if (scopeRef === 'none' || scopeRef === 'self') {
      return true;
    }

    // Validate namespaced scope reference
    const pattern = /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/;
    return pattern.test(scopeRef);
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
   * Log task details for debugging and monitoring
   *
   * @private
   * @param {object} data - Task data
   * @param {string} qualifiedId - Fully qualified task ID
   */
  _logTaskDetails(data, qualifiedId) {
    const methodCount = data.refinementMethods?.length || 0;
    const preconditionCount = data.planningPreconditions?.length || 0;
    const effectCount = data.planningEffects?.length || 0;

    this._logger.debug(
      `Task ${qualifiedId} loaded: ${methodCount} refinement method(s), ` +
        `${preconditionCount} precondition(s), ${effectCount} effect(s)`,
      {
        taskId: qualifiedId,
        planningScope: data.planningScope,
        hasStructuralGates: !!data.structuralGates,
        cost: data.cost,
        priority: data.priority,
      }
    );
  }

  /**
   * Override to provide summary of loaded tasks
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

    // Get loaded tasks for summary statistics
    const tasksKey = `${registryKey}.${modId}`;
    const tasks = this._dataRegistry.getAll(tasksKey) || [];

    if (tasks.length > 0) {
      // Count refinement methods across all tasks
      const totalRefinementMethods = tasks.reduce((sum, task) => {
        return sum + (task.refinementMethods?.length || 0);
      }, 0);

      this._logger.info(
        `Mod '${modId}' loaded ${tasks.length} planning task(s) with ${totalRefinementMethods} total refinement method(s)`
      );
    }

    return result;
  }
}

export default TaskLoader;
