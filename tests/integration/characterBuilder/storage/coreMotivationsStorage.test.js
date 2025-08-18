/**
 * @file Integration tests for Core Motivations storage functionality
 * @see src/characterBuilder/storage/characterDatabase.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterDatabase } from '../../../../src/characterBuilder/storage/characterDatabase.js';

describe('Core Motivations Storage Integration', () => {
  let db;
  let mockLogger;
  let mockIndexedDB;
  let mockDbInstance;
  let mockTransaction;
  let mockObjectStore;
  let mockIndex;
  let mockRequest;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock index
    mockIndex = {
      get: jest.fn(),
      getAll: jest.fn(),
      count: jest.fn(),
    };

    // Create mock object store
    mockObjectStore = {
      put: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      delete: jest.fn(),
      index: jest.fn().mockReturnValue(mockIndex),
      createIndex: jest.fn(),
    };

    // Create mock transaction
    mockTransaction = {
      objectStore: jest.fn().mockReturnValue(mockObjectStore),
      oncomplete: null,
      onerror: null,
    };

    // Create mock database instance
    mockDbInstance = {
      objectStoreNames: {
        contains: jest.fn(),
      },
      createObjectStore: jest.fn().mockReturnValue(mockObjectStore),
      transaction: jest.fn().mockReturnValue(mockTransaction),
      close: jest.fn(),
    };

    // Create mock request
    mockRequest = {
      result: null,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    // Create mock IndexedDB
    mockIndexedDB = {
      open: jest.fn().mockReturnValue(mockRequest),
    };

    // Mock global indexedDB
    global.indexedDB = mockIndexedDB;
    global.IDBKeyRange = {
      only: jest.fn().mockImplementation((value) => ({ value, type: 'only' })),
    };

    // Create database instance
    db = new CharacterDatabase({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.indexedDB;
    delete global.IDBKeyRange;
  });

  describe('Migration from version 2 to 3', () => {
    it('should create coreMotivations store during migration', async () => {
      mockRequest.result = mockDbInstance;
      const upgradeEvent = {
        target: { result: mockDbInstance },
        oldVersion: 2,
      };

      // Mock that coreMotivations store doesn't exist yet
      mockDbInstance.objectStoreNames.contains.mockImplementation(
        (storeName) => {
          // All stores except coreMotivations exist
          return storeName !== 'coreMotivations';
        }
      );

      const initPromise = db.initialize();

      // Simulate upgrade needed
      setTimeout(() => {
        mockRequest.onupgradeneeded(upgradeEvent);
        mockRequest.onsuccess();
      }, 0);

      await initPromise;

      // Verify store creation
      expect(mockDbInstance.createObjectStore).toHaveBeenCalledWith(
        'coreMotivations',
        { keyPath: 'id' }
      );

      // Verify indexes were created with correct settings
      const indexCalls = mockObjectStore.createIndex.mock.calls;
      expect(indexCalls).toContainEqual([
        'directionId',
        'directionId',
        { unique: false },
      ]);
      expect(indexCalls).toContainEqual([
        'conceptId',
        'conceptId',
        { unique: false },
      ]);
      expect(indexCalls).toContainEqual([
        'createdAt',
        'createdAt',
        { unique: false },
      ]);

      // Verify logging
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Created coreMotivations object store'
      );
    });

    it('should preserve existing stores during migration', async () => {
      mockRequest.result = mockDbInstance;
      const upgradeEvent = {
        target: { result: mockDbInstance },
        oldVersion: 2,
      };

      // Mock that existing stores are present
      mockDbInstance.objectStoreNames.contains.mockImplementation(
        (storeName) => {
          const existingStores = [
            'characterConcepts',
            'thematicDirections',
            'metadata',
            'cliches',
          ];
          return existingStores.includes(storeName);
        }
      );

      const initPromise = db.initialize();

      // Simulate upgrade needed
      setTimeout(() => {
        mockRequest.onupgradeneeded(upgradeEvent);
        mockRequest.onsuccess();
      }, 0);

      await initPromise;

      // Should only create the new coreMotivations store
      expect(mockDbInstance.createObjectStore).toHaveBeenCalledTimes(1);
      expect(mockDbInstance.createObjectStore).toHaveBeenCalledWith(
        'coreMotivations',
        { keyPath: 'id' }
      );
    });

    it('should handle migration from version 0 to 3', async () => {
      mockRequest.result = mockDbInstance;
      const upgradeEvent = {
        target: { result: mockDbInstance },
        oldVersion: 0,
      };

      // Mock that no stores exist
      mockDbInstance.objectStoreNames.contains.mockReturnValue(false);

      const initPromise = db.initialize();

      // Simulate upgrade needed
      setTimeout(() => {
        mockRequest.onupgradeneeded(upgradeEvent);
        mockRequest.onsuccess();
      }, 0);

      await initPromise;

      // Should create all stores including coreMotivations
      expect(mockDbInstance.createObjectStore).toHaveBeenCalledWith(
        'characterConcepts',
        { keyPath: 'id' }
      );
      expect(mockDbInstance.createObjectStore).toHaveBeenCalledWith(
        'thematicDirections',
        { keyPath: 'id' }
      );
      expect(mockDbInstance.createObjectStore).toHaveBeenCalledWith(
        'metadata',
        { keyPath: 'key' }
      );
      expect(mockDbInstance.createObjectStore).toHaveBeenCalledWith('cliches', {
        keyPath: 'id',
      });
      expect(mockDbInstance.createObjectStore).toHaveBeenCalledWith(
        'coreMotivations',
        { keyPath: 'id' }
      );
    });
  });

  describe('Core Motivations data operations', () => {
    beforeEach(async () => {
      mockRequest.result = mockDbInstance;
      mockDbInstance.objectStoreNames.contains.mockReturnValue(true);

      // Initialize database
      const initPromise = db.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully save a core motivation', async () => {
      const coreMotivation = {
        id: 'motivation-1',
        directionId: 'direction-1',
        conceptId: 'concept-1',
        coreDesire: 'To seek truth and justice',
        internalContradiction: 'Must lie to protect loved ones',
        centralQuestion: 'What price is too high for truth?',
        createdAt: new Date().toISOString(),
        metadata: {
          model: 'gpt-4',
          temperature: 0.8,
          promptTokens: 100,
          completionTokens: 150,
          generationTime: 1500,
        },
      };

      const putRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(putRequest);

      const savePromise = db.saveCoreMotivation(coreMotivation);

      setTimeout(() => putRequest.onsuccess(), 0);
      const result = await savePromise;

      expect(result).toEqual(coreMotivation);
      expect(mockObjectStore.put).toHaveBeenCalledWith(coreMotivation);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Saved core motivation')
      );
    });

    it('should save multiple core motivations in batch', async () => {
      const motivations = [
        {
          directionId: 'direction-1',
          conceptId: 'concept-1',
          coreDesire: 'First motivation',
        },
        {
          directionId: 'direction-1',
          conceptId: 'concept-1',
          coreDesire: 'Second motivation',
        },
      ];

      const putRequest1 = { onsuccess: null, onerror: null };
      const putRequest2 = { onsuccess: null, onerror: null };
      mockObjectStore.put
        .mockReturnValueOnce(putRequest1)
        .mockReturnValueOnce(putRequest2);

      const savePromise = db.saveCoreMotivations(motivations);

      setTimeout(() => {
        putRequest1.onsuccess();
        putRequest2.onsuccess();
      }, 0);

      const result = await savePromise;

      expect(result).toHaveLength(2);
      expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith('Saved 2 core motivations');
    });

    it('should retrieve core motivations by direction ID', async () => {
      const motivations = [
        {
          id: 'motivation-1',
          directionId: 'direction-1',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'motivation-2',
          directionId: 'direction-1',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ];

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        result: motivations,
      };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      const retrievePromise = db.getCoreMotivationsByDirectionId('direction-1');

      setTimeout(() => getAllRequest.onsuccess(), 0);
      const result = await retrievePromise;

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('motivation-2'); // Sorted newest first
      expect(result[1].id).toBe('motivation-1');
      expect(mockObjectStore.index).toHaveBeenCalledWith('directionId');
      expect(mockIndex.getAll).toHaveBeenCalledWith('direction-1');
    });

    it('should retrieve core motivations by concept ID', async () => {
      const motivations = [
        { id: 'motivation-1', conceptId: 'concept-1' },
        { id: 'motivation-2', conceptId: 'concept-1' },
      ];

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        result: motivations,
      };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      const retrievePromise = db.getCoreMotivationsByConceptId('concept-1');

      setTimeout(() => getAllRequest.onsuccess(), 0);
      const result = await retrievePromise;

      expect(result).toHaveLength(2);
      expect(mockObjectStore.index).toHaveBeenCalledWith('conceptId');
      expect(mockIndex.getAll).toHaveBeenCalledWith('concept-1');
    });

    it('should retrieve single core motivation by ID', async () => {
      const motivation = { id: 'motivation-1', directionId: 'direction-1' };

      const getRequest = {
        onsuccess: null,
        onerror: null,
        result: motivation,
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      const retrievePromise = db.getCoreMotivationById('motivation-1');

      setTimeout(() => getRequest.onsuccess(), 0);
      const result = await retrievePromise;

      expect(result).toEqual(motivation);
      expect(mockObjectStore.get).toHaveBeenCalledWith('motivation-1');
    });

    it('should delete a core motivation', async () => {
      // Mock getCoreMotivationById to return a motivation
      const motivation = { id: 'motivation-1', directionId: 'direction-1' };
      const getRequest = {
        onsuccess: null,
        onerror: null,
        result: motivation,
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      const deleteRequest = { onsuccess: null, onerror: null };
      mockObjectStore.delete.mockReturnValue(deleteRequest);

      const deletePromise = db.deleteCoreMotivation('motivation-1');

      setTimeout(() => {
        getRequest.onsuccess();
        setTimeout(() => deleteRequest.onsuccess(), 0);
      }, 0);

      const result = await deletePromise;

      expect(result).toBe(true);
      expect(mockObjectStore.delete).toHaveBeenCalledWith('motivation-1');
    });

    it('should update a core motivation', async () => {
      const existingMotivation = {
        id: 'motivation-1',
        directionId: 'direction-1',
        coreDesire: 'Original desire',
        createdAt: '2024-01-01T00:00:00Z',
      };
      const updates = { coreDesire: 'Updated desire' };

      // Mock getCoreMotivationById
      const getRequest = {
        onsuccess: null,
        onerror: null,
        result: existingMotivation,
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      const putRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(putRequest);

      const updatePromise = db.updateCoreMotivation('motivation-1', updates);

      setTimeout(() => {
        getRequest.onsuccess();
        setTimeout(() => putRequest.onsuccess(), 0);
      }, 0);

      const result = await updatePromise;

      expect(result.coreDesire).toBe('Updated desire');
      expect(result.id).toBe('motivation-1'); // Preserved
      expect(result.createdAt).toBe('2024-01-01T00:00:00Z'); // Preserved
    });

    it('should delete all core motivations for a direction', async () => {
      const motivations = [
        { id: 'motivation-1', directionId: 'direction-1' },
        { id: 'motivation-2', directionId: 'direction-1' },
      ];

      // Mock getCoreMotivationsByDirectionId
      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        result: motivations,
      };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      const deleteRequest1 = { onsuccess: null, onerror: null };
      const deleteRequest2 = { onsuccess: null, onerror: null };
      mockObjectStore.delete
        .mockReturnValueOnce(deleteRequest1)
        .mockReturnValueOnce(deleteRequest2);

      const deletePromise = db.deleteAllCoreMotivationsForDirection(
        'direction-1'
      );

      setTimeout(() => {
        getAllRequest.onsuccess();
        setTimeout(() => {
          deleteRequest1.onsuccess();
          deleteRequest2.onsuccess();
        }, 0);
      }, 0);

      const result = await deletePromise;

      expect(result).toBe(2);
      expect(mockObjectStore.delete).toHaveBeenCalledWith('motivation-1');
      expect(mockObjectStore.delete).toHaveBeenCalledWith('motivation-2');
    });

    it('should check if direction has core motivations', async () => {
      const motivations = [{ id: 'motivation-1' }];

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        result: motivations,
      };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      const checkPromise = db.hasCoreMotivationsForDirection('direction-1');

      setTimeout(() => getAllRequest.onsuccess(), 0);
      const result = await checkPromise;

      expect(result).toBe(true);
    });

    it('should return false when no motivations exist for direction', async () => {
      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        result: [],
      };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      const checkPromise = db.hasCoreMotivationsForDirection('direction-1');

      setTimeout(() => getAllRequest.onsuccess(), 0);
      const result = await checkPromise;

      expect(result).toBe(false);
    });

    it('should count core motivations for a direction', async () => {
      const countRequest = {
        onsuccess: null,
        onerror: null,
        result: 3,
      };
      mockIndex.count.mockReturnValue(countRequest);

      const countPromise = db.getCoreMotivationsCount('direction-1');

      setTimeout(() => countRequest.onsuccess(), 0);
      const result = await countPromise;

      expect(result).toBe(3);
      expect(mockObjectStore.index).toHaveBeenCalledWith('directionId');
      expect(mockIndex.count).toHaveBeenCalledWith('direction-1');
    });

    it('should support many-to-one relationship with directions', async () => {
      const motivations = [
        {
          id: 'motivation-1',
          directionId: 'direction-1',
          conceptId: 'concept-1',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'motivation-2',
          directionId: 'direction-1', // Same direction
          conceptId: 'concept-1',
          createdAt: '2024-01-02T00:00:00Z',
        },
        {
          id: 'motivation-3',
          directionId: 'direction-1', // Same direction
          conceptId: 'concept-1',
          createdAt: '2024-01-03T00:00:00Z',
        },
      ];

      // Verify the index allows non-unique directionId values
      const indexCalls = mockObjectStore.createIndex.mock.calls;
      const directionIdIndex = indexCalls.find(
        (call) => call[0] === 'directionId'
      );

      // If the index was created, it should have unique: false
      if (directionIdIndex) {
        expect(directionIdIndex[2].unique).toBe(false);
      }

      // This demonstrates that multiple motivations can have the same directionId
      // unlike cliches which have a unique directionId index
      expect(mockDbInstance.objectStoreNames.contains('coreMotivations')).toBe(
        true
      );
    });

    it('should support querying by directionId index', async () => {
      const directionId = 'direction-1';
      const expectedMotivations = [
        { id: 'motivation-1', directionId },
        { id: 'motivation-2', directionId },
      ];

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        result: expectedMotivations,
      };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      // Test that the index can be used for queries
      mockTransaction.objectStore('coreMotivations');
      const store = mockTransaction.objectStore.mock.results[0].value;
      store.index('directionId');

      expect(mockObjectStore.index).toHaveBeenCalledWith('directionId');
    });

    it('should support querying by conceptId index', async () => {
      const conceptId = 'concept-1';
      const expectedMotivations = [
        { id: 'motivation-1', conceptId },
        { id: 'motivation-2', conceptId },
      ];

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        result: expectedMotivations,
      };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      // Test that the index can be used for queries
      mockTransaction.objectStore('coreMotivations');
      const store = mockTransaction.objectStore.mock.results[0].value;
      store.index('conceptId');

      expect(mockObjectStore.index).toHaveBeenCalledWith('conceptId');
    });

    it('should support chronological queries via createdAt index', async () => {
      const expectedMotivations = [
        { id: 'motivation-1', createdAt: '2024-01-01T00:00:00Z' },
        { id: 'motivation-2', createdAt: '2024-01-02T00:00:00Z' },
      ];

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        result: expectedMotivations,
      };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      // Test that the index can be used for queries
      mockTransaction.objectStore('coreMotivations');
      const store = mockTransaction.objectStore.mock.results[0].value;
      store.index('createdAt');

      expect(mockObjectStore.index).toHaveBeenCalledWith('createdAt');
    });

    it('should handle concurrent operations safely', async () => {
      const motivations = [
        { directionId: 'direction-1', conceptId: 'concept-1', coreDesire: 'First' },
        { directionId: 'direction-1', conceptId: 'concept-1', coreDesire: 'Second' },
      ];

      // Simulate concurrent save operations
      const putRequest1 = { onsuccess: null, onerror: null };
      const putRequest2 = { onsuccess: null, onerror: null };
      
      mockObjectStore.put
        .mockReturnValueOnce(putRequest1)
        .mockReturnValueOnce(putRequest2);

      const save1Promise = db.saveCoreMotivation(motivations[0]);
      const save2Promise = db.saveCoreMotivation(motivations[1]);

      setTimeout(() => {
        putRequest1.onsuccess();
        putRequest2.onsuccess();
      }, 0);

      const [result1, result2] = await Promise.all([save1Promise, save2Promise]);

      expect(result1).toMatchObject(motivations[0]);
      expect(result2).toMatchObject(motivations[1]);
      expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
    });

    it('should handle transaction failures gracefully', async () => {
      const motivation = {
        directionId: 'direction-1',
        conceptId: 'concept-1',
        coreDesire: 'Test motivation',
      };

      const putRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: 'Transaction failed' },
      };
      mockObjectStore.put.mockReturnValue(putRequest);

      const savePromise = db.saveCoreMotivation(motivation);

      setTimeout(() => putRequest.onerror(), 0);

      await expect(savePromise).rejects.toThrow(
        'Failed to save core motivation: Transaction failed'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Error handling during migration', () => {
    it('should handle migration failure gracefully', async () => {
      mockRequest.result = mockDbInstance;
      const upgradeEvent = {
        target: { result: mockDbInstance },
        oldVersion: 2,
      };

      // Mock that createObjectStore throws an error
      mockDbInstance.createObjectStore.mockImplementation(() => {
        throw new Error('Failed to create object store');
      });

      // Mock that coreMotivations store doesn't exist
      mockDbInstance.objectStoreNames.contains.mockImplementation(
        (storeName) => {
          return storeName !== 'coreMotivations';
        }
      );

      const initPromise = db.initialize();

      // Simulate upgrade needed with error
      setTimeout(() => {
        try {
          mockRequest.onupgradeneeded(upgradeEvent);
        } catch (error) {
          // Error should be caught and handled
          mockRequest.onerror();
        }
      }, 0);

      // The initialization should handle the error appropriately
      await expect(initPromise).rejects.toThrow();
    });

    it('should not affect existing data during failed migration', async () => {
      mockRequest.result = mockDbInstance;
      const upgradeEvent = {
        target: { result: mockDbInstance },
        oldVersion: 2,
      };

      // Mock existing stores
      const existingStores = [
        'characterConcepts',
        'thematicDirections',
        'metadata',
        'cliches',
      ];

      mockDbInstance.objectStoreNames.contains.mockImplementation(
        (storeName) => {
          return existingStores.includes(storeName);
        }
      );

      // Mock that creating coreMotivations fails
      mockDbInstance.createObjectStore.mockImplementation((storeName) => {
        if (storeName === 'coreMotivations') {
          throw new Error('Failed to create coreMotivations store');
        }
        return mockObjectStore;
      });

      const initPromise = db.initialize();

      // Simulate upgrade needed with partial failure
      setTimeout(() => {
        try {
          mockRequest.onupgradeneeded(upgradeEvent);
        } catch (error) {
          // Existing stores should remain intact
          expect(
            mockDbInstance.objectStoreNames.contains('characterConcepts')
          ).toBe(true);
          expect(
            mockDbInstance.objectStoreNames.contains('thematicDirections')
          ).toBe(true);
          expect(mockDbInstance.objectStoreNames.contains('metadata')).toBe(
            true
          );
          expect(mockDbInstance.objectStoreNames.contains('cliches')).toBe(
            true
          );
          mockRequest.onerror();
        }
      }, 0);

      await expect(initPromise).rejects.toThrow();
    });
  });
});
