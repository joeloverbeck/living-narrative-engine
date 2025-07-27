# Ticket 06: Edit Concept Functionality

## Overview

Implement the complete edit concept functionality, including loading existing concept data, pre-populating the form, handling updates via CharacterBuilderService, and maintaining UI state during edits.

## Dependencies

- Ticket 01: HTML Structure (completed)
- Ticket 02: CSS Styling (completed)
- Ticket 03: Controller Setup (completed)
- Ticket 04: Create Concept (completed)
- Ticket 05: Display Concepts (completed)

## Implementation Details

### 1. Implement Show Edit Modal Method

In `CharacterConceptsManagerController`, implement the `#showEditModal` method:

```javascript
/**
 * Show edit modal for a concept
 * @param {string} conceptId
 */
async #showEditModal(conceptId) {
    this.#logger.info('Showing edit modal', { conceptId });

    try {
        // Find concept in cached data
        const conceptData = this.#conceptsData.find(
            ({ concept }) => concept.id === conceptId
        );

        if (!conceptData) {
            throw new Error(`Concept not found: ${conceptId}`);
        }

        const { concept } = conceptData;

        // Set editing state
        this.#editingConceptId = conceptId;

        // Update modal for editing
        this.#elements.conceptModalTitle.textContent = 'Edit Character Concept';
        this.#elements.saveConceptBtn.textContent = 'Update Concept';

        // Pre-populate form
        this.#elements.conceptText.value = concept.text;

        // Update character count
        this.#updateCharacterCount();

        // Validate form (should be valid since it's existing content)
        this.#validateConceptForm();

        // Show modal
        this.#elements.conceptModal.style.display = 'flex';

        // Focus and select text
        setTimeout(() => {
            this.#elements.conceptText.focus();
            this.#elements.conceptText.setSelectionRange(
                this.#elements.conceptText.value.length,
                this.#elements.conceptText.value.length
            );
        }, 100);

        // Track modal open
        this.#eventBus.dispatch({
            type: 'ui:modal-opened',
            payload: { modalType: 'edit-concept', conceptId }
        });

    } catch (error) {
        this.#logger.error('Failed to show edit modal', error);
        this.#showError('Failed to load concept for editing. Please try again.');
    }
}
```

### 2. Implement Update Concept Method

Add the method that calls the service to update:

```javascript
/**
 * Update an existing character concept
 * @param {string} conceptId - The concept ID
 * @param {string} conceptText - The updated concept text
 */
async #updateConcept(conceptId, conceptText) {
    this.#logger.info('Updating concept', { conceptId, length: conceptText.length });

    try {
        // Check if text actually changed
        const currentConcept = this.#conceptsData.find(
            ({ concept }) => concept.id === conceptId
        )?.concept;

        if (currentConcept && currentConcept.text === conceptText) {
            this.#logger.info('No changes detected, skipping update');
            return;
        }

        // Update via service
        const updatedConcept = await this.#characterBuilderService.updateCharacterConcept(
            conceptId,
            conceptText
        );

        this.#logger.info('Concept updated successfully', { id: updatedConcept.id });

        // Show success message
        this.#showSuccessNotification('Character concept updated successfully!');

        // Update local cache immediately for better UX
        this.#updateLocalConceptCache(updatedConcept);

        // The UI will also be updated via event listener

    } catch (error) {
        this.#logger.error('Failed to update concept', error);
        throw error;
    }
}
```

### 3. Add Local Cache Update Method

Implement immediate UI update for better UX:

