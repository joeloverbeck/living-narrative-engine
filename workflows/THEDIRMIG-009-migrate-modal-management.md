# THEDIRMIG-009: Migrate Modal Management System

## Overview

Migrate the modal management system to use base controller patterns. This includes updating modal show/hide logic, event handling, and state management while maintaining the existing dynamic confirmation modal functionality.

## Priority

**MEDIUM** - Important UI functionality

## Dependencies

- **Related**: THEDIRMIG-004 (cached modal elements)
- **Enables**: THEDIRMIG-011 (modal cleanup)

## Acceptance Criteria

- [ ] Modal system uses base controller element access
- [ ] Modal show/hide uses base controller helpers
- [ ] Confirmation callbacks properly managed
- [ ] ESC key handling works
- [ ] Modal state tracked correctly
- [ ] No memory leaks from callbacks
- [ ] Error handling for missing DOM elements
- [ ] CSS requirements documented for animations

## Implementation Steps

### Step 1: Add Modal State Management

```javascript
export class ThematicDirectionsManagerController extends BaseCharacterBuilderController {
  // Existing fields...

  /**
   * Current modal state
   * @type {Object|null}
   */
  #activeModal = null;

  /**
   * Pending modal action callback
   * @type {Function|null}
   */
  #pendingModalAction = null;

  /**
   * Modal keyboard event handler
   * @type {Function|null}
   */
  #modalKeyHandler = null;

  /**
   * Previously focused element
   * @type {Element|null}
   */
  #previousFocus = null;
}
```

### Step 2: Create Modal Management Methods

```javascript
/**
 * Show confirmation modal with dynamic content
 * @private
 * @param {Object} options - Modal options
 * @param {string} options.title - Modal title
 * @param {string} options.message - Modal message
 * @param {Function} options.onConfirm - Confirm callback
 * @param {Function} [options.onCancel] - Cancel callback
 * @param {string} [options.confirmText] - Confirm button text
 * @param {string} [options.cancelText] - Cancel button text
 * @param {string} [options.type] - Modal type (confirm, alert, error)
 */
_showConfirmationModal(options) {
  const {
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'confirm'
  } = options;

  // Store modal state
  this.#activeModal = {
    type: 'confirmation',
    options: options
  };

  // Store callbacks
  this.#pendingModalAction = onConfirm;
  this.#activeModal.onCancel = onCancel;

  // Update modal content
  this._updateModalContent({
    title,
    message,
    confirmText,
    cancelText,
    type
  });

  // Show modal using base controller helpers
  this._showModal();

  // Focus confirm button for accessibility
  const confirmBtn = this._getElement('modalConfirmBtn');
  if (confirmBtn) {
    setTimeout(() => confirmBtn.focus(), 100);
  }
}

/**
 * Update modal content
 * @private
 * @param {Object} content - Content to display
 */
_updateModalContent(content) {
  const { title, message, confirmText, cancelText, type } = content;

  // Update text content
  this._setElementText('modalTitle', title);
  this._setElementText('modalMessage', message);
  this._setElementText('modalConfirmBtn', confirmText);
  this._setElementText('modalCancelBtn', cancelText);

  // Update modal styling based on type
  const modal = this._getElement('confirmationModal');
  if (modal) {
    modal.className = `modal modal-${type}`;
  }

  // Show/hide buttons based on type
  if (type === 'alert') {
    this._hideElement('modalCancelBtn');
  } else {
    this._showElement('modalCancelBtn');
  }
}

/**
 * Show the modal
 * @private
 */
_showModal() {
  // Show confirmation modal using base controller helpers
  this._showElement('confirmationModal');

  // Track focus before showing modal
  this._trackFocus();

  // Setup ESC key handler
  this._setupModalKeyHandling();

  // Focus confirm button for accessibility
  const confirmBtn = this._getElement('modalConfirmBtn');
  if (confirmBtn) {
    setTimeout(() => confirmBtn.focus(), 100);
  }
}

/**
 * Close the modal
 * @private
 * @param {boolean} [cancelled=false] - Whether modal was cancelled
 */
_closeModal(cancelled = false) {
  if (!this.#activeModal) return;

  // Call cancel callback if cancelled
  if (cancelled && this.#activeModal.onCancel) {
    try {
      this.#activeModal.onCancel();
    } catch (error) {
      this.logger.error('Error in modal cancel callback:', error);
    }
  }

  // Hide modal using base controller helper
  this._hideElement('confirmationModal');

  // Clear modal state
  this.#activeModal = null;
  this.#pendingModalAction = null;

  // Remove ESC handler
  this._removeModalKeyHandling();

  // Restore focus to previous element
  this._restoreFocus();
}
```

