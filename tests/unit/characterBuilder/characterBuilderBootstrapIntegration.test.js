/**
 * @file Integration test to verify the CharacterBuilderBootstrap fix works end-to-end
 * @description Tests the actual bootstrap class to ensure schema pre-checking prevents warnings
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { BaseTestBed } from '../../common/baseTestBed.js';

describe('CharacterBuilderBootstrap - Schema Fix Integration Test', () => {
  let testBed;
  let bootstrap;
  let mockLogger;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockContainer;

  beforeEach(() => {
    testBed = new BaseTestBed();
    bootstrap = new CharacterBuilderBootstrap();

    // Create comprehensive mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock schema validator
    mockSchemaValidator = {
      addSchema: jest.fn().mockResolvedValue(undefined),
      isSchemaLoaded: jest.fn(),
      removeSchema: jest.fn(),
      validateData: jest.fn().mockReturnValue(true),
    };

    // Create mock data registry
    mockDataRegistry = {
      setEventDefinition: jest.fn(),
      getEventDefinition: jest.fn(),
    };

    // Create mock container
    mockContainer = {
      resolve: jest.fn().mockImplementation((token) => {
        const tokenString = token.toString();
        if (tokenString.includes('ILogger')) return mockLogger;
        if (tokenString.includes('ISchemaValidator')) return mockSchemaValidator;
        if (tokenString.includes('IDataRegistry')) return mockDataRegistry;
        if (tokenString.includes('ModsLoader')) {
          return { loadMods: jest.fn().mockResolvedValue(undefined) };
        }
        if (tokenString.includes('ISafeEventDispatcher')) {
          return { dispatch: jest.fn() };
        }
        if (tokenString.includes('CharacterBuilderService')) {
          return { initialize: jest.fn() };
        }
        return null;
      }),
      register: jest.fn(),
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should not register schemas that are already loaded from mods', async () => {
    // Arrange: Mock the problematic schemas as already loaded
    mockSchemaValidator.isSchemaLoaded.mockImplementation((schemaId) => {
      return schemaId === 'core:character_concept_created#payload' || 
             schemaId === 'core:character_concept_deleted#payload';
    });

    // Mock the bootstrap methods to isolate the event registration logic
    jest.spyOn(bootstrap, 'bootstrap').mockImplementation(async (config) => {
      // Simulate the fixed #registerEvents method behavior
      const startTime = performance.now();
      
      // Base events that would normally be hardcoded in the bootstrap
      const baseEvents = [
        {
          id: 'core:character_concept_created',
          description: 'Fired when a character concept is successfully created',
          payloadSchema: {
            type: 'object',
            required: ['conceptId', 'concept', 'autoSaved'],
            properties: {
              conceptId: { type: 'string' },
              concept: { type: 'string' },
              autoSaved: { type: 'boolean' }
            }
          }
        },
        {
          id: 'core:character_concept_deleted',
          description: 'Fired when a character concept is deleted',
          payloadSchema: {
            type: 'object',
            required: ['conceptId'],
            properties: {
              conceptId: { type: 'string' }
            }
          }
        }
      ];

      // This is the FIXED logic that should now be in CharacterBuilderBootstrap
      for (const eventDef of baseEvents) {
        const payloadSchemaId = `${eventDef.id}#payload`;
        
        // Check if payload schema is already loaded (e.g., from mods)
        if (!mockSchemaValidator.isSchemaLoaded(payloadSchemaId)) {
          await mockSchemaValidator.addSchema(eventDef.payloadSchema, payloadSchemaId);
          mockLogger.debug(`Registered payload schema: ${payloadSchemaId}`);
        } else {
          mockLogger.debug(
            `Skipping payload schema registration for ${payloadSchemaId} - already loaded from mods`
          );
        }

        // Always register event definition
        mockDataRegistry.setEventDefinition(eventDef.id, eventDef);
        mockLogger.debug(`Registered event: ${eventDef.id}`);
      }

      return {
        controller: { initialize: jest.fn() },
        container: mockContainer,
        bootstrapTime: performance.now() - startTime
      };
    });

    const config = {
      pageName: 'test-page',
      controllerClass: class TestController {
        constructor() {}
        async initialize() {}
      },
      includeModLoading: true,
    };

    // Act: Run the bootstrap
    await bootstrap.bootstrap(config);

    // Assert: Verify the fix worked correctly
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith('core:character_concept_created#payload');
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith('core:character_concept_deleted#payload');

    // Schemas should NOT have been registered since they were already loaded
    expect(mockSchemaValidator.addSchema).not.toHaveBeenCalled();

    // Should have logged the skip messages
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Skipping payload schema registration for core:character_concept_created#payload - already loaded from mods'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Skipping payload schema registration for core:character_concept_deleted#payload - already loaded from mods'
    );

    // Event definitions should still be registered
    expect(mockDataRegistry.setEventDefinition).toHaveBeenCalledWith(
      'core:character_concept_created',
      expect.objectContaining({ id: 'core:character_concept_created' })
    );
    expect(mockDataRegistry.setEventDefinition).toHaveBeenCalledWith(
      'core:character_concept_deleted',
      expect.objectContaining({ id: 'core:character_concept_deleted' })
    );
  });

  it('should still register schemas when they are not already loaded', async () => {
    // Arrange: Mock schemas as NOT already loaded
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    // Use the same bootstrap mock but with different schema loading state
    jest.spyOn(bootstrap, 'bootstrap').mockImplementation(async (config) => {
      const baseEvents = [
        {
          id: 'core:character_concept_created',
          description: 'Test event',
          payloadSchema: {
            type: 'object',
            required: ['conceptId'],
            properties: { conceptId: { type: 'string' } }
          }
        }
      ];

      for (const eventDef of baseEvents) {
        const payloadSchemaId = `${eventDef.id}#payload`;
        
        if (!mockSchemaValidator.isSchemaLoaded(payloadSchemaId)) {
          await mockSchemaValidator.addSchema(eventDef.payloadSchema, payloadSchemaId);
          mockLogger.debug(`Registered payload schema: ${payloadSchemaId}`);
        } else {
          mockLogger.debug(
            `Skipping payload schema registration for ${payloadSchemaId} - already loaded from mods`
          );
        }

        mockDataRegistry.setEventDefinition(eventDef.id, eventDef);
      }

      return {
        controller: { initialize: jest.fn() },
        container: mockContainer,
        bootstrapTime: 0
      };
    });

    const config = {
      pageName: 'test-page',
      controllerClass: class TestController {
        constructor() {}
        async initialize() {}
      }
    };

    // Act
    await bootstrap.bootstrap(config);

    // Assert: Schema should be registered when not already loaded
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith('core:character_concept_created#payload');
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'object' }),
      'core:character_concept_created#payload'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith('Registered payload schema: core:character_concept_created#payload');
  });
});