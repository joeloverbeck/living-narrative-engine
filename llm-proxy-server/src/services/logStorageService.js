/**
 * @file Log storage service for handling file-based persistence of debug logs
 * @description Provides JSONL format storage with date-based organization and category detection
 * @see debugLogController.js, responseUtils.js
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import { parseFileSize } from '../config/debugLogConfigValidator.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {import('../config/appConfig.js').AppConfigService} AppConfigService
 */

/**
 * @typedef {object} LogStorageConfig
 * @description Configuration for log storage service
 * @property {string} baseLogPath - Base directory for log files
 * @property {number} retentionDays - Number of days to retain logs
 * @property {number} maxFileSizeMB - Maximum file size in MB before rotation
 * @property {number} writeBufferSize - Number of logs to buffer before writing
 * @property {number} flushIntervalMs - Interval to flush buffered logs
 */

/**
 * @typedef {object} DebugLogEntry
 * @description Structure for individual debug log entries
 * @property {string} level - Log level: debug, info, warn, error
 * @property {string} message - Log message text
 * @property {string} [category] - Optional log category: engine, ui, ecs, ai, etc
 * @property {string} timestamp - ISO 8601 datetime string
 * @property {string} [source] - Optional source location: filename.js:line
 * @property {string} [sessionId] - Optional UUID v4 session identifier
 * @property {object} [metadata] - Optional additional context data
 */

/**
 * @typedef {object} StandardizedErrorObject
 * @description Standardized structure for error information
 * @property {string} message - Human-readable error description
 * @property {string} stage - Machine-readable error stage
 * @property {object} details - Additional error context
 */

/**
 * Category patterns for automatic log categorization
 */
const CATEGORY_PATTERNS = {
  engine: /GameEngine|engineState|gameSession/i,
  ui: /UI|Renderer|domUI|display/i,
  ecs: /Entity|Component|System|entityManager/i,
  ai: /AI|LLM|notes|thoughts|memory/i,
  persistence: /Save|Load|persist|storage/i,
  anatomy: /anatomy|body|part|descriptor/i,
  actions: /action|target|resolution/i,
  turns: /turn|round|cycle/i,
  events: /event|dispatch|listener/i,
  validation: /validate|schema|ajv/i,
  general: null, // default fallback
};

/**
 * Default configuration values (fallback if AppConfigService not provided)
 */
const DEFAULT_CONFIG = {
  baseLogPath: 'logs',
  retentionDays: 7,
  maxFileSizeMB: 10,
  writeBufferSize: 100,
  flushIntervalMs: 5000,
};

/**
 * Log storage service for file-based persistence of debug logs
 */
class LogStorageService {
  /** @type {ILogger} */
  #logger;

  /** @type {LogStorageConfig} */
  #config;

  /** @type {Map<string, DebugLogEntry[]>} */
  #writeBuffer;

  /** @type {*} */
  #flushTimer;

  /** @type {boolean} */
  #isFlushingBuffer;

  /** @type {Set<string>} */
  #createdDirectories;

