# POSDEPREF-003: Update Sex-Core Component References in sex-vaginal-penetration

**Status:** ✅ Completed (2025-12-18)
**Priority:** High
**Effort:** Small
**Dependencies:** POSDEPREF-001 (components must be moved first)

---

## Objective

Update all references to the migrated sexual engagement components in the `sex-vaginal-penetration` mod from `positioning:` namespace to `sex-core:` namespace.

---

## Reassessed Assumptions (Corrected 2025-12-18)

1. **Manifest dependency already exists** - `sex-core` is already declared as a dependency in `mod-manifest.json` (lines 24-27). No manifest changes needed.
2. **Test files MUST be updated** - Original ticket marked tests as "Out of Scope" for POSDEPREF-011, but 13 test files contain old namespace references. These must be updated atomically with mod files to avoid test failures.
3. **Other `positioning:` references must be preserved** - Files contain references to `positioning:closeness`, `positioning:sitting_on`, and positioning conditions that must NOT be changed.

---

## Files to Touch

### Action Files (7 files)

- `data/mods/sex-vaginal-penetration/actions/insert_penis_into_vagina.action.json`
- `data/mods/sex-vaginal-penetration/actions/insert_primary_penis_into_your_vagina.action.json`
- `data/mods/sex-vaginal-penetration/actions/slide_penis_along_labia.action.json`
- `data/mods/sex-vaginal-penetration/actions/pull_penis_out_of_vagina.action.json`
- `data/mods/sex-vaginal-penetration/actions/ride_penis_greedily.action.json`
- `data/mods/sex-vaginal-penetration/actions/straddling_penis_milking.action.json`
- `data/mods/sex-vaginal-penetration/actions/thrust_penis_slowly_and_tenderly.action.json`

### Rule Files (5 files with vaginal references)

- `data/mods/sex-vaginal-penetration/rules/handle_insert_penis_into_vagina.rule.json`
- `data/mods/sex-vaginal-penetration/rules/handle_insert_primary_penis_into_your_vagina.rule.json`
- `data/mods/sex-vaginal-penetration/rules/handle_pull_penis_out_of_vagina.rule.json`
- `data/mods/sex-vaginal-penetration/rules/handle_ride_penis_greedily.rule.json`
- `data/mods/sex-vaginal-penetration/rules/handle_straddling_penis_milking.rule.json`

### Scope Files (2 files)

- `data/mods/sex-vaginal-penetration/scopes/actors_being_fucked_vaginally_by_me.scope`
- `data/mods/sex-vaginal-penetration/scopes/actors_fucking_me_vaginally.scope`

### Test Files (13 files - updated scope from POSDEPREF-011)

- `tests/integration/mods/sex-vaginal-penetration/insert_penis_into_vagina_action.test.js`
- `tests/integration/mods/sex-vaginal-penetration/insert_penis_into_vagina_action_discovery.test.js`
- `tests/integration/mods/sex-vaginal-penetration/insert_primary_penis_into_your_vagina_action.test.js`
- `tests/integration/mods/sex-vaginal-penetration/insert_primary_penis_into_your_vagina_action_discovery.test.js`
- `tests/integration/mods/sex-vaginal-penetration/pull_penis_out_of_vagina_action.test.js`
- `tests/integration/mods/sex-vaginal-penetration/ride_penis_greedily_action.test.js`
- `tests/integration/mods/sex-vaginal-penetration/ride_penis_greedily_action_discovery.test.js`
- `tests/integration/mods/sex-vaginal-penetration/slide_penis_along_labia_action_discovery.test.js`
- `tests/integration/mods/sex-vaginal-penetration/straddling_penis_milking_action.test.js`
- `tests/integration/mods/sex-vaginal-penetration/straddling_penis_milking_action_discovery.test.js`
- `tests/integration/mods/sex-vaginal-penetration/thrust_penis_slowly_and_tenderly_action.test.js`
- `tests/integration/mods/sex-vaginal-penetration/thrust_penis_slowly_and_tenderly_action_discovery.test.js`
- `tests/integration/mods/sex-vaginal-penetration/vaginal_penetration_workflow.test.js`

### Manifest File - NO CHANGES NEEDED

- `data/mods/sex-vaginal-penetration/mod-manifest.json` already has `sex-core` dependency

---

## Changes Required

### String Replacements (ONLY these two patterns)

| Old Reference | New Reference |
|---------------|---------------|
| `positioning:fucking_vaginally` | `sex-core:fucking_vaginally` |
| `positioning:being_fucked_vaginally` | `sex-core:being_fucked_vaginally` |

### DO NOT Change

