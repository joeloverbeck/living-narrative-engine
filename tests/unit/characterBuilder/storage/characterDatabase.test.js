/**
 * @file Unit tests for CharacterDatabase
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

describe('CharacterDatabase', () => {
  let database;
  let mockLogger;
  let mockIndexedDB;
  let mockDbInstance;
  let mockTransaction;
  let mockObjectStore;
  let mockIndex;
  let mockRequest;
  let mockCursor;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock cursor
    mockCursor = {
      value: null,
      continue: jest.fn(),
      delete: jest.fn(),
    };

    // Create mock index
    mockIndex = {
      getAll: jest.fn(),
      openCursor: jest.fn(),
      get: jest.fn(),
      count: jest.fn(),
    };

    // Create mock object store
    mockObjectStore = {
      put: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      delete: jest.fn(),
      createIndex: jest.fn(),
      index: jest.fn().mockReturnValue(mockIndex),
    };

    // Create mock transaction
    mockTransaction = {
      objectStore: jest.fn().mockReturnValue(mockObjectStore),
      oncomplete: null,
      onerror: null,
      error: null,
    };

    // Create mock database instance
    mockDbInstance = {
      objectStoreNames: {
        contains: jest.fn().mockReturnValue(false),
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
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.indexedDB;
    delete global.IDBKeyRange;
  });

  describe('constructor', () => {
    it('should create instance with valid logger dependency', () => {
      expect(() => {
        database = new CharacterDatabase({ logger: mockLogger });
      }).not.toThrow();

      expect(database).toBeDefined();
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new CharacterDatabase({});
      }).toThrow();
    });

    it('should throw error when logger is missing required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing info, warn, error

      expect(() => {
        new CharacterDatabase({ logger: invalidLogger });
      }).toThrow();
    });

    it('should initialize with null database connection', () => {
      database = new CharacterDatabase({ logger: mockLogger });
      // Database should be null initially (private field, tested through behavior)
      expect(database).toBeDefined();
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      database = new CharacterDatabase({ logger: mockLogger });
    });

    it('should successfully initialize database', async () => {
      mockRequest.result = mockDbInstance;

      const initPromise = database.initialize();

      // Simulate successful database opening
      setTimeout(() => {
        mockRequest.onsuccess();
      }, 0);

      await initPromise;

      expect(mockIndexedDB.open).toHaveBeenCalledWith('CharacterBuilder', 3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterDatabase: Successfully opened database'
      );
    });

    it('should handle database open error', async () => {
      const errorMessage = 'Database access denied';
      mockRequest.error = { message: errorMessage };

      const initPromise = database.initialize();

      // Simulate database open error
      setTimeout(() => {
        mockRequest.onerror();
      }, 0);

      await expect(initPromise).rejects.toThrow(
        `Failed to open CharacterBuilder database: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle database open error without message', async () => {
      mockRequest.error = null;

      const initPromise = database.initialize();

      // Simulate database open error
      setTimeout(() => {
        mockRequest.onerror();
      }, 0);

      await expect(initPromise).rejects.toThrow(
        'Failed to open CharacterBuilder database: Unknown error'
      );
    });

    it('should create object stores on upgrade needed', async () => {
      mockRequest.result = mockDbInstance;
      const upgradeEvent = {
        target: { result: mockDbInstance },
        oldVersion: 0, // Simulate fresh install
      };

      const initPromise = database.initialize();

      // Simulate upgrade needed
      setTimeout(() => {
        mockRequest.onupgradeneeded(upgradeEvent);
        mockRequest.onsuccess();
      }, 0);

      await initPromise;

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
    });

    it('should skip creating existing object stores', async () => {
      mockRequest.result = mockDbInstance;
      mockDbInstance.objectStoreNames.contains.mockReturnValue(true);
      const upgradeEvent = { target: { result: mockDbInstance } };

      const initPromise = database.initialize();

      // Simulate upgrade needed with existing stores
      setTimeout(() => {
        mockRequest.onupgradeneeded(upgradeEvent);
        mockRequest.onsuccess();
      }, 0);

      await initPromise;

      expect(mockDbInstance.createObjectStore).not.toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      mockRequest.result = mockDbInstance;

      // First initialization
      const initPromise1 = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise1;

      // Reset mock call count
      mockIndexedDB.open.mockClear();
      mockLogger.debug.mockClear();

      // Second initialization
      await database.initialize();

      expect(mockIndexedDB.open).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Already initialized'
      );
    });

    it('should create coreMotivations store during version 3 migration', async () => {
      mockRequest.result = mockDbInstance;
      const upgradeEvent = {
        target: { result: mockDbInstance },
        oldVersion: 2,
      };

      // Mock that coreMotivations store doesn't exist yet
      mockDbInstance.objectStoreNames.contains.mockImplementation(
        (storeName) => {
          return storeName !== 'coreMotivations';
        }
      );

      const initPromise = database.initialize();

      // Simulate upgrade needed from version 2 to 3
      setTimeout(() => {
        mockRequest.onupgradeneeded(upgradeEvent);
        mockRequest.onsuccess();
      }, 0);

      await initPromise;

      expect(mockDbInstance.createObjectStore).toHaveBeenCalledWith(
        'coreMotivations',
        { keyPath: 'id' }
      );
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith(
        'directionId',
        'directionId',
        { unique: false }
      );
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith(
        'conceptId',
        'conceptId',
        { unique: false }
      );
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith(
        'createdAt',
        'createdAt',
        { unique: false }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Created coreMotivations object store'
      );
    });

    it('should handle all migration steps from version 0 to 3', async () => {
      mockRequest.result = mockDbInstance;
      const upgradeEvent = {
        target: { result: mockDbInstance },
        oldVersion: 0,
      };

      // Mock that no stores exist
      mockDbInstance.objectStoreNames.contains.mockReturnValue(false);

      const initPromise = database.initialize();

      // Simulate upgrade needed from version 0 to 3
      setTimeout(() => {
        mockRequest.onupgradeneeded(upgradeEvent);
        mockRequest.onsuccess();
      }, 0);

      await initPromise;

      // Should create all stores including the new coreMotivations store
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

    it('should not create coreMotivations store if it already exists', async () => {
      mockRequest.result = mockDbInstance;
      const upgradeEvent = {
        target: { result: mockDbInstance },
        oldVersion: 2,
      };

      // Mock that coreMotivations store already exists
      mockDbInstance.objectStoreNames.contains.mockReturnValue(true);

      const initPromise = database.initialize();

      // Simulate upgrade needed from version 2 to 3
      setTimeout(() => {
        mockRequest.onupgradeneeded(upgradeEvent);
        mockRequest.onsuccess();
      }, 0);

      await initPromise;

      // Should not create any stores since they all exist
      expect(mockDbInstance.createObjectStore).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    beforeEach(() => {
      database = new CharacterDatabase({ logger: mockLogger });
    });

    it('should close database connection when initialized', async () => {
      mockRequest.result = mockDbInstance;

      // Initialize first
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;

      // Close database
      database.close();

      expect(mockDbInstance.close).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Database connection closed'
      );
    });

    it('should handle close when not initialized', () => {
      expect(() => {
        database.close();
      }).not.toThrow();

      expect(mockDbInstance.close).not.toHaveBeenCalled();
    });
  });

  describe('saveCharacterConcept', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;

      // Initialize database
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully save character concept', async () => {
      const concept = {
        id: 'test-concept-1',
        concept: 'A brave warrior',
        status: 'draft',
      };

      const putRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(putRequest);

      const savePromise = database.saveCharacterConcept(concept);

      // Simulate successful save
      setTimeout(() => {
        putRequest.onsuccess();
      }, 0);

      const result = await savePromise;

      expect(mockDbInstance.transaction).toHaveBeenCalledWith(
        ['characterConcepts'],
        'readwrite'
      );
      expect(mockObjectStore.put).toHaveBeenCalledWith(concept);
      expect(result).toBe(concept);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Saved character concept test-concept-1'
      );
    });

    it('should handle save error', async () => {
      const concept = { id: 'test-concept-1', concept: 'A brave warrior' };
      const errorMessage = 'Storage quota exceeded';

      const putRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: errorMessage },
      };
      mockObjectStore.put.mockReturnValue(putRequest);

      const savePromise = database.saveCharacterConcept(concept);

      // Simulate save error
      setTimeout(() => {
        putRequest.onerror();
      }, 0);

      await expect(savePromise).rejects.toThrow(
        `Failed to save character concept: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle save error without message', async () => {
      const concept = { id: 'test-concept-1', concept: 'A brave warrior' };

      const putRequest = {
        onsuccess: null,
        onerror: null,
        error: null,
      };
      mockObjectStore.put.mockReturnValue(putRequest);

      const savePromise = database.saveCharacterConcept(concept);

      // Simulate save error
      setTimeout(() => {
        putRequest.onerror();
      }, 0);

      await expect(savePromise).rejects.toThrow(
        'Failed to save character concept: Unknown error'
      );
    });
  });

  describe('getCharacterConcept', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;

      // Initialize database
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully get character concept', async () => {
      const conceptId = 'test-concept-1';
      const concept = { id: conceptId, concept: 'A brave warrior' };

      const getRequest = { onsuccess: null, onerror: null, result: concept };
      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = database.getCharacterConcept(conceptId);

      // Simulate successful get
      setTimeout(() => {
        getRequest.onsuccess();
      }, 0);

      const result = await getPromise;

      expect(mockDbInstance.transaction).toHaveBeenCalledWith(
        ['characterConcepts'],
        'readonly'
      );
      expect(mockObjectStore.get).toHaveBeenCalledWith(conceptId);
      expect(result).toBe(concept);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Retrieved character concept test-concept-1: found'
      );
    });

    it('should return null when concept not found', async () => {
      const conceptId = 'nonexistent-concept';

      const getRequest = { onsuccess: null, onerror: null, result: undefined };
      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = database.getCharacterConcept(conceptId);

      // Simulate not found
      setTimeout(() => {
        getRequest.onsuccess();
      }, 0);

      const result = await getPromise;

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Retrieved character concept nonexistent-concept: not found'
      );
    });

    it('should handle get error', async () => {
      const conceptId = 'test-concept-1';
      const errorMessage = 'Database connection lost';

      const getRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: errorMessage },
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = database.getCharacterConcept(conceptId);

      // Simulate get error
      setTimeout(() => {
        getRequest.onerror();
      }, 0);

      await expect(getPromise).rejects.toThrow(
        `Failed to get character concept: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle get error with null error object', async () => {
      const conceptId = 'test-concept-1';

      const getRequest = {
        onsuccess: null,
        onerror: null,
        error: null,
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = database.getCharacterConcept(conceptId);

      // Simulate get error with null error
      setTimeout(() => {
        getRequest.onerror();
      }, 0);

      await expect(getPromise).rejects.toThrow(
        'Failed to get character concept: Unknown error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getAllCharacterConcepts', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;

      // Initialize database
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully get all character concepts', async () => {
      const concepts = [
        { id: 'concept-1', concept: 'A brave warrior' },
        { id: 'concept-2', concept: 'A wise mage' },
      ];

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        result: concepts,
      };
      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const getAllPromise = database.getAllCharacterConcepts();

      // Simulate successful getAll
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const result = await getAllPromise;

      expect(mockDbInstance.transaction).toHaveBeenCalledWith(
        ['characterConcepts'],
        'readonly'
      );
      expect(mockObjectStore.getAll).toHaveBeenCalled();
      expect(result).toBe(concepts);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Retrieved 2 character concepts'
      );
    });

    it('should handle empty results', async () => {
      const getAllRequest = { onsuccess: null, onerror: null, result: null };
      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const getAllPromise = database.getAllCharacterConcepts();

      // Simulate empty results
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const result = await getAllPromise;

      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Retrieved 0 character concepts'
      );
    });

    it('should handle getAll error', async () => {
      const errorMessage = 'Transaction aborted';

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: errorMessage },
      };
      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const getAllPromise = database.getAllCharacterConcepts();

      // Simulate getAll error
      setTimeout(() => {
        getAllRequest.onerror();
      }, 0);

      await expect(getAllPromise).rejects.toThrow(
        `Failed to get character concepts: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle getAll error with null error object', async () => {
      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        error: null,
      };
      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const getAllPromise = database.getAllCharacterConcepts();

      // Simulate getAll error with null error
      setTimeout(() => {
        getAllRequest.onerror();
      }, 0);

      await expect(getAllPromise).rejects.toThrow(
        'Failed to get character concepts: Unknown error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('deleteCharacterConcept', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;

      // Initialize database
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully delete character concept and associated directions', async () => {
      const conceptId = 'test-concept-1';

      // Mock transaction for both stores
      const conceptStore = { ...mockObjectStore, delete: jest.fn() };
      const directionsStore = { ...mockObjectStore, delete: jest.fn() };

      mockTransaction.objectStore
        .mockReturnValueOnce(conceptStore) // First call for concepts store
        .mockReturnValueOnce(directionsStore); // Second call for directions store

      // Mock cursor for finding directions
      const cursorRequest = { onsuccess: null };
      mockIndex.openCursor.mockReturnValue(cursorRequest);

      // Mock the index access properly
      directionsStore.index = jest.fn().mockReturnValue(mockIndex);

      const deletePromise = database.deleteCharacterConcept(conceptId);

      // Simulate cursor finding directions
      setTimeout(() => {
        mockCursor.value = { id: 'direction-1' };
        cursorRequest.onsuccess({ target: { result: mockCursor } });

        // Simulate cursor continuing and finding another direction
        setTimeout(() => {
          mockCursor.value = { id: 'direction-2' };
          cursorRequest.onsuccess({ target: { result: mockCursor } });

          // Simulate cursor completion
          setTimeout(() => {
            cursorRequest.onsuccess({ target: { result: null } });

            // Simulate transaction completion
            setTimeout(() => {
              mockTransaction.oncomplete();
            }, 0);
          }, 0);
        }, 0);
      }, 0);

      const result = await deletePromise;

      expect(mockDbInstance.transaction).toHaveBeenCalledWith(
        ['characterConcepts', 'thematicDirections'],
        'readwrite'
      );
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Deleted character concept test-concept-1 and 2 associated directions'
      );
    });

    it('should handle delete error', async () => {
      const conceptId = 'test-concept-1';
      const errorMessage = 'Delete operation failed';

      // Mock transaction for both stores
      const conceptStore = { ...mockObjectStore, delete: jest.fn() };
      const directionsStore = { ...mockObjectStore, delete: jest.fn() };

      mockTransaction.objectStore
        .mockReturnValueOnce(conceptStore)
        .mockReturnValueOnce(directionsStore);

      // Mock cursor for finding directions
      const cursorRequest = { onsuccess: null };
      mockIndex.openCursor.mockReturnValue(cursorRequest);
      directionsStore.index = jest.fn().mockReturnValue(mockIndex);

      mockTransaction.error = { message: errorMessage };

      const deletePromise = database.deleteCharacterConcept(conceptId);

      // Simulate transaction error
      setTimeout(() => {
        mockTransaction.onerror();
      }, 0);

      await expect(deletePromise).rejects.toThrow(
        `Failed to delete character concept: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle delete error with null transaction error', async () => {
      const conceptId = 'test-concept-1';

      // Mock transaction for both stores
      const conceptStore = { ...mockObjectStore, delete: jest.fn() };
      const directionsStore = { ...mockObjectStore, delete: jest.fn() };

      mockTransaction.objectStore
        .mockReturnValueOnce(conceptStore)
        .mockReturnValueOnce(directionsStore);

      // Mock cursor for finding directions
      const cursorRequest = { onsuccess: null };
      mockIndex.openCursor.mockReturnValue(cursorRequest);
      directionsStore.index = jest.fn().mockReturnValue(mockIndex);

      mockTransaction.error = null;

      const deletePromise = database.deleteCharacterConcept(conceptId);

      // Simulate transaction error with null error
      setTimeout(() => {
        mockTransaction.onerror();
      }, 0);

      await expect(deletePromise).rejects.toThrow(
        'Failed to delete character concept: Unknown error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('saveThematicDirections', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;

      // Initialize database
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully save multiple thematic directions', async () => {
      const directions = [
        { id: 'direction-1', conceptId: 'concept-1', text: 'Direction 1' },
        { id: 'direction-2', conceptId: 'concept-1', text: 'Direction 2' },
      ];

      const putRequest1 = { onsuccess: null, onerror: null };
      const putRequest2 = { onsuccess: null, onerror: null };
      mockObjectStore.put
        .mockReturnValueOnce(putRequest1)
        .mockReturnValueOnce(putRequest2);

      const savePromise = database.saveThematicDirections(directions);

      // Simulate successful saves
      setTimeout(() => {
        putRequest1.onsuccess();
        putRequest2.onsuccess();
      }, 0);

      const result = await savePromise;

      expect(mockDbInstance.transaction).toHaveBeenCalledWith(
        ['thematicDirections'],
        'readwrite'
      );
      expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
      expect(result).toEqual(directions);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Saved 2 thematic directions'
      );
    });

    it('should handle empty directions array', async () => {
      const result = await database.saveThematicDirections([]);

      expect(result).toEqual([]);
      expect(mockObjectStore.put).not.toHaveBeenCalled();
    });

    it('should handle save error for thematic directions', async () => {
      const directions = [{ id: 'direction-1', conceptId: 'concept-1' }];
      const errorMessage = 'Storage error';

      const putRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: errorMessage },
      };
      mockObjectStore.put.mockReturnValue(putRequest);

      const savePromise = database.saveThematicDirections(directions);

      // Simulate save error
      setTimeout(() => {
        putRequest.onerror();
      }, 0);

      await expect(savePromise).rejects.toThrow(
        `Failed to save thematic direction: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle save error for thematic directions with null error object', async () => {
      const directions = [{ id: 'direction-1', conceptId: 'concept-1' }];

      const putRequest = {
        onsuccess: null,
        onerror: null,
        error: null,
      };
      mockObjectStore.put.mockReturnValue(putRequest);

      const savePromise = database.saveThematicDirections(directions);

      // Simulate save error with null error
      setTimeout(() => {
        putRequest.onerror();
      }, 0);

      await expect(savePromise).rejects.toThrow(
        'Failed to save thematic direction: Unknown error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getThematicDirectionsByConceptId', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;

      // Initialize database
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully get thematic directions by concept ID', async () => {
      const conceptId = 'concept-1';
      const directions = [
        { id: 'direction-1', conceptId, text: 'Direction 1' },
        { id: 'direction-2', conceptId, text: 'Direction 2' },
      ];

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        result: directions,
      };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      const getPromise = database.getThematicDirectionsByConceptId(conceptId);

      // Simulate successful get
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const result = await getPromise;

      expect(mockDbInstance.transaction).toHaveBeenCalledWith(
        ['thematicDirections'],
        'readonly'
      );
      expect(mockObjectStore.index).toHaveBeenCalledWith('conceptId');
      expect(mockIndex.getAll).toHaveBeenCalledWith(conceptId);
      expect(result).toBe(directions);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Retrieved 2 thematic directions for concept concept-1'
      );
    });

    it('should handle empty results for concept ID', async () => {
      const conceptId = 'concept-1';

      const getAllRequest = { onsuccess: null, onerror: null, result: null };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      const getPromise = database.getThematicDirectionsByConceptId(conceptId);

      // Simulate empty results
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const result = await getPromise;

      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Retrieved 0 thematic directions for concept concept-1'
      );
    });

    it('should handle get error for thematic directions by concept ID', async () => {
      const conceptId = 'concept-1';
      const errorMessage = 'Index query failed';

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: errorMessage },
      };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      const getPromise = database.getThematicDirectionsByConceptId(conceptId);

      // Simulate get error
      setTimeout(() => {
        getAllRequest.onerror();
      }, 0);

      await expect(getPromise).rejects.toThrow(
        `Failed to get thematic directions: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle get error for thematic directions by concept ID with null error object', async () => {
      const conceptId = 'concept-1';

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        error: null,
      };
      mockIndex.getAll.mockReturnValue(getAllRequest);

      const getPromise = database.getThematicDirectionsByConceptId(conceptId);

      // Simulate get error with null error
      setTimeout(() => {
        getAllRequest.onerror();
      }, 0);

      await expect(getPromise).rejects.toThrow(
        'Failed to get thematic directions: Unknown error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getAllThematicDirections', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;

      // Initialize database
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully get all thematic directions', async () => {
      const directions = [
        { id: 'direction-1', conceptId: 'concept-1' },
        { id: 'direction-2', conceptId: 'concept-2' },
      ];

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        result: directions,
      };
      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const getAllPromise = database.getAllThematicDirections();

      // Simulate successful getAll
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const result = await getAllPromise;

      expect(mockDbInstance.transaction).toHaveBeenCalledWith(
        ['thematicDirections'],
        'readonly'
      );
      expect(mockObjectStore.getAll).toHaveBeenCalled();
      expect(result).toBe(directions);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Retrieved 2 thematic directions'
      );
    });

    it('should handle empty results for all thematic directions', async () => {
      const getAllRequest = { onsuccess: null, onerror: null, result: null };
      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const getAllPromise = database.getAllThematicDirections();

      // Simulate empty results
      setTimeout(() => {
        getAllRequest.onsuccess();
      }, 0);

      const result = await getAllPromise;

      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Retrieved 0 thematic directions'
      );
    });

    it('should handle getAll error for thematic directions', async () => {
      const errorMessage = 'Query execution failed';

      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: errorMessage },
      };
      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const getAllPromise = database.getAllThematicDirections();

      // Simulate getAll error
      setTimeout(() => {
        getAllRequest.onerror();
      }, 0);

      await expect(getAllPromise).rejects.toThrow(
        `Failed to get all thematic directions: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle getAll error for thematic directions with null error object', async () => {
      const getAllRequest = {
        onsuccess: null,
        onerror: null,
        error: null,
      };
      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const getAllPromise = database.getAllThematicDirections();

      // Simulate getAll error with null error
      setTimeout(() => {
        getAllRequest.onerror();
      }, 0);

      await expect(getAllPromise).rejects.toThrow(
        'Failed to get all thematic directions: Unknown error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getThematicDirection', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;

      // Initialize database
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully get single thematic direction', async () => {
      const directionId = 'direction-1';
      const direction = { id: directionId, conceptId: 'concept-1' };

      const getRequest = { onsuccess: null, onerror: null, result: direction };
      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = database.getThematicDirection(directionId);

      // Simulate successful get
      setTimeout(() => {
        getRequest.onsuccess();
      }, 0);

      const result = await getPromise;

      expect(mockDbInstance.transaction).toHaveBeenCalledWith(
        ['thematicDirections'],
        'readonly'
      );
      expect(mockObjectStore.get).toHaveBeenCalledWith(directionId);
      expect(result).toBe(direction);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Retrieved thematic direction direction-1',
        { found: true }
      );
    });

    it('should return null when thematic direction not found', async () => {
      const directionId = 'nonexistent-direction';

      const getRequest = { onsuccess: null, onerror: null, result: null };
      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = database.getThematicDirection(directionId);

      // Simulate not found
      setTimeout(() => {
        getRequest.onsuccess();
      }, 0);

      const result = await getPromise;

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterDatabase: Retrieved thematic direction nonexistent-direction',
        { found: false }
      );
    });

    it('should handle get error for single thematic direction', async () => {
      const directionId = 'direction-1';
      const errorMessage = 'Get operation failed';

      const getRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: errorMessage },
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = database.getThematicDirection(directionId);

      // Simulate get error
      setTimeout(() => {
        getRequest.onerror();
      }, 0);

      await expect(getPromise).rejects.toThrow(
        `Failed to get thematic direction: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle get error for single thematic direction with null error object', async () => {
      const directionId = 'direction-1';

      const getRequest = {
        onsuccess: null,
        onerror: null,
        error: null,
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = database.getThematicDirection(directionId);

      // Simulate get error with null error
      setTimeout(() => {
        getRequest.onerror();
      }, 0);

      await expect(getPromise).rejects.toThrow(
        'Failed to get thematic direction: Unknown error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updateThematicDirection', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;

      // Initialize database
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully update thematic direction', async () => {
      const directionId = 'direction-1';
      const existingDirection = {
        id: directionId,
        conceptId: 'concept-1',
        text: 'Original text',
      };
      const updates = { text: 'Updated text' };

      // Mock get request for existing direction
      const getRequest = {
        onsuccess: null,
        onerror: null,
        result: existingDirection,
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      // Mock put request for update
      const putRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(putRequest);

      const updatePromise = database.updateThematicDirection(
        directionId,
        updates
      );

      // Simulate successful get
      setTimeout(() => {
        getRequest.onsuccess();

        // Simulate successful put
        setTimeout(() => {
          putRequest.onsuccess();
        }, 0);
      }, 0);

      const result = await updatePromise;

      expect(mockObjectStore.get).toHaveBeenCalledWith(directionId);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingDirection,
          ...updates,
          updatedAt: expect.any(String),
        })
      );
      expect(result).toEqual(
        expect.objectContaining({
          ...existingDirection,
          ...updates,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterDatabase: Successfully updated thematic direction direction-1'
      );
    });

    it('should throw error when direction not found for update', async () => {
      const directionId = 'nonexistent-direction';
      const updates = { text: 'Updated text' };

      // Mock get request returning null
      const getRequest = { onsuccess: null, onerror: null, result: null };
      mockObjectStore.get.mockReturnValue(getRequest);

      const updatePromise = database.updateThematicDirection(
        directionId,
        updates
      );

      // Simulate not found
      setTimeout(() => {
        getRequest.onsuccess();
      }, 0);

      await expect(updatePromise).rejects.toThrow(
        'Thematic direction not found: nonexistent-direction'
      );
    });

    it('should handle update error', async () => {
      const directionId = 'direction-1';
      const existingDirection = { id: directionId, conceptId: 'concept-1' };
      const updates = { text: 'Updated text' };
      const errorMessage = 'Update failed';

      // Mock successful get
      const getRequest = {
        onsuccess: null,
        onerror: null,
        result: existingDirection,
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      // Mock put error
      const putRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: errorMessage },
      };
      mockObjectStore.put.mockReturnValue(putRequest);

      const updatePromise = database.updateThematicDirection(
        directionId,
        updates
      );

      // Simulate successful get and put error
      setTimeout(() => {
        getRequest.onsuccess();

        setTimeout(() => {
          putRequest.onerror();
        }, 0);
      }, 0);

      await expect(updatePromise).rejects.toThrow(
        `Failed to update thematic direction: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle update error with null error object', async () => {
      const directionId = 'direction-1';
      const existingDirection = { id: directionId, conceptId: 'concept-1' };
      const updates = { text: 'Updated text' };

      // Mock successful get
      const getRequest = {
        onsuccess: null,
        onerror: null,
        result: existingDirection,
      };
      mockObjectStore.get.mockReturnValue(getRequest);

      // Mock put error with null error
      const putRequest = {
        onsuccess: null,
        onerror: null,
        error: null,
      };
      mockObjectStore.put.mockReturnValue(putRequest);

      const updatePromise = database.updateThematicDirection(
        directionId,
        updates
      );

      // Simulate successful get and put error
      setTimeout(() => {
        getRequest.onsuccess();

        setTimeout(() => {
          putRequest.onerror();
        }, 0);
      }, 0);

      await expect(updatePromise).rejects.toThrow(
        'Failed to update thematic direction: Unknown error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('deleteThematicDirection', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;

      // Initialize database
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully delete thematic direction', async () => {
      const directionId = 'direction-1';

      const deleteRequest = { onsuccess: null, onerror: null };
      mockObjectStore.delete.mockReturnValue(deleteRequest);

      const deletePromise = database.deleteThematicDirection(directionId);

      // Simulate successful delete
      setTimeout(() => {
        deleteRequest.onsuccess();
      }, 0);

      const result = await deletePromise;

      expect(mockDbInstance.transaction).toHaveBeenCalledWith(
        ['thematicDirections'],
        'readwrite'
      );
      expect(mockObjectStore.delete).toHaveBeenCalledWith(directionId);
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterDatabase: Successfully deleted thematic direction direction-1'
      );
    });

    it('should handle delete error for thematic direction', async () => {
      const directionId = 'direction-1';
      const errorMessage = 'Delete operation failed';

      const deleteRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: errorMessage },
      };
      mockObjectStore.delete.mockReturnValue(deleteRequest);

      const deletePromise = database.deleteThematicDirection(directionId);

      // Simulate delete error
      setTimeout(() => {
        deleteRequest.onerror();
      }, 0);

      await expect(deletePromise).rejects.toThrow(
        `Failed to delete thematic direction: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle delete error for thematic direction with null error object', async () => {
      const directionId = 'direction-1';

      const deleteRequest = {
        onsuccess: null,
        onerror: null,
        error: null,
      };
      mockObjectStore.delete.mockReturnValue(deleteRequest);

      const deletePromise = database.deleteThematicDirection(directionId);

      // Simulate delete error with null error
      setTimeout(() => {
        deleteRequest.onerror();
      }, 0);

      await expect(deletePromise).rejects.toThrow(
        'Failed to delete thematic direction: Unknown error'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('findOrphanedDirections', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;

      // Initialize database
      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    it('should successfully find orphaned directions', async () => {
      const allDirections = [
        { id: 'direction-1', conceptId: 'concept-1' },
        { id: 'direction-2', conceptId: 'concept-2' },
        { id: 'direction-3', conceptId: 'nonexistent-concept' },
      ];

      // Mock getAllThematicDirections
      const getAllDirectionsRequest = {
        onsuccess: null,
        onerror: null,
        result: allDirections,
      };

      // Mock getCharacterConcept calls
      const getConcept1Request = {
        onsuccess: null,
        onerror: null,
        result: { id: 'concept-1' },
      };
      const getConcept2Request = {
        onsuccess: null,
        onerror: null,
        result: { id: 'concept-2' },
      };
      const getNonexistentConceptRequest = {
        onsuccess: null,
        onerror: null,
        result: null,
      };

      // Set up mock store calls
      mockObjectStore.getAll.mockReturnValue(getAllDirectionsRequest);
      mockObjectStore.get
        .mockReturnValueOnce(getConcept1Request)
        .mockReturnValueOnce(getConcept2Request)
        .mockReturnValueOnce(getNonexistentConceptRequest);

      const findPromise = database.findOrphanedDirections();

      // Simulate getAllThematicDirections success
      setTimeout(() => {
        getAllDirectionsRequest.onsuccess();

        // Simulate concept lookups
        setTimeout(() => {
          getConcept1Request.onsuccess(); // concept-1 exists
          setTimeout(() => {
            getConcept2Request.onsuccess(); // concept-2 exists
            setTimeout(() => {
              getNonexistentConceptRequest.onsuccess(); // nonexistent-concept doesn't exist
            }, 0);
          }, 0);
        }, 0);
      }, 0);

      const result = await findPromise;

      expect(result).toEqual([
        { id: 'direction-3', conceptId: 'nonexistent-concept' },
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterDatabase: Found 1 orphaned directions'
      );
    });

    it('should handle case with no orphaned directions', async () => {
      const allDirections = [
        { id: 'direction-1', conceptId: 'concept-1' },
        { id: 'direction-2', conceptId: 'concept-2' },
      ];

      // Mock getAllThematicDirections
      const getAllDirectionsRequest = {
        onsuccess: null,
        onerror: null,
        result: allDirections,
      };

      // Mock getCharacterConcept calls - all concepts exist
      const getConcept1Request = {
        onsuccess: null,
        onerror: null,
        result: { id: 'concept-1' },
      };
      const getConcept2Request = {
        onsuccess: null,
        onerror: null,
        result: { id: 'concept-2' },
      };

      mockObjectStore.getAll.mockReturnValue(getAllDirectionsRequest);
      mockObjectStore.get
        .mockReturnValueOnce(getConcept1Request)
        .mockReturnValueOnce(getConcept2Request);

      const findPromise = database.findOrphanedDirections();

      // Simulate getAllThematicDirections success
      setTimeout(() => {
        getAllDirectionsRequest.onsuccess();

        // Simulate concept lookups - all exist
        setTimeout(() => {
          getConcept1Request.onsuccess();
          setTimeout(() => {
            getConcept2Request.onsuccess();
          }, 0);
        }, 0);
      }, 0);

      const result = await findPromise;

      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterDatabase: Found 0 orphaned directions'
      );
    });

    it('should handle directions with concepts that throw errors during lookup', async () => {
      const allDirections = [
        { id: 'direction-1', conceptId: 'concept-1' },
        { id: 'direction-2', conceptId: 'error-concept' },
      ];

      // Mock getAllThematicDirections
      const getAllDirectionsRequest = {
        onsuccess: null,
        onerror: null,
        result: allDirections,
      };

      // Mock getCharacterConcept calls
      const getConcept1Request = {
        onsuccess: null,
        onerror: null,
        result: { id: 'concept-1' },
      };
      const getErrorConceptRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: 'Database error' },
      };

      mockObjectStore.getAll.mockReturnValue(getAllDirectionsRequest);
      mockObjectStore.get
        .mockReturnValueOnce(getConcept1Request)
        .mockReturnValueOnce(getErrorConceptRequest);

      const findPromise = database.findOrphanedDirections();

      // Simulate getAllThematicDirections success
      setTimeout(() => {
        getAllDirectionsRequest.onsuccess();

        // Simulate concept lookups
        setTimeout(() => {
          getConcept1Request.onsuccess(); // concept-1 exists
          setTimeout(() => {
            getErrorConceptRequest.onerror(); // error-concept throws error
          }, 0);
        }, 0);
      }, 0);

      const result = await findPromise;

      // Direction with error-concept should be considered orphaned
      expect(result).toEqual([
        { id: 'direction-2', conceptId: 'error-concept' },
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterDatabase: Found 1 orphaned directions'
      );
    });

    it('should handle error in getAllThematicDirections', async () => {
      const errorMessage = 'Failed to get directions';

      const getAllDirectionsRequest = {
        onsuccess: null,
        onerror: null,
        error: { message: errorMessage },
      };

      mockObjectStore.getAll.mockReturnValue(getAllDirectionsRequest);

      const findPromise = database.findOrphanedDirections();

      // Simulate getAllThematicDirections error
      setTimeout(() => {
        getAllDirectionsRequest.onerror();
      }, 0);

      await expect(findPromise).rejects.toThrow(
        `Failed to find orphaned directions: Failed to get all thematic directions: ${errorMessage}`
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle empty directions list', async () => {
      const getAllDirectionsRequest = {
        onsuccess: null,
        onerror: null,
        result: [],
      };

      mockObjectStore.getAll.mockReturnValue(getAllDirectionsRequest);

      const findPromise = database.findOrphanedDirections();

      // Simulate getAllThematicDirections success with empty array
      setTimeout(() => {
        getAllDirectionsRequest.onsuccess();
      }, 0);

      const result = await findPromise;

      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterDatabase: Found 0 orphaned directions'
      );
    });
  });

  describe('error handling for uninitialized database', () => {
    beforeEach(() => {
      database = new CharacterDatabase({ logger: mockLogger });
      // Do not initialize database
    });

    it('should throw error when calling saveCharacterConcept without initialization', async () => {
      const concept = { id: 'test', concept: 'Test concept' };

      await expect(database.saveCharacterConcept(concept)).rejects.toThrow(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    });

    it('should throw error when calling getCharacterConcept without initialization', async () => {
      await expect(database.getCharacterConcept('test-id')).rejects.toThrow(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    });

    it('should throw error when calling getAllCharacterConcepts without initialization', async () => {
      await expect(database.getAllCharacterConcepts()).rejects.toThrow(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    });

    it('should throw error when calling deleteCharacterConcept without initialization', async () => {
      await expect(database.deleteCharacterConcept('test-id')).rejects.toThrow(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    });

    it('should throw error when calling saveThematicDirections without initialization', async () => {
      await expect(database.saveThematicDirections([])).rejects.toThrow(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    });

    it('should throw error when calling getThematicDirectionsByConceptId without initialization', async () => {
      await expect(
        database.getThematicDirectionsByConceptId('test-id')
      ).rejects.toThrow(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    });

    it('should throw error when calling getAllThematicDirections without initialization', async () => {
      await expect(database.getAllThematicDirections()).rejects.toThrow(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    });

    it('should throw error when calling getThematicDirection without initialization', async () => {
      await expect(database.getThematicDirection('test-id')).rejects.toThrow(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    });

    it('should throw error when calling updateThematicDirection without initialization', async () => {
      await expect(
        database.updateThematicDirection('test-id', {})
      ).rejects.toThrow(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    });

    it('should throw error when calling deleteThematicDirection without initialization', async () => {
      await expect(database.deleteThematicDirection('test-id')).rejects.toThrow(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    });

    it('should throw error when calling findOrphanedDirections without initialization', async () => {
      await expect(database.findOrphanedDirections()).rejects.toThrow(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    });
  });

  describe('Cliché Operations', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;
      mockDbInstance.objectStoreNames.contains.mockReturnValue(true);

      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    describe('saveCliche', () => {
      it('should successfully save a cliché', async () => {
        const cliche = {
          id: 'cliche-1',
          directionId: 'direction-1',
          conceptId: 'concept-1',
          title: 'The Reluctant Hero',
          items: ['Refuses the call', 'Eventually accepts destiny'],
        };

        const putRequest = { onsuccess: null, onerror: null };
        mockObjectStore.put.mockReturnValue(putRequest);

        const savePromise = database.saveCliche(cliche);

        setTimeout(() => putRequest.onsuccess(), 0);
        const result = await savePromise;

        expect(result).toEqual(cliche);
        expect(mockObjectStore.put).toHaveBeenCalledWith(cliche);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'CharacterDatabase: Saved cliche cliche-1'
        );
      });

      it('should handle save error for cliché', async () => {
        const cliche = {
          id: 'cliche-1',
          directionId: 'direction-1',
          conceptId: 'concept-1',
        };
        const errorMessage = 'Storage quota exceeded';

        const putRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: errorMessage },
        };
        mockObjectStore.put.mockReturnValue(putRequest);

        const savePromise = database.saveCliche(cliche);

        setTimeout(() => putRequest.onerror(), 0);

        await expect(savePromise).rejects.toThrow(
          `Failed to save cliche: ${errorMessage}`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'CharacterDatabase: Error saving cliche',
          expect.any(Error)
        );
      });

      it('should handle save error with null error object', async () => {
        const cliche = {
          id: 'cliche-1',
          directionId: 'direction-1',
          conceptId: 'concept-1',
        };

        const putRequest = {
          onsuccess: null,
          onerror: null,
          error: null,
        };
        mockObjectStore.put.mockReturnValue(putRequest);

        const savePromise = database.saveCliche(cliche);

        setTimeout(() => putRequest.onerror(), 0);

        await expect(savePromise).rejects.toThrow(
          'Failed to save cliche: Unknown error'
        );
      });
    });

    describe('getClicheByDirectionId', () => {
      it('should successfully get cliché by direction ID', async () => {
        const cliche = {
          id: 'cliche-1',
          directionId: 'direction-1',
          conceptId: 'concept-1',
          title: 'The Chosen One',
        };

        const getRequest = { onsuccess: null, onerror: null, result: cliche };
        mockIndex.get.mockReturnValue(getRequest);

        const getPromise = database.getClicheByDirectionId('direction-1');

        setTimeout(() => getRequest.onsuccess(), 0);
        const result = await getPromise;

        expect(result).toEqual(cliche);
        expect(mockObjectStore.index).toHaveBeenCalledWith('directionId');
        expect(mockIndex.get).toHaveBeenCalledWith('direction-1');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Found cliche with ID: cliche-1')
        );
      });

      it('should return null when cliché not found', async () => {
        const getRequest = { onsuccess: null, onerror: null, result: null };
        mockIndex.get.mockReturnValue(getRequest);

        const getPromise = database.getClicheByDirectionId('nonexistent');

        setTimeout(() => getRequest.onsuccess(), 0);
        const result = await getPromise;

        expect(result).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'No cliche found in database for directionId: nonexistent'
        );
      });

      it('should handle index query error', async () => {
        const errorMessage = 'Index query failed';
        const getRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: errorMessage },
        };
        mockIndex.get.mockReturnValue(getRequest);

        const getPromise = database.getClicheByDirectionId('direction-1');

        setTimeout(() => getRequest.onerror(), 0);

        await expect(getPromise).rejects.toThrow(
          `Failed to get cliche: ${errorMessage}`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error in getClicheByDirectionId'),
          expect.any(Error)
        );
      });

      it('should handle transaction error', async () => {
        const errorMessage = 'Transaction failed';

        // Set up mock transaction to trigger error
        const failingTransaction = {
          ...mockTransaction,
          error: { message: errorMessage },
          onerror: null,
        };
        mockDbInstance.transaction.mockReturnValue(failingTransaction);

        const getRequest = { onsuccess: null, onerror: null };
        mockIndex.get.mockReturnValue(getRequest);

        const getPromise = database.getClicheByDirectionId('direction-1');

        // Simulate transaction error
        setTimeout(() => {
          if (failingTransaction.onerror) {
            failingTransaction.onerror();
          }
        }, 0);

        await expect(getPromise).rejects.toThrow(
          `Transaction failed: ${errorMessage}`
        );
      });

      it('should handle exception in getClicheByDirectionId', async () => {
        // Make index throw an exception
        mockObjectStore.index.mockImplementation(() => {
          throw new Error('Index access failed');
        });

        await expect(
          database.getClicheByDirectionId('direction-1')
        ).rejects.toThrow('Index access failed');

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Exception in getClicheByDirectionId'),
          expect.any(Error)
        );
      });
    });

    describe('addCliche', () => {
      it('should add cliché using saveCliche', async () => {
        const cliche = {
          id: 'cliche-1',
          directionId: 'direction-1',
          conceptId: 'concept-1',
        };

        const putRequest = { onsuccess: null, onerror: null };
        mockObjectStore.put.mockReturnValue(putRequest);

        const addPromise = database.addCliche(cliche);

        setTimeout(() => putRequest.onsuccess(), 0);
        const result = await addPromise;

        expect(result).toEqual(cliche);
        expect(mockObjectStore.put).toHaveBeenCalledWith(cliche);
      });
    });

    describe('updateCliche', () => {
      it('should successfully update a cliché', async () => {
        const id = 'cliche-1';
        const updatedData = {
          title: 'Updated Title',
          items: ['New item 1', 'New item 2'],
        };

        const putRequest = { onsuccess: null, onerror: null };
        mockObjectStore.put.mockReturnValue(putRequest);

        const updatePromise = database.updateCliche(id, updatedData);

        setTimeout(() => putRequest.onsuccess(), 0);
        const result = await updatePromise;

        expect(result).toEqual({ ...updatedData, id });
        expect(mockObjectStore.put).toHaveBeenCalledWith({
          ...updatedData,
          id,
        });
      });

      it('should throw error for invalid cliché ID', async () => {
        await expect(database.updateCliche('', {})).rejects.toThrow(
          'Cliche ID is required for update'
        );

        await expect(database.updateCliche(null, {})).rejects.toThrow(
          'Cliche ID is required for update'
        );

        await expect(database.updateCliche(123, {})).rejects.toThrow(
          'Cliche ID is required for update'
        );
      });

      it('should throw error for invalid update data', async () => {
        await expect(database.updateCliche('cliche-1', null)).rejects.toThrow(
          'Updated cliche data is required'
        );

        await expect(
          database.updateCliche('cliche-1', 'string')
        ).rejects.toThrow('Updated cliche data is required');
      });
    });

    describe('deleteCliche', () => {
      it('should successfully delete a cliché', async () => {
        const clicheId = 'cliche-1';

        const deleteRequest = { onsuccess: null, onerror: null };
        mockObjectStore.delete.mockReturnValue(deleteRequest);

        const deletePromise = database.deleteCliche(clicheId);

        setTimeout(() => deleteRequest.onsuccess(), 0);
        const result = await deletePromise;

        expect(result).toBe(true);
        expect(mockObjectStore.delete).toHaveBeenCalledWith(clicheId);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'CharacterDatabase: Successfully deleted cliche cliche-1'
        );
      });

      it('should handle delete error', async () => {
        const clicheId = 'cliche-1';
        const errorMessage = 'Delete operation failed';

        const deleteRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: errorMessage },
        };
        mockObjectStore.delete.mockReturnValue(deleteRequest);

        const deletePromise = database.deleteCliche(clicheId);

        setTimeout(() => deleteRequest.onerror(), 0);

        await expect(deletePromise).rejects.toThrow(
          `Failed to delete cliche: ${errorMessage}`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'CharacterDatabase: Error deleting cliche',
          expect.any(Error)
        );
      });

      it('should handle delete error with null error object', async () => {
        const clicheId = 'cliche-1';

        const deleteRequest = {
          onsuccess: null,
          onerror: null,
          error: null,
        };
        mockObjectStore.delete.mockReturnValue(deleteRequest);

        const deletePromise = database.deleteCliche(clicheId);

        setTimeout(() => deleteRequest.onerror(), 0);

        await expect(deletePromise).rejects.toThrow(
          'Failed to delete cliche: Unknown error'
        );
      });
    });
  });

  describe('Metadata Operations', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;
      mockDbInstance.objectStoreNames.contains.mockReturnValue(true);

      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    describe('storeMigrationMetadata', () => {
      it('should successfully store migration metadata', async () => {
        const migrationKey = 'migration-v1-v2';
        const migrationData = {
          version: 2,
          migratedEntities: 100,
        };

        const putRequest = { onsuccess: null, onerror: null };
        mockObjectStore.put.mockReturnValue(putRequest);

        const storePromise = database.storeMigrationMetadata(
          migrationKey,
          migrationData
        );

        setTimeout(() => putRequest.onsuccess(), 0);
        await storePromise;

        expect(mockObjectStore.put).toHaveBeenCalledWith({
          key: migrationKey,
          value: expect.objectContaining({
            ...migrationData,
            migratedAt: expect.any(String),
          }),
        });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'CharacterDatabase: Stored migration metadata for migration-v1-v2'
        );
      });

      it('should handle storage error', async () => {
        const migrationKey = 'migration-v1-v2';
        const migrationData = { version: 2 };
        const errorMessage = 'Storage failed';

        const putRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: errorMessage },
        };
        mockObjectStore.put.mockReturnValue(putRequest);

        const storePromise = database.storeMigrationMetadata(
          migrationKey,
          migrationData
        );

        setTimeout(() => putRequest.onerror(), 0);

        await expect(storePromise).rejects.toThrow(
          `Failed to store migration metadata: ${errorMessage}`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'CharacterDatabase: Error storing migration metadata',
          expect.any(Error)
        );
      });

      it('should handle storage error with null error object', async () => {
        const migrationKey = 'migration-v1-v2';
        const migrationData = { version: 2 };

        const putRequest = {
          onsuccess: null,
          onerror: null,
          error: null,
        };
        mockObjectStore.put.mockReturnValue(putRequest);

        const storePromise = database.storeMigrationMetadata(
          migrationKey,
          migrationData
        );

        setTimeout(() => putRequest.onerror(), 0);

        await expect(storePromise).rejects.toThrow(
          'Failed to store migration metadata: Unknown error'
        );
      });
    });

    describe('addMetadata', () => {
      it('should successfully add metadata entry', async () => {
        const metadata = {
          key: 'last-sync',
          value: { timestamp: '2024-01-01T00:00:00Z', count: 42 },
        };

        const putRequest = { onsuccess: null, onerror: null };
        mockObjectStore.put.mockReturnValue(putRequest);

        const addPromise = database.addMetadata(metadata);

        setTimeout(() => putRequest.onsuccess(), 0);
        await addPromise;

        expect(mockObjectStore.put).toHaveBeenCalledWith({
          key: metadata.key,
          value: metadata.value,
          timestamp: expect.any(String),
        });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'CharacterDatabase: Added metadata for last-sync'
        );
      });

      it('should handle add error', async () => {
        const metadata = { key: 'test-key', value: 'test-value' };
        const errorMessage = 'Add failed';

        const putRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: errorMessage },
        };
        mockObjectStore.put.mockReturnValue(putRequest);

        const addPromise = database.addMetadata(metadata);

        setTimeout(() => putRequest.onerror(), 0);

        await expect(addPromise).rejects.toThrow(
          `Failed to add metadata: ${errorMessage}`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'CharacterDatabase: Error adding metadata',
          expect.any(Error)
        );
      });

      it('should handle add error with null error object', async () => {
        const metadata = { key: 'test-key', value: 'test-value' };

        const putRequest = {
          onsuccess: null,
          onerror: null,
          error: null,
        };
        mockObjectStore.put.mockReturnValue(putRequest);

        const addPromise = database.addMetadata(metadata);

        setTimeout(() => putRequest.onerror(), 0);

        await expect(addPromise).rejects.toThrow(
          'Failed to add metadata: Unknown error'
        );
      });
    });

    describe('hasClichesStore', () => {
      it('should return true when cliches store exists', () => {
        mockDbInstance.objectStoreNames.contains.mockReturnValue(true);

        const result = database.hasClichesStore();

        expect(result).toBe(true);
        expect(mockDbInstance.objectStoreNames.contains).toHaveBeenCalledWith(
          'cliches'
        );
      });

      it('should return false when cliches store does not exist', () => {
        mockDbInstance.objectStoreNames.contains.mockReturnValue(false);

        const result = database.hasClichesStore();

        expect(result).toBe(false);
        expect(mockDbInstance.objectStoreNames.contains).toHaveBeenCalledWith(
          'cliches'
        );
      });

      it('should throw error when database not initialized', () => {
        const uninitializedDb = new CharacterDatabase({ logger: mockLogger });

        expect(() => uninitializedDb.hasClichesStore()).toThrow(
          'CharacterDatabase: Database not initialized. Call initialize() first.'
        );
      });
    });
  });

  describe('Debug Utility Methods', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;
      mockDbInstance.objectStoreNames.contains.mockReturnValue(true);

      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    describe('debugDumpAllCliches', () => {
      it('should dump all clichés from database', async () => {
        const cliches = [
          {
            id: 'cliche-1',
            conceptId: 'concept-1',
            directionId: 'direction-1',
            title: "The Hero's Journey",
          },
          {
            id: 'cliche-2',
            conceptId: 'concept-2',
            directionId: 'direction-2',
            title: 'The Mentor',
          },
        ];

        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          result: cliches,
        };
        mockObjectStore.getAll.mockReturnValue(getAllRequest);

        const dumpPromise = database.debugDumpAllCliches();

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await dumpPromise;

        expect(result).toEqual(cliches);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'DEBUG DB: Starting to dump all clichés...'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'DEBUG DB: Found 2 total clichés in database'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Cliche 1: ID=cliche-1')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Cliche 2: ID=cliche-2')
        );
      });

      it('should handle empty clichés list', async () => {
        const getAllRequest = { onsuccess: null, onerror: null, result: [] };
        mockObjectStore.getAll.mockReturnValue(getAllRequest);

        const dumpPromise = database.debugDumpAllCliches();

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await dumpPromise;

        expect(result).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'DEBUG DB: Found 0 total clichés in database'
        );
      });

      it('should handle dump error', async () => {
        const errorMessage = 'Failed to fetch';
        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: errorMessage },
        };
        mockObjectStore.getAll.mockReturnValue(getAllRequest);

        const dumpPromise = database.debugDumpAllCliches();

        setTimeout(() => getAllRequest.onerror(), 0);

        await expect(dumpPromise).rejects.toThrow(
          `Failed to dump clichés: ${errorMessage}`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'DEBUG DB: Error dumping clichés:',
          expect.any(Error)
        );
      });

      it('should handle exception during dump', async () => {
        mockObjectStore.getAll.mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        await expect(database.debugDumpAllCliches()).rejects.toThrow(
          'Unexpected error'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'DEBUG DB: Exception dumping clichés:',
          expect.any(Error)
        );
      });
    });

    describe('debugDumpAllThematicDirections', () => {
      it('should dump all thematic directions from database', async () => {
        const directions = [
          {
            id: 'direction-1',
            conceptId: 'concept-1',
            title: 'Dark and brooding',
          },
          {
            id: 'direction-2',
            conceptId: 'concept-2',
            title: 'Light-hearted comedy',
          },
        ];

        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          result: directions,
        };
        mockObjectStore.getAll.mockReturnValue(getAllRequest);

        const dumpPromise = database.debugDumpAllThematicDirections();

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await dumpPromise;

        expect(result).toEqual(directions);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'DEBUG DB: Starting to dump all thematic directions...'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'DEBUG DB: Found 2 total thematic directions in database'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Direction 1: ID=direction-1')
        );
      });

      it('should handle empty directions list', async () => {
        const getAllRequest = { onsuccess: null, onerror: null, result: null };
        mockObjectStore.getAll.mockReturnValue(getAllRequest);

        const dumpPromise = database.debugDumpAllThematicDirections();

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await dumpPromise;

        expect(result).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'DEBUG DB: Found 0 total thematic directions in database'
        );
      });

      it('should handle dump error', async () => {
        const errorMessage = 'Query failed';
        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: errorMessage },
        };
        mockObjectStore.getAll.mockReturnValue(getAllRequest);

        const dumpPromise = database.debugDumpAllThematicDirections();

        setTimeout(() => getAllRequest.onerror(), 0);

        await expect(dumpPromise).rejects.toThrow(
          `Failed to dump directions: ${errorMessage}`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'DEBUG DB: Error dumping directions:',
          expect.any(Error)
        );
      });

      it('should handle exception during dump', async () => {
        // Mock the transaction method to throw an error
        mockDbInstance.transaction.mockImplementation(() => {
          throw new Error('Transaction failed');
        });

        await expect(database.debugDumpAllThematicDirections()).rejects.toThrow(
          'Transaction failed'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'DEBUG DB: Exception dumping directions:',
          expect.any(Error)
        );
      });
    });

    describe('debugDumpAllCharacterConcepts', () => {
      it('should dump all character concepts from database', async () => {
        const concepts = [
          {
            id: 'concept-1',
            status: 'draft',
            createdAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'concept-2',
            status: 'published',
            createdAt: '2024-01-02T00:00:00Z',
          },
        ];

        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          result: concepts,
        };
        mockObjectStore.getAll.mockReturnValue(getAllRequest);

        const dumpPromise = database.debugDumpAllCharacterConcepts();

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await dumpPromise;

        expect(result).toEqual(concepts);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'DEBUG DB: Starting to dump all character concepts...'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'DEBUG DB: Found 2 total character concepts in database'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Concept 1: ID=concept-1')
        );
      });

      it('should handle empty concepts list', async () => {
        const getAllRequest = { onsuccess: null, onerror: null, result: [] };
        mockObjectStore.getAll.mockReturnValue(getAllRequest);

        const dumpPromise = database.debugDumpAllCharacterConcepts();

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await dumpPromise;

        expect(result).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'DEBUG DB: Found 0 total character concepts in database'
        );
      });

      it('should handle dump error', async () => {
        const errorMessage = 'Database error';
        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: errorMessage },
        };
        mockObjectStore.getAll.mockReturnValue(getAllRequest);

        const dumpPromise = database.debugDumpAllCharacterConcepts();

        setTimeout(() => getAllRequest.onerror(), 0);

        await expect(dumpPromise).rejects.toThrow(
          `Failed to dump concepts: ${errorMessage}`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'DEBUG DB: Error dumping concepts:',
          expect.any(Error)
        );
      });

      it('should handle null error object', async () => {
        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          error: null,
        };
        mockObjectStore.getAll.mockReturnValue(getAllRequest);

        const dumpPromise = database.debugDumpAllCharacterConcepts();

        setTimeout(() => getAllRequest.onerror(), 0);

        await expect(dumpPromise).rejects.toThrow(
          'Failed to dump concepts: Unknown error'
        );
      });

      it('should handle transaction failure before dump starts', async () => {
        mockDbInstance.transaction.mockImplementationOnce(() => {
          throw new Error('Transaction failure');
        });

        await expect(database.debugDumpAllCharacterConcepts()).rejects.toThrow(
          'Transaction failure'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'DEBUG DB: Exception dumping concepts:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Core Motivations Methods', () => {
    beforeEach(async () => {
      database = new CharacterDatabase({ logger: mockLogger });
      mockRequest.result = mockDbInstance;
      mockDbInstance.objectStoreNames.contains.mockReturnValue(true);

      const initPromise = database.initialize();
      setTimeout(() => mockRequest.onsuccess(), 0);
      await initPromise;
    });

    describe('saveCoreMotivation', () => {
      const mockMotivation = {
        directionId: 'direction-1',
        conceptId: 'concept-1',
        coreDesire: 'To seek truth and justice',
        internalContradiction: 'Must lie to protect loved ones',
        centralQuestion: 'What price is too high for truth?',
      };

      it('should successfully save a core motivation with generated ID and timestamp', async () => {
        const putRequest = { onsuccess: null, onerror: null };
        mockObjectStore.put.mockReturnValue(putRequest);

        const savePromise = database.saveCoreMotivation(mockMotivation);

        setTimeout(() => putRequest.onsuccess(), 0);
        const result = await savePromise;

        expect(result).toMatchObject(mockMotivation);
        expect(result.id).toBeDefined();
        expect(result.createdAt).toBeDefined();
        expect(mockObjectStore.put).toHaveBeenCalledWith(
          expect.objectContaining({
            ...mockMotivation,
            id: expect.any(String),
            createdAt: expect.any(String),
          })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Saved core motivation')
        );
      });

      it('should preserve existing ID and timestamp', async () => {
        const motivationWithId = {
          ...mockMotivation,
          id: 'existing-id',
          createdAt: '2024-01-01T00:00:00.000Z',
        };

        const putRequest = { onsuccess: null, onerror: null };
        mockObjectStore.put.mockReturnValue(putRequest);

        const savePromise = database.saveCoreMotivation(motivationWithId);

        setTimeout(() => putRequest.onsuccess(), 0);
        const result = await savePromise;

        expect(result.id).toBe('existing-id');
        expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
      });

      it('should throw error for missing motivation', async () => {
        await expect(database.saveCoreMotivation(null)).rejects.toThrow(
          'Motivation is required'
        );
      });

      it('should throw error for missing directionId', async () => {
        const invalidMotivation = { ...mockMotivation, directionId: '' };
        await expect(
          database.saveCoreMotivation(invalidMotivation)
        ).rejects.toThrow('saveCoreMotivation: Invalid directionId');
      });

      it('should throw error for missing conceptId', async () => {
        const invalidMotivation = { ...mockMotivation, conceptId: '' };
        await expect(
          database.saveCoreMotivation(invalidMotivation)
        ).rejects.toThrow('saveCoreMotivation: Invalid conceptId');
      });

      it('should throw error for missing coreDesire', async () => {
        const invalidMotivation = { ...mockMotivation, coreDesire: null };
        await expect(
          database.saveCoreMotivation(invalidMotivation)
        ).rejects.toThrow('Core desire is required');
      });

      it('should handle IndexedDB put error', async () => {
        const putRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: 'Storage error' },
        };
        mockObjectStore.put.mockReturnValue(putRequest);

        const savePromise = database.saveCoreMotivation(mockMotivation);

        setTimeout(() => putRequest.onerror(), 0);

        await expect(savePromise).rejects.toThrow(
          'Failed to save core motivation: Storage error'
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should reject when transaction creation fails', async () => {
        database.close();

        await expect(
          database.saveCoreMotivation({
            ...mockMotivation,
            id: 'existing',
            createdAt: '2024-01-01T00:00:00Z',
          })
        ).rejects.toThrow(
          'CharacterDatabase: Database not initialized. Call initialize() first.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to save core motivation:',
          expect.any(Error)
        );
      });
    });

    describe('saveCoreMotivations', () => {
      const mockMotivations = [
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

      it('should save multiple motivations successfully', async () => {
        const putRequest1 = { onsuccess: null, onerror: null };
        const putRequest2 = { onsuccess: null, onerror: null };
        mockObjectStore.put
          .mockReturnValueOnce(putRequest1)
          .mockReturnValueOnce(putRequest2);

        const savePromise = database.saveCoreMotivations(mockMotivations);

        setTimeout(() => {
          putRequest1.onsuccess();
          putRequest2.onsuccess();
        }, 0);

        const result = await savePromise;

        expect(result).toHaveLength(2);
        expect(result[0]).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
        expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Saved 2 core motivations'
        );
      });

      it('should throw error for null motivations array', async () => {
        await expect(database.saveCoreMotivations(null)).rejects.toThrow(
          'Motivations array is required'
        );
      });

      it('should throw error for empty motivations array', async () => {
        await expect(database.saveCoreMotivations([])).rejects.toThrow(
          'Motivations must be a non-empty array'
        );
      });

      it('should continue processing even if some motivations fail', async () => {
        const putRequest1 = {
          onsuccess: null,
          onerror: null,
          error: { message: 'Storage error' },
        };
        const putRequest2 = { onsuccess: null, onerror: null };
        mockObjectStore.put
          .mockReturnValueOnce(putRequest1)
          .mockReturnValueOnce(putRequest2);

        const savePromise = database.saveCoreMotivations(mockMotivations);

        setTimeout(() => {
          putRequest1.onerror();
          putRequest2.onsuccess();
        }, 0);

        const result = await savePromise;

        expect(result).toHaveLength(1); // Only one succeeded
        expect(mockLogger.warn).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Saved 1 core motivations'
        );
      });

      it('should resolve after processing when all motivations fail', async () => {
        const putRequest1 = { onsuccess: null, onerror: null, error: { message: 'fail-1' } };
        const putRequest2 = { onsuccess: null, onerror: null, error: { message: 'fail-2' } };
        mockObjectStore.put
          .mockReturnValueOnce(putRequest1)
          .mockReturnValueOnce(putRequest2);

        const savePromise = database.saveCoreMotivations(mockMotivations);

        setTimeout(() => {
          putRequest1.onerror();
          putRequest2.onerror();
        }, 0);

        const result = await savePromise;

        expect(result).toEqual([]);
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);
        expect(mockLogger.info).toHaveBeenCalledWith('Saved 0 core motivations');
      });

      it('should reject when transaction creation fails', async () => {
        database.close();

        await expect(
          database.saveCoreMotivations([{ ...mockMotivations[0] }])
        ).rejects.toThrow(
          'CharacterDatabase: Database not initialized. Call initialize() first.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to save core motivations:',
          expect.any(Error)
        );
      });
    });

    describe('getCoreMotivationsByDirectionId', () => {
      const mockMotivations = [
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

      it('should retrieve motivations for a direction sorted by createdAt desc', async () => {
        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          result: mockMotivations,
        };
        mockIndex.getAll.mockReturnValue(getAllRequest);

        const retrievePromise =
          database.getCoreMotivationsByDirectionId('direction-1');

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await retrievePromise;

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('motivation-2'); // Newest first
        expect(result[1].id).toBe('motivation-1');
        expect(mockObjectStore.index).toHaveBeenCalledWith('directionId');
        expect(mockIndex.getAll).toHaveBeenCalledWith('direction-1');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Retrieved 2 motivations for direction direction-1'
        );
      });

      it('should return empty array when no motivations found', async () => {
        const getAllRequest = { onsuccess: null, onerror: null, result: [] };
        mockIndex.getAll.mockReturnValue(getAllRequest);

        const retrievePromise =
          database.getCoreMotivationsByDirectionId('direction-1');

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await retrievePromise;

        expect(result).toEqual([]);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Retrieved 0 motivations for direction direction-1'
        );
      });

      it('should throw error for missing directionId', async () => {
        await expect(
          database.getCoreMotivationsByDirectionId('')
        ).rejects.toThrow(
          'getCoreMotivationsByDirectionId: Invalid directionId'
        );
      });

      it('should handle IndexedDB getAll error', async () => {
        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: 'Query error' },
        };
        mockIndex.getAll.mockReturnValue(getAllRequest);

        const retrievePromise =
          database.getCoreMotivationsByDirectionId('direction-1');

        setTimeout(() => getAllRequest.onerror(), 0);

        await expect(retrievePromise).rejects.toThrow(
          'Failed to get core motivations: Query error'
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should reject when transaction creation fails', async () => {
        database.close();

        await expect(
          database.getCoreMotivationsByDirectionId('direction-1')
        ).rejects.toThrow(
          'CharacterDatabase: Database not initialized. Call initialize() first.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to get core motivations by direction:',
          expect.any(Error)
        );
      });
    });

    describe('getCoreMotivationsByConceptId', () => {
      it('should retrieve motivations for a concept sorted by createdAt desc', async () => {
        const mockMotivations = [
          {
            id: 'motivation-1',
            conceptId: 'concept-1',
            createdAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'motivation-2',
            conceptId: 'concept-1',
            createdAt: '2024-01-03T00:00:00Z',
          },
          {
            id: 'motivation-3',
            conceptId: 'concept-1',
            createdAt: '2024-01-02T00:00:00Z',
          },
        ];
        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          result: mockMotivations,
        };
        mockIndex.getAll.mockReturnValue(getAllRequest);

        const retrievePromise =
          database.getCoreMotivationsByConceptId('concept-1');

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await retrievePromise;

        expect(result).toHaveLength(3);
        expect(result.map((item) => item.id)).toEqual([
          'motivation-2',
          'motivation-3',
          'motivation-1',
        ]);
        expect(mockObjectStore.index).toHaveBeenCalledWith('conceptId');
        expect(mockIndex.getAll).toHaveBeenCalledWith('concept-1');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Retrieved 3 motivations for concept concept-1'
        );
      });

      it('should throw error for missing conceptId', async () => {
        await expect(
          database.getCoreMotivationsByConceptId('')
        ).rejects.toThrow('getCoreMotivationsByConceptId: Invalid conceptId');
      });

      it('should handle IndexedDB getAll error for concept retrieval', async () => {
        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: 'Concept query error' },
        };
        mockIndex.getAll.mockReturnValue(getAllRequest);

        const retrievePromise =
          database.getCoreMotivationsByConceptId('concept-1');

        setTimeout(() => getAllRequest.onerror(), 0);

        await expect(retrievePromise).rejects.toThrow(
          'Failed to get core motivations: Concept query error'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to get core motivations by concept:',
          expect.any(Error)
        );
      });

      it('should reject when transaction creation fails', async () => {
        database.close();

        await expect(
          database.getCoreMotivationsByConceptId('concept-1')
        ).rejects.toThrow(
          'CharacterDatabase: Database not initialized. Call initialize() first.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to get core motivations by concept:',
          expect.any(Error)
        );
      });
    });

    describe('getCoreMotivationById', () => {
      it('should retrieve motivation by ID successfully', async () => {
        const mockMotivation = {
          id: 'motivation-1',
          directionId: 'direction-1',
        };
        const getRequest = {
          onsuccess: null,
          onerror: null,
          result: mockMotivation,
        };
        mockObjectStore.get.mockReturnValue(getRequest);

        const retrievePromise = database.getCoreMotivationById('motivation-1');

        setTimeout(() => getRequest.onsuccess(), 0);
        const result = await retrievePromise;

        expect(result).toEqual(mockMotivation);
        expect(mockObjectStore.get).toHaveBeenCalledWith('motivation-1');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Retrieved core motivation motivation-1'
        );
      });

      it('should return null when motivation not found', async () => {
        const getRequest = { onsuccess: null, onerror: null, result: null };
        mockObjectStore.get.mockReturnValue(getRequest);

        const retrievePromise = database.getCoreMotivationById('nonexistent');

        setTimeout(() => getRequest.onsuccess(), 0);
        const result = await retrievePromise;

        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Core motivation nonexistent not found'
        );
      });

      it('should throw error for missing motivationId', async () => {
        await expect(database.getCoreMotivationById('')).rejects.toThrow(
          'getCoreMotivationById: Invalid motivationId'
        );
      });

      it('should handle IndexedDB get error', async () => {
        const getRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: 'Lookup failure' },
        };
        mockObjectStore.get.mockReturnValue(getRequest);

        const retrievePromise = database.getCoreMotivationById('motivation-1');

        setTimeout(() => getRequest.onerror(), 0);

        await expect(retrievePromise).rejects.toThrow(
          'Failed to get core motivation: Lookup failure'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to get core motivation by ID:',
          expect.any(Error)
        );
      });

      it('should reject when transaction creation fails', async () => {
        database.close();

        await expect(
          database.getCoreMotivationById('motivation-1')
        ).rejects.toThrow(
          'CharacterDatabase: Database not initialized. Call initialize() first.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to get core motivation by ID:',
          expect.any(Error)
        );
      });
    });

    describe('deleteCoreMotivation', () => {
      it('should delete motivation successfully', async () => {
        // Mock getCoreMotivationById to return a motivation
        const mockMotivation = {
          id: 'motivation-1',
          directionId: 'direction-1',
        };
        const getRequest = {
          onsuccess: null,
          onerror: null,
          result: mockMotivation,
        };
        mockObjectStore.get.mockReturnValue(getRequest);

        const deleteRequest = {
          onsuccess: null,
          onerror: null,
          result: undefined,
        };
        mockObjectStore.delete.mockReturnValue(deleteRequest);

        const deletePromise = database.deleteCoreMotivation('motivation-1');

        setTimeout(() => {
          getRequest.onsuccess(); // First call succeeds
          setTimeout(() => deleteRequest.onsuccess(), 0); // Then deletion succeeds
        }, 0);

        const result = await deletePromise;

        expect(result).toBe(true);
        expect(mockObjectStore.delete).toHaveBeenCalledWith('motivation-1');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Deleted core motivation motivation-1'
        );
      });

      it('should return false when motivation does not exist', async () => {
        const getRequest = { onsuccess: null, onerror: null, result: null };
        mockObjectStore.get.mockReturnValue(getRequest);

        const deletePromise = database.deleteCoreMotivation('nonexistent');

        setTimeout(() => getRequest.onsuccess(), 0);
        const result = await deletePromise;

        expect(result).toBe(false);
        expect(mockObjectStore.delete).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Cannot delete non-existent motivation nonexistent'
        );
      });

      it('should throw error for missing motivationId', async () => {
        await expect(database.deleteCoreMotivation('')).rejects.toThrow(
          'deleteCoreMotivation: Invalid motivationId'
        );
      });

      it('should reject when deletion fails', async () => {
        const mockMotivation = {
          id: 'motivation-1',
          directionId: 'direction-1',
        };
        const getRequest = {
          onsuccess: null,
          onerror: null,
          result: mockMotivation,
        };
        const deleteRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: 'Delete failure' },
        };
        mockObjectStore.get.mockReturnValue(getRequest);
        mockObjectStore.delete.mockReturnValue(deleteRequest);

        const deletePromise = database.deleteCoreMotivation('motivation-1');

        setTimeout(() => {
          getRequest.onsuccess();
          setTimeout(() => deleteRequest.onerror(), 0);
        }, 0);

        await expect(deletePromise).rejects.toThrow(
          'Failed to delete core motivation: Delete failure'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to delete core motivation:',
          expect.any(Error)
        );
      });

      it('should reject when transaction creation fails', async () => {
        jest
          .spyOn(database, 'getCoreMotivationById')
          .mockResolvedValue({ id: 'motivation-1' });
        database.close();

        await expect(
          database.deleteCoreMotivation('motivation-1')
        ).rejects.toThrow(
          'CharacterDatabase: Database not initialized. Call initialize() first.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to delete core motivation:',
          expect.any(Error)
        );
      });
    });

    describe('updateCoreMotivation', () => {
      it('should update motivation successfully', async () => {
        const existingMotivation = {
          id: 'motivation-1',
          directionId: 'direction-1',
          conceptId: 'concept-1',
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

        const putRequest = {
          onsuccess: null,
          onerror: null,
          result: undefined,
        };
        mockObjectStore.put.mockReturnValue(putRequest);

        const updatePromise = database.updateCoreMotivation(
          'motivation-1',
          updates
        );

        setTimeout(() => {
          getRequest.onsuccess(); // First call succeeds
          setTimeout(() => putRequest.onsuccess(), 0); // Then update succeeds
        }, 0);

        const result = await updatePromise;

        expect(result.coreDesire).toBe('Updated desire');
        expect(result.id).toBe('motivation-1'); // Preserved
        expect(result.createdAt).toBe('2024-01-01T00:00:00Z'); // Preserved
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Updated core motivation motivation-1'
        );
      });

      it('should throw error when motivation not found', async () => {
        const getRequest = { onsuccess: null, onerror: null, result: null };
        mockObjectStore.get.mockReturnValue(getRequest);

        const updatePromise = database.updateCoreMotivation('nonexistent', {
          coreDesire: 'New desire',
        });

        setTimeout(() => getRequest.onsuccess(), 0);

        await expect(updatePromise).rejects.toThrow(
          'Core motivation nonexistent not found'
        );
      });

      it('should throw error for missing motivationId', async () => {
        await expect(database.updateCoreMotivation('', {})).rejects.toThrow(
          'updateCoreMotivation: Invalid motivationId'
        );
      });

      it('should throw error for missing updates', async () => {
        await expect(
          database.updateCoreMotivation('motivation-1', null)
        ).rejects.toThrow('Updates are required');
      });

      it('should reject when update write fails', async () => {
        const existingMotivation = {
          id: 'motivation-1',
          directionId: 'direction-1',
          conceptId: 'concept-1',
          coreDesire: 'Original',
          createdAt: '2024-01-01T00:00:00Z',
        };
        const getRequest = {
          onsuccess: null,
          onerror: null,
          result: existingMotivation,
        };
        const putRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: 'Update failure' },
        };
        mockObjectStore.get.mockReturnValue(getRequest);
        mockObjectStore.put.mockReturnValue(putRequest);

        const updatePromise = database.updateCoreMotivation('motivation-1', {
          coreDesire: 'Updated',
        });

        setTimeout(() => {
          getRequest.onsuccess();
          setTimeout(() => putRequest.onerror(), 0);
        }, 0);

        await expect(updatePromise).rejects.toThrow(
          'Failed to update core motivation: Update failure'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to update core motivation:',
          expect.any(Error)
        );
      });

      it('should reject when transaction creation fails', async () => {
        jest
          .spyOn(database, 'getCoreMotivationById')
          .mockResolvedValue({
            id: 'motivation-1',
            createdAt: '2024-01-01T00:00:00Z',
          });
        database.close();

        await expect(
          database.updateCoreMotivation('motivation-1', { coreDesire: 'New' })
        ).rejects.toThrow(
          'CharacterDatabase: Database not initialized. Call initialize() first.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to update core motivation:',
          expect.any(Error)
        );
      });
    });

    describe('deleteAllCoreMotivationsForDirection', () => {
      it('should delete all motivations for a direction', async () => {
        const mockMotivations = [
          { id: 'motivation-1', directionId: 'direction-1' },
          { id: 'motivation-2', directionId: 'direction-1' },
        ];

        // Mock getCoreMotivationsByDirectionId
        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          result: mockMotivations,
        };
        mockIndex.getAll.mockReturnValue(getAllRequest);

        const deleteRequest1 = {
          onsuccess: null,
          onerror: null,
          result: undefined,
        };
        const deleteRequest2 = {
          onsuccess: null,
          onerror: null,
          result: undefined,
        };
        mockObjectStore.delete
          .mockReturnValueOnce(deleteRequest1)
          .mockReturnValueOnce(deleteRequest2);

        const deletePromise =
          database.deleteAllCoreMotivationsForDirection('direction-1');

        setTimeout(() => {
          getAllRequest.onsuccess(); // Get motivations succeeds
          setTimeout(() => {
            deleteRequest1.onsuccess(); // First deletion succeeds
            deleteRequest2.onsuccess(); // Second deletion succeeds
          }, 0);
        }, 0);

        const result = await deletePromise;

        expect(result).toBe(2);
        expect(mockObjectStore.delete).toHaveBeenCalledWith('motivation-1');
        expect(mockObjectStore.delete).toHaveBeenCalledWith('motivation-2');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Deleted 2 motivations for direction direction-1'
        );
      });

      it('should return 0 when no motivations exist for direction', async () => {
        const getAllRequest = { onsuccess: null, onerror: null, result: [] };
        mockIndex.getAll.mockReturnValue(getAllRequest);

        const deletePromise =
          database.deleteAllCoreMotivationsForDirection('direction-1');

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await deletePromise;

        expect(result).toBe(0);
        expect(mockObjectStore.delete).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
          'No motivations to delete for direction direction-1'
        );
      });

      it('should throw error for missing directionId', async () => {
        await expect(
          database.deleteAllCoreMotivationsForDirection('')
        ).rejects.toThrow(
          'deleteAllCoreMotivationsForDirection: Invalid directionId'
        );
      });

      it('should resolve even when some deletions fail', async () => {
        const mockMotivations = [
          { id: 'motivation-1', directionId: 'direction-1' },
          { id: 'motivation-2', directionId: 'direction-1' },
        ];

        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          result: mockMotivations,
        };
        const deleteRequestSuccess = { onsuccess: null, onerror: null };
        const deleteRequestError = {
          onsuccess: null,
          onerror: null,
          error: { message: 'Delete failure' },
        };

        mockIndex.getAll.mockReturnValue(getAllRequest);
        mockObjectStore.delete
          .mockReturnValueOnce(deleteRequestSuccess)
          .mockReturnValueOnce(deleteRequestError);

        const deletePromise =
          database.deleteAllCoreMotivationsForDirection('direction-1');

        setTimeout(() => {
          getAllRequest.onsuccess();
          setTimeout(() => {
            deleteRequestSuccess.onsuccess();
            deleteRequestError.onerror();
          }, 0);
        }, 0);

        const deletedCount = await deletePromise;

        expect(deletedCount).toBe(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to delete motivation motivation-2: Delete failure'
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Deleted 1 motivations for direction direction-1'
        );
      });

      it('should reject when transaction creation fails', async () => {
        jest
          .spyOn(database, 'getCoreMotivationsByDirectionId')
          .mockResolvedValue([{ id: 'motivation-1' }]);
        database.close();

        await expect(
          database.deleteAllCoreMotivationsForDirection('direction-1')
        ).rejects.toThrow(
          'CharacterDatabase: Database not initialized. Call initialize() first.'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to delete all core motivations for direction:',
          expect.any(Error)
        );
      });
    });

    describe('hasCoreMotivationsForDirection', () => {
      it('should return true when motivations exist', async () => {
        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          result: [{ id: 'motivation-1' }],
        };
        mockIndex.getAll.mockReturnValue(getAllRequest);

        const checkPromise =
          database.hasCoreMotivationsForDirection('direction-1');

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await checkPromise;

        expect(result).toBe(true);
      });

      it('should return false when no motivations exist', async () => {
        const getAllRequest = { onsuccess: null, onerror: null, result: [] };
        mockIndex.getAll.mockReturnValue(getAllRequest);

        const checkPromise =
          database.hasCoreMotivationsForDirection('direction-1');

        setTimeout(() => getAllRequest.onsuccess(), 0);
        const result = await checkPromise;

        expect(result).toBe(false);
      });

      it('should return false on error', async () => {
        const getAllRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: 'Error' },
        };
        mockIndex.getAll.mockReturnValue(getAllRequest);

        const checkPromise =
          database.hasCoreMotivationsForDirection('direction-1');

        setTimeout(() => getAllRequest.onerror(), 0);
        const result = await checkPromise;

        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for missing directionId', async () => {
        await expect(
          database.hasCoreMotivationsForDirection('')
        ).rejects.toThrow(
          'hasCoreMotivationsForDirection: Invalid directionId'
        );
      });
    });

    describe('getCoreMotivationsCount', () => {
      it('should return count of motivations for direction', async () => {
        const countRequest = { onsuccess: null, onerror: null, result: 5 };
        mockIndex.count.mockReturnValue(countRequest);

        const countPromise = database.getCoreMotivationsCount('direction-1');

        setTimeout(() => countRequest.onsuccess(), 0);
        const result = await countPromise;

        expect(result).toBe(5);
        expect(mockObjectStore.index).toHaveBeenCalledWith('directionId');
        expect(mockIndex.count).toHaveBeenCalledWith('direction-1');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Direction direction-1 has 5 core motivations'
        );
      });

      it('should return 0 when count is null or undefined', async () => {
        const countRequest = { onsuccess: null, onerror: null, result: null };
        mockIndex.count.mockReturnValue(countRequest);

        const countPromise = database.getCoreMotivationsCount('direction-1');

        setTimeout(() => countRequest.onsuccess(), 0);
        const result = await countPromise;

        expect(result).toBe(0);
      });

      it('should return 0 on error', async () => {
        const countRequest = {
          onsuccess: null,
          onerror: null,
          error: { message: 'Count error' },
        };
        mockIndex.count.mockReturnValue(countRequest);

        const countPromise = database.getCoreMotivationsCount('direction-1');

        setTimeout(() => countRequest.onerror(), 0);
        const result = await countPromise;

        expect(result).toBe(0);
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for missing directionId', async () => {
        await expect(database.getCoreMotivationsCount('')).rejects.toThrow(
          'getCoreMotivationsCount: Invalid directionId'
        );
      });

      it('should resolve to 0 when transaction creation fails', async () => {
        database.close();

        await expect(
          database.getCoreMotivationsCount('direction-1')
        ).resolves.toBe(0);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to get core motivations count:',
          expect.any(Error)
        );
      });
    });
  });
});
