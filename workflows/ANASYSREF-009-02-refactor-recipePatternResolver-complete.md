# ANASYSREF-009-02: Complete recipePatternResolver Refactoring with Validators & Facade

## Objective

Complete the refactoring of `recipePatternResolver.js` by extracting validators, utilities, and creating a clean facade that maintains backward compatibility. This finalizes Phase 1, bringing the critical 1195-line file into compliance with the 500-line standard.

## Dependencies

### Requires
- **ANASYSREF-009-01** (matchers must be extracted first)

### Blocks
- **ANASYSREF-009-03** (bodyBlueprintFactory depends on completed recipePatternResolver)

## Priority

🔴 **CRITICAL** - Completes highest priority file refactoring

## Scope

### Files to Create

1. **src/anatomy/recipePatternResolver/validators/patternValidator.js** (~150 lines)
   - Extract `validatePatternMutualExclusivity()`
   - Extract `validateBlueprintVersion()`
   - Pattern definition validation

2. **src/anatomy/recipePatternResolver/validators/exclusionValidator.js** (~100 lines)
   - Extract `validateExclusions()`
   - Extract `applyExclusions()`
   - Exclusion logic validation

3. **src/anatomy/recipePatternResolver/validators/precedenceValidator.js** (~100 lines)
   - Extract `validatePatternPrecedence()`
   - Pattern conflict detection
   - Warning generation for precedence issues

4. **src/anatomy/recipePatternResolver/utils/patternUtils.js** (~100 lines)
   - Extract `hasMatcher()` helper
   - Pattern type detection utilities
   - Common pattern helper functions

5. **src/anatomy/recipePatternResolver/utils/slotFilterUtils.js** (~100 lines)
   - Extract `filterSlotsByProperties()` if not already in propertyMatcher
   - Slot matching helper functions
   - Common filtering utilities

6. **src/anatomy/recipePatternResolver/patternResolver.js** (<300 lines)
   - Main facade orchestrating all modules
   - Public API: `resolveRecipePatterns()`
   - Backward compatible interface

### Files to Modify

1. **src/anatomy/recipePatternResolver.js** (DELETE after migration complete)
   - Will be replaced by new modular structure
   - Backup before deletion for reference

2. **src/anatomy/bodyBlueprintFactory.js**
   - Update import from `./recipePatternResolver.js`
   - To: `./recipePatternResolver/patternResolver.js`

3. **Container/DI Registration Files** (if applicable)
   - Update registration paths

### Files to Update (Imports Only)

**Test Files** (3 primary test files):
1. `tests/unit/anatomy/recipePatternResolver.test.js`
2. `tests/unit/anatomy/recipePatternResolver.validation.test.js`
3. `tests/unit/anatomy/recipePatternResolver.additionalCoverage.test.js`

**Update import from:**
```javascript
import recipePatternResolver from '../../../src/anatomy/recipePatternResolver.js';
```

**To:**
```javascript
import recipePatternResolver from '../../../src/anatomy/recipePatternResolver/patternResolver.js';
```

### Directory Structure to Complete

```
src/anatomy/recipePatternResolver/
├── patternResolver.js (main facade, <300 lines)
├── matchers/ (created in ANASYSREF-009-01)
│   ├── groupMatcher.js
│   ├── wildcardMatcher.js
│   └── propertyMatcher.js
├── validators/ (NEW)
│   ├── patternValidator.js
│   ├── exclusionValidator.js
│   └── precedenceValidator.js
└── utils/ (NEW)
    ├── patternUtils.js
    └── slotFilterUtils.js
```

## Implementation Steps

### Step 1: Create Validator Directories

**Commands:**
```bash
mkdir -p src/anatomy/recipePatternResolver/validators
mkdir -p src/anatomy/recipePatternResolver/utils
```

**Expected Outcome:** Directories created

### Step 2: Extract patternValidator Module

**Action:** Create `src/anatomy/recipePatternResolver/validators/patternValidator.js`

**Extract from recipePatternResolver.js:**
- `validatePatternMutualExclusivity()` function
- `validateBlueprintVersion()` function
- Pattern definition validation logic

