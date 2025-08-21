# CORMOTSEL-003: Load All Thematic Directions from All Concepts

## Priority: P0 (Critical)

## Estimated Effort: 1 hour

## Status: TODO

## Problem Statement

The current implementation only loads thematic directions from the most recent (latest) character concept. This is incorrect - the generator should load ALL thematic directions from ALL concepts, similar to how the clichés generator works.

### Current Broken Code Location

- **File**: `src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js`
- **Lines**: 113-143
- **Methods**: `#loadCurrentConcept()` and `#loadEligibleDirections()`

## Implementation Details

### Step 1: Remove Single-Concept Loading

Delete or comment out the `#loadCurrentConcept()` method entirely:

```javascript
// DELETE THIS METHOD:
async #loadCurrentConcept() {
  const concepts = await getAllCharacterConcepts();
  // WRONG: Only uses the last concept
  this.#currentConceptId = concepts[concepts.length - 1].id;
}
```

### Step 2: Update `#loadEligibleDirections()` Method

Replace the current implementation with one that loads from ALL concepts:

```javascript
async #loadEligibleDirections() {
  try {
    // Step 1: Get ALL directions with their concepts (matching clichés generator)
    const directionsWithConcepts =
      await this.characterBuilderService.getAllThematicDirectionsWithConcepts();

    if (!directionsWithConcepts || directionsWithConcepts.length === 0) {
      this.#eligibleDirections = [];
      this.#showEmptyState();
      return;
    }

    // Step 2: Filter to only those with clichés (implemented in CORMOTSEL-004)
    const eligibleDirections = [];
    for (const item of directionsWithConcepts) {
      const hasClichés = await this.characterBuilderService.hasClichesForDirection(
        item.direction.id
      );
      if (hasClichés) {
        eligibleDirections.push(item);
      }
    }

    // Step 3: Store the filtered data map for later use
    this.#directionsWithConceptsMap = new Map(
      eligibleDirections.map((item) => [item.direction.id, item])
    );

    // Step 4: Extract just the directions for organization
    const directions = eligibleDirections.map((item) => item.direction);

    // Step 5: Organize by concept for display (implemented in CORMOTSEL-005)
    this.#eligibleDirections = await this.#organizeDirectionsByConcept(directions);

    // Step 6: Populate the select dropdown (implemented in CORMOTSEL-001)
    this.#populateDirectionSelector(this.#eligibleDirections);

    this.logger.info(`Loaded ${eligibleDirections.length} eligible directions from ${this.#eligibleDirections.length} concepts`);

  } catch (error) {
    this.logger.error('Failed to load eligible directions', error);
    this.#handleError(error, 'Failed to load thematic directions');
  }
}
```

### Step 3: Add Empty State Handler

Implement method to show when no directions are available:

```javascript
#showEmptyState() {
  const selector = document.getElementById('direction-selector');
  if (selector) {
    selector.innerHTML = '<option value="">No thematic directions available</option>';
    selector.disabled = true;
  }

  const generateBtn = document.getElementById('generate-btn');
  if (generateBtn) {
    generateBtn.disabled = true;
  }

  // Show helpful message to user
  const messageContainer = document.getElementById('message-container');
  if (messageContainer) {
    messageContainer.innerHTML = `
      <div class="alert alert-info">
        <p>No thematic directions with clichés found.</p>
        <p>Please create thematic directions and add clichés first.</p>
      </div>
    `;
  }

  this.eventBus.dispatch('core:no_directions_available', {});
}
```

### Step 4: Update Initialization

Remove the call to `#loadCurrentConcept()` from the `initialize()` method:

```javascript
async initialize() {
  try {
    this.logger.info('Initializing Core Motivations Generator Controller');

    // REMOVE THIS LINE:
    // await this.#loadCurrentConcept();

    // Load ALL eligible directions (those with clichés)
    await this.#loadEligibleDirections();

    // Rest of initialization...
    this.#setupEventListeners();
    this.#setupFocusManagement();
    // ... etc
  } catch (error) {
    this.logger.error('Failed to initialize controller', error);
    this.#handleError(error, 'Failed to initialize Core Motivations Generator');
  }
}
```

## Acceptance Criteria

- [ ] All thematic directions from ALL concepts are loaded
- [ ] Not limited to just the latest/most recent concept
- [ ] `getAllThematicDirectionsWithConcepts()` service method is called
- [ ] Directions are properly mapped with their parent concepts
- [ ] Empty state is shown when no directions exist
- [ ] Console logs show correct count of directions and concepts

## Dependencies

- **CORMOTSEL-001**: Need working dropdown to display results
- **CORMOTSEL-004**: Will filter for directions with clichés
- **CORMOTSEL-005**: Will organize directions by concept

## Testing Requirements

### Manual Testing

1. Create multiple character concepts
2. Add thematic directions to each concept
3. Open Core Motivations Generator
4. Verify ALL directions appear, not just from latest concept
5. Check console for log showing direction and concept counts

### Unit Tests

```javascript
describe('#loadEligibleDirections', () => {
  it('should load directions from all concepts', async () => {
    const mockDirectionsWithConcepts = [
      {
        direction: { id: 'dir1', conceptId: 'concept1' },
        concept: { id: 'concept1', title: 'Concept 1' },
      },
      {
        direction: { id: 'dir2', conceptId: 'concept2' },
        concept: { id: 'concept2', title: 'Concept 2' },
      },
      {
        direction: { id: 'dir3', conceptId: 'concept1' },
        concept: { id: 'concept1', title: 'Concept 1' },
      },
    ];

    jest
      .spyOn(characterBuilderService, 'getAllThematicDirectionsWithConcepts')
      .mockResolvedValue(mockDirectionsWithConcepts);

    await controller.loadEligibleDirections();

    expect(
      characterBuilderService.getAllThematicDirectionsWithConcepts
    ).toHaveBeenCalled();
    expect(controller.directionsWithConceptsMap.size).toBe(3);
  });

  it('should show empty state when no directions exist', async () => {
    jest
      .spyOn(characterBuilderService, 'getAllThematicDirectionsWithConcepts')
      .mockResolvedValue([]);

    await controller.loadEligibleDirections();

    const selector = document.getElementById('direction-selector');
    expect(selector.disabled).toBe(true);
    expect(selector.innerHTML).toContain('No thematic directions available');
  });
});
```

## Related Files

- **Character Builder Service**: `src/characterBuilder/services/characterBuilderService.js`
- **Working Example**: `src/clichesGenerator/controllers/ClichesGeneratorController.js`

## Notes

- This change aligns with the clichés generator pattern
- Must handle the case where no concepts or directions exist gracefully
- Consider adding a refresh button if directions are added while page is open
