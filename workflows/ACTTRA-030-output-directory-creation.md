# ACTTRA-030: Create Output Directory Auto-Creation

## Summary

Implement automatic creation and validation of output directories for action trace files, including permission checking, path validation, and error recovery. This ensures trace output always has a valid destination without manual directory setup.

## Status

- **Type**: Implementation
- **Priority**: Low
- **Complexity**: Low
- **Estimated Time**: 1 hour
- **Dependencies**:
  - ACTTRA-024 (ActionTraceOutputService)

## Objectives

### Primary Goals

1. **Auto-Create Directories** - Create missing directories automatically
2. **Permission Validation** - Check write permissions
3. **Path Security** - Prevent directory traversal attacks
4. **Error Recovery** - Handle creation failures gracefully
5. **Nested Paths** - Support deep directory structures
6. **Cross-Platform** - Work on Windows, Mac, Linux

### Success Criteria

- [ ] Directories created on first use
- [ ] Nested paths created recursively
- [ ] Permissions validated before writing
- [ ] Path traversal attacks prevented
- [ ] Errors handled without crashes
- [ ] Works on all platforms
- [ ] Efficient with caching
- [ ] Clear error messages

## Technical Specification

### 1. Directory Manager Implementation

#### File: `src/actions/tracing/directoryManager.js`

