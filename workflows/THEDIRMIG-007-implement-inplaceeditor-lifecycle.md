# THEDIRMIG-007: Implement InPlaceEditor Lifecycle Management

## Overview

Implement proper lifecycle management for the ~25-30 InPlaceEditor instances used in the thematic directions manager. This includes tracking editor instances, initializing them when directions are displayed, and ensuring proper cleanup in the destroy hooks to prevent memory leaks.

## Priority

**HIGH** - Critical for preventing memory leaks

## Dependencies

- **Blocked by**: THEDIRMIG-006 (lifecycle methods)
- **Blocks**: THEDIRMIG-011 (cleanup implementation)
- **Related**: THEDIRMIG-004 (cached elements used by editors)

## Acceptance Criteria

- [ ] All InPlaceEditor instances are tracked in a Map
- [ ] Editors are created when direction cards are displayed
- [ ] Each editor is properly configured with field-specific settings
- [ ] Editors are destroyed before creating new ones
- [ ] All editors are cleaned up in \_preDestroy()
- [ ] No memory leaks from orphaned editor instances
- [ ] Edit functionality remains fully operational
- [ ] Validation and parsing work correctly

## Implementation Steps

### Step 1: Add InPlaceEditor Tracking

Add instance tracking to the controller:

```javascript
export class ThematicDirectionsManagerController extends BaseCharacterBuilderController {
  // Existing fields...

  /**
   * Map of InPlaceEditor instances keyed by element ID
   * @type {Map<string, InPlaceEditor>}
   */
  #inPlaceEditors = new Map();

  /**
   * Configuration for each editable field type
   * @type {Object}
   */
  #editorConfigs = {
    name: { maxLength: 100, required: true },
    description: { maxLength: 500, required: true, multiline: true },
    tags: { maxLength: 200, parser: this._parseTagsString.bind(this) },
    concepts: { maxLength: 300, parser: this._parseConceptsString.bind(this) },
  };
}
```

### Step 2: Create Editor Management Methods

Add methods to manage editor lifecycle:

```javascript
/**
 * Initialize InPlaceEditor for a specific field
 * @private
 * @param {string} elementId - The DOM element ID
 * @param {string} directionId - The direction ID
 * @param {string} fieldName - The field being edited
 * @param {Object} config - Editor configuration
 */
_createInPlaceEditor(elementId, directionId, fieldName, config) {
  // Check if element exists
  const element = document.getElementById(elementId);
  if (!element) {
    this.logger.warn(`Element not found for InPlaceEditor: ${elementId}`);
    return;
  }

  // Destroy existing editor if any
  if (this.#inPlaceEditors.has(elementId)) {
    this._destroyInPlaceEditor(elementId);
  }

  // Create new editor
  const editor = new InPlaceEditor({
    element: element,
    onSave: async (value) => {
      return await this._handleInPlaceEdit(directionId, fieldName, value);
    },
    onCancel: () => {
      this.logger.debug(`Edit cancelled for ${fieldName} on direction ${directionId}`);
    },
    validation: (value) => {
      return this._validateField(fieldName, value, config);
    },
    parser: config.parser,
    multiline: config.multiline || false,
    maxLength: config.maxLength,
    placeholder: `Enter ${fieldName}...`,
    trimValue: true
  });

  // Track the editor
  this.#inPlaceEditors.set(elementId, editor);

  return editor;
}

/**
 * Destroy a specific InPlaceEditor instance
 * @private
 * @param {string} elementId - The element ID
 */
_destroyInPlaceEditor(elementId) {
  const editor = this.#inPlaceEditors.get(elementId);
  if (editor) {
    if (typeof editor.destroy === 'function') {
      editor.destroy();
    }
    this.#inPlaceEditors.delete(elementId);
  }
}

/**
 * Destroy all InPlaceEditor instances
 * @private
 */
_destroyAllInPlaceEditors() {
  this.logger.debug(`Destroying ${this.#inPlaceEditors.size} InPlaceEditor instances`);

  this.#inPlaceEditors.forEach((editor, elementId) => {
    try {
      if (typeof editor.destroy === 'function') {
        editor.destroy();
      }
    } catch (error) {
      this.logger.error(`Error destroying InPlaceEditor ${elementId}:`, error);
    }
  });

  this.#inPlaceEditors.clear();
}
```

### Step 3: Initialize Editors When Displaying Directions

Update the display method to initialize editors:

```javascript
/**
 * Display filtered directions with InPlaceEditors
 * @private
 */
