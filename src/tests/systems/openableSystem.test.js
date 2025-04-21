import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- System Under Test ---
import OpenableSystem from '../../systems/openableSystem.js';

// --- Real Dependencies ---
// We now use the actual Entity class for testing system interactions
import Entity from '../../entities/entity.js';

// --- Component Type IDs (Assuming they are defined and exported like this) ---
// If these are not available via export, define them as const strings here for the test
import {
    NAME_COMPONENT_TYPE_ID,    // e.g., 'core:name'
    OPENABLE_COMPONENT_ID, // e.g., 'core:openable'
    LOCKABLE_COMPONENT_ID  // e.g., 'core:lockable'
} from '../../types/components.js';
// --- Fallback definitions if imports are not possible ---
// const NAME_COMPONENT_ID = 'core:name';
// const OPENABLE_COMPONENT_ID = 'core:openable';
// const LOCKABLE_COMPONENT_ID = 'core:lockable';


// --- Dependencies to Mock/Use ---
const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

const mockEntityManager = {
    getEntityInstance: jest.fn(),
    // Add other EntityManager methods if the system under test uses them directly
};

// --- REMOVED createMockEntity HELPER ---
// We will now use actual Entity instances.

// --- Test Suite ---
describe('OpenableSystem', () => {
    let openableSystem;
    let consoleErrorSpy;
    let consoleWarnSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        openableSystem = new OpenableSystem({
            eventBus: mockEventBus,
            entityManager: mockEntityManager,
        });
        // Mock console methods
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        });
    });

    afterEach(() => {
        // Restore console methods
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    // Constructor tests remain the same...
    describe('Constructor', () => {
        it('should throw error if eventBus is missing', () => {
            expect(() => new OpenableSystem({entityManager: mockEntityManager})).toThrow('OpenableSystem requires options.eventBus.');
        });
        it('should throw error if entityManager is missing', () => {
            expect(() => new OpenableSystem({eventBus: mockEventBus})).toThrow('OpenableSystem requires options.entityManager.');
        });
        it('should successfully instantiate with valid dependencies', () => {
            expect(() => new OpenableSystem({eventBus: mockEventBus, entityManager: mockEntityManager})).not.toThrow();
        });
    });

    // Test initialize method
    describe('initialize', () => {
        it('should subscribe a handler function to event:open_attempted', () => {
            openableSystem.initialize();
            expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                'event:open_attempted',
                expect.any(Function) // Ensure a function handler was subscribed
            );
        });
    });

    // Test shutdown method (optional)
    describe('shutdown', () => {
        it('should unsubscribe the previously subscribed handler from event:open_attempted', () => {
            openableSystem.initialize();
            expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
            const subscribedHandler = mockEventBus.subscribe.mock.calls[0][1];
            expect(subscribedHandler).toBeInstanceOf(Function);
            mockEventBus.subscribe.mockClear(); // Clear before shutdown

            openableSystem.shutdown();

            // Assert unsubscribe was called with the correct event name AND the specific handler
            // Note: Comparing function instances might be tricky if binding changes references.
            // This relies on the internal handler reference being stable.
            expect(mockEventBus.unsubscribe).toHaveBeenCalledTimes(1);
            // It's often sufficient to check the event name and that *a* function was unsubscribed
            expect(mockEventBus.unsubscribe).toHaveBeenCalledWith(
                'event:open_attempted',
                expect.any(Function) // Or potentially 'subscribedHandler' if reference guaranteed stable
            );
        });
    });


    // --- Test Cases for Handler Logic (Simulating Event Dispatch) ---
    describe('Event Handler Logic (#handleOpenAttempted via Event Simulation)', () => {
        const ACTOR_ID = 'player1';
        const TARGET_ID = 'door1';
        const TARGET_NAME = 'Wooden Door';

        /** @type {OpenAttemptedEventPayload} */
        const basePayload = {
            actorId: ACTOR_ID,
            targetEntityId: TARGET_ID,
        };

        // Helper to get the handler function after initialization
        const getSubscribedHandler = () => {
            openableSystem.initialize();
            if (mockEventBus.subscribe.mock.calls.length === 0) {
                throw new Error("Initialize did not call eventBus.subscribe");
            }
            const handler = mockEventBus.subscribe.mock.calls[0][1];
            mockEventBus.subscribe.mockClear(); // Clear call log after capture

            // Bind the handler to the system instance to ensure 'this' is correct
            return handler.bind(openableSystem);
        }

        it('AC4 - Success Case: should open a closed, unlocked entity and dispatch entity_opened', () => {
            // --- Arrange ---
            const handleOpenAttempted = getSubscribedHandler(); // Get the handler

            // Create component DATA objects
            const openableData = {isOpen: false};
            const nameData = {value: TARGET_NAME};
            const lockableData = {isLocked: false}; // Unlockable

            // Create a REAL Entity instance
            const targetEntity = new Entity(TARGET_ID);

            // Add component DATA using TYPE IDs
            targetEntity.addComponent(NAME_COMPONENT_TYPE_ID, nameData);
            targetEntity.addComponent(OPENABLE_COMPONENT_ID, openableData);
            targetEntity.addComponent(LOCKABLE_COMPONENT_ID, lockableData);

            // Mock EntityManager to return the REAL entity
            mockEntityManager.getEntityInstance.mockReturnValue(targetEntity);

            // --- Act ---
            handleOpenAttempted(basePayload);

            // --- Assert ---
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);

            // Assert the component DATA was modified correctly by the system
            const updatedOpenableData = targetEntity.getComponentData(OPENABLE_COMPONENT_ID);
            expect(updatedOpenableData).toBeDefined(); // Ensure component data exists
            expect(updatedOpenableData.isOpen).toBe(true); // Check the data state

            expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:entity_opened", {
                actorId: ACTOR_ID,
                targetEntityId: TARGET_ID,
                targetDisplayName: TARGET_NAME, // Assuming getDisplayName works with NAME_COMPONENT_ID data
            });
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('AC4 - Success Case (No Lockable): should open a closed entity without LockableComponent', () => {
            // --- Arrange ---
            const handleOpenAttempted = getSubscribedHandler();

            const openableData = {isOpen: false};
            const nameData = {value: TARGET_NAME};

            const targetEntity = new Entity(TARGET_ID);
            targetEntity.addComponent(NAME_COMPONENT_TYPE_ID, nameData);
            targetEntity.addComponent(OPENABLE_COMPONENT_ID, openableData);
            // No LockableComponent added

            mockEntityManager.getEntityInstance.mockReturnValue(targetEntity);

            // --- Act ---
            handleOpenAttempted(basePayload);

            // --- Assert ---
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);

            // Check data state was updated
            const updatedOpenableData = targetEntity.getComponentData(OPENABLE_COMPONENT_ID);
            expect(updatedOpenableData).toBeDefined();
            expect(updatedOpenableData.isOpen).toBe(true);

            expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:entity_opened", {
                actorId: ACTOR_ID,
                targetEntityId: TARGET_ID,
                targetDisplayName: TARGET_NAME,
            });
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('AC4 - Failure Case - Already Open: should do nothing and dispatch open_failed (ALREADY_OPEN)', () => {
            // --- Arrange ---
            const handleOpenAttempted = getSubscribedHandler();

            const openableData = {isOpen: true}; // Already open
            const nameData = {value: TARGET_NAME};

            const targetEntity = new Entity(TARGET_ID);
            targetEntity.addComponent(NAME_COMPONENT_TYPE_ID, nameData);
            targetEntity.addComponent(OPENABLE_COMPONENT_ID, openableData);

            mockEntityManager.getEntityInstance.mockReturnValue(targetEntity);

            // --- Act ---
            handleOpenAttempted(basePayload);

            // --- Assert ---
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);

            // Check data state did NOT change
            const currentOpenableData = targetEntity.getComponentData(OPENABLE_COMPONENT_ID);
            expect(currentOpenableData).toBeDefined();
            expect(currentOpenableData.isOpen).toBe(true); // Should remain true

            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:open_failed', {
                actorId: ACTOR_ID,
                targetEntityId: TARGET_ID,
                targetDisplayName: TARGET_NAME,
                reasonCode: 'ALREADY_OPEN',
            });
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('AC4 - Failure Case - Locked: should do nothing and dispatch open_failed (LOCKED)', () => {
            // --- Arrange ---
            const handleOpenAttempted = getSubscribedHandler();

            const openableData = {isOpen: false};
            const nameData = {value: TARGET_NAME};
            const lockableData = {isLocked: true}; // Locked!

            const targetEntity = new Entity(TARGET_ID);
            targetEntity.addComponent(NAME_COMPONENT_TYPE_ID, nameData);
            targetEntity.addComponent(OPENABLE_COMPONENT_ID, openableData);
            targetEntity.addComponent(LOCKABLE_COMPONENT_ID, lockableData);

            mockEntityManager.getEntityInstance.mockReturnValue(targetEntity);

            // --- Act ---
            handleOpenAttempted(basePayload);

            // --- Assert ---
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);

            // Check data state did NOT change
            const currentOpenableData = targetEntity.getComponentData(OPENABLE_COMPONENT_ID);
            expect(currentOpenableData).toBeDefined();
            expect(currentOpenableData.isOpen).toBe(false); // Should remain false

            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:open_failed', {
                actorId: ACTOR_ID,
                targetEntityId: TARGET_ID,
                targetDisplayName: TARGET_NAME,
                reasonCode: 'LOCKED',
            });
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('AC4 - Failure Case - Not Openable: should do nothing and dispatch open_failed (TARGET_NOT_OPENABLE)', () => {
            // --- Arrange ---
            const handleOpenAttempted = getSubscribedHandler();

            const nameData = {value: TARGET_NAME};

            const targetEntity = new Entity(TARGET_ID);
            targetEntity.addComponent(NAME_COMPONENT_TYPE_ID, nameData);
            // No OpenableComponent added

            mockEntityManager.getEntityInstance.mockReturnValue(targetEntity);

            // --- Act ---
            handleOpenAttempted(basePayload);

            // --- Assert ---
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);

            // Verify the component wasn't somehow added
            expect(targetEntity.hasComponent(OPENABLE_COMPONENT_ID)).toBe(false);

            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:open_failed', {
                actorId: ACTOR_ID,
                targetEntityId: TARGET_ID,
                targetDisplayName: TARGET_NAME,
                reasonCode: 'TARGET_NOT_OPENABLE',
            });
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalled(); // Warning expected from system
        });

        it('AC4 - Edge Case - Non-Existent Target Entity: should log error and dispatch open_failed (OTHER)', () => {
            // --- Arrange ---
            const handleOpenAttempted = getSubscribedHandler();
            mockEntityManager.getEntityInstance.mockReturnValue(null); // Entity not found

            // --- Act ---
            handleOpenAttempted(basePayload);

            // --- Assert ---
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:open_failed', {
                actorId: ACTOR_ID,
                targetEntityId: TARGET_ID,
                targetDisplayName: TARGET_ID, // System uses ID as fallback name here
                reasonCode: 'OTHER',
            });
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Target entity [${TARGET_ID}] not found`));
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

    }); // end describe Event Handler Logic

}); // end describe OpenableSystem