```javascript
/**
 * Update local concept cache immediately
 * @param {Object} updatedConcept
 */
#updateLocalConceptCache(updatedConcept) {
    // Find and update in local data
    const index = this.#conceptsData.findIndex(
        ({ concept }) => concept.id === updatedConcept.id
    );

    if (index !== -1) {
        // Preserve direction count
        const directionCount = this.#conceptsData[index].directionCount;

        // Update concept
        this.#conceptsData[index] = {
            concept: updatedConcept,
            directionCount
        };

        // Update UI immediately
        this.#updateConceptCard(updatedConcept, directionCount);
    }
}

/**
 * Update a single concept card in the UI
 * @param {Object} concept
 * @param {number} directionCount
 */
#updateConceptCard(concept, directionCount) {
    // Find the card element
    const card = this.#elements.conceptsResults.querySelector(
        `[data-concept-id="${concept.id}"]`
    );

    if (!card) return;

    // Update card content
    const conceptTextElement = card.querySelector('.concept-text');
    if (conceptTextElement) {
        conceptTextElement.textContent = this.#truncateText(concept.text, 150);
    }

    // Update date if it changed
    const dateElement = card.querySelector('.concept-date');
    if (dateElement && concept.updatedAt) {
        dateElement.textContent = `Updated ${this.#formatRelativeDate(concept.updatedAt)}`;
        dateElement.title = this.#formatFullDate(concept.updatedAt);
    }

    // Add update animation
    card.classList.add('concept-updated');
    setTimeout(() => {
        card.classList.remove('concept-updated');
    }, 1000);
}
```

### 4. Enhance Form Save Handler for Edit Mode

Update the save handler to handle both create and edit properly:

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
    const isEditing = !!this.#editingConceptId;

    try {
        // Disable form during save
        this.#setFormEnabled(false);
        this.#setSaveButtonLoading(true);

        if (isEditing) {
            // Update existing concept
            await this.#updateConcept(this.#editingConceptId, conceptText);
        } else {
            // Create new concept
            await this.#createConcept(conceptText);
        }

        // Close modal on success
        this.#closeConceptModal();

        // Log success
        this.#logger.info(`Concept ${isEditing ? 'updated' : 'created'} successfully`);

    } catch (error) {
        this.#logger.error(`Failed to ${isEditing ? 'update' : 'create'} concept`, error);
        this.#showFormError(`Failed to ${isEditing ? 'update' : 'save'} concept. Please try again.`);
    } finally {
        // Re-enable form
        this.#setFormEnabled(true);
        this.#setSaveButtonLoading(false);
    }
}
```

### 5. Add Dirty State Tracking

Implement tracking for unsaved changes:

```javascript
// Add to class properties
#originalConceptText = '';
#hasUnsavedChanges = false;

/**
 * Track changes to form
 */
#trackFormChanges() {
    const currentText = this.#elements.conceptText.value.trim();
    this.#hasUnsavedChanges = currentText !== this.#originalConceptText;

    // Update save button state
    if (this.#hasUnsavedChanges) {
        this.#elements.saveConceptBtn.classList.add('has-changes');
    } else {
        this.#elements.saveConceptBtn.classList.remove('has-changes');
    }
}

// Update #showEditModal to store original text
async #showEditModal(conceptId) {
    // ... existing code ...

    // Store original text for comparison
    this.#originalConceptText = concept.text;
    this.#hasUnsavedChanges = false;

    // ... rest of method
}

// Update form input handler
#setupFormHandlers() {
    // ... existing code ...

    this.#elements.conceptText.addEventListener('input', () => {
        this.#updateCharacterCount();
        this.#validateConceptForm();
        this.#trackFormChanges(); // Add this
    });
}

// Add confirmation before closing with unsaved changes
#closeConceptModal() {
    // Check for unsaved changes
    if (this.#hasUnsavedChanges && this.#editingConceptId) {
        const confirmClose = confirm(
            'You have unsaved changes. Are you sure you want to close without saving?'
        );

        if (!confirmClose) {
            return;
        }
    }

    // ... existing close logic ...

    // Reset tracking
    this.#originalConceptText = '';
    this.#hasUnsavedChanges = false;
}
```

### 6. Add Keyboard Shortcut for Quick Edit

Implement keyboard shortcuts for quick editing:

```javascript
// In #attachCardEventHandlers, add keyboard support
#attachCardEventHandlers(card, concept, directionCount) {
    // ... existing code ...

    // Add keyboard support
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `Character concept: ${concept.text.substring(0, 50)}...`);

    card.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'Enter':
            case ' ':
                if (!e.target.closest('button')) {
                    e.preventDefault();
                    this.#viewConceptDetails(concept);
                }
                break;
            case 'e':
            case 'E':
                if (!e.target.closest('input, textarea')) {
                    e.preventDefault();
                    this.#showEditModal(concept.id);
                }
                break;
            case 'Delete':
                if (!e.target.closest('input, textarea')) {
                    e.preventDefault();
                    this.#showDeleteConfirmation(concept, directionCount);
                }
                break;
        }
    });
}
```

### 7. Add Optimistic UI Updates

Implement optimistic updates for better perceived performance:

