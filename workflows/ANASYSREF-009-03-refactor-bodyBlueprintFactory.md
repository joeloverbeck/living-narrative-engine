# ANASYSREF-009-03: Refactor bodyBlueprintFactory into Modular Components

## Objective

Refactor `bodyBlueprintFactory.js` (759 lines, 52% over limit) into focused, maintainable modules by extracting blueprint loading, validation, and slot resolution logic while preserving the complete factory interface and all existing functionality.

## Dependencies

### Requires
- **ANASYSREF-009-02** (recipePatternResolver must be complete - bodyBlueprintFactory uses pattern resolution)

### Blocks
- **ANASYSREF-009-03** (anatomyGenerationWorkflow uses bodyBlueprintFactory)

## Priority

🟡 **IMPORTANT** - Second highest priority (759 lines, 52% over limit)

## Scope

### Files to Create

1. **src/anatomy/bodyBlueprintFactory/blueprintLoader.js** (~200 lines)
   - Blueprint loading and caching logic
   - Schema version detection (V1 vs V2)
   - Structure template loading
   - Blueprint file I/O

2. **src/anatomy/bodyBlueprintFactory/blueprintValidator.js** (~150 lines)
   - `validateRecipeSlots()` function
   - Blueprint-recipe consistency checks
   - Constraint validation
   - Error formatting

3. **src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js** (~200 lines)
   - V1 explicit slot processing
   - V2 slot generation coordination
   - Pattern resolution coordination (uses recipePatternResolver)
   - Slot merging logic

4. **src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js** (<400 lines)
   - Main facade orchestrating all modules
   - Public API: `createAnatomyGraph()`
   - Backward compatible interface
   - High-level coordination

### Files to Modify

1. **src/anatomy/bodyBlueprintFactory.js** (DELETE after migration complete)
   - Will be replaced by new modular structure
   - Backup before deletion for reference

2. **src/anatomy/workflows/anatomyGenerationWorkflow.js**
   - Update import from `../bodyBlueprintFactory.js`
   - To: `../bodyBlueprintFactory/bodyBlueprintFactory.js`

3. **src/anatomy/anatomyGenerationService.js** (if it imports bodyBlueprintFactory)
   - Update import path

4. **Container/DI Registration Files** (if applicable)
   - Update registration paths

### Files to Update (Imports Only)

**Test Files** (11 files):
1. `tests/unit/anatomy/bodyBlueprintFactory.test.js`
2. `tests/unit/anatomy/bodyBlueprintFactory.v2.test.js`
3. `tests/unit/anatomy/bodyBlueprintFactory.*.test.js` (multiple specialized tests)
4. `tests/integration/anatomy/bodyBlueprintFactory.*.integration.test.js`

**Update import from:**
```javascript
import BodyBlueprintFactory from '../../../src/anatomy/bodyBlueprintFactory.js';
```

**To:**
```javascript
import BodyBlueprintFactory from '../../../src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js';
```

### Directory Structure to Create

```
src/anatomy/bodyBlueprintFactory/
├── bodyBlueprintFactory.js (main facade, <400 lines)
├── blueprintLoader.js (~200 lines)
├── blueprintValidator.js (~150 lines)
└── slotResolutionOrchestrator.js (~200 lines)
```

## Implementation Steps

### Step 1: Create Directory Structure

**Commands:**
```bash
mkdir -p src/anatomy/bodyBlueprintFactory
```

**Expected Outcome:** Directory created at `src/anatomy/bodyBlueprintFactory/`

### Step 2: Extract blueprintLoader Module

**Action:** Create `src/anatomy/bodyBlueprintFactory/blueprintLoader.js`

**Extract from bodyBlueprintFactory.js:**
- Blueprint loading logic (`loadBlueprint()`)
- Blueprint caching mechanism
- Schema version detection (V1 vs V2)
- Structure template loading
- File I/O operations

**Module Interface:**
```javascript
/**
 * Loads a blueprint definition from file system
 * @param {string} blueprintId - Blueprint identifier
 * @param {object} dependencies - Required dependencies (fileLoader, cache, logger)
 * @returns {object} Blueprint definition
 */
export async function loadBlueprint(blueprintId, { fileLoader, cache, logger }) {
  // Implementation
}

/**
 * Detects blueprint schema version (V1 or V2)
 * @param {object} blueprint - Blueprint to analyze
 * @returns {number} Schema version (1 or 2)
 */
export function detectBlueprintVersion(blueprint) {
  // Implementation
}

/**
 * Loads structure template for V2 blueprints
 * @param {string} templateId - Template identifier
 * @param {object} dependencies - Required dependencies
 * @returns {object} Structure template
 */
export async function loadStructureTemplate(templateId, dependencies) {
  // Implementation
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/bodyBlueprintFactory.test.js
```

