# TURORDTIC-004: Implement Actor Display Data Extraction

## Status
Ready for Implementation

## Priority
High - Required for rendering actors

## Dependencies
- TURORDTIC-003 (class skeleton must exist)

## Description
Implement the `#getActorDisplayData()` private method that extracts actor name and portrait path from entity components. This method provides a consistent interface for retrieving display information regardless of component availability.

## Affected Files
- `src/domUI/turnOrderTickerRenderer.js` (modify)

## Current Behavior
The method stub returns only the entity ID:
```javascript
#getActorDisplayData(entityId) {
  return { name: entityId };
}
```

## Implementation

### Replace Method Implementation

**Location:** `src/domUI/turnOrderTickerRenderer.js`

Replace the stub with:

```javascript
/**
 * Extract display data (name, portrait) for an actor.
 * Handles missing components gracefully with fallbacks.
 *
 * @param {string} entityId - Entity ID of the actor
 * @returns {{ name: string, portraitPath?: string, participating: boolean }} Display data
 * @private
 */
#getActorDisplayData(entityId) {
  try {
    // Use EntityDisplayDataProvider for name and portrait
    const displayData = this.#entityDisplayDataProvider.getDisplayData(entityId);

    // Extract name (fallback to entity ID if not available)
    const name = displayData?.name || entityId;

    // Extract portrait path (optional)
    const portraitPath = displayData?.portraitPath || null;

    // Check participation status
    let participating = true; // Default to true
    if (this.#entityManager.hasComponent(entityId, PARTICIPATION_COMPONENT_ID)) {
      const participationComponent = this.#entityManager.getComponent(
        entityId,
        PARTICIPATION_COMPONENT_ID
      );
      participating = participationComponent?.participating ?? true;
    }

    this.#logger.debug('Actor display data extracted', {
      entityId,
      name,
      hasPortrait: !!portraitPath,
      participating,
    });

    return {
      name,
      portraitPath,
      participating,
    };
  } catch (error) {
    // If any error occurs, return minimal fallback data
    this.#logger.warn('Failed to extract actor display data, using fallback', {
      entityId,
      error: error.message,
    });

    return {
      name: entityId,
      portraitPath: null,
      participating: true,
    };
  }
}
```

### Add Import for Participation Component

At the top of the file, ensure this import exists (should already be there from TURORDTIC-003):
```javascript
import { PARTICIPATION_COMPONENT_ID } from '../constants/componentIds.js';
```

## Edge Cases Handled

### 1. Missing EntityDisplayDataProvider Data
**Scenario:** `getDisplayData()` returns null or undefined
**Solution:** Fallback to entity ID for name

### 2. Missing Name Component
**Scenario:** Actor has no `core:name` component
**Solution:** EntityDisplayDataProvider should handle this, but we fallback to entity ID as secondary safeguard

### 3. Missing Portrait Component
**Scenario:** Actor has no `core:portrait` component
**Solution:** Return `portraitPath: null`, caller will render name badge instead

### 4. Invalid Portrait Path
**Scenario:** Portrait path is empty string or invalid
**Solution:** Treat as `null`, will be handled by image `onerror` in next ticket

### 5. Missing Participation Component
**Scenario:** Actor has no `core:participation` component
**Solution:** Default to `participating: true` (actors participate by default)

### 6. Exception During Data Extraction
**Scenario:** Any method call throws an error
**Solution:** Catch and return minimal fallback data, log warning

## Testing

### Unit Tests
**File:** `tests/unit/domUI/turnOrderTickerRenderer.test.js`

Add test suite:

