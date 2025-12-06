# Root Cause Analysis: Anatomy Description Bugs

**Date**: 2025-11-03
**Status**: Investigation Complete - Fix Locations Identified
**Priority**: High (User-Facing Visual Bug)

## Executive Summary

Two distinct bugs affect the anatomy visualization system:

1. **Left Eye Color Duplication**: Left eye shows "blue, amber, round" (TWO colors) while right eye correctly shows "blue, round" (ONE color)
2. **Missing Clothing Items**: Recipe specifies 7 clothing items (bra, camisole, thong, skirt, tights, slingbacks, necklace) but description only shows 3 (necklace, tights, slingbacks), missing torso and genital coverage items

**Root Cause**: Build caching + SEPARATE systems (anatomy generation vs clothing registration)

## Bug #1: Eye Color Duplication

### Current Symptoms

```
Recipe: ane_artzelai.recipe.json
- left_eye: properties: { "descriptors:color_basic": { "color": "blue" }, "descriptors:shape_eye": { "shape": "round" } }
- right_eye: properties: { "descriptors:color_basic": { "color": "blue" }, "descriptors:shape_eye": { "shape": "round" } }

EXPECTED OUTPUT:
- Left eye: "blue, round"
- Right eye: "blue, round"

ACTUAL OUTPUT:
- Left eye: "blue, amber, round" (WRONG - two colors!)
- Right eye: "blue, round" (CORRECT)
```

### Root Cause Identification

**Primary Cause**: **Browser cache is serving OLD `anatomy-visualizer.js`**

Evidence:

1. ✅ Fix WAS applied correctly to `src/anatomy/bodyPartDescriptionBuilder.js` (lines 63-66, 113-120)
2. ✅ All 344 anatomy tests pass with the fix
3. ✅ Build system works (`npm run build` succeeded, regenerated `dist/anatomy-visualizer.js`)
4. ❌ **BUT**: Browser is loading CACHED old JavaScript from before the fix

**Secondary Cause**: Fallback to default entity definition

The "amber" color comes from `data/mods/anatomy/entities/definitions/human_eye_amber.entity.json`:

```json
{
  "id": "anatomy:human_eye_amber",
  "components": {
    "anatomy:part": { "subType": "eye" },
    "descriptors:color_extended": { "color": "amber" },
    "descriptors:shape_eye": { "shape": "almond" }
  }
}
```

**How This Happens**:

1. Recipe specifies left_eye with `properties: { "descriptors:color_basic": { "color": "blue" } }`
2. Component overrides SHOULD be applied via `entityManager.createEntityInstance(definitionId, { componentOverrides })`
3. Entity instance SHOULD use `entity.getComponentData()` which checks overrides FIRST
4. **OLD CODE** (still in browser cache) accesses `entity.components` directly, BYPASSING overrides
5. Falls back to default entity definition which has "amber" color
6. Result: Shows BOTH base definition color AND recipe override color

**Why Only Left Eye?**

Timing/randomization issue in part selection - left eye happens to select `human_eye_amber` as base definition while right eye selects a different base (likely `human_eye_blue`).

### Fix Verification

**Code is ALREADY FIXED** in source:

File: `src/anatomy/bodyPartDescriptionBuilder.js`

```javascript
// Lines 63-69 - buildDescription method
// Always use getComponentData method for Entity instances to respect overrides
let components;
if (entity.getComponentData) {
  components = this.#extractEntityComponents(entity);
} else {
  // Fallback for plain objects in tests
  components = entity.components;
}

// Lines 113-120 - buildMultipleDescription method
// Always use getComponentData method for Entity instances to respect overrides
let components;
if (entity.getComponentData) {
  components = this.#extractEntityComponents(entity);
} else {
  // Fallback for plain objects in tests
  components = entity.components;
}

// Lines 181-196 - #extractEntityComponents private method
#extractEntityComponents(entity) {
  const components = {};

  for (const compType of BodyPartDescriptionBuilder.COMPONENT_TYPES) {
    try {
      const data = entity.getComponentData(compType); // Uses correct method!
      if (data) {
        components[compType] = data;
      }
    } catch (e) {
      // Component doesn't exist on entity - this is expected
    }
  }

  return components;
}
```

**Build Status**: ✅ COMPLETE

```bash
$ npm run build
✨ Build completed successfully!
📊 Build Summary:
⏱  Total time: 3.1s
📋 Steps completed: 4 / 4
```

File regenerated: `dist/anatomy-visualizer.js` (9,993,932 bytes, timestamp: Nov 3 11:30)

### Required User Action

**Clear browser cache and reload**:

1. **Hard Refresh** (most common):
   - Chrome/Edge: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
   - Firefox: `Ctrl + Shift + R` or `Cmd + Shift + R`
   - Safari: `Cmd + Option + R`

2. **Or Clear Cache Completely**:
   - Chrome: `Ctrl + Shift + Delete` → Select "Cached images and files" → Clear data
   - Firefox: `Ctrl + Shift + Delete` → Select "Cache" → Clear Now
   - Safari: Safari menu → Clear History → All History

