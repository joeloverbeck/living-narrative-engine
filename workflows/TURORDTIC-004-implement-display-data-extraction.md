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
#_getActorDisplayData(entityId) {
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
#_getActorDisplayData(entityId) {
  try {
    // Use EntityDisplayDataProvider for name and portrait
    const name = this.#_entityDisplayDataProvider.getEntityName(entityId, entityId);
    const portraitPath = this.#_entityDisplayDataProvider.getEntityPortraitPath(entityId);

    // Check participation status
    let participating = true; // Default to true
    if (this.#_entityManager.hasComponent(entityId, PARTICIPATION_COMPONENT_ID)) {
      const participationComponent = this.#_entityManager.getComponentData(
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

### 1. Missing Name Component
**Scenario:** Actor has no `core:name` component
**Solution:** EntityDisplayDataProvider.getEntityName() returns the default (entity ID) when name component is missing

### 2. Missing Portrait Component
**Scenario:** Actor has no `core:portrait` component
**Solution:** EntityDisplayDataProvider.getEntityPortraitPath() returns `null`, caller will render name badge instead

### 3. Invalid Portrait Path
**Scenario:** Portrait path is empty string or invalid
**Solution:** Treat as `null`, will be handled by image `onerror` in next ticket

### 4. Missing Participation Component
**Scenario:** Actor has no `core:participation` component
**Solution:** Default to `participating: true` (actors participate by default)

### 5. Exception During Data Extraction
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
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockEntityDisplayDataProvider = {
      getEntityName: jest.fn(),
      getEntityPortraitPath: jest.fn(),
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
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Alice');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue('/path/to/alice.jpg');
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer['#_getActorDisplayData']('actor-1');

    expect(result).toEqual({
      name: 'Alice',
      portraitPath: '/path/to/alice.jpg',
      participating: true,
    });
  });

  it('should fallback to entity ID when name missing', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('actor-1');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue('/path/to/portrait.jpg');
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer['#_getActorDisplayData']('actor-1');

    expect(result.name).toBe('actor-1');
  });

  it('should handle missing portrait gracefully', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Bob');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer['#_getActorDisplayData']('actor-2');

    expect(result).toEqual({
      name: 'Bob',
      portraitPath: null,
      participating: true,
    });
  });

  it('should extract participation status when component exists', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Charlie');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
    mockEntityManager.hasComponent.mockReturnValue(true);
    mockEntityManager.getComponentData.mockReturnValue({
      participating: false,
    });

    const result = renderer['#_getActorDisplayData']('actor-3');

    expect(result.participating).toBe(false);
  });

  it('should default to participating true when component missing', () => {
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Diana');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue(null);
    mockEntityManager.hasComponent.mockReturnValue(false);

    const result = renderer['#_getActorDisplayData']('actor-4');

    expect(result.participating).toBe(true);
  });

  it('should handle exception and return fallback', () => {
    mockEntityDisplayDataProvider.getEntityName.mockImplementation(() => {
      throw new Error('Service unavailable');
    });

    const result = renderer['#_getActorDisplayData']('actor-6');

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
    mockEntityDisplayDataProvider.getEntityName.mockReturnValue('Eve');
    mockEntityDisplayDataProvider.getEntityPortraitPath.mockReturnValue('/path/to/eve.jpg');
    mockEntityManager.hasComponent.mockReturnValue(false);

    renderer['#_getActorDisplayData']('actor-7');

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
- [ ] Method extracts name using `EntityDisplayDataProvider.getEntityName()`
- [ ] Method extracts portrait path using `EntityDisplayDataProvider.getEntityPortraitPath()`
- [ ] Method extracts participation status using `EntityManager.getComponentData()`
- [ ] Fallback to entity ID when name missing (handled by getEntityName default)
- [ ] Return `null` for portrait when missing (handled by getEntityPortraitPath)
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
- **EntityDisplayDataProvider:** Provides name via `getEntityName()` and portrait via `getEntityPortraitPath()`
- **EntityManager:** Provides component data via `hasComponent()` and `getComponentData()`
- **PARTICIPATION_COMPONENT_ID:** Constant for component lookup (already imported)

## Notes
- This method is private (`#_getActorDisplayData`) and called by `#_createActorElement()`
- The method returns an object, not a string, for flexibility
- Participation status will be used by `#_applyParticipationState()` in TURORDTIC-010
- Portrait path validation (file existence) is NOT done here - handled by image `onerror` in DOM
- Private fields use underscore prefix (`#_entityManager`, `#_entityDisplayDataProvider`) per class convention

## Next Ticket
TURORDTIC-005: Implement DOM element creation for actors
