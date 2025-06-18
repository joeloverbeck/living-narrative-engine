// --- FILE START ---
/**
 * @file Test suite for TurnHandlerResolver.
 * @see tests/services/turnHandlerResolver.test.js
 */

import TurnHandlerResolver from '../../src/turns/services/turnHandlerResolver.js';
import Entity from '../../src/entities/entity.js';
import EntityDefinition from '../../src/entities/EntityDefinition.js';
import EntityInstanceData from '../../src/entities/EntityInstanceData.js';
import {
  PLAYER_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../src/constants/componentIds.js';
import { beforeEach, describe, expect, jest, test, afterEach } from '@jest/globals';

// Helper function to create entity instances for testing
const createTestEntity = (instanceId, definitionId, defComponents = {}, instanceOverrides = {}) => {
  const definition = new EntityDefinition(definitionId, { components: defComponents });
  const instanceData = new EntityInstanceData(instanceId, definition, instanceOverrides);
  return new Entity(instanceData);
};

// --- Mock Interfaces/Classes Inline ---
// Simple mock for ILogger
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// Simple mock instance for the player rule (or any ITurnHandler)
const createMockPlayerHandlerInstance = () => ({
  startTurn: jest.fn().mockResolvedValue(undefined),
});

// Simple mock instance for the AI rule (or any ITurnHandler)
const createMockAIHandlerInstance = () => ({
  startTurn: jest.fn().mockResolvedValue(undefined),
});

describe('TurnHandlerResolver', () => {
  let mockLogger;
  let mockPlayerHandlerInstance;
  let mockAIHandlerInstance;
  let mockCreatePlayerHandler;
  let mockCreateAIHandler;
  let handlerRules;
  let resolver;
  let hasComponentSpy;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockLogger = createMockLogger();
    mockPlayerHandlerInstance = createMockPlayerHandlerInstance();
    mockAIHandlerInstance = createMockAIHandlerInstance();
    mockCreatePlayerHandler = jest.fn(() => mockPlayerHandlerInstance);
    mockCreateAIHandler = jest.fn(() => mockAIHandlerInstance);

    // Spy on Entity.prototype.hasComponent for all instances
    hasComponentSpy = jest.spyOn(Entity.prototype, 'hasComponent');

    // Define the handler rules array, which the new resolver expects.
    // The order is important: Player rule should come first to have priority.
    handlerRules = [
      {
        name: 'Player',
        predicate: (actor) => actor.hasComponent(PLAYER_COMPONENT_ID),
        factory: mockCreatePlayerHandler,
      },
      {
        name: 'AI',
        predicate: (actor) => actor.hasComponent(ACTOR_COMPONENT_ID),
        factory: mockCreateAIHandler,
      },
    ];

    // Instantiate the resolver with the new dependency structure
    resolver = new TurnHandlerResolver({
      logger: mockLogger,
      handlerRules: handlerRules,
    });
  });

  afterEach(() => {
    if (hasComponentSpy) {
      hasComponentSpy.mockRestore();
    }
  });

  // --- Constructor Tests ---
  describe('Constructor', () => {
    test('should throw error if logger dependency is missing or invalid', () => {
      const validHandlerRules = []; // A valid (but empty) rules array
      expect(
        () => new TurnHandlerResolver({ handlerRules: validHandlerRules })
      ).toThrow('Missing required dependency: logger.');
      expect(
        () =>
          new TurnHandlerResolver({
            logger: {}, // Invalid logger (missing methods)
            handlerRules: validHandlerRules,
          })
      ).toThrow("Invalid or missing method 'debug' on dependency 'logger'.");
      expect(
        () =>
          new TurnHandlerResolver({
            logger: null, // Invalid logger
            handlerRules: validHandlerRules,
          })
      ).toThrow('Missing required dependency: logger.');
    });

    test('should throw error if handlerRules dependency is missing or not an array', () => {
      const validLogger = createMockLogger();
      const errorMsg =
        'TurnHandlerResolver requires handlerRules to be an array.';
      expect(() => new TurnHandlerResolver({ logger: validLogger })).toThrow(
        errorMsg
      );
      expect(
        () =>
          new TurnHandlerResolver({ logger: validLogger, handlerRules: null })
      ).toThrow(errorMsg);
      expect(
        () => new TurnHandlerResolver({ logger: validLogger, handlerRules: {} })
      ).toThrow(errorMsg);
    });

    test('should initialize successfully with valid dependencies', () => {
      expect(resolver).toBeInstanceOf(TurnHandlerResolver);
      // Check the new log message from the constructor
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnHandlerResolver initialized with 2 handler rules.'
      );
    });
  });

  // --- resolveHandler Tests ---
  describe('Player Actor Handling', () => {
    test('should resolve ActorTurnHandler for an entity with PLAYER_COMPONENT_ID', async () => {
      const playerEntity = createTestEntity('player1', 'dummy-def', { [PLAYER_COMPONENT_ID]: {} });

      const handler = await resolver.resolveHandler(playerEntity);

      expect(mockCreatePlayerHandler).toHaveBeenCalledTimes(1);
      expect(mockCreateAIHandler).not.toHaveBeenCalled();
      expect(handler).toBe(mockPlayerHandlerInstance);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnHandlerResolver: Resolving handler for actor player1...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Match found for actor player1. Applying rule: 'Player'."
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnHandlerResolver: Creating new PlayerHandler for actor player1.'
      );

      // Verify hasComponent was called for the first rule, which matched
      expect(playerEntity.hasComponent).toHaveBeenCalledWith(
        PLAYER_COMPONENT_ID
      );
      // It should not have checked for the second rule
      expect(playerEntity.hasComponent).not.toHaveBeenCalledWith(
        ACTOR_COMPONENT_ID
      );
    });
  });

  describe('AI Actor Handling', () => {
    test('should resolve ActorTurnHandler for an entity with ACTOR_COMPONENT_ID but not PLAYER_COMPONENT_ID', async () => {
      const aiEntity = createTestEntity('ai1', 'dummy-def', { [ACTOR_COMPONENT_ID]: {} });

      const handler = await resolver.resolveHandler(aiEntity);

      expect(mockCreateAIHandler).toHaveBeenCalledTimes(1);
      expect(mockCreatePlayerHandler).not.toHaveBeenCalled();
      expect(handler).toBe(mockAIHandlerInstance);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnHandlerResolver: Resolving handler for actor ai1...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Match found for actor ai1. Applying rule: 'AI'."
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnHandlerResolver: Creating new AIHandler for actor ai1.'
      );

      // Verify hasComponent was called for both rules
      expect(aiEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID); // Checked first
      expect(aiEntity.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID); // Checked second
    });
  });

  describe('Non-Actor / Other Entity Handling', () => {
    test('should return null for an entity without PLAYER_COMPONENT_ID or ACTOR_COMPONENT_ID', async () => {
      const nonActorEntity = createTestEntity('item1', 'dummy-def');

      const handler = await resolver.resolveHandler(nonActorEntity);

      expect(mockCreatePlayerHandler).not.toHaveBeenCalled();
      expect(mockCreateAIHandler).not.toHaveBeenCalled();
      expect(handler).toBeNull();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnHandlerResolver: Resolving handler for actor item1...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnHandlerResolver: No matching rule found for actor item1. Returning null.'
      );
      // Verify both predicates were checked
      expect(nonActorEntity.hasComponent).toHaveBeenCalledWith(
        PLAYER_COMPONENT_ID
      );
      expect(nonActorEntity.hasComponent).toHaveBeenCalledWith(
        ACTOR_COMPONENT_ID
      );
    });

    test('should resolve ActorTurnHandler for an entity with both PLAYER_COMPONENT_ID and ACTOR_COMPONENT_ID', async () => {
      const playerActorEntity = createTestEntity('playerActor', 'dummy-def', {
        [PLAYER_COMPONENT_ID]: {},
        [ACTOR_COMPONENT_ID]: {},
      });

      const handler = await resolver.resolveHandler(playerActorEntity);

      expect(mockCreatePlayerHandler).toHaveBeenCalledTimes(1);
      expect(mockCreateAIHandler).not.toHaveBeenCalled();
      expect(handler).toBe(mockPlayerHandlerInstance);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnHandlerResolver: Resolving handler for actor playerActor...'
      );
      // It should short-circuit after the Player rule matches
      expect(playerActorEntity.hasComponent).toHaveBeenCalledWith(
        PLAYER_COMPONENT_ID
      );
      expect(playerActorEntity.hasComponent).not.toHaveBeenCalledWith(
        ACTOR_COMPONENT_ID
      );
    });

    test('should return null for an entity that only has unrelated components', async () => {
      const sceneryEntity = createTestEntity('scenery1', 'dummy-def', { 'component:description': {} });

      const handler = await resolver.resolveHandler(sceneryEntity);

      expect(mockCreatePlayerHandler).not.toHaveBeenCalled();
      expect(mockCreateAIHandler).not.toHaveBeenCalled();
      expect(handler).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnHandlerResolver: Resolving handler for actor scenery1...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnHandlerResolver: No matching rule found for actor scenery1. Returning null.'
      );
      expect(sceneryEntity.hasComponent).toHaveBeenCalledWith(
        PLAYER_COMPONENT_ID
      );
      expect(sceneryEntity.hasComponent).toHaveBeenCalledWith(
        ACTOR_COMPONENT_ID
      );
    });
  });

  describe('Invalid Input Handling', () => {
    test('should return null and log warning for invalid actor input (null)', async () => {
      const handler = await resolver.resolveHandler(null);

      expect(mockCreatePlayerHandler).not.toHaveBeenCalled();
      expect(mockCreateAIHandler).not.toHaveBeenCalled();
      expect(handler).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.'
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Resolving handler for actor')
      );
    });

    test('should return null and log warning for invalid actor input (missing id)', async () => {
      const invalidEntity = { name: 'invalid', hasComponent: jest.fn() };
      const handler = await resolver.resolveHandler(invalidEntity);

      expect(mockCreatePlayerHandler).not.toHaveBeenCalled();
      expect(mockCreateAIHandler).not.toHaveBeenCalled();
      expect(handler).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.'
      );
      expect(invalidEntity.hasComponent).not.toHaveBeenCalled();
    });

    test('should return null and log warning for invalid actor input (undefined)', async () => {
      const handler = await resolver.resolveHandler(undefined);

      expect(mockCreatePlayerHandler).not.toHaveBeenCalled();
      expect(mockCreateAIHandler).not.toHaveBeenCalled();
      expect(handler).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.'
      );
    });
  });
});
