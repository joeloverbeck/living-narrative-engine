# CLIGEN-011: Form Controls & Interactions

## Ticket Information

**Project**: Living Narrative Engine - Clichés Generator  
**Phase**: Phase 3 - UI Implementation  
**Priority**: High  
**Estimated Time**: 4 hours  
**Complexity**: Medium  
**Dependencies**: CLIGEN-010 (CSS Styling), ClichesGeneratorController.js foundation  
**Assignee**: TBD  
**Status**: Ready for Development

## Overview

Implement interactive form functionality for the Clichés Generator page, including direction selector population, form validation, event handling, and user feedback mechanisms. This ticket focuses on bridging the UI layer with the existing controller architecture to create a fully functional form experience.

## Current State Analysis

### Existing Infrastructure ✅

- `ClichesGeneratorController.js` - Comprehensive controller with state management
- `cliches-generator.html` - Complete HTML form structure with proper IDs
- `BaseCharacterBuilderController.js` - Base class with common functionality
- Event bus system for component communication
- Validation utilities and error handling infrastructure

### What's Missing ❌

- Direction selector dropdown population logic
- Form event handlers and validation
- Generate button state management
- User feedback and status message system
- Integration between UI events and controller methods

## Technical Requirements

### 1. Direction Selector Implementation

Implement the dropdown population and selection handling:

```javascript
/**
 * Populate direction selector with available thematic directions
 * Groups directions by character concept for better organization
 */
async _populateDirectionSelector() {
  try {
    // Use cached data if available
    const directionsData = await this._loadDirectionsData();
    const selector = this.#directionSelector;

    // Clear existing options (keep placeholder)
    while (selector.children.length > 1) {
      selector.removeChild(selector.lastChild);
    }

    // Group directions by concept for organized display
    const groupedDirections = this._groupDirectionsByConcept(directionsData);

    // Create optgroups for each concept
    for (const [conceptId, directions] of groupedDirections) {
      const concept = await this._getCachedConcept(conceptId);
      const optgroup = document.createElement('optgroup');
      optgroup.label = concept.title || 'Unknown Concept';

      // Add directions to the group
      directions.forEach(direction => {
        const option = document.createElement('option');
        option.value = direction.id;
        option.textContent = direction.title;
        option.setAttribute('data-concept-id', conceptId);
        optgroup.appendChild(option);
      });

      selector.appendChild(optgroup);
    }

    this._logActivity('Direction selector populated', {
      conceptCount: groupedDirections.size,
      directionCount: directionsData.length
    });

  } catch (error) {
    this._handleError('Failed to populate direction selector', error);
    this._showStatusMessage('Unable to load thematic directions. Please try refreshing.', 'error');
  }
}

/**
 * Group directions by their parent concept for organized display
 */
_groupDirectionsByConcept(directions) {
  const grouped = new Map();

  directions.forEach(direction => {
    if (!grouped.has(direction.conceptId)) {
      grouped.set(direction.conceptId, []);
    }
    grouped.get(direction.conceptId).push(direction);
  });

  // Sort directions within each group by title
  for (const directions of grouped.values()) {
    directions.sort((a, b) => a.title.localeCompare(b.title));
  }

  return grouped;
}
```

### 2. Form Event Handlers

Implement comprehensive form event handling:

