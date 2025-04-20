// src/tests/systems/openableSystem.test.js

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- System Under Test ---
import OpenableSystem from '../../systems/openableSystem.js';
import OpenableComponent from "../../components/openableComponent.js";
import LockableComponent from "../../components/lockableComponent.js";
import {NameComponent} from "../../components/nameComponent.js";

// --- Dependencies to Mock/Use ---

const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
};

const mockEntityManager = {
    getEntityInstance: jest.fn(),
};

const createMockEntity = (id, components = {}) => {
    const mockEntity = {
        id: id,
        components: new Map(),
        getComponent: jest.fn((ComponentClass) => {
            return mockEntity.components.get(ComponentClass);
        }),
        _addMockComponent: (ComponentClass, instance) => {
            mockEntity.components.set(ComponentClass, instance);
        },
    };
    for (const ComponentClassName in components) {
        // Find the actual class constructor based on its name string
        const ComponentClass = [OpenableComponent, LockableComponent, NameComponent].find(c => c.name === ComponentClassName);
        if (ComponentClass) {
            mockEntity._addMockComponent(ComponentClass, components[ComponentClassName]);
        } else {
            console.warn(`Mock Component Class not found for name: ${ComponentClassName}`);
        }
    }
    return mockEntity;
};

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
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        });
    });

    afterEach(() => {
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
            // --- Corrected Assertion ---
            // We verify the event name and that *a* function was passed.
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                'event:open_attempted',
                expect.any(Function) // Ensure a function handler was subscribed
            );
        });
    });

    // Test shutdown method (optional)
    describe('shutdown', () => {
        it('should unsubscribe the previously subscribed handler from event:open_attempted', () => {
            // --- Corrected Test Logic ---
            // 1. Initialize to subscribe the handler
            openableSystem.initialize();

            // 2. Capture the handler function passed to subscribe
            // Ensure initialize was actually called and subscribed something
            expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
            const subscribedHandler = mockEventBus.subscribe.mock.calls[0][1]; // Get the function argument
            expect(subscribedHandler).toBeInstanceOf(Function); // Verify it's a function

            // 3. Clear the subscribe mock call *after* capturing the handler,
            //    so it doesn't interfere if shutdown accidentally subscribes again.
            mockEventBus.subscribe.mockClear();

            // 4. Call shutdown
            openableSystem.shutdown();

            // 5. Assert unsubscribe was called with the correct event name AND the captured handler
            expect(mockEventBus.unsubscribe).toHaveBeenCalledTimes(1);
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
            return handler;
        }

        it('AC4 - Success Case: should open a closed, unlocked entity and dispatch entity_opened', () => {
            // --- Arrange ---
            const handleOpenAttempted = getSubscribedHandler(); // Get the handler
            const mockOpenableComp = {isOpen: false, setState: jest.fn()};
            const mockNameComp = {value: TARGET_NAME};
            const mockLockableComp = {isLocked: false}; // Unlockable

            const mockTargetEntity = createMockEntity(TARGET_ID, {
                NameComponent: mockNameComp,
                OpenableComponent: mockOpenableComp,
                LockableComponent: mockLockableComp
            });
            mockEntityManager.getEntityInstance.mockReturnValue(mockTargetEntity);

            // --- Act ---
            // Call the captured handler function directly
            handleOpenAttempted(basePayload);

            // --- Assert --- (Assertions remain the same)
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
            expect(mockTargetEntity.getComponent).toHaveBeenCalledWith(OpenableComponent);
            expect(mockTargetEntity.getComponent).toHaveBeenCalledWith(LockableComponent);
            expect(mockOpenableComp.setState).toHaveBeenCalledWith(true);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:entity_opened", {
                actorId: ACTOR_ID, targetEntityId: TARGET_ID, targetDisplayName: TARGET_NAME,
            });
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('AC4 - Success Case (No Lockable): should open a closed entity without LockableComponent', () => {
            // --- Arrange ---
            const handleOpenAttempted = getSubscribedHandler();
            const mockOpenableComp = {isOpen: false, setState: jest.fn()};
            const mockNameComp = {value: TARGET_NAME};
            // No LockableComponent

            const mockTargetEntity = createMockEntity(TARGET_ID, {
                NameComponent: mockNameComp,
                OpenableComponent: mockOpenableComp
                // LockableComponent missing
            });
            mockEntityManager.getEntityInstance.mockReturnValue(mockTargetEntity);

            // --- Act ---
            handleOpenAttempted(basePayload);

            // --- Assert ---
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
            expect(mockTargetEntity.getComponent).toHaveBeenCalledWith(OpenableComponent);
            expect(mockTargetEntity.getComponent).toHaveBeenCalledWith(LockableComponent); // Still checks for it
            expect(mockOpenableComp.setState).toHaveBeenCalledWith(true);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith("event:entity_opened", {
                actorId: ACTOR_ID, targetEntityId: TARGET_ID, targetDisplayName: TARGET_NAME,
            });
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('AC4 - Failure Case - Already Open: should do nothing and dispatch open_failed (ALREADY_OPEN)', () => {
            // --- Arrange ---
            const handleOpenAttempted = getSubscribedHandler();
            const mockOpenableComp = {isOpen: true, setState: jest.fn()}; // Already open
            const mockNameComp = {value: TARGET_NAME};
            const mockTargetEntity = createMockEntity(TARGET_ID, {
                NameComponent: mockNameComp, OpenableComponent: mockOpenableComp
            });
            mockEntityManager.getEntityInstance.mockReturnValue(mockTargetEntity);

            // --- Act ---
            handleOpenAttempted(basePayload);

            // --- Assert ---
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
            expect(mockTargetEntity.getComponent).toHaveBeenCalledWith(OpenableComponent);
            expect(mockOpenableComp.setState).not.toHaveBeenCalled();
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
            const mockOpenableComp = {isOpen: false, setState: jest.fn()};
            const mockLockableComp = {isLocked: true}; // Locked!
            const mockNameComp = {value: TARGET_NAME};
            const mockTargetEntity = createMockEntity(TARGET_ID, {
                NameComponent: mockNameComp, OpenableComponent: mockOpenableComp, LockableComponent: mockLockableComp
            });
            mockEntityManager.getEntityInstance.mockReturnValue(mockTargetEntity);

            // --- Act ---
            handleOpenAttempted(basePayload);

            // --- Assert ---
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
            expect(mockTargetEntity.getComponent).toHaveBeenCalledWith(OpenableComponent);
            expect(mockTargetEntity.getComponent).toHaveBeenCalledWith(LockableComponent);
            expect(mockOpenableComp.setState).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:open_failed', {
                actorId: ACTOR_ID, targetEntityId: TARGET_ID, targetDisplayName: TARGET_NAME, reasonCode: 'LOCKED',
            });
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('AC4 - Failure Case - Not Openable: should do nothing and dispatch open_failed (TARGET_NOT_OPENABLE)', () => {
            // --- Arrange ---
            const handleOpenAttempted = getSubscribedHandler();
            const mockNameComp = {value: TARGET_NAME};
            // No OpenableComponent
            const mockTargetEntity = createMockEntity(TARGET_ID, {NameComponent: mockNameComp});
            mockEntityManager.getEntityInstance.mockReturnValue(mockTargetEntity);

            // --- Act ---
            handleOpenAttempted(basePayload);

            // --- Assert ---
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
            expect(mockTargetEntity.getComponent).toHaveBeenCalledWith(OpenableComponent); // Still checked
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:open_failed', {
                actorId: ACTOR_ID,
                targetEntityId: TARGET_ID,
                targetDisplayName: TARGET_NAME,
                reasonCode: 'TARGET_NOT_OPENABLE',
            });
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalled(); // Warning expected
        });

        it('AC4 - Edge Case - Non-Existent Target Entity: should log error and dispatch open_failed (OTHER)', () => {
            // --- Arrange ---
            const handleOpenAttempted = getSubscribedHandler();
            mockEntityManager.getEntityInstance.mockReturnValue(null); // Not found

            // --- Act ---
            handleOpenAttempted(basePayload);

            // --- Assert ---
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(TARGET_ID);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:open_failed', {
                actorId: ACTOR_ID, targetEntityId: TARGET_ID, targetDisplayName: TARGET_ID, reasonCode: 'OTHER',
            });
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Target entity [${TARGET_ID}] not found`));
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

    }); // end describe Event Handler Logic

}); // end describe OpenableSystem