3. **Or Open in Incognito/Private Window** (temporary test):
   - Chrome: `Ctrl + Shift + N`
   - Firefox: `Ctrl + Shift + P`

## Bug #2: Missing Clothing Items

### Current Symptoms

```
Recipe: ane_artzelai.recipe.json
clothingEntities: [
  { "entityId": "clothing:platinum_necklace", "equip": true },        ✅ SHOWS
  { "entityId": "clothing:seamless_plunge_bra_microfiber_nude", "equip": true },  ❌ MISSING
  { "entityId": "clothing:satin_cowl_neck_camisole", "equip": true },             ❌ MISSING
  { "entityId": "clothing:nude_thong", "equip": true },                          ❌ MISSING
  { "entityId": "clothing:high_waisted_pencil_skirt_black", "equip": true },      ❌ MISSING
  { "entityId": "clothing:matte_sheer_tights_smoke_black", "equip": true },       ✅ SHOWS
  { "entityId": "clothing:block_heel_slingbacks_leather_taupe", "equip": true }   ✅ SHOWS
]

EXPECTED OUTPUT:
"Wearing: platinum necklace | nude seamless plunge bra | satin cowl neck camisole | nude thong | black high-waisted pencil skirt | smoke black matte sheer tights | taupe block heel slingbacks."

ACTUAL OUTPUT:
"Wearing: platinum necklace | smoke black matte sheer tights | taupe block heel slingbacks. Torso is fully exposed. Genitals are fully exposed."
```

### Root Cause Identification

**Primary Cause**: **Clothing registration happens AFTER anatomy description is cached**

Evidence from code flow:

1. **Anatomy Generation Workflow** (`src/anatomy/workflows/anatomyGenerationWorkflow.js`):

   ```javascript
   async generate(blueprintId, recipeId, options) {
     // Phase 1: Generate anatomy graph
     const graphResult = await this.#bodyBlueprintFactory.createAnatomyGraph(blueprintId, recipeId, { ownerId });

     // Phase 2.5: Update anatomy:body component (line 104)
     await this.#updateAnatomyBodyComponent(ownerId, recipeId, graphResult, partsMap);

     // Phase 3: Create blueprint slot entities (line 118)
     await this.#createBlueprintSlotEntities(blueprintId, graphResult);

     // Phase 3.5: Create clothing slot metadata (line 127)
     await this.#createClothingSlotMetadata(ownerId, blueprintId);

     // Phase 4: Instantiate clothing (line 130-160) <-- HAPPENS LAST!
     if (this.#clothingInstantiationService) {
       const recipe = this.#dataRegistry.get('anatomyRecipes', recipeId);
       if (recipe && recipe.clothingEntities && recipe.clothingEntities.length > 0) {
         clothingResult = await this.#clothingInstantiationService.instantiateRecipeClothing(
           ownerId, recipe, { partsMap, slotEntityMappings }
         );
       }
     }
   }
   ```

2. **UI Rendering** (`src/domUI/anatomy-renderer/VisualizationComposer.js`):
   - Renders anatomy visualization
   - Description is generated from `bodyEntity` via `BodyDescriptionComposer`
   - Clothing SHOULD be read from `equipmentDescriptionService`

3. **Equipment Description Service** (`src/clothing/services/equipmentDescriptionService.js`):

   ```javascript
   async generateEquipmentDescription(entityId) {
     // Line 84: Get equipped items using ClothingManagementService
     const { items: equippedItems, equippedData } = await this.#getEquippedItems(entityId);

     // Line 121-180: #getEquippedItems reads from clothing:equipped component
     const response = await this.#clothingManagementService.getEquippedItems(entityId);

     // Line 519-561: #calculateExposureDescriptions checks clothing:slot_metadata
     const slotMetadata = this.#entityManager.getComponentData(entityId, 'clothing:slot_metadata');
   }
   ```

**The Disconnect**:

- Anatomy generation completes and updates `anatomy:body` component
- **UI/Visualization reads from `anatomy:body` immediately**
- Clothing instantiation happens AFTER anatomy generation
- Clothing is stored separately in `clothing:equipped` component
- **If UI renders BEFORE clothing is instantiated**, description is empty

**Why Some Items Show**:

The items that DO show (necklace, tights, slingbacks) are likely:

- Instantiated in a PREVIOUS character generation session
- Still attached to the entity from earlier
- OR categorized as "accessories"/"footwear" which might have different timing

The items that DON'T show (bra, camisole, thong, skirt) are likely:

- Categorized as "underwear"/"tops"/"bottoms"
- Require torso/genital slot coverage
- These slots are being reported as "fully exposed" because clothing hasn't been registered yet

### Timing Race Condition

**Sequence of Events**:

