# TURORDTIC-005: Implement DOM Element Creation for Actors

## Status
Ready for Implementation

## Priority
High - Required for rendering actors

## Dependencies
- TURORDTIC-003 (class skeleton)
- TURORDTIC-004 (display data extraction)

## Description
Implement the `#createActorElement()` private method that creates DOM elements for actors in the ticker. The method handles both actors with portraits (image + name) and actors without portraits (name badge).

## Affected Files
- `src/domUI/turnOrderTickerRenderer.js` (modify)

## Current Behavior
The method stub creates an empty div:
```javascript
#createActorElement(entity) {
  const element = this.#domElementFactory.createElement('div');
  element.classList.add('ticker-actor');
  return element;
}
```

## HTML Structure Reference
From spec lines 250-266:

### With Portrait
```html
<div class="ticker-actor" data-entity-id="actor-1" data-participating="true">
  <img
    class="ticker-actor-portrait"
    src="/path/to/portrait.jpg"
    alt="Alice"
    loading="lazy"
  />
  <span class="ticker-actor-name">Alice</span>
</div>
```

### Without Portrait
```html
<div class="ticker-actor" data-entity-id="actor-2" data-participating="true">
  <div class="ticker-actor-name-badge">
    <span class="ticker-actor-name">Bob</span>
  </div>
</div>
```

## Implementation

### Replace Method Implementation

**Location:** `src/domUI/turnOrderTickerRenderer.js`

Replace the stub with:

```javascript
/**
 * Create a DOM element for an actor in the ticker.
 * Renders portrait + name or name badge depending on data availability.
 *
 * @param {Object} entity - The actor entity (must have id property)
 * @returns {HTMLElement} The actor element
 * @private
 */
#createActorElement(entity) {
  if (!entity || !entity.id) {
    this.#logger.error('Cannot create actor element: entity or entity.id missing', { entity });
    throw new Error('Entity must have an id property');
  }

  const entityId = entity.id;
  const displayData = this.#getActorDisplayData(entityId);

  // Create container
  const container = this.#domElementFactory.createElement('div');
  container.classList.add('ticker-actor');
  container.setAttribute('data-entity-id', entityId);
  container.setAttribute('data-participating', displayData.participating.toString());

  if (displayData.portraitPath) {
    // Render with portrait
    this.#createPortraitElement(container, displayData);
  } else {
    // Render with name badge
    this.#createNameBadgeElement(container, displayData);
  }

  // Add name label below (always shown)
  const nameLabel = this.#domElementFactory.createElement('span');
  nameLabel.classList.add('ticker-actor-name');
  nameLabel.textContent = displayData.name;
  nameLabel.title = displayData.name; // Tooltip for long names
  container.appendChild(nameLabel);

  this.#logger.debug('Actor element created', {
    entityId,
    hasPortrait: !!displayData.portraitPath,
    name: displayData.name,
  });

  return container;
}

/**
 * Create portrait image element with error handling.
 *
 * @param {HTMLElement} container - Parent container
 * @param {Object} displayData - Display data with portraitPath and name
 * @private
 */
#createPortraitElement(container, displayData) {
  const img = this.#domElementFactory.createElement('img');
  img.classList.add('ticker-actor-portrait');
  img.src = displayData.portraitPath;
  img.alt = displayData.name;
  img.loading = 'lazy'; // Performance optimization

  // Handle image load failures
  img.onerror = () => {
    this.#logger.warn('Portrait failed to load, switching to name badge', {
      portraitPath: displayData.portraitPath,
      name: displayData.name,
    });

    // Remove failed image
    img.remove();

    // Replace with name badge
    this.#createNameBadgeElement(container, displayData);
  };

  container.appendChild(img);
}

/**
 * Create name badge element (no portrait fallback).
 *
 * @param {HTMLElement} container - Parent container
 * @param {Object} displayData - Display data with name
 * @private
 */
#createNameBadgeElement(container, displayData) {
  const badge = this.#domElementFactory.createElement('div');
  badge.classList.add('ticker-actor-name-badge');

  const nameSpan = this.#domElementFactory.createElement('span');
  nameSpan.classList.add('ticker-actor-name');
  nameSpan.textContent = displayData.name;

  badge.appendChild(nameSpan);
  container.insertBefore(badge, container.firstChild); // Insert at beginning
}
```

