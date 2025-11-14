# RECVALREF-011-09: Implement LoadFailureValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical - Special Consideration)
**Estimated Effort:** 2 hours
**Complexity:** Medium (Stateful Pattern)

## Objective

Extract the `#checkEntityDefinitionLoadFailures` inline method from `RecipePreflightValidator` into a standalone `LoadFailureValidator` class extending `BaseValidator`.

## Background

This validator reports entity definition load failures that occurred during mod loading. It's special because it accesses a stateful `loadFailures` map passed to `RecipePreflightValidator` constructor.

**Special Challenge:** The validator needs access to load-time state that isn't part of the recipe itself.

## Current Implementation

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`
**Method:** `#checkEntityDefinitionLoadFailures` (lines 904-975)

**Stateful Dependency:**
- `this.#loadFailures` - Map of entity definition load failures from constructor
- Passed to RecipePreflightValidator from mod loading system

**Logic:**
- Checks if loadFailures map has entries
- For each failure, extracts component validation details
- Reports errors with file paths and validation messages
- Provides context about why entities failed to load

## Solution: Pass via Options

**Decision:** Pass `loadFailures` via `options.loadFailures` parameter to maintain stateless validator pattern.

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
    // Get loadFailures from options
    const loadFailures = options?.loadFailures;

    if (!loadFailures || loadFailures.size === 0) {
      builder.addPassed('No entity definition load failures');
      return;
    }

    // Extract logic from lines 904-975
    // Use builder.addError() for each load failure
    // Include component validation details
  }

  #extractComponentValidationDetails(error, failedComponents) {
    // Extract from lines 984-1013
    // Helper to format component validation errors
  }
}
```

**Key Extraction Points:**
- Lines 908-913: Check loadFailures map
- Lines 915-973: Process each load failure
- Lines 924-966: Extract and format error details
- Lines 984-1013: Component validation detail extraction

### 2. Update RecipePreflightValidator Integration (30 min)

**Changes Needed in RecipePreflightValidator:**

```javascript
// When calling LoadFailureValidator
const result = await this.#loadFailureValidator.validate(recipe, {
  loadFailures: this.#loadFailures,  // Pass stateful map
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
   - Should pass when no loadFailures in options
   - Should pass when loadFailures map is empty
   - Should error when loadFailures contains entries
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
   - Should handle loadFailures as undefined
   - Should handle loadFailures as null

5. Edge cases
   - Should handle load failures with missing error messages
   - Should handle failures without failedComponents
   - Should handle partial error data
   - Should handle very large loadFailures maps

**Coverage Target:** 80%+ branch coverage

## Dependencies

**Service Dependencies:**
- `ILogger` - For logging (inherited only)

**Code Dependencies:**
- `BaseValidator` - Base class
- **No other dependencies** - simplest validator

**Data Dependencies:**
- `options.loadFailures` - Map of entity definition load failures

## Acceptance Criteria

- [ ] LoadFailureValidator class created
- [ ] Extends BaseValidator with priority: 50, failFast: false
- [ ] No constructor dependencies except logger
- [ ] Reads loadFailures from options.loadFailures
- [ ] Handles missing/null/undefined loadFailures gracefully
- [ ] Component validation detail extraction works
- [ ] Unit tests achieve 80%+ branch coverage
- [ ] Error messages match original format exactly
- [ ] Passed message matches original
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
- Line 908: `this.#loadFailures && this.#loadFailures.size > 0`
- Lines 918-920: Iterate loadFailures map
- Lines 924-966: Error message construction with file paths
- Lines 984-1013: Component validation detail extraction

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
