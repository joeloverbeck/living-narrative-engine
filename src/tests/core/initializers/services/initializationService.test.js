// src/tests/core/initializers/services/initializationService.test.js

import InitializationService from '../../../../core/initializers/services/initializationService.js';
import { afterEach, beforeEach, describe, expect, it, jest, test } from "@jest/globals"; // Added afterEach

// --- Mocks ---
let mockContainer;
let mockLogger;
let mockValidatedEventDispatcher;
let mockWorldLoader;
let mockSystemInitializer;
let mockGameStateInitializer;
let mockWorldInitializer;
let mockInputSetupService;
let mockGameLoop; // Keep the mock object itself for potential use in other tests/layers
// Variable to store the original container.resolve mock implementation
let originalContainerResolve;

const MOCK_WORLD_NAME = 'testWorld';
// const MOCK_GAMELOOP_ID = 'gl-12345'; // No longer needed for event payload

describe('InitializationService', () => {
    beforeEach(() => {
        // Reset mocks for each test
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        mockValidatedEventDispatcher = {
            // Default success, allow overriding in tests
            dispatchValidated: jest.fn().mockResolvedValue(undefined),
        };
        mockWorldLoader = {
            loadWorld: jest.fn().mockResolvedValue(undefined), // Default success
        };
        mockSystemInitializer = {
            initializeAll: jest.fn().mockResolvedValue(undefined), // Default success
        };
        mockGameStateInitializer = {
            setupInitialState: jest.fn().mockResolvedValue(true), // Default success
        };
        mockWorldInitializer = {
            initializeWorldEntities: jest.fn().mockReturnValue(true), // Default success
        };
        mockInputSetupService = {
            configureInputHandler: jest.fn(), // Default success (void return)
        };
        // GameLoop mock remains, even if InitService doesn't resolve/return it directly.
        // Other parts of the system might still interact with it.
        mockGameLoop = {
            // id: MOCK_GAMELOOP_ID, // ID no longer used in events from this service
            // other properties/methods if needed
        };

        // Mock AppContainer resolve behavior
        mockContainer = {
            resolve: jest.fn((token) => {
                switch (token) {
                    case 'WorldLoader':
                        return mockWorldLoader;
                    case 'SystemInitializer':
                        return mockSystemInitializer;
                    case 'GameStateInitializer':
                        return mockGameStateInitializer;
                    case 'WorldInitializer':
                        return mockWorldInitializer;
                    case 'InputSetupService':
                        return mockInputSetupService;
                    // REMOVED: GameLoop case - InitService no longer resolves it.
                    // If another test *needs* to simulate GameLoop resolution (e.g., testing GameEngine),
                    // it should customize the resolver mock in that specific test.
                    // case 'GameLoop':
                    //     return mockGameLoop;
                    case 'ILogger': // For constructor fallback test
                        return mockLogger;
                    default:
                        // Allow tests to resolve unmocked things if absolutely necessary,
                        // but default should cover known dependencies.
                        // console.warn(`Default mock resolve falling back for token: ${String(token)}`);
                        return undefined; // Return undefined instead of throwing by default
                    // Throw error only if not mocked elsewhere - allows specific tests to override
                    // throw new Error(`Default mock resolve error: Unknown token ${token}`);
                }
            }),
        };
        // Store the original implementation for use in specific failure tests
        originalContainerResolve = mockContainer.resolve.getMockImplementation();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        // These tests remain unchanged as the constructor logic didn't depend on GameLoop
        it('should instantiate successfully with valid dependencies', () => {
            expect(() => new InitializationService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher
            })).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith('InitializationService: Instance created successfully with dependencies.');
        });

        it('should throw an error if container is missing', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error
            expect(() => new InitializationService({
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher
            })).toThrow('InitializationService: Missing required dependency \'container\'.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('InitializationService: Missing required dependency \'container\'.');
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if logger is missing', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            expect(() => new InitializationService({
                container: mockContainer,
                validatedEventDispatcher: mockValidatedEventDispatcher
            })).toThrow('InitializationService: Missing or invalid required dependency \'logger\'.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('InitializationService: Missing or invalid required dependency \'logger\'.');
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if logger is invalid (missing methods)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const invalidLogger = { info: jest.fn() }; // Missing error/debug
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
            const invalidDispatcher = { dispatch: jest.fn() };
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
            // Create a valid service instance for sequence tests
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
            expect(result.gameLoop).toBeUndefined(); // Property doesn't exist in result anymore, so this is correct

            expect(mockLogger.error).toHaveBeenCalledWith('InitializationService requires a valid non-empty worldName.');
            // container.resolve should not be called for input validation errors
            const relevantResolveCalls = mockContainer.resolve.mock.calls.filter(call => call[0] !== 'ILogger'); // Exclude constructor resolve
            expect(relevantResolveCalls.length).toBe(0);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(expect.stringContaining('initialization:'), expect.anything(), expect.anything());
        });

        // --- Success Path (Corrected) ---
        it('should run the full initialization sequence successfully', async () => {
            const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

            // 1. Verify Logging Start/End
            expect(mockLogger.info).toHaveBeenCalledWith(`InitializationService: Starting runInitializationSequence for world: ${MOCK_WORLD_NAME}.`);
            // --- CORRECTION: Updated expected log message ---
            expect(mockLogger.info).toHaveBeenCalledWith(`InitializationService: Initialization sequence for world '${MOCK_WORLD_NAME}' completed successfully (GameLoop resolution removed).`);

            // 2. Verify 'started' event dispatch (first dispatch call)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(
                1, // First call
                'initialization:initialization_service:started',
                { worldName: MOCK_WORLD_NAME },
                { allowSchemaNotFound: true }
            );
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:initialization_service:started' event.", { worldName: MOCK_WORLD_NAME });


            // 3. Verify Orchestration (Resolves and Service Calls in Order)
            const resolveOrder = mockContainer.resolve.mock.calls.map(call => call[0]);
            // --- CORRECTION: Removed 'GameLoop' from expected resolve order ---
            expect(resolveOrder).toEqual([
                'WorldLoader',
                'SystemInitializer',
                'GameStateInitializer',
                'WorldInitializer',
                'InputSetupService'
                // 'GameLoop' // No longer resolved here
            ]);

            // Check service calls happened *after* resolve and in order
            expect(mockWorldLoader.loadWorld).toHaveBeenCalledWith(MOCK_WORLD_NAME);
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).toHaveBeenCalled();

            // 4. Verify 'completed' event dispatch (second dispatch call)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(
                2, // Second call
                'initialization:initialization_service:completed',
                // --- CORRECTION: Removed gameLoopInstanceId from payload ---
                { worldName: MOCK_WORLD_NAME /*, gameLoopInstanceId: MOCK_GAMELOOP_ID */ },
                { allowSchemaNotFound: true }
            );
            // --- CORRECTION: Updated expected debug log payload ---
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:initialization_service:completed' event.", { worldName: MOCK_WORLD_NAME });


            // 5. Verify Success Result
            expect(result.success).toBe(true);
            // --- CORRECTION: Removed check for gameLoop property in result ---
            // expect(result.gameLoop).toBe(mockGameLoop);
            expect(result.error).toBeUndefined();

            // 6. Verify No Error Logging/Events
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), expect.any(Error));
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('initialization:initialization_service:failed', expect.anything(), expect.anything());
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('ui:show_fatal_error', expect.anything());
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('ui:disable_input', expect.anything());
        });

        // --- Failure Paths ---
        // Helper function to test common failure logic (Unchanged conceptually, but result.gameLoop check is implicitly correct now)
        const testFailure = async (setupFailure, expectedError) => {
            // Setup the specific failure condition before running the sequence
            setupFailure();

            const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

            // Verify common failure logic:

            // 1. Critical error logged with the correct error object (or one matching type/message)
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during initialization sequence for world '${MOCK_WORLD_NAME}'`),
                expectedError // Jest matches error type and message here
            );

            // 2. 'started' event was dispatched (should always happen if input is valid)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:initialization_service:started',
                { worldName: MOCK_WORLD_NAME },
                { allowSchemaNotFound: true }
            );

            // 3. 'failed' event was dispatched with correct message and *some* stack
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:initialization_service:failed',
                {
                    worldName: MOCK_WORLD_NAME,
                    error: expectedError.message, // Check the message matches
                    stack: expect.any(String)    // Stack exists, but don't match exactly
                },
                { allowSchemaNotFound: true }
            );
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:initialization_service:failed' event.", expect.objectContaining({ error: expectedError.message }));

            // 4. UI events dispatched with correct structure and message
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'ui:show_fatal_error',
                {
                    title: 'Fatal Initialization Error',
                    message: expect.stringContaining(expectedError.message), // Check message contains the error
                    details: expect.any(String) // Stack/details exist
                }
            );
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'ui:disable_input',
                { message: 'Fatal error during initialization. Cannot continue.' }
            );
            expect(mockLogger.info).toHaveBeenCalledWith('InitializationService: Dispatched ui:show_fatal_error and ui:disable_input events.');


            // 5. Verify Failure Result object properties
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error); // Ensure an error object was returned
            expect(result.error.message).toEqual(expectedError.message); // Check the message is correct
            expect(result.gameLoop).toBeUndefined(); // Property doesn't exist, so undefined is correct

            // 6. Verify 'completed' event was NOT dispatched
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'initialization:initialization_service:completed',
                expect.anything(),
                expect.anything()
            );
        };

        // --- Existing Failure Tests (Remain Valid) ---
        it('should handle failure when WorldLoader resolve fails', async () => {
            const error = new Error('Failed to resolve WorldLoader');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'WorldLoader') throw error;
                return originalContainerResolve(token);
            }), error);
            expect(mockWorldLoader.loadWorld).not.toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
        });

        it('should handle failure when worldLoader.loadWorld rejects', async () => {
            const error = new Error('World loading failed');
            await testFailure(() => mockWorldLoader.loadWorld.mockRejectedValue(error), error);
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
        });

        it('should handle failure when SystemInitializer resolve fails', async () => {
            const error = new Error('Failed to resolve SystemInitializer');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'SystemInitializer') throw error;
                return originalContainerResolve(token);
            }), error);
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
        });

        it('should handle failure when systemInitializer.initializeAll rejects', async () => {
            const error = new Error('System init failed');
            await testFailure(() => mockSystemInitializer.initializeAll.mockRejectedValue(error), error);
            expect(mockGameStateInitializer.setupInitialState).not.toHaveBeenCalled();
        });

        it('should handle failure when GameStateInitializer resolve fails', async () => {
            const error = new Error('Failed to resolve GameStateInitializer');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'GameStateInitializer') throw error;
                return originalContainerResolve(token);
            }), error);
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockGameStateInitializer.setupInitialState).not.toHaveBeenCalled();
        });

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

        it('should handle failure when WorldInitializer resolve fails', async () => {
            const error = new Error('Failed to resolve WorldInitializer');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'WorldInitializer') throw error;
                return originalContainerResolve(token);
            }), error);
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).not.toHaveBeenCalled();
        });

        it('should handle failure when worldInitializer.initializeWorldEntities returns false', async () => {
            const expectedError = new Error('World initialization failed via WorldInitializer.');
            await testFailure(() => mockWorldInitializer.initializeWorldEntities.mockReturnValue(false), expectedError);
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });

        it('should handle failure when worldInitializer.initializeWorldEntities throws', async () => {
            const error = new Error('World entity init critical failure');
            await testFailure(() => mockWorldInitializer.initializeWorldEntities.mockImplementation(() => { throw error; }), error);
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });

        it('should handle failure when InputSetupService resolve fails', async () => {
            const error = new Error('Failed to resolve InputSetupService');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'InputSetupService') throw error;
                return originalContainerResolve(token);
            }), error);
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });


        it('should handle failure when inputSetupService.configureInputHandler throws', async () => {
            const error = new Error('Input setup failed');
            await testFailure(() => mockInputSetupService.configureInputHandler.mockImplementation(() => { throw error; }), error);
            // Check that GameLoop wasn't attempted (even though the step is removed, good sanity check)
            const resolveCalls = mockContainer.resolve.mock.calls.map(call => call[0]);
            expect(resolveCalls).not.toContain('GameLoop');
        });

        // --- CORRECTION: Deleted the obsolete test case for GameLoop resolve failure ---
        // it('should handle failure when GameLoop resolve fails', async () => {
        //     // ... test content deleted ...
        // });

        // --- Test for secondary failure during error handling (Remains Valid) ---
        it('should log an error if dispatching UI error events fails during main error handling', async () => {
            const mainError = new Error('World loading failed');
            const dispatchError = new Error('Failed to dispatch UI event');

            mockWorldLoader.loadWorld.mockRejectedValue(mainError);
            mockValidatedEventDispatcher.dispatchValidated.mockImplementation(async (eventName) => {
                if (eventName === 'initialization:initialization_service:started' || eventName === 'initialization:initialization_service:failed') {
                    return Promise.resolve(); // Allow non-UI events
                }
                if (eventName === 'ui:show_fatal_error' || eventName === 'ui:disable_input') {
                    throw dispatchError; // Make UI dispatches fail
                }
                throw new Error(`Unexpected event dispatched in UI fail test: ${eventName}`);
            });

            const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

            expect(result.success).toBe(false);
            expect(result.error).toBe(mainError);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`CRITICAL ERROR`), mainError);
            expect(mockLogger.error).toHaveBeenCalledWith(`InitializationService: Failed to dispatch UI error events after initialization failure:`, dispatchError);

            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:show_fatal_error', expect.anything());
            // Check at least one UI dispatch was attempted
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(expect.stringMatching(/ui:(show_fatal_error|disable_input)/), expect.anything());
        });
    });
});