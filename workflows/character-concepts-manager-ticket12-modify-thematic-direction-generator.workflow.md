# Ticket 12: Modify Thematic Direction Generator

## Overview

Modify the Thematic Direction Generator to use a dropdown selector for existing character concepts instead of allowing write-in text, display the selected concept, and update form validation.

## Dependencies

- Existing thematic-direction-generator.html
- Existing thematicDirectionController.js
- CharacterBuilderService with concept loading capability

## Implementation Details

### 1. Update HTML Structure

Modify `thematic-direction-generator.html` to replace the textarea with a dropdown:

```html
<!-- Replace the existing character concept textarea section with: -->

<!-- Character Concept Selection -->
<div class="cb-form-group">
  <label for="concept-selector">
    Select Character Concept:
    <span class="required" aria-hidden="true">*</span>
  </label>
  <select
    id="concept-selector"
    class="cb-select"
    required
    aria-describedby="concept-selector-help concept-selector-error"
  >
    <option value="">-- Choose a character concept --</option>
    <!-- Options will be populated dynamically -->
  </select>
  <div id="concept-selector-help" class="input-help">
    Choose an existing character concept to generate thematic directions for.
  </div>
  <div
    id="concept-selector-error"
    class="error-message"
    role="alert"
    aria-live="polite"
  ></div>
</div>

<!-- Add concept display area after the selector -->
<div
  id="selected-concept-display"
  class="concept-display"
  style="display: none;"
>
  <h3 class="concept-display-title">Selected Concept</h3>
  <div id="concept-content" class="concept-content">
    <!-- Concept text will be displayed here -->
  </div>
  <div class="concept-meta">
    <span id="concept-directions-count">0 existing directions</span>
    <span id="concept-created-date">Created on --</span>
  </div>
</div>

<!-- Add link to create new concepts -->
<div class="concept-actions">
  <p>Need to create a new concept?</p>
  <a href="character-concepts-manager.html" class="cb-link">
    Go to Character Concepts Manager →
  </a>
</div>
```

### 2. Add CSS Styles

Add styles for the concept selector and display in `css/thematic-direction.css`:

```css
/* Concept selector styles */
.cb-select {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.3s ease;
}

.cb-select:hover {
  border-color: var(--narrative-purple-light);
}

.cb-select:focus {
  outline: none;
  border-color: var(--narrative-purple);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.cb-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Selected concept display */
.concept-display {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 1.5rem;
  transition: all 0.3s ease;
}

.concept-display-title {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  color: var(--text-primary);
  font-weight: 600;
}

.concept-content {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  color: var(--text-primary);
  line-height: 1.6;
  font-style: italic;
  border-left: 3px solid var(--narrative-purple);
}

.concept-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.concept-meta span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

#concept-directions-count {
  color: var(--narrative-purple);
  font-weight: 500;
}

/* Concept actions */
.concept-actions {
  text-align: center;
  padding: 1rem;
  background: var(--bg-highlight);
  border-radius: 8px;
  margin-top: 1rem;
}

.concept-actions p {
  margin: 0 0 0.5rem 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.cb-link {
  color: var(--narrative-purple);
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s ease;
}

.cb-link:hover {
  color: var(--narrative-purple-dark);
  text-decoration: underline;
}

/* Loading state for selector */
.cb-select.loading {
  background-image: url('data:image/svg+xml;utf8,<svg>...</svg>');
  background-repeat: no-repeat;
  background-position: right 1rem center;
  background-size: 20px 20px;
}

/* Empty state for no concepts */
.no-concepts-message {
  padding: 2rem;
  text-align: center;
  background: var(--bg-highlight);
  border-radius: 8px;
  margin: 1rem 0;
}

.no-concepts-message h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.no-concepts-message p {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
}
```

### 3. Update Controller Constructor

In `src/domUI/thematicDirectionController.js`, update the constructor to include concept selector elements:

```javascript
constructor({ logger, characterBuilderService, eventBus, llmService }) {
    // ... existing validation ...

    // Add concept-related properties
    this.#selectedConceptId = null;
    this.#conceptsData = [];
}

// In #cacheElements method, add:
this.#elements.conceptSelector = document.getElementById('concept-selector');
this.#elements.selectedConceptDisplay = document.getElementById('selected-concept-display');
this.#elements.conceptContent = document.getElementById('concept-content');
this.#elements.conceptDirectionsCount = document.getElementById('concept-directions-count');
this.#elements.conceptCreatedDate = document.getElementById('concept-created-date');
this.#elements.conceptSelectorError = document.getElementById('concept-selector-error');
```

### 4. Implement Concept Loading

Add methods to load and display concepts:

```javascript
/**
 * Load available character concepts
 */
async #loadCharacterConcepts() {
    this.#logger.info('Loading character concepts for selection');

    try {
        // Show loading state
        this.#elements.conceptSelector.classList.add('loading');
        this.#elements.conceptSelector.disabled = true;

        // Load concepts
        const concepts = await this.#characterBuilderService.getAllCharacterConcepts();
        this.#conceptsData = concepts;

        // Sort by creation date (newest first)
        concepts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Populate dropdown
        this.#populateConceptSelector(concepts);

        // Check URL parameters for pre-selection
        this.#checkForPreselection();

        this.#logger.info(`Loaded ${concepts.length} character concepts`);

    } catch (error) {
        this.#logger.error('Failed to load character concepts', error);
        this.#showConceptError('Failed to load character concepts. Please refresh the page.');
    } finally {
        this.#elements.conceptSelector.classList.remove('loading');
        this.#elements.conceptSelector.disabled = false;
    }
}

/**
 * Populate the concept selector dropdown
 * @param {Array} concepts
 */
#populateConceptSelector(concepts) {
    // Clear existing options except the first
    while (this.#elements.conceptSelector.options.length > 1) {
        this.#elements.conceptSelector.remove(1);
    }

    if (concepts.length === 0) {
        // Show no concepts message
        this.#showNoConceptsMessage();
        return;
    }

    // Add concepts as options
    concepts.forEach(concept => {
        const option = document.createElement('option');
        option.value = concept.id;
        option.textContent = this.#truncateText(concept.text, 80);

        // Add data attributes for quick access
        option.dataset.fullText = concept.text;
        option.dataset.createdAt = concept.createdAt;

        this.#elements.conceptSelector.appendChild(option);
    });
}

/**
 * Show message when no concepts exist
 */
#showNoConceptsMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'no-concepts-message';
    messageDiv.innerHTML = `
        <h3>No Character Concepts Available</h3>
        <p>You need to create at least one character concept before generating thematic directions.</p>
        <a href="character-concepts-manager.html" class="cb-button-primary">
            Create Your First Concept
        </a>
    `;

    // Insert after the form group
    this.#elements.conceptSelector.closest('.cb-form-group').insertAdjacentElement(
        'afterend',
        messageDiv
    );

    // Disable form submission
    this.#elements.conceptSelector.disabled = true;
    this.#elements.generateBtn.disabled = true;
}

/**
 * Check URL for concept pre-selection
 */
#checkForPreselection() {
    const urlParams = new URLSearchParams(window.location.search);
    const conceptId = urlParams.get('conceptId');

    if (conceptId && this.#conceptsData.some(c => c.id === conceptId)) {
        this.#elements.conceptSelector.value = conceptId;
        this.#handleConceptSelection();
    }
}
```

### 5. Handle Concept Selection

Add event handler for concept selection:

```javascript
/**
 * Set up concept selector event listener
 */
#setupConceptSelector() {
    this.#elements.conceptSelector.addEventListener('change', () => {
        this.#handleConceptSelection();
    });
}

/**
 * Handle concept selection change
 */
async #handleConceptSelection() {
    const selectedId = this.#elements.conceptSelector.value;

    if (!selectedId) {
        // No concept selected
        this.#selectedConceptId = null;
        this.#elements.selectedConceptDisplay.style.display = 'none';
        this.#validateForm();
        return;
    }

    // Find selected concept
    const concept = this.#conceptsData.find(c => c.id === selectedId);
    if (!concept) {
        this.#logger.error('Selected concept not found', { selectedId });
        return;
    }

    this.#selectedConceptId = selectedId;

    // Display concept details
    this.#displaySelectedConcept(concept);

    // Load direction count
    await this.#loadDirectionCount(selectedId);

    // Validate form
    this.#validateForm();
}

/**
 * Display the selected concept
 * @param {Object} concept
 */
#displaySelectedConcept(concept) {
    // Show display area
    this.#elements.selectedConceptDisplay.style.display = 'block';

    // Set concept text
    this.#elements.conceptContent.textContent = concept.text;

    // Set creation date
    const createdDate = new Date(concept.createdAt).toLocaleDateString();
    this.#elements.conceptCreatedDate.textContent = `Created on ${createdDate}`;

    // Scroll into view
    this.#elements.selectedConceptDisplay.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
    });
}

/**
 * Load direction count for selected concept
 * @param {string} conceptId
 */
async #loadDirectionCount(conceptId) {
    try {
        const directions = await this.#characterBuilderService
            .getThematicDirectionsByConceptId(conceptId);

        const count = directions.length;
        const text = count === 0 ? 'No existing directions' :
                    count === 1 ? '1 existing direction' :
                    `${count} existing directions`;

        this.#elements.conceptDirectionsCount.textContent = text;

        // Add warning if many directions exist
        if (count >= 10) {
            this.#elements.conceptDirectionsCount.innerHTML +=
                ' <span class="warning">(consider if more are needed)</span>';
        }

    } catch (error) {
        this.#logger.error('Failed to load direction count', error);
        this.#elements.conceptDirectionsCount.textContent = 'Unable to load directions';
    }
}
```

### 6. Update Form Validation

Modify the form validation to check concept selection:

```javascript
/**
 * Validate the entire form
 * @returns {boolean}
 */
#validateForm() {
    let isValid = true;

    // Validate concept selection
    if (!this.#selectedConceptId) {
        this.#showConceptError('Please select a character concept');
        isValid = false;
    } else {
        this.#clearConceptError();
    }

    // Validate temperature
    const tempValid = this.#validateTemperature();
    if (!tempValid) isValid = false;

    // Update generate button state
    this.#elements.generateBtn.disabled = !isValid;

    return isValid;
}

/**
 * Show concept selection error
 * @param {string} message
 */
#showConceptError(message) {
    this.#elements.conceptSelectorError.textContent = message;
    this.#elements.conceptSelector.classList.add('error');
}

/**
 * Clear concept selection error
 */
#clearConceptError() {
    this.#elements.conceptSelectorError.textContent = '';
    this.#elements.conceptSelector.classList.remove('error');
}
```

### 7. Update Form Submission

Modify the generate handler to use selected concept:

```javascript
/**
 * Handle form submission
 * @param {Event} e
 */
async #handleGenerate(e) {
    e.preventDefault();

    if (!this.#validateForm()) {
        return;
    }

    // Get selected concept
    const concept = this.#conceptsData.find(c => c.id === this.#selectedConceptId);
    if (!concept) {
        this.#showError('Selected concept not found. Please select again.');
        return;
    }

    const temperature = parseFloat(this.#elements.temperatureInput.value);

    try {
        this.#setLoadingState(true);

        // Generate directions with the selected concept
        const result = await this.#generateThematicDirections(
            concept.text,  // Use the full concept text
            temperature
        );

        // Store concept ID with results for saving
        result.conceptId = this.#selectedConceptId;

        this.#displayResults(result);

    } catch (error) {
        this.#logger.error('Generation failed:', error);
        this.#showError('Failed to generate thematic directions. Please try again.');
    } finally {
        this.#setLoadingState(false);
    }
}
```

### 8. Update Save Functionality

Modify the save method to include concept ID:

```javascript
/**
 * Save generated directions
 */
async #saveGeneratedDirections() {
    if (!this.#lastGeneratedDirections || !this.#selectedConceptId) {
        this.#logger.warn('No directions to save or no concept selected');
        return;
    }

    try {
        this.#setSaveButtonState('saving');

        const savedCount = 0;
        const errors = [];

        for (const [index, direction] of this.#lastGeneratedDirections.entries()) {
            try {
                // Save with concept ID
                await this.#characterBuilderService.createThematicDirection(
                    this.#selectedConceptId,  // Use selected concept ID
                    direction.text
                );
                savedCount++;
            } catch (error) {
                this.#logger.error(`Failed to save direction ${index + 1}:`, error);
                errors.push(`Direction ${index + 1}: ${error.message}`);
            }
        }

        // Show results
        if (savedCount > 0) {
            this.#showSaveSuccess(savedCount);

            // Refresh direction count
            await this.#loadDirectionCount(this.#selectedConceptId);
        }

        if (errors.length > 0) {
            this.#showSaveErrors(errors);
        }

    } catch (error) {
        this.#logger.error('Save operation failed:', error);
        this.#showError('Failed to save directions. Please try again.');
    } finally {
        this.#setSaveButtonState('default');
    }
}
```

### 9. Update Initialization

Modify the initialize method to load concepts:

```javascript
async initialize() {
    try {
        this.#logger.info('Initializing Thematic Direction Generator');

        // Cache DOM elements
        this.#cacheElements();

        // Initialize character builder service
        await this.#characterBuilderService.initialize();

        // Load character concepts
        await this.#loadCharacterConcepts();

        // Set up event listeners
        this.#setupEventListeners();
        this.#setupConceptSelector();  // Add this

        // ... rest of initialization ...

    } catch (error) {
        this.#logger.error('Failed to initialize:', error);
        this.#showError('Failed to initialize the page. Please refresh and try again.');
    }
}
```

### 10. Add Navigation Helper

Add a helper to navigate to concepts manager:

```javascript
/**
 * Navigate to character concepts manager
 */
#navigateToConceptsManager() {
    // Save current state if needed
    if (this.#lastGeneratedDirections && this.#lastGeneratedDirections.length > 0) {
        const confirmLeave = confirm(
            'You have unsaved generated directions. Do you want to leave without saving?'
        );
        if (!confirmLeave) return;
    }

    window.location.href = 'character-concepts-manager.html';
}
```

## Acceptance Criteria

1. ✅ Textarea replaced with dropdown selector
2. ✅ Dropdown populated with existing concepts
3. ✅ Selected concept text displays below selector
4. ✅ Concept metadata shows (date, direction count)
5. ✅ Form validation requires concept selection
6. ✅ Generation uses selected concept text
7. ✅ Saving associates directions with concept ID
8. ✅ Link to concepts manager provided
9. ✅ Empty state handled when no concepts exist
10. ✅ URL parameter pre-selection works
11. ✅ Direction count updates after save
12. ✅ Loading states show during async operations

## Testing Requirements

1. Test with no existing concepts
2. Test with many concepts (scrolling in dropdown)
3. Test concept selection and display
4. Test form validation with no selection
5. Test generation with selected concept
6. Test saving and association
7. Test navigation between pages
8. Test URL parameter pre-selection

## Notes

- Maintain existing functionality while changing input method
- Ensure smooth user experience with loading states
- Consider caching concepts for better performance
- Test with concepts of various lengths
- Ensure proper error handling throughout
