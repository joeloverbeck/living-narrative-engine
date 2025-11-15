# GOAPIMPL-021-07: Dependency Injection Registration

**Parent Ticket**: GOAPIMPL-021 (GOAP Controller)
**Priority**: MEDIUM
**Estimated Effort**: 30 minutes
**Dependencies**: GOAPIMPL-021-01

## Description

Register GOAPController in the dependency injection container with proper token definition and factory configuration. Ensures controller can be injected into other services.

## Acceptance Criteria

- [ ] `IGOAPController` token defined in tokens file
- [ ] GOAPController registered in GOAP registrations
- [ ] Factory correctly resolves all dependencies
- [ ] Singleton lifecycle (one instance per actor)
- [ ] Registration follows project DI patterns
- [ ] Token exports correctly

## Files to Modify

### Token Definition
- `src/dependencyInjection/tokens/tokens-core.js`

### Registration
- `src/dependencyInjection/registrations/goapRegistrations.js`

## Implementation Details

### Token Definition

```javascript
// src/dependencyInjection/tokens/tokens-core.js

export const tokens = {
  // ... existing tokens ...

  // GOAP System
  IGOAPPlanner: 'IGOAPPlanner',
  IRefinementEngine: 'IRefinementEngine',
  IPlanInvalidationDetector: 'IPlanInvalidationDetector',
  IGOAPController: 'IGOAPController',  // NEW

  // ... other tokens ...
};
```

### Registration Factory

```javascript
// src/dependencyInjection/registrations/goapRegistrations.js

import GOAPController from '../../goap/controllers/goapController.js';
import { tokens } from '../tokens/tokens-core.js';

/**
 * Register GOAP system services
 * @param {Container} container - DI container
 */
export function registerGoapServices(container) {
  // ... existing GOAP registrations ...

  // GOAPController
  container.register(
    tokens.IGOAPController,
    class {
      static create(container) {
        return new GOAPController({
          planner: container.resolve(tokens.IGOAPPlanner),
          refinementEngine: container.resolve(tokens.IRefinementEngine),
          invalidationDetector: container.resolve(tokens.IPlanInvalidationDetector),
          contextAssemblyService: container.resolve(tokens.IContextAssemblyService),
          eventBus: container.resolve(tokens.IEventBus),
          logger: container.resolve(tokens.ILogger)
        });
      }
    },
    { lifecycle: 'singleton' }
  );
}
```

### Main Registration Entry Point

```javascript
// Ensure goapRegistrations.js is called in main registration file
// src/dependencyInjection/registrations/index.js

import { registerGoapServices } from './goapRegistrations.js';

export function registerAllServices(container) {
  // ... other registrations ...
  registerGoapServices(container);
  // ... other registrations ...
}
```

## Lifecycle Considerations

### Singleton vs Transient

**Decision: Singleton**

Rationale:
- GOAPController maintains state (`#activePlan`, `#failedGoals`)
- Each actor should have ONE controller managing their GOAP lifecycle
- Creating new instances would lose plan state between turns

**Implementation Note**: In multi-actor scenarios, may need to explore:
- One controller per actor (keyed by actor ID)
- Controller factory that returns actor-specific instances
- OR: Make controller stateless, store plan in actor component

For MVP, singleton is acceptable if system has single GOAP-controlled actor.

### Future Multi-Actor Support

```javascript
// Future enhancement: Actor-keyed factories
container.registerFactory(
  tokens.IGOAPController,
  (actorId) => {
    const key = `GOAPController_${actorId}`;
    if (!container.has(key)) {
      container.register(key, GOAPController, { lifecycle: 'singleton' });
    }
    return container.resolve(key);
  }
);
```

## Dependency Resolution Order

GOAPController depends on:
1. `IGOAPPlanner` (GOAPIMPL-018) ← Must be registered first
2. `IRefinementEngine` (GOAPIMPL-014) ← Must be registered first
3. `IPlanInvalidationDetector` (GOAPIMPL-020) ← Must be registered first
4. `IContextAssemblyService` (GOAPIMPL-007) ← Must be registered first
5. `IEventBus` (Core system) ← Already registered
6. `ILogger` (Core system) ← Already registered

Ensure `registerGoapServices()` is called AFTER all GOAP subsystems are registered.

## Testing Requirements

### Unit Tests
Create `tests/unit/dependencyInjection/goapRegistrations.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { registerGoapServices } from '../../../src/dependencyInjection/registrations/goapRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens/tokens-core.js';

describe('GOAP DI Registration', () => {
  let testBed;
  let container;

  beforeEach(() => {
    testBed = createTestBed();
    container = testBed.container;

    // Register dependencies
    container.register(tokens.IGOAPPlanner, testBed.createMock('planner', ['plan']));
    container.register(tokens.IRefinementEngine, testBed.createMock('refinement', ['refine']));
    container.register(tokens.IPlanInvalidationDetector, testBed.createMock('detector', ['check']));
    container.register(tokens.IContextAssemblyService, testBed.createMock('context', ['buildContext']));
    container.register(tokens.IEventBus, testBed.createMock('eventBus', ['dispatch']));
    container.register(tokens.ILogger, testBed.createMockLogger());
  });

  it('should register GOAPController', () => {
    registerGoapServices(container);
    const controller = container.resolve(tokens.IGOAPController);

    expect(controller).toBeDefined();
    expect(controller.decideTurn).toBeDefined();
  });

  it('should inject all required dependencies', () => {
    registerGoapServices(container);
    const controller = container.resolve(tokens.IGOAPController);

    // Dependencies should be injected (verify constructor didn't throw)
    expect(controller).toBeDefined();
  });

  it('should use singleton lifecycle', () => {
    registerGoapServices(container);

    const instance1 = container.resolve(tokens.IGOAPController);
    const instance2 = container.resolve(tokens.IGOAPController);

    expect(instance1).toBe(instance2);
  });
});
```

### Integration Tests
- [ ] Controller resolves in full DI container
- [ ] All GOAP services can be resolved together
- [ ] No circular dependency issues

## Success Validation

✅ **Done when**:
- Token defined and exported correctly
- Registration factory resolves all dependencies
- Singleton lifecycle enforced
- Unit tests pass
- Integration with full DI container works
- Can resolve `tokens.IGOAPController` successfully

## Related Tickets

- **Previous**: GOAPIMPL-021-06 (Event Dispatching)
- **Next**: GOAPIMPL-021-08 (Unit Tests)
- **Implements**: GOAPIMPL-021 (Parent - GOAP Controller)
- **Depends On**: GOAPIMPL-018, GOAPIMPL-014, GOAPIMPL-020, GOAPIMPL-007
