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

    // Reset character count
    this.#elements.charCount.textContent = '0/1000';
    this.#elements.charCount.classList.remove('warning', 'error');

    // Clear any error messages
    this.#elements.conceptError.textContent = '';

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
        this.#elements.saveConceptBtn.textContent = 'Saving...';

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
        this.#elements.saveConceptBtn.textContent =
            this.#editingConceptId ? 'Update Concept' : 'Create Concept';
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

        // Show success message (optional)
        this.#showSuccessNotification('Character concept created successfully!');

        // The UI will be updated via event listener

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
 * Show error message in the form
 * @param {string} message
 */
#showFormError(message) {
    this.#elements.conceptError.textContent = message;
    this.#elements.conceptError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Show success notification
 * @param {string} message
 */
#showSuccessNotification(message) {
    // Check if notification system exists
    if (window.notificationSystem) {
        window.notificationSystem.show(message, 'success');
    } else {
        // Fallback: log success
        this.#logger.info(message);
    }
}
```

### 7. Enhance Form Validation

Update the validation method to be more comprehensive:

```javascript
/**
 * Validate the concept form
 * @returns {boolean}
 */
#validateConceptForm() {
    const conceptText = this.#elements.conceptText.value.trim();
    const minLength = 10;
    const maxLength = 1000;

    let isValid = true;
    let errorMessage = '';

    // Check if empty
    if (conceptText.length === 0) {
        isValid = false;
        errorMessage = 'Character concept is required';
    }
    // Check minimum length
    else if (conceptText.length < minLength) {
        isValid = false;
        errorMessage = `Concept must be at least ${minLength} characters`;
    }
    // Check maximum length
    else if (conceptText.length > maxLength) {
        isValid = false;
        errorMessage = `Concept must not exceed ${maxLength} characters`;
    }
    // Check for meaningful content (not just whitespace or repeated chars)
    else if (this.#isInvalidContent(conceptText)) {
        isValid = false;
        errorMessage = 'Please provide a meaningful character concept';
    }

    // Update UI
    this.#elements.conceptError.textContent = errorMessage;
    this.#elements.saveConceptBtn.disabled = !isValid || conceptText.length === 0;

    // Add/remove error styling
    if (!isValid && conceptText.length > 0) {
        this.#elements.conceptText.classList.add('error');
    } else {
        this.#elements.conceptText.classList.remove('error');
    }

    return isValid;
}

/**
 * Check if content is invalid (e.g., just repeated characters)
 * @param {string} text
 * @returns {boolean}
 */
#isInvalidContent(text) {
    // Check for repeated single character
    if (text.length > 5 && new Set(text).size === 1) {
        return true;
    }

    // Check for minimal word count (at least 3 words)
    const words = text.split(/\s+/).filter(word => word.length > 0);
    if (words.length < 3) {
        return true;
    }

    return false;
}
```

### 8. Add Keyboard Shortcuts

Enhance the form with keyboard shortcuts:

```javascript
// In #setupFormHandlers method, add:
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

### 9. Add Loading State for Save Button

Create a more sophisticated loading state:

```javascript
/**
 * Set save button loading state
 * @param {boolean} isLoading
 */
#setSaveButtonLoading(isLoading) {
    if (isLoading) {
        this.#elements.saveConceptBtn.disabled = true;
        this.#elements.saveConceptBtn.classList.add('loading');
        this.#elements.saveConceptBtn.innerHTML = `
            <span class="spinner"></span>
            <span>Saving...</span>
        `;
    } else {
        this.#elements.saveConceptBtn.classList.remove('loading');
        this.#elements.saveConceptBtn.textContent =
            this.#editingConceptId ? 'Update Concept' : 'Create Concept';
        // Re-validate to set correct disabled state
        this.#validateConceptForm();
    }
}
```

### 10. Add Focus Management

Ensure proper focus management for accessibility:

```javascript
// In #showCreateModal, enhance focus handling:
#showCreateModal() {
    // ... existing code ...

    // Store previous focus
    this.#previousFocus = document.activeElement;

    // Show modal
    this.#elements.conceptModal.style.display = 'flex';

    // Set focus trap
    this.#setFocusTrap(this.#elements.conceptModal);

    // Focus on textarea
    setTimeout(() => {
        this.#elements.conceptText.focus();
        this.#elements.conceptText.select(); // Select any existing text
    }, 100);
}

// In #closeConceptModal, restore focus:
#closeConceptModal() {
    // ... existing code ...

    // Remove focus trap
    this.#removeFocusTrap();

    // Restore previous focus
    if (this.#previousFocus && this.#previousFocus.focus) {
        this.#previousFocus.focus();
    }
}

/**
 * Set focus trap within an element
 * @param {HTMLElement} element
 */
#setFocusTrap(element) {
    const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    this.#focusTrapHandler = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    };

    element.addEventListener('keydown', this.#focusTrapHandler);
}

/**
 * Remove focus trap
 */
#removeFocusTrap() {
    if (this.#focusTrapHandler) {
        this.#elements.conceptModal.removeEventListener('keydown', this.#focusTrapHandler);
        this.#focusTrapHandler = null;
    }
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

1. Test form validation with various inputs:
   - Empty text
   - Text below minimum length
   - Text above maximum length
   - Valid text
   - Text with only spaces
   - Repeated characters
2. Test character counter updates
3. Test save operation success and failure
4. Test modal close behavior
5. Test keyboard shortcuts
6. Test focus trap in modal
7. Test error message display

## Notes

- Ensure all async operations have proper error handling
- Maintain consistency with existing form patterns in the app
- Consider adding animation for modal show/hide
- Test with screen readers for accessibility
- The service will dispatch events that update the UI
