/**
 * @file perceptibleEventTestBed.js
 * @description Test bed helper for perceptible event sender E2E tests
 *
 * Provides utilities for creating test locations and actors with proper
 * entity definition registration to avoid DefinitionNotFoundError.
 */

import { createEntityDefinition } from '../../../common/entities/entityFactories.js';
import {
  assertPresent,
  assertNonBlankString,
} from '../../../../src/utils/dependencyUtils.js';
import { EXITS_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

/**
 * Test bed helper for perceptible event sender tests
 *
 * Handles proper entity definition registration and instance creation
 * following the pattern from EntityWorkflowTestBed.
 */
export class PerceptibleEventTestBed {
  /**
   * Create a new PerceptibleEventTestBed
   *
   * @param {object} params - Required services
   * @param {object} params.entityManager - Entity manager instance
   * @param {object} params.registry - Data registry instance
   * @param {object} params.validator - Schema validator instance
   * @param {object} params.logger - Logger instance
   */
  constructor({ entityManager, registry, validator, logger }) {
    assertPresent(entityManager, 'entityManager is required');
    assertPresent(registry, 'registry is required');
    assertPresent(validator, 'validator is required');
    assertPresent(logger, 'logger is required');

    this.entityManager = entityManager;
    this.registry = registry;
    this.validator = validator;
    this.logger = logger;

    // Track created entities for cleanup
    this.createdEntityIds = new Set();
  }

  /**
   * Register required component schemas for testing
   */
  async registerComponentSchemas() {
    // Register core:exits schema
    await this.validator.addSchema(
      {
        type: 'object',
        properties: {
          exits: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
        },
        additionalProperties: false,
      },
      EXITS_COMPONENT_ID
    );

    // Register core:name schema
    await this.validator.addSchema(
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      'core:name'
    );

    // Register core:position schema
    await this.validator.addSchema(
      {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
        },
        required: ['locationId'],
        additionalProperties: false,
      },
      'core:position'
    );

    // Register core:actor schema
    await this.validator.addSchema(
      {
        type: 'object',
        properties: {
          name: { type: 'string', default: '' },
          conscious: { type: 'boolean', default: true },
          trader: { type: 'boolean', default: false },
          isPlayer: { type: 'boolean', default: false },
        },
        additionalProperties: false,
      },
      'core:actor'
    );

    this.logger.debug('Registered component schemas for perceptible event tests');
  }

  /**
   * Ensure an entity definition exists in the registry
   *
   * @param {string} definitionId - Entity definition ID
   * @param {object} components - Components for the definition
   * @private
   */
  _ensureDefinitionExists(definitionId, components = {}) {
    assertNonBlankString(definitionId, 'definitionId');

    // Check if definition already exists
    try {
      const existingDef = this.registry.get('entityDefinitions', definitionId);
      if (existingDef) {
        return;
      }
    } catch (error) {
      // Definition doesn't exist, we'll create it
    }

    // Create entity definition
    const definition = createEntityDefinition(definitionId, components);
    this.registry.store('entityDefinitions', definitionId, definition);
    this.logger.debug(`Created entity definition: ${definitionId}`);
  }

  /**
   * Create a location entity with exits component
   *
   * @param {string} id - Entity instance ID
   * @param {string} name - Location name
   * @param {object} [options] - Additional options
   * @param {Array<string>} [options.exits] - Exit IDs
   * @returns {Promise<object>} Created location entity
   */
  async createLocation(id, name, options = {}) {
    assertNonBlankString(id, 'location id');
    assertNonBlankString(name, 'location name');

    const { exits = [] } = options;

    // Prepare components for definition
    const components = {
      'core:name': { name },
      [EXITS_COMPONENT_ID]: { exits },
    };

    // Ensure definition exists
    this._ensureDefinitionExists(id, components);

    // Create entity instance with specific ID
    const entity = await this.entityManager.createEntityInstance(id, {
      instanceId: id,
    });

    // Track for cleanup
    this.createdEntityIds.add(id);

    this.logger.debug(`Created location entity: ${id} (${name})`);
    return entity;
  }

  /**
   * Create an actor entity with position component
   *
   * @param {string} id - Entity instance ID
   * @param {string} name - Actor name
   * @param {string} locationId - Location where actor is positioned
   * @param {object} [options] - Additional options
   * @param {boolean} [options.isPlayer] - Whether this is a player actor
   * @returns {Promise<object>} Created actor entity
   */
  async createActor(id, name, locationId, options = {}) {
    assertNonBlankString(id, 'actor id');
    assertNonBlankString(name, 'actor name');
    assertNonBlankString(locationId, 'locationId');

    const { isPlayer = false } = options;

    // Prepare components for definition
    const components = {
      'core:actor': { name, isPlayer },
      'core:name': { name },
      'core:position': { locationId },
    };

    // Ensure definition exists
    this._ensureDefinitionExists(id, components);

    // Create entity instance with specific ID
    const entity = await this.entityManager.createEntityInstance(id, {
      instanceId: id,
    });

    // Track for cleanup
    this.createdEntityIds.add(id);

    this.logger.debug(
      `Created actor entity: ${id} (${name}) at location ${locationId}`
    );
    return entity;
  }

  /**
   * Add exits component to an existing location
   *
   * @param {string} locationId - Location entity ID
   * @param {Array<string>} [exits] - Exit IDs
   * @returns {Promise<void>}
   */
  async addExitsToLocation(locationId, exits = []) {
    assertNonBlankString(locationId, 'locationId');

    await this.entityManager.addComponent(locationId, EXITS_COMPONENT_ID, {
      exits,
    });

    this.logger.debug(`Added exits to location: ${locationId}`);
  }

  /**
   * Cleanup created entities
   * Note: In E2E tests, cleanup typically happens via test framework teardown
   */
  cleanup() {
    this.createdEntityIds.clear();
    this.logger.debug('Perceptible event test bed cleanup complete');
  }
}
