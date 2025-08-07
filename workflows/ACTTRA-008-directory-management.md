# ACTTRA-008: Create Trace Output Directory Management (Browser-Based)

## Overview

Implement browser-compatible trace output directory management using the File System Access API. This utility ensures that the action tracing system can write files to the configured output directory in a browser environment, handling directory creation and permission management through the browser's File System Access API.

## Priority

**LOW** - Infrastructure support utility

## Dependencies

- **Enables**: ACTTRA-024 (ActionTraceOutputService)
- **Related**: ACTTRA-006 (configuration loader), ACTTRA-007 (path validation)
- **Requires**: Browser File System Access API through existing IStorageProvider interface

## Acceptance Criteria

- [ ] TraceDirectoryManager class for browser-based directory operations
- [ ] Auto-creation of trace output directories using File System Access API
- [ ] Path validation and sanitization for browser environment
- [ ] Permission handling through browser permission prompts
- [ ] Support for nested directory structures
- [ ] Integration with existing IStorageProvider interface
- [ ] Graceful handling of permission denials and user cancellations
- [ ] Comprehensive logging of directory operations
- [ ] Unit tests with mocked browser APIs
- [ ] Browser-compatible path handling (forward slashes)

## Current Directory Structure

Based on the specification, trace files will be written to:

**Default Location**: `./traces/actions/` (relative to user-selected root directory)

**File Structure**:

```
traces/
└── actions/
    ├── core-go_2024-01-15_10-30-00.json
    ├── core-go_2024-01-15_10-30-00.txt
    ├── core-look_2024-01-15_10-31-15.json
    └── core-look_2024-01-15_10-31-15.txt
```

**Important Note**: Directory creation happens within the user-selected root directory through browser File System Access API.

## Implementation Steps

### Step 1: Analyze Existing Browser Storage Integration

Review current browser storage patterns in the codebase:

```bash
# Find existing storage usage
grep -r "IStorageProvider" src/
grep -r "BrowserStorageProvider" src/
grep -r "FileSystemDirectoryHandle" src/

# Check for directory creation patterns
grep -r "getDirectoryHandle" src/
```

Expected patterns:

- IStorageProvider interface for storage operations
- BrowserStorageProvider for File System Access API
- Browser permission handling
- FileSystemDirectoryHandle for directories

### Step 2: Create TraceDirectoryManager Class

**File**: `src/actions/tracing/traceDirectoryManager.js`

```javascript
/**
 * @file Browser-based directory management for action tracing system
 * Handles creation and validation of trace output directories using File System Access API
 */

import {
  validateDependency,
  assertNonBlankString,
} from '../../utils/validationUtils.js';
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
   * @param {Object} dependencies
   * @param {import('../../interfaces/IStorageProvider.js').IStorageProvider} dependencies.storageProvider - Storage service
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   */
  constructor({ storageProvider, logger }) {
    validateDependency(storageProvider, 'IStorageProvider', null, {
      requiredMethods: ['getRootHandle', 'ensureDirectoryExists'],
    });
    this.#logger = ensureValidLogger(logger, 'TraceDirectoryManager');

    this.#storageProvider = storageProvider;
    this.#createdDirectories = new Set();
    this.#rootHandle = null;
  }

  /**
   * Ensure directory exists within the browser's sandboxed filesystem
   * @param {string} directoryPath - Path to directory (relative to root)
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
   * @param {string} directoryPath - Path to validate
   * @returns {ValidationResult} Validation result
   */
  validateDirectoryPath(directoryPath) {
    assertNonBlankString(directoryPath, 'Directory path is required');

    const normalizedPath = this.#normalizePath(directoryPath);
    return this.#validatePath(normalizedPath);
  }

  /**
   * Get the root directory handle from storage provider
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
   * @returns {string[]} List of directory paths
   */
  getCachedDirectories() {
    return Array.from(this.#createdDirectories);
  }

  /**
   * Normalize path for consistent handling in browser
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
 * @typedef {Object} DirectoryResult
 * @property {boolean} success - Whether operation succeeded
 * @property {string} path - Normalized directory path
 * @property {boolean} existed - Whether directory existed before operation
 * @property {boolean} created - Whether directory was created
 * @property {boolean} writable - Whether directory is writable
 * @property {boolean} [cached] - Whether result came from cache
 * @property {string} [error] - Error message if operation failed
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether path is valid
 * @property {string[]} errors - List of validation errors
 * @property {string} normalizedPath - Normalized version of the path
 */
```

### Step 3: Update Storage Provider Interface