```javascript
/**
 * Set up form event listeners and interactions
 */
_setupEventListeners() {
  super._setupEventListeners();

  // Direction selector change handler
  this.#directionSelector.addEventListener('change', (event) => {
    this._handleDirectionSelection(event);
  });

  // Form submission handler
  this.#form.addEventListener('submit', (event) => {
    event.preventDefault();
    this._handleFormSubmission();
  });

  // Generate button click handler
  this.#generateBtn.addEventListener('click', (event) => {
    this._handleGenerateClick(event);
  });

  // Retry button handler (for error states)
  document.addEventListener('click', (event) => {
    if (event.target.id === 'retry-btn') {
      this._handleRetryGeneration();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    this._handleKeyboardShortcuts(event);
  });

  // Back to menu navigation
  this.#backToMenuBtn.addEventListener('click', () => {
    this._handleNavigateBack();
  });
}

/**
 * Handle direction selection with validation and state updates
 */
async _handleDirectionSelection(event) {
  const directionId = event.target.value;

  try {
    // Clear previous state
    this._clearPreviousSelection();

    if (!directionId) {
      this._updateUIState('no-selection');
      return;
    }

    // Validate selection
    const validationResult = validateDirectionSelection(directionId);
    if (!validationResult.isValid) {
      throw new ClicheValidationError('Invalid direction selection', validationResult);
    }

    // Update loading state
    this._updateUIState('loading-selection');

    // Load direction and concept data
    const [direction, concept] = await Promise.all([
      this._getDirectionById(directionId),
      this._getConceptByDirectionId(directionId)
    ]);

    // Update controller state
    this.#selectedDirectionId = directionId;
    this.#currentDirection = direction;
    this.#currentConcept = concept;

    // Check if clichés already exist
    const existingCliches = await this._characterBuilderService.getClichesByDirectionId(directionId);

    if (existingCliches) {
      // Display existing clichés
      this.#currentCliches = existingCliches;
      this._updateUIState('has-results');
      this._displayDirectionInfo(direction, concept);
      await this._displayCliches(existingCliches);
      this._showStatusMessage('Clichés already exist for this direction.', 'info');
    } else {
      // Ready for generation
      this._updateUIState('ready-to-generate');
      this._displayDirectionInfo(direction, concept);
      this._showStatusMessage('Ready to generate clichés for this direction.', 'success');
    }

    // Add to state history
    this._addToStateHistory('direction-selected', { directionId, hasExisting: !!existingCliches });

  } catch (error) {
    this._handleError('Direction selection failed', error);
    this._updateUIState('selection-error');
    this._showStatusMessage('Failed to load direction details. Please try again.', 'error');
  }
}
```

### 3. Form Validation System

Implement comprehensive form validation:

```javascript
/**
 * Validate form state before submission
 */
_validateForm() {
  const errors = [];

  // Check direction selection
  if (!this.#selectedDirectionId) {
    errors.push({
      field: 'direction-selector',
      message: 'Please select a thematic direction'
    });
  }

  // Check for generation prerequisites
  try {
    const prerequisites = validateGenerationPrerequisites({
      directionId: this.#selectedDirectionId,
      direction: this.#currentDirection,
      concept: this.#currentConcept,
      isGenerating: this.#isGenerating
    });

    if (!prerequisites.isValid) {
      errors.push(...prerequisites.errors);
    }
  } catch (error) {
    errors.push({
      field: 'general',
      message: 'Validation failed. Please check your selection and try again.'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Display form validation errors to the user
 */
_displayFormErrors(errors) {
  // Clear previous errors
  this._clearFormErrors();

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

  // Show general error message
  this._showStatusMessage('Please fix the errors below and try again.', 'error');

  // Focus first error field for accessibility
  const firstErrorField = document.querySelector('.cb-form-error');
  if (firstErrorField) {
    firstErrorField.focus();
  }
}

/**
 * Clear all form validation errors
 */
_clearFormErrors() {
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
```

### 4. Generate Button State Management

Implement intelligent button state management:

