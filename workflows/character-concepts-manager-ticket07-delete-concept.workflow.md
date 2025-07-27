# Ticket 07: Delete Concept with Cascade

## Overview

Implement the delete concept functionality with confirmation modal, cascade deletion of associated thematic directions, and proper UI updates after deletion.

## Dependencies

- Ticket 01: HTML Structure (completed)
- Ticket 02: CSS Styling (completed)
- Ticket 03: Controller Setup (completed)
- Ticket 05: Display Concepts (completed)

## Implementation Details

### 1. Implement Show Delete Confirmation Method

In `CharacterConceptsManagerController`, implement the `#showDeleteConfirmation` method:

```javascript
/**
 * Show delete confirmation modal
 * @param {Object} concept - The concept to delete
 * @param {number} directionCount - Number of associated directions
 */
#showDeleteConfirmation(concept, directionCount) {
    this.#logger.info('Showing delete confirmation', {
        conceptId: concept.id,
        directionCount
    });

    // Store concept data for deletion
    this.#conceptToDelete = { concept, directionCount };

    // Build confirmation message
    let message = `Are you sure you want to delete this character concept?`;

    // Add concept preview
    const truncatedText = this.#truncateText(concept.text, 100);
    message += `\n\n"${this.#escapeHtml(truncatedText)}"`;

    // Add warning about thematic directions
    if (directionCount > 0) {
        message += `\n\n⚠️ <strong>Warning:</strong> This will also delete `;
        message += `<strong>${directionCount}</strong> associated thematic `;
        message += `${directionCount === 1 ? 'direction' : 'directions'}.`;
        message += `\n\nThis action cannot be undone.`;
    }

    // Update modal content
    this.#elements.deleteModalMessage.innerHTML = message.replace(/\n/g, '<br>');

    // Update delete button based on severity
    if (directionCount > 0) {
        this.#elements.confirmDeleteBtn.textContent = `Delete Concept & ${directionCount} Direction${directionCount === 1 ? '' : 's'}`;
        this.#elements.confirmDeleteBtn.classList.add('severe-action');
    } else {
        this.#elements.confirmDeleteBtn.textContent = 'Delete Concept';
        this.#elements.confirmDeleteBtn.classList.remove('severe-action');
    }

    // Show modal
    this.#elements.deleteModal.style.display = 'flex';

    // Focus on cancel button (safer default)
    setTimeout(() => {
        this.#elements.cancelDeleteBtn.focus();
    }, 100);

    // Set up delete handler
    this.#setupDeleteHandler();
}
```

### 2. Implement Delete Handler Setup

Add method to set up the delete confirmation handler:

```javascript
/**
 * Set up delete confirmation handler
 */
#setupDeleteHandler() {
    // Remove any existing handler
    if (this.#deleteHandler) {
        this.#elements.confirmDeleteBtn.removeEventListener('click', this.#deleteHandler);
    }

    // Create new handler
    this.#deleteHandler = async () => {
        if (!this.#conceptToDelete) return;

        const { concept, directionCount } = this.#conceptToDelete;

        try {
            // Disable buttons during deletion
            this.#setDeleteModalEnabled(false);
            this.#elements.confirmDeleteBtn.textContent = 'Deleting...';

            // Perform deletion
            await this.#deleteConcept(concept.id, directionCount);

            // Close modal on success
            this.#closeDeleteModal();

        } catch (error) {
            this.#logger.error('Failed to delete concept', error);
            this.#showDeleteError('Failed to delete concept. Please try again.');
        } finally {
            // Re-enable buttons
            this.#setDeleteModalEnabled(true);
        }
    };

    // Attach handler
    this.#elements.confirmDeleteBtn.addEventListener('click', this.#deleteHandler);
}
```

### 3. Implement Delete Concept Method

Add the actual deletion method:

```javascript
/**
 * Delete a character concept and its thematic directions
 * @param {string} conceptId - The concept ID to delete
 * @param {number} directionCount - Number of directions (for logging)
 */
async #deleteConcept(conceptId, directionCount) {
    this.#logger.info('Deleting concept', { conceptId, directionCount });

    try {
        // Apply optimistic UI update
        this.#applyOptimisticDelete(conceptId);

        // Delete via service (handles cascade deletion)
        await this.#characterBuilderService.deleteCharacterConcept(conceptId);

        this.#logger.info('Concept deleted successfully', {
            conceptId,
            cascadedDirections: directionCount
        });

        // Show success notification
        let successMessage = 'Character concept deleted successfully';
        if (directionCount > 0) {
            successMessage += ` (${directionCount} direction${directionCount === 1 ? '' : 's'} also deleted)`;
        }
        this.#showSuccessNotification(successMessage);

        // Remove from local cache
        this.#removeFromLocalCache(conceptId);

        // Update statistics
        this.#updateStatistics();

        // Check if we need to show empty state
        if (this.#conceptsData.length === 0) {
            this.#uiStateManager.setState('empty');
        }

    } catch (error) {
        // Revert optimistic delete on failure
        this.#revertOptimisticDelete();
        this.#logger.error('Failed to delete concept', error);
        throw error;
    }
}
```

