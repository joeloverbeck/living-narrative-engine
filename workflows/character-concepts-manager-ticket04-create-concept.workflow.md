# Ticket 04: Create Concept Functionality

## Overview

Implement the complete create concept functionality, including modal display, form validation, saving via CharacterBuilderService, and UI updates upon successful creation.

## Dependencies

- Ticket 01: HTML Structure (completed)
- Ticket 02: CSS Styling (completed)
- Ticket 03: Controller Setup (must be completed)

## Implementation Details

### 1. Implement Show Create Modal Method

In `CharacterConceptsManagerController`, implement the `#showCreateModal` method:

```javascript
/**
 * Show the create concept modal
 */
#showCreateModal() {
    this.#logger.info('Showing create concept modal');

    // Reset form for new concept
    this.#editingConceptId = null;
    this.#resetConceptForm();

    // Update modal title
    this.#elements.conceptModalTitle.textContent = 'Create Character Concept';
    this.#elements.saveConceptBtn.textContent = 'Create Concept';

    // Show modal
    this.#elements.conceptModal.style.display = 'flex';

    // Focus on textarea
    setTimeout(() => {
        this.#elements.conceptText.focus();
    }, 100);

    // Track modal open for analytics (if applicable)
    this.#eventBus.dispatch({
        type: 'ui:modal-opened',
        payload: { modalType: 'create-concept' }
    });
}
```

### 2. Implement Reset Form Method

Add a helper method to reset the form:

```javascript
/**
 * Reset the concept form to initial state
 */
#resetConceptForm() {
    // Clear form
    this.#elements.conceptForm.reset();

    // Reset character count (ValidationPatterns.concept uses 50-3000 chars)
    this.#elements.charCount.textContent = '0/3000';
    this.#elements.charCount.classList.remove('warning', 'error');

    // Clear any error messages using FormValidationHelper
    FormValidationHelper.clearFieldError(this.#elements.conceptText);

    // Disable save button initially
    this.#elements.saveConceptBtn.disabled = true;

    // Clear editing state
    this.#editingConceptId = null;
}
```

### 3. Implement Close Modal Method

Implement the `#closeConceptModal` method:

```javascript
/**
 * Close the concept modal and clean up
 */
#closeConceptModal() {
    this.#logger.info('Closing concept modal');

    // Hide modal
    this.#elements.conceptModal.style.display = 'none';

    // Reset form
    this.#resetConceptForm();

    // Clear editing state
    this.#editingConceptId = null;

    // Dispatch modal closed event
    this.#eventBus.dispatch({
        type: 'ui:modal-closed',
        payload: { modalType: 'concept' }
    });
}
```

### 4. Implement Save Concept Handler

Implement the main save handler that works for both create and edit:

```javascript
/**
 * Handle concept form submission
 */
async #handleConceptSave() {
    // Validate form
    if (!this.#validateConceptForm()) {
        this.#logger.warn('Form validation failed');
        return;
    }

    const conceptText = this.#elements.conceptText.value.trim();

    try {
        // Disable form during save
        this.#setFormEnabled(false);
        this.#setSaveButtonLoading(true);

        if (this.#editingConceptId) {
            // Update existing concept
            await this.#updateConcept(this.#editingConceptId, conceptText);
        } else {
            // Create new concept
            await this.#createConcept(conceptText);
        }

        // Close modal on success
        this.#closeConceptModal();

    } catch (error) {
        this.#logger.error('Failed to save concept', error);
        this.#showFormError('Failed to save concept. Please try again.');
    } finally {
        // Re-enable form
        this.#setFormEnabled(true);
        this.#setSaveButtonLoading(false);
    }
}
```

### 5. Implement Create Concept Method

Add the method that calls the service:

```javascript
/**
 * Create a new character concept
 * @param {string} conceptText - The concept text
 */
async #createConcept(conceptText) {
    this.#logger.info('Creating new concept', { length: conceptText.length });

    try {
        const concept = await this.#characterBuilderService.createCharacterConcept(conceptText);

        this.#logger.info('Concept created successfully', { id: concept.id });

        // Show success message
        this.#showSuccessNotification('Character concept created successfully!');

        // The UI will be updated via service event (CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED)

    } catch (error) {
        this.#logger.error('Failed to create concept', error);
        throw error;
    }
}
```

### 6. Add Form Helper Methods

Add utility methods for form management:

```javascript
/**
 * Enable or disable form elements
 * @param {boolean} enabled
 */
#setFormEnabled(enabled) {
    this.#elements.conceptText.disabled = !enabled;
    this.#elements.saveConceptBtn.disabled = !enabled;
    this.#elements.cancelConceptBtn.disabled = !enabled;

    if (enabled) {
        // Re-validate if enabling
        this.#validateConceptForm();
    }
}

/**
 * Show error message using FormValidationHelper
 * @param {string} message
 */
#showFormError(message) {
    FormValidationHelper.showFieldError(this.#elements.conceptText, message);
}

/**
 * Show success via logging (no notification system in current architecture)
 * @param {string} message
 */
#showSuccessNotification(message) {
    // Log success - UI updates happen via event listeners
    this.#logger.info(message);
}
```