```javascript
/**
 * Update generate button state based on current conditions
 */
_updateGenerateButtonState() {
  const button = this.#generateBtn;

  if (this.#isGenerating) {
    // Generating state
    button.disabled = true;
    button.textContent = 'Generating...';
    button.classList.add('cb-button-loading');
    button.setAttribute('aria-busy', 'true');

  } else if (!this.#selectedDirectionId) {
    // No selection state
    button.disabled = true;
    button.textContent = 'Select Direction First';
    button.classList.remove('cb-button-loading');
    button.setAttribute('aria-busy', 'false');

  } else if (this.#currentCliches) {
    // Already has results state
    button.disabled = true;
    button.textContent = 'Clichés Already Exist';
    button.classList.remove('cb-button-loading');
    button.setAttribute('aria-busy', 'false');

  } else {
    // Ready to generate state
    button.disabled = false;
    button.textContent = 'Generate Clichés';
    button.classList.remove('cb-button-loading');
    button.setAttribute('aria-busy', 'false');
  }

  // Update button styling based on state
  this._updateButtonStyling(button);
}

/**
 * Handle generate button click with comprehensive validation
 */
async _handleGenerateClick(event) {
  try {
    // Prevent multiple submissions
    if (this.#isGenerating) {
      return;
    }

    // Validate form
    const validation = this._validateForm();
    if (!validation.isValid) {
      this._displayFormErrors(validation.errors);
      return;
    }

    // Confirm generation if needed
    const shouldProceed = await this._confirmGeneration();
    if (!shouldProceed) {
      return;
    }

    // Start generation process
    await this._startGeneration();

  } catch (error) {
    this._handleError('Generation failed to start', error);
    this._updateUIState('generation-error');
  }
}

/**
 * Start the cliché generation process
 */
async _startGeneration() {
  try {
    // Update state and UI
    this.#isGenerating = true;
    this._updateUIState('generating');
    this._updateGenerateButtonState();
    this._showStatusMessage('Generating clichés... This may take a few seconds.', 'info');

    // Track generation start
    this._trackGenerationStart();

    // Generate clichés through controller
    const cliches = await this._characterBuilderService.generateClichesForDirection(
      this.#currentConcept,
      this.#currentDirection
    );

    // Update state with results
    this.#currentCliches = cliches;
    this.#isGenerating = false;

    // Display results
    this._updateUIState('generation-complete');
    await this._displayCliches(cliches);
    this._updateGenerateButtonState();
    this._showStatusMessage('Clichés generated successfully!', 'success');

    // Track successful generation
    this._trackGenerationSuccess(cliches);

    // Add to state history
    this._addToStateHistory('generation-complete', {
      directionId: this.#selectedDirectionId,
      clicheCount: this._countTotalCliches(cliches)
    });

  } catch (error) {
    // Handle generation failure
    this.#isGenerating = false;
    this._updateUIState('generation-error');
    this._updateGenerateButtonState();

    this._handleError('Cliché generation failed', error);
    this._showStatusMessage('Failed to generate clichés. Please try again.', 'error');

    // Track generation failure
    this._trackGenerationFailure(error);
  }
}
```

### 5. Status Message System

Implement user feedback through status messages:

```javascript
/**
 * Display status messages to the user with appropriate styling
 */
_showStatusMessage(message, type = 'info', duration = 5000) {
  const container = this.#statusMessages;

  // Create message element
  const messageElement = document.createElement('div');
  messageElement.className = `cb-status-message cb-status-${type}`;
  messageElement.setAttribute('role', type === 'error' ? 'alert' : 'status');
  messageElement.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  // Create message content
  const messageContent = document.createElement('span');
  messageContent.textContent = message;
  messageElement.appendChild(messageContent);

  // Add close button for persistent messages
  if (type === 'error' || duration === null) {
    const closeButton = document.createElement('button');
    closeButton.className = 'cb-message-close';
    closeButton.setAttribute('aria-label', 'Close message');
    closeButton.innerHTML = '×';
    closeButton.addEventListener('click', () => {
      this._removeStatusMessage(messageElement);
    });
    messageElement.appendChild(closeButton);
  }

  // Add to container
  container.appendChild(messageElement);

  // Auto-remove after duration (if specified)
  if (duration !== null) {
    setTimeout(() => {
      if (messageElement.parentNode) {
        this._removeStatusMessage(messageElement);
      }
    }, duration);
  }

  // Limit total number of messages
  this._limitStatusMessages(5);
}

/**
 * Remove a status message with animation
 */
_removeStatusMessage(messageElement) {
  messageElement.classList.add('cb-message-removing');
  setTimeout(() => {
    if (messageElement.parentNode) {
      messageElement.parentNode.removeChild(messageElement);
    }
  }, 300);
}

/**
 * Clear all status messages
 */
_clearStatusMessages() {
  const messages = this.#statusMessages.querySelectorAll('.cb-status-message');
  messages.forEach(message => this._removeStatusMessage(message));
}
```

