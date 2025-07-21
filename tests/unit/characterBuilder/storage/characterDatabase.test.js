/**
 * @file Unit tests for CharacterDatabase
 */

import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { CharacterDatabase } from '../../../../src/characterBuilder/storage/characterDatabase.js';

/**
 * @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger
 */

describe('CharacterDatabase', () => {
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {CharacterDatabase} */
  let database;
  /** @type {jest.MockedFunction<any>} */
  let mockIndexedDB;
  /** @type {jest.MockedFunction<any>} */
  let mockIDBRequest;
  /** @type {jest.MockedFunction<any>} */
  let mockIDBDatabase;
  /** @type {jest.MockedFunction<any>} */
  let mockIDBTransaction;
  /** @type {jest.MockedFunction<any>} */
  let mockIDBObjectStore;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock IndexedDB components
    mockIDBObjectStore = {
      add: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      delete: jest.fn(),
      put: jest.fn(),
    };

    mockIDBTransaction = {
      objectStore: jest.fn(() => mockIDBObjectStore),
      oncomplete: null,
      onerror: null,
    };

    mockIDBDatabase = {
      transaction: jest.fn(() => mockIDBTransaction),
      createObjectStore: jest.fn(() => mockIDBObjectStore),
      deleteObjectStore: jest.fn(),
      objectStoreNames: {
        contains: jest.fn(() => false),
      },
      version: 1,
      close: jest.fn(),
    };

    mockIDBRequest = {
      result: mockIDBDatabase,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    mockIndexedDB = {
      open: jest.fn(() => mockIDBRequest),
    };

    // Mock global IndexedDB
    global.indexedDB = mockIndexedDB;

    database = new CharacterDatabase({
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.indexedDB;
  });

  describe('Constructor', () => {
    test('should create instance with valid dependencies', () => {
      expect(database).toBeInstanceOf(CharacterDatabase);
    });

    test('should throw error if logger is invalid', () => {
      expect(() => {
        new CharacterDatabase({
          logger: null,
        });
      }).toThrow('Missing required dependency: ILogger.');
    });
  });

  describe('initialize', () => {
    test('should successfully initialize database', async () => {
      // Mock successful database opening
      setTimeout(() => {
        mockIDBRequest.onsuccess();
      }, 0);

      const initPromise = database.initialize();
      
      await initPromise;

      expect(mockIndexedDB.open).toHaveBeenCalledWith('CharacterBuilderDB', 1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully initialized')
      );
    });

    test('should handle database upgrade', async () => {
      // Mock upgrade needed scenario
      setTimeout(() => {
        if (mockIDBRequest.onupgradeneeded) {
          mockIDBRequest.onupgradeneeded();
        }
        mockIDBRequest.onsuccess();
      }, 0);

      await database.initialize();

      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith(
        'characterConcepts',
        expect.objectContaining({ keyPath: 'id' })
      );
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith(
        'thematicDirections',
        expect.objectContaining({ keyPath: 'id' })
      );
    });

    test('should handle database initialization errors', async () => {
      const dbError = new Error('Database unavailable');
      
      setTimeout(() => {
        mockIDBRequest.error = dbError;
        if (mockIDBRequest.onerror) {
          mockIDBRequest.onerror();
        }
      }, 0);

      await expect(database.initialize()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize database'),
        expect.any(Object)
      );
    });

    test('should not reinitialize if already initialized', async () => {
      // First initialization
      setTimeout(() => {
        mockIDBRequest.onsuccess();
      }, 0);
      await database.initialize();

      // Second initialization attempt
      await database.initialize();

      expect(mockIndexedDB.open).toHaveBeenCalledTimes(1);
    });
  });

  describe('storeConcept', () => {
    const mockConceptData = {
      name: 'Test Hero',
      description: 'A brave adventurer',
      background: 'Noble',
      personality: 'Courageous',
    };

    beforeEach(async () => {
      // Initialize database first
      setTimeout(() => mockIDBRequest.onsuccess(), 0);
      await database.initialize();
    });

    test('should successfully store character concept', async () => {
      const mockStoredConcept = {
        id: 'generated-uuid-123',
        ...mockConceptData,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      };

      // Mock successful transaction
      setTimeout(() => {
        mockIDBTransaction.oncomplete();
      }, 0);

      const result = await database.storeConcept(mockConceptData);

      expect(result).toMatchObject(mockStoredConcept);
      expect(mockIDBDatabase.transaction).toHaveBeenCalledWith(
        ['characterConcepts'],
        'readwrite'
      );
      expect(mockIDBObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining(mockConceptData)
      );
    });

    test('should handle storage errors', async () => {
      const storageError = new Error('Storage failed');
      
      setTimeout(() => {
        mockIDBTransaction.onerror = storageError;
        if (mockIDBTransaction.onerror) {
          mockIDBTransaction.onerror();
        }
      }, 0);

      await expect(database.storeConcept(mockConceptData)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to store character concept'),
        expect.any(Object)
      );
    });

    test('should throw error if not initialized', async () => {
      const uninitializedDb = new CharacterDatabase({ logger: mockLogger });
      
      await expect(uninitializedDb.storeConcept(mockConceptData)).rejects.toThrow();
    });
  });

  describe('retrieveConcept', () => {
    beforeEach(async () => {
      setTimeout(() => mockIDBRequest.onsuccess(), 0);
      await database.initialize();
    });

    test('should successfully retrieve character concept', async () => {
      const conceptId = 'test-concept-123';
      const mockConcept = {
        id: conceptId,
        name: 'Test Hero',
        description: 'A brave adventurer',
      };

      // Mock successful retrieval
      mockIDBObjectStore.get.mockReturnValue({
        onsuccess: null,
        onerror: null,
        result: mockConcept,
      });

      setTimeout(() => {
        const request = mockIDBObjectStore.get.mock.results[0].value;
        request.result = mockConcept;
        if (request.onsuccess) {
          request.onsuccess();
        }
      }, 0);

      const result = await database.retrieveConcept(conceptId);

      expect(result).toEqual(mockConcept);
      expect(mockIDBDatabase.transaction).toHaveBeenCalledWith(
        ['characterConcepts'],
        'readonly'
      );
      expect(mockIDBObjectStore.get).toHaveBeenCalledWith(conceptId);
    });

    test('should return null if concept not found', async () => {
      const conceptId = 'non-existent-concept';

      mockIDBObjectStore.get.mockReturnValue({
        onsuccess: null,
        onerror: null,
        result: undefined,
      });

      setTimeout(() => {
        const request = mockIDBObjectStore.get.mock.results[0].value;
        request.result = undefined;
        if (request.onsuccess) {
          request.onsuccess();
        }
      }, 0);

      const result = await database.retrieveConcept(conceptId);

      expect(result).toBeNull();
    });

    test('should handle retrieval errors', async () => {
      const conceptId = 'test-concept-123';
      const retrievalError = new Error('Retrieval failed');

      mockIDBObjectStore.get.mockReturnValue({
        onsuccess: null,
        onerror: null,
        error: retrievalError,
      });

      setTimeout(() => {
        const request = mockIDBObjectStore.get.mock.results[0].value;
        request.error = retrievalError;
        if (request.onerror) {
          request.onerror();
        }
      }, 0);

      await expect(database.retrieveConcept(conceptId)).rejects.toThrow();
    });
  });

  describe('listConcepts', () => {
    beforeEach(async () => {
      setTimeout(() => mockIDBRequest.onsuccess(), 0);
      await database.initialize();
    });

    test('should successfully list all character concepts', async () => {
      const mockConcepts = [
        {
          id: 'concept-1',
          name: 'Hero One',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'concept-2',
          name: 'Hero Two',
          createdAt: new Date().toISOString(),
        },
      ];

      mockIDBObjectStore.getAll.mockReturnValue({
        onsuccess: null,
        onerror: null,
        result: mockConcepts,
      });

      setTimeout(() => {
        const request = mockIDBObjectStore.getAll.mock.results[0].value;
        request.result = mockConcepts;
        if (request.onsuccess) {
          request.onsuccess();
        }
      }, 0);

      const result = await database.listConcepts();

      expect(result).toEqual(mockConcepts);
      expect(mockIDBObjectStore.getAll).toHaveBeenCalled();
    });

    test('should return empty array if no concepts exist', async () => {
      mockIDBObjectStore.getAll.mockReturnValue({
        onsuccess: null,
        onerror: null,
        result: [],
      });

      setTimeout(() => {
        const request = mockIDBObjectStore.getAll.mock.results[0].value;
        request.result = [];
        if (request.onsuccess) {
          request.onsuccess();
        }
      }, 0);

      const result = await database.listConcepts();

      expect(result).toEqual([]);
    });
  });

  describe('deleteConcept', () => {
    beforeEach(async () => {
      setTimeout(() => mockIDBRequest.onsuccess(), 0);
      await database.initialize();
    });

    test('should successfully delete character concept', async () => {
      const conceptId = 'test-concept-123';

      setTimeout(() => {
        mockIDBTransaction.oncomplete();
      }, 0);

      const result = await database.deleteConcept(conceptId);

      expect(result).toBe(true);
      expect(mockIDBObjectStore.delete).toHaveBeenCalledWith(conceptId);
    });

    test('should handle deletion errors', async () => {
      const conceptId = 'test-concept-123';
      const deletionError = new Error('Deletion failed');

      setTimeout(() => {
        mockIDBTransaction.onerror = deletionError;
        if (mockIDBTransaction.onerror) {
          mockIDBTransaction.onerror();
        }
      }, 0);

      await expect(database.deleteConcept(conceptId)).rejects.toThrow();
    });
  });

  describe('storeDirections', () => {
    const mockDirections = [
      {
        id: 'direction-1',
        conceptId: 'concept-123',
        title: 'Test Direction',
        description: 'A test thematic direction',
      },
    ];

    beforeEach(async () => {
      setTimeout(() => mockIDBRequest.onsuccess(), 0);
      await database.initialize();
    });

    test('should successfully store thematic directions', async () => {
      const conceptId = 'concept-123';

      setTimeout(() => {
        mockIDBTransaction.oncomplete();
      }, 0);

      const result = await database.storeDirections(conceptId, mockDirections);

      expect(result).toEqual(mockDirections);
      expect(mockIDBObjectStore.put).toHaveBeenCalledWith(mockDirections[0]);
    });

    test('should handle storage errors', async () => {
      const conceptId = 'concept-123';
      const storageError = new Error('Storage failed');

      setTimeout(() => {
        mockIDBTransaction.onerror = storageError;
        if (mockIDBTransaction.onerror) {
          mockIDBTransaction.onerror();
        }
      }, 0);

      await expect(
        database.storeDirections(conceptId, mockDirections)
      ).rejects.toThrow();
    });
  });

  describe('retrieveDirections', () => {
    beforeEach(async () => {
      setTimeout(() => mockIDBRequest.onsuccess(), 0);
      await database.initialize();
    });

    test('should successfully retrieve thematic directions', async () => {
      const conceptId = 'concept-123';
      const mockDirections = [
        {
          id: 'direction-1',
          conceptId,
          title: 'Test Direction',
        },
      ];

      mockIDBObjectStore.getAll.mockReturnValue({
        onsuccess: null,
        onerror: null,
        result: mockDirections,
      });

      setTimeout(() => {
        const request = mockIDBObjectStore.getAll.mock.results[0].value;
        request.result = mockDirections;
        if (request.onsuccess) {
          request.onsuccess();
        }
      }, 0);

      const result = await database.retrieveDirections(conceptId);

      expect(result).toEqual(mockDirections);
    });

    test('should return empty array if no directions found', async () => {
      const conceptId = 'concept-123';

      mockIDBObjectStore.getAll.mockReturnValue({
        onsuccess: null,
        onerror: null,
        result: [],
      });

      setTimeout(() => {
        const request = mockIDBObjectStore.getAll.mock.results[0].value;
        request.result = [];
        if (request.onsuccess) {
          request.onsuccess();
        }
      }, 0);

      const result = await database.retrieveDirections(conceptId);

      expect(result).toEqual([]);
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      setTimeout(() => mockIDBRequest.onsuccess(), 0);
      await database.initialize();
    });

    test('should successfully close database connection', async () => {
      await database.close();

      expect(mockIDBDatabase.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterDatabase: Database connection closed'
      );
    });

    test('should handle closing when not initialized', async () => {
      const uninitializedDb = new CharacterDatabase({ logger: mockLogger });
      
      await expect(uninitializedDb.close()).resolves.toBeUndefined();
    });
  });
});