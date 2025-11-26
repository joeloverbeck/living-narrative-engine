# CLOLAYMIG-003: Accessories - Update Recipe References

## Status: ✅ COMPLETED

## Summary

Update all recipe files that reference accessory entities to use the new `accessories:*` namespace instead of `clothing:*`. Also add `accessories` as a dependency to affected mods.

## Dependencies

- CLOLAYMIG-002 (Accessories - Create Entities) must be completed

## Reference Changes

### Recipe Files to Modify

| Recipe File | Entity References to Update |
|------------|----------------------------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | `black_tactical_work_belt` |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | `dark_brown_leather_belt` |
| `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json` | `black_leather_collar_silver_bell` |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | `black_tactical_work_belt`, `slate_nylon_baseball_cap` |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | `black_tactical_work_belt`, `slate_nylon_baseball_cap` |

### Exact Changes Per File

#### `data/mods/fantasy/recipes/threadscar_melissa.recipe.json`

```diff
- "entityId": "clothing:black_tactical_work_belt",
+ "entityId": "accessories:black_tactical_work_belt",
```

#### `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json`

```diff
- "entityId": "clothing:dark_brown_leather_belt",
+ "entityId": "accessories:dark_brown_leather_belt",
```

#### `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json`

```diff
- "entityId": "clothing:black_leather_collar_silver_bell",
+ "entityId": "accessories:black_leather_collar_silver_bell",
```

#### `data/mods/patrol/recipes/dylan_crace.recipe.json`

```diff
- "entityId": "clothing:black_tactical_work_belt",
+ "entityId": "accessories:black_tactical_work_belt",

- "entityId": "clothing:slate_nylon_baseball_cap",
+ "entityId": "accessories:slate_nylon_baseball_cap",
```

#### `data/mods/patrol/recipes/len_amezua.recipe.json`

```diff
- "entityId": "clothing:black_tactical_work_belt",
+ "entityId": "accessories:black_tactical_work_belt",

- "entityId": "clothing:slate_nylon_baseball_cap",
+ "entityId": "accessories:slate_nylon_baseball_cap",
```

## Files to Modify

### Mod Manifests - Add `accessories` Dependency

#### `data/mods/fantasy/mod-manifest.json`

Add to `dependencies` array:

```json
{
  "id": "accessories",
  "version": "^1.0.0"
}
```

#### `data/mods/patrol/mod-manifest.json`

Add to `dependencies` array:

```json
{
  "id": "accessories",
  "version": "^1.0.0"
}
```

## Out of Scope

- **DO NOT** delete any files from `clothing` mod
- **DO NOT** modify `clothing/mod-manifest.json`
- **DO NOT** modify any non-accessory entity references
- **DO NOT** modify any entities in the `accessories` mod
- **DO NOT** modify entities in the `clothing` mod
- **DO NOT** touch any underwear, base, or outer clothing references

## Files Summary

| File | Action |
|------|--------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | Update 1 reference |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | Update 1 reference |
| `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json` | Update 1 reference |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | Update 2 references |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | Update 2 references |
| `data/mods/fantasy/mod-manifest.json` | Add dependency |
| `data/mods/patrol/mod-manifest.json` | Add dependency |

**Total: 7 references across 5 recipe files, 2 manifest updates**

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate        # Schema validation passes
npm run test:ci         # Full test suite passes
```

### Invariants That Must Remain True

1. All recipe files load successfully
2. The `clothing` mod still contains all 125 entity definitions
3. Characters using these recipes can be created successfully
4. The accessory items resolve to `accessories:*` entities, not `clothing:*`
5. No broken entity references

### Manual Verification

1. Run `npm run start` and create a character using `threadscar_melissa` recipe
2. Verify the belt entity has ID `accessories:black_tactical_work_belt`
3. Search for `"clothing:black_tactical_work_belt"` in recipe files - should find 0 matches
4. Search for `"clothing:slate_nylon_baseball_cap"` in recipe files - should find 0 matches

## Rollback

```bash
git checkout data/mods/fantasy/recipes/*.recipe.json
git checkout data/mods/patrol/recipes/*.recipe.json
git checkout data/mods/fantasy/mod-manifest.json
git checkout data/mods/patrol/mod-manifest.json
```

---

## Outcome

### Completed: 2025-11-25

### What was changed vs originally planned

**All changes executed exactly as planned.** The ticket assumptions were 100% accurate:

1. **Recipe file updates (7 entity references across 5 files):**
   - `threadscar_melissa.recipe.json`: Changed `clothing:black_tactical_work_belt` → `accessories:black_tactical_work_belt`
   - `bertram_the_muddy.recipe.json`: Changed `clothing:dark_brown_leather_belt` → `accessories:dark_brown_leather_belt`
   - `vespera_nightwhisper.recipe.json`: Changed `clothing:black_leather_collar_silver_bell` → `accessories:black_leather_collar_silver_bell`
   - `dylan_crace.recipe.json`: Changed 2 references (`black_tactical_work_belt` and `slate_nylon_baseball_cap`)
   - `len_amezua.recipe.json`: Changed 2 references (`black_tactical_work_belt` and `slate_nylon_baseball_cap`)

2. **Mod manifest updates (2 files):**
   - `fantasy/mod-manifest.json`: Added `accessories` dependency
   - `patrol/mod-manifest.json`: Added `accessories` dependency

### Validation Results

- `npm run validate`: ✅ Passed (0 violations across 42 mods)
- `npm run test:unit`: ✅ 36,868 tests passed
- `npm run test:integration`: ✅ 13,577 tests passed
- Grep verification: No recipe files contain old `clothing:*` references for accessory items

### No ticket corrections required

The ticket assumptions were verified against the actual codebase before implementation:
- All 5 recipe files existed at the specified paths
- All recipe files contained the expected `clothing:*` entity references
- The `accessories` mod with 14 entities (including all 4 referenced items) was already created by CLOLAYMIG-002
- Both `fantasy` and `patrol` mod manifests existed and required the `accessories` dependency addition
