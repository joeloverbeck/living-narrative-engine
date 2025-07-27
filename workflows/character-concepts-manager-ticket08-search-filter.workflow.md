# Ticket 08: Search and Filter Implementation

## Overview

Implement real-time search functionality with debouncing, caching for performance, and dynamic display updates based on search terms.

## Dependencies

- Ticket 03: Controller Setup (completed)
- Ticket 05: Display Concepts (completed)

## Implementation Details

### 1. Implement Handle Search Method

In `CharacterConceptsManagerController`, implement the `#handleSearch` method:

```javascript
/**
 * Handle search input changes
 * @param {string} searchTerm
 */
#handleSearch(searchTerm) {
    this.#logger.info('Handling search', { searchTerm, length: searchTerm.length });

    // Update search filter
    this.#searchFilter = searchTerm.trim().toLowerCase();

    // Filter concepts
    const filteredConcepts = this.#filterConcepts(this.#conceptsData);

    // Update display
    this.#displayFilteredConcepts(filteredConcepts);

    // Update search state UI
    this.#updateSearchState(searchTerm, filteredConcepts.length);

    // Track search usage
    if (searchTerm.length > 0) {
        this.#eventBus.dispatch({
            type: 'ui:search-performed',
            payload: {
                searchTerm,
                resultCount: filteredConcepts.length,
                totalConcepts: this.#conceptsData.length
            }
        });
    }
}
```

### 2. Enhance Filter Concepts Method

Update the filter method with more sophisticated matching:

```javascript
/**
 * Filter concepts based on search term
 * @param {Array<{concept: Object, directionCount: number}>} concepts
 * @returns {Array<{concept: Object, directionCount: number}>}
 */
#filterConcepts(concepts) {
    if (!this.#searchFilter || this.#searchFilter.length === 0) {
        return concepts;
    }

    const searchTerms = this.#searchFilter.split(/\s+/).filter(term => term.length > 0);

    return concepts.filter(({ concept }) => {
        const conceptTextLower = concept.text.toLowerCase();

        // Check if all search terms are found
        return searchTerms.every(term => {
            // Direct substring match
            if (conceptTextLower.includes(term)) {
                return true;
            }

            // Fuzzy match for typos (simple implementation)
            if (this.#fuzzyMatch(conceptTextLower, term)) {
                return true;
            }

            return false;
        });
    });
}

/**
 * Simple fuzzy matching for typo tolerance
 * @param {string} text
 * @param {string} searchTerm
 * @returns {boolean}
 */
#fuzzyMatch(text, searchTerm) {
    // Only apply fuzzy matching for terms longer than 3 characters
    if (searchTerm.length <= 3) {
        return false;
    }

    // Check if text contains all characters of search term in order
    let searchIndex = 0;
    for (let i = 0; i < text.length && searchIndex < searchTerm.length; i++) {
        if (text[i] === searchTerm[searchIndex]) {
            searchIndex++;
        }
    }

    return searchIndex === searchTerm.length;
}
```

### 3. Implement Display Filtered Concepts

Add method to display filtered results with appropriate messaging:

