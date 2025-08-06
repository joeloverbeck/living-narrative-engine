# ACTTRA-008: Create Trace Output Directory Management

## Overview

Implement automatic creation of trace output directories with permission checking and path validation. This utility ensures that the action tracing system can write files to the configured output directory, creating the necessary directory structure if it doesn't exist and handling filesystem permission issues gracefully.

## Priority

**LOW** - Infrastructure support utility

## Dependencies

- **Enables**: ACTTRA-024 (ActionTraceOutputService)
- **Related**: ACTTRA-006 (configuration loader), ACTTRA-007 (path validation)
- **Requires**: File system access through existing IFileSystem interface

## Acceptance Criteria

- [ ] TraceDirectoryManager class for directory operations
- [ ] Auto-creation of trace output directories with proper permissions
- [ ] Path validation and sanitization before directory creation
- [ ] Permission checking with clear error messages for access issues
- [ ] Support for nested directory structures
- [ ] Integration with existing IFileSystem interface
- [ ] Graceful handling of readonly filesystems and permission errors
- [ ] Comprehensive logging of directory operations
- [ ] Unit tests with filesystem mocking
- [ ] Cross-platform compatibility (Windows/Linux/macOS paths)

## Current Directory Structure

Based on the specification, trace files will be written to:

**Default Location**: `./traces/actions/`

**File Structure**:

```
traces/
└── actions/
    ├── core-go_2024-01-15_10-30-00.json
    ├── core-go_2024-01-15_10-30-00.txt
    ├── core-look_2024-01-15_10-31-15.json
    └── core-look_2024-01-15_10-31-15.txt
```

**Important Note**: The `./traces/actions` directory does not exist by default and must be created by the system.

## Implementation Steps

### Step 1: Analyze Existing File System Integration

Review current filesystem patterns in the codebase:

```bash
# Find existing filesystem usage
find src -name "*fileSystem*" -o -name "*FileSystem*"
find src -name "*fs*" -type f

# Check for directory creation patterns
grep -r "mkdir\|createDir" src/
```

Expected patterns:

- IFileSystem interface for filesystem operations
- Dependency injection for file system services
- Error handling for filesystem permissions
- Cross-platform path handling

### Step 2: Create TraceDirectoryManager Class

**File**: `src/actions/tracing/traceDirectoryManager.js`

