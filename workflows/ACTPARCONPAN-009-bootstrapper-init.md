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
- [ ] Maintain alphabetical ordering

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
/**
 * @file Initialization helper for ActorParticipationController
 */

import { resolveAndInitialize } from '../../utils/resolveAndInitialize.js';
import { tokens } from '../../../dependencyInjection/tokens/tokens-ui.js';

/**
 * Initialize the actor participation controller
 * @param {Object} container - DI container
 * @param {Object} logger - Logger instance
 * @returns {Object} Initialized controller instance
 */
export function initActorParticipationController(container, logger) {
  return resolveAndInitialize(
    container,
    tokens.ActorParticipationController,
    'ActorParticipationController',
    logger
  );
}
```

### auxiliary/index.js
```javascript
// Add export (maintain alphabetical order)
export { initActorParticipationController } from './initActorParticipationController.js';
// ... existing exports ...
```

### initializeAuxiliaryServicesStage.js
```javascript
// Add import (maintain alphabetical order)
import { initActorParticipationController } from './auxiliary/index.js';

// In the initialization sequence array, add BEFORE initPerceptibleEventSenderController:
const initializationSequence = [
  // ... existing initializers ...
  { name: 'ActorParticipationController', fn: initActorParticipationController },
  { name: 'PerceptibleEventSenderController', fn: initPerceptibleEventSenderController },
  // ... remaining initializers ...
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
- Use `resolveAndInitialize` helper for consistent initialization pattern
- Positioning before PerceptibleEventSenderController ensures proper initialization order
- Logger instance should be passed through for consistent logging
- Check existing auxiliary service initializers for reference patterns
- The controller will automatically subscribe to ENGINE_READY_UI during construction
