# CORMOTSEL-005: Organize Directions by Concept Using Optgroups

## Priority: P1 (High)

## Estimated Effort: 1 hour

## Status: TODO

## Problem Statement

Thematic directions need to be organized by their parent concepts in the dropdown using HTML optgroups. This improves usability when there are many directions across multiple concepts, making it easier for users to find and understand the context of each direction.

## Implementation Details

### Step 1: Add `#organizeDirectionsByConcept()` Method

Create a new method to organize directions into concept groups:

```javascript
async #organizeDirectionsByConcept(directions) {
  const organized = [];
  const conceptMap = new Map();

  for (const direction of directions) {
    if (!conceptMap.has(direction.conceptId)) {
      // Get concept from our cached map first
      let concept = null;
      const directionWithConcept = this.#directionsWithConceptsMap.get(
        direction.id
      );

      if (directionWithConcept && directionWithConcept.concept) {
        concept = directionWithConcept.concept;
      } else {
        // Fallback: fetch the concept if not in cache
        this.logger.warn(`Concept not in cache for direction ${direction.id}, fetching...`);
        concept = await this.characterBuilderService.getCharacterConcept(
          direction.conceptId
        );
      }

      if (concept) {
        conceptMap.set(direction.conceptId, {
          conceptId: direction.conceptId,
          conceptTitle: concept.title || `Concept ${direction.conceptId}`,
          directions: []
        });
      } else {
        this.logger.warn(`Concept not found for ID: ${direction.conceptId}`);
        // Create a fallback group for orphaned directions
        conceptMap.set(direction.conceptId, {
          conceptId: direction.conceptId,
          conceptTitle: `Unknown Concept (${direction.conceptId})`,
          directions: []
        });
      }
    }

    // Add direction to its concept group
    const group = conceptMap.get(direction.conceptId);
    if (group) {
      group.directions.push(direction);
    }
  }

  // Convert map to array and sort
  const organizedArray = Array.from(conceptMap.values());

  // Sort concept groups alphabetically by title
  organizedArray.sort((a, b) =>
    a.conceptTitle.localeCompare(b.conceptTitle)
  );

  // Sort directions within each concept group
  organizedArray.forEach(group => {
    group.directions.sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  });

  this.logger.info(`Organized ${directions.length} directions into ${organizedArray.length} concept groups`);

  return organizedArray;
}
```

### Step 2: Update `#populateDirectionSelector()` to Use Optgroups

Modify the population method to create optgroup elements:

```javascript
#populateDirectionSelector(organizedData) {
  const selector = document.getElementById('direction-selector');
  if (!selector) {
    this.logger.error('Direction selector element not found');
    return;
  }

  // Clear existing options (keep default)
  selector.innerHTML = '<option value="">-- Choose a thematic direction --</option>';

  // Track statistics
  let totalDirections = 0;

  // Add optgroups for each concept
  for (const conceptGroup of organizedData) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = conceptGroup.conceptTitle;
    optgroup.id = `optgroup-${conceptGroup.conceptId}`;

    // Add directions as options within the optgroup
    for (const direction of conceptGroup.directions) {
      const option = document.createElement('option');
      option.value = direction.id;
      option.textContent = direction.title;

      // Add data attributes for additional context
      option.dataset.conceptId = conceptGroup.conceptId;
      option.dataset.conceptTitle = conceptGroup.conceptTitle;
      option.dataset.directionTitle = direction.title;

      // Add description as title for tooltip
      if (direction.description) {
        option.title = direction.description;
      }

      optgroup.appendChild(option);
      totalDirections++;
    }

    selector.appendChild(optgroup);
  }

  // Log population results
  this.logger.info(`Populated selector with ${totalDirections} directions in ${organizedData.length} groups`);

  // Dispatch event for UI updates
  this.eventBus.dispatch('core:directions_loaded', {
    totalDirections,
    conceptGroups: organizedData.length,
    groups: organizedData.map(g => ({
      conceptId: g.conceptId,
      conceptTitle: g.conceptTitle,
      directionCount: g.directions.length
    }))
  });
}
```

### Step 3: Update Data Structure Type

Add JSDoc type definitions for clarity:

```javascript
/**
 * @typedef {Object} ConceptGroup
 * @property {string} conceptId - The concept's unique identifier
 * @property {string} conceptTitle - The concept's display title
 * @property {Array<ThematicDirection>} directions - Directions in this concept
 */

/**
 * @typedef {Object} ThematicDirection
 * @property {string} id - The direction's unique identifier
 * @property {string} conceptId - The parent concept's ID
 * @property {string} title - The direction's display title
 * @property {string} [description] - Optional description
 */

class CoreMotivationsGeneratorController extends BaseCharacterBuilderController {
  /**
   * @type {Array<ConceptGroup>}
   */
  #eligibleDirections = [];

  /**
   * @type {Map<string, {direction: ThematicDirection, concept: CharacterConcept}>}
   */
  #directionsWithConceptsMap = new Map();

  // ... rest of class
}
```

### Step 4: Add Styling for Optgroups (Optional)

Add CSS to style the optgroups for better visual hierarchy:

```css
/* In core-motivations-generator.css or inline styles */
#direction-selector optgroup {
  font-weight: bold;
  color: #333;
  background-color: #f5f5f5;
}

#direction-selector option {
  font-weight: normal;
  padding-left: 1em;
  color: #000;
  background-color: white;
}

#direction-selector option:hover {
  background-color: #e9ecef;
}

/* Style for disabled optgroups if needed */
#direction-selector optgroup:disabled {
  color: #999;
  font-style: italic;
}
```

## Acceptance Criteria

- [ ] Directions are grouped by their parent concepts
- [ ] Each concept appears as an optgroup with its title as label
- [ ] Directions within each group are sorted alphabetically
- [ ] Concept groups are sorted alphabetically
- [ ] Orphaned directions (missing concept) are handled gracefully
- [ ] Dropdown displays proper visual hierarchy

## Dependencies

- **CORMOTSEL-003**: Must have all directions loaded
- **CORMOTSEL-004**: Must have filtered directions
- **CORMOTSEL-001**: Must have working dropdown structure

## Testing Requirements

### Manual Testing

1. Create multiple concepts with different names
2. Add multiple directions to each concept
3. Add clichés to make directions eligible
4. Open Core Motivations Generator
5. Verify directions are grouped by concept in dropdown
6. Verify alphabetical sorting of both concepts and directions

### Unit Tests

```javascript
describe('#organizeDirectionsByConcept', () => {
  it('should group directions by concept', async () => {
    const directions = [
      { id: 'dir1', conceptId: 'concept1', title: 'B Direction' },
      { id: 'dir2', conceptId: 'concept2', title: 'A Direction' },
      { id: 'dir3', conceptId: 'concept1', title: 'A Direction' },
    ];

    const organized = await controller.organizeDirectionsByConcept(directions);

    expect(organized).toHaveLength(2);
    expect(organized[0].directions).toHaveLength(2);
    expect(organized[1].directions).toHaveLength(1);
  });

  it('should sort concepts and directions alphabetically', async () => {
    const directions = [
      { id: 'dir1', conceptId: 'b-concept', title: 'Z Direction' },
      { id: 'dir2', conceptId: 'a-concept', title: 'B Direction' },
      { id: 'dir3', conceptId: 'a-concept', title: 'A Direction' },
    ];

    controller.directionsWithConceptsMap = new Map([
      ['dir1', { direction: directions[0], concept: { title: 'B Concept' } }],
      ['dir2', { direction: directions[1], concept: { title: 'A Concept' } }],
      ['dir3', { direction: directions[2], concept: { title: 'A Concept' } }],
    ]);

    const organized = await controller.organizeDirectionsByConcept(directions);

    // Check concept order
    expect(organized[0].conceptTitle).toBe('A Concept');
    expect(organized[1].conceptTitle).toBe('B Concept');

    // Check direction order within first concept
    expect(organized[0].directions[0].title).toBe('A Direction');
    expect(organized[0].directions[1].title).toBe('B Direction');
  });

  it('should create optgroups in the select element', () => {
    const organizedData = [
      {
        conceptId: 'c1',
        conceptTitle: 'Test Concept',
        directions: [{ id: 'd1', title: 'Test Direction' }],
      },
    ];

    controller.populateDirectionSelector(organizedData);

    const selector = document.getElementById('direction-selector');
    const optgroups = selector.querySelectorAll('optgroup');

    expect(optgroups).toHaveLength(1);
    expect(optgroups[0].label).toBe('Test Concept');
  });
});
```

## Related Files

- **Working Example**: `src/clichesGenerator/controllers/ClichesGeneratorController.js`
- **HTML Template**: `core-motivations-generator.html`

## Notes

- This organization pattern matches the clichés generator for consistency
- Consider adding expand/collapse functionality for large concept groups
- The visual hierarchy helps users understand the relationship between concepts and directions
