/**
 * @file IndexedDB storage adapter for browser-based key-value storage
 * @see ../actions/tracing/actionTraceOutputService.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * IndexedDB adapter providing key-value storage interface
 * Used for persisting action traces in the browser
 */
export class IndexedDBStorageAdapter {
  #logger;
  #db = null;
  #dbName;
  #dbVersion;
  #storeName;
  #isInitialized = false;
  #initPromise = null;

  /**
   * Constructor
   *
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {string} [dependencies.dbName] - Database name
   * @param {number} [dependencies.dbVersion] - Database version
   * @param {string} [dependencies.storeName] - Object store name
   */
  constructor({
    logger,
    dbName = 'ActionTraces',
    dbVersion = 1,
    storeName = 'traces',
  }) {
    this.#logger = ensureValidLogger(logger, 'IndexedDBStorageAdapter');
    this.#dbName = dbName;
    this.#dbVersion = dbVersion;
    this.#storeName = storeName;
  }

  /**
   * Initialize the IndexedDB database
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#isInitialized) {
      return;
    }

    // Prevent multiple simultaneous initialization attempts
    if (this.#initPromise) {
      return this.#initPromise;
    }

    this.#initPromise = this.#performInitialization();

    try {
      await this.#initPromise;
      this.#isInitialized = true;
    } finally {
      this.#initPromise = null;
    }
  }

  /**
   * Perform the actual database initialization
   *
   * @private
   * @returns {Promise<void>}
   */
  async #performInitialization() {
    return new Promise((resolve, reject) => {
      // Check for IndexedDB support
      if (!window.indexedDB) {
        const error = new Error('IndexedDB is not supported in this browser');
        this.#logger.error('IndexedDBStorageAdapter: IndexedDB not supported');
        reject(error);
        return;
      }

      const request = indexedDB.open(this.#dbName, this.#dbVersion);

      request.onerror = () => {
        const error = new Error(
          `Failed to open IndexedDB: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error(
          'IndexedDBStorageAdapter: Failed to open database',
          error
        );
        reject(error);
      };

      request.onsuccess = () => {
        this.#db = request.result;
        this.#logger.debug(
          'IndexedDBStorageAdapter: Database opened successfully'
        );

        // Handle database close events
        this.#db.onclose = () => {
          this.#logger.warn(
            'IndexedDBStorageAdapter: Database connection closed unexpectedly'
          );
          this.#isInitialized = false;
          this.#db = null;
        };

        resolve();
      };

      request.onupgradeneeded = (event) => {
        this.#logger.info(
          `IndexedDBStorageAdapter: Database upgrade needed from version ${event.oldVersion} to ${event.newVersion}`
        );

        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.#storeName)) {
          const store = db.createObjectStore(this.#storeName, {
            keyPath: 'key',
          });

          // Create index for timestamp queries
          store.createIndex('timestamp', 'timestamp', { unique: false });

          this.#logger.debug(
            `IndexedDBStorageAdapter: Created object store '${this.#storeName}'`
          );
        }
      };
    });
  }

  /**
   * Ensure database is initialized before operations
   *
   * @private
   * @throws {Error} If initialization fails
   */
  async #ensureInitialized() {
    if (!this.#isInitialized) {
      await this.initialize();
    }

    if (!this.#db) {
      throw new Error(
        'IndexedDBStorageAdapter: Database not available after initialization'
      );
    }
  }

  /**
   * Get an item from storage
   *
   * @param {string} key - The key to retrieve
   * @returns {Promise<any>} The stored value or null if not found
   */
  async getItem(key) {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#db.transaction([this.#storeName], 'readonly');
        const store = transaction.objectStore(this.#storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            this.#logger.debug(
              `IndexedDBStorageAdapter: Retrieved item with key '${key}'`
            );
            resolve(result.value);
          } else {
            this.#logger.debug(
              `IndexedDBStorageAdapter: No item found for key '${key}'`
            );
            resolve(null);
          }
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get item: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            `IndexedDBStorageAdapter: Error getting item '${key}'`,
            error
          );
          reject(error);
        };
      } catch (error) {
        this.#logger.error(
          `IndexedDBStorageAdapter: Transaction error for getItem`,
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Set an item in storage
   *
   * @param {string} key - The key to store
   * @param {any} value - The value to store
   * @returns {Promise<void>}
   */
  async setItem(key, value) {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#db.transaction(
          [this.#storeName],
          'readwrite'
        );
        const store = transaction.objectStore(this.#storeName);

        const record = {
          key,
          value,
          timestamp: Date.now(),
        };

        const request = store.put(record);

        request.onsuccess = () => {
          this.#logger.debug(
            `IndexedDBStorageAdapter: Stored item with key '${key}'`
          );
          resolve();
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to set item: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            `IndexedDBStorageAdapter: Error setting item '${key}'`,
            error
          );
          reject(error);
        };

        transaction.onerror = () => {
          const error = new Error(
            `Transaction failed: ${transaction.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            'IndexedDBStorageAdapter: Transaction error',
            error
          );
          reject(error);
        };
      } catch (error) {
        this.#logger.error(
          `IndexedDBStorageAdapter: Transaction error for setItem`,
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Remove an item from storage
   *
   * @param {string} key - The key to remove
   * @returns {Promise<void>}
   */
  async removeItem(key) {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#db.transaction(
          [this.#storeName],
          'readwrite'
        );
        const store = transaction.objectStore(this.#storeName);
        const request = store.delete(key);

        request.onsuccess = () => {
          this.#logger.debug(
            `IndexedDBStorageAdapter: Removed item with key '${key}'`
          );
          resolve();
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to remove item: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            `IndexedDBStorageAdapter: Error removing item '${key}'`,
            error
          );
          reject(error);
        };
      } catch (error) {
        this.#logger.error(
          `IndexedDBStorageAdapter: Transaction error for removeItem`,
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Get all keys from storage
   *
   * @returns {Promise<string[]>} Array of all keys
   */
  async getAllKeys() {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#db.transaction([this.#storeName], 'readonly');
        const store = transaction.objectStore(this.#storeName);
        const request = store.getAllKeys();

        request.onsuccess = () => {
          const keys = request.result || [];
          this.#logger.debug(
            `IndexedDBStorageAdapter: Retrieved ${keys.length} keys`
          );
          resolve(keys);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get keys: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            'IndexedDBStorageAdapter: Error getting all keys',
            error
          );
          reject(error);
        };
      } catch (error) {
        this.#logger.error(
          `IndexedDBStorageAdapter: Transaction error for getAllKeys`,
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Clear all items from storage
   *
   * @returns {Promise<void>}
   */
  async clear() {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#db.transaction(
          [this.#storeName],
          'readwrite'
        );
        const store = transaction.objectStore(this.#storeName);
        const request = store.clear();

        request.onsuccess = () => {
          this.#logger.info(
            'IndexedDBStorageAdapter: Cleared all items from storage'
          );
          resolve();
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to clear storage: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            'IndexedDBStorageAdapter: Error clearing storage',
            error
          );
          reject(error);
        };
      } catch (error) {
        this.#logger.error(
          `IndexedDBStorageAdapter: Transaction error for clear`,
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Get the number of items in storage
   *
   * @returns {Promise<number>} The count of items
   */
  async count() {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#db.transaction([this.#storeName], 'readonly');
        const store = transaction.objectStore(this.#storeName);
        const request = store.count();

        request.onsuccess = () => {
          const count = request.result || 0;
          this.#logger.debug(
            `IndexedDBStorageAdapter: Storage contains ${count} items`
          );
          resolve(count);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to count items: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            'IndexedDBStorageAdapter: Error counting items',
            error
          );
          reject(error);
        };
      } catch (error) {
        this.#logger.error(
          `IndexedDBStorageAdapter: Transaction error for count`,
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
      this.#isInitialized = false;
      this.#logger.debug('IndexedDBStorageAdapter: Database connection closed');
    }
  }

  /**
   * Check if storage is available and working
   *
   * @returns {Promise<boolean>} True if storage is available
   */
  async isAvailable() {
    try {
      await this.#ensureInitialized();
      // Try a simple operation to verify it's working
      const testKey = '__indexeddb_test__';
      await this.setItem(testKey, 'test');
      await this.removeItem(testKey);
      return true;
    } catch (error) {
      this.#logger.warn(
        'IndexedDBStorageAdapter: Storage availability check failed',
        error
      );
      return false;
    }
  }
}

export default IndexedDBStorageAdapter;
