# RECVALREF-011-10: Integrate Validators and Refactor RecipePreflightValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical - Integration)
**Estimated Effort:** 3 hours
**Complexity:** Medium-High

## Objective

Integrate all 8 standalone validators into `RecipePreflightValidator`, refactor the orchestrator to use validators instead of inline methods, and reduce file size to <500 lines.

## Background

After creating 8 standalone validators (RECVALREF-011-01 through RECVALREF-011-09), we need to:
1. Register validators in dependency injection
2. Refactor RecipePreflightValidator to use validators
3. Remove inline methods and external function calls
4. Verify file size reduction
5. Ensure all existing tests pass

## Prerequisites

**All sub-tickets must be completed:**
- [x] RECVALREF-011-01: RecipeUsageValidator
- [x] RECVALREF-011-02: DescriptorCoverageValidator
- [x] RECVALREF-011-03: BlueprintExistenceValidator
- [x] RECVALREF-011-04: RecipeBodyDescriptorValidator
- [x] RECVALREF-011-05: PartAvailabilityValidator
- [x] RECVALREF-011-06: SocketSlotCompatibilityValidator
- [x] RECVALREF-011-07: PatternMatchingValidator
- [x] RECVALREF-011-08: GeneratedSlotPartsValidator
- [x] RECVALREF-011-09: LoadFailureValidator

## Implementation Tasks

### 1. Add DI Tokens (15 min)

**File:** `src/dependencyInjection/tokens/tokens-core.js`

**Add to tokens object:**
```javascript
// Anatomy Validation Validators (Recipe Validation Pattern)
BlueprintExistenceValidator: 'BlueprintExistenceValidator',
RecipeBodyDescriptorValidator: 'RecipeBodyDescriptorValidator',
SocketSlotCompatibilityValidator: 'SocketSlotCompatibilityValidator',
PartAvailabilityValidator: 'PartAvailabilityValidator',
GeneratedSlotPartsValidator: 'GeneratedSlotPartsValidator',
PatternMatchingValidator: 'PatternMatchingValidator',
RecipeUsageValidator: 'RecipeUsageValidator',
DescriptorCoverageValidator: 'DescriptorCoverageValidator',
LoadFailureValidator: 'LoadFailureValidator',
```

### 2. Create Validator Registrations (30 min)

**File:** `src/dependencyInjection/registrations/anatomyValidationRegistrations.js`

**Structure:**
```javascript
import { tokens } from '../tokens/tokens-core.js';
import { BlueprintExistenceValidator } from '../../anatomy/validation/validators/BlueprintExistenceValidator.js';
import { RecipeBodyDescriptorValidator } from '../../anatomy/validation/validators/RecipeBodyDescriptorValidator.js';
// ... import all 9 validators

export function registerAnatomyValidators(container, bind) {
  // Priority 10 - Blueprint Existence
  container.register(
    tokens.BlueprintExistenceValidator,
    bind(BlueprintExistenceValidator).dependencies({
      logger: tokens.ILogger,
      anatomyBlueprintRepository: tokens.IAnatomyBlueprintRepository,
    })
  );

  // Priority 15 - Recipe Body Descriptors
  container.register(
    tokens.RecipeBodyDescriptorValidator,
    bind(RecipeBodyDescriptorValidator).dependencies({
      logger: tokens.ILogger,
      dataRegistry: tokens.IDataRegistry,
    })
  );

  // ... register remaining 7 validators with dependencies

  // Priority 50 - Load Failures (special - no dependencies)
  container.register(
    tokens.LoadFailureValidator,
    bind(LoadFailureValidator).dependencies({
      logger: tokens.ILogger,
    })
  );
}
```

### 3. Update Main DI Registration (5 min)

**File:** `src/dependencyInjection/registrations/index.js` (or equivalent)

**Add import and call:**
```javascript
import { registerAnatomyValidators } from './anatomyValidationRegistrations.js';

// In registration function:
registerAnatomyValidators(container, bind);
```

### 4. Refactor RecipePreflightValidator (1.5 hours)

