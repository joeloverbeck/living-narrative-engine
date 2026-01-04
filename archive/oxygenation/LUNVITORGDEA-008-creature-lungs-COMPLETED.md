# LUNVITORGDEA-008: (Optional) Add vital_organ to Creature Lung Entities

**Status**: ✅ COMPLETED

## Summary

Apply the same `anatomy:vital_organ` component with `requiresAllDestroyed: true` to creature lung entities for consistency. This ensures all respiratory organs in the game behave identically.

## Dependencies

- LUNVITORGDEA-001 (Schema must include `requiresAllDestroyed` and `respiratory` organType)
- LUNVITORGDEA-002 (Human lung implementation as reference)

## Priority

**Optional** - Can be deferred if creature anatomy is not actively used.

## File List

### Files to Modify
- `data/mods/anatomy-creatures/entities/definitions/feline_lung_left.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/feline_lung_right.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/mustelid_lung_left.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/mustelid_lung_right.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/amphibian_lung_left.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/amphibian_lung_right.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/reptilian_lung_left.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/reptilian_lung_right.entity.json`

### Entities NOT Modified (Rationale)
- `amphibian_skin_respiration.entity.json` - Cutaneous respiration is supplemental, not vital
- `eldritch_respiratory_mass.entity.json` - Single organ, `requiresAllDestroyed` doesn't apply

## Out of Scope

- DO NOT modify human lung entities (done in 002)
- DO NOT modify the vital_organ component schema (done in 001)
- DO NOT modify deathCheckService.js (done in 003)
- DO NOT create new entity files

## Implementation Details

### Per-Entity Changes

For each creature lung entity, add the `anatomy:vital_organ` component:

```json
"anatomy:vital_organ": {
  "organType": "respiratory",
  "killOnDestroy": true,
  "requiresAllDestroyed": true,
  "deathMessage": "suffocated as all respiratory organs failed"
}
```

### Consistency Requirements

All creature lungs should have:
- Same `organType`: `"respiratory"`
- Same `requiresAllDestroyed`: `true`
- Same `killOnDestroy`: `true`
- Death message can be customized per creature type if desired

### Example Creature-Specific Message

```json
// For a wolf
"deathMessage": "the wolf collapsed, unable to breathe"

// For a dragon
"deathMessage": "the dragon's breathing ceased as both lungs failed"
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` - All entity validation must pass
- `npm run validate:mod:anatomy-creatures` - Creature mod validation must pass

### Invariants That Must Remain True
1. All creature lungs use `requiresAllDestroyed: true`
2. All creature lungs use `organType: "respiratory"`
3. Existing creature anatomy remains functional
4. Death message format consistent with human lungs

### Verification Per Entity

For each modified entity, verify:
- JSON is valid
- vital_organ component present
- requiresAllDestroyed is true
- organType is "respiratory"

## Verification Commands

```bash
# Validate all entities
npm run validate

# Validate creature mod specifically
npm run validate:mod anatomy-creatures

# Run creature respiratory tests
npm run test:integration -- tests/integration/anatomy/respiratoryOrganDeath.integration.test.js
```

## Design Notes

- This is marked optional because creature anatomy may not be fully implemented
- If creatures have different lung counts (e.g., 4 lungs), the collective logic still works
- Custom death messages allow for creature-specific narrative flavor

## Estimated Diff Size

~10-20 lines per creature lung entity (depends on how many exist).

---

## Outcome

**Completed**: 2026-01-03

### Changes Made

Added `anatomy:vital_organ` component to all 8 creature lung entities:

| Entity | Death Message |
|--------|---------------|
| feline_lung_left/right | "suffocated as both feline lungs failed" |
| mustelid_lung_left/right | "suffocated as both lungs failed" |
| amphibian_lung_left/right | "suffocated as both amphibian lungs failed" |
| reptilian_lung_left/right | "suffocated as both massive lungs failed" |

### Entities Correctly Excluded
- `amphibian_skin_respiration.entity.json` - Supplemental breathing, not vital organ
- `eldritch_respiratory_mass.entity.json` - Single organ, collective death doesn't apply

### Tests Added

Extended `tests/integration/anatomy/respiratoryOrganDeath.integration.test.js` with:
- Feline lungs: single destroyed → survive, both destroyed → death
- Reptilian lungs: high-health organs (50 HP) behave identically
- Cross-creature consistency: parameterized tests for mustelid and amphibian

### Validation Results

```
✅ npm run validate:mod anatomy-creatures - PASSED
✅ Integration tests: 17 passed (including 6 new creature tests)
```

### Notes

- Reptilian lungs have 50 HP (vs 25-30 for other creatures), representing "massive" dragon lungs
- All creature lungs now behave consistently with human lungs per LUNVITORGDEA-002
