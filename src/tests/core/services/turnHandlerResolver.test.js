// src/tests/core/services/turnHandlerResolver.test.js

import TurnHandlerResolver from '../../../core/services/turnHandlerResolver.js';
// PlayerTurnHandler is imported only for type checking/instanceof, not execution
// import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import Entity from '../../../entities/entity.js';
import {PLAYER_COMPONENT_ID} from '../../../types/components.js';
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


describe('TurnHandlerResolver', () => {
    let mockLogger;
    let mockPlayerTurnHandler;
    let resolver;

    beforeEach(() => {
        // Create fresh mocks for each test
        mockLogger = createMockLogger();
        mockPlayerTurnHandler = createMockPlayerTurnHandler();

        resolver = new TurnHandlerResolver({
            logger: mockLogger,
            playerTurnHandler: mockPlayerTurnHandler
        });
    });

    // --- Constructor Tests ---
    test('should throw error if logger dependency is missing or invalid', () => {
        // Test with missing logger
        expect(() => new TurnHandlerResolver({playerTurnHandler: mockPlayerTurnHandler}))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
        // Test with invalid logger (missing required methods)
        expect(() => new TurnHandlerResolver({logger: {}, playerTurnHandler: mockPlayerTurnHandler}))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
        // Test with null logger
        expect(() => new TurnHandlerResolver({logger: null, playerTurnHandler: mockPlayerTurnHandler}))
            .toThrow('TurnHandlerResolver: Invalid or missing logger dependency.');
    });

    test('should throw error if playerTurnHandler dependency is missing or invalid', () => {
        // Test with missing handler
        expect(() => new TurnHandlerResolver({logger: mockLogger}))
            .toThrow('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
        // Test with invalid handler (missing required methods)
        expect(() => new TurnHandlerResolver({logger: mockLogger, playerTurnHandler: {}}))
            .toThrow('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
        // Test with null handler
        expect(() => new TurnHandlerResolver({logger: mockLogger, playerTurnHandler: null}))
            .toThrow('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
    });

    test('should initialize successfully with valid dependencies', () => {
        expect(resolver).toBeInstanceOf(TurnHandlerResolver);
        // Check if the logger's debug method was called during initialization
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver initialized.');
    });

    // --- resolveHandler Tests ---
    test('should resolve PlayerTurnHandler for an entity with PLAYER_COMPONENT_ID', async () => {
        const playerEntity = new Entity('player1');
        // Mock the hasComponent method directly on the entity instance for this test
        playerEntity.hasComponent = jest.fn((componentId) => componentId === PLAYER_COMPONENT_ID);

        const handler = await resolver.resolveHandler(playerEntity);

        expect(handler).toBe(mockPlayerTurnHandler); // Should return the injected instance
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor player1...');
        expect(playerEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
        expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: Resolved PlayerTurnHandler for actor player1.');
    });

    test('should return null for an entity without PLAYER_COMPONENT_ID', async () => {
        const npcEntity = new Entity('npc1');
        // Mock hasComponent to return false for the player component
        npcEntity.hasComponent = jest.fn((componentId) => componentId !== PLAYER_COMPONENT_ID);

        const handler = await resolver.resolveHandler(npcEntity);

        expect(handler).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor npc1...');
        expect(npcEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
        // Future: expect(npcEntity.hasComponent).toHaveBeenCalledWith(AI_COMPONENT_ID); // If AI handler is added
        expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: No specific turn handler found for actor npc1. Returning null.');
    });

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

    test('should return null for an entity with an unexpected component type', async () => {
        const itemEntity = new Entity('item1');
        // Mock hasComponent to always return false for simplicity in this case
        itemEntity.hasComponent = jest.fn().mockReturnValue(false);

        const handler = await resolver.resolveHandler(itemEntity);

        expect(handler).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith('TurnHandlerResolver: Attempting to resolve turn handler for actor item1...');
        expect(itemEntity.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
        expect(mockLogger.info).toHaveBeenCalledWith('TurnHandlerResolver: No specific turn handler found for actor item1. Returning null.');
    });
});