**File:** `src/anatomy/validation/RecipePreflightValidator.js`

**Changes:**

#### A. Update Constructor (inject validators)

```javascript
constructor({
  logger,
  dataRegistry,
  schemaValidator,
  anatomyBlueprintRepository,
  loadFailures,
  // NEW: Inject all validators
  blueprintExistenceValidator,
  recipeBodyDescriptorValidator,
  socketSlotCompatibilityValidator,
  partAvailabilityValidator,
  generatedSlotPartsValidator,
  patternMatchingValidator,
  recipeUsageValidator,
  descriptorCoverageValidator,
  loadFailureValidator,
}) {
  // ... existing validation ...

  // Store validators
  this.#blueprintExistenceValidator = blueprintExistenceValidator;
  this.#recipeBodyDescriptorValidator = recipeBodyDescriptorValidator;
  // ... store all 9 validators
}
```

#### B. Replace #runValidationChecks Method

**OLD (lines ~110-140):**
```javascript
async #runValidationChecks(recipe, results, options) {
  await this.#checkComponentExistence(recipe, results);
  await this.#checkPropertySchemas(recipe, results);
  await this.#checkBodyDescriptors(recipe, results);
  await this.#checkBlueprintExists(recipe, results);
  // ... 9 more inline method calls
}
```

**NEW:**
```javascript
async #runValidationChecks(recipe, results, options) {
  // Still call ValidationRule adapters
  await this.#checkComponentExistence(recipe, results);
  await this.#checkPropertySchemas(recipe, results);

  // NEW: Call validators in priority order
  const validators = [
    this.#blueprintExistenceValidator,      // Priority 10
    this.#recipeBodyDescriptorValidator,    // Priority 15
    this.#socketSlotCompatibilityValidator, // Priority 20
    this.#partAvailabilityValidator,        // Priority 25
    this.#generatedSlotPartsValidator,      // Priority 30
    this.#patternMatchingValidator,         // Priority 35
    this.#descriptorCoverageValidator,      // Priority 40
    this.#loadFailureValidator,             // Priority 50
    this.#recipeUsageValidator,             // Priority 60
  ];

  // Sort by priority (defensive, already ordered)
  validators.sort((a, b) => a.priority - b.priority);

  for (const validator of validators) {
    const validationOptions = {
      loadFailures: this.#loadFailures, // For LoadFailureValidator
      ...options,
    };

    const result = await validator.validate(recipe, validationOptions);

    // Aggregate results
    results.errors.push(...result.errors);
    results.warnings.push(...result.warnings);
    results.suggestions.push(...result.suggestions);
    results.passed.push(...result.passed);

    // Stop if failFast and has errors
    if (validator.failFast && result.errors.length > 0) {
      this.#logger.info(
        `Stopping validation: ${validator.name} failed with fail-fast enabled`
      );
      break;
    }
  }
}
```

#### C. Delete Inline Methods

**Remove these methods (save ~500+ lines):**
- `#checkBodyDescriptors` (lines 235-335)
- `#checkBlueprintExists` (lines 341-370)
- `#checkSocketSlotCompatibility` (lines 381-410) - wrapper for external function
- `#checkPatternMatching` (lines 480-511) - wrapper for external function
- `#checkDescriptorCoverage` (lines 513-563)
- `#hasDescriptorComponents` (lines 565-567)
- `#preferredEntityHasDescriptors` (lines 576-599)
- `#checkPartAvailability` (lines 554-670)
- `#checkGeneratedSlotPartAvailability` (lines 717-842)
- `#ensureBlueprintProcessed` (lines 411-456) - moved to utils
- `#checkEntityDefinitionLoadFailures` (lines 904-975)
- `#extractComponentValidationDetails` (lines 984-1013)
- `#checkRecipeUsage` (lines 1022-1061)

#### D. Remove External Function Imports

**Delete imports:**
```javascript
// DELETE:
import { validateSocketSlotCompatibility } from './socketSlotCompatibilityValidator.js';
import { validatePatternMatching } from './patternMatchingValidator.js';
```

### 5. Delete/Deprecate External Validator Files (15 min)

