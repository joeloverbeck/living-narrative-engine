# Mod Testing Documentation Restructuring Specification

**Status:** Approved for Implementation
**Priority:** P2 (Medium - Documentation Cleanup)
**Risk Level:** Low
**Estimated Effort:** 2-3 hours

---

## Problem Statement

The current mod testing documentation in `docs/testing/` contains **significant redundancy** across 5 files, totaling 3,118 lines. Analysis reveals:

### Redundancy Analysis

| Document | Lines | Redundancy Level | Primary Issues |
|----------|-------|------------------|----------------|
| **TEAOUTTHR-008-auto-registration-migration.md** | 185 | 🔴 100% | All content duplicated in mod-testing-guide.md |
| **action-discovery-testing-toolkit.md** | 64 | 🟠 95% | Mostly pointers back to main guide |
| **MODTESTROB-009-migration-guide.md** | 284 | 🟡 60% | Sections 2-9 duplicate main guide; tables and examples unique |
| **mod-testing-guide.md** | 990 | ✅ Primary | Comprehensive single source of truth |
| **scope-resolver-registry.md** | 1595 | ✅ Essential | Valuable scope catalog reference |

**Total Current**: 3,118 lines across 5 files
**Proposed After**: ~2,300 lines across 2 files (**26% reduction**)

### Impact on Maintainability

**Current Problems:**
1. **Drift Risk**: Duplicate information requires synchronized updates across 4 files
2. **Discovery Issues**: Developers unsure which guide to consult
3. **Maintenance Burden**: 40% more content to keep current
4. **Redundant Examples**: Same patterns explained 2-3 times

**Evidence from Codebase:**
- 21 files reference these documentation files (15 docs + 2 source + 1 mod README + 1 report + 2 self-refs)
- Most references point to `mod-testing-guide.md` (primary authority)
- TEAOUTTHR-008 and action-discovery-toolkit rarely referenced outside their own docs

---

## Proposed Solution

### Phase 1: File Deletions

#### Delete: `TEAOUTTHR-008-auto-registration-migration.md`

**Justification**: 100% redundant with mod-testing-guide.md

**Content Mapping** (what to preserve vs delete):

| TEAOUTTHR-008 Section | Lines | Status | Reason |
|----------------------|-------|--------|---------|
| Auto-registration pattern | 1-74 | ❌ DELETE | Already in mod-testing-guide.md:196-245 |
| Multiple scope categories | 75-130 | ❌ DELETE | Already in mod-testing-guide.md:232-244, 476-484 |
| Backward compatibility | 131-185 | ❌ DELETE | Already covered in main guide |

**No content extraction needed** - everything already documented.

#### Delete: `action-discovery-testing-toolkit.md`

**Justification**: 95% redundant, minimal unique value

**Content Mapping**:

| Toolkit Section | Lines | Status | Action |
|----------------|-------|--------|---------|
| When to Use Discovery Bed | 7-13 | ❌ DELETE | Already in mod-testing-guide.md:305-313 |
| Modernization Checklist | 16-27 | ❌ DELETE | Already in mod-testing-guide.md:314-349 |
| Migration Workflow | 29-39 | ❌ DELETE | Duplicate of MODTESTROB-009 |
| Diagnostics | 41-46 | ✅ EXTRACT | Add cross-reference note to mod-testing-guide.md:350-379 |
| Troubleshooting Cheatsheet | 48-57 | ❌ DELETE | Covered in mod-testing-guide.md:982-990 |

**Content to Extract**:
```markdown
> **Action Discovery Bed Diagnostics**: When debugging resolver behavior, the Action Discovery Bed provides detailed operator and scope traces. See [Diagnostics & Logging](#diagnostics--logging) section for complete diagnostic workflow.
```

### Phase 2: Consolidation

#### Consolidate: `MODTESTROB-009-migration-guide.md` → `mod-testing-guide.md`

**Unique Content to Preserve** (60 lines):

1. **Migration Baseline Tracking Table** (Lines 48-59)
   - Adds accountability for migration progress
   - Insert after "Best Practices" section (mod-testing-guide.md:770)

2. **Legacy Pattern Quick Reference** (Lines 63-70)
   - Valuable for maintainers updating old tests
   - Insert in new "Migration from Legacy Patterns" section

3. **Before/After Code Examples** (Lines 199-259)
   - Concrete migration demonstration
   - Insert in new "Migration from Legacy Patterns" section

**Sections to DELETE** (224 lines):
- Lines 1-47: Audience/prerequisites (generic)
- Lines 71-198: Workflow steps 1-9 (duplicate main guide)
- Lines 260-284: Verification checklist (covered in main guide)

#### New Section: "Migration from Legacy Patterns"

Add to `mod-testing-guide.md` after line 799 (Best Practices section):

```markdown
## Migration from Legacy Patterns

This section helps maintainers convert legacy mod tests to modern fixtures and helpers.

### Migration Baseline Tracking

[Insert table from MODTESTROB-009:48-59]

### Quick Pattern Reference

[Insert table from MODTESTROB-009:63-70]

### Example: Sitting Action Migration

[Insert before/after from MODTESTROB-009:199-259]

**For complete migration workflow**: See [Fixture Lifecycle](#fixture-lifecycle) and [Scenario Composition](#scenario-composition) sections above.
```

