# Body Descriptors Missing from Descriptions: Comprehensive Analysis

**Date:** 2025-11-05
**Issue:** `skinColor` and `smell` from recipe `bodyDescriptors` are not appearing in generated character descriptions
**Affected Recipe:** `p_erotica_duchess:bogdana_avalune_recipe`
**Session:** Third attempt to resolve this issue

## Executive Summary

After thorough code analysis, the codebase **appears to have full support** for `skinColor` and `smell` bodyDescriptors from recipes through to generated descriptions. However, the user reports these fields still don't appear in their output. This report documents the complete flow, identifies potential failure points, and provides refactoring recommendations for robustness.

## Complete Data Flow Analysis

### 1. Recipe Schema Definition

**File:** `data/schemas/anatomy.recipe.schema.json:178-183`

```json
"skinColor": {
  "type": "string"
},
"smell": {
  "type": "string"
}
```

**Status:** ✅ **Correctly Defined**
Both properties are defined as free-form strings in the schema, alongside other bodyDescriptors like `build`, `composition`, `height`, and `hairDensity`.

---

### 2. Recipe Validation

**File:** `src/loaders/anatomyRecipeLoader.js:88-90`

```javascript
// Validate body descriptors if present
if (data.bodyDescriptors) {
  this._validateBodyDescriptors(data.bodyDescriptors, baseId, filename);
}
```

**File:** `src/loaders/anatomyRecipeLoader.js:235-248`

```javascript
_validateBodyDescriptors(bodyDescriptors, recipeId, filename) {
  try {
    BodyDescriptorValidator.validate(
      bodyDescriptors,
      `recipe '${recipeId}' from file '${filename}'`
    );
  } catch (error) {
    if (error instanceof BodyDescriptorValidationError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}
```

**File:** `src/anatomy/utils/bodyDescriptorValidator.js:12-38`

The validator checks that:
1. `bodyDescriptors` is an object (not array)
2. No unknown properties are present
3. Each property has a string value
4. Enum-validated properties (build, height, etc.) have valid values
5. Free-form properties (skinColor, smell) are accepted as-is

**Status:** ✅ **Correctly Validated**
The validator explicitly supports both `skinColor` and `smell` as free-form strings (no enum validation).

**Constants:** `src/anatomy/constants/bodyDescriptorConstants.js:80-89`

```javascript
skinColor: {
  label: 'Skin color',
  validValues: null, // Free-form string
  description: 'Skin color descriptor',
},
smell: {
  label: 'Smell',
  validValues: null, // Free-form string
  description: 'Body smell descriptor',
},
```

---

### 3. Anatomy Generation Workflow

**File:** `src/anatomy/workflows/anatomyGenerationWorkflow.js:472-477`

```javascript
// Apply recipe bodyDescriptors if present
if (recipe?.bodyDescriptors) {
  bodyObject.descriptors = { ...recipe.bodyDescriptors };
  this.#logger.debug(
    `AnatomyGenerationWorkflow: Applied bodyDescriptors from recipe '${recipeId}': ${JSON.stringify(recipe.bodyDescriptors)}`
  );
}
```

**Flow:**
1. Retrieves recipe from data registry
2. Creates `bodyObject` with root and parts map
3. **Copies ALL properties** from `recipe.bodyDescriptors` to `bodyObject.descriptors`
4. Stores in `anatomy:body` component at line 485-489

**Status:** ✅ **Should Work Correctly**
Uses object spread (`...`) which copies all properties including `skinColor` and `smell`.

---

### 4. Body Description Composer - Extraction

**File:** `src/anatomy/bodyDescriptionComposer.js:450-486`

