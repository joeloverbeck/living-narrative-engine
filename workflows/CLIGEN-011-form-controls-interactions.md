# CLIGEN-011: Form Controls & Interactions

## Ticket Information

**Project**: Living Narrative Engine - Clichés Generator  
**Phase**: Phase 3 - UI Enhancement  
**Priority**: High  
**Estimated Time**: 3 hours  
**Complexity**: Medium  
**Dependencies**: CLIGEN-010 (CSS Styling), ClichesGeneratorController.js existing implementation  
**Assignee**: TBD  
**Status**: Ready for Development

## Overview

Enhance and complete the interactive form functionality for the Clichés Generator page. While core functionality exists in `ClichesGeneratorController.js`, this ticket focuses on adding missing features including form validation UI, keyboard shortcuts, focus management, and improving the existing user feedback mechanisms.

## Current State Analysis

### Already Implemented ✅

In `ClichesGeneratorController.js`:

- `#populateDirectionSelector()` - Direction dropdown population with concept grouping
- `#handleDirectionSelection()` - Direction selection event handling
- `#handleGenerateCliches()` - Generate button click handling
- `#showStatusMessage()` - Status message display system
- `#updateGenerateButton()` - Basic button state management
- `_setupEventListeners()` - Form submission and basic event handling
- `#handleGenerationError()` - Error handling with partial retry logic
- Event bus integration for service communication
- Base class methods from `BaseCharacterBuilderController.js`

### What Needs Enhancement 🔧

- **Form Validation UI**: Visual error display and field validation feedback
- **Keyboard Shortcuts**: Ctrl+Enter for generate, Escape for cancel, F5 for refresh
- **Focus Management**: Proper focus handling for accessibility
- **Confirmation Dialogs**: User confirmation before certain actions
- **Enhanced Button States**: More granular state variations
- **Retry Mechanism**: Complete retry button functionality in error states

### What's Missing ❌

- Form validation error display system
- Keyboard navigation and shortcuts
- Focus management for accessibility
- Confirmation dialog implementation
- Enhanced loading states and animations

## Technical Requirements

### 1. Form Validation UI Enhancement

Add visual validation feedback to the existing validation logic:

```javascript
/**
 * Display form validation errors to the user
 * Enhances existing validation with UI feedback
 */
#displayFormErrors(errors) {
  // Clear previous errors
  this.#clearFormErrors();

  errors.forEach(error => {
    const fieldElement = document.getElementById(error.field);

    if (fieldElement) {
      // Add error styling to field
      fieldElement.classList.add('cb-form-error');
      fieldElement.setAttribute('aria-invalid', 'true');

      // Create and display error message
      const errorElement = document.createElement('div');
      errorElement.className = 'cb-field-error';
      errorElement.textContent = error.message;
      errorElement.id = `${error.field}-error`;

      // Associate error with field for accessibility
      fieldElement.setAttribute('aria-describedby', errorElement.id);

      // Insert error message after field
      fieldElement.parentNode.insertBefore(errorElement, fieldElement.nextSibling);
    }
  });

  // Show general error message using existing method
  this.#showStatusMessage('Please fix the errors below and try again.', 'error');

  // Focus first error field for accessibility
  const firstErrorField = document.querySelector('.cb-form-error');
  if (firstErrorField) {
    firstErrorField.focus();
  }
}

/**
 * Clear all form validation errors
 */
#clearFormErrors() {
  // Remove error classes and attributes
  document.querySelectorAll('.cb-form-error').forEach(element => {
    element.classList.remove('cb-form-error');
    element.removeAttribute('aria-invalid');
    element.removeAttribute('aria-describedby');
  });

  // Remove error messages
  document.querySelectorAll('.cb-field-error').forEach(element => {
    element.remove();
  });
}

/**
 * Validate form before submission
 * Integrates with existing validation utilities
 */
#validateForm() {
  const errors = [];

  // Check direction selection
  if (!this.#selectedDirectionId) {
    errors.push({
      field: 'direction-selector',
      message: 'Please select a thematic direction'
    });
  }

  // Use existing validation functions from clicheValidator.js
  try {
    const prerequisites = validateGenerationPrerequisites({
      directionId: this.#selectedDirectionId,
      direction: this.#currentDirection,
      concept: this.#currentConcept
    });

    if (!prerequisites.isValid) {
      errors.push(...prerequisites.errors);
    }
  } catch (error) {
    errors.push({
      field: 'general',
      message: 'Validation failed. Please check your selection.'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### 2. Keyboard Shortcuts Implementation

Add keyboard navigation and shortcuts to enhance UX:

```javascript
/**
 * Add keyboard shortcuts to existing event listeners
 * Should be called from _setupEventListeners()
 */
#setupKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    this.#handleKeyboardShortcuts(event);
  });
}

/**
 * Handle keyboard shortcuts for improved user experience
 */
#handleKeyboardShortcuts(event) {
  // Generate shortcut: Ctrl/Cmd + Enter
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    const generateBtn = this._getElement('generate-btn');
    if (generateBtn && !generateBtn.disabled) {
      event.preventDefault();
      this.#handleGenerateCliches();
    }
    return;
  }

  // Escape key: Clear current operation
  if (event.key === 'Escape') {
    this.#handleEscapeKey();
    return;
  }

  // F5 key: Refresh data (prevent default browser refresh)
  if (event.key === 'F5' && !event.shiftKey) {
    event.preventDefault();
    this.#handleRefresh();
    return;
  }

  // Tab navigation enhancement
  if (event.key === 'Tab') {
    this.#enhanceTabNavigation(event);
  }
}

/**
 * Handle escape key press for canceling operations
 */
#handleEscapeKey() {
  // Clear form errors
  this.#clearFormErrors();

  // Clear status messages except critical ones
  const statusContainer = this._getElement('status-messages');
  if (statusContainer) {
    const nonCriticalMessages = statusContainer.querySelectorAll('.cb-message:not(.cb-message-error)');
    nonCriticalMessages.forEach(msg => msg.remove());
  }

  // If generating, show info
  if (this.#isGenerating) {
    this.#showStatusMessage('Generation in progress. Please wait for completion.', 'info');
  }
}

/**
 * Handle data refresh
 */
async #handleRefresh() {
  try {
    this.#showStatusMessage('Refreshing data...', 'info');

    // Re-populate direction selector
    await this.#populateDirectionSelector();

    // Clear current selection if needed
    if (!this.#currentCliches) {
      this.#selectedDirectionId = null;
      this.#currentDirection = null;
      this.#currentConcept = null;
    }

    this.#showStatusMessage('Data refreshed successfully', 'success');
  } catch (error) {
    this.#showStatusMessage('Failed to refresh data', 'error');
  }
}
```

### 3. Focus Management System

Implement proper focus management for accessibility:

```javascript
/**
 * Manage focus after state changes for accessibility
 */
#manageFocus(newState) {
  switch (newState) {
    case 'ready-to-generate': {
      const generateBtn = this._getElement('generate-btn');
      if (generateBtn && !generateBtn.disabled) {
        generateBtn.focus();
      }
      break;
    }

    case 'generation-complete': {
      // Focus first result or status message
      const firstResult = document.querySelector('.cliche-category-card');
      if (firstResult) {
        firstResult.setAttribute('tabindex', '0');
        firstResult.focus();
      } else {
        const statusMessage = document.querySelector('.cb-message-success');
        if (statusMessage) {
          statusMessage.focus();
        }
      }
      break;
    }

    case 'generation-error': {
      // Focus retry button if available
      const retryButton = document.querySelector('[data-action="retry"]');
      if (retryButton) {
        retryButton.focus();
      } else {
        const errorMessage = document.querySelector('.cb-message-error');
        if (errorMessage) {
          errorMessage.focus();
        }
      }
      break;
    }

    case 'selection-made': {
      // Keep focus on selector unless generating
      if (!this.#isGenerating) {
        const generateBtn = this._getElement('generate-btn');
        if (generateBtn && !generateBtn.disabled) {
          generateBtn.focus();
        }
      }
      break;
    }
  }
}