Since the browser storage provider needs to support directory operations, we should extend it:

**Note**: This would require extending `BrowserStorageProvider` with directory-specific methods. For now, the `TraceDirectoryManager` handles this directly.

### Step 4: Integration with DI Container

Update the action tracing registrations to include the directory manager:

**File**: `src/dependencyInjection/registrations/actionTracingRegistrations.js` (addition)

```javascript
// Add to existing imports
import TraceDirectoryManager from '../../actions/tracing/traceDirectoryManager.js';

// Add to registerActionTracing function after existing registrations:

  // Register TraceDirectoryManager
  container.register(
    tokens.ITraceDirectoryManager,
    (c) =>
      new TraceDirectoryManager({
        storageProvider: c.resolve(tokens.IStorageProvider),
        logger: c.resolve(tokens.ILogger),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Action Tracing Registration: Registered ${String(tokens.ITraceDirectoryManager)}.`
  );
```

### Step 5: Update Token Definitions

**File**: `src/dependencyInjection/tokens/actionTracingTokens.js` (modification)

```javascript
import { freeze } from '../../utils/cloneUtils.js';

/**
 * @file Action tracing DI tokens.
 * @typedef {string} DiToken
 */

/**
 * Action tracing tokens for dependency injection.
 *
 * @type {Readonly<Record<string, DiToken>>}
 */