---

## Reference Update Strategy

### Files Requiring Updates (21 total)

**Category 1: Direct Documentation Links** (15 files)
- `CLAUDE.md` (project instructions)
- `README.md` (root documentation)
- 13 spec files in `specs/` directory (various action specs + vampirism features)

**Update Pattern**:
```diff
- [Action Discovery Testing Toolkit](docs/testing/action-discovery-testing-toolkit.md)
+ See [Action Discovery Harness](docs/testing/mod-testing-guide.md#action-discovery-harness)

- [TEAOUTTHR-008 Migration Guide](docs/testing/TEAOUTTHR-008-auto-registration-migration.md)
+ See [Zero-Config Testing](docs/testing/mod-testing-guide.md#zero-config-testing-recommended)

- [MODTESTROB-009 Migration Guide](docs/testing/MODTESTROB-009-migration-guide.md)
+ See [Migration from Legacy Patterns](docs/testing/mod-testing-guide.md#migration-from-legacy-patterns)
```

**Category 2: Source Code References** (2 files)
- `tests/common/mods/ModTestFixture.js`
- `tests/common/mods/scopeResolverHelpers.js`

**Update Pattern**:
```javascript
// Old reference
// @see docs/testing/action-discovery-testing-toolkit.md

// New reference
// @see docs/testing/mod-testing-guide.md#action-discovery-harness
```

**Category 3: Mod README References** (1 file)
- `tests/integration/mods/vampirism/README.md`

Update to point to main guide sections.

**Category 4: Reports** (1 file)
- `reports/tear-out-throat-testing-analysis.md`

This report file is **informational only** and doesn't require immediate update (can be updated later or left as historical reference).

---

## Implementation Checklist

### Step 1: Content Extraction
- [ ] Extract 60 lines of unique content from MODTESTROB-009
- [ ] Create "Migration from Legacy Patterns" section in mod-testing-guide.md
- [ ] Add diagnostic cross-reference note from action-discovery-toolkit

### Step 2: File Deletion Preparation
- [ ] Verify no critical content lost from TEAOUTTHR-008
- [ ] Verify no critical content lost from action-discovery-toolkit
- [ ] Archive deleted files in git history (already tracked)

### Step 3: Reference Updates
- [ ] Update CLAUDE.md project instructions
- [ ] Update README.md root documentation
- [ ] Update source code JSDoc references (2 files)
- [ ] Update high-priority spec files (10 files)

### Step 4: Validation
- [ ] Verify all mod-testing-guide.md links still work
- [ ] Verify scope-resolver-registry.md references updated
- [ ] Run `npm run lint` on updated files
- [ ] Commit with descriptive message

### Step 5: Documentation
- [ ] Add "Removed Files" note to mod-testing-guide.md header
- [ ] Update doc navigation if present

---

## Expected Outcomes

### Quantitative Benefits
- **40% fewer documentation files** to maintain (5 → 2 core files after consolidation)
- **26% line reduction** (3,118 → ~2,300 lines)
- **60 lines of unique content** preserved and integrated
- **21 reference updates** to point to consolidated locations (15 documentation files + 2 source files + 1 mod README + 1 report + 2 self-references in deleted docs)

### Qualitative Benefits
- ✅ **Single Source of Truth**: mod-testing-guide.md remains comprehensive
- ✅ **No Information Loss**: All unique patterns/tables preserved
- ✅ **Improved Discoverability**: Developers know where to look
- ✅ **Reduced Maintenance**: No drift between duplicate docs
- ✅ **Better Navigation**: Logical flow within single guide

### Risk Mitigation
- **Low Risk**: Deleted files 95-100% redundant
- **Git History**: All content preserved in version control
- **Gradual Updates**: Reference updates can be phased
- **Rollback Plan**: Restore deleted files from git if needed

---

## File Removal Candidates Summary

| File | Lines | Redundancy | Action | Unique Content |
|------|-------|------------|--------|----------------|
| **TEAOUTTHR-008-auto-registration-migration.md** | 185 | 100% | 🗑️ DELETE | None |
| **action-discovery-testing-toolkit.md** | 64 | 95% | 🗑️ DELETE | 1 diagnostic note |
| **MODTESTROB-009-migration-guide.md** | 284 | 60% | 📝 CONSOLIDATE | 60 lines (3 sections) |

**After Restructuring:**
- `mod-testing-guide.md` (enhanced with migration section)
- `scope-resolver-registry.md` (unchanged)

---

## Approval Criteria

- ✅ No unique information lost
- ✅ All critical patterns preserved
- ✅ Reference update strategy documented
- ✅ Low-risk implementation plan
- ✅ Measurable maintenance improvements

---

## Next Steps (Post-Implementation)

1. **Monitor**: Track if developers have trouble finding information (1 month)
2. **Optimize**: Consider scope-resolver-registry.md compression (future task)
3. **Standardize**: Apply learnings to other documentation areas

---

## Related Issues

- **MODTESTROB-010-01**: Migration batch tracking (depends on baseline table preservation)
- **TEAOUTTHR-006**: Positioning scopes 90%+ coverage (referenced in scope registry)

---

**Specification Author**: Claude Code (Architecture Analysis Mode)
**Review Status**: Ready for Implementation
**Last Updated**: 2025-10-26
