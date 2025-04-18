// src/tests/systems/questStartTriggerSystem.test.js

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Mock Core Dependencies ---
// Mock EventBus (Manual Trigger/Spy)
const createMockEventBus = () => {
    // Define _subscriptions INSIDE the factory scope for each instance
    const _subscriptions = new Map();

    const mockBus = {
        // Keep track of the internal map if needed for debugging, but don't rely on it externally
        _internal_subscriptions: _subscriptions, // Optional: for inspection in tests if needed

        subscribe: jest.fn((eventName, handler) => {
            // Reference the _subscriptions map defined above
            if (!_subscriptions.has(eventName)) {
                _subscriptions.set(eventName, new Set());
            }
            _subscriptions.get(eventName).add(handler);
        }),

        unsubscribe: jest.fn((eventName, handler) => {
            // Reference the _subscriptions map defined above
            _subscriptions.get(eventName)?.delete(handler);
        }),

        dispatch: jest.fn((eventName, payload) => {
            // Reference the _subscriptions map defined above
            const handlers = _subscriptions.get(eventName);
            if (handlers) {
                [...handlers].forEach(handler => handler({...payload})); // Pass copy
            }
        }),

        // Helper to manually trigger a specific subscribed handler (still useful)
        triggerEvent: (eventName, payload) => {
            // Reference the _subscriptions map defined above
            const handlers = _subscriptions.get(eventName);
            if (handlers) {
                [...handlers].forEach(handler => handler({...payload})); // Pass copy
            } else {
                // console.warn(`[Test Trigger] No handlers found for event: ${eventName}`);
            }
        },

        // Clear function specific to THIS mock bus instance
        clearAll: () => {
            // Clear the internal map of THIS instance
            _subscriptions.clear();
            // Clear the mock function calls on THIS instance
            mockBus.subscribe.mockClear();
            mockBus.unsubscribe.mockClear();
            mockBus.dispatch.mockClear();
            // Note: triggerEvent is not a jest mock, so no mockClear needed
        }
    };
    return mockBus;
};

const mockGameDataRepository = {
    getAllQuestDefinitions: jest.fn(),
    // Add other methods if QuestStartTriggerSystem were to use them
    _quests: [], // Internal store for mock data
    setupQuests: (quests) => {
        mockGameDataRepository._quests = quests;
        mockGameDataRepository.getAllQuestDefinitions.mockReturnValue(mockGameDataRepository._quests);
    },
    clearData: () => {
        mockGameDataRepository._quests = [];
        mockGameDataRepository.getAllQuestDefinitions.mockClear();
    }
};

// Mock GameStateManager
const mockGameStateManager = {
    getPlayer: jest.fn(),
    _player: null, // Internal store for mock player
    setPlayer: (player) => {
        mockGameStateManager._player = player;
        mockGameStateManager.getPlayer.mockReturnValue(mockGameStateManager._player);
    },
    clearPlayer: () => {
        mockGameStateManager._player = null;
        mockGameStateManager.getPlayer.mockClear();
    }
};

// Mock Entity & Components (simplified)
class MockQuestLogComponent {
    constructor(initialQuests = {}) {
        // Store quest status: { questId: 'active' | 'completed' | 'failed' }
        this.questLog = {...initialQuests};
    }

    getQuestStatus = jest.fn((questId) => this.questLog[questId]);
    // Add startQuest/completeObjective etc. if needed by other systems, but not directly by QSTS
}

class MockEntity {
    constructor(id) {
        this.id = id;
        this._components = new Map();
    }

    addComponent(componentInstance, componentKey = null) {
        const key = componentKey || componentInstance.constructor;
        this._components.set(key, componentInstance);
        // Simulate common lookup patterns
        if (typeof key === 'function') this._components.set(key.name, componentInstance);
        if (typeof componentKey === 'string') this._components.set(componentKey, componentInstance);
    }

    getComponent(ComponentClassOrKey) {
        // Try direct key, then constructor, then name
        return this._components.get(ComponentClassOrKey) || this._components.get(ComponentClassOrKey?.constructor) || this._components.get(ComponentClassOrKey?.name);
    }

