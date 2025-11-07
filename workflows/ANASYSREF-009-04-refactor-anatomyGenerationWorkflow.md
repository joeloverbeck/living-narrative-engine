# ANASYSREF-009-04: Extract Workflow Stages from anatomyGenerationWorkflow

## ⚠️ WORKFLOW VALIDATION NOTES

**This workflow has been validated against the actual codebase. Key corrections made:**

1. **Dependencies Corrected**: Removed non-existent dependencies (partSelectionService, socketGenerator, componentMutationService). Added actual dependencies (dataRegistry, eventBus, socketIndex).

2. **Stage Breakdown Corrected**: The bodyBlueprintFactory.createAnatomyGraph() already does blueprint resolution, part selection, AND graph construction. This workflow only handles post-processing.

3. **ANATOMY_GENERATED Event Structure Corrected**: Event includes `timestamp`, `bodyParts`, `partsMap`, `slotEntityMappings` (not `socketIndex`, `clothingInstantiated`, `clothingEntities` as originally assumed).

4. **Method Signature Corrected**: `generate(blueprintId, recipeId, options)` not `generate(entityId, blueprintId, recipeData, options)`.

5. **Actual Stages**: partsMapBuildingStage, slotEntityCreationStage, clothingInstantiationStage, eventPublicationStage (not blueprintResolution, partSelection, graphConstruction as originally assumed).

## Objective

Refactor `anatomyGenerationWorkflow.js` (649 lines, 30% over limit) by extracting the four major post-processing stages into focused modules, creating a clean orchestration pattern that improves maintainability while preserving all functionality including critical ANATOMY_GENERATED event dispatching.

## Dependencies

### Requires
- **ANASYSREF-009-03** (bodyBlueprintFactory must be complete - anatomyGenerationWorkflow uses it)

### Blocks
- **ANASYSREF-009-05** (final validation requires all refactorings complete)

## Priority

🟡 **IMPORTANT** - Third priority (649 lines, 30% over limit)

## Scope

### Files to Create

**IMPORTANT:** The anatomy graph creation (blueprint resolution, part selection, graph construction) is already done by bodyBlueprintFactory.createAnatomyGraph(). The workflow does NOT do these steps - it only orchestrates post-processing.

1. **src/anatomy/workflows/stages/partsMapBuildingStage.js** (~80 lines)
   - Build parts map from generated entities
   - Update anatomy:body component with structure
   - Body descriptor validation

2. **src/anatomy/workflows/stages/slotEntityCreationStage.js** (~150 lines)
   - Create blueprint slot entities
   - Build slot entity mappings
   - Create clothing slot metadata component

3. **src/anatomy/workflows/stages/clothingInstantiationStage.js** (~100 lines)
   - Clothing instantiation coordination (if recipe has clothing)
   - Pass partsMap and slotEntityMappings to clothing service

4. **src/anatomy/workflows/stages/eventPublicationStage.js** (~80 lines)
   - Publish ANATOMY_GENERATED event (if eventBus and socketIndex available)
   - Build event payload with all required fields

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
    ├── partsMapBuildingStage.js (~80 lines)
    ├── slotEntityCreationStage.js (~150 lines)
    ├── clothingInstantiationStage.js (~100 lines)
    └── eventPublicationStage.js (~80 lines)
```

### Current Dependencies (Actual)

The workflow currently uses these dependencies (constructor, lines 48-56):
- **entityManager** (IEntityManager) - Entity manipulation
- **dataRegistry** (IDataRegistry) - Data access (recipes, blueprints)
- **logger** (ILogger) - Logging
- **bodyBlueprintFactory** (BodyBlueprintFactory) - Graph creation (does blueprint resolution, part selection, graph construction)
- **clothingInstantiationService** (ClothingInstantiationService) - Optional, clothing instantiation
- **eventBus** (ISafeEventDispatcher) - Optional, event publishing
- **socketIndex** (AnatomySocketIndex) - Optional, socket lookup for events

**NOTE:** The workflow does NOT use partSelectionService, socketGenerator, or componentMutationService. Those are used internally by bodyBlueprintFactory.

## Implementation Steps

### Step 1: Create Stages Directory

**Commands:**
```bash
mkdir -p src/anatomy/workflows/stages
```

**Expected Outcome:** Directory created at `src/anatomy/workflows/stages/`

### Step 2: Extract partsMapBuildingStage Module

**Action:** Create `src/anatomy/workflows/stages/partsMapBuildingStage.js`

**Extract from anatomyGenerationWorkflow.js:**
- Lines 111: #buildPartsMap() method (lines 229-262)
- Lines 116-121: #updateAnatomyBodyComponent() method (lines 493-538)

**Module Interface:**
```javascript
/**
 * Builds parts map and updates anatomy:body component
 * @param {object} context - Generation context
 * @param {object} dependencies - Required services
 * @returns {object} Parts map
 */
