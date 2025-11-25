# CLOLAYMIG-012: Base-Clothing - Update Recipe References

## Summary

Update all recipe files that reference base-clothing entities to use the new `base-clothing:*` namespace instead of `clothing:*`. Also add `base-clothing` as a dependency to affected mods.

## Dependencies

- CLOLAYMIG-011 (Base-Clothing - Create Entities) must be completed

## Reference Changes

### Recipe Files to Modify

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

## Files to Modify

### Mod Manifests - Add `base-clothing` Dependency

#### `data/mods/fantasy/mod-manifest.json`

Add to `dependencies` array:

```json
{
  "id": "base-clothing",
  "version": "^1.0.0"
}
```

#### `data/mods/patrol/mod-manifest.json`

Add to `dependencies` array:

```json
{
  "id": "base-clothing",
  "version": "^1.0.0"
}
```

## Out of Scope

- **DO NOT** delete any files from `clothing` mod
- **DO NOT** modify `clothing/mod-manifest.json`
- **DO NOT** modify any non-base-clothing entity references
- **DO NOT** modify any entities in the `base-clothing` mod
- **DO NOT** modify entities in the `clothing` mod
- **DO NOT** touch any underwear, outer, or accessory references

## Files Summary

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

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate        # Schema validation passes
npm run test:ci         # Full test suite passes
```

### Invariants That Must Remain True

1. All recipe files load successfully
2. The `clothing` mod still contains all original entity definitions
3. Characters using these recipes can be created successfully
4. The base-clothing items resolve to `base-clothing:*` entities, not `clothing:*`
5. No broken entity references

### Manual Verification

1. Run `npm run start` and create a character using `threadscar_melissa` recipe
2. Verify the pants entity has ID `base-clothing:shale_gray_nylon_field_pants`
3. Search for `"clothing:shale_gray_nylon_field_pants"` in recipe files - should find 0 matches
4. Search for `"clothing:charcoal_wool_tshirt"` in recipe files - should find 0 matches
5. Search for `"clothing:black_leather_duty_boots"` in recipe files - should find 0 matches
6. Search for `"clothing:cream_poets_shirt_billowing_sleeves"` in recipe files - should find 0 matches
7. Search for `"clothing:black_breeches_tapered_knee"` in recipe files - should find 0 matches
8. Search for `"clothing:digitigrade_foot_wraps_burgundy"` in recipe files - should find 0 matches

## Rollback

```bash
git checkout data/mods/fantasy/recipes/*.recipe.json
git checkout data/mods/patrol/recipes/*.recipe.json
git checkout data/mods/fantasy/mod-manifest.json
git checkout data/mods/patrol/mod-manifest.json
```
