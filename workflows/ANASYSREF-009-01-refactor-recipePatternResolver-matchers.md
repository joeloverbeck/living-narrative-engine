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

1. **src/anatomy/recipePatternResolver/matchers/groupMatcher.js** (~150 lines)
   - Extract `resolveMatchesGroup()` logic
   - Extract limbSet/appendage group extraction
   - Handle `matchesGroup` patterns

2. **src/anatomy/recipePatternResolver/matchers/wildcardMatcher.js** (~150 lines)
   - Extract `resolveMatchesPattern()` logic
   - Wildcard pattern matching with `*`
   - Pattern syntax validation

3. **src/anatomy/recipePatternResolver/matchers/propertyMatcher.js** (~200 lines)
   - Extract `resolveMatchesAll()` logic
   - Property-based filtering (slotType, orientation, socketId)
   - Complex filter combinations

### Files to Modify

1. **src/anatomy/recipePatternResolver.js**
   - Remove extracted matcher logic (will reduce to ~900 lines)
   - Add imports for new matcher modules
   - Delegate to matchers instead of inline logic

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

**Extract from recipePatternResolver.js:**
- `resolveMatchesGroup()` function
- Group extraction logic (limbSets, appendages)
- Group validation logic

**Module Interface:**
```javascript
/**
 * Resolves slots matching a group pattern (limbSet:*, appendage:*)
 * @param {object} pattern - Pattern with matchesGroup property
 * @param {object} blueprint - Blueprint with limbSets/appendages
 * @param {array} slots - Slots to filter
 * @param {object} logger - Logger instance
 * @returns {array} Matching slots
 */
export function resolveMatchesGroup(pattern, blueprint, slots, logger) {
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

**Extract from recipePatternResolver.js:**
- `resolveMatchesPattern()` function
- Wildcard pattern matching logic
- Pattern syntax validation

**Module Interface:**
```javascript
/**
 * Resolves slots matching a wildcard pattern (leg_*, *_left)
 * @param {object} pattern - Pattern with matchesPattern property
 * @param {array} slots - Slots to filter
 * @param {object} logger - Logger instance
 * @returns {array} Matching slots
 */
export function resolveMatchesPattern(pattern, slots, logger) {
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

**Extract from recipePatternResolver.js:**
- `resolveMatchesAll()` function
- Property filtering logic (slotType, orientation, socketId)
- Filter combination logic

**Module Interface:**
```javascript
/**
 * Resolves slots matching property filters
 * @param {object} pattern - Pattern with matchesAll property
 * @param {array} slots - Slots to filter
 * @param {object} logger - Logger instance
 * @returns {array} Matching slots
 */
export function resolveMatchesAll(pattern, slots, logger) {
  // Implementation
}

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

**Expected Outcome:**
- New module created
- No syntax errors
- Tests may fail (expected)

### Step 5: Update recipePatternResolver.js to Use Matchers

**Action:** Modify `src/anatomy/recipePatternResolver.js`

**Changes:**
1. Add imports:
```javascript
import { resolveMatchesGroup } from './matchers/groupMatcher.js';
import { resolveMatchesPattern } from './matchers/wildcardMatcher.js';
import { resolveMatchesAll } from './matchers/propertyMatcher.js';
```

2. Replace inline logic with matcher calls:
```javascript
// Before:
const matchingSlots = this.#resolveMatchesGroup(pattern, blueprint, slots);

// After:
const matchingSlots = resolveMatchesGroup(pattern, blueprint, slots, this.#logger);
```

3. Remove extracted functions from recipePatternResolver.js

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.test.js
```

**Expected Outcome:**
- File reduced to ~900 lines
- Tests should start passing
- No syntax errors

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
- recipePatternResolver.js: ~900 lines (reduced from 1195)
- groupMatcher.js: ~150 lines
- wildcardMatcher.js: ~150 lines
- propertyMatcher.js: ~200 lines

## Testing Strategy

### Unit Tests

**Primary Test File:**
```bash
npm run test:unit -- tests/unit/anatomy/recipePatternResolver.test.js
```

**Additional Test Files:**
- `tests/unit/anatomy/recipePatternResolver.validation.test.js`
- `tests/unit/anatomy/recipePatternResolver.additionalCoverage.test.js`

**Expected:** All 20 recipePatternResolver test files pass without modification

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

- [x] Directory structure created
- [x] groupMatcher.js created (~150 lines)
- [x] wildcardMatcher.js created (~150 lines)
- [x] propertyMatcher.js created (~200 lines)
- [x] recipePatternResolver.js updated to use matchers (~900 lines)
- [x] All 20 recipePatternResolver unit tests pass
- [x] Integration tests pass (bodyBlueprintFactory)
- [x] ESLint passes on all modified files
- [x] No breaking changes to public API
- [x] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [x] Spider anatomy test passes (8 legs via matchesPattern)
- [x] Dragon anatomy test passes (legs + wings + tail via patterns)

## Risk Assessment

**Risk Level:** 🟢 **LOW**

**Rationale:**
- Extracting independent matcher functions
- No API changes (internal refactoring only)
- Comprehensive test coverage exists (20 test files)
- Each matcher is self-contained

**Specific Risks:**

1. **Import Path Errors**
   - **Mitigation:** Verify imports immediately after extraction
   - **Detection:** Test runner will fail on wrong paths

2. **Missing Dependencies**
   - **Mitigation:** Ensure all dependencies (logger, utils) passed as parameters
   - **Detection:** ESLint will catch undefined variables

3. **Logic Errors During Extraction**
   - **Mitigation:** Run tests after each extraction
   - **Detection:** Unit tests will fail immediately

## Estimated Effort

**Total:** 8-10 hours

**Breakdown:**
- Directory setup: 0.5 hours
- Extract groupMatcher: 2-3 hours
- Extract wildcardMatcher: 2-3 hours
- Extract propertyMatcher: 2-3 hours
- Update recipePatternResolver: 1-2 hours
- Testing and validation: 1-2 hours

## Definition of Done

- [ ] All files created with correct line counts
- [ ] recipePatternResolver.js reduced to ~900 lines
- [ ] All 20 recipePatternResolver unit tests pass without modification
- [ ] ESLint passes on all modified files (zero warnings)
- [ ] TypeScript type checking passes
- [ ] Integration tests pass (bodyBlueprintFactory)
- [ ] Spider anatomy generates correctly (8 legs via pattern matching)
- [ ] Dragon anatomy generates correctly (legs + wings + tail)
- [ ] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [ ] No breaking changes to public API
- [ ] Git commit created with descriptive message
- [ ] Ready for ANASYSREF-009-02 (validators and facade extraction)

## Notes

**Critical Synchronization:**
- All matchers must use consistent slot filtering logic
- Logger must be passed to all matchers for consistent error reporting
- No changes to pattern resolution behavior (behavior must be identical)

**Next Steps:**
After completion, proceed to **ANASYSREF-009-02** to extract validators, utilities, and create the final facade.