/**
 * Enhance tab navigation for better keyboard accessibility
 */
#enhanceTabNavigation(event) {
  const focusableElements = this.#getFocusableElements();
  const currentIndex = focusableElements.indexOf(document.activeElement);

  if (event.shiftKey) {
    // Shift+Tab: Move backwards
    if (currentIndex === 0) {
      event.preventDefault();
      focusableElements[focusableElements.length - 1].focus();
    }
  } else {
    // Tab: Move forwards
    if (currentIndex === focusableElements.length - 1) {
      event.preventDefault();
      focusableElements[0].focus();
    }
  }
}

/**
 * Get all focusable elements in the form
 */
#getFocusableElements() {
  const selector = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(document.querySelectorAll(selector))
    .filter(el => el.offsetParent !== null); // Filter out hidden elements
}
```

### 4. Enhanced Button State Management

Improve the existing `#updateGenerateButton()` method:

```javascript
/**
 * Enhanced generate button state management
 * Extends existing #updateGenerateButton() method
 */
#updateGenerateButtonEnhanced() {
  const button = this._getElement('generate-btn');
  if (!button) return;

  // Remove all state classes
  button.classList.remove('cb-button-loading', 'cb-button-disabled', 'cb-button-ready', 'cb-button-exists');

  if (this.#isGenerating) {
    // Generating state with spinner
    button.disabled = true;
    button.innerHTML = '<span class="cb-spinner"></span> Generating...';
    button.classList.add('cb-button-loading');
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-label', 'Generating clichés, please wait');

  } else if (!this.#selectedDirectionId) {
    // No selection state
    button.disabled = true;
    button.textContent = 'Select Direction First';
    button.classList.add('cb-button-disabled');
    button.setAttribute('aria-busy', 'false');
    button.setAttribute('aria-label', 'Please select a direction before generating');

  } else if (this.#currentCliches && this.#currentCliches.length > 0) {
    // Already has results state
    button.disabled = false;
    button.textContent = 'Regenerate Clichés';
    button.classList.add('cb-button-exists');
    button.setAttribute('aria-busy', 'false');
    button.setAttribute('aria-label', 'Regenerate clichés for current direction');

  } else {
    // Ready to generate state
    button.disabled = false;
    button.textContent = 'Generate Clichés';
    button.classList.add('cb-button-ready');
    button.setAttribute('aria-busy', 'false');
    button.setAttribute('aria-label', 'Generate clichés for selected direction');
  }

  // Update button tooltip
  this.#updateButtonTooltip(button);
}

/**
 * Add helpful tooltips to the generate button
 */
#updateButtonTooltip(button) {
  if (button.disabled) {
    button.title = button.textContent;
  } else if ((event.ctrlKey || event.metaKey)) {
    button.title = 'Click or press Ctrl+Enter to generate';
  } else {
    button.title = 'Generate clichés for the selected direction';
  }
}
```

### 5. Confirmation Dialog Implementation

Add confirmation dialogs for user actions:

```javascript
/**
 * Show confirmation dialog before regenerating
 */
async #confirmRegeneration() {
  if (!this.#currentCliches || this.#currentCliches.length === 0) {
    return true; // No existing clichés, proceed without confirmation
  }

  return new Promise((resolve) => {
    const dialog = this.#createConfirmationDialog({
      title: 'Regenerate Clichés?',
      message: 'This will replace the existing clichés. Are you sure you want to continue?',
      confirmText: 'Regenerate',
      cancelText: 'Cancel',
      type: 'warning'
    });

    dialog.addEventListener('confirm', () => {
      dialog.remove();
      resolve(true);
    });

    dialog.addEventListener('cancel', () => {
      dialog.remove();
      resolve(false);
    });

    document.body.appendChild(dialog);
    dialog.querySelector('[data-action="cancel"]').focus();
  });
}

/**
 * Create a confirmation dialog element
 */
#createConfirmationDialog(options) {
  const dialog = document.createElement('div');
  dialog.className = 'cb-dialog-overlay';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'dialog-title');

  dialog.innerHTML = `
    <div class="cb-dialog">
      <h3 id="dialog-title" class="cb-dialog-title">${options.title}</h3>
      <p class="cb-dialog-message">${options.message}</p>
      <div class="cb-dialog-actions">
        <button class="cb-button cb-button-secondary" data-action="cancel">
          ${options.cancelText}
        </button>
        <button class="cb-button cb-button-${options.type || 'primary'}" data-action="confirm">
          ${options.confirmText}
        </button>
      </div>
    </div>
  `;

  // Handle dialog actions
  dialog.querySelector('[data-action="confirm"]').addEventListener('click', () => {
    dialog.dispatchEvent(new Event('confirm'));
  });

  dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    dialog.dispatchEvent(new Event('cancel'));
  });

  // Handle escape key
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dialog.dispatchEvent(new Event('cancel'));
    }
  });

  return dialog;
}
```