### 7. Form Validation Integration

The form validation is already handled by `FormValidationHelper` with `ValidationPatterns.concept` (50-3000 characters). The `#validateConceptForm` method only needs to call the existing validation:

```javascript
/**
 * Validate the concept form using FormValidationHelper
 * @returns {boolean}
 */
#validateConceptForm() {
    return FormValidationHelper.validateField(
        this.#elements.conceptText,
        ValidationPatterns.concept,
        'Concept'
    );
}
```

Note: Real-time validation is already set up in the constructor with:
- Character limits: 50-3000 characters (enforced by ValidationPatterns.concept)
- Character counter: Updates automatically
- Error messages: Handled by FormValidationHelper
- Save button state: Managed by validation system

### 8. Add Keyboard Shortcuts

Keyboard shortcuts are already handled in the existing event setup. The Escape key for modal closing is already implemented in `#setupModalHandlers`. For form submission shortcuts, add to existing `#setupFormHandlers`:

```javascript
// Add to existing #setupFormHandlers method:
this.#elements.conceptText.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Enter to submit
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!this.#elements.saveConceptBtn.disabled) {
      this.#handleConceptSave();
    }
  }
});
```

### 9. Simplify Loading State for Save Button

Simplify the loading state to work with the existing validation system:

```javascript
/**
 * Set save button loading state
 * @param {boolean} isLoading
 */
#setSaveButtonLoading(isLoading) {
    if (isLoading) {
        this.#elements.saveConceptBtn.disabled = true;
        this.#elements.saveConceptBtn.textContent = 'Saving...';
    } else {
        this.#elements.saveConceptBtn.textContent =
            this.#editingConceptId ? 'Update Concept' : 'Create Concept';
        // Re-validate to set correct disabled state
        this.#validateConceptForm();
    }
}
```

### 10. Basic Focus Management

Implement basic focus management for accessibility:

```javascript
// Update #showCreateModal to include focus management:
#showCreateModal() {
    this.#logger.info('Showing create concept modal');

    // Reset form for new concept
    this.#editingConceptId = null;
    this.#resetConceptForm();

    // Update modal title
    this.#elements.conceptModalTitle.textContent = 'Create Character Concept';
    this.#elements.saveConceptBtn.textContent = 'Create Concept';

    // Store previous focus
    this.#previousFocus = document.activeElement;

    // Show modal
    this.#elements.conceptModal.style.display = 'flex';

    // Focus on textarea
    setTimeout(() => {
        this.#elements.conceptText.focus();
    }, 100);

    // Track modal open for analytics
    this.#eventBus.dispatch({
        type: 'ui:modal-opened',
        payload: { modalType: 'create-concept' }
    });
}

// Update #closeConceptModal to restore focus:
#closeConceptModal() {
    this.#logger.info('Closing concept modal');

    // Hide modal
    this.#elements.conceptModal.style.display = 'none';

    // Reset form
    this.#resetConceptForm();

    // Clear editing state
    this.#editingConceptId = null;

    // Restore previous focus
    if (this.#previousFocus && this.#previousFocus.focus) {
        this.#previousFocus.focus();
    }

    // Dispatch modal closed event
    this.#eventBus.dispatch({
        type: 'ui:modal-closed',
        payload: { modalType: 'concept' }
    });
}
```

## Acceptance Criteria

1. ✅ Create button opens modal with correct title
2. ✅ Form validates in real-time as user types
3. ✅ Character counter updates and shows warnings
4. ✅ Save button is disabled when form is invalid
5. ✅ Concept is saved via CharacterBuilderService
6. ✅ Modal closes on successful save
7. ✅ Error messages display for validation failures
8. ✅ Loading state shows during save operation
9. ✅ Form is properly reset when modal closes
10. ✅ Keyboard shortcuts work (Ctrl+Enter, Escape)
11. ✅ Focus management works correctly
12. ✅ Proper error handling for save failures

## Testing Requirements

1. Test form validation with various inputs (using ValidationPatterns.concept):
   - Empty text
   - Text below 50 characters (minimum)
   - Text above 3000 characters (maximum)
   - Valid text (50-3000 characters)
   - Text with only spaces
2. Test FormValidationHelper integration:
   - Real-time validation setup
   - Character counter updates (0/3000)
   - Error message display via FormValidationHelper
3. Test save operation success and failure
4. Test modal close behavior and focus restoration
5. Test keyboard shortcuts (Ctrl+Enter, Escape)
6. Test service integration:
   - createCharacterConcept service call
   - Event dispatching (CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED)
   - Error handling from service

## Notes

- Form validation uses existing ValidationPatterns.concept (50-3000 characters)
- Real-time validation is handled by FormValidationHelper.setupRealTimeValidation
- Character counter shows current/3000 format
- Error handling integrates with CharacterBuilderService retry logic and circuit breakers
- Service events (CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED) automatically update UI
- No custom notification system - use logging for success messages
- Focus management includes basic restoration but no complex focus trapping
- Integration with existing UIStateManager for error display
