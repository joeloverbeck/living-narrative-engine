# ACTTRA-004: Add Wildcard Pattern Support

## Status

**Status**: Not Started  
**Priority**: P1 - High  
**Estimated Time**: 3 hours  
**Complexity**: Medium  
**Dependencies**: ACTTRA-003 (ActionTraceFilter implementation)  
**Blocked By**: None

## Context

The action tracing system needs robust wildcard pattern support to allow flexible action selection. This includes support for `*` (all actions), `mod:*` (all actions from a mod), and potentially more complex patterns in the future.

## Requirements

### Functional Requirements

1. Support `*` pattern to match all actions
2. Support `mod:*` pattern to match all actions from a specific mod
3. Validate pattern syntax at configuration load time
4. Optimize pattern matching for performance
5. Support case-insensitive matching option
6. Provide pattern testing utilities

### Non-Functional Requirements

- Pattern matching must be <1ms per check
- Memory efficient pattern storage
- Clear error messages for invalid patterns
- Extensible for future pattern types

## Implementation Details

### 1. Pattern Parser and Compiler

**File**: `src/actions/tracing/patternMatcher.js`

```javascript
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @file Pattern matching engine for action tracing
 * Supports wildcards and other pattern types
 */

/**
 * PatternMatcher - Compiles and matches patterns for action filtering
 */
class PatternMatcher {
  #patterns;
  #compiledPatterns;
  #logger;
  #caseInsensitive;

  constructor({ logger, caseInsensitive = false }) {
    validateDependency(logger, 'ILogger');

    this.#logger = logger;
    this.#patterns = [];
    this.#compiledPatterns = [];
    this.#caseInsensitive = caseInsensitive;
  }

  /**
   * Compile patterns for efficient matching
   * @param {string[]} patterns - Array of pattern strings
   */
  compilePatterns(patterns) {
    if (!Array.isArray(patterns)) {
      throw new TypeError('Patterns must be an array');
    }

    this.#patterns = patterns;
    this.#compiledPatterns = [];

    for (const pattern of patterns) {
      const compiled = this.#compilePattern(pattern);
      if (compiled) {
        this.#compiledPatterns.push(compiled);
      }
    }

    this.#logger.debug('Patterns compiled', {
      patternCount: patterns.length,
      compiledCount: this.#compiledPatterns.length,
    });
  }

  /**
   * Compile a single pattern
   * @private
   * @param {string} pattern - Pattern to compile
   * @returns {Object|null} Compiled pattern object
   */
  #compilePattern(pattern) {
    if (!pattern || typeof pattern !== 'string') {
      this.#logger.warn(`Invalid pattern: ${pattern}`);
      return null;
    }

    // Handle different pattern types
    if (pattern === '*') {
      // Match all
      return {
        type: 'all',
        original: pattern,
        test: () => true,
      };
    }

    if (pattern.endsWith(':*')) {
      // Mod wildcard: "mod:*"
      const modName = pattern.slice(0, -2);
      if (!this.#isValidModName(modName)) {
        this.#logger.warn(`Invalid mod name in pattern: ${pattern}`);
        return null;
      }

      const prefix = this.#caseInsensitive ? modName.toLowerCase() : modName;
      return {
        type: 'mod_wildcard',
        original: pattern,
        modName,
        prefix: prefix + ':',
        test: (actionId) => {
          const id = this.#caseInsensitive ? actionId.toLowerCase() : actionId;
          return id.startsWith(prefix + ':');
        },
      };
    }

    if (pattern.includes('*')) {
      // General wildcard pattern
      return this.#compileWildcardPattern(pattern);
    }

    // Exact match
    const exactPattern = this.#caseInsensitive
      ? pattern.toLowerCase()
      : pattern;
    return {
      type: 'exact',
      original: pattern,
      pattern: exactPattern,
      test: (actionId) => {
        const id = this.#caseInsensitive ? actionId.toLowerCase() : actionId;
        return id === exactPattern;
      },
    };
  }

  /**
   * Compile a general wildcard pattern
   * @private
   */
  #compileWildcardPattern(pattern) {
    // Convert wildcard pattern to regex
    // Escape special regex characters except *
    let regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    if (this.#caseInsensitive) {
      regexPattern = regexPattern.toLowerCase();
    }

    try {
      const regex = new RegExp(
        `^${regexPattern}$`,
        this.#caseInsensitive ? 'i' : ''
      );
      return {
        type: 'wildcard',
        original: pattern,
        regex,
        test: (actionId) => regex.test(actionId),
      };
    } catch (error) {
      this.#logger.error(
        `Failed to compile wildcard pattern: ${pattern}`,
        error
      );
      return null;
    }
  }

  /**
   * Validate mod name format
   * @private
   */
  #isValidModName(modName) {
    // Mod names should be lowercase alphanumeric with underscores
    return /^[a-z][a-z0-9_]*$/.test(modName);
  }

  /**
   * Test if an action ID matches any pattern
   * @param {string} actionId - Action ID to test
   * @returns {boolean} True if matches any pattern
   */
  matches(actionId) {
    if (!actionId || typeof actionId !== 'string') {
      return false;
    }

    for (const compiled of this.#compiledPatterns) {
      if (compiled.test(actionId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get information about which pattern matched
   * @param {string} actionId - Action ID to test
   * @returns {Object|null} Matching pattern info or null
   */
  getMatchingPattern(actionId) {
    if (!actionId || typeof actionId !== 'string') {
      return null;
    }

    for (const compiled of this.#compiledPatterns) {
      if (compiled.test(actionId)) {
        return {
          type: compiled.type,
          original: compiled.original,
          actionId,
        };
      }
    }

    return null;
  }

  /**
   * Get statistics about compiled patterns
   * @returns {Object}
   */
  getStatistics() {
    const stats = {
      totalPatterns: this.#compiledPatterns.length,
      exactMatches: 0,
      modWildcards: 0,
      generalWildcards: 0,
      matchAll: false,
    };

    for (const pattern of this.#compiledPatterns) {
      switch (pattern.type) {
        case 'exact':
          stats.exactMatches++;
          break;
        case 'mod_wildcard':
          stats.modWildcards++;
          break;
        case 'wildcard':
          stats.generalWildcards++;
          break;
        case 'all':
          stats.matchAll = true;
          break;
      }
    }

    return stats;
  }

  /**
   * Validate a pattern without compiling
   * @static
   * @param {string} pattern - Pattern to validate
   * @returns {Object} Validation result
   */
  static validatePattern(pattern) {
    const result = {
      valid: true,
      type: null,
      errors: [],
    };

    if (!pattern || typeof pattern !== 'string') {
      result.valid = false;
      result.errors.push('Pattern must be a non-empty string');
      return result;
    }

    // Check for valid pattern types
    if (pattern === '*') {
      result.type = 'all';
    } else if (pattern.endsWith(':*')) {
      result.type = 'mod_wildcard';
      const modName = pattern.slice(0, -2);
      if (!/^[a-z][a-z0-9_]*$/.test(modName)) {
        result.valid = false;
        result.errors.push(
          `Invalid mod name: ${modName}. Must be lowercase alphanumeric with underscores`
        );
      }
    } else if (pattern.includes('*')) {
      result.type = 'wildcard';
      // Check for multiple consecutive asterisks
      if (pattern.includes('**')) {
        result.errors.push(
          'Warning: Multiple consecutive asterisks are redundant'
        );
      }
    } else if (pattern.includes(':')) {
      result.type = 'exact';
      const [mod, action] = pattern.split(':');
      if (!/^[a-z][a-z0-9_]*$/.test(mod)) {
        result.valid = false;
        result.errors.push(`Invalid mod name: ${mod}`);
      }
      if (!/^[a-z][a-z0-9_]*$/.test(action)) {
        result.valid = false;
        result.errors.push(`Invalid action name: ${action}`);
      }
    } else {
      result.valid = false;
      result.errors.push('Pattern must contain a colon (:) separator');
    }

    return result;
  }

  /**
   * Clear all patterns
   */
  clear() {
    this.#patterns = [];
    this.#compiledPatterns = [];
  }
}

export default PatternMatcher;
```

