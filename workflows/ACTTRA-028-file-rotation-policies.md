# ACTTRA-028: Implement File Rotation Policies

## Summary

Implement comprehensive file rotation policies for action trace files to manage disk space, maintain performance, and ensure traces are retained according to configured policies. Support both age-based and count-based rotation strategies with efficient file management and cleanup.

## Status

- **Type**: Implementation
- **Priority**: Medium
- **Complexity**: Medium
- **Estimated Time**: 3 hours
- **Dependencies**:
  - ACTTRA-024 (ActionTraceOutputService)
  - ACTTRA-029 (File naming conventions)

## Objectives

### Primary Goals

1. **Age-Based Rotation** - Remove files older than specified age
2. **Count-Based Rotation** - Maintain maximum number of files
3. **Size-Based Limits** - Monitor total directory size
4. **Efficient Scanning** - Minimize filesystem operations
5. **Safe Deletion** - Prevent accidental data loss
6. **Archive Support** - Optional compression before deletion

### Success Criteria

- [ ] Files rotated according to policy
- [ ] Old files deleted automatically
- [ ] Directory size stays within limits
- [ ] Rotation doesn't block trace writing
- [ ] Important traces can be preserved
- [ ] Archive option works correctly
- [ ] Performance impact minimal
- [ ] Configuration changes applied dynamically

## Technical Specification

### 1. File Rotation Manager Implementation

#### File: `src/actions/tracing/fileRotationManager.js`

