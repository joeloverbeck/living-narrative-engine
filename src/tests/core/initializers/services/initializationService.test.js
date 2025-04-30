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
let mockGameLoop;
// Variable to store the original container.resolve mock implementation
let originalContainerResolve;

const MOCK_WORLD_NAME = 'testWorld';
const MOCK_GAMELOOP_ID = 'gl-12345';

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
        mockGameLoop = {
            id: MOCK_GAMELOOP_ID,
            // other properties/methods if needed by the service
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
                    case 'GameLoop':
                        return mockGameLoop;
                    case 'ILogger': // For constructor fallback test
                        return mockLogger;
                    default:
                        // Throw error only if not mocked elsewhere - allows specific tests to override
                        throw new Error(`Default mock resolve error: Unknown token ${token}`);
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
            // We don't strictly need to check container.resolve('ILogger') here,
            // as the primary check is the thrown error and the console message.
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
            // Error should be logged by the constructor itself if logger is valid
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

        // --- Input Validation ---
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
            expect(mockContainer.resolve).not.toHaveBeenCalled();
            // Event dispatcher should not be called for input validation failure before sequence starts
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(expect.stringContaining('initialization:'), expect.anything(), expect.anything());
        });

        // --- Success Path ---
        it('should run the full initialization sequence successfully', async () => {
            const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

            // 1. Verify Logging Start/End
            expect(mockLogger.info).toHaveBeenCalledWith(`InitializationService: Starting runInitializationSequence for world: ${MOCK_WORLD_NAME}.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`InitializationService: Initialization sequence for world '${MOCK_WORLD_NAME}' completed successfully.`);

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
            expect(resolveOrder).toEqual([
                'WorldLoader',
                'SystemInitializer',
                'GameStateInitializer',
                'WorldInitializer',
                'InputSetupService',
                'GameLoop'
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
                { worldName: MOCK_WORLD_NAME, gameLoopInstanceId: MOCK_GAMELOOP_ID },
                { allowSchemaNotFound: true }
            );
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:initialization_service:completed' event.", { worldName: MOCK_WORLD_NAME, gameLoopInstanceId: MOCK_GAMELOOP_ID });


            // 5. Verify Success Result
            expect(result.success).toBe(true);
            expect(result.gameLoop).toBe(mockGameLoop);
            expect(result.error).toBeUndefined();

            // 6. Verify No Error Logging/Events
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), expect.any(Error));
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('initialization:initialization_service:failed', expect.anything(), expect.anything());
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('ui:show_fatal_error', expect.anything());
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('ui:disable_input', expect.anything());
        });

        // --- Failure Paths ---
        // Helper function to test common failure logic
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
            // expect(result.error).toBe(expectedError); // REMOVED: This fails for service-generated errors due to instance inequality
            expect(result.error).toBeInstanceOf(Error); // Ensure an error object was returned
            expect(result.error.message).toEqual(expectedError.message); // Check the message is correct
            expect(result.gameLoop).toBeUndefined();

            // 6. Verify 'completed' event was NOT dispatched
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'initialization:initialization_service:completed',
                expect.anything(),
                expect.anything()
            );
        };

        it('should handle failure when WorldLoader resolve fails', async () => {
            const error = new Error('Failed to resolve WorldLoader');
            // Override resolve specifically for this test
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'WorldLoader') throw error;
                // Delegate to original mock for others (like ILogger if constructor fails)
                return originalContainerResolve(token);
            }), error);
            // Ensure subsequent steps didn't run
            expect(mockWorldLoader.loadWorld).not.toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
        });

        it('should handle failure when worldLoader.loadWorld rejects', async () => {
            const error = new Error('World loading failed');
            await testFailure(() => mockWorldLoader.loadWorld.mockRejectedValue(error), error);
            // Ensure subsequent steps didn't run
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
        });

        it('should handle failure when SystemInitializer resolve fails', async () => {
            const error = new Error('Failed to resolve SystemInitializer');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'SystemInitializer') throw error; // Fails here
                // Use original mock for preceding steps and others
                return originalContainerResolve(token);
            }), error);
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled(); // Previous step ran
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled(); // Failed step didn't run
        });

        it('should handle failure when systemInitializer.initializeAll rejects', async () => {
            const error = new Error('System init failed');
            await testFailure(() => mockSystemInitializer.initializeAll.mockRejectedValue(error), error);
            expect(mockGameStateInitializer.setupInitialState).not.toHaveBeenCalled();
        });

        it('should handle failure when GameStateInitializer resolve fails', async () => {
            const error = new Error('Failed to resolve GameStateInitializer');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'GameStateInitializer') throw error; // Fails here
                return originalContainerResolve(token); // Use original for others
            }), error);
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockGameStateInitializer.setupInitialState).not.toHaveBeenCalled();
        });

        it('should handle failure when gameStateInitializer.setupInitialState returns false', async () => {
            // The service *throws* its own error in this case.
            const expectedError = new Error('Initial game state setup failed via GameStateInitializer.');
            // We pass the expectedError to testFailure for message checking, etc.
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
                if (token === 'WorldInitializer') throw error; // Fails here
                return originalContainerResolve(token); // Use original for others
            }), error);
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).not.toHaveBeenCalled();
        });

        it('should handle failure when worldInitializer.initializeWorldEntities returns false', async () => {
            // The service *throws* its own error in this case.
            const expectedError = new Error('World initialization failed via WorldInitializer.');
            // Pass expectedError for message checking in testFailure.
            await testFailure(() => mockWorldInitializer.initializeWorldEntities.mockReturnValue(false), expectedError);
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });

        it('should handle failure when worldInitializer.initializeWorldEntities throws', async () => {
            // This tests if the method itself throws directly.
            const error = new Error('World entity init critical failure');
            await testFailure(() => mockWorldInitializer.initializeWorldEntities.mockImplementation(() => { throw error; }), error);
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });

        it('should handle failure when InputSetupService resolve fails', async () => {
            const error = new Error('Failed to resolve InputSetupService');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'InputSetupService') throw error; // Fails here
                return originalContainerResolve(token); // Use original for others
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
            // GameLoop resolve should not happen if input setup fails
            expect(mockContainer.resolve).not.toHaveBeenCalledWith('GameLoop');
        });

        it('should handle failure when GameLoop resolve fails', async () => {
            const error = new Error('Failed to resolve GameLoop');
            await testFailure(() => mockContainer.resolve.mockImplementation((token) => {
                if (token === 'GameLoop') throw error; // Fails here
                return originalContainerResolve(token); // Use original for others
            }), error);
            // Previous steps should have run
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockGameStateInitializer.setupInitialState).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).toHaveBeenCalled();
            // testFailure checks that completed event wasn't dispatched
        });

        it('should log an error if dispatching UI error events fails during main error handling', async () => {
            const mainError = new Error('World loading failed');
            const dispatchError = new Error('Failed to dispatch UI event');

            mockWorldLoader.loadWorld.mockRejectedValue(mainError);
            // Make the UI dispatch calls fail specifically
            mockValidatedEventDispatcher.dispatchValidated.mockImplementation(async (eventName) => {
                if (eventName === 'initialization:initialization_service:started') {
                    return Promise.resolve(); // Allow start event
                }
                if (eventName === 'initialization:initialization_service:failed') {
                    return Promise.resolve(); // Allow failed event
                }
                if (eventName === 'ui:show_fatal_error' || eventName === 'ui:disable_input') {
                    throw dispatchError; // Make UI dispatches fail
                }
                // Should not reach completed event
                throw new Error(`Unexpected event dispatched in UI fail test: ${eventName}`);
            });

            const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

            // Still expect the overall failure result from the main error
            expect(result.success).toBe(false);
            // Check the returned error matches the main error instance
            expect(result.error).toBe(mainError);


            // Expect the main error log
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(`CRITICAL ERROR`), mainError);
            // Crucially, expect the *secondary* error log for the dispatch failure
            expect(mockLogger.error).toHaveBeenCalledWith(`InitializationService: Failed to dispatch UI error events after initialization failure:`, dispatchError);

            // Check UI events were attempted
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:show_fatal_error', expect.anything());
            // Depending on whether the first UI dispatch throws immediately, the second might not be called.
            // Let's check it was called at least once.
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(expect.stringMatching(/ui:(show_fatal_error|disable_input)/), expect.anything());


        });
    });
});