### Step 3: Implement Modal Event Handlers

```javascript
/**
 * Handle modal confirm button click
 * @private
 */
_handleModalConfirm() {
  if (!this.#pendingModalAction) {
    this.logger.warn('No pending modal action to confirm');
    return;
  }

  // Execute the pending action
  try {
    const result = this.#pendingModalAction();

    // Handle promise results
    if (result && typeof result.then === 'function') {
      result
        .then(() => {
          this._closeModal();
        })
        .catch(error => {
          this.logger.error('Modal action failed:', error);
          this._showError('Operation failed. Please try again.');
        });
    } else {
      // Synchronous action
      this._closeModal();
    }
  } catch (error) {
    this.logger.error('Error executing modal action:', error);
    this._showError('An error occurred. Please try again.');
  }
}

/**
 * Handle modal cancel
 * @private
 */
_handleModalCancel() {
  this._closeModal(true); // true = cancelled
}

/**
 * Setup keyboard handling for modal
 * @private
 */
_setupModalKeyHandling() {
  // Store handler reference for removal
  this.#modalKeyHandler = (e) => {
    if (e.key === 'Escape' && this.#activeModal) {
      e.preventDefault();
      this._closeModal(true);
    }
  };

  // Use capture phase to handle before other handlers
  document.addEventListener('keydown', this.#modalKeyHandler, true);
}

/**
 * Remove modal keyboard handling
 * @private
 */
_removeModalKeyHandling() {
  if (this.#modalKeyHandler) {
    document.removeEventListener('keydown', this.#modalKeyHandler, true);
    this.#modalKeyHandler = null;
  }
}
```

### Step 4: Update Modal Usage Throughout Controller

Find and update existing modal calls:

```javascript
// BEFORE:
this.#showDeleteConfirmation(directionId);

// AFTER:
this._showConfirmationModal({
  title: 'Delete Thematic Direction',
  message: `Are you sure you want to delete "${direction.name}"? This action cannot be undone.`,
  onConfirm: () => this._deleteDirection(directionId),
  confirmText: 'Delete',
  cancelText: 'Cancel',
  type: 'confirm',
});
```

Common modal scenarios to update:

#### Delete Confirmation

```javascript
/**
 * Confirm direction deletion
 * @private
 * @param {string} directionId - Direction to delete
 */
_confirmDeleteDirection(directionId) {
  const direction = this.#directionsData.find(d => d.id === directionId);
  if (!direction) return;

  this._showConfirmationModal({
    title: 'Delete Thematic Direction',
    message: `Are you sure you want to delete "${direction.name}"? This action cannot be undone.`,
    onConfirm: async () => {
      await this._deleteDirection(directionId);
    },
    confirmText: 'Delete',
    cancelText: 'Keep',
    type: 'confirm'
  });
}
```

#### Cleanup Orphans Confirmation

```javascript
/**
 * Handle cleanup orphans button click
 * @private
 */
_handleCleanupOrphans() {
  if (this.#orphanedCount === 0) {
    this._showAlert({
      title: 'No Orphaned Directions',
      message: 'There are no orphaned thematic directions to clean up.',
      type: 'info'
    });
    return;
  }

  this._showConfirmationModal({
    title: 'Clean Up Orphaned Directions',
    message: `This will remove ${this.#orphanedCount} orphaned thematic direction(s) that are not linked to any character concepts. Continue?`,
    onConfirm: async () => {
      await this._performOrphanCleanup();
    },
    confirmText: `Remove ${this.#orphanedCount} Orphaned`,
    cancelText: 'Cancel',
    type: 'confirm'
  });
}
```

#### Alert Modal

```javascript
/**
 * Show alert modal (single button)
 * @private
 * @param {Object} options - Alert options
 */
_showAlert(options) {
  this._showConfirmationModal({
    ...options,
    type: 'alert',
    onConfirm: () => {}, // Just close
    confirmText: 'OK'
  });
}
```

### Step 5: Add Focus Management

```javascript
/**
 * Track and restore focus
 * @private
 */
_trackFocus() {
  this.#previousFocus = document.activeElement;
}

/**
 * Restore focus after modal closes
 * @private
 */
_restoreFocus() {
  if (this.#previousFocus && this.#previousFocus.focus) {
    try {
      this.#previousFocus.focus();
    } catch (error) {
      // Element might be removed
    }
  }
  this.#previousFocus = null;
}

