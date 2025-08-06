/**
 * @file TraceConfigLoader class for loading trace analysis configuration
 * @see loggerConfigLoader.js
 */

import { fetchWithRetry } from '../utils/index.js';
import { isNonBlankString } from '../utils/textUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} TraceConfigurationFile
 * @description Represents the structure of the trace-config.json file.
 * @property {boolean} [traceAnalysisEnabled] - Whether trace analysis tools should be enabled
 * @property {object} [performanceMonitoring] - Performance monitoring configuration
 * @property {boolean} [performanceMonitoring.enabled] - Whether performance monitoring is enabled
 * @property {object} [performanceMonitoring.thresholds] - Performance thresholds
 * @property {number} [performanceMonitoring.thresholds.slowOperationMs] - Slow operation threshold
 * @property {number} [performanceMonitoring.thresholds.criticalOperationMs] - Critical operation threshold
 * @property {number} [performanceMonitoring.thresholds.maxConcurrency] - Maximum concurrency threshold
 * @property {number} [performanceMonitoring.thresholds.maxTotalDurationMs] - Maximum total duration threshold
 * @property {number} [performanceMonitoring.thresholds.maxErrorRate] - Maximum error rate percentage
 * @property {number} [performanceMonitoring.thresholds.maxMemoryUsageMB] - Maximum memory usage in MB
 * @property {object} [performanceMonitoring.sampling] - Sampling configuration
 * @property {number} [performanceMonitoring.sampling.rate] - Sampling rate (0.0-1.0)
 * @property {string} [performanceMonitoring.sampling.strategy] - Sampling strategy
 * @property {boolean} [performanceMonitoring.sampling.alwaysSampleErrors] - Always sample errors
 * @property {boolean} [performanceMonitoring.sampling.alwaysSampleSlow] - Always sample slow operations
 * @property {number} [performanceMonitoring.sampling.slowThresholdMs] - Slow threshold for sampling
 * @property {object} [visualization] - Visualization configuration
 * @property {boolean} [visualization.enabled] - Whether visualization is enabled
 * @property {object} [visualization.options] - Visualization options
 * @property {boolean} [visualization.options.showAttributes] - Show span attributes
 * @property {boolean} [visualization.options.showTimings] - Show timing information
 * @property {boolean} [visualization.options.showErrors] - Show error details
 * @property {boolean} [visualization.options.showCriticalPath] - Highlight critical path
 * @property {number} [visualization.options.maxDepth] - Maximum depth to display (0 = no limit)
 * @property {number} [visualization.options.minDuration] - Minimum duration to display
 * @property {boolean} [visualization.options.colorsEnabled] - Enable ANSI colors
 * @property {object} [analysis] - Analysis configuration
 * @property {boolean} [analysis.enabled] - Whether analysis is enabled
 * @property {number} [analysis.bottleneckThresholdMs] - Bottleneck detection threshold
 * @property {object} [actionTracing] - Action tracing configuration
 * @property {boolean} [actionTracing.enabled] - Enable or disable action tracing globally
 * @property {string[]} [actionTracing.tracedActions] - Action IDs to trace
 * @property {string} [actionTracing.outputDirectory] - Directory for trace output files
 * @property {string} [actionTracing.verbosity] - Level of detail in traces
 * @property {boolean} [actionTracing.includeComponentData] - Include component data in traces
 * @property {boolean} [actionTracing.includePrerequisites] - Include prerequisite evaluation details
 * @property {boolean} [actionTracing.includeTargets] - Include target resolution details
 * @property {number} [actionTracing.maxTraceFiles] - Maximum number of trace files to keep
 * @property {string} [actionTracing.rotationPolicy] - How to rotate old trace files
 * @property {number} [actionTracing.maxFileAge] - Maximum age of trace files in seconds
 */

/**
 * @typedef {object} LoadTraceConfigErrorResult
 * @description Represents the structure of a failed trace configuration load attempt.
 * @property {true} error - Indicates an error occurred
 * @property {string} message - A description of the error
 * @property {string} [stage] - The stage where the error occurred
 * @property {Error} [originalError] - The original error object, if any
 * @property {string} [path] - The file path that was attempted
 */