export async function executePartsMapBuilding(context, dependencies) {
  const { graphResult, ownerId, recipeId } = context;
  const { entityManager, dataRegistry, logger } = dependencies;

  // 1. Build parts map from graphResult.entities
  // 2. Update anatomy:body component with structure and descriptors

  return {
    partsMap // Map<string, string>
  };
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow.test.js
```

**Expected Outcome:**
- Module created (~80 lines)
- No syntax errors
- Tests may fail (expected until refactoring complete)

### Step 3: Extract slotEntityCreationStage Module

**Action:** Create `src/anatomy/workflows/stages/slotEntityCreationStage.js`

**Extract from anatomyGenerationWorkflow.js:**
- Lines 127-130: #createBlueprintSlotEntities() method (lines 272-418)
- Lines 132-136: #buildSlotEntityMappings() method (lines 428-480)
- Lines 138-139: #createClothingSlotMetadata() method (lines 548-601)

**Module Interface:**
```javascript
/**
 * Creates blueprint slot entities and mappings
 * @param {object} context - Generation context
 * @param {object} dependencies - Required services
 * @returns {object} Slot entity mappings
 */
export async function executeSlotEntityCreation(context, dependencies) {
  const { blueprintId, graphResult, ownerId } = context;
  const { entityManager, dataRegistry, logger } = dependencies;

  // 1. Create blueprint slot entities (from blueprint.slots)
  // 2. Build slot entity mappings
  // 3. Create clothing slot metadata component

  return {
    slotEntityMappings // Map<string, string>
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

### Step 4: Extract eventPublicationStage Module

**Action:** Create `src/anatomy/workflows/stages/eventPublicationStage.js`

**Extract from anatomyGenerationWorkflow.js:**
- Lines 187-217: Event publication logic

**Module Interface:**
```javascript
/**
 * Publishes ANATOMY_GENERATED event if eventBus and socketIndex available
 * @param {object} context - Generation context
 * @param {object} dependencies - Required services
 * @returns {void}
 */
export async function executeEventPublication(context, dependencies) {
  const { ownerId, blueprintId, graphResult, partsMap, slotEntityMappings } = context;
  const { eventBus, socketIndex, dataRegistry, logger } = dependencies;

  // Only execute if eventBus and socketIndex are available
  if (!eventBus || !socketIndex) {
    return;
  }

  // 1. Get sockets from socketIndex
  // 2. Build event payload with all required fields
  // 3. Dispatch ANATOMY_GENERATED event

  // Event payload: { entityId, blueprintId, sockets, timestamp, bodyParts, partsMap, slotEntityMappings }
}
```

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow.events.test.js
```

**Expected Outcome:**
- Module created (~80 lines)
- No syntax errors

### Step 5: Extract clothingInstantiationStage Module

**Action:** Create `src/anatomy/workflows/stages/clothingInstantiationStage.js`

**Extract from anatomyGenerationWorkflow.js:**
- Lines 142-173: Clothing instantiation logic

**Module Interface:**
```javascript
/**
 * Instantiates clothing if configured in recipe
 * @param {object} context - Generation context
 * @param {object} dependencies - Required services
 * @returns {object|undefined} Clothing instantiation results or undefined
 */
export async function executeClothingInstantiation(context, dependencies) {
  const { ownerId, recipeId, partsMap, slotEntityMappings } = context;
  const { clothingInstantiationService, dataRegistry, logger } = dependencies;

  // Only execute if clothingInstantiationService is available
  if (!clothingInstantiationService) {
    return undefined;
  }

  // 1. Get recipe from dataRegistry
  // 2. Check if recipe has clothingEntities
  // 3. Call clothingInstantiationService.instantiateRecipeClothing()
  // 4. Return clothingResult (contains instantiated array)

  return clothingResult; // { instantiated: [...], ... } or undefined
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
import { executePartsMapBuilding } from './stages/partsMapBuildingStage.js';
import { executeSlotEntityCreation } from './stages/slotEntityCreationStage.js';
import { executeClothingInstantiation } from './stages/clothingInstantiationStage.js';
import { executeEventPublication } from './stages/eventPublicationStage.js';
```

2. **Refactor generate() method:**
```javascript
async generate(blueprintId, recipeId, options) {
  const { ownerId } = options;

  this.#logger.debug(
    `AnatomyGenerationWorkflow: Starting generate() for entity '${ownerId}' using blueprint '${blueprintId}' and recipe '${recipeId}'`
  );

  // Step 1: Generate the anatomy graph (blueprint resolution, part selection, graph construction)
  // This is done by bodyBlueprintFactory - NOT by this workflow
  const graphResult = await this.#bodyBlueprintFactory.createAnatomyGraph(
    blueprintId,
    recipeId,
    { ownerId }
  );

  this.#logger.debug(
    `AnatomyGenerationWorkflow: Generated ${graphResult.entities.length} anatomy parts for entity '${ownerId}'`
  );

  // Step 2: Build parts map and update anatomy:body component
  const { partsMap } = await executePartsMapBuilding(
    { graphResult, ownerId, recipeId },
    this.#getDependencies()
  );

  graphResult.partsMap = partsMap;

  // Step 3: Create blueprint slot entities and mappings
  const { slotEntityMappings } = await executeSlotEntityCreation(
    { blueprintId, graphResult, ownerId },
    this.#getDependencies()
  );

  // Step 4: Instantiate clothing (optional)
  const clothingResult = await executeClothingInstantiation(
    { ownerId, recipeId, partsMap, slotEntityMappings },
    this.#getDependencies()
  );

  // Step 5: Publish ANATOMY_GENERATED event (optional)
  await executeEventPublication(
    { ownerId, blueprintId, graphResult, partsMap, slotEntityMappings },
    this.#getDependencies()
  );

  // Build result
  const result = {
    rootId: graphResult.rootId,
    entities: graphResult.entities,
    partsMap,
    slotEntityMappings,
  };

  if (clothingResult) {
    result.clothingResult = clothingResult;
  }

  return result;
}

#getDependencies() {
  return {
    entityManager: this.#entityManager,
    dataRegistry: this.#dataRegistry,
    bodyBlueprintFactory: this.#bodyBlueprintFactory,
    clothingInstantiationService: this.#clothingInstantiationService,
    eventBus: this.#eventBus,
    socketIndex: this.#socketIndex,
    logger: this.#logger
  };
}
```

3. **Remove extracted private methods:**
   - Delete #buildPartsMap()
   - Delete #updateAnatomyBodyComponent()
   - Delete #createBlueprintSlotEntities()
   - Delete #buildSlotEntityMappings()
   - Delete #createClothingSlotMetadata()
   - Keep validateBodyDescriptors() and validateRecipe() (public methods)

**Testing:**
```bash
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow
```

**Expected Outcome:**
- File reduced to <250 lines (much smaller than expected!)
- Tests should pass
- No functional changes (behavior identical)

### Step 7: Verify ANATOMY_GENERATED Event

**Critical:** Ensure ANATOMY_GENERATED event still dispatches correctly

**Test:**
```bash
npm run test:unit -- tests/unit/anatomy/workflows/anatomyGenerationWorkflow.events.test.js
```

**Verify Event Payload Includes (Actual Structure):**
- `entityId` - The owner entity ID
- `blueprintId` - The blueprint ID
- `sockets` - Array of socket objects (from socketIndex.getEntitySockets())
- `timestamp` - Date.now() timestamp
- `bodyParts` - Array of entity IDs (graphResult.entities)
- `partsMap` - Plain object (converted from Map)
- `slotEntityMappings` - Plain object (converted from Map)

**Event Dispatch Pattern:**
```javascript
this.#eventBus.dispatch('ANATOMY_GENERATED', {
  // event type is first parameter, not in payload
  entityId: ownerId,
  blueprintId: blueprintId,
  sockets: sockets,
  timestamp: Date.now(),
  bodyParts: graphResult.entities,
  partsMap: Object.fromEntries(partsMap),
  slotEntityMappings: Object.fromEntries(slotEntityMappings),
})
```

**Expected Outcome:**
- Event test passes
- Event payload structure unchanged
- Event only dispatches if both eventBus AND socketIndex are available

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
- anatomyGenerationWorkflow.js: <250 lines (reduced from 649)
- partsMapBuildingStage.js: ~80 lines
- slotEntityCreationStage.js: ~150 lines
- clothingInstantiationStage.js: ~100 lines
- eventPublicationStage.js: ~80 lines
- Total: ~660 lines distributed across 5 files (vs 649 in single file)

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

- [ ] Directory structure created (src/anatomy/workflows/stages/)
- [ ] partsMapBuildingStage.js created (~80 lines)
- [ ] slotEntityCreationStage.js created (~150 lines)
- [ ] clothingInstantiationStage.js created (~100 lines)
- [ ] eventPublicationStage.js created (~80 lines)
- [ ] anatomyGenerationWorkflow.js refactored (<250 lines)
- [ ] All anatomyGenerationWorkflow unit tests pass
- [ ] Event tests pass (ANATOMY_GENERATED with correct payload structure)
- [ ] Integration tests pass (all anatomy generation scenarios)
- [ ] ESLint passes on all modified files
- [ ] No breaking changes to public API
- [ ] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [ ] ANATOMY_GENERATED event dispatches correctly (only if eventBus and socketIndex available)
- [ ] Event payload includes: entityId, blueprintId, sockets, timestamp, bodyParts, partsMap, slotEntityMappings
- [ ] Clothing integration works (when recipe has clothingEntities)

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
- [ ] anatomyGenerationWorkflow.js refactored (<250 lines)
- [ ] All anatomyGenerationWorkflow unit tests pass without modification
- [ ] Event tests pass (ANATOMY_GENERATED dispatch with correct payload)
- [ ] ESLint passes on all modified files (zero warnings)
- [ ] TypeScript type checking passes
- [ ] All integration tests pass (anatomy generation scenarios)
- [ ] ANATOMY_GENERATED event dispatches with correct payload structure
- [ ] Event only dispatches when both eventBus AND socketIndex are available
- [ ] Clothing integration works (when recipe has clothingEntities)
- [ ] Code coverage maintained at 80%+ branches, 90%+ functions/lines
- [ ] No breaking changes to public API (generate signature unchanged)
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
// Event dispatch: eventBus.dispatch('ANATOMY_GENERATED', payload)
// Event type is first parameter, NOT in payload!
{
  entityId: string,              // Owner entity ID
  blueprintId: string,           // Blueprint ID
  sockets: Array<object>,        // Socket objects from socketIndex
  timestamp: number,             // Date.now() timestamp
  bodyParts: Array<string>,      // All entity IDs (graphResult.entities)
  partsMap: object,              // Plain object (converted from Map)
  slotEntityMappings: object,    // Plain object (converted from Map)
}
```

**Stage Execution Order (MUST PRESERVE):**
1. bodyBlueprintFactory.createAnatomyGraph() → produces entire graph (blueprint resolution, part selection, graph construction all done here!)
2. Parts Map Building → builds partsMap, updates anatomy:body component
3. Slot Entity Creation → creates slot entities, builds slot mappings, creates clothing slot metadata
4. Clothing Instantiation (optional) → instantiates clothing if recipe has clothingEntities
5. Event Publication (optional) → publishes ANATOMY_GENERATED event if eventBus and socketIndex available

**File Size Verification:**
After completion, verify all files ≤500 lines:
```bash
wc -l src/anatomy/workflows/anatomyGenerationWorkflow.js
wc -l src/anatomy/workflows/stages/*.js
```

**Expected:**
- anatomyGenerationWorkflow.js: <250 lines (down from 649)
- partsMapBuildingStage.js: ~80 lines
- slotEntityCreationStage.js: ~150 lines
- clothingInstantiationStage.js: ~100 lines
- eventPublicationStage.js: ~80 lines
- Total: ~660 lines (well distributed across 5 files)

**Next Steps:**
After completion, proceed to **ANASYSREF-009-05** for final validation and documentation.