```javascript
/**
 * @file Directory management for action tracing system
 * Handles creation and validation of trace output directories
 */

import {
  validateDependency,
  assertNonBlankString,
} from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import path from 'path';

/**
 * Manages trace output directories with automatic creation and validation
 */
class TraceDirectoryManager {
  #fileSystem;
  #logger;
  #createdDirectories;

  /**
   * @param {Object} dependencies
   * @param {IFileSystem} dependencies.fileSystem - File system service
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ fileSystem, logger }) {
    validateDependency(fileSystem, 'IFileSystem', null, {
      requiredMethods: ['mkdir', 'access', 'stat'],
    });
    this.#logger = ensureValidLogger(logger, 'TraceDirectoryManager');

    this.#fileSystem = fileSystem;
    this.#createdDirectories = new Set();
  }

  /**
   * Ensure directory exists, creating it if necessary
   * @param {string} directoryPath - Path to directory
   * @returns {Promise<DirectoryResult>} Result with status and metadata
   */
  async ensureDirectoryExists(directoryPath) {
    assertNonBlankString(directoryPath, 'Directory path is required');

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

      // Check if directory already exists
      const existsResult = await this.#checkDirectoryExists(normalizedPath);

      if (existsResult.exists) {
        // Verify it's writable
        const writableResult =
          await this.#checkDirectoryWritable(normalizedPath);

        if (writableResult.writable) {
          this.#createdDirectories.add(normalizedPath);
          this.#logger.debug('Directory exists and is writable', {
            path: normalizedPath,
          });

          return {
            success: true,
            path: normalizedPath,
            existed: true,
            created: false,
            writable: true,
          };
        } else {
          this.#logger.error('Directory exists but is not writable', {
            path: normalizedPath,
            error: writableResult.error,
          });

          return {
            success: false,
            path: normalizedPath,
            existed: true,
            created: false,
            writable: false,
            error: writableResult.error,
          };
        }
      }

      // Directory doesn't exist, create it
      const createResult = await this.#createDirectory(normalizedPath);

      if (createResult.success) {
        this.#createdDirectories.add(normalizedPath);
        this.#logger.info('Trace directory created successfully', {
          path: normalizedPath,
          recursive: createResult.recursive,
        });
      }

      return {
        success: createResult.success,
        path: normalizedPath,
        existed: false,
        created: createResult.success,
        writable: createResult.success,
        recursive: createResult.recursive,
        error: createResult.error,
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
   * @param {string} directoryPath - Path to validate
   * @returns {ValidationResult} Validation result
   */
  validateDirectoryPath(directoryPath) {
    assertNonBlankString(directoryPath, 'Directory path is required');

    const normalizedPath = this.#normalizePath(directoryPath);
    return this.#validatePath(normalizedPath);
  }

  /**
   * Get information about a directory
   * @param {string} directoryPath - Path to analyze
   * @returns {Promise<DirectoryInfo>} Directory information
   */
  async getDirectoryInfo(directoryPath) {
    assertNonBlankString(directoryPath, 'Directory path is required');

    const normalizedPath = this.#normalizePath(directoryPath);

    try {
      const existsResult = await this.#checkDirectoryExists(normalizedPath);

      if (!existsResult.exists) {
        return {
          path: normalizedPath,
          exists: false,
          writable: false,
          parentExists: await this.#checkParentDirectoryExists(normalizedPath),
        };
      }

      const writableResult = await this.#checkDirectoryWritable(normalizedPath);
      const stats = await this.#fileSystem.stat(normalizedPath);

      return {
        path: normalizedPath,
        exists: true,
        writable: writableResult.writable,
        parentExists: true,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        permissions: stats.mode,
      };
    } catch (error) {
      this.#logger.error('Failed to get directory info', error, {
        path: directoryPath,
      });

      return {
        path: normalizedPath,
        exists: false,
        writable: false,
        parentExists: false,
        error: error.message,
      };
    }
  }

  /**
   * Clear the cache of created directories
   * Useful for testing or when filesystem state might have changed
   */
  clearCache() {
    const count = this.#createdDirectories.size;
    this.#createdDirectories.clear();

    this.#logger.debug('Directory creation cache cleared', {
      clearedCount: count,
    });
  }

  /**
   * Get list of directories that have been created/validated
   * @returns {string[]} List of directory paths
   */
  getCachedDirectories() {
    return Array.from(this.#createdDirectories);
  }

  /**
   * Normalize path for consistent handling across platforms
   * @private
   */
  #normalizePath(directoryPath) {
    // Normalize path separators and resolve relative paths
    const normalized = path.normalize(directoryPath);

    // Convert to forward slashes for consistency (works on Windows too)
    return normalized.replace(/\\/g, '/');
  }

  /**
   * Validate directory path for security and correctness
   * @private
   */
  #validatePath(normalizedPath) {
    const errors = [];

    // Check for path traversal attempts
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
      errors.push('Path contains directory traversal sequences');
    }

    // Check for potentially dangerous paths
    const dangerousPaths = ['/etc', '/var', '/sys', '/proc', '/dev'];
    if (
      dangerousPaths.some((dangerous) => normalizedPath.startsWith(dangerous))
    ) {
      errors.push('Path points to system directory');
    }

    // Check for null bytes (security)
    if (normalizedPath.includes('\0')) {
      errors.push('Path contains null bytes');
    }

    // Check path length (filesystem limits)
    if (normalizedPath.length > 260) {
      // Windows MAX_PATH limit
      errors.push('Path exceeds maximum length (260 characters)');
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(normalizedPath)) {
      errors.push('Path contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalizedPath,
    };
  }

  /**
   * Check if directory exists
   * @private
   */
  async #checkDirectoryExists(directoryPath) {
    try {
      await this.#fileSystem.access(directoryPath);
      const stats = await this.#fileSystem.stat(directoryPath);

      return {
        exists: true,
        isDirectory: stats.isDirectory(),
      };
    } catch (error) {
      // Directory doesn't exist or can't be accessed
      return {
        exists: false,
        isDirectory: false,
        error: error.code,
      };
    }
  }

  /**
   * Check if directory is writable
   * @private
   */
  async #checkDirectoryWritable(directoryPath) {
    try {
      // Try to access with write permission
      await this.#fileSystem.access(
        directoryPath,
        this.#fileSystem.constants.W_OK
      );

      return {
        writable: true,
      };
    } catch (error) {
      return {
        writable: false,
        error: `Directory not writable: ${error.message}`,
      };
    }
  }

  /**
   * Check if parent directory exists
   * @private
   */
  async #checkParentDirectoryExists(directoryPath) {
    try {
      const parentPath = path.dirname(directoryPath);
      const result = await this.#checkDirectoryExists(parentPath);
      return result.exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create directory with proper error handling
   * @private
   */
  async #createDirectory(directoryPath) {
    try {
      // Use recursive creation to handle nested directories
      await this.#fileSystem.mkdir(directoryPath, { recursive: true });

      // Verify creation was successful
      const verifyResult = await this.#checkDirectoryExists(directoryPath);

      if (!verifyResult.exists || !verifyResult.isDirectory) {
        return {
          success: false,
          recursive: true,
          error: 'Directory creation verification failed',
        };
      }

      // Verify it's writable
      const writableResult = await this.#checkDirectoryWritable(directoryPath);

      if (!writableResult.writable) {
        return {
          success: false,
          recursive: true,
          error: writableResult.error,
        };
      }

      return {
        success: true,
        recursive: true,
      };
    } catch (error) {
      // Handle specific filesystem errors
      const errorMessage = this.#formatFilesystemError(error);

      return {
        success: false,
        recursive: true,
        error: errorMessage,
      };
    }
  }

  /**
   * Format filesystem errors for user-friendly messages
   * @private
   */
  #formatFilesystemError(error) {
    switch (error.code) {
      case 'EACCES':
        return 'Permission denied. Check directory permissions or run with appropriate privileges.';

      case 'ENOTDIR':
        return 'Path component is not a directory.';

      case 'ENOENT':
        return 'Parent directory does not exist.';

      case 'ENOSPC':
        return 'No space left on device.';

      case 'EROFS':
        return 'File system is read-only.';

      case 'EMFILE':
      case 'ENFILE':
        return 'Too many open files.';

      case 'ENAMETOOLONG':
        return 'Path name too long.';

      default:
        return `Filesystem error: ${error.message} (${error.code || 'unknown'})`;
    }
  }
}

export default TraceDirectoryManager;

/**
 * @typedef {Object} DirectoryResult
 * @property {boolean} success - Whether operation succeeded
 * @property {string} path - Normalized directory path
 * @property {boolean} existed - Whether directory existed before operation
 * @property {boolean} created - Whether directory was created
 * @property {boolean} writable - Whether directory is writable
 * @property {boolean} [recursive] - Whether recursive creation was used
 * @property {boolean} [cached] - Whether result came from cache
 * @property {string} [error] - Error message if operation failed
 */

/**
 * @typedef {Object} DirectoryInfo
 * @property {string} path - Normalized directory path
 * @property {boolean} exists - Whether directory exists
 * @property {boolean} writable - Whether directory is writable
 * @property {boolean} parentExists - Whether parent directory exists
 * @property {boolean} [isDirectory] - Whether path is a directory
 * @property {number} [size] - Directory size in bytes
 * @property {Date} [created] - Directory creation time
 * @property {Date} [modified] - Directory modification time
 * @property {number} [permissions] - Directory permissions
 * @property {string} [error] - Error message if info retrieval failed
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether path is valid
 * @property {string[]} errors - List of validation errors
 * @property {string} normalizedPath - Normalized version of the path
 */
```

