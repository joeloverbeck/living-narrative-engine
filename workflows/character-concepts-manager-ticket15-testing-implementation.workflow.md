# Ticket 15: Testing Implementation

## Overview

Create comprehensive unit tests for the CharacterConceptsManagerController, integration tests for service interactions, and ensure all CRUD operations and event handling are properly tested.

## Dependencies

- All previous implementation tickets
- Existing test infrastructure and patterns
- Jest testing framework

## Implementation Details

### 1. Create Unit Test File

Create `tests/unit/domUI/characterConceptsManagerController.test.js`:

```javascript
/**
 * @file Unit tests for CharacterConceptsManagerController
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import { TestBed } from '../../common/testBed.js';

describe('CharacterConceptsManagerController', () => {
  let testBed;
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockDom;

  beforeEach(() => {
    testBed = new TestBed();

    // Create mocks
    mockLogger = testBed.createMockLogger();
    mockCharacterBuilderService = createMockCharacterBuilderService();
    mockEventBus = testBed.createMockEventBus();

    // Setup DOM
    mockDom = setupMockDOM();

    // Create controller
    controller = new CharacterConceptsManagerController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    testBed.cleanup();
    cleanupMockDOM();
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(() => {
        new CharacterConceptsManagerController({});
      }).toThrow();

      expect(() => {
        new CharacterConceptsManagerController({
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should initialize with valid dependencies', () => {
      expect(controller).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterConceptsManagerController initialized'
      );
    });
  });

  describe('initialize', () => {
    it('should cache DOM elements', async () => {
      await controller.initialize();

      // Verify DOM elements were cached
      expect(controller._elements).toBeDefined();
      expect(controller._elements.conceptsContainer).toBeDefined();
    });

    it('should initialize character builder service', async () => {
      await controller.initialize();

      expect(mockCharacterBuilderService.initialize).toHaveBeenCalled();
    });

    it('should load initial concepts data', async () => {
      const mockConcepts = createMockConcepts(3);
      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      await controller.initialize();

      expect(
        mockCharacterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockCharacterBuilderService.initialize.mockRejectedValue(
        new Error('Init failed')
      );

      await expect(controller.initialize()).rejects.toThrow('Init failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should prevent double initialization', async () => {
      await controller.initialize();
      await controller.initialize();

      expect(mockCharacterBuilderService.initialize).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Controller already initialized'
      );
    });
  });
});

/**
 * Create mock character builder service
 */
function createMockCharacterBuilderService() {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
    createCharacterConcept: jest.fn(),
    updateCharacterConcept: jest.fn(),
    deleteCharacterConcept: jest.fn(),
    getThematicDirectionsByConceptId: jest.fn().mockResolvedValue([]),
    getConceptsWithDirectionCounts: jest.fn().mockResolvedValue([]),
  };
}

/**
 * Setup mock DOM structure
 */
function setupMockDOM() {
  document.body.innerHTML = `
        <div id="concepts-container">
            <div id="empty-state"></div>
            <div id="loading-state"></div>
            <div id="error-state">
                <p id="error-message-text"></p>
            </div>
            <div id="results-state">
                <div id="concepts-results"></div>
            </div>
        </div>
        <button id="create-concept-btn"></button>
        <input id="concept-search" />
        <div id="total-concepts">0</div>
        <div id="concept-modal">
            <form id="concept-form">
                <textarea id="concept-text"></textarea>
                <button id="save-concept-btn"></button>
            </form>
        </div>
    `;

  return document;
}

/**
 * Cleanup mock DOM
 */
function cleanupMockDOM() {
  document.body.innerHTML = '';
}

/**
 * Create mock concepts
 */
function createMockConcepts(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `concept-${i}`,
    text: `Test concept ${i}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}