### 6. Enhanced Retry Mechanism

Complete the retry functionality for error states:

```javascript
/**
 * Enhanced error handling with retry functionality
 * Extends existing #handleGenerationError() method
 */
#handleGenerationErrorEnhanced(error) {
  // Call existing error handler
  this.#handleGenerationError(error);

  // Add retry button to error message
  const errorContainer = this._getElement('status-messages');
  if (errorContainer) {
    const lastError = errorContainer.querySelector('.cb-message-error:last-child');
    if (lastError && !lastError.querySelector('[data-action="retry"]')) {
      const retryButton = document.createElement('button');
      retryButton.className = 'cb-button-small cb-button-retry';
      retryButton.setAttribute('data-action', 'retry');
      retryButton.textContent = 'Retry';
      retryButton.addEventListener('click', () => this.#handleRetryGeneration());
      lastError.appendChild(retryButton);
    }
  }

  // Update UI state
  this.#manageFocus('generation-error');
}

/**
 * Handle retry generation after error
 */
async #handleRetryGeneration() {
  // Clear error messages
  const errorMessages = document.querySelectorAll('.cb-message-error');
  errorMessages.forEach(msg => msg.remove());

  // Reset state
  this.#isGenerating = false;
  this.#updateGenerateButtonEnhanced();

  // Retry generation
  await this.#handleGenerateCliches();
}
```

## Implementation Tasks

### Task 1: Form Validation UI (45 minutes)

- [ ] Implement `#displayFormErrors()` method for visual error feedback
- [ ] Implement `#clearFormErrors()` method for error cleanup
- [ ] Enhance `#validateForm()` to integrate with existing validators
- [ ] Add CSS classes for error states (.cb-form-error, .cb-field-error)
- [ ] Test validation with various input scenarios

### Task 2: Keyboard Shortcuts (30 minutes)

- [ ] Implement `#setupKeyboardShortcuts()` method
- [ ] Add Ctrl+Enter for generate action
- [ ] Add Escape key handling for clearing operations
- [ ] Add F5 override for data refresh
- [ ] Test keyboard navigation flow

### Task 3: Focus Management (30 minutes)

- [ ] Implement `#manageFocus()` method for state-based focus
- [ ] Add `#enhanceTabNavigation()` for better keyboard accessibility
- [ ] Implement `#getFocusableElements()` helper
- [ ] Add proper tabindex and ARIA attributes
- [ ] Test with screen readers

### Task 4: Enhanced Button States (20 minutes)

- [ ] Enhance existing `#updateGenerateButton()` method
- [ ] Add loading spinner for generation state
- [ ] Add regenerate state for existing clichés
- [ ] Implement `#updateButtonTooltip()` for helpful hints
- [ ] Style new button states in CSS

### Task 5: Confirmation Dialogs (25 minutes)

- [ ] Implement `#confirmRegeneration()` method
- [ ] Create `#createConfirmationDialog()` helper
- [ ] Add dialog styling and animations
- [ ] Test dialog accessibility and keyboard navigation
- [ ] Integrate with generation flow

### Task 6: Complete Retry Mechanism (20 minutes)

