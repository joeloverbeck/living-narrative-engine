# RECVALREF-011-09: Implement LoadFailureValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical - Special Consideration)
**Estimated Effort:** 2 hours
**Complexity:** Medium (Stateful Pattern)

## Objective

Extract the `#checkEntityDefinitionLoadFailures` inline method from `RecipePreflightValidator` into a standalone `LoadFailureValidator` class extending `BaseValidator`. This validator must continue surfacing the loader totals that the anatomy system guide calls "Entity load failures" (Stage 2) while fitting into the BaseValidator pipeline described in RECVALREF-000.

## Background

This validator reports entity definition load failures recorded during mod loading. It's special because it reads from the `loadFailures` object (a `TotalResultsSummary` produced by `LoadResultAggregator`, see `src/loaders/LoadResultAggregator.js`) that gets passed to the `RecipePreflightValidator` constructor via `scripts/validate-recipe.js`. The relevant data lives at `loadFailures.entityDefinitions.failures`, which is an array of `{ file, error }` entries accumulated per entity definition. The anatomy system guide (`docs/anatomy/anatomy-system-guide.md`) explicitly calls out this Stage 2 check as "Entity load failures", so output parity matters for downstream tooling.

**Special Challenge:** The validator needs access to load-time state that isn't part of the recipe itself.

## Current Implementation

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`
**Method:** `#checkEntityDefinitionLoadFailures` (lines 904-975)

**Stateful Dependency:**
- `this.#loadFailures` - Snapshot of the loader totals object captured in the constructor
- Relevant path: `this.#loadFailures?.entityDefinitions?.failures`
- Populated by `LoadResultAggregator` before the validator is invoked

**Logic:**
- Reads `this.#loadFailures?.entityDefinitions?.failures || []`
- Returns early (no `passed` entry) when there are zero failures
- For each failure, derives the base entityId from the filename, inspects `error.message`, and optionally extracts `failedComponents`
- Calls `#extractComponentValidationDetails` to build the `validationDetails` array when component IDs are available
- Pushes `ENTITY_LOAD_FAILURE` objects into `results.errors` with identical `details`/`fix` payloads as today and logs a debug summary

## Solution: Pass via Options

**Decision:** Pass `loadFailures` via `options.loadFailures` so the validator remains stateless but can still access `options.loadFailures?.entityDefinitions?.failures` (the only slice of the totals object it needs).

## Implementation Tasks

### 1. Create Validator Class (1 hour)

**File:** `src/anatomy/validation/validators/LoadFailureValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';

/**
 * Reports entity definition load failures from mod loading
 *
 * Special validator: Accesses load-time failures via options.loadFailures
 *
 * Priority: 50 - After entity availability checks
 * Fail Fast: false - Report all load failures for context
 */
export class LoadFailureValidator extends BaseValidator {
  constructor({ logger }) {
    super({
      name: 'load-failure',
      priority: 50,
      failFast: false,
      logger,
    });
  }

  async performValidation(recipe, options, builder) {
    const failureEntries =
      options?.loadFailures?.entityDefinitions?.failures ?? [];

    if (!Array.isArray(failureEntries) || failureEntries.length === 0) {
      // Inline helper exits silently today, so do not add a passed entry
      return;
    }

    // Extract logic from lines 904-975
    // Use builder.addError('ENTITY_LOAD_FAILURE', message, metadata)
    // Preserve details/fix payloads from the inline helper
  }

  #extractComponentValidationDetails(error, failedComponents) {
    // Extract from lines 984-1013
    // Helper to format component validation errors
  }
}
```

**Key Extraction Points:**
- Lines 906-913: Check `entityDefinitions.failures`
- Lines 915-973: Process each load failure entry
- Lines 924-966: Extract and format error details plus `fix` strings
- Lines 984-1013: Component validation detail extraction helper

### 2. Update RecipePreflightValidator Integration (30 min)

**Changes Needed in RecipePreflightValidator:**

```javascript
// When calling LoadFailureValidator
const result = await this.#loadFailureValidator.validate(recipe, {
  loadFailures: this.#loadFailures,  // Pass loader totals snapshot
  // ... other options
});
```

