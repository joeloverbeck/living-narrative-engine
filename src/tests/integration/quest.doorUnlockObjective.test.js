// src/tests/integration/quest.doorUnlockObjective.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';

// --- Mock Core Dependencies FIRST ---
jest.mock('../../core/dataManager.js', () => {
    return jest.fn().mockImplementation(() => ({
        getQuestDefinition: jest.fn(),
        getObjectiveDefinition: jest.fn(),
        // Mock other methods if needed by QuestSystem/ObjectiveEventListenerService dependencies
    }));
});

jest.mock('../../core/gameStateManager.js', () => ({
    getPlayer: jest.fn(),
    // Mock other methods if needed
}));

jest.mock('../../entities/entityManager.js', () => ({
    getEntityInstance: jest.fn(),
    // Mock other methods if needed (e.g., getComponent if services use it directly)
}));

// Mock Entity Class
jest.mock('../../entities/entity.js', () => {
    return class MockEntity {
        constructor(id) {
            this.id = id;
            this._components = new Map();
        }

        addComponent(componentInstance, componentKey = null) {
            const key = componentKey || componentInstance.constructor;
            this._components.set(key, componentInstance);
            if (typeof key === 'function') this._components.set(key.name, componentInstance);
            if (typeof componentKey === 'string') this._components.set(componentKey, componentInstance);
            // Simulate entity reference if component needs it
            if (typeof componentInstance.setEntity === 'function') componentInstance.setEntity(this);
        }

        getComponent(ComponentClassOrKey) {
            return this._components.get(ComponentClassOrKey) || this._components.get(ComponentClassOrKey?.name);
        }

        hasComponent(ComponentClassOrKey) {
            return this._components.has(ComponentClassOrKey) || this._components.has(ComponentClassOrKey?.name);
        }

        toString() {
            return `MockEntity[id=${this.id}]`;
        }
    };
});


// --- Import Dependencies AFTER Mocks ---
import DataManager from '../../core/dataManager.js'; // Mocked constructor
import GameStateManager from '../../core/gameStateManager.js'; // Mocked object
import EntityManager from '../../entities/entityManager.js'; // Mocked object
import MockEntity from '../../entities/entity.js'; // Mocked class

// Import REAL Systems & Services needed for the test flow
import EventBus from '../../core/eventBus.js'; // Use real EventBus for this integration
import {ObjectiveEventListenerService} from '../../services/objectiveEventListenerService.js';
import QuestSystem from '../../systems/questSystem.js';
// Import supporting services QuestSystem might depend on (even if indirectly used in this test)
// These might need mocking if they have complex dependencies or side effects not needed here
import QuestPrerequisiteService from '../../services/questPrerequisiteService.js';
import QuestRewardService from '../../services/questRewardService.js';
import {ObjectiveStateCheckerService} from '../../services/objectiveStateCheckerService.js'; // QuestSystem needs this

// Import REAL Components
import {QuestLogComponent} from '../../components/questLogComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js'; // Needed for context, though not directly tested
import {PositionComponent} from '../../components/positionComponent.js'; // Needed for context


// --- Helper: Mock EventBus (Manual Trigger) ---
// Reusing the manual trigger pattern for precise control
const createMockEventBus = () => {
    const realEventBus = new EventBus(); // Use a real instance to test subscribe/unsubscribe/dispatch logic
    const originalSubscribe = realEventBus.subscribe.bind(realEventBus);
    const originalUnsubscribe = realEventBus.unsubscribe.bind(realEventBus);
    const originalDispatch = realEventBus.dispatch.bind(realEventBus);

    // Keep track of handlers for manual triggering if needed, though real dispatch might suffice
    const subscriptions = new Map();

    return {
        // Spied versions
        subscribe: jest.fn((eventName, handler) => {
            originalSubscribe(eventName, handler); // Call real subscribe
            if (!subscriptions.has(eventName)) subscriptions.set(eventName, new Set());
            subscriptions.get(eventName).add(handler);
            // console.log(`[Test Spy] Subscribed to ${eventName}`);
        }),
        unsubscribe: jest.fn((eventName, handler) => {
            originalUnsubscribe(eventName, handler); // Call real unsubscribe
            if (subscriptions.has(eventName)) subscriptions.get(eventName).delete(handler);
            // console.log(`[Test Spy] Unsubscribed from ${eventName}`);
        }),
        dispatch: jest.fn((eventName, payload) => {
            // console.log(`[Test Spy] Dispatching ${eventName}`, payload);
            originalDispatch(eventName, payload); // Call real dispatch
        }),
        // Helper to check subscriptions
        getHandlersForEvent: (eventName) => subscriptions.get(eventName) || new Set(),
        // Expose the real bus if needed, though spies should cover interactions
        _realBus: realEventBus,
    };
};


