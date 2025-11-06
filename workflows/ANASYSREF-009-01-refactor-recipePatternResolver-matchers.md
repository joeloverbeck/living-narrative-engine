# ANASYSREF-009-01: Extract Matcher Modules from recipePatternResolver

## Objective

Extract the three primary matcher implementations (groupMatcher, wildcardMatcher, propertyMatcher) from the oversized `recipePatternResolver.js` (1195 lines) into focused, testable modules. This is Phase 1 of splitting the most critical oversized file in the anatomy system.

## Dependencies

### Requires
- None (can start immediately)

### Blocks
- ANASYSREF-009-02 (completion of recipePatternResolver refactoring)
- ANASYSREF-009-03 (bodyBlueprintFactory depends on completed recipePatternResolver)

## Priority

🔴 **CRITICAL** - Highest priority file (1195 lines, 139% over limit)

## Scope

### Files to Create

1. **src/anatomy/recipePatternResolver/matchers/groupMatcher.js** (~230 lines)
   - Extract `#resolveSlotGroup()` logic (~118 lines)
   - Extract `#validateMatchesGroup()` logic (~83 lines)
   - Extract `#generateSlotKeysFromLimbSet()` and `#generateSlotKeysFromAppendage()` helpers
   - Handle `matchesGroup` patterns (limbSet:*, appendage:*)

2. **src/anatomy/recipePatternResolver/matchers/wildcardMatcher.js** (~80 lines)
   - Extract `#resolveWildcardPattern()` logic (~25 lines)
   - Extract `#validateMatchesPattern()` logic (~31 lines)
   - Extract `#wildcardToRegex()` helper (~10 lines)
   - Wildcard pattern matching with `*`

3. **src/anatomy/recipePatternResolver/matchers/propertyMatcher.js** (~100 lines)
   - Extract `#resolvePropertyFilter()` logic (~50 lines)
   - Extract `#validateMatchesAll()` logic (~40 lines)
   - Property-based filtering (slotType, orientation, socketId)

### Files to Modify

1. **src/anatomy/recipePatternResolver.js**
   - Remove extracted matcher logic (will reduce to ~785 lines from 1195)
   - Add imports for new matcher modules
   - Delegate to matchers instead of inline logic
   - Pass dependencies (dataRegistry, slotGenerator, logger) to matcher functions

### Directory Structure to Create

```
src/anatomy/recipePatternResolver/
├── matchers/
│   ├── groupMatcher.js
│   ├── wildcardMatcher.js
│   └── propertyMatcher.js
```

## Implementation Steps

### Step 1: Create Directory Structure

**Commands:**
```bash
mkdir -p src/anatomy/recipePatternResolver/matchers
```

**Expected Outcome:** Directory created at `src/anatomy/recipePatternResolver/matchers/`

### Step 2: Extract groupMatcher Module

**Action:** Create `src/anatomy/recipePatternResolver/matchers/groupMatcher.js`

**Extract from recipePatternResolver.js (lines 762-899):**
- `#resolveSlotGroup(groupRef, blueprint, options)` - main resolution (~118 lines)
- `#validateMatchesGroup(pattern, blueprint, patternIndex)` - validation (~83 lines)
- `#generateSlotKeysFromLimbSet(limbSet)` - helper (~5 lines)
- `#generateSlotKeysFromAppendage(appendage)` - helper (~5 lines)

**Module Interface:**
```javascript
/**
 * Resolves slots matching a group pattern (limbSet:*, appendage:*)
 * @param {string} groupRef - Group reference (e.g., 'limbSet:leg')
 * @param {object} blueprint - Blueprint with structure template
 * @param {object} options - Options {throwOnZeroMatches, allowMissing}
 * @param {object} deps - Dependencies {dataRegistry, slotGenerator, logger}
 * @returns {string[]} Array of matching slot keys
 */
export function resolveSlotGroup(groupRef, blueprint, options = {}, deps) {
  // Implementation
}

/**
 * Validates matchesGroup pattern
 * @param {object} pattern - Pattern with matchesGroup property
 * @param {object} blueprint - Blueprint context
 * @param {number} patternIndex - Pattern index for error messages
 * @param {object} deps - Dependencies {dataRegistry, logger}
 * @throws {ValidationError} If pattern is invalid
 */
export function validateMatchesGroup(pattern, blueprint, patternIndex, deps) {
  // Implementation
}
```

