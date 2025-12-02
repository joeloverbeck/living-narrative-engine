# Recipe Validation Robustness Specification

## Context

### Location in Codebase
The anatomy recipe validation system is located across several modules:

| Component | Path | Purpose |
|-----------|------|---------|
| Validation Pipeline | `src/anatomy/validation/RecipeValidationRunner.js` | Orchestrates validator execution |
| Entity Matcher | `src/anatomy/services/entityMatcherService.js` | Matches entities to recipe requirements |
| Body Descriptor Registry | `src/anatomy/registries/bodyDescriptorRegistry.js` | Single source of truth for descriptor values |
| Validators | `src/anatomy/validation/validators/*.js` | Individual validation rules |
| Recipe Schema | `data/schemas/anatomy.recipe.schema.json` | JSON Schema for recipe structure |
| CLI Entry | `scripts/validate-recipe.js` | Command-line validation interface |

### What the Module Does
The recipe validation system validates anatomy recipes before they can be used to generate entity anatomy. It ensures:
1. All referenced content (blueprints, components, entities) exists and is registered
2. Body descriptor values are valid according to the registry
3. Recipe slots can be matched to existing entity definitions
4. Recipe structure conforms to the JSON schema

---

## Problem

### What Failed
During ROOHENANAREC-003 (chicken recipe implementation), three distinct failure categories were discovered when running `npm run validate:recipe`:

### Failure 1: Missing Manifest Registration
**Error**: `"Blueprint 'anatomy:rooster' does not exist"`

**How it failed**: Content files existed on disk but were not listed in `data/mods/anatomy/mod-manifest.json`. The validation pipeline's `BlueprintExistenceValidator` (priority 10, failFast: true) rejected the recipe immediately.

**Root cause**: The mod loading system only discovers content that is explicitly registered in the manifest. Without registration, content is invisible to validators.

**Tests affected**: All recipe validation tests fail if manifest registration is incomplete.

### Failure 2: Invalid Body Descriptor Values
**Error**: `"Invalid value 'small' for body descriptor 'height'. Expected one of: microscopic, minuscule, tiny, petite, short, average, tall, very-tall, gigantic, colossal, titanic"`

**How it failed**: The recipe used `"height": "small"` but `small` is not in the enumerated valid values for the height descriptor.

**Root cause**: Body descriptor values are strictly enumerated in `bodyDescriptorRegistry.js`. The registry defines specific valid values for each descriptor, and validation rejects anything not in the list.

**Tests affected**: `tests/unit/anatomy/chicken.recipe.test.js` - body descriptor assertions.

### Failure 3: Property Semantic Misunderstanding
**Error**: `"No entity definitions found for slot 'comb'"`

**How it failed**: The recipe used `properties` to specify size variations:
```json
{
  "comb": {
    "partType": "chicken_comb",
    "preferId": "anatomy:chicken_comb",
    "properties": {
      "descriptors:size_category": { "size": "large" }
    }
  }
}
```

**Root cause**: The `properties` field is a **filter** to select entities that already have those exact component values, NOT a runtime override mechanism. The `EntityMatcherService.#matchesPropertyValues()` method performs strict equality matching:

```javascript
#matchesPropertyValues(entityDef, propertyRequirements) {
  for (const [componentId, requiredProps] of Object.entries(propertyRequirements)) {
    const component = entityDef.components?.[componentId];
    if (!component) return false;  // Entity must have the component
    for (const [propKey, propValue] of Object.entries(requiredProps)) {
      if (component[propKey] !== propValue) return false;  // Values must match exactly
    }
  }
  return true;
}
```

Since `chicken_comb.entity.json` does not have a `descriptors:size_category` component with `size: "large"`, no matching entity was found.

**Tests affected**: Tests checking for property overrides on comb, wattle, and tail slots.

---

## Truth Sources

### Primary Documentation
- `data/schemas/anatomy.recipe.schema.json` - Canonical recipe structure
- `src/anatomy/registries/bodyDescriptorRegistry.js` - Valid descriptor values
- `docs/anatomy/body-descriptors-complete.md` - Body descriptor documentation

