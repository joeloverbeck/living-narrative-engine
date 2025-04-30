// src/tests/core/shutdown/services/shutdownService.test.js

import ShutdownService from '../../../../core/shutdown/services/shutdownService.js';
import { SHUTDOWNABLE } from '../../../../core/config/tags.js';
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

// --- Mocks ---
let mockContainer;
let mockLogger;
let mockValidatedEventDispatcher;
let mockGameLoop;
let mockShutdownableSystem1;
let mockShutdownableSystem2;
let mockSystemWithError;
let mockSystemWithoutShutdown;

const MOCK_ERROR_MESSAGE = 'Mock error during shutdown';
const MOCK_SYSTEM1_NAME = 'MockSystem1';
const MOCK_SYSTEM2_NAME = 'MockSystem2';
const MOCK_ERROR_SYSTEM_NAME = 'ErrorSystem';
const MOCK_NO_SHUTDOWN_SYSTEM_NAME = 'NoShutdownSystem';

describe('ShutdownService', () => {
    beforeEach(() => {
        // Reset mocks for each test
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
        };
        mockValidatedEventDispatcher = {
            // Default success, allow overriding in tests
            dispatchValidated: jest.fn().mockResolvedValue(undefined),
        };
        mockGameLoop = {
            isRunning: true, // Default to running
            stop: jest.fn(),
        };

        // Mock systems
        mockShutdownableSystem1 = {
            shutdown: jest.fn(),
            constructor: { name: MOCK_SYSTEM1_NAME }
        };
        mockShutdownableSystem2 = {
            shutdown: jest.fn(),
            constructor: { name: MOCK_SYSTEM2_NAME }
        };
        mockSystemWithError = {
            shutdown: jest.fn(() => { throw new Error(MOCK_ERROR_MESSAGE); }),
            constructor: { name: MOCK_ERROR_SYSTEM_NAME }
        };
        mockSystemWithoutShutdown = {
            // No shutdown method
            constructor: { name: MOCK_NO_SHUTDOWN_SYSTEM_NAME }
        };

        // Mock AppContainer
        mockContainer = {
            resolveByTag: jest.fn().mockReturnValue([ // Default success with standard systems
                mockShutdownableSystem1,
                mockShutdownableSystem2,
            ]),
            disposeSingletons: jest.fn(),
            resolve: jest.fn((token) => { // Primarily for constructor fallback test
                if (token === 'ILogger') return mockLogger;
                throw new Error(`Mock container unexpected resolve: ${token}`);
            }),
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        // No changes needed in constructor tests
        it('should instantiate successfully with valid dependencies', () => {
            expect(() => new ShutdownService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                gameLoop: mockGameLoop
            })).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith('ShutdownService: Instance created successfully with dependencies.');
        });

        it('should throw an error if container is missing', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            expect(() => new ShutdownService({
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                gameLoop: mockGameLoop
            })).toThrow('ShutdownService: Missing required dependency \'container\'.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('ShutdownService: Missing required dependency \'container\'.');
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if logger is missing', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            // Mock container resolve to simulate fallback attempt
            mockContainer.resolve.mockImplementationOnce((token) => {
                if (token === 'ILogger') throw new Error('Could not resolve fallback');
                return undefined;
            })
            expect(() => new ShutdownService({
                container: mockContainer,
                // logger: missing
                validatedEventDispatcher: mockValidatedEventDispatcher,
                gameLoop: mockGameLoop
            })).toThrow('ShutdownService: Missing or invalid required dependency \'logger\'.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('ShutdownService: Missing or invalid required dependency \'logger\'.');
            // Check fallback attempt was made
            expect(mockContainer.resolve).toHaveBeenCalledWith('ILogger');
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if logger is invalid (missing warn)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const invalidLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() /* warn missing */ };
            expect(() => new ShutdownService({
                container: mockContainer,
                logger: invalidLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                gameLoop: mockGameLoop
            })).toThrow('ShutdownService: Missing or invalid required dependency \'logger\'.');
            expect(consoleErrorSpy).toHaveBeenCalledWith('ShutdownService: Missing or invalid required dependency \'logger\'.');
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if validatedEventDispatcher is missing', () => {
            expect(() => new ShutdownService({
                container: mockContainer,
                logger: mockLogger,
                // validatedEventDispatcher: missing
                gameLoop: mockGameLoop
            })).toThrow('ShutdownService: Missing or invalid required dependency \'validatedEventDispatcher\'.');
            expect(mockLogger.error).toHaveBeenCalledWith('ShutdownService: Missing or invalid required dependency \'validatedEventDispatcher\'.');
        });

        it('should throw an error if validatedEventDispatcher is invalid (missing dispatchValidated)', () => {
            const invalidDispatcher = { dispatch: jest.fn() };
            expect(() => new ShutdownService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: invalidDispatcher,
                gameLoop: mockGameLoop
            })).toThrow('ShutdownService: Missing or invalid required dependency \'validatedEventDispatcher\'.');
            expect(mockLogger.error).toHaveBeenCalledWith('ShutdownService: Missing or invalid required dependency \'validatedEventDispatcher\'.');
        });

        it('should throw an error if gameLoop is missing', () => {
            expect(() => new ShutdownService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                // gameLoop: missing
            })).toThrow('ShutdownService: Missing or invalid required dependency \'gameLoop\'. Expected a GameLoop instance with isRunning and stop().');
            expect(mockLogger.error).toHaveBeenCalledWith('ShutdownService: Missing or invalid required dependency \'gameLoop\'. Expected a GameLoop instance with isRunning and stop().');
        });

        it('should throw an error if gameLoop is invalid (missing stop)', () => {
            const invalidGameLoop = { isRunning: true /* stop missing */ };
            expect(() => new ShutdownService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                gameLoop: invalidGameLoop,
            })).toThrow('ShutdownService: Missing or invalid required dependency \'gameLoop\'. Expected a GameLoop instance with isRunning and stop().');
            expect(mockLogger.error).toHaveBeenCalledWith('ShutdownService: Missing or invalid required dependency \'gameLoop\'. Expected a GameLoop instance with isRunning and stop().');
        });

        it('should throw an error if gameLoop is invalid (missing isRunning)', () => {
            const invalidGameLoop = { stop: jest.fn() /* isRunning missing */ };
            expect(() => new ShutdownService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                gameLoop: invalidGameLoop,
            })).toThrow('ShutdownService: Missing or invalid required dependency \'gameLoop\'. Expected a GameLoop instance with isRunning and stop().');
            expect(mockLogger.error).toHaveBeenCalledWith('ShutdownService: Missing or invalid required dependency \'gameLoop\'. Expected a GameLoop instance with isRunning and stop().');
        });
    });

    // --- runShutdownSequence Tests ---
    describe('runShutdownSequence', () => {
        let service;

        beforeEach(() => {
            // Create a valid service instance for sequence tests
            service = new ShutdownService({
                container: mockContainer,
                logger: mockLogger,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                gameLoop: mockGameLoop
            });
            // Reset mock return values needed for specific tests
            mockContainer.resolveByTag.mockReturnValue([
                mockShutdownableSystem1,
                mockShutdownableSystem2,
            ]);
        });

        // --- Success Path ---
        it('should run the full shutdown sequence successfully when game loop is running', async () => {
            mockGameLoop.isRunning = true;

            await service.runShutdownSequence();

            // Verify order and calls
            const loggerInfoCalls = mockLogger.info.mock.calls.map(call => call[0]);
            const loggerDebugCalls = mockLogger.debug.mock.calls.map(call => call[0]);
            const dispatchCalls = mockValidatedEventDispatcher.dispatchValidated.mock.calls;

            // Expect constructor log first (index 0)
            expect(loggerInfoCalls[0]).toBe('ShutdownService: Instance created successfully with dependencies.');

            // 1. Initial logs and events (Indices 1-based relative to sequence start)
            expect(loggerInfoCalls[1]).toBe('ShutdownService: runShutdownSequence called. Starting shutdown sequence...');
            expect(dispatchCalls[0][0]).toBe('shutdown:shutdown_service:started');
            expect(dispatchCalls[1][0]).toBe('ui:show_message');
            expect(dispatchCalls[1][1]).toEqual({ text: 'System shutting down...', type: 'info' });
            expect(loggerDebugCalls).toContain("Dispatched 'shutdown:shutdown_service:started' event.");
            expect(loggerDebugCalls).toContain('ShutdownService: Dispatched ui:show_message event.');

            // 2. Stop Game Loop (Indices 2, 3)
            expect(loggerInfoCalls[2]).toBe('ShutdownService: Stopping GameLoop...');
            expect(mockGameLoop.stop).toHaveBeenCalledTimes(1);
            expect(loggerInfoCalls[3]).toBe('ShutdownService: GameLoop stop() method called.');

            // 3. Resolve Shutdownable Systems (Indices 4, 5)
            expect(loggerInfoCalls[4]).toBe("ShutdownService: Attempting to shut down systems tagged as SHUTDOWNABLE...");
            expect(mockContainer.resolveByTag).toHaveBeenCalledWith(SHUTDOWNABLE[0]);
            expect(loggerInfoCalls[5]).toBe(`ShutdownService: Found 2 systems tagged as SHUTDOWNABLE.`);

            // 4. Shutdown Systems (Indices 6, 7 for logs inside loop, then 8)
            // Check debug logs for attempt
            expect(loggerDebugCalls).toContain(`ShutdownService: Attempting to call shutdown() on system: ${MOCK_SYSTEM1_NAME}...`);
            // Check mock function call
            expect(mockShutdownableSystem1.shutdown).toHaveBeenCalledTimes(1);
            // Check specific info log for success (using toHaveBeenCalledWith for robustness)
            expect(mockLogger.info).toHaveBeenCalledWith(`ShutdownService: Successfully called shutdown() on system: ${MOCK_SYSTEM1_NAME}.`);
            // Check specific log message by index if order is critical
            expect(loggerInfoCalls[6]).toBe(`ShutdownService: Successfully called shutdown() on system: ${MOCK_SYSTEM1_NAME}.`); // <-- Log for System 1

            expect(loggerDebugCalls).toContain(`ShutdownService: Attempting to call shutdown() on system: ${MOCK_SYSTEM2_NAME}...`);
            expect(mockShutdownableSystem2.shutdown).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(`ShutdownService: Successfully called shutdown() on system: ${MOCK_SYSTEM2_NAME}.`);
            expect(loggerInfoCalls[7]).toBe(`ShutdownService: Successfully called shutdown() on system: ${MOCK_SYSTEM2_NAME}.`); // <-- Log for System 2

            // **CORRECTED INDEX:** Finished processing is AFTER the logs for each system (index 5 + 1 + 2 = 8)
            expect(loggerInfoCalls[8]).toBe("ShutdownService: Finished processing SHUTDOWNABLE systems."); // <-- CORRECTED index

            // 5. Dispose Singletons (Indices 9, 10, 11)
            // **CORRECTED INDEX:** Checking disposal (index 8 + 1 = 9)
            expect(loggerInfoCalls[9]).toBe('ShutdownService: Checking container for singleton disposal...');
            // **CORRECTED INDEX:** Attempting disposal (index 9 + 1 = 10)
            expect(loggerInfoCalls[10]).toBe('ShutdownService: Attempting to dispose container singletons...');
            expect(mockContainer.disposeSingletons).toHaveBeenCalledTimes(1);
            // **CORRECTED INDEX:** Disposal successful (index 10 + 1 = 11)
            expect(loggerInfoCalls[11]).toBe('ShutdownService: Container singletons disposed successfully.');

            // 6. Final logs and events (Index 12 for log, check event dispatch)
            // **CORRECTED INDEX:** Sequence finished (index 11 + 1 = 12)
            expect(loggerInfoCalls[12]).toBe('ShutdownService: Shutdown sequence finished.');
            // Check completed event dispatch (should be the 3rd dispatch call overall)
            expect(dispatchCalls[2][0]).toBe('shutdown:shutdown_service:completed');
            expect(loggerDebugCalls).toContain("Dispatched 'shutdown:shutdown_service:completed' event.");

            // 7. No critical errors or failure events
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('shutdown:shutdown_service:failed', expect.anything(), expect.anything());

            // Verify total info calls match expected count
            expect(mockLogger.info).toHaveBeenCalledTimes(13); // Constructor(1) + Sequence Start(1) + Stop(2) + Resolve(2) + Sys1(1) + Sys2(1) + Finished Sys(1) + Dispose(3) + Finished Seq(1) = 13
        });

        it('should run the shutdown sequence correctly when game loop is already stopped', async () => {
            mockGameLoop.isRunning = false;

            await service.runShutdownSequence();

            // Verify GameLoop interactions
            // Constructor log is still [0]
            expect(mockLogger.info.mock.calls[1][0]).toBe('ShutdownService: runShutdownSequence called. Starting shutdown sequence...');
            expect(mockLogger.info.mock.calls[2][0]).toBe('ShutdownService: GameLoop instance found but already stopped or not running.'); // <-- Check this log specifically
            expect(mockGameLoop.stop).not.toHaveBeenCalled();

            // Verify rest of sequence still runs (spot check)
            expect(mockContainer.resolveByTag).toHaveBeenCalledWith(SHUTDOWNABLE[0]);
            expect(mockShutdownableSystem1.shutdown).toHaveBeenCalledTimes(1);
            expect(mockShutdownableSystem2.shutdown).toHaveBeenCalledTimes(1);
            // Check the "Finished processing" log occurred AFTER system logs
            expect(mockLogger.info).toHaveBeenCalledWith("ShutdownService: Finished processing SHUTDOWNABLE systems.");
            expect(mockContainer.disposeSingletons).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith('ShutdownService: Shutdown sequence finished.');
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('shutdown:shutdown_service:completed', {}, { allowSchemaNotFound: true });
        });

        // --- Error Handling Tests ---
        // No changes should be needed below this line based on the current failure

        it('should handle errors during container.resolveByTag', async () => {
            const resolveError = new Error('Failed to resolve tag');
            mockContainer.resolveByTag.mockImplementationOnce(() => { throw resolveError; });

            await service.runShutdownSequence();

            // Verify error logging
            expect(mockLogger.error).toHaveBeenCalledWith("ShutdownService: CRITICAL ERROR resolving SHUTDOWNABLE systems. Cannot proceed with tagged system shutdown.", resolveError);

            // Verify system shutdown was skipped
            expect(mockShutdownableSystem1.shutdown).not.toHaveBeenCalled();
            expect(mockShutdownableSystem2.shutdown).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalledWith("ShutdownService: Finished processing SHUTDOWNABLE systems.");

            // Verify singleton disposal still happens
            expect(mockLogger.info).toHaveBeenCalledWith('ShutdownService: Attempting to dispose container singletons...');
            expect(mockContainer.disposeSingletons).toHaveBeenCalledTimes(1);

            // Verify sequence completes successfully overall (error was contained)
            expect(mockLogger.info).toHaveBeenCalledWith('ShutdownService: Shutdown sequence finished.');
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('shutdown:shutdown_service:completed', {}, { allowSchemaNotFound: true });
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('shutdown:shutdown_service:failed', expect.anything(), expect.anything());
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only the resolve error
        });

        it('should handle errors during an individual system shutdown call', async () => {
            const systemError = new Error('System shutdown failed');
            mockSystemWithError.shutdown.mockImplementationOnce(() => { throw systemError; }); // Override beforeEach setup
            mockContainer.resolveByTag.mockReturnValue([
                mockShutdownableSystem1,
                mockSystemWithError, // Inject the failing system
                mockShutdownableSystem2,
            ]);

            await service.runShutdownSequence();

            // Verify attempt and error log for the failing system
            expect(mockLogger.debug).toHaveBeenCalledWith(`ShutdownService: Attempting to call shutdown() on system: ${MOCK_ERROR_SYSTEM_NAME}...`);
            expect(mockSystemWithError.shutdown).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(`ShutdownService: Error during shutdown() call for system: ${MOCK_ERROR_SYSTEM_NAME}. Continuing...`, systemError);

            // Verify other systems were still called
            expect(mockShutdownableSystem1.shutdown).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(`ShutdownService: Successfully called shutdown() on system: ${MOCK_SYSTEM1_NAME}.`);
            expect(mockShutdownableSystem2.shutdown).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(`ShutdownService: Successfully called shutdown() on system: ${MOCK_SYSTEM2_NAME}.`);
            // Check "Finished processing" still logged
            expect(mockLogger.info).toHaveBeenCalledWith("ShutdownService: Finished processing SHUTDOWNABLE systems.");

            // Verify singleton disposal still happens
            expect(mockContainer.disposeSingletons).toHaveBeenCalledTimes(1);

            // Verify sequence completes successfully overall
            expect(mockLogger.info).toHaveBeenCalledWith('ShutdownService: Shutdown sequence finished.');
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('shutdown:shutdown_service:completed', {}, { allowSchemaNotFound: true });
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only the system shutdown error
        });

        it('should handle systems tagged SHUTDOWNABLE that lack a shutdown method', async () => {
            mockContainer.resolveByTag.mockReturnValue([
                mockShutdownableSystem1,
                mockSystemWithoutShutdown, // Inject system without shutdown()
                mockShutdownableSystem2,
            ]);

            await service.runShutdownSequence();

            // Verify warning log for the system missing shutdown()
            expect(mockLogger.warn).toHaveBeenCalledWith(`ShutdownService: System tagged SHUTDOWNABLE (${MOCK_NO_SHUTDOWN_SYSTEM_NAME}) does not have a valid shutdown() method.`);

            // Verify other systems were still called
            expect(mockShutdownableSystem1.shutdown).toHaveBeenCalledTimes(1);
            expect(mockShutdownableSystem2.shutdown).toHaveBeenCalledTimes(1);
            // Check "Finished processing" still logged
            expect(mockLogger.info).toHaveBeenCalledWith("ShutdownService: Finished processing SHUTDOWNABLE systems.");

            // Verify singleton disposal still happens
            expect(mockContainer.disposeSingletons).toHaveBeenCalledTimes(1);

            // Verify sequence completes successfully overall
            expect(mockLogger.info).toHaveBeenCalledWith('ShutdownService: Shutdown sequence finished.');
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('shutdown:shutdown_service:completed', {}, { allowSchemaNotFound: true });
            expect(mockLogger.error).not.toHaveBeenCalled(); // No errors expected
        });

        it('should handle errors during container.disposeSingletons', async () => {
            const disposeError = new Error('Singleton disposal failed');
            mockContainer.disposeSingletons.mockImplementationOnce(() => { throw disposeError; });

            await service.runShutdownSequence();

            // Verify error logging for disposal failure
            expect(mockLogger.info).toHaveBeenCalledWith('ShutdownService: Attempting to dispose container singletons...');
            expect(mockLogger.error).toHaveBeenCalledWith('ShutdownService: Error occurred during container.disposeSingletons().', disposeError);
            expect(mockLogger.info).not.toHaveBeenCalledWith('ShutdownService: Container singletons disposed successfully.');


            // Verify sequence still "finishes" and dispatches completed event
            expect(mockLogger.info).toHaveBeenCalledWith('ShutdownService: Shutdown sequence finished.');
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('shutdown:shutdown_service:completed', {}, { allowSchemaNotFound: true });
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('shutdown:shutdown_service:failed', expect.anything(), expect.anything());
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only the dispose error
        });

        it('should handle critical errors during gameLoop.stop()', async () => {
            const stopError = new Error('GameLoop stop failed critically');
            mockGameLoop.isRunning = true;
            mockGameLoop.stop.mockImplementationOnce(() => { throw stopError; });

            await service.runShutdownSequence();

            // Verify critical error log
            expect(mockLogger.error).toHaveBeenCalledWith('ShutdownService: CRITICAL ERROR during main shutdown sequence:', stopError);

            // Verify 'failed' event dispatched
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'shutdown:shutdown_service:failed',
                { error: stopError.message, stack: stopError.stack },
                { allowSchemaNotFound: true }
            );
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'shutdown:shutdown_service:failed' event.", expect.objectContaining({ error: stopError.message }));


            // Verify 'completed' event was NOT dispatched
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('shutdown:shutdown_service:completed', expect.anything(), expect.anything());

            // Verify subsequent steps (resolve, shutdown, dispose) were skipped due to the throw
            expect(mockContainer.resolveByTag).not.toHaveBeenCalled();
            expect(mockContainer.disposeSingletons).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalledWith('ShutdownService: Shutdown sequence finished.'); // This log is after the main try block
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only the critical stop error
        });

        it('should log errors but continue if dispatching "started" event fails', async () => {
            const dispatchError = new Error('Dispatch failed');
            mockValidatedEventDispatcher.dispatchValidated.mockImplementation(async (event) => {
                if (event === 'shutdown:shutdown_service:started') {
                    throw dispatchError;
                }
                // Allow other events like ui:show_message and completed
                return Promise.resolve();
            });

            await service.runShutdownSequence();

            // Verify error logged for the specific dispatch failure
            expect(mockLogger.error).toHaveBeenCalledWith("Failed to dispatch 'shutdown:shutdown_service:started' event", dispatchError);

            // Verify the rest of the sequence continued
            expect(mockGameLoop.stop).toHaveBeenCalled();
            expect(mockContainer.resolveByTag).toHaveBeenCalled();
            expect(mockShutdownableSystem1.shutdown).toHaveBeenCalled();
            expect(mockContainer.disposeSingletons).toHaveBeenCalled();
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('shutdown:shutdown_service:completed', expect.anything(), expect.anything());
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only the 'started' dispatch error
        });

        it('should log errors if dispatching "completed" event fails', async () => {
            const dispatchError = new Error('Dispatch completed failed');
            mockValidatedEventDispatcher.dispatchValidated.mockImplementation(async (event) => {
                if (event === 'shutdown:shutdown_service:completed') {
                    throw dispatchError;
                }
                return Promise.resolve(); // Allow other events
            });

            await service.runShutdownSequence();

            // Verify sequence ran fully
            expect(mockContainer.disposeSingletons).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('ShutdownService: Shutdown sequence finished.');

            // Verify error logged for the specific dispatch failure
            // This should now be called because of await/try-catch in service
            expect(mockLogger.error).toHaveBeenCalledWith("Failed to dispatch 'shutdown:shutdown_service:completed' event", dispatchError);
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only the 'completed' dispatch error
        });

        it('should log errors if dispatching "failed" event fails after a critical error', async () => {
            const stopError = new Error('GameLoop stop failed critically');
            const dispatchError = new Error('Dispatch failed event failed');
            mockGameLoop.isRunning = true;
            mockGameLoop.stop.mockImplementationOnce(() => { throw stopError; });

            mockValidatedEventDispatcher.dispatchValidated.mockImplementation(async (event) => {
                if (event === 'shutdown:shutdown_service:failed') {
                    throw dispatchError; // Simulate failure dispatching the failure event
                }
                // Allow 'started' and 'ui:show_message'
                if (event === 'shutdown:shutdown_service:started' || event === 'ui:show_message') {
                    return Promise.resolve();
                }
                // Prevent 'completed' (though it shouldn't be reached anyway)
                if (event === 'shutdown:shutdown_service:completed') {
                    throw new Error('Should not dispatch completed');
                }
                // Should not be called for other events in this test flow
                return Promise.resolve();
            });

            await service.runShutdownSequence();

            // Verify critical error log for stopError (first error log)
            expect(mockLogger.error).toHaveBeenCalledWith('ShutdownService: CRITICAL ERROR during main shutdown sequence:', stopError);

            // Verify attempt to dispatch 'failed' event
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'shutdown:shutdown_service:failed',
                { error: stopError.message, stack: stopError.stack },
                { allowSchemaNotFound: true }
            );

            // Verify error logged for the dispatch failure itself (second error log)
            expect(mockLogger.error).toHaveBeenNthCalledWith(2, "Failed to dispatch 'shutdown:shutdown_service:failed' event", dispatchError); // Check the second call specifically

            // Verify total error calls
            expect(mockLogger.error).toHaveBeenCalledTimes(2);

            // Verify 'completed' event was NOT dispatched
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('shutdown:shutdown_service:completed', expect.anything(), expect.anything());
        });
    });
});