# ACTTRA-029: Add Trace File Naming Conventions

## Summary

Implement standardized file naming conventions for action trace files that ensure uniqueness, enable efficient sorting and searching, include relevant metadata in the filename, and support both human and programmatic identification of trace files.

## Status

- **Type**: Implementation
- **Priority**: Low
- **Complexity**: Low
- **Estimated Time**: 1 hour
- **Dependencies**:
  - ACTTRA-024 (ActionTraceOutputService)

## Objectives

### Primary Goals

1. **Unique Names** - Guarantee no filename collisions
2. **Sortable Format** - Enable chronological sorting
3. **Metadata Inclusion** - Embed key information in filename
4. **Pattern Matching** - Support glob and regex patterns
5. **Human Readable** - Clear and understandable names
6. **Extension Management** - Consistent file extensions

### Success Criteria

- [ ] Filenames are always unique
- [ ] Files sort chronologically by name
- [ ] Action ID visible in filename
- [ ] Timestamp included with precision
- [ ] Valid filesystem characters only
- [ ] Extensions match content type
- [ ] Pattern matching works reliably
- [ ] Names readable by humans

## Technical Specification

### 1. File Naming Service Implementation

#### File: `src/actions/tracing/traceFileNaming.js`

```javascript
/**
 * @file Service for generating trace file names
 * @see actionTraceOutputService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import crypto from 'crypto';

/**
 * File naming strategies
 * @enum {string}
 */
export const NamingStrategy = {
  TIMESTAMP_FIRST: 'timestamp_first', // 2024-01-15_103045_core-go_abc123.json
  ACTION_FIRST: 'action_first', // core-go_2024-01-15_103045_abc123.json
  HIERARCHICAL: 'hierarchical', // 2024/01/15/core-go_103045_abc123.json
  SEQUENTIAL: 'sequential', // trace_000001_core-go.json
};

/**
 * Timestamp formats
 * @enum {string}
 */
export const TimestampFormat = {
  ISO: 'iso', // 2024-01-15T10-30-45-123Z
  COMPACT: 'compact', // 20240115_103045
  UNIX: 'unix', // 1705315845123
  HUMAN: 'human', // 2024-01-15_10h30m45s
};

/**
 * Service for generating trace file names
 */
export class TraceFileNaming {
  #logger;
  #strategy;
  #timestampFormat;
  #includeHash;
  #hashLength;
  #sequenceCounter;
  #sequenceFile;
  #sanitizer;
  #maxLength;

  /**
   * Constructor
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger service
   * @param {object} options - Naming options
   */
  constructor({ logger }, options = {}) {
    this.#logger = ensureValidLogger(logger, 'TraceFileNaming');

    // Configure naming options
    this.#strategy = options.strategy || NamingStrategy.TIMESTAMP_FIRST;
    this.#timestampFormat = options.timestampFormat || TimestampFormat.COMPACT;
    this.#includeHash = options.includeHash !== false;
    this.#hashLength = options.hashLength || 6;
    this.#maxLength = options.maxLength || 255; // Filesystem limit

    // Sequential numbering
    this.#sequenceCounter = 0;
    this.#sequenceFile = options.sequenceFile || null;

    // Character sanitization
    this.#sanitizer = this.#createSanitizer();

    // Load sequence if using sequential strategy
    if (this.#strategy === NamingStrategy.SEQUENTIAL && this.#sequenceFile) {
      this.#loadSequence();
    }
  }

  /**
   * Generate filename for trace
   * @param {object} trace - Trace object
   * @param {string} extension - File extension
   * @returns {string} Generated filename
   */
  generateFilename(trace, extension = 'json') {
    // Extract metadata from trace
    const metadata = this.#extractMetadata(trace);

    // Generate filename based on strategy
    let filename;
    switch (this.#strategy) {
      case NamingStrategy.TIMESTAMP_FIRST:
        filename = this.#generateTimestampFirst(metadata);
        break;

      case NamingStrategy.ACTION_FIRST:
        filename = this.#generateActionFirst(metadata);
        break;

      case NamingStrategy.HIERARCHICAL:
        filename = this.#generateHierarchical(metadata);
        break;

      case NamingStrategy.SEQUENTIAL:
        filename = this.#generateSequential(metadata);
        break;

      default:
        filename = this.#generateTimestampFirst(metadata);
    }

    // Add extension
    filename = this.#addExtension(filename, extension);

    // Ensure filename is unique
    filename = this.#ensureUniqueness(filename);

    // Validate length
    filename = this.#enforceMaxLength(filename);

    return filename;
  }

  /**
   * Extract metadata from trace
   * @private
   */
  #extractMetadata(trace) {
    const metadata = {
      actionId: 'unknown',
      actorId: null,
      timestamp: Date.now(),
      traceType: 'generic',
      error: false,
    };

    // Extract action ID
    if (trace.actionId) {
      metadata.actionId = trace.actionId;
    } else if (
      trace.getTracedActions &&
      typeof trace.getTracedActions === 'function'
    ) {
      const tracedActions = trace.getTracedActions();
      if (tracedActions.size > 0) {
        metadata.actionId = Array.from(tracedActions.keys())[0];
      }
    }

    // Extract actor ID
    if (trace.actorId) {
      metadata.actorId = trace.actorId;
    }

    // Extract timestamp
    if (trace.execution?.startTime) {
      metadata.timestamp = trace.execution.startTime;
    } else if (trace.startTime) {
      metadata.timestamp = trace.startTime;
    }

    // Determine trace type
    if (trace.constructor?.name === 'ActionExecutionTrace') {
      metadata.traceType = 'execution';
    } else if (trace.constructor?.name === 'ActionAwareStructuredTrace') {
      metadata.traceType = 'pipeline';
    }

    // Check for errors
    if (trace.execution?.error || trace.error) {
      metadata.error = true;
    }

    return metadata;
  }

  /**
   * Generate timestamp-first filename
   * @private
   */
  #generateTimestampFirst(metadata) {
    const parts = [];

    // Add timestamp
    parts.push(this.#formatTimestamp(metadata.timestamp));

    // Add action ID
    parts.push(this.#sanitizeActionId(metadata.actionId));

    // Add actor ID if present
    if (metadata.actorId) {
      parts.push(this.#sanitizeString(metadata.actorId));
    }

    // Add error indicator
    if (metadata.error) {
      parts.push('ERROR');
    }

    // Add hash if configured
    if (this.#includeHash) {
      parts.push(this.#generateHash(metadata));
    }

    return parts.join('_');
  }

  /**
   * Generate action-first filename
   * @private
   */
  #generateActionFirst(metadata) {
    const parts = [];

    // Add action ID first
    parts.push(this.#sanitizeActionId(metadata.actionId));

    // Add timestamp
    parts.push(this.#formatTimestamp(metadata.timestamp));

    // Add trace type
    parts.push(metadata.traceType);

    // Add error indicator
    if (metadata.error) {
      parts.push('ERROR');
    }

    // Add hash if configured
    if (this.#includeHash) {
      parts.push(this.#generateHash(metadata));
    }

    return parts.join('_');
  }

  /**
   * Generate hierarchical filename (with path)
   * @private
   */
  #generateHierarchical(metadata) {
    const date = new Date(metadata.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Create directory structure
    const dirs = [year, month, day];

    // Create filename
    const filename = [
      this.#sanitizeActionId(metadata.actionId),
      this.#formatTimeOnly(metadata.timestamp),
      this.#includeHash ? this.#generateHash(metadata) : null,
    ]
      .filter(Boolean)
      .join('_');

    // Combine path and filename
    return [...dirs, filename].join('/');
  }

  /**
   * Generate sequential filename
   * @private
   */
  #generateSequential(metadata) {
    const parts = [];

    // Add prefix
    parts.push('trace');

    // Add sequence number
    const sequence = this.#getNextSequence();
    parts.push(String(sequence).padStart(6, '0'));

    // Add action ID
    parts.push(this.#sanitizeActionId(metadata.actionId));

    // Add compact timestamp
    parts.push(
      this.#formatTimestamp(metadata.timestamp, TimestampFormat.COMPACT)
    );

    return parts.join('_');
  }

  /**
   * Format timestamp based on configured format
   * @private
   */
  #formatTimestamp(timestamp, format = null) {
    const fmt = format || this.#timestampFormat;
    const date = new Date(timestamp);

    switch (fmt) {
      case TimestampFormat.ISO:
        return date.toISOString().replace(/[:.]/g, '-').replace('T', '_');

      case TimestampFormat.COMPACT:
        return [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, '0'),
          String(date.getDate()).padStart(2, '0'),
          '_',
          String(date.getHours()).padStart(2, '0'),
          String(date.getMinutes()).padStart(2, '0'),
          String(date.getSeconds()).padStart(2, '0'),
        ].join('');

      case TimestampFormat.UNIX:
        return String(timestamp);

      case TimestampFormat.HUMAN:
        return [
          date.getFullYear(),
          '-',
          String(date.getMonth() + 1).padStart(2, '0'),
          '-',
          String(date.getDate()).padStart(2, '0'),
          '_',
          String(date.getHours()).padStart(2, '0'),
          'h',
          String(date.getMinutes()).padStart(2, '0'),
          'm',
          String(date.getSeconds()).padStart(2, '0'),
          's',
        ].join('');

      default:
        return this.#formatTimestamp(timestamp, TimestampFormat.COMPACT);
    }
  }

  /**
   * Format time only (for hierarchical)
   * @private
   */
  #formatTimeOnly(timestamp) {
    const date = new Date(timestamp);
    return [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0'),
    ].join('');
  }

  /**
   * Sanitize action ID for filename
   * @private
   */
  #sanitizeActionId(actionId) {
    // Replace colon with dash (common in action IDs)
    let sanitized = actionId.replace(/:/g, '-');

    // Apply general sanitization
    sanitized = this.#sanitizeString(sanitized);

    return sanitized;
  }

  /**
   * Sanitize string for filesystem
   * @private
   */
  #sanitizeString(str) {
    if (!str) return '';

    // Replace invalid characters
    let sanitized = str.replace(
      this.#sanitizer.pattern,
      this.#sanitizer.replacement
    );

    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

    // Limit length
    if (sanitized.length > 50) {
      sanitized = sanitized.substring(0, 50);
    }

    return sanitized || 'unknown';
  }

  /**
   * Create sanitizer configuration
   * @private
   */
  #createSanitizer() {
    // Characters not allowed in filenames across platforms
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;

    // Reserved names on Windows
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

    return {
      pattern: invalidChars,
      replacement: '-',
      reserved: reservedNames,
    };
  }

  /**
   * Generate hash for uniqueness
   * @private
   */
  #generateHash(metadata) {
    const data = JSON.stringify({
      ...metadata,
      random: Math.random(),
      pid: process.pid,
    });

    const hash = crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')
      .substring(0, this.#hashLength);

    return hash;
  }

  /**
   * Add extension to filename
   * @private
   */
  #addExtension(filename, extension) {
    // Clean extension
    const ext = extension.startsWith('.') ? extension : `.${extension}`;

    // Check if extension already present
    if (filename.endsWith(ext)) {
      return filename;
    }

    return filename + ext;
  }

  /**
   * Ensure filename uniqueness
   * @private
   */
  #ensureUniqueness(filename) {
    // Add microseconds if not using hash
    if (!this.#includeHash) {
      const microseconds = String(process.hrtime.bigint()).slice(-6);
      const parts = filename.split('.');
      const name = parts[0];
      const ext = parts.slice(1).join('.');

      return `${name}_${microseconds}.${ext}`;
    }

    return filename;
  }

  /**
   * Enforce maximum filename length
   * @private
   */
  #enforceMaxLength(filename) {
    if (filename.length <= this.#maxLength) {
      return filename;
    }

    // Preserve extension
    const lastDot = filename.lastIndexOf('.');
    const name = filename.substring(0, lastDot);
    const ext = filename.substring(lastDot);

    // Calculate available space
    const availableLength = this.#maxLength - ext.length - 10; // Reserve for hash

    // Truncate name
    const truncated = name.substring(0, availableLength);

    // Add truncation indicator and hash
    const hash = this.#generateHash({ filename, timestamp: Date.now() });

    return `${truncated}_TRUNC_${hash}${ext}`;
  }

  /**
   * Get next sequence number
   * @private
   */
  #getNextSequence() {
    this.#sequenceCounter++;

    // Save sequence if configured
    if (this.#sequenceFile) {
      this.#saveSequence();
    }

    return this.#sequenceCounter;
  }

  /**
   * Load sequence from file
   * @private
   */
  async #loadSequence() {
    // Implementation depends on file system access
    // For now, start from 0
    this.#sequenceCounter = 0;
  }

  /**
   * Save sequence to file
   * @private
   */
  async #saveSequence() {
    // Implementation depends on file system access
    // For now, just log
    this.#logger.debug(`TraceFileNaming: Sequence at ${this.#sequenceCounter}`);
  }

  /**
   * Parse filename to extract metadata
   * @param {string} filename - Filename to parse
   * @returns {object} Extracted metadata
   */
  parseFilename(filename) {
    const metadata = {
      actionId: null,
      timestamp: null,
      hash: null,
      error: false,
      extension: null,
    };

    // Remove path if present
    const basename = filename.split('/').pop();

    // Extract extension
    const lastDot = basename.lastIndexOf('.');
    if (lastDot > 0) {
      metadata.extension = basename.substring(lastDot + 1);
      filename = basename.substring(0, lastDot);
    } else {
      filename = basename;
    }

    // Check for error indicator
    if (filename.includes('ERROR')) {
      metadata.error = true;
    }

    // Parse based on strategy patterns
    const parts = filename.split('_');

    // Try to identify components
    for (const part of parts) {
      // Check if timestamp
      if (/^\d{8}_?\d{6}/.test(part)) {
        metadata.timestamp = this.#parseCompactTimestamp(part);
      }
      // Check if hash (6-8 hex chars)
      else if (/^[a-f0-9]{6,8}$/i.test(part)) {
        metadata.hash = part;
      }
      // Check if action ID (contains dash)
      else if (part.includes('-') && !metadata.actionId) {
        metadata.actionId = part.replace(/-/g, ':');
      }
    }

    return metadata;
  }

  /**
   * Parse compact timestamp
   * @private
   */
  #parseCompactTimestamp(str) {
    const cleaned = str.replace(/\D/g, '');

    if (cleaned.length >= 14) {
      const year = parseInt(cleaned.substring(0, 4));
      const month = parseInt(cleaned.substring(4, 6)) - 1;
      const day = parseInt(cleaned.substring(6, 8));
      const hour = parseInt(cleaned.substring(8, 10));
      const minute = parseInt(cleaned.substring(10, 12));
      const second = parseInt(cleaned.substring(12, 14));

      return new Date(year, month, day, hour, minute, second).getTime();
    }

    return null;
  }

  /**
   * Get filename pattern for glob matching
   * @param {object} criteria - Search criteria
   * @returns {string} Glob pattern
   */
  getGlobPattern(criteria = {}) {
    const patterns = [];

    if (criteria.actionId) {
      const sanitized = this.#sanitizeActionId(criteria.actionId);
      patterns.push(`*${sanitized}*`);
    }

    if (criteria.date) {
      const dateStr = this.#formatTimestamp(
        criteria.date,
        TimestampFormat.COMPACT
      ).substring(0, 8); // Just the date part
      patterns.push(`${dateStr}*`);
    }

    if (criteria.error) {
      patterns.push('*ERROR*');
    }

    if (criteria.extension) {
      patterns.push(`*.${criteria.extension}`);
    }

    return patterns.length > 0 ? patterns.join('') : '*';
  }

  /**
   * Validate filename
   * @param {string} filename - Filename to validate
   * @returns {boolean} Whether filename is valid
   */
  isValidFilename(filename) {
    // Check length
    if (filename.length > this.#maxLength) {
      return false;
    }

    // Check for invalid characters
    if (this.#sanitizer.pattern.test(filename)) {
      return false;
    }

    // Check for reserved names
    const name = filename.split('.')[0];
    if (this.#sanitizer.reserved.test(name)) {
      return false;
    }

    return true;
  }
}

