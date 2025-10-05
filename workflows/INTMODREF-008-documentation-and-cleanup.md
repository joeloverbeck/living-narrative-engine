# INTMODREF-008: Documentation and Cleanup

**Phase**: 5 - Cleanup
**Estimated Time**: 1 hour
**Dependencies**: INTMODREF-002, INTMODREF-003, INTMODREF-004, INTMODREF-005, INTMODREF-006, INTMODREF-007 (all previous tickets complete)
**Report Reference**: Cleanup (lines 567-582), Post-Migration (lines 833-837)

## Objective

Complete the refactoring by deprecating/removing the intimacy mod, updating all documentation, and ensuring the new mod structure is properly documented for future development.

## Background

With all content migrated, dependencies updated, and tests passing, the final step is to clean up the old intimacy mod and update all project documentation to reflect the new architecture.

## Tasks

### 1. Handle Intimacy Mod Deprecation

**Option A: Mark as Deprecated (Recommended for transition period)**

Update `data/mods/intimacy/mod-manifest.json`:

```json
{
  "id": "intimacy",
  "version": "1.0.0",
  "name": "Intimacy [DEPRECATED]",
  "description": "⚠️ DEPRECATED: This mod has been split into affection, kissing, and caressing mods. Please update your dependencies.",
  "deprecated": true,
  "replacedBy": ["affection", "kissing", "caressing"],
  "author": "Living Narrative Engine",
  "dependencies": []
}
```

Create deprecation notice file:

**File**: `data/mods/intimacy/DEPRECATED.md`

```markdown
# Intimacy Mod - DEPRECATED

⚠️ **This mod has been deprecated and split into three semantically distinct mods.**

## Migration Required

Replace `intimacy` dependency with:

```json
{
  "dependencies": [
    { "id": "affection", "version": "^1.0.0" },
    { "id": "kissing", "version": "^1.0.0" },
    { "id": "caressing", "version": "^1.0.0" }
  ]
}
```

## Action Mapping

### Affection Mod
- `intimacy:hold_hand` → `affection:hold_hand`
- `intimacy:hug_tight` → `affection:hug_tight`
- `intimacy:brush_hand` → `affection:brush_hand`
- `intimacy:massage_back` → `affection:massage_back`
- `intimacy:massage_shoulders` → `affection:massage_shoulders`
- `intimacy:sling_arm_around_shoulders` → `affection:sling_arm_around_shoulders`
- `intimacy:wrap_arm_around_waist` → `affection:wrap_arm_around_waist`
- `intimacy:place_hand_on_waist` → `affection:place_hand_on_waist`

### Kissing Mod
- `intimacy:kiss_cheek` → `kissing:kiss_cheek`
- `intimacy:peck_on_lips` → `kissing:peck_on_lips`
- `intimacy:lean_in_for_deep_kiss` → `kissing:lean_in_for_deep_kiss`
- ... (all 15 kissing actions)
- Component: `intimacy:kissing` → `kissing:kissing`

### Caressing Mod
- `intimacy:run_thumb_across_lips` → `caressing:run_thumb_across_lips`
- `intimacy:fondle_ass` → `caressing:fondle_ass`
- ... (all 9 caressing actions)

## Removal Date

This mod will be completely removed in version 2.0.0.
```

**Option B: Complete Removal (After transition period)**

```bash
# Back up first
cp -r data/mods/intimacy data/mods/intimacy.backup

# Remove intimacy mod
rm -rf data/mods/intimacy
```

**Recommendation**: Use Option A for 1-2 release cycles, then proceed with Option B.

### 2. Update Game Configuration

**File**: `data/game.json`

**Before**:
```json
{
  "mods": [
    "core",
    "anatomy",
    "positioning",
    "descriptors",
    "clothing",
    "intimacy",
    "sex",
    "seduction",
    "p_erotica"
  ]
}
```

**After**:
```json
{
  "mods": [
    "core",
    "anatomy",
    "positioning",
    "descriptors",
    "clothing",
    "affection",
    "kissing",
    "caressing",
    "sex",
    "seduction",
    "p_erotica"
  ]
}
```

### 3. Update Project Documentation

#### Update README.md

Add section about the refactoring:

```markdown
## Recent Changes

### Intimacy Mod Refactoring (v1.5.0)

The monolithic `intimacy` mod has been split into three semantically distinct mods:

- **affection** - Gentle, caring physical contact (platonic-compatible)
- **kissing** - Romantic mouth-based interactions with state management
- **caressing** - Sensual touching with sexual tension escalation

#### Visual Hierarchy

Actions now have distinct color schemes:
- Soft Purple (#6a1b9a) - Affection (gentle, caring)
- Rose Pink (#ad1457) - Kissing (romantic, passionate)
- Dark Purple (#311b92) - Caressing (sensual, intense)

#### Migration Guide

If your mod depends on the old `intimacy` mod, update your `mod-manifest.json`:

```json
{
  "dependencies": [
    { "id": "affection", "version": "^1.0.0" },
    { "id": "kissing", "version": "^1.0.0" },
    { "id": "caressing", "version": "^1.0.0" }
  ]
}
```

See [DEPRECATED.md](data/mods/intimacy/DEPRECATED.md) for complete action mapping.
```