## Edge Cases Handled

### 1. Missing Entity ID
**Scenario:** `entity` or `entity.id` is null/undefined
**Solution:** Throw error with clear message

### 2. Portrait Load Failure
**Scenario:** Portrait path is invalid or image fails to load
**Solution:** `onerror` handler replaces image with name badge

### 3. Very Long Actor Names
**Scenario:** Actor name exceeds display width
**Solution:**
- CSS handles with `text-overflow: ellipsis` (from TURORDTIC-001)
- Add `title` attribute for tooltip

### 4. Name Badge Already Exists
**Scenario:** `onerror` called on image with name badge already present
**Solution:** `insertBefore(badge, container.firstChild)` ensures badge at top

### 5. Empty/Null Portrait Path
**Scenario:** `displayData.portraitPath` is `null` or empty string
**Solution:** Conditional check renders name badge instead

## Testing

### Unit Tests
**File:** `tests/unit/domUI/turnOrderTickerRenderer.test.js`

Add test suite:

```javascript
describe('TurnOrderTickerRenderer - Actor Element Creation', () => {
  let renderer;
  let mockLogger;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockContainer;
  let mockDomElementFactory;

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

    mockDomElementFactory = {
      createElement: jest.fn((tag) => document.createElement(tag)),
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
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });
  });

  it('should create element with portrait when available', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Alice',
      portraitPath: '/path/to/alice.jpg',
    });
    mockEntityManager.hasComponent.mockReturnValue(false);

    const element = renderer['#createActorElement']({ id: 'actor-1' });

    expect(element.classList.contains('ticker-actor')).toBe(true);
    expect(element.getAttribute('data-entity-id')).toBe('actor-1');
    expect(element.querySelector('.ticker-actor-portrait')).toBeTruthy();
    expect(element.querySelector('.ticker-actor-portrait').src).toContain('alice.jpg');
    expect(element.querySelector('.ticker-actor-portrait').alt).toBe('Alice');
    expect(element.querySelector('.ticker-actor-name').textContent).toBe('Alice');
  });

  it('should create element with name badge when portrait missing', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Bob',
    });
    mockEntityManager.hasComponent.mockReturnValue(false);

    const element = renderer['#createActorElement']({ id: 'actor-2' });

    expect(element.classList.contains('ticker-actor')).toBe(true);
    expect(element.querySelector('.ticker-actor-portrait')).toBeFalsy();
    expect(element.querySelector('.ticker-actor-name-badge')).toBeTruthy();
    expect(element.querySelector('.ticker-actor-name-badge .ticker-actor-name').textContent).toBe('Bob');
  });

  it('should set participation data attribute', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Charlie',
    });
    mockEntityManager.hasComponent.mockReturnValue(true);
    mockEntityManager.getComponent.mockReturnValue({ participating: false });

    const element = renderer['#createActorElement']({ id: 'actor-3' });

    expect(element.getAttribute('data-participating')).toBe('false');
  });

  it('should set lazy loading on portrait images', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Diana',
      portraitPath: '/path/to/diana.jpg',
    });
    mockEntityManager.hasComponent.mockReturnValue(false);

    const element = renderer['#createActorElement']({ id: 'actor-4' });
    const img = element.querySelector('.ticker-actor-portrait');

    expect(img.loading).toBe('lazy');
  });

  it('should add title attribute for tooltip', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Very Long Actor Name That Will Be Truncated',
    });
    mockEntityManager.hasComponent.mockReturnValue(false);

    const element = renderer['#createActorElement']({ id: 'actor-5' });
    const nameLabel = element.querySelector('.ticker-actor-name');

    expect(nameLabel.title).toBe('Very Long Actor Name That Will Be Truncated');
  });

  it('should handle image load failure', () => {
    mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Eve',
      portraitPath: '/path/to/invalid.jpg',
    });
    mockEntityManager.hasComponent.mockReturnValue(false);

    const element = renderer['#createActorElement']({ id: 'actor-6' });
    const img = element.querySelector('.ticker-actor-portrait');

    // Simulate image error
    img.onerror();

    expect(element.querySelector('.ticker-actor-portrait')).toBeFalsy();
    expect(element.querySelector('.ticker-actor-name-badge')).toBeTruthy();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Portrait failed to load, switching to name badge',
      expect.any(Object)
    );
  });

  it('should throw error if entity has no id', () => {
    expect(() => {
      renderer['#createActorElement']({});
    }).toThrow('Entity must have an id property');

    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should throw error if entity is null', () => {
    expect(() => {
      renderer['#createActorElement'](null);
    }).toThrow('Entity must have an id property');
  });
});
```