```javascript
/**
 * Display filtered concepts with appropriate state
 * @param {Array<{concept: Object, directionCount: number}>} filteredConcepts
 */
#displayFilteredConcepts(filteredConcepts) {
    if (filteredConcepts.length === 0 && this.#searchFilter) {
        // Show no results state
        this.#showNoSearchResults();
    } else {
        // Display the filtered concepts
        this.#displayConcepts(filteredConcepts);
    }
}

/**
 * Show no search results state
 */
#showNoSearchResults() {
    // Clear results
    this.#elements.conceptsResults.innerHTML = '';

    // Create custom empty state for search
    const noResultsDiv = document.createElement('div');
    noResultsDiv.className = 'no-search-results';
    noResultsDiv.innerHTML = `
        <div class="no-results-icon">🔍</div>
        <p class="no-results-title">No concepts match your search</p>
        <p class="no-results-message">
            No concepts found for "<strong>${this.#escapeHtml(this.#searchFilter)}</strong>"
        </p>
        <div class="search-suggestions">
            <p>Try:</p>
            <ul>
                <li>Using different keywords</li>
                <li>Checking for typos</li>
                <li>Using more general terms</li>
            </ul>
        </div>
        <button type="button" class="cb-button-secondary" id="clear-search-btn">
            Clear Search
        </button>
    `;

    // Add clear button handler
    const clearBtn = noResultsDiv.querySelector('#clear-search-btn');
    clearBtn.addEventListener('click', () => {
        this.#clearSearch();
    });

    // Show results state with custom content
    this.#uiStateManager.setState('results');
    this.#elements.conceptsResults.appendChild(noResultsDiv);
}
```

### 4. Add Search State UI Updates

Implement visual feedback for search state:

```javascript
/**
 * Update search-related UI elements
 * @param {string} searchTerm
 * @param {number} resultCount
 */
#updateSearchState(searchTerm, resultCount) {
    const hasSearch = searchTerm.length > 0;

    // Add search active class to container
    if (hasSearch) {
        this.#elements.conceptsContainer.classList.add('search-active');
    } else {
        this.#elements.conceptsContainer.classList.remove('search-active');
    }

    // Update or create search status element
    this.#updateSearchStatus(searchTerm, resultCount);

    // Update clear button visibility
    this.#updateClearButton(hasSearch);
}

/**
 * Update search status display
 * @param {string} searchTerm
 * @param {number} resultCount
 */
#updateSearchStatus(searchTerm, resultCount) {
    if (!searchTerm) {
        // Remove status if no search
        const existingStatus = document.querySelector('.search-status');
        if (existingStatus) {
            existingStatus.remove();
        }
        return;
    }

    // Find or create status element
    let statusElement = document.querySelector('.search-status');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.className = 'search-status';
        // Insert after panel title
        const panelTitle = this.#elements.conceptsResults.parentElement.querySelector('.cb-panel-title');
        if (panelTitle) {
            panelTitle.insertAdjacentElement('afterend', statusElement);
        }
    }

    // Update status content
    const totalCount = this.#conceptsData.length;
    statusElement.innerHTML = `
        <span class="search-status-text">
            Showing <strong>${resultCount}</strong> of <strong>${totalCount}</strong> concepts
            matching "<strong>${this.#escapeHtml(searchTerm)}</strong>"
        </span>
        <button type="button" class="clear-search-inline" aria-label="Clear search">
            ✕
        </button>
    `;

    // Add clear handler
    const clearBtn = statusElement.querySelector('.clear-search-inline');
    clearBtn.addEventListener('click', () => this.#clearSearch());
}
```

### 5. Implement Clear Search Functionality

Add methods to clear search:

```javascript
/**
 * Clear search and show all concepts
 */
#clearSearch() {
    this.#logger.info('Clearing search');

    // Clear input
    this.#elements.conceptSearch.value = '';
    this.#searchFilter = '';

    // Display all concepts
    this.#displayConcepts(this.#conceptsData);

    // Update UI state
    this.#updateSearchState('', this.#conceptsData.length);

    // Focus back to search input
    this.#elements.conceptSearch.focus();
}

/**
 * Update clear button visibility
 * @param {boolean} visible
 */
#updateClearButton(visible) {
    // Find or create clear button
    let clearButton = this.#elements.conceptSearch.parentElement.querySelector('.search-clear-btn');

    if (visible && !clearButton) {
        // Create clear button
        clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'search-clear-btn';
        clearButton.innerHTML = '✕';
        clearButton.setAttribute('aria-label', 'Clear search');

        // Insert after search input
        this.#elements.conceptSearch.parentElement.style.position = 'relative';
        this.#elements.conceptSearch.parentElement.appendChild(clearButton);

        // Add handler
        clearButton.addEventListener('click', () => this.#clearSearch());
    } else if (!visible && clearButton) {
        // Remove clear button
        clearButton.remove();
    }
}
```