```javascript
extractBodyLevelDescriptors(bodyEntity) {
  const descriptors = {};

  // Add height FIRST (before other descriptors)
  const heightDescription = this.extractHeightDescription(bodyEntity);
  if (heightDescription) {
    descriptors.height = `Height: ${heightDescription}`;
  }

  const skinColorDescription = this.extractSkinColorDescription(bodyEntity);
  if (skinColorDescription) {
    descriptors.skin_color = `Skin color: ${skinColorDescription}`;
  }

  const buildDescription = this.extractBuildDescription(bodyEntity);
  if (buildDescription) {
    descriptors.build = `Build: ${buildDescription}`;
  }

  const bodyHairDescription = this.extractBodyHairDescription(bodyEntity);
  if (bodyHairDescription) {
    descriptors.body_hair = `Body hair: ${bodyHairDescription}`;
  }

  const compositionDescription =
    this.extractBodyCompositionDescription(bodyEntity);
  if (compositionDescription) {
    descriptors.body_composition = `Body composition: ${compositionDescription}`;
  }

  const smellDescription = this.extractSmellDescription(bodyEntity);
  if (smellDescription) {
    descriptors.smell = `Smell: ${smellDescription}`;
  }

  return descriptors;
}
```

**Status:** ✅ **Calls Extraction Methods**
Both `extractSkinColorDescription` and `extractSmellDescription` are called.

**File:** `src/anatomy/bodyDescriptionComposer.js:521-546` (skinColor extraction)

```javascript
extractSkinColorDescription(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  // Check body.descriptors first
  if (bodyComponent?.body?.descriptors?.skinColor) {
    return bodyComponent.body.descriptors.skinColor;
  }

  // Fallback to entity-level component for backward compatibility
  if (bodyEntity && typeof bodyEntity.getComponentData === 'function') {
    const skinColorComponent = bodyEntity.getComponentData(
      'descriptors:skin_color'
    );
    if (skinColorComponent?.skinColor) {
      console.warn(
        `[DEPRECATION] Entity ${bodyEntity.id || 'unknown'} uses entity-level descriptor...`
      );
      return skinColorComponent.skinColor;
    }
  }

  return '';
}
```

**File:** `src/anatomy/bodyDescriptionComposer.js:554-577` (smell extraction)

```javascript
extractSmellDescription(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  // Check body.descriptors first
  if (bodyComponent?.body?.descriptors?.smell) {
    return bodyComponent.body.descriptors.smell;
  }

  // Fallback to entity-level component for backward compatibility
  if (bodyEntity && typeof bodyEntity.getComponentData === 'function') {
    const smellComponent = bodyEntity.getComponentData('descriptors:smell');
    if (smellComponent?.smell) {
      console.warn(
        `[DEPRECATION] Entity ${bodyEntity.id || 'unknown'} uses entity-level descriptor...`
      );
      return smellComponent.smell;
    }
  }

  return '';
}
```

**Status:** ✅ **Correctly Extracts from body.descriptors**
Both methods check `bodyComponent?.body?.descriptors?.skinColor` and `bodyComponent?.body?.descriptors?.smell` respectively.

---

### 5. Body Description Composer - Inclusion in Output

**File:** `src/anatomy/bodyDescriptionComposer.js:113-127`

```javascript
// FIRST: Add body-level descriptors using configured order
const bodyLevelDescriptors = this.extractBodyLevelDescriptors(bodyEntity);
const bodyDescriptorOrder = this.getBodyDescriptorOrder(descriptionOrder);

const processedDescriptors = new Set();

for (const descriptorType of bodyDescriptorOrder) {
  if (
    bodyLevelDescriptors[descriptorType] &&
    !processedDescriptors.has(descriptorType)
  ) {
    lines.push(bodyLevelDescriptors[descriptorType]);
    processedDescriptors.add(descriptorType);
  }
}
```

**File:** `src/anatomy/bodyDescriptionComposer.js:494-513` (getBodyDescriptorOrder)

