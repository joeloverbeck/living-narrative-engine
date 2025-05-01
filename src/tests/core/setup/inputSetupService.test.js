// src/tests/core/setup/inputSetupService.test.js

import InputSetupService from '../../../core/setup/inputSetupService';
import {beforeEach, describe, expect, it, jest} from '@jest/globals'; // Adjust path as necessary
// --- Token Import --- ADDED
import {tokens} from '../../../core/config/tokens.js'; // ADDED

// --- Mock Imports ---
// We'll create mocks directly using jest.fn() or jest.mock() inline below

// --- Type Imports for Mocks (Optional but good practice) ---
/** @typedef {import('../../../core/config/appContainer.js').default} AppContainer */ // Corrected path assumption
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */ // Corrected path assumption
/** @typedef {import('../../../core/services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Corrected path assumption
/** @typedef {import('../../../core/gameLoop.js').default} GameLoop */ // Corrected path assumption
/** @typedef {import('../../../core/interfaces/IInputHandler.js').IInputHandler} IInputHandler */ // Use Interface type

describe('InputSetupService', () => {
    /** @type {AppContainer} */ let mockContainer;
    /** @type {ILogger} */ let mockLogger;
    /** @type {ValidatedEventDispatcher} */ let mockvalidatedEventDispatcher;
    /** @type {GameLoop} */ let mockGameLoop;
    /** @type {IInputHandler} */ let mockInputHandler; // Use Interface type
    /** @type {Function | null} */ let capturedCallback = null; // To capture the function passed to setCommandCallback

    beforeEach(() => {
        // Reset mocks and captured callback before each test
        capturedCallback = null;
        jest.clearAllMocks(); // Clears call counts and recorded args for all mocks

        // --- Create Mocks ---
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        mockvalidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(true), // Default to resolving successfully
        };

        mockGameLoop = {
            isRunning: false, // Default state
            processSubmittedCommand: jest.fn(),
        };

        // Mock InputHandler specifically
        mockInputHandler = {
            setCommandCallback: jest.fn((callback) => {
                capturedCallback = callback; // Capture the passed function
            }),
            // Add other methods like enable/disable if needed by other tests, though not directly by InputSetupService
            enable: jest.fn(),
            disable: jest.fn(),
        };

        // Mock AppContainer and its resolve method
        mockContainer = {
            // --- MODIFIED: Resolve based on tokens.IInputHandler ---
            resolve: jest.fn((key) => {
                if (key === tokens.IInputHandler) { // Use token key
                    return mockInputHandler;
                }
                return undefined; // Default for other keys
            }),
            // --- END MODIFICATION ---
            // Add other AppContainer methods if needed
            register: jest.fn(),
            disposeSingletons: jest.fn(),
            reset: jest.fn(),
        };
    });

    // --- Test Suite 1: Constructor ---
    describe('Constructor', () => {
        it('should create an instance successfully with valid mocks', () => {
            const service = new InputSetupService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockvalidatedEventDispatcher,
                gameLoop: mockGameLoop,
            });
            expect(service).toBeInstanceOf(InputSetupService);
            expect(mockLogger.info).toHaveBeenCalledWith('InputSetupService: Instance created.');
        });

        it('should throw an error if container is missing', () => {
            expect(() => {
                new InputSetupService({
                    // container: undefined,
                    logger: mockLogger,
                    validatedEventDispatcher: mockvalidatedEventDispatcher,
                    gameLoop: mockGameLoop,
                });
            }).toThrow("InputSetupService: Missing 'container'.");
        });

        it('should throw an error if logger is missing', () => {
            expect(() => {
                new InputSetupService({
                    container: mockContainer,
                    // logger: undefined,
                    validatedEventDispatcher: mockvalidatedEventDispatcher,
                    gameLoop: mockGameLoop,
                });
            }).toThrow("InputSetupService: Missing 'logger'.");
        });

        it('should throw an error if validatedEventDispatcher is missing', () => {
            expect(() => {
                new InputSetupService({
                    container: mockContainer,
                    logger: mockLogger,
                    // validatedEventDispatcher: undefined,
                    gameLoop: mockGameLoop,
                });
            }).toThrow("InputSetupService: Missing 'validatedEventDispatcher'.");
        });

        it('should throw an error if gameLoop is missing', () => {
            expect(() => {
                new InputSetupService({
                    container: mockContainer,
                    logger: mockLogger,
                    validatedEventDispatcher: mockvalidatedEventDispatcher,
                    // gameLoop: undefined,
                });
            }).toThrow("InputSetupService: Missing 'gameLoop'.");
        });
    });

    // --- Test Suite 2: configureInputHandler Method ---
    describe('configureInputHandler Method', () => {
        /** @type {InputSetupService} */ let service;

        beforeEach(() => {
            // Instantiate the service for method tests
            service = new InputSetupService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockvalidatedEventDispatcher,
                gameLoop: mockGameLoop,
            });
        });

        // --- MODIFIED: Check for resolution with token ---
        it(`should call container.resolve with tokens.IInputHandler exactly once`, () => {
            service.configureInputHandler();
            expect(mockContainer.resolve).toHaveBeenCalledTimes(1);
            expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IInputHandler); // Use token
        });
        // --- END MODIFICATION ---

        it('should call inputHandler.setCommandCallback exactly once with a function argument', () => {
            service.configureInputHandler();
            expect(mockInputHandler.setCommandCallback).toHaveBeenCalledTimes(1);
            expect(mockInputHandler.setCommandCallback).toHaveBeenCalledWith(expect.any(Function));
            expect(capturedCallback).toBeInstanceOf(Function); // Verify the captured value is a function
        });

        it('should call logger.info with the correct configuration message', () => {
            service.configureInputHandler();
            expect(mockLogger.info).toHaveBeenCalledWith('InputSetupService: InputHandler resolved and command callback configured.');
            expect(mockLogger.debug).toHaveBeenCalledWith('InputSetupService: Attempting to configure InputHandler...');
        });

        // --- MODIFIED: Simulate failure when resolving token ---
        it('should throw an error if IInputHandler cannot be resolved', () => {
            // Override the mock resolve for this specific test
            mockContainer.resolve.mockImplementation((key) => {
                if (key === tokens.IInputHandler) { // Check for token
                    throw new Error('Test: Could not resolve IInputHandler');
                }
                return undefined;
            });

            expect(() => {
                service.configureInputHandler();
            }).toThrow('InputSetupService configuration failed: Test: Could not resolve IInputHandler'); // Error message reflects failed resolution
            // Check logger was called with the error
            expect(mockLogger.error).toHaveBeenCalledWith(
                'InputSetupService: Failed to resolve or configure InputHandler.',
                expect.any(Error) // Check that an error object was passed
            );
        });
        // --- END MODIFICATION ---

    });

    // --- Test Suite 3: Callback Logic (GameLoop Running) ---
    describe('Callback Logic (GameLoop Running)', () => {
        /** @type {InputSetupService} */ let service;
        const testCommand = 'test command';

        beforeEach(() => {
            service = new InputSetupService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockvalidatedEventDispatcher,
                gameLoop: mockGameLoop,
            });
            service.configureInputHandler(); // Set up the callback
            mockGameLoop.isRunning = true; // Set GameLoop state for this suite
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

        it('should call gameLoop.processSubmittedCommand with the command', async () => {
            await capturedCallback(testCommand);
            expect(mockGameLoop.processSubmittedCommand).toHaveBeenCalledTimes(1);
            expect(mockGameLoop.processSubmittedCommand).toHaveBeenCalledWith(testCommand);
        });

        it("should NOT call validatedEventDispatcher.dispatchValidated with 'ui:disable_input'", async () => {
            await capturedCallback(testCommand);
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'ui:disable_input',
                expect.anything()
            );
        });

        it('should call ui:command_echo before processSubmittedCommand', async () => {
            await capturedCallback(testCommand);

            const echoCallIndex = mockvalidatedEventDispatcher.dispatchValidated.mock.calls.findIndex(
                call => call && call[0] === 'ui:command_echo'
            );
            expect(echoCallIndex).toBeGreaterThanOrEqual(0);
            const echoGlobalOrder = mockvalidatedEventDispatcher.dispatchValidated.mock.invocationCallOrder[echoCallIndex];
            const processGlobalOrder = mockGameLoop.processSubmittedCommand.mock.invocationCallOrder[0];

            expect(echoGlobalOrder).toBeDefined();
            expect(processGlobalOrder).toBeDefined();
            expect(echoGlobalOrder).toBeLessThan(processGlobalOrder);
        });
    });

    // --- Test Suite 4: Callback Logic (GameLoop Not Running) ---
    describe('Callback Logic (GameLoop Not Running)', () => {
        /** @type {InputSetupService} */ let service;
        const testCommand = 'another command';

        beforeEach(() => {
            service = new InputSetupService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockvalidatedEventDispatcher,
                gameLoop: mockGameLoop,
            });
            service.configureInputHandler(); // Set up the callback
            mockGameLoop.isRunning = false; // Set GameLoop state for this suite
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

        it("should call validatedEventDispatcher.dispatchValidated with 'ui:disable_input' and message", async () => {
            await capturedCallback(testCommand);
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'ui:disable_input',
                {message: 'Game not running.'}
            );
        });

        it('should NOT call gameLoop.processSubmittedCommand', async () => {
            await capturedCallback(testCommand);
            expect(mockGameLoop.processSubmittedCommand).not.toHaveBeenCalled();
        });

        it("should call logger.warn with 'GameLoop is not ready/running'", async () => {
            await capturedCallback(testCommand);
            expect(mockLogger.warn).toHaveBeenCalledWith('Input received, but GameLoop is not ready/running.');
        });

        it('should call ui:command_echo before ui:disable_input', async () => {
            await capturedCallback(testCommand);

            const echoCallIndex = mockvalidatedEventDispatcher.dispatchValidated.mock.calls.findIndex(
                call => call && call[0] === 'ui:command_echo'
            );
            const disableCallIndex = mockvalidatedEventDispatcher.dispatchValidated.mock.calls.findIndex(
                call => call && call[0] === 'ui:disable_input'
            );

            expect(echoCallIndex).toBeGreaterThanOrEqual(0);
            expect(disableCallIndex).toBeGreaterThanOrEqual(0);

            const echoGlobalOrder = mockvalidatedEventDispatcher.dispatchValidated.mock.invocationCallOrder[echoCallIndex];
            const disableGlobalOrder = mockvalidatedEventDispatcher.dispatchValidated.mock.invocationCallOrder[disableCallIndex];

            expect(echoGlobalOrder).toBeDefined();
            expect(disableGlobalOrder).toBeDefined();
            expect(echoGlobalOrder).toBeLessThan(disableGlobalOrder);
        });
    });
});