**Expected Outcome:**
- Module created (~200 lines)
- No syntax errors
- Tests may fail (expected until refactoring complete)

### Step 3: Extract blueprintValidator Module

**Action:** Create `src/anatomy/bodyBlueprintFactory/blueprintValidator.js`

**Extract from bodyBlueprintFactory.js:**
- `validateRecipeSlots()` function
- Blueprint-recipe consistency validation
- Constraint validation logic
- Error message formatting

**Module Interface:**
```javascript
/**
 * Validates that recipe slots match blueprint structure
 * @param {array} recipeSlots - Slots defined in recipe
 * @param {object} blueprint - Blueprint definition
 * @param {object} logger - Logger instance
 * @throws {ValidationError} if validation fails
 */
export function validateRecipeSlots(recipeSlots, blueprint, logger) {
  // Implementation
}

/**
 * Validates blueprint-recipe consistency
 * @param {object} blueprint - Blueprint definition
 * @param {object} recipe - Recipe definition
 * @param {object} logger - Logger instance
 * @throws {ValidationError} if inconsistent
 */
export function validateBlueprintRecipeConsistency(blueprint, recipe, logger) {
  // Implementation
}

/**
 * Validates blueprint constraints
 * @param {object} blueprint - Blueprint to validate
 * @param {object} logger - Logger instance
 * @throws {ValidationError} if constraints violated
 */
export function validateBlueprintConstraints(blueprint, logger) {
  // Implementation
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/bodyBlueprintFactory.test.js
```

**Expected Outcome:**
- Module created (~150 lines)
- No syntax errors

### Step 4: Extract slotResolutionOrchestrator Module

**Action:** Create `src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js`

**Extract from bodyBlueprintFactory.js:**
- V1 slot processing logic (explicit slots)
- V2 slot generation coordination (templates)
- Pattern resolution coordination (calls recipePatternResolver)
- Slot merging and deduplication logic

**Module Interface:**
```javascript
/**
 * Resolves slots for V1 blueprints (explicit slot definitions)
 * @param {object} blueprint - V1 blueprint
 * @param {object} recipe - Recipe definition
 * @param {object} dependencies - Required dependencies
 * @returns {array} Resolved slots
 */
export function resolveV1Slots(blueprint, recipe, dependencies) {
  // Implementation
}

/**
 * Resolves slots for V2 blueprints (template-based)
 * @param {object} blueprint - V2 blueprint
 * @param {object} recipe - Recipe definition
 * @param {object} dependencies - Required dependencies (patternResolver, etc.)
 * @returns {array} Generated slots
 */
export function resolveV2Slots(blueprint, recipe, dependencies) {
  // Implementation
}

/**
 * Merges slots from multiple sources (explicit + patterns)
 * @param {array} slots - Slots to merge
 * @param {object} logger - Logger instance
 * @returns {array} Merged slots without duplicates
 */
export function mergeSlots(slots, logger) {
  // Implementation
}

/**
 * Coordinates pattern resolution with recipePatternResolver
 * @param {array} patterns - Recipe patterns
 * @param {object} blueprint - Blueprint context
 * @param {array} slots - Available slots
 * @param {object} patternResolver - RecipePatternResolver instance
 * @returns {Map} Pattern resolution results
 */
export function coordinatePatternResolution(patterns, blueprint, slots, patternResolver) {
  // Implementation
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/bodyBlueprintFactory.v2.test.js
```

**Expected Outcome:**
- Module created (~200 lines)
- No syntax errors

### Step 5: Create bodyBlueprintFactory Facade

**Action:** Create `src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js`

**Purpose:** Main facade that orchestrates all modules and maintains backward compatibility

**Module Structure:**
```javascript
/**
 * @file Main facade for anatomy graph creation from blueprints + recipes
 */

// Import extracted modules
import {
  loadBlueprint,
  detectBlueprintVersion,
  loadStructureTemplate
} from './blueprintLoader.js';
import {
  validateRecipeSlots,
  validateBlueprintRecipeConsistency
} from './blueprintValidator.js';
import {
  resolveV1Slots,
  resolveV2Slots,
  mergeSlots,
  coordinatePatternResolution
} from './slotResolutionOrchestrator.js';

/**
 * BodyBlueprintFactory - Creates anatomy graphs from blueprints and recipes
 */
class BodyBlueprintFactory {
  #logger;
  #recipePatternResolver;
  #socketGenerator;
  #slotGenerator;
  #orientationResolver;
  // ... other dependencies

  constructor({
    logger,
    recipePatternResolver,
    socketGenerator,
    slotGenerator,
    orientationResolver,
    // ... other dependencies
  }) {
    // Validate all dependencies
    this.#logger = logger;
    this.#recipePatternResolver = recipePatternResolver;
    // ... store dependencies
  }

  /**
   * Creates an anatomy graph from blueprint and recipe
   * @param {string} blueprintId - Blueprint identifier
   * @param {object} recipe - Recipe definition
   * @param {object} options - Creation options
   * @returns {object} Anatomy graph with entities and sockets
   */
  async createAnatomyGraph(blueprintId, recipe, options = {}) {
    // Orchestrate:
    // 1. Load blueprint (use blueprintLoader)
    // 2. Validate blueprint-recipe consistency (use blueprintValidator)
    // 3. Resolve slots (use slotResolutionOrchestrator)
    // 4. Generate sockets (use socketGenerator)
    // 5. Build entity graph
    // Maintain exact same behavior as original
  }

  // ... other public methods if they exist
}

export default BodyBlueprintFactory;
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/bodyBlueprintFactory
```

