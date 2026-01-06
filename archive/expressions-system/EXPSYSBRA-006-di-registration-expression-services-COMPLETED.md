# EXPSYSBRA-006: DI Registration for Expression Services

## Summary

Register all expression services in the dependency injection container and wire up the `ExpressionPersistenceListener` to the initialization flow.

Status: Completed

## Background

This ticket completes the wiring of all expression services:
1. Register expression services in a new registration bundle invoked by `baseContainerConfig`
2. Add listener to `InitializationService` constructor
3. Subscribe listener to `ACTION_DECIDED_ID` in `setupPersistenceListeners`

## File List (Expected to Touch)

### Files to Modify
- `src/dependencyInjection/registrations/expressionsRegistrations.js` (NEW FILE)
- `src/dependencyInjection/baseContainerConfig.js` - Invoke expression registrations when game systems are enabled
- `src/dependencyInjection/registrations/orchestrationRegistrations.js` - Resolve `IExpressionPersistenceListener` and pass into `InitializationService`
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IExpressionRegistry` and `IExpressionPersistenceListener` tokens if missing
- `src/initializers/services/initializationService.js` - Add listener dependency and subscription

### Files to Read (NOT modify)
- `src/dependencyInjection/registrations/orchestrationRegistrations.js` - Pattern for listener registration
- `src/dependencyInjection/registrations/loadersRegistrations.js` - Existing loader registrations
- `src/ai/moodSexualPersistenceListener.js` - Pattern reference

## Out of Scope (MUST NOT Change)

- `src/expressions/*.js` - Services created in previous tickets
- `src/loaders/expressionLoader.js` - Already registered
- `src/loaders/loaderMeta.js` - Already configured
- Existing listener registrations (don't modify, only add new)
- Any other registration files not listed above

## Implementation Details

### 1. New File: `expressionsRegistrations.js`

```javascript
/**
 * @file Expression system dependency injection registrations
 */

import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import ExpressionRegistry from '../../expressions/expressionRegistry.js';
import ExpressionContextBuilder from '../../expressions/expressionContextBuilder.js';
import ExpressionEvaluatorService from '../../expressions/expressionEvaluatorService.js';
import ExpressionDispatcher from '../../expressions/expressionDispatcher.js';
import ExpressionPersistenceListener from '../../expressions/expressionPersistenceListener.js';

/**
 * Register all expression system services
 * @param {Container} container - DI container
 */
