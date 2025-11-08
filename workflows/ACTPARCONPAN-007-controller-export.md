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
- [ ] Maintain alphabetical ordering of exports
- [ ] Verify correct relative path to controller file

### Verification
- [ ] Verify export syntax is correct
- [ ] Check that other modules can import the controller
- [ ] Ensure no duplicate exports exist

## Files Modified
- `src/domUI/index.js`

## Code Changes Template
```javascript
// Add to src/domUI/index.js (maintain alphabetical order)

export { default as ActorParticipationController } from './actorParticipationController.js';
// ... existing exports ...
```

## Acceptance Criteria
- [ ] Controller exported from `src/domUI/index.js`
- [ ] Export follows project conventions (default export pattern)
- [ ] Exports remain in alphabetical order
- [ ] Import path is correct
- [ ] No ESLint errors
- [ ] TypeScript type checking passes

## Validation Steps
1. Run `npx eslint src/domUI/index.js`
2. Run `npm run typecheck`
3. Verify import works in a test file:
   ```javascript
   import { ActorParticipationController } from './src/domUI/index.js';
   ```
4. Check alphabetical ordering against other exports in the file

## Notes
- This is a simple export addition following existing module patterns
- Critical for dependency injection in next phase
- Ensures controller is accessible via the `domUI` module barrel export