### 6. Add Search Highlighting

Implement highlighting of search terms in results:

```javascript
/**
 * Highlight search terms in text
 * @param {string} text
 * @param {string} searchTerm
 * @returns {string} HTML with highlighted terms
 */
#highlightSearchTerms(text, searchTerm) {
    if (!searchTerm || searchTerm.length === 0) {
        return this.#escapeHtml(text);
    }

    const searchTerms = searchTerm.split(/\s+/).filter(term => term.length > 0);
    let highlightedText = this.#escapeHtml(text);

    // Highlight each search term
    searchTerms.forEach(term => {
        const regex = new RegExp(`(${this.#escapeRegex(term)})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });

    return highlightedText;
}

/**
 * Escape special regex characters
 * @param {string} string
 * @returns {string}
 */
#escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Update #createConceptCard to use highlighting when searching
#createConceptCard(concept, directionCount, index) {
    // ... existing code ...

    // Use highlighted text when searching
    const displayText = this.#searchFilter
        ? this.#highlightSearchTerms(this.#truncateText(concept.text, 150), this.#searchFilter)
        : this.#escapeHtml(this.#truncateText(concept.text, 150));

    // Update the innerHTML to use displayText instead of escaped text
    // ... rest of card creation ...
}
```

### 7. Add Search Persistence

Store and restore search state:

```javascript
/**
 * Save search state to session storage
 */
#saveSearchState() {
    if (this.#searchFilter) {
        sessionStorage.setItem('conceptsManagerSearch', this.#searchFilter);
    } else {
        sessionStorage.removeItem('conceptsManagerSearch');
    }
}

/**
 * Restore search state from session storage
 */
#restoreSearchState() {
    const savedSearch = sessionStorage.getItem('conceptsManagerSearch');
    if (savedSearch) {
        this.#elements.conceptSearch.value = savedSearch;
        this.#searchFilter = savedSearch.toLowerCase();

        // Apply search after concepts load
        this.#searchStateRestored = true;
    }
}

// Update #loadConceptsData to apply restored search
async #loadConceptsData() {
    // ... existing loading logic ...

    // After loading, check if we need to restore search
    if (this.#searchStateRestored) {
        const filteredConcepts = this.#filterConcepts(this.#conceptsData);
        this.#displayConcepts(filteredConcepts);
        this.#updateSearchState(this.#elements.conceptSearch.value, filteredConcepts.length);
        this.#searchStateRestored = false;
    }
}

// Save search state on input
#setupEventListeners() {
    // ... existing setup ...

    this.#elements.conceptSearch.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
        this.#saveSearchState(); // Add this
    });
}
```

### 8. Add Search CSS Styles

Add these styles to character-concepts-manager.css:

```css
/* Search enhancements */
.search-active .concepts-display-panel {
  border-color: var(--narrative-purple);
}

/* Search status */
.search-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-highlight);
  border-radius: 8px;
  margin: 1rem 0;
  font-size: 0.875rem;
}

.search-status-text strong {
  color: var(--narrative-purple);
  font-weight: 600;
}

.clear-search-inline {
  background: transparent;
  border: none;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 1rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.clear-search-inline:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* Search input with clear button */
.cb-form-group {
  position: relative;
}

.search-clear-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 1rem;
  transition: all 0.2s ease;
}

.search-clear-btn:hover {
  color: var(--text-primary);
}

#concept-search {
  padding-right: 2.5rem; /* Make room for clear button */
}

/* No search results */
.no-search-results {
  text-align: center;
  padding: 3rem 2rem;
}

