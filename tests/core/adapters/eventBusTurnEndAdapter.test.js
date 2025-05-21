// src/tests/core/adapters/EventBusTurnEndAdapter.test.js
// --- FILE START ---

import EventBusTurnEndAdapter from '../../../src/turns/adapters/eventBusTurnEndAdapter.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {TURN_ENDED_ID} from "../../../src/constants/eventIds.js";

// --- Mocks ---
const mockSafeDispatcher = {
    dispatchSafely: jest.fn().mockResolvedValue(true), // Default mock success
};

const mockVed = {
    dispatchValidated: jest.fn().mockResolvedValue(true), // Default mock success
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

// Mock logger to spy on
const mockLogger = {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

describe('EventBusTurnEndAdapter', () => {

    beforeEach(() => {
        jest.resetAllMocks();
        // Reset mocks to default behavior for each test
        mockSafeDispatcher.dispatchSafely.mockResolvedValue(true);
        mockVed.dispatchValidated.mockResolvedValue(true);
    });

    it('should throw an error if no valid dispatcher is provided', () => {
        expect(() => new EventBusTurnEndAdapter({logger: mockLogger})).toThrow(/Requires a valid ISafeEventDispatcher \(preferred\) or IValidatedEventDispatcher/);
        expect(() => new EventBusTurnEndAdapter({safeEventDispatcher: {}, logger: mockLogger})).toThrow();
        expect(() => new EventBusTurnEndAdapter({validatedEventDispatcher: {}, logger: mockLogger})).toThrow();
    });

    it('should prefer ISafeEventDispatcher if provided and valid', () => {
        const adapter = new EventBusTurnEndAdapter({
            safeEventDispatcher: mockSafeDispatcher,
            validatedEventDispatcher: mockVed,
            logger: mockLogger
        });
        expect(adapter).toBeDefined();
        // Optionally, verify no warning was logged if using console directly in constructor
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should use IValidatedEventDispatcher if ISafeEventDispatcher is not provided or invalid', () => {
        const adapter = new EventBusTurnEndAdapter({validatedEventDispatcher: mockVed, logger: mockLogger});
        expect(adapter).toBeDefined();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('falling back to IValidatedEventDispatcher'));
    });

    it('should throw an error during turnEnded if entityId is invalid', async () => {
        const adapter = new EventBusTurnEndAdapter({safeEventDispatcher: mockSafeDispatcher, logger: mockLogger});
        // notifyTurnEnded is called by turnEnded
        await expect(adapter.turnEnded(null)).rejects.toThrow('EventBusTurnEndAdapter: entityId must be a non-empty string');
        await expect(adapter.turnEnded('')).rejects.toThrow('EventBusTurnEndAdapter: entityId must be a non-empty string');
        await expect(adapter.turnEnded(123)).rejects.toThrow('EventBusTurnEndAdapter: entityId must be a non-empty string');
    });

    it('should call dispatchSafely with correct arguments when using ISafeEventDispatcher', async () => {
        const adapter = new EventBusTurnEndAdapter({safeEventDispatcher: mockSafeDispatcher, logger: mockLogger});
        const entityId = 'npc1';
        const success = true; // The success parameter is still passed to notifyTurnEnded

        await adapter.notifyTurnEnded(entityId, success);

        expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        // Test that the payload dispatched *only* contains entityId
        expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledWith(
            TURN_ENDED_ID, {entityId}
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received notifyTurnEnded for ${entityId} with success=${success}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Dispatching ${TURN_ENDED_ID} with entityId only`));
    });

    it('should call dispatchValidated with correct arguments when using IValidatedEventDispatcher', async () => {
        const adapter = new EventBusTurnEndAdapter({validatedEventDispatcher: mockVed, logger: mockLogger});
        const entityId = 'player99';
        const success = false; // The success parameter is still passed to notifyTurnEnded

        await adapter.notifyTurnEnded(entityId, success);

        expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
        // Test that the payload dispatched *only* contains entityId
        expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
            TURN_ENDED_ID, {entityId}
        );
        expect(mockSafeDispatcher.dispatchSafely).not.toHaveBeenCalled(); // Ensure safe wasn't called
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received notifyTurnEnded for ${entityId} with success=${success}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Dispatching ${TURN_ENDED_ID} with entityId only`));
    });

    it('should resolve void even if dispatchSafely returns false', async () => {
        mockSafeDispatcher.dispatchSafely.mockResolvedValueOnce(false); // Simulate dispatch attempt, but dispatcher indicates an issue (e.g. no listeners handled it)
        const adapter = new EventBusTurnEndAdapter({safeEventDispatcher: mockSafeDispatcher, logger: mockLogger});
        const entityId = 'monster1';

        // The adapter's job is to attempt dispatch; it resolves if the dispatch attempt itself doesn't throw.
        // The boolean return from dispatchSafely is for the dispatcher's internal logic, not for the adapter to throw on.
        await expect(adapter.turnEnded(entityId)).resolves.toBeUndefined();
        expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully dispatched ${TURN_ENDED_ID} for ${entityId}.`)); // This log happens if dispatchSafely doesn't throw
    });

    it('should resolve void if dispatchValidated succeeds', async () => {
        mockVed.dispatchValidated.mockResolvedValueOnce(true);
        const adapter = new EventBusTurnEndAdapter({validatedEventDispatcher: mockVed, logger: mockLogger});
        const entityId = 'item1';

        await expect(adapter.turnEnded(entityId)).resolves.toBeUndefined();
        expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully dispatched ${TURN_ENDED_ID} for ${entityId}.`));
    });

    it('should reject if dispatchValidated throws an error', async () => {
        const dispatchError = new Error("VED failed for turn end");
        mockVed.dispatchValidated.mockRejectedValueOnce(dispatchError);
        const adapter = new EventBusTurnEndAdapter({validatedEventDispatcher: mockVed, logger: mockLogger});
        const entityId = 'system_actor';

        await expect(adapter.turnEnded(entityId)).rejects.toThrow(dispatchError);
        expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
        // Check the specific error log from the adapter's catch block
        expect(mockLogger.error).toHaveBeenCalledWith(
            `EventBusTurnEndAdapter: Error dispatching ${TURN_ENDED_ID} for ${entityId}. Error: ${dispatchError.message}`,
            dispatchError
        );
    });

});
// --- FILE END ---