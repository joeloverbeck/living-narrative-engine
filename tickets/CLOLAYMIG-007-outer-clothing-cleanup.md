# CLOLAYMIG-007: Outer-Clothing - Remove from Clothing Mod

## Summary

Remove the 10 outer-clothing entity files from the `clothing` mod and update its manifest, now that they have been migrated to the `outer-clothing` mod.

## Dependencies

- CLOLAYMIG-006 (Outer-Clothing - Update References) must be completed

## Files to Delete

Delete these 10 files from `data/mods/clothing/entities/definitions/`:

```
battle_scarred_leather_jacket.entity.json
charcoal_heather_zip_up_hoodie.entity.json
dark_olive_cotton_twill_chore_jacket.entity.json
floor_length_black_leather_coat.entity.json
flowing_cape_blood_red.entity.json
indigo_denim_trucker_jacket.entity.json
leather_work_apron.entity.json
military_coat_midnight_blue_gold_epaulettes.entity.json
pale_pink_fleece_hoodie_heart_patches.entity.json
white_structured_linen_blazer.entity.json
```

## Files to Modify

### `data/mods/clothing/mod-manifest.json`

Remove these 10 entries from the `entities.definitions` array:

```
"battle_scarred_leather_jacket.entity.json"
"charcoal_heather_zip_up_hoodie.entity.json"
"dark_olive_cotton_twill_chore_jacket.entity.json"
"floor_length_black_leather_coat.entity.json"
"flowing_cape_blood_red.entity.json"
"indigo_denim_trucker_jacket.entity.json"
"leather_work_apron.entity.json"
"military_coat_midnight_blue_gold_epaulettes.entity.json"
"pale_pink_fleece_hoodie_heart_patches.entity.json"
"white_structured_linen_blazer.entity.json"
```

**Entity count after this ticket depends on prior completions:**
- If CLOLAYMIG-004 (accessories) is complete: 111 - 10 = **101 entities**
- If only this ticket: 125 - 10 = 115 entities

## Out of Scope

- **DO NOT** modify any files in the `outer-clothing` mod
- **DO NOT** modify any recipe files
- **DO NOT** modify any other mod manifests
- **DO NOT** delete any non-outer-clothing entity files
- **DO NOT** modify any other sections of the `clothing` manifest (components, actions, rules, etc.)

## Files Summary

| File | Action |
|------|--------|
| `data/mods/clothing/mod-manifest.json` | Remove 10 entries from definitions |
| `data/mods/clothing/entities/definitions/*.entity.json` | Delete 10 files |

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate        # Schema validation passes - no duplicate entity warnings for outer items
npm run test:ci         # Full test suite passes
```

### Invariants That Must Remain True

1. The `outer-clothing` mod has exactly 10 entity definitions
2. All recipe files continue to work (reference `outer-clothing:*` IDs)
3. No broken entity references anywhere in the codebase
4. The game can start successfully with `npm run start`
5. The clothing mod's components, actions, rules, events, conditions, and scopes are unchanged

### Manual Verification

1. Count files in `data/mods/outer-clothing/entities/definitions/` = 10
2. Verify `npm run validate` shows no duplicate entity warnings for outer items
3. Run `npm run start` and verify the game loads

### Verification Commands

```bash
# Count outer-clothing entities (should be 10)
ls -1 data/mods/outer-clothing/entities/definitions/*.entity.json | wc -l

# Verify no duplicate IDs
grep -r '"id": "clothing:battle_scarred_leather_jacket"' data/mods/
# Should return 0 results
```

## Post-Completion State

After this ticket:
- **Outer-clothing migration is complete**
- `outer-clothing` mod: 10 entities
- All outer-clothing references point to `outer-clothing:*`

## Rollback

```bash
# Restore deleted files from the outer-clothing mod (they were copied)
for f in data/mods/outer-clothing/entities/definitions/*.entity.json; do
  name=$(basename "$f")
  cp "$f" "data/mods/clothing/entities/definitions/$name"
  # Update ID back to clothing:*
  sed -i 's/"id": "outer-clothing:/"id": "clothing:/g' "data/mods/clothing/entities/definitions/$name"
done

# Restore manifest
git checkout data/mods/clothing/mod-manifest.json
```
