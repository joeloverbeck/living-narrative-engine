# ACTTRA-003: Enhance ActionTraceConfigLoader with Performance Optimizations

## Status

**Status**: Not Started  
**Priority**: P0 - Critical  
**Estimated Time**: 2 hours  
**Complexity**: Low-Medium  
**Dependencies**: ACTTRA-001 (schema), ACTTRA-002 (config extension)  
**Blocked By**: None

## Context

**IMPORTANT**: Analysis shows that the existing `ActionTraceConfigLoader` already provides all the filtering functionality originally proposed for ActionTraceFilter, including:
- `shouldTraceAction(actionId)` method with wildcard pattern support
- Configuration loading and caching
- Pattern matching for exact matches and wildcards

Instead of creating a duplicate ActionTraceFilter class, this workflow focuses on enhancing the existing `ActionTraceConfigLoader` with performance optimizations to meet the <1ms lookup requirements.

## Requirements

### Functional Requirements

1. ✅ **Already Implemented**: Load and cache action tracing configuration
2. **Enhancement Needed**: Optimize exact action ID matching to O(1) lookup using Set
3. ✅ **Already Implemented**: Support wildcard patterns (`*`, `mod:*`)
4. **Enhancement Needed**: Add verbosity level and inclusion configuration methods
5. **Enhancement Needed**: Optimize initialization and caching for performance
6. **Enhancement Needed**: Add statistics and performance monitoring methods

### Non-Functional Requirements

- ✅ **Already Implemented**: Minimal performance impact when disabled
- **Target**: Optimize lookup times to <1ms per check (currently may be slower due to array iteration)
- **Enhancement Needed**: Memory efficient caching with Set-based lookups
- ✅ **Already Implemented**: Configuration hot reload support via `reloadConfig()`

## Implementation Details

### 1. Performance Enhancement to Existing ActionTraceConfigLoader

**Enhancements to Add:**

#### Performance Optimizations to Implement:

1. **Set-based Exact Matching**: Replace array iteration with Set for O(1) lookups
2. **Cached Wildcard Patterns**: Pre-compile wildcard patterns for faster matching  
3. **Additional Configuration Methods**: Add verbosity, inclusion, and statistics methods
4. **Performance Monitoring**: Add statistics and timing methods

#### Code Changes Needed:

```javascript
// Add these private fields to the existing ActionTraceConfigLoader class:
#tracedActionsSet = new Set(); // O(1) exact match lookups
#wildcardPatterns = []; // Pre-compiled wildcard patterns for performance

// Enhance the existing shouldTraceAction method to use Set-based lookups:
async shouldTraceAction(actionId) {
  const config = await this.loadConfig();

  if (!config.enabled) {
    return false;
  }

  // Fast path: O(1) exact match using Set
  if (this.#tracedActionsSet.has(actionId)) {
    return true;
  }

  // Check pre-compiled wildcard patterns
  return this.#wildcardPatterns.some(pattern => {
    if (pattern.type === 'all') return true;
    if (pattern.type === 'mod') {
      return actionId.startsWith(pattern.prefix) && pattern.regex.test(actionId);
    }
    return false;
  });
}

// Add these new methods to the existing class:
getVerbosityLevel() { /* implementation */ }
getInclusionConfig() { /* implementation */ }
getOutputDirectory() { /* implementation */ }  
getRotationConfig() { /* implementation */ }
filterDataByVerbosity(data) { /* implementation */ }
getStatistics() { /* implementation */ }

// Add this method to rebuild lookup structures when config changes:
#buildLookupStructures() {
  this.#tracedActionsSet.clear();
  this.#wildcardPatterns = [];
  
  for (const pattern of config.tracedActions) {
    if (pattern === '*') {
      this.#wildcardPatterns.push({ type: 'all' });
    } else if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -1);
      this.#wildcardPatterns.push({
        type: 'mod',
        prefix,
        regex: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z_]+$`)
      });
    } else {
      this.#tracedActionsSet.add(pattern); // O(1) exact matches
    }
  }
}
```

### 2. Type Definitions

**Status**: ✅ **Already Exists** in `src/configuration/actionTraceConfigLoader.js`

The existing ActionTraceConfigLoader already includes the `ActionTracingConfig` typedef with all necessary properties. No additional type definitions are needed since we're enhancing the existing class rather than creating new ones.

## Testing Requirements

### Unit Tests

**Additional tests needed** for the new performance optimization methods:

```javascript
// Add these tests to the existing tests/unit/configuration/actionTraceConfigLoader.test.js