### 2. Pattern Matcher Factory

**File**: `src/actions/tracing/patternMatcherFactory.js`

```javascript
import PatternMatcher from './patternMatcher.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Factory for creating optimized pattern matchers
 */
class PatternMatcherFactory {
  #logger;
  #cache;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger');
    this.#logger = logger;
    this.#cache = new Map();
  }

  /**
   * Create an optimized pattern matcher
   * @param {string[]} patterns - Patterns to match
   * @param {Object} options - Matcher options
   * @returns {PatternMatcher}
   */
  createMatcher(patterns, options = {}) {
    const cacheKey = this.#getCacheKey(patterns, options);

    // Check cache
    if (this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey);
    }

    // Analyze patterns to choose optimal strategy
    const analysis = this.#analyzePatterns(patterns);

    let matcher;
    if (analysis.onlyExact) {
      // Use optimized exact matcher
      matcher = this.#createExactMatcher(patterns, options);
    } else if (analysis.hasAll) {
      // Use simple all-matcher
      matcher = this.#createAllMatcher(options);
    } else {
      // Use general pattern matcher
      matcher = new PatternMatcher({
        logger: this.#logger,
        caseInsensitive: options.caseInsensitive,
      });
      matcher.compilePatterns(patterns);
    }

    // Cache the matcher
    this.#cache.set(cacheKey, matcher);

    return matcher;
  }

  /**
   * Analyze patterns to determine optimization strategy
   * @private
   */
  #analyzePatterns(patterns) {
    const analysis = {
      hasAll: false,
      onlyExact: true,
      modWildcards: 0,
      generalWildcards: 0,
    };

    for (const pattern of patterns) {
      if (pattern === '*') {
        analysis.hasAll = true;
        analysis.onlyExact = false;
      } else if (pattern.includes('*')) {
        analysis.onlyExact = false;
        if (pattern.endsWith(':*')) {
          analysis.modWildcards++;
        } else {
          analysis.generalWildcards++;
        }
      }
    }

    return analysis;
  }

  /**
   * Create optimized exact matcher using Set
   * @private
   */
  #createExactMatcher(patterns, options) {
    const patternSet = new Set(
      options.caseInsensitive ? patterns.map((p) => p.toLowerCase()) : patterns
    );

    return {
      matches: (actionId) => {
        const id = options.caseInsensitive ? actionId.toLowerCase() : actionId;
        return patternSet.has(id);
      },
      getMatchingPattern: (actionId) => {
        const id = options.caseInsensitive ? actionId.toLowerCase() : actionId;
        return patternSet.has(id)
          ? { type: 'exact', original: actionId, actionId }
          : null;
      },
      getStatistics: () => ({
        totalPatterns: patternSet.size,
        exactMatches: patternSet.size,
        modWildcards: 0,
        generalWildcards: 0,
        matchAll: false,
      }),
    };
  }

  /**
   * Create simple all-matcher
   * @private
   */
  #createAllMatcher(options) {
    return {
      matches: () => true,
      getMatchingPattern: (actionId) => ({
        type: 'all',
        original: '*',
        actionId,
      }),
      getStatistics: () => ({
        totalPatterns: 1,
        exactMatches: 0,
        modWildcards: 0,
        generalWildcards: 0,
        matchAll: true,
      }),
    };
  }

  /**
   * Generate cache key for patterns and options
   * @private
   */
  #getCacheKey(patterns, options) {
    const sortedPatterns = [...patterns].sort();
    return JSON.stringify({
      patterns: sortedPatterns,
      options,
    });
  }

  /**
   * Clear the matcher cache
   */
  clearCache() {
    this.#cache.clear();
  }
}

export default PatternMatcherFactory;
```