.no-results-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.no-results-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.no-results-message {
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.no-results-message strong {
  color: var(--narrative-purple);
}

.search-suggestions {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  text-align: left;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.search-suggestions p {
  margin: 0 0 0.5rem 0;
  font-weight: 600;
}

.search-suggestions ul {
  margin: 0;
  padding-left: 1.5rem;
}

.search-suggestions li {
  margin: 0.25rem 0;
  color: var(--text-secondary);
}

/* Search term highlighting */
mark {
  background-color: rgba(139, 92, 246, 0.2);
  color: inherit;
  padding: 0.1rem 0.2rem;
  border-radius: 3px;
  font-weight: 500;
}
```

### 9. Add Keyboard Navigation for Search

Implement keyboard shortcuts:

```javascript
// Add to #setupEventListeners
this.#elements.conceptSearch.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'Escape':
      // Clear search on Escape
      if (this.#searchFilter) {
        e.preventDefault();
        this.#clearSearch();
      }
      break;

    case 'Enter':
      // Focus first result on Enter
      if (this.#searchFilter) {
        e.preventDefault();
        const firstCard =
          this.#elements.conceptsResults.querySelector('.concept-card');
        if (firstCard) {
          firstCard.focus();
        }
      }
      break;
  }
});

// Add global search shortcut
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + F to focus search
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key === 'f' &&
    !e.target.closest('input, textarea')
  ) {
    e.preventDefault();
    this.#elements.conceptSearch.focus();
    this.#elements.conceptSearch.select();
  }
});
```

### 10. Add Search Analytics

Track search usage for improvements:

```javascript
// Add to class properties
#searchAnalytics = {
    searches: [],
    noResultSearches: []
};

/**
 * Track search analytics
 * @param {string} searchTerm
 * @param {number} resultCount
 */
#trackSearchAnalytics(searchTerm, resultCount) {
    if (!searchTerm) return;

    const searchData = {
        term: searchTerm,
        resultCount,
        timestamp: Date.now()
    };

    this.#searchAnalytics.searches.push(searchData);

    if (resultCount === 0) {
        this.#searchAnalytics.noResultSearches.push(searchData);
    }

    // Keep only last 100 searches
    if (this.#searchAnalytics.searches.length > 100) {
        this.#searchAnalytics.searches.shift();
    }

    // Log analytics periodically
    if (this.#searchAnalytics.searches.length % 10 === 0) {
        this.#logger.info('Search analytics', {
            totalSearches: this.#searchAnalytics.searches.length,
            noResultSearches: this.#searchAnalytics.noResultSearches.length,
            averageResults: this.#calculateAverageResults()
        });
    }
}

/**
 * Calculate average search results
 * @returns {number}
 */
#calculateAverageResults() {
    const searches = this.#searchAnalytics.searches;
    if (searches.length === 0) return 0;

    const sum = searches.reduce((acc, search) => acc + search.resultCount, 0);
    return Math.round(sum / searches.length);
}
```

## Acceptance Criteria

1. ✅ Search input filters concepts in real-time
2. ✅ Search is debounced by 300ms
3. ✅ Search is case-insensitive
4. ✅ Multiple search terms work (AND logic)
5. ✅ No results state shows helpful message
6. ✅ Search terms are highlighted in results
7. ✅ Clear button appears when searching
8. ✅ Search state persists during session
9. ✅ Escape key clears search
10. ✅ Ctrl/Cmd+F focuses search input
11. ✅ Search status shows result count
12. ✅ Fuzzy matching for minor typos

## Testing Requirements

1. Test with various search terms (single, multiple words)
2. Test no results messaging
3. Test search highlighting
4. Test clear functionality
5. Test keyboard navigation
6. Test search persistence
7. Test with special characters
8. Test performance with many concepts

## Notes

- Consider implementing search suggestions based on common terms
- Future enhancement: search filters (date range, has directions, etc.)
- Consider implementing search history
- Test performance with large datasets
- Ensure accessibility for search features
