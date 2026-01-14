/**
 * @file Service for appending expression evaluation logs to JSONL files
 * @description Persists expression evaluation log entries in daily JSONL files
 * @see ../handlers/expressionLogController.js
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Service for writing expression evaluation logs safely within the project root.
 */
export class ExpressionLogService {
  #logger;
  #projectRoot;
  #logDirectory;
  #logDirectoryFullPath;

  /**
   * Creates a new ExpressionLogService instance.
   * @param {object} logger - Logger instance for info and error logging
   * @param {string} [projectRoot='../'] - Path to project root relative to llm-proxy-server
   * @param {string} [logDirectory='logs/expressions'] - Log directory relative to project root
   */
  constructor(logger, projectRoot = '../', logDirectory = 'logs/expressions') {
    if (!logger) {
      throw new Error('ExpressionLogService: logger is required');
    }
    this.#logger = logger;
    this.#projectRoot = path.resolve(process.cwd(), projectRoot);
    this.#logDirectory = logDirectory;
    this.#logDirectoryFullPath = path.resolve(
      this.#projectRoot,
      this.#logDirectory
    );
    this.#validateLogDirectory();

    this.#logger.debug('ExpressionLogService: Instance created', {
      projectRoot: this.#projectRoot,
      logDirectory: this.#logDirectory,
    });
  }

  /**
   * Appends a JSONL log entry to the daily expression log file.
   * @param {object} entry - Log entry payload
   * @param {Date} [timestamp=new Date()] - Timestamp for file naming
   * @returns {Promise<{path: string, bytesWritten: number}>}
   */
  async appendEntry(entry, timestamp = new Date()) {
    const { fullPath, relativePath } = this.#getLogFilePath(timestamp);
    const serialized = JSON.stringify(entry);

    if (!serialized) {
      throw new Error('ExpressionLogService: entry must be JSON-serializable');
    }

    await fs.mkdir(this.#logDirectoryFullPath, { recursive: true });
    const line = `${serialized}\n`;
    await fs.appendFile(fullPath, line, 'utf8');

    return {
      path: relativePath,
      bytesWritten: Buffer.byteLength(line, 'utf8'),
    };
  }

  #getLogFilePath(timestamp) {
    const dateStamp = timestamp.toISOString().slice(0, 10);
    const fileName = `expression-evals-${dateStamp}.jsonl`;
    const fullPath = path.resolve(this.#logDirectoryFullPath, fileName);
    const relativePath = path.relative(this.#projectRoot, fullPath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error(
        'ExpressionLogService: resolved log path is outside the project root'
      );
    }

    return { fullPath, relativePath };
  }

  #validateLogDirectory() {
    const relativePath = path.relative(
      this.#projectRoot,
      this.#logDirectoryFullPath
    );

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error(
        'ExpressionLogService: log directory must be within project root'
      );
    }
  }
}

export default ExpressionLogService;
