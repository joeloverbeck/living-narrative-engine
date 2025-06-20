/**
 * @file Unit tests for the ActionContextBuilder.
 * @module tests/turns/prompting/actionContextBuilder
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import ActionContextBuilder from '../../../../src/turns/prompting/actionContextBuilder.js';
import { PromptError } from '../../../../src/errors/promptError.js';
import Entity from '../../../../src/entities/entity.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../../src/entities/entityInstanceData.js';

// ─────────────────────────────────────────────────────────────────────────────

// Mock factory functions for dependencies
const createMockWorldContext = () => ({
  getLocationOfEntity: jest.fn(),
});

const createMockEntityManager = () => ({
  // Add methods here if they become needed by the builder
});

const createMockGameDataRepository = () => ({
  // Add methods here if they become needed by the builder
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// Helper function to create entity instances for testing
const createTestEntity = (
  instanceId,
  definitionId,
  defComponents = {},
  instanceOverrides = {}
) => {
  const definition = new EntityDefinition(definitionId, {
    description: `Test Definition ${definitionId}`,
    components: defComponents,
  });
  const instanceData = new EntityInstanceData(
    instanceId,
    definition,
    instanceOverrides
  );
  return new Entity(instanceData);
};

describe('ActionContextBuilder', () => {
  let mockWorldContext;
  let mockEntityManager;
  let mockGameDataRepository;
  let mockLogger;
  let builder;

  beforeEach(() => {
    // Reset mocks before each test
    mockWorldContext = createMockWorldContext();
    mockEntityManager = createMockEntityManager();
    mockGameDataRepository = createMockGameDataRepository();
    mockLogger = createMockLogger();

    // Instantiate the builder with fresh mocks
    builder = new ActionContextBuilder({
      worldContext: mockWorldContext,
      entityManager: mockEntityManager,
      gameDataRepository: mockGameDataRepository,
      logger: mockLogger,
    });
  });

  describe('Constructor', () => {
    it('should throw an error if worldContext is missing', () => {
      expect(
        () =>
          new ActionContextBuilder({
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
          })
      ).toThrow('Missing required dependency: worldContext.');
    });

    it('should throw an error if entityManager is missing', () => {
      expect(
        () =>
          new ActionContextBuilder({
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
          })
      ).toThrow('Missing required dependency: entityManager.');
    });

    it('should throw an error if gameDataRepository is missing', () => {
      expect(
        () =>
          new ActionContextBuilder({
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            logger: mockLogger,
          })
      ).toThrow('Missing required dependency: gameDataRepository.');
    });

    it('should throw an error if logger is missing', () => {
      expect(
        () =>
          new ActionContextBuilder({
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
          })
      ).toThrow('Missing required dependency: logger.');
    });

    it('should throw if a dependency is missing a required method', () => {
      const incompleteWorldContext = {}; // Missing getLocationOfEntity
      expect(
        () =>
          new ActionContextBuilder({
            worldContext: incompleteWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
          })
      ).toThrow(
        "Invalid or missing method 'getLocationOfEntity' on dependency 'worldContext'."
      );
    });
  });

  describe('buildContext', () => {
    let actor;
    let location;

    beforeEach(() => {
      actor = createTestEntity('actor-1', 'player-def');
      location = createTestEntity('location-1', 'room-def');
    });

    it('should return a valid ActionContext on the happy path', async () => {
      // Arrange
      mockWorldContext.getLocationOfEntity.mockResolvedValue(location);

      // Act
      const context = await builder.buildContext(actor);

      // Assert
      expect(context).toBeDefined();
      expect(context).toBeInstanceOf(Object);

      // Check for correct keys
      expect(Object.keys(context)).toEqual(
        expect.arrayContaining([
          'actingEntity',
          'currentLocation',
          'entityManager',
          'gameDataRepository',
          'logger',
          'worldContext',
        ])
      );

      // Check that references are passed through correctly
      expect(context.actingEntity).toBe(actor);
      expect(context.currentLocation).toBe(location);
      expect(context.entityManager).toBe(mockEntityManager);
      expect(context.gameDataRepository).toBe(mockGameDataRepository);
      expect(context.logger).toBe(mockLogger);
      expect(context.worldContext).toBe(mockWorldContext);

      // Verify collaborator was called correctly
      expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledWith(
        actor.id
      );
      expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledTimes(1);
    });

    it('should throw a PromptError with code INVALID_ACTOR if the actor is null', async () => {
      // Arrange
      const expectedError = new PromptError(
        'Cannot build ActionContext: actor is invalid or has no ID.',
        null,
        'INVALID_ACTOR'
      );

      // Act & Assert
      await expect(builder.buildContext(null)).rejects.toThrow(expectedError);
    });

    it('should throw a PromptError with code INVALID_ACTOR if the actor is undefined', async () => {
      // Arrange
      const expectedError = new PromptError(
        'Cannot build ActionContext: actor is invalid or has no ID.',
        null,
        'INVALID_ACTOR'
      );

      // Act & Assert
      await expect(builder.buildContext(undefined)).rejects.toThrow(
        expectedError
      );
    });

    it('should throw a PromptError with code INVALID_ACTOR if actor.id is an empty string', async () => {
      // Arrange
      // Create a mock actor object with an empty ID to specifically test ActionContextBuilder's validation
      const actorWithEmptyId = {
        id: '',
        // Add other Entity methods as jest.fn() if buildContext calls them before the ID check for other reasons.
        // Based on current buildContext, only 'id' is strictly needed for this specific failure path.
        hasComponent: jest.fn(),
        getComponentData: jest.fn(),
        get definitionId() {
          return 'mock-def';
        },
        get instanceData() {
          return { instanceId: '' };
        },
      };
      const expectedError = new PromptError(
        'Cannot build ActionContext: actor is invalid or has no ID.',
        null,
        'INVALID_ACTOR'
      );

      // Act & Assert
      await expect(builder.buildContext(actorWithEmptyId)).rejects.toThrow(
        expectedError
      );
    });

    it('should throw a PromptError with code INVALID_ACTOR if actor.id is a string of just whitespace', async () => {
      // Arrange
      // Create a mock actor object with a whitespace ID
      const actorWithWhitespaceId = {
        id: '   ',
        hasComponent: jest.fn(),
        getComponentData: jest.fn(),
        get definitionId() {
          return 'mock-def';
        },
        get instanceData() {
          return { instanceId: '   ' };
        },
      };
      const expectedError = new PromptError(
        'Cannot build ActionContext: actor is invalid or has no ID.',
        null,
        'INVALID_ACTOR'
      );

      // Act & Assert
      await expect(builder.buildContext(actorWithWhitespaceId)).rejects.toThrow(
        expectedError
      );
    });

    it('should throw a PromptError with code LOCATION_NOT_FOUND if the location is missing', async () => {
      // Arrange
      mockWorldContext.getLocationOfEntity.mockResolvedValue(null);
      const expectedError = new PromptError(
        `Location not found for actor with ID: ${actor.id}`,
        null,
        'LOCATION_NOT_FOUND'
      );

      // Act & Assert
      await expect(builder.buildContext(actor)).rejects.toThrow(expectedError);
      expect(mockWorldContext.getLocationOfEntity).toHaveBeenCalledWith(
        actor.id
      );
    });
  });
});
