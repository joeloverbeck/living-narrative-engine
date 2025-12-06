# CLOLAYMIG-004: Accessories - Remove from Clothing Mod

**Status: ✅ COMPLETED**

## Summary

Remove the 14 accessory entity files from the `clothing` mod and update its manifest, now that they have been migrated to the `accessories` mod.

## Dependencies

- CLOLAYMIG-003 (Accessories - Update References) must be completed ✅

## Files to Delete

Delete these 14 files from `data/mods/clothing/entities/definitions/`:

```
black_calfskin_belt.entity.json
black_diamond_silver_spike_collar.entity.json
black_leather_collar_silver_bell.entity.json
black_tactical_work_belt.entity.json
dark_brown_leather_belt.entity.json
layered_gold_chain_necklaces.entity.json
layered_pearl_choker.entity.json
mikimoto_delicate_pearl_strand.entity.json
platinum_necklace.entity.json
silver_chain_pendant_necklace.entity.json
slate_nylon_baseball_cap.entity.json
small_steel_huggie_hoops.entity.json
south_sea_pearl_necklace_16mm.entity.json
twisted_black_metal_crown_blood_red_gems.entity.json
```

## Files to Modify

### `data/mods/clothing/mod-manifest.json`

Remove these 14 entries from the `entities.definitions` array:

```
"black_calfskin_belt.entity.json"
"black_diamond_silver_spike_collar.entity.json"
"black_leather_collar_silver_bell.entity.json"
"black_tactical_work_belt.entity.json"
"dark_brown_leather_belt.entity.json"
"layered_gold_chain_necklaces.entity.json"
"layered_pearl_choker.entity.json"
"mikimoto_delicate_pearl_strand.entity.json"
"platinum_necklace.entity.json"
"silver_chain_pendant_necklace.entity.json"
"slate_nylon_baseball_cap.entity.json"
"small_steel_huggie_hoops.entity.json"
"south_sea_pearl_necklace_16mm.entity.json"
"twisted_black_metal_crown_blood_red_gems.entity.json"
```

After removal, the `clothing` mod should have **111 entity definitions** remaining (125 - 14 = 111).

## Out of Scope

- **DO NOT** modify any files in the `accessories` mod
- **DO NOT** modify any recipe files
- **DO NOT** modify any other mod manifests
- **DO NOT** delete any non-accessory entity files
- **DO NOT** modify any other sections of the `clothing` manifest (components, actions, rules, etc.)

## Files Summary

| File                                                    | Action                             |
| ------------------------------------------------------- | ---------------------------------- |
| `data/mods/clothing/mod-manifest.json`                  | Remove 14 entries from definitions |
| `data/mods/clothing/entities/definitions/*.entity.json` | Delete 14 files                    |

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate        # Schema validation passes - no duplicate entity warnings
npm run test:ci         # Full test suite passes
```

### Invariants That Must Remain True

1. The `clothing` mod has exactly 111 entity definitions remaining ✅
2. The `accessories` mod has exactly 14 entity definitions ✅
3. All recipe files continue to work (reference `accessories:*` IDs) ✅
4. No broken entity references anywhere in the codebase ✅
5. The game can start successfully with `npm run start` ✅
6. The clothing mod's components, actions, rules, events, conditions, and scopes are unchanged ✅

### Manual Verification

1. Count files in `data/mods/clothing/entities/definitions/` = 111 ✅
2. Verify `npm run validate` shows no duplicate entity warnings ✅
3. Run `npm run start` and verify the game loads ✅

### Verification Commands

```bash
# Count clothing entities (should be 111)
ls -1 data/mods/clothing/entities/definitions/*.entity.json | wc -l

# Count accessories entities (should be 14)
ls -1 data/mods/accessories/entities/definitions/*.entity.json | wc -l

# Verify no duplicate IDs
grep -r '"id": "clothing:black_tactical_work_belt"' data/mods/
# Should return 0 results
```

## Post-Completion State

After this ticket:

- **Accessories migration is complete**
- `clothing` mod: 111 entities (down from 125)
- `accessories` mod: 14 entities
- All accessory references point to `accessories:*`

## Rollback

```bash
# Restore deleted files from the accessories mod (they were copied)
for f in data/mods/accessories/entities/definitions/*.entity.json; do
  name=$(basename "$f")
  cp "$f" "data/mods/clothing/entities/definitions/$name"
  # Update ID back to clothing:*
  sed -i 's/"id": "accessories:/"id": "clothing:/g' "data/mods/clothing/entities/definitions/$name"
done

# Restore manifest
git checkout data/mods/clothing/mod-manifest.json
```

---

## Outcome

**Completed on:** 2025-11-25

### What was actually changed vs originally planned

**Planned Changes (all completed as specified):**

- ✅ Deleted 14 accessory entity files from `data/mods/clothing/entities/definitions/`
- ✅ Removed 14 entries from `data/mods/clothing/mod-manifest.json`

**Additional Changes Required (not in original scope):**

- Updated `tests/unit/clothing/entities/jon_urena_clothing_entities.test.js`:
  - Removed "Dark-Brown Leather Belt" test block (entity migrated to accessories mod)
  - Updated Cross-Entity Validation test to exclude belt file
  - Updated slot coverage expectations (removed torso_lower)
  - Updated layer distribution expectations (removed accessories count)
- Updated `tests/integration/clothing/beltBlockingEntities.integration.test.js`:
  - Changed entity file paths from `clothing` to `accessories` mod
- Updated `tests/integration/core/materialComponentMigration.integration.test.js`:
  - Changed `clothing:black_calfskin_belt` references to `accessories:black_calfskin_belt`

### Test Results

- Unit tests: 2233 suites, 36863 tests passed
- Integration tests: 1807 suites, 13577 tests passed
- Validation: PASSED with 0 violations across 42 mods

### Final State

- `clothing` mod: 111 entity definitions
- `accessories` mod: 14 entity definitions
- No duplicate entity IDs
- All tests passing
