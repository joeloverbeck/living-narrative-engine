/**
 * @file O(1) socket lookup service for anatomy entities
 * @see src/interfaces/IAnatomySocketIndex.js
 */

import { BaseService } from '../../utils/serviceBase.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/IAnatomySocketIndex.js').IAnatomySocketIndex} IAnatomySocketIndex */

/**
 * Socket information for indexing
 *
 * @typedef {object} SocketInfo
 * @property {string} id - Socket ID
 * @property {string} orientation - Socket orientation
 * @property {string} entityId - Entity that contains this socket
 */

/**
 * Provides O(1) socket lookup and indexing for anatomy entities
 * Optimized for fast socket-to-entity lookups and orientation-based queries
 */
class AnatomySocketIndex extends BaseService {
  #logger;
  #entityManager;
  #bodyGraphService;

  // O(1) lookup indexes with per-root isolation for concurrent safety
  #socketToEntityMap = new Map(); // "${rootEntityId}:${socketId}" -> entityId
  #entityToSocketsMap = new Map(); // "${rootEntityId}:${entityId}" -> SocketInfo[]
  #rootEntityCache = new Map(); // rootEntityId -> Set<entityId>

  constructor({ logger, entityManager, bodyGraphService, cacheCoordinator }) {
    super();

    this.#logger = this._init('AnatomySocketIndex', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'getEntitiesWithComponent'],
      },
      bodyGraphService: {
        value: bodyGraphService,
        requiredMethods: ['getBodyGraph'],
      },
    });

    this.#entityManager = entityManager;
    this.#bodyGraphService = bodyGraphService;

    // Register caches with coordinator if provided
    if (cacheCoordinator) {
      cacheCoordinator.registerCache(
        'anatomySocketIndex:socketToEntity',
        this.#socketToEntityMap
      );
      cacheCoordinator.registerCache(
        'anatomySocketIndex:entityToSockets',
        this.#entityToSocketsMap
      );
      cacheCoordinator.registerCache(
        'anatomySocketIndex:rootEntity',
        this.#rootEntityCache
      );
      this.#logger.debug(
        'Registered AnatomySocketIndex caches with coordinator'
      );
    }
  }

  /**
   * Creates a composite key for socket-to-entity mapping
   * Ensures isolation between different root entity hierarchies
   *
   * @param {string} rootEntityId - Root entity ID
   * @param {string} socketId - Socket ID
   * @returns {string} Composite key
   * @private
   */
  #createSocketKey(rootEntityId, socketId) {
    return `${rootEntityId}:${socketId}`;
  }

  /**
   * Creates a composite key for entity-to-sockets mapping
   * Ensures isolation between different root entity hierarchies
   *
   * @param {string} rootEntityId - Root entity ID
   * @param {string} entityId - Entity ID
   * @returns {string} Composite key
   * @private
   */
  #createEntityKey(rootEntityId, entityId) {
    return `${rootEntityId}:${entityId}`;
  }

  /**
   * Builds or rebuilds the socket index for a root entity
   * This replaces the O(n) traversal in #getEntityAnatomyStructure
   *
   * @param {string} rootEntityId - The root entity to index
   * @returns {Promise<void>}
   */
  async buildIndex(rootEntityId) {
    assertNonBlankString(
      rootEntityId,
      'rootEntityId',
      'AnatomySocketIndex.buildIndex',
      this.#logger
    );

    try {
      // Clear existing index for this root entity
      this.invalidateIndex(rootEntityId);

      // Get all entities in the hierarchy
      const bodyGraph = await this.#bodyGraphService.getBodyGraph(rootEntityId);
      const allPartIds = bodyGraph.getAllPartIds();
      const entitiesToIndex = [rootEntityId, ...allPartIds];

      // Build index with parallel socket collection
      const socketPromises = entitiesToIndex.map((entityId) =>
        this.#collectEntitySockets(entityId)
      );

      const entitySocketResults = await Promise.allSettled(socketPromises);
      const rootEntitySet = new Set(entitiesToIndex);

      // Process results and build indexes with per-root isolation
      for (let i = 0; i < entitySocketResults.length; i++) {
        const result = entitySocketResults[i];
        const entityId = entitiesToIndex[i];

        if (result.status === 'fulfilled' && result.value.length > 0) {
          const sockets = result.value;

          // Update entity-to-sockets mapping with composite key
          const entityKey = this.#createEntityKey(rootEntityId, entityId);
          this.#entityToSocketsMap.set(entityKey, sockets);

          // Update socket-to-entity mapping with composite keys
          for (const socket of sockets) {
            const socketKey = this.#createSocketKey(rootEntityId, socket.id);
            this.#socketToEntityMap.set(socketKey, entityId);
          }
        }
      }

      // Cache the root entity hierarchy
      this.#rootEntityCache.set(rootEntityId, rootEntitySet);

      this.#logger.debug(
        `Built socket index for root entity ${rootEntityId}: ${rootEntitySet.size} entities, ${this.#socketToEntityMap.size} sockets`
      );
    } catch (error) {
      this.#logger.error(
        `Failed to build socket index for root entity ${rootEntityId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Finds the entity that contains a specific socket
   * Provides O(1) lookup replacing the O(n) #findEntityWithSocket method
   *
   * @param {string} rootEntityId - The root entity to search within
   * @param {string} socketId - The socket ID to find
   * @returns {Promise<string|null>} The entity ID that contains the socket, or null if not found
   */
  async findEntityWithSocket(rootEntityId, socketId) {
    assertNonBlankString(
      rootEntityId,
      'rootEntityId',
      'AnatomySocketIndex.findEntityWithSocket',
      this.#logger
    );
    assertNonBlankString(
      socketId,
      'socketId',
      'AnatomySocketIndex.findEntityWithSocket',
      this.#logger
    );

    // Build index if not present
    if (!this.#rootEntityCache.has(rootEntityId)) {
      this.#logger.info(
        `AnatomySocketIndex: Building index for root entity '${rootEntityId}' (first lookup for socket '${socketId}')`
      );
      await this.buildIndex(rootEntityId);
    }

    // Use composite key for lookup
    const socketKey = this.#createSocketKey(rootEntityId, socketId);
    const entityId = this.#socketToEntityMap.get(socketKey);

    this.#logger.debug(
      `AnatomySocketIndex: Lookup for socket '${socketId}' in root '${rootEntityId}': ${entityId ? `found entity '${entityId}'` : 'not found'}`
    );

    // Verify the entity is part of the root entity's hierarchy
    if (entityId && this.#rootEntityCache.get(rootEntityId)?.has(entityId)) {
      return entityId;
    }

    if (entityId) {
      this.#logger.warn(
        `AnatomySocketIndex: Found entity '${entityId}' for socket '${socketId}', but it's not in root entity '${rootEntityId}' hierarchy. This indicates a data integrity issue.`
      );
    }

    return null;
  }

  /**
   * Gets all sockets for a specific entity
   * Note: This method bypasses caching to avoid conflicts with composite key system.
   * Use getEntitiesWithSockets() with buildIndex() for efficient batch operations.
   *
   * @param {string} entityId - The entity to get sockets for
   * @returns {Promise<Array<{id: string, orientation: string}>>} Array of socket objects
   */
  async getEntitySockets(entityId) {
    assertNonBlankString(
      entityId,
      'entityId',
      'AnatomySocketIndex.getEntitySockets',
      this.#logger
    );

    // Directly collect sockets without caching
    // This avoids conflicts with the composite key caching system used by buildIndex()
    const sockets = await this.#collectEntitySockets(entityId);

    return sockets.map((socket) => ({
      id: socket.id,
      orientation: socket.orientation,
    }));
  }

  /**
   * Gets all entities that have sockets within a root entity hierarchy
   *
   * @param {string} rootEntityId - The root entity to search within
   * @returns {Promise<string[]>} Array of entity IDs that have sockets
   */
  async getEntitiesWithSockets(rootEntityId) {
    assertNonBlankString(
      rootEntityId,
      'rootEntityId',
      'AnatomySocketIndex.getEntitiesWithSockets',
      this.#logger
    );

    // Build index if not present
    if (!this.#rootEntityCache.has(rootEntityId)) {
      await this.buildIndex(rootEntityId);
    }

    const rootEntities = this.#rootEntityCache.get(rootEntityId);
    if (!rootEntities) {
      return [];
    }

    // Return entities that have sockets (using composite keys)
    return Array.from(rootEntities).filter((entityId) => {
      const entityKey = this.#createEntityKey(rootEntityId, entityId);
      return this.#entityToSocketsMap.has(entityKey);
    });
  }

  /**
   * Invalidates the index for a specific root entity
   *
   * @param {string} rootEntityId - The root entity to invalidate
   * @returns {void}
   */
  invalidateIndex(rootEntityId) {
    assertNonBlankString(
      rootEntityId,
      'rootEntityId',
      'AnatomySocketIndex.invalidateIndex',
      this.#logger
    );

    const rootEntities = this.#rootEntityCache.get(rootEntityId);
    if (rootEntities) {
      // Remove socket-to-entity mappings for this hierarchy (using composite keys)
      for (const entityId of rootEntities) {
        const entityKey = this.#createEntityKey(rootEntityId, entityId);
        const sockets = this.#entityToSocketsMap.get(entityKey);
        if (sockets) {
          for (const socket of sockets) {
            const socketKey = this.#createSocketKey(rootEntityId, socket.id);
            this.#socketToEntityMap.delete(socketKey);
          }
        }
        this.#entityToSocketsMap.delete(entityKey);
      }

      // Remove root entity cache
      this.#rootEntityCache.delete(rootEntityId);
    }

    this.#logger.debug(
      `Invalidated socket index for root entity ${rootEntityId}`
    );
  }

  /**
   * Clears all cached indexes
   *
   * @returns {void}
   */
  clearCache() {
    this.#socketToEntityMap.clear();
    this.#entityToSocketsMap.clear();
    this.#rootEntityCache.clear();
    this.#logger.debug('Cleared all socket indexes');
  }

  /**
   * Collects socket information for a specific entity
   *
   * @param {string} entityId - The entity to collect sockets from
   * @returns {Promise<SocketInfo[]>} Array of socket information
   * @private
   */
  async #collectEntitySockets(entityId) {
    try {
      const socketsComponent = await this.#entityManager.getComponentData(
        entityId,
        'anatomy:sockets'
      );

      if (!socketsComponent?.sockets) {
        return [];
      }

      return socketsComponent.sockets.map((socket) => ({
        id: socket.id,
        orientation: socket.orientation || 'neutral',
        entityId: entityId,
      }));
    } catch (error) {
      this.#logger.warn(
        `Failed to collect sockets for entity ${entityId}`,
        error
      );
      return [];
    }
  }
}

export default AnatomySocketIndex;