_displayDirections() {
  // Destroy existing editors before re-rendering
  this._destroyAllInPlaceEditors();

  const container = this._getElement('directionsList');
  if (!container) return;

  const filteredDirections = this._getFilteredDirections();

  if (filteredDirections.length === 0) {
    container.innerHTML = '<p class="no-results">No directions match your filters.</p>';
    return;
  }

  // Render direction cards
  container.innerHTML = filteredDirections
    .map(direction => this._createDirectionCardHTML(direction))
    .join('');

  // Initialize InPlaceEditors for each direction
  filteredDirections.forEach(direction => {
    this._initializeDirectionEditors(direction);
  });

  this.logger.debug(`Displayed ${filteredDirections.length} directions with editors`);
}

/**
 * Initialize all editors for a single direction
 * @private
 * @param {Object} direction - The direction data
 */
_initializeDirectionEditors(direction) {
  const directionId = direction.id;

  // Initialize editor for each editable field
  Object.entries(this.#editorConfigs).forEach(([fieldName, config]) => {
    const elementId = `direction-${directionId}-${fieldName}`;
    this._createInPlaceEditor(elementId, directionId, fieldName, config);
  });
}

/**
 * Create HTML for a direction card with editable fields
 * @private
 * @param {Object} direction - Direction data
 * @returns {string} HTML string
 */
_createDirectionCardHTML(direction) {
  const concepts = direction.concepts || [];
  const tags = direction.tags || [];

  return `
    <div class="direction-card" data-direction-id="${direction.id}">
      <div class="direction-header">
        <h3 id="direction-${direction.id}-name"
            class="direction-name editable"
            data-field="name">${this._escapeHtml(direction.name)}</h3>
        <div class="direction-actions">
          <button class="icon-btn edit-btn" data-action="edit" title="Edit">
            <span class="icon">✏️</span>
          </button>
          <button class="icon-btn delete-btn" data-action="delete" title="Delete">
            <span class="icon">🗑️</span>
          </button>
        </div>
      </div>

      <div id="direction-${direction.id}-description"
           class="direction-description editable"
           data-field="description">${this._escapeHtml(direction.description)}</div>

      <div class="direction-metadata">
        <div class="metadata-row">
          <span class="metadata-label">Tags:</span>
          <span id="direction-${direction.id}-tags"
                class="metadata-value editable"
                data-field="tags">${tags.join(', ') || 'None'}</span>
        </div>

        <div class="metadata-row">
          <span class="metadata-label">Concepts:</span>
          <span id="direction-${direction.id}-concepts"
                class="metadata-value editable"
                data-field="concepts">${concepts.map(c => c.name).join(', ') || 'None'}</span>
        </div>
      </div>

      <div class="direction-footer">
        <span class="direction-id">ID: ${direction.id}</span>
        <span class="direction-status ${direction.orphaned ? 'orphaned' : ''}">
          ${direction.orphaned ? '⚠️ Orphaned' : '✓ Active'}
        </span>
      </div>
    </div>
  `;
}
```

### Step 4: Handle InPlaceEdit Save

Implement the save handler:

```javascript
/**
 * Handle in-place edit save
 * @private
 * @param {string} directionId - Direction ID
 * @param {string} fieldName - Field being edited
 * @param {*} value - New value (may be parsed)
 * @returns {Promise<boolean>} Success status
 */
