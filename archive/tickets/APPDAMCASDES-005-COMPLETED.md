# APPDAMCASDES-005: Integrate Cascade into DamageResolutionService

**Title:** Wire CascadeDestructionService into Damage Resolution Flow

**Summary:** Integrate the cascade destruction logic into the main damage resolution pipeline, calling the service when a part is destroyed and feeding cascade entries into narrative composition.

**Status:** Completed

## Files to Modify

- `src/logic/services/damageResolutionService.js`
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` (add dependency to factory)
- `tests/unit/logic/services/damageResolutionService.test.js`

## Files to Create

- None

## Out of Scope

- CascadeDestructionService implementation changes (ticket APPDAMCASDES-001)
- DamageAccumulator implementation changes (ticket APPDAMCASDES-003)
- DamageNarrativeComposer implementation changes (ticket APPDAMCASDES-004)
- DI token definition (ticket APPDAMCASDES-002)
- Integration tests (ticket APPDAMCASDES-006)
- E2E tests (ticket APPDAMCASDES-007)

## Implementation Details

### Constructor Changes in `damageResolutionService.js`

Add to constructor parameters:

```javascript
constructor({
  // ... existing parameters ...
  cascadeDestructionService,  // NEW
}) {
```

Add private field:

```javascript
#cascadeDestructionService;
```

Note: `DamageResolutionService` currently does not validate dependencies via `validateDependency`, so keep consistent and only assign the dependency (allowing a fallback stub if needed for non-DI usage).

### Integration Point (~line 321)

After the existing `PART_DESTROYED_EVENT` dispatch:

```javascript
if (newHealth <= 0 && previousHealth > 0) {
  this.#dispatcher.dispatch(PART_DESTROYED_EVENT, {
    // ... existing event data ...
  });

  // NEW: Cascade destruction for children
  const cascadeResult = await this.#cascadeDestructionService.executeCascade(
    partId,
    ownerEntityId || entityId
  );

  if (cascadeResult.destroyedPartIds.length > 0 && session) {
    this.#damageAccumulator.recordCascadeDestruction(session, {
      sourcePartId: partId,
      sourcePartType: partType,
      sourceOrientation: orientation,
      destroyedParts: cascadeResult.destroyedParts,
      entityName,
      entityPossessive,
    });
  }
}
```

### Narrative Composition Update (~line 466)

Update the compose call:

```javascript
composedNarrative = this.#damageNarrativeComposer.compose(
  entries,
  finalized.cascadeDestructions  // NEW parameter
);
```

### DI Registration Update in `worldAndEntityRegistrations.js`

Update DamageResolutionService factory (~line 1160):

```javascript
registrar.singletonFactory(tokens.DamageResolutionService, (c) => {
  return new DamageResolutionService({
    // ... existing dependencies ...
    cascadeDestructionService: c.resolve(tokens.CascadeDestructionService),  // NEW
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

1. `should call cascadeDestructionService.executeCascade when part health transitions to 0`
2. `should NOT call executeCascade when part damaged but not destroyed`
3. `should NOT call executeCascade when part was already at 0 health`
4. `should record cascade destruction to accumulator when children destroyed`
5. `should NOT record cascade destruction when no children destroyed`
6. `should pass cascadeDestructions to narrative composer`
7. `should handle executeCascade returning empty destroyedPartIds gracefully`
8. `should pass correct ownerEntityId to executeCascade`
9. All existing DamageResolutionService tests continue to pass
10. `npm run typecheck` passes

### Invariants

- Cascade only triggers on transition to 0 health (`newHealth <= 0 && previousHealth > 0`)
- Cascade happens asynchronously but is awaited within resolve() flow
- Existing damage propagation logic unchanged
- Death check still runs after all damage (including cascade)
- Session can be null (no cascade recording when no session)
- Cascade result checked before recording (avoid empty records)

## Dependencies

- Depends on:
  - APPDAMCASDES-001 (CascadeDestructionService)
  - APPDAMCASDES-002 (DI token)
  - APPDAMCASDES-003 (recordCascadeDestruction method)
  - APPDAMCASDES-004 (compose signature change)
- Blocks:
  - APPDAMCASDES-006 (integration tests)
  - APPDAMCASDES-007 (E2E tests)

## Verification Commands

```bash
# Run unit tests for DamageResolutionService
npm run test:unit -- tests/unit/logic/services/damageResolutionService.test.js

# Lint modified files
npx eslint src/logic/services/damageResolutionService.js src/dependencyInjection/registrations/worldAndEntityRegistrations.js

# Type check
npm run typecheck

# Run full unit test suite to verify no regressions
npm run test:unit
```

## Notes

- This is the critical integration ticket - all previous tickets must be complete
- Test updates should mock CascadeDestructionService for unit tests
- Existing mocks need the new dependency added to constructor calls
- The session parameter is optional in the service, handle null case

## Outcome

- Wired DamageResolutionService to await CascadeDestructionService on part-destroyed transitions and record cascades when present.
- Passed finalized cascadeDestructions into the narrative composer; compose signature already supported this.
- Kept dependency handling consistent with existing DamageResolutionService (no validateDependency addition) and used a no-op fallback for non-DI instantiations.
- Updated DI registration and unit/integration test harnesses to supply CascadeDestructionService stubs where needed.
