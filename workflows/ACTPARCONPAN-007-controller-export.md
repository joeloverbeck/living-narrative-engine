# ACTPARCONPAN-007: Controller Export and Module Integration

## Ticket Information
- **ID**: ACTPARCONPAN-007
- **Phase**: 2 - Controller
- **Estimated Time**: 15 minutes
- **Complexity**: Low
- **Dependencies**: ACTPARCONPAN-006

## Scope
Export the `ActorParticipationController` from the `domUI` module index to make it accessible for dependency injection registration.

## Detailed Tasks

### Export Addition
- [ ] Open `src/domUI/index.js`
- [ ] Add export statement for `ActorParticipationController`
- [ ] Place export in the appropriate functional group (Controllers section, near `ProcessingIndicatorController`)
- [ ] Verify correct relative path to controller file (`./actorParticipationController.js`)

### Verification
- [ ] Verify export syntax is correct
- [ ] Check that other modules can import the controller
- [ ] Ensure no duplicate exports exist

## Files Modified
- `src/domUI/index.js`

## Code Changes Template
```javascript
// Add to src/domUI/index.js (near line 40, in Controllers section)
// Place after ProcessingIndicatorController or create a new Controllers section

// Controllers
export { ProcessingIndicatorController } from './processingIndicatorController.js';
export { default as ActorParticipationController } from './actorParticipationController.js';
```

**Note**: The domUI index.js uses functional grouping (not alphabetical ordering). The file is organized as:
- Interfaces and base classes
- Concrete classes and utilities
- Renderers and state controllers
- Modals & UI Components
- Engine UI Management
- Controllers (ProcessingIndicatorController, ActorParticipationController)
- Entity Lifecycle Monitor
- Facade

## Acceptance Criteria
- [ ] Controller exported from `src/domUI/index.js`
- [ ] Export follows project conventions (default export pattern: `export { default as ClassName }`)
- [ ] Export placed in appropriate functional group (Controllers section)
- [ ] Import path is correct (`./actorParticipationController.js`)
- [ ] No ESLint errors
- [ ] TypeScript type checking passes

## Validation Steps
1. Run `npx eslint src/domUI/index.js`
2. Run `npm run typecheck`
3. Verify import works in a test file:
   ```javascript
   import { ActorParticipationController } from './src/domUI/index.js';
   ```
4. Verify export is in the Controllers section (near `ProcessingIndicatorController`)
5. Confirm the export pattern matches other default exports in the file

## Notes
- This is a simple export addition following existing module patterns
- Critical for dependency injection in next phase
- Ensures controller is accessible via the `domUI` module barrel export
- **Important**: The domUI index.js uses functional grouping, NOT alphabetical ordering
- The export should be placed in the Controllers section alongside `ProcessingIndicatorController`
- The controller uses `export default`, so the import pattern is `export { default as ClassName }`
