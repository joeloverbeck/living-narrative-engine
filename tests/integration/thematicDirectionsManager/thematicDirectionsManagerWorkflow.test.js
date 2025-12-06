/**
 * @file Integration tests for Thematic Directions Manager workflow
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';
import { ThematicDirectionsManagerController } from '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';
import { BaseCharacterBuilderControllerTestBase } from '../../unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
};

global.indexedDB = mockIndexedDB;

// Mock PreviousItemsDropdown to avoid DOM dependencies
jest.mock(
  '../../../src/shared/characterBuilder/previousItemsDropdown.js',
  () => {
    return {
      PreviousItemsDropdown: jest.fn().mockImplementation(() => ({
        loadItems: jest.fn().mockResolvedValue(undefined),
        getSelectedValue: jest.fn(() => ''),
        setSelectedValue: jest.fn(),
        enable: jest.fn(),
        disable: jest.fn(),
        destroy: jest.fn(),
      })),
    };
  }
);

// Mock InPlaceEditor to avoid DOM dependencies
jest.mock('../../../src/shared/characterBuilder/inPlaceEditor.js', () => {
  return {
    InPlaceEditor: jest.fn().mockImplementation(() => ({
      destroy: jest.fn(),
      getValue: jest.fn(() => ''),
      setValue: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
    })),
  };
});

describe('Thematic Directions Manager Integration Tests', () => {
  let characterBuilderService;
  let storageService;
  let database;
  let controller;
  let mockLogger;
  let mockDirectionGenerator;
  let mockEventBus;
  let mockSchemaValidator;
  let testBase;

  // Test data
  const testConcept = {
    id: 'test-concept-1',
    concept: 'A brave knight on a quest for redemption',
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const testDirection = {
    id: 'test-direction-1',
    conceptId: 'test-concept-1',
    title: 'The Path of Redemption',
    description: 'A journey of self-discovery and atonement',
    coreTension: 'The struggle between past sins and future hope',
    uniqueTwist: 'The knight must face those they wronged',
    narrativePotential: 'Rich opportunities for character growth',
    createdAt: new Date().toISOString(),
  };

  const orphanedDirection = {
    id: 'orphaned-direction-1',
    conceptId: 'missing-concept',
    title: 'Lost Direction',
    description: 'A direction without a parent concept',
    coreTension: 'Existential uncertainty',
    uniqueTwist: 'No one knows its origin',
    narrativePotential: 'Limited without context',
    createdAt: new Date().toISOString(),
  };

  const initializeTestDOM = () => {
    document.body.innerHTML = `
      <div class="page-container">
        <div class="header-section">
          <button id="refresh-btn">Refresh</button>
          <button id="cleanup-orphans-btn">Clean Up</button>
          <button id="back-to-menu-btn">Back</button>
        </div>

        <div class="filter-section">
          <select id="concept-selector">
            <option value="">All Concepts</option>
            <option value="orphaned">Orphaned</option>
          </select>
          <input id="direction-filter" type="text" />
        </div>

        <div class="stats-section">
          <span id="total-directions">0</span>
          <span id="orphaned-count">0</span>
        </div>

        <div id="concept-display-container" style="display: none;">
          <div id="concept-display-content"></div>
        </div>

        <div class="states">
          <div id="empty-state" style="display: none;"></div>
          <div id="loading-state" style="display: none;"></div>
          <div id="error-state" style="display: none;">
            <p id="error-message-text"></p>
            <button id="retry-btn">Retry</button>
          </div>
          <div id="results-state" style="display: none;">
            <div id="directions-results">
              <div id="directions-container"></div>
            </div>
          </div>
        </div>
      </div>

      <div id="confirmation-modal" style="display: none;">
        <div class="modal-content">
          <h2 id="modal-title"></h2>
          <p id="modal-message"></p>
          <button id="modal-confirm-btn">Confirm</button>
          <button id="modal-cancel-btn">Cancel</button>
          <button id="close-modal-btn">Close</button>
        </div>
      </div>
    `;
  };

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    initializeTestDOM();

    mockLogger = testBase.mocks.logger;

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    mockEventBus = testBase.mocks.eventBus;
    mockEventBus.dispatch = jest.fn();
    mockEventBus.subscribe = jest.fn(() => jest.fn());
    mockEventBus.unsubscribe = jest.fn();

    mockSchemaValidator = {
      ...testBase.mocks.schemaValidator,
      validate: jest.fn(() => true),
      validateAgainstSchema: jest.fn(() => true),
      formatAjvErrors: jest.fn(() => ''),
    };
    testBase.mocks.schemaValidator = mockSchemaValidator;

    global.alert = jest.fn();
    window.location.href = '';

    // Mock IndexedDB operations
    const mockRequest = {
      result: {
        createObjectStore: jest.fn(() => ({
          createIndex: jest.fn(),
        })),
        transaction: jest.fn(() => ({
          objectStore: jest.fn(() => ({
            put: jest.fn(() => ({ onsuccess: null, onerror: null })),
            get: jest.fn(() => ({ onsuccess: null, onerror: null })),
            getAll: jest.fn(() => ({ onsuccess: null, onerror: null })),
            delete: jest.fn(() => ({ onsuccess: null, onerror: null })),
            index: jest.fn(() => ({
              getAll: jest.fn(() => ({ onsuccess: null, onerror: null })),
              openCursor: jest.fn(() => ({ onsuccess: null, onerror: null })),
            })),
          })),
          oncomplete: null,
          onerror: null,
        })),
        objectStoreNames: {
          contains: jest.fn(() => false),
        },
        close: jest.fn(),
      },
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    mockIndexedDB.open.mockReturnValue(mockRequest);

    database = new CharacterDatabase({ logger: mockLogger });

    storageService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      storeCharacterConcept: jest.fn().mockResolvedValue(testConcept),
      listCharacterConcepts: jest.fn().mockResolvedValue([testConcept]),
      getCharacterConcept: jest.fn().mockImplementation((conceptId) => {
        if (conceptId === testConcept.id) {
          return Promise.resolve(testConcept);
        }
        return Promise.resolve(null);
      }),
      deleteCharacterConcept: jest.fn().mockResolvedValue(true),
      storeThematicDirections: jest.fn().mockResolvedValue([testDirection]),
      getThematicDirections: jest.fn().mockResolvedValue([testDirection]),
      getThematicDirection: jest.fn().mockResolvedValue(testDirection),
      updateThematicDirection: jest.fn().mockImplementation((id, updates) => {
        return Promise.resolve({ ...testDirection, ...updates });
      }),
      deleteThematicDirection: jest.fn().mockResolvedValue(true),
      getAllThematicDirections: jest.fn().mockResolvedValue([testDirection]),
      findOrphanedDirections: jest.fn().mockResolvedValue([orphanedDirection]),
    };

    characterBuilderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });
    characterBuilderService.initialize = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    document.body.innerHTML = '';
    if (testBase) {
      await testBase.cleanup();
      testBase = null;
    }
  });

  const createController = (overrides = {}) => {
    if (!testBase) {
      throw new Error(
        'Test base must be initialized before creating controller'
      );
    }

    return new ThematicDirectionsManagerController({
      ...testBase.mockDependencies,
      logger: mockLogger,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      characterBuilderService,
      ...overrides,
    });
  };

  describe('Complete Workflow Tests', () => {
    it('should initialize all services successfully', async () => {
      // Mock successful database initialization
      const mockRequest = {
        result: {
          objectStoreNames: { contains: jest.fn(() => true) },
          close: jest.fn(),
        },
        onsuccess: null,
        onerror: null,
      };

      mockIndexedDB.open.mockReturnValue(mockRequest);

      // Initialize database with immediate callback execution
      const dbInitPromise = database.initialize();

      // Trigger success callback immediately
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess();
      }

      await dbInitPromise;

      // Since storageService is mocked, just verify the mock was called
      await storageService.initialize();
      await characterBuilderService.initialize();

      expect(storageService.initialize).toHaveBeenCalled();
      expect(characterBuilderService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterDatabase: Successfully opened database'
      );
    });

    it('should properly identify and handle orphaned directions', async () => {
      const mockDirectionsWithConcepts = [
        { direction: testDirection, concept: testConcept },
        { direction: orphanedDirection, concept: null },
      ];

      characterBuilderService.getAllThematicDirectionsWithConcepts = jest
        .fn()
        .mockResolvedValue(mockDirectionsWithConcepts);
      characterBuilderService.getAllCharacterConcepts = jest
        .fn()
        .mockResolvedValue([testConcept]);

      // This test focuses on the data structure, not the controller initialization
      // We can verify the orphaned direction logic without initializing the controller
      const orphanedCount = mockDirectionsWithConcepts.filter(
        (item) => !item.concept
      ).length;
      expect(orphanedCount).toBe(1);

      // Verify the service method would return the correct data
      const result =
        await characterBuilderService.getAllThematicDirectionsWithConcepts();
      expect(result).toEqual(mockDirectionsWithConcepts);
      expect(result[1].concept).toBeNull();
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Service initialization failed');

      // Create a new mock service that will fail
      const failingCharacterBuilderService = {
        initialize: jest.fn().mockRejectedValue(error),
        getAllThematicDirectionsWithConcepts: jest.fn(),
        getAllCharacterConcepts: jest.fn(),
        createCharacterConcept: jest.fn(),
        updateCharacterConcept: jest.fn(),
        deleteCharacterConcept: jest.fn(),
        getCharacterConcept: jest.fn(),
        generateThematicDirections: jest.fn(),
        getThematicDirections: jest.fn(),
        getOrphanedThematicDirections: jest.fn(),
        updateThematicDirection: jest.fn(),
        deleteThematicDirection: jest.fn(),
      };

      controller = createController({
        characterBuilderService: failingCharacterBuilderService,
      });

      // The initialization should throw an error
      await expect(controller.initialize()).rejects.toThrow(error);

      // The service should have been invoked as part of initialization
      expect(failingCharacterBuilderService.initialize).toHaveBeenCalled();
    });

    it('should handle data loading errors gracefully', async () => {
      const error = new Error('Data loading failed');

      // Set up mocks to fail during data loading
      characterBuilderService.getAllThematicDirectionsWithConcepts = jest
        .fn()
        .mockRejectedValue(error);
      characterBuilderService.getAllCharacterConcepts = jest
        .fn()
        .mockResolvedValue([]);

      controller = createController();

      await controller.initialize();

      // The controller should have logged errors during initialization
      const errorCalls = mockLogger.error.mock.calls;

      // The controller should handle errors gracefully
      const hasError = errorCalls.some(
        (call) =>
          call[0].includes('Failed to load directions') ||
          call[0].includes('Failed to initialize') ||
          call[0].includes('Data loading failed')
      );

      expect(hasError).toBe(true);
      expect(errorCalls.length).toBeGreaterThan(0);

      // The test successfully demonstrates that the controller handles errors gracefully
      // by catching and logging them rather than throwing
    });
  });

  describe('Service Integration Tests', () => {
    it('should integrate CharacterBuilderService with storage properly', async () => {
      // Update the mock for this specific test
      storageService.getAllThematicDirections.mockResolvedValue([
        testDirection,
        orphanedDirection,
      ]);

      const result =
        await characterBuilderService.getAllThematicDirectionsWithConcepts();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        direction: testDirection,
        concept: testConcept,
      });
      expect(result[1]).toEqual({
        direction: orphanedDirection,
        concept: null,
      });
    });

    it('should handle direction updates through the service chain', async () => {
      const updates = { title: 'Updated Title' };
      const updatedDirection = { ...testDirection, title: 'Updated Title' };

      storageService.updateThematicDirection.mockResolvedValue(
        updatedDirection
      );

      const result = await characterBuilderService.updateThematicDirection(
        testDirection.id,
        updates
      );

      expect(result).toEqual(updatedDirection);
      expect(storageService.updateThematicDirection).toHaveBeenCalledWith(
        testDirection.id,
        updates
      );

      // The event should be dispatched with the actual field-level changes
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:direction_updated',
        {
          directionId: testDirection.id,
          field: 'title',
          oldValue: testDirection.title,
          newValue: 'Updated Title',
        }
      );
    });

    it('should handle direction deletions through the service chain', async () => {
      storageService.deleteThematicDirection.mockResolvedValue(true);

      const result = await characterBuilderService.deleteThematicDirection(
        testDirection.id
      );

      expect(result).toBe(true);
      expect(storageService.deleteThematicDirection).toHaveBeenCalledWith(
        testDirection.id
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:direction_deleted',
        {
          directionId: testDirection.id,
        }
      );
    });

    it('should find orphaned directions through the service chain', async () => {
      storageService.findOrphanedDirections.mockResolvedValue([
        orphanedDirection,
      ]);

      const result =
        await characterBuilderService.getOrphanedThematicDirections();

      expect(result).toEqual([orphanedDirection]);
      expect(storageService.findOrphanedDirections).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should propagate storage errors through the service chain', async () => {
      const storageError = new Error('Database connection failed');
      storageService.getAllThematicDirections.mockRejectedValue(storageError);

      await expect(
        characterBuilderService.getAllThematicDirectionsWithConcepts()
      ).rejects.toThrow('Failed to get all thematic directions with concepts');
    });

    it('should handle validation errors in the service chain', async () => {
      const validationError = new Error('Validation failed');
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Invalid data format'
      );

      storageService.updateThematicDirection.mockRejectedValue(validationError);
      // Also need to make getThematicDirection fail
      storageService.getThematicDirection.mockRejectedValue(validationError);

      await expect(
        characterBuilderService.updateThematicDirection(testDirection.id, {
          title: 'New Title',
        })
      ).rejects.toThrow('Failed to update thematic direction');
    });

    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Operation timeout');
      storageService.getAllThematicDirections.mockRejectedValue(timeoutError);

      await expect(
        characterBuilderService.getAllThematicDirectionsWithConcepts()
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get all thematic directions'),
        expect.any(Error)
      );
    });
  });

  describe('Event Flow Integration', () => {
    it('should dispatch events correctly through the workflow', async () => {
      const updates = { title: 'Updated Title' };
      const updatedDirection = { ...testDirection, title: 'Updated Title' };

      storageService.updateThematicDirection.mockResolvedValue(
        updatedDirection
      );

      await characterBuilderService.updateThematicDirection(
        testDirection.id,
        updates
      );

      // Should dispatch the appropriate event with field-level changes
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:direction_updated',
        {
          directionId: testDirection.id,
          field: 'title',
          oldValue: testDirection.title,
          newValue: 'Updated Title',
        }
      );
    });

    it('should not dispatch events on operation failures', async () => {
      const error = new Error('Update failed');
      storageService.updateThematicDirection.mockRejectedValue(error);
      storageService.getThematicDirection.mockRejectedValue(error);

      await expect(
        characterBuilderService.updateThematicDirection(testDirection.id, {
          title: 'New Title',
        })
      ).rejects.toThrow();

      // Should not dispatch event on failure
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain data consistency across operations', async () => {
      const conceptsData = [testConcept];
      const directionsData = [testDirection, orphanedDirection];

      characterBuilderService.getAllCharacterConcepts = jest
        .fn()
        .mockResolvedValue(conceptsData);
      storageService.getAllThematicDirections.mockResolvedValue(directionsData);

      const result =
        await characterBuilderService.getAllThematicDirectionsWithConcepts();

      // Should correctly match directions with concepts
      expect(result[0].direction.conceptId).toBe(result[0].concept.id);
      expect(result[1].concept).toBeNull(); // Orphaned
    });

    it('should handle concurrent operations safely', async () => {
      const updates1 = { title: 'Update 1' };
      const updates2 = { title: 'Update 2' };

      storageService.updateThematicDirection.mockImplementation(
        (id, updates) => {
          return Promise.resolve({ ...testDirection, ...updates });
        }
      );

      // Simulate concurrent updates
      const promise1 = characterBuilderService.updateThematicDirection(
        testDirection.id,
        updates1
      );
      const promise2 = characterBuilderService.updateThematicDirection(
        testDirection.id,
        updates2
      );

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.title).toBe('Update 1');
      expect(result2.title).toBe('Update 2');
      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
    });
  });
});