```javascript
/**
 * @file Manages directory creation and validation for trace output
 * @see actionTraceOutputService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import path from 'path';
import fs from 'fs/promises';
import { constants } from 'fs';
import os from 'os';

/**
 * Directory validation results
 * @enum {string}
 */
export const DirectoryStatus = {
  EXISTS: 'exists',
  CREATED: 'created',
  FAILED: 'failed',
  PERMISSION_DENIED: 'permission_denied',
  INVALID_PATH: 'invalid_path',
};

/**
 * Manages output directory creation and validation
 */
export class DirectoryManager {
  #fileSystem;
  #logger;
  #directoryCache;
  #permissionCache;
  #basePath;
  #maxDepth;
  #defaultPermissions;

  /**
   * Constructor
   * @param {object} dependencies
   * @param {IFileSystem} dependencies.fileSystem - File system interface
   * @param {ILogger} dependencies.logger - Logger service
   * @param {object} options - Configuration options
   */
  constructor({ fileSystem, logger }, options = {}) {
    validateDependency(fileSystem, 'IFileSystem', null, {
      requiredMethods: ['mkdir', 'access', 'stat', 'realpath'],
    });

    this.#fileSystem = fileSystem;
    this.#logger = ensureValidLogger(logger, 'DirectoryManager');

    // Configuration
    this.#basePath = options.basePath || process.cwd();
    this.#maxDepth = options.maxDepth || 10;
    this.#defaultPermissions = options.permissions || 0o755;

    // Caches for performance
    this.#directoryCache = new Map();
    this.#permissionCache = new Map();

    // Cache TTL
    this.#startCacheCleanup();
  }

  /**
   * Ensure directory exists and is writable
   * @param {string} dirPath - Directory path
   * @returns {Promise<object>} Result with status and path
   */
  async ensureDirectory(dirPath) {
    const startTime = Date.now();

    try {
      // Validate path first
      const validation = await this.#validatePath(dirPath);
      if (!validation.valid) {
        return {
          status: DirectoryStatus.INVALID_PATH,
          path: dirPath,
          error: validation.error,
          duration: Date.now() - startTime,
        };
      }

      // Check cache
      if (this.#directoryCache.has(validation.resolved)) {
        const cached = this.#directoryCache.get(validation.resolved);
        if (cached.timestamp > Date.now() - 60000) {
          // 1 minute cache
          this.#logger.debug(
            `DirectoryManager: Using cached status for ${validation.resolved}`
          );
          return cached.result;
        }
      }

      // Check if directory exists
      const exists = await this.#directoryExists(validation.resolved);

      if (exists) {
        // Check permissions
        const hasPermission = await this.#checkPermissions(validation.resolved);

        if (hasPermission) {
          const result = {
            status: DirectoryStatus.EXISTS,
            path: validation.resolved,
            duration: Date.now() - startTime,
          };

          this.#cacheResult(validation.resolved, result);
          return result;
        } else {
          return {
            status: DirectoryStatus.PERMISSION_DENIED,
            path: validation.resolved,
            error: 'No write permission',
            duration: Date.now() - startTime,
          };
        }
      }

      // Create directory
      const created = await this.#createDirectory(validation.resolved);

      if (created) {
        const result = {
          status: DirectoryStatus.CREATED,
          path: validation.resolved,
          duration: Date.now() - startTime,
        };

        this.#cacheResult(validation.resolved, result);
        this.#logger.info(
          `DirectoryManager: Created directory ${validation.resolved}`
        );
        return result;
      } else {
        return {
          status: DirectoryStatus.FAILED,
          path: validation.resolved,
          error: 'Failed to create directory',
          duration: Date.now() - startTime,
        };
      }
    } catch (error) {
      this.#logger.error(
        `DirectoryManager: Error ensuring directory ${dirPath}`,
        error
      );
      return {
        status: DirectoryStatus.FAILED,
        path: dirPath,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate path for security and correctness
   * @private
   */
  async #validatePath(dirPath) {
    const result = {
      valid: false,
      resolved: null,
      error: null,
    };

    try {
      // Check for null/undefined
      if (!dirPath) {
        result.error = 'Path is required';
        return result;
      }

      // Normalize path
      const normalized = path.normalize(dirPath);

      // Check for directory traversal attempts
      if (this.#hasDirectoryTraversal(normalized)) {
        result.error = 'Directory traversal detected';
        this.#logger.warn(
          `DirectoryManager: Directory traversal attempt: ${dirPath}`
        );
        return result;
      }

      // Resolve to absolute path
      const absolute = path.isAbsolute(normalized)
        ? normalized
        : path.join(this.#basePath, normalized);

      // Check path depth
      const depth = absolute.split(path.sep).length;
      if (depth > this.#maxDepth) {
        result.error = `Path too deep (max ${this.#maxDepth} levels)`;
        return result;
      }

      // Check if path is within allowed base path
      if (!this.#isWithinBasePath(absolute)) {
        result.error = 'Path outside allowed directory';
        return result;
      }

      // Platform-specific validation
      if (!this.#isValidForPlatform(absolute)) {
        result.error = 'Invalid path for current platform';
        return result;
      }

      result.valid = true;
      result.resolved = absolute;
      return result;
    } catch (error) {
      result.error = error.message;
      return result;
    }
  }

  /**
   * Check for directory traversal patterns
   * @private
   */
  #hasDirectoryTraversal(dirPath) {
    const dangerous = ['..', '..\\', '../', '\\..\\', '/../'];

    const normalized = dirPath.toLowerCase();
    return dangerous.some((pattern) => normalized.includes(pattern));
  }

  /**
   * Check if path is within base path
   * @private
   */
  #isWithinBasePath(absolutePath) {
    // Allow specific system directories
    const allowedPaths = [
      this.#basePath,
      path.join(this.#basePath, 'traces'),
      path.join(this.#basePath, 'logs'),
      os.tmpdir(),
    ];

    return allowedPaths.some((allowed) => absolutePath.startsWith(allowed));
  }

  /**
   * Validate path for current platform
   * @private
   */
  #isValidForPlatform(dirPath) {
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows-specific validation
      const invalidChars = /[<>:"|?*]/;
      const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

      const parts = dirPath.split(path.sep);
      for (const part of parts) {
        if (invalidChars.test(part) || reservedNames.test(part)) {
          return false;
        }
      }

      // Check for valid drive letter
      if (path.isAbsolute(dirPath)) {
        const drive = dirPath[0];
        if (!/[A-Za-z]/.test(drive)) {
          return false;
        }
      }
    } else {
      // Unix-like validation
      const invalidChars = /[\0]/; // Null character
      if (invalidChars.test(dirPath)) {
        return false;
      }
    }

    // Check path length limits
    const maxPath = platform === 'win32' ? 260 : 4096;
    if (dirPath.length > maxPath) {
      return false;
    }

    return true;
  }

  /**
   * Check if directory exists
   * @private
   */
  async #directoryExists(dirPath) {
    try {
      const stats = await this.#fileSystem.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Check directory permissions
   * @private
   */
  async #checkPermissions(dirPath) {
    // Check cache first
    if (this.#permissionCache.has(dirPath)) {
      const cached = this.#permissionCache.get(dirPath);
      if (cached.timestamp > Date.now() - 300000) {
        // 5 minute cache
        return cached.hasPermission;
      }
    }

    try {
      // Check for read and write permissions
      await this.#fileSystem.access(dirPath, constants.R_OK | constants.W_OK);

      // Test write by creating a temp file
      const testFile = path.join(dirPath, `.write_test_${Date.now()}`);
      try {
        await this.#fileSystem.writeFile(testFile, '');
        await this.#fileSystem.unlink(testFile);

        // Cache success
        this.#permissionCache.set(dirPath, {
          hasPermission: true,
          timestamp: Date.now(),
        });

        return true;
      } catch (writeError) {
        this.#logger.warn(
          `DirectoryManager: Cannot write to ${dirPath}`,
          writeError
        );

        // Cache failure
        this.#permissionCache.set(dirPath, {
          hasPermission: false,
          timestamp: Date.now(),
        });

        return false;
      }
    } catch (error) {
      this.#logger.warn(
        `DirectoryManager: Permission check failed for ${dirPath}`,
        error
      );
      return false;
    }
  }

  /**
   * Create directory recursively
   * @private
   */
  async #createDirectory(dirPath) {
    try {
      await this.#fileSystem.mkdir(dirPath, {
        recursive: true,
        mode: this.#defaultPermissions,
      });

      // Verify creation
      const exists = await this.#directoryExists(dirPath);
      if (!exists) {
        this.#logger.error(
          `DirectoryManager: Directory creation verified failed for ${dirPath}`
        );
        return false;
      }

      // Verify permissions
      const hasPermission = await this.#checkPermissions(dirPath);
      if (!hasPermission) {
        this.#logger.error(
          `DirectoryManager: Created directory but no write permission for ${dirPath}`
        );
        return false;
      }

      return true;
    } catch (error) {
      this.#logger.error(
        `DirectoryManager: Failed to create directory ${dirPath}`,
        error
      );

      // Handle specific errors
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        this.#logger.error('DirectoryManager: Permission denied');
      } else if (error.code === 'ENOSPC') {
        this.#logger.error('DirectoryManager: No space left on device');
      } else if (error.code === 'EROFS') {
        this.#logger.error('DirectoryManager: Read-only file system');
      }

      return false;
    }
  }

  /**
   * Cache directory result
   * @private
   */
  #cacheResult(dirPath, result) {
    this.#directoryCache.set(dirPath, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Start cache cleanup timer
   * @private
   */
  #startCacheCleanup() {
    setInterval(() => {
      this.#cleanupCache();
    }, 300000); // Clean every 5 minutes
  }

  /**
   * Clean expired cache entries
   * @private
   */
  #cleanupCache() {
    const now = Date.now();
    const maxAge = 600000; // 10 minutes

    // Clean directory cache
    for (const [key, value] of this.#directoryCache) {
      if (now - value.timestamp > maxAge) {
        this.#directoryCache.delete(key);
      }
    }

    // Clean permission cache
    for (const [key, value] of this.#permissionCache) {
      if (now - value.timestamp > maxAge) {
        this.#permissionCache.delete(key);
      }
    }

    this.#logger.debug(
      `DirectoryManager: Cache cleanup - directories: ${this.#directoryCache.size}, permissions: ${this.#permissionCache.size}`
    );
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.#directoryCache.clear();
    this.#permissionCache.clear();
    this.#logger.info('DirectoryManager: Caches cleared');
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getCacheStats() {
    return {
      directories: this.#directoryCache.size,
      permissions: this.#permissionCache.size,
    };
  }

  /**
   * Create a test directory to verify functionality
   * @param {string} testPath - Path to test
   * @returns {Promise<boolean>} Success status
   */
  async testDirectoryCreation(testPath = './test_trace_output') {
    this.#logger.info(
      `DirectoryManager: Testing directory creation at ${testPath}`
    );

    const result = await this.ensureDirectory(testPath);

    if (
      result.status === DirectoryStatus.CREATED ||
      result.status === DirectoryStatus.EXISTS
    ) {
      // Try to clean up test directory
      try {
        await this.#fileSystem.rmdir(result.path);
        this.#logger.info(
          'DirectoryManager: Test successful, cleaned up test directory'
        );
      } catch (error) {
        this.#logger.debug(
          'DirectoryManager: Could not remove test directory',
          error
        );
      }

      return true;
    }

    this.#logger.error('DirectoryManager: Test failed', result);
    return false;
  }
}