### Step 3: Create Integration Utility

**File**: `src/actions/tracing/directoryUtils.js`

```javascript
/**
 * @file Utility functions for directory operations in action tracing
 * Provides convenience functions for common directory tasks
 */

import TraceDirectoryManager from './traceDirectoryManager.js';

/**
 * Create a configured TraceDirectoryManager instance
 * @param {Object} dependencies
 * @returns {TraceDirectoryManager}
 */
export function createTraceDirectoryManager(dependencies) {
  return new TraceDirectoryManager(dependencies);
}

/**
 * Ensure multiple directories exist
 * @param {TraceDirectoryManager} dirManager - Directory manager instance
 * @param {string[]} directories - Array of directory paths
 * @returns {Promise<DirectoryBatchResult>} Results for all directories
 */
export async function ensureMultipleDirectories(dirManager, directories) {
  const results = [];
  const errors = [];
  let successCount = 0;

  for (const dir of directories) {
    try {
      const result = await dirManager.ensureDirectoryExists(dir);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        errors.push(`${dir}: ${result.error}`);
      }
    } catch (error) {
      const errorResult = {
        success: false,
        path: dir,
        existed: false,
        created: false,
        writable: false,
        error: error.message,
      };
      results.push(errorResult);
      errors.push(`${dir}: ${error.message}`);
    }
  }

  return {
    results,
    successCount,
    totalCount: directories.length,
    errors,
    allSuccessful: errors.length === 0,
  };
}

/**
 * Get the standard trace directories configuration
 * @param {string} baseOutputDir - Base output directory
 * @returns {string[]} Array of standard trace directories
 */
export function getStandardTraceDirectories(baseOutputDir = './traces') {
  return [
    baseOutputDir,
    `${baseOutputDir}/actions`,
    `${baseOutputDir}/actions/archive`,
  ];
}

/**
 * Validate and normalize a trace output path
 * @param {string} outputPath - Path to validate
 * @returns {ValidationResult} Validation result
 */
export function validateTraceOutputPath(outputPath) {
  // Create temporary manager for validation
  const tempManager = {
    validateDirectoryPath:
      TraceDirectoryManager.prototype.validateDirectoryPath.bind({
        _normalizePath: TraceDirectoryManager.prototype._normalizePath,
        _validatePath: TraceDirectoryManager.prototype._validatePath,
      }),
  };

  return tempManager.validateDirectoryPath(outputPath);
}

/**
 * @typedef {Object} DirectoryBatchResult
 * @property {DirectoryResult[]} results - Individual directory results
 * @property {number} successCount - Number of successful operations
 * @property {number} totalCount - Total number of directories processed
 * @property {string[]} errors - List of error messages
 * @property {boolean} allSuccessful - Whether all operations succeeded
 */
```

