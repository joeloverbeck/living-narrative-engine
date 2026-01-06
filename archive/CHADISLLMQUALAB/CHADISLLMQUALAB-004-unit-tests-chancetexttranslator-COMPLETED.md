# CHADISLLMQUALAB-004: Unit Tests for ChanceTextTranslator

## Overview

**Ticket ID**: CHADISLLMQUALAB-004
**Status**: Completed
**Priority**: High
**Depends On**: CHADISLLMQUALAB-001
**Blocks**: None (parallel with CHADISLLMQUALAB-002, CHADISLLMQUALAB-003)

## Objective

Expand the existing `ChanceTextTranslator` unit tests to cover all 12 granularity levels, boundary conditions, edge cases, and error handling.

## Reassessed Assumptions

- `ChanceTextTranslator` lives at `src/prompting/ChanceTextTranslator.js` (not under `src/prompting/services/`).
- The unit test file already exists at `tests/unit/prompting/ChanceTextTranslator.test.js`.
- `CHANCE_PATTERN` requires at least one whitespace before `chance` (`\\s+`), so `(55%chance)` is intentionally not matched.
- `translateForLlm` returns an empty string for non-string or falsy input (including `null`, `undefined`, and `''`).

## File List

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/prompting/ChanceTextTranslator.test.js` | **MODIFY** | Expand unit tests for ChanceTextTranslator |

## Out of Scope

- **DO NOT** modify `src/prompting/ChanceTextTranslator.js` implementation
- **DO NOT** create integration tests or touch other prompting tests
- **DO NOT** modify `AIPromptContentProvider.test.js` (handled in CHADISLLMQUALAB-006)
- **DO NOT** create shared test helpers or fixtures (use inline mocks)

## Implementation Details

### Test File Structure

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ChanceTextTranslator } from '../../../src/prompting/ChanceTextTranslator.js';

describe('ChanceTextTranslator', () => {
  let translator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };
    translator = new ChanceTextTranslator({ logger: mockLogger });
  });

  describe('constructor', () => { ... });
  describe('getQualitativeLabel', () => { ... });
  describe('translateForLlm', () => { ... });
  describe('CHANCE_LEVELS static property', () => { ... });
  describe('CHANCE_PATTERN static property', () => { ... });
});
```

### Test Suites Required

#### 1. Constructor Tests

```javascript
describe('constructor', () => {
  it('should initialize with valid logger', () => {
    expect(translator).toBeDefined();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ChanceTextTranslator: Initialized'
    );
  });

  it('should throw when logger is missing required methods', () => {
    expect(() => {
      new ChanceTextTranslator({ logger: {} });
    }).toThrow();
  });

  it('should throw when logger is null', () => {
    expect(() => {
      new ChanceTextTranslator({ logger: null });
    }).toThrow();
  });
});
```

#### 2. getQualitativeLabel - Boundary Tests

Use `it.each` for comprehensive boundary testing:

```javascript
describe('getQualitativeLabel', () => {
  describe('boundary conditions - all tier boundaries', () => {
    it.each([
      // Tier boundaries - test both edges of each tier
      [100, 'certain'],
      [95, 'certain'],
      [94, 'excellent chance'],
      [85, 'excellent chance'],
      [84, 'very good chance'],
      [75, 'very good chance'],
      [74, 'good chance'],
      [65, 'good chance'],
      [64, 'decent chance'],
      [55, 'decent chance'],
      [54, 'fair chance'],
      [45, 'fair chance'],
      [44, 'uncertain chance'],
      [35, 'uncertain chance'],
      [34, 'poor chance'],
      [25, 'poor chance'],
      [24, 'unlikely'],
      [15, 'unlikely'],
      [14, 'very unlikely'],
      [5, 'very unlikely'],
      [4, 'desperate'],
      [1, 'desperate'],
      [0, 'impossible'],
    ])('should return "%s" for %d%%', (percentage, expected) => {
      expect(translator.getQualitativeLabel(percentage)).toBe(expected);
    });
  });

  describe('mid-tier values', () => {
    it.each([
      [97, 'certain'],
      [90, 'excellent chance'],
      [80, 'very good chance'],
      [70, 'good chance'],
      [60, 'decent chance'],
      [50, 'fair chance'],
      [40, 'uncertain chance'],
      [30, 'poor chance'],
      [20, 'unlikely'],
      [10, 'very unlikely'],
      [2, 'desperate'],
    ])('should return "%s" for %d%% (mid-tier)', (percentage, expected) => {
      expect(translator.getQualitativeLabel(percentage)).toBe(expected);
    });
  });
});
```

#### 3. getQualitativeLabel - Edge Cases