```

### Step 6: Clean Up in Destroy

```javascript
/**
 * Pre-destroy cleanup
 * @protected
 * @override
 */
_preDestroy() {
  // Close any open modals
  if (this.#activeModal) {
    this._closeModal();
  }

  // Clear pending actions
  this.#pendingModalAction = null;

  // Remove any lingering handlers
  this._removeModalKeyHandling();

  super._preDestroy();
}
```

## CSS Requirements

The following CSS will need to be added to support the modal system:

```css
/* Modal type classes for different modal styles */
.modal-confirm {
  /* Default confirmation modal styling */
}

.modal-alert .modal-cancel-btn {
  display: none;
}

.modal-error {
  /* Error modal styling - red theme */
  border-left: 4px solid #e74c3c;
}

.modal-error .modal-header {
  background-color: #e74c3c;
  color: white;
}
```

**Note**: The existing modal HTML structure will be used with basic show/hide functionality. Advanced animations and transitions can be added later if needed.

## Testing Strategy

### Manual Testing Checklist

1. **Basic Functionality**:
   - [ ] Modal opens with correct content
   - [ ] Confirm button executes action
   - [ ] Cancel button closes without action
   - [ ] X button closes without action

2. **Keyboard Handling**:
   - [ ] ESC key closes modal
   - [ ] Tab cycles through buttons
   - [ ] Enter on focused button works

3. **Focus Management**:
   - [ ] Focus moves to confirm button
   - [ ] Focus returns after close

4. **Async Actions**:
   - [ ] Loading state during async operations
   - [ ] Error handling for failed actions

### Unit Test Example

```javascript
describe('Modal Management', () => {
  it('should show confirmation modal with correct content', () => {
    controller._showConfirmationModal({
      title: 'Test Title',
      message: 'Test Message',
      onConfirm: jest.fn(),
      confirmText: 'Yes',
      cancelText: 'No',
    });

    expect(controller._getElement('modalTitle').textContent).toBe('Test Title');
    expect(controller._getElement('modalMessage').textContent).toBe(
      'Test Message'
    );
    expect(controller._getElement('modalConfirmBtn').textContent).toBe('Yes');
    expect(controller._getElement('modalCancelBtn').textContent).toBe('No');
  });

  it('should execute confirm callback', () => {
    const confirmSpy = jest.fn();

    controller._showConfirmationModal({
      title: 'Test',
      message: 'Test',
      onConfirm: confirmSpy,
    });

    controller._handleModalConfirm();

    expect(confirmSpy).toHaveBeenCalled();
  });

  it('should handle ESC key to close modal', () => {
    controller._showConfirmationModal({
      title: 'Test',
      message: 'Test',
      onConfirm: jest.fn(),
    });

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escEvent);

    expect(controller.#activeModal).toBe(null);
  });
});
```

## Common Modal Patterns

### Pattern 1: Async Operation with Loading

```javascript
_showConfirmationModal({
  title: 'Save Changes',
  message: 'Save all pending changes?',
  onConfirm: async () => {
    this._showLoading('Saving...');
    try {
      await this._saveAllChanges();
      // Show success message using available methods
      this.logger.info('Changes saved successfully');
      // Modal will close automatically on success
    } catch (error) {
      this._showError('Failed to save changes');
      throw error; // Re-throw to prevent modal close
    }
  },
});
```

### Pattern 2: Error Recovery Modal

```javascript
_showErrorRecoveryModal(errorMessage) {
  this._showConfirmationModal({
    title: 'Operation Failed',
    message: `${errorMessage}\n\nWould you like to try again?`,
    onConfirm: () => this._retryOperation(),
    confirmText: 'Retry',
    cancelText: 'Cancel',
    type: 'error'
  });
}
```

## Files Modified

- [ ] `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`
- [ ] `css/thematic-directions-manager.css` (potentially)

## Files Created

- None

## Definition of Done

- [ ] Modal system migrated to base controller patterns
- [ ] Show/hide uses base controller helpers
- [ ] Confirmation callbacks properly managed
- [ ] ESC key handling implemented
- [ ] Modal state tracked correctly
- [ ] Focus management implemented
- [ ] Async actions handled properly
- [ ] Memory leaks prevented
- [ ] Error handling for missing DOM elements
- [ ] CSS requirements documented
- [ ] Tests pass
- [ ] Manual testing confirms all modals work
- [ ] Code committed with descriptive message