/**
 * @class TraceConfigLoader
 * @description Service responsible for loading and parsing the trace-config.json file.
 * It fetches the configuration file, typically served as a static asset.
 */
export class TraceConfigLoader {
  /**
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * @private
   * @type {string} - Default path to the trace configuration file
   */
  #defaultConfigPath = 'config/trace-config.json';

  /**
   * @private
   * @type {number}
   */
  #defaultMaxRetries = 2;

  /**
   * @private
   * @type {number}
   */
  #defaultBaseDelayMs = 300;

  /**
   * @private
   * @type {number}
   */
  #defaultMaxDelayMs = 1000;

  /** @type {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #safeEventDispatcher;

  /**
   * Creates an instance of TraceConfigLoader.
   *
   * @param {object} [dependencies] - Optional dependencies
   * @param {ILogger} [dependencies.logger] - An optional logger instance
   * @param {string} [dependencies.configPath] - Optional override for the config file path
   * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dependencies.safeEventDispatcher - Event dispatcher
   */
  constructor(dependencies = {}) {
    // Use the provided logger, or fallback to console
    this.#logger = dependencies.logger || console;

    if (
      !dependencies.safeEventDispatcher ||
      typeof dependencies.safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'TraceConfigLoader requires a valid ISafeEventDispatcher instance.'
      );
    }
    this.#safeEventDispatcher = dependencies.safeEventDispatcher;

