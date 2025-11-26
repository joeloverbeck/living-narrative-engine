# CLOLAYMIG-012: Base-Clothing - Update Recipe References

## Status: COMPLETED

**Completed:** 2025-11-26

## Summary

Update all recipe files that reference base-clothing entities to use the new `base-clothing:*` namespace instead of `clothing:*`. Also add `base-clothing` as a dependency to affected mods.

## Dependencies

- CLOLAYMIG-011 (Base-Clothing - Create Entities) must be completed

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned:** 13 entity reference updates across 5 recipe files + 2 mod manifest dependency additions

**Actual:** Exactly as planned - all 13 references updated, both manifest dependencies added

### Files Modified

| File | Changes |
|------|---------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | Updated 2 references to `base-clothing:*` |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | Updated 3 references to `base-clothing:*` |
| `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json` | Updated 3 references to `base-clothing:*` |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | Updated 3 references to `base-clothing:*` |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | Updated 2 references to `base-clothing:*` |
| `data/mods/fantasy/mod-manifest.json` | Added `base-clothing` dependency |
| `data/mods/patrol/mod-manifest.json` | Added `base-clothing` dependency |

### New Tests Added

| Test File | Purpose |
|-----------|---------|
| `tests/integration/mods/base-clothing/baseClothingRecipeReferences.integration.test.js` | 16 tests validating recipe references, manifest dependencies, and entity resolution |

### Test Results

- `npm run validate` - **PASSED** (0 cross-reference violations)
- `tests/integration/clothing/` - **PASSED** (285 tests)
- `tests/integration/mods/base-clothing/` - **PASSED** (30 tests)

### Validation Performed

1. All recipe files now use `base-clothing:*` namespace for migrated entities
2. No `clothing:*` prefix remains for the 6 migrated entity types in recipes
3. Both `fantasy` and `patrol` mods have `base-clothing` dependency
4. Both mods retain `clothing` dependency (for infrastructure)
5. All 68 base-clothing entities exist and are referenced correctly

---

## Original Ticket Content

### Reference Changes

#### Recipe Files to Modify

| Recipe File | Entity References to Update |
|------------|----------------------------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | `shale_gray_nylon_field_pants`, `black_leather_duty_boots` |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | `shale_gray_nylon_field_pants`, `charcoal_wool_tshirt`, `black_leather_duty_boots` |
| `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json` | `cream_poets_shirt_billowing_sleeves`, `black_breeches_tapered_knee`, `digitigrade_foot_wraps_burgundy` |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | `shale_gray_nylon_field_pants`, `charcoal_wool_tshirt`, `black_leather_duty_boots` |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | `shale_gray_nylon_field_pants`, `black_leather_duty_boots` |

### Exact Changes Per File

#### `data/mods/fantasy/recipes/threadscar_melissa.recipe.json`

```diff
- "entityId": "clothing:shale_gray_nylon_field_pants",
+ "entityId": "base-clothing:shale_gray_nylon_field_pants",

- "entityId": "clothing:black_leather_duty_boots",
+ "entityId": "base-clothing:black_leather_duty_boots",
```

#### `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json`

```diff
- "entityId": "clothing:shale_gray_nylon_field_pants",
+ "entityId": "base-clothing:shale_gray_nylon_field_pants",

- "entityId": "clothing:charcoal_wool_tshirt",
+ "entityId": "base-clothing:charcoal_wool_tshirt",

- "entityId": "clothing:black_leather_duty_boots",
+ "entityId": "base-clothing:black_leather_duty_boots",
```

#### `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json`

```diff
- "entityId": "clothing:cream_poets_shirt_billowing_sleeves",
+ "entityId": "base-clothing:cream_poets_shirt_billowing_sleeves",

- "entityId": "clothing:black_breeches_tapered_knee",
+ "entityId": "base-clothing:black_breeches_tapered_knee",

- "entityId": "clothing:digitigrade_foot_wraps_burgundy",
+ "entityId": "base-clothing:digitigrade_foot_wraps_burgundy",
```

#### `data/mods/patrol/recipes/dylan_crace.recipe.json`

```diff
- "entityId": "clothing:shale_gray_nylon_field_pants",
+ "entityId": "base-clothing:shale_gray_nylon_field_pants",

- "entityId": "clothing:charcoal_wool_tshirt",
+ "entityId": "base-clothing:charcoal_wool_tshirt",

- "entityId": "clothing:black_leather_duty_boots",
+ "entityId": "base-clothing:black_leather_duty_boots",
```

#### `data/mods/patrol/recipes/len_amezua.recipe.json`

```diff
- "entityId": "clothing:shale_gray_nylon_field_pants",
+ "entityId": "base-clothing:shale_gray_nylon_field_pants",

- "entityId": "clothing:black_leather_duty_boots",
+ "entityId": "base-clothing:black_leather_duty_boots",
```

### Files to Modify

#### Mod Manifests - Add `base-clothing` Dependency

##### `data/mods/fantasy/mod-manifest.json`

Add to `dependencies` array:

```json
{
  "id": "base-clothing",
  "version": "^1.0.0"
}
```

##### `data/mods/patrol/mod-manifest.json`

Add to `dependencies` array:

```json
{
  "id": "base-clothing",
  "version": "^1.0.0"
}
```

### Out of Scope

- **DO NOT** delete any files from `clothing` mod
- **DO NOT** modify `clothing/mod-manifest.json`
- **DO NOT** modify any non-base-clothing entity references
- **DO NOT** modify any entities in the `base-clothing` mod
- **DO NOT** modify entities in the `clothing` mod
- **DO NOT** touch any underwear, outer, or accessory references

### Files Summary

| File | Action |
|------|--------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | Update 2 references |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | Update 3 references |
| `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json` | Update 3 references |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | Update 3 references |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | Update 2 references |
| `data/mods/fantasy/mod-manifest.json` | Add dependency |
| `data/mods/patrol/mod-manifest.json` | Add dependency |

**Total: 13 references across 5 recipe files, 2 manifest updates**

### Acceptance Criteria

#### Tests That Must Pass

```bash
npm run validate        # Schema validation passes
npm run test:ci         # Full test suite passes
```

#### Invariants That Must Remain True

1. All recipe files load successfully
2. The `clothing` mod still contains all original entity definitions
3. Characters using these recipes can be created successfully
4. The base-clothing items resolve to `base-clothing:*` entities, not `clothing:*`
5. No broken entity references

### Rollback

```bash
git checkout data/mods/fantasy/recipes/*.recipe.json
git checkout data/mods/patrol/recipes/*.recipe.json
git checkout data/mods/fantasy/mod-manifest.json
git checkout data/mods/patrol/mod-manifest.json
```