- `positioning:closeness` - Valid positioning component
- `positioning:sitting_on` - Valid positioning component
- `positioning:receiving_blowjob` - Different migration ticket (POSDEPREF-004)
- `positioning:` condition references - Valid positioning conditions

---

## Out of Scope

**DO NOT modify:**

- Any files outside `data/mods/sex-vaginal-penetration/` or its test directory
- Component files (already moved in POSDEPREF-001)
- References to `positioning:giving_blowjob` or `positioning:receiving_blowjob` (POSDEPREF-004)
- References to `positioning:fucking_anally` or `positioning:being_fucked_anally` (POSDEPREF-002)
- References to `positioning:closeness`, `positioning:sitting_on`, or positioning conditions

---

## Implementation Steps

1. Replace `positioning:fucking_vaginally` → `sex-core:fucking_vaginally` in all mod and test files
2. Replace `positioning:being_fucked_vaginally` → `sex-core:being_fucked_vaginally` in all mod and test files
3. Validate JSON syntax of all modified files
4. Run integration tests to verify changes

---

## Acceptance Criteria

### Tests That Must Pass

```bash
# Integration tests (includes mod validation via fixture setup)
NODE_ENV=test npm run test:integration -- tests/integration/mods/sex-vaginal-penetration/ --silent
```

### Invariants That Must Remain True

1. No references to `positioning:fucking_vaginally` remain in the mod or tests
2. No references to `positioning:being_fucked_vaginally` remain in the mod or tests
3. All JSON files remain valid
4. `sex-core` dependency is declared in manifest (already satisfied)
5. Other `positioning:` references remain unchanged
6. No functional behavior changes (only namespace updates)

---

## Verification Steps

```bash
# 1. Check no old references remain (mod files)
grep -r "positioning:fucking_vaginally" data/mods/sex-vaginal-penetration/ && echo "ERROR: Old references remain"
grep -r "positioning:being_fucked_vaginally" data/mods/sex-vaginal-penetration/ && echo "ERROR: Old references remain"

# 2. Check no old references remain (test files)
grep -r "positioning:fucking_vaginally" tests/integration/mods/sex-vaginal-penetration/ && echo "ERROR: Old test references remain"
grep -r "positioning:being_fucked_vaginally" tests/integration/mods/sex-vaginal-penetration/ && echo "ERROR: Old test references remain"

# 3. Verify new references exist
grep -r "sex-core:fucking_vaginally" data/mods/sex-vaginal-penetration/ | wc -l
grep -r "sex-core:being_fucked_vaginally" data/mods/sex-vaginal-penetration/ | wc -l

# 4. Verify other positioning references still exist (should not be zero)
grep -r "positioning:closeness" data/mods/sex-vaginal-penetration/ | wc -l

# 5. Run tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/sex-vaginal-penetration/ --silent
```

---

## Related Tickets

- **Blocked by:** POSDEPREF-001
- **Parallel with:** POSDEPREF-002, POSDEPREF-004 through POSDEPREF-010
- **Supersedes for tests:** POSDEPREF-011 (test updates now included in this ticket)

---

## Outcome (2025-12-18)

### What Was Actually Changed vs. Originally Planned

**Originally Planned:**
- Update references in mod files only (14 files)
- Test file updates deferred to separate ticket POSDEPREF-011
- May need to add `sex-core` dependency to manifest

**Actually Changed:**
- Updated 14 mod files (7 actions, 5 rules, 2 scopes) as planned
- Updated 13 integration test files (not originally in scope)
- Updated 4 fixture files in `tests/common/mods/sex-vaginal-penetration/` and `tests/common/mods/sex/`
- No manifest changes needed (dependency already existed)

### Files Modified (Total: 31 files)

**Mod Files (14):**
- 7 action JSON files
- 5 rule JSON files
- 2 scope files

**Test Files (17):**
- 13 integration test files in `tests/integration/mods/sex-vaginal-penetration/`
- 2 fixture files in `tests/common/mods/sex-vaginal-penetration/`
- 2 fixture files in `tests/common/mods/sex/`

### Verification Results

- ✅ No old references to `positioning:fucking_vaginally` remain
- ✅ No old references to `positioning:being_fucked_vaginally` remain
- ✅ 35 new `sex-core:` references in mod files
- ✅ 52 new `sex-core:` references in test files
- ✅ Other `positioning:` references preserved (11 closeness, 5 sitting_on)
- ✅ All 124 integration tests pass

### Key Learnings

1. Test files must be updated atomically with mod files to prevent test failures
2. Fixture files in `tests/common/mods/` also need updates, not just integration tests
3. The manifest dependency was already in place, so no manifest changes were needed
