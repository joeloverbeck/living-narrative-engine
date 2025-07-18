/**
 * @file Documentation of standardized entity creation helper options.
 * @typedef {object} CreateEntityOptions
 * @property {Record<string, object>} [overrides] Component overrides applied to the instance.
 * @property {string} [instanceId] Explicit instance ID to assign.
 * @property {boolean} [resetDispatch] If true, resets the event dispatcher mock after creation.
 *
 * The helper functions {@link EntityManagerTestBed#createEntity},
 * {@link EntityManagerTestBed#createBasicEntity},
 * {@link EntityManagerTestBed#createActorEntity} and
 * {@link EntityManagerTestBed#createEntityWithOverrides} all accept a
 * {@link CreateEntityOptions} object as their second argument.
 */

import { BaseTestBed } from '../baseTestBed.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import fs from 'fs';
import path from 'path';

/**
 * Test bed class for schema validation and entity testing.
 * Provides methods for validating data against schemas and creating mock entities.
 */
export class TestBedClass extends BaseTestBed {
  constructor() {
    super();
    this.logger = new ConsoleLogger();
    this.schemaValidator = new AjvSchemaValidator({ logger: this.logger });
    this.loadedSchemas = new Map();
  }

  /**
   * Validates data against a component schema.
   *
   * @param {object} data - The data to validate
   * @param {string} schemaId - The schema ID (e.g., 'core:material')
   * @returns {{isValid: boolean, errors: string[]}} Validation result
   */
  validateAgainstSchema(data, schemaId) {
    try {
      const schema = this._loadComponentSchema(schemaId);
      if (!schema) {
        return {
          isValid: false,
          errors: [`Schema not found: ${schemaId}`]
        };
      }

      // Ensure schema is loaded in the validator
      if (!this.schemaValidator.isSchemaLoaded(schemaId)) {
        this.schemaValidator.addSchema(schema, schemaId);
      }

      // Use the AjvSchemaValidator directly
      const result = this.schemaValidator.validate(schemaId, data);
      
      if (result.isValid) {
        return {
          isValid: true,
          errors: []
        };
      }
      
      // Extract error messages from the AJV error objects
      const errors = result.errors.map(err => {
        if (typeof err === 'string') {
          return err;
        }
        return err.message || String(err);
      });
      
      return {
        isValid: false,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Creates a mock entity with the given ID and loads its components from disk.
   *
   * @param {string} entityId - The entity ID (e.g., 'clothing:white_structured_linen_blazer')
   * @returns {object} Mock entity object
   */
  createMockEntity(entityId) {
    const entity = {
      id: entityId,
      components: {},
      hasComponent: function(componentId) {
        return componentId in this.components;
      },
      getComponentData: function(componentId) {
        return this.components[componentId] || null;
      },
      addComponent: function(componentId, data) {
        this.components[componentId] = data;
      }
    };

    // Try to load entity definition from disk if it exists
    try {
      const [modId, entityName] = entityId.split(':');
      const entityPath = path.join(
        process.cwd(), 
        'data/mods', 
        modId, 
        'entities/definitions',
        `${entityName}.entity.json`
      );

      if (fs.existsSync(entityPath)) {
        const entityDef = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
        if (entityDef.components) {
          Object.assign(entity.components, entityDef.components);
        }
      }
    } catch (error) {
      // Entity definition not found or invalid, continue with empty entity
      this.logger.debug(`Could not load entity definition for ${entityId}: ${error.message}`);
    }

    return entity;
  }

  /**
   * Loads a component schema from disk.
   *
   * @private
   * @param {string} schemaId - The schema ID (e.g., 'core:material')
   * @returns {object|null} The component's dataSchema or null if not found
   */
  _loadComponentSchema(schemaId) {
    if (this.loadedSchemas.has(schemaId)) {
      return this.loadedSchemas.get(schemaId);
    }

    try {
      const [modId, componentName] = schemaId.split(':');
      const componentPath = path.join(
        process.cwd(),
        'data/mods',
        modId,
        'components',
        `${componentName}.component.json`
      );

      if (!fs.existsSync(componentPath)) {
        this.logger.error(`Component file not found: ${componentPath}`);
        return null;
      }

      const componentDef = JSON.parse(fs.readFileSync(componentPath, 'utf8'));
      const schema = componentDef.dataSchema;

      if (!schema) {
        this.logger.error(`No dataSchema found in component: ${schemaId}`);
        return null;
      }

      this.loadedSchemas.set(schemaId, schema);
      return schema;
    } catch (error) {
      this.logger.error(`Error loading component schema ${schemaId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Cleanup method called after each test.
   */
  async cleanup() {
    await super.cleanup();
    this.loadedSchemas.clear();
  }
}