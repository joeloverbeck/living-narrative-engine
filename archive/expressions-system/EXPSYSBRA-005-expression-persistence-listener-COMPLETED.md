# EXPSYSBRA-005: Expression Persistence Listener

## Summary

Create the `ExpressionPersistenceListener` that subscribes to `ACTION_DECIDED_ID` events and orchestrates expression evaluation and dispatch when mood/sexual state changes.

## Background

This is the integration point between the LLM response processing flow and the expression system. It:
1. Listens for `ACTION_DECIDED_ID` events (same event mood/sexual persistence uses)
2. Extracts mood and sexual state updates from the event
3. Builds evaluation context using `ExpressionContextBuilder` (which calculates emotions/sexual states)
4. Evaluates expressions using `ExpressionEvaluatorService`
5. Dispatches matched expression using `ExpressionDispatcher`
6. Tracks previous state for state-change comparisons

## File List (Expected to Touch)

### New Files
- `src/expressions/expressionPersistenceListener.js` - Main listener

### Files to Read (NOT modify)
- `src/ai/moodSexualPersistenceListener.js` - Pattern reference (similar listener)
- `src/constants/eventIds.js` - `ACTION_DECIDED_ID` constant
- `src/constants/componentIds.js` - `MOOD_COMPONENT_ID`, `SEXUAL_STATE_COMPONENT_ID`
- `src/initializers/services/initializationService.js` - Where listeners are registered

## Out of Scope (MUST NOT Change)

- `src/ai/moodSexualPersistenceListener.js` - Reference only
- `src/turns/services/LLMResponseProcessor.js` - No modifications needed
- `src/initializers/services/initializationService.js` - Modified in EXPSYSBRA-006
- `src/constants/eventIds.js` - Use existing constants
- Any existing persistence listeners

## Implementation Details

### Class: `ExpressionPersistenceListener`

```javascript
/**
 * @file Expression Persistence Listener - Handles expression evaluation on state changes
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../constants/componentIds.js';

class ExpressionPersistenceListener {
  #expressionContextBuilder;
  #expressionEvaluatorService;
  #expressionDispatcher;
  #entityManager;
  #logger;
  #previousStateCache; // Map<actorId, PreviousState>
  #turnCounter;

  constructor({
    expressionContextBuilder,
    expressionEvaluatorService,
    expressionDispatcher,
    entityManager,
    logger
  }) {
    validateDependency(expressionContextBuilder, 'IExpressionContextBuilder', logger);
    validateDependency(expressionEvaluatorService, 'IExpressionEvaluatorService', logger);
    validateDependency(expressionDispatcher, 'IExpressionDispatcher', logger);
    validateDependency(entityManager, 'IEntityManager', logger);

    this.#expressionContextBuilder = expressionContextBuilder;
    this.#expressionEvaluatorService = expressionEvaluatorService;
    this.#expressionDispatcher = expressionDispatcher;
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#previousStateCache = new Map();
    this.#turnCounter = 0;
  }

  /**
   * Handle ACTION_DECIDED event
   * @param {Object} event - The action decided event
   */
  async handleEvent(event) {
    const { actorId, extractedData } = event?.payload || {};

    if (!actorId) {
      this.#logger.debug('Expression listener: No actorId in event, skipping');
      return;
    }

    // Check if there are mood or sexual state updates
    const { moodUpdate, sexualUpdate } = extractedData || {};
    if (!moodUpdate && !sexualUpdate) {
      this.#logger.debug('Expression listener: No mood/sexual updates, skipping');
      return;
    }

    this.#turnCounter++;

    try {
      await this.#processStateChange(actorId, moodUpdate, sexualUpdate);
    } catch (err) {
      this.#logger.error(`Expression listener error for actor ${actorId}`, err);
      // Don't rethrow - graceful degradation
    }
  }

  /**
   * Process mood/sexual state change and potentially dispatch expression
   * @private
   */
  async #processStateChange(actorId, moodUpdate, sexualUpdate) {
    // Get current component data (after MoodSexualPersistenceListener has updated)
    const moodData = this.#getMoodData(actorId, moodUpdate);
    const sexualStateData = this.#getSexualStateData(actorId, sexualUpdate);

    if (!moodData) {
      this.#logger.warn(`Expression listener: No mood data for actor ${actorId}`);
      return;
    }

    // Get previous state for comparison
    const previousState = this.#previousStateCache.get(actorId) || null;

    // Build evaluation context
    const context = this.#expressionContextBuilder.buildContext(
      actorId,
      moodData,
      sexualStateData || null,
      previousState
    );

    // Evaluate expressions
    const matchedExpression = this.#expressionEvaluatorService.evaluate(context);

    if (matchedExpression) {
      this.#logger.debug(
        `Expression matched for actor ${actorId}: ${matchedExpression.id}`
      );

      // Dispatch the expression
      await this.#expressionDispatcher.dispatch(
        actorId,
        matchedExpression,
        this.#turnCounter
      );
    }

    // Cache current state for next comparison
    this.#previousStateCache.set(actorId, {
      emotions: context.emotions,
      sexualStates: context.sexualStates,
      moodAxes: context.moodAxes
    });
  }

  /**
   * Get mood data, merging update with existing component
   * @private
   */
  #getMoodData(actorId, moodUpdate) {
    try {
      // Get current component (may have been updated by MoodSexualPersistenceListener)
      const current = this.#entityManager.getComponentData(actorId, MOOD_COMPONENT_ID);
      if (moodUpdate && current) {
        return { ...current, ...moodUpdate };
      }
      return current || moodUpdate || null;
    } catch {
      return moodUpdate || null;
    }
  }

  /**
   * Get sexual state data, merging update with existing component
   * @private
   */
  #getSexualStateData(actorId, sexualUpdate) {
    try {
      const current = this.#entityManager.getComponentData(actorId, SEXUAL_STATE_COMPONENT_ID);
      if (sexualUpdate && current) {
        return { ...current, ...sexualUpdate };
      }
      return current || sexualUpdate;
    } catch {
      return sexualUpdate || null;
    }
  }

  /**
   * Clear cached previous states (for testing or game reset)
   */
  clearCache() {
    this.#previousStateCache.clear();
    this.#turnCounter = 0;
  }

  /**
   * Get turn counter (for testing)
   */
  getTurnCounter() {
    return this.#turnCounter;
  }
}

export default ExpressionPersistenceListener;
```

