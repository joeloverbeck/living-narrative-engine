// src/tests/core/adapters/eventBusCommandInputGateway.test.js
// --- FILE START (Entire file content as corrected) ---

import { EventBusCommandInputGateway } from '../../../core/turns/adapters/eventBusCommandInputGateway.js';
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

// --- Mocks ---
const mockVed = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    // Add dispatchValidated if needed by other potential methods, though not directly used here
    dispatchValidated: jest.fn(),
};

describe('EventBusCommandInputGateway', () => {
    let gateway;
    let listenerCallback;
    let unsubscribeFn;

    beforeEach(() => {
        // Reset mocks before each test
        jest.resetAllMocks();
        gateway = new EventBusCommandInputGateway({ validatedEventDispatcher: mockVed });
        listenerCallback = jest.fn();
        unsubscribeFn = gateway.onCommand(listenerCallback);
    });

    afterEach(() => {
        // Clean up any remaining subscriptions if destroy is implemented and needed
        if (gateway && typeof gateway.destroy === 'function') {
            gateway.destroy();
        }
    });

    it('should throw an error if VED dependency is missing or invalid', () => {
        expect(() => new EventBusCommandInputGateway({})).toThrow(/Invalid or missing validatedEventDispatcher/);
        expect(() => new EventBusCommandInputGateway({ validatedEventDispatcher: {} })).toThrow(/Invalid or missing validatedEventDispatcher/);
        expect(() => new EventBusCommandInputGateway({ validatedEventDispatcher: { subscribe: 'not a function', unsubscribe: () => {} } })).toThrow(/Invalid or missing validatedEventDispatcher/);
        expect(() => new EventBusCommandInputGateway({ validatedEventDispatcher: { subscribe: () => {}, unsubscribe: 'not a function' } })).toThrow(/Invalid or missing validatedEventDispatcher/);
    });

    it('should throw an error if listener provided to onCommand is not a function', () => {
        expect(() => gateway.onCommand(null)).toThrow(/listener must be a function/);
        expect(() => gateway.onCommand('not a function')).toThrow(/listener must be a function/);
        expect(() => gateway.onCommand({})).toThrow(/listener must be a function/);
    });

    it('should subscribe to "core:submit_command" on the VED when onCommand is called', () => {
        // Check the call made during beforeEach
        expect(mockVed.subscribe).toHaveBeenCalledTimes(1); // CORRECTED MATCHER
        expect(mockVed.subscribe).toHaveBeenCalledWith('core:submit_command', expect.any(Function));
    });

    it('should call the listener with the trimmed command when a valid event is received', () => {
        // Get the actual handler function passed to subscribe
        const eventHandler = mockVed.subscribe.mock.calls[0][1];

        // Simulate event dispatch (direct payload)
        eventHandler({ command: '  test command  ' });
        expect(listenerCallback).toHaveBeenCalledTimes(1); // CORRECTED MATCHER
        expect(listenerCallback).toHaveBeenCalledWith('test command');

        listenerCallback.mockClear();

        // Simulate event dispatch (wrapped payload)
        eventHandler({ type: 'core:submit_command', payload: { command: ' another command ' } });
        expect(listenerCallback).toHaveBeenCalledTimes(1); // CORRECTED MATCHER
        expect(listenerCallback).toHaveBeenCalledWith('another command');
    });

    it('should NOT call the listener if the command string is empty or missing', () => {
        const eventHandler = mockVed.subscribe.mock.calls[0][1];

        // Simulate event with empty command
        eventHandler({ command: '   ' });
        expect(listenerCallback).not.toHaveBeenCalled();

        // Simulate event with missing command property
        eventHandler({ someOtherProp: 'value' });
        expect(listenerCallback).not.toHaveBeenCalled();

        // Simulate event with null command
        eventHandler({ command: null });
        expect(listenerCallback).not.toHaveBeenCalled();

        // Simulate event with undefined command
        eventHandler({ command: undefined });
        expect(listenerCallback).not.toHaveBeenCalled();

        // Simulate event with empty payload
        eventHandler({ payload: {} });
        expect(listenerCallback).not.toHaveBeenCalled();

        // Simulate null event data
        eventHandler(null);
        expect(listenerCallback).not.toHaveBeenCalled();

        // Simulate undefined event data
        eventHandler(undefined);
        expect(listenerCallback).not.toHaveBeenCalled();
    });

    it('should return an unsubscribe function that calls VED.unsubscribe with the correct listener', () => {
        expect(unsubscribeFn).toBeInstanceOf(Function);

        // Get the actual handler function that was subscribed
        const subscribedHandler = mockVed.subscribe.mock.calls[0][1];

        // Call the unsubscribe function
        unsubscribeFn();

        // Verify unsubscribe was called correctly
        expect(mockVed.unsubscribe).toHaveBeenCalledTimes(1); // CORRECTED MATCHER
        expect(mockVed.unsubscribe).toHaveBeenCalledWith('core:submit_command', subscribedHandler);
    });

    it('should handle multiple listeners and unsubscribing one does not affect others', () => {
        const listenerCallback2 = jest.fn();
        const unsubscribeFn2 = gateway.onCommand(listenerCallback2);

        expect(mockVed.subscribe).toHaveBeenCalledTimes(2); // Once in beforeEach, once here
        const handler1 = mockVed.subscribe.mock.calls[0][1];
        const handler2 = mockVed.subscribe.mock.calls[1][1];
        expect(handler1).not.toBe(handler2); // Ensure different bound handlers

        // Unsubscribe the first listener
        unsubscribeFn();
        expect(mockVed.unsubscribe).toHaveBeenCalledTimes(1); // CORRECTED MATCHER (for this specific call)
        expect(mockVed.unsubscribe).toHaveBeenCalledWith('core:submit_command', handler1);

        // Simulate event dispatch
        handler2({ command: '  test for listener 2 ' }); // Use the actual handler for listener 2

        // Verify only listener 2 was called
        expect(listenerCallback).not.toHaveBeenCalled();
        expect(listenerCallback2).toHaveBeenCalledTimes(1); // CORRECTED MATCHER
        expect(listenerCallback2).toHaveBeenCalledWith('test for listener 2');

        // Unsubscribe the second listener
        unsubscribeFn2();
        expect(mockVed.unsubscribe).toHaveBeenCalledTimes(2); // Total calls
        expect(mockVed.unsubscribe).toHaveBeenCalledWith('core:submit_command', handler2);
    });

    it('should handle calling unsubscribe multiple times gracefully', () => {
        const handler1 = mockVed.subscribe.mock.calls[0][1];

        unsubscribeFn(); // First call
        expect(mockVed.unsubscribe).toHaveBeenCalledTimes(1); // CORRECTED MATCHER (for this specific call)
        expect(mockVed.unsubscribe).toHaveBeenCalledWith('core:submit_command', handler1);

        unsubscribeFn(); // Second call
        // Should ideally not call unsubscribe again, or VED should handle it gracefully
        // Our implementation ensures it only tries to remove if found in the map.
        expect(mockVed.unsubscribe).toHaveBeenCalledTimes(1); // Should still be called only once
    });

    it('destroy() should unsubscribe all active listeners', () => {
        const listenerCallback2 = jest.fn();
        gateway.onCommand(listenerCallback2); // Subscribe a second listener

        const handler1 = mockVed.subscribe.mock.calls[0][1];
        const handler2 = mockVed.subscribe.mock.calls[1][1];

        expect(mockVed.subscribe).toHaveBeenCalledTimes(2);

        gateway.destroy();

        expect(mockVed.unsubscribe).toHaveBeenCalledTimes(2); // Total calls
        // Check that unsubscribe was called for both handlers (order might vary)
        expect(mockVed.unsubscribe).toHaveBeenCalledWith('core:submit_command', handler1);
        expect(mockVed.unsubscribe).toHaveBeenCalledWith('core:submit_command', handler2);
    });

});
// --- FILE END ---