export const actionTracingTokens = freeze({
  IActionTraceConfigLoader: 'IActionTraceConfigLoader',
  IActionTraceConfigValidator: 'IActionTraceConfigValidator',
  IActionTraceFilter: 'IActionTraceFilter',
  IActionTraceOutputService: 'IActionTraceOutputService',
  ITraceDirectoryManager: 'ITraceDirectoryManager',
});
```

## Testing Strategy

### Step 6: Create Comprehensive Unit Tests

**File**: `tests/unit/actions/tracing/traceDirectoryManager.test.js`

```javascript
/**
 * @file Unit tests for browser-based TraceDirectoryManager
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import TraceDirectoryManager from '../../../../src/actions/tracing/traceDirectoryManager.js';

describe('TraceDirectoryManager', () => {
  let manager;
  let mockStorageProvider;
  let mockLogger;
  let mockDirectoryHandle;

  beforeEach(() => {
    // Mock FileSystemDirectoryHandle
    mockDirectoryHandle = {
      name: 'test-dir',
      kind: 'directory',
      getDirectoryHandle: jest.fn(),
      queryPermission: jest.fn().mockResolvedValue('granted'),
      requestPermission: jest.fn().mockResolvedValue('granted'),
    };

    // Mock window.showDirectoryPicker
    global.window = {
      showDirectoryPicker: jest.fn().mockResolvedValue(mockDirectoryHandle),
    };

    mockStorageProvider = {
      getRootHandle: jest.fn().mockResolvedValue(mockDirectoryHandle),
      ensureDirectoryExists: jest.fn().mockResolvedValue({ success: true }),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    manager = new TraceDirectoryManager({
      storageProvider: mockStorageProvider,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.window;
  });

  describe('Constructor', () => {
    it('should initialize with valid dependencies', () => {
      expect(manager).toBeDefined();
      expect(() => manager.clearCache()).not.toThrow();
    });

    it('should validate storage provider dependency', () => {
      expect(
        () =>
          new TraceDirectoryManager({
            storageProvider: null,
            logger: mockLogger,
          })
      ).toThrow('IStorageProvider');
    });
  });

  describe('Directory Creation', () => {
    it('should create directory when it does not exist', async () => {
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValue(
        mockDirectoryHandle
      );

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(result.writable).toBe(true);
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith(
        'traces',
        { create: true }
      );
    });

    it('should handle permission denial', async () => {
      mockDirectoryHandle.queryPermission.mockResolvedValue('denied');
      mockDirectoryHandle.requestPermission.mockResolvedValue('denied');
      global.window.showDirectoryPicker.mockResolvedValue(mockDirectoryHandle);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('denied');
    });

    it('should cache successful directory operations', async () => {
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValue(
        mockDirectoryHandle
      );

      // First call
      const result1 = await manager.ensureDirectoryExists('./traces/actions');
      // Second call
      const result2 = await manager.ensureDirectoryExists('./traces/actions');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.cached).toBe(true);

      // Should only create directory once
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledTimes(2); // traces + actions
    });

    it('should handle user cancellation', async () => {
      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';
      global.window.showDirectoryPicker.mockRejectedValue(abortError);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('denied');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User cancelled directory selection'
      );
    });
  });

  describe('Path Validation', () => {
    it('should validate safe paths', () => {
      const result = manager.validateDirectoryPath('./traces/actions');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.normalizedPath).toBe('traces/actions');
    });

    it('should reject path traversal attempts', () => {
      const result = manager.validateDirectoryPath('../../etc/passwd');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Path contains directory traversal sequences'
      );
    });

    it('should reject paths with invalid characters', () => {
      const result = manager.validateDirectoryPath('traces/actions|test');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Path contains invalid characters');
    });

    it('should reject reserved Windows names', () => {
      const result = manager.validateDirectoryPath('traces/con/test');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Path contains reserved name: con');
    });

    it('should normalize paths correctly', () => {
      const result = manager.validateDirectoryPath(
        './traces//actions/archive/'
      );

      expect(result.isValid).toBe(true);
      expect(result.normalizedPath).toBe('traces/actions/archive');
    });
  });

  describe('Cache Management', () => {
    it('should clear directory cache', async () => {
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValue(
        mockDirectoryHandle
      );

      await manager.ensureDirectoryExists('./traces/actions');
      expect(manager.getCachedDirectories()).toContain('traces/actions');

      manager.clearCache();
      expect(manager.getCachedDirectories()).toEqual([]);
    });

    it('should provide list of cached directories', async () => {
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValue(
        mockDirectoryHandle
      );

      await manager.ensureDirectoryExists('./traces/actions');
      await manager.ensureDirectoryExists('./traces/rules');

      const cached = manager.getCachedDirectories();
      expect(cached).toContain('traces/actions');
      expect(cached).toContain('traces/rules');
    });
  });

  describe('Error Handling', () => {
    it('should handle NotAllowedError', async () => {
      const error = new Error('Not allowed');
      error.name = 'NotAllowedError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should handle QuotaExceededError', async () => {
      const error = new Error('Quota exceeded');
      error.name = 'QuotaExceededError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage quota exceeded');
    });

    it('should handle TypeMismatchError', async () => {
      const error = new Error('Type mismatch');
      error.name = 'TypeMismatchError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a directory');
    });
  });
});
```

## Performance Considerations

- **Directory Caching**: Cache successful directory operations to avoid redundant permission checks
- **Handle Reuse**: Reuse FileSystemDirectoryHandle instances to minimize permission prompts
- **Error Categorization**: Quick identification of error types to avoid retries on permanent failures
- **Path Normalization**: Normalize paths once and cache results

## Browser Compatibility

- **File System Access API**: Chrome 86+, Edge 86+, Opera 72+
- **Not supported**: Firefox, Safari (as of 2024)
- **Fallback options**: IndexedDB for browsers without File System Access API
- **Progressive Enhancement**: Detect API availability and provide appropriate fallback

## Files Created

- [ ] `src/actions/tracing/traceDirectoryManager.js`
- [ ] `tests/unit/actions/tracing/traceDirectoryManager.test.js`

## Files Modified

- [ ] `src/dependencyInjection/tokens/actionTracingTokens.js` (add ITraceDirectoryManager)
- [ ] `src/dependencyInjection/registrations/actionTracingRegistrations.js` (register TraceDirectoryManager)

## Definition of Done

- [ ] TraceDirectoryManager class implemented for browser environment
- [ ] Path validation covers security concerns and browser limitations
- [ ] Directory creation through File System Access API
- [ ] Browser permission handling with user-friendly messages
- [ ] Directory caching improves performance for repeated operations
- [ ] Unit tests achieve 80%+ coverage including edge cases
- [ ] All tests pass in browser environment
- [ ] Documentation includes usage examples
- [ ] Memory usage optimized with proper cleanup
- [ ] Code review completed
- [ ] No security vulnerabilities in path handling
- [ ] Integration with DI container working
- [ ] Code committed with descriptive message

## Usage Examples

### Basic Directory Creation

```javascript
const dirManager = container.resolve(tokens.ITraceDirectoryManager);

// Ensure trace directory exists (may prompt user for directory selection)
const result = await dirManager.ensureDirectoryExists('./traces/actions');

if (result.success) {
  console.log(`Directory ready: ${result.path}`);
} else {
  console.error(`Failed to create directory: ${result.error}`);
}
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
- **Input Sanitization**: Validate and normalize all path inputs
- **Permission Management**: Handle browser permission prompts gracefully
- **Error Information**: Avoid exposing sensitive filesystem information in error messages
- **Sandboxed Environment**: All operations occur within browser's sandboxed filesystem

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