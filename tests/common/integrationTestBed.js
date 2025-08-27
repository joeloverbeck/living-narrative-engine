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

    // Create mock UI elements for tests that need UI components
    const outputDiv = document.createElement('div');
    outputDiv.id = 'gameArea';

    // Create action buttons container for ActionButtonsRenderer
    const actionButtonsContainer = document.createElement('div');
    actionButtonsContainer.id = 'action-buttons';
    outputDiv.appendChild(actionButtonsContainer);

    // Append outputDiv to document body so selectors work
    document.body.appendChild(outputDiv);

    const mockUIElements = {
      outputDiv: outputDiv,
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document: document,
    };

    // Configure the container WITHOUT character builder first
    await configureBaseContainer(this.container, {
      includeGameSystems: false, // Keep minimal for integration tests
      includeUI: true, // UI needed for action button rendering tests
      includeCharacterBuilder: false, // DON'T include character builder yet
      uiElements: mockUIElements, // Provide mock UI elements
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
          id: 'core:character_concept_created',
          description: 'Dispatched when a new character concept is created.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              concept: { type: 'string' },
              autoSaved: { type: 'boolean' },
            },
            required: ['conceptId', 'concept'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:character_concept_updated',
          description: 'Dispatched when a character concept is updated.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              concept: { type: 'string' },
              field: { type: 'string' },
              oldValue: {},
              newValue: {},
            },
            required: ['conceptId'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:character_concept_deleted',
          description: 'Dispatched when a character concept is deleted.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
            },
            required: ['conceptId'],
            additionalProperties: false,
          },
        },
        {
          id: 'core:character_builder_error_occurred',
          description: 'Dispatched when an error occurs in character builder.',
          payloadSchema: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              operation: { type: 'string' },
              context: { type: 'object' },
            },
            required: ['error'],
            additionalProperties: true,
          },
        },
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
        {
          id: 'core:thematic_directions_generated',
          description:
            'Dispatched when thematic directions are generated for a character concept.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              directionCount: { type: 'integer', minimum: 0 },
              autoSaved: { type: 'boolean' },
            },
            required: ['conceptId', 'directionCount', 'autoSaved'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:character_concept_saved',
          description:
            'Dispatched when a character concept is saved to storage.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              concept: { type: 'string' },
              autoSaved: { type: 'boolean' },
            },
            required: ['conceptId', 'concept'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cliches_retrieved',
          description:
            'Dispatched when clichés are successfully retrieved from storage.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              directionId: { type: 'string' },
              cliches: { type: 'array', items: { type: 'object' } },
              count: { type: 'integer', minimum: 0 },
            },
            required: ['conceptId', 'directionId'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cliches_retrieval_failed',
          description: 'Dispatched when cliché retrieval from storage fails.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              directionId: { type: 'string' },
              error: { type: 'string' },
              errorCode: { type: 'string' },
            },
            required: ['conceptId', 'directionId', 'error'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cliches_stored',
          description: 'Dispatched when clichés are successfully stored.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              directionId: { type: 'string' },
              clicheId: { type: 'string' },
              count: { type: 'integer', minimum: 0 },
            },
            required: ['conceptId', 'directionId'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cliches_storage_failed',
          description: 'Dispatched when cliché storage operation fails.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              directionId: { type: 'string' },
              error: { type: 'string' },
              errorCode: { type: 'string' },
            },
            required: ['conceptId', 'directionId', 'error'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cliches_deleted',
          description: 'Dispatched when clichés are deleted from storage.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              directionId: { type: 'string' },
              deletedCount: { type: 'integer', minimum: 0 },
            },
            required: ['conceptId', 'directionId'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cliches_generation_started',
          description: 'Dispatched when cliché generation starts.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              directionId: { type: 'string' },
            },
            required: ['conceptId', 'directionId'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cliches_generation_completed',
          description:
            'Dispatched when cliché generation completes successfully.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              directionId: { type: 'string' },
              clicheId: { type: 'string' },
              totalCount: { type: 'integer', minimum: 0 },
              generationTime: { type: 'number', minimum: 0 },
            },
            required: ['conceptId', 'directionId'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cliches_generation_failed',
          description: 'Dispatched when cliché generation fails.',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: { type: 'string' },
              directionId: { type: 'string' },
              error: { type: 'string' },
              errorCode: { type: 'string' },
              attempt: { type: 'integer', minimum: 0 },
            },
            required: ['conceptId', 'directionId', 'error'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cliche_error_occurred',
          description: 'Dispatched when a cliché-related error occurs.',
          payloadSchema: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              code: { type: 'string' },
              operation: { type: 'string' },
              attempt: { type: 'integer', minimum: 1 },
              context: { type: 'object' },
              recovery: { type: 'string' },
            },
            required: ['message', 'operation'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:core_motivations_generation_started',
          description: 'Dispatched when core motivations generation begins',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: {
                type: 'string',
                description: 'ID of the character concept',
              },
              directionId: {
                type: 'string',
                description: 'ID of the thematic direction',
              },
              directionTitle: {
                type: 'string',
                description: 'Title of the thematic direction',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'ISO 8601 timestamp of when generation started',
              },
            },
            required: ['conceptId', 'directionId'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:core_motivations_generation_completed',
          description:
            'Dispatched when core motivations are successfully generated',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: {
                type: 'string',
                description: 'ID of the character concept',
              },
              directionId: {
                type: 'string',
                description: 'ID of the thematic direction',
              },
              motivationIds: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Array of generated motivation IDs',
              },
              totalCount: {
                type: 'integer',
                minimum: 0,
                description: 'Total number of motivations for this direction',
              },
              generationTime: {
                type: 'integer',
                minimum: 0,
                description: 'Time taken to generate in milliseconds',
              },
            },
            required: ['conceptId', 'directionId', 'motivationIds'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:core_motivations_generation_failed',
          description: 'Dispatched when core motivations generation fails',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: {
                type: 'string',
                description: 'ID of the character concept',
              },
              directionId: {
                type: 'string',
                description: 'ID of the thematic direction',
              },
              error: {
                type: 'string',
                description: 'Error message describing the failure',
              },
              errorCode: {
                type: 'string',
                description: 'Error code for categorization',
              },
              retryAttempt: {
                type: 'integer',
                minimum: 0,
                description: 'Number of retry attempts made',
              },
            },
            required: ['conceptId', 'directionId', 'error'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:core_motivations_retrieved',
          description:
            'Dispatched when core motivations are loaded from storage',
          payloadSchema: {
            type: 'object',
            properties: {
              directionId: {
                type: 'string',
                description: 'ID of the thematic direction',
              },
              count: {
                type: 'integer',
                minimum: 0,
                description: 'Number of motivations retrieved',
              },
              source: {
                type: 'string',
                enum: ['database', 'cache', 'session'],
                description: 'Source of the retrieved data',
              },
            },
            required: ['directionId', 'count'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cache_initialized',
          description: 'Dispatched when a cache manager is initialized.',
          payloadSchema: {
            type: 'object',
            properties: {
              maxSize: {
                description: 'Maximum cache size',
                type: 'number',
              },
              ttlConfig: {
                description:
                  'Time-to-live configuration for different data types',
                type: 'object',
              },
              cacheManagerType: {
                description: 'Type of cache manager that was initialized',
                type: 'string',
              },
              timestamp: {
                description: 'Initialization timestamp',
                type: 'number',
              },
            },
            additionalProperties: true,
          },
        },
        {
          id: 'core:cache_hit',
          description: 'Dispatched when a cache hit occurs.',
          payloadSchema: {
            type: 'object',
            properties: {
              key: {
                description: 'Cache key that was hit',
                type: 'string',
              },
              type: {
                description: 'Type of cached data',
                type: 'string',
              },
              totalHits: {
                description: 'Total number of hits for this key',
                type: 'number',
              },
            },
            required: ['key'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cache_miss',
          description: 'Dispatched when a cache miss occurs.',
          payloadSchema: {
            type: 'object',
            properties: {
              key: {
                description: 'Cache key that was missed',
                type: 'string',
              },
            },
            required: ['key'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cache_evicted',
          description: 'Dispatched when a cache entry is evicted.',
          payloadSchema: {
            type: 'object',
            properties: {
              key: {
                description: 'Cache key that was evicted',
                type: 'string',
              },
            },
            required: ['key'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:cliche_item_deleted',
          description:
            'Fired when an individual item is removed from a cliché category',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: {
                type: 'string',
                description:
                  'The ID of the character concept associated with the cliché',
              },
              directionId: {
                type: 'string',
                description: 'The ID of the thematic direction',
              },
              categoryId: {
                type: 'string',
                description:
                  "The category from which the item was removed (e.g., 'names', 'personalityTraits')",
              },
              itemText: {
                type: 'string',
                description: 'The text of the item that was removed',
              },
              remainingCount: {
                type: 'integer',
                minimum: 0,
                description:
                  'The total number of items remaining across all categories',
              },
            },
            required: [
              'conceptId',
              'directionId',
              'categoryId',
              'itemText',
              'remainingCount',
            ],
            additionalProperties: false,
          },
        },
        {
          id: 'core:cliche_trope_deleted',
          description:
            'Fired when a trope or stereotype is removed from a cliché',
          payloadSchema: {
            type: 'object',
            properties: {
              conceptId: {
                type: 'string',
                description:
                  'The ID of the character concept associated with the cliché',
              },
              directionId: {
                type: 'string',
                description: 'The ID of the thematic direction',
              },
              tropeText: {
                type: 'string',
                description: 'The text of the trope that was removed',
              },
              remainingCount: {
                type: 'integer',
                minimum: 0,
                description:
                  'The total number of items remaining across all categories and tropes',
              },
            },
            required: [
              'conceptId',
              'directionId',
              'tropeText',
              'remainingCount',
            ],
            additionalProperties: false,
          },
        },
        {
          id: 'core:speech_patterns_generation_started',
          description:
            'Dispatched when speech patterns generation begins for a character.',
          payloadSchema: {
            type: 'object',
            properties: {
              characterData: {
                description: 'The character data being used for generation',
                type: 'object',
                additionalProperties: true,
              },
              options: {
                description: 'Options for speech pattern generation',
                type: 'object',
                additionalProperties: true,
              },
              timestamp: {
                description: 'ISO 8601 timestamp of when generation started',
                type: 'string',
                format: 'date-time',
              },
            },
            required: ['characterData', 'options', 'timestamp'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:speech_patterns_generation_completed',
          description:
            'Dispatched when speech patterns generation successfully completes.',
          payloadSchema: {
            type: 'object',
            properties: {
              result: {
                description: 'The generated speech patterns result',
                type: 'object',
                additionalProperties: true,
              },
              processingTime: {
                description: 'Time taken to process in milliseconds',
                type: 'number',
                minimum: 0,
              },
              timestamp: {
                description: 'ISO 8601 timestamp of when generation completed',
                type: 'string',
                format: 'date-time',
              },
            },
            required: ['result', 'processingTime', 'timestamp'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:speech_patterns_generation_failed',
          description: 'Dispatched when speech patterns generation fails.',
          payloadSchema: {
            type: 'object',
            properties: {
              error: {
                description: 'The error message describing what went wrong',
                type: 'string',
              },
              processingTime: {
                description: 'Time taken before failure in milliseconds',
                type: 'number',
                minimum: 0,
              },
              timestamp: {
                description: 'ISO 8601 timestamp of when generation failed',
                type: 'string',
                format: 'date-time',
              },
            },
            required: ['error', 'processingTime', 'timestamp'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:speech_patterns_cache_hit',
          description:
            'Dispatched when cached speech patterns are returned instead of generating new ones.',
          payloadSchema: {
            type: 'object',
            properties: {
              cacheKey: {
                description: 'The cache key that was hit',
                type: 'string',
              },
              timestamp: {
                description:
                  'ISO 8601 timestamp of when the cache hit occurred',
                type: 'string',
                format: 'date-time',
              },
            },
            required: ['cacheKey', 'timestamp'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:speech_patterns_generation_retry',
          description:
            'Dispatched when speech patterns generation is retried after a failure.',
          payloadSchema: {
            type: 'object',
            properties: {
              attempt: {
                description: 'Current attempt number (starting from 1)',
                type: 'number',
                minimum: 1,
              },
              maxRetries: {
                description: 'Maximum number of retry attempts allowed',
                type: 'number',
                minimum: 1,
              },
              delay: {
                description: 'Delay in milliseconds before the retry attempt',
                type: 'number',
                minimum: 0,
              },
              error: {
                description: 'Error message from the previous failed attempt',
                type: 'string',
              },
              timestamp: {
                description:
                  'ISO 8601 timestamp of when the retry was scheduled',
                type: 'string',
                format: 'date-time',
              },
            },
            required: ['attempt', 'maxRetries', 'delay', 'error', 'timestamp'],
            additionalProperties: true,
          },
        },
        {
          id: 'core:circuit_breaker_opened',
          description:
            'Dispatched when a circuit breaker opens due to consecutive failures, preventing further requests until reset.',
          payloadSchema: {
            type: 'object',
            properties: {
              service: {
                description:
                  'Name of the service where the circuit breaker was opened',
                type: 'string',
              },
              consecutiveFailures: {
                description:
                  'Number of consecutive failures that caused the circuit breaker to open',
                type: 'number',
                minimum: 1,
              },
              resetTimeout: {
                description:
                  'Timeout in milliseconds after which the circuit breaker will attempt to reset',
                type: 'number',
                minimum: 0,
              },
              timestamp: {
                description:
                  'ISO 8601 timestamp of when the circuit breaker was opened',
                type: 'string',
                format: 'date-time',
              },
            },
            required: [
              'service',
              'consecutiveFailures',
              'resetTimeout',
              'timestamp',
            ],
            additionalProperties: true,
          },
        },
      ];

      // Register event definitions with the data registry
      // Only register events that aren't already loaded (prevents duplicate registration warnings)
      for (const eventDef of testEventDefinitions) {
        const existingDef = dataRegistry.get('events', eventDef.id);
        if (!existingDef) {
          dataRegistry.store('events', eventDef.id, eventDef);
        }
      }

      // Also register the schemas with the schema validator
      const schemaValidator = this.container.resolve(tokens.ISchemaValidator);
      if (schemaValidator) {
        for (const eventDef of testEventDefinitions) {
          const schemaId = `${eventDef.id}#payload`;
          // Only register schema if not already loaded (prevents duplicate registration warnings)
          if (
            typeof schemaValidator.addSchema === 'function' &&
            typeof schemaValidator.isSchemaLoaded === 'function' &&
            !schemaValidator.isSchemaLoaded(schemaId)
          ) {
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
   * Getter methods to expose registered services for tests
   */

  get characterBuilderService() {
    return this.container.resolve(tokens.ICharacterBuilderService);
  }

  get eventBus() {
    return this.container.resolve(tokens.IEventBus);
  }

  get schemaValidator() {
    return this.container.resolve(tokens.ISchemaValidator);
  }

  get coreMotivationsGenerator() {
    // Return a mock since this service doesn't exist yet
    return {
      generate: jest.fn().mockResolvedValue([]),
      getMotivations: jest.fn().mockResolvedValue([]),
      deleteMotivation: jest.fn().mockResolvedValue(true),
    };
  }

  get displayEnhancer() {
    // Return a mock since this service doesn't exist yet
    return {
      enhance: jest.fn().mockReturnValue('enhanced content'),
      format: jest.fn().mockReturnValue('formatted content'),
    };
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