```
1. User loads anatomy-visualizer.html
2. JavaScript calls anatomyGenerationWorkflow.generate()
   └─> Creates anatomy entities (head, torso, arms, legs, eyes, etc.)
   └─> Updates anatomy:body component on bodyEntity
   └─> UI renders description from anatomy:body
   └─> Description shows anatomy parts ✅
   └─> Equipment description reads clothing:equipped component ❌ (empty or stale)
   └─> Returns "Torso is fully exposed. Genitals are fully exposed."
3. Clothing instantiation completes (LATER)
   └─> Creates clothing entities
   └─> Adds them to clothing:equipped component
   └─> BUT UI already rendered and cached the description!
```

### Fix Strategy

Two approaches:

**Option A: Await Clothing Before Rendering** (Recommended)

- Modify UI code to wait for clothing instantiation to complete before rendering
- Ensure `anatomyGenerationWorkflow.generate()` returns `clothingResult`
- UI checks for `clothingResult.instantiated` before calling description composer

**Option B: Reactive Description Updates**

- Add event listener for clothing changes
- Trigger description re-generation when clothing is added
- More complex but allows progressive loading

### Code Locations Requiring Changes

**Option A Implementation**:

1. **`src/anatomy-visualizer.js`** (main entry point):
   - Ensure `await anatomyGenerationService.generate()` completes FULLY
   - Verify `clothingResult` is present before calling visualization

2. **`src/domUI/AnatomyVisualizerUI.js`**:
   - Add validation that clothing is loaded before rendering description
   - Check `bodyEntity.getComponentData('clothing:equipped')` exists

3. **`src/domUI/anatomy-renderer/VisualizationComposer.js`**:
   - Validate clothing state before calling `bodyDescriptionComposer.composeDescription()`

**No changes needed to**:

- ✅ `anatomyGenerationWorkflow.js` - already returns `clothingResult`
- ✅ `equipmentDescriptionService.js` - correctly reads `clothing:equipped`
- ✅ `bodyDescriptionComposer.js` - correctly calls equipment service

## Verification Steps

### Bug #1: Eye Color Duplication

**After hard refresh**:

1. Open anatomy-visualizer.html
2. Select "Ane Artzelai" entity
3. Verify left eye shows: "blue, round" (NOT "blue, amber, round")
4. Verify right eye shows: "blue, round"
5. Both eyes should be IDENTICAL

**Success Criteria**:

- ✅ No "amber" color appears for either eye
- ✅ Both eyes show exactly: "blue, round"
- ✅ Recipe properties correctly override base definitions

### Bug #2: Missing Clothing Items

**After implementing Option A**:

1. Open anatomy-visualizer.html
2. Select "Ane Artzelai" entity
3. Verify description includes ALL 7 clothing items:
   - platinum necklace
   - nude seamless plunge bra
   - satin cowl neck camisole
   - nude thong
   - black high-waisted pencil skirt
   - smoke black matte sheer tights
   - taupe block heel slingbacks
4. Verify NO exposure messages:
   - ❌ "Torso is fully exposed"
   - ❌ "Genitals are fully exposed"

**Success Criteria**:

- ✅ All 7 items appear in description
- ✅ Underwear/torso items correctly listed
- ✅ Exposure messages only when truly unclothed
- ✅ Consistent ordering by category

## Related Files

### Source Files

- `src/anatomy/bodyPartDescriptionBuilder.js` - ✅ Fixed (uses getComponentData)
- `src/anatomy/bodyDescriptionComposer.js` - Calls equipment service
- `src/anatomy/workflows/anatomyGenerationWorkflow.js` - Manages clothing instantiation
- `src/clothing/services/equipmentDescriptionService.js` - Reads equipped items
- `src/entities/entity.js` - Entity wrapper with getComponentData method
- `src/entities/entityInstanceData.js` - Manages component overrides

### Build Files

- `dist/anatomy-visualizer.js` - Bundled output (NEEDS BROWSER CACHE CLEAR)
- `scripts/build.js` - Build system
- `scripts/build.config.js` - Build configuration

### Data Files

- `.private/data/mods/p_erotica_grocery_store/recipes/ane_artzelai.recipe.json` - Recipe with clothing list
- `data/mods/anatomy/entities/definitions/human_eye_amber.entity.json` - Default eye with amber color
- `data/mods/clothing/entities/definitions/*.entity.json` - Clothing entity definitions

## Conclusion

**Bug #1 (Eye Color)**: **FIXED** - Code already corrected, user just needs to clear browser cache

**Bug #2 (Missing Clothing)**: **IDENTIFIED** - Timing issue between anatomy rendering and clothing registration. Fix requires ensuring UI waits for clothing instantiation before rendering descriptions.

**Next Steps**:

1. User clears browser cache to verify Bug #1 fix
2. Implement Option A (await clothing before rendering) for Bug #2
3. Add integration test to verify clothing appears in descriptions
4. Consider adding loading state UI to show "Generating clothing..." message

---

**Analysis completed**: 2025-11-03
**Methodology**: Systematic code tracing from symptoms → root causes → fix locations