```javascript
describe('edge cases', () => {
  it('should clamp values above 100 to certain', () => {
    expect(translator.getQualitativeLabel(101)).toBe('certain');
    expect(translator.getQualitativeLabel(150)).toBe('certain');
    expect(translator.getQualitativeLabel(1000)).toBe('certain');
  });

  it('should clamp negative values to impossible', () => {
    expect(translator.getQualitativeLabel(-1)).toBe('impossible');
    expect(translator.getQualitativeLabel(-10)).toBe('impossible');
    expect(translator.getQualitativeLabel(-100)).toBe('impossible');
  });

  it('should round floating point percentages correctly', () => {
    // 54.5+ rounds to 55 → decent chance
    expect(translator.getQualitativeLabel(54.5)).toBe('decent chance');
    expect(translator.getQualitativeLabel(54.7)).toBe('decent chance');
    // 54.4 and below rounds to 54 → fair chance
    expect(translator.getQualitativeLabel(54.4)).toBe('fair chance');
    expect(translator.getQualitativeLabel(54.1)).toBe('fair chance');
  });

  it('should handle NaN with warning and fallback', () => {
    const result = translator.getQualitativeLabel(NaN);
    expect(result).toBe('fair chance');
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should handle non-number with warning and fallback', () => {
    expect(translator.getQualitativeLabel('fifty')).toBe('fair chance');
    expect(translator.getQualitativeLabel(undefined)).toBe('fair chance');
    expect(translator.getQualitativeLabel(null)).toBe('fair chance');
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
```

#### 4. translateForLlm - Standard Patterns

```javascript
describe('translateForLlm', () => {
  describe('standard patterns', () => {
    it.each([
      ['punch Goblin (55% chance)', 'punch Goblin (decent chance)'],
      ['attack target (95% chance)', 'attack target (certain)'],
      ['risky move (5% chance)', 'risky move (very unlikely)'],
      ['impossible action (0% chance)', 'impossible action (impossible)'],
      ['guaranteed hit (100% chance)', 'guaranteed hit (certain)'],
    ])('should translate "%s" to "%s"', (input, expected) => {
      expect(translator.translateForLlm(input)).toBe(expected);
    });
  });

  describe('modifier tags preservation', () => {
    it('should preserve modifier tags after chance', () => {
      const input = 'attack (55% chance) [flanking] [weapon-bonus]';
      const expected = 'attack (decent chance) [flanking] [weapon-bonus]';
      expect(translator.translateForLlm(input)).toBe(expected);
    });

    it('should handle tags with no space after chance', () => {
      const input = 'attack (55% chance)[flanking]';
      const expected = 'attack (decent chance)[flanking]';
      expect(translator.translateForLlm(input)).toBe(expected);
    });

    it('should preserve complex tag combinations', () => {
      const input = 'strike (75% chance) [critical] [backstab] [poisoned]';
      const expected = 'strike (very good chance) [critical] [backstab] [poisoned]';
      expect(translator.translateForLlm(input)).toBe(expected);
    });
  });

  describe('multiple patterns', () => {
    it('should handle multiple chance patterns in one string', () => {
      const input = 'attack (75% chance) or defend (45% chance)';
      const expected = 'attack (very good chance) or defend (fair chance)';
      expect(translator.translateForLlm(input)).toBe(expected);
    });

    it('should handle three or more patterns', () => {
      const input = 'a (95% chance), b (50% chance), c (5% chance)';
      const expected = 'a (certain), b (fair chance), c (very unlikely)';
      expect(translator.translateForLlm(input)).toBe(expected);
    });
  });

  describe('no-op cases', () => {
    it('should preserve text without chance patterns', () => {
      const input = 'walk to tavern';
      expect(translator.translateForLlm(input)).toBe('walk to tavern');
    });

    it('should return empty string for null input', () => {
      expect(translator.translateForLlm(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(translator.translateForLlm(undefined)).toBe('');
    });

    it('should return empty string for non-string input', () => {
      expect(translator.translateForLlm(123)).toBe('');
      expect(translator.translateForLlm({})).toBe('');
      expect(translator.translateForLlm([])).toBe('');
    });

    it('should preserve empty string input', () => {
      expect(translator.translateForLlm('')).toBe('');
    });
  });

  describe('case insensitivity', () => {
    it('should handle "Chance" with capital C', () => {
      expect(translator.translateForLlm('attack (55% Chance)')).toBe(
        'attack (decent chance)'
      );
    });

    it('should handle "CHANCE" in all caps', () => {
      expect(translator.translateForLlm('attack (55% CHANCE)')).toBe(
        'attack (decent chance)'
      );
    });

    it('should handle mixed case', () => {
      expect(translator.translateForLlm('attack (55% cHaNcE)')).toBe(
        'attack (decent chance)'
      );
    });
  });

  describe('whitespace variations', () => {
    it('should handle single space before "chance"', () => {
      expect(translator.translateForLlm('attack (55% chance)')).toBe(
        'attack (decent chance)'
      );
    });

    it('should handle multiple spaces before "chance"', () => {
      expect(translator.translateForLlm('attack (55%  chance)')).toBe(
        'attack (decent chance)'
      );
      expect(translator.translateForLlm('attack (55%   chance)')).toBe(
        'attack (decent chance)'
      );
    });

    it('should NOT match when no space before "chance"', () => {
      // Document expected behavior - no match
      const input = 'attack (55%chance)';
      expect(translator.translateForLlm(input)).toBe(input);
    });
  });
});
```