### Step 4: Integration with DI Container

Update the action tracing container to register the directory manager:

**File**: `src/dependencyInjection/containers/actionTracingContainer.js` (addition)

```javascript
// ... existing imports ...
import TraceDirectoryManager from '../../actions/tracing/traceDirectoryManager.js';

export function registerActionTracing(container) {
  // ... existing registrations ...

  // Register TraceDirectoryManager
  container.register(
    actionTracingTokens.ITraceDirectoryManager,
    (deps) => {
      const logger = setup.setupService('TraceDirectoryManager', deps.logger, {
        fileSystem: {
          value: deps.fileSystem,
          requiredMethods: ['mkdir', 'access', 'stat'],
        },
      });

      return new TraceDirectoryManager({
        fileSystem: deps.fileSystem,
        logger,
      });
    },
    {
      lifetime: 'singleton',
      dependencies: {
        fileSystem: tokens.IFileSystem,
        logger: tokens.ILogger,
      },
    }
  );
}
```

### Step 5: Update Token Definitions

**File**: `src/dependencyInjection/tokens/actionTracingTokens.js` (addition)

```javascript
export const actionTracingTokens = {
  IActionTraceConfigLoader: Symbol('IActionTraceConfigLoader'),
  IActionTraceFilter: Symbol('IActionTraceFilter'),
  IActionTraceOutputService: Symbol('IActionTraceOutputService'),
  ITraceDirectoryManager: Symbol('ITraceDirectoryManager'),
};

// ... rest of existing exports ...
```

## Testing Strategy

### Step 6: Create Comprehensive Unit Tests

**File**: `tests/unit/actions/tracing/traceDirectoryManager.test.js`

