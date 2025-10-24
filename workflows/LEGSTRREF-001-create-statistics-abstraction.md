# LEGSTRREF-001: Create Statistics Abstraction

## Metadata
- **Ticket ID**: LEGSTRREF-001
- **Phase**: 1 - Foundation
- **Priority**: High
- **Effort**: 0.5 days
- **Status**: Not Started
- **Dependencies**: None
- **Blocks**: LEGSTRREF-004, LEGSTRREF-005, LEGSTRREF-006

## Problem Statement

### Current Issue
The `LegacyStrategy` class tracks statistics through a scattered pattern with conditional checks:

```javascript
#incrementStat(stats, key) {
  if (!stats || typeof stats !== 'object') {
    return; // Silent no-op if stats undefined
  }
  if (typeof stats[key] !== 'number') {
    stats[key] = 0;
  }
  stats[key] += 1;
}
```

**Issues**:
- Statistics tracking scattered across 15+ call sites
- Optional stats object creates inconsistent behavior
- Difficult to verify statistics accuracy
- Mixing business logic with metrics collection
- No statistics abstraction or interface

### Impact
- Hard to ensure statistics completeness
- Testing requires mocking statistics object
- Changes to statistics requirements affect multiple locations
- No centralized control over statistics operations

## Solution Overview

Create a `StatisticsCollector` class that encapsulates all statistics tracking logic, providing a clean API and removing conditional checks from business logic.

### Benefits
- ✅ Centralized statistics logic
- ✅ Easier to test statistics tracking
- ✅ Clear API for statistics operations
- ✅ Can extend with more operations (reset, snapshot, etc.)
- ✅ Removes conditional checks from business logic

## Implementation Steps

### Step 1: Create StatisticsCollector Class

**File**: `src/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.js`

```javascript
/**
 * @file StatisticsCollector - Encapsulates statistics tracking logic
 */

/**
 * Encapsulates statistics tracking logic for action formatting.
 * Provides a clean API for incrementing counters and querying stats.
 */
class StatisticsCollector {
  #stats;
  #enabled;

  /**
   * Creates a new statistics collector.
   * @param {Object|null} stats - Statistics object to track into, or null to disable
   */
  constructor(stats) {
    this.#stats = stats || null;
    this.#enabled = stats && typeof stats === 'object';
  }

  /**
   * Increments a statistics counter by 1.
   * No-op if statistics are disabled.
   * @param {string} key - The statistic key to increment
   */
  increment(key) {
    if (!this.#enabled) {
      return;
    }

    if (typeof this.#stats[key] !== 'number') {
      this.#stats[key] = 0;
    }

    this.#stats[key] += 1;
  }

  /**
   * Checks if statistics collection is enabled.
   * @returns {boolean} True if statistics are being collected
   */
  isEnabled() {
    return this.#enabled;
  }

  /**
   * Gets the underlying statistics object.
   * @returns {Object|null} The statistics object, or null if disabled
   */
  getStats() {
    return this.#stats;
  }

  /**
   * Gets the current value of a statistic.
   * @param {string} key - The statistic key to query
   * @returns {number|undefined} The statistic value, or undefined if not set
   */
  get(key) {
    if (!this.#enabled) {
      return undefined;
    }
    return this.#stats[key];
  }

  /**
   * Resets a specific statistic to 0.
   * No-op if statistics are disabled.
   * @param {string} key - The statistic key to reset
   */
  reset(key) {
    if (!this.#enabled) {
      return;
    }
    this.#stats[key] = 0;
  }

  /**
   * Resets all statistics to 0.
   * No-op if statistics are disabled.
   */
  resetAll() {
    if (!this.#enabled) {
      return;
    }
    for (const key of Object.keys(this.#stats)) {
      this.#stats[key] = 0;
    }
  }

  /**
   * Creates a snapshot of current statistics.
   * @returns {Object|null} A copy of the statistics object, or null if disabled
   */
  snapshot() {
    if (!this.#enabled) {
      return null;
    }
    return { ...this.#stats };
  }
}

export default StatisticsCollector;
```

### Step 2: Create Comprehensive Unit Tests