export default DirectoryManager;
```

### 2. Integration with ActionTraceOutputService

#### Update: `src/actions/tracing/actionTraceOutputService.js`

```javascript
// Add to constructor
constructor({ fileSystem, logger, actionTraceFilter }) {
  // ... existing code ...

  // Initialize directory manager
  this.#directoryManager = new DirectoryManager({
    fileSystem: this.#fileSystem,
    logger: this.#logger,
  }, {
    basePath: process.cwd(),
    maxDepth: 10,
  });

  // Track directory creation status
  this.#directoryCreated = false;
  this.#directoryValid = false;
}

// Update #ensureDirectoryExists method
async #ensureDirectoryExists(directory) {
  // Use directory manager
  const result = await this.#directoryManager.ensureDirectory(directory);

  switch (result.status) {
    case DirectoryStatus.EXISTS:
    case DirectoryStatus.CREATED:
      this.#directoryValid = true;
      this.#logger.info(
        `ActionTraceOutputService: Output directory ready at ${result.path}`
      );
      break;

    case DirectoryStatus.PERMISSION_DENIED:
      throw new Error(`No write permission for directory: ${directory}`);

    case DirectoryStatus.INVALID_PATH:
      throw new Error(`Invalid directory path: ${result.error}`);

    case DirectoryStatus.FAILED:
      throw new Error(`Failed to create directory: ${result.error}`);

    default:
      throw new Error(`Unknown directory status: ${result.status}`);
  }
}