```javascript
/**
 * @file Manages rotation of trace files
 * @see actionTraceOutputService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

/**
 * Rotation policies
 * @enum {string}
 */
export const RotationPolicy = {
  AGE: 'age',
  COUNT: 'count',
  SIZE: 'size',
  HYBRID: 'hybrid', // Combination of policies
};

/**
 * Archive formats
 * @enum {string}
 */
export const ArchiveFormat = {
  NONE: 'none',
  GZIP: 'gzip',
  TAR_GZIP: 'tar.gz',
};

/**
 * Manages file rotation for trace output
 */
export class FileRotationManager {
  #fileSystem;
  #logger;
  #config;
  #isRotating;
  #lastRotation;
  #fileCache;
  #rotationTimer;
  #preservedFiles;

  /**
   * Constructor
   * @param {object} dependencies
   * @param {IFileSystem} dependencies.fileSystem - File system interface
   * @param {ILogger} dependencies.logger - Logger service
   * @param {object} dependencies.config - Rotation configuration
   */
  constructor({ fileSystem, logger, config }) {
    validateDependency(fileSystem, 'IFileSystem', null, {
      requiredMethods: ['readdir', 'stat', 'unlink', 'rename'],
    });

    this.#fileSystem = fileSystem;
    this.#logger = ensureValidLogger(logger, 'FileRotationManager');
    this.#config = this.#validateConfig(config);

    this.#isRotating = false;
    this.#lastRotation = Date.now();
    this.#fileCache = new Map();
    this.#preservedFiles = new Set();
    this.#rotationTimer = null;

    this.#scheduleRotation();
  }

  /**
   * Validate and set defaults for configuration
   * @private
   */
  #validateConfig(config) {
    return {
      // Rotation policy
      policy: config.rotationPolicy || RotationPolicy.AGE,

      // Age-based settings
      maxFileAge: config.maxFileAge || 86400, // 24 hours in seconds

      // Count-based settings
      maxTraceFiles: config.maxTraceFiles || 100,

      // Size-based settings
      maxDirectorySize: config.maxDirectorySize || 100 * 1024 * 1024, // 100MB
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB

      // Archive settings
      archiveBeforeDelete: config.archiveBeforeDelete || false,
      archiveFormat: config.archiveFormat || ArchiveFormat.GZIP,
      archiveDirectory: config.archiveDirectory || './traces/archive',

      // Performance settings
      rotationInterval: config.rotationInterval || 300000, // 5 minutes
      batchSize: config.batchSize || 50, // Files to process per batch

      // Preservation
      preservePattern: config.preservePattern || null, // Regex to preserve files
      preserveCount: config.preserveCount || 10, // Keep N most recent always

      ...config,
    };
  }

  /**
   * Schedule periodic rotation checks
   * @private
   */
  #scheduleRotation() {
    if (this.#rotationTimer) {
      clearInterval(this.#rotationTimer);
    }

    this.#rotationTimer = setInterval(async () => {
      await this.rotateFiles();
    }, this.#config.rotationInterval);
  }

  /**
   * Perform file rotation
   * @param {string} directory - Directory to rotate files in
   * @returns {Promise<object>} Rotation results
   */
  async rotateFiles(directory) {
    if (this.#isRotating) {
      this.#logger.debug('FileRotationManager: Rotation already in progress');
      return { skipped: true };
    }

    this.#isRotating = true;
    const startTime = Date.now();
    const results = {
      deleted: 0,
      archived: 0,
      preserved: 0,
      errors: 0,
      duration: 0,
    };

    try {
      this.#logger.debug(
        `FileRotationManager: Starting rotation in ${directory}`
      );

      // Get all trace files
      const files = await this.#getTraceFiles(directory);

      if (files.length === 0) {
        this.#logger.debug('FileRotationManager: No files to rotate');
        return results;
      }

      // Apply rotation policy
      const filesToRotate = await this.#applyRotationPolicy(files, directory);

      // Process files in batches
      await this.#processRotation(filesToRotate, results);

      // Update cache
      this.#updateFileCache(files, filesToRotate);

      results.duration = Date.now() - startTime;
      this.#lastRotation = Date.now();

      this.#logger.info('FileRotationManager: Rotation complete', results);
    } catch (error) {
      this.#logger.error('FileRotationManager: Rotation error', error);
      results.errors++;
    } finally {
      this.#isRotating = false;
    }

    return results;
  }

  /**
   * Get all trace files in directory
   * @private
   */
  async #getTraceFiles(directory) {
    try {
      const entries = await this.#fileSystem.readdir(directory, {
        withFileTypes: true,
      });

      const files = [];

      for (const entry of entries) {
        if (entry.isFile() && this.#isTraceFile(entry.name)) {
          const filePath = path.join(directory, entry.name);
          const stats = await this.#fileSystem.stat(filePath);

          files.push({
            name: entry.name,
            path: filePath,
            size: stats.size,
            created: stats.birthtime || stats.ctime,
            modified: stats.mtime,
            age: Date.now() - stats.mtime.getTime(),
          });
        }
      }

      // Sort by modification time (oldest first)
      files.sort((a, b) => a.modified - b.modified);

      return files;
    } catch (error) {
      this.#logger.error('FileRotationManager: Error reading directory', error);
      return [];
    }
  }

  /**
   * Check if file is a trace file
   * @private
   */
  #isTraceFile(filename) {
    return (
      filename.endsWith('.json') ||
      filename.endsWith('.txt') ||
      filename.endsWith('.json.gz')
    );
  }

  /**
   * Apply rotation policy to determine files to rotate
   * @private
   */
  async #applyRotationPolicy(files, directory) {
    const policy = this.#config.policy;
    let filesToRotate = [];

    switch (policy) {
      case RotationPolicy.AGE:
        filesToRotate = this.#applyAgePolicy(files);
        break;

      case RotationPolicy.COUNT:
        filesToRotate = this.#applyCountPolicy(files);
        break;

      case RotationPolicy.SIZE:
        filesToRotate = await this.#applySizePolicy(files, directory);
        break;

      case RotationPolicy.HYBRID:
        filesToRotate = await this.#applyHybridPolicy(files, directory);
        break;

      default:
        this.#logger.warn(`FileRotationManager: Unknown policy ${policy}`);
    }

    // Apply preservation rules
    filesToRotate = this.#applyPreservationRules(files, filesToRotate);

    return filesToRotate;
  }

  /**
   * Apply age-based rotation policy
   * @private
   */
  #applyAgePolicy(files) {
    const maxAge = this.#config.maxFileAge * 1000; // Convert to milliseconds
    const now = Date.now();

    return files.filter((file) => {
      const age = now - file.modified.getTime();
      return age > maxAge;
    });
  }

  /**
   * Apply count-based rotation policy
   * @private
   */
  #applyCountPolicy(files) {
    const maxCount = this.#config.maxTraceFiles;

    if (files.length <= maxCount) {
      return [];
    }

    // Keep the newest files, rotate the oldest
    const toKeep = files.length - maxCount;
    return files.slice(0, toKeep);
  }

  /**
   * Apply size-based rotation policy
   * @private
   */
  async #applySizePolicy(files, directory) {
    const maxDirSize = this.#config.maxDirectorySize;
    const maxFileSize = this.#config.maxFileSize;

    let totalSize = 0;
    const filesToRotate = [];
    const oversizedFiles = [];

    // Calculate total size and find oversized files
    for (const file of files) {
      totalSize += file.size;

      if (file.size > maxFileSize) {
        oversizedFiles.push(file);
      }
    }

    // Rotate oversized files first
    filesToRotate.push(...oversizedFiles);

    // If still over limit, rotate oldest files
    if (totalSize > maxDirSize) {
      let currentSize = totalSize;

      for (const file of files) {
        if (currentSize <= maxDirSize) {
          break;
        }

        if (!oversizedFiles.includes(file)) {
          filesToRotate.push(file);
          currentSize -= file.size;
        }
      }
    }

    return filesToRotate;
  }

  /**
   * Apply hybrid rotation policy
   * @private
   */
  async #applyHybridPolicy(files, directory) {
    // Combine all policies - rotate if ANY condition is met
    const byAge = new Set(this.#applyAgePolicy(files));
    const byCount = new Set(this.#applyCountPolicy(files));
    const bySize = new Set(await this.#applySizePolicy(files, directory));

    // Union of all policies
    const combined = new Set([...byAge, ...byCount, ...bySize]);

    return Array.from(combined);
  }

  /**
   * Apply preservation rules to protect important files
   * @private
   */
  #applyPreservationRules(allFiles, filesToRotate) {
    const preservePattern = this.#config.preservePattern;
    const preserveCount = this.#config.preserveCount;

    // Filter out preserved files by pattern
    if (preservePattern) {
      const regex = new RegExp(preservePattern);
      filesToRotate = filesToRotate.filter((file) => {
        const shouldPreserve = regex.test(file.name);
        if (shouldPreserve) {
          this.#preservedFiles.add(file.path);
        }
        return !shouldPreserve;
      });
    }

    // Always keep N most recent files
    if (preserveCount > 0) {
      const sortedByTime = [...allFiles].sort(
        (a, b) => b.modified.getTime() - a.modified.getTime()
      );

      const recentFiles = new Set(
        sortedByTime.slice(0, preserveCount).map((f) => f.path)
      );

      filesToRotate = filesToRotate.filter(
        (file) => !recentFiles.has(file.path)
      );
    }

    return filesToRotate;
  }

  /**
   * Process file rotation (archive or delete)
   * @private
   */
  async #processRotation(files, results) {
    const batchSize = this.#config.batchSize;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (file) => {
          try {
            if (this.#config.archiveBeforeDelete) {
              await this.#archiveFile(file);
              results.archived++;
            }

            await this.#deleteFile(file);
            results.deleted++;
          } catch (error) {
            this.#logger.error(
              `FileRotationManager: Error processing ${file.name}`,
              error
            );
            results.errors++;
          }
        })
      );

      // Brief pause between batches to prevent I/O overload
      if (i + batchSize < files.length) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Archive file before deletion
   * @private
   */
  async #archiveFile(file) {
    const archiveDir = this.#config.archiveDirectory;
    const format = this.#config.archiveFormat;

    // Ensure archive directory exists
    await this.#fileSystem.mkdir(archiveDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `${path.basename(file.name, path.extname(file.name))}_${timestamp}`;

    switch (format) {
      case ArchiveFormat.GZIP:
        await this.#archiveAsGzip(file, archiveDir, archiveName);
        break;

      case ArchiveFormat.TAR_GZIP:
        // For single files, just use gzip
        await this.#archiveAsGzip(file, archiveDir, archiveName);
        break;

      default:
        // Just move the file
        const destPath = path.join(
          archiveDir,
          `${archiveName}${path.extname(file.name)}`
        );
        await this.#fileSystem.rename(file.path, destPath);
    }

    this.#logger.debug(`FileRotationManager: Archived ${file.name}`);
  }

  /**
   * Archive file as gzip
   * @private
   */
  async #archiveAsGzip(file, archiveDir, archiveName) {
    const source = createReadStream(file.path);
    const destination = createWriteStream(
      path.join(archiveDir, `${archiveName}.gz`)
    );
    const gzip = createGzip({ level: 9 });

    await pipeline(source, gzip, destination);
  }

  /**
   * Delete file
   * @private
   */
  async #deleteFile(file) {
    await this.#fileSystem.unlink(file.path);
    this.#logger.debug(`FileRotationManager: Deleted ${file.name}`);

    // Remove from cache
    this.#fileCache.delete(file.path);
    this.#preservedFiles.delete(file.path);
  }

  /**
   * Update file cache after rotation
   * @private
   */
  #updateFileCache(allFiles, rotatedFiles) {
    const rotatedPaths = new Set(rotatedFiles.map((f) => f.path));

    // Clear cache and rebuild with remaining files
    this.#fileCache.clear();

    for (const file of allFiles) {
      if (!rotatedPaths.has(file.path)) {
        this.#fileCache.set(file.path, {
          size: file.size,
          modified: file.modified,
        });
      }
    }
  }

  /**
   * Get rotation statistics
   * @returns {object} Statistics
   */
  getStatistics() {
    return {
      isRotating: this.#isRotating,
      lastRotation: this.#lastRotation,
      cachedFiles: this.#fileCache.size,
      preservedFiles: this.#preservedFiles.size,
      policy: this.#config.policy,
      maxAge: this.#config.maxFileAge,
      maxCount: this.#config.maxTraceFiles,
      maxSize: this.#config.maxDirectorySize,
    };
  }

  /**
   * Update configuration
   * @param {object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.#config = this.#validateConfig({ ...this.#config, ...newConfig });

    // Restart rotation timer with new interval
    this.#scheduleRotation();

    this.#logger.info(
      'FileRotationManager: Configuration updated',
      this.#config
    );
  }

  /**
   * Force immediate rotation
   * @param {string} directory - Directory to rotate
   * @returns {Promise<object>} Rotation results
   */
  async forceRotation(directory) {
    this.#logger.info('FileRotationManager: Forcing rotation');
    return this.rotateFiles(directory);
  }

  /**
   * Shutdown rotation manager
   */
  shutdown() {
    if (this.#rotationTimer) {
      clearInterval(this.#rotationTimer);
      this.#rotationTimer = null;
    }

    this.#logger.info('FileRotationManager: Shutdown complete');
  }
}

export default FileRotationManager;
```

