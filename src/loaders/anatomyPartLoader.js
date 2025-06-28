// src/loaders/anatomyPartLoader.js

import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';
import { parseAndValidateId } from '../utils/idUtils.js';

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads anatomy part definitions from mods.
 * Parts are entity definitions with anatomy-specific components and sockets.
 *
 * @augments BaseManifestItemLoader
 */
class AnatomyPartLoader extends BaseManifestItemLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'anatomyParts',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched anatomy part file's data.
   * Note: Anatomy parts are now regular entity definitions and are loaded by EntityLoader.
   * This loader exists only for backward compatibility and will skip processing.
   *
   * @override
   * @protected
   * @param {string} modId
   * @param {string} filename
   * @param {string} resolvedPath
   * @param {any} data
   * @param {string} registryKey
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>}
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    this._logger.debug(
      `AnatomyPartLoader [${modId}]: Skipping ${filename} - anatomy parts are now loaded as entity definitions`
    );

    // Anatomy parts are now regular entity definitions and are handled by EntityLoader
    // This loader exists only for backward compatibility
    // Return a dummy result to satisfy the interface
    return {
      qualifiedId: `${modId}:skipped_${filename}`,
      didOverride: false,
    };
  }

  /**
   * Transforms an anatomy part definition into a standard entity definition
   *
   * @param partData
   * @param modId
   * @param filename
   * @private
   */
  _transformToEntityDefinition(partData, modId, filename) {
    // Convert components array to components object
    const componentsObject = {};

    if (partData.components && Array.isArray(partData.components)) {
      for (const component of partData.components) {
        if (!component.type) {
          throw new Error(
            `Invalid component in anatomy part '${filename}' from mod '${modId}'. Missing 'type' field.`
          );
        }

        // Extract the component data (everything except 'type')
        const { type, ...componentData } = component;
        componentsObject[type] = componentData;
      }
    }

    // Add tag components
    if (partData.tags && Array.isArray(partData.tags)) {
      for (const tag of partData.tags) {
        // Tags are marker components with empty data
        componentsObject[tag] = {};
      }
    }

    return {
      id: partData.id,
      description: partData.description || `Anatomy part: ${partData.id}`,
      components: componentsObject,
    };
  }

  /**
   * Validates that anatomy parts have required components
   *
   * @param components
   * @param modId
   * @param filename
   * @private
   */
  _validateAnatomyComponents(components, modId, filename) {
    // Check for required anatomy:part component
    if (!components['anatomy:part']) {
      throw new Error(
        `Invalid anatomy part in '${filename}' from mod '${modId}'. Missing required 'anatomy:part' component.`
      );
    }

    // Validate anatomy:part has subType
    if (!components['anatomy:part'].subType) {
      throw new Error(
        `Invalid anatomy part in '${filename}' from mod '${modId}'. 'anatomy:part' component missing required 'subType' field.`
      );
    }

    // Validate sockets if present
    if (components['anatomy:sockets']) {
      const sockets = components['anatomy:sockets'].sockets;
      if (!Array.isArray(sockets)) {
        throw new Error(
          `Invalid anatomy part in '${filename}' from mod '${modId}'. 'anatomy:sockets' component must have 'sockets' array.`
        );
      }

      // Validate each socket
      const socketIds = new Set();
      for (const socket of sockets) {
        if (!socket.id) {
          throw new Error(
            `Invalid socket in anatomy part '${filename}' from mod '${modId}'. Socket missing required 'id' field.`
          );
        }

        if (socketIds.has(socket.id)) {
          throw new Error(
            `Duplicate socket ID '${socket.id}' in anatomy part '${filename}' from mod '${modId}'.`
          );
        }
        socketIds.add(socket.id);

        if (
          !socket.allowedTypes ||
          !Array.isArray(socket.allowedTypes) ||
          socket.allowedTypes.length === 0
        ) {
          throw new Error(
            `Invalid socket '${socket.id}' in anatomy part '${filename}' from mod '${modId}'. 'allowedTypes' must be a non-empty array.`
          );
        }

        if (socket.maxCount !== undefined && socket.maxCount < 1) {
          throw new Error(
            `Invalid socket '${socket.id}' in anatomy part '${filename}' from mod '${modId}'. 'maxCount' must be at least 1.`
          );
        }
      }
    }
  }
}

export default AnatomyPartLoader;