### 4. Implement Close Delete Modal Method

Add method to close the delete modal:

```javascript
/**
 * Close the delete confirmation modal
 */
#closeDeleteModal() {
    this.#logger.info('Closing delete modal');

    // Hide modal
    this.#elements.deleteModal.style.display = 'none';

    // Clean up
    this.#conceptToDelete = null;

    // Remove handler
    if (this.#deleteHandler) {
        this.#elements.confirmDeleteBtn.removeEventListener('click', this.#deleteHandler);
        this.#deleteHandler = null;
    }

    // Reset button text
    this.#elements.confirmDeleteBtn.textContent = 'Delete';
    this.#elements.confirmDeleteBtn.classList.remove('severe-action');

    // Dispatch modal closed event
    this.#eventBus.dispatch({
        type: 'ui:modal-closed',
        payload: { modalType: 'delete-confirmation' }
    });
}
```

### 5. Implement Optimistic Delete UI Updates

Add methods for optimistic UI updates:

```javascript
/**
 * Apply optimistic delete to UI
 * @param {string} conceptId
 */
#applyOptimisticDelete(conceptId) {
    const card = this.#elements.conceptsResults.querySelector(
        `[data-concept-id="${conceptId}"]`
    );

    if (card) {
        // Store for potential revert
        this.#deletedCard = {
            element: card,
            nextSibling: card.nextSibling,
            parent: card.parentElement
        };

        // Add deletion animation
        card.classList.add('concept-deleting');

        // Remove after animation
        setTimeout(() => {
            if (card.parentElement) {
                card.remove();
            }
        }, 300);
    }
}

/**
 * Revert optimistic delete on failure
 */
#revertOptimisticDelete() {
    if (this.#deletedCard) {
        const { element, nextSibling, parent } = this.#deletedCard;

        // Remove deleting class
        element.classList.remove('concept-deleting');
        element.classList.add('concept-delete-failed');

        // Re-insert if removed
        if (!element.parentElement && parent) {
            if (nextSibling && nextSibling.parentElement === parent) {
                parent.insertBefore(element, nextSibling);
            } else {
                parent.appendChild(element);
            }
        }

        // Clean up after animation
        setTimeout(() => {
            element.classList.remove('concept-delete-failed');
        }, 2000);

        this.#deletedCard = null;
    }
}

/**
 * Remove concept from local cache
 * @param {string} conceptId
 */
#removeFromLocalCache(conceptId) {
    const index = this.#conceptsData.findIndex(
        ({ concept }) => concept.id === conceptId
    );

    if (index !== -1) {
        this.#conceptsData.splice(index, 1);
        this.#logger.info('Removed concept from local cache', { conceptId });
    }
}
```

### 6. Add Delete Modal Helper Methods

Add utility methods for the delete modal:

```javascript
/**
 * Enable or disable delete modal buttons
 * @param {boolean} enabled
 */
#setDeleteModalEnabled(enabled) {
    this.#elements.confirmDeleteBtn.disabled = !enabled;
    this.#elements.cancelDeleteBtn.disabled = !enabled;
    this.#elements.closeDeleteModal.disabled = !enabled;
}

/**
 * Show error in delete modal
 * @param {string} message
 */
#showDeleteError(message) {
    // Create or update error element
    let errorElement = this.#elements.deleteModal.querySelector('.delete-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'delete-error error-message';
        this.#elements.deleteModalMessage.parentElement.appendChild(errorElement);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Hide after 5 seconds
    setTimeout(() => {
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }, 5000);
}
```

### 7. Add Delete Animation CSS

Add these CSS classes to character-concepts-manager.css:

```css
/* Delete animations */
.concept-card.concept-deleting {
  animation: fadeOutScale 0.3s ease-out forwards;
}

@keyframes fadeOutScale {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.9);
  }
}

.concept-card.concept-delete-failed {
  animation: shake 0.5s ease-out;
  border-color: #e74c3c;
  background-color: rgba(231, 76, 60, 0.05);
}

/* Severe action button */
.cb-button-danger.severe-action {
  background: #c0392b;
  animation: pulse-danger 2s infinite;
}

@keyframes pulse-danger {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(231, 76, 60, 0);
  }
}

/* Delete error message */
.delete-error {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid #e74c3c;
  border-radius: 8px;
  color: #c0392b;
  font-size: 0.875rem;
}
```