**Module Interface:**
```javascript
/**
 * Validates that pattern has exactly one matcher type
 * @param {object} pattern - Pattern to validate
 * @param {object} logger - Logger instance
 * @throws {InvalidArgumentError} if multiple matchers present
 */
export function validatePatternMutualExclusivity(pattern, logger) {
  // Implementation
}

/**
 * Validates blueprint version supports pattern type
 * @param {object} pattern - Pattern to validate
 * @param {object} blueprint - Blueprint to check
 * @param {object} logger - Logger instance
 * @throws {InvalidArgumentError} if version mismatch
 */
export function validateBlueprintVersion(pattern, blueprint, logger) {
  // Implementation
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.validation.test.js
```

### Step 3: Extract exclusionValidator Module

**Action:** Create `src/anatomy/recipePatternResolver/validators/exclusionValidator.js`

**Extract from recipePatternResolver.js:**
- `validateExclusions()` function
- `applyExclusions()` function

**Module Interface:**
```javascript
/**
 * Validates exclusion patterns
 * @param {array} exclusions - Exclusion patterns
 * @param {object} logger - Logger instance
 */
export function validateExclusions(exclusions, logger) {
  // Implementation
}

/**
 * Applies exclusions to slot list
 * @param {array} slots - Slots to filter
 * @param {array} exclusions - Exclusion patterns
 * @param {object} blueprint - Blueprint context
 * @param {object} logger - Logger instance
 * @returns {array} Filtered slots
 */
export function applyExclusions(slots, exclusions, blueprint, logger) {
  // Implementation
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.test.js
```

### Step 4: Extract precedenceValidator Module

**Action:** Create `src/anatomy/recipePatternResolver/validators/precedenceValidator.js`

**Extract from recipePatternResolver.js:**
- `validatePatternPrecedence()` function
- Pattern conflict detection
- Warning generation logic

**Module Interface:**
```javascript
/**
 * Validates pattern precedence and warns about conflicts
 * @param {array} patterns - All patterns to check
 * @param {object} logger - Logger instance
 */
export function validatePatternPrecedence(patterns, logger) {
  // Implementation
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.test.js
```

### Step 5: Extract patternUtils Module

**Action:** Create `src/anatomy/recipePatternResolver/utils/patternUtils.js`

**Extract from recipePatternResolver.js:**
- `hasMatcher()` helper function
- Pattern type detection utilities
- Common pattern helpers

**Module Interface:**
```javascript
/**
 * Checks if pattern has a specific matcher type
 * @param {object} pattern - Pattern to check
 * @param {string} matcherType - Type to check for (matchesGroup, matchesPattern, matchesAll)
 * @returns {boolean}
 */
export function hasMatcher(pattern, matcherType) {
  // Implementation
}

/**
 * Detects which matcher type a pattern uses
 * @param {object} pattern - Pattern to analyze
 * @returns {string|null} Matcher type or null
 */
export function detectMatcherType(pattern) {
  // Implementation
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.test.js
```

### Step 6: Extract slotFilterUtils Module

**Action:** Create `src/anatomy/recipePatternResolver/utils/slotFilterUtils.js`

**Extract from recipePatternResolver.js (or propertyMatcher.js if already there):**
- `filterSlotsByProperties()` function
- Slot filtering helper functions

**Module Interface:**
```javascript
/**
 * Filters slots by property criteria
 * @param {array} slots - Slots to filter
 * @param {object} filters - Filter criteria
 * @returns {array} Filtered slots
 */
export function filterSlotsByProperties(slots, filters) {
  // Implementation
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.test.js
```

### Step 7: Create patternResolver Facade

**Action:** Create `src/anatomy/recipePatternResolver/patternResolver.js`

**Purpose:** Main facade that orchestrates all modules and maintains backward compatibility

