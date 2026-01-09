# TWOPHAEMOSTAUPD-007: LLMChooser Integration and Listener Updates

## Summary

Wire the `TwoPhaseDecisionOrchestrator` into `LLMChooser` and update event listeners to handle the new `MOOD_STATE_UPDATED` event correctly.

## Status

Completed.

## Assumptions (Updated)

- `TwoPhaseDecisionOrchestrator` is already registered via DI and returns the same shape as `LLMChooser.choose()` (index/speech + extracted metadata).
- `MOOD_STATE_UPDATED_ID` is dispatched by `MoodPersistenceService` with payload `{ actorId, moodUpdate, sexualUpdate }` (not nested under `extractedData`).
- `LLMChooser` will always delegate to the orchestrator (no legacy single-prompt fallback in this adapter).
- Persistence listeners are currently subscribed only to `ACTION_DECIDED_ID` and must add `MOOD_STATE_UPDATED_ID` to avoid double updates in the two-phase flow.

## Dependencies

- **Requires:** TWOPHAEMOSTAUPD-006 (TwoPhaseDecisionOrchestrator)

## Files to Touch

| File | Action |
|------|--------|
| `src/turns/adapters/llmChooser.js` | MODIFY |
| `src/dependencyInjection/registrations/aiRegistrations.js` | MODIFY |
| `src/ai/moodSexualPersistenceListener.js` | MODIFY |
| `src/expressions/expressionPersistenceListener.js` | MODIFY |
| `src/initializers/services/initializationService.js` | MODIFY |
| `tests/unit/turns/adapters/llmChooser.test.js` | MODIFY |
| `tests/unit/ai/moodSexualPersistenceListener.test.js` | MODIFY |
| `tests/unit/expressions/expressionPersistenceListener.test.js` | MODIFY |

## Out of Scope

- **DO NOT** modify debug button UI (separate ticket TWOPHAEMOSTAUPD-008)
- **DO NOT** modify prompt content or schemas
- **DO NOT** create new services (already done in prior tickets)
- **DO NOT** modify game engine

## Implementation Details

### Modify: `llmChooser.js`

**Changes required:**

1. Add `twoPhaseOrchestrator` dependency to constructor
2. Validate the new dependency
3. Modify `choose()` to delegate entirely to orchestrator:

```javascript
class LLMChooser {
  #twoPhaseOrchestrator;
  #logger;
  // Remove #promptPipeline, #llmAdapter, #responseProcessor if no longer needed directly

  constructor({ twoPhaseOrchestrator, logger }) {
    if (!twoPhaseOrchestrator?.orchestrate) {
      throw new Error('LLMChooser: twoPhaseOrchestrator must have orchestrate method');
    }
    if (!logger?.debug) {
      throw new Error('LLMChooser: logger required');
    }

    this.#twoPhaseOrchestrator = twoPhaseOrchestrator;
    this.#logger = logger;
  }

  async choose({ actor, context, actions, abortSignal }) {
    this.#logger.debug(`LLMChooser: Delegating to two-phase orchestrator for ${actor.id}`);
    return await this.#twoPhaseOrchestrator.orchestrate({
      actor,
      context,
      actions,
      abortSignal,
    });
  }
}
```

**Note:** Review if any other methods in `LLMChooser` still need direct access to `promptPipeline`, `llmAdapter`, or `responseProcessor`. If so, keep those dependencies. Otherwise, simplify to just orchestrator + logger.

Also update DI registration to pass `TwoPhaseDecisionOrchestrator` into `LLMChooser`.

### Modify: `moodSexualPersistenceListener.js`

**Changes required:**

1. Add handling for `MOOD_STATE_UPDATED_ID` event
2. Track whether mood was already updated this turn to prevent double-updates
3. Modify `ACTION_DECIDED_ID` handler to check if mood already updated

```javascript
import { ACTION_DECIDED_ID, MOOD_STATE_UPDATED_ID } from '../constants/eventIds.js';

class MoodSexualPersistenceListener {
  #moodUpdatedThisTurn = new Set(); // Track actors who already had mood updated

  handleEvent(event) {
    if (event.type === MOOD_STATE_UPDATED_ID) {
      // Mark that this actor's mood was updated via two-phase flow
      this.#moodUpdatedThisTurn.add(event.payload.actorId);
      // Mood already persisted by MoodPersistenceService - nothing to do
      this.#logger.debug(`MoodSexualPersistenceListener: Mood already updated for ${event.payload.actorId}`);
      return;
    }

    if (event.type === ACTION_DECIDED_ID) {
      const { actorId, extractedData } = event.payload;

      // Check if mood was already updated this turn (two-phase flow)
      if (this.#moodUpdatedThisTurn.has(actorId)) {
        this.#logger.debug(`MoodSexualPersistenceListener: Skipping mood for ${actorId} - already updated`);
        this.#moodUpdatedThisTurn.delete(actorId); // Clear for next turn
        return;
      }

      // Legacy single-prompt flow - apply mood update
      if (extractedData?.moodUpdate) {
        this.#applyMoodUpdate(actorId, extractedData.moodUpdate);
      }
      if (extractedData?.sexualUpdate) {
        this.#applySexualUpdate(actorId, extractedData.sexualUpdate);
      }
    }
  }
}
```

### Modify: `expressionPersistenceListener.js`

**Changes required:**

