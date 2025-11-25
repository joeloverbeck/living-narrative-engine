# CLOLAYMIG-014: Final Verification and Migration Completion

## Summary

Perform comprehensive verification of the clothing layer migration to confirm all 125 entities have been successfully migrated to their layer-specific mods and all references have been updated.

## Dependencies

- All previous tickets (CLOLAYMIG-001 through CLOLAYMIG-013) must be completed

## Verification Checklist

### Entity Count Verification

| Mod | Expected Count |
|-----|---------------|
| `clothing` | 0 entities |
| `underwear` | 33 entities |
| `base-clothing` | 68 entities |
| `outer-clothing` | 10 entities |
| `accessories` | 14 entities |
| **Total** | **125 entities** |

### Files to Inspect (NOT modify)

1. `data/mods/clothing/mod-manifest.json`
   - Verify `entities.definitions` array is empty
   - Verify components, actions, rules, events, conditions, scopes sections unchanged

2. `data/mods/underwear/mod-manifest.json`
   - Verify 33 entity definitions listed

3. `data/mods/base-clothing/mod-manifest.json`
   - Verify 68 entity definitions listed

4. `data/mods/outer-clothing/mod-manifest.json`
   - Verify 10 entity definitions listed

5. `data/mods/accessories/mod-manifest.json`
   - Verify 14 entity definitions listed

6. `data/game.json`
   - Verify load order: `clothing → underwear → base-clothing → outer-clothing → accessories → armor`

7. `data/mods/fantasy/mod-manifest.json`
   - Verify dependencies include: `underwear`, `base-clothing`, `outer-clothing`, `accessories`

8. `data/mods/patrol/mod-manifest.json`
   - Verify dependencies include: `underwear`, `base-clothing`, `accessories`
   - Note: `outer-clothing` dependency NOT required (no patrol recipes use outer items)

### Recipe Reference Verification

Verify no `clothing:*` entity references remain in recipe files:

| Recipe File | Expected `clothing:*` References |
|-------------|--------------------------------|
| `data/mods/fantasy/recipes/threadscar_melissa.recipe.json` | 0 |
| `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` | 0 |
| `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json` | 0 |
| `data/mods/patrol/recipes/dylan_crace.recipe.json` | 0 |
| `data/mods/patrol/recipes/len_amezua.recipe.json` | 0 |

## Out of Scope

- **DO NOT** modify any files
- **DO NOT** create any new files
- **DO NOT** delete any files
- This is a verification-only ticket

## Files Summary

| File | Action |
|------|--------|
| All files listed above | Inspect only, no modifications |

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate        # Schema validation passes - no duplicate warnings, no broken references
npm run test:ci         # Full test suite passes
npm run test:e2e        # E2E tests pass
```

### Verification Commands

```bash
# 1. Verify entity counts
echo "Clothing entities (should be 0):"
ls -1 data/mods/clothing/entities/definitions/*.entity.json 2>/dev/null | wc -l

echo "Underwear entities (should be 33):"
ls -1 data/mods/underwear/entities/definitions/*.entity.json | wc -l

echo "Base-clothing entities (should be 68):"
ls -1 data/mods/base-clothing/entities/definitions/*.entity.json | wc -l

echo "Outer-clothing entities (should be 10):"
ls -1 data/mods/outer-clothing/entities/definitions/*.entity.json | wc -l

echo "Accessories entities (should be 14):"
ls -1 data/mods/accessories/entities/definitions/*.entity.json | wc -l

# 2. Verify no clothing:* references in recipes
echo "Clothing references in recipes (should be 0):"
grep -r '"clothing:' data/mods/fantasy/recipes/*.recipe.json data/mods/patrol/recipes/*.recipe.json | wc -l

# 3. Verify no duplicate entity IDs
echo "Duplicate underwear IDs (should be 0):"
grep -r '"id": "underwear:' data/mods/ | cut -d: -f3 | sort | uniq -d | wc -l

echo "Duplicate base-clothing IDs (should be 0):"
grep -r '"id": "base-clothing:' data/mods/ | cut -d: -f3 | sort | uniq -d | wc -l

echo "Duplicate outer-clothing IDs (should be 0):"
grep -r '"id": "outer-clothing:' data/mods/ | cut -d: -f3 | sort | uniq -d | wc -l

echo "Duplicate accessories IDs (should be 0):"
grep -r '"id": "accessories:' data/mods/ | cut -d: -f3 | sort | uniq -d | wc -l
```

### Manual Verification

1. **Run the game**: `npm run start`
   - Verify game loads without errors

2. **Test character creation** with each recipe:
   - `threadscar_melissa` - Verify all clothing items load
   - `bertram_the_muddy` - Verify all clothing items load
   - `vespera_nightwhisper` - Verify all clothing items load
   - `dylan_crace` - Verify all clothing items load
   - `len_amezua` - Verify all clothing items load

3. **Verify clothing functionality**:
   - Test `remove_clothing` action works
   - Test `remove_others_clothing` action works
   - Verify clothing coverage system still works

### Invariants That Must Remain True

1. Total entity count across all clothing mods = 125
2. No duplicate entity IDs anywhere in the system
3. All recipe files load successfully
4. Character creation with all 5 recipes works
5. Clothing removal actions function correctly
6. Game loads and runs without errors
7. The `clothing` mod retains all non-entity content:
   - 5 components
   - 2 actions
   - 2 rules
   - 4 events
   - 2 conditions
   - 5 scopes

## Post-Verification Actions

If verification passes:
1. Update any project documentation that references clothing entity IDs
2. Notify team that migration is complete
3. Consider archiving the migration spec (`specs/clothing-layer-migration.md`)

If verification fails:
1. Document which checks failed
2. Create follow-up tickets to address issues
3. Do NOT mark this ticket complete until all checks pass

## Rollback

Not applicable - this is a verification-only ticket. If verification fails, previous tickets provide individual rollback procedures.

## Migration Complete Summary

Upon successful completion of this ticket:

| Metric | Before | After |
|--------|--------|-------|
| Total mods | clothing only | clothing + 4 layer mods |
| Clothing mod entities | 125 | 0 |
| Underwear mod entities | - | 33 |
| Base-clothing mod entities | - | 68 |
| Outer-clothing mod entities | - | 10 |
| Accessories mod entities | - | 14 |
| Recipe references updated | 0 | 32 |
| Mod dependencies added | 0 | 6 (fantasy: 4, patrol: 3, minus shared) |

The `clothing` mod is now a pure framework mod providing:
- Component definitions for wearable items
- Actions for clothing management
- Rules for clothing behavior
- Events for clothing state changes
- Conditions for clothing checks
- Scopes for clothing queries