describe('Performance Optimizations', () => {
  it('should use O(1) exact matching with Set', async () => {
    // Test that exact matches are faster with Set vs array iteration
    const start = performance.now();
    const result = await loader.shouldTraceAction('core:go');
    const duration = performance.now() - start;
    
    expect(result).toBe(true);
    expect(duration).toBeLessThan(1); // <1ms requirement
  });
  
  it('should provide verbosity configuration', async () => {
    expect(loader.getVerbosityLevel).toBeDefined();
    expect(loader.getInclusionConfig).toBeDefined();
    expect(loader.getOutputDirectory).toBeDefined();
    expect(loader.getRotationConfig).toBeDefined();
  });
  
  it('should provide performance statistics', async () => {
    expect(loader.getStatistics).toBeDefined();
    const stats = loader.getStatistics();
    expect(stats).toHaveProperty('exactMatches');
    expect(stats).toHaveProperty('wildcardPatterns');
  });
  
  it('should filter data by verbosity level', async () => {
    expect(loader.filterDataByVerbosity).toBeDefined();
    const data = { timestamp: Date.now(), result: 'success', debugInfo: {} };
    const filtered = loader.filterDataByVerbosity(data);
    expect(filtered).toBeDefined();
  });
});
```

### Performance Tests

**File**: `tests/performance/configuration/actionTraceConfigLoader.perf.test.js`

**Directory Status**: Need to create `/tests/performance/configuration/` directory.

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionTraceConfigLoader from '../../../src/configuration/actionTraceConfigLoader.js';

describe('ActionTraceConfigLoader Performance', () => {
  let loader;

  beforeEach(async () => {
    // Create loader with many patterns for performance testing
    const mockTraceConfigLoader = {
      loadConfig: jest.fn().mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: [
            // 100 exact matches
            ...Array.from({ length: 100 }, (_, i) => `mod${i}:action${i}`),
            // 10 wildcard patterns
            ...Array.from({ length: 10 }, (_, i) => `wildcard${i}:*`),
          ],
          outputDirectory: './traces',
          verbosity: 'standard',
        }
      })
    };

    const mockValidator = {
      validate: jest.fn().mockResolvedValue({ isValid: true })
    };

    loader = new ActionTraceConfigLoader({
      traceConfigLoader: mockTraceConfigLoader,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
      validator: mockValidator
    });

    await loader.loadConfig(); // Initialize with optimized structures
  });

  it('should perform exact match lookups in <1ms', async () => {
    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await loader.shouldTraceAction('mod50:action50');
    }

    const duration = performance.now() - start;
    const avgTime = duration / iterations;

    expect(avgTime).toBeLessThan(1); // Less than 1ms per lookup
  });

  it('should handle wildcard matching efficiently', async () => {
    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await loader.shouldTraceAction('wildcard5:something');
    }

    const duration = performance.now() - start;
    const avgTime = duration / iterations;

    expect(avgTime).toBeLessThan(1); // Less than 1ms per lookup
  });

  it('should handle non-matching lookups efficiently', async () => {
    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await loader.shouldTraceAction('nonexistent:action');
    }

    const duration = performance.now() - start;
    const avgTime = duration / iterations;

    expect(avgTime).toBeLessThan(1); // Less than 1ms per lookup
  });
});
```

## Acceptance Criteria

- [ ] ActionTraceConfigLoader enhanced with performance optimizations
- [ ] ✅ Configuration loading and caching working (already implemented)
- [ ] Exact action ID matching with O(1) Set-based lookup (enhancement needed)
- [ ] ✅ Wildcard pattern support (`*`, `mod:*`) (already implemented)
- [ ] Verbosity-based data filtering methods added
- [ ] Pre-compiled wildcard patterns for performance
- [ ] ✅ Configuration reload support (already implemented via `reloadConfig()`)
- [ ] Performance targets met (<1ms per lookup)
- [ ] Enhanced unit tests covering new performance methods
- [ ] Performance tests validating lookup speed in new test directory
- [ ] Statistics and monitoring methods implemented
- [ ] ✅ Error handling for invalid configurations (already implemented)

## Performance Considerations

1. **✅ Already Implemented**: Short-circuit evaluation - Check enabled flag first
2. **✅ Already Implemented**: Caching - Configuration cached to avoid repeated loading  
3. **Enhancement Needed**: Set-based lookup - Replace array iteration with Set for O(1) exact matches
4. **Enhancement Needed**: Pre-compiled patterns - Compile wildcard patterns only once during config load
5. **Enhancement Needed**: Optimized data structures - Build lookup structures once and reuse

## Related Tickets

- ACTTRA-001: Create action tracing configuration schema (provides schema)
- ACTTRA-002: Extend existing trace configuration (provides config) 
- ACTTRA-009: Create ActionAwareStructuredTrace class (will use enhanced ActionTraceConfigLoader)
- ACTTRA-010: Enhance ActionDiscoveryService with tracing (will integrate enhanced ActionTraceConfigLoader)

## Notes

**Architecture Decision**: After analysis, it was determined that creating a separate ActionTraceFilter class would duplicate functionality already present in the existing ActionTraceConfigLoader. The ActionTraceConfigLoader already includes:

- ✅ `shouldTraceAction(actionId)` method with pattern matching
- ✅ Configuration loading and caching
- ✅ Wildcard pattern support (`*` and `mod:*`)
- ✅ Hot reload via `reloadConfig()`

**Recommendation**: Enhance the existing ActionTraceConfigLoader with performance optimizations rather than creating duplicate functionality.

**Future Considerations**:
- Consider adding LRU cache for recent lookup results
- May need support for complex regex patterns beyond basic wildcards
- ✅ Hot reload capability already implemented and important for debugging