**Testing:**
```bash
# Verify extraction (should still fail tests, but no syntax errors)
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.test.js
```

**Expected Outcome:**
- New module created
- No syntax errors
- Tests may fail (expected until refactoring complete)

### Step 3: Extract wildcardMatcher Module

**Action:** Create `src/anatomy/recipePatternResolver/matchers/wildcardMatcher.js`

**Extract from recipePatternResolver.js (lines 283-313, 911-945):**
- `#resolveWildcardPattern(pattern, slotKeys)` - main matching (~25 lines)
- `#validateMatchesPattern(pattern, blueprint, patternIndex)` - validation (~31 lines)
- `#wildcardToRegex(pattern)` - regex conversion helper (~10 lines)

**Module Interface:**
```javascript
/**
 * Resolves slots matching a wildcard pattern (leg_*, *_left, *tentacle*)
 * @param {string} pattern - Wildcard pattern string
 * @param {string[]} slotKeys - Available slot keys to match against
 * @param {object} logger - Logger instance
 * @returns {string[]} Array of matching slot keys
 */
export function resolveWildcardPattern(pattern, slotKeys, logger) {
  // Implementation
}

/**
 * Validates matchesPattern wildcard pattern
 * @param {object} pattern - Pattern with matchesPattern property
 * @param {object} blueprint - Blueprint context
 * @param {number} patternIndex - Pattern index for error messages
 * @param {object} logger - Logger instance
 * @throws {ValidationError} If pattern is invalid
 */
export function validateMatchesPattern(pattern, blueprint, patternIndex, logger) {
  // Implementation
}

/**
 * Converts wildcard pattern to regular expression
 * @param {string} pattern - Wildcard pattern (e.g., "leg_*", "*_left")
 * @returns {RegExp} Compiled regular expression
 */
export function wildcardToRegex(pattern) {
  // Implementation
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.test.js
```

**Expected Outcome:**
- New module created
- No syntax errors
- Tests may fail (expected)

### Step 4: Extract propertyMatcher Module

**Action:** Create `src/anatomy/recipePatternResolver/matchers/propertyMatcher.js`

**Extract from recipePatternResolver.js (lines 314-353, 960-1009):**
- `#resolvePropertyFilter(filter, blueprintSlots)` - main filtering (~50 lines)
- `#validateMatchesAll(pattern, blueprint, patternIndex)` - validation (~40 lines)

**Module Interface:**
```javascript
/**
 * Resolves slots matching property filters (slotType, orientation, socketId)
 * @param {object} filter - Filter criteria object
 * @param {object} blueprintSlots - Blueprint's slot definitions
 * @param {object} logger - Logger instance
 * @returns {string[]} Array of matching slot keys
 */
export function resolvePropertyFilter(filter, blueprintSlots, logger) {
  // Implementation
}

/**
 * Validates matchesAll property-based filter
 * @param {object} pattern - Pattern with matchesAll property
 * @param {object} blueprint - Blueprint context
 * @param {number} patternIndex - Pattern index for error messages
 * @param {object} logger - Logger instance
 * @throws {ValidationError} If pattern is invalid or has unsupported properties
 */
export function validateMatchesAll(pattern, blueprint, patternIndex, logger) {
  // Implementation
}
```