### 2. Integration with ActionTraceOutputService

#### Update: `src/actions/tracing/actionTraceOutputService.js`

```javascript
// Add to constructor
constructor({ fileSystem, logger, actionTraceFilter }) {
  // ... existing code ...

  // Initialize rotation manager
  const rotationConfig = {
    rotationPolicy: actionTraceFilter.getRotationPolicy() || 'age',
    maxFileAge: actionTraceFilter.getMaxFileAge() || 86400,
    maxTraceFiles: actionTraceFilter.getMaxTraceFiles() || 100,
    archiveBeforeDelete: false,
    preserveCount: 10,
  };

  this.#rotationManager = new FileRotationManager({
    fileSystem: this.#fileSystem,
    logger: this.#logger,
    config: rotationConfig,
  });
}

// Update #rotateOldFiles method
async #rotateOldFiles(directory) {
  // Delegate to rotation manager
  const results = await this.#rotationManager.rotateFiles(directory);

  if (results.errors > 0) {
    this.#logger.warn(
      `ActionTraceOutputService: Rotation completed with ${results.errors} errors`
    );
  }
}

// Add method to get rotation stats
getRotationStatistics() {
  return this.#rotationManager.getStatistics();
}

// Update shutdown method
async shutdown() {
  // ... existing code ...

  // Shutdown rotation manager
  this.#rotationManager.shutdown();
}
```

