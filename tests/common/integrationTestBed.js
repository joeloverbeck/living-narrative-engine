/**
 * @file Integration test bed that provides access to the full DI container
 * for integration testing scenarios
 */

import { BaseTestBed } from './baseTestBed.js';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../src/dependencyInjection/baseContainerConfig.js';
import ConsoleLogger from '../../src/logging/consoleLogger.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { jest } from '@jest/globals';

/**
 * Integration test bed that provides full DI container functionality for integration tests.
 * This class sets up a real DI container with actual services for testing integration scenarios.
 */
export class IntegrationTestBed extends BaseTestBed {
  constructor() {
    super();
    /** @type {AppContainer} */
    this.container = null;
    /** @type {ConsoleLogger} */
    this.logger = null;
  }

  /**
   * Initializes the integration test bed with a full DI container
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    await super.setup();

    // Create and configure DI container
    this.container = new AppContainer();
    this.logger = new ConsoleLogger();

    // Create mock logger for tests
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };

    // Register the logger first before configuring base container
    this.container.register(tokens.ILogger, mockLogger);

    // Configure the container WITHOUT character builder first
    await configureBaseContainer(this.container, {
      includeGameSystems: false, // Keep minimal for integration tests
      includeUI: false, // No UI needed for event testing
      includeCharacterBuilder: false, // DON'T include character builder yet
      logger: mockLogger,
    });

    // Register minimal AI services needed by character builder (but not the full AI system)
    const { registerMinimalAIForCharacterBuilder } = await import(
      '../../src/dependencyInjection/registrations/aiRegistrations.js'
    );
    registerMinimalAIForCharacterBuilder(this.container, mockLogger);

    // Now mock the ThematicDirectionGenerator BEFORE registering character builder
    await this._mockThematicDirectionGenerator();

    // Now register character builder services - they will use our mock
    const { registerCharacterBuilder } = await import(
      '../../src/dependencyInjection/registrations/characterBuilderRegistrations.js'
    );
    registerCharacterBuilder(this.container);

    // For integration tests, manually register schemas and definitions instead of loading mods
    // This avoids network requests during testing
    await this._registerTestComponentSchemas();
    await this._registerTestEventDefinitions();

    // Store reference to mock logger for test assertions
    this.mockLogger = mockLogger;
  }

  /**
   * Gets a service from the DI container
   *
   * @template T
   * @param {string} serviceKey - The service key to resolve
   * @returns {T} The resolved service instance
   */
  get(serviceKey) {
    if (!this.container) {
      throw new Error(
        'IntegrationTestBed not initialized. Call initialize() first.'
      );
    }

    // Handle special cases for service key mapping
    if (serviceKey === 'ILogger') {
      return this.mockLogger;
    }

    return this.container.resolve(serviceKey);
  }

  /**
   * Checks if a service is registered in the container
   *
   * @param {string} serviceKey - The service key to check
   * @returns {boolean} True if the service is registered
   */
  isRegistered(serviceKey) {
    if (!this.container) {
      return false;
    }
    return this.container.isRegistered(serviceKey);
  }

  /**
   * Sets an override for a service in the container (useful for mocking)
   *
   * @param {string} serviceKey - The service key to override
   * @param {any} override - The override value or factory function
   */
  setOverride(serviceKey, override) {
    if (!this.container) {
      throw new Error(
        'IntegrationTestBed not initialized. Call initialize() first.'
      );
    }
    this.container.setOverride(serviceKey, override);
  }

  /**
   * Clears an override for a service in the container
   *
   * @param {string} serviceKey - The service key to clear override for
   */
  clearOverride(serviceKey) {
    if (!this.container) {
      throw new Error(
        'IntegrationTestBed not initialized. Call initialize() first.'
      );
    }
    this.container.clearOverride(serviceKey);
  }

  /**
   * Mocks the ThematicDirectionGenerator to avoid LLM calls
   *
   * @private
   * @returns {Promise<void>}
   */
  async _mockThematicDirectionGenerator() {
    try {
      // Create a mock generator that returns predictable results
      const mockGenerator = {
        generateDirections: jest.fn().mockResolvedValue([
          {
            id: 'test-direction-1',
            title: 'Test Direction 1',
            description: 'A test thematic direction',
            coreTension: 'The central conflict of test direction 1',
            uniqueTwist: 'A unique twist for test direction 1',
            narrativePotential: 'The narrative potential of test direction 1',
          },
          {
            id: 'test-direction-2',
            title: 'Test Direction 2',
            description: 'Another test thematic direction',
            coreTension: 'The central conflict of test direction 2',
            uniqueTwist: 'A unique twist for test direction 2',
            narrativePotential: 'The narrative potential of test direction 2',
          },
        ]),
      };

      // Use setOverride which takes precedence over regular registrations
      // This will be used when CharacterBuilderService is created during configureBaseContainer
      this.container.setOverride(
        tokens.ThematicDirectionGenerator,
        mockGenerator
      );

      if (this.mockLogger && this.mockLogger.debug) {
        this.mockLogger.debug(
          'IntegrationTestBed: ThematicDirectionGenerator mock override set'
        );
      }
    } catch (error) {
      if (this.mockLogger && this.mockLogger.warn) {
        this.mockLogger.warn(
          `IntegrationTestBed: Failed to mock ThematicDirectionGenerator: ${error.message}`
        );
      }
      // Don't throw - allow tests to continue
    }
  }