**Note:** The propertyMatcher will need access to `wildcardToRegex` from wildcardMatcher for orientation/socketId pattern matching.

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.test.js
```

**Expected Outcome:**
- New module created
- No syntax errors
- Tests may fail (expected)

### Step 5: Update recipePatternResolver.js to Use Matchers

**Action:** Modify `src/anatomy/recipePatternResolver.js`

**Changes:**
1. Add imports:
```javascript
import {
  resolveSlotGroup,
  validateMatchesGroup
} from './recipePatternResolver/matchers/groupMatcher.js';
import {
  resolveWildcardPattern,
  validateMatchesPattern,
  wildcardToRegex
} from './recipePatternResolver/matchers/wildcardMatcher.js';
import {
  resolvePropertyFilter,
  validateMatchesAll
} from './recipePatternResolver/matchers/propertyMatcher.js';
```

2. Replace inline method calls with matcher function calls:
```javascript
// Before:
const slotKeys = this.#resolveSlotGroup(groupRef, blueprint, options);

// After:
const deps = {
  dataRegistry: this.#dataRegistry,
  slotGenerator: this.#slotGenerator,
  logger: this.#logger
};
const slotKeys = resolveSlotGroup(groupRef, blueprint, options, deps);
```

3. Remove extracted private methods:
   - `#resolveSlotGroup()`
   - `#validateMatchesGroup()`
   - `#generateSlotKeysFromLimbSet()`
   - `#generateSlotKeysFromAppendage()`
   - `#resolveWildcardPattern()`
   - `#validateMatchesPattern()`
   - `#wildcardToRegex()`
   - `#resolvePropertyFilter()`
   - `#validateMatchesAll()`

4. Update `#applyExclusions()` to use new matcher functions

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.test.js
```

**Expected Outcome:**
- File reduced to ~785 lines (from 1195, removing ~410 lines)
- All tests should pass (behavior unchanged)
- No syntax errors
- All dependencies properly passed to matcher functions

### Step 6: Validate Extraction

**Commands:**
```bash
# Run all recipePatternResolver tests
npm run test:unit -- tests/unit/anatomy/recipePatternResolver

# Run ESLint on modified files
npx eslint src/anatomy/recipePatternResolver.js \
  src/anatomy/recipePatternResolver/matchers/groupMatcher.js \
  src/anatomy/recipePatternResolver/matchers/wildcardMatcher.js \
  src/anatomy/recipePatternResolver/matchers/propertyMatcher.js

