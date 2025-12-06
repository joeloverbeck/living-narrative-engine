/**
 * @file IndexedDB wrapper for character builder data storage
 * @see ../services/characterStorageService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { v4 as uuidv4 } from 'uuid';
import { assertPresent, assertNonBlankString } from '../../utils/index.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {import('../models/characterConcept.js').CharacterConcept} CharacterConcept
 * @typedef {import('../models/thematicDirection.js').ThematicDirection} ThematicDirection
 * @typedef {import('../models/coreMotivation.js').CoreMotivation} CoreMotivation
 */

/**
 * Database configuration constants
 */
const DB_NAME = 'CharacterBuilder';
const DB_VERSION = 3;

const STORES = {
  CHARACTER_CONCEPTS: 'characterConcepts',
  THEMATIC_DIRECTIONS: 'thematicDirections',
  METADATA: 'metadata',
  CLICHES: 'cliches',
  CORE_MOTIVATIONS: 'coreMotivations',
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
        const oldVersion = event.oldVersion;

        // Call existing method for version 1 stores
        if (oldVersion < 1) {
          this.#createObjectStores(db);
        }

        // Add new cliches store for version 2
        if (oldVersion < 2) {
          this.#createClichesStore(db);
        }

        // Add core motivations store for version 3
        if (oldVersion < 3) {
          this.#createCoreMotivationsStore(db);
        }
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
   * Create cliches object store
   *
   * @private
   * @param {IDBDatabase} db - Database instance
   */
  #createClichesStore(db) {
    if (!db.objectStoreNames.contains(STORES.CLICHES)) {
      const store = db.createObjectStore(STORES.CLICHES, {
        keyPath: 'id',
      });

      // Unique index for one-to-one relationship with directions
      store.createIndex('directionId', 'directionId', {
        unique: true,
      });

      // Non-unique index for concept tracking
      store.createIndex('conceptId', 'conceptId', {
        unique: false,
      });

      // Index for chronological queries
      store.createIndex('createdAt', 'createdAt', {
        unique: false,
      });

      // Composite index for concept + direction queries
      store.createIndex('conceptDirection', ['conceptId', 'directionId'], {
        unique: true,
      });

      this.#logger.debug('CharacterDatabase: Created cliches object store');
    }
  }

  /**
   * Create core motivations object store
   *
   * @private
   * @param {IDBDatabase} db - Database instance
   */
  #createCoreMotivationsStore(db) {
    if (!db.objectStoreNames.contains(STORES.CORE_MOTIVATIONS)) {
      const store = db.createObjectStore(STORES.CORE_MOTIVATIONS, {
        keyPath: 'id',
      });

      // Non-unique index for many-to-one relationship with directions
      store.createIndex('directionId', 'directionId', {
        unique: false,
      });

      // Non-unique index for concept tracking
      store.createIndex('conceptId', 'conceptId', {
        unique: false,
      });

      // Index for chronological queries
      store.createIndex('createdAt', 'createdAt', {
        unique: false,
      });

      this.#logger.debug(
        'CharacterDatabase: Created coreMotivations object store'
      );
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
      const _conceptRequest = conceptsStore.delete(conceptId);

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
      const transaction = this.#getTransaction(
        [STORES.THEMATIC_DIRECTIONS],
        'readwrite'
      );
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
      const transaction = this.#getTransaction(
        [STORES.THEMATIC_DIRECTIONS],
        'readwrite'
      );
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
        } catch (_error) {
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
      this.#logger.error(
        'CharacterDatabase: Error finding orphaned directions',
        error
      );
      throw new Error(errorMessage);
    }
  }

  /**
   * Save a cliche
   *
   * @param {object} cliche - Cliche to save
   * @returns {Promise<object>}
   */
  async saveCliche(cliche) {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction([STORES.CLICHES], 'readwrite');
      const store = transaction.objectStore(STORES.CLICHES);
      const request = store.put(cliche);

      request.onsuccess = () => {
        this.#logger.debug(`CharacterDatabase: Saved cliche ${cliche.id}`);
        resolve(cliche);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to save cliche: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error('CharacterDatabase: Error saving cliche', error);
        reject(error);
      };
    });
  }

  /**
   * Get cliche by direction ID
   *
   * @param {string} directionId - Thematic direction ID
   * @returns {Promise<object|null>}
   */
  async getClicheByDirectionId(directionId) {
    this.#logger.debug(
      `DEBUG DB: getClicheByDirectionId called with directionId: ${directionId}`
    );

    return new Promise((resolve, reject) => {
      try {
        this.#logger.debug(`DEBUG DB: Creating transaction for CLICHES store`);

        const transaction = this.#getTransaction([STORES.CLICHES]);
        const store = transaction.objectStore(STORES.CLICHES);

        this.#logger.debug(
          `DEBUG DB: Got cliches store, accessing directionId index`
        );

        const index = store.index('directionId');

        this.#logger.debug(
          `DEBUG DB: Creating index request for directionId: ${directionId}`
        );

        const request = index.get(directionId);

        request.onsuccess = () => {
          const result = request.result || null;
          this.#logger.debug(
            `DEBUG DB: Index query completed for direction ${directionId}: ${result ? 'FOUND' : 'NOT_FOUND'}`
          );

          if (result) {
            this.#logger.debug(
              `DEBUG DB: Found cliche with ID: ${result.id}, conceptId: ${result.conceptId}, directionId: ${result.directionId}`
            );
          } else {
            this.#logger.debug(
              `No cliche found in database for directionId: ${directionId}`
            );
          }

          resolve(result);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get cliche: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            `DEBUG DB: Error in getClicheByDirectionId for ${directionId}:`,
            error
          );
          reject(error);
        };

        transaction.onerror = () => {
          const error = new Error(
            `Transaction failed: ${transaction.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            `DEBUG DB: Transaction error in getClicheByDirectionId for ${directionId}:`,
            error
          );
          reject(error);
        };
      } catch (error) {
        this.#logger.error(
          `DEBUG DB: Exception in getClicheByDirectionId for ${directionId}:`,
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Store migration metadata
   *
   * @param {string} migrationKey - Migration identifier
   * @param {object} migrationData - Migration details
   * @returns {Promise<void>}
   */
  async storeMigrationMetadata(migrationKey, migrationData) {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction([STORES.METADATA], 'readwrite');
      const store = transaction.objectStore(STORES.METADATA);

      const request = store.put({
        key: migrationKey,
        value: {
          ...migrationData,
          migratedAt: new Date().toISOString(),
        },
      });

      request.onsuccess = () => {
        this.#logger.debug(
          `CharacterDatabase: Stored migration metadata for ${migrationKey}`
        );
        resolve();
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to store migration metadata: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error(
          'CharacterDatabase: Error storing migration metadata',
          error
        );
        reject(error);
      };
    });
  }

  /**
   * Verify if cliches store exists
   *
   * @returns {boolean}
   */
  hasClichesStore() {
    this.#ensureInitialized();
    return this.#db.objectStoreNames.contains(STORES.CLICHES);
  }

  /**
   * Add cliche (alias for saveCliche for consistency with workflow spec)
   *
   * @param {object} cliche - Cliche to save
   * @returns {Promise<object>}
   */
  async addCliche(cliche) {
    return this.saveCliche(cliche);
  }

  /**
   * Update an existing cliche
   *
   * @param {string} id - Cliche ID
   * @param {object} updatedData - Updated cliche data
   * @returns {Promise<object>}
   */
  async updateCliche(id, updatedData) {
    if (!id || typeof id !== 'string') {
      throw new Error('Cliche ID is required for update');
    }

    if (!updatedData || typeof updatedData !== 'object') {
      throw new Error('Updated cliche data is required');
    }

    // Ensure the ID matches
    updatedData.id = id;

    // Use saveCliche which uses put() and will update existing records
    return this.saveCliche(updatedData);
  }

  /**
   * Delete a cliché by ID
   *
   * @param {string} clicheId - Cliche ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteCliche(clicheId) {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction([STORES.CLICHES], 'readwrite');
      const store = transaction.objectStore(STORES.CLICHES);
      const request = store.delete(clicheId);

      request.onsuccess = () => {
        this.#logger.debug(
          `CharacterDatabase: Successfully deleted cliche ${clicheId}`
        );
        resolve(true);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to delete cliche: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error('CharacterDatabase: Error deleting cliche', error);
        reject(error);
      };
    });
  }

  /**
   * Add metadata entry
   *
   * @param {object} metadata - Metadata entry with key and value
   * @returns {Promise<void>}
   */
  async addMetadata(metadata) {
    return new Promise((resolve, reject) => {
      const transaction = this.#getTransaction([STORES.METADATA], 'readwrite');
      const store = transaction.objectStore(STORES.METADATA);

      const request = store.put({
        key: metadata.key,
        value: metadata.value,
        timestamp: new Date().toISOString(),
      });

      request.onsuccess = () => {
        this.#logger.debug(
          `CharacterDatabase: Added metadata for ${metadata.key}`
        );
        resolve();
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to add metadata: ${request.error?.message || 'Unknown error'}`
        );
        this.#logger.error('CharacterDatabase: Error adding metadata', error);
        reject(error);
      };
    });
  }

  /**
   * Save a core motivation to the database
   *
   * @param {object} motivation - Core motivation object
   * @returns {Promise<object>} Saved motivation with ID
   */
  async saveCoreMotivation(motivation) {
    assertPresent(motivation, 'Motivation is required');
    assertNonBlankString(
      motivation.directionId,
      'directionId',
      'saveCoreMotivation',
      this.#logger
    );
    assertNonBlankString(
      motivation.conceptId,
      'conceptId',
      'saveCoreMotivation',
      this.#logger
    );
    assertPresent(motivation.coreDesire, 'Core desire is required');

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#getTransaction(
          [STORES.CORE_MOTIVATIONS],
          'readwrite'
        );
        const store = transaction.objectStore(STORES.CORE_MOTIVATIONS);

        // Ensure ID exists
        if (!motivation.id) {
          motivation.id = uuidv4();
        }

        // Ensure timestamp exists
        if (!motivation.createdAt) {
          motivation.createdAt = new Date().toISOString();
        }

        const request = store.put(motivation);

        request.onsuccess = () => {
          this.#logger.info(`Saved core motivation ${motivation.id}`);
          resolve(motivation);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to save core motivation: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error('Failed to save core motivation:', error);
          reject(error);
        };
      } catch (error) {
        this.#logger.error('Failed to save core motivation:', error);
        reject(error);
      }
    });
  }

  /**
   * Save multiple core motivations
   *
   * @param {Array<object>} motivations - Array of motivation objects
   * @returns {Promise<Array<string>>} Array of saved motivation IDs
   */
  async saveCoreMotivations(motivations) {
    assertPresent(motivations, 'Motivations array is required');

    if (!Array.isArray(motivations) || motivations.length === 0) {
      throw new Error('Motivations must be a non-empty array');
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#getTransaction(
          [STORES.CORE_MOTIVATIONS],
          'readwrite'
        );
        const store = transaction.objectStore(STORES.CORE_MOTIVATIONS);

        const savedIds = [];
        let processedCount = 0;

        // Process each motivation
        for (const motivation of motivations) {
          // Ensure ID and timestamp
          if (!motivation.id) {
            motivation.id = uuidv4();
          }
          if (!motivation.createdAt) {
            motivation.createdAt = new Date().toISOString();
          }

          const request = store.put(motivation);

          request.onsuccess = () => {
            savedIds.push(motivation.id);
            processedCount++;

            // Check if all motivations processed
            if (processedCount === motivations.length) {
              this.#logger.info(`Saved ${savedIds.length} core motivations`);
              resolve(savedIds);
            }
          };

          request.onerror = () => {
            this.#logger.warn(
              `Failed to save motivation ${motivation.id}: ${request.error?.message}`
            );
            processedCount++;

            // Continue processing even if some fail
            if (processedCount === motivations.length) {
              this.#logger.info(`Saved ${savedIds.length} core motivations`);
              resolve(savedIds);
            }
          };
        }
      } catch (error) {
        this.#logger.error('Failed to save core motivations:', error);
        reject(error);
      }
    });
  }

  /**
   * Get all core motivations for a direction
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<Array<object>>} Array of motivations
   */
  async getCoreMotivationsByDirectionId(directionId) {
    assertNonBlankString(
      directionId,
      'directionId',
      'getCoreMotivationsByDirectionId',
      this.#logger
    );

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#getTransaction([STORES.CORE_MOTIVATIONS]);
        const store = transaction.objectStore(STORES.CORE_MOTIVATIONS);
        const index = store.index('directionId');
        const request = index.getAll(directionId);

        request.onsuccess = () => {
          const motivations = request.result || [];

          // Sort by creation date (newest first)
          motivations.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB - dateA;
          });

          this.#logger.info(
            `Retrieved ${motivations.length} motivations for direction ${directionId}`
          );

          resolve(motivations);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get core motivations: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            'Failed to get core motivations by direction:',
            error
          );
          reject(error);
        };
      } catch (error) {
        this.#logger.error(
          'Failed to get core motivations by direction:',
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Get all core motivations for a concept
   *
   * @param {string} conceptId - Concept ID
   * @returns {Promise<Array<object>>} Array of motivations
   */
  async getCoreMotivationsByConceptId(conceptId) {
    assertNonBlankString(
      conceptId,
      'conceptId',
      'getCoreMotivationsByConceptId',
      this.#logger
    );

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#getTransaction([STORES.CORE_MOTIVATIONS]);
        const store = transaction.objectStore(STORES.CORE_MOTIVATIONS);
        const index = store.index('conceptId');
        const request = index.getAll(conceptId);

        request.onsuccess = () => {
          const motivations = request.result || [];

          // Sort by creation date (newest first)
          motivations.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB - dateA;
          });

          this.#logger.info(
            `Retrieved ${motivations.length} motivations for concept ${conceptId}`
          );

          resolve(motivations);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get core motivations: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error(
            'Failed to get core motivations by concept:',
            error
          );
          reject(error);
        };
      } catch (error) {
        this.#logger.error('Failed to get core motivations by concept:', error);
        reject(error);
      }
    });
  }

  /**
   * Get a single core motivation by ID
   *
   * @param {string} motivationId - Motivation ID
   * @returns {Promise<object | null>} Motivation object or null
   */
  async getCoreMotivationById(motivationId) {
    assertNonBlankString(
      motivationId,
      'motivationId',
      'getCoreMotivationById',
      this.#logger
    );

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#getTransaction([STORES.CORE_MOTIVATIONS]);
        const store = transaction.objectStore(STORES.CORE_MOTIVATIONS);
        const request = store.get(motivationId);

        request.onsuccess = () => {
          const motivation = request.result || null;

          if (motivation) {
            this.#logger.info(`Retrieved core motivation ${motivationId}`);
          } else {
            this.#logger.warn(`Core motivation ${motivationId} not found`);
          }

          resolve(motivation);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get core motivation: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error('Failed to get core motivation by ID:', error);
          reject(error);
        };
      } catch (error) {
        this.#logger.error('Failed to get core motivation by ID:', error);
        reject(error);
      }
    });
  }

  /**
   * Delete a core motivation
   *
   * @param {string} motivationId - Motivation ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteCoreMotivation(motivationId) {
    assertNonBlankString(
      motivationId,
      'motivationId',
      'deleteCoreMotivation',
      this.#logger
    );

    // First get motivation details before deletion for logging
    const motivation = await this.getCoreMotivationById(motivationId);

    if (!motivation) {
      this.#logger.warn(
        `Cannot delete non-existent motivation ${motivationId}`
      );
      return false;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#getTransaction(
          [STORES.CORE_MOTIVATIONS],
          'readwrite'
        );
        const store = transaction.objectStore(STORES.CORE_MOTIVATIONS);
        const request = store.delete(motivationId);

        request.onsuccess = () => {
          this.#logger.info(`Deleted core motivation ${motivationId}`);
          resolve(true);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to delete core motivation: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error('Failed to delete core motivation:', error);
          reject(error);
        };
      } catch (error) {
        this.#logger.error('Failed to delete core motivation:', error);
        reject(error);
      }
    });
  }

  /**
   * Update a core motivation
   *
   * @param {string} motivationId - Motivation ID
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated motivation
   */
  async updateCoreMotivation(motivationId, updates) {
    assertNonBlankString(
      motivationId,
      'motivationId',
      'updateCoreMotivation',
      this.#logger
    );
    assertPresent(updates, 'Updates are required');

    // First get the existing motivation
    const existing = await this.getCoreMotivationById(motivationId);

    if (!existing) {
      throw new Error(`Core motivation ${motivationId} not found`);
    }

    // Merge updates
    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation date
    };

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#getTransaction(
          [STORES.CORE_MOTIVATIONS],
          'readwrite'
        );
        const store = transaction.objectStore(STORES.CORE_MOTIVATIONS);
        const request = store.put(updated);

        request.onsuccess = () => {
          this.#logger.info(`Updated core motivation ${motivationId}`);
          resolve(updated);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to update core motivation: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error('Failed to update core motivation:', error);
          reject(error);
        };
      } catch (error) {
        this.#logger.error('Failed to update core motivation:', error);
        reject(error);
      }
    });
  }

  /**
   * Delete all core motivations for a direction
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<number>} Number of deleted motivations
   */
  async deleteAllCoreMotivationsForDirection(directionId) {
    assertNonBlankString(
      directionId,
      'directionId',
      'deleteAllCoreMotivationsForDirection',
      this.#logger
    );

    // Get all motivations for this direction first
    const motivations = await this.getCoreMotivationsByDirectionId(directionId);

    if (motivations.length === 0) {
      this.#logger.info(
        `No motivations to delete for direction ${directionId}`
      );
      return 0;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#getTransaction(
          [STORES.CORE_MOTIVATIONS],
          'readwrite'
        );
        const store = transaction.objectStore(STORES.CORE_MOTIVATIONS);
        let deletedCount = 0;
        let processedCount = 0;

        // Delete each motivation
        for (const motivation of motivations) {
          const request = store.delete(motivation.id);

          request.onsuccess = () => {
            deletedCount++;
            processedCount++;

            if (processedCount === motivations.length) {
              this.#logger.info(
                `Deleted ${deletedCount} motivations for direction ${directionId}`
              );
              resolve(deletedCount);
            }
          };

          request.onerror = () => {
            this.#logger.warn(
              `Failed to delete motivation ${motivation.id}: ${request.error?.message}`
            );
            processedCount++;

            if (processedCount === motivations.length) {
              this.#logger.info(
                `Deleted ${deletedCount} motivations for direction ${directionId}`
              );
              resolve(deletedCount);
            }
          };
        }
      } catch (error) {
        this.#logger.error(
          'Failed to delete all core motivations for direction:',
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Check if a direction has any core motivations
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<boolean>} True if motivations exist
   */
  async hasCoreMotivationsForDirection(directionId) {
    assertNonBlankString(
      directionId,
      'directionId',
      'hasCoreMotivationsForDirection',
      this.#logger
    );

    try {
      const motivations =
        await this.getCoreMotivationsByDirectionId(directionId);
      return motivations.length > 0;
    } catch (error) {
      this.#logger.error('Failed to check core motivations existence:', error);
      return false;
    }
  }

  /**
   * Get count of core motivations for a direction
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<number>} Count of motivations
   */
  async getCoreMotivationsCount(directionId) {
    assertNonBlankString(
      directionId,
      'directionId',
      'getCoreMotivationsCount',
      this.#logger
    );

    return new Promise((resolve, _reject) => {
      try {
        const transaction = this.#getTransaction([STORES.CORE_MOTIVATIONS]);
        const store = transaction.objectStore(STORES.CORE_MOTIVATIONS);
        const index = store.index('directionId');
        const request = index.count(directionId);

        request.onsuccess = () => {
          const count = request.result || 0;

          this.#logger.info(
            `Direction ${directionId} has ${count} core motivations`
          );

          resolve(count);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get core motivations count: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error('Failed to get core motivations count:', error);
          // Return 0 on error as fallback
          resolve(0);
        };
      } catch (error) {
        this.#logger.error('Failed to get core motivations count:', error);
        resolve(0);
      }
    });
  }

  /**
   * DEBUG METHOD: Dump all clichés in the database
   *
   * @returns {Promise<Array>} All clichés with their details
   */
  async debugDumpAllCliches() {
    this.#logger.debug('DEBUG DB: Starting to dump all clichés...');

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#getTransaction([STORES.CLICHES]);
        const store = transaction.objectStore(STORES.CLICHES);
        const request = store.getAll();

        request.onsuccess = () => {
          const cliches = request.result || [];
          this.#logger.debug(
            `DEBUG DB: Found ${cliches.length} total clichés in database`
          );

          cliches.forEach((cliche, index) => {
            this.#logger.debug(
              `DEBUG DB: Cliche ${index + 1}: ID=${cliche.id}, conceptId=${cliche.conceptId}, directionId=${cliche.directionId}, title="${cliche.title || 'N/A'}"`
            );
          });

          resolve(cliches);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to dump clichés: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error('DEBUG DB: Error dumping clichés:', error);
          reject(error);
        };
      } catch (error) {
        this.#logger.error('DEBUG DB: Exception dumping clichés:', error);
        reject(error);
      }
    });
  }

  /**
   * DEBUG METHOD: Dump all thematic directions in the database
   *
   * @returns {Promise<Array>} All thematic directions with their details
   */
  async debugDumpAllThematicDirections() {
    this.#logger.debug('DEBUG DB: Starting to dump all thematic directions...');

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#getTransaction([STORES.THEMATIC_DIRECTIONS]);
        const store = transaction.objectStore(STORES.THEMATIC_DIRECTIONS);
        const request = store.getAll();

        request.onsuccess = () => {
          const directions = request.result || [];
          this.#logger.debug(
            `DEBUG DB: Found ${directions.length} total thematic directions in database`
          );

          directions.forEach((direction, index) => {
            this.#logger.debug(
              `DEBUG DB: Direction ${index + 1}: ID=${direction.id}, conceptId=${direction.conceptId}, title="${direction.title || 'N/A'}"`
            );
          });

          resolve(directions);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to dump directions: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error('DEBUG DB: Error dumping directions:', error);
          reject(error);
        };
      } catch (error) {
        this.#logger.error('DEBUG DB: Exception dumping directions:', error);
        reject(error);
      }
    });
  }

  /**
   * DEBUG METHOD: Dump all character concepts in the database
   *
   * @returns {Promise<Array>} All character concepts with their details
   */
  async debugDumpAllCharacterConcepts() {
    this.#logger.debug('DEBUG DB: Starting to dump all character concepts...');

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#getTransaction([STORES.CHARACTER_CONCEPTS]);
        const store = transaction.objectStore(STORES.CHARACTER_CONCEPTS);
        const request = store.getAll();

        request.onsuccess = () => {
          const concepts = request.result || [];
          this.#logger.debug(
            `DEBUG DB: Found ${concepts.length} total character concepts in database`
          );

          concepts.forEach((concept, index) => {
            this.#logger.debug(
              `DEBUG DB: Concept ${index + 1}: ID=${concept.id}, status=${concept.status}, createdAt=${concept.createdAt}`
            );
          });

          resolve(concepts);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to dump concepts: ${request.error?.message || 'Unknown error'}`
          );
          this.#logger.error('DEBUG DB: Error dumping concepts:', error);
          reject(error);
        };
      } catch (error) {
        this.#logger.error('DEBUG DB: Exception dumping concepts:', error);
        reject(error);
      }
    });
  }
}
