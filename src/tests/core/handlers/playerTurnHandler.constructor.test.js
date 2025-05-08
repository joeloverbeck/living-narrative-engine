// __tests__/PlayerTurnHandler.constructor.test.js
// --- FILE START ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {afterEach, beforeEach, describe, expect, it, jest, test} from "@jest/globals"; // Adjust path as necessary

describe('PlayerTurnHandler', () => {
    describe('Constructor', () => {
        let mockLogger;
        let mockCommandProcessor;
        let mockTurnEndPort;
        let mockPlayerPromptService;
        let mockCommandOutcomeInterpreter;
        let mockSafeEventDispatcher;
        let mockSubscriptionLifecycleManager;
        let validDependencies;
        let consoleErrorSpy;

        beforeEach(() => {
            mockLogger = {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            };
            mockCommandProcessor = {
                processCommand: jest.fn(),
            };
            mockTurnEndPort = {
                notifyTurnEnded: jest.fn(),
            };
            mockPlayerPromptService = {
                prompt: jest.fn(),
            };
            mockCommandOutcomeInterpreter = {
                interpret: jest.fn(),
            };
            mockSafeEventDispatcher = {
                dispatchSafely: jest.fn(),
                subscribe: jest.fn(),
            };
            mockSubscriptionLifecycleManager = {
                subscribeToCommandInput: jest.fn(),
                unsubscribeFromCommandInput: jest.fn(),
                subscribeToTurnEnded: jest.fn(),
                unsubscribeFromTurnEnded: jest.fn(),
                unsubscribeAll: jest.fn(),
            };

            validDependencies = {
                logger: mockLogger,
                commandProcessor: mockCommandProcessor,
                turnEndPort: mockTurnEndPort,
                playerPromptService: mockPlayerPromptService,
                commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
                safeEventDispatcher: mockSafeEventDispatcher,
                subscriptionLifecycleManager: mockSubscriptionLifecycleManager,
            };

            // Clear any spies from previous tests
            if (consoleErrorSpy) {
                consoleErrorSpy.mockRestore();
                consoleErrorSpy = null;
            }
        });

        afterEach(() => {
            // Ensure console.error is restored if a test fails before its local restore
            if (consoleErrorSpy) {
                consoleErrorSpy.mockRestore();
                consoleErrorSpy = null;
            }
            jest.clearAllMocks();
        });

        /**
         * Test: PlayerTurnHandler - Constructor - Successful Instantiation
         * Scenario ID: 3.1.1
         */
        it('should instantiate successfully when all dependencies are valid (Scenario 3.1.1)', () => {
            let handlerInstance = null;
            expect(() => {
                handlerInstance = new PlayerTurnHandler(validDependencies);
            }).not.toThrow();

            expect(handlerInstance).toBeInstanceOf(PlayerTurnHandler);
            expect(handlerInstance).not.toBeNull();
            expect(handlerInstance).not.toBeUndefined();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('PlayerTurnHandler initialized successfully with core dependencies.')
            );
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Or atLeastOnce if other debug calls are possible
        });

        /**
         * Test: PlayerTurnHandler - Constructor - Missing Logger Dependency
         * Scenario ID: 3.1.2
         */
        it('should throw an error and log to console.error if logger is null (Scenario 3.1.2)', () => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const dependenciesWithNullLogger = {...validDependencies, logger: null};

            expect(() => {
                new PlayerTurnHandler(dependenciesWithNullLogger);
            }).toThrow(Error);

            try {
                new PlayerTurnHandler(dependenciesWithNullLogger);
            } catch (e) {
                expect(e.message).toBe('PlayerTurnHandler: Invalid or missing logger dependency.');
            }

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'PlayerTurnHandler Constructor: Invalid or missing logger dependency (must include error and debug methods).'
            );
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error and log to console.error if logger is undefined (Scenario 3.1.2 extension)', () => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const dependenciesWithUndefinedLogger = {...validDependencies, logger: undefined};

            expect(() => {
                new PlayerTurnHandler(dependenciesWithUndefinedLogger);
            }).toThrow('PlayerTurnHandler: Invalid or missing logger dependency.');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'PlayerTurnHandler Constructor: Invalid or missing logger dependency (must include error and debug methods).'
            );
            consoleErrorSpy.mockRestore();
        });


        /**
         * Test: PlayerTurnHandler - Constructor - Invalid Logger (Missing Methods)
         * Scenario ID: 3.1.3
         */
        it('should throw an error and log to console.error if logger is invalid (e.g., missing error method) (Scenario 3.1.3)', () => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const invalidLogger = {debug: jest.fn(), info: jest.fn()}; // Missing 'error'
            const dependenciesWithInvalidLogger = {...validDependencies, logger: invalidLogger};

            expect(() => {
                new PlayerTurnHandler(dependenciesWithInvalidLogger);
            }).toThrow('PlayerTurnHandler: Invalid or missing logger dependency.');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'PlayerTurnHandler Constructor: Invalid or missing logger dependency (must include error and debug methods).'
            );
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error and log to console.error if logger is invalid (e.g., missing debug method) (Scenario 3.1.3 extension)', () => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const invalidLogger = {error: jest.fn(), warn: jest.fn()}; // Missing 'debug'
            const dependenciesWithInvalidLogger = {...validDependencies, logger: invalidLogger};

            expect(() => {
                new PlayerTurnHandler(dependenciesWithInvalidLogger);
            }).toThrow('PlayerTurnHandler: Invalid or missing logger dependency.');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'PlayerTurnHandler Constructor: Invalid or missing logger dependency (must include error and debug methods).'
            );
            consoleErrorSpy.mockRestore();
        });

        /**
         * Test: PlayerTurnHandler - Constructor - Missing or Invalid commandProcessor
         * Scenario ID: 3.1.4
         */
        describe('commandProcessor validation (Scenario 3.1.4)', () => {
            const expectedErrorMessage = 'PlayerTurnHandler: Invalid or missing commandProcessor.';
            const expectedLogError = 'PlayerTurnHandler Constructor: Invalid or missing commandProcessor (requires processCommand).';

            test.each([
                {case: 'null', value: null},
                {case: 'undefined', value: undefined}
            ])('should throw an error if commandProcessor is $case', ({value}) => {
                const deps = {...validDependencies, commandProcessor: value};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });

            it('should throw an error if commandProcessor.processCommand is not a function', () => {
                const invalidCommandProcessor = {processCommand: 'not-a-function'};
                const deps = {...validDependencies, commandProcessor: invalidCommandProcessor};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });
        });

        /**
         * Test: PlayerTurnHandler - Constructor - Missing or Invalid turnEndPort
         * Scenario ID: 3.1.5
         */
        describe('turnEndPort validation (Scenario 3.1.5)', () => {
            const expectedErrorMessage = 'PlayerTurnHandler: Invalid or missing turnEndPort.';
            const expectedLogError = 'PlayerTurnHandler Constructor: Invalid or missing turnEndPort (requires notifyTurnEnded method).';

            test.each([
                {case: 'null', value: null},
                {case: 'undefined', value: undefined}
            ])('should throw an error if turnEndPort is $case', ({value}) => {
                const deps = {...validDependencies, turnEndPort: value};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });

            it('should throw an error if turnEndPort.notifyTurnEnded is not a function', () => {
                const invalidTurnEndPort = {notifyTurnEnded: 'not-a-function'};
                const deps = {...validDependencies, turnEndPort: invalidTurnEndPort};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });
        });

        /**
         * Test: PlayerTurnHandler - Constructor - Missing or Invalid playerPromptService
         * Scenario ID: 3.1.6
         */
        describe('playerPromptService validation (Scenario 3.1.6)', () => {
            const expectedErrorMessage = 'PlayerTurnHandler: Invalid or missing playerPromptService.';
            const expectedLogError = 'PlayerTurnHandler Constructor: Invalid or missing playerPromptService (requires prompt method from IPlayerPromptService).';

            test.each([
                {case: 'null', value: null},
                {case: 'undefined', value: undefined}
            ])('should throw an error if playerPromptService is $case', ({value}) => {
                const deps = {...validDependencies, playerPromptService: value};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });

            it('should throw an error if playerPromptService.prompt is not a function', () => {
                const invalidPlayerPromptService = {prompt: 'not-a-function'};
                const deps = {...validDependencies, playerPromptService: invalidPlayerPromptService};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });
        });

        /**
         * Test: PlayerTurnHandler - Constructor - Missing or Invalid commandOutcomeInterpreter
         * Scenario ID: 3.1.7
         */
        describe('commandOutcomeInterpreter validation (Scenario 3.1.7)', () => {
            const expectedErrorMessage = 'PlayerTurnHandler: Invalid or missing commandOutcomeInterpreter.';
            const expectedLogError = 'PlayerTurnHandler Constructor: Invalid or missing commandOutcomeInterpreter (requires interpret method from ICommandOutcomeInterpreter).';

            test.each([
                {case: 'null', value: null},
                {case: 'undefined', value: undefined}
            ])('should throw an error if commandOutcomeInterpreter is $case', ({value}) => {
                const deps = {...validDependencies, commandOutcomeInterpreter: value};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });

            it('should throw an error if commandOutcomeInterpreter.interpret is not a function', () => {
                const invalidInterpreter = {interpret: 'not-a-function'};
                const deps = {...validDependencies, commandOutcomeInterpreter: invalidInterpreter};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });
        });

        /**
         * Test: PlayerTurnHandler - Constructor - Missing or Invalid safeEventDispatcher
         * Scenario ID: 3.1.8
         */
        describe('safeEventDispatcher validation (Scenario 3.1.8)', () => {
            const expectedErrorMessage = 'PlayerTurnHandler: Invalid or missing safeEventDispatcher.';
            const expectedLogError = 'PlayerTurnHandler Constructor: Invalid or missing safeEventDispatcher (requires dispatchSafely and subscribe methods).';

            test.each([
                {case: 'null', value: null},
                {case: 'undefined', value: undefined}
            ])('should throw an error if safeEventDispatcher is $case', ({value}) => {
                const deps = {...validDependencies, safeEventDispatcher: value};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });

            it('should throw an error if safeEventDispatcher is missing dispatchSafely method', () => {
                const invalidDispatcher = {subscribe: jest.fn()};
                const deps = {...validDependencies, safeEventDispatcher: invalidDispatcher};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });

            it('should throw an error if safeEventDispatcher is missing subscribe method', () => {
                const invalidDispatcher = {dispatchSafely: jest.fn()};
                const deps = {...validDependencies, safeEventDispatcher: invalidDispatcher};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });
            it('should throw an error if safeEventDispatcher.dispatchSafely is not a function', () => {
                const invalidDispatcher = {dispatchSafely: 'not-a-function', subscribe: jest.fn()};
                const deps = {...validDependencies, safeEventDispatcher: invalidDispatcher};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });
            it('should throw an error if safeEventDispatcher.subscribe is not a function', () => {
                const invalidDispatcher = {dispatchSafely: jest.fn(), subscribe: 'not-a-function'};
                const deps = {...validDependencies, safeEventDispatcher: invalidDispatcher};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });
        });

        /**
         * Test: PlayerTurnHandler - Constructor - Missing or Invalid subscriptionLifecycleManager
         * Scenario ID: 3.1.9
         */
        describe('subscriptionLifecycleManager validation (Scenario 3.1.9)', () => {
            const expectedErrorMessage = 'PlayerTurnHandler: Invalid or missing subscriptionLifecycleManager dependency.';
            const expectedLogError = 'PlayerTurnHandler Constructor: Invalid or missing subscriptionLifecycleManager dependency.'; // As per code

            test.each([
                {case: 'null', value: null},
                {case: 'undefined', value: undefined}
            ])('should throw an error if subscriptionLifecycleManager is $case', ({value}) => {
                const deps = {...validDependencies, subscriptionLifecycleManager: value};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });

            it('should throw an error if subscriptionLifecycleManager is missing subscribeToCommandInput method', () => {
                const invalidManager = {unsubscribeAll: jest.fn()}; // Missing subscribeToCommandInput
                const deps = {...validDependencies, subscriptionLifecycleManager: invalidManager};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });

            it('should throw an error if subscriptionLifecycleManager is missing unsubscribeAll method', () => {
                const invalidManager = {subscribeToCommandInput: jest.fn()}; // Missing unsubscribeAll
                const deps = {...validDependencies, subscriptionLifecycleManager: invalidManager};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });

            it('should throw an error if subscriptionLifecycleManager.subscribeToCommandInput is not a function', () => {
                const invalidManager = {subscribeToCommandInput: 'not-a-function', unsubscribeAll: jest.fn()};
                const deps = {...validDependencies, subscriptionLifecycleManager: invalidManager};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });

            it('should throw an error if subscriptionLifecycleManager.unsubscribeAll is not a function', () => {
                const invalidManager = {subscribeToCommandInput: jest.fn(), unsubscribeAll: 'not-a-function'};
                const deps = {...validDependencies, subscriptionLifecycleManager: invalidManager};
                expect(() => new PlayerTurnHandler(deps)).toThrow(expectedErrorMessage);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogError);
            });
        });
    });
});
// --- FILE END ---