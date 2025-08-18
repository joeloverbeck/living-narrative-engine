/**
 * @file Tracing Configuration Initializer
 * @description Coordinates the initialization and configuration of the action tracing system
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Coordinates initialization of the action tracing system with proper configuration loading
 * Implements the initializableSystem interface for automatic startup
 */
class TracingConfigurationInitializer {
  #configLoader;
  #actionTraceFilter;
  #actionTraceOutputService;
  #logger;
  #isInitialized = false;
  #initializationPromise = null;

  /**
   * @param {object} dependencies
   * @param {object} dependencies.configLoader - Action trace configuration loader
   * @param {object} dependencies.actionTraceFilter - Action trace filter to configure
   * @param {object} dependencies.actionTraceOutputService - Output service to configure
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({
    configLoader,
    actionTraceFilter,
    actionTraceOutputService,
    logger,
  }) {
    validateDependency(configLoader, 'IActionTraceConfigLoader', null, {
      requiredMethods: ['loadConfig', 'isEnabled', 'getOutputDirectory'],
    });
    validateDependency(actionTraceFilter, 'IActionTraceFilter', null, {
      requiredMethods: ['updateFromConfig', 'isEnabled'],
    });

    this.#logger = ensureValidLogger(logger, 'TracingConfigurationInitializer');
    this.#configLoader = configLoader;
    this.#actionTraceFilter = actionTraceFilter;
    this.#actionTraceOutputService = actionTraceOutputService;
  }

  /**
   * Initialize the tracing system with configuration
   *
   * @returns {Promise<InitializationResult>}
   */
  async initialize() {
    // Return existing promise if already initializing
    if (this.#initializationPromise) {
      return this.#initializationPromise;
    }

    // Return success if already initialized
    if (this.#isInitialized) {
      return { success: true, message: 'Already initialized' };
    }

    this.#initializationPromise = this.#performInitialization();
    return this.#initializationPromise;
  }