```javascript
/**
 * Apply optimistic update to UI before server response
 * @param {string} conceptId
 * @param {string} newText
 */
#applyOptimisticUpdate(conceptId, newText) {
    // Update card immediately
    const card = this.#elements.conceptsResults.querySelector(
        `[data-concept-id="${conceptId}"]`
    );

    if (card) {
        const textElement = card.querySelector('.concept-text');
        if (textElement) {
            textElement.textContent = this.#truncateText(newText, 150);
            card.classList.add('concept-updating');
        }
    }
}

// Update #updateConcept to use optimistic updates
async #updateConcept(conceptId, conceptText) {
    // Apply optimistic update
    this.#applyOptimisticUpdate(conceptId, conceptText);

    try {
        // ... existing update logic ...

        // Remove updating class on success
        const card = this.#elements.conceptsResults.querySelector(
            `[data-concept-id="${conceptId}"]`
        );
        if (card) {
            card.classList.remove('concept-updating');
            card.classList.add('concept-updated');
        }

    } catch (error) {
        // Revert optimistic update on failure
        this.#revertOptimisticUpdate(conceptId);
        throw error;
    }
}

/**
 * Revert optimistic update on failure
 * @param {string} conceptId
 */
#revertOptimisticUpdate(conceptId) {
    // Find original concept
    const originalData = this.#conceptsData.find(
        ({ concept }) => concept.id === conceptId
    );

    if (originalData) {
        this.#updateConceptCard(originalData.concept, originalData.directionCount);
    }

    // Remove updating class
    const card = this.#elements.conceptsResults.querySelector(
        `[data-concept-id="${conceptId}"]`
    );
    if (card) {
        card.classList.remove('concept-updating');
        card.classList.add('concept-update-failed');
        setTimeout(() => {
            card.classList.remove('concept-update-failed');
        }, 2000);
    }
}
```

### 8. Add CSS Classes for Update States

Add these CSS classes to character-concepts-manager.css:

```css
/* Update animation states */
.concept-card.concept-updating {
  opacity: 0.7;
  position: relative;
}

.concept-card.concept-updating::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(139, 92, 246, 0.1) 50%,
    transparent 100%
  );
  animation: shimmer 1s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.concept-card.concept-updated {
  animation: pulse 0.5s ease-out;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1);
  }
}

.concept-card.concept-update-failed {
  animation: shake 0.5s ease-out;
  border-color: #e74c3c;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

/* Save button with changes */
.cb-button-primary.has-changes {
  background: var(--narrative-purple);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3);
}
```

### 9. Add Undo Functionality

Implement basic undo for the last edit:

```javascript
// Add to class properties
#lastEdit = null;

// Store edit before applying
async #updateConcept(conceptId, conceptText) {
    // Store last edit for undo
    const currentConcept = this.#conceptsData.find(
        ({ concept }) => concept.id === conceptId
    )?.concept;

    if (currentConcept) {
        this.#lastEdit = {
            conceptId,
            previousText: currentConcept.text,
            newText: conceptText,
            timestamp: Date.now()
        };
    }

    // ... rest of update logic ...
}

/**
 * Undo last edit if available
 */
async #undoLastEdit() {
    if (!this.#lastEdit || Date.now() - this.#lastEdit.timestamp > 30000) {
        // No recent edit to undo (30 second window)
        return;
    }

    try {
        await this.#updateConcept(
            this.#lastEdit.conceptId,
            this.#lastEdit.previousText
        );

        this.#showSuccessNotification('Edit undone');
        this.#lastEdit = null;

    } catch (error) {
        this.#logger.error('Failed to undo edit', error);
        this.#showError('Failed to undo edit');
    }
}

// Add keyboard shortcut for undo (Ctrl+Z when not in form)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' &&
        !e.target.closest('input, textarea')) {
        e.preventDefault();
        this.#undoLastEdit();
    }
});
```

## Acceptance Criteria

1. ✅ Edit button opens modal with existing concept text
2. ✅ Modal title shows "Edit Character Concept"
3. ✅ Save button shows "Update Concept"
4. ✅ Form is pre-populated with current concept text
5. ✅ Character count updates correctly
6. ✅ Changes are saved via CharacterBuilderService
7. ✅ UI updates immediately with optimistic updates
8. ✅ Unsaved changes are tracked and warned about
9. ✅ Keyboard shortcuts work (E for edit)
10. ✅ Update animations provide visual feedback
11. ✅ Failed updates revert optimistic changes
12. ✅ Basic undo functionality works

## Testing Requirements

1. Test editing with various concept lengths
2. Test unsaved changes warning
3. Test optimistic updates and rollback
4. Test keyboard shortcuts
5. Test concurrent edits handling
6. Test edit with no changes (should skip update)
7. Test undo functionality
8. Test animation states

## Notes

- Maintain consistency with create functionality
- Ensure proper error handling and rollback
- Consider implementing conflict resolution for concurrent edits
- Test with slow network to verify optimistic updates
- The service will dispatch events that also update the UI