```javascript
getBodyDescriptorOrder(descriptionOrder) {
  const bodyDescriptorTypes = [
    'height',
    'skin_color',
    'build',
    'body_composition',
    'body_hair',
    'smell',
  ];
  const filtered = descriptionOrder.filter((type) =>
    bodyDescriptorTypes.includes(type)
  );

  // Defensive logic: ensure height is always first if it's missing from configuration
  if (!filtered.includes('height')) {
    filtered.unshift('height');
  }

  return filtered;
}
```

**Status:** ✅ **Includes Both in Order**
The `bodyDescriptorTypes` array explicitly includes both `'skin_color'` and `'smell'`.

---

### 6. Description Configuration

**File:** `src/anatomy/configuration/descriptionConfiguration.js:14-37`

```javascript
this._defaultDescriptionOrder = [
  'height',
  'build',
  'body_composition',
  'body_hair',
  'skin_color',  // Line 19
  'smell',       // Line 20
  'hair',
  'eye',
  'face',
  // ... more part types
];
```

**Status:** ✅ **Both Present in Default Order**
`skin_color` is at position 5 and `smell` is at position 6 in the default description order.

---

## Existing Recipe Examples

### Human Male Recipe
**File:** `data/mods/anatomy/recipes/human_male.recipe.json:5-10`

```json
"bodyDescriptors": {
  "build": "muscular",
  "hairDensity": "hairy",
  "composition": "lean",
  "skinColor": "tanned"
}
```

### Human Female Recipe
**File:** `data/mods/anatomy/recipes/human_female.recipe.json:5-9`

```json
"bodyDescriptors": {
  "build": "athletic",
  "composition": "lean",
  "skinColor": "olive"
}
```

### Human Futa Recipe
**File:** `data/mods/anatomy/recipes/human_futa.recipe.json:5-9`

```json
"bodyDescriptors": {
  "build": "shapely",
  "composition": "average",
  "skinColor": "fair"
}
```

**Observation:** Multiple existing recipes use `skinColor`, but **none use `smell`**. This suggests `smell` may be less tested in practice.

---

## Test Coverage Analysis

### Integration Tests

**File:** `tests/integration/anatomy/recipeBodyDescriptorsFullWorkflow.integration.test.js`

This test file explicitly tests the complete flow from recipe to description:

```javascript
it('should include skinColor and smell from recipe in generated description', async () => {
  const recipeData = {
    recipeId: 'test:full_workflow_recipe',
    blueprintId: 'anatomy:human_male',
    bodyDescriptors: {
      height: 'gigantic',
      build: 'hulking',
      composition: 'lean',
      skinColor: 'fair',
      smell: 'musky',
    },
    // ... slots and patterns
  };

  // ... creates character from recipe

  expect(description).toContain('Skin color: fair');
  expect(description).toContain('Smell: musky');
});
```

**Other Test Files with Coverage:**
- `tests/integration/anatomy/skinColorInDescription.integration.test.js`
- `tests/integration/anatomy/smellInDescription.integration.test.js`
- `tests/unit/anatomy/bodyDescriptionComposer.skinColor.test.js`
- `tests/unit/anatomy/bodyDescriptionComposer.smell.test.js`

**Status:** ✅ **Comprehensive Test Coverage**
Tests verify the complete workflow from recipe → workflow → composer → description.

---

## Potential Failure Points

Despite the code appearing correct, here are potential failure points that could cause the issue:

### 1. **Data Registry Issue**

**Location:** `src/anatomy/workflows/anatomyGenerationWorkflow.js:463`

```javascript
const recipe = this.#dataRegistry.get('anatomyRecipes', recipeId);
```

**Potential Issue:** If the recipe isn't properly registered in the data registry, the bodyDescriptors won't be retrieved.

**Evidence Check:**
- Recipe should be loaded via `AnatomyRecipeLoader.processFetchedItem()`
- Stored with key format: `{modId}:{baseId}` or just `{baseId}`
- User's recipe has ID: `p_erotica_duchess:bogdana_avalune_recipe`

