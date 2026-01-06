# EXPSYSBRA-004: Expression Dispatcher Service

## Summary

Create the `ExpressionDispatcher` service that takes a matched expression and dispatches it as a perceptible event through the existing sense-aware perception system.

## Background

The dispatcher is responsible for:
1. Taking a matched expression from the evaluator
2. Replacing placeholders (`{actor}`) with actual values
3. Determining the actor's current location (via `core:position`)
4. Dispatching a `core:perceptible_event` with the expression data (EventBus payload shape)
5. Handling rate limiting (one expression per turn, global cooldown)

## File List (Expected to Touch)

### New Files
- `src/expressions/expressionDispatcher.js` - Dispatcher service

### Files to Read (NOT modify)
- `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` - Event dispatch pattern
- `src/constants/eventIds.js` - (confirm there is no `core:perceptible_event` constant)
- `src/constants/componentIds.js` - Component ID constants
- `src/events/eventBus.js` - Event dispatch interface

## Out of Scope (MUST NOT Change)

- `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` - Use event dispatch, not modify
- `src/events/eventBus.js` - Use as-is
- `src/constants/eventIds.js` - No new constants
- `src/perception/registries/perceptionTypeRegistry.js` - Do not register `emotion.expression` here (separate ticket)
- Any perception system files
- DI registration (separate ticket EXPSYSBRA-006)

## Implementation Details

### Class: `ExpressionDispatcher`

```javascript
/**
 * @file Expression Dispatcher - Dispatches expressions as perceptible events
 */

import { validateDependency } from '../utils/dependencyUtils.js';

const LOCATION_COMPONENT_ID = 'core:position';
const NAME_COMPONENT_ID = 'core:name';
const DEFAULT_PERCEPTION_TYPE = 'emotion.expression';

class ExpressionDispatcher {
  #eventBus;
  #entityManager;
  #logger;
  #lastDispatchTurn;  // Track to enforce one-per-turn (global cooldown)

  constructor({ eventBus, entityManager, logger }) {
    validateDependency(eventBus, 'IEventBus', logger, { requiredMethods: ['dispatch'] });
    validateDependency(entityManager, 'IEntityManager', logger);
    this.#eventBus = eventBus;
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#lastDispatchTurn = null;
  }

  /**
   * Dispatch an expression as a perceptible event
   * @param {string} actorId - Actor experiencing the expression
   * @param {Expression} expression - Matched expression to dispatch
   * @param {number} turnNumber - Current turn number for rate limiting
   * @returns {boolean} - True if dispatched, false if rate limited or blocked
   */
  async dispatch(actorId, expression, turnNumber) {
    // Rate limiting: one expression per turn (global)
    if (this.#lastDispatchTurn === turnNumber) {
      this.#logger.debug(
        `Expression dispatch rate limited on turn ${turnNumber}`
      );
      return false;
    }

    try {
      const locationId = this.#getActorLocationId(actorId);
      if (!locationId) {
        this.#logger.warn(`Cannot dispatch expression: actor ${actorId} has no location`);
        return false;
      }

      const actorName = this.#getActorName(actorId);
      const descriptionText = this.#replacePlaceholders(expression.description_text, {
        actor: actorName
      });

      const eventPayload = {
        eventName: 'core:perceptible_event',
        locationId,
        originLocationId: locationId,
        descriptionText,
        actorDescription: expression.actor_description ?? null,
        perceptionType: expression.perception_type || DEFAULT_PERCEPTION_TYPE,
        actorId,
        targetId: null,
        involvedEntities: [],
        alternateDescriptions: expression.alternate_descriptions ?? null,
        senseAware: true,
        contextualData: {
          source: 'expression_system',
          expressionId: expression.id
        },
        timestamp: new Date().toISOString()
      };

      await this.#eventBus.dispatch('core:perceptible_event', eventPayload);

      // Update rate limit tracking
      this.#lastDispatchTurn = turnNumber;

      this.#logger.debug(
        `Dispatched expression ${expression.id} for actor ${actorId}`,
        { locationId, perceptionType: eventPayload.payload.perceptionType }
      );

      return true;
    } catch (err) {
      this.#logger.error(`Failed to dispatch expression ${expression.id}`, err);
      return false;
    }
  }

  /**
   * Clear rate limit tracking (e.g., on new game or test reset)
   */
  clearRateLimits() {
    this.#lastDispatchTurn = null;
  }

  /**
   * Get actor's current location ID
   * @private
   */
  #getActorLocationId(actorId) {
    try {
      const locationComponent = this.#entityManager.getComponentData(
        actorId,
        LOCATION_COMPONENT_ID
      );
      return locationComponent?.locationId || null;
    } catch {
      return null;
    }
  }

  /**
   * Get actor's display name
   * @private
   */
  #getActorName(actorId) {
    try {
      const nameComponent = this.#entityManager.getComponentData(
        actorId,
        NAME_COMPONENT_ID
      );
      return nameComponent?.text || nameComponent?.value || actorId;
    } catch {
      return actorId;
    }
  }

  /**
   * Replace placeholders in description text
   * @private
   */
  #replacePlaceholders(text, values) {
    if (!text) return '';

    let result = text;
    for (const [placeholder, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
    }
    return result;
  }
}

export default ExpressionDispatcher;
```

