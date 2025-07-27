# Ticket 05: Display and List Concepts

## Overview

Implement the functionality to load, display, and render character concepts in a grid layout, including handling empty, loading, and error states.

## Dependencies

- Ticket 01: HTML Structure (completed)
- Ticket 02: CSS Styling (completed)
- Ticket 03: Controller Setup (completed)
- Ticket 04: Create Concept (should be completed)

## Implementation Details

### 1. Implement Load Concepts Data Method

In `CharacterConceptsManagerController`, implement the `#loadConceptsData` method:

```javascript
/**
 * Load all character concepts with their direction counts
 */
async #loadConceptsData() {
    this.#logger.info('Loading character concepts data');

    try {
        // Show loading state
        this.#uiStateManager.setState('loading');

        // Get all concepts
        const concepts = await this.#characterBuilderService.getAllCharacterConcepts();

        // Get direction counts for each concept
        const conceptsWithCounts = await Promise.all(
            concepts.map(async (concept) => {
                try {
                    const directions = await this.#characterBuilderService
                        .getThematicDirectionsByConceptId(concept.id);

                    return {
                        concept,
                        directionCount: directions.length
                    };
                } catch (error) {
                    this.#logger.error(`Failed to get directions for concept ${concept.id}`, error);
                    // Return concept with 0 directions on error
                    return {
                        concept,
                        directionCount: 0
                    };
                }
            })
        );

        // Store data
        this.#conceptsData = conceptsWithCounts;

        // Apply current filter if any
        const filteredConcepts = this.#filterConcepts(conceptsWithCounts);

        // Display concepts
        this.#displayConcepts(filteredConcepts);

        // Update statistics
        this.#updateStatistics();

        this.#logger.info(`Loaded ${concepts.length} concepts`);

    } catch (error) {
        this.#logger.error('Failed to load concepts', error);
        this.#showError('Failed to load character concepts. Please try again.');
    }
}
```

### 2. Implement Display Concepts Method

Add the method to render concepts in the grid:

```javascript
/**
 * Display concepts in the UI
 * @param {Array<{concept: Object, directionCount: number}>} conceptsWithCounts
 */
#displayConcepts(conceptsWithCounts) {
    // Clear existing content
    this.#elements.conceptsResults.innerHTML = '';

    if (conceptsWithCounts.length === 0) {
        // Show empty state
        this.#uiStateManager.setState('empty');
        return;
    }

    // Show results state
    this.#uiStateManager.setState('results');

    // Create document fragment for performance
    const fragment = document.createDocumentFragment();

    // Create cards for each concept
    conceptsWithCounts.forEach(({ concept, directionCount }, index) => {
        const card = this.#createConceptCard(concept, directionCount, index);
        fragment.appendChild(card);
    });

    // Append all cards at once
    this.#elements.conceptsResults.appendChild(fragment);

    // Add entrance animation class
    requestAnimationFrame(() => {
        this.#elements.conceptsResults.classList.add('cards-loaded');
    });
}
```

### 3. Implement Create Concept Card Method

Create the method to build individual concept cards:

