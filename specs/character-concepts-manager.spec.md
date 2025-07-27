# Character Concepts Manager Specification

## Overview

The Character Concepts Manager is a comprehensive management interface for character concepts within the Living Narrative Engine's Character Builder system. It provides full CRUD (Create, Read, Update, Delete) functionality for character concepts while maintaining relationships with their associated thematic directions.

## Goals

1. **Centralized Management**: Provide a single interface for managing all character concepts
2. **Data Integrity**: Safely handle concept deletion with associated thematic directions
3. **User Experience**: Maintain consistency with existing Character Builder pages
4. **Code Reuse**: Maximize reuse of existing components, services, and styles

## Architecture

### Component Structure

```
CharacterConceptsManagerApp
├── CharacterConceptsManagerController
│   ├── Concept CRUD Operations
│   ├── List Display & Management
│   ├── Filtering & Search
│   └── Modal Management
├── CharacterBuilderService (Existing)
│   ├── Data Operations
│   └── Event Dispatching
├── Shared UI Components (Existing)
│   ├── UIStateManager
│   ├── InPlaceEditor
│   └── PreviousItemsDropdown (if needed)
└── New Components
    ├── ConceptCard
    └── ConfirmationModal (Enhanced)
```

### Data Flow

1. **Load Flow**: Controller → Service → IndexedDB → UI Update
2. **Create Flow**: Modal Input → Validation → Service → Store → Event → UI Refresh
3. **Update Flow**: In-place Edit → Validation → Service → Store → Event → UI Update
4. **Delete Flow**: Confirm Modal → Service → Cascade Delete → Event → UI Refresh

## User Interface Design