### Event Payload Structure

```javascript
{
  eventName: 'core:perceptible_event',
  locationId: 'location_entity_id',
  originLocationId: 'location_entity_id',
  descriptionText: "Alice's jaw locks and their movements get sharp...",
  actorDescription: "Heat floods my face. I want to do something...",
  perceptionType: 'emotion.expression',
  actorId: 'actor_entity_id',
  targetId: null,
  involvedEntities: [],
  alternateDescriptions: {
    auditory: "You hear a sharp intake of breath nearby.",
    tactile: "...",
    olfactory: "..."
  },
  senseAware: true,
  contextualData: {
    source: 'expression_system',
    expressionId: 'core:suppressed_rage'
  },
  timestamp: '2024-01-15T10:30:00.000Z'
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Test: `tests/unit/expressions/expressionDispatcher.test.js`**
   - `should dispatch expression as perceptible event`
   - `should replace {actor} placeholder with actor name`
   - `should use actor ID as fallback when name unavailable`
   - `should include alternate descriptions in payload`
   - `should use default perception type when not specified`
   - `should rate limit to one expression per turn`
   - `should return false when rate limited`
   - `should return false when actor has no location`
   - `should clear rate limits with clearRateLimits method`
   - `should handle dispatch errors gracefully`
   - `should validate dependencies in constructor`
   - `should include timestamp in event payload`
   - `should include expression ID in payload for debugging`

### Invariants That Must Remain True

1. **One expression per turn (global)** - Rate limiting enforced
2. **No dispatch without location** - Actor must have location
3. **Placeholder replacement is safe** - Handle missing placeholders
4. **Graceful error handling** - Return false, don't throw
5. **Async dispatch** - Returns promise for event dispatch
6. **Event structure matches perceptible event schema** - Compatible with existing handlers
7. **Default perception type** - `emotion.expression` when not specified

## Estimated Size

- ~120-150 lines of code
- Single file addition
- Reuses existing event dispatch infrastructure

## Dependencies

- Depends on: EXPSYSBRA-003 (ExpressionEvaluatorService - conceptually)
- Uses: `IEventBus`, `IEntityManager`

## Notes

- Event dispatched to `core:perceptible_event` (existing infrastructure)
- Rate limiting is global to prevent expression spam in a single turn
- `source: 'expression_system'` for tracing/debugging
- Placeholder pattern: `{placeholder}` - same as action descriptions
- Consider future: additional placeholders like `{target}`, `{location}`

## Status

Completed.

## Outcome

Created `ExpressionDispatcher` using the existing EventBus payload shape (no `type/payload` wrapper), resolved actor location via `core:position`, and applied a global per-turn cooldown. Added placeholder replacement for observer/alternate descriptions, contextual debug metadata (`source`, `expressionId`), and unit tests covering dispatch payload, fallbacks, rate limiting, and error handling. Perception type registry updates remain out of scope.