async _handleInPlaceEdit(directionId, fieldName, value) {
  try {
    this.logger.debug(`Saving edit for ${fieldName} on direction ${directionId}`);

    // Find the direction
    const direction = this.#directionsData.find(d => d.id === directionId);
    if (!direction) {
      throw new Error(`Direction not found: ${directionId}`);
    }

    // Prepare update data
    const updateData = { ...direction };
    updateData[fieldName] = value;

    // Validate against schema
    const validation = await this.schemaValidator.validateAgainstSchema(
      updateData,
      'thematic-direction'
    );

    if (!validation.valid) {
      this._showError(`Validation failed: ${validation.errors.join(', ')}`);
      return false;
    }

    // Save to backend
    await this._executeWithErrorHandling(
      () => this.characterBuilderService.updateThematicDirection(directionId, updateData),
      `update direction ${fieldName}`,
      {
        retries: 1,
        userErrorMessage: `Failed to save ${fieldName}. Please try again.`
      }
    );

    // Update local data
    Object.assign(direction, updateData);

    // Dispatch update event
    this.eventBus.dispatch({
      type: 'core:thematic_direction_updated',
      payload: { direction: updateData }
    });

    this._showSuccess(`${fieldName} updated successfully`);
    return true;

  } catch (error) {
    this.logger.error(`Failed to save in-place edit:`, error);
    this._showError(`Failed to save changes: ${error.message}`);
    return false;
  }
}
```

### Step 5: Implement Field Validation

Add field-specific validation:

```javascript
/**
 * Validate a field value
 * @private
 * @param {string} fieldName - Field name
 * @param {*} value - Value to validate
 * @param {Object} config - Field configuration
 * @returns {Object} Validation result
 */
