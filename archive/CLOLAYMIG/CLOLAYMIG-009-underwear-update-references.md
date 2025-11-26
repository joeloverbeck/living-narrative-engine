# CLOLAYMIG-009: Underwear - Update Recipe References

**STATUS: ✅ COMPLETED**

## Summary

Update all recipe files that reference underwear entities to use the new `underwear:*` namespace instead of `clothing:*`. Also add `underwear` as a dependency to affected mods.

## Dependencies

- CLOLAYMIG-008 (Underwear - Create Entities) must be completed

## Reference Changes

### Recipe Files to Modify

| Recipe File | Entity References to Update |
|------------|----------------------------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | `graphite_wool_briefs`, `charcoal_nylon_sports_bra`, `dark_gray_wool_boot_socks` |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | `graphite_wool_briefs`, `dark_gray_wool_boot_socks` |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | `graphite_wool_briefs`, `dark_gray_wool_boot_socks` |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | `charcoal_nylon_sports_bra`, `graphite_wool_briefs`, `dark_gray_wool_boot_socks` |

**Note**: `vespera_nightwhisper` does NOT reference any underwear items.

### Exact Changes Per File

#### `data/mods/fantasy/recipes/threadscar_melissa.recipe.json`

```diff
- "entityId": "clothing:graphite_wool_briefs",
+ "entityId": "underwear:graphite_wool_briefs",

- "entityId": "clothing:charcoal_nylon_sports_bra",
+ "entityId": "underwear:charcoal_nylon_sports_bra",

- "entityId": "clothing:dark_gray_wool_boot_socks",
+ "entityId": "underwear:dark_gray_wool_boot_socks",
```

#### `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json`

```diff
- "entityId": "clothing:graphite_wool_briefs",
+ "entityId": "underwear:graphite_wool_briefs",

- "entityId": "clothing:dark_gray_wool_boot_socks",
+ "entityId": "underwear:dark_gray_wool_boot_socks",
```

#### `data/mods/patrol/recipes/dylan_crace.recipe.json`

```diff
- "entityId": "clothing:graphite_wool_briefs",
+ "entityId": "underwear:graphite_wool_briefs",

- "entityId": "clothing:dark_gray_wool_boot_socks",
+ "entityId": "underwear:dark_gray_wool_boot_socks",
```

#### `data/mods/patrol/recipes/len_amezua.recipe.json`

```diff
- "entityId": "clothing:charcoal_nylon_sports_bra",
+ "entityId": "underwear:charcoal_nylon_sports_bra",

- "entityId": "clothing:graphite_wool_briefs",
+ "entityId": "underwear:graphite_wool_briefs",

- "entityId": "clothing:dark_gray_wool_boot_socks",
+ "entityId": "underwear:dark_gray_wool_boot_socks",
```

## Files to Modify

### Mod Manifests - Add `underwear` Dependency

#### `data/mods/fantasy/mod-manifest.json`

Add to `dependencies` array:

```json
{
  "id": "underwear",
  "version": "^1.0.0"
}
```

#### `data/mods/patrol/mod-manifest.json`

Add to `dependencies` array:

```json
{
  "id": "underwear",
  "version": "^1.0.0"
}
```

## Out of Scope

- **DO NOT** delete any files from `clothing` mod
- **DO NOT** modify `clothing/mod-manifest.json`
- **DO NOT** modify any non-underwear entity references
- **DO NOT** modify any entities in the `underwear` mod
- **DO NOT** modify entities in the `clothing` mod
- **DO NOT** touch any accessories, base, or outer clothing references

## Files Summary

| File | Action |
|------|--------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | Update 3 references |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | Update 2 references |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | Update 2 references |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | Update 3 references |
| `data/mods/fantasy/mod-manifest.json` | Add dependency |
| `data/mods/patrol/mod-manifest.json` | Add dependency |

**Total: 10 references across 4 recipe files, 2 manifest updates**

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
4. The underwear items resolve to `underwear:*` entities, not `clothing:*`
5. No broken entity references

### Manual Verification

1. Run `npm run start` and create a character using `threadscar_melissa` recipe
2. Verify the briefs entity has ID `underwear:graphite_wool_briefs`
3. Search for `"clothing:graphite_wool_briefs"` in recipe files - should find 0 matches
4. Search for `"clothing:charcoal_nylon_sports_bra"` in recipe files - should find 0 matches
5. Search for `"clothing:dark_gray_wool_boot_socks"` in recipe files - should find 0 matches

## Rollback

```bash
git checkout data/mods/fantasy/recipes/*.recipe.json
git checkout data/mods/patrol/recipes/*.recipe.json
git checkout data/mods/fantasy/mod-manifest.json
git checkout data/mods/patrol/mod-manifest.json
```

---

## Outcome

**Completed**: 2025-11-26

### What Was Changed (vs Originally Planned)

All changes executed exactly as planned in the ticket. No discrepancies.

### Files Modified

1. **Recipe files** (10 entity reference updates):
   - `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` - 3 references updated
   - `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` - 2 references updated
   - `data/mods/patrol/recipes/dylan_crace.recipe.json` - 2 references updated
   - `data/mods/patrol/recipes/len_amezua.recipe.json` - 3 references updated

2. **Mod manifests** (2 dependency additions):
   - `data/mods/fantasy/mod-manifest.json` - added `underwear` dependency
   - `data/mods/patrol/mod-manifest.json` - added `underwear` dependency

### Validation Results

- ✅ `npm run validate` - PASSED (0 cross-reference violations)
- ✅ `npm run test:unit` - PASSED (36,857 tests)
- ✅ `npm run test:integration` - PASSED (13,633 tests)
- ✅ Underwear migration tests - PASSED (11 tests)
- ✅ No `clothing:*` underwear references remain in recipe files
