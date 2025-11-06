# ANASYSREF-009-04: Extract Workflow Stages from anatomyGenerationWorkflow

## Objective

Refactor `anatomyGenerationWorkflow.js` (649 lines, 30% over limit) by extracting the four major workflow stages into focused modules, creating a clean orchestration pattern that improves maintainability while preserving all functionality including critical ANATOMY_GENERATED event dispatching.

## Dependencies

### Requires
- **ANASYSREF-009-03** (bodyBlueprintFactory must be complete - anatomyGenerationWorkflow uses it)

### Blocks
- **ANASYSREF-009-05** (final validation requires all refactorings complete)

## Priority

🟡 **IMPORTANT** - Third priority (649 lines, 30% over limit)

## Scope

### Files to Create

1. **src/anatomy/workflows/stages/blueprintResolutionStage.js** (~100 lines)
   - Blueprint loading coordination
   - Recipe loading and processing
   - Blueprint-recipe validation

2. **src/anatomy/workflows/stages/partSelectionStage.js** (~100 lines)
   - Part selection coordination
   - Slot-to-entity mapping
   - Part assignment validation

3. **src/anatomy/workflows/stages/graphConstructionStage.js** (~150 lines)
   - Entity graph building
   - Socket generation coordination
   - Component updates and relationships
   - Hierarchical structure creation

4. **src/anatomy/workflows/stages/clothingInstantiationStage.js** (~100 lines)
   - Clothing metadata creation
   - Clothing instantiation coordination
   - Socket index building
   - Clothing attachment to sockets

### Files to Modify

1. **src/anatomy/workflows/anatomyGenerationWorkflow.js**
   - Refactor to orchestrate stages (<350 lines)
   - Maintain public API: `generate()`
   - Preserve ANATOMY_GENERATED event dispatching
   - Keep error handling and logging

### Files to Update (Imports Only)

**Test Files** (2 files):
1. `tests/unit/anatomy/workflows/anatomyGenerationWorkflow.test.js`
2. `tests/unit/anatomy/workflows/anatomyGenerationWorkflow.events.test.js`

**Note:** Import paths likely won't change (file name stays same), but verify after refactoring

### Directory Structure to Create

```
src/anatomy/workflows/
├── anatomyGenerationWorkflow.js (main coordinator, <350 lines)
└── stages/
    ├── blueprintResolutionStage.js (~100 lines)
    ├── partSelectionStage.js (~100 lines)
    ├── graphConstructionStage.js (~150 lines)
    └── clothingInstantiationStage.js (~100 lines)
```

## Implementation Steps

### Step 1: Create Stages Directory

**Commands:**
```bash
mkdir -p src/anatomy/workflows/stages
```

**Expected Outcome:** Directory created at `src/anatomy/workflows/stages/`

### Step 2: Extract blueprintResolutionStage Module

**Action:** Create `src/anatomy/workflows/stages/blueprintResolutionStage.js`

**Extract from anatomyGenerationWorkflow.js:**
- Blueprint loading coordination
- Recipe loading and processing
- Blueprint-recipe validation

**Module Interface:**
```javascript
/**
 * Resolves blueprint and recipe for anatomy generation
 * @param {object} context - Generation context
 * @param {object} dependencies - Required services
 * @returns {object} Resolved blueprint and recipe
 */
export async function executeBlueprintResolution(context, dependencies) {
  const { entityId, blueprintId, recipeData } = context;
  const { bodyBlueprintFactory, logger } = dependencies;

  // 1. Load blueprint
  // 2. Process recipe
  // 3. Validate blueprint-recipe consistency

  return {
    blueprint,
    recipe,
    slots // Resolved slots
  };
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow.test.js
```

**Expected Outcome:**
- Module created (~100 lines)
- No syntax errors
- Tests may fail (expected until refactoring complete)

### Step 3: Extract partSelectionStage Module

**Action:** Create `src/anatomy/workflows/stages/partSelectionStage.js`

**Extract from anatomyGenerationWorkflow.js:**
- Part selection coordination
- Slot-to-entity mapping
- Part assignment validation