// --- Global Test Variables ---
let mockDataManagerInstance;
let mockEntityManagerInstance = EntityManager; // Use mocked object directly
let mockGameStateManagerInstance = GameStateManager; // Use mocked object directly
let mockEventBusInstance;

let objectiveEventListenerServiceInstance;
let questSystemInstance;
// Mocks for QuestSystem dependencies that aren't the main focus
let mockQuestPrerequisiteService;
let mockQuestRewardService;
let mockObjectiveStateCheckerService;


let mockPlayer;
let mockExitRoom;
let playerQuestLogComp;
let roomConnectionsComp;


// --- Test Data (Matching Ticket Refs) ---
const QUEST_ID = 'demo:quest_exit_dungeon';
const OBJECTIVE_ID = 'demo:obj_unlock_exit_door';
const TARGET_CONNECTION_ID = 'demo:exit_north_door';
const OTHER_CONNECTION_ID = 'demo:room_exit_south';
const LOCATION_ID = 'demo:room_exit';
const PLAYER_ID = 'player:test_verifier';

const objectiveDefinition = {
    id: OBJECTIVE_ID,
    completionConditions: {
        allOf: [
            {
                type: "event_listener",
                eventName: "event:door_unlocked",
                filters: {connectionId: TARGET_CONNECTION_ID}
            }
        ]
    },
    eventsToFireOnCompletion: [{eventName: "objective:completed"}] // Simplified
};

const questDefinition = {
    id: QUEST_ID,
    titleId: "quest_title_exit_dungeon",
    objectiveIds: [OBJECTIVE_ID],
    rewards: {experience: 25},
    // Other fields not strictly needed for this objective completion test
};