**Expected Outcome:**
- Facade created (<400 lines)
- All functionality delegated to modules
- Identical behavior to original implementation

### Step 6: Update Dependent Files

**Action 1:** Update anatomyGenerationWorkflow.js import

```javascript
// Before:
import BodyBlueprintFactory from '../bodyBlueprintFactory.js';

// After:
import BodyBlueprintFactory from '../bodyBlueprintFactory/bodyBlueprintFactory.js';
```

**Action 2:** Update anatomyGenerationService.js import (if applicable)

```javascript
// Before:
import BodyBlueprintFactory from './bodyBlueprintFactory.js';

// After:
import BodyBlueprintFactory from './bodyBlueprintFactory/bodyBlueprintFactory.js';
```

**Action 3:** Update all test file imports

**Files to update** (11 files):
- `tests/unit/anatomy/bodyBlueprintFactory.test.js`
- `tests/unit/anatomy/bodyBlueprintFactory.v2.test.js`
- `tests/unit/anatomy/bodyBlueprintFactory.*.test.js`
- `tests/integration/anatomy/bodyBlueprintFactory.*.integration.test.js`

**Change:**
```javascript
// Before:
import BodyBlueprintFactory from '../../../src/anatomy/bodyBlueprintFactory.js';

// After:
import BodyBlueprintFactory from '../../../src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js';
```

**Testing after each update:**
```bash
npm run test:unit -- tests/unit/anatomy/bodyBlueprintFactory
npm run test:integration -- tests/integration/anatomy/bodyBlueprintFactory
```

### Step 7: Delete Old bodyBlueprintFactory.js

**Action:** Remove the original file (after confirming all tests pass)

**Commands:**
```bash
# Backup first (just in case)
cp src/anatomy/bodyBlueprintFactory.js src/anatomy/bodyBlueprintFactory.js.backup

# Delete original
rm src/anatomy/bodyBlueprintFactory.js
```

**Testing:**
```bash
# Verify all tests still pass
npm run test:unit -- tests/unit/anatomy/bodyBlueprintFactory
npm run test:integration -- tests/integration/anatomy/bodyBlueprintFactory
npm run test:integration -- tests/integration/anatomy
```

**Expected Outcome:**
- Original file deleted
- All tests pass
- No references to old file remain

### Step 8: Final Validation

**Commands:**
```bash
# Run all bodyBlueprintFactory tests
npm run test:unit -- tests/unit/anatomy/bodyBlueprintFactory

# Run integration tests
npm run test:integration -- tests/integration/anatomy/bodyBlueprintFactory
npm run test:integration -- tests/integration/anatomy

# ESLint all new files
npx eslint src/anatomy/bodyBlueprintFactory/

# Verify file sizes
wc -l src/anatomy/bodyBlueprintFactory/*.js
```

**Expected Outcome:**
- All tests pass (100% of original tests)
- ESLint passes (zero warnings)
- All files <500 lines
- No functional changes (behavior identical)

## Testing Strategy

### Unit Tests

**All bodyBlueprintFactory Tests:**
```bash
npm run test:unit -- tests/unit/anatomy/bodyBlueprintFactory
```

**Expected:** 11+ test files pass with zero modifications to test logic

### Integration Tests

**V1 Blueprint Integration:**
```bash
npm run test:integration -- tests/integration/anatomy/bodyBlueprintFactory.v1.integration.test.js
```

**Expected:**
- Human anatomy generates correctly (V1 explicit slots)

**V2 Blueprint Integration:**
```bash
npm run test:integration -- tests/integration/anatomy/bodyBlueprintFactory.v2.integration.test.js
```

**Expected:**
- Spider anatomy generates correctly (8 legs via patterns)
- Dragon anatomy generates correctly (legs + wings + tail via patterns)
- Centaur anatomy generates correctly (mixed limb types)

### Regression Testing

**Critical Scenarios:**
1. V1 blueprint with explicit slots
2. V2 blueprint with structure templates
3. V2 blueprint with pattern matching
4. Mixed slot definitions (explicit + patterns)
5. Socket generation for all slot types
6. Clothing integration

