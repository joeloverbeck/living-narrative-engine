# APPDAME2ECOV-003: Metadata and Damage Tags Coverage

Status: Completed

## Summary

Add end-to-end coverage proving `metadata` and `damage_tags` on `damage_entry` survive the APPLY_DAMAGE pipeline: they should be captured in the damage session entries and emitted on the `anatomy:damage_applied` event (including multi-entry weapons).

## Background

Current behavior (from `src/logic/operationHandlers/applyDamageHandler.js` and `src/logic/services/damageResolutionService.js`):

- `metadata` and `damage_tags` parameters are accepted, normalized (deduped tags), and stored on the normalized `finalDamageEntry` as `metadata` and `damageTags`.
- `DamageResolutionService` records these fields into each session entry and queues them on the `anatomy:damage_applied` payload.
- `DamageTypeEffectsService` and `DamageNarrativeComposer` do **not** read or propagate metadata/tags today, and effect payloads/components have no slots for them.
- Existing coverage only validates schema acceptance (`tests/integration/mods/anatomy/missingEventDefinitions.integration.test.js`) but never runs the live pipeline with metadata/tags present.

## Files Expected to Touch

### New Files

- `tests/e2e/actions/damageMetadataTags.e2e.test.js` - New e2e test suite

### Files Referenced (Read-Only for Context)

- `src/logic/operationHandlers/applyDamageHandler.js` - Metadata/tags processing
- `src/logic/services/damageResolutionService.js` - Session recording
- `data/schemas/operations/applyDamage.schema.json` - Schema for damage_entry
- `data/mods/anatomy/events/damage_applied.event.json` - Event payload shape

## Out of Scope

- Propagating metadata/tags into effect components or effect event payloads (not supported in current services)
- Narrative composition changes (metadata/tags unused today)
- Modifications to existing e2e test files
- Changes to schema definitions

## Acceptance Criteria

### Tests That Must Pass

1. **Session captures metadata**  
   - Test: `should record damage_entry metadata in damage session`  
   - Verifies: `damageAccumulator.finalize` entries include `metadata` from the originating entry.

2. **Session captures tags (deduped)**  
   - Test: `should record damage_tags array in damage session`  
   - Verifies: session entries include `damageTags` with duplicates removed.

3. **Damage event includes metadata/tags**  
   - Test: `should include metadata and damageTags in anatomy:damage_applied payload`  
   - Verifies: queued/dispatch payload matches the entry data.

4. **Multi-entry isolation**  
   - Test: `should preserve distinct metadata/tags for each damage entry on multi-entry weapons`  
   - Verifies: Each recorded entry keeps its own metadata/tags.

### Invariants That Must Remain True

- Existing e2e tests in `tests/e2e/actions/` continue to pass
- No changes to production behavior (tests-only unless a blocking defect is uncovered)
- Test follows existing patterns in `damageEffectsTriggers.e2e.test.js`
- Uses `ModTestFixture` and `ModEntityBuilder` from test utilities
- Properly cleans up test resources in `afterEach`
- Metadata/tags are optional - absence should not cause failures

## Implementation Notes

- Create custom weapon definitions with `metadata` and `damage_tags` on damage entries (dedupe expectations use resolved `damageTags`).
- Example metadata: `{ "source": "enchanted", "element": "fire" }`
- Example tags: `["magical", "holy", "critical_hit"]`
- Capture events via the fixture event bus to verify payload contents.
- Inspect `damageAccumulator.finalize` output to assert session recording.
- Test with multiple damage entries having different metadata/tags.

## Outcome

- Enabled APPLY_DAMAGE to fall back to `damage_entry.metadata` / `damage_entry.damage_tags` when top-level params are absent so the live pipeline retains the authored data.
- Added `tests/e2e/actions/damageMetadataTags.e2e.test.js` to assert session recording, event payload inclusion, tag deduping, and multi-entry isolation for metadata/tags.

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/damageMetadataTags.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file)

## Estimated Size

Medium - Single test file with ~7-8 test cases
