# CORMOTSEL-002: Implement Proper Select Element Event Handling

## Priority: P0 (Critical)
## Estimated Effort: 1 hour
## Status: TODO

## Problem Statement
The current implementation uses div-specific click and keydown event handlers which don't work with a proper `<select>` element. We need to implement standard select element change event handling.

### Current Broken Code Location
- **File**: `src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js`
- **Method**: `#createDirectionElement()` and related event handlers

## Implementation Details

### Step 1: Update `#setupEventListeners()` Method
Add proper select element change handler:

```javascript
#setupEventListeners() {
  // Select element change handler
  const selector = document.getElementById('direction-selector');
  selector?.addEventListener('change', (e) => {
    if (e.target.value) {
      this.#handleDirectionSelection(e.target.value);
    } else {
      // Clear selection
      this.#clearDirectionSelection();
    }
  });
  
  // Keep existing event listeners for other elements
  const generateBtn = document.getElementById('generate-btn');
  generateBtn?.addEventListener('click', () => this.#handleGenerate());
  
  // Keep other existing listeners for export, clear, etc.
  const exportBtn = document.getElementById('export-btn');
  exportBtn?.addEventListener('click', () => this.#handleExport());
  
  const clearBtn = document.getElementById('clear-storage-btn');
  clearBtn?.addEventListener('click', () => this.#handleClearStorage());
  
  // Keyboard shortcuts remain the same
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.#handleGenerate();
      } else if (e.key === 'e') {
        e.preventDefault();
        this.#handleExport();
      } else if (e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        this.#handleClearStorage();
      }
    }
  });
}
```

### Step 2: Implement `#handleDirectionSelection()` Method
Create new method to handle direction selection:

```javascript
async #handleDirectionSelection(directionId) {
  try {
    // Validate direction ID
    if (!directionId) {
      this.#clearDirectionSelection();
      return;
    }
    
    // Get direction and concept from cache
    const directionWithConcept = this.#directionsWithConceptsMap.get(directionId);
    if (!directionWithConcept) {
      throw new Error(`Direction not found: ${directionId}`);
    }
    
    // Update state
    this.#selectedDirectionId = directionId;
    this.#currentDirection = directionWithConcept.direction;
    this.#currentConcept = directionWithConcept.concept;
    
    // Update UI
    this.#updateUIState();
    
    // Enable generate button
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.disabled = false;
    }
    
    // Dispatch selection event
    this.eventBus.dispatch('core:direction_selected', {
      directionId,
      conceptId: directionWithConcept.direction.conceptId,
      directionTitle: directionWithConcept.direction.title,
      conceptTitle: directionWithConcept.concept?.title
    });
    
  } catch (error) {
    this.logger.error('Failed to handle direction selection', error);
    this.#handleError(error, 'Failed to select direction');
  }
}
```

### Step 3: Implement `#clearDirectionSelection()` Method
Add method to handle clearing selection:

```javascript
#clearDirectionSelection() {
  this.#selectedDirectionId = null;
  this.#currentDirection = null;
  this.#currentConcept = null;
  
  // Disable generate button
  const generateBtn = document.getElementById('generate-btn');
  if (generateBtn) {
    generateBtn.disabled = true;
  }
  
  // Reset dropdown to default
  const selector = document.getElementById('direction-selector');
  if (selector) {
    selector.value = '';
  }
  
  this.#updateUIState();
  
  // Dispatch clear event
  this.eventBus.dispatch('core:direction_cleared', {});
}
```

### Step 4: Remove Old Event Handling Code
Remove the following methods and any references to them:
- `#createDirectionElement()` - entire method
- Any div-specific click handlers
- Any div-specific keyboard handlers
- Any code that adds event listeners to individual direction elements

## Acceptance Criteria
- [ ] Select element change event properly triggers direction selection
- [ ] Selecting a direction enables the generate button
- [ ] Clearing selection (choosing default option) disables generate button
- [ ] State updates correctly when selection changes
- [ ] No leftover div-specific event handlers
- [ ] Keyboard shortcuts (Ctrl+Enter, etc.) still work
- [ ] Event bus properly dispatches selection events

## Dependencies
- **CORMOTSEL-001**: Must have working select element with options first

## Testing Requirements

### Manual Testing
1. Select a direction from dropdown → Verify generate button enables
2. Change to different direction → Verify state updates
3. Select default "-- Choose --" option → Verify generate button disables
4. Test keyboard shortcuts still work (Ctrl+Enter, Ctrl+E, Ctrl+Shift+Del)

### Unit Tests
```javascript
describe('Select Event Handling', () => {
  it('should handle direction selection from dropdown', async () => {
    const mockDirectionId = 'dir1';
    const selector = document.getElementById('direction-selector');
    
    // Simulate selection
    selector.value = mockDirectionId;
    selector.dispatchEvent(new Event('change'));
    
    expect(controller.selectedDirectionId).toBe(mockDirectionId);
    expect(generateBtn.disabled).toBe(false);
  });
  
  it('should clear selection when default option chosen', () => {
    const selector = document.getElementById('direction-selector');
    
    // Simulate clearing
    selector.value = '';
    selector.dispatchEvent(new Event('change'));
    
    expect(controller.selectedDirectionId).toBeNull();
    expect(generateBtn.disabled).toBe(true);
  });
  
  it('should dispatch correct events on selection', async () => {
    const eventSpy = jest.spyOn(eventBus, 'dispatch');
    
    // Simulate selection
    await controller.handleDirectionSelection('dir1');
    
    expect(eventSpy).toHaveBeenCalledWith('core:direction_selected', 
      expect.objectContaining({
        directionId: 'dir1'
      })
    );
  });
});
```

## Related Files
- **Controller**: `src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js`
- **Working Example**: `src/clichesGenerator/controllers/ClichesGeneratorController.js`

## Notes
- This fix is critical for making the dropdown functional
- Must maintain backward compatibility with keyboard shortcuts
- Consider adding aria-live regions for accessibility