```javascript
/**
 * @file Unit tests for TraceDirectoryManager
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraceDirectoryManagerTestBed } from '../../../common/actions/traceDirectoryManagerTestBed.js';

describe('TraceDirectoryManager', () => {
  let testBed;
  let dirManager;

  beforeEach(() => {
    testBed = new TraceDirectoryManagerTestBed();
    dirManager = testBed.createDirectoryManager();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should initialize with valid dependencies', () => {
      expect(dirManager).toBeDefined();
      expect(() => dirManager.clearCache()).not.toThrow();
    });

    it('should validate file system dependency', () => {
      expect(() =>
        testBed.createDirectoryManager({
          fileSystem: null,
        })
      ).toThrow('IFileSystem');
    });
  });

  describe('Directory Creation', () => {
    it('should create directory when it does not exist', async () => {
      testBed.mockFileSystem.access.mockRejectedValue({ code: 'ENOENT' });
      testBed.mockFileSystem.mkdir.mockResolvedValue();
      testBed.setupDirectoryExists('./traces/actions', true, true);

      const result = await dirManager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(result.existed).toBe(false);
      expect(result.writable).toBe(true);
      expect(testBed.mockFileSystem.mkdir).toHaveBeenCalledWith(
        'traces/actions',
        { recursive: true }
      );
    });

    it('should handle existing writable directory', async () => {
      testBed.setupDirectoryExists('./traces/actions', true, true);

      const result = await dirManager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(true);
      expect(result.created).toBe(false);
      expect(result.existed).toBe(true);
      expect(result.writable).toBe(true);
      expect(testBed.mockFileSystem.mkdir).not.toHaveBeenCalled();
    });

    it('should handle existing non-writable directory', async () => {
      testBed.setupDirectoryExists('./traces/actions', true, false);

      const result = await dirManager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.created).toBe(false);
      expect(result.existed).toBe(true);
      expect(result.writable).toBe(false);
      expect(result.error).toContain('not writable');
    });

    it('should cache successful directory operations', async () => {
      testBed.setupDirectoryExists('./traces/actions', true, true);

      // First call
      const result1 =
        await dirManager.ensureDirectoryExists('./traces/actions');
      // Second call
      const result2 =
        await dirManager.ensureDirectoryExists('./traces/actions');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.cached).toBe(true);

      // Should only check directory once
      expect(testBed.mockFileSystem.access).toHaveBeenCalledTimes(2); // First call checks exists + writable
    });
  });

  describe('Path Validation', () => {
    it('should validate safe paths', () => {
      const result = dirManager.validateDirectoryPath('./traces/actions');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.normalizedPath).toBe('traces/actions');
    });

    it('should reject path traversal attempts', () => {
      const result = dirManager.validateDirectoryPath('../../etc/passwd');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Path contains directory traversal sequences'
      );
    });

    it('should reject system directories', () => {
      const result = dirManager.validateDirectoryPath('/etc/traces');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Path points to system directory');
    });

    it('should reject paths with invalid characters', () => {
      const result = dirManager.validateDirectoryPath('traces/actions|test');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Path contains invalid characters');
    });

    it('should reject overly long paths', () => {
      const longPath = 'a'.repeat(300);
      const result = dirManager.validateDirectoryPath(longPath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Path exceeds maximum length');
    });
  });

  describe('Directory Information', () => {
    it('should provide comprehensive directory information', async () => {
      testBed.setupDirectoryExists('./traces', true, true);
      testBed.mockFileSystem.stat.mockResolvedValue({
        isDirectory: () => true,
        size: 4096,
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-02'),
        mode: 0o755,
      });

      const info = await dirManager.getDirectoryInfo('./traces');

      expect(info.exists).toBe(true);
      expect(info.writable).toBe(true);
      expect(info.isDirectory).toBe(true);
      expect(info.size).toBe(4096);
      expect(info.created).toEqual(new Date('2024-01-01'));
      expect(info.permissions).toBe(0o755);
    });

    it('should handle non-existent directories', async () => {
      testBed.setupDirectoryExists('./nonexistent', false, false);

      const info = await dirManager.getDirectoryInfo('./nonexistent');

      expect(info.exists).toBe(false);
      expect(info.writable).toBe(false);
      expect(info.parentExists).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle permission denied errors', async () => {
      testBed.mockFileSystem.access.mockRejectedValue({ code: 'ENOENT' });
      testBed.mockFileSystem.mkdir.mockRejectedValue({
        code: 'EACCES',
        message: 'Permission denied',
      });

      const result = await dirManager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should handle read-only filesystem errors', async () => {
      testBed.mockFileSystem.access.mockRejectedValue({ code: 'ENOENT' });
      testBed.mockFileSystem.mkdir.mockRejectedValue({
        code: 'EROFS',
        message: 'Read-only file system',
      });

      const result = await dirManager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('read-only');
    });

    it('should handle no space left errors', async () => {
      testBed.mockFileSystem.access.mockRejectedValue({ code: 'ENOENT' });
      testBed.mockFileSystem.mkdir.mockRejectedValue({
        code: 'ENOSPC',
        message: 'No space left on device',
      });

      const result = await dirManager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No space left');
    });
  });

  describe('Cache Management', () => {
    it('should clear directory cache', async () => {
      testBed.setupDirectoryExists('./traces/actions', true, true);

      await dirManager.ensureDirectoryExists('./traces/actions');
      expect(dirManager.getCachedDirectories()).toContain('traces/actions');

      dirManager.clearCache();
      expect(dirManager.getCachedDirectories()).toEqual([]);
    });

    it('should provide list of cached directories', async () => {
      testBed.setupDirectoryExists('./traces/actions', true, true);
      testBed.setupDirectoryExists('./traces/rules', true, true);

      await dirManager.ensureDirectoryExists('./traces/actions');
      await dirManager.ensureDirectoryExists('./traces/rules');

      const cached = dirManager.getCachedDirectories();
      expect(cached).toContain('traces/actions');
      expect(cached).toContain('traces/rules');
    });
  });
});
```