**This maintains:**
- Validator remains stateless (no instance state)
- RecipePreflightValidator still owns loadFailures
- Pattern is consistent with BaseValidator

### 3. Create Unit Tests (30 min)

**File:** `tests/unit/anatomy/validation/validators/LoadFailureValidator.test.js`

**Test Cases:**
1. Constructor validation
   - Should initialize with correct configuration
   - Should only require logger (no other dependencies)

2. Basic validation scenarios
   - Should return zero issues when `options.loadFailures` is missing
   - Should return zero issues when `options.loadFailures.entityDefinitions.failures` is empty or not an array
   - Should emit errors when the failures array contains entries
   - Should report all load failures (not just first)

3. Error detail extraction
   - Should extract component validation details
   - Should include file paths in errors
   - Should include validation messages
   - Should handle missing component data
   - Should handle malformed error objects

4. Options handling
   - Should handle missing options parameter
   - Should handle options without loadFailures
   - Should handle loadFailures as undefined/null
   - Should handle malformed totals objects (e.g., failures not being an array)

5. Edge cases
   - Should handle load failures with missing error messages
   - Should handle failures without failedComponents (regex does not match)
   - Should handle partial error data (missing file/error)
   - Should handle very large failures arrays

**Coverage Target:** 80%+ branch coverage

## Dependencies

**Service Dependencies:**
- `ILogger` - For logging (inherited only)

**Code Dependencies:**
- `BaseValidator` - Base class
- **No other dependencies** - simplest validator

**Data Dependencies:**
- `options.loadFailures` - Loader totals snapshot (see `LoadResultAggregator`)
- `options.loadFailures.entityDefinitions.failures` - Array of `{ file, error }`

## Acceptance Criteria

- [ ] LoadFailureValidator class created
- [ ] Extends BaseValidator with priority: 50, failFast: false
- [ ] No constructor dependencies except logger
- [ ] Reads loader totals from `options.loadFailures?.entityDefinitions?.failures`
- [ ] Handles missing/null/undefined/non-array `loadFailures` gracefully
- [ ] Component validation detail extraction works
- [ ] Unit tests achieve 80%+ branch coverage
- [ ] Error messages match original format exactly
- [ ] Does **not** add a `passed` entry when no failures exist (matches original behavior)
- [ ] ESLint passes on new file

## Testing Commands

```bash
# Run unit tests
npm run test:unit -- validators/LoadFailureValidator.test.js

# Check coverage
npm run test:unit -- validators/LoadFailureValidator.test.js --coverage

# Lint
npx eslint src/anatomy/validation/validators/LoadFailureValidator.js
```

## Code Reference

**Original Method Location:**
`src/anatomy/validation/RecipePreflightValidator.js:904-975`

**Helper Method:**
`src/anatomy/validation/RecipePreflightValidator.js:984-1013`

**Key Logic to Preserve:**
- Line 906: `const entityDefFailures = this.#loadFailures?.entityDefinitions?.failures || []`
- Lines 918-973: Iterate failure array and construct error payloads
- Lines 924-966: Error message construction with file paths, `details`, and `fix`
- Lines 984-1013: Component validation detail extraction helper

**Constructor Usage:**
- Line 83: `this.#loadFailures = loadFailures` (constructor parameter)
- This will become `options.loadFailures` in validator

## Critical Notes

- **Stateful Pattern Solution**: Use options.loadFailures, not constructor injection
- **Simplest Dependencies**: Only requires logger, no services
- **Context Validator**: Provides context about load-time failures, not recipe validation per se
- Reports failures for informational purposes (helps debug why entities are missing)
- May have many entries if mod loading had issues

## Integration Notes for RECVALREF-011-10

When integrating this validator in RecipePreflightValidator:

1. Pass loadFailures via options:
   ```javascript
   const result = await validator.validate(recipe, {
     loadFailures: this.#loadFailures,
   });
   ```

2. Ensure loadFailures is available in RecipePreflightValidator constructor
3. Document this pattern for future stateful validators

## Success Metrics

- LoadFailureValidator: ~120-150 lines
- Test file: ~200-250 lines
- Branch coverage: 80%+
- Zero behavior changes from original
- Clean options-based pattern for stateful data