### Page Layout

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Character Concepts Manager - Living Narrative Engine</title>
    <link rel="stylesheet" href="css/style.css" />
    <link rel="stylesheet" href="css/components.css" />
    <link rel="stylesheet" href="css/character-concepts-manager.css" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  </head>
  <body>
    <div id="character-concepts-manager-container" class="cb-page-container">
      <!-- Header with gradient background -->
      <header class="cb-page-header">
        <div class="header-content">
          <h1>Character Concepts Manager</h1>
          <p class="header-subtitle">
            Create, organize, and manage your character concepts
          </p>
        </div>
      </header>

      <main class="cb-page-main character-concepts-manager-main">
        <!-- Left Panel: Controls & Actions -->
        <section class="cb-input-panel concept-controls-panel">
          <h2 class="cb-panel-title">Concept Management</h2>

          <!-- Quick Actions -->
          <div class="action-buttons">
            <button
              id="create-concept-btn"
              type="button"
              class="cb-button-primary"
            >
              ➕ New Concept
            </button>
          </div>

          <!-- Search/Filter -->
          <div class="cb-form-group">
            <label for="concept-search">Search Concepts:</label>
            <input
              type="text"
              id="concept-search"
              class="cb-input"
              placeholder="Search by content..."
            />
          </div>

          <!-- Statistics Display -->
          <div class="stats-display">
            <h3>Statistics</h3>
            <div class="stat-item">
              <span class="stat-label">Total Concepts:</span>
              <span id="total-concepts" class="stat-value">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">With Directions:</span>
              <span id="concepts-with-directions" class="stat-value">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Directions:</span>
              <span id="total-directions" class="stat-value">0</span>
            </div>
          </div>
        </section>

        <!-- Right Panel: Concepts Grid -->
        <section class="cb-results-panel concepts-display-panel">
          <h2 class="cb-panel-title">Character Concepts</h2>

          <div id="concepts-container" class="cb-state-container">
            <!-- Empty State -->
            <div id="empty-state" class="cb-empty-state">
              <p>No character concepts yet.</p>
              <p>Create your first concept to get started.</p>
              <button
                type="button"
                class="cb-button-primary"
                id="create-first-btn"
              >
                ➕ Create First Concept
              </button>
            </div>

            <!-- Loading State -->
            <div
              id="loading-state"
              class="cb-loading-state"
              style="display: none;"
            >
              <div class="spinner large"></div>
              <p>Loading concepts...</p>
            </div>

            <!-- Error State -->
            <div id="error-state" class="cb-error-state" style="display: none;">
              <p class="error-title">Unable to Load Concepts</p>
              <p class="error-message" id="error-message-text"></p>
              <button type="button" class="cb-button-secondary" id="retry-btn">
                Try Again
              </button>
            </div>

            <!-- Results State -->
            <div
              id="results-state"
              class="cb-state-container"
              style="display: none;"
            >
              <div id="concepts-results" class="concepts-grid">
                <!-- Dynamically populated concept cards -->
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer class="cb-page-footer">
        <div class="footer-content">
          <button
            type="button"
            id="back-to-menu-btn"
            class="cb-button-secondary"
          >
            ← Back to Main Menu
          </button>
          <p class="footer-info">
            Living Narrative Engine - Character Concepts Manager
          </p>
        </div>
      </footer>
    </div>

    <!-- Create/Edit Concept Modal -->
    <div
      id="concept-modal"
      class="modal"
      style="display: none;"
      role="dialog"
      aria-labelledby="concept-modal-title"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="concept-modal-title">Create Character Concept</h2>
          <button
            type="button"
            class="close-modal"
            aria-label="Close modal"
            id="close-concept-modal"
          >
            ×
          </button>
        </div>
        <div class="modal-body">
          <form id="concept-form" novalidate>
            <div class="cb-form-group">
              <label for="concept-text">
                Character Concept:
                <span class="required" aria-hidden="true">*</span>
              </label>
              <textarea
                id="concept-text"
                name="conceptText"
                class="cb-textarea"
                placeholder="e.g. a ditzy female adventurer who's good with a bow"
                rows="6"
                minlength="10"
                maxlength="1000"
                required
                aria-describedby="concept-help concept-error"
              ></textarea>
              <div id="concept-help" class="input-help">
                Describe your character in a few sentences. Focus on
                personality, background, and key traits.
              </div>
              <div class="input-meta">
                <span class="char-count" id="char-count">0/1000</span>
                <div
                  id="concept-error"
                  class="error-message"
                  role="alert"
                  aria-live="polite"
                ></div>
              </div>
            </div>
            <div class="modal-actions">
              <button
                type="submit"
                id="save-concept-btn"
                class="cb-button-primary"
                disabled
              >
                Save Concept
              </button>
              <button
                type="button"
                id="cancel-concept-btn"
                class="cb-button-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      id="delete-confirmation-modal"
      class="modal"
      style="display: none;"
      role="dialog"
      aria-labelledby="delete-modal-title"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="delete-modal-title">Confirm Deletion</h2>
          <button
            type="button"
            class="close-modal"
            aria-label="Close modal"
            id="close-delete-modal"
          >
            ×
          </button>
        </div>
        <div class="modal-body">
          <p id="delete-modal-message">
            <!-- Dynamic message will be inserted here -->
          </p>
          <div class="modal-actions">
            <button
              type="button"
              id="confirm-delete-btn"
              class="cb-button-danger"
            >
              Delete
            </button>
            <button
              type="button"
              id="cancel-delete-btn"
              class="cb-button-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <script src="character-concepts-manager.js"></script>
  </body>
</html>
```

### Concept Card Component

Each character concept will be displayed as a card with the following structure:

```html
<div class="concept-card" data-concept-id="{conceptId}">
  <div class="concept-card-header">
    <span class="concept-status {status}">{Status}</span>
    <button type="button" class="concept-menu-btn" aria-label="More options">
      ⋮
    </button>
  </div>
  <div class="concept-card-content">
    <p class="concept-text">{Truncated concept text...}</p>
    <div class="concept-meta">
      <span class="direction-count">
        <strong>{count}</strong> thematic directions
      </span>
      <span class="concept-date"> Created {relative date} </span>
    </div>
  </div>
  <div class="concept-card-actions">
    <button type="button" class="edit-btn" aria-label="Edit concept">
      ✏️ Edit
    </button>
    <button type="button" class="delete-btn" aria-label="Delete concept">
      🗑️ Delete
    </button>
    <button
      type="button"
      class="view-directions-btn"
      aria-label="View thematic directions"
    >
      📋 Directions
    </button>
  </div>