    // hasComponent - not strictly needed by QSTS, but good practice
    hasComponent(ComponentClassOrKey) {
        return this._components.has(ComponentClassOrKey) || this._components.has(ComponentClassOrKey?.constructor) || this._components.has(ComponentClassOrKey?.name);
    }
}

// --- End Mock Core Dependencies ---

// --- Import System Under Test ---
// NOTE: Path adjusted assuming tests are in src/tests/** and system is in src/services/**
import {QuestStartTriggerSystem} from '../../systems/questStartTriggerSystem.js';
import {QuestLogComponent} from '../../components/questLogComponent.js';
import {EVENT_ENTITY_MOVED} from "../../types/eventTypes.js"; // Import real key if used

// --- Test Data ---
const PLAYER_ID = 'player:test';
const TARGET_QUEST_ID = 'demo:quest_exit_dungeon';
const TARGET_LOCATION_ID = 'demo:room_exit';
const OTHER_LOCATION_ID = 'demo:room_entrance';
const NON_PLAYER_ID = 'npc:goblin';

const questDefWithCorrectTrigger = {
    id: TARGET_QUEST_ID,
    titleId: "quest_title_exit_dungeon",
    objectiveIds: ["demo:obj_unlock_exit_door"],
    prerequisites: null,
    rewards: {experience: 25},
    startingTriggers: [
        {
            type: "on_enter_location",
            locationId: TARGET_LOCATION_ID,
            "$comment": "Quest starts automatically when player enters the exit room."
        }
    ],
    questGiverId: null,
    isRepeatable: false
};

const questDefWithWrongLocation = {
    ...questDefWithCorrectTrigger,
    id: 'quest:wrong_loc',
    startingTriggers: [{type: "on_enter_location", locationId: "demo:room_treasure"}]
};
const questDefWithWrongType = {
    ...questDefWithCorrectTrigger,
    id: 'quest:wrong_type',
    startingTriggers: [{type: "on_interact", entityId: "lever:xyz"}]
};
const questDefWithNoTriggers = {...questDefWithCorrectTrigger, id: 'quest:no_triggers', startingTriggers: []};
const questDefWithNullTriggers = {...questDefWithCorrectTrigger, id: 'quest:null_triggers', startingTriggers: null};
const otherQuestDef = {
    id: 'quest:other',
    titleId: 'other_title',
    startingTriggers: [{type: "on_event", eventName: "something_else"}]
};


