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
- [ ] Add controller factory to `registerControllers()` function in `uiRegistrations.js`
- [ ] Configure factory with required dependencies:
  - `eventBus` (tokens.ISafeEventDispatcher) **[CORRECTED: was IEventBus]**
  - `documentContext` (tokens.IDocumentContext)
  - `logger` (tokens.ILogger)
  - `entityManager` (tokens.IEntityManager)
- [ ] Use `registerWithLog` helper with singletonFactory lifecycle
- [ ] Maintain alphabetical ordering in registrations (after InputStateController, before PerceptibleEventSenderController)

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
// Add import at top with other controller imports (around line 43)
import { ActorParticipationController } from '../../domUI/index.js';

// In registerControllers function (around line 378), add registration:
// Position: After InputStateController, before PerceptibleEventSenderController
registerWithLog(
  registrar,
  tokens.ActorParticipationController,
  (c) =>
    new ActorParticipationController({
      eventBus: c.resolve(tokens.ISafeEventDispatcher),  // CORRECTED: was IEventBus
      documentContext: c.resolve(tokens.IDocumentContext),
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
    }),
  { lifecycle: 'singletonFactory' },
  logger
);
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
- Follow existing DI patterns in the project (check other controller registrations in `registerControllers()`)
- Use `ISafeEventDispatcher` not `IEventBus` - the controller validates against ISafeEventDispatcher interface
- All dependency tokens are available from the merged `tokens` object imported from `../tokens.js`
- Use `registerWithLog` helper for consistent logging (from `../../utils/registrarHelpers.js`)
- Singleton lifecycle is appropriate for UI controllers
- The controller will be initialized in the bootstrapper (next ticket: ACTPARCONPAN-009)
- Pattern reference: See `PerceptibleEventSenderController` registration (lines 393-406) for similar controller with same dependencies
