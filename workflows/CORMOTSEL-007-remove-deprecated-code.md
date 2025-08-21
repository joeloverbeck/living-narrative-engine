# CORMOTSEL-007: Remove Deprecated Methods and Code

## Priority: P2 (Medium)
## Estimated Effort: 0.5 hour
## Status: TODO

## Problem Statement
Several methods and code sections are no longer needed with the new implementation and should be removed to clean up the codebase. This includes div-based element creation, old event handlers, and single-concept loading logic.

## Implementation Details

### Step 1: Remove Deprecated Methods
Delete these entire methods from the controller:

```javascript
// DELETE these methods completely:

/**
 * @deprecated No longer needed - we load from all concepts
 */
async #loadCurrentConcept() {
  const concepts = await getAllCharacterConcepts();
  this.#currentConceptId = concepts[concepts.length - 1].id;
}

/**
 * @deprecated Replaced by #populateDirectionSelector()
 */
#displayDirections() {
  const container = document.getElementById('direction-selector');
  container.innerHTML = '';
  container.setAttribute('role', 'listbox');
  
  this.#eligibleDirections.forEach((direction) => {
    const element = this.#createDirectionElement(direction);
    container.appendChild(element);
  });
}

/**
 * @deprecated No longer creating div elements
 */
#createDirectionElement(direction) {
  const element = document.createElement('div');
  element.className = 'direction-item';
  element.setAttribute('role', 'option');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-selected', 'false');
  element.dataset.directionId = direction.id;
  
  element.innerHTML = `
    <div class="direction-title">${direction.title}</div>
    ${direction.description ? `<div class="direction-description">${direction.description}</div>` : ''}
  `;
  
  // Add click handler
  element.addEventListener('click', () => {
    this.#selectDirection(direction.id);
  });
  
  // Add keyboard handlers
  element.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.#selectDirection(direction.id);
    }
  });
  
  return element;
}

/**
 * @deprecated Replaced by #handleDirectionSelection()
 */
#selectDirection(directionId) {
  // Old selection logic
  this.#selectedDirectionId = directionId;
  this.#updateDirectionDisplay();
  this.#enableGenerateButton();
}

/**
 * @deprecated No longer needed with select element
 */
#updateDirectionDisplay() {
  const elements = document.querySelectorAll('.direction-item');
  elements.forEach(el => {
    el.setAttribute('aria-selected', 'false');
    el.classList.remove('selected');
  });
  
  const selected = document.querySelector(`[data-direction-id="${this.#selectedDirectionId}"]`);
  if (selected) {
    selected.setAttribute('aria-selected', 'true');
    selected.classList.add('selected');
  }
}
```

### Step 2: Remove Old Event Listener Setup
Remove div-specific event listener code:

```javascript
// In #setupEventListeners(), REMOVE:

// Old div-based listeners
const directionItems = document.querySelectorAll('.direction-item');
directionItems.forEach(item => {
  item.addEventListener('click', (e) => {
    const directionId = e.currentTarget.dataset.directionId;
    this.#selectDirection(directionId);
  });
});

// Old keyboard navigation for divs
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    // Remove this entire block of arrow key navigation for divs
  }
});
```

### Step 3: Remove Old CSS Classes
Remove CSS that was specific to div-based implementation:

```css
/* REMOVE from CSS file or style tags: */

.direction-item {
  padding: 10px;
  cursor: pointer;
  border: 1px solid transparent;
}

.direction-item:hover {
  background-color: #f0f0f0;
}

.direction-item.selected {
  background-color: #e0e0e0;
  border-color: #007bff;
}

.direction-item[aria-selected="true"] {
  font-weight: bold;
}

.direction-title {
  font-size: 14px;
  font-weight: 500;
}

.direction-description {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}
```

### Step 4: Remove Unused Imports
Check for and remove any imports that are no longer used:

```javascript
// Check and remove if unused:
// import { someUnusedFunction } from './unusedModule.js';
```

### Step 5: Remove Old Method Calls
Update any places that call removed methods:

```javascript
// In initialize() method, REMOVE:
// await this.#loadCurrentConcept();

// In any refresh methods, REMOVE calls to:
// this.#displayDirections();
// this.#updateDirectionDisplay();
```

### Step 6: Clean Up Comments
Remove or update outdated comments:

```javascript
// REMOVE comments like:
// "Load the current concept for this session"
// "Create div elements for each direction"
// "Handle div click events"

// UPDATE comments to reflect new implementation:
// Old: "Display directions as div elements"
// New: "Populate select dropdown with directions"
```

### Step 7: Remove Unused Properties
Remove properties that are no longer needed:

```javascript
// REMOVE from class properties:
// #currentConceptId = null;  // No longer needed
// #directionElements = [];   // If storing div references
// #selectedElement = null;   // If tracking selected div
```

## Acceptance Criteria
- [ ] All deprecated methods are removed
- [ ] No references to removed methods remain
- [ ] Old event listeners are removed
- [ ] Unused CSS classes are removed
- [ ] Unused imports are removed
- [ ] Outdated comments are updated or removed
- [ ] Code still compiles without errors
- [ ] All tests pass after cleanup

## Dependencies
- **CORMOTSEL-001** through **CORMOTSEL-006**: New implementation must be complete before removing old code

## Testing Requirements

### Manual Testing
1. Ensure page loads without console errors
2. Verify all functionality works with new implementation
3. Check that no old UI elements remain
4. Verify no broken event listeners

### Unit Tests
```javascript
describe('Deprecated Code Removal', () => {
  it('should not have deprecated methods', () => {
    const controller = new CoreMotivationsGeneratorController(dependencies);
    
    // These methods should not exist
    expect(controller.loadCurrentConcept).toBeUndefined();
    expect(controller.displayDirections).toBeUndefined();
    expect(controller.createDirectionElement).toBeUndefined();
    expect(controller.selectDirection).toBeUndefined();
  });
  
  it('should not have deprecated properties', () => {
    const controller = new CoreMotivationsGeneratorController(dependencies);
    
    // These properties should not exist
    expect(controller.currentConceptId).toBeUndefined();
    expect(controller.directionElements).toBeUndefined();
  });
  
  it('should not create div elements for directions', () => {
    controller.initialize();
    
    const divs = document.querySelectorAll('.direction-item');
    expect(divs.length).toBe(0);
  });
});
```

### Code Coverage Check
- Run coverage report to identify any dead code
- Ensure no unreachable code remains
- Verify all remaining code has test coverage

## Cleanup Checklist
- [ ] `#loadCurrentConcept()` removed
- [ ] `#displayDirections()` removed
- [ ] `#createDirectionElement()` removed
- [ ] `#selectDirection()` removed
- [ ] `#updateDirectionDisplay()` removed
- [ ] Div-specific event listeners removed
- [ ] Div-specific CSS classes removed
- [ ] `#currentConceptId` property removed
- [ ] Outdated comments updated
- [ ] Unused imports removed

## Related Files
- **Controller**: `src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js`
- **Styles**: `styles/core-motivations-generator.css` (if separate)
- **HTML**: `core-motivations-generator.html`

## Notes
- This cleanup should be done after all new functionality is working
- Keep a backup of the old code temporarily in case of issues
- Consider using version control to track these deletions
- Run linting and formatting after cleanup