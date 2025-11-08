# ACTPARCONPAN-008: Dependency Injection Token and Registration

## Ticket Information
- **ID**: ACTPARCONPAN-008
- **Phase**: 3 - Integration
- **Estimated Time**: 1 hour
- **Complexity**: Low
- **Dependencies**: ACTPARCONPAN-007

## Scope
Configure dependency injection for `ActorParticipationController` by defining the DI token and registering the controller factory with its dependencies.

## Detailed Tasks

### Token Definition
- [ ] Open `src/dependencyInjection/tokens/tokens-ui.js`
- [ ] Add `ActorParticipationController` token
- [ ] Use consistent naming: `ActorParticipationController: 'ActorParticipationController'`
- [ ] Maintain alphabetical ordering in the tokens object

### Controller Import
- [ ] Open `src/dependencyInjection/registrations/uiRegistrations.js`
- [ ] Add import for `ActorParticipationController` from `domUI` module
- [ ] Maintain alphabetical ordering of imports

### Factory Registration
- [ ] Add controller factory to `registerUIDependencies()` function
- [ ] Configure factory with required dependencies:
  - `eventBus` (tokens.IEventBus)
  - `documentContext` (tokens.IDocumentContext)
  - `logger` (tokens.ILogger)
  - `entityManager` (tokens.IEntityManager)
- [ ] Use singleton lifecycle (default behavior)
- [ ] Maintain alphabetical ordering in registrations

## Files Modified
- `src/dependencyInjection/tokens/tokens-ui.js`
- `src/dependencyInjection/registrations/uiRegistrations.js`

## Code Changes Template

### tokens-ui.js
```javascript
// Add to tokens object (maintain alphabetical order)
export const tokens = {
  ActorParticipationController: 'ActorParticipationController',
  // ... existing tokens ...
};
```

### uiRegistrations.js
```javascript
// Add import (maintain alphabetical order)
import { ActorParticipationController } from '../../domUI/index.js';

// In registerUIDependencies function, add to container.register() calls:
container.register(
  tokens.ActorParticipationController,
  asClass(ActorParticipationController).singleton()
);

// Or if using factory pattern:
container.register(tokens.ActorParticipationController, {
  resolve: (c) => {
    const eventBus = c.resolve(tokens.IEventBus);
    const documentContext = c.resolve(tokens.IDocumentContext);
    const logger = c.resolve(tokens.ILogger);
    const entityManager = c.resolve(tokens.IEntityManager);

    return new ActorParticipationController({
      eventBus,
      documentContext,
      logger,
      entityManager,
    });
  },
  lifetime: 'singleton',
});
```

## Acceptance Criteria
- [ ] Token defined in `tokens-ui.js`
- [ ] Controller imported in `uiRegistrations.js`
- [ ] Factory registered with all required dependencies
- [ ] Singleton lifecycle configured
- [ ] All dependencies resolve correctly
- [ ] Alphabetical ordering maintained
- [ ] No ESLint errors
- [ ] TypeScript type checking passes

## Validation Steps
1. Run `npx eslint src/dependencyInjection/tokens/tokens-ui.js src/dependencyInjection/registrations/uiRegistrations.js`
2. Run `npm run typecheck`
3. Verify token export:
   ```javascript
   import { tokens } from './src/dependencyInjection/tokens/tokens-ui.js';
   console.log(tokens.ActorParticipationController); // Should output: 'ActorParticipationController'
   ```
4. Test container resolution (in a test file):
   ```javascript
   const controller = container.resolve(tokens.ActorParticipationController);
   expect(controller).toBeInstanceOf(ActorParticipationController);
   ```

## Notes
- Follow existing DI patterns in the project (check other controller registrations)
- Ensure all dependency tokens are imported from `tokens-core.js` if needed
- Singleton lifecycle is appropriate for UI controllers
- The controller will be initialized in the bootstrapper (next ticket)