**Module Interface:**
```javascript
/**
 * Executes part selection for all slots
 * @param {object} context - Generation context with blueprint and slots
 * @param {object} dependencies - Required services (partSelectionService, etc.)
 * @returns {Map} Map of slot IDs to selected part entities
 */
export async function executePartSelection(context, dependencies) {
  const { blueprint, slots, entityId } = context;
  const { partSelectionService, logger } = dependencies;

  // 1. Select parts for each slot
  // 2. Create part entities
  // 3. Map slots to entities

  return {
    partEntities, // Map<slotId, entityId>
    createdEntities // Array of entity IDs
  };
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow.test.js
```

**Expected Outcome:**
- Module created (~100 lines)
- No syntax errors

### Step 4: Extract graphConstructionStage Module

**Action:** Create `src/anatomy/workflows/stages/graphConstructionStage.js`

**Extract from anatomyGenerationWorkflow.js:**
- Entity graph building
- Socket generation coordination
- Component updates (parent-child relationships)
- Hierarchical structure creation

**Module Interface:**
```javascript
/**
 * Constructs the entity graph with sockets and relationships
 * @param {object} context - Generation context with parts and slots
 * @param {object} dependencies - Required services (socketGenerator, componentMutationService, etc.)
 * @returns {object} Constructed graph with sockets
 */
export async function executeGraphConstruction(context, dependencies) {
  const { blueprint, slots, partEntities, entityId } = context;
  const {
    socketGenerator,
    componentMutationService,
    entityManager,
    logger
  } = dependencies;

  // 1. Generate sockets for all slots
  // 2. Create parent-child relationships
  // 3. Update components with socket references
  // 4. Build hierarchical structure

  return {
    sockets, // Array of socket objects
    socketIndex, // Map for quick socket lookup
    rootEntityId // Root of the anatomy graph
  };
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow.test.js
```

**Expected Outcome:**
- Module created (~150 lines)
- No syntax errors

### Step 5: Extract clothingInstantiationStage Module

**Action:** Create `src/anatomy/workflows/stages/clothingInstantiationStage.js`

**Extract from anatomyGenerationWorkflow.js:**
- Clothing metadata creation
- Clothing instantiation coordination
- Socket index building
- Clothing attachment to sockets

**Module Interface:**
```javascript
/**
 * Instantiates clothing if configured
 * @param {object} context - Generation context with sockets and options
 * @param {object} dependencies - Required services
 * @returns {object} Clothing instantiation results
 */
export async function executeClothingInstantiation(context, dependencies) {
  const { sockets, socketIndex, entityId, options } = context;
  const { clothingInstantiationService, logger } = dependencies;

  // Only execute if instantiateClothing option is true
  if (!options.instantiateClothing) {
    return { clothingInstantiated: false };
  }

  // 1. Build socket index
  // 2. Create clothing metadata
  // 3. Coordinate clothing instantiation
  // 4. Attach clothing to sockets

  return {
    clothingInstantiated: true,
    clothingEntities // Array of clothing entity IDs
  };
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow.test.js
```

**Expected Outcome:**
- Module created (~100 lines)
- No syntax errors

### Step 6: Refactor anatomyGenerationWorkflow to Orchestrate Stages

**Action:** Modify `src/anatomy/workflows/anatomyGenerationWorkflow.js`

**Changes:**

1. **Add imports:**
```javascript
import { executeBlueprintResolution } from './stages/blueprintResolutionStage.js';
import { executePartSelection } from './stages/partSelectionStage.js';
import { executeGraphConstruction } from './stages/graphConstructionStage.js';
import { executeClothingInstantiation } from './stages/clothingInstantiationStage.js';
```

2. **Refactor generate() method:**
```javascript
async generate(entityId, blueprintId, recipeData, options = {}) {
  try {
    // Stage 1: Blueprint Resolution
    const blueprintContext = await executeBlueprintResolution(
      { entityId, blueprintId, recipeData },
      this.#getDependencies()
    );

    // Stage 2: Part Selection
    const partContext = await executePartSelection(
      { ...blueprintContext, entityId },
      this.#getDependencies()
    );

    // Stage 3: Graph Construction
    const graphContext = await executeGraphConstruction(
      { ...blueprintContext, ...partContext, entityId },
      this.#getDependencies()
    );

    // Stage 4: Clothing Instantiation (optional)
    const clothingContext = await executeClothingInstantiation(
      { ...graphContext, entityId, options },
      this.#getDependencies()
    );

    // Dispatch ANATOMY_GENERATED event (CRITICAL!)
    this.#eventBus.dispatch({
      type: 'ANATOMY_GENERATED',
      payload: {
        entityId,
        blueprintId,
        sockets: graphContext.sockets,
        socketIndex: graphContext.socketIndex,
        ...clothingContext
      }
    });

    return {
      success: true,
      entityId,
      sockets: graphContext.sockets,
      ...clothingContext
    };
  } catch (error) {
    // Error handling
  }
}

#getDependencies() {
  return {
    bodyBlueprintFactory: this.#bodyBlueprintFactory,
    partSelectionService: this.#partSelectionService,
    socketGenerator: this.#socketGenerator,
    componentMutationService: this.#componentMutationService,
    entityManager: this.#entityManager,
    clothingInstantiationService: this.#clothingInstantiationService,
    logger: this.#logger
  };
}
```

