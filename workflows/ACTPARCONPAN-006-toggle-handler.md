# ACTPARCONPAN-006: Participation Toggle Handler

## Ticket Information
- **ID**: ACTPARCONPAN-006
- **Phase**: 2 - Controller
- **Estimated Time**: 2-3 hours
- **Complexity**: Medium
- **Dependencies**: ACTPARCONPAN-005

## Scope
Implement the participation toggle event handler, component updates via entity manager, user feedback, and error handling with UI state reversion.

## Detailed Tasks

### Toggle Handler Implementation
- [ ] Update entityManager dependency validation to include `addComponent` method
- [ ] Replace `#handleParticipationToggle(event)` placeholder (make it async)
- [ ] Extract checkbox element from event target
- [ ] Validate event target is a checkbox
- [ ] Extract actor ID from `dataset.actorId`
- [ ] Extract new participation state from `checked` property
- [ ] Await component update logic
- [ ] Add comprehensive error handling

### Component Update Logic
- [ ] Implement `#updateParticipation(actorId, participating)` private method (async)
- [ ] Validate actorId exists
- [ ] Update/add participation component via `entityManager.addComponent()` (handles both cases)
- [ ] Await the async operation
- [ ] Log successful update with actor ID and state
- [ ] Return success/failure boolean

### Status Feedback Implementation
- [ ] Implement `#showStatus(message, type)` private method
- [ ] Accept message string and type ('success' | 'error')
- [ ] Update status area text content
- [ ] Add CSS class for styling (`status-success` or `status-error`)
- [ ] Implement auto-clear after 3 seconds using `setTimeout`
- [ ] Clear any existing timeout before setting new one
- [ ] Store timeout ID for cleanup

### Error Handling and State Reversion
- [ ] Wrap component update in try-catch
- [ ] On error, revert checkbox state to previous value
- [ ] Display error message via `#showStatus()`
- [ ] Log error details with context
- [ ] Prevent UI state from becoming inconsistent

### Status Timeout Cleanup
- [ ] Add `#statusTimeout` private field
- [ ] Clear timeout in `#showStatus()` before setting new one
- [ ] Clear timeout in `cleanup()` method

## Files Modified
- `src/domUI/actorParticipationController.js`