### 3. Integration with ActionTraceFilter

Update `ActionTraceFilter` to use the pattern matcher:

```javascript
// In actionTraceFilter.js
import PatternMatcherFactory from './patternMatcherFactory.js';

class ActionTraceFilter {
  #patternMatcher;
  #patternMatcherFactory;

  constructor({ configLoader, logger }) {
    // ... existing code ...
    this.#patternMatcherFactory = new PatternMatcherFactory({ logger });
    this.#patternMatcher = null;
  }

  #buildLookupStructures() {
    // Use pattern matcher for wildcard support
    this.#patternMatcher = this.#patternMatcherFactory.createMatcher(
      this.#config.tracedActions || [],
      { caseInsensitive: false }
    );
  }

  shouldTrace(actionId) {
    if (!this.isEnabled() || !this.#isInitialized) {
      return false;
    }

    return this.#patternMatcher?.matches(actionId) || false;
  }
}
```

## Testing Requirements

### Unit Tests

**File**: `tests/unit/actions/tracing/patternMatcher.unit.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import PatternMatcher from '../../../../src/actions/tracing/patternMatcher.js';

describe('PatternMatcher', () => {
  let matcher;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    matcher = new PatternMatcher({ logger: mockLogger });
  });

  describe('pattern compilation', () => {
    it('should compile exact match patterns', () => {
      matcher.compilePatterns(['core:go', 'core:attack']);

      expect(matcher.matches('core:go')).toBe(true);
      expect(matcher.matches('core:attack')).toBe(true);
      expect(matcher.matches('core:move')).toBe(false);
    });

    it('should compile wildcard all pattern', () => {
      matcher.compilePatterns(['*']);

      expect(matcher.matches('any:action')).toBe(true);
      expect(matcher.matches('core:go')).toBe(true);
      expect(matcher.matches('custom:test')).toBe(true);
    });

    it('should compile mod wildcard patterns', () => {
      matcher.compilePatterns(['core:*', 'custom:*']);

      expect(matcher.matches('core:go')).toBe(true);
      expect(matcher.matches('core:attack')).toBe(true);
      expect(matcher.matches('custom:action')).toBe(true);
      expect(matcher.matches('other:action')).toBe(false);
    });

    it('should handle general wildcard patterns', () => {
      matcher.compilePatterns(['core:go*', '*:attack', 'custom:*_action']);

      expect(matcher.matches('core:go')).toBe(true);
      expect(matcher.matches('core:go_north')).toBe(true);
      expect(matcher.matches('any:attack')).toBe(true);
      expect(matcher.matches('custom:test_action')).toBe(true);
    });

    it('should handle invalid patterns gracefully', () => {
      matcher.compilePatterns([null, undefined, '', 123, 'Core:Go']);

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('case sensitivity', () => {
    it('should support case-insensitive matching', () => {
      const caseInsensitiveMatcher = new PatternMatcher({
        logger: mockLogger,
        caseInsensitive: true,
      });

      caseInsensitiveMatcher.compilePatterns(['CORE:GO', 'Custom:*']);

      expect(caseInsensitiveMatcher.matches('core:go')).toBe(true);
      expect(caseInsensitiveMatcher.matches('CORE:GO')).toBe(true);
      expect(caseInsensitiveMatcher.matches('custom:action')).toBe(true);
      expect(caseInsensitiveMatcher.matches('CUSTOM:ACTION')).toBe(true);
    });
  });

  describe('pattern validation', () => {
    it('should validate valid patterns', () => {
      expect(PatternMatcher.validatePattern('core:go')).toEqual({
        valid: true,
        type: 'exact',
        errors: [],
      });

      expect(PatternMatcher.validatePattern('*')).toEqual({
        valid: true,
        type: 'all',
        errors: [],
      });

      expect(PatternMatcher.validatePattern('core:*')).toEqual({
        valid: true,
        type: 'mod_wildcard',
        errors: [],
      });
    });

    it('should reject invalid patterns', () => {
      const result = PatternMatcher.validatePattern('InvalidMod:action');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid mod name: InvalidMod');
    });

    it('should warn about redundant patterns', () => {
      const result = PatternMatcher.validatePattern('core:**action');
      expect(result.errors).toContain(
        'Warning: Multiple consecutive asterisks are redundant'
      );
    });
  });

  describe('statistics', () => {
    it('should provide pattern statistics', () => {
      matcher.compilePatterns([
        'core:go',
        'core:attack',
        'custom:*',
        '*:test',
        '*',
      ]);

      const stats = matcher.getStatistics();

      expect(stats.totalPatterns).toBe(5);
      expect(stats.exactMatches).toBe(2);
      expect(stats.modWildcards).toBe(1);
      expect(stats.generalWildcards).toBe(1);
      expect(stats.matchAll).toBe(true);
    });
  });

  describe('getMatchingPattern', () => {
    it('should return matching pattern information', () => {
      matcher.compilePatterns(['core:go', 'custom:*']);

      const exactMatch = matcher.getMatchingPattern('core:go');
      expect(exactMatch).toEqual({
        type: 'exact',
        original: 'core:go',
        actionId: 'core:go',
      });

      const wildcardMatch = matcher.getMatchingPattern('custom:action');
      expect(wildcardMatch).toEqual({
        type: 'mod_wildcard',
        original: 'custom:*',
        actionId: 'custom:action',
      });

      const noMatch = matcher.getMatchingPattern('other:action');
      expect(noMatch).toBeNull();
    });
  });
});
```