#### 5. Static Property Tests

```javascript
describe('CHANCE_LEVELS static property', () => {
  it('should have 12 levels', () => {
    expect(ChanceTextTranslator.CHANCE_LEVELS).toHaveLength(12);
  });

  it('should cover 0 to 100 without gaps', () => {
    const levels = ChanceTextTranslator.CHANCE_LEVELS;
    // Sort by min ascending
    const sorted = [...levels].sort((a, b) => a.min - b.min);

    // First level should include 0
    expect(sorted[0].min).toBe(0);

    // Last level should include 100
    expect(sorted[sorted.length - 1].max).toBe(100);

    // Check for no gaps
    for (let i = 0; i <= 100; i++) {
      const matchingLevel = levels.find(l => i >= l.min && i <= l.max);
      expect(matchingLevel).toBeDefined();
    }
  });

  it('should have unique labels for each level', () => {
    const labels = ChanceTextTranslator.CHANCE_LEVELS.map(l => l.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });
});

describe('CHANCE_PATTERN static property', () => {
  it('should be a RegExp with global and case-insensitive flags', () => {
    expect(ChanceTextTranslator.CHANCE_PATTERN).toBeInstanceOf(RegExp);
    expect(ChanceTextTranslator.CHANCE_PATTERN.flags).toContain('g');
    expect(ChanceTextTranslator.CHANCE_PATTERN.flags).toContain('i');
  });

  it('should match standard chance patterns', () => {
    const pattern = ChanceTextTranslator.CHANCE_PATTERN;
    expect('(55% chance)'.match(pattern)).toBeTruthy();
    expect('(100% chance)'.match(pattern)).toBeTruthy();
    expect('(0% chance)'.match(pattern)).toBeTruthy();
  });

  it('should capture the percentage number', () => {
    const pattern = new RegExp(ChanceTextTranslator.CHANCE_PATTERN.source, 'i');
    const match = '(55% chance)'.match(pattern);
    expect(match[1]).toBe('55');
  });
});
```

## Acceptance Criteria

### Specific Tests That Must Pass

All tests in this file must pass:

```bash
npm run test:unit -- tests/unit/prompting/ChanceTextTranslator.test.js
```

### Coverage Requirements

- **Statement coverage**: ≥ 95%
- **Branch coverage**: ≥ 90%
- **Function coverage**: ≥ 100%
- **Line coverage**: ≥ 95%

Verify with:
```bash
npm run test:unit -- tests/unit/prompting/ChanceTextTranslator.test.js --coverage
```

### Invariants That Must Remain True

1. **All 12 tiers tested**: Every tier has boundary tests
2. **Both boundaries per tier**: Min and max values tested
3. **Edge cases covered**: NaN, null, undefined, out-of-range
4. **No mocking of SUT**: Only logger is mocked
5. **Isolated tests**: Each test independent, uses fresh instance

## Technical Notes

- Follow existing test file structure in `tests/unit/prompting/`
- Use `jest.fn()` for logger mock, not shared test helpers
- Use `it.each` for parameterized tests to improve readability
- Import from `@jest/globals` for consistency with project patterns

## Definition of Done

- [x] Test file updated at correct location
- [x] Constructor tests validate dependency handling
- [x] All 12 tier boundaries tested (both min and max)
- [x] Edge cases tested (NaN, null, undefined, out-of-range, floating point)
- [x] `translateForLlm` standard patterns tested
- [x] Modifier tag preservation tested
- [x] Multiple patterns in one string tested
- [x] Case insensitivity tested
- [x] Whitespace variations tested
- [x] No-op cases tested (no patterns, null/undefined input)
- [x] Static properties tested for completeness
- [x] All tests pass: `npm run test:unit -- tests/unit/prompting/ChanceTextTranslator.test.js`
- [x] Coverage meets thresholds (≥ 90% branches, ≥ 95% lines)

## Outcome

Updated `tests/unit/prompting/ChanceTextTranslator.test.js` with constructor/static-property coverage and expanded `translateForLlm` cases. No production code or integration tests were added, and the previously planned `tests/unit/prompting/services/...` file was not created because the existing unit test file already covered this service.
