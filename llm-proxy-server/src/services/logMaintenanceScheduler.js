/**
 * @file Log maintenance scheduler service for automated file rotation and cleanup
 * @description Provides cron-based scheduling for existing LogStorageService maintenance operations
 * @see logStorageService.js, server.js
 */

import cron from 'node-cron';
import { ensureValidLogger } from '../utils/loggerUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {import('./logStorageService.js').default} LogStorageService
 */

/**
 * @typedef {import('../config/appConfig.js').AppConfigService} AppConfigService
 */

/**
 * @typedef {object} SchedulerConfig
 * @description Configuration for log maintenance scheduler
 * @property {boolean} enabled - Enable/disable scheduler
 * @property {string} rotationCheckSchedule - Cron expression for rotation checks
 * @property {string} cleanupSchedule - Cron expression for cleanup operations
 * @property {boolean} enableRetry - Enable retry logic for failed operations
 * @property {number} maxRetries - Maximum number of retries for failed operations
 * @property {number} retryDelayMs - Delay between retries in milliseconds
 */

/**
 * Default scheduler configuration
 */
const DEFAULT_SCHEDULER_CONFIG = {
  enabled: true,
  rotationCheckSchedule: '0 * * * *', // Every hour at minute 0
  cleanupSchedule: '0 2 * * *', // Daily at 2:00 AM
  enableRetry: true,
  maxRetries: 3,
  retryDelayMs: 5000, // 5 seconds
};

/**
 * Log maintenance scheduler service for automated file rotation and cleanup
 */
class LogMaintenanceScheduler {
  /** @type {ILogger} */
  #logger;

  /** @type {LogStorageService} */
  #logStorageService;

  /** @type {SchedulerConfig} */
  #config;

  /** @type {cron.ScheduledTask|null} */
  #rotationTask;

  /** @type {cron.ScheduledTask|null} */
  #cleanupTask;

  /** @type {boolean} */
  #isRunning;

  /** @type {Map<string, number>} */
  #retryCounters;

  /** @type {boolean} */
  #rotationTaskRunning;

  /** @type {boolean} */
  #cleanupTaskRunning;

