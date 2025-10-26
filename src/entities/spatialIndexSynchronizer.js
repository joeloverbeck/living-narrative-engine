/**
 * @file This module listens to component and entity changes, and ensures that the spatial index is updated.
 * @see src/entities/spatialIndexSynchronizer.js
 */

import { POSITION_COMPONENT_ID } from '../constants/componentIds.js';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
} from '../constants/eventIds.js';

/**
 * @typedef {import('../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} ISpatialIndexManager
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../entities/entity.js').default} Entity
 * @typedef {import('../constants/eventIds.js').EntityCreatedPayload} EntityCreatedPayload
 * @typedef {import('../constants/eventIds.js').EntityRemovedPayload} EntityRemovedPayload
 * @typedef {import('../constants/eventIds.js').ComponentAddedPayload} ComponentAddedPayload
 * @typedef {import('../constants/eventIds.js').ComponentRemovedPayload} ComponentRemovedPayload
 */

/**
 * @description Listens for entity-related events and keeps the spatial index synchronized.
 * @class SpatialIndexSynchronizer
 */
export class SpatialIndexSynchronizer {
  /**
   * Map to track entity positions for removal
   *
   * @private
   * @type {Map<string, string>}
   */
  #entityPositions;

  /**
   * @param {object} dependencies
   * @param {ISpatialIndexManager} dependencies.spatialIndexManager
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher
   * @param {ILogger} dependencies.logger
   */
  /**
   * Initialize the synchronizer with required dependencies.
   *
   * @description Constructor for SpatialIndexSynchronizer.
   * @param {object} dependencies - Constructor dependencies.
   * @param {ISpatialIndexManager} dependencies.spatialIndexManager - Spatial index manager instance.
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher - Event dispatcher.
   * @param {ILogger} dependencies.logger - Logger instance.
   * @param {IEntityManager} [dependencies.entityManager] - Optional entity manager used to bootstrap existing entities.
   */
  constructor({
    spatialIndexManager,
    safeEventDispatcher,
    logger,
    entityManager,
  }) {
    /** @private */
    this.spatialIndex = spatialIndexManager;
    /** @private */
    this.logger = logger;
    /** @private */
    this.#entityPositions = new Map();

    this.#subscribeToEvents(safeEventDispatcher);
    this.#bootstrapExistingEntities(entityManager);

    this.logger.debug(
      'SpatialIndexSynchronizer initialized and listening for events.'
    );
  }

