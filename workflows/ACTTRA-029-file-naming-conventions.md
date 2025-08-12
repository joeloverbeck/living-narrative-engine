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

### 1. Enhanced ActionTraceOutputService for File Naming

#### File: `src/actions/tracing/actionTraceOutputService.js` (Enhancement)

```javascript
/**
 * @file Enhanced ActionTraceOutputService with file naming conventions
 * @see storageRotationManager.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * File naming strategies for browser-compatible trace storage
 * @enum {string}
 */
export const NamingStrategy = {
  TIMESTAMP_FIRST: 'timestamp_first', // 2024-01-15_103045_core-go_abc123
  ACTION_FIRST: 'action_first', // core-go_2024-01-15_103045_abc123
  SEQUENTIAL: 'sequential', // trace_000001_core-go_20240115103045
};

/**
 * Timestamp formats for browser-compatible storage
 * @enum {string}
 */
export const TimestampFormat = {
  COMPACT: 'compact', // 20240115_103045
  UNIX: 'unix', // 1705315845123
  HUMAN: 'human', // 2024-01-15_10h30m45s
};

/**
 * Enhanced ActionTraceOutputService with standardized naming conventions
 */
export class ActionTraceOutputService {
  // ... existing fields ...
  #namingStrategy;
  #timestampFormat;
  #includeHash;
  #hashLength;
  #sequenceCounter;

  /**
   * Enhanced constructor with naming configuration
   * @param {object} dependencies - All existing ActionTraceOutputService dependencies
   * @param {object} options - Additional naming options
   */
  constructor({
    storageAdapter,
    logger,
    actionTraceFilter,
    jsonFormatter,
    humanReadableFormatter,
    outputHandler,
    eventBus,
    queueConfig,
    namingOptions = {},
  } = {}) {
    // ... existing constructor code ...

    // Configure naming options
    this.#namingStrategy =
      namingOptions.strategy || NamingStrategy.TIMESTAMP_FIRST;
    this.#timestampFormat =
      namingOptions.timestampFormat || TimestampFormat.COMPACT;
    this.#includeHash = namingOptions.includeHash !== false;
    this.#hashLength = namingOptions.hashLength || 6;
    this.#sequenceCounter = 0;

    this.#logger.debug(
      'ActionTraceOutputService: Enhanced with naming conventions',
      {
        strategy: this.#namingStrategy,
        timestampFormat: this.#timestampFormat,
        includeHash: this.#includeHash,
      }
    );
  }

  /**
   * Enhanced generateTraceId method with configurable naming strategies
   * @param {object} trace - Trace object
   * @returns {string} Generated trace ID with naming convention
   */
  #generateTraceId(trace) {
    // Extract metadata from trace (existing logic)
    const timestamp = Date.now();
    let actionId = 'unknown';

    if (trace.actionId) {
      actionId = trace.actionId;
    } else if (
      trace.getTracedActions &&
      typeof trace.getTracedActions === 'function'
    ) {
      const tracedActions = trace.getTracedActions();
      if (tracedActions.size > 0) {
        actionId = Array.from(tracedActions.keys())[0];
      }
    }

    const metadata = {
      actionId,
      timestamp,
      error: trace.execution?.error || trace.error || false,
    };

    // Generate ID based on configured strategy
    switch (this.#namingStrategy) {
      case NamingStrategy.TIMESTAMP_FIRST:
        return this.#generateTimestampFirst(metadata);

      case NamingStrategy.ACTION_FIRST:
        return this.#generateActionFirst(metadata);

      case NamingStrategy.SEQUENTIAL:
        return this.#generateSequential(metadata);

      default:
        return this.#generateTimestampFirst(metadata);
    }
  }

  /**
   * Generate timestamp-first trace ID format
   * @private
   */
  #generateTimestampFirst(metadata) {
    const parts = [
      this.#formatTimestamp(metadata.timestamp),
      this.#sanitizeActionId(metadata.actionId),
    ];

    if (metadata.error) {
      parts.push('ERROR');
    }

    if (this.#includeHash) {
      parts.push(this.#generateWebHash(metadata));
    }

    return parts.join('_');
  }

  /**
   * Generate action-first trace ID format
   * @private
   */
  #generateActionFirst(metadata) {
    const parts = [
      this.#sanitizeActionId(metadata.actionId),
      this.#formatTimestamp(metadata.timestamp),
    ];

    if (metadata.error) {
      parts.push('ERROR');
    }

    if (this.#includeHash) {
      parts.push(this.#generateWebHash(metadata));
    }

    return parts.join('_');
  }

  /**
   * Generate sequential trace ID format
   * @private
   */
  #generateSequential(metadata) {
    const sequence = ++this.#sequenceCounter;
    const parts = [
      'trace',
      String(sequence).padStart(6, '0'),
      this.#sanitizeActionId(metadata.actionId),
      this.#formatTimestamp(metadata.timestamp),
    ];

    if (metadata.error) {
      parts.push('ERROR');
    }

    return parts.join('_');
  }

  /**
   * Format timestamp for browser-compatible file naming
   * @private
   */
  #formatTimestamp(timestamp) {
    const date = new Date(timestamp);

    switch (this.#timestampFormat) {
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
        return this.#formatTimestamp(timestamp);
    }
  }

  /**
   * Sanitize action ID for browser-compatible storage keys
   * @private
   */
  #sanitizeActionId(actionId) {
    if (!actionId) return 'unknown';

    // Replace namespace colon and other special chars with dashes
    return (
      actionId
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/^[.\s]+|[.\s]+$/g, '')
        .substring(0, 30) || 'unknown'
    );
  }

  /**
   * Generate browser-compatible hash for uniqueness
   * @private
   */
  #generateWebHash(metadata) {
    // Simple hash for browser compatibility
    const data = JSON.stringify({
      ...metadata,
      random: Math.random(),
      timestamp: performance.now(),
    });

    // Use simple string hash algorithm
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16).substring(0, this.#hashLength);
  }
}

// Export constants for external use
export { NamingStrategy, TimestampFormat };
```