**Module Structure:**
```javascript
/**
 * @file Main facade for recipe pattern resolution
 */

// Import matchers
import { resolveMatchesGroup } from './matchers/groupMatcher.js';
import { resolveMatchesPattern } from './matchers/wildcardMatcher.js';
import { resolveMatchesAll } from './matchers/propertyMatcher.js';

// Import validators
import {
  validatePatternMutualExclusivity,
  validateBlueprintVersion
} from './validators/patternValidator.js';
import {
  validateExclusions,
  applyExclusions
} from './validators/exclusionValidator.js';
import {
  validatePatternPrecedence
} from './validators/precedenceValidator.js';

// Import utilities
import { hasMatcher } from './utils/patternUtils.js';

/**
 * RecipePatternResolver - Main class for resolving V2 recipe patterns
 */
class RecipePatternResolver {
  #logger;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
  }

  /**
   * Resolves recipe patterns against blueprint slots
   * @param {array} recipePatterns - Patterns from recipe
   * @param {object} blueprint - Blueprint definition
   * @param {array} slots - Available slots
   * @returns {Map} Map of slot IDs to recipe pattern data
   */
  resolveRecipePatterns(recipePatterns, blueprint, slots) {
    // Orchestrate validation and resolution
    // Use extracted modules
    // Maintain exact same behavior as original
  }
}

export default RecipePatternResolver;
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver
```

**Expected Outcome:**
- Facade created (<300 lines)
- All functionality delegated to modules
- Identical behavior to original implementation

### Step 8: Update Dependent Files

**Action 1:** Update bodyBlueprintFactory.js import

```javascript
// Before:
import RecipePatternResolver from './recipePatternResolver.js';

// After:
import RecipePatternResolver from './recipePatternResolver/patternResolver.js';
```

**Action 2:** Update all test file imports

**Files to update:**
- `tests/unit/anatomy/recipePatternResolver.test.js`
- `tests/unit/anatomy/recipePatternResolver.validation.test.js`
- `tests/unit/anatomy/recipePatternResolver.additionalCoverage.test.js`

**Change:**
```javascript
// Before:
import RecipePatternResolver from '../../../src/anatomy/recipePatternResolver.js';

// After:
import RecipePatternResolver from '../../../src/anatomy/recipePatternResolver/patternResolver.js';
```

**Testing after each update:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver
```

### Step 9: Delete Old recipePatternResolver.js

**Action:** Remove the original file (after confirming all tests pass)

**Commands:**
```bash
# Backup first (just in case)
cp src/anatomy/recipePatternResolver.js src/anatomy/recipePatternResolver.js.backup

# Delete original
rm src/anatomy/recipePatternResolver.js
```

**Testing:**
```bash
# Verify all tests still pass
npm run test:unit -- tests/unit/anatomy/recipePatternResolver
npm run test:integration -- tests/integration/anatomy/bodyBlueprintFactory
```

**Expected Outcome:**
- Original file deleted
- All tests pass
- No references to old file remain

### Step 10: Final Validation

**Commands:**
```bash
# Run all recipePatternResolver tests
npm run test:unit -- tests/unit/anatomy/recipePatternResolver

# Run integration tests
npm run test:integration -- tests/integration/anatomy/bodyBlueprintFactory

# ESLint all new files
npx eslint src/anatomy/recipePatternResolver/

# Verify file sizes
wc -l src/anatomy/recipePatternResolver/**/*.js
```

**Expected Outcome:**
- All tests pass (100% of original tests)
- ESLint passes (zero warnings)
- All files <500 lines
- No functional changes (behavior identical)

## Testing Strategy

### Unit Tests

**All recipePatternResolver Tests:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver
```

**Expected:** 20 test files pass with zero modifications to test logic

### Integration Tests

**Blueprint Factory Integration:**
```bash
npm run test:integration -- tests/integration/anatomy/bodyBlueprintFactory.v2.integration.test.js
```

**Expected:**
- Spider anatomy generates correctly (8 legs via matchesPattern: "leg_*")
- Dragon anatomy generates correctly (legs + wings + tail via patterns)
- Centaur anatomy generates correctly (mixed limb types)

### Contract Testing

**Critical:** Pattern resolution must produce identical results

**Approach:**
1. Before refactoring: Capture pattern resolution outputs for test blueprints
2. After refactoring: Verify identical outputs
3. Test all pattern types (matchesGroup, matchesPattern, matchesAll)

### Code Quality