  /**
   * Creates a new LogStorageService instance
   * @param {ILogger} logger - Logger instance for service-side logging
   * @param {AppConfigService|Partial<LogStorageConfig>} [configOrAppConfig] - AppConfigService instance or legacy config object
   */
  constructor(logger, configOrAppConfig = {}) {
    this.#logger = ensureValidLogger(logger, 'LogStorageService');
    this.#writeBuffer = new Map();
    this.#flushTimer = null;
    this.#isFlushingBuffer = false;
    this.#createdDirectories = new Set();

    // Determine if we received AppConfigService or legacy config
    if (
      configOrAppConfig &&
      typeof configOrAppConfig.getDebugLoggingConfig === 'function'
    ) {
      // Using AppConfigService
      const debugConfig = configOrAppConfig.getDebugLoggingConfig();

      // Parse max file size if provided as string
      let maxFileSizeMB = DEFAULT_CONFIG.maxFileSizeMB;
      if (debugConfig.storage && debugConfig.storage.maxFileSize) {
        const sizeResult = parseFileSize(debugConfig.storage.maxFileSize);
        if (sizeResult.valid) {
          maxFileSizeMB = Math.floor(sizeResult.value / (1024 * 1024)); // Convert bytes to MB
        }
      }

      this.#config = {
        baseLogPath: debugConfig.storage?.path || DEFAULT_CONFIG.baseLogPath,
        retentionDays:
          debugConfig.storage?.retentionDays || DEFAULT_CONFIG.retentionDays,
        maxFileSizeMB: maxFileSizeMB,
        writeBufferSize:
          debugConfig.performance?.writeBufferSize ||
          DEFAULT_CONFIG.writeBufferSize,
        flushIntervalMs:
          debugConfig.performance?.flushInterval ||
          DEFAULT_CONFIG.flushIntervalMs,
      };

      this.#logger.debug(
        'LogStorageService: Initialized with AppConfigService',
        {
          config: this.#config,
          debugLoggingEnabled: configOrAppConfig.isDebugLoggingEnabled(),
        }
      );
    } else {
      // Legacy configuration object
      this.#config = { ...DEFAULT_CONFIG, ...configOrAppConfig };
      this.#logger.debug('LogStorageService: Initialized with legacy config', {
        config: this.#config,
      });
    }

    // Start periodic flush timer
    this.#startFlushTimer();
  }

  /**
   * Writes a batch of debug logs to appropriate files
   * @param {DebugLogEntry[]} logs - Array of debug log entries to write
   * @returns {Promise<number>} Number of logs successfully processed
   */
  async writeLogs(logs) {
    if (!Array.isArray(logs) || logs.length === 0) {
      this.#logger.debug(
        'LogStorageService.writeLogs: No logs provided or empty array'
      );
      return 0;
    }

    this.#logger.debug(
      `LogStorageService.writeLogs: Processing ${logs.length} logs`
    );

    let processedCount = 0;

    try {
      // Group logs by date and category for efficient writing
      const logGroups = this.#groupLogsByDateAndCategory(logs);

      // Buffer logs for batch processing
      for (const [groupKey, groupLogs] of logGroups.entries()) {
        if (!this.#writeBuffer.has(groupKey)) {
          this.#writeBuffer.set(groupKey, []);
        }
        this.#writeBuffer.get(groupKey).push(...groupLogs);
        processedCount += groupLogs.length;
      }

      // Check if buffer is full and needs immediate flush
      const totalBuffered = Array.from(this.#writeBuffer.values()).reduce(
        (sum, logs) => sum + logs.length,
        0
      );

      if (totalBuffered >= this.#config.writeBufferSize) {
        await this.#flushWriteBuffer();
      }

      this.#logger.debug(
        `LogStorageService.writeLogs: Buffered ${processedCount} logs`,
        {
          totalBuffered,
          bufferGroups: this.#writeBuffer.size,
        }
      );

      return processedCount;
    } catch (error) {
      this.#logger.error(
        'LogStorageService.writeLogs: Failed to process logs',
        {
          error: error.message,
          stack: error.stack,
          logsCount: logs.length,
        }
      );

      // Return partial success count
      return processedCount;
    }
  }

  /**
   * Forces immediate flush of buffered logs to disk
   * @returns {Promise<number>} Number of logs flushed
   */
  async flushLogs() {
    return await this.#flushWriteBuffer();
  }

  /**
   * Rotates large files by checking file sizes and moving to numbered backups
   * @returns {Promise<number>} Number of files rotated
   */
  async rotateLargeFiles() {
    let rotatedCount = 0;

    try {
      const today = new Date().toISOString().split('T')[0];
      const todayPath = path.join(this.#config.baseLogPath, today);

      // Check if today's directory exists
      try {
        await fs.access(todayPath);
      } catch {
        // Directory doesn't exist, nothing to rotate
        return 0;
      }

      const files = await fs.readdir(todayPath);
      const maxSize = this.#config.maxFileSizeMB * 1024 * 1024;

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const filePath = path.join(todayPath, file);
        const stats = await fs.stat(filePath);

        if (stats.size >= maxSize) {
          await this.#rotateFile(filePath);
          rotatedCount++;
        }
      }

      if (rotatedCount > 0) {
        this.#logger.info(
          `LogStorageService.rotateLargeFiles: Rotated ${rotatedCount} files`
        );
      }

      return rotatedCount;
    } catch (error) {
      this.#logger.error(
        'LogStorageService.rotateLargeFiles: Failed to rotate files',
        {
          error: error.message,
          stack: error.stack,
        }
      );
      return rotatedCount;
    }
  }

  /**
   * Cleans up logs older than the retention period
   * @returns {Promise<number>} Number of directories cleaned up
   */
  async cleanupOldLogs() {
    let cleanedCount = 0;

    try {
      const baseDir = this.#config.baseLogPath;
      const retentionMs = this.#config.retentionDays * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(Date.now() - retentionMs);

      // Check if base directory exists
      try {
        await fs.access(baseDir);
      } catch {
        // Base directory doesn't exist, nothing to clean
        return 0;
      }

      const entries = await fs.readdir(baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Check if directory name matches YYYY-MM-DD format
        const dateMatch = entry.name.match(/^\d{4}-\d{2}-\d{2}$/);
        if (!dateMatch) continue;

        const dirDate = new Date(entry.name + 'T00:00:00Z');
        if (dirDate < cutoffDate) {
          const dirPath = path.join(baseDir, entry.name);
          await fs.rm(dirPath, { recursive: true, force: true });
          cleanedCount++;

          this.#logger.debug(
            `LogStorageService.cleanupOldLogs: Removed directory ${entry.name}`
          );
        }
      }

      if (cleanedCount > 0) {
        this.#logger.info(
          `LogStorageService.cleanupOldLogs: Cleaned ${cleanedCount} directories`
        );
      }

      return cleanedCount;
    } catch (error) {
      this.#logger.error(
        'LogStorageService.cleanupOldLogs: Failed to cleanup old logs',
        {
          error: error.message,
          stack: error.stack,
        }
      );
      return cleanedCount;
    }
  }

  /**
   * Gracefully shuts down the service
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.#logger.info('LogStorageService.shutdown: Shutting down service');

    // Stop flush timer
    if (this.#flushTimer) {
      clearInterval(this.#flushTimer);
      this.#flushTimer = null;
    }

    // Flush any remaining buffered logs
    await this.#flushWriteBuffer();

    this.#logger.info('LogStorageService.shutdown: Service shutdown complete');
  }

  /**
   * Groups logs by date and category for efficient batch processing
   * @private
   * @param {DebugLogEntry[]} logs - Array of log entries
   * @returns {Map<string, DebugLogEntry[]>} Map of group key to log entries
   */
  #groupLogsByDateAndCategory(logs) {
    const groups = new Map();

    for (const log of logs) {
      try {
        const date = new Date(log.timestamp).toISOString().split('T')[0];
        const category = this.#detectCategory(log);
        const groupKey = `${date}:${category}`;

        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey).push(log);
      } catch (error) {
        this.#logger.warn(
          'LogStorageService.#groupLogsByDateAndCategory: Failed to group log',
          {
            error: error.message,
            logLevel: log.level,
            logMessage: log.message?.substring(0, 100),
          }
        );
      }
    }

    return groups;
  }

  /**
   * Detects the category for a log entry using pattern matching
   * @private
   * @param {DebugLogEntry} log - Log entry to categorize
   * @returns {string} Detected category
   */
  #detectCategory(log) {
    // Use explicit category if provided
    if (log.category && typeof log.category === 'string') {
      return log.category.toLowerCase();
    }

    // Try to match against patterns using message and source
    const searchText = `${log.message || ''} ${log.source || ''}`;

    for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
      if (pattern && pattern.test(searchText)) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Ensures directory structure exists for the given date
   * @private
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<string>} Path to the date directory
   */
  async #ensureDirectoryStructure(date) {
    const dirPath = path.join(this.#config.baseLogPath, date);

    // Use cache to avoid repeated directory creation checks
    if (this.#createdDirectories.has(dirPath)) {
      return dirPath;
    }

    try {
      await fs.mkdir(dirPath, { recursive: true, mode: 0o755 });
      this.#createdDirectories.add(dirPath);

      this.#logger.debug(
        `LogStorageService.#ensureDirectoryStructure: Created directory ${dirPath}`
      );
      return dirPath;
    } catch (error) {
      // If directory already exists, that's fine
      if (error.code === 'EEXIST') {
        this.#createdDirectories.add(dirPath);
        return dirPath;
      }

      this.#logger.error(
        `LogStorageService.#ensureDirectoryStructure: Failed to create directory ${dirPath}`,
        {
          error: error.message,
          code: error.code,
        }
      );
      throw error;
    }
  }

  /**
   * Gets the file path for a specific date and category
   * @private
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} category - Log category
   * @returns {string} Full file path
   */
  #getCategoryFilePath(date, category) {
    return path.join(this.#config.baseLogPath, date, `${category}.jsonl`);
  }

  /**
   * Formats a log entry as JSONL string
   * @private
   * @param {DebugLogEntry} log - Log entry to format
   * @returns {string} JSONL formatted string
   */
  #formatLogEntry(log) {
    try {
      return JSON.stringify(log) + '\n';
    } catch (error) {
      this.#logger.warn(
        'LogStorageService.#formatLogEntry: Failed to serialize log entry',
        {
          error: error.message,
          logLevel: log.level,
          logMessage: log.message?.substring(0, 100),
        }
      );

      // Return a safe fallback entry
      return (
        JSON.stringify({
          level: log.level || 'unknown',
          message: `[SERIALIZATION_ERROR] ${log.message?.substring(0, 200) || 'Unknown message'}`,
          timestamp: log.timestamp || new Date().toISOString(),
          category: 'general',
          metadata: { serializationError: true },
        }) + '\n'
      );
    }
  }

  /**
   * Flushes buffered logs to disk
   * @private
   * @returns {Promise<number>} Number of logs flushed
   */
  async #flushWriteBuffer() {
    if (this.#isFlushingBuffer || this.#writeBuffer.size === 0) {
      return 0;
    }

    this.#isFlushingBuffer = true;
    let flushedCount = 0;

    try {
      // Create a snapshot of current buffer and clear it
      const bufferSnapshot = new Map(this.#writeBuffer);
      this.#writeBuffer.clear();

      for (const [groupKey, logs] of bufferSnapshot) {
        try {
          const [date, category] = groupKey.split(':');
          await this.#writeLogsToFile(date, category, logs);
          flushedCount += logs.length;
        } catch (error) {
          this.#logger.error(
            `LogStorageService.#flushWriteBuffer: Failed to write group ${groupKey}`,
            {
              error: error.message,
              logsCount: logs.length,
            }
          );

          // Re-buffer failed logs for retry
          if (!this.#writeBuffer.has(groupKey)) {
            this.#writeBuffer.set(groupKey, []);
          }
          this.#writeBuffer.get(groupKey).push(...logs);
        }
      }

      if (flushedCount > 0) {
        this.#logger.debug(
          `LogStorageService.#flushWriteBuffer: Flushed ${flushedCount} logs`
        );
      }

      return flushedCount;
    } catch (error) {
      this.#logger.error(
        'LogStorageService.#flushWriteBuffer: Critical flush error',
        {
          error: error.message,
          stack: error.stack,
        }
      );
      return flushedCount;
    } finally {
      this.#isFlushingBuffer = false;
    }
  }

  /**
   * Writes logs to a specific file
   * @private
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} category - Log category
   * @param {DebugLogEntry[]} logs - Array of log entries
   * @returns {Promise<void>}
   */
  async #writeLogsToFile(date, category, logs) {
    await this.#ensureDirectoryStructure(date);
    const filePath = this.#getCategoryFilePath(date, category);

    // Format all logs as JSONL
    const jsonlData = logs.map((log) => this.#formatLogEntry(log)).join('');

    // Atomic write operation
    const tempFilePath = filePath + '.tmp';

    try {
      // Write to temporary file first
      await fs.writeFile(tempFilePath, jsonlData, {
        encoding: 'utf8',
        flag: 'w',
        mode: 0o644,
      });

      // Check if original file exists for append operation
      let shouldAppend = false;
      try {
        await fs.access(filePath);
        shouldAppend = true;
      } catch {
        // File doesn't exist, we'll move temp file
      }

      if (shouldAppend) {
        // Append temp file contents to original file
        const tempData = await fs.readFile(tempFilePath, 'utf8');
        await fs.appendFile(filePath, tempData, { encoding: 'utf8' });
        await fs.unlink(tempFilePath);
      } else {
        // Move temp file to final location
        await fs.rename(tempFilePath, filePath);
      }

      this.#logger.debug(
        `LogStorageService.#writeLogsToFile: Wrote ${logs.length} logs to ${filePath}`
      );
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  /**
   * Rotates a file by moving it to a numbered backup
   * @private
   * @param {string} filePath - Path to file to rotate
   * @returns {Promise<void>}
   */
  async #rotateFile(filePath) {
    const dir = path.dirname(filePath);
    const name = path.basename(filePath, '.jsonl');

    let rotationNumber = 1;
    let rotatedPath;

    // Find next available rotation number
    do {
      rotatedPath = path.join(dir, `${name}.${rotationNumber}.jsonl`);
      try {
        await fs.access(rotatedPath);
        rotationNumber++;
      } catch {
        break;
      }
    } while (rotationNumber < 100); // Prevent infinite loop

    if (rotationNumber >= 100) {
      throw new Error(`Too many rotated files for ${filePath}`);
    }

    await fs.rename(filePath, rotatedPath);

    this.#logger.info(
      `LogStorageService.#rotateFile: Rotated ${filePath} to ${rotatedPath}`
    );
  }

  /**
   * Starts the periodic flush timer
   * @private
   * @returns {void}
   */
  #startFlushTimer() {
    this.#flushTimer = setInterval(async () => {
      try {
        await this.#flushWriteBuffer();
      } catch (error) {
        this.#logger.error(
          'LogStorageService.#startFlushTimer: Periodic flush failed',
          {
            error: error.message,
          }
        );
      }
    }, this.#config.flushIntervalMs);
  }
}

export default LogStorageService;