## Code Changes Template
```javascript
// Update entityManager dependency validation in constructor
validateDependency(entityManager, 'IEntityManager', logger, {
  requiredMethods: ['getEntitiesWithComponent', 'addComponent'],
});

// Add private field for timeout
#statusTimeout = null;

// Replace #handleParticipationToggle placeholder
async #handleParticipationToggle(event) {
  const checkbox = event.target;

  // Validate event target
  if (checkbox.tagName !== 'INPUT' || checkbox.type !== 'checkbox') {
    return; // Not a checkbox, ignore
  }

  const actorId = checkbox.dataset.actorId;
  const newParticipationState = checkbox.checked;

  if (!actorId) {
    this.#logger.warn('[ActorParticipation] Checkbox missing data-actor-id attribute');
    return;
  }

  this.#logger.debug(`[ActorParticipation] Toggling participation for actor ${actorId} to ${newParticipationState}`);

  try {
    const success = await this.#updateParticipation(actorId, newParticipationState);
    if (success) {
      const statusMessage = newParticipationState
        ? `Enabled participation for ${actorId}`
        : `Disabled participation for ${actorId}`;
      this.#showStatus(statusMessage, 'success');
    } else {
      throw new Error('Failed to update participation component');
    }
  } catch (err) {
    this.#logger.error(`[ActorParticipation] Error updating participation for actor ${actorId}`, err);
    // Revert checkbox state
    checkbox.checked = !newParticipationState;
    this.#showStatus('Error updating participation', 'error');
  }
}

async #updateParticipation(actorId, participating) {
  try {
    // addComponent() handles both adding new components and updating existing ones
    const success = await this.#entityManager.addComponent(
      actorId,
      PARTICIPATION_COMPONENT_ID,
      { participating }
    );

    if (success) {
      this.#logger.info(`[ActorParticipation] Updated participation for actor ${actorId} to ${participating}`);
      return true;
    }

    this.#logger.warn(`[ActorParticipation] Failed to update participation component for actor ${actorId}`);
    return false;
  } catch (err) {
    this.#logger.error(`[ActorParticipation] Error updating participation component for actor ${actorId}`, err);
    return false;
  }
}

#showStatus(message, type = 'success') {
  if (!this.#actorParticipationStatus) {
    this.#logger.warn('[ActorParticipation] Cannot show status: status element not found');
    return;
  }

  // Clear any existing timeout
  if (this.#statusTimeout) {
    clearTimeout(this.#statusTimeout);
    this.#statusTimeout = null;
  }

  // Update status text and class
  this.#actorParticipationStatus.textContent = message;
  this.#actorParticipationStatus.className = `status-message status-${type}`;

  // Auto-clear after 3 seconds
  this.#statusTimeout = setTimeout(() => {
    if (this.#actorParticipationStatus) {
      this.#actorParticipationStatus.textContent = '';
      this.#actorParticipationStatus.className = 'status-message';
    }
    this.#statusTimeout = null;
  }, 3000);

  this.#logger.debug(`[ActorParticipation] Displayed status: ${message} (${type})`);
}

// Update cleanup() to clear status timeout
cleanup() {
  try {
    this.#logger.info('[ActorParticipation] Cleaning up...');

    // Clear status timeout
    if (this.#statusTimeout) {
      clearTimeout(this.#statusTimeout);
      this.#statusTimeout = null;
    }

    // Unsubscribe from event bus
    if (this.#gameReadyHandler) {
      this.#eventBus.unsubscribe(ENGINE_READY_UI, this.#gameReadyHandler);
      this.#gameReadyHandler = null;
      this.#logger.debug('[ActorParticipation] Unsubscribed from game events');
    }

    // Remove DOM event listeners
    if (this.#actorParticipationList && this.#boundHandleToggle) {
      this.#actorParticipationList.removeEventListener('change', this.#boundHandleToggle);
    }

    // Clear references
    this.#actorParticipationWidget = null;
    this.#actorParticipationList = null;
    this.#actorParticipationStatus = null;
    this.#boundHandleToggle = null;

    this.#logger.debug('[ActorParticipation] Cleanup complete');
  } catch (err) {
    this.#logger.error('[ActorParticipation] Error during cleanup', err);
  }
}
```

## Acceptance Criteria
- [ ] Toggle handler validates event target is a checkbox
- [ ] Toggle handler is async and awaits component updates
- [ ] Actor ID extracted from `data-actor-id` attribute
- [ ] Participation state extracted from checkbox `checked` property
- [ ] Component update uses `addComponent()` which handles both adding and updating
- [ ] `addComponent()` is called with correct signature: `(actorId, componentTypeId, componentData)`
- [ ] Component update is async and properly awaited
- [ ] Status messages displayed with success/error styling
- [ ] Status auto-clears after 3 seconds
- [ ] Error handling reverts checkbox state on failure
- [ ] Timeout cleared properly in cleanup
- [ ] All logging uses `[ActorParticipation]` prefix for consistency
- [ ] All code follows project conventions
- [ ] No ESLint errors

## Validation Steps
1. Run `npx eslint src/domUI/actorParticipationController.js`
2. Run `npm run typecheck`
3. Unit test: Mock entity manager and verify component updates
4. Unit test: Verify checkbox state reversion on error
5. Unit test: Verify status message display and auto-clear
6. Integration test: Toggle participation and verify component changes
7. Manual test: Toggle checkboxes and observe status messages

## Notes
- Use `dataset.actorId` for clean attribute access
- Checkbox state reversion prevents UI inconsistency on errors
- Auto-clear timeout improves UX (status doesn't linger)
- `addComponent()` automatically handles both adding new and updating existing components
- No need to check `hasComponent()` before calling `addComponent()`
- Method signature: `entityManager.addComponent(instanceId, componentTypeId, componentData)`
- Method is async and must be awaited
- Use `[ActorParticipation]` logging prefix for consistency with existing code
- Defensive checks for missing elements and attributes