// Add validation method
async validateOutputDirectory() {
  const outputDir = this.#actionTraceFilter.getOutputDirectory();
  const result = await this.#directoryManager.ensureDirectory(outputDir);

  return {
    valid: result.status === DirectoryStatus.EXISTS ||
           result.status === DirectoryStatus.CREATED,
    status: result.status,
    path: result.path,
    error: result.error,
  };
}
```

## Implementation Notes

### Security Considerations

1. **Path Traversal Prevention**
   - Check for `..` patterns
   - Validate absolute paths
   - Restrict to base directory

2. **Permission Validation**
   - Test actual write capability
   - Handle permission errors
   - Cache results safely

3. **Platform Differences**
   - Windows path limits
   - Reserved names
   - Drive letters
   - Unix permissions

### Performance Optimizations

1. **Caching**
   - Cache directory status
   - Cache permission checks
   - TTL-based expiration

2. **Batch Operations**
   - Create nested paths once
   - Minimize stat calls
   - Reuse validation results

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/actions/tracing/directoryManager.unit.test.js

describe('DirectoryManager - Directory Creation', () => {
  it('should create missing directories');
  it('should handle nested paths');
  it('should validate permissions');
  it('should prevent directory traversal');
  it('should handle platform differences');
  it('should cache results efficiently');
  it('should handle creation failures');
  it('should validate path security');
});
```

### Integration Tests

```javascript
// tests/integration/actions/tracing/directoryCreation.integration.test.js

describe('Directory Creation Integration', () => {
  it('should create directories on first trace write');
  it('should handle concurrent directory creation');
  it('should recover from permission errors');
  it('should work across platforms');
});
```

## Error Handling

### Error Scenarios

1. **Permission Denied**
   - No write access
   - Read-only filesystem
   - User restrictions

2. **Invalid Path**
   - Directory traversal
   - Invalid characters
   - Path too long

3. **Disk Issues**
   - No space left
   - Disk errors
   - Network drive issues

### Recovery Strategies

1. **Fallback Paths**
   - Try temp directory
   - Use home directory
   - Log to memory

2. **User Notification**
   - Clear error messages
   - Suggest solutions
   - Configuration help

## Dependencies

- `IFileSystem` - File operations
- `ILogger` - Logging
- `path` - Path manipulation
- `os` - Platform detection

## Platform Support

### Windows

- Handle drive letters
- Reserved names (CON, PRN, etc.)
- Path length limits (260 chars)
- Backslash separators

### macOS/Linux

- Unix permissions
- Case sensitivity
- Symbolic links
- Path length (4096 chars)

## Next Steps

This completes Phase 4: Output Generation. Next phases would include:

- Phase 5: Testing & Documentation
- Integration with existing systems
- Performance optimization
- Production deployment

---

**Ticket Status**: Ready for Implementation
**Last Updated**: 2025-01-10
**Author**: System Architect
