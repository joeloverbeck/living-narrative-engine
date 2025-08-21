# CORMOTSEL-008: Add Unit Tests for New Implementation

## Priority: P2 (Medium)

## Estimated Effort: 1-1.5 hours

## Status: TODO

## Problem Statement

Comprehensive unit tests are needed for the new implementation to ensure all functionality works correctly and to maintain code coverage at 80%+.

## Implementation Details

### Test File Location

Create or update: `tests/unit/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.test.js`

### Step 1: Test Data Loading

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CoreMotivationsGeneratorController from '../../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';

describe('CoreMotivationsGeneratorController - Data Loading', () => {
  let controller;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockLogger;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <select id="direction-selector">
        <option value="">-- Choose a thematic direction --</option>
      </select>
      <button id="generate-btn" disabled>Generate</button>
      <div id="message-container"></div>
      <div id="loading-indicator"></div>
    `;

    // Create mocks
    mockCharacterBuilderService = {
      getAllThematicDirectionsWithConcepts: jest.fn(),
      hasClichesForDirection: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateCoreMotivations: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    controller = new CoreMotivationsGeneratorController({
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  describe('#loadEligibleDirections', () => {
    it('should load all directions from all concepts', async () => {
      const mockData = [
        {
          direction: { id: 'dir1', conceptId: 'c1', title: 'Direction 1' },
          concept: { id: 'c1', title: 'Concept 1' },
        },
        {
          direction: { id: 'dir2', conceptId: 'c2', title: 'Direction 2' },
          concept: { id: 'c2', title: 'Concept 2' },
        },
      ];

      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockData
      );
      mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        true
      );

      await controller.loadEligibleDirections();

      expect(
        mockCharacterBuilderService.getAllThematicDirectionsWithConcepts
      ).toHaveBeenCalled();
      expect(controller.totalDirectionsCount).toBe(2);
    });

    it('should filter out directions without clichés', async () => {
      const mockData = [
        {
          direction: { id: 'dir1', conceptId: 'c1', title: 'Has Clichés' },
          concept: { id: 'c1', title: 'Concept 1' },
        },
        {
          direction: { id: 'dir2', conceptId: 'c1', title: 'No Clichés' },
          concept: { id: 'c1', title: 'Concept 1' },
        },
      ];

      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockData
      );
      mockCharacterBuilderService.hasClichesForDirection.mockImplementation(
        (id) => Promise.resolve(id === 'dir1')
      );

      await controller.loadEligibleDirections();

      expect(
        mockCharacterBuilderService.hasClichesForDirection
      ).toHaveBeenCalledTimes(2);
      expect(controller.totalDirectionsCount).toBe(1);
    });

    it('should show empty state when no directions exist', async () => {
      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        []
      );

      await controller.loadEligibleDirections();

      const selector = document.getElementById('direction-selector');
      expect(selector.innerHTML).toContain('No thematic directions available');
      expect(selector.disabled).toBe(true);
    });

    it('should show specific empty state when no directions have clichés', async () => {
      const mockData = [
        {
          direction: { id: 'dir1', conceptId: 'c1', title: 'No Clichés' },
          concept: { id: 'c1', title: 'Concept 1' },
        },
      ];

      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockData
      );
      mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );

      await controller.loadEligibleDirections();

      const messageContainer = document.getElementById('message-container');
      expect(messageContainer.innerHTML).toContain(
        'none have associated clichés'
      );
    });
  });
});
```

### Step 2: Test Dropdown Population

```javascript
describe('Dropdown Population', () => {
  describe('#populateDirectionSelector', () => {
    it('should create option elements, not div elements', () => {
      const organizedData = [
        {
          conceptId: 'c1',
          conceptTitle: 'Test Concept',
          directions: [
            { id: 'dir1', title: 'Direction 1' },
            { id: 'dir2', title: 'Direction 2' },
          ],
        },
      ];

      controller.populateDirectionSelector(organizedData);

      const selector = document.getElementById('direction-selector');
      const divs = selector.querySelectorAll('div');
      const options = selector.querySelectorAll('option');

      expect(divs.length).toBe(0);
      expect(options.length).toBe(3); // default + 2 directions
    });

    it('should create optgroups for concept organization', () => {
      const organizedData = [
        {
          conceptId: 'c1',
          conceptTitle: 'Concept A',
          directions: [{ id: 'dir1', title: 'Direction 1' }],
        },
        {
          conceptId: 'c2',
          conceptTitle: 'Concept B',
          directions: [{ id: 'dir2', title: 'Direction 2' }],
        },
      ];

      controller.populateDirectionSelector(organizedData);

      const selector = document.getElementById('direction-selector');
      const optgroups = selector.querySelectorAll('optgroup');

      expect(optgroups.length).toBe(2);
      expect(optgroups[0].label).toBe('Concept A');
      expect(optgroups[1].label).toBe('Concept B');
    });

    it('should set correct values and text on options', () => {
      const organizedData = [
        {
          conceptId: 'c1',
          conceptTitle: 'Test',
          directions: [{ id: 'unique-id-123', title: 'My Direction Title' }],
        },
      ];

      controller.populateDirectionSelector(organizedData);

      const option = document.querySelector('option[value="unique-id-123"]');

      expect(option).toBeTruthy();
      expect(option.textContent).toBe('My Direction Title');
      expect(option.dataset.conceptId).toBe('c1');
    });

    it('should dispatch event after population', () => {
      const organizedData = [
        {
          conceptId: 'c1',
          conceptTitle: 'Test',
          directions: [{ id: 'dir1', title: 'Direction 1' }],
        },
      ];

      controller.populateDirectionSelector(organizedData);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:directions_loaded',
        expect.objectContaining({
          totalDirections: 1,
          conceptGroups: 1,
        })
      );
    });
  });
});
```

### Step 3: Test Event Handling

```javascript
describe('Event Handling', () => {
  describe('Select element change event', () => {
    beforeEach(async () => {
      // Setup controller with data
      const mockData = [
        {
          direction: { id: 'dir1', conceptId: 'c1', title: 'Direction 1' },
          concept: { id: 'c1', title: 'Concept 1' },
        },
      ];

      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockData
      );
      mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        true
      );

      await controller.initialize();
    });

    it('should handle direction selection from dropdown', () => {
      const selector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');

      // Simulate selection
      selector.value = 'dir1';
      selector.dispatchEvent(new Event('change'));

      expect(controller.selectedDirectionId).toBe('dir1');
      expect(generateBtn.disabled).toBe(false);
    });

    it('should clear selection when default option chosen', () => {
      const selector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');

      // First select something
      selector.value = 'dir1';
      selector.dispatchEvent(new Event('change'));

      // Then clear
      selector.value = '';
      selector.dispatchEvent(new Event('change'));

      expect(controller.selectedDirectionId).toBeNull();
      expect(generateBtn.disabled).toBe(true);
    });

    it('should dispatch events on selection changes', () => {
      const selector = document.getElementById('direction-selector');

      selector.value = 'dir1';
      selector.dispatchEvent(new Event('change'));

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:direction_selected',
        expect.objectContaining({
          directionId: 'dir1',
        })
      );
    });
  });

  describe('Keyboard shortcuts', () => {
    it('should trigger generate on Ctrl+Enter', () => {
      const generateSpy = jest.spyOn(controller, 'handleGenerate');

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
      });

      document.dispatchEvent(event);

      expect(generateSpy).toHaveBeenCalled();
    });
  });
});
```

### Step 4: Test Direction Organization

```javascript
describe('Direction Organization', () => {
  describe('#organizeDirectionsByConcept', () => {
    it('should group directions by concept', async () => {
      const directions = [
        { id: 'dir1', conceptId: 'c1', title: 'Direction A' },
        { id: 'dir2', conceptId: 'c2', title: 'Direction B' },
        { id: 'dir3', conceptId: 'c1', title: 'Direction C' },
      ];

      // Setup cache
      controller.directionsWithConceptsMap = new Map([
        [
          'dir1',
          {
            direction: directions[0],
            concept: { id: 'c1', title: 'Concept 1' },
          },
        ],
        [
          'dir2',
          {
            direction: directions[1],
            concept: { id: 'c2', title: 'Concept 2' },
          },
        ],
        [
          'dir3',
          {
            direction: directions[2],
            concept: { id: 'c1', title: 'Concept 1' },
          },
        ],
      ]);

      const organized =
        await controller.organizeDirectionsByConcept(directions);

      expect(organized.length).toBe(2);

      const concept1Group = organized.find((g) => g.conceptId === 'c1');
      expect(concept1Group.directions.length).toBe(2);

      const concept2Group = organized.find((g) => g.conceptId === 'c2');
      expect(concept2Group.directions.length).toBe(1);
    });

    it('should sort concepts alphabetically', async () => {
      const directions = [
        { id: 'dir1', conceptId: 'z', title: 'Direction 1' },
        { id: 'dir2', conceptId: 'a', title: 'Direction 2' },
        { id: 'dir3', conceptId: 'm', title: 'Direction 3' },
      ];

      controller.directionsWithConceptsMap = new Map([
        [
          'dir1',
          {
            direction: directions[0],
            concept: { id: 'z', title: 'Zebra Concept' },
          },
        ],
        [
          'dir2',
          {
            direction: directions[1],
            concept: { id: 'a', title: 'Apple Concept' },
          },
        ],
        [
          'dir3',
          {
            direction: directions[2],
            concept: { id: 'm', title: 'Mango Concept' },
          },
        ],
      ]);

      const organized =
        await controller.organizeDirectionsByConcept(directions);

      expect(organized[0].conceptTitle).toBe('Apple Concept');
      expect(organized[1].conceptTitle).toBe('Mango Concept');
      expect(organized[2].conceptTitle).toBe('Zebra Concept');
    });

    it('should sort directions within concepts alphabetically', async () => {
      const directions = [
        { id: 'dir1', conceptId: 'c1', title: 'Zebra Direction' },
        { id: 'dir2', conceptId: 'c1', title: 'Apple Direction' },
        { id: 'dir3', conceptId: 'c1', title: 'Mango Direction' },
      ];

      controller.directionsWithConceptsMap = new Map([
        [
          'dir1',
          { direction: directions[0], concept: { id: 'c1', title: 'Concept' } },
        ],
        [
          'dir2',
          { direction: directions[1], concept: { id: 'c1', title: 'Concept' } },
        ],
        [
          'dir3',
          { direction: directions[2], concept: { id: 'c1', title: 'Concept' } },
        ],
      ]);

      const organized =
        await controller.organizeDirectionsByConcept(directions);

      expect(organized[0].directions[0].title).toBe('Apple Direction');
      expect(organized[0].directions[1].title).toBe('Mango Direction');
      expect(organized[0].directions[2].title).toBe('Zebra Direction');
    });
  });
});
```

### Step 5: Test State Management

```javascript
describe('State Management', () => {
  it('should initialize with correct default state', () => {
    expect(controller.selectedDirectionId).toBeNull();
    expect(controller.currentDirection).toBeNull();
    expect(controller.currentConcept).toBeNull();
    expect(controller.isLoading).toBe(false);
    expect(controller.eligibleDirections).toEqual([]);
  });

  it('should update loading state correctly', () => {
    const generateBtn = document.getElementById('generate-btn');
    const loadingIndicator = document.getElementById('loading-indicator');

    controller.setLoadingState(true);

    expect(controller.isLoading).toBe(true);
    expect(generateBtn.disabled).toBe(true);
    expect(loadingIndicator.style.display).toBe('block');

    controller.setLoadingState(false);

    expect(controller.isLoading).toBe(false);
    expect(loadingIndicator.style.display).toBe('none');
  });

  it('should handle cache staleness correctly', () => {
    // Fresh cache
    controller.cacheTimestamp = Date.now();
    expect(controller.isCacheStale()).toBe(false);

    // Stale cache (6 minutes old)
    controller.cacheTimestamp = Date.now() - 6 * 60 * 1000;
    expect(controller.isCacheStale()).toBe(true);
  });
});
```

## Acceptance Criteria

- [ ] All new methods have unit tests
- [ ] Data loading is fully tested
- [ ] Dropdown population is tested
- [ ] Event handling is tested
- [ ] Direction organization is tested
- [ ] State management is tested
- [ ] Error scenarios are tested
- [ ] Code coverage remains at 80%+

## Dependencies

- **CORMOTSEL-001** through **CORMOTSEL-006**: Implementation must be complete

## Test Coverage Goals

- **Functions**: 90%+
- **Branches**: 80%+
- **Lines**: 90%+
- **Statements**: 90%+

## Running Tests

```bash
# Run specific test file
npm test tests/unit/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.test.js

# Run with coverage
npm run test:unit

# Run in watch mode for development
npm test -- --watch
```

## Related Files

- **Test Utilities**: `tests/common/testbed.js`
- **Test Helpers**: `tests/common/helpers/`
- **Controller**: `src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js`

## Notes

- Use existing test helpers from `tests/common/` where possible
- Mock all external dependencies
- Test both success and failure paths
- Include edge cases in tests