```javascript
/**
 * Create a concept card element
 * @param {Object} concept - The concept data
 * @param {number} directionCount - Number of thematic directions
 * @param {number} index - Card index for animation delay
 * @returns {HTMLElement}
 */
#createConceptCard(concept, directionCount, index) {
    const card = document.createElement('div');
    card.className = 'concept-card';
    card.dataset.conceptId = concept.id;
    card.style.animationDelay = `${index * 0.05}s`;

    // Determine status
    const status = directionCount > 0 ? 'completed' : 'draft';

    // Create card HTML
    card.innerHTML = `
        <div class="concept-card-header">
            <span class="concept-status ${status}">
                ${status === 'completed' ? 'Has Directions' : 'No Directions'}
            </span>
            <button type="button" class="concept-menu-btn" aria-label="More options">
                ⋮
            </button>
        </div>
        <div class="concept-card-content">
            <p class="concept-text">${this.#escapeHtml(this.#truncateText(concept.text, 150))}</p>
            <div class="concept-meta">
                <span class="direction-count">
                    <strong>${directionCount}</strong> thematic ${directionCount === 1 ? 'direction' : 'directions'}
                </span>
                <span class="concept-date" title="${this.#formatFullDate(concept.createdAt)}">
                    Created ${this.#formatRelativeDate(concept.createdAt)}
                </span>
            </div>
        </div>
        <div class="concept-card-actions">
            <button type="button" class="edit-btn" aria-label="Edit concept" data-action="edit">
                ✏️ Edit
            </button>
            <button type="button" class="delete-btn" aria-label="Delete concept" data-action="delete">
                🗑️ Delete
            </button>
            <button type="button" class="view-directions-btn"
                    aria-label="View thematic directions" data-action="view-directions"
                    ${directionCount === 0 ? 'disabled' : ''}>
                📋 Directions
            </button>
        </div>
    `;

    // Add click handlers
    this.#attachCardEventHandlers(card, concept, directionCount);

    return card;
}
```

### 4. Add Card Event Handlers

Implement event handling for concept cards:

```javascript
/**
 * Attach event handlers to a concept card
 * @param {HTMLElement} card
 * @param {Object} concept
 * @param {number} directionCount
 */
#attachCardEventHandlers(card, concept, directionCount) {
    // Card click (excluding buttons)
    card.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons
        if (e.target.closest('button')) return;

        // View concept details (could open edit modal in read-only mode)
        this.#viewConceptDetails(concept);
    });

    // Button click handlers
    const buttons = card.querySelectorAll('[data-action]');
    buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = button.dataset.action;

            switch (action) {
                case 'edit':
                    this.#showEditModal(concept.id);
                    break;
                case 'delete':
                    this.#showDeleteConfirmation(concept, directionCount);
                    break;
                case 'view-directions':
                    this.#viewThematicDirections(concept.id);
                    break;
            }
        });
    });

    // Menu button (for future expansion)
    const menuBtn = card.querySelector('.concept-menu-btn');
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#showConceptMenu(concept, e.currentTarget);
    });
}
```

### 5. Implement Filter Concepts Method

Add filtering capability:

```javascript
/**
 * Filter concepts based on search term
 * @param {Array<{concept: Object, directionCount: number}>} concepts
 * @returns {Array<{concept: Object, directionCount: number}>}
 */
#filterConcepts(concepts) {
    if (!this.#searchFilter) {
        return concepts;
    }

    const searchLower = this.#searchFilter.toLowerCase();

    return concepts.filter(({ concept }) => {
        return concept.text.toLowerCase().includes(searchLower);
    });
}
```

### 6. Implement Update Statistics Method

Add the method to update statistics display:

```javascript
/**
 * Update statistics display
 */
#updateStatistics() {
    const totalConcepts = this.#conceptsData.length;
    const conceptsWithDirections = this.#conceptsData.filter(
        ({ directionCount }) => directionCount > 0
    ).length;
    const totalDirections = this.#conceptsData.reduce(
        (sum, { directionCount }) => sum + directionCount, 0
    );

    // Update UI
    this.#elements.totalConcepts.textContent = totalConcepts;
    this.#elements.conceptsWithDirections.textContent = conceptsWithDirections;
    this.#elements.totalDirections.textContent = totalDirections;

    // Log statistics
    this.#logger.info('Statistics updated', {
        totalConcepts,
        conceptsWithDirections,
        totalDirections
    });
}
```

### 7. Add Utility Methods

Implement helper methods for formatting and text handling:

```javascript
/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
#escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Truncate text with ellipsis
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
#truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;

    // Try to break at word boundary
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
        return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
}

/**
 * Format date as relative time
 * @param {Date|string} date
 * @returns {string}
 */
#formatRelativeDate(date) {
    const dateObj = new Date(date);
    const now = new Date();
    const diffMs = now - dateObj;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    // Fall back to date
    return dateObj.toLocaleDateString();
}

/**
 * Format full date for tooltip
 * @param {Date|string} date
 * @returns {string}
 */
#formatFullDate(date) {
    return new Date(date).toLocaleString();
}
```

### 8. Add Placeholder Methods for Card Actions

Add placeholder methods for card actions (to be implemented in later tickets):

```javascript
/**
 * View concept details
 * @param {Object} concept
 */
#viewConceptDetails(concept) {
    this.#logger.info('Viewing concept details', { id: concept.id });
    // Could show read-only modal or expand card
    // For now, just show edit modal in read-only mode
    this.#showEditModal(concept.id);
}

/**
 * Show edit modal for a concept
 * @param {string} conceptId
 */
#showEditModal(conceptId) {
    this.#logger.info('Showing edit modal', { conceptId });
    // Implementation in Ticket 06
}

/**
 * Show delete confirmation
 * @param {Object} concept
 * @param {number} directionCount
 */
#showDeleteConfirmation(concept, directionCount) {
    this.#logger.info('Showing delete confirmation', { conceptId: concept.id, directionCount });
    // Implementation in Ticket 07
}

/**
 * View thematic directions for a concept
 * @param {string} conceptId
 */
#viewThematicDirections(conceptId) {
    this.#logger.info('Viewing thematic directions', { conceptId });
    // Navigate to thematic directions manager with filter
    window.location.href = `thematic-directions-manager.html?conceptId=${conceptId}`;
}

/**
 * Show concept context menu
 * @param {Object} concept
 * @param {HTMLElement} button
 */
#showConceptMenu(concept, button) {
    this.#logger.info('Showing concept menu', { conceptId: concept.id });
    // Future: show dropdown menu with additional options
}
```

### 9. Implement Refresh After Operations

Add a method to refresh the display after create/update/delete:

```javascript
/**
 * Refresh the concepts display
 * @param {boolean} maintainScroll - Whether to maintain scroll position
 */
async #refreshConceptsDisplay(maintainScroll = true) {
    // Save scroll position
    const scrollTop = maintainScroll ? this.#elements.conceptsResults.scrollTop : 0;

    // Reload data
    await this.#loadConceptsData();

    // Restore scroll position
    if (maintainScroll && scrollTop > 0) {
        this.#elements.conceptsResults.scrollTop = scrollTop;
    }
}
```

### 10. Add Empty State Enhancements

Enhance the empty state handling:

```javascript
/**
 * Show appropriate empty state based on context
 */
#showEmptyState() {
    const hasSearchFilter = this.#searchFilter.length > 0;

    if (hasSearchFilter) {
        // No search results
        this.#elements.emptyState.innerHTML = `
            <p>No concepts match your search.</p>
            <p>Try adjusting your search terms.</p>
            <button type="button" class="cb-button-secondary" id="clear-search-btn">
                Clear Search
            </button>
        `;

        // Add clear search handler
        const clearBtn = document.getElementById('clear-search-btn');
        clearBtn?.addEventListener('click', () => {
            this.#elements.conceptSearch.value = '';
            this.#searchFilter = '';
            this.#displayConcepts(this.#conceptsData);
        });
    } else {
        // No concepts at all
        this.#elements.emptyState.innerHTML = `
            <p>No character concepts yet.</p>
            <p>Create your first concept to get started.</p>
            <button type="button" class="cb-button-primary" id="create-first-btn">
                ➕ Create First Concept
            </button>
        `;

        // Re-attach event listener
        const createBtn = document.getElementById('create-first-btn');
        createBtn?.addEventListener('click', () => this.#showCreateModal());
    }

    this.#uiStateManager.setState('empty');
}
```

## Acceptance Criteria

1. ✅ Concepts load from CharacterBuilderService on page init
2. ✅ Loading state displays during data fetch
3. ✅ Concept cards display in responsive grid
4. ✅ Each card shows concept text (truncated), status, and direction count
5. ✅ Relative dates display correctly
6. ✅ Empty state shows when no concepts exist
7. ✅ Error state shows on load failure
8. ✅ Statistics update correctly
9. ✅ Cards have entrance animation
10. ✅ Action buttons work on each card
11. ✅ Click handlers properly attached
12. ✅ Direction counts load for each concept

## Testing Requirements

1. Test loading with various numbers of concepts (0, 1, many)
2. Test error handling when service fails
3. Test card rendering with long concept text
4. Test relative date formatting
5. Test statistics calculation
6. Test empty state display
7. Test card action buttons
8. Verify no memory leaks from event handlers

## Notes

- Use document fragments for performance with many cards
- Properly escape HTML to prevent XSS
- Consider virtual scrolling for very large lists (future enhancement)
- Ensure cards are keyboard navigable
- Test with screen readers for accessibility