### Step 7: Create Test Helper

**File**: `tests/common/actions/traceDirectoryManagerTestBed.js`

```javascript
/**
 * @file Test helper for TraceDirectoryManager
 */

import TraceDirectoryManager from '../../../src/actions/tracing/traceDirectoryManager.js';

export class TraceDirectoryManagerTestBed {
  constructor() {
    this.mockFileSystem = {
      mkdir: jest.fn(),
      access: jest.fn(),
      stat: jest.fn(),
      constants: {
        W_OK: 2, // Write permission constant
      },
    };

    this.mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  }

  createDirectoryManager(overrides = {}) {
    const dependencies = {
      fileSystem: this.mockFileSystem,
      logger: this.mockLogger,
      ...overrides,
    };

    return new TraceDirectoryManager(dependencies);
  }

  /**
   * Setup mock filesystem to simulate directory existence and writability
   * @param {string} path - Directory path
   * @param {boolean} exists - Whether directory exists
   * @param {boolean} writable - Whether directory is writable
   */
  setupDirectoryExists(path, exists, writable) {
    const normalizedPath = path.replace(/\\/g, '/').replace(/^\.\//, '');

    if (exists) {
      // Directory exists - access succeeds
      this.mockFileSystem.access.mockImplementation((checkPath, mode) => {
        if (checkPath.includes(normalizedPath)) {
          if (mode === this.mockFileSystem.constants.W_OK && !writable) {
            const error = new Error('Permission denied');
            error.code = 'EACCES';
            throw error;
          }
          return Promise.resolve();
        }
        const error = new Error('No such file or directory');
        error.code = 'ENOENT';
        throw error;
      });

      this.mockFileSystem.stat.mockImplementation((checkPath) => {
        if (checkPath.includes(normalizedPath)) {
          return Promise.resolve({
            isDirectory: () => true,
            size: 4096,
            birthtime: new Date(),
            mtime: new Date(),
            mode: 0o755,
          });
        }
        const error = new Error('No such file or directory');
        error.code = 'ENOENT';
        throw error;
      });
    } else {
      // Directory doesn't exist - access fails
      this.mockFileSystem.access.mockImplementation((checkPath) => {
        if (checkPath.includes(normalizedPath)) {
          const error = new Error('No such file or directory');
          error.code = 'ENOENT';
          throw error;
        }
        return Promise.resolve();
      });

      this.mockFileSystem.stat.mockImplementation((checkPath) => {
        if (checkPath.includes(normalizedPath)) {
          const error = new Error('No such file or directory');
          error.code = 'ENOENT';
          throw error;
        }
        return Promise.resolve({
          isDirectory: () => true,
          size: 4096,
          birthtime: new Date(),
          mtime: new Date(),
          mode: 0o755,
        });
      });
    }
  }

  /**
   * Setup filesystem error for testing error conditions
   * @param {string} operation - Operation that should fail ('mkdir', 'access', 'stat')
   * @param {string} errorCode - Error code to simulate
   * @param {string} message - Error message
   */
  setupFilesystemError(operation, errorCode, message = 'Simulated error') {
    const error = new Error(message);
    error.code = errorCode;

    this.mockFileSystem[operation].mockRejectedValue(error);
  }

  cleanup() {
    jest.clearAllMocks();
  }
}
```