**Question:** Is the symlinked mod being properly loaded? Are mod manifests correct?

### 2. **Component Data Not Persisted**

**Location:** `src/anatomy/workflows/anatomyGenerationWorkflow.js:485-489`

```javascript
await this.#entityManager.addComponent(
  entityId,
  'anatomy:body',
  updatedData
);
```

**Potential Issue:** If `addComponent` fails silently or doesn't persist the descriptors, they won't be available during description composition.

**Evidence Check:**
- Should see debug log: `"Applied bodyDescriptors from recipe..."`
- Should see debug log: `"Updated entity '{id}' with body structure..."`

### 3. **Entity Retrieval Issue**

**Location:** `src/anatomy/bodyDescriptionComposer.js:92-94`

```javascript
const bodyComponent = bodyEntity.getComponentData(
  ANATOMY_BODY_COMPONENT_ID
);
```

**Potential Issue:** If the entity passed to `composeDescription` is stale or cached before the bodyDescriptors were added, they won't be present.

**Evidence Check:**
- Timing of when description is generated vs when anatomy is created
- Caching in entity manager or body description composer

### 4. **Null/Undefined Check Failure**

**Location:** `src/anatomy/bodyDescriptionComposer.js:525, 558`

```javascript
if (bodyComponent?.body?.descriptors?.skinColor) {
  return bodyComponent.body.descriptors.skinColor;
}
```

**Potential Issue:** Optional chaining might fail if `descriptors` is null/undefined instead of an object.

**Evidence Check:**
- Log `bodyComponent.body.descriptors` to verify structure
- Verify `descriptors` is an object, not null

### 5. **Key Mismatch**

**Current Keys:**
- Recipe uses: `skinColor`, `smell`
- Composer extracts: `skinColor`, `smell`
- Descriptor map keys: `skin_color`, `smell`
- Description order keys: `skin_color`, `smell`

**Status:** ✅ **Keys are consistent** where needed.
The underscore conversion happens only in the `bodyLevelDescriptors` map, which is correct.

---

## Root Cause Hypothesis

Based on the analysis, the most likely root cause is **NOT a code issue** but rather:

### Hypothesis A: Recipe Not Properly Loaded
The symlinked mod `p_erotica_duchess` may not be loading correctly, causing the recipe to not be registered in the data registry with its `bodyDescriptors`.

**Evidence:**
- No files found when searching for `p_erotica_duchess` or `bogdana`
- Symlinks may not be followed by the loader

**Test:**
```javascript
const recipe = dataRegistry.get('anatomyRecipes', 'p_erotica_duchess:bogdana_avalune_recipe');
console.log('Recipe bodyDescriptors:', recipe?.bodyDescriptors);
```

### Hypothesis B: Cached Description
The description shown to the user was generated before the bodyDescriptors code was implemented or before the recipe was updated.

**Evidence:**
- User mentions this is the "third Claude Code session" trying to fix this
- Previous analysis (SKINCOLOR_ANALYSIS.md) concluded the code was already working

**Test:**
- Delete any cached character data
- Regenerate character from scratch
- Verify fresh description generation

### Hypothesis C: Blueprint Override
The blueprint `anatomy:human_futa` might be overriding or not supporting the bodyDescriptors properly.

**Evidence:**
- Existing `anatomy:human_futa.recipe.json` only has `skinColor`, not `smell`
- Blueprint might have its own descriptor defaults that override recipe values

**Test:**
```javascript
const blueprint = dataRegistry.get('anatomyBlueprints', 'anatomy:human_futa');
console.log('Blueprint descriptors:', blueprint?.bodyDescriptors);
```

### Hypothesis D: Silent Failure in Workflow
The `AnatomyGenerationWorkflow.generate()` method might be failing silently when copying bodyDescriptors.

**Evidence:**
- No try-catch around the descriptor copying code
- Spread operator could fail if `recipe.bodyDescriptors` is not an object