### Domain Rules
1. **Manifest Registration Rule**: All content must be registered in `mod-manifest.json` to be discoverable
2. **Descriptor Enumeration Rule**: Body descriptors with `validValues !== null` only accept those specific values
3. **Property Filtering Rule**: `properties` matches entities that already have those values, not runtime overrides

### External Contracts
- JSON Schema Draft-07 for schema validation
- AJV validator for JSON Schema enforcement
- Node.js fs module for file access during validation

---

## Desired Behavior

### Normal Cases

1. **Valid Recipe with Registered Content**
   - Input: Recipe with valid structure, registered blueprint, matching entities
   - Output: Validation passes with all checks green
   - Behavior: All validators run in priority order and succeed

2. **Recipe with preferId Specification**
   - Input: Slot specifies `preferId` pointing to registered entity
   - Output: Validation passes, preferId used at runtime for entity selection
   - Behavior: `PartAvailabilityValidator` confirms entity exists with matching partType

3. **Recipe with Pattern Definitions**
   - Input: Recipe has patterns for bilateral body parts (left/right)
   - Output: Validation passes, all pattern slots resolved
   - Behavior: `PatternMatchingValidator` confirms all pattern slots exist in blueprint

### Edge Cases

1. **Entity with Multiple Matching Criteria**
   - Scenario: Recipe slot specifies partType + tags + properties
   - Expected: Only entities matching ALL criteria are valid matches
   - Behavior: AND logic across all filters

2. **Free-form Descriptor Values**
   - Scenario: `skinColor` or `smell` with arbitrary string
   - Expected: Any non-empty string accepted (validValues === null)
   - Behavior: No enumeration check for these descriptors

3. **Pattern Slot Coverage**
   - Scenario: Pattern matches slots not in blueprint
   - Expected: Warning issued but not fatal error
   - Behavior: `PatternMatchingValidator` logs warning, validation continues

### Failure Modes

| Condition | Error Type | Error Message | Recovery |
|-----------|------------|---------------|----------|
| Blueprint not in manifest | `BlueprintExistenceValidator` | "Blueprint '{id}' does not exist" | Register in mod-manifest.json |
| Invalid descriptor value | `RecipeBodyDescriptorValidator` | "Invalid value '{v}' for {descriptor}" | Use value from valid list |
| No matching entities | `PartAvailabilityValidator` | "No entity definitions found for slot '{s}'" | Remove properties filter or create matching entity |
| Component not registered | `ComponentExistenceValidator` | "Component '{id}' does not exist" | Register component in manifest |
| Malformed JSON | Schema validation | AJV error with path | Fix JSON syntax |

---

## Invariants

Properties that must always hold:

1. **Registry Completeness**: `bodyDescriptorRegistry.js` is the single source of truth for all descriptor metadata
2. **Manifest Gatekeeping**: Only content listed in `mod-manifest.json` is discoverable by validators
3. **Strict Property Matching**: `properties` field uses exact equality (`===`), never partial matching
4. **Validator Priority Order**: Validators execute in priority order (0 = highest); failFast validators abort on first error
5. **Schema First**: Recipe must pass JSON Schema validation before domain validators run
6. **Blueprint Before Parts**: Blueprint existence is validated (priority 10) before part availability (priority 25)

---

## API Contracts

### What Stays Stable

1. **Recipe Schema Structure**
   - `recipeId`, `blueprintId`, `bodyDescriptors`, `slots`, `patterns` fields
   - Schema URL: `schema://living-narrative-engine/anatomy.recipe.schema.json`

2. **Validator Interface**
   - `validate(recipe, context)` method signature
   - Return `{ errors: [], warnings: [] }` structure

3. **Body Descriptor Names**
   - `height`, `skinColor`, `build`, `composition`, `hairDensity`, `smell`

4. **Property Matching Semantics**
   - `properties` field filters entities, not overrides values
   - Strict equality matching

### What is Allowed to Change

1. **Valid Descriptor Values**
   - New values can be added to enumerated descriptors
   - Display order can be adjusted