### Performance Tests

```javascript
describe('PatternMatcher Performance', () => {
  it('should handle large pattern sets efficiently', () => {
    const patterns = [
      ...Array.from({ length: 1000 }, (_, i) => `mod${i}:action${i}`),
      ...Array.from({ length: 100 }, (_, i) => `wildcard${i}:*`),
    ];

    const matcher = new PatternMatcher({ logger: mockLogger });
    matcher.compilePatterns(patterns);

    const start = performance.now();
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      matcher.matches(`mod${i % 1000}:action${i % 1000}`);
    }

    const duration = performance.now() - start;
    const avgTime = duration / iterations;

    expect(avgTime).toBeLessThan(1); // Less than 1ms per match
  });
});
```

## Acceptance Criteria

- [ ] PatternMatcher class implemented with all pattern types
- [ ] Support for `*` (match all) pattern
- [ ] Support for `mod:*` (mod wildcard) pattern
- [ ] Support for general wildcard patterns
- [ ] Case-insensitive matching option
- [ ] Pattern validation utilities
- [ ] Pattern matcher factory for optimization
- [ ] Integration with ActionTraceFilter
- [ ] Performance target met (<1ms per match)
- [ ] Unit tests with >80% coverage
- [ ] Performance tests passing

## Related Tickets

- ACTTRA-003: Implement ActionTraceFilter class (integrates with)
- ACTTRA-005: Implement configuration caching (uses patterns)

## Notes

- Consider adding support for glob patterns in future
- May need to add negative patterns (exclusions)
- Pattern compilation could be cached across reloads
