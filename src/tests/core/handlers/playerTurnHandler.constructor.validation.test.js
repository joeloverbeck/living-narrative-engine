// src/tests/core/handlers/PlayerTurnHandler/constructor.validation.test.js
// --- FILE START ---

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// --- Module to Test ---
// Adjust the path according to your project structure
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';

// --- Setup ---
// Define a factory function for creating valid dependencies
const createValidDeps = () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
    actionDiscoverySystem: {
        getValidActions: jest.fn(),
    },
    commandProcessor: {
        processCommand: jest.fn(),
    },
    worldContext: {
        getLocationOfEntity: jest.fn(),
    },
    entityManager: {
        getEntityInstance: jest.fn(),
    },
    gameDataRepository: {
        getActionDefinition: jest.fn(),
    },
    promptOutputPort: {
        prompt: jest.fn(),
    },
    turnEndPort: {
        notifyTurnEnded: jest.fn(),
    },
    playerPromptService: {
        prompt: jest.fn(),
    },
    commandOutcomeInterpreter: {
        interpret: jest.fn(),
    },
    safeEventDispatcher: {
        dispatchSafely: jest.fn(),
    },
});

// --- Test Suite ---
describe('PlayerTurnHandler: Constructor Validation', () => {
    /** @type {ReturnType<createValidDeps>} */
    let validDeps;

    beforeEach(() => {
        // Reset mocks and create fresh valid dependencies before each test
        jest.clearAllMocks();
        validDeps = createValidDeps();
    });

    // --- Success Case ---
    it('should instantiate successfully with valid dependencies', () => {
        // --- Assertions ---
        expect(() => new PlayerTurnHandler(validDeps)).not.toThrow();
        // Also verify the constructor logged successful initialization (requires valid logger)
        expect(validDeps.logger.debug).toHaveBeenCalledWith(
            `${PlayerTurnHandler.name} initialized successfully with all dependencies.`
        );
    });

    // --- Failure Cases ---

    // Test Logger
    describe('Logger Validation', () => {
        it('should throw if logger is null', () => {
            const deps = { ...validDeps, logger: null };
            // Constructor logs to console.error before throwing, we check the throw
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing logger/i);
        });

        it('should throw if logger is missing the error method', () => {
            const invalidLogger = { info: jest.fn(), debug: jest.fn() }; // Missing error
            const deps = { ...validDeps, logger: invalidLogger };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing logger/i);
        });
    });

    // Test Action Discovery System
    describe('ActionDiscoverySystem Validation', () => {
        it('should throw if actionDiscoverySystem is null', () => {
            const deps = { ...validDeps, actionDiscoverySystem: null };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing actionDiscoverySystem/i);
        });

        it('should throw if actionDiscoverySystem is invalid (missing getValidActions)', () => {
            const deps = { ...validDeps, actionDiscoverySystem: {} };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing actionDiscoverySystem/i);
            // Verify logger.error was called (if logger is valid)
            expect(validDeps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Invalid or missing actionDiscoverySystem (requires getValidActions)')
            );
        });
    });

    // Test Command Processor
    describe('CommandProcessor Validation', () => {
        it('should throw if commandProcessor is null', () => {
            const deps = { ...validDeps, commandProcessor: null };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing commandProcessor/i);
        });

        it('should throw if commandProcessor is invalid (missing processCommand)', () => {
            const deps = { ...validDeps, commandProcessor: {} };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing commandProcessor/i);
            // Verify logger.error was called (if logger is valid)
            expect(validDeps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Invalid or missing commandProcessor (requires processCommand)')
            );
        });
    });

    // Test World Context
    describe('WorldContext Validation', () => {
        it('should throw if worldContext is null', () => {
            const deps = { ...validDeps, worldContext: null };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing worldContext/i);
        });

        it('should throw if worldContext is invalid (missing getLocationOfEntity)', () => {
            const deps = { ...validDeps, worldContext: {} };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing worldContext/i);
            // Verify logger.error was called (if logger is valid)
            expect(validDeps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Invalid or missing worldContext (requires getLocationOfEntity)')
            );
        });
    });

    // Test Entity Manager
    describe('EntityManager Validation', () => {
        it('should throw if entityManager is null', () => {
            const deps = { ...validDeps, entityManager: null };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing entityManager/i);
        });

        it('should throw if entityManager is invalid (missing getEntityInstance)', () => {
            const deps = { ...validDeps, entityManager: {} };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing entityManager/i);
            // Verify logger.error was called (if logger is valid)
            expect(validDeps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Invalid or missing entityManager (requires getEntityInstance)')
            );
        });
    });

    // Test Game Data Repository
    describe('GameDataRepository Validation', () => {
        it('should throw if gameDataRepository is null', () => {
            const deps = { ...validDeps, gameDataRepository: null };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing gameDataRepository/i);
        });

        it('should throw if gameDataRepository is invalid (missing getActionDefinition)', () => {
            const deps = { ...validDeps, gameDataRepository: {} };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing gameDataRepository/i);
            // Verify logger.error was called (if logger is valid)
            expect(validDeps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Invalid or missing gameDataRepository (requires getActionDefinition)')
            );
        });
    });

    // Test Prompt Output Port
    describe('PromptOutputPort Validation', () => {
        it('should throw if promptOutputPort is null', () => {
            const deps = { ...validDeps, promptOutputPort: null };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing promptOutputPort/i);
        });

        it('should throw if promptOutputPort is invalid (missing prompt method)', () => {
            const deps = { ...validDeps, promptOutputPort: {} };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing promptOutputPort/i);
            // Verify logger.error was called (if logger is valid)
            expect(validDeps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Invalid or missing promptOutputPort (requires prompt method)')
            );
        });
    });

    // Test Turn End Port
    describe('TurnEndPort Validation', () => {
        it('should throw if turnEndPort is null', () => {
            const deps = { ...validDeps, turnEndPort: null };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing turnEndPort/i);
        });

        it('should throw if turnEndPort is invalid (missing notifyTurnEnded method)', () => {
            const deps = { ...validDeps, turnEndPort: {} };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing turnEndPort/i);
            // Verify logger.error was called (if logger is valid)
            expect(validDeps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Invalid or missing turnEndPort (requires notifyTurnEnded method)')
            );
        });
    });

    // Test Player Prompt Service
    describe('PlayerPromptService Validation', () => {
        it('should throw if playerPromptService is null', () => {
            const deps = { ...validDeps, playerPromptService: null };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing playerPromptService/i);
        });

        it('should throw if playerPromptService is invalid (missing prompt method)', () => {
            const deps = { ...validDeps, playerPromptService: {} };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing playerPromptService/i);
            // Verify logger.error was called (if logger is valid)
            expect(validDeps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Invalid or missing playerPromptService (requires prompt method)')
            );
        });
    });

    // Test Command Outcome Interpreter
    describe('CommandOutcomeInterpreter Validation', () => {
        it('should throw if commandOutcomeInterpreter is null', () => {
            const deps = { ...validDeps, commandOutcomeInterpreter: null };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing commandOutcomeInterpreter/i);
        });

        it('should throw if commandOutcomeInterpreter is invalid (missing interpret method)', () => {
            const deps = { ...validDeps, commandOutcomeInterpreter: {} };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing commandOutcomeInterpreter/i);
            // Verify logger.error was called (if logger is valid)
            expect(validDeps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Invalid or missing commandOutcomeInterpreter (requires interpret method)')
            );
        });
    });

    // Test Safe Event Dispatcher
    describe('SafeEventDispatcher Validation', () => {
        it('should throw if safeEventDispatcher is null', () => {
            const deps = { ...validDeps, safeEventDispatcher: null };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing safeEventDispatcher/i);
        });

        it('should throw if safeEventDispatcher is invalid (missing dispatchSafely method)', () => {
            const deps = { ...validDeps, safeEventDispatcher: {} };
            expect(() => new PlayerTurnHandler(deps)).toThrow(/Invalid or missing safeEventDispatcher/i);
            // Verify logger.error was called (if logger is valid)
            expect(validDeps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Invalid or missing safeEventDispatcher (requires dispatchSafely method)')
            );
        });
    });

});

// --- FILE END ---