**File**: `tests/unit/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import StatisticsCollector from '../../../../../../src/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.js';

describe('StatisticsCollector', () => {
  describe('constructor', () => {
    it('should accept a valid stats object', () => {
      const stats = {};
      const collector = new StatisticsCollector(stats);
      expect(collector.isEnabled()).toBe(true);
      expect(collector.getStats()).toBe(stats);
    });

    it('should handle null stats', () => {
      const collector = new StatisticsCollector(null);
      expect(collector.isEnabled()).toBe(false);
      expect(collector.getStats()).toBeNull();
    });

    it('should handle undefined stats', () => {
      const collector = new StatisticsCollector(undefined);
      expect(collector.isEnabled()).toBe(false);
      expect(collector.getStats()).toBeNull();
    });

    it('should reject non-object stats', () => {
      const collector = new StatisticsCollector('not an object');
      expect(collector.isEnabled()).toBe(false);
    });
  });

  describe('increment', () => {
    it('should increment a new counter from 0', () => {
      const stats = {};
      const collector = new StatisticsCollector(stats);

      collector.increment('testCounter');

      expect(stats.testCounter).toBe(1);
    });

    it('should increment an existing counter', () => {
      const stats = { testCounter: 5 };
      const collector = new StatisticsCollector(stats);

      collector.increment('testCounter');

      expect(stats.testCounter).toBe(6);
    });

    it('should handle multiple increments', () => {
      const stats = {};
      const collector = new StatisticsCollector(stats);

      collector.increment('testCounter');
      collector.increment('testCounter');
      collector.increment('testCounter');

      expect(stats.testCounter).toBe(3);
    });

    it('should handle multiple different counters', () => {
      const stats = {};
      const collector = new StatisticsCollector(stats);

      collector.increment('counter1');
      collector.increment('counter2');
      collector.increment('counter1');

      expect(stats.counter1).toBe(2);
      expect(stats.counter2).toBe(1);
    });

    it('should be no-op when disabled', () => {
      const collector = new StatisticsCollector(null);

      collector.increment('testCounter');

      expect(collector.getStats()).toBeNull();
    });

    it('should initialize non-numeric values to 0', () => {
      const stats = { testCounter: 'not a number' };
      const collector = new StatisticsCollector(stats);

      collector.increment('testCounter');

      expect(stats.testCounter).toBe(1);
    });
  });

  describe('isEnabled', () => {
    it('should return true when stats object provided', () => {
      const collector = new StatisticsCollector({});
      expect(collector.isEnabled()).toBe(true);
    });

    it('should return false when stats is null', () => {
      const collector = new StatisticsCollector(null);
      expect(collector.isEnabled()).toBe(false);
    });
  });

  describe('get', () => {
    it('should return statistic value', () => {
      const stats = { testCounter: 42 };
      const collector = new StatisticsCollector(stats);

      expect(collector.get('testCounter')).toBe(42);
    });

    it('should return undefined for non-existent key', () => {
      const collector = new StatisticsCollector({});

      expect(collector.get('nonExistent')).toBeUndefined();
    });

    it('should return undefined when disabled', () => {
      const collector = new StatisticsCollector(null);

      expect(collector.get('testCounter')).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should reset a counter to 0', () => {
      const stats = { testCounter: 5 };
      const collector = new StatisticsCollector(stats);

      collector.reset('testCounter');

      expect(stats.testCounter).toBe(0);
    });

    it('should be no-op when disabled', () => {
      const collector = new StatisticsCollector(null);

      collector.reset('testCounter');

      expect(collector.getStats()).toBeNull();
    });
  });

  describe('resetAll', () => {
    it('should reset all counters to 0', () => {
      const stats = { counter1: 5, counter2: 10, counter3: 15 };
      const collector = new StatisticsCollector(stats);

      collector.resetAll();

      expect(stats.counter1).toBe(0);
      expect(stats.counter2).toBe(0);
      expect(stats.counter3).toBe(0);
    });

    it('should be no-op when disabled', () => {
      const collector = new StatisticsCollector(null);

      collector.resetAll();

      expect(collector.getStats()).toBeNull();
    });
  });

  describe('snapshot', () => {
    it('should create a copy of statistics', () => {
      const stats = { counter1: 5, counter2: 10 };
      const collector = new StatisticsCollector(stats);

      const snapshot = collector.snapshot();

      expect(snapshot).toEqual({ counter1: 5, counter2: 10 });
      expect(snapshot).not.toBe(stats); // Different object
    });

    it('should return null when disabled', () => {
      const collector = new StatisticsCollector(null);

      expect(collector.snapshot()).toBeNull();
    });

    it('should not be affected by subsequent changes', () => {
      const stats = { counter1: 5 };
      const collector = new StatisticsCollector(stats);

      const snapshot = collector.snapshot();
      collector.increment('counter1');

      expect(snapshot.counter1).toBe(5);
      expect(stats.counter1).toBe(6);
    });
  });
});
```

