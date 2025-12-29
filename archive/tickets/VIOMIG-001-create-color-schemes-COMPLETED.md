# VIOMIG-001: Create Color Schemes and Documentation

**Status**: Completed
**Type**: Documentation
**Priority**: High (blocks all other tickets)

## Summary

Create new WCAG-compliant color schemes for future `grabbing` and `creature-attacks` mods, document them as available schemes, and update scheme counts. No mod assignments are updated because the referenced mods do not exist in `data/mods/` yet.

## Files to Touch

- `docs/mods/mod-color-schemes-available.md` - ADD 2 new schemes (Grip Iron, Feral Amber), update counts and quick reference
- `docs/mods/mod-color-schemes-used.md` - Update counts only to stay consistent with available schemes

## Out of Scope

- Do NOT modify any mod files
- Do NOT create mod directories
- Do NOT touch `data/game.json`
- Do NOT modify any action files
- Do NOT modify any source code

## Implementation Details

### New Schemes to Add to `mod-color-schemes-available.md`

```markdown
### 2.5 Grip Iron
- **Background**: `#4a4a4a` (Metallic gray)
- **Text**: `#f5f5f5` (Near white)
- **Hover BG**: `#5a5a5a`
- **Hover Text**: `#ffffff`
- **Normal Contrast**: 8.13:1 (AAA)
- **Hover Contrast**: 6.90:1 (AA)
- **Theme**: Control, restraint, iron grip

### 7.4 Feral Amber
- **Background**: `#8b5a00` (Dark amber)
- **Text**: `#fff8e1` (Cream)
- **Hover BG**: `#a06800`
- **Hover Text**: `#ffffff`
- **Normal Contrast**: 5.55:1 (AA)
- **Hover Contrast**: 4.69:1 (AA)
- **Theme**: Natural predator, animalistic instinct
```

### Updates to `mod-color-schemes-used.md`

No new mod assignments are added because `grabbing`, `creature-attacks`, `striking`, and `lethal-violence` mods are not present in `data/mods/`. Existing assignments remain unchanged.

## Acceptance Criteria

### Tests
- [x] New color schemes have valid 6-digit hex color codes
- [x] Grip Iron contrast ratio: `#4a4a4a` vs `#f5f5f5` ≥ 4.5:1 (WCAG AA)
- [x] Feral Amber contrast ratio: `#8b5a00` vs `#fff8e1` ≥ 4.5:1 (WCAG AA)
- [x] Documentation follows existing format in both files
- [x] No duplicate scheme names in available schemes

### Invariants
- [x] All existing color scheme entries remain unchanged
- [x] Section numbering remains consistent and unique across scheme definitions
- [x] Existing mod assignments remain unchanged

## Dependencies

- None (first ticket in sequence)

## Blocks

- VIOMIG-003 (needs Bold Red scheme documented)
- VIOMIG-005 (needs Grip Iron scheme documented)
- VIOMIG-007 (needs Dark Red Alert scheme documented)
- VIOMIG-009 (needs Feral Amber scheme documented)

## Verification Commands

```bash
# Check contrast ratios (manual verification or use online tool)
# https://webaim.org/resources/contrastchecker/

# Verify no duplicate scheme names
grep -E "^### [0-9]+\.[0-9]+" docs/mods/mod-color-schemes-available.md | sort | uniq -d

# Verify count of available scheme definitions
rg -n "^#### " docs/mods/mod-color-schemes-available.md | wc -l
```

## Outcome

- Added Grip Iron (2.5) and Feral Amber (7.4) to the available schemes catalog with corrected contrast ratios.
- Updated scheme counts in both documentation files to reflect the current totals.
- Deferred mod assignment changes because the referenced mods are not present in `data/mods/`.
