# CORMOTSEL-009: Add Integration Tests

## Priority: P2 (Medium)

## Estimated Effort: 1-1.5 hours

## Status: TODO

## Problem Statement

Integration tests are needed to verify the end-to-end flow of the Core Motivations Generator with the new dropdown implementation, ensuring all components work together correctly.

## Implementation Details

### Test File Location

Create: `tests/integration/coreMotivationsGenerator/coreMotivationsSelector.integration.test.js`

### Step 1: End-to-End Flow Tests

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CoreMotivationsGeneratorController } from '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';
import { createCharacterConcept } from '../../../src/characterBuilder/models/characterConcept.js';
import { createThematicDirection } from '../../../src/characterBuilder/models/thematicDirection.js';
import { Cliche } from '../../../src/characterBuilder/models/cliche.js';

// Test utilities
const clearAllTestData = async (database) => {
  // Helper function to clear all test data
  const concepts = await database.getAllCharacterConcepts();
  const directions = await database.getAllThematicDirections();

  for (const direction of directions) {
    await database.deleteThematicDirection(direction.id);
  }

  for (const concept of concepts) {
    await database.deleteCharacterConcept(concept.id);
  }
};

describe('Core Motivations Selector - Integration Tests', () => {
  let dom;
  let controller;
  let characterBuilderService;
  let database;

  beforeEach(async () => {
    // Setup DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <select id="direction-selector">
            <option value="">-- Choose a thematic direction --</option>
          </select>
          <button id="generate-btn" disabled>Generate Core Motivations</button>
          <div id="message-container"></div>
          <div id="selected-direction-display"></div>
          <div id="loading-indicator" style="display: none;"></div>
          <div id="results-container"></div>
        </body>
      </html>
    `);

    global.document = dom.window.document;
    global.window = dom.window;

    // Initialize database
    database = new CharacterDatabase({ logger: console });
    await database.initialize();

    // Clear any existing test data
    await clearAllTestData(database);

    // Initialize real service
    characterBuilderService = new CharacterBuilderService({
      logger: console,
      database: database,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });

    // Initialize controller with real service
    controller = new CoreMotivationsGeneratorController({
      characterBuilderService,
      eventBus: mockEventBus,
      logger: console,
      coreMotivationsGenerator: mockCoreMotivationsGenerator,
      displayEnhancer: mockDisplayEnhancer,
    });
  });

  afterEach(async () => {
    await clearAllTestData(database);
    database.close();
    dom.window.close();
  });

  describe('Complete User Flow', () => {
    it('should load directions from multiple concepts with clichés', async () => {
      // Setup test data - create concepts
      const concept1 = createCharacterConcept({
        title: 'Adventure Hero',
        description: 'A brave adventurer',
      });
      concept1.id = 'concept-1';
      await database.saveCharacterConcept(concept1);

      const concept2 = createCharacterConcept({
        title: 'Dark Villain',
        description: 'An evil mastermind',
      });
      concept2.id = 'concept-2';
      await database.saveCharacterConcept(concept2);

      // Create thematic directions
      const direction1 = createThematicDirection({
        conceptId: 'concept-1',
        title: 'The Reluctant Hero',
        description: 'Forced into adventure',
      });
      direction1.id = 'dir-1';

      const direction2 = createThematicDirection({
        conceptId: 'concept-2',
        title: 'Power at Any Cost',
        description: 'Seeking ultimate power',
      });
      direction2.id = 'dir-2';

      const direction3 = createThematicDirection({
        conceptId: 'concept-1',
        title: 'Seeking Glory',
        description: 'Fame and fortune',
      });
      direction3.id = 'dir-3';

      // Save directions as array using the actual database method
      await database.saveThematicDirections([
        direction1,
        direction2,
        direction3,
      ]);

      // Add clichés only to some directions using individual save method
      const cliche1 = new Cliche({
        directionId: 'dir-1',
        conceptId: 'concept-1',
        title: 'Hero Journey Clichés',
        cliches: [
          { text: 'The call to adventure', category: 'plot' },
          { text: 'Mentor figure appears', category: 'character' },
        ],
      });
      await database.saveCliche(cliche1);

      const cliche2 = new Cliche({
        directionId: 'dir-2',
        conceptId: 'concept-2',
        title: 'Villain Power Clichés',
        cliches: [
          { text: 'Corruption by power', category: 'theme' },
          { text: 'Betrayal of allies', category: 'plot' },
        ],
      });
      await database.saveCliche(cliche2);

      // direction 3 has no clichés - should be filtered out

      // Initialize controller
      await controller.initialize();

      // Verify dropdown population
      const selector = document.getElementById('direction-selector');
      const optgroups = selector.querySelectorAll('optgroup');

      expect(optgroups.length).toBe(2); // Two concepts

      // Check first concept group
      const adventureGroup = Array.from(optgroups).find(
        (og) => og.label === 'Adventure Hero'
      );
      expect(adventureGroup).toBeTruthy();

      const adventureOptions = adventureGroup.querySelectorAll('option');
      expect(adventureOptions.length).toBe(1); // Only dir-1 has clichés
      expect(adventureOptions[0].textContent).toBe('The Reluctant Hero');

      // Check second concept group
      const villainGroup = Array.from(optgroups).find(
        (og) => og.label === 'Dark Villain'
      );
      expect(villainGroup).toBeTruthy();

      const villainOptions = villainGroup.querySelectorAll('option');
      expect(villainOptions.length).toBe(1);
      expect(villainOptions[0].textContent).toBe('Power at Any Cost');
    });

    it('should handle direction selection and enable generation', async () => {
      // Setup minimal test data
      const concept = createCharacterConcept({
        title: 'Test Concept',
      });
      concept.id = 'test-concept';
      await database.saveCharacterConcept(concept);

      const direction = createThematicDirection({
        conceptId: 'test-concept',
        title: 'Test Direction',
      });
      direction.id = 'test-dir';
      await database.saveThematicDirections([direction]);

      const cliche = new Cliche({
        directionId: 'test-dir',
        conceptId: 'test-concept',
        title: 'Test Clichés',
        cliches: [{ text: 'Test cliché' }],
      });
      await database.saveCliche(cliche);

      await controller.initialize();

      const selector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');

      // Initially disabled
      expect(generateBtn.disabled).toBe(true);

      // Select a direction
      selector.value = 'test-dir';
      selector.dispatchEvent(new Event('change'));

      // Should enable generate button
      expect(generateBtn.disabled).toBe(false);
      expect(controller.selectedDirectionId).toBe('test-dir');

      // Clear selection
      selector.value = '';
      selector.dispatchEvent(new Event('change'));

      // Should disable generate button
      expect(generateBtn.disabled).toBe(true);
      expect(controller.selectedDirectionId).toBeNull();
    });
  });

  describe('Cross-Concept Verification', () => {
    it('should correctly filter and organize complex data structures', async () => {
      // Create a more complex scenario
      const concepts = [];
      const directions = [];

      // Create 3 concepts
      for (let i = 1; i <= 3; i++) {
        const concept = createCharacterConcept({
          title: `Concept ${String.fromCharCode(67 - i + 1)}`, // C, B, A for reverse alpha
        });
        concept.id = `concept-${i}`;
        await database.saveCharacterConcept(concept);
        concepts.push(concept);
      }

      // Create multiple directions per concept
      const directionsToSave = [];
      for (let c = 1; c <= 3; c++) {
        for (let d = 1; d <= 3; d++) {
          const dirId = `dir-${c}-${d}`;
          const direction = createThematicDirection({
            conceptId: `concept-${c}`,
            title: `Direction ${c}-${String.fromCharCode(67 - d + 1)}`, // C, B, A
          });
          direction.id = dirId;
          directionsToSave.push(direction);
          directions.push(direction);

          // Only add clichés to some directions
          if (d !== 2) {
            // Skip middle direction in each concept
            const cliche = new Cliche({
              directionId: dirId,
              conceptId: `concept-${c}`,
              title: `Clichés for ${dirId}`,
              cliches: [{ text: `Cliché for ${dirId}` }],
            });
            await database.saveCliche(cliche);
          }
        }
      }

      // Save all directions at once
      await database.saveThematicDirections(directionsToSave);

      await controller.initialize();

      const selector = document.getElementById('direction-selector');
      const optgroups = selector.querySelectorAll('optgroup');

      // Should have 3 concepts
      expect(optgroups.length).toBe(3);

      // Check alphabetical ordering of concepts
      expect(optgroups[0].label).toBe('Concept A');
      expect(optgroups[1].label).toBe('Concept B');
      expect(optgroups[2].label).toBe('Concept C');

      // Each concept should have 2 directions (middle one filtered out)
      optgroups.forEach((og) => {
        const options = og.querySelectorAll('option');
        expect(options.length).toBe(2);

        // Check alphabetical ordering within group
        const titles = Array.from(options).map((o) => o.textContent);
        const sorted = [...titles].sort();
        expect(titles).toEqual(sorted);
      });
    });
  });

  describe('Empty State Handling', () => {
    it('should show appropriate message when no directions exist', async () => {
      // No data created
      await controller.initialize();

      const selector = document.getElementById('direction-selector');
      const messageContainer = document.getElementById('message-container');

      expect(selector.disabled).toBe(true);
      expect(selector.innerHTML).toContain('No thematic directions available');
    });

    it('should show specific message when directions exist but have no clichés', async () => {
      // Create directions without clichés
      const concept = createCharacterConcept({
        title: 'Test Concept',
      });
      concept.id = 'concept-1';
      await database.saveCharacterConcept(concept);

      const direction = createThematicDirection({
        conceptId: 'concept-1',
        title: 'Direction without clichés',
      });
      direction.id = 'dir-1';
      await database.saveThematicDirections([direction]);

      await controller.initialize();

      const messageContainer = document.getElementById('message-container');
      expect(messageContainer.innerHTML).toContain(
        'none have associated clichés'
      );
      expect(messageContainer.innerHTML).toContain(
        'Go to the Clichés Generator'
      );
    });
  });

  describe('Data Persistence', () => {
    it('should maintain selection state across operations', async () => {
      // Setup data
      const concept = createCharacterConcept({
        title: 'Persistent Concept',
      });
      concept.id = 'persist-concept';
      await database.saveCharacterConcept(concept);

      const direction = createThematicDirection({
        conceptId: 'persist-concept',
        title: 'Persistent Direction',
      });
      direction.id = 'persist-dir';
      await database.saveThematicDirections([direction]);

      const cliche = new Cliche({
        directionId: 'persist-dir',
        conceptId: 'persist-concept',
        title: 'Persistent Clichés',
        cliches: [{ text: 'Persistent cliché' }],
      });
      await database.saveCliche(cliche);

      await controller.initialize();

      // Make selection
      const selector = document.getElementById('direction-selector');
      selector.value = 'persist-dir';
      selector.dispatchEvent(new Event('change'));

      // Verify state
      expect(controller.selectedDirectionId).toBe('persist-dir');
      expect(controller.currentDirection.title).toBe('Persistent Direction');
      expect(controller.currentConcept.title).toBe('Persistent Concept');

      // Verify current state persists (no need to call private method)
      expect(controller.selectedDirectionId).toBe('persist-dir');
      expect(controller.currentDirection.title).toBe('Persistent Direction');
      expect(controller.currentConcept.title).toBe('Persistent Concept');
    });
  });
});
```

### Step 2: Performance Tests

```javascript
describe('Performance Tests', () => {
  it('should handle large numbers of directions efficiently', async () => {
    const startTime = Date.now();

    // Create many concepts and directions
    const allDirections = [];
    for (let c = 1; c <= 10; c++) {
      const concept = createCharacterConcept({
        title: `Performance Concept ${c}`,
      });
      concept.id = `perf-concept-${c}`;
      await database.saveCharacterConcept(concept);

      for (let d = 1; d <= 10; d++) {
        const dirId = `perf-dir-${c}-${d}`;
        const direction = createThematicDirection({
          conceptId: `perf-concept-${c}`,
          title: `Direction ${c}-${d}`,
        });
        direction.id = dirId;
        allDirections.push(direction);

        // Add clichés to 80% of directions
        if (Math.random() > 0.2) {
          const cliche = new Cliche({
            directionId: dirId,
            conceptId: `perf-concept-${c}`,
            title: `Clichés for ${dirId}`,
            cliches: [{ text: `Cliché for ${dirId}` }],
          });
          await database.saveCliche(cliche);
        }
      }
    }

    // Save all directions at once for better performance
    await database.saveThematicDirections(allDirections);

    // Initialize and measure time
    await controller.initialize();
    const loadTime = Date.now() - startTime;

    // Should complete in reasonable time
    expect(loadTime).toBeLessThan(2000); // 2 seconds max

    // Verify all data loaded correctly
    const selector = document.getElementById('direction-selector');
    const options = selector.querySelectorAll('option[value]');

    // Should have filtered to ~80 directions
    expect(options.length).toBeGreaterThan(70);
    expect(options.length).toBeLessThan(90);
  });
});
```

### Step 3: Error Recovery Tests

```javascript
describe('Error Recovery', () => {
  it('should handle missing concepts gracefully', async () => {
    // Create orphaned direction (concept doesn't exist) by directly inserting into database
    const orphanDirection = createThematicDirection({
      conceptId: 'non-existent-concept',
      title: 'Orphaned Direction',
    });
    orphanDirection.id = 'orphan-dir';
    await database.saveThematicDirections([orphanDirection]);

    // Add cliché for orphaned direction
    const orphanCliche = new Cliche({
      directionId: 'orphan-dir',
      conceptId: 'non-existent-concept',
      title: 'Orphaned Clichés',
      cliches: [{ text: 'Some cliché' }],
    });
    await database.saveCliche(orphanCliche);

    await controller.initialize();

    // Should still load but with fallback concept title
    const selector = document.getElementById('direction-selector');
    const optgroups = selector.querySelectorAll('optgroup');

    expect(optgroups.length).toBeGreaterThan(0);

    const orphanGroup = Array.from(optgroups).find((og) =>
      og.label.includes('Unknown Concept')
    );
    expect(orphanGroup).toBeTruthy();
  });

  it('should recover from service failures', async () => {
    // Mock service to fail once then succeed
    let callCount = 0;
    jest
      .spyOn(characterBuilderService, 'getAllThematicDirectionsWithConcepts')
      .mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Service temporarily unavailable');
        }
        return Promise.resolve([]);
      });

    // First attempt should fail gracefully
    await controller.initialize();

    // Should show error state
    const messageContainer = document.getElementById('message-container');
    expect(messageContainer.innerHTML).toContain('Failed to load');

    // Retry should succeed
    await controller.initialize();

    // Should now show empty state (no data)
    expect(messageContainer.innerHTML).not.toContain('Failed');
  });
});
```

## Acceptance Criteria

- [ ] End-to-end flow from page load to selection works
- [ ] Multiple concepts with directions are handled correctly
- [ ] Filtering for clichés works across all concepts
- [ ] Empty states are shown appropriately
- [ ] Performance is acceptable with many directions
- [ ] Error recovery mechanisms work
- [ ] Data persistence is maintained
- [ ] All integration tests pass

## Dependencies

- **CORMOTSEL-001** through **CORMOTSEL-008**: Implementation and unit tests must be complete

## Test Environment Setup

```javascript
// Test utilities needed
const mockLLMService = {
  generateCoreMotivations: jest.fn().mockResolvedValue({
    motivations: ['Test motivation'],
    contradictions: ['Test contradiction'],
    centralQuestion: 'Test question?',
  }),
};

const mockEventBus = {
  dispatch: jest.fn(),
  subscribe: jest.fn(),
};

const mockStorageService = {
  initialize: jest.fn().mockResolvedValue(),
  storeCharacterConcept: jest.fn().mockResolvedValue(),
  listCharacterConcepts: jest.fn().mockResolvedValue([]),
  getCharacterConcept: jest.fn().mockResolvedValue(null),
  deleteCharacterConcept: jest.fn().mockResolvedValue(),
  storeThematicDirections: jest.fn().mockResolvedValue(),
  getThematicDirections: jest.fn().mockResolvedValue([]),
};

const mockDirectionGenerator = {
  generateDirections: jest.fn().mockResolvedValue([]),
};

const mockCoreMotivationsGenerator = {
  generate: jest.fn().mockResolvedValue([]),
};

const mockDisplayEnhancer = {
  createMotivationBlock: jest
    .fn()
    .mockReturnValue(document.createElement('div')),
  formatMotivationsForExport: jest.fn().mockReturnValue('test export'),
  formatSingleMotivation: jest.fn().mockReturnValue('test motivation'),
};
```

## Running Tests

```bash
# Run integration tests
npm run test:integration

# Run specific test file
npm test tests/integration/coreMotivationsGenerator/coreMotivationsSelector.integration.test.js

# Run with coverage
npm run test:integration -- --coverage
```

## Manual Testing Checklist

After automated tests pass, perform manual testing:

- [ ] Create 3+ character concepts
- [ ] Add 5+ thematic directions across concepts
- [ ] Add clichés to some but not all directions
- [ ] Open Core Motivations Generator page
- [ ] Verify only directions with clichés appear
- [ ] Verify directions are grouped by concept
- [ ] Select different directions and verify state updates
- [ ] Generate core motivations for selected direction
- [ ] Test keyboard navigation (Tab, Arrow keys)
- [ ] Test with screen reader
- [ ] Check performance with 50+ directions
- [ ] Test error recovery (corrupt localStorage data)

## Related Files

- **Test Helpers**: `tests/common/characterBuilder/characterBuilderIntegrationTestBed.js`
- **Core Motivations Helpers**: `tests/common/coreMotivations/testHelpers.js`
- **Character Database**: `src/characterBuilder/storage/characterDatabase.js`
- **Character Builder Service**: `src/characterBuilder/services/characterBuilderService.js`
- **Controller**: `src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js`
- **Character Models**: `src/characterBuilder/models/characterConcept.js`, `src/characterBuilder/models/thematicDirection.js`, `src/characterBuilder/models/cliche.js`

## Notes

- Integration tests use real `CharacterDatabase` and `CharacterBuilderService` instances
- Mock only external dependencies (LLM service, storage service, direction generator)
- Use actual model classes (`createCharacterConcept`, `createThematicDirection`, `Cliche`)
- Test realistic user scenarios with proper database initialization
- Include edge cases and error conditions
- Database operations use IndexedDB with proper cleanup between tests
- All test data creation follows the actual API patterns used in production code
