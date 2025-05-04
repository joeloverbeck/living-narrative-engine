// src/tests/core/initializers/services/initializationService.test.js

import InitializationService from '../../../../core/initializers/services/initializationService.js';
import {afterEach, beforeEach, describe, expect, it, jest, test} from "@jest/globals";

// --- Mocks ---
let mockContainer;
let mockLogger;
let mockValidatedEventDispatcher;
let mockWorldLoader;
let mockSystemInitializer;
// REMOVED: let mockGameStateInitializer;
let mockWorldInitializer;
let mockInputSetupService;
let mockGameLoop; // Keep the mock object itself for potential use in other tests/layers
// Variable to store the original container.resolve mock implementation
let originalContainerResolve;

const MOCK_WORLD_NAME = 'testWorld';

describe('InitializationService', () => {
    beforeEach(() => {
        // Reset mocks for each test
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined),
        };
        mockWorldLoader = {
            loadWorld: jest.fn().mockResolvedValue(undefined),
        };
        mockSystemInitializer = {
            initializeAll: jest.fn().mockResolvedValue(undefined),
        };
        // REMOVED: mockGameStateInitializer setup
        mockWorldInitializer = {
            initializeWorldEntities: jest.fn().mockReturnValue(true),
        };
        mockInputSetupService = {
            configureInputHandler: jest.fn(),
        };
        mockGameLoop = {
            // Properties if needed by other layers
        };

        // Mock AppContainer resolve behavior
        mockContainer = {
            resolve: jest.fn((token) => {
                switch (token) {
                    case 'WorldLoader':
                        return mockWorldLoader;
                    case 'SystemInitializer':
                        return mockSystemInitializer;
                    // REMOVED: GameStateInitializer case
                    case 'WorldInitializer':
                        return mockWorldInitializer;
                    case 'InputSetupService':
                        return mockInputSetupService;
                    // REMOVED: GameLoop case
                    case 'ILogger': // For constructor fallback test
                        return mockLogger;
                    default:
                        return undefined;
                }
            }),
        };
        originalContainerResolve = mockContainer.resolve.getMockImplementation();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // --- Constructor Tests ---
    // These tests remain unchanged as the constructor logic didn't depend on GameStateInitializer or GameLoop
    describe('Constructor', () => {
        it('should instantiate successfully with valid dependencies', () => {
            expect(() => new InitializationService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher
            })).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith('InitializationService: Instance created successfully with dependencies.');
        });

        it('should throw an error if container is missing', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            expect(() => new InitializationService({
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher
            })).toThrow('InitializationService: Missing required dependency \'container\'.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('InitializationService: Missing required dependency \'container\'.');
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if logger is missing', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            expect(() => new InitializationService({
                container: mockContainer,
                validatedEventDispatcher: mockValidatedEventDispatcher
            })).toThrow('InitializationService: Missing or invalid required dependency \'logger\'.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('InitializationService: Missing or invalid required dependency \'logger\'.');
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if logger is invalid (missing methods)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const invalidLogger = {info: jest.fn()}; // Missing error/debug
            expect(() => new InitializationService({
                container: mockContainer,
                logger: invalidLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher
            })).toThrow('InitializationService: Missing or invalid required dependency \'logger\'.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('InitializationService: Missing or invalid required dependency \'logger\'.');
            consoleErrorSpy.mockRestore();
        });


        it('should throw an error if validatedEventDispatcher is missing', () => {
            expect(() => new InitializationService({
                container: mockContainer,
                logger: mockLogger,
            })).toThrow('InitializationService: Missing or invalid required dependency \'validatedEventDispatcher\'.');
            expect(mockLogger.error).toHaveBeenCalledWith('InitializationService: Missing or invalid required dependency \'validatedEventDispatcher\'.');
        });

        it('should throw an error if validatedEventDispatcher is invalid (missing dispatchValidated)', () => {
            const invalidDispatcher = {dispatch: jest.fn()};
            expect(() => new InitializationService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: invalidDispatcher,
            })).toThrow('InitializationService: Missing or invalid required dependency \'validatedEventDispatcher\'.');
            expect(mockLogger.error).toHaveBeenCalledWith('InitializationService: Missing or invalid required dependency \'validatedEventDispatcher\'.');
        });
    });

    // --- runInitializationSequence Tests ---
    describe('runInitializationSequence', () => {
        let service;

        beforeEach(() => {
            service = new InitializationService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher
            });
        });

        // --- Input Validation (Unchanged) ---
        test.each([
            [null],
            [undefined],
            [''],
            ['   '],
        ])('should return failure and log error for invalid worldName: %p', async (invalidWorldName) => {
            const result = await service.runInitializationSequence(invalidWorldName);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error.message).toBe('InitializationService requires a valid non-empty worldName.');
            expect(result.gameLoop).toBeUndefined();

            expect(mockLogger.error).toHaveBeenCalledWith('InitializationService requires a valid non-empty worldName.');
            const relevantResolveCalls = mockContainer.resolve.mock.calls.filter(call => call[0] !== 'ILogger');
            expect(relevantResolveCalls.length).toBe(0);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(expect.stringContaining('initialization:'), expect.anything(), expect.anything());
        });

        // --- Success Path (Corrected) ---
        it('should run the full initialization sequence successfully', async () => {
            const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

            // 1. Verify Logging Start/End
            expect(mockLogger.info).toHaveBeenCalledWith(`InitializationService: Starting runInitializationSequence for world: ${MOCK_WORLD_NAME}.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`InitializationService: Initialization sequence for world '${MOCK_WORLD_NAME}' completed successfully (GameLoop resolution removed).`);

            // 3. Verify Orchestration (Resolves and Service Calls in Order)
            const resolveOrder = mockContainer.resolve.mock.calls.map(call => call[0]);
            // --- CORRECTION: Removed 'GameStateInitializer' from expected resolve order ---
            expect(resolveOrder).toEqual([
                'WorldLoader',
                'SystemInitializer',
                // 'GameStateInitializer', // REMOVED
                'WorldInitializer',
                'InputSetupService',
                'DomUiFacade'
                // 'GameLoop' // Already correctly removed
            ]);

            // Check service calls happened *after* resolve and in order
            expect(mockWorldLoader.loadWorld).toHaveBeenCalledWith(MOCK_WORLD_NAME);
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            // --- CORRECTION: Removed check for mockGameStateInitializer.setupInitialState ---
            // expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).toHaveBeenCalled();


            // 5. Verify Success Result
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined(); // Already correctly updated

            // 6. Verify No Error Logging/Events
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), expect.any(Error));
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('initialization:initialization_service:failed', expect.anything(), expect.anything());
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('ui:show_fatal_error', expect.anything());
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('ui:disable_input', expect.anything());
        });

        // --- Failure Paths ---
        // Helper function to test common failure logic (remains valid)
        const testFailure = async (setupFailure, expectedError) => {
            setupFailure();
            const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

            // 1. Critical error logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during initialization sequence for world '${MOCK_WORLD_NAME}'`),
                expectedError
            );
            // 3. 'failed' event dispatched
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:initialization_service:failed',
                {
                    worldName: MOCK_WORLD_NAME,
                    error: expectedError.message,
                    stack: expect.any(String)
                },
                {allowSchemaNotFound: true}
            );
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:initialization_service:failed' event.", expect.objectContaining({error: expectedError.message}));
            // 4. UI events dispatched
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'ui:show_fatal_error',
                {
                    title: 'Fatal Initialization Error',
                    message: expect.stringContaining(expectedError.message),
                    details: expect.any(String)
                }
            );
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'ui:disable_input',
                {message: 'Fatal error during initialization. Cannot continue.'}
            );
            expect(mockLogger.info).toHaveBeenCalledWith('InitializationService: Dispatched ui:show_fatal_error and ui:disable_input events.');
            // 5. Failure Result object properties
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error.message).toEqual(expectedError.message);
            expect(result.gameLoop).toBeUndefined();
            // 6. 'completed' event NOT dispatched
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'initialization:initialization_service:completed',
                expect.anything(),
                expect.anything()
            );
        };

        // --- Existing Failure Tests (Adjusted where needed) ---
        it('should handle failure when WorldLoader resolve fails', async () => {
            const error = new Error('Failed to resolve WorldLoader');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'WorldLoader') throw error;
                return originalContainerResolve(token);
            }), error);
            expect(mockWorldLoader.loadWorld).not.toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
            // No need to check GameStateInitializer here anymore
        });

        it('should handle failure when worldLoader.loadWorld rejects', async () => {
            const error = new Error('World loading failed');
            await testFailure(() => mockWorldLoader.loadWorld.mockRejectedValue(error), error);
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
            // No need to check GameStateInitializer here anymore
        });

        it('should handle failure when SystemInitializer resolve fails', async () => {
            const error = new Error('Failed to resolve SystemInitializer');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'SystemInitializer') throw error;
                return originalContainerResolve(token);
            }), error);
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
            // No need to check GameStateInitializer here anymore
        });

        it('should handle failure when systemInitializer.initializeAll rejects', async () => {
            const error = new Error('System init failed');
            await testFailure(() => mockSystemInitializer.initializeAll.mockRejectedValue(error), error);
            // --- CORRECTION: Removed check for mockGameStateInitializer ---
            // expect(mockGameStateInitializer.setupInitialState).not.toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).not.toHaveBeenCalled(); // Check the *next* step instead
        });

        // --- CORRECTION: REMOVED OBSOLETE TESTS FOR GameStateInitializer ---
        /*
        it('should handle failure when gameStateInitializer.setupInitialState returns false', async () => {
            const expectedError = new Error('Initial game state setup failed via GameStateInitializer.');
            await testFailure(() => mockGameStateInitializer.setupInitialState.mockResolvedValue(false), expectedError);
            expect(mockWorldInitializer.initializeWorldEntities).not.toHaveBeenCalled();
        });

        it('should handle failure when gameStateInitializer.setupInitialState rejects', async () => {
            const error = new Error('GameState init failed');
            await testFailure(() => mockGameStateInitializer.setupInitialState.mockRejectedValue(error), error);
            expect(mockWorldInitializer.initializeWorldEntities).not.toHaveBeenCalled();
        });
        */

        it('should handle failure when WorldInitializer resolve fails', async () => {
            const error = new Error('Failed to resolve WorldInitializer');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'WorldInitializer') throw error;
                return originalContainerResolve(token);
            }), error);
            // Verify previous steps were called
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            // --- CORRECTION: Removed check for mockGameStateInitializer ---
            // expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled();
            // Verify the failed step wasn't called
            expect(mockWorldInitializer.initializeWorldEntities).not.toHaveBeenCalled();
        });

        it('should handle failure when worldInitializer.initializeWorldEntities returns false', async () => {
            const expectedError = new Error('World initialization failed via WorldInitializer.');
            await testFailure(() => mockWorldInitializer.initializeWorldEntities.mockReturnValue(false), expectedError);
            // Verify the next step wasn't called
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });

        it('should handle failure when worldInitializer.initializeWorldEntities throws', async () => {
            const error = new Error('World entity init critical failure');
            await testFailure(() => mockWorldInitializer.initializeWorldEntities.mockImplementation(() => {
                throw error;
            }), error);
            // Verify the next step wasn't called
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });

        it('should handle failure when InputSetupService resolve fails', async () => {
            const error = new Error('Failed to resolve InputSetupService');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'InputSetupService') throw error;
                return originalContainerResolve(token);
            }), error);
            // Verify previous steps were called
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            // --- CORRECTION: Removed check for mockGameStateInitializer ---
            // expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            // Verify the failed step wasn't called
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });


        it('should handle failure when inputSetupService.configureInputHandler throws', async () => {
            const error = new Error('Input setup failed');
            await testFailure(() => mockInputSetupService.configureInputHandler.mockImplementation(() => {
                throw error;
            }), error);
            // Check that GameLoop wasn't attempted (already correct)
            const resolveCalls = mockContainer.resolve.mock.calls.map(call => call[0]);
            expect(resolveCalls).not.toContain('GameLoop');
        });

        // --- CORRECTION: Deleted the obsolete test case for GameLoop resolve failure (already done) ---

        // --- Test for secondary failure during error handling (Remains Valid) ---
        it('should log an error if dispatching UI error events fails during main error handling', async () => {
            const mainError = new Error('World loading failed');
            const dispatchError = new Error('Failed to dispatch UI event');

            mockWorldLoader.loadWorld.mockRejectedValue(mainError);
            mockValidatedEventDispatcher.dispatchValidated.mockImplementation(async (eventName) => {
                if (eventName === 'initialization:initialization_service:started' || eventName === 'initialization:initialization_service:failed') {
                    return Promise.resolve();
                }
                if (eventName === 'ui:show_fatal_error' || eventName === 'ui:disable_input') {
                    throw dispatchError;
                }
                throw new Error(`Unexpected event dispatched in UI fail test: ${eventName}`);
            });

            const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

            expect(result.success).toBe(false);
            expect(result.error).toBe(mainError);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`CRITICAL ERROR`), mainError);
            expect(mockLogger.error).toHaveBeenCalledWith(`InitializationService: Failed to dispatch UI error events after initialization failure:`, dispatchError);

            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:show_fatal_error', expect.anything());
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(expect.stringMatching(/ui:(show_fatal_error|disable_input)/), expect.anything());
        });
    });
});