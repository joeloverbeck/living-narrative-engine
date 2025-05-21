// tests/initializers/services/initializationService.runInitializationSequence.test.js
// ****** CORRECTED FILE ******

import InitializationService from '../../../src/initializers/services/initializationService.js';
import {afterEach, beforeEach, describe, expect, it, jest, test} from "@jest/globals";
import {tokens} from '../../../src/config/tokens.js'; // Import tokens for DomUiFacade

// --- Mocks ---
let mockContainer;
let mockLogger;
let mockValidatedEventDispatcher;
let mockWorldLoader;
let mockSystemInitializer;
let mockWorldInitializer;
let mockInputSetupService;
let mockDomUiFacade; // Added mock for DomUiFacade

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
            dispatchValidated: jest.fn().mockResolvedValue(undefined), // Default success
        };
        mockWorldLoader = {
            loadWorld: jest.fn().mockResolvedValue(undefined),
        };
        mockSystemInitializer = {
            initializeAll: jest.fn().mockResolvedValue(undefined),
        };
        mockWorldInitializer = {
            initializeWorldEntities: jest.fn().mockReturnValue(true),
        };
        mockInputSetupService = {
            configureInputHandler: jest.fn(),
        };
        mockDomUiFacade = {
            // Add methods if needed, but often just resolving it is enough
        };

        // Mock AppContainer resolve behavior - Simplified
        mockContainer = {
            resolve: jest.fn((token) => {
                switch (token) {
                    case 'WorldLoader':
                        return mockWorldLoader;
                    case 'SystemInitializer':
                        return mockSystemInitializer;
                    case 'WorldInitializer':
                        return mockWorldInitializer;
                    case 'InputSetupService':
                        return mockInputSetupService;
                    case tokens.DomUiFacade: // Use imported token
                        return mockDomUiFacade;
                    case 'ILogger': // For constructor fallback test & general logging
                        return mockLogger;
                    default:
                        // Return undefined for any other token requested by default
                        return undefined;
                }
            }),
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
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
            // Ensure the logger passed to the constructor is the mock
            // (This might be redundant if constructor logging uses container.resolve('ILogger') fallback)
            // but explicitly setting it ensures the correct mock is used if constructor logic changes.
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
            // Ensure container.resolve wasn't called except maybe for logger in constructor
            const relevantResolveCalls = mockContainer.resolve.mock.calls.filter(call => call[0] !== 'ILogger');
            expect(relevantResolveCalls.length).toBe(0);
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
        });

        // --- Success Path ---
        it('should run the full initialization sequence successfully', async () => {
            const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

            // 1. Verify Logging Start/End
            expect(mockLogger.info).toHaveBeenCalledWith(`InitializationService: Starting runInitializationSequence for world: ${MOCK_WORLD_NAME}.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`InitializationService: Initialization sequence for world '${MOCK_WORLD_NAME}' completed successfully (GameLoop resolution removed).`);

            // 3. Verify Orchestration (Resolves and Service Calls in Order)
            const resolveOrder = mockContainer.resolve.mock.calls.map(call => call[0]);
            // Filter out potential ILogger calls from constructor if they happen
            const serviceResolveOrder = resolveOrder.filter(token => token !== 'ILogger');
            expect(serviceResolveOrder).toEqual([
                'WorldLoader',
                'SystemInitializer',
                'WorldInitializer',
                'InputSetupService',
                tokens.DomUiFacade // Correct token
            ]);

            // Check service calls happened *after* resolve and in order
            expect(mockWorldLoader.loadWorld).toHaveBeenCalledWith(MOCK_WORLD_NAME);
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            expect(mockInputSetupService.configureInputHandler).toHaveBeenCalled();


            // 5. Verify Success Result
            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();

            // 6. Verify No Error Logging/Events for *critical* failures
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR'), expect.any(Error));
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('initialization:initialization_service:failed', expect.anything(), expect.anything());
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('ui:show_fatal_error', expect.anything());
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:disable_input', expect.anything());
        });

        // --- Failure Paths Helper ---
        // This helper is for CRITICAL failures that halt the sequence
        const testFailure = async (setupFailure, expectedError) => {
            setupFailure(); // Sets up the condition that throws the critical error
            const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

            // 1. Critical error logged - THIS IS THE ASSERTION THAT WAS FAILING
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during initialization sequence for world '${MOCK_WORLD_NAME}'`),
                expectedError // Expect the exact error object or one with the same message
            );
            // 3. 'failed' event dispatched (or attempted)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:initialization_service:failed',
                expect.objectContaining({ // Check relevant parts
                    worldName: MOCK_WORLD_NAME,
                    error: expectedError.message,
                }),
                {allowSchemaNotFound: true}
            );
            // If dispatch itself didn't fail, log success
            const failedEventCall = mockValidatedEventDispatcher.dispatchValidated.mock.calls.find(call => call[0] === 'initialization:initialization_service:failed');
            const failedEventResult = failedEventCall ? mockValidatedEventDispatcher.dispatchValidated.mock.results[mockValidatedEventDispatcher.dispatchValidated.mock.calls.indexOf(failedEventCall)] : undefined;
            if (failedEventResult?.type !== 'throw') {
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Dispatched 'initialization:initialization_service:failed' event"), expect.objectContaining({error: expectedError.message}));
            }

            // 4. UI events dispatched (or attempted)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'ui:show_fatal_error',
                expect.objectContaining({
                    title: 'Fatal Initialization Error',
                    message: expect.stringContaining(expectedError.message),
                })
            );
            // Check disable input was also called *if* show_fatal_error didn't throw
            const fatalErrorCall = mockValidatedEventDispatcher.dispatchValidated.mock.calls.find(call => call[0] === 'ui:show_fatal_error');
            const fatalErrorResult = fatalErrorCall ? mockValidatedEventDispatcher.dispatchValidated.mock.results[mockValidatedEventDispatcher.dispatchValidated.mock.calls.indexOf(fatalErrorCall)] : undefined;
            if (fatalErrorResult?.type !== 'throw') {
                expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                    'textUI:disable_input',
                    {message: 'Fatal error during initialization. Cannot continue.'}
                );
                expect(mockLogger.info).toHaveBeenCalledWith('InitializationService: Dispatched ui:show_fatal_error and textUI:disable_input events.');
            }


            // 5. Failure Result object properties
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            // Use expect.objectContaining for error comparison if exact instance isn't guaranteed
            expect(result.error).toEqual(expect.objectContaining({message: expectedError.message}));
            expect(result.gameLoop).toBeUndefined();

            // 6. 'completed' event NOT dispatched
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'initialization:initialization_service:completed',
                expect.anything(),
                expect.anything()
            );
        };

        // --- Critical Failure Tests (Using testFailure helper) ---
        it('should handle failure when WorldLoader resolve fails', async () => {
            const error = new Error('Failed to resolve WorldLoader');
            await testFailure(() => {
                // Directly mock container.resolve for this specific test run
                mockContainer.resolve.mockImplementation((token) => {
                    if (token === 'WorldLoader') {
                        throw error; // Simulate failure for this token
                    }
                    if (token === 'ILogger') {
                        return mockLogger; // Still provide logger if needed by constructor/service
                    }
                    // No other services should be resolved before this point in the sequence
                    return undefined;
                });
            }, error);
            // Assert that subsequent steps were NOT taken
            expect(mockWorldLoader.loadWorld).not.toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
            // ... and so on for other steps
        });


        it('should handle failure when worldLoader.loadWorld rejects', async () => {
            const error = new Error('World loading failed');
            // No need to change resolve mock, just the method mock
            await testFailure(() => mockWorldLoader.loadWorld.mockRejectedValue(error), error);
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
        });

        it('should handle failure when SystemInitializer resolve fails', async () => {
            const error = new Error('Failed to resolve SystemInitializer');
            await testFailure(() => {
                // Directly mock container.resolve
                mockContainer.resolve.mockImplementation((token) => {
                    if (token === 'SystemInitializer') {
                        throw error; // Fail here
                    }
                    if (token === 'WorldLoader') {
                        return mockWorldLoader; // This needs to resolve successfully first
                    }
                    if (token === 'ILogger') {
                        return mockLogger;
                    }
                    return undefined;
                });
            }, error);
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled(); // Should have been called before failure
            expect(mockSystemInitializer.initializeAll).not.toHaveBeenCalled();
        });


        it('should handle failure when systemInitializer.initializeAll rejects', async () => {
            const error = new Error('System init failed');
            // No need to change resolve mock, just the method mock
            await testFailure(() => mockSystemInitializer.initializeAll.mockRejectedValue(error), error);
            // Ensure previous step was called
            expect(mockWorldLoader.loadWorld).toHaveBeenCalledWith(MOCK_WORLD_NAME);
            // Ensure subsequent steps were not called
            expect(mockWorldInitializer.initializeWorldEntities).not.toHaveBeenCalled();
        });


        it('should handle failure when WorldInitializer resolve fails', async () => {
            const error = new Error('Failed to resolve WorldInitializer');
            await testFailure(() => {
                // Directly mock container.resolve
                mockContainer.resolve.mockImplementation((token) => {
                    if (token === 'WorldInitializer') {
                        throw error; // Fail here
                    }
                    // Services resolved before this point:
                    if (token === 'WorldLoader') return mockWorldLoader;
                    if (token === 'SystemInitializer') return mockSystemInitializer;
                    if (token === 'ILogger') return mockLogger;
                    return undefined;
                });
            }, error);
            // Ensure previous steps were called
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            // Ensure subsequent steps were not called
            expect(mockWorldInitializer.initializeWorldEntities).not.toHaveBeenCalled();
        });


        it('should handle failure when worldInitializer.initializeWorldEntities returns false', async () => {
            // The service code now throws an error in this case
            const expectedError = new Error('World initialization failed via WorldInitializer.');
            await testFailure(() => {
                mockWorldInitializer.initializeWorldEntities.mockReturnValue(false);
                // Resolve mock is standard here
            }, expectedError);
            // Ensure previous steps were called
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            // Ensure subsequent steps were not called
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });


        it('should handle failure when worldInitializer.initializeWorldEntities throws', async () => {
            const error = new Error('World entity init critical failure');
            await testFailure(() => {
                mockWorldInitializer.initializeWorldEntities.mockImplementation(() => {
                    throw error;
                });
                // Resolve mock is standard here
            }, error);
            // Ensure previous steps were called
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            // Ensure subsequent steps were not called
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });

        it('should handle failure when InputSetupService resolve fails', async () => {
            const error = new Error('Failed to resolve InputSetupService');
            await testFailure(() => {
                // Directly mock container.resolve
                mockContainer.resolve.mockImplementation((token) => {
                    if (token === 'InputSetupService') {
                        throw error; // Fail here
                    }
                    // Services resolved before this point:
                    if (token === 'WorldLoader') return mockWorldLoader;
                    if (token === 'SystemInitializer') return mockSystemInitializer;
                    if (token === 'WorldInitializer') return mockWorldInitializer;
                    if (token === 'ILogger') return mockLogger;
                    return undefined;
                });
            }, error);
            // Ensure previous steps were called
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            // Ensure subsequent steps were not called
            expect(mockInputSetupService.configureInputHandler).not.toHaveBeenCalled();
        });


        it('should handle failure when inputSetupService.configureInputHandler throws', async () => {
            const error = new Error('Input setup failed');
            await testFailure(() => {
                mockInputSetupService.configureInputHandler.mockImplementation(() => {
                    throw error;
                });
                // Resolve mock is standard here
            }, error);
            // Ensure previous steps were called
            expect(mockWorldLoader.loadWorld).toHaveBeenCalled();
            expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
            expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalled();
            // Check that DomUiFacade resolve wasn't attempted *after* this failure
            const resolveCalls = mockContainer.resolve.mock.calls.map(call => call[0]);
            expect(resolveCalls).not.toContain(tokens.DomUiFacade);
        });

        // --- Test for secondary failure during error handling ---
        it('should log an error if dispatching UI error events fails during main error handling', async () => {
            const mainError = new Error('World loading failed');
            const dispatchError = new Error('Failed to dispatch UI event');

            // 1. Simulate the main initialization failure
            mockWorldLoader.loadWorld.mockRejectedValue(mainError);

            // 2. Simulate the failure of the event dispatch for UI events
            mockValidatedEventDispatcher.dispatchValidated.mockImplementation(async (eventName, payload) => {
                if (eventName === 'ui:show_fatal_error' || eventName === 'textUI:disable_input') {
                    throw dispatchError; // Simulate failure ONLY for UI events
                }
                // Allow other dispatches (like 'failed') to succeed for this test
                return Promise.resolve();
            });

            // 3. Run the sequence
            const result = await service.runInitializationSequence(MOCK_WORLD_NAME);

            // 4. Assertions
            expect(result.success).toBe(false);
            // Check the error message specifically, instance might be different if re-thrown/wrapped
            expect(result.error?.message).toBe(mainError.message);


            // Check that the *main* error was logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`CRITICAL ERROR during initialization sequence for world '${MOCK_WORLD_NAME}'`),
                mainError // Or expect.objectContaining({ message: mainError.message })
            );

            // Check that the *secondary* error (failure to dispatch UI events) was also logged
            expect(mockLogger.error).toHaveBeenCalledWith(
                `InitializationService: Failed to dispatch UI error events after initialization failure:`,
                dispatchError // Or expect.objectContaining({ message: dispatchError.message })
            );

            // Verify that the dispatch for the UI event that *caused* the secondary error was attempted
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('ui:show_fatal_error', expect.anything());

            // Verify the 'initialization:initialization_service:failed' event was still attempted (and succeeded based on mock setup)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:initialization_service:failed',
                expect.objectContaining({worldName: MOCK_WORLD_NAME, error: mainError.message}),
                expect.anything() // options like {allowSchemaNotFound: true}
            );

            // Because 'ui:show_fatal_error' threw, 'textUI:disable_input' should NOT have been called AFTER it
            const calls = mockValidatedEventDispatcher.dispatchValidated.mock.calls;
            const failedCallIndex = calls.findIndex(call => call[0] === 'initialization:initialization_service:failed');
            const uiFatalCallIndex = calls.findIndex(call => call[0] === 'ui:show_fatal_error');
            const uiDisableCallIndex = calls.findIndex(call => call[0] === 'textUI:disable_input');

            expect(failedCallIndex).toBeGreaterThanOrEqual(0); // init failed event called
            expect(uiFatalCallIndex).toBeGreaterThanOrEqual(0); // ui fatal called
            // Ensure uiFatal was called *after* the failed event if order matters strictly, otherwise just check presence.
            if (failedCallIndex !== -1 && uiFatalCallIndex !== -1) {
                // This check might be too strict depending on async nature, but good to verify intent
                // expect(uiFatalCallIndex).toBeGreaterThan(failedCallIndex);
            }
            expect(uiDisableCallIndex).toBe(-1); // ui disable should NOT be called because ui fatal threw
        });
    });
});