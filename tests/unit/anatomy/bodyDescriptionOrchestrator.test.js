import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyDescriptionOrchestrator } from '../../../src/anatomy/BodyDescriptionOrchestrator.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

describe('BodyDescriptionOrchestrator', () => {
  let orchestrator;
  let mockLogger;
  let mockBodyDescriptionComposer;
  let mockBodyGraphService;
  let mockEventDispatcher;
  let mockEntityManager;
  let mockPartDescriptionGenerator;

  // Helper function to create mock entities
  const createMockBodyEntity = (config = {}) => ({
    id: config.id || 'test-entity-1',
    hasComponent: jest.fn().mockImplementation((componentId) => {
      if (componentId === ANATOMY_BODY_COMPONENT_ID) {
        return config.hasAnatomyBody !== false;
      }
      if (componentId === DESCRIPTION_COMPONENT_ID) {
        return config.hasDescription === true;
      }
      return false;
    }),
    getComponentData: jest.fn().mockImplementation((componentId) => {
      if (componentId === ANATOMY_BODY_COMPONENT_ID) {
        return (
          config.anatomyBodyData || {
            body: { root: 'root-1' },
            recipeId: 'test-recipe',
          }
        );
      }
      if (componentId === 'core:name') {
        return config.nameData || { text: 'Test Entity' };
      }
      if (componentId === DESCRIPTION_COMPONENT_ID) {
        return config.descriptionData || null;
      }
      return null;
    }),
  });

  beforeEach(() => {
    // Create mocks
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBodyDescriptionComposer = {
      composeDescription: jest.fn().mockResolvedValue('Default description'),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn().mockReturnValue(['part-1', 'part-2', 'part-3']),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockPartDescriptionGenerator = {
      generateMultiplePartDescriptions: jest.fn().mockReturnValue(
        new Map([
          ['part-1', 'A strong arm'],
          ['part-2', 'A muscular torso'],
          ['part-3', 'Sturdy legs'],
        ])
      ),
    };

    // Create orchestrator instance
    orchestrator = new BodyDescriptionOrchestrator({
      logger: mockLogger,
      bodyDescriptionComposer: mockBodyDescriptionComposer,
      bodyGraphService: mockBodyGraphService,
      eventDispatcher: mockEventDispatcher,
      entityManager: mockEntityManager,
      partDescriptionGenerator: mockPartDescriptionGenerator,
    });
  });

  describe('constructor', () => {
    it('should throw error if logger is not provided', () => {
      expect(
        () =>
          new BodyDescriptionOrchestrator({
            bodyDescriptionComposer: mockBodyDescriptionComposer,
            bodyGraphService: mockBodyGraphService,
            eventDispatcher: mockEventDispatcher,
            entityManager: mockEntityManager,
            partDescriptionGenerator: mockPartDescriptionGenerator,
          })
      ).toThrow('logger is required');
    });

    it('should throw error if bodyDescriptionComposer is not provided', () => {
      expect(
        () =>
          new BodyDescriptionOrchestrator({
            logger: mockLogger,
            bodyGraphService: mockBodyGraphService,
            eventDispatcher: mockEventDispatcher,
            entityManager: mockEntityManager,
            partDescriptionGenerator: mockPartDescriptionGenerator,
          })
      ).toThrow('bodyDescriptionComposer is required');
    });

    it('should throw error if eventDispatcher is not provided', () => {
      expect(
        () =>
          new BodyDescriptionOrchestrator({
            logger: mockLogger,
            bodyDescriptionComposer: mockBodyDescriptionComposer,
            bodyGraphService: mockBodyGraphService,
            entityManager: mockEntityManager,
            partDescriptionGenerator: mockPartDescriptionGenerator,
          })
      ).toThrow('eventDispatcher is required');
    });

    it('should throw error if bodyGraphService is not provided', () => {
      expect(
        () =>
          new BodyDescriptionOrchestrator({
            logger: mockLogger,
            bodyDescriptionComposer: mockBodyDescriptionComposer,
            eventDispatcher: mockEventDispatcher,
            entityManager: mockEntityManager,
            partDescriptionGenerator: mockPartDescriptionGenerator,
          })
      ).toThrow('bodyGraphService is required');
    });

    it('should throw error if entityManager is not provided', () => {
      expect(
        () =>
          new BodyDescriptionOrchestrator({
            logger: mockLogger,
            bodyDescriptionComposer: mockBodyDescriptionComposer,
            bodyGraphService: mockBodyGraphService,
            eventDispatcher: mockEventDispatcher,
            partDescriptionGenerator: mockPartDescriptionGenerator,
          })
      ).toThrow('entityManager is required');
    });

    it('should throw error if partDescriptionGenerator is not provided', () => {
      expect(
        () =>
          new BodyDescriptionOrchestrator({
            logger: mockLogger,
            bodyDescriptionComposer: mockBodyDescriptionComposer,
            bodyGraphService: mockBodyGraphService,
            eventDispatcher: mockEventDispatcher,
            entityManager: mockEntityManager,
          })
      ).toThrow('partDescriptionGenerator is required');
    });
  });

  describe('generateBodyDescription', () => {
    it('should return composed description when successful', async () => {
      const entity = createMockBodyEntity();
      const expectedDescription = 'A tall figure with broad shoulders';
      mockBodyDescriptionComposer.composeDescription.mockReturnValue(
        expectedDescription
      );

      const result = await orchestrator.generateBodyDescription(entity);

      expect(result).toBe(expectedDescription);
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(entity);
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `BodyDescriptionOrchestrator: Generated body description for '${entity.id}'`
      );
    });

    it('should dispatch error event when description is empty string', async () => {
      const entity = createMockBodyEntity({ nameData: { text: 'John Doe' } });
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      const result = await orchestrator.generateBodyDescription(entity);

      expect(result).toBe('');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message:
            'Failed to generate body description for entity "John Doe": Description is empty',
          details: {
            raw: 'Entity ID: test-entity-1, Recipe ID: test-recipe',
            timestamp: expect.any(String),
          },
        }
      );
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      // Verify the first parameter is a string
      expect(typeof mockEventDispatcher.dispatch.mock.calls[0][0]).toBe(
        'string'
      );
      // Verify the second parameter is an object
      expect(typeof mockEventDispatcher.dispatch.mock.calls[0][1]).toBe(
        'object'
      );
    });

    it('should dispatch error event when description is only whitespace', async () => {
      const entity = createMockBodyEntity();
      mockBodyDescriptionComposer.composeDescription.mockReturnValue(
        '   \n\t  '
      );

      const result = await orchestrator.generateBodyDescription(entity);

      expect(result).toBe('   \n\t  ');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Description is empty'),
        })
      );
    });

    it('should dispatch error event when description is null', async () => {
      const entity = createMockBodyEntity();
      mockBodyDescriptionComposer.composeDescription.mockReturnValue(null);

      const result = await orchestrator.generateBodyDescription(entity);

      expect(result).toBe(null);
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Description is empty'),
        })
      );
    });

    it('should use entity ID in error message when name is not available', async () => {
      const entity = createMockBodyEntity({ nameData: null });
      entity.getComponentData.mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return { body: { root: 'root-1' }, recipeId: 'test-recipe' };
        }
        if (componentId === 'core:name') {
          return null; // No name data
        }
        return null;
      });
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      await orchestrator.generateBodyDescription(entity);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message:
            'Failed to generate body description for entity "test-entity-1": Description is empty',
        })
      );
    });

    it('should include recipe ID in error details when available', async () => {
      const entity = createMockBodyEntity({
        anatomyBodyData: { body: { root: 'root-1' }, recipeId: 'human-male' },
      });
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      await orchestrator.generateBodyDescription(entity);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          details: expect.objectContaining({
            raw: 'Entity ID: test-entity-1, Recipe ID: human-male',
          }),
        })
      );
    });

    it('should handle missing recipe ID gracefully', async () => {
      const entity = createMockBodyEntity({
        anatomyBodyData: { body: { root: 'root-1' } }, // No recipeId
      });
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      await orchestrator.generateBodyDescription(entity);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          details: expect.objectContaining({
            raw: 'Entity ID: test-entity-1, Recipe ID: unknown',
          }),
        })
      );
    });

    it('should not dispatch error event when description is valid', async () => {
      const entity = createMockBodyEntity();
      mockBodyDescriptionComposer.composeDescription.mockReturnValue(
        'Valid description'
      );

      await orchestrator.generateBodyDescription(entity);

      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should verify event dispatcher receives correct parameter types', async () => {
      const entity = createMockBodyEntity();
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      await orchestrator.generateBodyDescription(entity);

      // Get the call arguments
      const [eventId, payload] = mockEventDispatcher.dispatch.mock.calls[0];

      // Verify parameter types
      expect(typeof eventId).toBe('string');
      expect(eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
      expect(typeof payload).toBe('object');
      expect(payload).toHaveProperty('message');
      expect(payload).toHaveProperty('details');

      // Ensure we're NOT passing an event object as the first parameter
      expect(eventId).not.toHaveProperty('type');
      expect(eventId).not.toHaveProperty('payload');
    });
  });

  describe('generateAllDescriptions', () => {
    it('should generate descriptions for all parts and body', async () => {
      const entity = createMockBodyEntity();
      const bodyDescription = 'A well-built figure';
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        bodyDescription
      );

      const result = await orchestrator.generateAllDescriptions(entity);

      expect(result).toEqual({
        bodyDescription,
        partDescriptions: expect.any(Map),
      });
      expect(result.partDescriptions.size).toBe(3);
      expect(mockBodyGraphService.getAllParts).toHaveBeenCalledWith({
        root: 'root-1',
      });
      expect(
        mockPartDescriptionGenerator.generateMultiplePartDescriptions
      ).toHaveBeenCalledWith(['part-1', 'part-2', 'part-3']);
    });

    it('should throw error if entity has no anatomy:body component', async () => {
      const entity = createMockBodyEntity({ hasAnatomyBody: false });

      await expect(
        orchestrator.generateAllDescriptions(entity)
      ).rejects.toThrow('Entity must have an anatomy:body component');
    });

    it('should throw error if body component has no root', async () => {
      const entity = createMockBodyEntity({
        anatomyBodyData: { body: {} }, // No root
      });

      await expect(
        orchestrator.generateAllDescriptions(entity)
      ).rejects.toThrow('Body component must have a body.root property');
    });

    it('should dispatch error event when body description is empty', async () => {
      const entity = createMockBodyEntity();
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      const result = await orchestrator.generateAllDescriptions(entity);

      expect(result.bodyDescription).toBe('');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    it('should throw error when entity is null', async () => {
      await expect(orchestrator.generateAllDescriptions(null)).rejects.toThrow(
        'Entity must have an anatomy:body component'
      );
    });
  });

  describe('getOrGenerateBodyDescription', () => {
    it('should return null for null entity', async () => {
      const result = await orchestrator.getOrGenerateBodyDescription(null);
      expect(result).toBeNull();
    });

    it('should return existing description for non-anatomy entity', async () => {
      const entity = createMockBodyEntity({
        hasAnatomyBody: false,
        hasDescription: true,
        descriptionData: { text: 'A simple object' },
      });

      const result = await orchestrator.getOrGenerateBodyDescription(entity);
      expect(result).toBe('A simple object');
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).not.toHaveBeenCalled();
    });

    it('should return null for non-anatomy entity without description', async () => {
      const entity = createMockBodyEntity({
        hasAnatomyBody: false,
        hasDescription: false,
      });

      const result = await orchestrator.getOrGenerateBodyDescription(entity);
      expect(result).toBeNull();
    });

    it('should generate new description for anatomy entity', async () => {
      const entity = createMockBodyEntity();
      const expectedDescription = 'Generated description';
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        expectedDescription
      );

      const result = await orchestrator.getOrGenerateBodyDescription(entity);
      expect(result).toBe(expectedDescription);
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(entity);
    });

    it('should always regenerate description (isDescriptionCurrent returns false)', async () => {
      const entity = createMockBodyEntity({
        hasDescription: true,
        descriptionData: { text: 'Old description' },
      });
      const newDescription = 'New generated description';
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        newDescription
      );

      const result = await orchestrator.getOrGenerateBodyDescription(entity);
      expect(result).toBe(newDescription);
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(entity);
    });

    it('should return existing description when metadata marks it as current', async () => {
      const entity = createMockBodyEntity({
        hasDescription: true,
        descriptionData: {
          text: 'Existing current description',
          metadata: { isCurrent: true },
        },
      });

      const result = await orchestrator.getOrGenerateBodyDescription(entity);

      expect(result).toBe('Existing current description');
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).not.toHaveBeenCalled();
    });

    it('should return null when composition fails', async () => {
      const entity = createMockBodyEntity();
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(null);

      const result = await orchestrator.getOrGenerateBodyDescription(entity);
      expect(result).toBeNull();
    });
  });

  describe('error event dispatch verification', () => {
    it('should ensure event dispatcher is called with correct signature', async () => {
      const entity = createMockBodyEntity();
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      // Spy on the dispatch method to capture exact calls
      const dispatchSpy = jest.spyOn(mockEventDispatcher, 'dispatch');

      await orchestrator.generateBodyDescription(entity);

      // Verify the dispatch method signature
      expect(dispatchSpy).toHaveBeenCalledTimes(1);

      // Get the actual arguments passed
      const callArgs = dispatchSpy.mock.calls[0];

      // First argument should be the event ID string
      expect(callArgs[0]).toBe(SYSTEM_ERROR_OCCURRED_ID);
      expect(typeof callArgs[0]).toBe('string');

      // Second argument should be the payload object
      expect(callArgs[1]).toMatchObject({
        message: expect.any(String),
        details: expect.any(Object),
      });

      // Ensure we have exactly 2 arguments (not passing options or other params)
      expect(callArgs.length).toBe(2);
    });

    it('should never pass event object as first parameter', async () => {
      const entity = createMockBodyEntity();
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      await orchestrator.generateBodyDescription(entity);

      const firstArg = mockEventDispatcher.dispatch.mock.calls[0][0];

      // Verify the first argument is a string, not an object
      expect(typeof firstArg).toBe('string');

      // If it were an object (bug scenario), it would have these properties
      if (typeof firstArg === 'object' && firstArg !== null) {
        expect(firstArg).not.toHaveProperty('type');
        expect(firstArg).not.toHaveProperty('payload');
      }

      // Ensure it's the correct event ID string
      expect(firstArg).toBe(SYSTEM_ERROR_OCCURRED_ID);
    });
  });
});