export function registerExpressionServices(container) {
  const registrar = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Expression Registration: starting...');

  // Expression Registry
  registrar.singletonFactory(tokens.IExpressionRegistry, (c) => {
    return new ExpressionRegistry({
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
    });
  });

  // Expression Context Builder
  registrar.singletonFactory(tokens.IExpressionContextBuilder, (c) => {
    return new ExpressionContextBuilder({
      emotionCalculatorService: c.resolve(tokens.IEmotionCalculatorService),
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });

  // Expression Evaluator Service
  registrar.singletonFactory(tokens.IExpressionEvaluatorService, (c) => {
    return new ExpressionEvaluatorService({
      expressionRegistry: c.resolve(tokens.IExpressionRegistry),
      jsonLogicEvaluationService: c.resolve(tokens.JsonLogicEvaluationService),
      gameDataRepository: c.resolve(tokens.IGameDataRepository),
      logger: c.resolve(tokens.ILogger),
    });
  });

  // Expression Dispatcher
  registrar.singletonFactory(tokens.IExpressionDispatcher, (c) => {
    return new ExpressionDispatcher({
      eventBus: c.resolve(tokens.IEventBus),
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });

  // Expression Persistence Listener
  registrar.singletonFactory(tokens.IExpressionPersistenceListener, (c) => {
    return new ExpressionPersistenceListener({
      expressionContextBuilder: c.resolve(tokens.IExpressionContextBuilder),
      expressionEvaluatorService: c.resolve(tokens.IExpressionEvaluatorService),
      expressionDispatcher: c.resolve(tokens.IExpressionDispatcher),
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });

  logger.debug('Expression Registration: complete.');
}

export default registerExpressionServices;
```

### 2. Token Addition: `tokens-core.js`

If not already present, add:
```javascript
// Expression System
IExpressionRegistry: 'IExpressionRegistry',
IExpressionPersistenceListener: 'IExpressionPersistenceListener',
// Note: IExpressionContextBuilder, IExpressionEvaluatorService,
// IExpressionDispatcher, IExpressionOrchestrator already exist
```

### 3. Import in `baseContainerConfig.js`

```javascript
import { registerExpressionServices } from './registrations/expressionsRegistrations.js';

// In configureBaseContainer (when includeGameSystems is true):
registerExpressionServices(container);
```

### 4. Update `initializationService.js`

```javascript
// Add to constructor parameters
#expressionPersistenceListener;

constructor({
  // ... existing params ...
  expressionPersistenceListener,
}) {
  // ... existing validation ...
  this.#expressionPersistenceListener = expressionPersistenceListener;
}

// In setupPersistenceListeners call (around line 315-336):
setupPersistenceListeners(this.#safeEventDispatcher, [
  {
    eventId: ACTION_DECIDED_ID,
    handler: this.#thoughtListener.handleEvent.bind(this.#thoughtListener)
  },
  {
    eventId: ACTION_DECIDED_ID,
    handler: this.#notesListener.handleEvent.bind(this.#notesListener)
  },
  {
    eventId: ACTION_DECIDED_ID,
    handler: this.#moodSexualListener.handleEvent.bind(this.#moodSexualListener)
  },
  // NEW: Expression listener
  {
    eventId: ACTION_DECIDED_ID,
    handler: this.#expressionPersistenceListener.handleEvent.bind(
      this.#expressionPersistenceListener
    )
  }
], this.#logger);
```

### 5. Update `orchestrationRegistrations.js`

Add expression listener to InitializationService factory:

```javascript
const expressionPersistenceListener = c.resolve(tokens.IExpressionPersistenceListener);

// Include in InitializationService persistence block:
expressionPersistenceListener,
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Test: `tests/unit/dependencyInjection/registrations/expressionsRegistrations.test.js`**
   - `should register ExpressionRegistry with correct dependencies`
   - `should register ExpressionContextBuilder with correct dependencies`
   - `should register ExpressionEvaluatorService with correct dependencies`
   - `should register ExpressionDispatcher with correct dependencies`
   - `should register ExpressionPersistenceListener with correct dependencies`
   - `should resolve all expression services without circular dependencies`

2. **Existing Tests That Must Continue to Pass**
   - `tests/unit/dependencyInjection/registrations/orchestrationRegistrations.test.js`
   - `tests/unit/initializers/services/initializationService.*.test.js`
   - All existing initialization and DI tests

### Invariants That Must Remain True

1. **No circular dependencies** - All services resolvable
2. **Backward compatible** - Existing services unaffected
3. **Listener order** - Expression listener runs after mood/sexual listener
4. **Token uniqueness** - No token collisions
5. **Dependency resolution** - All dependencies available at registration time
6. **Existing tests pass** - No regressions

## Estimated Size

- New file: ~80-100 lines
- Modifications: ~20-30 lines across 3 files
- Token additions: 2-3 lines (if needed)

## Dependencies

- Depends on: EXPSYSBRA-001 through EXPSYSBRA-005 (all services must exist)

## Notes

- Follow existing registration patterns exactly
- Expression listener must be registered AFTER mood/sexual listener
- Use `Registrar.singletonFactory` for the registrations
- Verify EmotionCalculatorService token exists (`IEmotionCalculatorService`)
- Use `JsonLogicEvaluationService` and `IGameDataRepository` for evaluator dependencies
- Ensure `IExpressionRegistry` and `IExpressionPersistenceListener` tokens exist

## Outcome

- Added expression DI registrations and tokens, wired them into base container and initialization flow, and updated orchestration wiring.
- Updated unit/integration tests to include the expression persistence listener and added a new registration test suite, matching actual dependencies (event bus + game data repository).