  /**
   * Perform the actual initialization
   *
   * @private
   * @returns {Promise<InitializationResult>}
   */
  async #performInitialization() {
    const startTime = Date.now();
    this.#logger.info(
      'TracingConfigurationInitializer: Starting initialization...'
    );

    try {
      // Step 1: Load trace configuration
      this.#logger.debug('Loading trace configuration...');
      const config = await this.#configLoader.loadConfig();

      if (!config) {
        throw new Error('Configuration loading returned null or undefined');
      }

      this.#logger.debug('Trace configuration loaded', {
        enabled: config.enabled,
        tracedActionsCount: Array.isArray(config.tracedActions)
          ? config.tracedActions.length
          : 0,
        outputDirectory: config.outputDirectory,
        verbosity: config.verbosity,
      });

      // Step 2: Update filter with configuration
      this.#logger.debug('Updating ActionTraceFilter with configuration...');
      this.#actionTraceFilter.updateFromConfig(config);

      // Step 3: Log final configuration status
      const filterSummary = this.#actionTraceFilter.getConfigurationSummary();
      this.#logger.info('ActionTraceFilter configured', filterSummary);

      // Step 4: Configure output service for file output if needed
      if (
        config.enabled &&
        this.#actionTraceOutputService &&
        config.outputDirectory
      ) {
        this.#logger.debug(
          'Configuring trace output service for file output...',
          {
            outputDirectory: config.outputDirectory,
          }
        );

        // Enable file output with the configured directory
        const fileOutputEnabled =
          this.#actionTraceOutputService.enableFileOutput(
            config.outputDirectory
          );
        if (fileOutputEnabled) {
          this.#logger.info('File output configured successfully', {
            outputDirectory: config.outputDirectory,
          });
        } else {
          this.#logger.warn(
            'Failed to configure file output, traces will use IndexedDB'
          );
        }
      }

      const duration = Date.now() - startTime;
      this.#isInitialized = true;

      // Perform post-initialization validation and diagnostics
      const diagnosis = await this.validateAndDiagnose();

      const result = {
        success: true,
        message: `Tracing system initialized successfully in ${duration}ms`,
        config: {
          enabled: config.enabled,
          tracedActions: config.tracedActions,
          outputDirectory: config.outputDirectory,
          verbosity: config.verbosity,
        },
        diagnostics: diagnosis,
        initializationTime: duration,
      };

      if (diagnosis.configurationValid) {
        // Check if this is a pre-configured but disabled state
        if (!config.enabled && config.tracedActions?.length > 0) {
          this.#logger.info(
            'TracingConfigurationInitializer: Initialization complete - tracing pre-configured but disabled',
            result
          );
        } else {
          this.#logger.info(
            'TracingConfigurationInitializer: Initialization complete and validated',
            result
          );
        }
      } else {
        this.#logger.warn(
          'TracingConfigurationInitializer: Initialization complete but configuration has issues',
          {
            ...result,
            issues: diagnosis.issues,
            recommendations: diagnosis.recommendations,
          }
        );
      }

      // Clear the promise after successful initialization so subsequent calls
      // can return "Already initialized" message
      this.#initializationPromise = null;

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result = {
        success: false,
        message: `Tracing initialization failed after ${duration}ms: ${error.message}`,
        error: error.message,
        initializationTime: duration,
      };

      this.#logger.error(
        'TracingConfigurationInitializer: Initialization failed',
        result
      );

      // Reset promise so initialization can be retried
      this.#initializationPromise = null;

      return result;
    }
  }

  /**
   * Validate current configuration and provide diagnostics
   *
   * @returns {Promise<object>} Validation result with diagnostics
   */
  async validateAndDiagnose() {
    const diagnosis = {
      timestamp: new Date().toISOString(),
      configurationValid: false,
      issues: [],
      recommendations: [],
      status: {},
    };

    try {
      // Check if config can be loaded
      const config = await this.#configLoader.loadConfig();
      if (!config) {
        diagnosis.issues.push(
          'Configuration loading returned null or undefined'
        );
        diagnosis.recommendations.push(
          'Check if config/trace-config.json exists and is valid JSON'
        );
        return diagnosis;
      }

      diagnosis.status.configLoaded = true;
      diagnosis.status.enabled = config.enabled;
      diagnosis.status.tracedActions = config.tracedActions;
      diagnosis.status.outputDirectory = config.outputDirectory;

      // Validate filter configuration
      const filterSummary = this.#actionTraceFilter.getConfigurationSummary();
      diagnosis.status.filterConfigured = filterSummary.enabled;
      diagnosis.status.filterTracedActionCount =
        filterSummary.tracedActionCount;

      // Check for common issues
      // Note: Having tracedActions configured while disabled is valid -
      // allows pre-configuration for intermittent debugging
      if (config.enabled) {
        // Only check for missing configuration when tracing is enabled
        if (
          !Array.isArray(config.tracedActions) ||
          config.tracedActions.length === 0
        ) {
          diagnosis.issues.push(
            'Tracing is enabled but no actions configured for tracing'
          );
          diagnosis.recommendations.push(
            'Add action IDs to "tracedActions" array in configuration (e.g., ["*"] for all actions)'
          );
        }

        if (!config.outputDirectory) {
          diagnosis.issues.push(
            'Tracing is enabled but no output directory specified'
          );
          diagnosis.recommendations.push(
            'Set "outputDirectory" in configuration to specify where trace files should be saved'
          );
        }
      }

      // Check if filter matches config
      if (config.enabled !== filterSummary.enabled) {
        diagnosis.issues.push(
          'Filter enabled state does not match configuration'
        );
        diagnosis.recommendations.push(
          'Restart the application or reload configuration'
        );
      }

      // Mark as valid if no critical issues
      diagnosis.configurationValid = diagnosis.issues.length === 0;

      // Log diagnostics
      if (diagnosis.configurationValid) {
        // Log appropriate message based on enabled state
        if (!config.enabled && config.tracedActions?.length > 0) {
          this.#logger.info('Tracing configuration ready but disabled', {
            enabled: config.enabled,
            tracedActionsConfigured: config.tracedActions?.length || 0,
            outputDirectory: config.outputDirectory,
            note: 'Tracing is pre-configured but disabled. Set enabled:true to activate.',
          });
        } else {
          this.#logger.info('Tracing configuration validation passed', {
            enabled: config.enabled,
            tracedActionsCount: config.tracedActions?.length || 0,
            outputDirectory: config.outputDirectory,
            filterConfigured: filterSummary.enabled,
          });
        }
      } else {
        this.#logger.warn('Tracing configuration validation found issues', {
          issueCount: diagnosis.issues.length,
          issues: diagnosis.issues,
          recommendations: diagnosis.recommendations,
        });
      }

      return diagnosis;
    } catch (error) {
      diagnosis.issues.push(
        `Configuration validation failed: ${error.message}`
      );
      diagnosis.recommendations.push(
        'Check logs for detailed error information'
      );

      this.#logger.error('Tracing configuration validation error', error);
      return diagnosis;
    }
  }

  /**
   * Check if the tracing system has been initialized
   *
   * @returns {boolean}
   */
  isInitialized() {
    return this.#isInitialized;
  }

  /**
   * Get current tracing configuration status
   *
   * @returns {Promise<object>} Configuration status
   */
  async getStatus() {
    try {
      const config = await this.#configLoader.loadConfig();
      const filterSummary = this.#actionTraceFilter.getConfigurationSummary();

      return {
        initialized: this.#isInitialized,
        configLoaded: !!config,
        enabled: config?.enabled || false,
        filterConfigured: filterSummary.enabled,
        tracedActions: filterSummary.tracedActions,
        outputDirectory: config?.outputDirectory,
        verbosity: config?.verbosity,
      };
    } catch (error) {
      this.#logger.error('Failed to get tracing status', error);
      return {
        initialized: this.#isInitialized,
        configLoaded: false,
        enabled: false,
        error: error.message,
      };
    }
  }

  /**
   * Reload configuration and update all components
   *
   * @returns {Promise<InitializationResult>}
   */
  async reloadConfiguration() {
    this.#logger.info(
      'TracingConfigurationInitializer: Reloading configuration...'
    );

    try {
      // Force reload of configuration
      const config = await this.#configLoader.reloadConfig();

      // Update filter with new configuration
      this.#actionTraceFilter.updateFromConfig(config);

      this.#logger.info('Configuration reloaded successfully');
      return {
        success: true,
        message: 'Configuration reloaded successfully',
        config: {
          enabled: config.enabled,
          tracedActions: config.tracedActions,
          outputDirectory: config.outputDirectory,
          verbosity: config.verbosity,
        },
      };
    } catch (error) {
      this.#logger.error('Failed to reload configuration', error);
      return {
        success: false,
        message: `Failed to reload configuration: ${error.message}`,
        error: error.message,
      };
    }
  }
}

export default TracingConfigurationInitializer;
