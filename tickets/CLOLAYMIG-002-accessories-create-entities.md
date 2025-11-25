# CLOLAYMIG-002: Accessories - Create Entities in New Mod

## Summary

Copy 14 accessory entity files from `clothing` mod to `accessories` mod and update their entity IDs from `clothing:*` to `accessories:*`.

## Dependencies

- CLOLAYMIG-001 (Infrastructure Setup) must be completed

## Entity List (14 items)

| Current File | Current ID | New ID |
|--------------|-----------|--------|
| `black_calfskin_belt.entity.json` | `clothing:black_calfskin_belt` | `accessories:black_calfskin_belt` |
| `black_diamond_silver_spike_collar.entity.json` | `clothing:black_diamond_silver_spike_collar` | `accessories:black_diamond_silver_spike_collar` |
| `black_leather_collar_silver_bell.entity.json` | `clothing:black_leather_collar_silver_bell` | `accessories:black_leather_collar_silver_bell` |
| `black_tactical_work_belt.entity.json` | `clothing:black_tactical_work_belt` | `accessories:black_tactical_work_belt` |
| `dark_brown_leather_belt.entity.json` | `clothing:dark_brown_leather_belt` | `accessories:dark_brown_leather_belt` |
| `layered_gold_chain_necklaces.entity.json` | `clothing:layered_gold_chain_necklaces` | `accessories:layered_gold_chain_necklaces` |
| `layered_pearl_choker.entity.json` | `clothing:layered_pearl_choker` | `accessories:layered_pearl_choker` |
| `mikimoto_delicate_pearl_strand.entity.json` | `clothing:mikimoto_delicate_pearl_strand` | `accessories:mikimoto_delicate_pearl_strand` |
| `platinum_necklace.entity.json` | `clothing:platinum_necklace` | `accessories:platinum_necklace` |
| `silver_chain_pendant_necklace.entity.json` | `clothing:silver_chain_pendant_necklace` | `accessories:silver_chain_pendant_necklace` |
| `slate_nylon_baseball_cap.entity.json` | `clothing:slate_nylon_baseball_cap` | `accessories:slate_nylon_baseball_cap` |
| `small_steel_huggie_hoops.entity.json` | `clothing:small_steel_huggie_hoops` | `accessories:small_steel_huggie_hoops` |
| `south_sea_pearl_necklace_16mm.entity.json` | `clothing:south_sea_pearl_necklace_16mm` | `accessories:south_sea_pearl_necklace_16mm` |
| `twisted_black_metal_crown_blood_red_gems.entity.json` | `clothing:twisted_black_metal_crown_blood_red_gems` | `accessories:twisted_black_metal_crown_blood_red_gems` |

## Files to Create

Copy each file from `data/mods/clothing/entities/definitions/` to `data/mods/accessories/entities/definitions/` and update the `id` field:

```
data/mods/accessories/entities/definitions/
├── black_calfskin_belt.entity.json
├── black_diamond_silver_spike_collar.entity.json
├── black_leather_collar_silver_bell.entity.json
├── black_tactical_work_belt.entity.json
├── dark_brown_leather_belt.entity.json
├── layered_gold_chain_necklaces.entity.json
├── layered_pearl_choker.entity.json
├── mikimoto_delicate_pearl_strand.entity.json
├── platinum_necklace.entity.json
├── silver_chain_pendant_necklace.entity.json
├── slate_nylon_baseball_cap.entity.json
├── small_steel_huggie_hoops.entity.json
├── south_sea_pearl_necklace_16mm.entity.json
└── twisted_black_metal_crown_blood_red_gems.entity.json
```

## Files to Modify

### `data/mods/accessories/mod-manifest.json`

Add all 14 entity files to the `definitions` array:

```json
"content": {
  "entities": {
    "definitions": [
      "black_calfskin_belt.entity.json",
      "black_diamond_silver_spike_collar.entity.json",
      "black_leather_collar_silver_bell.entity.json",
      "black_tactical_work_belt.entity.json",
      "dark_brown_leather_belt.entity.json",
      "layered_gold_chain_necklaces.entity.json",
      "layered_pearl_choker.entity.json",
      "mikimoto_delicate_pearl_strand.entity.json",
      "platinum_necklace.entity.json",
      "silver_chain_pendant_necklace.entity.json",
      "slate_nylon_baseball_cap.entity.json",
      "small_steel_huggie_hoops.entity.json",
      "south_sea_pearl_necklace_16mm.entity.json",
      "twisted_black_metal_crown_blood_red_gems.entity.json"
    ],
    "instances": []
  }
}
```

## Out of Scope

- **DO NOT** delete any files from `clothing` mod yet
- **DO NOT** modify `clothing/mod-manifest.json`
- **DO NOT** modify any recipe files
- **DO NOT** modify any mod manifests other than `accessories/mod-manifest.json`
- **DO NOT** modify any other mods' dependencies

## Entity ID Update Pattern

For each copied file, update only the `id` field:

```diff
- "id": "clothing:black_calfskin_belt",
+ "id": "accessories:black_calfskin_belt",
```

**Do not change any other fields in the entity files.**

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate        # Schema validation passes (may show duplicate entity warnings - expected)
npm run test:ci         # Full test suite passes
```

### Invariants That Must Remain True

1. The `clothing` mod still contains all 125 entity definitions (unchanged)
2. All recipe files continue to work (still reference `clothing:*` IDs)
3. The `accessories` mod loads successfully with 14 entities
4. Each entity in `accessories` has correct `accessories:*` ID prefix
5. Entity file names remain identical (only content changes)

### Manual Verification

1. Count files in `data/mods/accessories/entities/definitions/` = 14
2. Verify each file has `"id": "accessories:..."` (not `clothing:...`)
3. Run `npm run validate` - should pass (duplicate warnings are acceptable temporarily)

## Rollback

```bash
rm -rf data/mods/accessories/entities/definitions/*.entity.json
# Reset manifest to empty definitions array
```