// --- Test Suite ---
describe('QuestStartTriggerSystem - Trigger Matching (Ticket 3)', () => {
    let questStartTriggerSystem;
    let mockEventBus;
    let mockPlayerEntity;
    let mockPlayerQuestLog;

    beforeEach(() => {
        jest.clearAllMocks(); // Ensure mocks are clean
        mockEventBus = createMockEventBus();
        mockGameDataRepository.clearData();
        mockGameStateManager.clearPlayer();

        // Setup Player
        mockPlayerQuestLog = new MockQuestLogComponent(); // Fresh log each time
        mockPlayerEntity = new MockEntity(PLAYER_ID);
        // Use the actual component class as the key if the system uses it
        mockPlayerEntity.addComponent(mockPlayerQuestLog, QuestLogComponent);

        // Setup Managers
        mockGameStateManager.setPlayer(mockPlayerEntity);
        // Setup default quests - including the target quest
        mockGameDataRepository.setupQuests([
            questDefWithCorrectTrigger,
            questDefWithWrongLocation,
            questDefWithWrongType,
            questDefWithNoTriggers,
            questDefWithNullTriggers,
            otherQuestDef
        ]);

        // Instantiate System Under Test
        questStartTriggerSystem = new QuestStartTriggerSystem({
            eventBus: mockEventBus,
            gameDataRepository: mockGameDataRepository,
            gameStateManager: mockGameStateManager
        });

        // Initialize the system to subscribe to events
        questStartTriggerSystem.initialize();
    });

    afterEach(() => {
        // Optional: Explicitly clear mocks/bus if needed between tests in other suites
        mockEventBus.clearAll();
    });

    it('should subscribe to "' + EVENT_ENTITY_MOVED + '" upon initialization', () => {
        // Verify AC: Initialization subscribes
        expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
        expect(mockEventBus.subscribe).toHaveBeenCalledWith(
            EVENT_ENTITY_MOVED,
            expect.any(Function) // The bound _handleEntityMoved method
        );
    });

    it('should dispatch "event:quest_trigger_met" when player enters the correct location for an eligible quest', () => {
        // Verify AC: Core success case

        // --- Arrange ---
        const eventPayload = {
            entityId: PLAYER_ID,
            oldLocationId: OTHER_LOCATION_ID,
            newLocationId: TARGET_LOCATION_ID // The location specified in the trigger
        };
        // Ensure quest is not already in the log
        expect(mockPlayerQuestLog.getQuestStatus(TARGET_QUEST_ID)).toBeUndefined();

        // --- Act ---
        // Simulate the event bus triggering the subscribed handler
        mockEventBus.triggerEvent(EVENT_ENTITY_MOVED, eventPayload);

        // --- Assert ---
        // Verify AC checks:
        // 1. Player check passed (implied by reaching dispatch)
        // 2. Quest Log checked (implied by reaching dispatch)
        // 3. Quest Definition retrieved (mockGameDataRepository.getAllQuestDefinitions was called)
        expect(mockGameDataRepository.getAllQuestDefinitions).toHaveBeenCalledTimes(1);
        // 4. startingTriggers accessed and matched (implied by reaching dispatch)
        // 5. Correct event dispatched
        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'event:quest_trigger_met',
            {questId: TARGET_QUEST_ID}
        );
    });

    it('should NOT dispatch if the moved entity is not the player', () => {
        // Verify AC: Player identification check

        // --- Arrange ---
        const eventPayload = {
            entityId: NON_PLAYER_ID, // Different entity
            oldLocationId: OTHER_LOCATION_ID,
            newLocationId: TARGET_LOCATION_ID
        };

        // --- Act ---
        mockEventBus.triggerEvent(EVENT_ENTITY_MOVED, eventPayload);

        // --- Assert ---
        expect(mockGameStateManager.getPlayer).toHaveBeenCalled(); // Still checks who the player is
        expect(mockGameDataRepository.getAllQuestDefinitions).not.toHaveBeenCalled(); // Should exit before checking quests
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:quest_trigger_met', expect.anything());
    });

    it('should NOT dispatch if the event is missing newLocationId', () => {
        // Verify AC: Handling missing event data

        // --- Arrange ---
        const eventPayload = {
            entityId: PLAYER_ID,
            oldLocationId: OTHER_LOCATION_ID,
            newLocationId: undefined // Missing location
        };
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        }); // Suppress warning

        // --- Act ---
        mockEventBus.triggerEvent(EVENT_ENTITY_MOVED, eventPayload);

        // --- Assert ---
        expect(mockGameStateManager.getPlayer).toHaveBeenCalled();
        expect(mockGameDataRepository.getAllQuestDefinitions).not.toHaveBeenCalled(); // Should exit before checking quests
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:quest_trigger_met', expect.anything());
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('missing newLocationId'));

        consoleWarnSpy.mockRestore();
    });


    it('should NOT dispatch if the player enters a different location', () => {
        // Verify AC: Location mismatch check

        // --- Arrange ---
        const eventPayload = {
            entityId: PLAYER_ID,
            oldLocationId: TARGET_LOCATION_ID,
            newLocationId: OTHER_LOCATION_ID // Wrong location
        };

        // --- Act ---
        mockEventBus.triggerEvent(EVENT_ENTITY_MOVED, eventPayload);

        // --- Assert ---
        expect(mockGameDataRepository.getAllQuestDefinitions).toHaveBeenCalled(); // It will check quests
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:quest_trigger_met', expect.anything());
    });

    it('should NOT dispatch if the quest is already in the player log', () => {
        // Verify AC: Quest eligibility check (already active)

        // --- Arrange ---
        // Add the quest to the log *before* the event
        mockPlayerQuestLog.questLog[TARGET_QUEST_ID] = 'active';
        expect(mockPlayerQuestLog.getQuestStatus(TARGET_QUEST_ID)).toBe('active');

        const eventPayload = {
            entityId: PLAYER_ID,
            oldLocationId: OTHER_LOCATION_ID,
            newLocationId: TARGET_LOCATION_ID
        };

        // --- Act ---
        mockEventBus.triggerEvent(EVENT_ENTITY_MOVED, eventPayload);

        // --- Assert ---
        expect(mockGameDataRepository.getAllQuestDefinitions).toHaveBeenCalled();
        // Crucially, check that the QuestLogComponent's getQuestStatus was called for the target quest
        expect(mockPlayerQuestLog.getQuestStatus).toHaveBeenCalledWith(TARGET_QUEST_ID);
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:quest_trigger_met', expect.anything());
    });

    it('should NOT dispatch if the quest trigger type does not match "on_enter_location"', () => {
        // Verify AC: Trigger type mismatch check

        // --- Arrange ---
        mockGameDataRepository.setupQuests([questDefWithWrongType, otherQuestDef]); // Only provide quests with wrong types
        const eventPayload = {
            entityId: PLAYER_ID,
            oldLocationId: OTHER_LOCATION_ID,
            newLocationId: TARGET_LOCATION_ID // Location is "correct" but trigger type isn't
        };

        // --- Act ---
        mockEventBus.triggerEvent(EVENT_ENTITY_MOVED, eventPayload);

        // --- Assert ---
        expect(mockGameDataRepository.getAllQuestDefinitions).toHaveBeenCalled();
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:quest_trigger_met', expect.anything());
    });

    it('should NOT dispatch if the quest trigger locationId does not match', () => {
        // Verify AC: Trigger location mismatch check

        // --- Arrange ---
        mockGameDataRepository.setupQuests([questDefWithWrongLocation, otherQuestDef]); // Only provide quests with wrong location triggers
        const eventPayload = {
            entityId: PLAYER_ID,
            oldLocationId: OTHER_LOCATION_ID,
            newLocationId: TARGET_LOCATION_ID // Player enters the target location, but no quest trigger matches it
        };

        // --- Act ---
        mockEventBus.triggerEvent(EVENT_ENTITY_MOVED, eventPayload);

        // --- Assert ---
        expect(mockGameDataRepository.getAllQuestDefinitions).toHaveBeenCalled();
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:quest_trigger_met', expect.anything());
    });

    it('should handle quests with no startingTriggers array gracefully', () => {
        // --- Arrange ---
        mockGameDataRepository.setupQuests([questDefWithNoTriggers]);
        const eventPayload = {entityId: PLAYER_ID, newLocationId: TARGET_LOCATION_ID};

        // --- Act ---
        mockEventBus.triggerEvent(EVENT_ENTITY_MOVED, eventPayload);

        // --- Assert ---
        expect(mockGameDataRepository.getAllQuestDefinitions).toHaveBeenCalled();
        expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        // No error should be thrown
    });

    it('should handle quests with null startingTriggers gracefully', () => {
        // --- Arrange ---
        mockGameDataRepository.setupQuests([questDefWithNullTriggers]);
        const eventPayload = {entityId: PLAYER_ID, newLocationId: TARGET_LOCATION_ID};

        // --- Act ---
        mockEventBus.triggerEvent(EVENT_ENTITY_MOVED, eventPayload);

        // --- Assert ---
        expect(mockGameDataRepository.getAllQuestDefinitions).toHaveBeenCalled();
        expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        // No error should be thrown
    });

    it('should correctly check eligibility and triggers even with multiple quests defined', () => {
        // Ensures the loop doesn't stop early or get confused

        // --- Arrange ---
        // Use the default setup which has multiple quests
        expect(mockGameDataRepository._quests.length).toBeGreaterThan(1);
        const eventPayload = {entityId: PLAYER_ID, newLocationId: TARGET_LOCATION_ID};

        // --- Act ---
        mockEventBus.triggerEvent(EVENT_ENTITY_MOVED, eventPayload);

        // --- Assert ---
        // Should still only dispatch for the one matching quest
        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'event:quest_trigger_met',
            {questId: TARGET_QUEST_ID} // Make sure it's the correct one
        );
        // Ensure the quest log check was performed for multiple quests
        expect(mockPlayerQuestLog.getQuestStatus).toHaveBeenCalledWith(TARGET_QUEST_ID);
        expect(mockPlayerQuestLog.getQuestStatus).toHaveBeenCalledWith(questDefWithWrongLocation.id); // Example check
        // Add more checks if specific iteration order/logic needs validation
    });

});