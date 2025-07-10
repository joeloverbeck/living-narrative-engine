// src/scopeDsl/core/entityBuilder.js

/**
 * @file Entity Builder for Scope-DSL
 * @description Provides immutable entity creation with components
 */

import { buildComponents } from '../../utils/entityComponentUtils.js';

/**
 * @typedef {import('./gateways.js').EntityGateway} EntityGateway
 */

/**
 * Immutable entity builder that creates entities with components
 * while preserving prototype chains and avoiding mutation
 */
class EntityBuilder {
  /**
   * Creates a new EntityBuilder instance
   *
   * @param {EntityGateway} gateway - Gateway for entity/component operations
   * @param {object} [trace] - Optional trace logger
   */
  constructor(gateway, trace = null) {
    this.gateway = gateway;
    this.trace = trace;
  }

  /**
   * Creates an entity with components if needed
   *
   * @param {object} sourceEntity - Source entity to enhance
   * @returns {object} Enhanced entity with components
   */
  createWithComponents(sourceEntity) {
    if (!sourceEntity) {
      return null;
    }

    // If components already exist, return the entity as-is
    if (sourceEntity.components) {
      return sourceEntity;
    }

    // If no component type IDs, return the entity as-is
    if (
      !sourceEntity.componentTypeIds ||
      !Array.isArray(sourceEntity.componentTypeIds)
    ) {
      return sourceEntity;
    }

    // Build components
    const components = buildComponents(
      sourceEntity.id,
      sourceEntity,
      this.gateway
    );

    // Create enhanced entity using prototype-preserving approach
    return this._createEnhancedEntity(sourceEntity, components);
  }

  /**
   * Creates an enhanced entity while preserving prototype chain
   *
   * @param {object} sourceEntity - Original entity
   * @param {object} components - Components to add
   * @returns {object} Enhanced entity with components
   * @private
   */
  _createEnhancedEntity(sourceEntity, components) {
    // For simple objects, just create a new object
    if (this._isPlainObject(sourceEntity)) {
      return {
        ...sourceEntity,
        components,
      };
    }

    // For Entity instances, preserve the prototype chain
    const enhancedEntity = Object.create(Object.getPrototypeOf(sourceEntity));

    // Copy all properties and descriptors
    const descriptors = Object.getOwnPropertyDescriptors(sourceEntity);
    Object.defineProperties(enhancedEntity, descriptors);

    // Add components as a new property
    Object.defineProperty(enhancedEntity, 'components', {
      value: components,
      writable: false,
      enumerable: true,
      configurable: false,
    });

    return enhancedEntity;
  }

  /**
   * Checks if an object is a plain object (not a class instance)
   *
   * @param {object} obj - Object to check
   * @returns {boolean} True if plain object
   * @private
   */
  _isPlainObject(obj) {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    // Check if it's a plain object or has a custom prototype
    const proto = Object.getPrototypeOf(obj);
    return proto === Object.prototype || proto === null;
  }

  /**
   * Creates an entity builder with components for evaluation context
   *
   * @param {string|object} item - Entity item to process
   * @returns {object|null} Enhanced entity or null
   */
  createEntityForEvaluation(item) {
    let entity;

    if (typeof item === 'string') {
      entity = this.gateway.getEntityInstance(item) || { id: item };
    } else if (item && typeof item === 'object') {
      entity = item;
    } else {
      return null;
    }

    return this.createWithComponents(entity);
  }

  /**
   * Creates an actor entity with components for evaluation context
   *
   * @param {object} actorEntity - Actor entity to enhance
   * @returns {object} Enhanced actor entity
   */
  createActorForEvaluation(actorEntity) {
    if (!actorEntity) {
      throw new Error(
        'createActorForEvaluation: actorEntity cannot be null or undefined'
      );
    }

    if (!actorEntity.id || typeof actorEntity.id !== 'string') {
      throw new Error(
        `createActorForEvaluation: actorEntity must have a valid string ID, got: ${JSON.stringify(actorEntity.id)}`
      );
    }

    return this.createWithComponents(actorEntity);
  }

  /**
   * Creates a new EntityBuilder instance with different gateway
   *
   * @param {EntityGateway} gateway - New gateway
   * @param {object} [trace] - Optional trace logger
   * @returns {EntityBuilder} New builder instance
   */
  static withGateway(gateway, trace = null) {
    return new EntityBuilder(gateway, trace);
  }
}

export default EntityBuilder;