  /**
   * Creates a new LogMaintenanceScheduler instance
   * @param {ILogger} logger - Logger instance for service logging
   * @param {LogStorageService} logStorageService - Log storage service for maintenance operations
   * @param {AppConfigService|Partial<SchedulerConfig>} [configOrAppConfig] - AppConfigService instance or scheduler config
   */
  constructor(logger, logStorageService, configOrAppConfig = {}) {
    this.#logger = ensureValidLogger(logger, 'LogMaintenanceScheduler');

    if (!logStorageService) {
      throw new Error('LogStorageService is required');
    }
    this.#logStorageService = logStorageService;

    this.#rotationTask = null;
    this.#cleanupTask = null;
    this.#isRunning = false;
    this.#retryCounters = new Map();
    this.#rotationTaskRunning = false;
    this.#cleanupTaskRunning = false;

    // Determine configuration source
    if (
      configOrAppConfig &&
      typeof configOrAppConfig.getDebugLoggingConfig === 'function'
    ) {
      // Using AppConfigService
      const debugConfig = configOrAppConfig.getDebugLoggingConfig();
      const schedulerConfig = debugConfig.scheduler || {};

      this.#config = {
        enabled: schedulerConfig.enabled !== false, // Default to true
        rotationCheckSchedule:
          schedulerConfig.rotationCheckSchedule ||
          DEFAULT_SCHEDULER_CONFIG.rotationCheckSchedule,
        cleanupSchedule:
          schedulerConfig.cleanupSchedule ||
          DEFAULT_SCHEDULER_CONFIG.cleanupSchedule,
        enableRetry: schedulerConfig.enableRetry !== false, // Default to true
        maxRetries:
          schedulerConfig.maxRetries || DEFAULT_SCHEDULER_CONFIG.maxRetries,
        retryDelayMs:
          schedulerConfig.retryDelayMs || DEFAULT_SCHEDULER_CONFIG.retryDelayMs,
      };

      this.#logger.debug(
        'LogMaintenanceScheduler: Initialized with AppConfigService',
        {
          config: this.#config,
          debugLoggingEnabled: configOrAppConfig.isDebugLoggingEnabled(),
        }
      );
    } else {
      // Legacy configuration object
      this.#config = { ...DEFAULT_SCHEDULER_CONFIG, ...configOrAppConfig };
      this.#logger.debug(
        'LogMaintenanceScheduler: Initialized with config object',
        {
          config: this.#config,
        }
      );
    }

    // Validate cron expressions
    this.#validateCronExpressions();
  }

  /**
   * Starts the scheduled maintenance tasks
   * @returns {Promise<void>}
   */
  async start() {
    if (this.#isRunning) {
      this.#logger.warn(
        'LogMaintenanceScheduler.start: Scheduler already running'
      );
      return;
    }

    if (!this.#config.enabled) {
      this.#logger.info('LogMaintenanceScheduler.start: Scheduler is disabled');
      return;
    }

    try {
      this.#logger.info(
        'LogMaintenanceScheduler.start: Starting maintenance scheduler'
      );

      // Schedule rotation checks
      await this.#scheduleRotationChecks();

      // Schedule cleanup tasks
      await this.#scheduleCleanupTasks();

      this.#isRunning = true;

      this.#logger.info(
        'LogMaintenanceScheduler.start: Maintenance scheduler started successfully',
        {
          rotationSchedule: this.#config.rotationCheckSchedule,
          cleanupSchedule: this.#config.cleanupSchedule,
        }
      );
    } catch (error) {
      this.#logger.error(
        'LogMaintenanceScheduler.start: Failed to start scheduler',
        {
          error: error.message,
          stack: error.stack,
        }
      );
      throw error;
    }
  }

  /**
   * Stops all scheduled maintenance tasks
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.#isRunning) {
      this.#logger.debug('LogMaintenanceScheduler.stop: Scheduler not running');
      return;
    }

    this.#logger.info(
      'LogMaintenanceScheduler.stop: Stopping maintenance scheduler'
    );

    try {
      // Stop rotation task
      if (this.#rotationTask) {
        this.#rotationTask.stop();
        this.#rotationTask = null;
        this.#rotationTaskRunning = false;
      }

      // Stop cleanup task
      if (this.#cleanupTask) {
        this.#cleanupTask.stop();
        this.#cleanupTask = null;
        this.#cleanupTaskRunning = false;
      }

      this.#isRunning = false;
      this.#retryCounters.clear();

      this.#logger.info(
        'LogMaintenanceScheduler.stop: Maintenance scheduler stopped successfully'
      );
    } catch (error) {
      this.#logger.error(
        'LogMaintenanceScheduler.stop: Error stopping scheduler',
        {
          error: error.message,
        }
      );
      // Don't throw - we want shutdown to continue
    }
  }

  /**
   * Gets the current status of the scheduler
   * @returns {object} Scheduler status information
   */
  getStatus() {
    return {
      isRunning: this.#isRunning,
      isEnabled: this.#config.enabled,
      rotationTaskActive: this.#rotationTaskRunning,
      cleanupTaskActive: this.#cleanupTaskRunning,
      retryCounters: Object.fromEntries(this.#retryCounters),
    };
  }

  /**
   * Validates cron expressions in configuration
   * @private
   * @throws {Error} If cron expressions are invalid
   */
  #validateCronExpressions() {
    try {
      if (!cron.validate(this.#config.rotationCheckSchedule)) {
        throw new Error(
          `Invalid rotation check cron expression: ${this.#config.rotationCheckSchedule}`
        );
      }

      if (!cron.validate(this.#config.cleanupSchedule)) {
        throw new Error(
          `Invalid cleanup cron expression: ${this.#config.cleanupSchedule}`
        );
      }

      this.#logger.debug(
        'LogMaintenanceScheduler: Cron expressions validated successfully'
      );
    } catch (error) {
      this.#logger.error(
        'LogMaintenanceScheduler: Invalid cron expression configuration',
        {
          error: error.message,
          rotationSchedule: this.#config.rotationCheckSchedule,
          cleanupSchedule: this.#config.cleanupSchedule,
        }
      );
      throw error;
    }
  }

  /**
   * Sets up scheduled rotation checks
   * @private
   * @returns {Promise<void>}
   */
  async #scheduleRotationChecks() {
    try {
      this.#rotationTask = cron.schedule(
        this.#config.rotationCheckSchedule,
        async () => {
          await this.#runRotationCheck();
        },
        {
          scheduled: false, // Don't start immediately
          timezone: 'UTC',
        }
      );

      this.#rotationTask.start();
      this.#rotationTaskRunning = true;

      this.#logger.debug('LogMaintenanceScheduler: Rotation checks scheduled', {
        schedule: this.#config.rotationCheckSchedule,
      });
    } catch (error) {
      this.#logger.error(
        'LogMaintenanceScheduler: Failed to schedule rotation checks',
        {
          error: error.message,
          schedule: this.#config.rotationCheckSchedule,
        }
      );
      throw error;
    }
  }

  /**
   * Sets up scheduled cleanup tasks
   * @private
   * @returns {Promise<void>}
   */
  async #scheduleCleanupTasks() {
    try {
      this.#cleanupTask = cron.schedule(
        this.#config.cleanupSchedule,
        async () => {
          await this.#runCleanup();
        },
        {
          scheduled: false, // Don't start immediately
          timezone: 'UTC',
        }
      );

      this.#cleanupTask.start();
      this.#cleanupTaskRunning = true;

      this.#logger.debug('LogMaintenanceScheduler: Cleanup tasks scheduled', {
        schedule: this.#config.cleanupSchedule,
      });
    } catch (error) {
      this.#logger.error(
        'LogMaintenanceScheduler: Failed to schedule cleanup tasks',
        {
          error: error.message,
          schedule: this.#config.cleanupSchedule,
        }
      );
      throw error;
    }
  }

  /**
   * Executes rotation check using LogStorageService
   * @private
   * @returns {Promise<void>}
   */
  async #runRotationCheck() {
    const operationId = 'rotation';

    try {
      this.#logger.debug(
        'LogMaintenanceScheduler: Starting scheduled rotation check'
      );

      const rotatedCount = await this.#logStorageService.rotateLargeFiles();

      this.#logger.info(
        `LogMaintenanceScheduler: Scheduled rotation check completed`,
        {
          rotatedFiles: rotatedCount,
        }
      );

      // Reset retry counter on success
      this.#retryCounters.delete(operationId);
    } catch (error) {
      this.#logger.error(
        'LogMaintenanceScheduler: Scheduled rotation check failed',
        {
          error: error.message,
          stack: error.stack,
        }
      );

      await this.#handleOperationFailure(operationId, error, () =>
        this.#runRotationCheck()
      );
    }
  }

  /**
   * Executes cleanup using LogStorageService
   * @private
   * @returns {Promise<void>}
   */
  async #runCleanup() {
    const operationId = 'cleanup';

    try {
      this.#logger.debug('LogMaintenanceScheduler: Starting scheduled cleanup');

      const cleanedCount = await this.#logStorageService.cleanupOldLogs();

      this.#logger.info(
        `LogMaintenanceScheduler: Scheduled cleanup completed`,
        {
          cleanedDirectories: cleanedCount,
        }
      );

      // Reset retry counter on success
      this.#retryCounters.delete(operationId);
    } catch (error) {
      this.#logger.error('LogMaintenanceScheduler: Scheduled cleanup failed', {
        error: error.message,
        stack: error.stack,
      });

      await this.#handleOperationFailure(operationId, error, () =>
        this.#runCleanup()
      );
    }
  }

  /**
   * Handles operation failures with retry logic
   * @private
   * @param {string} operationId - Unique identifier for the operation
   * @param {Error} error - The error that occurred
   * @param {Function} retryFunction - Function to retry the operation
   * @returns {Promise<void>}
   */
  async #handleOperationFailure(operationId, error, retryFunction) {
    if (!this.#config.enableRetry) {
      this.#logger.warn(
        `LogMaintenanceScheduler: Retry disabled for failed ${operationId} operation`,
        { error: error.message }
      );
      return;
    }

    const currentRetries = this.#retryCounters.get(operationId) || 0;

    if (currentRetries >= this.#config.maxRetries) {
      this.#logger.error(
        `LogMaintenanceScheduler: Maximum retries exceeded for ${operationId} operation`,
        {
          error: error.message,
          retries: currentRetries,
          maxRetries: this.#config.maxRetries,
        }
      );
      return;
    }

    this.#retryCounters.set(operationId, currentRetries + 1);

    this.#logger.warn(
      `LogMaintenanceScheduler: Scheduling retry for ${operationId} operation`,
      {
        error: error.message,
        retryAttempt: currentRetries + 1,
        maxRetries: this.#config.maxRetries,
        delayMs: this.#config.retryDelayMs,
      }
    );

    // Schedule retry after delay
    setTimeout(async () => {
      try {
        await retryFunction();
      } catch (retryError) {
        this.#logger.error(
          `LogMaintenanceScheduler: Retry failed for ${operationId} operation`,
          {
            error: retryError.message,
            retryAttempt: this.#retryCounters.get(operationId),
          }
        );
      }
    }, this.#config.retryDelayMs);
  }
}

export default LogMaintenanceScheduler;
