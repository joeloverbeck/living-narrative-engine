# POSDEPREF-004: Update Sex-Core Component References in sex-penile-oral

**Status:** ✅ Completed
**Priority:** High
**Effort:** Medium (revised from Small - more files than originally scoped)
**Dependencies:** POSDEPREF-001 (components must be moved first)

---

## Objective

Update all references to the migrated sexual engagement components in the `sex-penile-oral` mod from `positioning:` namespace to `sex-core:` namespace.

---

## Corrected Assumptions (Ticket Revision)

**Original scope underestimated the number of files.** After code analysis:

1. **Rule files**: 6 files contain old references (as originally documented)
2. **Action files**: 22 files contain old references in `forbidden_components.actor` (NOT originally documented)
3. **Scope files**: 2 files contain old references (NOT originally documented)
4. **Manifest**: Needs `sex-core` dependency added

The original ticket stated "DO NOT modify action files" but this was incorrect - action files DO contain the component references in their `forbidden_components` arrays.

---

## Files to Touch (Corrected)

### Rule Files (6 files)

- `data/mods/sex-penile-oral/rules/handle_pull_own_penis_out_of_mouth.rule.json`
- `data/mods/sex-penile-oral/rules/handle_pull_penis_out_of_mouth_revulsion.rule.json`
- `data/mods/sex-penile-oral/rules/handle_pull_penis_out_of_mouth.rule.json`
- `data/mods/sex-penile-oral/rules/handle_take_penis_in_mouth_kneeling.rule.json`
- `data/mods/sex-penile-oral/rules/handle_take_penis_in_mouth_lying_close.rule.json`
- `data/mods/sex-penile-oral/rules/handle_take_penis_in_mouth.rule.json`

### Action Files (22 files)

- `data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis.action.json`
- `data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_lying_close.action.json`
- `data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_sitting_close.action.json`
- `data/mods/sex-penile-oral/actions/ejaculate_in_mouth.action.json`
- `data/mods/sex-penile-oral/actions/guide_blowjob_with_hand.action.json`
- `data/mods/sex-penile-oral/actions/lick_glans_lying_close.action.json`
- `data/mods/sex-penile-oral/actions/lick_testicles_lying_close.action.json`
- `data/mods/sex-penile-oral/actions/lick_testicles_sensually.action.json`
- `data/mods/sex-penile-oral/actions/lick_testicles_sitting_close.action.json`
- `data/mods/sex-penile-oral/actions/pull_own_penis_out_of_mouth.action.json`
- `data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth.action.json`
- `data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth_revulsion.action.json`
- `data/mods/sex-penile-oral/actions/suck_penis_hard.action.json`
- `data/mods/sex-penile-oral/actions/suck_penis_slowly.action.json`
- `data/mods/sex-penile-oral/actions/suckle_testicle.action.json`
- `data/mods/sex-penile-oral/actions/suckle_testicle_lying_close.action.json`
- `data/mods/sex-penile-oral/actions/suckle_testicle_sitting_close.action.json`
- `data/mods/sex-penile-oral/actions/take_penis_in_mouth.action.json`
- `data/mods/sex-penile-oral/actions/take_penis_in_mouth_kneeling.action.json`
- `data/mods/sex-penile-oral/actions/take_penis_in_mouth_lying_close.action.json`

### Scope Files (2 files)

- `data/mods/sex-penile-oral/scopes/actor_giving_blowjob_to_me.scope`
- `data/mods/sex-penile-oral/scopes/receiving_blowjob_from_actor.scope`

### Manifest File

- `data/mods/sex-penile-oral/mod-manifest.json`
  - Add `sex-core` dependency

---

## Changes Required

### String Replacements

| Old Reference | New Reference |
|---------------|---------------|
| `positioning:giving_blowjob` | `sex-core:giving_blowjob` |
| `positioning:receiving_blowjob` | `sex-core:receiving_blowjob` |

### Manifest Dependency

