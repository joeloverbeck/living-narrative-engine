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
   */
  constructor({ spatialIndexManager, safeEventDispatcher, logger }) {
    /** @private */
    this.spatialIndex = spatialIndexManager;
    /** @private */
    this.logger = logger;
    /** @private */
    this.#entityPositions = new Map();

    this.#subscribeToEvents(safeEventDispatcher);

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

    const position = entity.getComponentData(POSITION_COMPONENT_ID);
    if (position?.locationId) {
      this.spatialIndex.addEntity(entity.id, position.locationId);
      this.#entityPositions.set(entity.id, position.locationId);
      this.logger.debug(
        `SpatialSync: Added ${entity.id} to index at ${position.locationId}`
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
