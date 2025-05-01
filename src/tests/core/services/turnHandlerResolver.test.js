// src/tests/core/services/turnHandlerResolver.test.js
// --- FILE START (Entire file content as requested) ---

import TurnHandlerResolver from '../../../core/services/turnHandlerResolver.js';
// Handlers are imported only for type checking/instanceof, not execution
// import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
// import AITurnHandler from '../../../core/handlers/aiTurnHandler.js';
import Entity from '../../../entities/entity.js';
import {PLAYER_COMPONENT_ID, ACTOR_COMPONENT_ID} from '../../../types/components.js'; // Added ACTOR_COMPONENT_ID
import {beforeEach, describe, expect, jest, test} from "@jest/globals";
// --- Removed dependency on testUtils.js ---

// --- Mock Interfaces/Classes Inline ---
// Simple mock for ILogger
const createMockLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
});

// Simple mock for PlayerTurnHandler (or any ITurnHandler)
const createMockPlayerTurnHandler = () => ({
    handleTurn: jest.fn().mockResolvedValue(undefined), // Mock the required method
    // Add other methods if TurnHandlerResolver interacts with them
});

// Simple mock for AITurnHandler (or any ITurnHandler)
const createMockAITurnHandler = () => ({
    handleTurn: jest.fn().mockResolvedValue(undefined), // Mock the required method
});