### 6. Keyboard Shortcuts and Accessibility

Implement keyboard navigation and shortcuts:

```javascript
/**
 * Handle keyboard shortcuts for improved user experience
 */
_handleKeyboardShortcuts(event) {
  // Generate shortcut: Ctrl/Cmd + Enter
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    if (!this.#generateBtn.disabled) {
      event.preventDefault();
      this._handleGenerateClick(event);
    }
    return;
  }

  // Escape key: Clear current operation
  if (event.key === 'Escape') {
    this._handleEscapeKey();
    return;
  }

  // F5 key: Refresh data
  if (event.key === 'F5' && !event.shiftKey) {
    event.preventDefault();
    this._handleRefresh();
    return;
  }
}

/**
 * Handle escape key press for canceling operations
 */
_handleEscapeKey() {
  // Clear status messages
  this._clearStatusMessages();

  // Clear form errors
  this._clearFormErrors();

  // If generating, show cancellation option
  if (this.#isGenerating) {
    this._showStatusMessage('Generation in progress. Please wait for completion.', 'info');
  }
}

/**
 * Implement proper focus management for accessibility
 */
_manageFocus() {
  // Focus management after state changes
  switch (this._getCurrentState()) {
    case 'ready-to-generate':
      this.#generateBtn.focus();
      break;

    case 'generation-complete':
      // Focus first result or generate button
      const firstResult = document.querySelector('.cliche-category-card');
      if (firstResult) {
        firstResult.focus();
      } else {
        this.#generateBtn.focus();
      }
      break;

    case 'generation-error':
      const retryButton = document.getElementById('retry-btn');
      if (retryButton) {
        retryButton.focus();
      }
      break;
  }
}
```

## Implementation Tasks

### Task 1: Direction Selector Implementation (60 minutes)

- [ ] Implement dropdown population logic with concept grouping
- [ ] Add selection event handler with validation
- [ ] Implement cached data loading and error handling
- [ ] Test dropdown behavior and performance

### Task 2: Form Validation System (45 minutes)

- [ ] Create comprehensive form validation logic
- [ ] Implement error display and clearing mechanisms
- [ ] Add accessibility attributes for form errors
- [ ] Test validation with various input scenarios

### Task 3: Generate Button State Management (30 minutes)

- [ ] Implement button state logic based on current conditions
- [ ] Add loading states and visual feedback
- [ ] Connect button events to generation process
- [ ] Test button behavior across different states

### Task 4: Status Message System (30 minutes)

- [ ] Create status message display functionality
- [ ] Implement different message types (success, error, info)
- [ ] Add auto-dismiss and manual close options
- [ ] Test message accessibility and user experience

### Task 5: Event Handling and User Interactions (45 minutes)

- [ ] Set up all form event listeners
- [ ] Implement keyboard shortcuts and navigation
- [ ] Add retry and error recovery mechanisms
- [ ] Test complete user interaction flows

### Task 6: Integration and Testing (30 minutes)

- [ ] Connect form logic to existing controller methods
- [ ] Test integration with service layer
- [ ] Verify error handling and edge cases
- [ ] Conduct accessibility and usability testing

## Acceptance Criteria

### Functional Requirements

