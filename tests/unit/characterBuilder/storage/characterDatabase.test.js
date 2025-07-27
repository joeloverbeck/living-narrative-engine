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

      expect(mockIndexedDB.open).toHaveBeenCalledWith('CharacterBuilder', 1);
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
      const upgradeEvent = { target: { result: mockDbInstance } };

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
});
