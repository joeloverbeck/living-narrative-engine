// src/tests/handleTriggerEventEffect.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import {handleTriggerEventEffect} from '../effects/handlers/handleTriggerEventEffect.js';
import {getDisplayName} from '../utils/messages.js'; // Need to mock this

// --- Mock Dependencies ---

// Mock getDisplayName from the messages utility
jest.mock('../utils/messages.js', () => ({
    getDisplayName: jest.fn((target) => {
        if (!target) return 'nothing';
        if (target.mockType === 'Entity') return target.mockName || `Entity(${target.id})`;
        if (target.mockType === 'Connection') return target.name || target.direction || `Connection(${target.connectionId})`;
        return 'unknown target';
    }),
}));

// Minimal Mock Entity (doesn't need full Entity class features for this test)
class MockEntity {
    constructor(id, name = null) {
        this.id = id;
        this.mockType = 'Entity';
        this.mockName = name; // Store mock name for getDisplayName mock
        // Mock getComponent specifically for PositionComponent test
        this.getComponent = jest.fn();
    }
}

// Mock PositionComponent class (just need its existence for registry check)
class MockPositionComponent {
    constructor({locationId = 'default-loc'} = {}) {
        this.locationId = locationId;
    }
}

// --- Test Suite ---

describe('handleTriggerEventEffect', () => {
    let mockEventBus;
    let mockEntityManager;
    let mockUserEntity;
    let mockTargetEntity;
    let mockTargetConnection;
    let mockContext;
    let mockParams;
    let consoleErrorSpy;
    let consoleWarnSpy;
    let consoleDebugSpy;

    beforeEach(() => {
        // Reset mocks for each test
        jest.clearAllMocks();

        // Mock EventBus
        mockEventBus = {
            dispatch: jest.fn(),
        };

        // Mock EntityManager
        mockEntityManager = {
            componentRegistry: {
                get: jest.fn(),
            },
            // Add other methods if needed by future tests, but not by handleTriggerEventEffect directly
        };

        // Mock Entities/Connections
        mockUserEntity = new MockEntity('player1');
        mockTargetEntity = new MockEntity('npc1', 'Grumpy Orc');
        mockTargetConnection = {
            mockType: 'Connection', // Add mockType for getDisplayName mock
            connectionId: 'door-north-1',
            name: 'North Door',
            direction: 'north',
            // other irrelevant properties...
        };

        // Default Mock Context
        mockContext = {
            eventBus: mockEventBus,
            userEntity: mockUserEntity,
            target: null, // Default to no target
            itemName: 'Test Item',
            entityManager: mockEntityManager,
            itemInstanceId: 'item-instance-123',
            itemDefinitionId: 'item-def-abc',
        };

        // Default Mock Params
        mockParams = {
            eventName: 'test:event',
            event_payload: {}, // Start with empty payload
            feedback_message: undefined, // Start with no feedback
        };

        // Spy on console methods
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {
        });

        // Pre-register Position component for relevant tests by default
        // Specific tests can override this mock return value if needed
        mockEntityManager.componentRegistry.get.mockImplementation((name) => {
            if (name === 'Position') {
                return MockPositionComponent;
            }
            return undefined;
        });
    });

    // --- Parameter Validation Tests ---
    describe('Parameter Validation', () => {
        // --- [SNIP: No changes needed in these tests] ---
        it('TEST-HTEE-001: should fail if eventName is null', () => {
            mockParams.eventName = null;
            const result = handleTriggerEventEffect(mockParams, mockContext);
            expect(result.success).toBe(false);
            expect(result.stopPropagation).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    text: expect.stringContaining('Test Item trigger_event effect misconfigured (missing/invalid eventName)'),
                    type: 'error'
                })
            ]));
            expect(consoleErrorSpy).toHaveBeenCalledWith("EffectExecutionService: Invalid or missing 'eventName' parameter for 'trigger_event' effect in item Test Item. Params:", {
                "eventName": null,
                "event_payload": {},
                "feedback_message": undefined
            });
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        it('TEST-HTEE-001: should fail if eventName is undefined', () => {
            mockParams.eventName = undefined;
            const result = handleTriggerEventEffect(mockParams, mockContext);
            expect(result.success).toBe(false);
            expect(result.stopPropagation).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'error',
                    text: expect.stringContaining('misconfigured (missing/invalid eventName)')
                })
            ]));
            expect(consoleErrorSpy).toHaveBeenCalledWith("EffectExecutionService: Invalid or missing 'eventName' parameter for 'trigger_event' effect in item Test Item. Params:", {
                "eventName": undefined,
                "event_payload": {},
                "feedback_message": undefined
            });
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        it('TEST-HTEE-001: should fail if eventName is an empty string', () => {
            mockParams.eventName = '';
            const result = handleTriggerEventEffect(mockParams, mockContext);
            expect(result.success).toBe(false);
            expect(result.stopPropagation).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'error',
                    // FIX: Use expect.stringContaining and update text
                    text: expect.stringContaining('Test Item trigger_event effect misconfigured (missing/invalid eventName)')
                })
            ]));
            // Keep consoleErrorSpy check
            expect(consoleErrorSpy).toHaveBeenCalledWith("EffectExecutionService: Invalid or missing 'eventName' parameter for 'trigger_event' effect in item Test Item. Params:", {
                "eventName": "",
                "event_payload": {},
                "feedback_message": undefined
            });
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        it('TEST-HTEE-001: should fail if eventName is only whitespace', () => {
            mockParams.eventName = '   ';
            const result = handleTriggerEventEffect(mockParams, mockContext);
            expect(result.success).toBe(false);
            expect(result.stopPropagation).toBe(true);
            expect(result.messages).toEqual([{
                "text": "Internal Error: Test Item trigger_event effect misconfigured (missing/invalid eventName).",
                "type": "error"
            }]);
            expect(consoleErrorSpy).toHaveBeenCalledWith("EffectExecutionService: Invalid or missing 'eventName' parameter for 'trigger_event' effect in item Test Item. Params:", {
                "eventName": "   ",
                "event_payload": {},
                "feedback_message": undefined
            });
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        it('TEST-HTEE-002: should fail if payload is not an object (string)', () => { // Rename test slightly
            // FIX: Use 'payload' key
            mockParams.payload = 'not_an_object';
            // FIX: Delete event_payload if it was set in beforeEach or globally for mockParams
            delete mockParams.event_payload;

            const result = handleTriggerEventEffect(mockParams, mockContext);
            expect(result.success).toBe(false); // Now expects false because of new validation
            expect(result.stopPropagation).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                // FIX: Expect the new error message
                expect.objectContaining({
                    type: 'error',
                    text: expect.stringContaining('misconfigured (invalid payload type)')
                })
            ]));
            expect(consoleErrorSpy).toHaveBeenCalledWith("EffectExecutionService: Invalid 'payload' parameter (must be an object or undefined) for 'trigger_event' effect in item Test Item. Params:", {
                "eventName": "test:event",
                "feedback_message": undefined,
                "payload": "not_an_object"
            });
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        it('TEST-HTEE-002: should fail if payload is null', () => { // Rename test slightly
            // FIX: Use 'payload' key
            mockParams.payload = null;
            // FIX: Delete event_payload if it was set in beforeEach or globally for mockParams
            delete mockParams.event_payload;

            const result = handleTriggerEventEffect(mockParams, mockContext);
            expect(result.success).toBe(false); // Now expects false because of new validation
            expect(result.stopPropagation).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                // FIX: Expect the new error message
                expect.objectContaining({
                    type: 'error',
                    text: expect.stringContaining('misconfigured (invalid payload type)')
                })
            ]));
            expect(consoleErrorSpy).toHaveBeenCalledWith("EffectExecutionService: Invalid 'payload' parameter (must be an object or undefined) for 'trigger_event' effect in item Test Item. Params:", {
                "eventName": "test:event",
                "feedback_message": undefined,
                "payload": null
            });
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        it('TEST-HTEE-003: should fail if params object is null', () => {
            const result = handleTriggerEventEffect(null, mockContext);
            // Should fail on eventName check because (!params) is true
            expect(result.success).toBe(false);
            expect(result.stopPropagation).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                // FIX: Update expected string fragment
                expect.objectContaining({
                    type: 'error',
                    text: expect.stringContaining('misconfigured (missing/invalid eventName)')
                })
            ]));
            // FIX: Update expected console message detail
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid or missing 'eventName' parameter"), null); // Params was null
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        it('TEST-HTEE-003: should fail if params object is undefined', () => {
            const result = handleTriggerEventEffect(undefined, mockContext);
            // Should fail on eventName check because (!params) is true
            expect(result.success).toBe(false);
            expect(result.stopPropagation).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                // FIX: Update expected string fragment
                expect.objectContaining({
                    type: 'error',
                    text: expect.stringContaining('misconfigured (missing/invalid eventName)')
                })
            ]));
            // FIX: Update expected console message detail
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid or missing 'eventName' parameter"), undefined); // Params was undefined
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });
        // --- [/SNIP] ---
    });

    // --- Payload Construction & Basic Dispatch Tests ---
    describe('Payload Construction & Basic Dispatch', () => {
        // --- [SNIP: No changes needed in these tests] ---
        it('TEST-HTEE-004: Basic success - Minimal params, no target, no feedback', () => {
            // Params already set minimally in beforeEach
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            expect(result.stopPropagation).toBeUndefined(); // Should not stop propagation
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal',
                    text: expect.stringContaining("Dispatched event 'test:event'")
                })
            ]));
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('test:event', {
                userId: 'player1',
                targetEntityId: null,
                targetConnectionId: null,
                targetId: null,
                targetType: 'none',
                sourceItemId: 'item-instance-123',
                sourceItemDefinitionId: 'item-def-abc',
                // event_payload: {} (implicitly merged)
            });
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('TEST-HTEE-005: Basic success - With custom event_payload, no target', () => {
            const mockParams = {
                eventName: 'test:event',
                payload: { // <-- Nest custom data here
                    custom_data: 'value1',
                    numeric: 123
                }
            };
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('test:event', {
                userId: 'player1',
                targetEntityId: null,
                targetConnectionId: null,
                targetId: null,
                targetType: 'none',
                sourceItemId: 'item-instance-123',
                sourceItemDefinitionId: 'item-def-abc',
                custom_data: 'value1', // Custom data included
                numeric: 123          // Custom data included
            });
        });

        it('TEST-HTEE-006: Success with Entity Target', () => {
            mockContext.target = mockTargetEntity; // Set entity target
            mockParams.eventName = 'effect:on_entity';
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('effect:on_entity', {
                userId: 'player1',
                targetEntityId: 'npc1', // Correct entity ID
                targetConnectionId: null,
                targetId: 'npc1',       // Correct target ID
                targetType: 'entity',   // Correct type
                sourceItemId: 'item-instance-123',
                sourceItemDefinitionId: 'item-def-abc',
            });
        });

        it('TEST-HTEE-007: Success with Connection Target', () => {
            mockContext.target = mockTargetConnection; // Set connection target
            mockParams.eventName = 'interact:connection';
            mockContext.itemInstanceId = 'item-instance-key';
            mockContext.itemDefinitionId = 'item-def-key';
            mockContext.itemName = 'Key';
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('interact:connection', {
                userId: 'player1',
                targetEntityId: null,
                targetConnectionId: 'door-north-1', // Correct connection ID
                targetId: 'door-north-1',       // Correct target ID (uses connectionId)
                targetType: 'connection',   // Correct type
                sourceItemId: 'item-instance-key',
                sourceItemDefinitionId: 'item-def-key',
            });
        });
        // --- [/SNIP] ---
    });

    // --- Specific Event: event:connection_unlock_attempt Tests ---
    describe('Specific Event: event:connection_unlock_attempt', () => {
        beforeEach(() => {
            // Setup for this specific event
            mockParams.eventName = 'event:connection_unlock_attempt';
            mockContext.target = mockTargetConnection; // Usually targets a connection
            mockContext.itemInstanceId = 'key-instance-789';
            mockContext.itemDefinitionId = 'item-def-key-gold';
            mockContext.itemName = 'Gold Key';

            // Assume PositionComponent is registered and user has it by default
            // Reset specific mock for getComponent for this describe block
            mockUserEntity.getComponent.mockImplementation((CompClass) => {
                if (CompClass === MockPositionComponent) {
                    // Check if it's asking for the specific MockPositionComponent class we defined
                    return new MockPositionComponent({locationId: 'room1'});
                }
                return undefined;
            });
        });

        // --- [SNIP: No changes needed in these tests] ---
        it('TEST-HTEE-008: Success with Connection Target and Location', () => {
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                // Add the messages that were previously missing from the expectation
                expect.objectContaining({text: expect.stringContaining("Handling trigger_event: 'event:connection_unlock_attempt'")}),
                expect.objectContaining({text: expect.stringContaining("Base final payload with context:")}),
                // Keep/Adjust expected messages, matching the new wording/detail
                expect.objectContaining({text: expect.stringContaining("Added locationId (room1) from context")}),
                expect.objectContaining({text: expect.stringContaining("Using connectionId (door-north-1) derived from target context as fallback.")}), // Updated
                expect.objectContaining({text: expect.stringContaining("Using keyId (key-instance-789) derived from item instance context as fallback.")}), // Updated
                expect.objectContaining({text: expect.stringContaining("Dispatched event 'event:connection_unlock_attempt' for Gold Key.")}) // Updated wording
            ]));
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:connection_unlock_attempt', expect.objectContaining({
                userId: 'player1',
                targetConnectionId: 'door-north-1',
                targetId: 'door-north-1',
                targetType: 'connection',
                sourceItemId: 'key-instance-789',
                sourceItemDefinitionId: 'item-def-key-gold',
                locationId: 'room1',         // Location ID added
                connectionId: 'door-north-1', // connectionId populated
                keyId: 'key-instance-789'   // keyId populated from item instance
            }));
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('TEST-HTEE-009: keyId provided in event_payload overrides default', () => {
            const mockParams = {
                eventName: 'event:connection_unlock_attempt',
                // CORRECT: 'payload' nesting according to schema
                payload: {
                    keyId: 'master-skeleton-key-def'
                }
            };
            mockContext.itemInstanceId = 'some-other-id';

            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                // ... other messages like Handling, Base payload, Added locationId, Using connectionId ...
                expect.objectContaining({ // Check the specific message about keyId source
                    type: 'internal',
                    // FIX: Update expected message string
                    text: expect.stringContaining("Using keyId (master-skeleton-key-def) provided in payload.")
                }),
                expect.objectContaining({ // Check the dispatched message too
                    type: 'internal',
                    text: expect.stringContaining("Dispatched event 'event:connection_unlock_attempt'")
                })
            ]));
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:connection_unlock_attempt', expect.objectContaining({
                keyId: 'master-skeleton-key-def', // Overridden value
                sourceItemId: 'some-other-id'     // Original instance ID still present
                // ... other expected payload properties (userId, target*, locationId, etc.)
            }));
        });

        it('TEST-HTEE-010: Failure due to missing connectionId (target was null)', () => {
            mockContext.target = null; // NO target provided
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(false);
            expect(result.stopPropagation).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'error',
                    text: expect.stringContaining("CRITICAL: Missing connectionId for event:connection_unlock_attempt. Target was type none.")
                })
            ]));
            expect(mockEventBus.dispatch).not.toHaveBeenCalled(); // Main event dispatch fails
        });

        it('TEST-HTEE-010: Failure due to missing connectionId (target was entity)', () => {
            mockContext.target = mockTargetEntity; // WRONG target type
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(false);
            expect(result.stopPropagation).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'error',
                    text: expect.stringContaining("CRITICAL: Missing connectionId for event:connection_unlock_attempt. Target was type entity.")
                })
            ]));
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Missing 'connectionId' in payload"), expect.anything());
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        it('TEST-HTEE-011: User missing PositionComponent', () => {
            mockUserEntity.getComponent.mockReturnValue(undefined); // Simulate missing component
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true); // Should still succeed, but log warning
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'warning',
                    text: expect.stringContaining("User player1 missing locationId")
                })
            ]));
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                'event:connection_unlock_attempt', // FIX: Argument 1 is the event name
                expect.objectContaining({          // FIX: Argument 2 is the payload matcher
                    locationId: null // locationId should be null in payload
                })
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("lacks PositionComponent or locationId"));
        });

        it('TEST-HTEE-011: User PositionComponent lacks locationId', () => {
            mockUserEntity.getComponent.mockImplementation((CompClass) => {
                if (CompClass === MockPositionComponent) {
                    return new MockPositionComponent({locationId: null}); // Has component, but null locationId
                }
                return undefined;
            });
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'warning',
                    text: expect.stringContaining("User player1 missing locationId")
                })
            ]));
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                'event:connection_unlock_attempt', // FIX: Argument 1 is the event name
                expect.objectContaining({          // FIX: Argument 2 is the payload matcher
                    locationId: null
                })
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("lacks PositionComponent or locationId"));
        });

        it('TEST-HTEE-011: PositionComponent class not registered', () => {
            // Override the default mock setup for this specific test
            mockEntityManager.componentRegistry.get.mockImplementation((name) => {
                if (name === 'Position') {
                    return undefined; // Simulate Position not registered
                }
                return undefined; // Default for others
            });
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true); // Still succeeds, but logs error about registry
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'error',
                    text: expect.stringContaining("CRITICAL: Cannot get locationId")
                })
            ]));
            // FIX: Correct assertion structure: event name (string), payload matcher (object)
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                'event:connection_unlock_attempt',            // Argument 1: Event Name
                expect.objectContaining({locationId: null}) // Argument 2: Payload Matcher
            );
            expect(consoleErrorSpy).toHaveBeenCalledWith("EffectExecutionService: Position component class not registered. Cannot get locationId.");
        });
        // --- [/SNIP] ---
    });

    // --- Feedback Message Handling Tests ---
    describe('Feedback Message Handling', () => {
        // --- [SNIP: No changes needed in this test] ---
        it('TEST-HTEE-012: Feedback message dispatched successfully (no target)', () => {
            mockParams.feedback_message = 'You hear a click.';
            mockContext.target = null;
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'internal',
                    text: expect.stringContaining("Dispatched feedback message: \"You hear a click.\"")
                })
            ]));
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2); // 1 for main event, 1 for feedback
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('test:event', expect.any(Object)); // Main event
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:message_display', { // Feedback event
                text: 'You hear a click.',
                type: 'info'
            });
        });
        // --- [/SNIP] ---

        it('TEST-HTEE-013: Feedback message with {target} placeholder (Entity Target)', () => {
            mockParams.feedback_message = 'You examine the {target}.';
            mockContext.target = mockTargetEntity; // Grumpy Orc
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            // Verify getDisplayName was called (since targetType is 'entity')
            expect(getDisplayName).toHaveBeenCalledWith(mockTargetEntity);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
            // Check the main event dispatch (optional but good practice)
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('test:event', expect.objectContaining({
                targetId: 'npc1',
                targetType: 'entity'
            }));
            // Check the feedback dispatch
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:message_display', {
                text: 'You examine the Grumpy Orc.', // Placeholder replaced
                type: 'info'
            });
            // Note: No change made here, assuming the original assertion was correct
            // despite the confusing error message in the prompt.
        });

        it('TEST-HTEE-014: Feedback message with {target} placeholder (Connection Target)', () => {
            mockParams.feedback_message = 'You interact with the {target}.';
            mockContext.target = mockTargetConnection; // North Door
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            // FIX: Remove incorrect assertion. getDisplayName is NOT called for connections.
            // expect(getDisplayName).toHaveBeenCalledWith(mockTargetConnection);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:message_display', {
                text: 'You interact with the North Door.', // Placeholder replaced using target.name
                type: 'info'
            });
        });

        it('TEST-HTEE-014: Feedback message with {target} placeholder (Connection Target - no name)', () => {
            mockParams.feedback_message = 'You interact with the {target}.';
            // Create a connection target without a name for this test
            mockContext.target = {
                mockType: 'Connection',
                connectionId: 'door-north-1',
                name: undefined, // Explicitly no name
                direction: 'north',
            };
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            // FIX: Remove incorrect assertion. getDisplayName is NOT called for connections.
            // expect(getDisplayName).toHaveBeenCalledWith(mockContext.target);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:message_display', {
                text: 'You interact with the north.', // Placeholder replaced with direction
                type: 'info'
            });
        });

        it('TEST-HTEE-015: Feedback message with {target} placeholder (No Target)', () => {
            mockParams.feedback_message = 'You try to use it on {target}.';
            mockContext.target = null;
            const result = handleTriggerEventEffect(mockParams, mockContext);

            expect(result.success).toBe(true);
            // FIX: Remove incorrect assertion. getDisplayName is NOT called when target is null.
            // expect(getDisplayName).toHaveBeenCalledWith(null);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('ui:message_display', {
                text: 'You try to use it on nothing.', // Placeholder replaced with fallback
                type: 'info'
            });
        });

        // --- [SNIP: No changes needed in this test] ---
        it('should not dispatch feedback if feedback_message is empty or whitespace', () => {
            mockParams.feedback_message = '   ';
            const result = handleTriggerEventEffect(mockParams, mockContext);
            expect(result.success).toBe(true);
            // Only the main event should be dispatched
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('test:event', expect.any(Object));
        });
        // --- [/SNIP] ---
    });
});