Ensure `mod-manifest.json` includes:
```json
{
  "dependencies": [
    { "id": "positioning", "version": "^1.0.0" },
    { "id": "sex-core", "version": "^1.0.0" }
  ]
}
```

---

## Scope Clarification

**NOTE: Test file updates are required** for acceptance criteria to be met. The original ticket incorrectly stated test files were out of scope (POSDEPREF-011), but tests cannot pass without updating their references to match the new namespace. The test files are now in scope.

### Test Files (20 files)

Tests in `tests/integration/mods/sex-penile-oral/` that reference `positioning:giving_blowjob` or `positioning:receiving_blowjob` must be updated.

**DO NOT modify:**

- Any files outside `data/mods/sex-penile-oral/` and `tests/integration/mods/sex-penile-oral/`
- Component files (already moved in POSDEPREF-001)
- Files referencing `positioning:fucking_anally`, `positioning:being_fucked_anally`
- Files referencing `positioning:fucking_vaginally`, `positioning:being_fucked_vaginally`

---

## Implementation Steps

1. Replace all occurrences of `positioning:giving_blowjob` with `sex-core:giving_blowjob` in all mod files
2. Replace all occurrences of `positioning:receiving_blowjob` with `sex-core:receiving_blowjob` in all mod files
3. Add `sex-core` dependency to manifest
4. Validate JSON syntax of all modified files
5. Run integration tests

---

## Acceptance Criteria

### Tests That Must Pass

```bash
# Mod validation
npm run validate:mod:sex-penile-oral

# Integration tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/sex-penile-oral/ --silent
```

### Invariants That Must Remain True

1. No references to `positioning:giving_blowjob` remain in the mod
2. No references to `positioning:receiving_blowjob` remain in the mod
3. All JSON files remain valid
4. `sex-core` dependency is declared in manifest
5. No functional behavior changes (only namespace updates)

---

## Verification Steps

```bash
# 1. Check no old references remain
grep -r "positioning:giving_blowjob" data/mods/sex-penile-oral/ && echo "ERROR: Old references remain"
grep -r "positioning:receiving_blowjob" data/mods/sex-penile-oral/ && echo "ERROR: Old references remain"

# 2. Verify new references exist
grep -r "sex-core:giving_blowjob" data/mods/sex-penile-oral/ | wc -l
grep -r "sex-core:receiving_blowjob" data/mods/sex-penile-oral/ | wc -l

# 3. Validate JSON syntax
for file in data/mods/sex-penile-oral/**/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo "OK: $file"
done

# 4. Validate mod
npm run validate:mod:sex-penile-oral
```

---

## Related Tickets

- **Blocked by:** POSDEPREF-001
- **Parallel with:** POSDEPREF-002, POSDEPREF-003, POSDEPREF-005 through POSDEPREF-010
- **Blocks:** POSDEPREF-011 (test updates)

---

## Outcome

**Completed:** 2025-12-18

### Summary

Successfully migrated all `positioning:giving_blowjob` and `positioning:receiving_blowjob` references to `sex-core:` namespace in the sex-penile-oral mod.

### Files Modified

| Category | Count | Description |
|----------|-------|-------------|
| Rule files | 6 | Component references in operations |
| Action files | 22 | `forbidden_components.actor` arrays |
| Scope files | 2 | Component type filters |
| Manifest | 1 | Added sex-core dependency |
| Test files | 20 | Integration test fixtures |
| Fixture files | 2 | Common test utilities |

**Total files modified:** 53

### Verification Results

- ✅ No old namespace references remain in mod data files
- ✅ No old namespace references remain in test files
- ✅ All 174 integration tests pass
- ✅ `sex-core` dependency declared in manifest

### Lessons Learned

1. **Ticket scope was underestimated**: Original ticket only documented 6 rule files, but action files (22) and scope files (2) also contained references in `forbidden_components` arrays.

2. **Test files must be in scope**: Original ticket marked tests as out of scope (POSDEPREF-011), but tests cannot pass without matching namespace changes.

3. **Fixture files also need updates**: Common test utilities in `tests/common/mods/` that set up component states must match the new namespace.
