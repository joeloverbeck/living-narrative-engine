# APPDAMCASDES-004: Extend DamageNarrativeComposer for Cascade Narrative

**Title:** Add Cascade Destruction Narrative Composition

**Summary:** Extend DamageNarrativeComposer to generate narrative segments for cascade destruction events, appended after existing damage/propagation narratives.

**Status:** Completed

## Files to Modify

- `src/anatomy/services/damageNarrativeComposer.js`
- `tests/unit/anatomy/services/damageNarrativeComposer.test.js`

## Files to Create

- None

## Out of Scope

- CascadeDestructionService (ticket APPDAMCASDES-001)
- DamageAccumulator changes (ticket APPDAMCASDES-003)
- DamageResolutionService integration (ticket APPDAMCASDES-005)
- Integration tests (ticket APPDAMCASDES-006)
- E2E tests (ticket APPDAMCASDES-007)
- Changes to existing narrative formatting methods

## Implementation Details

### Existing Behavior (verified)

- `compose(entries)` currently returns early with a warning on empty or missing entries.
- `compose` already uses `#formatPartName` and `#formatPartList`, and formats damage descriptors with a `severity` qualifier when present.
- Damage narratives rely on `entityPossessive` (pronoun or possessive name) for possessive phrasing.

### New Private Method

Add after existing private methods:

```javascript
/**
 * Composes a narrative segment for cascade destruction.
 * @param {object} cascadeEntry - Cascade destruction data
 * @returns {string} Formatted cascade narrative segment
 */
#composeCascadeSegment(cascadeEntry) {
  const partNames = cascadeEntry.destroyedParts.map((p) =>
    this.#formatPartName(p.partType, p.orientation)
  );
  const formattedList = this.#formatPartList(partNames);
  const sourceName = this.#formatPartName(
    cascadeEntry.sourcePartType,
    cascadeEntry.sourceOrientation
  );
  const verb = partNames.length === 1 ? 'is' : 'are';

  return `As ${cascadeEntry.entityPossessive} ${sourceName} collapses, ${formattedList} ${verb} destroyed.`;
}
```

### Modified compose Method

Update signature to accept optional cascadeDestructions:

```javascript
/**
 * Composes damage narrative from accumulated entries.
 * @param {Array} entries - Damage entries to compose
 * @param {Array} [cascadeDestructions=[]] - Cascade destruction events
 * @returns {string} Composed narrative
 */
compose(entries, cascadeDestructions = []) {
  const segments = [];

  // ... existing logic for entries (unchanged) ...

  // NEW: Add cascade segments after regular damage narrative
  for (const cascadeEntry of cascadeDestructions) {
    segments.push(this.#composeCascadeSegment(cascadeEntry));
  }

  return segments.join(' ');
}
```

### Example Output

For a torso destruction with heart, spine, left lung, right lung:

```
"As her torso collapses, heart, spine, left lung, and right lung are destroyed."
```

For a single organ:

```
"As his head collapses, brain is destroyed."
```

### Cascade Entry Shape (assumed)

```javascript
{
  entityPossessive: 'her',
  sourcePartType: 'torso',
  sourceOrientation: null,
  destroyedParts: [
    { partType: 'heart', orientation: null },
    { partType: 'lung', orientation: 'left' },
  ],
}
```

## Acceptance Criteria

### Tests That Must Pass

1. `compose should accept optional cascadeDestructions parameter`
2. `compose with undefined cascadeDestructions should work (backward compatible)`
3. `compose with empty cascadeDestructions array should produce same output as before`
4. `#composeCascadeSegment should format single organ correctly (singular verb "is")`
5. `#composeCascadeSegment should format two organs correctly (plural verb "are")`
6. `#composeCascadeSegment should format multiple organs with Oxford comma`
7. `#composeCascadeSegment should use entity possessive correctly`
8. `#composeCascadeSegment should handle oriented parts (e.g., "left lung")`
9. `cascade segments should appear after regular damage narrative (including propagation)`
10. All existing DamageNarrativeComposer tests continue to pass unchanged

### Invariants

- Default parameter ensures backward compatibility
- Uses existing `#formatPartName` and `#formatPartList` methods (no duplication)
- Narrative style matches existing project voice ("collapses", "destroyed")
- Proper subject-verb agreement (is/are based on count)
- Orientation handled consistently with existing part name formatting

## Dependencies

- Depends on: Nothing (can run in parallel with APPDAMCASDES-002, APPDAMCASDES-003)
- Blocks: APPDAMCASDES-005 (integration requires this method signature)

## Verification Commands

```bash
# Run unit tests for DamageNarrativeComposer
npm run test:unit -- tests/unit/anatomy/services/damageNarrativeComposer.test.js

# Lint modified file
npx eslint src/anatomy/services/damageNarrativeComposer.js

# Type check
npm run typecheck
```

## Notes

- This is primarily additive - existing behavior unchanged
- The `#formatPartList` method already handles Oxford comma formatting
- `#formatPartName` already handles orientation; reuse it directly

## Outcome

- Added cascade destruction composition after damage/propagation narrative in `compose`, using existing part formatting helpers.
- Expanded unit coverage for cascade segments (singular/plural, Oxford comma, orientation, ordering).
- Updated examples to match existing formatting (no articles) and documented cascade entry shape.