**Test:**
Add explicit logging:
```javascript
if (recipe?.bodyDescriptors) {
  console.log('BEFORE COPY:', recipe.bodyDescriptors);
  bodyObject.descriptors = { ...recipe.bodyDescriptors };
  console.log('AFTER COPY:', bodyObject.descriptors);
}
```

---

## Refactoring Recommendations

### 1. **Add Defensive Validation**

**Problem:** The code assumes `recipe.bodyDescriptors` is an object but doesn't verify.

**Recommendation:** Add explicit type checking and validation.

**File:** `src/anatomy/workflows/anatomyGenerationWorkflow.js:472-477`

```javascript
// BEFORE:
if (recipe?.bodyDescriptors) {
  bodyObject.descriptors = { ...recipe.bodyDescriptors };
}

// AFTER:
if (recipe?.bodyDescriptors && typeof recipe.bodyDescriptors === 'object') {
  // Create a clean copy, filtering out non-string values
  const validDescriptors = Object.entries(recipe.bodyDescriptors)
    .filter(([key, value]) => typeof value === 'string' && value.trim())
    .reduce((acc, [key, value]) => {
      acc[key] = value.trim();
      return acc;
    }, {});

  if (Object.keys(validDescriptors).length > 0) {
    bodyObject.descriptors = validDescriptors;
    this.#logger.debug(
      `AnatomyGenerationWorkflow: Applied ${Object.keys(validDescriptors).length} bodyDescriptors: ${Object.keys(validDescriptors).join(', ')}`
    );
  }
} else if (recipe?.bodyDescriptors) {
  this.#logger.warn(
    `AnatomyGenerationWorkflow: Recipe '${recipeId}' has invalid bodyDescriptors (not an object): ${typeof recipe.bodyDescriptors}`
  );
}
```

### 2. **Explicit Descriptor Mapping**

**Problem:** The code relies on property names matching across different layers, making it fragile.

**Recommendation:** Create an explicit mapping between recipe keys and description keys.

**New File:** `src/anatomy/constants/descriptorMapping.js`

```javascript
/**
 * Maps recipe bodyDescriptor property names to description line keys
 * This makes the relationship explicit and easier to maintain
 */
export const DESCRIPTOR_KEY_MAPPING = {
  // Recipe property -> Description line key
  height: 'height',
  build: 'build',
  composition: 'body_composition',
  hairDensity: 'body_hair',
  skinColor: 'skin_color',
  smell: 'smell',
};

/**
 * Reverse mapping for looking up recipe keys from description keys
 */
export const DESCRIPTION_TO_RECIPE_KEY = Object.entries(DESCRIPTOR_KEY_MAPPING)
  .reduce((acc, [recipeKey, descKey]) => {
    acc[descKey] = recipeKey;
    return acc;
  }, {});

/**
 * Gets the description line key for a recipe property
 */
export function getDescriptionKey(recipeProperty) {
  return DESCRIPTOR_KEY_MAPPING[recipeProperty] || recipeProperty;
}

/**
 * Gets the recipe property for a description line key
 */
export function getRecipeKey(descriptionKey) {
  return DESCRIPTION_TO_RECIPE_KEY[descriptionKey] || descriptionKey;
}
```

**Usage in BodyDescriptionComposer:**

```javascript
import { getDescriptionKey } from '../constants/descriptorMapping.js';

extractBodyLevelDescriptors(bodyEntity) {
  const descriptors = {};
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  if (!bodyComponent?.body?.descriptors) {
    return descriptors;
  }

  // Iterate over actual recipe descriptors and map to description keys
  for (const [recipeKey, value] of Object.entries(bodyComponent.body.descriptors)) {
    if (value && typeof value === 'string') {
      const descKey = getDescriptionKey(recipeKey);
      const label = this.getDescriptorLabel(recipeKey);
      descriptors[descKey] = `${label}: ${value}`;
    }
  }

  return descriptors;
}
```