3. **Remove extracted stage logic:**
   - Delete inline blueprint resolution code
   - Delete inline part selection code
   - Delete inline graph construction code
   - Delete inline clothing instantiation code

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow
```

**Expected Outcome:**
- File reduced to <350 lines
- Tests should pass
- No functional changes (behavior identical)

### Step 7: Verify ANATOMY_GENERATED Event

**Critical:** Ensure ANATOMY_GENERATED event still dispatches correctly

**Test:**
```bash
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow.events.test.js
```

**Verify Event Payload Includes:**
- `entityId`
- `blueprintId`
- `sockets` (array of socket objects)
- `socketIndex` (Map for quick lookup)
- `clothingInstantiated` (boolean)
- `clothingEntities` (array, if clothing instantiated)

**Expected Outcome:**
- Event test passes
- Event payload structure unchanged
- Event timing correct (after socket index built, before clothing instantiation)

### Step 8: Run Complete Test Suite

**Commands:**
```bash
# Run all anatomyGenerationWorkflow tests
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow

# Run integration tests
npm run test:integration -- tests/integration/anatomy

# ESLint all modified files
npx eslint src/anatomy/workflows/anatomyGenerationWorkflow.js \
  src/anatomy/workflows/stages/
```

**Expected Outcome:**
- All tests pass
- ESLint passes (zero warnings)
- No functional changes

### Step 9: Verify File Sizes

**Commands:**
```bash
wc -l src/anatomy/workflows/anatomyGenerationWorkflow.js
wc -l src/anatomy/workflows/stages/*.js
```

**Expected Outcome:**
- anatomyGenerationWorkflow.js: <350 lines (reduced from 649)
- blueprintResolutionStage.js: ~100 lines
- partSelectionStage.js: ~100 lines
- graphConstructionStage.js: ~150 lines
- clothingInstantiationStage.js: ~100 lines

## Testing Strategy

### Unit Tests

**Primary Test Files:**
```bash
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow.test.js
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow.events.test.js
```

**Expected:** Both test files pass without modification

### Integration Tests

**Full Anatomy Generation:**
```bash
npm run test:integration -- tests/integration/anatomy
```

**Critical Scenarios:**
1. Human anatomy generation (V1 blueprint)
2. Spider anatomy generation (8 legs via patterns)
3. Dragon anatomy generation (legs + wings + tail)
4. Anatomy with clothing instantiation
5. Anatomy without clothing instantiation
6. ANATOMY_GENERATED event dispatch and handling

**Expected:** All integration tests pass

### Event Testing

**ANATOMY_GENERATED Event:**
- Event dispatches after graph construction
- Event includes complete socket information
- Event includes socket index for O(1) lookups
- Event timing allows clothing system to respond
- Event subscribers receive correct payload

### Code Quality

**ESLint:**
```bash
npx eslint src/anatomy/workflows/
```

**Expected:** Zero warnings, zero errors

**TypeScript:**
```bash
npm run typecheck
```

**Expected:** No type errors

## Success Criteria

- [x] Directory structure created
- [x] blueprintResolutionStage.js created (~100 lines)
- [x] partSelectionStage.js created (~100 lines)
- [x] graphConstructionStage.js created (~150 lines)
- [x] clothingInstantiationStage.js created (~100 lines)
- [x] anatomyGenerationWorkflow.js refactored (<350 lines)
- [x] All anatomyGenerationWorkflow unit tests pass
- [x] Event tests pass (ANATOMY_GENERATED)
- [x] Integration tests pass (all anatomy generation scenarios)
- [x] ESLint passes on all modified files
- [x] No breaking changes to public API
- [x] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [x] ANATOMY_GENERATED event dispatches correctly
- [x] Socket index builds correctly
- [x] Clothing integration works (when enabled)

## Risk Assessment

**Risk Level:** 🟢 **LOW**

**Rationale:**
- Clear stage boundaries in existing code
- ANATOMY_GENERATED event well-tested
- Comprehensive test coverage exists (2 test files + integration tests)
- Stage execution order is straightforward

**Specific Risks:**

1. **ANATOMY_GENERATED Event Timing**
   - **Impact:** High (clothing system depends on event)
   - **Probability:** Very Low (event dispatch logic simple)
   - **Mitigation:** Test event dispatch explicitly after refactoring
   - **Detection:** Event tests will fail immediately

2. **Stage Context Passing**
   - **Impact:** Medium (stages might miss required data)
   - **Probability:** Low (clear data flow between stages)
   - **Mitigation:** Each stage returns complete context for next stage
   - **Detection:** Unit tests will fail immediately

3. **Socket Index Building**
   - **Impact:** High (clothing attachment breaks without index)
   - **Probability:** Very Low (socket index logic in graphConstructionStage)
   - **Mitigation:** Verify socket index in tests
   - **Detection:** Clothing integration tests will fail

## Estimated Effort

**Total:** 6-8 hours

**Breakdown:**
- Extract blueprintResolutionStage: 1-1.5 hours
- Extract partSelectionStage: 1-1.5 hours
- Extract graphConstructionStage: 1.5-2 hours
- Extract clothingInstantiationStage: 1-1.5 hours
- Refactor main workflow: 1.5-2 hours
- Testing and validation: 1 hour

## Definition of Done

- [ ] All 4 stage modules created with correct line counts
- [ ] anatomyGenerationWorkflow.js refactored (<350 lines)
- [ ] All anatomyGenerationWorkflow unit tests pass without modification
- [ ] Event tests pass (ANATOMY_GENERATED dispatch)
- [ ] ESLint passes on all modified files (zero warnings)
- [ ] TypeScript type checking passes
- [ ] All integration tests pass (anatomy generation scenarios)
- [ ] Human anatomy generates correctly (V1)
- [ ] Spider anatomy generates correctly (8 legs)
- [ ] Dragon anatomy generates correctly (legs + wings + tail)
- [ ] ANATOMY_GENERATED event dispatches with correct payload
- [ ] Socket index builds correctly
- [ ] Clothing integration works (when enabled)
- [ ] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [ ] No breaking changes to public API
- [ ] No performance regression
- [ ] Git commit created with descriptive message
- [ ] Ready for ANASYSREF-009-05 (final validation)

## Notes

**Critical Event Integration:**
The ANATOMY_GENERATED event is **CRITICAL** for system integration:
- ClothingInstantiationService subscribes to this event
- Event must include socket information (sockets array + socketIndex)
- Event must dispatch **after** socket index built
- Event must dispatch **before** clothing instantiation completes
- Event payload structure must remain unchanged

**Event Payload Structure (MUST PRESERVE):**
```javascript
{
  type: 'ANATOMY_GENERATED',
  payload: {
    entityId: string,
    blueprintId: string,
    sockets: Array<object>, // Socket objects
    socketIndex: Map<string, object>, // Socket lookup index
    clothingInstantiated: boolean,
    clothingEntities: Array<string> // If clothing instantiated
  }
}
```

**Stage Execution Order (MUST PRESERVE):**
1. Blueprint Resolution → produces blueprint, recipe, slots
2. Part Selection → produces part entities
3. Graph Construction → produces sockets, socket index, relationships
4. Clothing Instantiation (optional) → produces clothing entities

**File Size Verification:**
After completion, verify all files ≤500 lines:
```bash
wc -l src/anatomy/workflows/anatomyGenerationWorkflow.js
wc -l src/anatomy/workflows/stages/*.js
```

**Expected:**
- anatomyGenerationWorkflow.js: <350 lines
- Each stage module: ≤150 lines
- Total: <800 lines (well distributed across 5 files)

**Next Steps:**
After completion, proceed to **ANASYSREF-009-05** for final validation and documentation.