### Integration Test
**File:** `tests/integration/domUI/turnOrderTicker.integration.test.js`

```javascript
describe('Turn Order Ticker - Actor Rendering', () => {
  it('should render actors with various portrait configurations', async () => {
    const { renderer, entityManager, entityDisplayDataProvider } = await setupTestEnvironment();

    // Create actors
    const actor1 = await entityManager.createEntity('actor-1', ['core:actor', 'core:name', 'core:portrait']);
    const actor2 = await entityManager.createEntity('actor-2', ['core:actor', 'core:name']);

    entityDisplayDataProvider.getDisplayData
      .mockReturnValueOnce({ name: 'Alice', portraitPath: '/portraits/alice.jpg' })
      .mockReturnValueOnce({ name: 'Bob' });

    const element1 = renderer['#createActorElement'](actor1);
    const element2 = renderer['#createActorElement'](actor2);

    expect(element1.querySelector('.ticker-actor-portrait')).toBeTruthy();
    expect(element2.querySelector('.ticker-actor-name-badge')).toBeTruthy();
  });
});
```

### Testing Commands
```bash
# Run unit tests for this method
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --testNamePattern="Actor Element Creation" --verbose

# Run integration tests
NODE_ENV=test npm run test:integration -- tests/integration/domUI/turnOrderTicker.integration.test.js --silent
```

## Acceptance Criteria
- [ ] Method creates `<div class="ticker-actor">` container
- [ ] Container has `data-entity-id` attribute
- [ ] Container has `data-participating` attribute
- [ ] Renders `<img>` with portrait when path available
- [ ] Portrait has `loading="lazy"` attribute
- [ ] Portrait has `alt` text with actor name
- [ ] Renders name badge when portrait missing
- [ ] Always renders name label below portrait/badge
- [ ] Name label has `title` attribute for tooltip
- [ ] Image `onerror` handler replaces with name badge
- [ ] Throws error for missing entity ID
- [ ] All unit tests pass
- [ ] Integration tests pass

## Performance Considerations
- **Lazy Loading:** `loading="lazy"` defers image loading until needed
- **DOM Creation:** Uses `domElementFactory` for testability
- **Error Handling:** `onerror` prevents broken images from showing
- **Single DOM Query:** No jQuery-style chaining, direct element creation

## Accessibility Considerations
- **Alt Text:** Portrait images have descriptive alt text
- **Tooltips:** Long names show full text in `title` attribute
- **ARIA:** Container structure supports screen readers

## Notes
- The method creates elements but does NOT append them to the DOM (caller's responsibility)
- Portrait aspect ratios handled by CSS (from TURORDTIC-001)
- Participation visual state applied by `#applyParticipationState()` (TURORDTIC-010)
- Animation classes added by `#animateActorEntry()` (TURORDTIC-011)

## Next Ticket
TURORDTIC-006: Implement event subscription and handling
