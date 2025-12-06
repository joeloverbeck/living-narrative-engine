# BERTHEMUDCHASPE-002: Create Required Anatomy Part Entities

**Status**: ✅ COMPLETED

## Description

Create new anatomy part entities that cannot be reused from existing parts, based on audit results from BERTHEMUDCHASPE-001. Each entity must include all required components with accurate descriptors.

## Prerequisite

**MUST complete BERTHEMUDCHASPE-001 first** to know which parts need creation.

## Files Expected to Touch

Based on audit results, ONLY these 3 parts need creation:

- CREATE: `data/mods/anatomy/entities/definitions/humanoid_hand_craftsman_stained.entity.json`
- CREATE: `data/mods/anatomy/entities/definitions/humanoid_arm_weathered_tannery_stained.entity.json`
- CREATE: `data/mods/anatomy/entities/definitions/humanoid_face_bearded_full_trimmed.entity.json`
- MODIFY: `data/mods/anatomy/mod-manifest.json` (add 3 new entity references)

## Explicit Out of Scope

- **NO creation** of parts marked as "reuse existing" in audit
- **NO recipe creation** (that's BERTHEMUDCHASPE-003)
- **NO character entity work** (that's BERTHEMUDCHASPE-005)
- **NO clothing creation** (that's BERTHEMUDCHASPE-004)
- **NO modification** of existing anatomy parts

## Acceptance Criteria

### Required Components Per Anatomy Part

Each created entity must include:

1. **anatomy:part** component with correct `subType` (hand/arm/head)
2. **anatomy:sockets** component (for arm and head only, not hand)
3. **core:name** component with simple name text
4. **Descriptor components** using ONLY existing enum values from schema:
   - `descriptors:texture` (use existing enum: rough, scarred, smooth, etc.)
   - `descriptors:facial_hair` (for head: use "full-beard" from enum)
5. **core:visual_properties** component (OPTIONAL but recommended) for narrative details
6. Valid entity ID in format `anatomy:part_name`

**CRITICAL CONSTRAINT**: Descriptor components only accept predefined enum values from their schemas. Complex details (callus patterns, dye crescents, chemical staining) MUST be encoded in visual_properties description text, NOT in descriptor components.

### Critical Features to Preserve

1. **Hands (MOST IMPORTANT)**:
   - Broad, strong hands from leatherwork
   - Specific callus patterns
   - Dark crescents under fingernails from embedded dyes/tannins
   - Short practical nails
   - "All digits functional" detail

2. **Arms**:
   - Permanent tan-brown chemical staining
   - Strong forearms from decades of work
   - Weathered skin texture

3. **Torso**:
   - Thick working-man's build
   - Slight belly from contentment (age 53)
   - Not muscular but solid

4. **Face**:
   - Full beard, neatly trimmed
   - Brown with grey throughout
   - Warm brown eyes with smile-lines
   - Unremarkable but kind

5. **Hair**:
   - Short, practical cut
   - Brown going grey
   - May have trace sawdust/dye

### Specific Tests That Must Pass

- All created entity files validate against anatomy part schema
- All entity IDs follow format `anatomy:part_name`
- All visual descriptions capture specified details
- `mod-manifest.json` includes all new entity references
- `npm run validate` passes without errors for anatomy mod

### Invariants That Must Remain True

- **NO modification** of existing anatomy part entities
- **NO recipe files** created or modified
- All new entities reference valid component types
- Entity structure matches existing anatomy part patterns

## Implementation Notes

### Corrected Assumptions from Audit

The audit document suggested component structures that don't exist in the actual codebase:

- ❌ **NO** `descriptors:professional_markers` component exists
- ❌ **NO** custom texture values like "calloused_stained" or "weathered_stained"
- ❌ **NO** custom color values like "tan_brown_stained" or "brown_greying"

### Actual Implementation Approach

- Use existing descriptor enum values (e.g., `texture: "rough"` or `"coarse"`)
- Encode narrative details in `core:visual_properties` description text
- Follow exact structure pattern from existing entities (scarred hand/arm, bearded head)
- Pay special attention to hands entity - it's Bertram's most distinctive feature
- Keep staining/weathering details consistent across arms and hands in description text

## Reference

- See `specs/bertram-the-muddy-character-spec.md` Section 3 for detailed requirements
- Check `claudedocs/bertram-anatomy-audit-results.md` for which parts to create
- Reference existing anatomy parts for component patterns

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned (from audit)**:

- Create 3 new anatomy part entities with complex descriptor components
- Use specialized descriptor values like "calloused_stained", "tan_brown_stained", "brown_greying"
- Use non-existent components like `descriptors:professional_markers`

**Actually Implemented**:

- ✅ Created 3 new anatomy part entities (as planned)
- ✅ Updated mod-manifest.json with 3 new entity references
- ⚠️ **Corrected approach**: Used only existing descriptor enum values from schemas
- ⚠️ **Adjusted strategy**: Encoded complex narrative details (calluses, dye crescents, chemical staining) in `core:visual_properties` description text instead of non-existent descriptor components

### Files Created

1. `data/mods/anatomy/entities/definitions/humanoid_hand_craftsman_stained.entity.json` - Master leatherworker hands with embedded dye crescents and callus patterns
2. `data/mods/anatomy/entities/definitions/humanoid_arm_weathered_tannery_stained.entity.json` - Arms with permanent tan-brown chemical staining from tannery work
3. `data/mods/anatomy/entities/definitions/humanoid_face_bearded_full_trimmed.entity.json` - Warm, unremarkable face with neatly trimmed full beard

### Files Modified

1. `data/mods/anatomy/mod-manifest.json` - Added 3 new entity references in alphabetical order

### Validation Results

- ✅ `npm run validate` passed with 0 violations for anatomy mod
- ✅ Integration test `anatomyPartParentEntityValidation.test.js` passed
- ✅ All entity IDs follow format `anatomy:part_name`
- ✅ All visual descriptions capture Bertram's critical features

### Key Deviations from Original Plan

The audit document (BERTHEMUDCHASPE-001) suggested using component structures that don't exist in the actual codebase. The ticket was corrected during implementation to:

1. Use only predefined enum values from existing descriptor components
2. Rely on `core:visual_properties` for rich narrative details
3. Follow exact patterns from existing anatomy parts (scarred hand/arm, bearded head)

This approach maintains character authenticity while respecting actual schema constraints.