#### Update CLAUDE.md

Add to mod development section:

```markdown
### Intimate Interaction Mods

The intimate interaction system is split into three mods:

1. **affection** (`data/mods/affection/`)
   - Gentle physical contact (hand-holding, hugs, massages)
   - Platonic-compatible actions
   - Color: Soft Purple (#6a1b9a)

2. **kissing** (`data/mods/kissing/`)
   - Mouth-based romantic interactions
   - State management with `kissing:kissing` component
   - Mouth engagement locking mechanics
   - Color: Rose Pink (#ad1457)

3. **caressing** (`data/mods/caressing/`)
   - Sensual touching with escalation
   - Multi-target actions with clothing integration
   - Requires `clothing` mod dependency
   - Color: Dark Purple (#311b92)

### Shared Scopes Note

These mods duplicate some positioning scopes for independence:
- `close_actors_facing_each_other.scope`
- `close_actors_facing_each_other_or_behind_target.scope`
- `close_actors_facing_away.scope`

This is intentional to avoid cross-dependencies.
```

#### Update Mod List Documentation

If there's a mod list file, update it:

**File**: `docs/mods/MOD_LIST.md` (or similar)

```markdown
## Interaction Mods

### Affection
- **ID**: `affection`
- **Purpose**: Gentle, caring physical contact
- **Actions**: 8 (hold_hand, hug_tight, etc.)
- **Dependencies**: anatomy, positioning, descriptors
- **Color**: Soft Purple (#6a1b9a)

### Kissing
- **ID**: `kissing`
- **Purpose**: Romantic mouth-based intimacy
- **Actions**: 15 (kiss_cheek, deep_kiss, etc.)
- **Components**: kissing (state management)
- **Dependencies**: anatomy, positioning, descriptors
- **Color**: Rose Pink (#ad1457)

### Caressing
- **ID**: `caressing`
- **Purpose**: Sensual touch and escalation
- **Actions**: 9 (fondle_ass, caress_abdomen, etc.)
- **Dependencies**: anatomy, positioning, descriptors, clothing
- **Color**: Dark Purple (#311b92)

### ~~Intimacy~~ [DEPRECATED]
- **Status**: Deprecated, replaced by affection, kissing, caressing
- **Removal**: Planned for v2.0.0
```

### 4. Update Color Scheme Specification

If there's a color scheme document, update it:

**File**: `docs/design/COLOR_SCHEMES.md` (or similar)

```markdown
## Color Scheme Assignments (Updated)

### 3.1 Soft Purple - Affection Mod
- **Background**: #6a1b9a
- **Text**: #f3e5f5
- **Theme**: Romance, elegance, gentle care
- **Usage**: Gentle physical contact actions

### 3.2 Rose Pink - Kissing Mod
- **Background**: #ad1457
- **Text**: #ffffff
- **Theme**: Warmth, tenderness, passion
- **Usage**: Romantic mouth-based interactions

### 7.2 Dark Purple - Caressing Mod
- **Background**: #311b92
- **Text**: #d1c4e9
- **Theme**: Premium, sensual, intense
- **Usage**: Sensual touching and escalation
```

### 5. Create Migration Guide for Developers

**File**: `docs/migration/INTIMACY_MOD_MIGRATION.md`

```markdown
# Intimacy Mod Migration Guide

## Overview

The `intimacy` mod has been refactored into three semantically distinct mods to improve maintainability and modularity.

## For Mod Developers

### Step 1: Update Dependencies

Replace:
```json
{ "id": "intimacy", "version": "^1.0.0" }
```

With:
```json
{ "id": "affection", "version": "^1.0.0" },
{ "id": "kissing", "version": "^1.0.0" },
{ "id": "caressing", "version": "^1.0.0" }
```

### Step 2: Update Action References

Use the mapping table in `data/mods/intimacy/DEPRECATED.md` to update all action IDs.

### Step 3: Update Component References

If using the kissing component:
- Old: `intimacy:kissing`
- New: `kissing:kissing`

### Step 4: Update Scope References

Scopes now belong to their respective mods:
- `intimacy:close_actors_facing_each_other` → `affection:close_actors_facing_each_other` (or kissing/caressing)

### Step 5: Test Your Mod

Verify all actions work correctly with the new mod structure.

## Benefits

- **Clear Semantics**: Each mod has a well-defined purpose
- **Better Modularity**: Use only the interaction types you need
- **Visual Differentiation**: Color-coded action categories
- **Easier Maintenance**: Smaller, focused modules

## Support

For issues, see: [GitHub Issues](link)
```

