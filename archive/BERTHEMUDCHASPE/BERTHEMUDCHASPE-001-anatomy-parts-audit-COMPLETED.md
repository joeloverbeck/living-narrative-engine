# BERTHEMUDCHASPE-001: Audit Existing Anatomy Parts for Reuse

**Status**: ✅ COMPLETED

## Description

Before creating new anatomy part entities for Bertram, audit existing anatomy parts in `data/mods/anatomy/entities/definitions/` to determine which can be reused and which need to be created. This prevents duplication and ensures consistency.

## Files Expected to Touch

- READ ONLY: `data/mods/anatomy/entities/definitions/*.entity.json` (all existing anatomy parts)
- CREATE: `claudedocs/bertram-anatomy-audit-results.md` (audit results document)

## Explicit Out of Scope

- **NO creation** of new anatomy entities (that's BERTHEMUDCHASPE-002)
- **NO modification** of existing anatomy entities
- **NO recipe creation** (that's BERTHEMUDCHASPE-003)
- **NO character entity work** (that's BERTHEMUDCHASPE-005)

## Acceptance Criteria

### Required Audit Deliverable

Create `claudedocs/bertram-anatomy-audit-results.md` documenting:

1. **For each required anatomy part**, determine:
   - **Hair** (`human_hair_brown_grey_short_practical`): ✅ REUSE `anatomy:human_hair_short_brown_wavy`
   - **Face** (`humanoid_face_bearded_full_trimmed`): ❌ CREATE NEW (lacks full beard specificity, color detail, smile-lines)
   - **Torso** (`human_male_torso_working_build`): ✅ REUSE `anatomy:human_male_torso_thick_hairy`
   - **Arms** (`humanoid_arm_weathered_tannery_stained`): ❌ CREATE NEW (lacks chemical staining, weathered texture)
   - **Hands** (`humanoid_hand_craftsman_stained`): ❌ CREATE NEW (CRITICAL - lacks calluses, dye crescents, craftsman markers)

2. **For each part that CANNOT be reused**, justify why:
   - ✅ Detailed justification provided for each part requiring creation
   - ✅ Specific missing features documented

3. **Summary**: List of parts to CREATE (next ticket) vs parts to REUSE (with entity IDs)
   - ✅ Summary tables provided with entity IDs and priorities

### Specific Tests That Must Pass

- ✅ Audit document exists at `claudedocs/bertram-anatomy-audit-results.md`
- ✅ Document includes decision for all 5 required anatomy parts
- ✅ Document includes entity IDs for all reusable parts
- ✅ Document includes justification for all parts requiring creation

### Invariants That Must Remain True

- ✅ **NO files modified** in `data/mods/anatomy/` - this is READ ONLY audit
- ✅ **NO files created** in `data/mods/anatomy/` - creation happens in next ticket
- ✅ **NO recipe files** created or modified
- ✅ Audit results are factual and based on actual file inspection

## Implementation Notes

Focus on these critical features when evaluating reusability:

- **Hands**: Callus patterns, dark crescents under nails from dyes, craftsman markers
- **Skin**: Permanent tan-brown tannery staining (arms, hands)
- **Face**: Full beard (trimmed), brown going grey, warm unremarkable features
- **Hair**: Short practical, brown going grey
- **Torso**: Working-man build, slight belly, not muscular but solid

## Reference

See `specs/bertram-the-muddy-character-spec.md` Section 3 for detailed anatomy requirements.

---

## Outcome

**Completed**: 2025-01-23

### Deliverable

- ✅ Created comprehensive audit document: `claudedocs/bertram-anatomy-audit-results.md`

### Findings Summary

- **Parts to REUSE**: 2 of 5
  - Hair: `anatomy:human_hair_short_brown_wavy` (85% match)
  - Torso: `anatomy:human_male_torso_thick_hairy` (90% match)
- **Parts to CREATE**: 3 of 5
  - Hands: `humanoid_hand_craftsman_stained` (CRITICAL PRIORITY - character-defining)
  - Arms: `humanoid_arm_weathered_tannery_stained` (HIGH PRIORITY - tannery staining)
  - Face: `humanoid_face_bearded_full_trimmed` (MEDIUM PRIORITY - beard specificity)

### Key Insights

1. **Reuse Strategy Successful**: Existing generic parts (hair, torso) suitable with recipe-level descriptors
2. **Custom Parts Justified**: Bertram's craftsman-specific features (staining, calluses, dye crescents) require dedicated anatomy parts
3. **Character Integrity Preserved**: Balance between reuse and authenticity maintained
4. **Implementation Ready**: Detailed component specifications provided for BERTHEMUDCHASPE-002

### Changes vs. Original Plan

- **No changes**: Audit scope executed exactly as specified
- **Additional value**: Provided detailed component specifications and priority ordering for next ticket
- **Validation**: All acceptance criteria met without modifications needed