2. **Validator Priorities**
   - Order can change as long as dependencies are respected
   - New validators can be added

3. **Error Message Text**
   - Wording can be improved for clarity
   - Additional context can be added

4. **New Descriptors**
   - Registry can be extended with new descriptors (next displayOrder: 70)

---

## Testing Plan

### Tests to Update/Add

#### Unit Tests

1. **Body Descriptor Validation** (`tests/unit/anatomy/validators/`)
   - Test all valid height values are accepted
   - Test invalid height values are rejected with clear error
   - Test free-form descriptors accept any string

2. **Entity Matcher Service** (`tests/unit/anatomy/services/entityMatcherService.test.js`)
   - Test `#matchesPropertyValues` with matching component
   - Test `#matchesPropertyValues` with missing component returns false
   - Test `#matchesPropertyValues` with mismatched value returns false

3. **Manifest Registration** (`tests/unit/loaders/`)
   - Test unregistered content is not discoverable
   - Test registered content is loaded correctly

#### Integration Tests

1. **Recipe Validation Pipeline** (`tests/integration/anatomy/`)
   - Test complete validation flow with valid recipe
   - Test validation failure with unregistered blueprint
   - Test validation failure with invalid descriptor
   - Test validation failure with unmatched properties

2. **Manifest-to-Validation Flow** (`tests/integration/loaders/`)
   - Test that manifest registration enables validation
   - Test that missing manifest entries cause validation failures

### Regression Tests

1. **Chicken Recipe Regression** (`tests/unit/anatomy/chicken.recipe.test.js`)
   - Existing 33 tests serve as regression suite
   - Add test verifying `properties` field is not used (prevents future misuse)

2. **Descriptor Registry Regression** (`tests/unit/anatomy/registries/`)
   - Test that adding new valid values doesn't break existing recipes
   - Property-based test: all registry descriptors have consistent structure

### Property Tests (Recommended)

1. **Descriptor Exhaustiveness**
   ```javascript
   // All valid values should pass validation
   for (const value of BODY_DESCRIPTOR_REGISTRY.height.validValues) {
     expect(validateDescriptorValue('height', value)).toBe(true);
   }
   ```

2. **Manifest Completeness Check**
   ```javascript
   // All content files in directory should be registered
   const files = glob('data/mods/anatomy/recipes/*.recipe.json');
   const manifest = loadManifest();
   for (const file of files) {
     expect(manifest.content.recipes).toContain(basename(file));
   }
   ```

3. **Property Filter Semantics**
   ```javascript
   // Property filtering should never mutate entities
   const originalEntity = deepClone(entity);
   matcher.findMatchingEntities(requirements);
   expect(entity).toEqual(originalEntity);
   ```

---

## Implementation Recommendations

### Short-term (Low Risk)

1. **Add manifest completeness validation** to `npm run validate:ecosystem`
   - Check that all files in mod directories are registered
   - Warn on unregistered files

2. **Improve error messages** for property filtering failures
   - Include "properties field filters existing entities, it does not apply overrides"
   - Suggest creating entity variants or removing properties

### Medium-term (Moderate Effort)

1. **Add JSDoc to `properties` field** in recipe schema
   - Clarify filtering vs override semantics
   - Link to documentation

2. **Create developer guide** for recipe authoring
   - Document common pitfalls
   - Include property filtering explanation

### Long-term (Architectural)

1. **Consider runtime override mechanism** if genuinely needed
   - Could add separate `overrides` field distinct from `properties`
   - Would require EntityMatcherService changes

2. **Add pre-commit validation hook**
   - Run `npm run validate:recipe` on changed recipe files
   - Prevent invalid recipes from being committed

---

## References

- Ticket: `archive/ROOHENANAREC-003-recipes-COMPLETED.md`
- Original Spec: `archive/specs/rooster-hen-anatomy-recipes.md`
- Tests: `tests/unit/anatomy/chicken.recipe.test.js`
- Body Descriptor Docs: `docs/anatomy/body-descriptors-complete.md`
