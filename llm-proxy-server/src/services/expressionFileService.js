/**
 * @file Service for reading and updating expression file diagnostic statuses
 * @description Handles reading expression files from mods directories and updating their diagnosticStatus field
 * @see ../handlers/expressionStatusController.js
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Valid diagnostic status values that can be written to expression files
 * @type {readonly string[]}
 */
const VALID_STATUSES = Object.freeze([
  'unknown',
  'impossible',
  'extremely_rare',
  'rare',
  'normal',
  'frequent',
]);

/**
 * @typedef {Object} ExpressionStatusInfo
 * @property {string} id - Expression ID (e.g., 'emotions-attention:flow_absorption')
 * @property {string} filePath - Relative path to expression file from project root
 * @property {string|null} diagnosticStatus - Current status or null if not set
 */

/**
 * @typedef {Object} UpdateResult
 * @property {boolean} success - Whether the update succeeded
 * @property {string} message - Human-readable result message
 * @property {string} [expressionId] - Expression ID on success
 */

/**
 * Service for managing expression file diagnostic status persistence.
 * Provides secure file I/O for reading and updating expression files within the mods directory.
 */
export class ExpressionFileService {
  /** @type {Object} */
  #logger;

  /** @type {string} */
  #projectRoot;

  /** @type {string} */
  #modsPath;

  /**
   * Creates a new ExpressionFileService instance.
   * @param {Object} logger - Logger instance for info and error logging
   * @param {string} [projectRoot='../'] - Path to project root relative to llm-proxy-server
   */
  constructor(logger, projectRoot = '../') {
    if (!logger) {
      throw new Error('ExpressionFileService: logger is required');
    }
    this.#logger = logger;
    this.#projectRoot = path.resolve(process.cwd(), projectRoot);
    this.#modsPath = path.join(this.#projectRoot, 'data', 'mods');
    this.#logger.debug('ExpressionFileService: Instance created', {
      projectRoot: this.#projectRoot,
      modsPath: this.#modsPath,
    });
  }

  /**
   * Validates that a file path is within the data/mods/ directory and is an expression file.
   * Prevents path traversal attacks.
   * @param {string} filePath - Relative file path from project root
   * @returns {boolean} True if path is valid and safe
   */
  validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    // Must be an expression file
    if (!filePath.endsWith('.expression.json')) {
      return false;
    }

    // Resolve full path and check it stays within mods directory
    const fullPath = path.resolve(this.#projectRoot, filePath);
    const relativePath = path.relative(this.#modsPath, fullPath);

    // Check for path traversal attempts
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return false;
    }

    // Ensure the path starts with data/mods/
    const relativeToProject = path.relative(this.#projectRoot, fullPath);
    if (!relativeToProject.startsWith('data' + path.sep + 'mods' + path.sep)) {
      return false;
    }

    return true;
  }

  /**
   * Updates the diagnosticStatus field in an expression file.
   * @param {string} filePath - Relative path to expression file from project root
   * @param {string} newStatus - New diagnostic status value
   * @returns {Promise<UpdateResult>} Result indicating success or failure
   */
  async updateExpressionStatus(filePath, newStatus) {
    // Validate status value
    if (!VALID_STATUSES.includes(newStatus)) {
      this.#logger.warn('ExpressionFileService: Invalid status value', {
        newStatus,
        validStatuses: VALID_STATUSES,
      });
      return {
        success: false,
        message: `Invalid status: ${newStatus}. Valid values: ${VALID_STATUSES.join(', ')}`,
      };
    }

    // Validate file path
    if (!this.validateFilePath(filePath)) {
      this.#logger.warn('ExpressionFileService: Invalid file path', { filePath });
      return {
        success: false,
        message: 'Invalid file path - must be within data/mods/ and end with .expression.json',
      };
    }

    const fullPath = path.resolve(this.#projectRoot, filePath);

    try {
      // Read existing file
      const content = await fs.readFile(fullPath, 'utf-8');
      let expression;
      try {
        expression = JSON.parse(content);
      } catch {
        this.#logger.error('ExpressionFileService: Invalid JSON in file', { filePath });
        return { success: false, message: 'File contains invalid JSON' };
      }

      // Check if status actually changed
      const previousStatus = expression.diagnosticStatus || null;
      if (previousStatus === newStatus) {
        this.#logger.debug('ExpressionFileService: Status unchanged', {
          filePath,
          status: newStatus,
        });
        return {
          success: true,
          message: 'Status unchanged',
          expressionId: expression.id,
        };
      }

      // Update the diagnosticStatus field
      expression.diagnosticStatus = newStatus;

      // Write back with consistent formatting (4-space indent)
      await fs.writeFile(fullPath, JSON.stringify(expression, null, 4), 'utf-8');

      this.#logger.info('ExpressionFileService: Updated diagnostic status', {
        filePath,
        expressionId: expression.id,
        previousStatus,
        newStatus,
      });

      return {
        success: true,
        message: 'Status updated successfully',
        expressionId: expression.id,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.#logger.warn('ExpressionFileService: File not found', { filePath });
        return { success: false, message: 'Expression file not found' };
      }

      this.#logger.error('ExpressionFileService: Failed to update status', {
        filePath,
        error: error.message,
      });
      return { success: false, message: `Failed to update file: ${error.message}` };
    }
  }

  /**
   * Scans all expression files in all mods and returns their diagnostic statuses.
   * Uses parallel I/O for performance to avoid timeout issues with many files.
   * @returns {Promise<ExpressionStatusInfo[]>} Array of expression status information
   */
  async scanAllExpressionStatuses() {
    const results = [];

    try {
      const modDirs = await fs.readdir(this.#modsPath, { withFileTypes: true });

      // Process all mod directories in parallel
      const modPromises = modDirs
        .filter((modDir) => modDir.isDirectory())
        .map(async (modDir) => {
          const expressionsPath = path.join(this.#modsPath, modDir.name, 'expressions');

          // Check if expressions directory exists
          try {
            await fs.access(expressionsPath);
          } catch {
            // No expressions directory in this mod
            return [];
          }

          const files = await fs.readdir(expressionsPath);
          const expressionFiles = files.filter((f) => f.endsWith('.expression.json'));

          // Read all expression files in this mod in parallel
          const filePromises = expressionFiles.map(async (file) => {
            const relativeFilePath = path.join(
              'data',
              'mods',
              modDir.name,
              'expressions',
              file
            );
            const fullPath = path.join(expressionsPath, file);

            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const expression = JSON.parse(content);

              return {
                id: expression.id,
                filePath: relativeFilePath,
                diagnosticStatus: expression.diagnosticStatus || null,
              };
            } catch (err) {
              this.#logger.warn('ExpressionFileService: Failed to read expression file', {
                file: relativeFilePath,
                error: err.message,
              });
              return null;
            }
          });

          return Promise.all(filePromises);
        });

      const modResults = await Promise.all(modPromises);

      // Flatten and filter out nulls
      for (const modExpressions of modResults) {
        for (const expr of modExpressions) {
          if (expr) results.push(expr);
        }
      }
    } catch (error) {
      this.#logger.error('ExpressionFileService: Failed to scan expressions', {
        error: error.message,
      });
    }

    this.#logger.info('ExpressionFileService: Scan completed', {
      expressionCount: results.length,
    });

    return results;
  }
}

export default ExpressionFileService;
