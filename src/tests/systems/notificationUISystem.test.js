// src/tests/systems/notificationUISystem.test.js

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Tell Jest to mock GameDataRepository BEFORE importing NotificationUISystem ---
// This replaces the actual GameDataRepository module with a mock, preventing its
// code (including the Ajv import) from running during testing.
// jest.mock('../../core/eventBus.js'); // Optionally mock EventBus too if it's complex

// System Under Test (Import AFTER mocks are set up)
import {NotificationUISystem} from '../../systems/notificationUISystem.js';

// Dependencies to Mock
// No need to import the real GameDataRepository anymore.
// We'll create a manual mock instance for EventBus for clarity in spying.
const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

// Real constants needed for assertions
import {TARGET_MESSAGES} from '../../utils/messages.js'; // Adjust path if needed

// --- Test Suite ---

describe('NotificationUISystem: _handleMoveFailed', () => {
    let notificationUISystem;
    let consoleWarnSpy;
    let consoleErrorSpy;
    let consoleLogSpy; // Added for potential future use or debugging logs in source

    beforeEach(() => {
        // Clear mocks before each test
        jest.clearAllMocks(); // Clears calls to mocked modules and jest.fn()

        // Instantiate the system with mocks
        // Pass the manual mock for eventBus.
        // For gameDataRepository, pass a simple object {} which satisfies the constructor check,
        // as the actual GameDataRepository module has been replaced by jest.mock.
        notificationUISystem = new NotificationUISystem({
            eventBus: mockEventBus,
            gameDataRepository: {}, // Pass an empty object - sufficient for constructor check
        });

        // Spy on console methods
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        }); // Can suppress constructor logs etc.
    });

    afterEach(() => {
        // Restore console spies
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    // --- Test Cases based on Refined Ticket 5.5.2.4 ---
    // (The actual test case code below remains unchanged from your version)

    it('TC1 (New - DIRECTION_LOCKED, Name Provided): should dispatch correct message', () => {
        const payload = {reasonCode: 'DIRECTION_LOCKED', blockerDisplayName: 'sturdy door', actorId: 'player'};
        const expectedDispatchPayload = {text: TARGET_MESSAGES.MOVE_BLOCKED_LOCKED('sturdy door'), type: 'warning'};
        // Sanity check the expected text manually once
        expect(expectedDispatchPayload.text).toBe('The sturdy door is locked.');

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleWarnSpy).not.toHaveBeenCalled(); // No warning if name is provided
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('TC2 (New - DIRECTION_LOCKED, No Name): should dispatch fallback message and warn', () => {
        const payload = {reasonCode: 'DIRECTION_LOCKED', actorId: 'player'};
        const expectedDispatchPayload = {text: 'The way that way is locked.', type: 'warning'};

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Received 'DIRECTION_LOCKED' for actor player without a valid blockerDisplayName"));
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('TC3 (New - DIRECTION_BLOCKED, Name Provided): should dispatch correct message', () => {
        const payload = {reasonCode: 'DIRECTION_BLOCKED', blockerDisplayName: 'heavy gate', actorId: 'player'};
        const expectedDispatchPayload = {text: TARGET_MESSAGES.MOVE_BLOCKED_GENERIC('heavy gate'), type: 'warning'};
        // Sanity check the expected text manually once
        expect(expectedDispatchPayload.text).toBe('The heavy gate blocks the way.');

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('TC4 (New - DIRECTION_BLOCKED, No Name): should dispatch fallback message and warn', () => {
        const payload = {reasonCode: 'DIRECTION_BLOCKED', actorId: 'player'};
        const expectedDispatchPayload = {text: 'Something blocks the way.', type: 'warning'};

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Received 'DIRECTION_BLOCKED' for actor player without a valid blockerDisplayName"));
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('TC5 (New - BLOCKER_NOT_FOUND, Details Provided): should dispatch details message and log error', () => {
        const payload = {
            reasonCode: 'BLOCKER_NOT_FOUND',
            details: 'The ethereal barrier dissipated unexpectedly.',
            blockerEntityId: 'barrier_abc',
            previousLocationId: 'room_1', // <-- FIX: Provide the expected propertys
            actorId: 'player'
        };
        const expectedDispatchPayload = {text: 'The ethereal barrier dissipated unexpectedly.', type: 'warning'};

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Echoing BlockerSystem error - Blocker entity ID "barrier_abc" not found for actor player at location room_1.`));
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('TC6 (New - BLOCKER_NOT_FOUND, No Details): should dispatch fallback message and log error', () => {
        const payload = {
            reasonCode: 'BLOCKER_NOT_FOUND',
            blockerEntityId: 'barrier_xyz',
            previousLocationId: 'room_2', // <-- FIX: Provide the expected property
            actorId: 'player'
        };
        const expectedDispatchPayload = {text: TARGET_MESSAGES.MOVE_BLOCKER_NOT_FOUND(), type: 'warning'};
        // Sanity check the expected text manually once
        expect(expectedDispatchPayload.text).toBe("The way seems blocked by something that isn't there anymore.");

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Echoing BlockerSystem error - Blocker entity ID "barrier_xyz" not found for actor player at location room_2.`));
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('TC7 (Regression - INVALID_DIRECTION): should dispatch correct message', () => {
        const payload = {reasonCode: 'INVALID_DIRECTION', direction: 'north', actorId: 'player'};
        const expectedDispatchPayload = {text: TARGET_MESSAGES.MOVE_CANNOT_GO_WAY, type: 'info'};
        // Sanity check the expected text manually once
        expect(expectedDispatchPayload.text).toBe("You can't go that way.");

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('TC8 (Regression - NO_EXITS): should dispatch correct message', () => {
        const payload = {reasonCode: 'NO_EXITS', actorId: 'player'};
        const expectedDispatchPayload = {text: TARGET_MESSAGES.MOVE_NO_EXITS, type: 'info'};
        // Sanity check the expected text manually once
        expect(expectedDispatchPayload.text).toBe("There are no obvious exits from here.");

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('TC9 (Regression - SETUP_ERROR, Position Unknown): should dispatch correct error message and log error', () => {
        const payload = {reasonCode: 'SETUP_ERROR', details: 'Player position unknown', actorId: 'player'};
        const expectedDispatchPayload = {text: TARGET_MESSAGES.MOVE_POSITION_UNKNOWN, type: 'error'};
        // Sanity check the expected text manually once
        expect(expectedDispatchPayload.text).toBe("Cannot move: Your position is unknown.");

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith("NotificationUISystem: Move setup error for actor player - Reason: SETUP_ERROR, Details: Player position unknown");
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('TC10 (Regression - SETUP_ERROR, Location Unknown): should dispatch correct error message and log error', () => {
        const payload = {reasonCode: 'SETUP_ERROR', details: 'Current location unknown', actorId: 'player'};
        const expectedDispatchPayload = {text: TARGET_MESSAGES.MOVE_LOCATION_UNKNOWN, type: 'error'};
        // Sanity check the expected text manually once
        expect(expectedDispatchPayload.text).toBe("Cannot move: your current location is unknown.");

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith("NotificationUISystem: Move setup error for actor player - Reason: SETUP_ERROR, Details: Current location unknown");
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('TC11 (Regression - DATA_ERROR, Invalid Connection): should dispatch correct error message and log error', () => {
        const payload = {
            reasonCode: 'DATA_ERROR',
            details: 'Invalid connection: missing target',
            direction: 'east',
            actorId: 'player'
        };
        const expectedDispatchPayload = {text: TARGET_MESSAGES.MOVE_INVALID_CONNECTION('east'), type: 'error'};
        // Sanity check the expected text manually once
        expect(expectedDispatchPayload.text).toBe("The way east seems improperly constructed.");

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith("NotificationUISystem: Move data error for actor player - Reason: DATA_ERROR, Direction: east, Details: Invalid connection: missing target");
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('TC12 (Regression - DATA_ERROR, Bad Target Def): should dispatch correct error message and log error', () => {
        const payload = {
            reasonCode: 'DATA_ERROR',
            details: 'Target location definition not found',
            direction: 'west',
            actorId: 'player'
        };
        const expectedDispatchPayload = {text: TARGET_MESSAGES.MOVE_BAD_TARGET_DEF('west'), type: 'error'};
        // Sanity check the expected text manually once
        expect(expectedDispatchPayload.text).toBe("Something is wrong with the passage leading west.");

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith("NotificationUISystem: Move data error for actor player - Reason: DATA_ERROR, Direction: west, Details: Target location definition not found");
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('TC13 (Regression - INTERNAL_DISPATCH_ERROR): should dispatch correct error message and log error', () => {
        const payload = {reasonCode: 'INTERNAL_DISPATCH_ERROR', details: 'Test error message', actorId: 'player'};
        const expectedDispatchPayload = {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'};
        // Sanity check the expected text manually once
        expect(expectedDispatchPayload.text).toBe("Internal error occurred.");

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith("NotificationUISystem: Internal move dispatch error for actor player - Reason: INTERNAL_DISPATCH_ERROR, Details: Test error message");
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('TC14 (Optional - Default Case): should dispatch fallback warning message and log warning', () => {
        const payload = {reasonCode: 'SOME_UNKNOWN_REASON_CODE', actorId: 'player'};
        const expectedDispatchPayload = {text: 'You failed to move. (SOME_UNKNOWN_REASON_CODE)', type: 'warning'};

        notificationUISystem._handleMoveFailed(payload);

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:display_message", expectedDispatchPayload);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith("NotificationUISystem: Unhandled move failure reasonCode: SOME_UNKNOWN_REASON_CODE for actor player");
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

});