### Code Quality

**ESLint:**
```bash
npx eslint src/anatomy/bodyBlueprintFactory/
```

**Expected:** Zero warnings, zero errors

**TypeScript:**
```bash
npm run typecheck
```

**Expected:** No type errors

## Success Criteria

- [x] Directory structure created
- [x] blueprintLoader.js created (~200 lines)
- [x] blueprintValidator.js created (~150 lines)
- [x] slotResolutionOrchestrator.js created (~200 lines)
- [x] bodyBlueprintFactory.js facade created (<400 lines)
- [x] Original bodyBlueprintFactory.js deleted
- [x] anatomyGenerationWorkflow.js import updated
- [x] anatomyGenerationService.js import updated (if applicable)
- [x] All 11 test files imports updated
- [x] All bodyBlueprintFactory unit tests pass
- [x] All bodyBlueprintFactory integration tests pass
- [x] ESLint passes on all new files
- [x] No breaking changes to public API
- [x] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [x] V1 blueprint test passes (human anatomy)
- [x] V2 blueprint tests pass (spider, dragon, centaur)

## Risk Assessment

**Risk Level:** 🟢 **LOW**

**Rationale:**
- recipePatternResolver already refactored (ANASYSREF-009-02 complete)
- Clear module boundaries identified
- Comprehensive test coverage exists (11+ test files)
- V1 and V2 blueprint tests cover all scenarios

**Specific Risks:**

1. **V1/V2 Logic Separation Issues**
   - **Impact:** Medium (one blueprint type might break)
   - **Probability:** Low (clear separation in original code)
   - **Mitigation:** Test V1 and V2 separately after extraction
   - **Detection:** Integration tests will fail immediately

2. **Pattern Resolution Integration**
   - **Impact:** High (V2 blueprints break)
   - **Probability:** Very Low (recipePatternResolver already modular)
   - **Mitigation:** Test pattern matching thoroughly
   - **Detection:** Spider/dragon anatomy tests will fail

3. **Test Import Path Errors**
   - **Impact:** Medium (tests fail to run)
   - **Probability:** Low (11 files to update)
   - **Mitigation:** Update imports systematically, test after each
   - **Detection:** Test runner will fail immediately

## Estimated Effort

**Total:** 6-8 hours

**Breakdown:**
- Extract blueprintLoader: 1.5-2 hours
- Extract blueprintValidator: 1-1.5 hours
- Extract slotResolutionOrchestrator: 2-2.5 hours
- Create bodyBlueprintFactory facade: 1.5-2 hours
- Update imports (tests, dependencies): 0.5-1 hour
- Final testing and validation: 1 hour

## Definition of Done

- [ ] All 4 modules created with correct line counts
- [ ] bodyBlueprintFactory.js facade created (<400 lines)
- [ ] Original bodyBlueprintFactory.js deleted
- [ ] anatomyGenerationWorkflow.js import updated
- [ ] anatomyGenerationService.js import updated (if applicable)
- [ ] All 11 test files imports updated
- [ ] All bodyBlueprintFactory unit tests pass without modification
- [ ] ESLint passes on all new files (zero warnings)
- [ ] TypeScript type checking passes
- [ ] V1 integration tests pass (human anatomy)
- [ ] V2 integration tests pass (spider, dragon, centaur)
- [ ] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [ ] No breaking changes to public API
- [ ] No performance regression
- [ ] Socket generation works correctly
- [ ] Git commit created with descriptive message
- [ ] Ready for ANASYSREF-009-04 (anatomyGenerationWorkflow refactoring)

## Notes

**Critical Synchronization:**
- Must use OrientationResolver for all orientation logic (avoid commit `af53a1948` bug)
- Socket keys must match slot keys exactly
- Pattern resolution must use recipePatternResolver module
- V1 and V2 logic must remain completely separate

**File Size Verification:**
After completion, verify all files ≤500 lines:
```bash
wc -l src/anatomy/bodyBlueprintFactory/*.js
```

**Expected:**
- bodyBlueprintFactory.js: <400 lines
- blueprintLoader.js: ~200 lines
- blueprintValidator.js: ~150 lines
- slotResolutionOrchestrator.js: ~200 lines
- Total: <1000 lines (well distributed across 4 modules)

**Integration Points:**
- recipePatternResolver: Used by slotResolutionOrchestrator for V2 pattern matching
- socketGenerator: Used by facade for socket creation
- slotGenerator: Used by slotResolutionOrchestrator for slot generation
- orientationResolver: Used by both SlotGenerator and SocketGenerator (critical!)

**Next Steps:**
After completion, proceed to **ANASYSREF-009-04** to refactor anatomyGenerationWorkflow.
