/**
 * @file Browser-based directory management for action tracing system
 * Handles creation and validation of trace output directories using File System Access API
 */

import {
  validateDependency,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Manages trace output directories in browser environment
 * Uses File System Access API for directory operations
 */
class TraceDirectoryManager {
  #storageProvider;
  #logger;
  #createdDirectories;
  #rootHandle;

  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/IStorageProvider.js').IStorageProvider} dependencies.storageProvider - Storage service
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   */
  constructor({ storageProvider, logger }) {
    validateDependency(storageProvider, 'IStorageProvider', null, {
      requiredMethods: ['writeFileAtomically', 'listFiles'],
    });
    this.#logger = ensureValidLogger(logger, 'TraceDirectoryManager');

    this.#storageProvider = storageProvider;
    this.#createdDirectories = new Set();
    this.#rootHandle = null;
  }

  /**
   * Ensure directory exists within the browser's sandboxed filesystem
   *
   * @param {string} directoryPath - Path to directory (relative to root)
   * @returns {Promise<DirectoryResult>} Result with status and metadata
   */
  async ensureDirectoryExists(directoryPath) {
    assertNonBlankString(
      directoryPath,
      'directoryPath',
      'TraceDirectoryManager.ensureDirectoryExists',
      this.#logger
    );

    try {
      // Normalize and validate the path
      const normalizedPath = this.#normalizePath(directoryPath);
      const validationResult = this.#validatePath(normalizedPath);

      if (!validationResult.isValid) {
        this.#logger.error('Invalid directory path', {
          path: directoryPath,
          errors: validationResult.errors,
        });

        return {
          success: false,
          path: normalizedPath,
          existed: false,
          created: false,
          writable: false,
          error: validationResult.errors.join(', '),
          errors: validationResult.errors,
        };
      }

      // Check if already processed this directory
      if (this.#createdDirectories.has(normalizedPath)) {
        return {
          success: true,
          path: normalizedPath,
          existed: true,
          created: false,
          writable: true,
          cached: true,
        };
      }

      // Get or prompt for root directory handle
      if (!this.#rootHandle) {
        this.#rootHandle = await this.#getRootDirectoryHandle();
        if (!this.#rootHandle) {
          return {
            success: false,
            path: normalizedPath,
            existed: false,
            created: false,
            writable: false,
            error: 'User denied directory access or cancelled selection',
          };
        }
      }

      // Create nested directory structure
      const segments = normalizedPath.split('/').filter(Boolean);
      let currentHandle = this.#rootHandle;

      for (const segment of segments) {
        try {
          // Create directory if it doesn't exist
          currentHandle = await currentHandle.getDirectoryHandle(segment, {
            create: true,
          });
        } catch (error) {
          this.#logger.error('Failed to create directory segment', error, {
            segment,
            path: normalizedPath,
          });

          return {
            success: false,
            path: normalizedPath,
            existed: false,
            created: false,
            writable: false,
            error: this.#formatBrowserError(error),
          };
        }
      }

      this.#createdDirectories.add(normalizedPath);
      this.#logger.info('Trace directory created successfully', {
        path: normalizedPath,
      });

      return {
        success: true,
        path: normalizedPath,
        existed: false,
        created: true,
        writable: true,
      };
    } catch (error) {
      this.#logger.error('Failed to ensure directory exists', error, {
        path: directoryPath,
      });

      return {
        success: false,
        path: directoryPath,
        existed: false,
        created: false,
        writable: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if a directory path is valid for trace output
   *
   * @param {string} directoryPath - Path to validate
   * @returns {ValidationResult} Validation result
   */
  validateDirectoryPath(directoryPath) {
    assertNonBlankString(
      directoryPath,
      'directoryPath',
      'TraceDirectoryManager.validateDirectoryPath',
      this.#logger
    );

    const normalizedPath = this.#normalizePath(directoryPath);
    return this.#validatePath(normalizedPath);
  }

  /**
   * Get the root directory handle from storage provider
   *
   * @private
   * @returns {Promise<FileSystemDirectoryHandle|null>}
   */
  async #getRootDirectoryHandle() {
    try {
      // This would need to be added to BrowserStorageProvider
      // For now, we'll prompt the user
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });

      // Verify permissions
      const permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        const requestResult = await handle.requestPermission({
          mode: 'readwrite',
        });
        if (requestResult !== 'granted') {
          this.#logger.warn('User denied write permission to directory');
          return null;
        }
      }

      this.#logger.debug('Root directory handle obtained', {
        name: handle.name,
      });

      return handle;
    } catch (error) {
      if (error.name === 'AbortError') {
        this.#logger.info('User cancelled directory selection');
      } else {
        this.#logger.error('Failed to get root directory handle', error);
      }
      return null;
    }
  }

  /**
   * Prompt user to select a directory for export
   * 
   * @returns {Promise<FileSystemDirectoryHandle|null>} Directory handle or null if cancelled
   */
  async selectDirectory() {
    try {
      // Prompt the user to select a directory
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });

      // Verify permissions
      const permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        const requestResult = await handle.requestPermission({
          mode: 'readwrite',
        });
        if (requestResult !== 'granted') {
          this.#logger.warn('User denied write permission to directory');
          return null;
        }
      }

      this.#logger.debug('Directory selected for export', {
        name: handle.name,
      });

      return handle;
    } catch (error) {
      if (error.name === 'AbortError') {
        this.#logger.info('User cancelled directory selection');
      } else {
        this.#logger.error('Failed to select directory', error);
      }
      return null;
    }
  }

  /**
   * Ensure a subdirectory exists within a parent directory handle
   * 
   * @param {FileSystemDirectoryHandle} parentHandle - Parent directory handle
   * @param {string} subdirectoryName - Name of subdirectory to create
   * @returns {Promise<FileSystemDirectoryHandle|null>} Subdirectory handle or null on error
   */
  async ensureSubdirectoryExists(parentHandle, subdirectoryName) {
    assertNonBlankString(
      subdirectoryName,
      'subdirectoryName',
      'TraceDirectoryManager.ensureSubdirectoryExists',
      this.#logger
    );

    if (!parentHandle) {
      this.#logger.error('Parent directory handle is required');
      return null;
    }

    try {
      // Create or get subdirectory
      const subdirectoryHandle = await parentHandle.getDirectoryHandle(
        subdirectoryName,
        { create: true }
      );

      this.#logger.debug('Subdirectory ensured', {
        name: subdirectoryName,
      });

      return subdirectoryHandle;
    } catch (error) {
      this.#logger.error('Failed to ensure subdirectory exists', error, {
        subdirectoryName,
      });
      return null;
    }
  }

  /**
   * Clear the cache of created directories
   */
  clearCache() {
    const count = this.#createdDirectories.size;
    this.#createdDirectories.clear();
    this.#rootHandle = null;

    this.#logger.debug('Directory creation cache cleared', {
      clearedCount: count,
    });
  }

  /**
   * Get list of directories that have been created/validated
   *
   * @returns {string[]} List of directory paths
   */
  getCachedDirectories() {
    return Array.from(this.#createdDirectories);
  }

  /**
   * Normalize path for consistent handling in browser
   *
   * @param directoryPath
   * @private
   */
  #normalizePath(directoryPath) {
    // Remove leading ./ and ensure forward slashes
    let normalized = directoryPath.replace(/\\/g, '/');
    normalized = normalized.replace(/^\.\//, '');
    normalized = normalized.replace(/\/+/g, '/'); // Remove duplicate slashes
    normalized = normalized.replace(/\/$/, ''); // Remove trailing slash

    return normalized;
  }

  /**
   * Validate directory path for browser environment
   *
   * @param normalizedPath
   * @private
   */
  #validatePath(normalizedPath) {
    const errors = [];

    // Check for path traversal attempts
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
      errors.push('Path contains directory traversal sequences');
    }

    // Check for null bytes (security)
    if (normalizedPath.includes('\0')) {
      errors.push('Path contains null bytes');
    }

    // Check path length (browser limits)
    if (normalizedPath.length > 255) {
      errors.push('Path exceeds maximum length (255 characters)');
    }

    // Check for invalid characters in browser context
    const invalidChars = /[<>:"|?*\0]/;
    if (invalidChars.test(normalizedPath)) {
      errors.push('Path contains invalid characters');
    }

    // Check for reserved names
    const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'lpt1'];
    const segments = normalizedPath.split('/');
    for (const segment of segments) {
      if (reservedNames.includes(segment.toLowerCase())) {
        errors.push(`Path contains reserved name: ${segment}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalizedPath,
    };
  }

  /**
   * Format browser filesystem errors for user-friendly messages
   *
   * @param error
   * @private
   */
  #formatBrowserError(error) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Permission denied. User needs to grant access to the directory.';

      case 'NotFoundError':
        return 'Directory or parent directory not found.';

      case 'TypeMismatchError':
        return 'Path component exists but is not a directory.';

      case 'InvalidStateError':
        return 'Invalid directory state or handle.';

      case 'SecurityError':
        return 'Security restrictions prevent this operation.';

      case 'AbortError':
        return 'Operation was aborted by the user.';

      case 'QuotaExceededError':
        return 'Storage quota exceeded.';

      default:
        return `Browser filesystem error: ${error.message || error.name || 'unknown'}`;
    }
  }
}

export default TraceDirectoryManager;

/**
 * @typedef {object} DirectoryResult
 * @property {boolean} success - Whether operation succeeded
 * @property {string} path - Normalized directory path
 * @property {boolean} existed - Whether directory existed before operation
 * @property {boolean} created - Whether directory was created
 * @property {boolean} writable - Whether directory is writable
 * @property {boolean} [cached] - Whether result came from cache
 * @property {string} [error] - Error message if operation failed
 * @property {string[]} [errors] - List of validation errors if operation failed
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} isValid - Whether path is valid
 * @property {string[]} errors - List of validation errors
 * @property {string} normalizedPath - Normalized version of the path
 */