### 8. Add Batch Delete Support (Future Enhancement)

Add placeholder for batch delete functionality:

```javascript
// Add to class properties
#selectedConcepts = new Set();

/**
 * Toggle concept selection for batch operations
 * @param {string} conceptId
 */
#toggleConceptSelection(conceptId) {
    if (this.#selectedConcepts.has(conceptId)) {
        this.#selectedConcepts.delete(conceptId);
    } else {
        this.#selectedConcepts.add(conceptId);
    }

    // Update UI
    this.#updateSelectionUI();
}

/**
 * Delete selected concepts
 */
async #deleteSelectedConcepts() {
    if (this.#selectedConcepts.size === 0) return;

    const count = this.#selectedConcepts.size;
    const confirmMessage = `Delete ${count} selected concept${count === 1 ? '' : 's'}?`;

    if (!confirm(confirmMessage)) return;

    // Delete each concept
    const deletionPromises = Array.from(this.#selectedConcepts).map(conceptId => {
        const conceptData = this.#conceptsData.find(
            ({ concept }) => concept.id === conceptId
        );
        if (conceptData) {
            return this.#deleteConcept(conceptId, conceptData.directionCount);
        }
    });

    try {
        await Promise.all(deletionPromises);
        this.#selectedConcepts.clear();
        this.#updateSelectionUI();
    } catch (error) {
        this.#logger.error('Failed to delete some concepts', error);
        this.#showError('Failed to delete some concepts. Please try again.');
    }
}
```

### 9. Handle Delete Event from Service

Update the event handler for concept deletion:

```javascript
/**
 * Handle concept deleted event
 * @param {CustomEvent} event
 */
#handleConceptDeleted(event) {
    this.#logger.info('Concept deleted event received', event.detail);

    const { conceptId, cascadedDirections } = event.detail;

    // Remove from local cache if not already removed
    this.#removeFromLocalCache(conceptId);

    // Remove card from UI if still present
    const card = this.#elements.conceptsResults.querySelector(
        `[data-concept-id="${conceptId}"]`
    );
    if (card) {
        card.remove();
    }

    // Update statistics
    this.#updateStatistics();

    // Check if empty
    if (this.#conceptsData.length === 0) {
        this.#uiStateManager.setState('empty');
    }
}
```

### 10. Add Undo Delete (Soft Delete) Support

For future enhancement, add soft delete support:

```javascript
// Add to class properties
#recentlyDeleted = [];

/**
 * Store deleted concept for potential undo
 * @param {Object} conceptData
 */
#storeDeletedConcept(conceptData) {
    this.#recentlyDeleted.unshift({
        ...conceptData,
        deletedAt: Date.now()
    });

    // Keep only last 5 deleted concepts
    if (this.#recentlyDeleted.length > 5) {
        this.#recentlyDeleted.pop();
    }

    // Remove after 5 minutes
    setTimeout(() => {
        this.#recentlyDeleted = this.#recentlyDeleted.filter(
            item => Date.now() - item.deletedAt < 300000
        );
    }, 300000);
}

/**
 * Show undo delete option
 */
#showUndoDeleteOption() {
    // This would show a snackbar or toast with undo option
    // Implementation depends on notification system
}
```

## Acceptance Criteria

1. ✅ Delete button shows confirmation modal
2. ✅ Modal displays concept preview and direction count warning
3. ✅ Delete button text reflects severity (with direction count)
4. ✅ Concept is deleted via CharacterBuilderService
5. ✅ Associated thematic directions are cascade deleted
6. ✅ UI updates immediately with deletion animation
7. ✅ Statistics update after deletion
8. ✅ Empty state shows when last concept deleted
9. ✅ Error handling shows user-friendly messages
10. ✅ Cancel button is focused by default (safer)
11. ✅ Modal can be closed with Escape key
12. ✅ Optimistic updates with rollback on failure

## Testing Requirements

1. Test deletion with and without thematic directions
2. Test cascade deletion actually removes directions
3. Test deletion animation
4. Test error handling and rollback
5. Test modal cancel behavior
6. Test statistics update after deletion
7. Test empty state display
8. Test keyboard navigation in modal

## Notes

- Ensure cascade deletion is properly handled by the service
- Consider implementing soft delete for undo functionality
- Test with concepts that have many thematic directions
- Ensure proper cleanup of event handlers
- The service should dispatch deletion events