// --- Test Setup ---
beforeEach(() => {
    jest.clearAllMocks();

    // --- 1. Create Core Mocks ---
    mockDataManagerInstance = new DataManager(); // Calls the mock constructor
    mockEventBusInstance = createMockEventBus();
    // mockEntityManagerInstance = mockGetEntityManager(); // Already mocked module
    // mockGameStateManagerInstance = mockGetGameStateManager(); // Already mocked module

    // --- 2. Instantiate Mock Entities ---
    mockPlayer = new MockEntity(PLAYER_ID);
    mockExitRoom = new MockEntity(LOCATION_ID);

    // --- 3. Instantiate Components ---
    playerQuestLogComp = new QuestLogComponent(); // Real component
    const playerPositionComp = new PositionComponent({locationId: LOCATION_ID});
    const playerNameComp = new NameComponent({value: "Verifier"});

    roomConnectionsComp = new ConnectionsComponent({ // Real component
        connections: [
            {direction: "south", connectionId: OTHER_CONNECTION_ID, target: "demo:room_treasure"},
            {
                direction: "north",
                target: "demo:room_outside",
                type: "door",
                connectionId: TARGET_CONNECTION_ID,
                initial_state: "locked",
                name: "heavy door"
            }
        ]
    });
    const roomNameComp = new NameComponent({value: "Exit"});

    // --- 4. Assemble Mock Entities ---
    mockPlayer.addComponent(playerQuestLogComp, QuestLogComponent);
    mockPlayer.addComponent(playerPositionComp, PositionComponent);
    mockPlayer.addComponent(playerNameComp, NameComponent);
    mockPlayer.addComponent(playerQuestLogComp, 'QuestLog'); // String key

    mockExitRoom.addComponent(roomConnectionsComp, ConnectionsComponent);
    mockExitRoom.addComponent(roomNameComp, NameComponent);
    mockExitRoom.addComponent(roomConnectionsComp, 'Connections'); // String key


    // --- 5. Configure Mock Managers ---
    mockDataManagerInstance.getQuestDefinition.mockImplementation((id) => {
        return id === QUEST_ID ? questDefinition : undefined;
    });
    mockDataManagerInstance.getObjectiveDefinition.mockImplementation((id) => {
        return id === OBJECTIVE_ID ? objectiveDefinition : undefined;
    });

    mockEntityManagerInstance.getEntityInstance.mockImplementation((id) => {
        if (id === PLAYER_ID) return mockPlayer;
        if (id === LOCATION_ID) return mockExitRoom;
        return undefined;
    });

    mockGameStateManagerInstance.getPlayer.mockReturnValue(mockPlayer);


    // --- 6. Instantiate Mocked QuestSystem Dependencies ---
    // Simple mocks suffice as their internal logic isn't tested here
    mockQuestPrerequisiteService = {check: jest.fn(() => true)}; // Assume prerequisites met
    mockQuestRewardService = {grant: jest.fn(), getRewardSummary: jest.fn(() => ({experience: 25}))};
    mockObjectiveStateCheckerService = {
        registerChecksForQuest: jest.fn(),
        unregisterChecksForObjective: jest.fn(),
        unregisterAllChecksForQuest: jest.fn(),
    };


    // --- 7. Instantiate REAL Services/Systems ---
    objectiveEventListenerServiceInstance = new ObjectiveEventListenerService({
        eventBus: mockEventBusInstance,
        dataManager: mockDataManagerInstance,
    });

    questSystemInstance = new QuestSystem({
        dataManager: mockDataManagerInstance,
        eventBus: mockEventBusInstance,
        entityManager: mockEntityManagerInstance,
        gameStateManager: mockGameStateManagerInstance,
        questPrerequisiteService: mockQuestPrerequisiteService,
        questRewardService: mockQuestRewardService,
        objectiveEventListenerService: objectiveEventListenerServiceInstance,
        objectiveStateCheckerService: mockObjectiveStateCheckerService,
    });


    // --- 8. Initialize Systems ---
    // QuestSystem initialization subscribes its handlers (_handleQuestStarted etc.)
    questSystemInstance.initialize();

    // --- 9. Set Initial Quest State ---
    // Manually start the quest to trigger ObjectiveEventListenerService subscriptions
    playerQuestLogComp.startQuest(QUEST_ID);
    expect(playerQuestLogComp.getQuestStatus(QUEST_ID)).toBe('active');

    // Manually dispatch the 'quest:started' event which QuestSystem listens for
    // This triggers QuestSystem._handleQuestStarted -> objectiveEventListenerService.registerListenersForQuest
    mockEventBusInstance.dispatch('quest:started', {questId: QUEST_ID});

});

afterEach(() => {
    jest.restoreAllMocks();
});