```javascript
describe('TurnOrderTickerRenderer - Display Data Extraction', () => {
  let renderer;
  let mockLogger;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockContainer;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getComponent: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockEntityDisplayDataProvider = {
      getDisplayData: jest.fn(),
    };

    mockContainer = document.createElement('div');
    mockContainer.innerHTML = `
      <span id="ticker-round-number"></span>
      <div id="ticker-actor-queue"></div>
    `;

    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: {
        query: (selector) => mockContainer.querySelector(selector),
        queryAll: jest.fn(),
      },
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(() => 'sub-id'),
        unsubscribe: jest.fn(),
      },
      domElementFactory: {
        createElement: jest.fn(() => document.createElement('div')),
      },
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });
  });

  it('should extract name and portrait when both exist', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Alice',
      portraitPath: '/path/to/alice.jpg',
    });
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer['#getActorDisplayData']('actor-1');

    expect(result).toEqual({
      name: 'Alice',
      portraitPath: '/path/to/alice.jpg',
      participating: true,
    });
  });

  it('should fallback to entity ID when name missing', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      portraitPath: '/path/to/portrait.jpg',
    });
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer['#getActorDisplayData']('actor-1');

    expect(result.name).toBe('actor-1');
  });

  it('should handle missing portrait gracefully', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Bob',
    });
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer['#getActorDisplayData']('actor-2');

    expect(result).toEqual({
      name: 'Bob',
      portraitPath: null,
      participating: true,
    });
  });

  it('should extract participation status when component exists', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Charlie',
    });
    mockEntityManager.hasComponent.mockReturnValue(true);
    mockEntityManager.getComponent.mockReturnValue({
      participating: false,
    });

    const result = renderer['#getActorDisplayData']('actor-3');

    expect(result.participating).toBe(false);
  });

  it('should default to participating true when component missing', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Diana',
    });
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer['#getActorDisplayData']('actor-4');

    expect(result.participating).toBe(true);
  });

  it('should handle null display data provider result', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue(null);
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer['#getActorDisplayData']('actor-5');

    expect(result).toEqual({
      name: 'actor-5',
      portraitPath: null,
      participating: true,
    });
  });

  it('should handle exception and return fallback', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockImplementation(() => {
      throw new Error('Service unavailable');
    });

    const result = renderer['#getActorDisplayData']('actor-6');

    expect(result).toEqual({
      name: 'actor-6',
      portraitPath: null,
      participating: true,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to extract actor display data, using fallback',
      expect.objectContaining({
        entityId: 'actor-6',
        error: 'Service unavailable',
      })
    );
  });

  it('should log debug information for successful extraction', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Eve',
      portraitPath: '/path/to/eve.jpg',
    });
    mockEntityManager.hasComponent.mockReturnValue(false);

    renderer['#getActorDisplayData']('actor-7');

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Actor display data extracted',
      expect.objectContaining({
        entityId: 'actor-7',
        name: 'Eve',
        hasPortrait: true,
        participating: true,
      })
    );
  });
});
```

### Testing Commands
```bash
# Run unit tests for this method
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --testNamePattern="Display Data Extraction" --verbose

# Run all ticker renderer tests
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --silent
```

## Acceptance Criteria
- [ ] Method extracts name from `EntityDisplayDataProvider`
- [ ] Method extracts portrait path from `EntityDisplayDataProvider`
- [ ] Method extracts participation status from entity components
- [ ] Fallback to entity ID when name missing
- [ ] Return `null` for portrait when missing
- [ ] Default to `participating: true` when component missing
- [ ] Handle exceptions gracefully with fallback data
- [ ] Log debug information for successful extraction
- [ ] Log warning for extraction failures
- [ ] All unit tests pass

## Performance Considerations
- Method is called once per actor per render
- Uses existing `EntityDisplayDataProvider` (already optimized)
- Component lookups are cached by `EntityManager`
- No DOM operations in this method (pure data extraction)

## Integration Points
- **EntityDisplayDataProvider:** Provides name and portrait
- **EntityManager:** Provides participation component
- **PARTICIPATION_COMPONENT_ID:** Constant for component lookup

## Notes
- This method is private (`#getActorDisplayData`) and called by `#createActorElement()`
- The method returns an object, not a string, for flexibility
- Participation status will be used by `#applyParticipationState()` in TURORDTIC-010
- Portrait path validation (file existence) is NOT done here - handled by image `onerror` in DOM

## Next Ticket
TURORDTIC-005: Implement DOM element creation for actors