### 6. Update CHANGELOG

**File**: `CHANGELOG.md`

```markdown
## [1.5.0] - 2025-01-XX

### Changed
- **BREAKING**: Refactored `intimacy` mod into three distinct mods
  - Created `affection` mod for gentle physical contact (Soft Purple)
  - Created `kissing` mod for romantic mouth interactions (Rose Pink)
  - Created `caressing` mod for sensual touching (Dark Purple)
- Deprecated `intimacy` mod (will be removed in v2.0.0)

### Added
- 8 affection actions with Soft Purple color scheme
- 15 kissing actions with Rose Pink color scheme
- 9 caressing actions with Dark Purple color scheme
- `kissing:kissing` component for state management
- Comprehensive integration tests for new mods
- Migration guide for mod developers

### Fixed
- Improved semantic clarity for intimate interactions
- Better modularity for dependent mods (sex, seduction)
- Enhanced visual differentiation through color schemes

### Migration
- Update mod dependencies from `intimacy` to `affection`, `kissing`, `caressing`
- See [INTIMACY_MOD_MIGRATION.md](docs/migration/INTIMACY_MOD_MIGRATION.md)
```

### 7. Verify Documentation Completeness

**Checklist**:

- [ ] README.md updated with refactoring details
- [ ] CLAUDE.md updated with new mod structure
- [ ] Mod list documentation updated
- [ ] Color scheme spec updated
- [ ] Migration guide created
- [ ] CHANGELOG.md updated
- [ ] Intimacy mod marked as deprecated
- [ ] game.json updated with new mods

### 8. Final Cleanup Tasks

```bash
# Remove any temporary files
rm intimacy-refs-*.txt
rm intimacy-test-refs.txt

# Remove migration scripts (or move to scripts/)
mv update-intimacy-refs.sh scripts/migration/
mv update-test-refs.sh scripts/migration/

# Verify no intimacy references in code (excluding deprecated mod itself)
grep -r "intimacy:" data/mods/ --exclude-dir=intimacy || echo "Clean ✓"

# Verify no intimacy references in tests
grep -r "intimacy:" tests/ || echo "Clean ✓"
```

## Acceptance Criteria

- [ ] Intimacy mod deprecated (or removed) properly
- [ ] game.json updated with new mod load order
- [ ] README.md includes refactoring documentation
- [ ] CLAUDE.md updated with new mod structure
- [ ] Migration guide created for developers
- [ ] CHANGELOG.md updated with breaking changes
- [ ] Color scheme documentation updated
- [ ] All temporary files cleaned up
- [ ] No `intimacy:` references remain (except in deprecated mod and migration docs)
- [ ] Documentation is clear and helpful for future developers

## Validation Commands

```bash
# Verify intimacy mod status
cat data/mods/intimacy/mod-manifest.json | jq .deprecated

# Verify game.json
cat data/game.json | jq .mods

# Check for remaining intimacy references (should only be in deprecated mod and docs)
grep -r "intimacy:" data/mods/ --exclude-dir=intimacy || echo "Clean ✓"
grep -r "intimacy:" tests/ || echo "Clean ✓"

# Verify documentation files exist
ls -la docs/migration/INTIMACY_MOD_MIGRATION.md
ls -la data/mods/intimacy/DEPRECATED.md

# Check CHANGELOG
grep -A10 "1.5.0" CHANGELOG.md
```

## Post-Migration Tasks

After this ticket is complete:

1. **Monitor for Issues**
   - Watch for bug reports related to the refactoring
   - Track community feedback on the new structure

2. **Collect Feedback**
   - Ask users about the new mod organization
   - Gather input on visual differentiation effectiveness

3. **Consider Future Improvements**
   - Evaluate if shared scopes need a helper mod
   - Assess if further granularity needed
   - Plan for intimacy mod complete removal (v2.0.0)

4. **Update External Resources**
   - Wiki pages
   - Tutorial videos
   - Community documentation

## Success Criteria (from Report)

- ✅ All 96+ files migrated successfully
- ✅ All tests passing (existing + new integration tests)
- ✅ Dependent mods (sex, seduction, p_erotica) functional
- ✅ No console errors in gameplay
- ✅ Visual appearance correct with new color schemes
- ✅ Documentation updated and comprehensive

## Notes

- Keep deprecated intimacy mod for 1-2 releases for smooth transition
- Monitor community mods for migration needs
- Migration guide is critical for external mod developers
- Consider announcing refactoring in release notes
- Archive intimacy mod backup before complete removal