- [ ] **Direction Selection**: Dropdown populates with grouped directions and handles selection properly
- [ ] **Form Validation**: Form validates input and displays clear error messages
- [ ] **Generate Button**: Button state changes appropriately based on conditions
- [ ] **Status Messages**: User receives clear feedback for all operations
- [ ] **Error Handling**: Graceful error recovery with user-friendly messages
- [ ] **Integration**: Form connects properly to existing controller and service layers

### User Experience Requirements

- [ ] **Responsive Interactions**: All interactions work smoothly on mobile and desktop
- [ ] **Loading States**: Clear visual feedback during async operations
- [ ] **Error Recovery**: Users can easily recover from errors and retry operations
- [ ] **Keyboard Navigation**: Complete keyboard accessibility for all functionality
- [ ] **Screen Reader Support**: Proper announcements and accessibility attributes

### Technical Requirements

- [ ] **Event Handling**: Proper event listener setup and cleanup
- [ ] **State Management**: Consistent state updates and validation
- [ ] **Performance**: Smooth interactions without blocking the UI
- [ ] **Error Boundaries**: Comprehensive error handling without crashes
- [ ] **Memory Management**: No memory leaks from event listeners

## Testing Strategy

### Unit Testing

```javascript
// Example test structure for form interactions
describe('ClichesGeneratorController - Form Interactions', () => {
  let controller, mockService, mockEventBus;

  beforeEach(() => {
    // Setup test environment
  });

  describe('Direction Selection', () => {
    it('should populate dropdown with grouped directions', async () => {
      // Test dropdown population
    });

    it('should handle direction selection with validation', async () => {
      // Test selection handling
    });
  });

  describe('Form Validation', () => {
    it('should validate form state before submission', () => {
      // Test validation logic
    });

    it('should display and clear error messages', () => {
      // Test error handling
    });
  });
});
```

### Integration Testing

- [ ] Test complete form workflow from selection to generation
- [ ] Verify integration with service layer and data persistence
- [ ] Test error scenarios and recovery mechanisms
- [ ] Validate accessibility features with screen readers

### User Acceptance Testing

- [ ] Test user flows with actual thematic direction data
- [ ] Verify form usability on different devices
- [ ] Test error scenarios from user perspective
- [ ] Validate keyboard navigation and shortcuts

## Definition of Done

- [ ] All form controls are functional and properly validated
- [ ] Direction selector populates and handles selection correctly
- [ ] Generate button state management works across all scenarios
- [ ] Status message system provides clear user feedback
- [ ] Form integrates properly with existing controller architecture
- [ ] Comprehensive error handling and recovery mechanisms
- [ ] Keyboard navigation and accessibility features implemented
- [ ] All acceptance criteria verified through testing
- [ ] Code follows project conventions and patterns
- [ ] Integration tests pass and cover critical user flows

## Dependencies

### Upstream Dependencies

- **CLIGEN-010**: CSS Styling & Responsive Design (styling for form elements)
- `ClichesGeneratorController.js` - Controller foundation and methods
- `BaseCharacterBuilderController.js` - Base functionality and patterns
- Character builder service layer - Data operations and validation

### Downstream Dependencies

- **CLIGEN-012**: Results Display & Categorization (displays generated results)

## Notes

### Integration Points

This ticket creates the bridge between the UI layer and the existing controller architecture. Key integration points:

- Form events → Controller methods
- Service layer calls → UI state updates
- Error handling → User feedback
- Data loading → UI state management

### Performance Considerations

- Implement proper event listener cleanup to prevent memory leaks
- Use debouncing for frequent events (typing, selection changes)
- Cache dropdown data to avoid repeated API calls
- Optimize DOM updates for smooth user experience

### Accessibility Focus

This ticket has a strong focus on accessibility:

- Proper ARIA attributes and roles
- Keyboard navigation support
- Screen reader announcements
- High contrast and reduced motion support
- Clear error messaging and recovery paths

---

**Created**: 2025-08-12  
**Last Updated**: 2025-08-12  
**Ticket Status**: Ready for Development