</div>
```

## Controller Implementation

### CharacterConceptsManagerController

```javascript
export class CharacterConceptsManagerController {
    #logger;
    #characterBuilderService;
    #eventBus;
    #uiStateManager;
    #searchFilter = '';
    #conceptsData = [];
    #editingConceptId = null;

    constructor({ logger, characterBuilderService, eventBus }) {
        // Dependency validation
        // Store dependencies
    }

    async initialize() {
        // Cache DOM elements
        // Initialize UI state manager
        // Initialize service
        // Set up event listeners
        // Load initial data
    }

    // Core Methods
    async #loadConceptsData()
    #displayConcepts(concepts)
    #createConceptCard(concept, directionCount)

    // CRUD Operations
    #showCreateModal()
    #showEditModal(conceptId)
    async #saveConcept(conceptText, conceptId = null)
    async #deleteConcept(conceptId)

    // UI Interactions
    #handleSearch(searchTerm)
    #updateStatistics()
    #showDeleteConfirmation(concept, directionCount)

    // Event Handlers
    #handleConceptCreated(event)
    #handleConceptUpdated(event)
    #handleConceptDeleted(event)
}
```

## CSS Styling

### character-concepts-manager.css

```css
/* Import shared components */
@import url('./components.css');

/* Page-specific layout */
.character-concepts-manager-main {
  grid-template-columns: 300px 1fr;
}

/* Concepts grid */
.concepts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  padding: 1rem;
}

/* Concept card styling */
.concept-card {
  background: #ffffff;
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
}

.concept-card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
  border-color: var(--narrative-purple-light);
}

.concept-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.concept-status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.concept-status.completed {
  background: rgba(46, 204, 113, 0.1);
  color: #27ae60;
}

.concept-status.draft {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.concept-text {
  color: var(--text-primary);
  line-height: 1.6;
  margin: 0 0 1rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.concept-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.direction-count strong {
  color: var(--narrative-purple);
  font-weight: 600;
}

.concept-card-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary);
}