_validateField(fieldName, value, config) {
  const validation = { valid: true, error: null };

  // Check required
  if (config.required && !value?.toString().trim()) {
    return { valid: false, error: `${fieldName} is required` };
  }

  // Check max length
  const stringValue = value?.toString() || '';
  if (config.maxLength && stringValue.length > config.maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be ${config.maxLength} characters or less`
    };
  }

  // Field-specific validation
  switch (fieldName) {
    case 'name':
      if (stringValue.length < 3) {
        return { valid: false, error: 'Name must be at least 3 characters' };
      }
      break;

    case 'tags':
      const tags = this._parseTagsString(stringValue);
      if (tags.some(tag => tag.length > 30)) {
        return { valid: false, error: 'Individual tags must be 30 characters or less' };
      }
      break;

    case 'concepts':
      // Concepts are validated during save against available concepts
      break;
  }

  return validation;
}

/**
 * Parse comma-separated tags string
 * @private
 * @param {string} tagsString - Raw tags input
 * @returns {string[]} Parsed tags array
 */
_parseTagsString(tagsString) {
  return tagsString
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
}

/**
 * Parse comma-separated concepts string
 * @private
 * @param {string} conceptsString - Raw concepts input
 * @returns {string[]} Parsed concept names array
 */
_parseConceptsString(conceptsString) {
  return conceptsString
    .split(',')
    .map(concept => concept.trim())
    .filter(concept => concept.length > 0);
}
```

### Step 6: Implement Cleanup in Destroy Hooks

Add cleanup to the destroy lifecycle:

```javascript
/**
 * Pre-destroy cleanup
 * @protected
 * @override
 */
_preDestroy() {
  this.logger.debug('ThematicDirectionsManager: Starting pre-destroy cleanup');

  // Destroy all InPlaceEditor instances
  this._destroyAllInPlaceEditors();

  // Clear any pending operations
  if (this.#pendingModalAction) {
    this.#pendingModalAction = null;
  }

  // Cancel any pending saves
  this._cancelPendingOperations();

  super._preDestroy();
}

/**
 * Post-destroy cleanup
 * @protected
 * @override
 */
_postDestroy() {
  // Additional cleanup if needed
  this.#editorConfigs = null;

  super._postDestroy();

  this.logger.debug('ThematicDirectionsManager: Cleanup complete');
}
```

### Step 7: Handle Dynamic Updates

Update event handlers for dynamic content:

```javascript
/**
 * Handle direction updated event
 * @private
 * @param {Object} data - Event data
 */
_handleDirectionUpdated(data) {
  const { direction } = data;
  if (!direction) return;

  // Update local data
  const index = this.#directionsData.findIndex(d => d.id === direction.id);
  if (index !== -1) {
    this.#directionsData[index] = direction;

    // Only re-render if the updated direction is visible
    const isVisible = this._isDirectionVisible(direction);
    if (isVisible) {
      // Re-render just this direction card
      this._updateDirectionCard(direction);
    }
  }
}

/**
 * Update a single direction card
 * @private
 * @param {Object} direction - Direction data
 */
_updateDirectionCard(direction) {
  const card = document.querySelector(`[data-direction-id="${direction.id}"]`);
  if (!card) return;

  // Destroy existing editors for this card
  Object.keys(this.#editorConfigs).forEach(fieldName => {
    const elementId = `direction-${direction.id}-${fieldName}`;
    this._destroyInPlaceEditor(elementId);
  });

  // Replace card HTML
  const newCardHTML = this._createDirectionCardHTML(direction);
  card.outerHTML = newCardHTML;

  // Re-initialize editors
  this._initializeDirectionEditors(direction);
}
```

## Testing Strategy

### Manual Testing Checklist

1. **Editor Initialization**:
   - [ ] All fields show edit cursor on hover
   - [ ] Clicking field activates edit mode
   - [ ] Edit UI appears correctly
   - [ ] Cancel button works

2. **Saving Changes**:
   - [ ] Valid changes save successfully
   - [ ] Invalid changes show error
   - [ ] UI updates after save
   - [ ] Backend receives updates

3. **Memory Management**:
   - [ ] Re-filtering destroys old editors
   - [ ] Page refresh cleans up properly
   - [ ] No console errors about detached nodes

### Unit Test Example

```javascript
describe('InPlaceEditor Lifecycle', () => {
  it('should create editors when displaying directions', () => {
    const directions = [
      { id: '1', name: 'Direction 1', description: 'Desc 1', tags: ['tag1'] },
    ];
    controller.#directionsData = directions;

    controller._displayDirections();

    // Verify editor was created for each field
    expect(controller.#inPlaceEditors.size).toBe(4); // name, desc, tags, concepts
    expect(controller.#inPlaceEditors.has('direction-1-name')).toBe(true);
  });

  it('should destroy all editors on cleanup', () => {
    // Create some editors
    controller._createInPlaceEditor('test-1', 'dir1', 'name', {
      maxLength: 100,
    });
    controller._createInPlaceEditor('test-2', 'dir1', 'desc', {
      maxLength: 500,
    });

    expect(controller.#inPlaceEditors.size).toBe(2);

    // Cleanup
    controller._preDestroy();

    expect(controller.#inPlaceEditors.size).toBe(0);
  });
});
```

## Memory Leak Prevention

### Key Points

1. **Always destroy before create**: When re-rendering, destroy existing editors first
2. **Track all instances**: Use Map to ensure no orphaned instances
3. **Cleanup on destroy**: Implement thorough cleanup in \_preDestroy()
4. **Handle errors gracefully**: Don't let destroy errors prevent cleanup of others

### Browser DevTools Verification

```javascript
// Add temporary debugging
window.__DEBUG_EDITORS__ = this.#inPlaceEditors;

// In console:
// Check editor count
console.log(window.__DEBUG_EDITORS__.size);

// Force garbage collection (Chrome DevTools)
// Performance tab > Collect garbage

// Take heap snapshot before/after operations
```

## Files Modified

- [ ] `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`

## Files Created

- None

## Definition of Done

- [ ] InPlaceEditor instances tracked in Map
- [ ] Editors created when directions displayed
- [ ] Field-specific configurations applied
- [ ] Editors destroyed before re-rendering
- [ ] Cleanup implemented in \_preDestroy()
- [ ] Edit functionality fully operational
- [ ] Validation working correctly
- [ ] No memory leaks detected
- [ ] All tests pass
- [ ] Manual testing confirms all edit operations work
- [ ] Code committed with descriptive message
