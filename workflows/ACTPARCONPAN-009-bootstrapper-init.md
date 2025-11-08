# ACTPARCONPAN-009: Bootstrapper Initialization Setup

## Ticket Information
- **ID**: ACTPARCONPAN-009
- **Phase**: 3 - Integration
- **Estimated Time**: 1-2 hours
- **Complexity**: Medium
- **Dependencies**: ACTPARCONPAN-008

## Scope
Configure controller initialization in the application bootstrapper, ensuring it initializes at the correct stage with proper dependency resolution and error handling.

## Detailed Tasks

### Initialization Helper Creation
- [ ] Create `src/bootstrapper/stages/auxiliary/initActorParticipationController.js`
- [ ] Import `resolveAndInitialize` helper from bootstrapper utilities
- [ ] Import `ActorParticipationController` token from `tokens-ui.js`
- [ ] Implement initialization function using standard pattern
- [ ] Add error handling and logging
- [ ] Export initialization function

### Auxiliary Index Export
- [ ] Open `src/bootstrapper/stages/auxiliary/index.js`
- [ ] Add export for `initActorParticipationController`
- [ ] Add at the end of the exports list (exports are currently NOT alphabetically ordered)

### Stage Integration
- [ ] Open `src/bootstrapper/stages/initializeAuxiliaryServicesStage.js`
- [ ] Import `initActorParticipationController`
- [ ] Add initialization call in the sequence array
- [ ] Position BEFORE `initPerceptibleEventSenderController` (as specified in spec)
- [ ] Ensure proper ordering with other auxiliary services

## Files Created
- `src/bootstrapper/stages/auxiliary/initActorParticipationController.js`

## Files Modified
- `src/bootstrapper/stages/auxiliary/index.js`
- `src/bootstrapper/stages/initializeAuxiliaryServicesStage.js`

## Code Templates

### initActorParticipationController.js
```javascript
// src/bootstrapper/stages/auxiliary/initActorParticipationController.js

import { resolveAndInitialize } from '../../../utils/bootstrapperHelpers.js';
import './typedefs.js';
/** @typedef {import('./typedefs.js').AuxHelperDeps} AuxHelperDeps */

/**
 * Resolves and initializes the ActorParticipationController service.
 *
 * @param {AuxHelperDeps} deps - Contains DI container, gameEngine, logger, and token map.
 * @returns {Promise<{success: boolean, error?: Error}>} Result of initialization.
 */
export async function initActorParticipationController({
  container,
  // gameEngine is passed but not used by this initializer
  logger,
  tokens,
}) {
  return resolveAndInitialize(
    container,
    tokens.ActorParticipationController,
    'initialize',  // CORRECTED: method name not token name
    logger
  );
}
```

### auxiliary/index.js
```javascript
// Add export at the end (exports are currently NOT alphabetically ordered)
// ... existing exports ...
export { initActorParticipationController } from './initActorParticipationController.js';
```

### initializeAuxiliaryServicesStage.js
```javascript
// Add import with other auxiliary imports (around line 4-13)
import {
  initEngineUIManager,
  initSaveGameUI,
  initLoadGameUI,
  initLlmSelectionModal,
  initCurrentTurnActorRenderer,
  initSpeechBubbleRenderer,
  initProcessingIndicatorController,
  initCriticalLogNotifier,
  initActorParticipationController,  // ADD THIS
  initPerceptibleEventSenderController,
} from './auxiliary/index.js';

// In the serviceInitializers array (after CriticalLogNotifier, around line 122), add BEFORE PerceptibleEventSenderController:
const serviceInitializers = [
  // ... existing initializers ...
  [
    'CriticalLogNotifier',
    () =>
      initCriticalLogNotifier({
        container,
        gameEngine,
        logger,
        tokens,
      }),
  ],
  [
    'ActorParticipationController',  // ADD THIS ENTRY
    () =>
      initActorParticipationController({
        container,
        gameEngine,
        logger,
        tokens,
      }),
  ],
  [
    'PerceptibleEventSenderController',
    () =>
      initPerceptibleEventSenderController({
        container,
        gameEngine,
        logger,
        tokens,
      }),
  ],
];
```

## Acceptance Criteria
- [ ] Initialization helper created with correct structure
- [ ] Helper uses `resolveAndInitialize` utility
- [ ] Export added to auxiliary index
- [ ] Import added to auxiliary services stage
- [ ] Initialization call added to sequence array
- [ ] Positioned BEFORE PerceptibleEventSenderController
- [ ] Error handling follows project patterns
- [ ] All code follows project conventions
- [ ] No ESLint errors
- [ ] TypeScript type checking passes

## Validation Steps
1. Run `npx eslint src/bootstrapper/stages/auxiliary/initActorParticipationController.js src/bootstrapper/stages/auxiliary/index.js src/bootstrapper/stages/initializeAuxiliaryServicesStage.js`
2. Run `npm run typecheck`
3. Start application and verify no initialization errors in console
4. Check initialization logs for ActorParticipationController
5. Verify controller is accessible via DI container after bootstrapping
6. Confirm ENGINE_READY_UI event subscription works

## Notes
- Use `resolveAndInitialize` helper for consistent initialization pattern (see initPerceptibleEventSenderController.js)
- Positioning before PerceptibleEventSenderController ensures proper initialization order
- Init functions receive `{ container, gameEngine, logger, tokens }` as deps object (gameEngine may not be destructured if not needed)
- The third parameter to `resolveAndInitialize` is the method name ('initialize'), not the token name
- Function must be async since `resolveAndInitialize` returns a Promise
- Check initPerceptibleEventSenderController.js for reference pattern (identical structure)
- The controller will subscribe to ENGINE_READY_UI during `initialize()` method call
- ActorParticipationController.initialize() method exists at src/domUI/actorParticipationController.js:70
- Token ActorParticipationController is defined in src/dependencyInjection/tokens/tokens-ui.js:39
