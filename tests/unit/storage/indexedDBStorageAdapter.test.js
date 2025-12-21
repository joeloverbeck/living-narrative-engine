/**
 * @file Unit tests for IndexedDBStorageAdapter
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { IndexedDBStorageAdapter } from '../../../src/storage/indexedDBStorageAdapter.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

// Helper to create a mock IndexedDB request
const createMockRequest = (
  result = undefined,
  shouldFail = false,
  error = null
) => {
  const request = {
    onsuccess: null,
    onerror: null,
    result,
    error,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  };

  // Helper method to trigger success or error
  request._trigger = (success = true) => {
    setTimeout(() => {
      if (success && request.onsuccess) {
        request.onsuccess();
      } else if (!success && request.onerror) {
        request.onerror();
      }
    }, 0);
  };

  return request;
};

// Mock IndexedDB for testing
const createMockIndexedDB = () => {
  const stores = new Map();

  const mockObjectStore = {
    put: jest.fn((value) => createMockRequest(value.key)),
    get: jest.fn((key) => createMockRequest(stores.get(key))),
    delete: jest.fn((key) => createMockRequest(undefined)),
    clear: jest.fn(() => createMockRequest(undefined)),
    getAllKeys: jest.fn(() => createMockRequest(Array.from(stores.keys()))),
    count: jest.fn(() => createMockRequest(stores.size)),
    createIndex: jest.fn(),
  };

  const mockTransaction = {
    objectStore: jest.fn(() => mockObjectStore),
    onerror: null,
    oncomplete: null,
    error: null,
  };

  const mockDB = {
    transaction: jest.fn(() => mockTransaction),
    close: jest.fn(),
    objectStoreNames: {
      contains: jest.fn((name) => name === 'traces'),
    },
    createObjectStore: jest.fn(() => mockObjectStore),
    onclose: null,
  };

  const mockOpenRequest = {
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: mockDB,
    error: null,
  };

  return {
    open: jest.fn(() => mockOpenRequest),
    mockOpenRequest,
    mockDB,
    mockTransaction,
    mockObjectStore,
    stores,
  };
};

describe('IndexedDBStorageAdapter', () => {
  let adapter;
  let mockLogger;
  let mockIndexedDB;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockIndexedDB = createMockIndexedDB();

    // Set up global indexedDB mock - both window.indexedDB and global indexedDB needed
    global.window = { indexedDB: mockIndexedDB };
    global.indexedDB = mockIndexedDB;
  });

  afterEach(() => {
    if (adapter) {
      adapter.close();
    }
    jest.clearAllMocks();
    delete global.window;
    delete global.indexedDB;
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with default configuration', () => {
      adapter = new IndexedDBStorageAdapter({ logger: mockLogger });
      expect(adapter).toBeDefined();
    });

    it('should accept custom database configuration', () => {
      adapter = new IndexedDBStorageAdapter({
        logger: mockLogger,
        dbName: 'CustomDB',
        dbVersion: 2,
        storeName: 'customStore',
      });
      expect(adapter).toBeDefined();
    });

    it('should initialize database successfully', async () => {
      adapter = new IndexedDBStorageAdapter({ logger: mockLogger });

      // Simulate successful database open
      const initPromise = adapter.initialize();
      mockIndexedDB.mockOpenRequest.onsuccess();

      await initPromise;

      expect(mockIndexedDB.open).toHaveBeenCalledWith('ActionTraces', 1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'IndexedDBStorageAdapter: Database opened successfully'
      );
    });

    it('should handle database upgrade', async () => {
      adapter = new IndexedDBStorageAdapter({ logger: mockLogger });

      const initPromise = adapter.initialize();

      // Simulate upgrade needed
      const mockEvent = {
        oldVersion: 0,
        newVersion: 1,
        target: { result: mockIndexedDB.mockDB },
      };

      // Modify mockDB to simulate missing object store
      mockIndexedDB.mockDB.objectStoreNames.contains = jest.fn(() => false);

      mockIndexedDB.mockOpenRequest.onupgradeneeded(mockEvent);
      mockIndexedDB.mockOpenRequest.onsuccess();

      await initPromise;

      expect(mockIndexedDB.mockDB.createObjectStore).toHaveBeenCalledWith(
        'traces',
        {
          keyPath: 'key',
        }
      );
    });

    it('should handle initialization failure', async () => {
      adapter = new IndexedDBStorageAdapter({ logger: mockLogger });

      const initPromise = adapter.initialize();

      // Simulate error
      mockIndexedDB.mockOpenRequest.error = new Error('Database error');
      mockIndexedDB.mockOpenRequest.onerror();

      await expect(initPromise).rejects.toThrow('Failed to open IndexedDB');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle missing IndexedDB support', async () => {
      delete global.window.indexedDB;

      adapter = new IndexedDBStorageAdapter({ logger: mockLogger });

      await expect(adapter.initialize()).rejects.toThrow(
        'IndexedDB is not supported in this browser'
      );
    });

    it('should prevent multiple simultaneous initialization', async () => {
      adapter = new IndexedDBStorageAdapter({ logger: mockLogger });

      const init1 = adapter.initialize();
      const init2 = adapter.initialize();

      mockIndexedDB.mockOpenRequest.onsuccess();

      await Promise.all([init1, init2]);

      // Should only open database once
      expect(mockIndexedDB.open).toHaveBeenCalledTimes(1);
    });

    it('should return early when already initialized', async () => {
      adapter = new IndexedDBStorageAdapter({ logger: mockLogger });

      // First initialization
      const initPromise = adapter.initialize();
      mockIndexedDB.mockOpenRequest.onsuccess();
      await initPromise;

      // Clear mock calls
      jest.clearAllMocks();

      // Second initialization should return early (line 54)
      await adapter.initialize();

      // Should not open database again
      expect(mockIndexedDB.open).not.toHaveBeenCalled();
    });
  });

  describe('Storage Operations', () => {
    beforeEach(async () => {
      adapter = new IndexedDBStorageAdapter({ logger: mockLogger });

      // Initialize the adapter
      const initPromise = adapter.initialize();
      mockIndexedDB.mockOpenRequest.onsuccess();
      await initPromise;

      // Reset the mock call counts for cleaner test assertions
      jest.clearAllMocks();
    });

    describe('setItem', () => {
      it('should store an item successfully', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        // Create a specific mock request for this test
        const mockPutRequest = createMockRequest(key);
        mockIndexedDB.mockObjectStore.put.mockReturnValueOnce(mockPutRequest);

        const setPromise = adapter.setItem(key, value);

        // Trigger the success event
        mockPutRequest._trigger(true);

        await setPromise;

        expect(mockIndexedDB.mockObjectStore.put).toHaveBeenCalledWith({
          key,
          value,
          timestamp: expect.any(Number),
        });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `IndexedDBStorageAdapter: Stored item with key '${key}'`
        );
      });

      it('should handle storage errors', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        // Create a mock request that will fail
        const mockPutRequest = createMockRequest(
          undefined,
          false,
          new Error('Storage error')
        );
        mockIndexedDB.mockObjectStore.put.mockReturnValueOnce(mockPutRequest);

        const setPromise = adapter.setItem(key, value);

        // Trigger the error event
        mockPutRequest._trigger(false);

        await expect(setPromise).rejects.toThrow('Failed to set item');
      });

      it('should handle transaction errors in setItem', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        // Create a custom transaction mock with onerror handler
        const mockTransactionWithError = {
          objectStore: jest.fn(() => mockIndexedDB.mockObjectStore),
          onerror: null,
          oncomplete: null,
          error: new Error('Transaction failed'),
        };

        // Override the transaction method for this test
        mockIndexedDB.mockDB.transaction.mockReturnValueOnce(
          mockTransactionWithError
        );

        // Create a mock request
        const mockPutRequest = createMockRequest(key);
        mockIndexedDB.mockObjectStore.put.mockReturnValueOnce(mockPutRequest);

        const setPromise = adapter.setItem(key, value);

        // Trigger transaction error after a delay to simulate async behavior
        setTimeout(() => {
          if (mockTransactionWithError.onerror) {
            mockTransactionWithError.onerror();
          }
        }, 0);

        await expect(setPromise).rejects.toThrow('Transaction failed');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Transaction error',
          expect.any(Error)
        );
      });

      it('should handle transaction creation error in setItem', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        // Make transaction creation throw
        mockIndexedDB.mockDB.transaction.mockImplementationOnce(() => {
          throw new Error('Transaction creation failed');
        });

        await expect(adapter.setItem(key, value)).rejects.toThrow(
          'Transaction creation failed'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Transaction error for setItem',
          expect.any(Error)
        );
      });
    });

    describe('getItem', () => {
      it('should retrieve an existing item', async () => {
        const key = 'test-key';
        const storedValue = { data: 'test-value' };

        // Create a mock request with stored data
        const mockGetRequest = createMockRequest({
          key,
          value: storedValue,
          timestamp: Date.now(),
        });
        mockIndexedDB.mockObjectStore.get.mockReturnValueOnce(mockGetRequest);

        const getPromise = adapter.getItem(key);

        // Trigger success event
        mockGetRequest._trigger(true);

        const result = await getPromise;

        expect(result).toEqual(storedValue);
        expect(mockIndexedDB.mockObjectStore.get).toHaveBeenCalledWith(key);
      });

      it('should return null for non-existent item', async () => {
        const key = 'non-existent';

        // Create a mock request with null result
        const mockGetRequest = createMockRequest(null);
        mockIndexedDB.mockObjectStore.get.mockReturnValueOnce(mockGetRequest);

        const getPromise = adapter.getItem(key);

        // Trigger success event with null result
        mockGetRequest._trigger(true);

        const result = await getPromise;

        expect(result).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `IndexedDBStorageAdapter: No item found for key '${key}'`
        );
      });

      it('should handle retrieval errors', async () => {
        const key = 'test-key';

        // Create a mock request that will fail
        const mockGetRequest = createMockRequest(
          undefined,
          false,
          new Error('Get error')
        );
        mockIndexedDB.mockObjectStore.get.mockReturnValueOnce(mockGetRequest);

        const getPromise = adapter.getItem(key);

        // Trigger error event
        mockGetRequest._trigger(false);

        await expect(getPromise).rejects.toThrow('Failed to get item');
      });

      it('should handle transaction creation error in getItem', async () => {
        const key = 'test-key';

        // Make transaction creation throw
        mockIndexedDB.mockDB.transaction.mockImplementationOnce(() => {
          throw new Error('Transaction creation failed');
        });

        await expect(adapter.getItem(key)).rejects.toThrow(
          'Transaction creation failed'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Transaction error for getItem',
          expect.any(Error)
        );
      });

      // Skip this test for now as it's complex to simulate the exact null db condition
      // The line 155 check is an edge case safety check that would require internal state manipulation
    });

    describe('removeItem', () => {
      it('should remove an item successfully', async () => {
        const key = 'test-key';

        // Create a mock request for deletion
        const mockDeleteRequest = createMockRequest(undefined);
        mockIndexedDB.mockObjectStore.delete.mockReturnValueOnce(
          mockDeleteRequest
        );

        const removePromise = adapter.removeItem(key);

        // Trigger success event
        mockDeleteRequest._trigger(true);

        await removePromise;

        expect(mockIndexedDB.mockObjectStore.delete).toHaveBeenCalledWith(key);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `IndexedDBStorageAdapter: Removed item with key '${key}'`
        );
      });

      it('should handle removal errors', async () => {
        const key = 'test-key';

        // Create a mock request that will fail
        const mockDeleteRequest = createMockRequest(
          undefined,
          false,
          new Error('Delete error')
        );
        mockIndexedDB.mockObjectStore.delete.mockReturnValueOnce(
          mockDeleteRequest
        );

        const removePromise = adapter.removeItem(key);

        // Trigger error event
        mockDeleteRequest._trigger(false);

        await expect(removePromise).rejects.toThrow('Failed to remove item');
      });

      it('should handle transaction creation error in removeItem', async () => {
        const key = 'test-key';

        // Make transaction creation throw (lines 311-315)
        mockIndexedDB.mockDB.transaction.mockImplementationOnce(() => {
          throw new Error('Transaction creation failed');
        });

        await expect(adapter.removeItem(key)).rejects.toThrow(
          'Transaction creation failed'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Transaction error for removeItem',
          expect.any(Error)
        );
      });
    });

    describe('getAllKeys', () => {
      it('should retrieve all keys', async () => {
        const keys = ['key1', 'key2', 'key3'];

        // Create a mock request with keys
        const mockGetKeysRequest = createMockRequest(keys);
        mockIndexedDB.mockObjectStore.getAllKeys.mockReturnValueOnce(
          mockGetKeysRequest
        );

        const getKeysPromise = adapter.getAllKeys();

        // Trigger success event
        mockGetKeysRequest._trigger(true);

        const result = await getKeysPromise;

        expect(result).toEqual(keys);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `IndexedDBStorageAdapter: Retrieved ${keys.length} keys`
        );
      });

      it('should handle empty storage', async () => {
        // Create a mock request with empty array
        const mockGetKeysRequest = createMockRequest([]);
        mockIndexedDB.mockObjectStore.getAllKeys.mockReturnValueOnce(
          mockGetKeysRequest
        );

        const getKeysPromise = adapter.getAllKeys();

        // Trigger success event
        mockGetKeysRequest._trigger(true);

        const result = await getKeysPromise;

        expect(result).toEqual([]);
      });

      it('should handle getAllKeys errors', async () => {
        // Create a mock request that will fail
        const mockGetKeysRequest = createMockRequest(
          undefined,
          false,
          new Error('GetKeys error')
        );
        mockIndexedDB.mockObjectStore.getAllKeys.mockReturnValueOnce(
          mockGetKeysRequest
        );

        const getKeysPromise = adapter.getAllKeys();

        // Trigger error event
        mockGetKeysRequest._trigger(false);

        await expect(getKeysPromise).rejects.toThrow('Failed to get keys');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Error getting all keys',
          expect.any(Error)
        );
      });

      it('should handle transaction creation error in getAllKeys', async () => {
        // Make transaction creation throw (lines 343-357)
        mockIndexedDB.mockDB.transaction.mockImplementationOnce(() => {
          throw new Error('Transaction creation failed');
        });

        await expect(adapter.getAllKeys()).rejects.toThrow(
          'Transaction creation failed'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Transaction error for getAllKeys',
          expect.any(Error)
        );
      });
    });

    describe('clear', () => {
      it('should clear all items', async () => {
        // Create a mock request for clear operation
        const mockClearRequest = createMockRequest(undefined);
        mockIndexedDB.mockObjectStore.clear.mockReturnValueOnce(
          mockClearRequest
        );

        const clearPromise = adapter.clear();

        // Trigger success event
        mockClearRequest._trigger(true);

        await clearPromise;

        expect(mockIndexedDB.mockObjectStore.clear).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Cleared all items from storage'
        );
      });

      it('should handle clear errors', async () => {
        // Create a mock request that will fail
        const mockClearRequest = createMockRequest(
          undefined,
          false,
          new Error('Clear error')
        );
        mockIndexedDB.mockObjectStore.clear.mockReturnValueOnce(
          mockClearRequest
        );

        const clearPromise = adapter.clear();

        // Trigger error event
        mockClearRequest._trigger(false);

        await expect(clearPromise).rejects.toThrow('Failed to clear storage');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Error clearing storage',
          expect.any(Error)
        );
      });

      it('should handle transaction creation error in clear', async () => {
        // Make transaction creation throw (lines 387-401)
        mockIndexedDB.mockDB.transaction.mockImplementationOnce(() => {
          throw new Error('Transaction creation failed');
        });

        await expect(adapter.clear()).rejects.toThrow(
          'Transaction creation failed'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Transaction error for clear',
          expect.any(Error)
        );
      });
    });

    describe('count', () => {
      it('should return the count of items', async () => {
        const itemCount = 5;

        // Create a mock request with count result
        const mockCountRequest = createMockRequest(itemCount);
        mockIndexedDB.mockObjectStore.count.mockReturnValueOnce(
          mockCountRequest
        );

        const countPromise = adapter.count();

        // Trigger success event
        mockCountRequest._trigger(true);

        const result = await countPromise;

        expect(result).toBe(itemCount);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `IndexedDBStorageAdapter: Storage contains ${itemCount} items`
        );
      });

      it('should handle count errors', async () => {
        // Create a mock request that will fail
        const mockCountRequest = createMockRequest(
          undefined,
          false,
          new Error('Count error')
        );
        mockIndexedDB.mockObjectStore.count.mockReturnValueOnce(
          mockCountRequest
        );

        const countPromise = adapter.count();

        // Trigger error event
        mockCountRequest._trigger(false);

        await expect(countPromise).rejects.toThrow('Failed to count items');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Error counting items',
          expect.any(Error)
        );
      });

      it('should handle transaction creation error in count', async () => {
        // Make transaction creation throw (lines 429-443)
        mockIndexedDB.mockDB.transaction.mockImplementationOnce(() => {
          throw new Error('Transaction creation failed');
        });

        await expect(adapter.count()).rejects.toThrow(
          'Transaction creation failed'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Transaction error for count',
          expect.any(Error)
        );
      });

      it('should return 0 when count result is null', async () => {
        // Create a mock request with null result
        const mockCountRequest = createMockRequest(null);
        mockIndexedDB.mockObjectStore.count.mockReturnValueOnce(
          mockCountRequest
        );

        const countPromise = adapter.count();

        // Trigger success event
        mockCountRequest._trigger(true);

        const result = await countPromise;

        expect(result).toBe(0);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'IndexedDBStorageAdapter: Storage contains 0 items'
        );
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      adapter = new IndexedDBStorageAdapter({ logger: mockLogger });

      const initPromise = adapter.initialize();
      mockIndexedDB.mockOpenRequest.onsuccess();
      await initPromise;
    });

    it('should close the database connection', () => {
      adapter.close();

      expect(mockIndexedDB.mockDB.close).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'IndexedDBStorageAdapter: Database connection closed'
      );
    });

    it('should check availability successfully', async () => {
      // Create mock requests for setItem and removeItem operations
      const mockSetRequest = createMockRequest(undefined);
      const mockRemoveRequest = createMockRequest(undefined);

      // Set up the mocks to return our request objects
      mockIndexedDB.mockObjectStore.put.mockReturnValueOnce(mockSetRequest);
      mockIndexedDB.mockObjectStore.delete.mockReturnValueOnce(
        mockRemoveRequest
      );

      const availabilityPromise = adapter.isAvailable();

      // Trigger successful setItem operation
      mockSetRequest._trigger(true);

      // Trigger successful removeItem operation
      mockRemoveRequest._trigger(true);

      const result = await availabilityPromise;

      expect(result).toBe(true);
    });

    it('should return false when availability check fails', async () => {
      // Create mock request for setItem that will fail
      const mockSetRequest = createMockRequest(
        undefined,
        false,
        new Error('Storage unavailable')
      );

      // Set up the mock to return our failing request object
      mockIndexedDB.mockObjectStore.put.mockReturnValueOnce(mockSetRequest);

      const checkPromise = adapter.isAvailable();

      // Trigger setItem failure
      mockSetRequest._trigger(false);

      const result = await checkPromise;

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'IndexedDBStorageAdapter: Storage availability check failed',
        expect.any(Error)
      );
    });

    it('should handle database close event', async () => {
      // Simulate database close event
      mockIndexedDB.mockDB.onclose();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'IndexedDBStorageAdapter: Database connection closed unexpectedly'
      );

      // Should reinitialize on next operation
      const initPromise = adapter.getItem('test');
      expect(mockIndexedDB.open).toHaveBeenCalledTimes(2); // Once for initial, once for reinit
    });
  });

  describe('Error Handling', () => {
    it('should handle transaction errors', async () => {
      adapter = new IndexedDBStorageAdapter({ logger: mockLogger });

      const initPromise = adapter.initialize();
      mockIndexedDB.mockOpenRequest.onsuccess();
      await initPromise;

      // Make transaction creation throw
      mockIndexedDB.mockDB.transaction.mockImplementation(() => {
        throw new Error('Transaction creation failed');
      });

      await expect(adapter.getItem('test')).rejects.toThrow(
        'Transaction creation failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'IndexedDBStorageAdapter: Transaction error for getItem',
        expect.any(Error)
      );
    });
  });
});