**ESLint:**
```bash
npx eslint src/anatomy/recipePatternResolver/
```

**Expected:** Zero warnings, zero errors

**TypeScript:**
```bash
npm run typecheck
```

**Expected:** No type errors

## Success Criteria

- [x] All 6 new modules created with correct line counts
- [x] patternValidator.js (~150 lines)
- [x] exclusionValidator.js (~100 lines)
- [x] precedenceValidator.js (~100 lines)
- [x] patternUtils.js (~100 lines)
- [x] slotFilterUtils.js (~100 lines)
- [x] patternResolver.js facade (<300 lines)
- [x] Original recipePatternResolver.js deleted
- [x] bodyBlueprintFactory.js import updated
- [x] All 3 test files imports updated
- [x] All 20 recipePatternResolver unit tests pass
- [x] Integration tests pass
- [x] ESLint passes on all new files
- [x] No breaking changes to public API
- [x] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [x] Spider anatomy test passes
- [x] Dragon anatomy test passes
- [x] Centaur anatomy test passes

## Risk Assessment

**Risk Level:** 🟢 **LOW**

**Rationale:**
- Matchers already extracted (ANASYSREF-009-01 complete)
- Validators are independent modules
- Facade maintains exact same interface
- Comprehensive test coverage exists

**Specific Risks:**

1. **Test Import Path Errors**
   - **Impact:** Medium (tests fail to run)
   - **Probability:** Low (straightforward path changes)
   - **Mitigation:** Update all test imports immediately after facade creation
   - **Detection:** Test runner will fail immediately on wrong paths

2. **Missed Dependencies in Facade**
   - **Impact:** High (functionality breaks)
   - **Probability:** Very Low (clear module boundaries)
   - **Mitigation:** Run full test suite after facade creation
   - **Detection:** Unit tests will fail immediately

3. **Pattern Resolution Behavior Change**
   - **Impact:** High (anatomy generation breaks)
   - **Probability:** Very Low (no logic changes, just reorganization)
   - **Mitigation:** Contract testing with captured outputs
   - **Detection:** Integration tests will fail

## Estimated Effort

**Total:** 6-8 hours

**Breakdown:**
- Extract patternValidator: 1-1.5 hours
- Extract exclusionValidator: 1 hour
- Extract precedenceValidator: 1 hour
- Extract patternUtils: 0.5-1 hour
- Extract slotFilterUtils: 0.5-1 hour
- Create patternResolver facade: 1.5-2 hours
- Update imports (tests, dependencies): 0.5-1 hour
- Final testing and validation: 1 hour

## Definition of Done

- [ ] All 6 modules created with correct line counts
- [ ] patternResolver.js facade created (<300 lines)
- [ ] Original recipePatternResolver.js deleted
- [ ] bodyBlueprintFactory.js import updated
- [ ] All 3 test files imports updated
- [ ] All 20 recipePatternResolver unit tests pass without modification
- [ ] ESLint passes on all new files (zero warnings)
- [ ] TypeScript type checking passes
- [ ] Integration tests pass (bodyBlueprintFactory)
- [ ] Spider anatomy generates correctly (8 legs)
- [ ] Dragon anatomy generates correctly (legs + wings + tail)
- [ ] Centaur anatomy generates correctly
- [ ] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [ ] No breaking changes to public API
- [ ] No performance regression
- [ ] Git commit created with descriptive message
- [ ] Ready for ANASYSREF-009-03 (bodyBlueprintFactory refactoring)

## Notes

**Critical Synchronization:**
- All modules must use consistent validation logic
- Logger must be passed to all modules for consistent error reporting
- Facade must maintain exact same behavior as original
- Public API must remain unchanged (backward compatibility critical)

**File Size Verification:**
After completion, verify all files ≤500 lines:
```bash
wc -l src/anatomy/recipePatternResolver/**/*.js
```

**Expected:**
- patternResolver.js: <300 lines
- All other modules: <200 lines each
- Total: <1500 lines (well distributed across 9 modules)

**Next Steps:**
After completion, proceed to **ANASYSREF-009-03** to refactor bodyBlueprintFactory.