// --- Test Suite ---
describe('Integration Test: Door Unlock Event Completes Quest Objective (Ticket 4)', () => {

    it('should have ObjectiveEventListenerService subscribe to "event:door_unlocked" when the quest starts', () => {
        // Verification Step 2: Confirm ObjectiveEventListenerService correctly subscribes...
        // This is checked implicitly by the beforeEach setup which dispatches 'quest:started'

        // Assert that the REAL EventBus instance (via the spy) has a handler registered for the event
        expect(mockEventBusInstance.subscribe).toHaveBeenCalledWith(
            'event:door_unlocked',
            expect.any(Function) // Check that *some* function was subscribed
        );

        // Optional: More detailed check if needed (inspect the actual handler count/properties)
        const handlers = mockEventBusInstance.getHandlersForEvent('event:door_unlocked');
        expect(handlers.size).toBeGreaterThan(0);
    });

    it('should mark the objective and quest as complete when the correct door unlocked event is dispatched', () => {
        // Acceptance Criteria 1 & 2

        // --- Pre-Assertions ---
        expect(playerQuestLogComp.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID)).toBe(false);
        expect(playerQuestLogComp.getQuestStatus(QUEST_ID)).toBe('active');

        // --- Define the Correct Event Payload ---
        const correctEventPayload = {
            userId: PLAYER_ID, // Or the ID expected by any potential filters (none here)
            locationId: LOCATION_ID,
            connectionId: TARGET_CONNECTION_ID, // The specific connection ID from the objective filter
            keyId: null, // Not relevant for this objective filter
            previousState: 'locked',
            newState: 'unlocked'
        };

        // --- Act: Dispatch the Event ---
        // This simulates the DoorSystem (or any other system) firing the event after unlock
        mockEventBusInstance.dispatch('event:door_unlocked', correctEventPayload);

        // --- Assertions ---
        // Verification Step 3 & 4 are implicitly tested if the state changes below.
        // Verification Step 5: Confirm QuestSystem processed completion

        // AC 1: Objective Complete?
        expect(playerQuestLogComp.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID)).toBe(true);

        // AC 2: Quest Complete?
        expect(playerQuestLogComp.getQuestStatus(QUEST_ID)).toBe('completed');

        // Optional: Check for objective/quest completion events dispatched by QuestSystem
        expect(mockEventBusInstance.dispatch).toHaveBeenCalledWith(
            'objective:completed', // From objective definition
            expect.objectContaining({objectiveId: OBJECTIVE_ID, questId: QUEST_ID})
        );
        expect(mockEventBusInstance.dispatch).toHaveBeenCalledWith(
            'quest:completed', // QuestSystem internal event
            expect.objectContaining({questId: QUEST_ID})
        );
        // Optional: Check reward service was called
        expect(mockQuestRewardService.grant).toHaveBeenCalledWith(questDefinition, mockPlayer);
    });

    it('should NOT complete the objective or quest if the event is for a different door', () => {
        // Acceptance Criterion 3: Negative Scenario

        // --- Pre-Assertions ---
        expect(playerQuestLogComp.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID)).toBe(false);
        expect(playerQuestLogComp.getQuestStatus(QUEST_ID)).toBe('active');

        // --- Define the Incorrect Event Payload ---
        const incorrectEventPayload = {
            userId: PLAYER_ID,
            locationId: LOCATION_ID,
            connectionId: OTHER_CONNECTION_ID, // A different connection ID
            keyId: null,
            previousState: 'locked',
            newState: 'unlocked'
        };

        // --- Act: Dispatch the Incorrect Event ---
        mockEventBusInstance.dispatch('event:door_unlocked', incorrectEventPayload);

        // --- Assertions ---
        // Verification Step 3: Listener should filter this out

        // Objective should NOT be complete
        expect(playerQuestLogComp.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID)).toBe(false);

        // Quest should NOT be complete
        expect(playerQuestLogComp.getQuestStatus(QUEST_ID)).toBe('active');

        // Ensure completion events were NOT fired
        expect(mockEventBusInstance.dispatch).not.toHaveBeenCalledWith(
            'objective:completed',
            expect.objectContaining({objectiveId: OBJECTIVE_ID})
        );
        expect(mockEventBusInstance.dispatch).not.toHaveBeenCalledWith(
            'quest:completed',
            expect.objectContaining({questId: QUEST_ID})
        );
    });

    it('should NOT complete the objective if the event is correct but the quest is not active', () => {
        // --- Setup Modification: Make quest inactive BEFORE dispatch ---
        playerQuestLogComp.updateQuestStatus(QUEST_ID, 'failed'); // Or any non-active status
        expect(playerQuestLogComp.getQuestStatus(QUEST_ID)).toBe('failed');

        // --- Define the Correct Event Payload ---
        const correctEventPayload = {
            userId: PLAYER_ID,
            locationId: LOCATION_ID,
            connectionId: TARGET_CONNECTION_ID,
            keyId: null,
            previousState: 'locked',
            newState: 'unlocked'
        };

        // --- Act: Dispatch the Event ---
        mockEventBusInstance.dispatch('event:door_unlocked', correctEventPayload);

        // --- Assertions ---
        // Objective should still be incomplete (because quest wasn't active when callback was processed)
        expect(playerQuestLogComp.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID)).toBe(false);
        // Quest status should remain what it was set to
        expect(playerQuestLogComp.getQuestStatus(QUEST_ID)).toBe('failed');

        // Ensure completion events were NOT fired
        expect(mockEventBusInstance.dispatch).not.toHaveBeenCalledWith(
            'objective:completed',
            expect.objectContaining({objectiveId: OBJECTIVE_ID})
        );
        expect(mockEventBusInstance.dispatch).not.toHaveBeenCalledWith(
            'quest:completed',
            expect.objectContaining({questId: QUEST_ID})
        );
    });


}); // End describe block