- [ ] Enhance `#handleGenerationError()` with retry button
- [ ] Implement `#handleRetryGeneration()` method
- [ ] Test retry flow with various error scenarios
- [ ] Ensure proper state cleanup on retry

### Task 7: Integration and Testing (30 minutes)

- [ ] Integrate all enhancements with existing controller
- [ ] Update `_setupEventListeners()` to include new handlers
- [ ] Test complete user flows
- [ ] Verify accessibility compliance
- [ ] Performance testing for smooth interactions

## Acceptance Criteria

### Functional Requirements

- [ ] **Form Validation**: Visual error feedback with clear messages
- [ ] **Keyboard Shortcuts**: Ctrl+Enter, Escape, and F5 work as expected
- [ ] **Focus Management**: Proper focus handling after state changes
- [ ] **Button States**: All button states display correctly
- [ ] **Confirmation Dialogs**: User confirmation before replacing clichés
- [ ] **Retry Mechanism**: Complete retry functionality in error states

### User Experience Requirements

- [ ] **Accessibility**: Full keyboard navigation and screen reader support
- [ ] **Visual Feedback**: Clear loading states and error messages
- [ ] **Responsive**: All enhancements work on mobile and desktop
- [ ] **Performance**: Smooth interactions without UI blocking
- [ ] **Error Recovery**: Easy recovery from error states

### Technical Requirements

- [ ] **Integration**: Seamless integration with existing controller code
- [ ] **No Breaking Changes**: All existing functionality continues to work
- [ ] **Clean Code**: Follows project patterns and conventions
- [ ] **Memory Management**: Proper cleanup of event listeners
- [ ] **Test Coverage**: Unit tests for new functionality

## Testing Strategy

### Unit Testing

```javascript
// Test structure for new enhancements
describe('ClichesGeneratorController - UI Enhancements', () => {
  describe('Form Validation UI', () => {
    it('should display validation errors visually', () => {
      // Test error display
    });

    it('should clear validation errors properly', () => {
      // Test error cleanup
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle Ctrl+Enter for generation', () => {
      // Test keyboard shortcut
    });

    it('should handle Escape key for cancel', () => {
      // Test escape handling
    });
  });

  describe('Focus Management', () => {
    it('should manage focus after state changes', () => {
      // Test focus management
    });
  });
});
```

### Integration Testing

- [ ] Test complete workflows with all enhancements
- [ ] Verify keyboard navigation through entire form
- [ ] Test error scenarios and recovery mechanisms
- [ ] Validate accessibility with automated tools

## Definition of Done

- [ ] All enhancement tasks completed and tested
- [ ] Form validation provides visual feedback
- [ ] Keyboard shortcuts implemented and documented
- [ ] Focus management improves accessibility
- [ ] Button states enhanced with better UX
- [ ] Confirmation dialogs prevent accidental data loss
- [ ] Retry mechanism works for all error states
- [ ] Integration tests pass
- [ ] Code follows project conventions
- [ ] No regression in existing functionality

## Dependencies

### Upstream Dependencies

- **CLIGEN-010**: CSS Styling for new UI elements
- `ClichesGeneratorController.js` - Existing controller implementation
- `BaseCharacterBuilderController.js` - Base class methods
- `clicheValidator.js` - Validation utilities

### Downstream Dependencies

- **CLIGEN-012**: Results Display (uses enhanced UI state)

## Notes

### Key Changes from Original Workflow

This updated workflow reflects the actual state of the codebase:

- Most core functionality already exists
- Focus is on enhancements rather than new implementation
- Method names use `#` prefix for private fields
- Leverages existing base class methods
- Integrates with existing validation and error handling

### Performance Considerations

- Debounce rapid keyboard events
- Use CSS transitions for smooth state changes
- Minimize DOM manipulation in loops
- Cache frequently accessed elements

### Accessibility Focus

- WCAG 2.1 AA compliance
- Full keyboard navigation
- Screen reader compatibility
- High contrast mode support
- Reduced motion preferences

---

**Created**: 2025-08-12  
**Last Updated**: 2025-01-12 (Corrected to align with actual codebase)  
**Ticket Status**: Ready for Development