    if (
      dependencies.configPath &&
      typeof dependencies.configPath === 'string'
    ) {
      this.#defaultConfigPath = dependencies.configPath;
    }
  }

  /**
   * Loads and parses the trace configuration file from the specified path,
   * or a default path if none is provided.
   *
   * @async
   * @param {string} [filePath] - The path to the trace-config.json file
   * @returns {Promise<TraceConfigurationFile | LoadTraceConfigErrorResult>} The parsed configuration or error
   */
  async loadConfig(filePath) {
    const path = isNonBlankString(filePath)
      ? filePath.trim()
      : this.#defaultConfigPath;

    // Safe logging methods
    const logError = (msg, ...args) =>
      this.#logger.error
        ? this.#logger.error(msg, ...args)
        : console.error(msg, ...args);
    const logWarn = (msg, ...args) =>
      this.#logger.warn
        ? this.#logger.warn(msg, ...args)
        : console.warn(msg, ...args);
    const logDebug = (msg, ...args) =>
      this.#logger.debug
        ? this.#logger.debug(msg, ...args)
        : console.debug(msg, ...args);

    let parsedResponse;
    try {
      logDebug(`[TraceConfigLoader] Loading trace configuration from ${path}`);

      parsedResponse = await fetchWithRetry(
        path,
        { method: 'GET', headers: { Accept: 'application/json' } },
        this.#defaultMaxRetries,
        this.#defaultBaseDelayMs,
        this.#defaultMaxDelayMs,
        this.#safeEventDispatcher,
        this.#logger
      );

      if (typeof parsedResponse !== 'object' || parsedResponse === null) {
        logWarn(
          `[TraceConfigLoader] Configuration file from ${path} is malformed (not an object). Content:`,
          parsedResponse
        );
        return {
          error: true,
          message: `Configuration file from ${path} is malformed. Ensure it's valid JSON.`,
          stage: 'validation',
          path: path,
        };
      }

      if (Object.keys(parsedResponse).length === 0) {
        // Return empty object, indicates no specific configuration found but file was parsable
        return {};
      }

      // Validate configuration structure
      const validationResult = this.#validateConfiguration(
        parsedResponse,
        path
      );
      if (validationResult.error) {
        logWarn(
          `[TraceConfigLoader] Configuration validation failed: ${validationResult.message}`
        );
        return validationResult;
      }

      logDebug(
        `[TraceConfigLoader] Configuration loaded successfully. Trace analysis enabled: ${parsedResponse.traceAnalysisEnabled}`
      );

      return /** @type {TraceConfigurationFile} */ (parsedResponse);
    } catch (error) {
      // Errors from fetchWithRetry (fetch/parse failures)
      logError(
        `[TraceConfigLoader] Failed to load or parse trace configuration from ${path}. Error: ${error.message}`,
        {
          path,
          originalError: {
            message: error.message,
            name: error.name,
            stack: error.stack,
          },
        }
      );

      let stage = 'fetch_or_parse';
      if (error.message) {
        const lowerMsg = error.message.toLowerCase();
        if (
          lowerMsg.includes('json') ||
          lowerMsg.includes('parse') ||
          lowerMsg.includes('token')
        ) {
          stage = 'parse';
        } else if (
          lowerMsg.includes('failed to fetch') ||
          lowerMsg.includes('network') ||
          lowerMsg.includes('not found') ||
          lowerMsg.includes('status')
        ) {
          stage = 'fetch';
        }
      }

      return {
        error: true,
        message: `Failed to load or parse trace configuration from ${path}: ${error.message}`,
        stage: stage,
        originalError: error,
        path: path,
      };
    }
  }

  /**
   * Check if any tracing feature is enabled
   *
   * @returns {Promise<boolean>}
   */
  async isAnyTracingEnabled() {
    const config = await this.loadConfig();

    // Handle error results
    if (config.error) {
      return false;
    }

    return (
      config.traceAnalysisEnabled ||
      config.performanceMonitoring?.enabled ||
      config.visualization?.enabled ||
      config.analysis?.enabled ||
      config.actionTracing?.enabled
    );
  }

  /**
   * Get action tracing configuration
   *
   * @returns {Promise<object | null>}
   */
  async getActionTracingConfig() {
    const config = await this.loadConfig();

    // Handle error results
    if (config.error) {
      return null;
    }

    return config.actionTracing || null;
  }

  /**
   * Validates the configuration structure
   *
   * @private
   * @param {any} config - Configuration to validate
   * @param {string} path - File path for error messages
   * @returns {LoadTraceConfigErrorResult | {error: false}} Validation result
   */
  #validateConfiguration(config, path) {
    // Validate traceAnalysisEnabled
    if (
      config.traceAnalysisEnabled !== undefined &&
      typeof config.traceAnalysisEnabled !== 'boolean'
    ) {
      return {
        error: true,
        message: `'traceAnalysisEnabled' in ${path} must be a boolean. Found: ${typeof config.traceAnalysisEnabled}.`,
        stage: 'validation',
        path: path,
      };
    }

    // Validate performanceMonitoring if present
    if (config.performanceMonitoring !== undefined) {
      if (typeof config.performanceMonitoring !== 'object') {
        return {
          error: true,
          message: `'performanceMonitoring' in ${path} must be an object.`,
          stage: 'validation',
          path: path,
        };
      }

      // Validate thresholds if present
      if (config.performanceMonitoring.thresholds !== undefined) {
        const thresholds = config.performanceMonitoring.thresholds;
        const numericThresholds = [
          'slowOperationMs',
          'criticalOperationMs',
          'maxConcurrency',
          'maxTotalDurationMs',
          'maxErrorRate',
          'maxMemoryUsageMB',
        ];

        for (const field of numericThresholds) {
          if (
            thresholds[field] !== undefined &&
            (typeof thresholds[field] !== 'number' || thresholds[field] < 0)
          ) {
            return {
              error: true,
              message: `'performanceMonitoring.thresholds.${field}' must be a non-negative number.`,
              stage: 'validation',
              path: path,
            };
          }
        }
      }

      // Validate sampling if present
      if (config.performanceMonitoring.sampling !== undefined) {
        const sampling = config.performanceMonitoring.sampling;

        if (
          sampling.rate !== undefined &&
          (typeof sampling.rate !== 'number' ||
            sampling.rate < 0 ||
            sampling.rate > 1)
        ) {
          return {
            error: true,
            message: `'performanceMonitoring.sampling.rate' must be a number between 0 and 1.`,
            stage: 'validation',
            path: path,
          };
        }

        if (
          sampling.strategy !== undefined &&
          !['random', 'adaptive', 'error_biased'].includes(sampling.strategy)
        ) {
          return {
            error: true,
            message: `'performanceMonitoring.sampling.strategy' must be one of: random, adaptive, error_biased.`,
            stage: 'validation',
            path: path,
          };
        }
      }
    }

    return { error: false };
  }
}

export default TraceConfigLoader;