.concept-card-actions button {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  background: transparent;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.concept-card-actions button:hover {
  background: var(--bg-highlight);
  border-color: var(--narrative-purple);
}

/* Statistics display */
.stats-display {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 2rem;
}

.stats-display h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  color: var(--text-primary);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.stat-label {
  color: var(--text-secondary);
}

.stat-value {
  font-weight: 600;
  color: var(--narrative-purple);
}

/* Modal enhancements */
.cb-button-danger {
  background: #e74c3c;
  color: white;
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.cb-button-danger:hover {
  background: #c0392b;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(231, 76, 60, 0.3);
}

/* Responsive design */
@media (max-width: 768px) {
  .character-concepts-manager-main {
    grid-template-columns: 1fr;
  }

  .concepts-grid {
    grid-template-columns: 1fr;
  }
}
```

## Integration Requirements

### Modifications to Thematic Direction Generator

1. **Remove Write-in Functionality**:
   - Remove the character concept textarea from the form
   - Replace with a dropdown selector for existing concepts
   - Display selected concept text in a read-only format

2. **HTML Changes**:

   ```html
   <!-- Replace the textarea section with: -->
   <div class="cb-form-group">
     <label for="concept-selector">Select Character Concept:</label>
     <select id="concept-selector" class="cb-select" required>
       <option value="">-- Choose a concept --</option>
       <!-- Populated dynamically -->
     </select>
   </div>

   <!-- Add concept display area -->
   <div
     id="selected-concept-display"
     class="concept-display"
     style="display: none;"
   >
     <h3>Selected Concept</h3>
     <div id="concept-content" class="concept-content">
       <!-- Concept text will be displayed here -->
     </div>
   </div>
   ```

3. **Controller Updates**:
   - Add concept selector initialization
   - Handle concept selection events
   - Display full concept text when selected
   - Update form validation to require concept selection

## Service Layer Extensions

### CharacterBuilderService Enhancements

While the existing service has most required functionality, we may need to add:

```javascript
/**
 * Get all concepts with their direction counts
 * @returns {Promise<Array<{concept: CharacterConcept, directionCount: number}>>}
 */
async getConceptsWithDirectionCounts() {
    const concepts = await this.getAllCharacterConcepts();
    const conceptsWithCounts = [];

    for (const concept of concepts) {
        const directions = await this.getThematicDirectionsByConceptId(concept.id);
        conceptsWithCounts.push({
            concept,
            directionCount: directions.length
        });
    }

    return conceptsWithCounts;
}
```

## Event Integration

### New Events to Handle

```javascript
// Listen for these events from CharacterBuilderService
CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED;
CHARACTER_BUILDER_EVENTS.CONCEPT_UPDATED;
CHARACTER_BUILDER_EVENTS.CONCEPT_DELETED;
CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED;

// Update UI accordingly when these events fire
```

## Data Validation

### Character Concept Validation

```javascript
const conceptValidation = {
  minLength: 10,
  maxLength: 1000,
  required: true,
  pattern: /^[\s\S]{10,1000}$/, // Any character, 10-1000 length
  messages: {
    tooShort: 'Concept must be at least 10 characters',
    tooLong: 'Concept must not exceed 1000 characters',
    required: 'Character concept is required',
  },
};
```

## Error Handling

1. **Network Errors**: Display retry options in error state
2. **Validation Errors**: Show inline error messages
3. **Storage Errors**: Log and display user-friendly messages
4. **Cascade Delete Errors**: Rollback and inform user

## Performance Considerations

1. **Lazy Loading**: Load concept details only when needed
2. **Search Debouncing**: Debounce search input by 300ms
3. **Virtual Scrolling**: Consider for large concept lists (future enhancement)
4. **Caching**: Cache concept data in controller for quick filtering

## Accessibility

1. **Keyboard Navigation**: Support Tab, Enter, Escape for all interactions
2. **ARIA Labels**: Proper labeling for all interactive elements
3. **Screen Reader Support**: Announce state changes and confirmations
4. **Focus Management**: Return focus appropriately after modal operations

## Testing Considerations

1. **Unit Tests**: Controller methods, validation logic
2. **Integration Tests**: Service layer interactions
3. **E2E Tests**: Complete user workflows
4. **Edge Cases**: Empty states, deletion with/without directions

## Implementation Timeline

### Phase 1: Core Implementation (Priority)

1. Create HTML structure
2. Implement controller with basic CRUD
3. Add CSS styling
4. Integrate with existing services

### Phase 2: Integration

1. Modify thematic-direction-generator.html
2. Update its controller for concept selection
3. Test end-to-end workflows

### Phase 3: Enhancements (Optional)

1. Bulk operations
2. Export/import functionality
3. Advanced filtering
4. Sorting options

## Success Criteria

1. ✅ Users can create, view, edit, and delete character concepts
2. ✅ Deletion of concepts with directions shows confirmation
3. ✅ Cascade deletion works correctly
4. ✅ Direction counts are displayed accurately
5. ✅ Search/filter functionality works smoothly
6. ✅ Thematic Direction Generator uses concept selection
7. ✅ UI matches existing Character Builder design language
8. ✅ All existing functionality remains intact

## Notes for Implementers

1. **Follow Existing Patterns**: Match the code style and patterns from existing Character Builder pages
2. **Reuse Components**: Leverage shared components wherever possible
3. **Test Cascade Deletion**: The database already supports this, but test thoroughly
4. **Maintain Event Flow**: Ensure all state changes dispatch appropriate events
5. **Consider Mobile**: Ensure responsive design works on small screens
