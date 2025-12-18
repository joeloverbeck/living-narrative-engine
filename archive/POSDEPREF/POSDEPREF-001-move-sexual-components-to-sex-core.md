# POSDEPREF-001: Move Sexual Engagement Components to sex-core

**Status:** ✅ Completed
**Priority:** High
**Effort:** Small
**Dependencies:** None (first ticket in sequence)
**Completed:** 2025-12-18

---

## Objective

Move 6 sexual engagement state components from `positioning` mod to `sex-core` mod, establishing proper domain boundaries.

---

## Files to Touch

### Files to MOVE (6 component files)

| Source | Destination |
|--------|-------------|
| `data/mods/positioning/components/fucking_anally.component.json` | `data/mods/sex-core/components/` |
| `data/mods/positioning/components/being_fucked_anally.component.json` | `data/mods/sex-core/components/` |
| `data/mods/positioning/components/fucking_vaginally.component.json` | `data/mods/sex-core/components/` |
| `data/mods/positioning/components/being_fucked_vaginally.component.json` | `data/mods/sex-core/components/` |
| `data/mods/positioning/components/giving_blowjob.component.json` | `data/mods/sex-core/components/` |
| `data/mods/positioning/components/receiving_blowjob.component.json` | `data/mods/sex-core/components/` |

### Files to EDIT (2 manifest files)

1. **`data/mods/positioning/mod-manifest.json`**
   - Remove these 6 entries from `content.components` array:
     - `"fucking_anally.component.json"`
     - `"being_fucked_anally.component.json"`
     - `"fucking_vaginally.component.json"`
     - `"being_fucked_vaginally.component.json"`
     - `"giving_blowjob.component.json"`
     - `"receiving_blowjob.component.json"`

2. **`data/mods/sex-core/mod-manifest.json`**
   - Add these 6 entries to `content.components` array:
     - `"fucking_anally.component.json"`
     - `"being_fucked_anally.component.json"`
     - `"fucking_vaginally.component.json"`
     - `"being_fucked_vaginally.component.json"`
     - `"giving_blowjob.component.json"`
     - `"receiving_blowjob.component.json"`

---

## Out of Scope

**DO NOT modify or move:**

- `data/mods/positioning/components/biting_neck.component.json` (vampirism mod)
- `data/mods/positioning/components/being_bitten_in_neck.component.json` (vampirism mod)
- `data/mods/positioning/scopes/actor_being_bitten_by_me.scope` (vampirism mod)
- `data/mods/positioning/scopes/actor_biting_my_neck.scope` (vampirism mod)
- `data/mods/positioning/components/doing_complex_performance.component.json` (stays in positioning)
- `data/mods/positioning/components/wielding.component.json` (separate ticket POSDEPREF-013)
- Any action files
- Any rule files
- Any scope files
- Any condition files
- Any test files (separate ticket POSDEPREF-011)
- Any files referencing these components (separate tickets POSDEPREF-002 through POSDEPREF-010)

---

## Implementation Steps

1. Create `data/mods/sex-core/components/` directory if it doesn't exist
2. Move the 6 component files from positioning to sex-core
3. Update `data/mods/positioning/mod-manifest.json` to remove the 6 component entries
4. Update `data/mods/sex-core/mod-manifest.json` to add the 6 component entries
5. Update component IDs inside each moved file from `positioning:*` to `sex-core:*`

---

## Acceptance Criteria

### Tests That Must Pass

```bash
# Mod validation (corrected syntax)
npm run validate:mod -- positioning
npm run validate:mod -- sex-core
```

**Note:** Full test suite will NOT pass until POSDEPREF-002 through POSDEPREF-011 are complete (component references need updating).

### Invariants That Must Remain True

1. Each moved component file has its `id` field updated to use `sex-core:` namespace
2. `data/mods/positioning/mod-manifest.json` no longer references the 6 moved components
3. `data/mods/sex-core/mod-manifest.json` now references all 6 moved components
4. No duplicate component definitions exist
5. Component file structure (schema, properties) remains unchanged except for `id` field

---

## Verification Steps

```bash
# 1. Verify files were moved correctly
ls data/mods/sex-core/components/

# 2. Verify files were removed from positioning
ls data/mods/positioning/components/ | grep -E "(fucking|blowjob)" && echo "ERROR: Files still in positioning"

# 3. Validate JSON syntax
for file in data/mods/sex-core/components/*.component.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 4. Validate mod manifests
npm run validate:mod -- positioning
npm run validate:mod -- sex-core

# 5. Verify component IDs were updated
grep -l '"sex-core:' data/mods/sex-core/components/*.component.json | wc -l
# Should output: 6
```

---

## Rollback Plan

If issues are discovered:

```bash
# Move components back
mv data/mods/sex-core/components/fucking_anally.component.json data/mods/positioning/components/
mv data/mods/sex-core/components/being_fucked_anally.component.json data/mods/positioning/components/
mv data/mods/sex-core/components/fucking_vaginally.component.json data/mods/positioning/components/
mv data/mods/sex-core/components/being_fucked_vaginally.component.json data/mods/positioning/components/
mv data/mods/sex-core/components/giving_blowjob.component.json data/mods/positioning/components/
mv data/mods/sex-core/components/receiving_blowjob.component.json data/mods/positioning/components/

# Restore manifests from git
git checkout -- data/mods/positioning/mod-manifest.json data/mods/sex-core/mod-manifest.json

# Update component IDs back to positioning namespace
```

---

## Related Tickets

- **Blocks:** POSDEPREF-002 through POSDEPREF-011 (all depend on components being moved first)
- **Blocked by:** None

---

## Outcome

### What Was Actually Changed

1. **Created** `data/mods/sex-core/components/` directory
2. **Moved** 6 component files from `data/mods/positioning/components/` to `data/mods/sex-core/components/`:
   - `fucking_anally.component.json`
   - `being_fucked_anally.component.json`
   - `fucking_vaginally.component.json`
   - `being_fucked_vaginally.component.json`
   - `giving_blowjob.component.json`
   - `receiving_blowjob.component.json`
3. **Updated** component IDs in each moved file from `positioning:*` to `sex-core:*`
4. **Updated** `data/mods/positioning/mod-manifest.json` - removed 6 component entries
5. **Updated** `data/mods/sex-core/mod-manifest.json` - added 6 component entries

### Discrepancies Found and Corrected in Ticket

1. **Validation command syntax** - Ticket had incorrect `npm run validate:mod:positioning` syntax; corrected to `npm run validate:mod -- positioning`

### Verification Results

- ✅ `npm run validate:mod -- positioning` passes with 0 violations
- ✅ `npm run validate:mod -- sex-core` passes with 0 violations
- ✅ All 6 component files have valid JSON syntax
- ✅ All 6 component IDs updated to `sex-core:` namespace
- ✅ No duplicate component definitions

### Tests Not Modified (Out of Scope)

As specified in the ticket, 20+ test files still reference the old `positioning:*` component IDs. These will be updated in POSDEPREF-011.