  /**
   * Subscribe to entity lifecycle and component events.
   *
   * @private
   * @param {ISafeEventDispatcher} dispatcher
   */
  #subscribeToEvents(dispatcher) {
    dispatcher.subscribe(ENTITY_CREATED_ID, this.onEntityAdded.bind(this));
    dispatcher.subscribe(ENTITY_REMOVED_ID, this.onEntityRemoved.bind(this));
    dispatcher.subscribe(COMPONENT_ADDED_ID, this.onPositionChanged.bind(this));
    dispatcher.subscribe(
      COMPONENT_REMOVED_ID,
      this.onPositionChanged.bind(this)
    );
  }

  /**
   * Extracts a normalized location id from an entity's position component.
   *
   * @private
   * @param {Entity} entity - Entity to inspect.
   * @returns {string|null} Trimmed location identifier when available.
   */
  #extractLocationId(entity) {
    if (!entity || typeof entity.getComponentData !== 'function') {
      return null;
    }

    const locationId = entity.getComponentData(
      POSITION_COMPONENT_ID
    )?.locationId;
    if (typeof locationId !== 'string') {
      return null;
    }

    const trimmed = locationId.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Seeds the spatial index from entities that already exist when the synchronizer initializes.
   *
   * @private
   * @param {IEntityManager} [entityManager] - Entity manager providing current entities.
   * @returns {void}
   */
  #bootstrapExistingEntities(entityManager) {
    if (!entityManager) {
      this.logger.debug(
        'SpatialIndexSynchronizer: No entity manager provided, skipping bootstrap of existing entities.'
      );
      return;
    }

    const hasIterableEntities =
      entityManager.entities &&
      typeof entityManager.entities[Symbol.iterator] === 'function';
    const canQueryByComponent =
      typeof entityManager.getEntitiesWithComponent === 'function';

    if (!hasIterableEntities && !canQueryByComponent) {
      this.logger.warn(
        'SpatialIndexSynchronizer: Provided entity manager cannot be iterated. Skipping bootstrap.'
      );
      return;
    }

    try {
      let seedSource;
      let shouldManuallyIndex = true;

      if (hasIterableEntities) {
        seedSource = entityManager.entities;
        if (typeof this.spatialIndex?.buildIndex === 'function') {
          this.spatialIndex.buildIndex(entityManager);
          shouldManuallyIndex = false;
        } else if (typeof this.spatialIndex?.clearIndex === 'function') {
          this.spatialIndex.clearIndex();
        }
      } else {
        // By this point `canQueryByComponent` must be true because a falsy value
        // would have triggered the guard clause above and exited early.
        seedSource = entityManager.getEntitiesWithComponent(
          POSITION_COMPONENT_ID
        );
        if (typeof this.spatialIndex?.clearIndex === 'function') {
          this.spatialIndex.clearIndex();
        }
      }

      if (!seedSource || typeof seedSource[Symbol.iterator] !== 'function') {
        this.logger.warn(
          'SpatialIndexSynchronizer: Unable to iterate existing entities during bootstrap.'
        );
        return;
      }

      this.#entityPositions.clear();
      let seededCount = 0;

      for (const entity of seedSource) {
        const entityId = typeof entity?.id === 'string' ? entity.id.trim() : '';
        if (!entityId) {
          continue;
        }

        const locationId = this.#extractLocationId(entity);
        if (!locationId) {
          continue;
        }

        if (shouldManuallyIndex) {
          this.spatialIndex.addEntity(entityId, locationId);
        }

        this.#entityPositions.set(entityId, locationId);
        seededCount += 1;
      }

      this.logger.debug(
        `SpatialIndexSynchronizer: Bootstrapped ${seededCount} existing entities into spatial index.`
      );
    } catch (error) {
      this.logger.error(
        'SpatialIndexSynchronizer: Failed to bootstrap spatial index from existing entities.',
        error
      );
    }
  }

  /**
   * Normalize an event object or payload to just the payload.
   *
   * @description Normalize an event object or payload to just the payload.
   * @private
   * @param {object|{payload: object}} eventOrPayload - Raw payload or event bus object.
   * @returns {object|null} The extracted payload, or null if invalid.
   */
  #normalizePayload(eventOrPayload) {
    const payload = eventOrPayload?.payload ?? eventOrPayload;
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    return payload;
  }

  /**
   * Handle the creation or reconstruction of a new entity.
   *
   * @description Handles the creation or reconstruction of a new entity.
   * @param {EntityCreatedPayload | {type: string, payload: EntityCreatedPayload}} eventOrPayload - Event object or raw payload.
   */
  onEntityAdded(eventOrPayload) {
    const payload = this.#normalizePayload(eventOrPayload);
    if (!payload) {
      this.logger.warn(
        'SpatialIndexSynchronizer.onEntityAdded: Invalid payload received',
        eventOrPayload
      );
      return;
    }

    const { entity } = payload;
    if (!entity) return;
    this.logger.debug(
      `SpatialIndexSynchronizer.onEntityAdded: Received payload with entity:`,
      entity
    );
    this.logger.debug(
      `SpatialIndexSynchronizer.onEntityAdded: Entity type:`,
      typeof entity
    );
    this.logger.debug(
      `SpatialIndexSynchronizer.onEntityAdded: Entity constructor:`,
      entity?.constructor?.name
    );

    const locationId = this.#extractLocationId(entity);
    if (locationId) {
      this.spatialIndex.addEntity(entity.id, locationId);
      this.#entityPositions.set(entity.id, locationId);
      this.logger.debug(
        `SpatialSync: Added ${entity.id} to index at ${locationId}`
      );
    }
  }

  /**
   * Handle the removal of an entity.
   *
   * @description Handles the removal of an entity.
   * @param {EntityRemovedPayload | {type: string, payload: EntityRemovedPayload}} eventOrPayload - Event object or raw payload.
   */
  onEntityRemoved(eventOrPayload) {
    const payload = this.#normalizePayload(eventOrPayload);
    if (!payload) {
      this.logger.warn(
        'SpatialIndexSynchronizer.onEntityRemoved: Invalid payload received',
        eventOrPayload
      );
      return;
    }

    const { instanceId } = payload;
    if (!instanceId) return;

    // Since we no longer have the entity object, we need to track positions separately
    // For now, we'll need to maintain a map of entity positions
    const locationId = this.#entityPositions?.get(instanceId);
    if (locationId) {
      this.spatialIndex.removeEntity(instanceId, locationId);
      this.#entityPositions.delete(instanceId);
      this.logger.debug(
        `SpatialSync: Removed ${instanceId} from index at ${locationId}`
      );
    } else {
      this.logger.debug(
        `SpatialSync: Entity ${instanceId} had no tracked location, skipping removal`
      );
    }
  }

  /**
   * Handle changes to an entity's components, updating the spatial index when position changes.
   *
   * @description Handles changes to an entity's components, updating the spatial index when position changes.
   * @param {ComponentAddedPayload | ComponentRemovedPayload | {type: string, payload: ComponentAddedPayload | ComponentRemovedPayload}} eventOrPayload - Event object or raw payload.
   */
  onPositionChanged(eventOrPayload) {
    const payload = this.#normalizePayload(eventOrPayload);
    if (!payload) {
      this.logger.warn(
        'SpatialIndexSynchronizer.onPositionChanged: Invalid payload received',
        eventOrPayload
      );
      return;
    }

    const { entity, componentTypeId, oldComponentData } = payload;
    // This handler only cares about the position component
    if (componentTypeId !== POSITION_COMPONENT_ID) {
      return;
    }

    // Ensure entity has a valid ID before proceeding
    if (
      !entity ||
      !entity.id ||
      typeof entity.id !== 'string' ||
      entity.id.trim() === ''
    ) {
      this.logger.warn(
        'SpatialIndexSynchronizer.onPositionChanged: Invalid entity ID, skipping position update',
        { entity, componentTypeId }
      );
      return;
    }

    const oldLocationId = oldComponentData?.locationId ?? null;

    // For a 'component_removed' event, 'componentData' will not be in the payload.
    // In that case, the new location is null.
    // For a 'component_added' event, we get the new location from the new data.
    const newLocationId =
      ('componentData' in payload && payload.componentData?.locationId) || null;

    // No need to update the index if the location hasn't effectively changed.
    if (oldLocationId === newLocationId) {
      return;
    }

    this.spatialIndex.updateEntityLocation(
      entity.id,
      oldLocationId,
      newLocationId
    );

    // Update our internal tracking
    if (newLocationId) {
      this.#entityPositions.set(entity.id, newLocationId);
    } else {
      this.#entityPositions.delete(entity.id);
    }

    this.logger.debug(
      `SpatialSync: Re-indexed ${entity.id} from '${oldLocationId}' to '${newLocationId}' due to position change.`
    );
  }
}