1. Subscribe to `MOOD_STATE_UPDATED_ID` in addition to `ACTION_DECIDED_ID`
2. Evaluate expressions when `MOOD_STATE_UPDATED_ID` fires (after Phase 1)
3. Prevent double-evaluation (only evaluate once per turn)

```javascript
import { ACTION_DECIDED_ID, MOOD_STATE_UPDATED_ID } from '../constants/eventIds.js';

class ExpressionPersistenceListener {
  #expressionEvaluatedThisTurn = new Set();

  async handleEvent(event) {
    if (event.type === MOOD_STATE_UPDATED_ID) {
      // Evaluate expressions after Phase 1 mood update
      const { actorId, moodUpdate, sexualUpdate } = event.payload;
      await this.#evaluateExpressions(actorId, moodUpdate, sexualUpdate);
      this.#expressionEvaluatedThisTurn.add(actorId);
      return;
    }

    if (event.type === ACTION_DECIDED_ID) {
      const { actorId, extractedData } = event.payload;

      // Skip if already evaluated this turn (two-phase flow)
      if (this.#expressionEvaluatedThisTurn.has(actorId)) {
        this.#logger.debug(`ExpressionPersistenceListener: Skipping for ${actorId} - already evaluated`);
        this.#expressionEvaluatedThisTurn.delete(actorId);
        return;
      }

      // Legacy single-prompt flow - evaluate now
      if (extractedData?.moodUpdate) {
        await this.#evaluateExpressions(actorId, extractedData.moodUpdate, extractedData.sexualUpdate);
      }
    }
  }
}
```

### Modify: `initializationService.js`

**Changes required:**

Subscribe listeners to `MOOD_STATE_UPDATED_ID`:

```javascript
setupPersistenceListeners(
  this.#safeEventDispatcher,
  [
    // Existing subscriptions
    { eventId: ACTION_DECIDED_ID, handler: moodSexualListener.handleEvent.bind(moodSexualListener) },
    { eventId: ACTION_DECIDED_ID, handler: expressionListener.handleEvent.bind(expressionListener) },
    // NEW subscriptions for two-phase flow
    { eventId: MOOD_STATE_UPDATED_ID, handler: moodSexualListener.handleEvent.bind(moodSexualListener) },
    { eventId: MOOD_STATE_UPDATED_ID, handler: expressionListener.handleEvent.bind(expressionListener) },
    // ... other listeners
  ],
  logger
);
```

## Acceptance Criteria

### Tests that must pass

#### `llmChooser.test.js` (MODIFY)

1. Constructor validates `twoPhaseOrchestrator` dependency
2. `choose()` calls `orchestrator.orchestrate()` with all params
3. `choose()` returns orchestrator result unchanged
4. `choose()` passes `abortSignal` to orchestrator

#### `moodSexualPersistenceListener.test.js` (MODIFY)

5. Handles `MOOD_STATE_UPDATED_ID` event type
6. Tracks actors whose mood was updated via two-phase flow
7. Skips mood update on `ACTION_DECIDED_ID` if already updated
8. Clears tracking after skipping
9. Still applies mood on `ACTION_DECIDED_ID` if not already updated (legacy flow)

#### `expressionPersistenceListener.test.js` (MODIFY)

10. Handles `MOOD_STATE_UPDATED_ID` event type
11. Evaluates expressions on `MOOD_STATE_UPDATED_ID`
12. Tracks actors whose expressions were evaluated
13. Skips evaluation on `ACTION_DECIDED_ID` if already evaluated
14. Clears tracking after skipping
15. Still evaluates on `ACTION_DECIDED_ID` if not already evaluated (legacy flow)

#### Updated Scope Notes

16. No legacy single-prompt fallback in `LLMChooser` (orchestrator is always used).
17. Rely on existing `TwoPhaseDecisionOrchestrator` unit coverage for phase ordering; add listener unit tests for event handling and skip logic.

### Invariants that must remain true

1. Backward-compatible return type from `LLMChooser.choose()`
2. Expressions evaluate after Phase 1, not after Phase 2
3. No double mood persistence in single turn
4. No double expression evaluation in single turn
5. `MOOD_STATE_UPDATED_ID` dispatched by `MoodPersistenceService`, not listeners

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/turns/adapters/llmChooser.test.js
npm run test:unit -- tests/unit/ai/moodSexualPersistenceListener.test.js
npm run test:unit -- tests/unit/expressions/expressionPersistenceListener.test.js

# Lint all modified files
npx eslint src/turns/adapters/llmChooser.js src/ai/moodSexualPersistenceListener.js src/expressions/expressionPersistenceListener.js
```

## Estimated Scope

- ~30 lines modifications to `llmChooser.js`
- ~40 lines modifications to `moodSexualPersistenceListener.js`
- ~40 lines modifications to `expressionPersistenceListener.js`
- ~10 lines modifications to `initializationService.js`
- ~100 lines test modifications
- Medium-sized diff with multiple related changes

## Outcome

Updated `LLMChooser` to delegate to `TwoPhaseDecisionOrchestrator` with DI wiring changes, and added MOOD_STATE_UPDATED handling + per-turn skip tracking in the mood/sexual and expression listeners with initialization subscriptions. Instead of creating a new two-phase integration test, updated existing unit/integration coverage and listener tests to align with event type handling and avoid double persistence.