### 2. Integration with Existing Systems

#### Container Registration

```javascript
// src/dependencyInjection/appContainer.js
import {
  NamingStrategy,
  TimestampFormat,
} from '../actions/tracing/actionTraceOutputService.js';

// Register enhanced service with naming options
container.register(tokens.IActionTraceOutputService, ActionTraceOutputService, {
  dependencies: [
    'storageAdapter',
    'logger',
    'actionTraceFilter',
    'jsonFormatter',
    'humanReadableFormatter',
    'eventBus',
  ],
  options: {
    namingOptions: {
      strategy: NamingStrategy.TIMESTAMP_FIRST,
      timestampFormat: TimestampFormat.COMPACT,
      includeHash: true,
      hashLength: 6,
    },
  },
});
```

#### Configuration Integration

```javascript
// config/trace-config.json
{
  "naming": {
    "strategy": "timestamp_first",
    "timestampFormat": "compact",
    "includeHash": true,
    "hashLength": 6
  },
  "storage": {
    "rotationPolicy": "count",
    "maxTraceCount": 100
  }
}
```

## Implementation Notes

### Browser-Compatible Naming Strategies

1. **Timestamp First**
   - Format: `20240115_103045_core-go_abc123`
   - Best for chronological browsing of IndexedDB records
   - Natural sorting for trace export
   - Compatible with existing `#generateTraceId()` method

2. **Action First**
   - Format: `core-go_20240115_103045_abc123`
   - Groups traces by action type in storage
   - Useful for filtering by action ID
   - Good for debugging specific actions

3. **Sequential**
   - Format: `trace_000001_core-go_20240115103045`
   - Simple incrementing counter
   - Guaranteed order within session
   - Compact and predictable

### Browser Storage Considerations

1. **IndexedDB Key Constraints**
   - No filesystem path separators needed
   - Storage keys can be longer than traditional filenames
   - UTF-8 safe character encoding
   - Consistent with existing storage patterns

2. **Hash Generation**
   - Uses browser-compatible string hashing
   - No Node.js crypto dependency
   - Performance.now() for high-resolution uniqueness
   - Collision-resistant within session scope

3. **Integration Points**
   - Enhances existing `#generateTraceId()` method
   - Works with StorageRotationManager
   - Compatible with IndexedDBStorageAdapter
   - Maintains backward compatibility

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/actions/tracing/actionTraceOutputService.naming.test.js

describe('ActionTraceOutputService - Naming Conventions', () => {
  it('should generate timestamp-first trace IDs');
  it('should generate action-first trace IDs');  
  it('should generate sequential trace IDs');
  it('should sanitize action IDs for browser storage');
  it('should format timestamps in different formats');
  it('should include error indicators in trace IDs');
  it('should generate browser-compatible hashes');
  it('should handle empty or invalid action IDs');
  it('should maintain uniqueness within session');
  it('should integrate with existing trace storage');
});
```

### Integration Tests

```javascript
// tests/integration/actions/tracing/namingIntegration.test.js

describe('ActionTraceOutputService - Naming Integration', () => {
  it('should work with StorageRotationManager');
  it('should maintain consistency with IndexedDBStorageAdapter');
  it('should preserve naming during export operations');
  it('should handle configuration changes');
});
```

## Examples

### Generated Trace IDs

```
// Timestamp First Strategy
20240115_103045_core-go_a1b2c3
20240115_103046_core-attack_ERROR_d4e5f6

// Action First Strategy  
core-go_20240115_103045_a1b2c3
core-attack_20240115_103046_ERROR_d4e5f6

// Sequential Strategy
trace_000001_core-go_20240115103045
trace_000002_core-attack_20240115103046_ERROR
```

## Dependencies

- `IStorageAdapter` - IndexedDB storage interface
- `ILogger` - Logging service  
- `StorageRotationManager` - File rotation management
- Existing ActionTraceOutputService infrastructure
- Browser-compatible APIs (performance.now(), Date)

## Next Steps

1. **Implementation** - Enhance existing ActionTraceOutputService with naming methods
2. **Configuration** - Add naming options to dependency injection setup  
3. **Testing** - Create comprehensive test suite for naming functionality
4. **Integration** - Ensure compatibility with StorageRotationManager
5. **ACTTRA-030** - Storage rotation policies with naming awareness

---

**Ticket Status**: Ready for Implementation (Enhanced for Browser Compatibility)
**Last Updated**: 2025-01-12  
**Author**: System Architect
