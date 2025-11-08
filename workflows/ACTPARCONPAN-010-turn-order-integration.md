# ACTPARCONPAN-010: Turn Order System Integration

## Ticket Information
- **ID**: ACTPARCONPAN-010
- **Phase**: 3 - Integration
- **Estimated Time**: 2-3 hours
- **Complexity**: Medium
- **Dependencies**: ACTPARCONPAN-003

## Scope
Integrate the participation component with the turn order system to skip non-participating actors in the turn queue, preventing LLM API calls for disabled actors.

## Detailed Tasks

### Turn Queue Discovery
- [ ] Search for turn queue implementation in `src/turns/order/` directory
- [ ] Likely locations:
  - `src/turns/order/queues/initiativePriorityQueue.js`
  - `src/turns/order/turnOrderManager.js`
  - Similar files managing turn progression
- [ ] Identify the `getNextActor()` or equivalent method
- [ ] Document actual file location for reference

### Import Participation Constant
- [ ] Import `PARTICIPATION_COMPONENT_ID` from constants
- [ ] Add import at top of turn queue file

### Participation Filter Implementation
- [ ] Locate the turn queue's `getNextActor()` method (or equivalent)
- [ ] Add participation check logic
- [ ] Implement while loop to skip actors with `participating: false`
- [ ] Maintain existing turn order logic (initiative, priority, etc.)
- [ ] Handle edge case: all actors non-participating (return null or appropriate value)

### Debug Logging
- [ ] Add debug log when skipping an actor
- [ ] Log actor ID and participation state
- [ ] Use existing logger instance from turn queue class

### Edge Case Handling
- [ ] Handle scenario where all actors have `participating: false`
- [ ] Prevent infinite loops if no participating actors exist
- [ ] Add max iterations safety check (e.g., queue size limit)
- [ ] Log warning if all actors are skipped

## Files Modified
- `src/turns/order/queues/initiativePriorityQueue.js` (or actual turn queue file)

## Code Changes Template
```javascript
// Add import at top of file
import { PARTICIPATION_COMPONENT_ID } from '../../../constants/componentIds.js';

// Modify getNextActor() method (example implementation)
getNextActor() {
  const maxAttempts = this.queue.length || 10; // Safety limit
  let attempts = 0;

  while (attempts < maxAttempts) {
    const actor = this.#getNextActorFromQueue(); // Original queue logic

    if (!actor) {
      // Queue exhausted
      return null;
    }

    // Check participation component
    const participationComponent = this.#entityManager.getComponent(
      actor.id,
      PARTICIPATION_COMPONENT_ID
    );

    const isParticipating = participationComponent?.dataSchema?.participating ?? true;

    if (isParticipating) {
      // Actor is participating, return normally
      this.#logger.debug(`Selected actor ${actor.id} for next turn`);
      return actor;
    }

    // Actor not participating, skip and try next
    this.#logger.debug(`Skipping actor ${actor.id} - participation disabled`);
    attempts++;
  }

  // All actors exhausted or all non-participating
  this.#logger.warn('No participating actors found in turn queue');
  return null;
}
```

## Alternative Implementation (if using iterator pattern)
```javascript
// If the turn system uses an iterator or different pattern:
*[Symbol.iterator]() {
  for (const actor of this.queue) {
    const participationComponent = this.#entityManager.getComponent(
      actor.id,
      PARTICIPATION_COMPONENT_ID
    );

    const isParticipating = participationComponent?.dataSchema?.participating ?? true;

    if (isParticipating) {
      yield actor;
    } else {
      this.#logger.debug(`Skipping actor ${actor.id} - participation disabled`);
    }
  }
}
```

## Acceptance Criteria
- [ ] Turn queue file located and identified
- [ ] Participation component imported
- [ ] `getNextActor()` method modified with participation check
- [ ] While loop skips actors with `participating: false`
- [ ] Default participation is `true` (backward compatible)
- [ ] Edge case handled: all actors non-participating
- [ ] Infinite loop prevention implemented
- [ ] Debug logging added for skipped actors
- [ ] Warning logged when no participating actors found
- [ ] Existing turn order logic preserved
- [ ] No ESLint errors
- [ ] TypeScript type checking passes

## Validation Steps
1. Run `npx eslint <turn-queue-file>`
2. Run `npm run typecheck`
3. Unit test: Verify skip logic with mock actors
4. Unit test: Test all-non-participating scenario
5. Integration test: Full turn cycle with mixed participation states
6. Manual test: Toggle participation and observe turn skipping
7. Verify LLM API calls are NOT made for disabled actors (check logs)

## Discovery Notes
**Document actual file locations found:**
- Turn queue file: `_______________________________`
- Method name for actor selection: `_______________________________`
- Any deviations from expected structure: `_______________________________`

## Notes
- Default participation to `true` for backward compatibility
- Safety limit prevents infinite loops if queue logic breaks
- Preserve all existing turn order behavior (initiative, priority)
- The participation filter should be transparent to other systems
- Test thoroughly with both manual and automated tests
