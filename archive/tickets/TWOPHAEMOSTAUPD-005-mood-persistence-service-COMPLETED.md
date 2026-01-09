# TWOPHAEMOSTAUPD-005: MOOD_STATE_UPDATED Event and MoodPersistenceService

## Summary

Add a MOOD_STATE_UPDATED event and a MoodPersistenceService to support the two-phase emotional state flow. Mood/sexual updates are already persisted on ACTION_DECIDED via MoodSexualPersistenceListener; this ticket introduces a dedicated service for Phase 1 without changing that existing behavior.

## Current Reality / Assumptions (Corrected)

- MoodSexualPersistenceListener already persists moodUpdate/sexualUpdate on ACTION_DECIDED.
- Component updates use entity.getComponentData + entity.modifyComponent and dispatch COMPONENT_ADDED_ID.
- baseline_libido is preserved during sexual state updates.
- ISafeEventDispatcher uses dispatch(eventId, payload[, options]) (not a { type, payload } envelope).
- IEntityManager exposes getEntityInstance (not getEntityById).

## Dependencies

- None (Phase 1 prompt/response pieces already exist: MoodUpdatePromptPipeline + MoodResponseProcessor).

## Files to Touch

| File | Action |
|------|--------|
| `src/constants/eventIds.js` | MODIFY |
| `src/ai/services/MoodPersistenceService.js` | CREATE |
| `src/dependencyInjection/tokens/tokens-ai.js` | MODIFY |
| `src/dependencyInjection/registrations/aiRegistrations.js` | MODIFY |
| `tests/unit/ai/services/MoodPersistenceService.test.js` | CREATE |
| `tests/unit/constants/eventIds.test.js` | MODIFY |

## Out of Scope

- Remove or rewrite MoodSexualPersistenceListener.
- Change ACTION_DECIDED flow, LLMChooser, or orchestrators.
- UI changes or expression system changes.

## Implementation Details

### Event Constant

Add to `src/constants/eventIds.js`:

```javascript
/**
 * Fired after mood/sexual state updates are persisted.
 * Intended for Phase 1 updates before action selection.
 */
export const MOOD_STATE_UPDATED_ID = 'core:mood_state_updated';
```

### New File: `MoodPersistenceService.js`

Location: `src/ai/services/MoodPersistenceService.js`

- Mirrors MoodSexualPersistenceListener update behavior (same component IDs and COMPONENT_ADDED_ID payload shape).
- Uses entityManager.getEntityInstance.
- Preserves baseline_libido for sexual_state updates.
- Dispatches MOOD_STATE_UPDATED_ID only if at least one update is applied.

### DI Token

Add to `tokens-ai.js`:
```javascript
IMoodPersistenceService: 'IMoodPersistenceService',
```

### DI Registration

Add factory to `aiRegistrations.js`:
```javascript
registrar.singletonFactory(tokens.IMoodPersistenceService, (c) =>
  new MoodPersistenceService({
    entityManager: c.resolve(tokens.IEntityManager),
    safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    logger: c.resolve(tokens.ILogger),
  })
);
```

## Acceptance Criteria

- MOOD_STATE_UPDATED_ID is exported in eventIds and covered by eventIds tests.
- MoodPersistenceService persists mood and sexual state updates using the same component update pattern as MoodSexualPersistenceListener.
- baseline_libido is preserved.
- MOOD_STATE_UPDATED_ID is dispatched with actorId + moodUpdate/sexualUpdate payload when at least one update is applied.
- Unit tests cover constructor validation, update behavior, and missing-entity/component handling.

## Verification Commands

```bash
npm run test:unit -- tests/unit/ai/services/MoodPersistenceService.test.js tests/unit/constants/eventIds.test.js
```

## Estimated Scope

- ~2 lines event constant addition
- ~120 lines for MoodPersistenceService
- ~5 lines DI token addition
- ~10 lines DI registration
- ~150-200 lines for tests

## Status

- Completed

## Outcome

- Assumptions corrected: mood/sexual updates already persist via MoodSexualPersistenceListener on ACTION_DECIDED; this ticket added a dedicated service for Phase 1 without rewiring that flow.
- Added MOOD_STATE_UPDATED_ID plus a MoodPersistenceService that mirrors existing component update behavior and preserves baseline_libido, along with DI registration and unit tests.