## Implementation Notes

### Rotation Strategies

1. **Age-Based**
   - Simple time-based deletion
   - Good for predictable workloads
   - Easy to understand

2. **Count-Based**
   - Fixed number of files
   - Predictable disk usage
   - FIFO deletion

3. **Size-Based**
   - Disk space management
   - Handles variable file sizes
   - Priority on large files

4. **Hybrid**
   - Most flexible
   - Multiple constraints
   - Complex but powerful

### Performance Considerations

1. **Caching**
   - Cache file metadata
   - Reduce stat calls
   - Update incrementally

2. **Batching**
   - Process files in groups
   - Prevent I/O storms
   - Pause between batches

3. **Async Operations**
   - Non-blocking rotation
   - Parallel processing
   - Background archival

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/actions/tracing/fileRotationManager.unit.test.js

describe('FileRotationManager - Rotation Policies', () => {
  it('should rotate files by age');
  it('should rotate files by count');
  it('should rotate files by size');
  it('should apply hybrid policy');
  it('should preserve recent files');
  it('should preserve files by pattern');
  it('should archive before deletion');
  it('should handle rotation errors');
  it('should update configuration dynamically');
});
```

### Integration Tests

```javascript
// tests/integration/actions/tracing/fileRotation.integration.test.js

describe('File Rotation Integration', () => {
  it('should rotate files without blocking writes');
  it('should maintain directory size limits');
  it('should compress archives correctly');
  it('should handle concurrent operations');
});
```

## Error Handling

### Error Scenarios

1. **Permission Errors**
   - Cannot delete files
   - Cannot create archives
   - Log and continue

2. **Disk Space**
   - Archive disk full
   - Cannot write archives
   - Skip archival, delete directly

3. **Corrupted Files**
   - Cannot read file stats
   - Skip problematic files
   - Log for investigation

## Dependencies

- `IFileSystem` - File operations
- `ILogger` - Logging
- Node.js streams - Compression
- zlib - Gzip compression

## Performance Targets

1. **Rotation Speed**: <1s for 100 files
2. **Memory Usage**: <10MB during rotation
3. **I/O Impact**: <10% during rotation
4. **Archive Compression**: 70%+ reduction

## Next Steps

1. **ACTTRA-029** - Add trace file naming conventions
2. **ACTTRA-030** - Create output directory auto-creation

---

**Ticket Status**: Ready for Implementation
**Last Updated**: 2025-01-10
**Author**: System Architect
