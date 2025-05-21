// src/tests/core/services/turnHandlerResolver.test.js
// --- FILE START (Entire file content as requested) ---

import TurnHandlerResolver from '../../src/turns/services/turnHandlerResolver.js';
import Entity from '../../src/entities/entity.js';
import {PLAYER_COMPONENT_ID, ACTOR_COMPONENT_ID} from '../../src/constants/componentIds.js';
import {beforeEach, describe, expect, jest, test} from "@jest/globals";

// --- Mock Interfaces/Classes Inline ---
// Simple mock for ILogger
const createMockLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
});

// Simple mock instance for PlayerTurnHandler (or any ITurnHandler)
// Renamed from createMockPlayerTurnHandler to avoid confusion with factory
const createMockPlayerHandlerInstance = () => ({
    startTurn: jest.fn().mockResolvedValue(undefined), // Mock a required method
    // Add other methods if needed by tests or code
});

// Simple mock instance for AITurnHandler (or any ITurnHandler)
// Renamed from createMockAITurnHandler to avoid confusion with factory
const createMockAIHandlerInstance = () => ({
    startTurn: jest.fn().mockResolvedValue(undefined), // Mock a required method
    // Add other methods if needed by tests or code
});


describe('TurnHandlerResolver', () => {
    let mockLogger;
    // Mocks for the handler *instances* returned by factories
    let mockPlayerHandlerInstance;
    let mockAIHandlerInstance;
    // Mocks for the *factory functions* passed to the constructor
    let mockCreatePlayerTurnHandler;
    let mockCreateAITurnHandler;
    let resolver;

    beforeEach(() => {
        // Create fresh mocks for each test
        mockLogger = createMockLogger();
        // Create the instances that the factories will return
        mockPlayerHandlerInstance = createMockPlayerHandlerInstance();
        mockAIHandlerInstance = createMockAIHandlerInstance();
        // Create the mock factory functions
        mockCreatePlayerTurnHandler = jest.fn(() => mockPlayerHandlerInstance);
        mockCreateAITurnHandler = jest.fn(() => mockAIHandlerInstance);

        // Instantiate the resolver with the mock factories
        resolver = new TurnHandlerResolver({
            logger: mockLogger,
            createPlayerTurnHandler: mockCreatePlayerTurnHandler, // Pass factory
            createAiTurnHandler: mockCreateAITurnHandler      // Pass factory
        });
    });

    // --- Constructor Tests ---
    test('should throw error if logger dependency is missing or invalid', () => {
        // We need valid *factories* for this test
        const validPlayerFactory = jest.fn(() => createMockPlayerHandlerInstance());
        const validAiFactory = jest.fn(() => createMockAIHandlerInstance());

        expect(() => new TurnHandlerResolver({
            // logger missing
            createPlayerTurnHandler: validPlayerFactory,
            createAiTurnHandler: validAiFactory
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
        expect(() => new TurnHandlerResolver({
            logger: {}, // Invalid logger (missing methods)
            createPlayerTurnHandler: validPlayerFactory,
            createAiTurnHandler: validAiFactory
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
        expect(() => new TurnHandlerResolver({
            logger: null, // Invalid logger
            createPlayerTurnHandler: validPlayerFactory,
            createAiTurnHandler: validAiFactory
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
    });

    test('should throw error if createPlayerTurnHandler factory is missing or invalid', () => {
        // Need a valid logger and AI factory for this test
        const validLogger = createMockLogger();
        const validAiFactory = jest.fn(() => createMockAIHandlerInstance());

        expect(() => new TurnHandlerResolver({
            logger: validLogger,
            // createPlayerTurnHandler missing
            createAiTurnHandler: validAiFactory
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing createPlayerTurnHandler factory function.');
        expect(() => new TurnHandlerResolver({
            logger: validLogger,
            createPlayerTurnHandler: {}, // Invalid factory (not a function)
            createAiTurnHandler: validAiFactory
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing createPlayerTurnHandler factory function.');
        expect(() => new TurnHandlerResolver({
            logger: validLogger,
            createPlayerTurnHandler: null, // Invalid factory
            createAiTurnHandler: validAiFactory
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing createPlayerTurnHandler factory function.');
    });

    test('should throw error if createAiTurnHandler factory is missing or invalid', () => {
        // Need a valid logger and Player factory for this test
        const validLogger = createMockLogger();
        const validPlayerFactory = jest.fn(() => createMockPlayerHandlerInstance());

        expect(() => new TurnHandlerResolver({
            logger: validLogger,
            createPlayerTurnHandler: validPlayerFactory
            // createAiTurnHandler missing
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing createAiTurnHandler factory function.');
        expect(() => new TurnHandlerResolver({
            logger: validLogger,
            createPlayerTurnHandler: validPlayerFactory,
            createAiTurnHandler: {} // Invalid factory (not a function)
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing createAiTurnHandler factory function.');
        expect(() => new TurnHandlerResolver({
            logger: validLogger,
            createPlayerTurnHandler: validPlayerFactory,
            createAiTurnHandler: null // Invalid factory
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing createAiTurnHandler factory function.');
    });

    test('should initialize successfully with valid dependencies', () => {
        // The beforeEach block already does this, so we just check the result
        expect(resolver).toBeInstanceOf(TurnHandlerResolver);
        // Check the log message from the constructor
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver initialized with handler factories.');
    });

    // --- resolveHandler Tests ---
    describe('Player Actor Handling', () => {
        test('should resolve PlayerTurnHandler for an entity with PLAYER_COMPONENT_ID', async () => {
            const playerEntity = new Entity('player1', 'dummy');
            playerEntity.hasComponent = jest.fn((componentId) => componentId === PLAYER_COMPONENT_ID);
            playerEntity.addComponent(PLAYER_COMPONENT_ID, {});

            const handler = await resolver.resolveHandler(playerEntity);

            // Check correct factory was called
            expect(mockCreatePlayerTurnHandler).toHaveBeenCalledTimes(1);
            expect(mockCreateAITurnHandler).not.toHaveBeenCalled();
            // Check handler instance returned by factory is the result
            expect(handler).toBe(mockPlayerHandlerInstance);

            // Check logging
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor player1...');
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Creating new PlayerTurnHandler for actor player1.'); // Log message updated
            // Verify hasComponent was called correctly
            expect(playerEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            expect(playerEntity.hasComponent).not.toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
        });
    });

    describe('AI Actor Handling', () => {
        test('should resolve AITurnHandler for an entity with ACTOR_COMPONENT_ID but not PLAYER_COMPONENT_ID', async () => {
            const aiEntity = new Entity('ai1', 'dummy');
            aiEntity.hasComponent = jest.fn((componentId) => {
                if (componentId === ACTOR_COMPONENT_ID) return true;
                if (componentId === PLAYER_COMPONENT_ID) return false;
                return false;
            });
            aiEntity.addComponent(ACTOR_COMPONENT_ID, {});

            const handler = await resolver.resolveHandler(aiEntity);

            // Check correct factory was called
            expect(mockCreateAITurnHandler).toHaveBeenCalledTimes(1);
            expect(mockCreatePlayerTurnHandler).not.toHaveBeenCalled();
            // Check handler instance returned by factory is the result
            expect(handler).toBe(mockAIHandlerInstance);

            // Check logging
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor ai1...');
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Creating new AITurnHandler for actor ai1.'); // Log message updated
            // Verify hasComponent was called correctly (order matters)
            expect(aiEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID); // Checked first
            expect(aiEntity.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID);  // Checked second
        });

        test('should log info when resolving AITurnHandler', async () => {
            const aiEntity = new Entity('ai2', 'dummy');
            aiEntity.hasComponent = jest.fn((componentId) => {
                if (componentId === ACTOR_COMPONENT_ID) return true;
                if (componentId === PLAYER_COMPONENT_ID) return false;
                return false;
            });
            aiEntity.addComponent(ACTOR_COMPONENT_ID, {});

            await resolver.resolveHandler(aiEntity);

            // Verify logging (debug and info)
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor ai2...');
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Creating new AITurnHandler for actor ai2.');
            // Verify factory call
            expect(mockCreateAITurnHandler).toHaveBeenCalledTimes(1);
        });
    });

    describe('Non-Actor / Other Entity Handling', () => {
        test('should return null for an entity without PLAYER_COMPONENT_ID or ACTOR_COMPONENT_ID', async () => {
            const nonActorEntity = new Entity('item1', 'dummy');
            nonActorEntity.hasComponent = jest.fn().mockReturnValue(false);

            const handler = await resolver.resolveHandler(nonActorEntity);

            // Check factories were NOT called
            expect(mockCreatePlayerTurnHandler).not.toHaveBeenCalled();
            expect(mockCreateAITurnHandler).not.toHaveBeenCalled();
            // Check result is null
            expect(handler).toBeNull();

            // Check logging
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor item1...');
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: No specific turn handler factory found for actor item1. Returning null.'); // Log message updated
            // Verify hasComponent was called correctly
            expect(nonActorEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            expect(nonActorEntity.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
        });

        // Test that Player takes precedence
        test('should resolve PlayerTurnHandler for an entity with both PLAYER_COMPONENT_ID and ACTOR_COMPONENT_ID', async () => {
            const playerActorEntity = new Entity('playerActor', 'dummy');
            playerActorEntity.hasComponent = jest.fn((componentId) => {
                return componentId === ACTOR_COMPONENT_ID || componentId === PLAYER_COMPONENT_ID;
            });
            playerActorEntity.addComponent(PLAYER_COMPONENT_ID, {});
            playerActorEntity.addComponent(ACTOR_COMPONENT_ID, {});

            const handler = await resolver.resolveHandler(playerActorEntity);

            // Check ONLY player factory was called
            expect(mockCreatePlayerTurnHandler).toHaveBeenCalledTimes(1);
            expect(mockCreateAITurnHandler).not.toHaveBeenCalled();
            // Check correct instance is returned
            expect(handler).toBe(mockPlayerHandlerInstance);

            // Check logging
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor playerActor...');
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Creating new PlayerTurnHandler for actor playerActor.');
            // Verify hasComponent calls (should short-circuit after player)
            expect(playerActorEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            expect(playerActorEntity.hasComponent).not.toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
            // Ensure other logs didn't happen
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('AITurnHandler'));
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('No specific turn handler factory found'));
        });

        test('should return null for an entity that only has unrelated components', async () => {
            const sceneryEntity = new Entity('scenery1', 'dummy');
            sceneryEntity.addComponent('component:description', {text: 'A nice tree'});
            sceneryEntity.hasComponent = jest.fn((componentId) => {
                if (componentId === 'component:description') return true;
                return false; // Not player, not actor
            });

            const handler = await resolver.resolveHandler(sceneryEntity);

            // Check factories were NOT called
            expect(mockCreatePlayerTurnHandler).not.toHaveBeenCalled();
            expect(mockCreateAITurnHandler).not.toHaveBeenCalled();
            // Check result is null
            expect(handler).toBeNull();

            // Check logging
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor scenery1...');
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: No specific turn handler factory found for actor scenery1. Returning null.');
            // Verify hasComponent checks
            expect(sceneryEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            expect(sceneryEntity.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
        });
    });

    describe('Invalid Input Handling', () => {
        test('should return null and log warning for invalid actor input (null)', async () => {
            const handler = await resolver.resolveHandler(null);

            // Check factories were NOT called
            expect(mockCreatePlayerTurnHandler).not.toHaveBeenCalled();
            expect(mockCreateAITurnHandler).not.toHaveBeenCalled();
            // Check result is null
            expect(handler).toBeNull();
            // Check logging
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.');
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Attempting to resolve turn handler for actor'));
        });

        test('should return null and log warning for invalid actor input (missing id)', async () => {
            const invalidEntity = {name: 'invalid', hasComponent: jest.fn()};
            const handler = await resolver.resolveHandler(invalidEntity);

            // Check factories were NOT called
            expect(mockCreatePlayerTurnHandler).not.toHaveBeenCalled();
            expect(mockCreateAITurnHandler).not.toHaveBeenCalled();
            // Check result is null
            expect(handler).toBeNull();
            // Check logging
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.');
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Attempting to resolve turn handler for actor'));
            // Ensure hasComponent wasn't called on the invalid object
            expect(invalidEntity.hasComponent).not.toHaveBeenCalled();
        });

        test('should return null and log warning for invalid actor input (undefined)', async () => {
            const handler = await resolver.resolveHandler(undefined);

            // Check factories were NOT called
            expect(mockCreatePlayerTurnHandler).not.toHaveBeenCalled();
            expect(mockCreateAITurnHandler).not.toHaveBeenCalled();
            // Check result is null
            expect(handler).toBeNull();
            // Check logging
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.');
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Attempting to resolve turn handler for actor'));
        });
    });
});
// --- FILE END ---