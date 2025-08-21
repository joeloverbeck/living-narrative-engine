# CORMOTSEL-004: Filter Directions to Only Those with Clichés

## Priority: P0 (Critical)

## Estimated Effort: 0.5-1 hour

## Status: TODO

## Problem Statement

The Core Motivations Generator should only show thematic directions that have associated clichés, as it needs these clichés to generate meaningful core motivations. Currently, it may show directions without clichés, which would cause generation to fail.

### Business Logic

Core motivations are generated based on the clichés associated with a thematic direction. Without clichés, the AI cannot generate appropriate motivations.

## Implementation Details

### Step 1: Add Filtering Logic in `#loadEligibleDirections()`

Update the method to filter directions based on cliché availability:

```javascript
async #loadEligibleDirections() {
  try {
    // Step 1: Get ALL directions with their concepts
    const directionsWithConcepts =
      await this.characterBuilderService.getAllThematicDirectionsWithConcepts();

    if (!directionsWithConcepts || directionsWithConcepts.length === 0) {
      this.#eligibleDirections = [];
      this.#showEmptyState();
      return;
    }

    // Step 2: Filter to only those with clichés
    const eligibleDirections = [];
    const totalDirections = directionsWithConcepts.length;
    let checkedCount = 0;

    for (const item of directionsWithConcepts) {
      checkedCount++;

      // Check if this direction has associated clichés
      const hasClichés = await this.characterBuilderService.hasClichesForDirection(
        item.direction.id
      );

      if (hasClichés) {
        eligibleDirections.push(item);
        this.logger.debug(`Direction "${item.direction.title}" has clichés`);
      } else {
        this.logger.debug(`Direction "${item.direction.title}" has no clichés - excluding`);
      }

      // Optional: Update progress if UI supports it
      this.#updateLoadingProgress(checkedCount, totalDirections);
    }

    // Log filtering results
    this.logger.info(`Filtered ${totalDirections} directions to ${eligibleDirections.length} with clichés`);

    if (eligibleDirections.length === 0) {
      this.#showEmptyStateNoClichés();
      return;
    }

    // Step 3: Store the filtered data map for later use
    this.#directionsWithConceptsMap = new Map(
      eligibleDirections.map((item) => [item.direction.id, item])
    );

    // Continue with organization and display...
    const directions = eligibleDirections.map((item) => item.direction);
    this.#eligibleDirections = await this.#organizeDirectionsByConcept(directions);
    this.#populateDirectionSelector(this.#eligibleDirections);

  } catch (error) {
    this.logger.error('Failed to load eligible directions', error);
    this.#handleError(error, 'Failed to load thematic directions');
  }
}
```

### Step 2: Add Specific Empty State for No Clichés

Create a method to show when directions exist but none have clichés:

```javascript
#showEmptyStateNoClichés() {
  const selector = document.getElementById('direction-selector');
  if (selector) {
    selector.innerHTML = '<option value="">No directions with clichés available</option>';
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
      <div class="alert alert-warning">
        <h4>No Eligible Directions Found</h4>
        <p>Thematic directions exist, but none have associated clichés.</p>
        <p>To use the Core Motivations Generator:</p>
        <ol>
          <li>Go to the Clichés Generator</li>
          <li>Select a thematic direction</li>
          <li>Generate clichés for it</li>
          <li>Return here to generate core motivations</li>
        </ol>
      </div>
    `;
  }

  this.eventBus.dispatch('core:no_eligible_directions', {
    reason: 'no_cliches'
  });
}
```

### Step 3: Add Optional Progress Indicator

For better UX when checking many directions:

```javascript
#updateLoadingProgress(current, total) {
  // Update a progress indicator if it exists
  const progressElement = document.getElementById('loading-progress');
  if (progressElement) {
    const percentage = Math.round((current / total) * 100);
    progressElement.textContent = `Checking directions: ${current}/${total} (${percentage}%)`;
  }

  // Optional: Update progress bar
  const progressBar = document.getElementById('loading-progress-bar');
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage);
  }
}
```

### Step 4: Verify Service Method Exists

Ensure `hasClichesForDirection()` exists in the character builder service:

```javascript
// In characterBuilderService.js
async hasClichesForDirection(directionId) {
  try {
    const clichés = await getClichesByDirectionId(directionId);
    return clichés && clichés.length > 0;
  } catch (error) {
    this.logger.error(`Failed to check clichés for direction ${directionId}`, error);
    return false;
  }
}
```

## Acceptance Criteria

- [ ] Only directions with associated clichés appear in dropdown
- [ ] Directions without clichés are filtered out
- [ ] Appropriate empty state shown when no directions have clichés
- [ ] Console logs show filtering statistics
- [ ] Progress indicator updates during filtering (if implemented)
- [ ] Service method `hasClichesForDirection()` is called for each direction

## Dependencies

- **CORMOTSEL-003**: Must load all directions first before filtering
- **Character Builder Service**: Must have `hasClichesForDirection()` method

## Testing Requirements

### Manual Testing

1. Create thematic directions without clichés
2. Create other directions with clichés
3. Open Core Motivations Generator
4. Verify only directions with clichés appear
5. Check console for filtering logs

### Unit Tests

```javascript
describe('Direction Filtering', () => {
  it('should filter out directions without clichés', async () => {
    const mockDirections = [
      { direction: { id: 'dir1', title: 'Has Clichés' }, concept: {} },
      { direction: { id: 'dir2', title: 'No Clichés' }, concept: {} },
      { direction: { id: 'dir3', title: 'Also Has Clichés' }, concept: {} },
    ];

    jest
      .spyOn(characterBuilderService, 'getAllThematicDirectionsWithConcepts')
      .mockResolvedValue(mockDirections);

    jest
      .spyOn(characterBuilderService, 'hasClichesForDirection')
      .mockImplementation((id) => {
        return Promise.resolve(id !== 'dir2');
      });

    await controller.loadEligibleDirections();

    expect(controller.directionsWithConceptsMap.size).toBe(2);
    expect(controller.directionsWithConceptsMap.has('dir1')).toBe(true);
    expect(controller.directionsWithConceptsMap.has('dir2')).toBe(false);
    expect(controller.directionsWithConceptsMap.has('dir3')).toBe(true);
  });

  it('should show specific empty state when no directions have clichés', async () => {
    jest
      .spyOn(characterBuilderService, 'hasClichesForDirection')
      .mockResolvedValue(false);

    await controller.loadEligibleDirections();

    const messageContainer = document.getElementById('message-container');
    expect(messageContainer.innerHTML).toContain(
      'none have associated clichés'
    );
  });
});
```

## Performance Considerations

- For many directions (50+), the filtering process may take time
- Consider implementing pagination or lazy loading
- Cache the results to avoid re-filtering on every page load

## Related Files

- **Character Builder Service**: `src/characterBuilder/services/characterBuilderService.js`
- **Clichés Storage**: `src/characterBuilder/repositories/clichesRepository.js`

## Notes

- This filtering ensures the generator only shows actionable directions
- Consider adding a "refresh" button to re-check for new clichés
- The filtering happens on every page load to catch newly added clichés
