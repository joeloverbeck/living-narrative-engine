# CHADISLLMQUALAB-001: Create ChanceTextTranslator Service

## Overview

**Ticket ID**: CHADISLLMQUALAB-001
**Status**: Completed
**Priority**: High
**Depends On**: None
**Blocks**: CHADISLLMQUALAB-002, CHADISLLMQUALAB-003

## Objective

Create a new `ChanceTextTranslator` service that converts numerical chance percentages to qualitative labels for LLM prompts. This service implements the 12-level granularity scale defined in the spec.

## File List

| File | Action | Description |
|------|--------|-------------|
| `src/prompting/ChanceTextTranslator.js` | **CREATE** | New service implementing percentage-to-label translation |
| `tests/unit/prompting/ChanceTextTranslator.test.js` | **CREATE** | Unit tests for the new service |

## Out of Scope

- **DO NOT** modify any existing services or files
- **DO NOT** modify `AIPromptContentProvider.js` (handled in CHADISLLMQUALAB-003)
- **DO NOT** modify DI registrations (handled in CHADISLLMQUALAB-002)
- **DO NOT** modify UI display logic or `ActionFormattingStage.js`
- **DO NOT** modify `ChanceCalculationService.js`
- **DO NOT** add integration tests (handled in CHADISLLMQUALAB-005)

## Implementation Details

### Service Structure

```javascript
/**
 * @file Translates numerical chance percentages to qualitative labels for LLM prompts
 */

import { validateDependency } from '../utils/dependencyUtils.js';

class ChanceTextTranslator {
  #logger;

  static CHANCE_LEVELS = [
    { min: 95, max: 100, label: 'certain' },
    { min: 85, max: 94, label: 'excellent chance' },
    { min: 75, max: 84, label: 'very good chance' },
    { min: 65, max: 74, label: 'good chance' },
    { min: 55, max: 64, label: 'decent chance' },
    { min: 45, max: 54, label: 'fair chance' },
    { min: 35, max: 44, label: 'uncertain chance' },
    { min: 25, max: 34, label: 'poor chance' },
    { min: 15, max: 24, label: 'unlikely' },
    { min: 5, max: 14, label: 'very unlikely' },
    { min: 1, max: 4, label: 'desperate' },
    { min: 0, max: 0, label: 'impossible' },
  ];

  static CHANCE_PATTERN = /\((\d+)%\s+chance\)/gi;

  constructor({ logger }) { ... }
  translateForLlm(text) { ... }
  getQualitativeLabel(percentage) { ... }
}
```

### Key Methods

1. **`constructor({ logger })`**
   - Validates logger dependency using `validateDependency()`
   - Logs initialization at debug level

2. **`translateForLlm(text)`**
   - Input: String potentially containing chance patterns like "(55% chance)"
   - Output: String with percentages replaced by qualitative labels
   - Returns an empty string for null/undefined/non-string inputs
   - Uses regex replacement with `CHANCE_PATTERN`

3. **`getQualitativeLabel(percentage)`**
   - Input: Numeric percentage 0-100
   - Output: Qualitative label string
   - Clamps values to 0-100 range
   - Rounds floating point values
   - Logs warning and returns "fair chance" for invalid inputs

### Pattern Matching

The regex `CHANCE_PATTERN` matches:
- `(55% chance)` - standard
- `(55%  chance)` - multiple spaces
- `(55% Chance)` - case insensitive

Does NOT match (by design):
- `(55%chance)` - no space before "chance"
- `55% chance` - no parentheses

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Boundary value tests**: All 12 tier boundaries correctly mapped
   - `getQualitativeLabel(100)` → "certain"
   - `getQualitativeLabel(95)` → "certain"
   - `getQualitativeLabel(94)` → "excellent chance"
   - ... (all boundaries)
   - `getQualitativeLabel(0)` → "impossible"

2. **Edge case tests**:
   - Values > 100 clamp to "certain"
   - Values < 0 clamp to "impossible"
   - Floating point values round correctly
   - NaN returns "fair chance" with warning
   - Non-numeric returns "fair chance" with warning

3. **Translation tests**:
   - `translateForLlm("punch Goblin (55% chance)")` → `"punch Goblin (decent chance)"`
   - Modifier tags preserved: `"attack (55% chance) [flanking]"` → `"attack (decent chance) [flanking]"`
   - Multiple patterns in one string handled
   - Null/undefined/non-string inputs return empty string

### Invariants That Must Remain True

1. **CHANCE_LEVELS array coverage**: Every integer 0-100 maps to exactly one label
2. **Idempotency**: Running `translateForLlm()` twice produces same result
3. **No side effects**: Service is stateless except for logger
4. **No external dependencies**: Only requires logger injection
5. **Pattern preservation**: Non-chance text passes through unchanged

## Technical Notes

- File location follows existing pattern: `src/prompting/`
- Use JSDoc types for IDE support
- Follow project naming conventions (PascalCase class, camelCase methods)
- Export both named and default exports for flexibility
- Static properties for CHANCE_LEVELS and CHANCE_PATTERN allow testing without instantiation

## Definition of Done

- [x] `ChanceTextTranslator.js` created at `src/prompting/`
- [x] Service implements all methods from spec
- [x] All 12 granularity levels correctly defined
- [x] Regex pattern matches required formats
- [x] Edge cases handled (null, undefined, NaN, out-of-range)
- [x] JSDoc documentation complete
- [x] Unit tests created for `ChanceTextTranslator`
- [ ] `npm run typecheck` passes
- [x] `npx eslint src/prompting/ChanceTextTranslator.js` passes

## Outcome

Created `ChanceTextTranslator` under `src/prompting/` (aligns with existing prompt services) and added unit tests in this ticket to satisfy QA requirements. Regex updated to require a space before "chance" and non-string inputs now return empty strings, matching the spec's pattern and edge-case expectations. `npm run typecheck` currently fails due to pre-existing repository errors outside this change.
