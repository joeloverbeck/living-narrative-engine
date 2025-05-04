// src/tests/core/setup/inputSetupService.test.js

import InputSetupService from '../../../core/setup/inputSetupService';
import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {tokens} from '../../../core/config/tokens.js';

// --- Mock Imports ---
// Mocks created inline using jest.fn()

// --- Type Imports for Mocks ---
/** @typedef {import('../../../core/config/appContainer.js').default} AppContainer */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
// GameLoop type import removed
/** @typedef {import('../../../core/interfaces/IInputHandler.js').IInputHandler} IInputHandler */

describe('InputSetupService', () => {
    /** @type {AppContainer} */ let mockContainer;
    /** @type {ILogger} */ let mockLogger;
    /** @type {ValidatedEventDispatcher} */ let mockvalidatedEventDispatcher;
    // mockGameLoop removed
    /** @type {IInputHandler} */ let mockInputHandler;
    /** @type {Function | null} */ let capturedCallback = null;

    beforeEach(() => {
        capturedCallback = null;
        jest.clearAllMocks();

        // --- Create Mocks ---
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        mockvalidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(true),
            // Add subscribe/unsubscribe if needed by other tests using VED mock, though not directly by InputSetupService
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
        };

        // mockGameLoop removed

        mockInputHandler = {
            setCommandCallback: jest.fn((callback) => {
                capturedCallback = callback;
            }),
            enable: jest.fn(),
            disable: jest.fn(),
        };

        mockContainer = {
            resolve: jest.fn((key) => {
                if (key === tokens.IInputHandler) {
                    return mockInputHandler;
                }
                return undefined;
            }),
            register: jest.fn(),
            disposeSingletons: jest.fn(),
            reset: jest.fn(),
        };
    });

    // --- Test Suite 1: Constructor ---
    describe('Constructor', () => {
        it('should create an instance successfully with valid mocks', () => {
            const service = new InputSetupService({ // gameLoop removed
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockvalidatedEventDispatcher,
            });
            expect(service).toBeInstanceOf(InputSetupService);
            expect(mockLogger.info).toHaveBeenCalledWith('InputSetupService: Instance created.');
        });

        it('should throw an error if container is missing', () => {
            expect(() => {
                new InputSetupService({ // gameLoop removed
                    // container: undefined,
                    logger: mockLogger,
                    validatedEventDispatcher: mockvalidatedEventDispatcher,
                });
            }).toThrow("InputSetupService: Missing 'container'.");
        });

        it('should throw an error if logger is missing', () => {
            expect(() => {
                new InputSetupService({ // gameLoop removed
                    container: mockContainer,
                    // logger: undefined,
                    validatedEventDispatcher: mockvalidatedEventDispatcher,
                });
            }).toThrow("InputSetupService: Missing 'logger'.");
        });

        it('should throw an error if validatedEventDispatcher is missing', () => {
            expect(() => {
                new InputSetupService({ // gameLoop removed
                    container: mockContainer,
                    logger: mockLogger,
                    // validatedEventDispatcher: undefined,
                });
            }).toThrow("InputSetupService: Missing 'validatedEventDispatcher'.");
        });

        // Test for missing gameLoop removed as it's no longer a dependency
    });

    // --- Test Suite 2: configureInputHandler Method ---
    describe('configureInputHandler Method', () => {
        /** @type {InputSetupService} */ let service;

        beforeEach(() => {
            service = new InputSetupService({ // gameLoop removed
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockvalidatedEventDispatcher,
            });
        });

        it(`should call container.resolve with tokens.IInputHandler exactly once`, () => {
            service.configureInputHandler();
            expect(mockContainer.resolve).toHaveBeenCalledTimes(1);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IInputHandler);
        });

        it('should call inputHandler.setCommandCallback exactly once with a function argument', () => {
            service.configureInputHandler();
            expect(mockInputHandler.setCommandCallback).toHaveBeenCalledTimes(1);
            expect(mockInputHandler.setCommandCallback).toHaveBeenCalledWith(expect.any(Function));
            expect(capturedCallback).toBeInstanceOf(Function);
        });

        // --- UPDATED: Check for the new log message ---
        it('should call logger.info with the correct configuration message', () => {
            service.configureInputHandler();
            // Check the specific info message was logged
            expect(mockLogger.info).toHaveBeenCalledWith('InputSetupService: InputHandler resolved and command callback configured to dispatch command:submit events.');
            // Optionally, check the debug message still occurs
            expect(mockLogger.debug).toHaveBeenCalledWith('InputSetupService: Attempting to configure InputHandler...');
        });
        // --- END UPDATED ---

        it('should throw an error if IInputHandler cannot be resolved', () => {
            mockContainer.resolve.mockImplementation((key) => {
                if (key === tokens.IInputHandler) {
                    throw new Error('Test: Could not resolve IInputHandler');
                }
                return undefined;
            });

            expect(() => {
                service.configureInputHandler();
            }).toThrow('InputSetupService configuration failed: Test: Could not resolve IInputHandler');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'InputSetupService: Failed to resolve or configure InputHandler.',
                expect.any(Error)
            );
        });
    });

    // --- Test Suite 3: Callback Logic ---
    // Renamed suite - distinction between game loop running/not running is irrelevant here now
    describe('Callback Logic', () => {
        /** @type {InputSetupService} */ let service;
        const testCommand = 'test command';

        beforeEach(() => {
            service = new InputSetupService({ // gameLoop removed
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockvalidatedEventDispatcher,
            });
            service.configureInputHandler(); // Set up the callback
            // mockGameLoop.isRunning state setting removed
            if (!capturedCallback) {
                throw new Error('Test setup failed: Callback was not captured.');
            }
        });

        it('should call validatedEventDispatcher.dispatchValidated with ui:command_echo', async () => {
            await capturedCallback(testCommand);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'ui:command_echo',
                {command: testCommand}
            );
        });

        // --- UPDATED: Check for 'command:submit' dispatch ---
        it('should call validatedEventDispatcher.dispatchValidated with command:submit', async () => {
            await capturedCallback(testCommand);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'command:submit',
                {command: testCommand}
            );
            // Check it was called (at least) twice total: once for echo, once for submit
            // (plus initialization events if configureInputHandler is called within test)
            // We can be more specific checking the *last* relevant calls if needed.
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(
                // If configureInputHandler was called in the main describe's beforeEach,
                // it might be called more times across all tests.
                // Focusing on the specific calls is better.
                2 // Adjust if init events are not counted or configure is called elsewhere
            );
        });
        // --- END UPDATED ---

        // Test for calling gameLoop.processSubmittedCommand removed

        // Test for NOT calling ui:disable_input removed (was specific to gameLoop running case)

        // --- UPDATED: Check order of echo and submit dispatches ---
        it('should call ui:command_echo before command:submit', async () => {
            await capturedCallback(testCommand);

            // Find the specific calls *after* the callback invocation
            const calls = mockvalidatedEventDispatcher.dispatchValidated.mock.calls;
            const invocationOrder = mockvalidatedEventDispatcher.dispatchValidated.mock.invocationCallOrder;

            // Filter calls made *during* the callback execution (simplest: check last 2 relevant calls)
            const callbackCalls = calls.slice(-2); // Assuming echo and submit are the last 2 VED calls

            const echoCall = callbackCalls.find(call => call && call[0] === 'ui:command_echo');
            const submitCall = callbackCalls.find(call => call && call[0] === 'command:submit');

            expect(echoCall).toBeDefined();
            expect(submitCall).toBeDefined();

            // Find original indices to get invocation order
            const echoCallIndex = calls.findIndex(call => call === echoCall);
            const submitCallIndex = calls.findIndex(call => call === submitCall);

            expect(invocationOrder[echoCallIndex]).toBeLessThan(invocationOrder[submitCallIndex]);
        });
        // --- END UPDATED ---
    });

    // Test Suite 4: Callback Logic (GameLoop Not Running) REMOVED entirely
    // The callback behavior is no longer conditional on game loop state.
});