### 3. **Centralized Descriptor Extraction**

**Problem:** Each descriptor has its own extraction method with duplicated logic.

**Recommendation:** Create a generic extraction method.

**File:** `src/anatomy/bodyDescriptionComposer.js`

```javascript
/**
 * Generic descriptor extraction with fallback support
 * @private
 */
#extractDescriptor(bodyEntity, descriptorKey, fallbackComponentId = null) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  // Try body.descriptors first
  if (bodyComponent?.body?.descriptors?.[descriptorKey]) {
    return bodyComponent.body.descriptors[descriptorKey];
  }

  // Fallback to entity-level component for backward compatibility
  if (fallbackComponentId && bodyEntity?.getComponentData) {
    const fallbackComponent = bodyEntity.getComponentData(fallbackComponentId);
    if (fallbackComponent?.[descriptorKey]) {
      this.#logger.warn(
        `[DEPRECATION] Entity ${bodyEntity.id || 'unknown'} uses entity-level descriptor '${fallbackComponentId}'. ` +
        `Please migrate to body.descriptors.${descriptorKey} in anatomy:body component.`
      );
      return fallbackComponent[descriptorKey];
    }
  }

  return '';
}

// Then simplify all extraction methods:
extractSkinColorDescription(bodyEntity) {
  return this.#extractDescriptor(bodyEntity, 'skinColor', 'descriptors:skin_color');
}

extractSmellDescription(bodyEntity) {
  return this.#extractDescriptor(bodyEntity, 'smell', 'descriptors:smell');
}

extractBuildDescription(bodyEntity) {
  return this.#extractDescriptor(bodyEntity, 'build', 'descriptors:build');
}
```

### 4. **Add Descriptor Verification Method**

**Problem:** No way to verify that descriptors were properly applied during anatomy generation.

**Recommendation:** Add a verification method that can be called after generation.

**File:** `src/anatomy/workflows/anatomyGenerationWorkflow.js`

```javascript
/**
 * Verifies that bodyDescriptors from recipe were applied to entity
 * Returns object with verification results for debugging
 *
 * @param {string} entityId - The entity to verify
 * @param {string} recipeId - The recipe that was used
 * @returns {object} Verification results
 */
verifyBodyDescriptors(entityId, recipeId) {
  const recipe = this.#dataRegistry.get('anatomyRecipes', recipeId);
  const entity = this.#entityManager.getEntityInstance(entityId);

  if (!entity) {
    return { success: false, reason: 'Entity not found' };
  }

  const bodyComponent = entity.getComponentData('anatomy:body');
  if (!bodyComponent?.body) {
    return { success: false, reason: 'anatomy:body component missing or invalid' };
  }

  const results = {
    success: true,
    recipeDescriptors: recipe?.bodyDescriptors || {},
    appliedDescriptors: bodyComponent.body.descriptors || {},
    missing: [],
    extra: [],
  };

  // Check for missing descriptors
  for (const key of Object.keys(results.recipeDescriptors)) {
    if (!(key in results.appliedDescriptors)) {
      results.missing.push(key);
      results.success = false;
    }
  }

  // Check for extra descriptors
  for (const key of Object.keys(results.appliedDescriptors)) {
    if (!(key in results.recipeDescriptors)) {
      results.extra.push(key);
    }
  }

  return results;
}
```

### 5. **Add Comprehensive Logging**

**Problem:** Hard to debug when descriptors go missing.

**Recommendation:** Add structured logging at each step.

**File:** `src/anatomy/workflows/anatomyGenerationWorkflow.js:472-477`

