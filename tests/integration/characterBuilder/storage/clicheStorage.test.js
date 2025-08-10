/**
 * @file Integration tests for Cliche storage functionality
 * @see src/characterBuilder/storage/characterDatabase.js
 * @see src/characterBuilder/models/cliche.js
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
import { Cliche } from '../../../../src/characterBuilder/models/cliche.js';

describe('Cliche Storage Integration', () => {
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
    };

    // Create mock object store
    mockObjectStore = {
      put: jest.fn(),
      get: jest.fn(),
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

    // Create database instance
    db = new CharacterDatabase({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.indexedDB;
    if (db) {
      db.close();
    }
  });

  describe('Database Initialization', () => {
    it('should create cliches store on version upgrade', async () => {
      // Setup for upgrade scenario
      const initPromise = db.initialize();

      // Simulate upgrade needed event
      mockRequest.onupgradeneeded({
        target: { result: mockDbInstance },
        oldVersion: 1,
      });

      // Mock store doesn't exist yet
      mockDbInstance.objectStoreNames.contains.mockReturnValue(false);

      // Verify store creation was attempted
      expect(mockDbInstance.createObjectStore).toHaveBeenCalledWith('cliches', {
        keyPath: 'id',
      });

      // Verify indexes were created
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith(
        'directionId',
        'directionId',
        { unique: true }
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
      expect(mockObjectStore.createIndex).toHaveBeenCalledWith(
        'conceptDirection',
        ['conceptId', 'directionId'],
        { unique: true }
      );

      // Simulate success
      mockRequest.result = mockDbInstance;
      mockRequest.onsuccess();

      await initPromise;
    });

    it('should not recreate cliches store if it already exists', async () => {
      // Mock store already exists for cliches, but not for others
      mockDbInstance.objectStoreNames.contains.mockImplementation(
        (storeName) => {
          return storeName === 'cliches';
        }
      );

      const initPromise = db.initialize();

      // Simulate upgrade needed event
      mockRequest.onupgradeneeded({
        target: { result: mockDbInstance },
        oldVersion: 1,
      });

      // Verify store creation was NOT attempted for cliches
      expect(mockDbInstance.createObjectStore).not.toHaveBeenCalledWith(
        'cliches',
        expect.any(Object)
      );

      // Simulate success
      mockRequest.result = mockDbInstance;
      mockRequest.onsuccess();

      await initPromise;
    });
  });

  describe('Store Operations', () => {
    beforeEach(async () => {
      // Initialize database
      const initPromise = db.initialize();
      mockRequest.result = mockDbInstance;
      mockRequest.onsuccess();
      await initPromise;

      // Setup store existence check
      mockDbInstance.objectStoreNames.contains.mockReturnValue(true);
    });

    it('should save and retrieve cliche', async () => {
      const cliche = new Cliche({
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: {
          names: ['Test Name'],
          physicalDescriptions: [],
          personalityTraits: [],
          skillsAbilities: [],
          typicalLikes: [],
          typicalDislikes: [],
          commonFears: [],
          genericGoals: [],
          backgroundElements: [],
          overusedSecrets: [],
          speechPatterns: [],
        },
      });

      // Mock save operation
      const saveRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(saveRequest);

      const savePromise = db.saveCliche(cliche.toJSON());

      // Simulate success
      saveRequest.onsuccess();

      const saved = await savePromise;
      expect(saved).toEqual(cliche.toJSON());
      expect(mockObjectStore.put).toHaveBeenCalledWith(cliche.toJSON());
    });

    it('should retrieve cliche by direction ID', async () => {
      const mockCliche = {
        id: 'cliche-1',
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: {
          names: ['Test'],
        },
      };

      // Mock get operation
      const getRequest = {
        result: mockCliche,
        onsuccess: null,
        onerror: null,
      };
      mockIndex.get.mockReturnValue(getRequest);

      const getPromise = db.getClicheByDirectionId('dir-1');

      // Simulate success
      getRequest.onsuccess();

      const retrieved = await getPromise;
      expect(retrieved).toEqual(mockCliche);
      expect(mockIndex.get).toHaveBeenCalledWith('dir-1');
    });

    it('should return null for non-existent cliche', async () => {
      // Mock get operation with no result
      const getRequest = {
        result: undefined,
        onsuccess: null,
        onerror: null,
      };
      mockIndex.get.mockReturnValue(getRequest);

      const getPromise = db.getClicheByDirectionId('non-existent');

      // Simulate success with no result
      getRequest.onsuccess();

      const retrieved = await getPromise;
      expect(retrieved).toBeNull();
    });

    it('should handle save errors gracefully', async () => {
      const cliche = new Cliche({
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: {},
      });

      // Mock save operation with error
      const saveRequest = {
        error: { message: 'Save failed' },
        onsuccess: null,
        onerror: null,
      };
      mockObjectStore.put.mockReturnValue(saveRequest);

      const savePromise = db.saveCliche(cliche.toJSON());

      // Simulate error
      saveRequest.onerror();

      await expect(savePromise).rejects.toThrow('Failed to save cliche');
    });

    it('should handle retrieval errors gracefully', async () => {
      // Mock get operation with error
      const getRequest = {
        error: { message: 'Get failed' },
        onsuccess: null,
        onerror: null,
      };
      mockIndex.get.mockReturnValue(getRequest);

      const getPromise = db.getClicheByDirectionId('dir-1');

      // Simulate error
      getRequest.onerror();

      await expect(getPromise).rejects.toThrow('Failed to get cliche');
    });
  });

  describe('Index Queries', () => {
    beforeEach(async () => {
      // Initialize database
      const initPromise = db.initialize();
      mockRequest.result = mockDbInstance;
      mockRequest.onsuccess();
      await initPromise;
    });

    it('should verify cliches store exists', () => {
      mockDbInstance.objectStoreNames.contains.mockReturnValue(true);
      expect(db.hasClichesStore()).toBe(true);
    });

    it('should verify cliches store does not exist', () => {
      mockDbInstance.objectStoreNames.contains.mockReturnValue(false);
      expect(db.hasClichesStore()).toBe(false);
    });

    it('should throw error if checking store before initialization', () => {
      const uninitializedDb = new CharacterDatabase({ logger: mockLogger });
      expect(() => uninitializedDb.hasClichesStore()).toThrow(
        'Database not initialized'
      );
    });
  });

  describe('Migration Metadata', () => {
    beforeEach(async () => {
      // Initialize database
      const initPromise = db.initialize();
      mockRequest.result = mockDbInstance;
      mockRequest.onsuccess();
      await initPromise;
    });

    it('should store migration metadata', async () => {
      const migrationData = {
        version: 2,
        description: 'Added cliches store',
      };

      // Mock put operation
      const putRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(putRequest);

      const storePromise = db.storeMigrationMetadata(
        'cliches_migration',
        migrationData
      );

      // Simulate success
      putRequest.onsuccess();

      await storePromise;

      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'cliches_migration',
          value: expect.objectContaining({
            version: 2,
            description: 'Added cliches store',
            migratedAt: expect.any(String),
          }),
        })
      );
    });

    it('should handle migration metadata storage errors', async () => {
      // Mock put operation with error
      const putRequest = {
        error: { message: 'Storage failed' },
        onsuccess: null,
        onerror: null,
      };
      mockObjectStore.put.mockReturnValue(putRequest);

      const storePromise = db.storeMigrationMetadata('migration_1', {});

      // Simulate error
      putRequest.onerror();

      await expect(storePromise).rejects.toThrow(
        'Failed to store migration metadata'
      );
    });
  });

  describe('Unique Constraint Enforcement', () => {
    beforeEach(async () => {
      // Initialize database
      const initPromise = db.initialize();
      mockRequest.result = mockDbInstance;
      mockRequest.onsuccess();
      await initPromise;
    });

    it('should simulate unique directionId constraint', async () => {
      const cliche1 = new Cliche({
        id: 'cliche-1',
        directionId: 'dir-1',
        conceptId: 'concept-1',
        categories: {},
      });

      const cliche2 = new Cliche({
        id: 'cliche-2',
        directionId: 'dir-1', // Same direction ID
        conceptId: 'concept-2',
        categories: {},
      });

      // Mock first save - success
      const saveRequest1 = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValueOnce(saveRequest1);

      const savePromise1 = db.saveCliche(cliche1.toJSON());
      saveRequest1.onsuccess();
      await savePromise1;

      // Mock second save - constraint error
      const saveRequest2 = {
        error: { message: 'ConstraintError' },
        onsuccess: null,
        onerror: null,
      };
      mockObjectStore.put.mockReturnValueOnce(saveRequest2);

      const savePromise2 = db.saveCliche(cliche2.toJSON());
      saveRequest2.onerror();

      await expect(savePromise2).rejects.toThrow();
    });
  });
});
