// src/core/adapters/EventBusTurnEndAdapter.test.js
// --- FILE START ---

import { EventBusTurnEndAdapter } from '../../../core/adapters/eventBusTurnEndAdapter.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// --- Mocks ---
const mockSafeDispatcher = {
    dispatchSafely: jest.fn().mockResolvedValue(true), // Default mock success
};

const mockVed = {
    dispatchValidated: jest.fn().mockResolvedValue(true), // Default mock success
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

describe('EventBusTurnEndAdapter', () => {

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should throw an error if no valid dispatcher is provided', () => {
        expect(() => new EventBusTurnEndAdapter({})).toThrow(/Requires a valid ISafeEventDispatcher \(preferred\) or IValidatedEventDispatcher/);
        expect(() => new EventBusTurnEndAdapter({ safeEventDispatcher: {} })).toThrow();
        expect(() => new EventBusTurnEndAdapter({ validatedEventDispatcher: {} })).toThrow();
    });

    it('should prefer ISafeEventDispatcher if provided and valid', () => {
        const adapter = new EventBusTurnEndAdapter({ safeEventDispatcher: mockSafeDispatcher, validatedEventDispatcher: mockVed });
        expect(adapter).toBeDefined();
    });

    it('should use IValidatedEventDispatcher if ISafeEventDispatcher is not provided or invalid', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const adapter = new EventBusTurnEndAdapter({ validatedEventDispatcher: mockVed });
        expect(adapter).toBeDefined();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('falling back to IValidatedEventDispatcher'));
        warnSpy.mockRestore();
    });

    it('should throw an error during turnEnded if entityId is invalid', async () => {
        const adapter = new EventBusTurnEndAdapter({ safeEventDispatcher: mockSafeDispatcher });
        await expect(adapter.turnEnded(null)).rejects.toThrow('entityId must be a non-empty string');
        await expect(adapter.turnEnded('')).rejects.toThrow('entityId must be a non-empty string');
        await expect(adapter.turnEnded(123)).rejects.toThrow('entityId must be a non-empty string');
    });

    it('should call dispatchSafely with correct arguments when using ISafeEventDispatcher', async () => {
        const adapter = new EventBusTurnEndAdapter({ safeEventDispatcher: mockSafeDispatcher });
        const entityId = 'npc1';

        await adapter.turnEnded(entityId);

        expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
        expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledWith(
            'core:turn_ended',
            { entityId: entityId }
        );
    });

    it('should call dispatchValidated with correct arguments when using IValidatedEventDispatcher', async () => {
        const adapter = new EventBusTurnEndAdapter({ validatedEventDispatcher: mockVed });
        const entityId = 'player99';

        await adapter.turnEnded(entityId);

        expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
            'core:turn_ended',
            { entityId: entityId }
        );
        expect(mockSafeDispatcher.dispatchSafely).not.toHaveBeenCalled(); // Ensure safe wasn't called
    });

    it('should resolve void even if dispatchSafely returns false', async () => {
        mockSafeDispatcher.dispatchSafely.mockResolvedValueOnce(false); // Simulate dispatch failure
        const adapter = new EventBusTurnEndAdapter({ safeEventDispatcher: mockSafeDispatcher });
        const entityId = 'monster1';

        await expect(adapter.turnEnded(entityId)).resolves.toBeUndefined();
        expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
    });

    it('should resolve void if dispatchValidated succeeds', async () => {
        mockVed.dispatchValidated.mockResolvedValueOnce(true);
        const adapter = new EventBusTurnEndAdapter({ validatedEventDispatcher: mockVed });
        const entityId = 'item1'; // Entities whose turns end might not just be players/NPCs

        await expect(adapter.turnEnded(entityId)).resolves.toBeUndefined();
        expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
    });

    it('should reject if dispatchValidated throws an error', async () => {
        const dispatchError = new Error("VED failed for turn end");
        mockVed.dispatchValidated.mockRejectedValueOnce(dispatchError);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console error
        const adapter = new EventBusTurnEndAdapter({ validatedEventDispatcher: mockVed });
        const entityId = 'system_actor';

        await expect(adapter.turnEnded(entityId)).rejects.toThrow(dispatchError);
        expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Error dispatching 'core:turn_ended' via VED"), expect.any(Error));

        errorSpy.mockRestore();
    });

});
// --- FILE END ---