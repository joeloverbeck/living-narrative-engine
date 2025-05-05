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
    // *** CORRECTED: Changed handleTurn to startTurn to match constructor validation ***
    startTurn: jest.fn().mockResolvedValue(undefined), // Mock the required method
    // Add other methods if TurnHandlerResolver interacts with them (e.g., handleAction if needed)
});

// Simple mock for AITurnHandler (or any ITurnHandler)
const createMockAITurnHandler = () => ({
    // *** CORRECTED: Changed handleTurn to startTurn to match constructor validation ***
    startTurn: jest.fn().mockResolvedValue(undefined), // Mock the required method
    // Add other methods if TurnHandlerResolver interacts with them (e.g., handleAction if needed)
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

        // This instantiation should now succeed
        resolver = new TurnHandlerResolver({
            logger: mockLogger,
            playerTurnHandler: mockPlayerTurnHandler,
            aiTurnHandler: mockAITurnHandler // Inject mock AI handler
        });
    });

    // --- Constructor Tests ---
    test('should throw error if logger dependency is missing or invalid', () => {
        // We still need valid turn handlers for these tests, even though we test logger absence
        const validPlayerHandler = createMockPlayerTurnHandler();
        const validAiHandler = createMockAITurnHandler();
        expect(() => new TurnHandlerResolver({
            playerTurnHandler: validPlayerHandler,
            aiTurnHandler: validAiHandler
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
        expect(() => new TurnHandlerResolver({
            logger: {},
            playerTurnHandler: validPlayerHandler,
            aiTurnHandler: validAiHandler
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
        expect(() => new TurnHandlerResolver({
            logger: null,
            playerTurnHandler: validPlayerHandler,
            aiTurnHandler: validAiHandler
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
    });

    test('should throw error if playerTurnHandler dependency is missing or invalid', () => {
        // Need a valid AI handler for this test
        const validAiHandler = createMockAITurnHandler();
        expect(() => new TurnHandlerResolver({logger: mockLogger, aiTurnHandler: validAiHandler}))
            .toThrow('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
        expect(() => new TurnHandlerResolver({
            logger: mockLogger,
            playerTurnHandler: {},
            aiTurnHandler: validAiHandler
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
        expect(() => new TurnHandlerResolver({
            logger: mockLogger,
            playerTurnHandler: null,
            aiTurnHandler: validAiHandler
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
    });

    // Added test for AI Turn Handler dependency
    test('should throw error if aiTurnHandler dependency is missing or invalid', () => {
        // Need a valid Player handler for this test
        const validPlayerHandler = createMockPlayerTurnHandler();
        expect(() => new TurnHandlerResolver({logger: mockLogger, playerTurnHandler: validPlayerHandler}))
            .toThrow('TurnHandlerResolver: Invalid or missing aiTurnHandler dependency.');
        expect(() => new TurnHandlerResolver({
            logger: mockLogger,
            playerTurnHandler: validPlayerHandler,
            aiTurnHandler: {}
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing aiTurnHandler dependency.');
        expect(() => new TurnHandlerResolver({
            logger: mockLogger,
            playerTurnHandler: validPlayerHandler,
            aiTurnHandler: null
        }))
            .toThrow('TurnHandlerResolver: Invalid or missing aiTurnHandler dependency.');
    });

    test('should initialize successfully with valid dependencies', () => {
        // The beforeEach block already does this, so we just check the result
        expect(resolver).toBeInstanceOf(TurnHandlerResolver);
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver initialized.');
    });

    // --- resolveHandler Tests ---
    describe('Player Actor Handling', () => {
        test('should resolve PlayerTurnHandler for an entity with PLAYER_COMPONENT_ID', async () => {
            const playerEntity = new Entity('player1');
            // Mock hasComponent specifically for this test
            playerEntity.hasComponent = jest.fn((componentId) => componentId === PLAYER_COMPONENT_ID);
            // Add component data (doesn't matter what it is for this test, just that it exists)
            playerEntity.addComponent(PLAYER_COMPONENT_ID, {});

            const handler = await resolver.resolveHandler(playerEntity);

            expect(handler).toBe(mockPlayerTurnHandler);
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor player1...');
            // Verify hasComponent was called correctly
            expect(playerEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            // It shouldn't need to check ACTOR_COMPONENT_ID if PLAYER_COMPONENT_ID is true
            expect(playerEntity.hasComponent).not.toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Resolved PlayerTurnHandler for actor player1.');
        });
    });

    describe('AI Actor Handling', () => {
        test('should resolve AITurnHandler for an entity with ACTOR_COMPONENT_ID but not PLAYER_COMPONENT_ID', async () => {
            const aiEntity = new Entity('ai1');
            // Mock hasComponent specifically for this test
            aiEntity.hasComponent = jest.fn((componentId) => {
                if (componentId === ACTOR_COMPONENT_ID) return true;
                if (componentId === PLAYER_COMPONENT_ID) return false;
                return false; // Default case
            });
            // Add component data
            aiEntity.addComponent(ACTOR_COMPONENT_ID, {});

            const handler = await resolver.resolveHandler(aiEntity);

            expect(handler).toBe(mockAITurnHandler);
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor ai1...');
            // Verify hasComponent was called correctly (order matters in the code)
            expect(aiEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID); // Checked first
            expect(aiEntity.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID);  // Checked second
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Resolved AITurnHandler for actor ai1.');
        });

        test('should log info when resolving AITurnHandler', async () => {
            const aiEntity = new Entity('ai2');
            // Mock hasComponent specifically for this test
            aiEntity.hasComponent = jest.fn((componentId) => {
                if (componentId === ACTOR_COMPONENT_ID) return true;
                if (componentId === PLAYER_COMPONENT_ID) return false;
                return false;
            });
            aiEntity.addComponent(ACTOR_COMPONENT_ID, {});

            await resolver.resolveHandler(aiEntity);

            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Resolved AITurnHandler for actor ai2.');
        });
    });

    describe('Non-Actor / Other Entity Handling', () => {
        test('should return null for an entity without PLAYER_COMPONENT_ID or ACTOR_COMPONENT_ID', async () => {
            const nonActorEntity = new Entity('item1');
            // Ensure it *actually* has no relevant components
            // The default Entity has no components, but mocking is safer for clarity
            nonActorEntity.hasComponent = jest.fn().mockReturnValue(false);

            const handler = await resolver.resolveHandler(nonActorEntity);

            expect(handler).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor item1...');
            // Verify hasComponent was called correctly (order matters)
            expect(nonActorEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            expect(nonActorEntity.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: No specific turn handler found for actor item1. Returning null.');
        });

        // This test name was slightly misleading, correcting it.
        // It tests that Player takes precedence even if Actor component is also present.
        test('should resolve PlayerTurnHandler for an entity with both PLAYER_COMPONENT_ID and ACTOR_COMPONENT_ID', async () => {
            const playerActorEntity = new Entity('playerActor');
            // Mock hasComponent specifically for this test
            playerActorEntity.hasComponent = jest.fn((componentId) => {
                return componentId === ACTOR_COMPONENT_ID || componentId === PLAYER_COMPONENT_ID;
            });
            // Add component data
            playerActorEntity.addComponent(PLAYER_COMPONENT_ID, {});
            playerActorEntity.addComponent(ACTOR_COMPONENT_ID, {});


            const handler = await resolver.resolveHandler(playerActorEntity);

            // Player handler should be returned due to the 'if' check coming first
            expect(handler).toBe(mockPlayerTurnHandler);
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor playerActor...');
            // Verify hasComponent was called correctly
            expect(playerActorEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            // ACTOR_COMPONENT_ID should *not* have been checked because the player check succeeded
            expect(playerActorEntity.hasComponent).not.toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
            // Verify correct logging
            expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Resolved PlayerTurnHandler for actor playerActor.');
            expect(mockLogger.info).not.toHaveBeenCalledWith('TurnHandlerResolver: Resolved AITurnHandler for actor playerActor.');
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('No specific turn handler found'));
        });


        test('should return null for an entity that only has unrelated components', async () => {
            const sceneryEntity = new Entity('scenery1');
            // Add some other component, but not Player or Actor
            sceneryEntity.addComponent('component:description', {text: 'A nice tree'});
            // Mock hasComponent to reflect reality for this entity
            sceneryEntity.hasComponent = jest.fn((componentId) => {
                if (componentId === 'component:description') return true;
                return false; // Not player, not actor
            });


            const handler = await resolver.resolveHandler(sceneryEntity);

            expect(handler).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor scenery1...');
            // Verify hasComponent checks
            expect(sceneryEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
            expect(sceneryEntity.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
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
            // Create an object that vaguely looks like an entity but lacks the crucial 'id'
            const invalidEntity = {name: 'invalid', hasComponent: jest.fn()};
            const handler = await resolver.resolveHandler(invalidEntity);
            expect(handler).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.');
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Attempting to resolve turn handler for actor'));
            // Ensure hasComponent wasn't called on the invalid object
            expect(invalidEntity.hasComponent).not.toHaveBeenCalled();
        });

        test('should return null and log warning for invalid actor input (undefined)', async () => {
            const handler = await resolver.resolveHandler(undefined);
            expect(handler).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.');
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Attempting to resolve turn handler for actor'));
        });
    });
});
// --- FILE END ---