# Run integration tests that use pattern matching
npm run test:integration -- tests/integration/anatomy/bodyBlueprintFactory
```

**Expected Outcome:**
- All unit tests pass
- ESLint passes
- Integration tests pass
- No functional changes (behavior identical)

### Step 7: Verify File Sizes

**Commands:**
```bash
wc -l src/anatomy/recipePatternResolver.js
wc -l src/anatomy/recipePatternResolver/matchers/*.js
```

**Expected Outcome:**
- recipePatternResolver.js: ~785 lines (reduced from 1195, -410 lines)
- groupMatcher.js: ~230 lines
- wildcardMatcher.js: ~80 lines
- propertyMatcher.js: ~100 lines
- **Total extracted:** ~410 lines

## Testing Strategy

### Unit Tests

**Primary Test Files (3 total):**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.test.js
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.validation.test.js
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.additionalCoverage.test.js
```

**Expected:** All 3 recipePatternResolver unit test files pass without modification

### Integration Tests

**Test Pattern Matching:**
```bash
npm run test:integration -- tests/integration/anatomy/bodyBlueprintFactory.v2.integration.test.js
```

**Expected:** Spider anatomy (8 legs via patterns), Dragon anatomy (legs + wings + tail) generate correctly

### Code Quality

**ESLint:**
```bash
npx eslint src/anatomy/recipePatternResolver.js \
  src/anatomy/recipePatternResolver/matchers/
```

**Expected:** Zero warnings, zero errors

**TypeScript:**
```bash
npm run typecheck
```

**Expected:** No type errors

## Success Criteria

- [ ] Directory structure created
- [ ] groupMatcher.js created (~230 lines with validation + helpers)
- [ ] wildcardMatcher.js created (~80 lines with validation + regex helper)
- [ ] propertyMatcher.js created (~100 lines with validation)
- [ ] recipePatternResolver.js updated to use matchers (~785 lines, -410 lines)
- [ ] All 3 recipePatternResolver unit tests pass
- [ ] Integration tests pass (bodyBlueprintFactory.v2.integration.test.js)
- [ ] ESLint passes on all modified files
- [ ] No breaking changes to public API
- [ ] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [ ] Spider anatomy test passes (8 legs via matchesPattern)
- [ ] Dragon anatomy test passes (legs + wings + tail via patterns)

## Risk Assessment

**Risk Level:** 🟢 **LOW**

**Rationale:**
- Extracting independent matcher functions
- No API changes (internal refactoring only)
- Comprehensive test coverage exists (3 test files covering all patterns)
- Each matcher is self-contained with clear dependencies

**Specific Risks:**

1. **Import Path Errors**
   - **Mitigation:** Verify imports immediately after extraction
   - **Detection:** Test runner will fail on wrong paths

2. **Missing Dependencies**
   - **Risk:** Private methods rely on class instance variables (#dataRegistry, #slotGenerator, #logger)
   - **Mitigation:** Pass dependencies as object parameter to all matcher functions
   - **Detection:** ESLint will catch undefined variables

3. **Logic Errors During Extraction**
   - **Mitigation:** Run tests after each extraction
   - **Detection:** Unit tests will fail immediately

4. **Circular Dependencies**
   - **Risk:** propertyMatcher needs wildcardToRegex from wildcardMatcher
   - **Mitigation:** Export wildcardToRegex as public function from wildcardMatcher
   - **Detection:** Module loading errors at runtime

## Estimated Effort

**Total:** 8-10 hours

**Breakdown:**
- Directory setup: 0.5 hours
- Extract groupMatcher (230 lines, 2 functions + 2 helpers): 3-4 hours
- Extract wildcardMatcher (80 lines, 3 functions): 1.5-2 hours
- Extract propertyMatcher (100 lines, 2 functions): 2-2.5 hours
- Update recipePatternResolver (refactor 9 method calls): 1.5-2 hours
- Testing and validation: 1-2 hours

## Definition of Done

- [ ] All files created with correct line counts
- [ ] recipePatternResolver.js reduced to ~785 lines (-410 lines from 1195)
- [ ] All 3 recipePatternResolver unit tests pass without modification
- [ ] ESLint passes on all modified files (zero warnings)
- [ ] TypeScript type checking passes
- [ ] Integration tests pass (bodyBlueprintFactory.v2.integration.test.js)
- [ ] Spider anatomy generates correctly (8 legs via matchesPattern)
- [ ] Dragon anatomy generates correctly (legs + wings + tail)
- [ ] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [ ] No breaking changes to public API
- [ ] Dependencies (dataRegistry, slotGenerator, logger) properly passed to matchers
- [ ] Git commit created with descriptive message
- [ ] Ready for ANASYSREF-009-02 (validators and facade extraction)

## Notes

**Critical Synchronization:**
- All matchers must use consistent slot filtering logic
- Dependencies must be explicitly passed to all matcher functions (no implicit class context)
- wildcardToRegex must be shared between wildcardMatcher and propertyMatcher
- No changes to pattern resolution behavior (behavior must be identical)
- Validation methods must be co-located with their corresponding resolution methods

**Dependency Structure:**
```javascript
// Each matcher receives dependencies explicitly:
const deps = {
  dataRegistry: this.#dataRegistry,  // For groupMatcher only
  slotGenerator: this.#slotGenerator, // For groupMatcher only
  logger: this.#logger                // For all matchers
};
```

**Next Steps:**
After completion, proceed to **ANASYSREF-009-02** to extract validators, utilities, and create the final facade.
