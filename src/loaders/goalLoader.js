/**
 * @file Defines the GoalLoader class, responsible for loading
 * GOAP goal definitions from mods.
 */

// --- Base Class Import ---
import { SimpleItemLoader } from './simpleItemLoader.js';
import { ModValidationError } from '../errors/modValidationError.js';
import { validateAgainstSchema } from '../utils/schemaValidationUtils.js';
import {
  normalizeGoalData,
  registerGoalNormalizationExtension,
  clearGoalNormalizationExtensions,
} from '../goals/normalization/index.js';

/* global process */

const GOAL_SCHEMA_ERROR_CODE = 'GOAL_SCHEMA_VALIDATION_FAILED';

/**
 * Checks if permissive goal loader mode is enabled via environment variable.
 * Browser-safe: Returns false (default) when process.env is unavailable.
 *
 * @returns {boolean} True if permissive mode is enabled, false otherwise
 */
function isPermissiveGoalLoaderMode() {
  // Browser compatibility: process.env doesn't exist in browsers
  if (typeof process === 'undefined' || !process.env) {
    return false; // Default behavior: permissive mode disabled
  }

  const raw = process.env.GOAL_LOADER_ALLOW_DEFAULTS;
  if (typeof raw !== 'string') {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}

/**
 * Checks if normalization diagnostics are enabled via environment variable.
 * Browser-safe: Returns true (default) when process.env is unavailable.
 */
function isNormalizationDiagnosticsEnabled() {
  // Browser compatibility: process.env doesn't exist in browsers
  if (typeof process === 'undefined' || !process.env) {
    return true; // Default behavior: diagnostics enabled
  }

  const raw = process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS;
  if (typeof raw !== 'string') {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === '0' ||
    normalized === 'false' ||
    normalized === 'off' ||
    normalized === 'no'
  ) {
    return false;
  }
  if (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'on' ||
    normalized === 'yes'
  ) {
    return true;
  }
  return true;
}

/**
 *
 * @param modId
 * @param registryKey
 */
function createNormalizationDiagnosticsState(modId = null, registryKey = null) {
  return {
    modId: modId || null,
    registryKey: registryKey || null,
    sessionStartedAt: Date.now(),
    sessionFinishedAt: null,
    goalsProcessed: 0,
    goalsWithMutations: 0,
    goalsRejected: 0,
    totalMutations: 0,
    fieldsAutoFilled: 0,
    warningsEmitted: 0,
    lastMutation: null,
    lastWarning: null,
    lastFile: null,
    lastModId: modId || null,
    diagnosticsEnabled: isNormalizationDiagnosticsEnabled(),
    context: null,
  };
}

/**
 *
 * @param state
 */
function cloneNormalizationDiagnostics(state) {
  if (!state) {
    return null;
  }
  return JSON.parse(JSON.stringify(state));
}

/**
 *
 * @param mutations
 */
function countAutoFilledFields(mutations) {
  if (!Array.isArray(mutations) || mutations.length === 0) {
    return 0;
  }
  let autoFilled = 0;
  for (const mutation of mutations) {
    if (mutation?.type === 'defaulted') {
      autoFilled += 1;
    }
  }
  return autoFilled;
}

/**
 *
 * @param segment
 */
function decodePointerSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 *
 * @param data
 * @param pointer
 */
function getValueAtPointer(data, pointer) {
  if (!pointer) {
    return data;
  }

  const trimmed = pointer.startsWith('/') ? pointer.slice(1) : pointer;
  if (!trimmed) {
    return data;
  }

  const segments = trimmed.split('/').map(decodePointerSegment);
  let current = data;
  for (const segment of segments) {
    if (
      current !== null &&
      typeof current === 'object' &&
      Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      current = current[segment];
      continue;
    }
    return undefined;
  }
  return current;
}

/**
 *
 * @param value
 */
function formatDataSnippet(value) {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 200) {
      return `${serialized.slice(0, 197)}...`;
    }
    return serialized;
  } catch (error) {
    return '[unserializable snippet]';
  }
}

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
    this._normalizationDiagnostics = createNormalizationDiagnosticsState();
    this._lastNormalizationDiagnostics = null;
  }

  static registerNormalizationExtension(extension) {
    return registerGoalNormalizationExtension(extension);
  }

  static clearNormalizationExtensions() {
    clearGoalNormalizationExtensions();
  }

  _resetNormalizationDiagnostics(modId, registryKey) {
    this._normalizationDiagnostics = createNormalizationDiagnosticsState(
      modId,
      registryKey
    );
  }

  _finalizeNormalizationDiagnostics(context = {}) {
    if (!this._normalizationDiagnostics) {
      return;
    }
    this._normalizationDiagnostics.sessionFinishedAt = Date.now();
    this._normalizationDiagnostics.context = {
      modId: context.modId || this._normalizationDiagnostics.modId || null,
      registryKey:
        context.registryKey ||
        this._normalizationDiagnostics.registryKey ||
        null,
      status: context.status || 'unknown',
      errorMessage: context.errorMessage || null,
      diagnosticsEnabled: this._shouldEmitNormalizationDiagnostics(),
    };

    const snapshot = cloneNormalizationDiagnostics(
      this._normalizationDiagnostics
    );
    this._lastNormalizationDiagnostics = snapshot;
    this._logger.info('goal-normalization.summary', snapshot);
  }

  _shouldEmitNormalizationDiagnostics() {
    return isNormalizationDiagnosticsEnabled();
  }

  _emitNormalizationDiagnosticsLogs(
    modId,
    filename,
    normalizationResult,
    allowDefaults
  ) {
    if (!this._shouldEmitNormalizationDiagnostics()) {
      return;
    }
    for (const mutation of normalizationResult.mutations || []) {
      this._logger.debug('goal-normalization.mutation', {
        modId,
        filename,
        allowDefaults,
        mutation,
      });
    }
    for (const warning of normalizationResult.warnings || []) {
      this._logger.debug('goal-normalization.warning', {
        modId,
        filename,
        allowDefaults,
        warning,
      });
    }
  }

  _recordNormalizationStats(
    modId,
    filename,
    normalizationResult,
    allowDefaults
  ) {
    if (!this._normalizationDiagnostics) {
      this._normalizationDiagnostics = createNormalizationDiagnosticsState(
        modId,
        null
      );
    }
    const stats = this._normalizationDiagnostics;
    stats.lastFile = filename;
    stats.lastModId = modId;
    stats.goalsProcessed += 1;
    const mutationCount = normalizationResult.mutations.length;
    const warningCount = normalizationResult.warnings.length;
    const diagnosticsEnabled = this._shouldEmitNormalizationDiagnostics();
    stats.diagnosticsEnabled = diagnosticsEnabled;

    if (mutationCount > 0) {
      stats.goalsWithMutations += 1;
      stats.totalMutations += mutationCount;
      stats.fieldsAutoFilled += countAutoFilledFields(
        normalizationResult.mutations
      );
      stats.lastMutation =
        normalizationResult.mutations[normalizationResult.mutations.length - 1];
    }

    if (warningCount > 0) {
      stats.warningsEmitted += warningCount;
      stats.lastWarning =
        normalizationResult.warnings[normalizationResult.warnings.length - 1];
    }

    this._emitNormalizationDiagnosticsLogs(
      modId,
      filename,
      normalizationResult,
      allowDefaults
    );
  }

  _recordNormalizationRejection(modId, filename) {
    if (!this._normalizationDiagnostics) {
      this._normalizationDiagnostics = createNormalizationDiagnosticsState(
        modId,
        null
      );
    }
    const stats = this._normalizationDiagnostics;
    stats.goalsRejected += 1;
    stats.lastFile = filename;
    stats.lastModId = modId;
  }

  async loadItemsForMod(
    modId,
    modManifest,
    contentKey,
    diskFolder,
    registryKey
  ) {
    this._resetNormalizationDiagnostics(modId, registryKey);
    try {
      const result = await super.loadItemsForMod(
        modId,
        modManifest,
        contentKey,
        diskFolder,
        registryKey
      );
      this._finalizeNormalizationDiagnostics({
        modId,
        registryKey,
        status: 'success',
      });
      return result;
    } catch (error) {
      this._finalizeNormalizationDiagnostics({
        modId,
        registryKey,
        status: 'error',
        errorMessage: error?.message || String(error),
      });
      throw error;
    }
  }

  getNormalizationDiagnosticsSnapshot() {
    const snapshot =
      cloneNormalizationDiagnostics(this._lastNormalizationDiagnostics) ||
      cloneNormalizationDiagnostics(this._normalizationDiagnostics);
    return snapshot;
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
    const allowDefaults = isPermissiveGoalLoaderMode();
    let normalizationResult;
    try {
      normalizationResult = normalizeGoalData(data, {
        modId,
        filename,
        logger: this._logger,
        allowDefaults,
      });
    } catch (error) {
      this._recordNormalizationRejection(modId, filename);
      throw error;
    }
    const normalizedData = normalizationResult.data;

    this._recordNormalizationStats(
      modId,
      filename,
      normalizationResult,
      allowDefaults
    );

    if (
      normalizationResult.mutations.length > 0 ||
      normalizationResult.warnings.length > 0
    ) {
      Object.defineProperty(normalizedData, '_normalization', {
        value: {
          mutations: normalizationResult.mutations,
          warnings: normalizationResult.warnings,
        },
        enumerable: false,
      });

      this._logger.debug('Applied goal normalization mutations.', {
        modId,
        filename,
        mutationCount: normalizationResult.mutations.length,
        warningCount: normalizationResult.warnings.length,
        allowDefaults,
        diagnosticsEnabled: this._shouldEmitNormalizationDiagnostics(),
      });
    }

    // Call parent implementation for standard processing
    const result = await super._processFetchedItem(
      modId,
      filename,
      resolvedPath,
      normalizedData,
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
   * Overrides primary schema validation to surface structured errors and
   * support the GOAL_LOADER_ALLOW_DEFAULTS feature flag.
   *
   * @param {object} data
   * @param {string} filename
   * @param {string} modId
   * @param {string} resolvedPath
   * @returns {import('../interfaces/coreServices.js').ValidationResult}
   */
  _validatePrimarySchema(data, filename, modId, resolvedPath) {
    const schemaId = this._primarySchemaId;
    const loaderName = this.constructor.name;

    if (!schemaId) {
      this._logger.debug(
        `${loaderName} [${modId}]: Skipping primary schema validation for '${filename}' as no primary schema ID is configured for this loader.`
      );
      return { isValid: true, errors: null };
    }

    let failureDetails = null;

    try {
      return validateAgainstSchema(
        this._schemaValidator,
        schemaId,
        data,
        this._logger,
        {
          validationDebugMessage: `${loaderName} [${modId}]: Validating '${filename}' against primary schema '${schemaId}'.`,
          notLoadedMessage: `${loaderName} [${modId}]: Rule schema '${schemaId}' is configured but not loaded. Skipping validation for ${filename}.`,
          notLoadedLogLevel: 'warn',
          skipIfSchemaNotLoaded: true,
          failureMessage: `${loaderName} [${modId}]: Primary schema validation failed for '${filename}' using schema '${schemaId}'.`,
          failureContext: { modId, filename, resolvedPath },
          failureThrowMessage: `${loaderName} [${modId}]: Primary schema validation failed for '${filename}' using schema '${schemaId}'.`,
          filePath: resolvedPath,
          onValidationFailure: ({ errors, errorDetails }) => {
            const firstError =
              Array.isArray(errors) && errors.length > 0 ? errors[0] : null;
            failureDetails = {
              errors,
              formattedErrors: errorDetails,
              schemaPath: firstError?.schemaPath || '',
              instancePath: firstError?.instancePath || '',
              keyword: firstError?.keyword || '',
              message: firstError?.message || 'Schema validation failed.',
            };
          },
        }
      );
    } catch (error) {
      if (isPermissiveGoalLoaderMode()) {
        this._logger.warn(
          `GoalLoader [${modId}]: Schema validation failed for '${filename}' but GOAL_LOADER_ALLOW_DEFAULTS is enabled. Continuing load.`,
          {
            modId,
            filename,
            schemaId,
            schemaPath: failureDetails?.schemaPath || '',
            instancePath: failureDetails?.instancePath || '',
            keyword: failureDetails?.keyword || '',
            validationMessage: failureDetails?.message || error.message,
          }
        );
        return { isValid: false, errors: failureDetails?.errors || null };
      }

      throw this._createGoalSchemaError(
        error,
        schemaId,
        data,
        modId,
        filename,
        resolvedPath,
        failureDetails
      );
    }
  }

  _createGoalSchemaError(
    originalError,
    schemaId,
    data,
    modId,
    filename,
    resolvedPath,
    failureDetails
  ) {
    const snippet = formatDataSnippet(
      getValueAtPointer(data, failureDetails?.instancePath || '')
    );

    return new ModValidationError(
      failureDetails?.message ||
        originalError.message ||
        'Goal schema validation failed.',
      GOAL_SCHEMA_ERROR_CODE,
      {
        modId,
        filename,
        resolvedPath,
        schemaId,
        schemaPath: failureDetails?.schemaPath || '',
        instancePath: failureDetails?.instancePath || '',
        keyword: failureDetails?.keyword || '',
        validationErrors: failureDetails?.errors || null,
        dataSnippet: snippet,
      },
      false
    );
  }
}

export default GoalLoader;