### Event Flow

```
LLM Response Processed
    ↓
ACTION_DECIDED_ID dispatched (with moodUpdate, sexualUpdate)
    ↓
MoodSexualPersistenceListener.handleEvent() [existing]
    ├→ Updates mood component
    └→ Updates sexual state component
    ↓
ExpressionPersistenceListener.handleEvent() [NEW]
    ├→ Get current mood/sexual data (after update)
    ├→ Get previous state from cache
    ├→ Build evaluation context
    ├→ Evaluate expressions
    ├→ Dispatch matched expression (if any)
    └→ Cache current state for next turn
```

### Listener Registration (Reference for EXPSYSBRA-006)

In `initializationService.js`:
```javascript
setupPersistenceListeners(this.#safeEventDispatcher, [
  // ... existing listeners ...
  {
    eventId: ACTION_DECIDED_ID,
    handler: this.#expressionPersistenceListener.handleEvent.bind(
      this.#expressionPersistenceListener
    )
  }
], this.#logger);
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Test: `tests/unit/expressions/expressionPersistenceListener.test.js`**
   - `should skip when event has no actorId`
   - `should skip when event has no mood or sexual updates`
   - `should build context from mood and sexual state data`
   - `should include previous state in context when available`
   - `should pass null previous state on first evaluation`
   - `should cache current state after evaluation`
   - `should call evaluator with built context`
   - `should dispatch matched expression`
   - `should not dispatch when no expression matches`
   - `should increment turn counter on each event with mood/sexual updates`
   - `should handle errors gracefully without rethrowing`
   - `should merge update with existing component data`
   - `should handle missing mood component gracefully`
   - `should validate dependencies in constructor`
   - `should clear cache with clearCache method`

### Invariants That Must Remain True

1. **Non-blocking** - Never blocks LLM response processing
2. **Graceful degradation** - Errors don't propagate to caller
3. **State caching** - Previous state cached per actor
4. **Turn tracking** - Turn counter incremented per event that includes mood/sexual updates
5. **Order independence** - Works regardless of listener order
6. **Component merge** - Updates merged with existing data

## Estimated Size

- ~150-180 lines of code
- Single file addition
- Orchestrates existing services

## Dependencies

- Depends on: EXPSYSBRA-002 (ExpressionContextBuilder)
- Depends on: EXPSYSBRA-003 (ExpressionEvaluatorService)
- Depends on: EXPSYSBRA-004 (ExpressionDispatcher)
- Uses: `IEntityManager`

## Notes

- Follows same pattern as `MoodSexualPersistenceListener`
- Runs AFTER mood/sexual state is persisted (listener order)
- Previous state cache enables "sudden change" expressions
- Turn counter enables rate limiting in dispatcher
- Consider future: significance threshold for state changes

## Status

Completed.

## Outcome

Implemented `ExpressionPersistenceListener` with dependency validation, event filtering, component merge logic, and state caching. The listener now delegates emotion/sexual state calculation to `ExpressionContextBuilder` (matching current architecture) and passes `null` when sexual state data is unavailable rather than forcing zeroed defaults. Added unit tests for skip logic, context building, previous-state caching, dispatch behavior, turn counter tracking, and error handling; DI registration remains scoped to EXPSYSBRA-006.
