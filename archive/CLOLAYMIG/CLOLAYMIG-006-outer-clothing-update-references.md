# CLOLAYMIG-006: Outer-Clothing - Update Recipe References

**Status: ✅ COMPLETED**

## Summary

Update all recipe files that reference outer-clothing entities to use the new `outer-clothing:*` namespace instead of `clothing:*`. Also add `outer-clothing` as a dependency to affected mods.

## Dependencies

- CLOLAYMIG-005 (Outer-Clothing - Create Entities) must be completed ✅

## Reference Changes

### Recipe Files to Modify

| Recipe File                                                | Entity References to Update     |
| ---------------------------------------------------------- | ------------------------------- |
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | `battle_scarred_leather_jacket` |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json`  | `leather_work_apron`            |

**Note**: `vespera_nightwhisper`, `dylan_crace`, and `len_amezua` recipes do NOT reference any outer-clothing items.

### Exact Changes Per File

#### `data/mods/fantasy/recipes/threadscar_melissa.recipe.json`

```diff
- "entityId": "clothing:battle_scarred_leather_jacket",
+ "entityId": "outer-clothing:battle_scarred_leather_jacket",
```

#### `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json`

```diff
- "entityId": "clothing:leather_work_apron",
+ "entityId": "outer-clothing:leather_work_apron",
```

## Files to Modify

### Mod Manifests - Add `outer-clothing` Dependency

#### `data/mods/fantasy/mod-manifest.json`

Add to `dependencies` array:

```json
{
  "id": "outer-clothing",
  "version": "^1.0.0"
}
```

**Note**: The `patrol` mod does NOT need `outer-clothing` dependency since no patrol recipes reference outer-clothing items.

## Out of Scope

- **DO NOT** delete any files from `clothing` mod
- **DO NOT** modify `clothing/mod-manifest.json`
- **DO NOT** modify any non-outer-clothing entity references
- **DO NOT** modify any entities in the `outer-clothing` mod
- **DO NOT** modify entities in the `clothing` mod
- **DO NOT** touch any underwear, base, or accessory references
- **DO NOT** modify `patrol/mod-manifest.json` (not needed)

## Files Summary

| File                                                       | Action             |
| ---------------------------------------------------------- | ------------------ |
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | Update 1 reference |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json`  | Update 1 reference |
| `data/mods/fantasy/mod-manifest.json`                      | Add dependency     |

**Total: 2 references across 2 recipe files, 1 manifest update**

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
4. The outer-clothing items resolve to `outer-clothing:*` entities, not `clothing:*`
5. No broken entity references

### Manual Verification

1. Run `npm run start` and create a character using `threadscar_melissa` recipe
2. Verify the jacket entity has ID `outer-clothing:battle_scarred_leather_jacket`
3. Search for `"clothing:battle_scarred_leather_jacket"` in recipe files - should find 0 matches
4. Search for `"clothing:leather_work_apron"` in recipe files - should find 0 matches

## Rollback

```bash
git checkout data/mods/fantasy/recipes/threadscar_melissa.recipe.json
git checkout data/mods/fantasy/recipes/bertram_the_muddy.recipe.json
git checkout data/mods/fantasy/mod-manifest.json
```

---

## Outcome

**Completed**: 2025-11-26

### What Was Changed (Exactly as Planned)

1. **`data/mods/fantasy/recipes/threadscar_melissa.recipe.json`**
   - Updated line 162: `clothing:battle_scarred_leather_jacket` → `outer-clothing:battle_scarred_leather_jacket`

2. **`data/mods/fantasy/recipes/bertram_the_muddy.recipe.json`**
   - Updated line 107: `clothing:leather_work_apron` → `outer-clothing:leather_work_apron`

3. **`data/mods/fantasy/mod-manifest.json`**
   - Added `outer-clothing` dependency to dependencies array

### Verification Results

- `npm run validate` - **PASSED** (0 cross-reference violations, 42 mods validated)
- `tests/integration/loaders/modsLoader` - **PASSED** (21 tests)
- `tests/integration/validation` - **PASSED** (341 tests)
- `tests/integration/clothing` - **PASSED** (285 tests)

### No Discrepancies

The ticket assumptions were 100% accurate. All changes matched exactly what was planned.