### Step 8: Create Utility Tests

**File**: `tests/unit/actions/tracing/directoryUtils.test.js`

```javascript
/**
 * @file Unit tests for directory utilities
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ensureMultipleDirectories,
  getStandardTraceDirectories,
  validateTraceOutputPath,
} from '../../../../src/actions/tracing/directoryUtils.js';

describe('Directory Utilities', () => {
  describe('ensureMultipleDirectories', () => {
    it('should process multiple directories', async () => {
      const mockDirectoryManager = {
        ensureDirectoryExists: jest
          .fn()
          .mockResolvedValueOnce({ success: true, path: 'traces' })
          .mockResolvedValueOnce({ success: true, path: 'traces/actions' })
          .mockResolvedValueOnce({
            success: false,
            path: 'traces/readonly',
            error: 'Permission denied',
          }),
      };

      const result = await ensureMultipleDirectories(mockDirectoryManager, [
        './traces',
        './traces/actions',
        './traces/readonly',
      ]);

      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.allSuccessful).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Permission denied');
    });
  });

  describe('getStandardTraceDirectories', () => {
    it('should return standard directory structure', () => {
      const dirs = getStandardTraceDirectories('./custom-traces');

      expect(dirs).toEqual([
        './custom-traces',
        './custom-traces/actions',
        './custom-traces/actions/archive',
      ]);
    });

    it('should use default base directory', () => {
      const dirs = getStandardTraceDirectories();

      expect(dirs[0]).toBe('./traces');
    });
  });

  describe('validateTraceOutputPath', () => {
    it('should validate safe paths', () => {
      const result = validateTraceOutputPath('./traces/actions');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject dangerous paths', () => {
      const result = validateTraceOutputPath('../../../etc');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
```

### Step 9: Integration Tests

**File**: `tests/integration/actions/tracing/traceDirectoryManager.integration.test.js`

```javascript
/**
 * @file Integration tests for TraceDirectoryManager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestContainerWithDefaults } from '../../../common/testContainerFactory.js';
import { actionTracingTokens } from '../../../../src/dependencyInjection/tokens/actionTracingTokens.js';
import path from 'path';
import { promises as fs } from 'fs';

describe('TraceDirectoryManager Integration', () => {
  let container;
  let directoryManager;
  let tempTestDir;

  beforeEach(async () => {
    container = createTestContainerWithDefaults();
    directoryManager = container.resolve(
      actionTracingTokens.ITraceDirectoryManager
    );

    // Create temporary directory for testing
    tempTestDir = path.join(process.cwd(), 'tmp-test-traces');
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    if (container?.dispose) {
      container.dispose();
    }
  });

  it('should create actual directory structure', async () => {
    const testDir = path.join(tempTestDir, 'actions');

    const result = await directoryManager.ensureDirectoryExists(testDir);

    expect(result.success).toBe(true);
    expect(result.created).toBe(true);

    // Verify directory actually exists
    const stats = await fs.stat(testDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should handle nested directory creation', async () => {
    const nestedDir = path.join(tempTestDir, 'deep', 'nested', 'actions');

    const result = await directoryManager.ensureDirectoryExists(nestedDir);

    expect(result.success).toBe(true);
    expect(result.recursive).toBe(true);

    // Verify all nested directories exist
    const stats = await fs.stat(nestedDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should provide accurate directory information', async () => {
    const testDir = path.join(tempTestDir, 'info-test');
    await fs.mkdir(testDir, { recursive: true });

    const info = await directoryManager.getDirectoryInfo(testDir);

    expect(info.exists).toBe(true);
    expect(info.isDirectory).toBe(true);
    expect(info.writable).toBe(true);
    expect(info.size).toBeGreaterThan(0);
    expect(info.created).toBeInstanceOf(Date);
  });
});
```