```

### 2. Test Create Concept Functionality

Add tests for concept creation:

```javascript
describe('create concept functionality', () => {
  beforeEach(async () => {
    await controller.initialize();
  });

  it('should show create modal when button clicked', async () => {
    const createBtn = document.getElementById('create-concept-btn');
    const modal = document.getElementById('concept-modal');

    createBtn.click();

    expect(modal.style.display).toBe('flex');
    expect(document.getElementById('concept-modal-title').textContent).toBe(
      'Create Character Concept'
    );
  });

  it('should validate concept text length', async () => {
    const conceptText = document.getElementById('concept-text');
    const saveBtn = document.getElementById('save-concept-btn');

    // Too short
    conceptText.value = 'short';
    conceptText.dispatchEvent(new Event('input'));

    expect(saveBtn.disabled).toBe(true);
    expect(document.getElementById('concept-error').textContent).toContain(
      'at least 10 characters'
    );

    // Valid length
    conceptText.value = 'This is a valid character concept';
    conceptText.dispatchEvent(new Event('input'));

    expect(saveBtn.disabled).toBe(false);
    expect(document.getElementById('concept-error').textContent).toBe('');

    // Too long
    conceptText.value = 'x'.repeat(1001);
    conceptText.dispatchEvent(new Event('input'));

    expect(saveBtn.disabled).toBe(true);
    expect(document.getElementById('concept-error').textContent).toContain(
      'exceed 1000 characters'
    );
  });

  it('should create concept on form submission', async () => {
    const mockConcept = {
      id: 'new-concept-1',
      text: 'A brave knight seeking redemption',
      createdAt: new Date().toISOString(),
    };

    mockCharacterBuilderService.createCharacterConcept.mockResolvedValue(
      mockConcept
    );

    // Fill form
    document.getElementById('concept-text').value = mockConcept.text;

    // Submit form
    const form = document.getElementById('concept-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await testBed.flushPromises();

    expect(
      mockCharacterBuilderService.createCharacterConcept
    ).toHaveBeenCalledWith(mockConcept.text);

    // Modal should close
    expect(document.getElementById('concept-modal').style.display).toBe('none');
  });

  it('should handle creation errors', async () => {
    mockCharacterBuilderService.createCharacterConcept.mockRejectedValue(
      new Error('Creation failed')
    );

    document.getElementById('concept-text').value = 'Test concept';
    document
      .getElementById('concept-form')
      .dispatchEvent(new Event('submit', { cancelable: true }));

    await testBed.flushPromises();

    expect(document.getElementById('concept-error').textContent).toContain(
      'Failed to save concept'
    );
  });
});
```

### 3. Test Display and List Functionality

Add tests for displaying concepts:

```javascript
describe('display concepts functionality', () => {
  it('should display concepts in grid', async () => {
    const mockConcepts = createMockConcepts(3);
    const mockConceptsWithCounts = mockConcepts.map((concept, i) => ({
      concept,
      directionCount: i * 2,
    }));

    mockCharacterBuilderService.getConceptsWithDirectionCounts.mockResolvedValue(
      mockConceptsWithCounts
    );

    await controller.initialize();

    const conceptCards = document.querySelectorAll('.concept-card');
    expect(conceptCards).toHaveLength(3);

    // Check first card content
    const firstCard = conceptCards[0];
    expect(firstCard.querySelector('.concept-text').textContent).toContain(
      'Test concept 0'
    );
    expect(firstCard.querySelector('.direction-count strong').textContent).toBe(
      '0'
    );
  });

  it('should show empty state when no concepts', async () => {
    mockCharacterBuilderService.getConceptsWithDirectionCounts.mockResolvedValue(
      []
    );

    await controller.initialize();

    expect(document.getElementById('empty-state').style.display).toBe('block');
    expect(document.getElementById('results-state').style.display).toBe('none');
  });

  it('should show loading state during data fetch', async () => {
    let resolvePromise;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockCharacterBuilderService.getConceptsWithDirectionCounts.mockReturnValue(
      promise
    );

    const initPromise = controller.initialize();

    // Should show loading
    expect(document.getElementById('loading-state').style.display).toBe(
      'block'
    );

    // Resolve and wait
    resolvePromise([]);
    await initPromise;

    // Loading should be hidden
    expect(document.getElementById('loading-state').style.display).toBe('none');
  });

  it('should update statistics correctly', async () => {
    const mockConceptsWithCounts = [
      { concept: createMockConcepts(1)[0], directionCount: 5 },
      { concept: createMockConcepts(1)[0], directionCount: 0 },
      { concept: createMockConcepts(1)[0], directionCount: 3 },
    ];

    mockCharacterBuilderService.getConceptsWithDirectionCounts.mockResolvedValue(
      mockConceptsWithCounts
    );

    await controller.initialize();

    expect(document.getElementById('total-concepts').textContent).toBe('3');
    expect(
      document.getElementById('concepts-with-directions').textContent
    ).toBe('2');
    expect(document.getElementById('total-directions').textContent).toBe('8');
  });
});
```

### 4. Test Edit Functionality

Add tests for editing concepts:

```javascript
describe('edit concept functionality', () => {
  let mockConcepts;

  beforeEach(async () => {
    mockConcepts = createMockConcepts(2);
    mockCharacterBuilderService.getConceptsWithDirectionCounts.mockResolvedValue(
      mockConcepts.map((c) => ({ concept: c, directionCount: 0 }))
    );

    await controller.initialize();
  });

  it('should populate form when editing', async () => {
    const editBtn = document.querySelector('.concept-card .edit-btn');
    editBtn.click();

    await testBed.flushPromises();

    const conceptText = document.getElementById('concept-text');
    expect(conceptText.value).toBe(mockConcepts[0].text);

    expect(document.getElementById('concept-modal-title').textContent).toBe(
      'Edit Character Concept'
    );
    expect(document.getElementById('save-concept-btn').textContent).toBe(
      'Update Concept'
    );
  });

  it('should update concept on save', async () => {
    const updatedConcept = {
      ...mockConcepts[0],
      text: 'Updated concept text',
      updatedAt: new Date().toISOString(),
    };

    mockCharacterBuilderService.updateCharacterConcept.mockResolvedValue(
      updatedConcept
    );

    // Open edit modal
    document.querySelector('.edit-btn').click();

    // Change text
    document.getElementById('concept-text').value = updatedConcept.text;

    // Submit
    document
      .getElementById('concept-form')
      .dispatchEvent(new Event('submit', { cancelable: true }));

    await testBed.flushPromises();

    expect(
      mockCharacterBuilderService.updateCharacterConcept
    ).toHaveBeenCalledWith(mockConcepts[0].id, updatedConcept.text);
  });

  it('should not update if text unchanged', async () => {
    // Open edit modal
    document.querySelector('.edit-btn').click();

    // Submit without changes
    document
      .getElementById('concept-form')
      .dispatchEvent(new Event('submit', { cancelable: true }));

    await testBed.flushPromises();

    expect(
      mockCharacterBuilderService.updateCharacterConcept
    ).not.toHaveBeenCalled();
  });
});
```

### 5. Test Delete Functionality

Add tests for deletion with cascade:

```javascript
describe('delete concept functionality', () => {
  let mockConcepts;

  beforeEach(async () => {
    mockConcepts = [
      { concept: createMockConcepts(1)[0], directionCount: 5 },
      { concept: createMockConcepts(1)[0], directionCount: 0 },
    ];

    mockCharacterBuilderService.getConceptsWithDirectionCounts.mockResolvedValue(
      mockConcepts
    );

    await controller.initialize();
  });

  it('should show confirmation modal with direction warning', () => {
    const deleteBtn = document.querySelector('.concept-card .delete-btn');
    deleteBtn.click();

    const deleteMessage = document.getElementById('delete-modal-message');
    expect(deleteMessage.innerHTML).toContain('5');
    expect(deleteMessage.innerHTML).toContain('associated thematic directions');
    expect(deleteMessage.innerHTML).toContain('cannot be undone');
  });

  it('should delete concept on confirmation', async () => {
    mockCharacterBuilderService.deleteCharacterConcept.mockResolvedValue(
      undefined
    );

    // Click delete
    document.querySelector('.delete-btn').click();

    // Confirm
    document.getElementById('confirm-delete-btn').click();

    await testBed.flushPromises();

    expect(
      mockCharacterBuilderService.deleteCharacterConcept
    ).toHaveBeenCalledWith(mockConcepts[0].concept.id);
  });

  it('should not delete on cancel', async () => {
    // Click delete
    document.querySelector('.delete-btn').click();

    // Cancel
    document.getElementById('cancel-delete-btn').click();

    await testBed.flushPromises();

    expect(
      mockCharacterBuilderService.deleteCharacterConcept
    ).not.toHaveBeenCalled();

    // Modal should be hidden
    expect(
      document.getElementById('delete-confirmation-modal').style.display
    ).toBe('none');
  });

  it('should handle deletion errors', async () => {
    mockCharacterBuilderService.deleteCharacterConcept.mockRejectedValue(
      new Error('Delete failed')
    );

    document.querySelector('.delete-btn').click();
    document.getElementById('confirm-delete-btn').click();

    await testBed.flushPromises();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to delete concept',
      expect.any(Error)
    );
  });
});
```

### 6. Test Search Functionality

Add tests for search and filtering:

```javascript
describe('search functionality', () => {
  beforeEach(async () => {
    const mockConcepts = [
      {
        concept: { ...createMockConcepts(1)[0], text: 'A brave knight' },
        directionCount: 0,
      },
      {
        concept: { ...createMockConcepts(1)[0], text: 'A wise wizard' },
        directionCount: 0,
      },
      {
        concept: { ...createMockConcepts(1)[0], text: 'A cunning thief' },
        directionCount: 0,
      },
    ];

    mockCharacterBuilderService.getConceptsWithDirectionCounts.mockResolvedValue(
      mockConcepts
    );

    await controller.initialize();
  });

  it('should filter concepts based on search term', async () => {
    const searchInput = document.getElementById('concept-search');

    // Search for "wizard"
    searchInput.value = 'wizard';
    searchInput.dispatchEvent(new Event('input'));

    // Wait for debounce
    await testBed.wait(350);

    const visibleCards = document.querySelectorAll(
      '.concept-card:not([style*="display: none"])'
    );
    expect(visibleCards).toHaveLength(1);
    expect(
      visibleCards[0].querySelector('.concept-text').textContent
    ).toContain('wizard');
  });

  it('should show no results message when no matches', async () => {
    const searchInput = document.getElementById('concept-search');

    searchInput.value = 'dragon';
    searchInput.dispatchEvent(new Event('input'));

    await testBed.wait(350);

    expect(document.querySelector('.no-search-results')).toBeTruthy();
    expect(document.querySelector('.no-search-results').textContent).toContain(
      'No concepts match your search'
    );
  });

  it('should clear search on clear button click', async () => {
    const searchInput = document.getElementById('concept-search');

    // Set search
    searchInput.value = 'wizard';
    searchInput.dispatchEvent(new Event('input'));

    await testBed.wait(350);

    // Click clear
    const clearBtn = document.querySelector('.search-clear-btn');
    clearBtn.click();

    expect(searchInput.value).toBe('');
    expect(document.querySelectorAll('.concept-card')).toHaveLength(3);
  });
});
```

### 7. Test Event Handling

Add tests for service event handling:

```javascript
describe('event handling', () => {
  beforeEach(async () => {
    await controller.initialize();
  });

  it('should handle concept created event', async () => {
    const newConcept = createMockConcepts(1)[0];

    mockEventBus.dispatch({
      type: 'character-builder:concept-created',
      payload: { concept: newConcept },
    });

    await testBed.flushPromises();

    // Should add new card
    const cards = document.querySelectorAll('.concept-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('should handle concept updated event', async () => {
    // Setup initial concept
    const concepts = [
      {
        concept: createMockConcepts(1)[0],
        directionCount: 0,
      },
    ];
    mockCharacterBuilderService.getConceptsWithDirectionCounts.mockResolvedValue(
      concepts
    );

    await controller.initialize();

    // Update concept
    const updatedConcept = {
      ...concepts[0].concept,
      text: 'Updated text',
    };

    mockEventBus.dispatch({
      type: 'character-builder:concept-updated',
      payload: { concept: updatedConcept },
    });

    await testBed.flushPromises();

    // Card should be updated
    expect(document.querySelector('.concept-text').textContent).toContain(
      'Updated text'
    );
  });

  it('should handle concept deleted event', async () => {
    const concepts = [
      {
        concept: createMockConcepts(1)[0],
        directionCount: 0,
      },
    ];
    mockCharacterBuilderService.getConceptsWithDirectionCounts.mockResolvedValue(
      concepts
    );

    await controller.initialize();

    mockEventBus.dispatch({
      type: 'character-builder:concept-deleted',
      payload: {
        conceptId: concepts[0].concept.id,
        cascadedDirections: 0,
      },
    });

    await testBed.flushPromises();

    // Card should be removed
    expect(document.querySelectorAll('.concept-card')).toHaveLength(0);
  });

  it('should handle directions generated event', async () => {
    const concepts = [
      {
        concept: createMockConcepts(1)[0],
        directionCount: 0,
      },
    ];
    mockCharacterBuilderService.getConceptsWithDirectionCounts.mockResolvedValue(
      concepts
    );

    await controller.initialize();

    mockEventBus.dispatch({
      type: 'character-builder:directions-generated',
      payload: {
        conceptId: concepts[0].concept.id,
        count: 5,
      },
    });

    await testBed.flushPromises();

    // Direction count should update
    expect(document.querySelector('.direction-count strong').textContent).toBe(
      '5'
    );
  });
});
```

### 8. Create Integration Test File

Create `tests/integration/characterConceptsManager.integration.test.js`:

```javascript
/**
 * @file Integration tests for Character Concepts Manager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestEnvironment } from '../common/testEnvironment.js';
import { CHARACTER_BUILDER_EVENTS } from '../../src/characterBuilder/characterBuilderEvents.js';

describe('Character Concepts Manager Integration', () => {
  let env;
  let characterBuilderService;
  let controller;

  beforeEach(async () => {
    env = await createTestEnvironment({
      withIndexedDB: true,
      withDOM: true,
    });

    characterBuilderService = env.container.resolve('ICharacterBuilderService');
    await characterBuilderService.initialize();

    // Create controller with real dependencies
    const { CharacterConceptsManagerController } = await import(
      '../../src/domUI/characterConceptsManagerController.js'
    );

    controller = new CharacterConceptsManagerController({
      logger: env.logger,
      characterBuilderService,
      eventBus: env.eventBus,
    });

    await controller.initialize();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should create, display, and delete concept with real service', async () => {
    // Create concept
    const conceptText = 'A mysterious wanderer with hidden powers';
    const concept =
      await characterBuilderService.createCharacterConcept(conceptText);

    expect(concept.id).toBeDefined();
    expect(concept.text).toBe(conceptText);

    // Verify event was dispatched
    expect(env.eventBus.dispatch).toHaveBeenCalledWith({
      type: CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED,
      payload: expect.objectContaining({ concept }),
    });

    // Load and verify display
    const conceptsWithCounts =
      await characterBuilderService.getConceptsWithDirectionCounts();
    expect(conceptsWithCounts).toHaveLength(1);
    expect(conceptsWithCounts[0].concept.text).toBe(conceptText);
    expect(conceptsWithCounts[0].directionCount).toBe(0);

    // Delete concept
    await characterBuilderService.deleteCharacterConcept(concept.id);

    // Verify deletion
    const remainingConcepts =
      await characterBuilderService.getAllCharacterConcepts();
    expect(remainingConcepts).toHaveLength(0);
  });

  it('should handle cascade deletion of thematic directions', async () => {
    // Create concept
    const concept = await characterBuilderService.createCharacterConcept(
      'Test concept for cascade deletion'
    );

    // Create thematic directions
    const direction1 = await characterBuilderService.createThematicDirection(
      concept.id,
      'First thematic direction'
    );
    const direction2 = await characterBuilderService.createThematicDirection(
      concept.id,
      'Second thematic direction'
    );

    // Verify directions exist
    const directions =
      await characterBuilderService.getThematicDirectionsByConceptId(
        concept.id
      );
    expect(directions).toHaveLength(2);

    // Delete concept (should cascade)
    await characterBuilderService.deleteCharacterConcept(concept.id);

    // Verify cascade deletion
    const remainingDirections =
      await characterBuilderService.getAllThematicDirections();
    expect(remainingDirections).toHaveLength(0);

    // Verify event includes cascade info
    expect(env.eventBus.dispatch).toHaveBeenCalledWith({
      type: CHARACTER_BUILDER_EVENTS.CONCEPT_DELETED,
      payload: expect.objectContaining({
        conceptId: concept.id,
        cascadedDirections: 2,
      }),
    });
  });
});
```

### 9. Create E2E Test File

Create `tests/e2e/characterConceptsManager.e2e.test.js`:

```javascript
/**
 * @file E2E tests for Character Concepts Manager workflow
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createFullTestEnvironment } from '../common/fullTestEnvironment.js';

describe('Character Concepts Manager E2E', () => {
  let env;
  let page;

  beforeEach(async () => {
    env = await createFullTestEnvironment();
    page = env.page;

    // Navigate to concepts manager
    await page.goto('/character-concepts-manager.html');
    await page.waitForSelector('#character-concepts-manager-container');
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should complete full workflow: create, edit, and delete', async () => {
    // Should show empty state initially
    await expect(page).toMatchElement('#empty-state', { visible: true });

    // Click create button
    await page.click('#create-first-btn');

    // Should show modal
    await expect(page).toMatchElement('#concept-modal', { visible: true });

    // Fill in concept
    const conceptText = 'An ancient dragon seeking redemption for past sins';
    await page.type('#concept-text', conceptText);

    // Character count should update
    const charCount = await page.$eval('#char-count', (el) => el.textContent);
    expect(charCount).toBe(`${conceptText.length}/1000`);

    // Save button should be enabled
    const saveDisabled = await page.$eval(
      '#save-concept-btn',
      (el) => el.disabled
    );
    expect(saveDisabled).toBe(false);

    // Submit form
    await page.click('#save-concept-btn');

    // Wait for modal to close and card to appear
    await page.waitForSelector('#concept-modal', { hidden: true });
    await page.waitForSelector('.concept-card');

    // Verify concept card content
    const cardText = await page.$eval('.concept-text', (el) => el.textContent);
    expect(cardText).toContain('ancient dragon');

    // Edit concept
    await page.click('.edit-btn');
    await page.waitForSelector('#concept-modal', { visible: true });

    // Clear and type new text
    await page.evaluate(() => {
      document.getElementById('concept-text').value = '';
    });
    await page.type('#concept-text', 'A reformed dragon teaching young heroes');
    await page.click('#save-concept-btn');

    // Verify update
    await page.waitForSelector('#concept-modal', { hidden: true });
    const updatedText = await page.$eval(
      '.concept-text',
      (el) => el.textContent
    );
    expect(updatedText).toContain('reformed dragon');

    // Delete concept
    await page.click('.delete-btn');
    await page.waitForSelector('#delete-confirmation-modal', { visible: true });

    // Verify warning message
    const deleteMessage = await page.$eval(
      '#delete-modal-message',
      (el) => el.textContent
    );
    expect(deleteMessage).toContain('Are you sure');

    // Confirm deletion
    await page.click('#confirm-delete-btn');

    // Should return to empty state
    await page.waitForSelector('#empty-state', { visible: true });

    // Verify statistics updated
    const totalConcepts = await page.$eval(
      '#total-concepts',
      (el) => el.textContent
    );
    expect(totalConcepts).toBe('0');
  });

  it('should integrate with thematic direction generator', async () => {
    // Create a concept first
    await page.click('#create-concept-btn');
    await page.type('#concept-text', 'A noble knight on a quest');
    await page.click('#save-concept-btn');
    await page.waitForSelector('.concept-card');

    // Navigate to thematic direction generator
    await page.goto('/thematic-direction-generator.html');
    await page.waitForSelector('#concept-selector');

    // Concept should appear in dropdown
    const options = await page.$$eval('#concept-selector option', (opts) =>
      opts.map((o) => o.textContent)
    );
    expect(options).toContain(expect.stringContaining('noble knight'));

    // Select concept
    await page.select(
      '#concept-selector',
      expect.stringContaining('noble knight')
    );

    // Selected concept should display
    await expect(page).toMatchElement('#selected-concept-display', {
      visible: true,
    });
    const displayedConcept = await page.$eval(
      '#concept-content',
      (el) => el.textContent
    );
    expect(displayedConcept).toContain('noble knight on a quest');
  });
});
```

### 10. Add Test Utilities

Create test utilities in `tests/common/characterBuilderTestUtils.js`:

```javascript
/**
 * @file Test utilities for Character Builder tests
 */

/**
 * Create mock character concepts
 * @param {number} count
 * @param {Object} overrides
 * @returns {Array}
 */
export function createMockConcepts(count, overrides = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: `concept-${Date.now()}-${i}`,
    text: `Test character concept ${i}: A detailed description of a character`,
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - i * 86400000).toISOString(),
    ...overrides,
  }));
}