describe('TurnHandlerResolver', () => {
    let mockLogger;
    let mockPlayerTurnHandler;
    let mockAITurnHandler; // Added mock AI handler
    let resolver;

    beforeEach(() => {
        // Create fresh mocks for each test
        mockLogger = createMockLogger();
        mockPlayerTurnHandler = createMockPlayerTurnHandler();
        mockAITurnHandler = createMockAITurnHandler(); // Create mock AI handler

        resolver = new TurnHandlerResolver({
            logger: mockLogger,
            playerTurnHandler: mockPlayerTurnHandler,
            aiTurnHandler: mockAITurnHandler // Inject mock AI handler
        });
    });

    // --- Constructor Tests ---
    test('should throw error if logger dependency is missing or invalid', () => {
        expect(() => new TurnHandlerResolver({
            playerTurnHandler: mockPlayerTurnHandler,
            aiTurnHandler: mockAITurnHandler
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
        expect(() => new TurnHandlerResolver({
            logger: {},
            playerTurnHandler: mockPlayerTurnHandler,
            aiTurnHandler: mockAITurnHandler
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
        expect(() => new TurnHandlerResolver({
            logger: null,
            playerTurnHandler: mockPlayerTurnHandler,
            aiTurnHandler: mockAITurnHandler
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
    });

    test('should throw error if playerTurnHandler dependency is missing or invalid', () => {
        expect(() => new TurnHandlerResolver({logger: mockLogger, aiTurnHandler: mockAITurnHandler}))
            .toThrow('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
        expect(() => new TurnHandlerResolver({
            logger: mockLogger,
            playerTurnHandler: {},
            aiTurnHandler: mockAITurnHandler
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
        expect(() => new TurnHandlerResolver({
            logger: mockLogger,
            playerTurnHandler: null,
            aiTurnHandler: mockAITurnHandler
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
    });

    // Added test for AI Turn Handler dependency
    test('should throw error if aiTurnHandler dependency is missing or invalid', () => {
        expect(() => new TurnHandlerResolver({logger: mockLogger, playerTurnHandler: mockPlayerTurnHandler}))
            .toThrow('TurnHandlerResolver: Invalid or missing aiTurnHandler dependency.');
        expect(() => new TurnHandlerResolver({
            logger: mockLogger,
            playerTurnHandler: mockPlayerTurnHandler,
            aiTurnHandler: {}
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing aiTurnHandler dependency.');
        expect(() => new TurnHandlerResolver({
            logger: mockLogger,
            playerTurnHandler: mockPlayerTurnHandler,
            aiTurnHandler: null
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing aiTurnHandler dependency.');
    });

    test('should initialize successfully with valid dependencies', () => {
        expect(resolver).toBeInstanceOf(TurnHandlerResolver);
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver initialized.');
    });

    // --- resolveHandler Tests ---
    describe('Player Actor Handling', () => {
        test('should resolve PlayerTurnHandler for an entity with PLAYER_COMPONENT_ID', async () => {
            const playerEntity = new Entity('player1');
            playerEntity.hasComponent = jest.fn((componentId) => componentId === PLAYER_COMPONENT_ID);

            const handler = await resolver.resolveHandler(playerEntity);

            expect(handler).toBe(mockPlayerTurnHandler);
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor player1...');
            expect(playerEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Resolved PlayerTurnHandler for actor player1.');
            expect(playerEntity.hasComponent).not.toHaveBeenCalledWith(ACTOR_COMPONENT_ID); // Shouldn't need to check actor if player is true
        });
    });

    describe('AI Actor Handling', () => {
        test('should resolve AITurnHandler for an entity with ACTOR_COMPONENT_ID but not PLAYER_COMPONENT_ID', async () => {
            const aiEntity = new Entity('ai1');
            aiEntity.hasComponent = jest.fn((componentId) => {
                if (componentId === ACTOR_COMPONENT_ID) return true;
                if (componentId === PLAYER_COMPONENT_ID) return false;
                return false; // Default case
            });

            const handler = await resolver.resolveHandler(aiEntity);

            expect(handler).toBe(mockAITurnHandler);
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor ai1...');
            expect(aiEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            expect(aiEntity.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Resolved AITurnHandler for actor ai1.');
        });

        test('should log info when resolving AITurnHandler', async () => {
            const aiEntity = new Entity('ai2');
            aiEntity.hasComponent = jest.fn((componentId) => {
                if (componentId === ACTOR_COMPONENT_ID) return true;
                if (componentId === PLAYER_COMPONENT_ID) return false;
                return false;
            });

            await resolver.resolveHandler(aiEntity);

            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Resolved AITurnHandler for actor ai2.');
        });
    });

    describe('Non-Actor / Other Entity Handling', () => {
        test('should return null for an entity without PLAYER_COMPONENT_ID or (ACTOR_COMPONENT_ID without PLAYER_COMPONENT_ID)', async () => {
            const nonActorEntity = new Entity('item1');
            // Mock hasComponent to return false for both relevant components
            nonActorEntity.hasComponent = jest.fn().mockReturnValue(false);

            const handler = await resolver.resolveHandler(nonActorEntity);

            expect(handler).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor item1...');
            expect(nonActorEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            expect(nonActorEntity.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID); // It checks actor if player is false
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: No specific turn handler found for actor item1. Returning null.');
        });

        test('should return null for an entity with ACTOR_COMPONENT_ID AND PLAYER_COMPONENT_ID (should be handled as player)', async () => {
            // This scenario verifies the 'if' takes precedence over the 'else if'
            const playerActorEntity = new Entity('playerActor');
            playerActorEntity.hasComponent = jest.fn((componentId) => {
                if (componentId === ACTOR_COMPONENT_ID) return true;
                if (componentId === PLAYER_COMPONENT_ID) return true;
                return false;
            });

            const handler = await resolver.resolveHandler(playerActorEntity);

            expect(handler).toBe(mockPlayerTurnHandler); // Should be handled by the player check first
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Resolved PlayerTurnHandler for actor playerActor.');
            expect(mockLogger.info).not.toHaveBeenCalledWith('TurnHandlerResolver: Resolved AITurnHandler for actor playerActor.');
        });


        test('should return null for an entity that is not an actor (lacks ACTOR_COMPONENT_ID)', async () => {
            const nonActorEntity = new Entity('scenery1');
            nonActorEntity.hasComponent = jest.fn((componentId) => {
                if (componentId === ACTOR_COMPONENT_ID) return false; // Explicitly not an actor
                if (componentId === PLAYER_COMPONENT_ID) return false;
                return false;
            });

            const handler = await resolver.resolveHandler(nonActorEntity);

            expect(handler).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor scenery1...');
            expect(nonActorEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            expect(nonActorEntity.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: No specific turn handler found for actor scenery1. Returning null.');
        });

    });


    describe('Invalid Input Handling', () => {
        test('should return null and log warning for invalid actor input (null)', async () => {
            const handler = await resolver.resolveHandler(null);
            expect(handler).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.');
            // Ensure resolution logic wasn't attempted
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Attempting to resolve turn handler for actor'));
        });

        test('should return null and log warning for invalid actor input (missing id)', async () => {
            const invalidEntity = {name: 'invalid'}; // Lacks an 'id' property
            const handler = await resolver.resolveHandler(invalidEntity);
            expect(handler).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.');
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Attempting to resolve turn handler for actor'));
        });
    });
});