  /**
   * Registers test component schemas needed for entity creation
   *
   * @private
   * @returns {Promise<void>}
   */
  async _registerTestComponentSchemas() {
    try {
      const schemaValidator = this.container.resolve(tokens.ISchemaValidator);
      if (!schemaValidator) {
        throw new Error('ISchemaValidator not found in container');
      }

      // Register core component schemas needed for tests
      const componentSchemas = [
        {
          id: 'core:name',
          schema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
            },
            required: ['text'],
            additionalProperties: false,
          },
        },
        {
          id: 'core:position',
          schema: {
            type: 'object',
            properties: {
              locationId: { type: 'string' },
            },
            required: ['locationId'],
            additionalProperties: false,
          },
        },
        {
          id: 'positioning:closeness',
          schema: {
            type: 'object',
            properties: {
              partners: {
                type: 'array',
                uniqueItems: true,
                items: { type: 'string' },
              },
            },
            required: ['partners'],
            additionalProperties: false,
          },
        },
        {
          id: 'intimacy:kissing',
          schema: {
            type: 'object',
            properties: {
              partner: { type: 'string' },
            },
            required: ['partner'],
            additionalProperties: false,
          },
        },
        {
          id: 'positioning:facing_away',
          schema: {
            type: 'object',
            properties: {
              facing: { type: 'string' },
            },
            required: ['facing'],
            additionalProperties: false,
          },
        },
        {
          id: 'anatomy:mouth',
          schema: {
            type: 'object',
            properties: {
              state: { type: 'string' },
            },
            required: ['state'],
            additionalProperties: false,
          },
        },
        {
          id: 'clothing:wearable',
          schema: {
            type: 'object',
            properties: {
              slot: { type: 'string' },
            },
            required: ['slot'],
            additionalProperties: false,
          },
        },
      ];

      // Register each component schema
      for (const { id, schema } of componentSchemas) {
        if (typeof schemaValidator.addSchema === 'function') {
          await schemaValidator.addSchema(schema, id);
        }
      }

      if (this.mockLogger && this.mockLogger.debug) {
        this.mockLogger.debug(
          'IntegrationTestBed: Test component schemas registered successfully'
        );
      }
    } catch (error) {
      if (this.mockLogger && this.mockLogger.error) {
        this.mockLogger.error(
          `IntegrationTestBed: Failed to register test component schemas: ${error.message}`,
          error
        );
      }
      throw error;
    }
  }

  /**
   * Registers test event definitions directly to avoid network requests
   *
   * @private
   * @returns {Promise<void>}
   */
  async _registerTestEventDefinitions() {
    try {
      const dataRegistry = this.container.resolve(tokens.IDataRegistry);
      if (!dataRegistry) {
        throw new Error('IDataRegistry not found in container');
      }

      // Register minimal event definitions needed for tests
      const testEventDefinitions = [
        {
          id: 'core:analytics_track',
          description: 'Event for tracking user analytics',
          payloadSchema: {
            type: 'object',
            properties: {
              event: { type: 'string' },
              properties: { type: 'object' },
            },
            required: ['event', 'properties'],
          },
        },
        {
          id: 'core:direction_updated',
          description: 'Event when a thematic direction is updated',
          payloadSchema: {
            type: 'object',
            properties: {
              directionId: { type: 'string', minLength: 1 },
              field: {
                type: 'string',
                enum: [
                  'title',
                  'description',
                  'coreTension',
                  'uniqueTwist',
                  'narrativePotential',
                ],
              },
              oldValue: { type: 'string' },
              newValue: { type: 'string' },
            },
            required: ['directionId', 'field', 'oldValue', 'newValue'],
            additionalProperties: false,
          },
        },
        {
          id: 'core:direction_deleted',
          description: 'Event when a thematic direction is deleted',
          payloadSchema: {
            type: 'object',
            properties: {
              directionId: { type: 'string' },
            },
            required: ['directionId'],
          },
        },
        {
          id: 'core:orphans_cleaned',
          description: 'Event when orphaned directions are cleaned',
          payloadSchema: {
            type: 'object',
            properties: {
              deletedCount: { type: 'number' },
            },
            required: ['deletedCount'],
          },
        },
      ];

      // Register event definitions with the data registry
      for (const eventDef of testEventDefinitions) {
        dataRegistry.store('events', eventDef.id, eventDef);
      }

      // Also register the schemas with the schema validator
      const schemaValidator = this.container.resolve(tokens.ISchemaValidator);
      if (schemaValidator) {
        for (const eventDef of testEventDefinitions) {
          const schemaId = `${eventDef.id}#payload`;
          // Register the schema directly - addSchema(schemaData, schemaId)
          if (typeof schemaValidator.addSchema === 'function') {
            schemaValidator.addSchema(eventDef.payloadSchema, schemaId);
          }
        }
      }

      if (this.mockLogger && this.mockLogger.debug) {
        this.mockLogger.debug(
          'IntegrationTestBed: Test event definitions registered successfully'
        );
      }
    } catch (error) {
      if (this.mockLogger && this.mockLogger.error) {
        this.mockLogger.error(
          `IntegrationTestBed: Failed to register test event definitions: ${error.message}`,
          error
        );
      }
      throw error;
    }
  }

  /**
   * Cleanup method called after each test.
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Reset container state
    if (this.container) {
      this.container.clearOverrides();
      this.container.disposeSingletons();
    }

    // Clear mock logger calls
    if (this.mockLogger) {
      Object.values(this.mockLogger).forEach((mockFn) => {
        if (typeof mockFn?.mockClear === 'function') {
          mockFn.mockClear();
        }
      });
    }

    await super.cleanup();
  }
}
