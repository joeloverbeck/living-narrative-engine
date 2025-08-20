# CORMOTGEN-020: Clear All with Confirmation Dialog

## Ticket ID

CORMOTGEN-020

## Title

Clear All functionality with modal confirmation dialog

## Status

COMPLETED

## Priority

MEDIUM

## Estimated Effort

N/A (Already implemented)

## Dependencies

- CORMOTGEN-002 (HTML modal structure) - COMPLETED
- CORMOTGEN-004 (Controller) - COMPLETED

## Description

The Clear All feature that removes all motivations for a direction with a proper confirmation modal is already fully implemented in the production code.

## Actual Implementation

### 1. Current Modal Implementation

The Clear All feature is already implemented in `CoreMotivationsGeneratorController` with inline modal handling:

**Location**: `src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js`

```javascript
async #clearAllMotivations() {
  if (!this.#selectedDirectionId || this.#currentMotivations.length === 0) {
    return;
  }

  // Show confirmation modal
  const modal = document.getElementById('confirmation-modal');
  modal.style.display = 'flex';

  // Handle confirmation
  const confirmBtn = document.getElementById('confirm-clear');
  const cancelBtn = document.getElementById('cancel-clear');

  const handleConfirm = async () => {
    this.#closeModal();
    this.#showLoadingState(true, 'Clearing all motivations...');

    try {
      const deletedCount =
        await this.characterBuilderService.clearCoreMotivationsForDirection(
          this.#selectedDirectionId
        );

      this.#currentMotivations = [];
      this.#displayMotivations();

      this.showSuccess(`Cleared ${deletedCount} motivations`);
    } catch (error) {
      this.logger.error('Failed to clear motivations:', error);
      this.showError('Failed to clear motivations');
    } finally {
      this.#showLoadingState(false);
    }

    cleanup();
  };

  const handleCancel = () => {
    this.#closeModal();
    cleanup();
  };

  const cleanup = () => {
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
}
```

### 2. HTML Modal Structure

The modal HTML already exists in `core-motivations-generator.html`:

```html
<div
  id="confirmation-modal"
  class="modal-overlay"
  style="display: none"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div class="modal-content">
    <h3 id="modal-title">Clear All Motivations?</h3>
    <p>This will permanently remove all motivations for this direction.</p>
    <div class="modal-actions">
      <button
        id="confirm-clear"
        class="cb-button cb-button-danger"
        aria-label="Confirm clear all"
      >
        Yes, Clear All
      </button>
      <button
        id="cancel-clear"
        class="cb-button cb-button-secondary"
        aria-label="Cancel"
      >
        Cancel
      </button>
    </div>
  </div>
</div>
```

### 3. Existing Safety Features

The implementation already includes:

- ✅ Button disabled if no motivations (checked in `#clearAllMotivations()`)
- ✅ ESC key cancels modal (implemented in focus management)
- ✅ Loading state during deletion (`#showLoadingState()`)
- ✅ Success/error messages after operation
- ✅ Focus management and accessibility features
- ✅ Keyboard shortcut: Ctrl+Shift+Delete

### 4. Alternative Modal Pattern

Note: `ThematicDirectionsManagerController` uses a more sophisticated modal pattern with state management:

```javascript
_showConfirmationModal(options) {
  const {
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'confirm',
  } = options;

  // Store modal state
  this.#activeModal = {
    type: 'confirmation',
    options: options,
  };

  // Store callbacks
  this.#pendingModalAction = onConfirm;
  this.#activeModal.onCancel = onCancel;

  // Update modal content and show
  this._updateModalContent({ title, message, confirmText, cancelText, type });
  this._showModal();
}
```

## Potential Improvements

While the feature is fully functional, consider these potential enhancements for consistency:

1. **Refactor to Shared Modal Component**:
   - Extract the modal pattern from `ThematicDirectionsManagerController`
   - Create a reusable `ConfirmationModal` class for all controllers
   - Benefits: Consistency, maintainability, reduced duplication

2. **Enhanced User Feedback**:
   - Add the motivation count to the confirmation message (already shows "all")
   - Consider adding an undo feature after clearing

3. **Consistency Between Controllers**:
   - Both controllers implement modals differently
   - Consider standardizing the approach across the application

## Validation Status

- ✅ Modal appears on click
- ✅ Clear All button triggers confirmation
- ✅ ESC key cancels modal
- ✅ Deletion works correctly
- ✅ Loading state shows during operation
- ✅ Success message appears after clearing
- ✅ Focus management works properly
- ✅ Keyboard shortcut (Ctrl+Shift+Delete) functional

## Conclusion

This feature is **COMPLETED** and fully functional. The workflow document has been updated to reflect the actual implementation rather than proposing new work.