/**
 * Create mock thematic directions
 * @param {string} conceptId
 * @param {number} count
 * @returns {Array}
 */
export function createMockDirections(conceptId, count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `direction-${Date.now()}-${i}`,
    conceptId,
    text: `Thematic direction ${i} for the character`,
    temperature: 0.7,
    createdAt: new Date().toISOString(),
  }));
}

/**
 * Setup DOM for Character Concepts Manager tests
 * @returns {Document}
 */
export function setupConceptsManagerDOM() {
  const html = `
        <div id="character-concepts-manager-container">
            <!-- Complete DOM structure from HTML file -->
        </div>
    `;

  document.body.innerHTML = html;
  return document;
}

/**
 * Wait for UI state change
 * @param {string} state - 'empty', 'loading', 'error', 'results'
 * @param {number} timeout
 */
export async function waitForUIState(state, timeout = 5000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const stateElement = document.getElementById(`${state}-state`);
    if (stateElement && stateElement.style.display !== 'none') {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timeout waiting for UI state: ${state}`);
}

/**
 * Simulate user typing with realistic delays
 * @param {HTMLElement} element
 * @param {string} text
 */
export async function simulateTyping(element, text) {
  element.focus();

  for (const char of text) {
    element.value += char;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) =>
      setTimeout(resolve, 50 + Math.random() * 50)
    );
  }
}
```

## Acceptance Criteria

1. ✅ Unit tests for controller with mocked dependencies
2. ✅ Tests for all CRUD operations (create, read, update, delete)
3. ✅ Tests for search and filtering functionality
4. ✅ Tests for event handling from service
5. ✅ Tests for error scenarios and recovery
6. ✅ Integration tests with real service
7. ✅ E2E tests for complete workflows
8. ✅ Test utilities for common operations
9. ✅ Tests for UI state management
10. ✅ Tests for cross-page integration

## Testing Requirements

1. All tests should be isolated and not depend on external state
2. Use proper setup and teardown to prevent test pollution
3. Mock external dependencies in unit tests
4. Use real implementations in integration tests
5. Test both success and failure paths
6. Verify UI updates after operations
7. Test accessibility features
8. Ensure adequate code coverage (>80%)

## Running Tests

```bash
# Run unit tests
npm run test:unit tests/unit/domUI/characterConceptsManagerController.test.js

# Run integration tests
npm run test:integration tests/integration/characterConceptsManager.integration.test.js

# Run E2E tests
npm run test:e2e tests/e2e/characterConceptsManager.e2e.test.js

# Run all tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Notes

- Follow existing test patterns in the codebase
- Use descriptive test names that explain the scenario
- Group related tests using describe blocks
- Keep tests focused on single behaviors
- Use test utilities to reduce duplication
- Consider edge cases and error scenarios
- Test loading states and async operations
- Verify event dispatching and handling
- Ensure tests run quickly and reliably