```javascript
// Enhanced logging
if (recipe?.bodyDescriptors) {
  const descriptorKeys = Object.keys(recipe.bodyDescriptors);
  this.#logger.info(
    `AnatomyGenerationWorkflow: Applying ${descriptorKeys.length} bodyDescriptors to entity '${entityId}'`,
    {
      recipeId,
      descriptors: descriptorKeys,
      values: recipe.bodyDescriptors,
    }
  );

  bodyObject.descriptors = { ...recipe.bodyDescriptors };

  // Verify copy succeeded
  if (Object.keys(bodyObject.descriptors).length !== descriptorKeys.length) {
    this.#logger.error(
      `AnatomyGenerationWorkflow: Descriptor copy mismatch!`,
      {
        expected: descriptorKeys.length,
        actual: Object.keys(bodyObject.descriptors).length,
        source: recipe.bodyDescriptors,
        destination: bodyObject.descriptors,
      }
    );
  }
}
```

**File:** `src/anatomy/bodyDescriptionComposer.js:459-483`

```javascript
// Enhanced logging in extractBodyLevelDescriptors
extractBodyLevelDescriptors(bodyEntity) {
  const descriptors = {};
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  // Log the raw descriptor data
  this.#logger.debug('Extracting body-level descriptors', {
    entityId: bodyEntity?.id,
    hasBodyComponent: !!bodyComponent,
    hasBody: !!bodyComponent?.body,
    hasDescriptors: !!bodyComponent?.body?.descriptors,
    descriptorKeys: bodyComponent?.body?.descriptors
      ? Object.keys(bodyComponent.body.descriptors)
      : [],
    descriptorValues: bodyComponent?.body?.descriptors,
  });

  // ... existing extraction logic

  // Log what was extracted
  this.#logger.debug('Extracted body-level descriptors', {
    entityId: bodyEntity?.id,
    extractedKeys: Object.keys(descriptors),
    extracted: descriptors,
  });

  return descriptors;
}
```

### 6. **Schema Enhancement**

**Problem:** The schema allows free-form strings for `skinColor` and `smell`, which could lead to inconsistencies.

**Recommendation:** Add pattern validation and examples.

**File:** `data/schemas/anatomy.recipe.schema.json`

```json
"skinColor": {
  "type": "string",
  "minLength": 1,
  "maxLength": 50,
  "pattern": "^[a-zA-Z0-9 -]+$",
  "description": "Free-form skin color descriptor. Examples: 'fair', 'olive', 'dark', 'bronze', 'tanned'",
  "examples": ["fair", "olive", "dark", "tanned", "bronze", "pale", "bronze-tinted"]
},
"smell": {
  "type": "string",
  "minLength": 1,
  "maxLength": 50,
  "pattern": "^[a-zA-Z0-9 -]+$",
  "description": "Free-form smell descriptor. Examples: 'musky', 'fresh', 'sweaty', 'floral'",
  "examples": ["musky", "fresh", "sweaty", "floral", "earthy", "clean"]
}
```

### 7. **Integration Test for User's Exact Recipe**

**Problem:** No test for the specific blueprint and descriptor combination the user is using.

**Recommendation:** Add a test that matches the user's recipe exactly.