export default TraceFileNaming;
```

## Implementation Notes

### Naming Strategies

1. **Timestamp First**
   - Best for chronological browsing
   - Easy to find recent traces
   - Natural sorting

2. **Action First**
   - Groups by action type
   - Easy to find specific actions
   - Good for analysis

3. **Hierarchical**
   - Organizes by date
   - Reduces files per directory
   - Better for large volumes

4. **Sequential**
   - Simple numbering
   - Guaranteed order
   - Compact names

### Uniqueness Guarantees

1. **Hash Suffix**
   - 6-character hash
   - Based on content + random
   - Very low collision probability

2. **Microseconds**
   - Process-unique timing
   - High resolution
   - No external state

3. **Sequential Counter**
   - Guaranteed unique
   - Requires state management
   - Simple and reliable

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/actions/tracing/traceFileNaming.unit.test.js

describe('TraceFileNaming - Name Generation', () => {
  it('should generate unique filenames');
  it('should sanitize action IDs correctly');
  it('should format timestamps properly');
  it('should handle all naming strategies');
  it('should include metadata in filename');
  it('should enforce maximum length');
  it('should validate filenames');
  it('should parse filenames correctly');
  it('should generate glob patterns');
});
```

## Examples

### Generated Filenames

```
// Timestamp First
20240115_103045_core-go_player1_a1b2c3.json
20240115_103046_core-attack_ERROR_d4e5f6.json

// Action First
core-go_20240115_103045_pipeline_a1b2c3.json
core-attack_20240115_103046_execution_ERROR.json

// Hierarchical
2024/01/15/core-go_103045_a1b2c3.json
2024/01/15/core-attack_103046_ERROR.json

// Sequential
trace_000001_core-go_20240115103045.json
trace_000002_core-attack_20240115103046.json
```

## Dependencies

- `ILogger` - Logging
- `crypto` - Hash generation

## Next Steps

1. **ACTTRA-030** - Create output directory auto-creation

---

**Ticket Status**: Ready for Implementation
**Last Updated**: 2025-01-10
**Author**: System Architect
