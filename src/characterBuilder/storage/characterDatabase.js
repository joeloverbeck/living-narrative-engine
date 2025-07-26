/**
 * @file IndexedDB wrapper for character builder data storage
 * @see ../services/characterStorageService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {import('../models/characterConcept.js').CharacterConcept} CharacterConcept
 * @typedef {import('../models/thematicDirection.js').ThematicDirection} ThematicDirection
 */

/**
 * Database configuration constants
 */
const DB_NAME = 'CharacterBuilder';
const DB_VERSION = 1;

const STORES = {
  CHARACTER_CONCEPTS: 'characterConcepts',
  THEMATIC_DIRECTIONS: 'thematicDirections',
  METADATA: 'metadata',
};

/**
 * IndexedDB wrapper for character builder storage operations
 */
export class CharacterDatabase {
  #logger;
  #db = null;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#logger = logger;
  }

  /**
   * Initialize the database connection
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#db) {
      this.#logger.debug('CharacterDatabase: Already initialized');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        const error = new Error(
          `Failed to open CharacterBuilder database: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error('CharacterDatabase: Failed to open database', error);
        reject(error);
      };

      request.onsuccess = () => {
        this.#db = request.result;
        this.#logger.info('CharacterDatabase: Successfully opened database');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        this.#logger.info(
          'CharacterDatabase: Database upgrade needed, creating object stores'
        );
        const db = event.target.result;
        this.#createObjectStores(db);
      };
    });
  }

  /**
   * Create object stores for the database
   *
   * @private
   * @param {IDBDatabase} db - Database instance
   */
  #createObjectStores(db) {
    // Create characterConcepts store
    if (!db.objectStoreNames.contains(STORES.CHARACTER_CONCEPTS)) {
      const conceptsStore = db.createObjectStore(STORES.CHARACTER_CONCEPTS, {
        keyPath: 'id',
      });
      conceptsStore.createIndex('status', 'status', { unique: false });
      conceptsStore.createIndex('createdAt', 'createdAt', { unique: false });
      conceptsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      this.#logger.debug(
        'CharacterDatabase: Created characterConcepts object store'
      );
    }

    // Create thematicDirections store
    if (!db.objectStoreNames.contains(STORES.THEMATIC_DIRECTIONS)) {
      const directionsStore = db.createObjectStore(STORES.THEMATIC_DIRECTIONS, {
        keyPath: 'id',
      });
      directionsStore.createIndex('conceptId', 'conceptId', { unique: false });
      directionsStore.createIndex('createdAt', 'createdAt', { unique: false });
      this.#logger.debug(
        'CharacterDatabase: Created thematicDirections object store'
      );
    }

    // Create metadata store
    if (!db.objectStoreNames.contains(STORES.METADATA)) {
      db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
      this.#logger.debug('CharacterDatabase: Created metadata object store');
    }
  }

  /**
   * Close the database connection
   *
   * @returns {void}
   */
  close() {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
      this.#logger.debug('CharacterDatabase: Database connection closed');
    }
  }

  /**
   * Ensure database is initialized
   *
   * @private
   * @throws {Error} If database is not initialized
   */
  #ensureInitialized() {
    if (!this.#db) {
      throw new Error(
        'CharacterDatabase: Database not initialized. Call initialize() first.'
      );
    }
  }

  /**
   * Get a transaction for the specified stores
   *
   * @private
   * @param {string[]} storeNames - Store names to include in transaction
   * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
   * @returns {IDBTransaction}
   */
  #getTransaction(storeNames, mode = 'readonly') {
    this.#ensureInitialized();
    return this.#db.transaction(storeNames, mode);
  }

  /**
   * Save a character concept
   *
   * @param {CharacterConcept} concept - Character concept to save
   * @returns {Promise<CharacterConcept>}
   */
  async saveCharacterConcept(concept) {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction(
        [STORES.CHARACTER_CONCEPTS],
        'readwrite'
      );
      const store = transaction.objectStore(STORES.CHARACTER_CONCEPTS);
      const request = store.put(concept);

      request.onsuccess = () => {
        this.#logger.debug(
          `CharacterDatabase: Saved character concept ${concept.id}`
        );
        resolve(concept);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to save character concept: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error(
          'CharacterDatabase: Error saving character concept',
          error
        );
        reject(error);
      };
    });
  }

  /**
   * Get a character concept by ID
   *
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<CharacterConcept|null>}
   */
  async getCharacterConcept(conceptId) {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction([STORES.CHARACTER_CONCEPTS]);
      const store = transaction.objectStore(STORES.CHARACTER_CONCEPTS);
      const request = store.get(conceptId);

      request.onsuccess = () => {
        const result = request.result || null;
        this.#logger.debug(
          `CharacterDatabase: Retrieved character concept ${conceptId}: ${result ? 'found' : 'not found'}`
        );
        resolve(result);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to get character concept: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error(
          'CharacterDatabase: Error getting character concept',
          error
        );
        reject(error);
      };
    });
  }

  /**
   * Get all character concepts
   *
   * @returns {Promise<CharacterConcept[]>}
   */
  async getAllCharacterConcepts() {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction([STORES.CHARACTER_CONCEPTS]);
      const store = transaction.objectStore(STORES.CHARACTER_CONCEPTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        this.#logger.debug(
          `CharacterDatabase: Retrieved ${results.length} character concepts`
        );
        resolve(results);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to get character concepts: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error(
          'CharacterDatabase: Error getting all character concepts',
          error
        );
        reject(error);
      };
    });
  }

  /**
   * Delete a character concept by ID
   *
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<boolean>}
   */
  async deleteCharacterConcept(conceptId) {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction(
        [STORES.CHARACTER_CONCEPTS, STORES.THEMATIC_DIRECTIONS],
        'readwrite'
      );

      // Delete the concept
      const conceptsStore = transaction.objectStore(STORES.CHARACTER_CONCEPTS);
      const conceptRequest = conceptsStore.delete(conceptId);

      // Delete associated thematic directions
      const directionsStore = transaction.objectStore(
        STORES.THEMATIC_DIRECTIONS
      );
      const directionsIndex = directionsStore.index('conceptId');
      const directionsRequest = directionsIndex.openCursor(
        IDBKeyRange.only(conceptId)
      );

      const directionsToDelete = [];

      directionsRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          directionsToDelete.push(cursor.value.id);
          cursor.continue();
        } else {
          // Delete all found directions
          directionsToDelete.forEach((directionId) => {
            directionsStore.delete(directionId);
          });
        }
      };

      transaction.oncomplete = () => {
        this.#logger.debug(
          `CharacterDatabase: Deleted character concept ${conceptId} and ${directionsToDelete.length} associated directions`
        );
        resolve(true);
      };

      transaction.onerror = () => {
        const error = new Error(
          `Failed to delete character concept: ${transaction.error?.message || 'Unknown error'}`
        );
        this.#logger.error(
          'CharacterDatabase: Error deleting character concept',
          error
        );
        reject(error);
      };
    });
  }

  /**
   * Save thematic directions
   *
   * @param {ThematicDirection[]} directions - Thematic directions to save
   * @returns {Promise<ThematicDirection[]>}
   */
  async saveThematicDirections(directions) {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction(
        [STORES.THEMATIC_DIRECTIONS],
        'readwrite'
      );
      const store = transaction.objectStore(STORES.THEMATIC_DIRECTIONS);

      let completed = 0;
      const results = [];

      if (directions.length === 0) {
        resolve([]);
        return;
      }

      directions.forEach((direction, index) => {
        const request = store.put(direction);

        request.onsuccess = () => {
          results[index] = direction;
          completed++;
          if (completed === directions.length) {
            this.#logger.debug(
              `CharacterDatabase: Saved ${directions.length} thematic directions`
            );
            resolve(results);
          }
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to save thematic direction: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            'CharacterDatabase: Error saving thematic direction',
            error
          );
          reject(error);
        };
      });
    });
  }

  /**
   * Get thematic directions by concept ID
   *
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<ThematicDirection[]>}
   */
  async getThematicDirectionsByConceptId(conceptId) {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction([STORES.THEMATIC_DIRECTIONS]);
      const store = transaction.objectStore(STORES.THEMATIC_DIRECTIONS);
      const index = store.index('conceptId');
      const request = index.getAll(conceptId);

      request.onsuccess = () => {
        const results = request.result || [];
        this.#logger.debug(
          `CharacterDatabase: Retrieved ${results.length} thematic directions for concept ${conceptId}`
        );
        resolve(results);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to get thematic directions: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error(
          'CharacterDatabase: Error getting thematic directions',
          error
        );
        reject(error);
      };
    });
  }

  /**
   * Get all thematic directions
   *
   * @returns {Promise<ThematicDirection[]>}
   */
  async getAllThematicDirections() {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction([STORES.THEMATIC_DIRECTIONS]);
      const store = transaction.objectStore(STORES.THEMATIC_DIRECTIONS);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        this.#logger.debug(
          `CharacterDatabase: Retrieved ${results.length} thematic directions`
        );
        resolve(results);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to get all thematic directions: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error(
          'CharacterDatabase: Error getting all thematic directions',
          error
        );
        reject(error);
      };
    });
  }

  /**
   * Get a single thematic direction by ID
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<ThematicDirection|null>}
   */
  async getThematicDirection(directionId) {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction([STORES.THEMATIC_DIRECTIONS]);
      const store = transaction.objectStore(STORES.THEMATIC_DIRECTIONS);
      const request = store.get(directionId);

      request.onsuccess = () => {
        const result = request.result || null;
        this.#logger.debug(
          `CharacterDatabase: Retrieved thematic direction ${directionId}`,
          { found: !!result }
        );
        resolve(result);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to get thematic direction: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error(
          'CharacterDatabase: Error getting thematic direction',
          error
        );
        reject(error);
      };
    });
  }

  /**
   * Update a thematic direction
   *
   * @param {string} directionId - Direction ID
   * @param {object} updates - Fields to update
   * @returns {Promise<ThematicDirection>}
   */
  async updateThematicDirection(directionId, updates) {
    // First get the existing direction
    const existingDirection = await this.getThematicDirection(directionId);
    if (!existingDirection) {
      throw new Error(`Thematic direction not found: ${directionId}`);
    }

    // Apply updates
    const updatedDirection = {
      ...existingDirection,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Save updated direction
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction([STORES.THEMATIC_DIRECTIONS], 'readwrite');
      const store = transaction.objectStore(STORES.THEMATIC_DIRECTIONS);
      const request = store.put(updatedDirection);

      request.onsuccess = () => {
        this.#logger.info(
          `CharacterDatabase: Successfully updated thematic direction ${directionId}`
        );
        resolve(updatedDirection);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to update thematic direction: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error(
          'CharacterDatabase: Error updating thematic direction',
          error
        );
        reject(error);
      };
    });
  }

  /**
   * Delete a thematic direction
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<boolean>}
   */
  async deleteThematicDirection(directionId) {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction([STORES.THEMATIC_DIRECTIONS], 'readwrite');
      const store = transaction.objectStore(STORES.THEMATIC_DIRECTIONS);
      const request = store.delete(directionId);

      request.onsuccess = () => {
        this.#logger.info(
          `CharacterDatabase: Successfully deleted thematic direction ${directionId}`
        );
        resolve(true);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to delete thematic direction: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error(
          'CharacterDatabase: Error deleting thematic direction',
          error
        );
        reject(error);
      };
    });
  }

  /**
   * Find orphaned thematic directions
   *
   * @returns {Promise<ThematicDirection[]>}
   */
  async findOrphanedDirections() {
    try {
      const allDirections = await this.getAllThematicDirections();
      const orphanedDirections = [];

      for (const direction of allDirections) {
        try {
          const concept = await this.getCharacterConcept(direction.conceptId);
          if (!concept) {
            orphanedDirections.push(direction);
          }
        } catch (error) {
          // If we can't find the concept, it's orphaned
          orphanedDirections.push(direction);
        }
      }

      this.#logger.info(
        `CharacterDatabase: Found ${orphanedDirections.length} orphaned directions`
      );
      return orphanedDirections;
    } catch (error) {
      const errorMessage = `Failed to find orphaned directions: ${error.message}`;
      this.#logger.error('CharacterDatabase: Error finding orphaned directions', error);
      throw new Error(errorMessage);
    }
  }
}