### Step 3: Add JSDoc Documentation

Ensure all methods have comprehensive JSDoc comments (already included in Step 1).

### Step 4: Usage Example in LegacyStrategy

**Before**:
```javascript
// Scattered throughout LegacyStrategy.js
this.#incrementStat(processingStats, 'successful');
this.#incrementStat(processingStats, 'multiTarget');
this.#incrementStat(processingStats, 'failed');
```

**After (preview for future integration)**:
```javascript
// In LegacyStrategy.js (will be integrated in LEGSTRREF-004+)
const statsCollector = new StatisticsCollector(processingStats);

// Clean, simple calls
statsCollector.increment('successful');
statsCollector.increment('multiTarget');
statsCollector.increment('failed');
```

## Acceptance Criteria

### Functional Requirements
- ✅ `StatisticsCollector` class created with all specified methods
- ✅ Constructor handles null, undefined, and object stats
- ✅ `increment()` method initializes and increments counters
- ✅ `isEnabled()` correctly reports statistics collection status
- ✅ `get()` method retrieves statistic values
- ✅ `reset()` and `resetAll()` clear statistics
- ✅ `snapshot()` creates immutable copies

### Quality Requirements
- ✅ Test coverage >95% (branches and lines)
- ✅ All edge cases tested (null stats, non-numeric values, etc.)
- ✅ JSDoc documentation complete for all public methods
- ✅ No ESLint violations
- ✅ Passes TypeScript type checking

### Non-Functional Requirements
- ✅ No changes to `LegacyStrategy.js` yet
- ✅ Zero impact on existing functionality
- ✅ All existing tests still pass

## Testing Requirements

### Unit Tests
- **Coverage Target**: 95%+ branches, 100% functions/lines
- **Test File**: `tests/unit/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.test.js`
- **Test Scenarios**:
  - Constructor with valid/null/undefined stats
  - Increment with new/existing counters
  - Multiple increments on same counter
  - Multiple different counters
  - No-op behavior when disabled
  - Non-numeric value initialization
  - Get method for existing/non-existent keys
  - Reset single and all statistics
  - Snapshot immutability

### Integration Tests
Not required for this ticket - this is a standalone utility class.

## Validation Steps

### Pre-Implementation Checklist
- [ ] File path confirmed: `src/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.js`
- [ ] Test path confirmed: `tests/unit/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.test.js`
- [ ] No conflicts with existing files

### Implementation Checklist
- [ ] `StatisticsCollector.js` created
- [ ] All methods implemented
- [ ] JSDoc documentation complete
- [ ] Unit tests created
- [ ] All tests passing

### Post-Implementation Verification
```bash
# Run unit tests
npm run test:unit -- tests/unit/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.test.js

# Verify coverage
npm run test:unit -- tests/unit/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.test.js --coverage

# Run linter
npx eslint src/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.js

# Run type checker
npm run typecheck
```

### Success Criteria Verification
- [ ] All unit tests pass
- [ ] Coverage >95%
- [ ] No ESLint violations
- [ ] TypeScript type checking passes
- [ ] All existing tests still pass

## Files Affected

### New Files
- `src/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.js`
- `tests/unit/actions/pipeline/stages/actionFormatting/legacy/StatisticsCollector.test.js`

### Modified Files
None (this ticket creates new files only)

## Risk Assessment

### Risk Level: Low

**Potential Issues**:
1. None - this is a new standalone class

**Mitigation**:
- Comprehensive unit tests
- No integration with existing code yet
- Simple, well-defined behavior

## Notes

- This class follows the Single Responsibility Principle
- Designed for easy extensibility (can add more methods later)
- No side effects - pure encapsulation of statistics logic
- Will be integrated into `LegacyStrategy` in later tickets (LEGSTRREF-004+)

## Related Tickets
- **Blocks**: LEGSTRREF-004, LEGSTRREF-005, LEGSTRREF-006
- **Part of**: Phase 1 - Foundation
- **Related**: LEGSTRREF-000 (Master Coordination)