## Performance Considerations

- **Directory Caching**: Cache successful directory operations to avoid redundant filesystem checks
- **Batch Operations**: Support batch directory creation for better performance
- **Error Categorization**: Quick identification of error types to avoid retries on permanent failures
- **Path Normalization**: Normalize paths once and cache results

## Cross-Platform Compatibility

- **Path Separators**: Normalize to forward slashes for consistency
- **Permission Checking**: Use filesystem constants for cross-platform permission checks
- **Error Codes**: Handle platform-specific filesystem error codes
- **Path Limits**: Account for different filesystem path length limitations

## Files Created

- [ ] `src/actions/tracing/traceDirectoryManager.js`
- [ ] `src/actions/tracing/directoryUtils.js`
- [ ] `tests/unit/actions/tracing/traceDirectoryManager.test.js`
- [ ] `tests/unit/actions/tracing/directoryUtils.test.js`
- [ ] `tests/common/actions/traceDirectoryManagerTestBed.js`
- [ ] `tests/integration/actions/tracing/traceDirectoryManager.integration.test.js`

## Files Modified

- [ ] `src/dependencyInjection/tokens/actionTracingTokens.js` (add ITraceDirectoryManager)
- [ ] `src/dependencyInjection/containers/actionTracingContainer.js` (register TraceDirectoryManager)

## Definition of Done

- [ ] TraceDirectoryManager class implemented with all methods
- [ ] Path validation covers security concerns and filesystem limits
- [ ] Directory creation supports nested structures with proper permissions
- [ ] Cross-platform compatibility verified (Windows/Linux/macOS)
- [ ] Comprehensive error handling with user-friendly messages
- [ ] Directory caching improves performance for repeated operations
- [ ] Unit tests achieve 80%+ coverage including edge cases
- [ ] Integration tests verify actual filesystem operations
- [ ] Utility functions for common directory tasks
- [ ] All tests pass on multiple platforms
- [ ] Documentation includes usage examples
- [ ] Memory usage optimized with proper cleanup
- [ ] Code review completed
- [ ] No security vulnerabilities in path handling
- [ ] Integration with DI container working
- [ ] Code committed with descriptive message

## Usage Examples

### Basic Directory Creation

```javascript
const dirManager = container.resolve('ITraceDirectoryManager');

// Ensure trace directory exists
const result = await dirManager.ensureDirectoryExists('./traces/actions');

if (result.success) {
  console.log(`Directory ready: ${result.path}`);
} else {
  console.error(`Failed to create directory: ${result.error}`);
}
```

### Batch Directory Setup

```javascript
import {
  ensureMultipleDirectories,
  getStandardTraceDirectories,
} from './directoryUtils.js';

const directories = getStandardTraceDirectories('./custom-traces');
const results = await ensureMultipleDirectories(dirManager, directories);

console.log(
  `Created ${results.successCount} of ${results.totalCount} directories`
);
```

### Path Validation

```javascript
const validation = dirManager.validateDirectoryPath(userInputPath);

if (!validation.isValid) {
  console.error('Invalid path:', validation.errors.join(', '));
}
```

## Security Considerations

- **Path Traversal Protection**: Reject paths containing `../` sequences
- **System Directory Protection**: Block access to system directories (`/etc`, `/var`, etc.)
- **Input Sanitization**: Validate and normalize all path inputs
- **Permission Validation**: Check write permissions before attempting operations
- **Error Information**: Avoid exposing sensitive filesystem information in error messages

## Next Steps

After completion of this ticket:

1. **ACTTRA-024**: Implement ActionTraceOutputService using TraceDirectoryManager
2. **ACTTRA-025**: Add async queue processing with directory management
3. Integration testing with complete action tracing pipeline

---

**Estimated Time**: 1 hour  
**Complexity**: Low  
**Priority**: Low  
**Phase**: 1 - Configuration and Filtering