**Action:** Delete these files (logic now in validators):
- `src/anatomy/validation/socketSlotCompatibilityValidator.js`
- `src/anatomy/validation/patternMatchingValidator.js`

**Verify no other imports:**
```bash
grep -r "socketSlotCompatibilityValidator" src/
grep -r "patternMatchingValidator" src/
```

### 6. Run Full Test Suite (15 min)

**Commands:**
```bash
# Run all unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run full CI suite
npm run test:ci
```

**Expected:**
- All existing RecipePreflightValidator tests pass
- All new validator unit tests pass
- Integration tests pass
- No regression in validation behavior

### 7. Verify File Size Reduction (5 min)

**Check:**
```bash
wc -l src/anatomy/validation/RecipePreflightValidator.js
```

**Expected:** <500 lines (target: ~400-450 lines)

**Breakdown:**
- Original: 1,064 lines
- Removed inline methods: ~600 lines
- Added validator orchestration: ~50 lines
- **Final: ~450-500 lines** (53% reduction)

### 8. Lint All Modified Files (10 min)

```bash
npx eslint src/anatomy/validation/RecipePreflightValidator.js
npx eslint src/anatomy/validation/validators/*.js
npx eslint src/anatomy/validation/utils/*.js
npx eslint src/dependencyInjection/tokens/tokens-core.js
npx eslint src/dependencyInjection/registrations/anatomyValidationRegistrations.js
```

## Dependencies

**Requires Completion Of:**
- All 9 validator sub-tickets (RECVALREF-011-01 through RECVALREF-011-09)
- blueprintProcessingUtils.js (from RECVALREF-011-07)

**DI System:**
- Container registration system
- Token definitions
- Bind utility for dependencies

## Acceptance Criteria

- [ ] All 9 validators registered in DI system
- [ ] anatomyValidationRegistrations.js created
- [ ] RecipePreflightValidator refactored to use validators
- [ ] All inline methods removed from RecipePreflightValidator
- [ ] External validator files deleted
- [ ] RecipePreflightValidator.js is <500 lines
- [ ] All existing tests pass (zero regression)
- [ ] Full test suite passes (unit, integration, CI)
- [ ] ESLint passes on all modified files
- [ ] No imports of deleted external validator files remain

## Testing Commands

```bash
# Unit tests
npm run test:unit -- RecipePreflightValidator.test.js

# All validation tests
npm run test:unit -- anatomy/validation/

# Integration tests
npm run test:integration

# Full CI
npm run test:ci

# Lint
npx eslint src/anatomy/validation/**/*.js src/dependencyInjection/**/*.js
```

## Code Reference

**RecipePreflightValidator Current:**
- Constructor: Lines 74-100
- #runValidationChecks: Lines 110-140
- Inline methods to delete: Lines 235-1061 (scattered)

**DI Registration Pattern:**
- See existing registrations in `src/dependencyInjection/registrations/`

## Critical Notes

- **Zero Breaking Changes**: All existing tests must pass
- **Fail-Fast Behavior**: BlueprintExistenceValidator stops pipeline on failure
- **Priority Order**: Validators run in priority order (10, 15, 20, ...)
- **ValidationRule Adapters**: Keep #checkComponentExistence and #checkPropertySchemas (use ValidationRule pattern)
- **Options Passing**: Pass loadFailures via options for LoadFailureValidator

## Success Metrics

- RecipePreflightValidator: 1,064 → <500 lines (53% reduction)
- Total new validator files: 9 classes (~1,500 lines)
- Total test files: 9 test suites (~2,000 lines)
- Test coverage: 80%+ on all validators
- Zero regression: All existing tests pass
- Clean architecture: Clear separation of concerns

## Rollback Plan

If integration fails:
1. Revert RecipePreflightValidator changes
2. Keep validator files for future attempt
3. Investigate test failures
4. Fix and retry integration

**Git Strategy:**
```bash
git checkout -b recvalref-011-integration
# Make changes
# Test
git commit -m "RECVALREF-011-10: Integrate validators"
# If issues: git reset --hard origin/main
```
