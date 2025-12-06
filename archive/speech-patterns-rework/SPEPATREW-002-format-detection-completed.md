# SPEPATREW-002: Implement Format Detection in CharacterDataFormatter

## Objective

Add format detection logic to `CharacterDataFormatter` to identify whether speech patterns use string, object, or mixed format.

## Priority

**Critical** - Prerequisite for format-specific rendering

## Estimated Effort

0.5 days

## Dependencies

- **SPEPATREW-001** must be completed (schema updated)

## Files to Touch

- `src/prompting/CharacterDataFormatter.js` (add private method)
- `tests/unit/prompting/CharacterDataFormatter.test.js` (add test suite)

## Implementation Details

### Add Private Method

```javascript
/**
 * Detects speech pattern format type
 * @private
 * @param {Array} patterns - Array of patterns
 * @returns {'string'|'object'|'mixed'} Detected format
 */
#detectPatternFormat(patterns) {
  if (!patterns || patterns.length === 0) {
    return 'string'; // Default to legacy for empty arrays
  }

  const hasStrings = patterns.some(p => typeof p === 'string');
  const hasObjects = patterns.some(p => typeof p === 'object' && p !== null);

  if (hasStrings && hasObjects) {
    this.#logger.warn('Mixed speech pattern formats detected. Consider consolidating to structured format.');
    return 'mixed';
  }

  return hasObjects ? 'object' : 'string';
}
```

### Update Existing Method

Modify `formatSpeechPatterns(speechPatterns)` to call `#detectPatternFormat()` but DO NOT yet implement format-specific rendering (that's SPEPATREW-003).

**CORRECTED ASSUMPTION**: The method signature is `formatSpeechPatterns(speechPatterns)`, NOT `formatSpeechPatterns(entity)`. It receives the patterns array/string directly.

For now, just add the detection call and log the detected format:

```javascript
formatSpeechPatterns(speechPatterns) {
  if (!speechPatterns) {
    this.#logger.debug('CharacterDataFormatter: No speech patterns provided');
    return '';
  }

  let result = '## Your Speech Patterns\n';

  // Add format detection
  let patterns = speechPatterns;
  if (Array.isArray(speechPatterns)) {
    const format = this.#detectPatternFormat(speechPatterns);
    this.#logger.debug(`Detected speech pattern format: ${format}`);

    // Keep existing rendering logic for now (string format only)
    speechPatterns.forEach((pattern) => {
      if (pattern && typeof pattern === 'string') {
        result += `- ${pattern.trim()}\n`;
      }
    });
  } else if (typeof speechPatterns === 'string') {
    // Handle existing format where patterns might be in text
    const extractedPatterns = this.#extractSpeechPatterns(speechPatterns);
    const format = this.#detectPatternFormat(extractedPatterns);
    this.#logger.debug(`Detected speech pattern format: ${format}`);

    extractedPatterns.forEach((pattern) => {
      result += `- ${pattern}\n`;
    });
  }

  this.#logger.debug('CharacterDataFormatter: Formatted speech patterns section');
  return result;
}
```

## Out of Scope

- **DO NOT** implement format-specific rendering methods yet (SPEPATREW-003)
- **DO NOT** modify schema files
- **DO NOT** change any character entity files
- **DO NOT** add XML formatting yet
- **DO NOT** modify other formatter methods

## Acceptance Criteria

### Tests That Must Pass

1. `#detectPatternFormat(['str1', 'str2'])` returns `'string'`
2. `#detectPatternFormat([{type: 'X', examples: ['e1']}])` returns `'object'`
3. `#detectPatternFormat(['str', {type: 'X', examples: ['e1']}])` returns `'mixed'`
4. `#detectPatternFormat([])` returns `'string'`
5. `#detectPatternFormat(null)` returns `'string'`
6. `#detectPatternFormat(undefined)` returns `'string'`
7. Mixed format detection logs warning message
8. All existing CharacterDataFormatter tests continue to pass
9. No regression in other formatter methods

### Invariants

- Method is private (prefixed with `#`)
- Returns only one of three strings: `'string'`, `'object'`, `'mixed'`
- No side effects except optional warning log
- Handles null/undefined gracefully
- Does not modify input array
- Existing `formatSpeechPatterns` output unchanged (backward compatibility)

## Validation Commands

```bash
# Run specific test file
npm run test:unit -- tests/unit/prompting/CharacterDataFormatter.test.js

# Run all unit tests
npm run test:unit

# Type check
npm run typecheck

# Lint the modified file
npx eslint src/prompting/CharacterDataFormatter.js
```

## Definition of Done

- [x] `#detectPatternFormat()` method implemented
- [x] Method integrated into `formatSpeechPatterns()`
- [x] All 9 test cases pass
- [x] Warning logged for mixed format
- [x] No regression in existing tests
- [x] All validation commands pass
- [x] Code review completed

## Status

**COMPLETED** - 2025-11-24

## Outcome

Successfully implemented format detection logic in CharacterDataFormatter with the following changes:

### Code Changes:

1. **Added `#detectPatternFormat()` method** (src/prompting/CharacterDataFormatter.js:54-73)
   - Detects 'string', 'object', or 'mixed' format
   - Returns 'string' for empty/null/undefined arrays (backward compatibility)
   - Logs warning for mixed format patterns

2. **Updated `formatSpeechPatterns()` method** (src/prompting/CharacterDataFormatter.js:237-271)
   - Integrated format detection for array patterns
   - Integrated format detection for text-based patterns
   - Logs detected format via debug()
   - Maintains existing output format (no rendering changes)

### Test Changes:

Added 9 comprehensive test cases (tests/unit/prompting/CharacterDataFormatter.test.js:291-398):

- String format detection
- Object format detection
- Mixed format detection with warning
- Empty array handling
- Text extraction format detection
- Backward compatibility verification
- Null/undefined handling
- Input immutability verification

### Discrepancies from Original Plan:

**CORRECTED ASSUMPTION**: The ticket originally assumed `formatSpeechPatterns(entity)` but the actual signature is `formatSpeechPatterns(speechPatterns)`. The method receives patterns directly, not an entity object. Ticket was updated to reflect this.

### Validation Results:

- All 79 CharacterDataFormatter tests pass ✓
- All 346 prompting unit tests pass ✓
- No regressions in existing functionality ✓
- Backward compatibility maintained ✓
