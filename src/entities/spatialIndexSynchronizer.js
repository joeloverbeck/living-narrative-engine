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
   * @param {object} dependencies
   * @param {ISpatialIndexManager} dependencies.spatialIndexManager
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher
   * @param {ILogger} dependencies.logger
   */
  constructor({ spatialIndexManager, safeEventDispatcher, logger }) {
    /** @private */
    this.spatialIndex = spatialIndexManager;
    /** @private */
    this.logger = logger;

    safeEventDispatcher.subscribe(
      ENTITY_CREATED_ID,
      this.onEntityAdded.bind(this)
    );
    safeEventDispatcher.subscribe(
      ENTITY_REMOVED_ID,
      this.onEntityRemoved.bind(this)
    );
    safeEventDispatcher.subscribe(
      COMPONENT_ADDED_ID,
      this.onComponentChanged.bind(this)
    );
    safeEventDispatcher.subscribe(
      COMPONENT_REMOVED_ID,
      this.onComponentChanged.bind(this)
    );

    this.logger.debug(
      'SpatialIndexSynchronizer initialized and listening for events.'
    );
  }

  /**
   * Handles the creation or reconstruction of a new entity.
   * @param {EntityCreatedPayload} payload
   */
  onEntityAdded({ entity }) {
    const position = entity.getComponentData(POSITION_COMPONENT_ID);
    if (position?.locationId) {
      this.spatialIndex.addEntity(entity.id, position.locationId);
      this.logger.debug(
        `SpatialSync: Added ${entity.id} to index at ${position.locationId}`
      );
    }
  }

  /**
   * Handles the removal of an entity.
   * @param {EntityRemovedPayload} payload
   */
  onEntityRemoved({ entity }) {
    const position = entity.getComponentData(POSITION_COMPONENT_ID);
    // We must remove the entity from its last known location
    if (position?.locationId) {
      this.spatialIndex.removeEntity(entity.id, position.locationId);
      this.logger.debug(
        `SpatialSync: Removed ${entity.id} from index at ${position.locationId}`
      );
    }
  }

  /**
   * Handles changes to an entity's components, specifically looking for position changes.
   * This now correctly uses the old and new component data to update the index.
   * @param {ComponentAddedPayload | ComponentRemovedPayload} payload
   */
  onComponentChanged(payload) {
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
    this.logger.debug(
      `SpatialSync: Re-indexed ${entity.id} from '${oldLocationId}' to '${newLocationId}' due to position change.`
    );
  }
}
