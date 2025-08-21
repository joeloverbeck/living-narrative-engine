# CORMOTSEL-001: Fix HTML Violation - Replace DIV Elements with OPTION Elements

## Priority: P0 (Critical)
## Estimated Effort: 0.5-1 hour
## Status: TODO

## Problem Statement
The Core Motivations Generator controller is attempting to append `<div>` elements to a `<select>` element, which violates HTML standards and completely breaks the dropdown functionality. This is causing the direction selector to be non-functional.

### Current Broken Code Location
- **File**: `src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js`
- **Lines**: 227-248 (`#displayDirections()` method)

## Implementation Details

### Step 1: Create New Method `#populateDirectionSelector()`
Replace the broken `#displayDirections()` method with a new implementation:

```javascript
#populateDirectionSelector(organizedData) {
  const selector = document.getElementById('direction-selector');
  if (!selector) {
    this.logger.error('Direction selector element not found');
    return;
  }
  
  // Clear existing options (keep default)
  selector.innerHTML = '<option value="">-- Choose a thematic direction --</option>';
  
  // Add optgroups for each concept
  for (const conceptGroup of organizedData) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = conceptGroup.conceptTitle;
    
    for (const direction of conceptGroup.directions) {
      const option = document.createElement('option');
      option.value = direction.id;
      option.textContent = direction.title;
      option.dataset.conceptId = conceptGroup.conceptId;
      optgroup.appendChild(option);
    }
    
    selector.appendChild(optgroup);
  }
  
  // Dispatch event for UI updates
  this.eventBus.dispatch('core:directions_loaded', {
    count: organizedData.reduce((sum, group) => sum + group.directions.length, 0),
    concepts: organizedData.length
  });
}
```

### Step 2: Update Method Calls
Find all places where `#displayDirections()` is called and replace with `#populateDirectionSelector()`:
- In `#loadEligibleDirections()` method
- Any other initialization or refresh methods

### Step 3: Remove Invalid HTML Attributes
Remove any code that sets invalid roles on the select element:
```javascript
// REMOVE:
container.setAttribute('role', 'listbox');  // Wrong role for select
```

## Acceptance Criteria
- [ ] Select element receives only `<option>` and `<optgroup>` elements as children
- [ ] No `<div>` elements are created for the dropdown
- [ ] HTML validation passes with no errors
- [ ] Dropdown displays correctly in the browser
- [ ] No console errors related to invalid HTML structure

## Dependencies
- None (this is the first critical fix)

## Testing Requirements

### Manual Testing
1. Open Core Motivations Generator page
2. Inspect the direction selector element in DevTools
3. Verify only `<option>` and `<optgroup>` elements are present
4. Verify dropdown functions normally (can click to open, select items)

### Unit Test
```javascript
describe('#populateDirectionSelector', () => {
  it('should only create option and optgroup elements', () => {
    const mockData = [
      {
        conceptId: 'concept1',
        conceptTitle: 'Test Concept',
        directions: [
          { id: 'dir1', title: 'Direction 1' }
        ]
      }
    ];
    
    controller.populateDirectionSelector(mockData);
    
    const selector = document.getElementById('direction-selector');
    const divElements = selector.querySelectorAll('div');
    expect(divElements.length).toBe(0);
    
    const optionElements = selector.querySelectorAll('option');
    expect(optionElements.length).toBeGreaterThan(0);
  });
});
```

## Related Files
- **HTML Template**: `/core-motivations-generator.html` (lines 57-64)
- **Working Example**: `/src/clichesGenerator/controllers/ClichesGeneratorController.js`

## Notes
- This is the most critical issue as it completely breaks functionality
- Must be fixed before any other improvements can be tested
- Follow the pattern from ClichesGeneratorController for consistency