**New File:** `tests/integration/anatomy/bogdanaRecipeReproduction.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Bogdana Avalune Recipe Reproduction', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  it('should include all bodyDescriptors from user recipe in description', async () => {
    // Exact reproduction of user's recipe structure
    const recipeData = {
      recipeId: 'test:bogdana_reproduction',
      blueprintId: 'anatomy:human_futa',
      bodyDescriptors: {
        build: 'hulking',
        composition: 'lean',
        height: 'gigantic',
        skinColor: 'fair',
        smell: 'musky',
      },
      slots: {
        torso: {
          partType: 'torso',
          preferId: 'anatomy:human_futa_torso_hulking_scarred',
          properties: {
            'descriptors:build': {
              build: 'hulking',
            },
          },
        },
        head: {
          partType: 'head',
          preferId: 'anatomy:humanoid_head_scarred',
        },
        // ... other slots from user's recipe
      },
      patterns: [
        // ... patterns from user's recipe
      ],
    };

    testBed.loadRecipes({ 'test:bogdana_reproduction': recipeData });

    const actorId = await testBed.createCharacterFromRecipe(
      'test:bogdana_reproduction'
    );

    const entity = testBed.entityManager.getEntityInstance(actorId);
    expect(entity).toBeDefined();

    // Verify anatomy:body component structure
    const bodyComponent = entity.getComponentData('anatomy:body');
    expect(bodyComponent?.body?.descriptors).toEqual({
      build: 'hulking',
      composition: 'lean',
      height: 'gigantic',
      skinColor: 'fair',
      smell: 'musky',
    });

    // Generate and verify description
    const description = await testBed.bodyDescriptionComposer.composeDescription(entity);

    // All descriptors should appear in order
    expect(description).toContain('Height: gigantic');
    expect(description).toContain('Build: hulking');
    expect(description).toContain('Body composition: lean');
    expect(description).toContain('Skin color: fair');
    expect(description).toContain('Smell: musky');

    // Verify ordering
    const heightPos = description.indexOf('Height: gigantic');
    const skinPos = description.indexOf('Skin color: fair');
    const smellPos = description.indexOf('Smell: musky');

    expect(skinPos).toBeGreaterThan(heightPos);
    expect(smellPos).toBeGreaterThan(skinPos);
  });
});
```

---

## Diagnostic Checklist

To identify the root cause, run these checks:

### Check 1: Verify Recipe Loading
```javascript
const recipe = dataRegistry.get('anatomyRecipes', 'p_erotica_duchess:bogdana_avalune_recipe');
console.log('Recipe found:', !!recipe);
console.log('Recipe bodyDescriptors:', recipe?.bodyDescriptors);
// Expected: { build: 'hulking', composition: 'lean', height: 'gigantic', skinColor: 'fair', smell: 'musky' }
```

### Check 2: Verify Anatomy Body Component
```javascript
const entity = entityManager.getEntityInstance(characterId);
const bodyComponent = entity.getComponentData('anatomy:body');
console.log('Body descriptors:', bodyComponent?.body?.descriptors);
// Expected: { build: 'hulking', composition: 'lean', height: 'gigantic', skinColor: 'fair', smell: 'musky' }
```

### Check 3: Verify Extraction
```javascript
const skinColor = bodyDescriptionComposer.extractSkinColorDescription(entity);
const smell = bodyDescriptionComposer.extractSmellDescription(entity);
console.log('Extracted skinColor:', skinColor); // Expected: 'fair'
console.log('Extracted smell:', smell); // Expected: 'musky'
```

### Check 4: Verify Description Order
```javascript
const config = bodyDescriptionComposer.config;
const order = config.getDescriptionOrder();
console.log('skin_color position:', order.indexOf('skin_color')); // Expected: 4 or 5
console.log('smell position:', order.indexOf('smell')); // Expected: 5 or 6
```

### Check 5: Full Description
```javascript
const description = await bodyDescriptionComposer.composeDescription(entity);
console.log('Full description:', description);
console.log('Contains "Skin color:":', description.includes('Skin color:'));
console.log('Contains "Smell:":', description.includes('Smell:'));
```

---

## Conclusion

The codebase appears to have **complete and correct support** for `skinColor` and `smell` bodyDescriptors. The issue is likely:

1. **Recipe not loading** - Symlinked mod not being recognized
2. **Cached data** - Old character data without the descriptors
3. **Silent failure** - Exception being caught and swallowed somewhere
4. **Timing issue** - Description generated before anatomy workflow completes

The refactoring recommendations above will make the system more robust and easier to debug:
- **Defensive validation** prevents silent failures
- **Explicit mapping** makes relationships clear
- **Generic extraction** reduces code duplication
- **Comprehensive logging** enables debugging
- **Verification methods** allow post-generation checks

These changes will ensure that future descriptor additions "just work" and that any failures are immediately visible with clear error messages.
