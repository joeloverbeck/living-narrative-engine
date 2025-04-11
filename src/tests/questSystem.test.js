// src/tests/questSystem.test.js

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import QuestSystem from '../systems/questSystem.js'; // Adjust path as needed
import { QuestLogComponent } from '../components/questLogComponent.js'; // Adjust path
import Entity from '../entities/entity.js'; // Adjust path
// Import the services we need to mock
import { QuestPrerequisiteService } from '../services/questPrerequisiteService.js';
import { QuestRewardService } from '../services/questRewardService.js';
import { ObjectiveEventListenerService } from '../services/objectiveEventListenerService.js';
// --- ADDED: Import the new service to mock ---
import { ObjectiveStateCheckerService } from '../services/objectiveStateCheckerService.js';

// --- Mocks ---

// Mock EventBus (Keep as is)
const mockEventBus = {
    _subscriptions: new Map(),
    subscribe: jest.fn((eventName, handler) => {
        if (!mockEventBus._subscriptions.has(eventName)) {
            mockEventBus._subscriptions.set(eventName, new Set());
        }
        mockEventBus._subscriptions.get(eventName).add(handler);
    }),
    unsubscribe: jest.fn((eventName, handler) => {
        const handlers = mockEventBus._subscriptions.get(eventName);
        if (handlers) {
            handlers.delete(handler);
        }
    }),
    dispatch: jest.fn((eventName, payload) => {
        const handlers = mockEventBus._subscriptions.get(eventName);
        if (handlers) {
            // Simulate event dispatch by calling handlers registered via subscribe
            const payloadCopy = { ...payload };
            [...handlers].forEach(handler => handler(payloadCopy));
        }
    }),
    getSubscriptionCount: (eventName) => {
        return mockEventBus._subscriptions.get(eventName)?.size || 0;
    },
    clearAllSubscriptions: () => {
        mockEventBus._subscriptions.clear();
        // Also clear mock function calls on the bus itself
        mockEventBus.subscribe.mockClear();
        mockEventBus.unsubscribe.mockClear();
        mockEventBus.dispatch.mockClear();
    }
};

// Mock DataManager (Keep as is, but ensure it's cleared)
const mockDataManager = {
    _quests: new Map(),
    _objectives: new Map(),
    getQuestDefinition: jest.fn((questId) => mockDataManager._quests.get(questId)),
    getObjectiveDefinition: jest.fn((objectiveId) => mockDataManager._objectives.get(objectiveId)),
    addQuestDefinition: (questDef) => mockDataManager._quests.set(questDef.id, questDef),
    addObjectiveDefinition: (objDef) => mockDataManager._objectives.set(objDef.id, objDef),
    clearAllData: () => {
        mockDataManager._quests.clear();
        mockDataManager._objectives.clear();
        // Clear mock function calls
        mockDataManager.getQuestDefinition.mockClear();
        mockDataManager.getObjectiveDefinition.mockClear();
    }
};

// Mock EntityManager (Keep as is)
const mockEntityManager = {
    getEntityInstance: jest.fn(), // Keep the function signature mocked
};

let mockPlayerEntity;
let mockQuestLogComponent;

// Mock GameStateManager (Keep as is)
const mockGameStateManager = {
    getPlayer: jest.fn(() => mockPlayerEntity),
    setFlag: jest.fn(), // Keep if needed
};

// Mock QuestPrerequisiteService (Keep as is)
const mockQuestPrerequisiteService = {
    check: jest.fn(),
};

// Mock QuestRewardService (Keep as is, ensure grant and getRewardSummary are mock functions)
const mockQuestRewardService = {
    grant: jest.fn(),
    getRewardSummary: jest.fn(() => null), // Add mock for getRewardSummary used in completeQuest
};

// Mock ObjectiveEventListenerService (Keep as is)
const mockObjectiveEventListenerService = {
    registerListenersForQuest: jest.fn(),
    unregisterListenersForObjective: jest.fn(),
    unregisterAllListenersForQuest: jest.fn(),
};

// --- Mock ObjectiveStateCheckerService --- // ********** ADDED SECTION **********
const mockObjectiveStateCheckerService = {
    registerChecksForQuest: jest.fn(),
    unregisterChecksForObjective: jest.fn(),
    unregisterAllChecksForQuest: jest.fn(),
};
// --- End Added Section --- //


// --- Test Suite ---

// Use a more specific describe block for these tests
describe('QuestSystem - Automatic Completion Check via _processObjectiveCompletion', () => {
    let questSystem;
    let consoleLogSpy;
    let consoleWarnSpy;
    let consoleErrorSpy; // Add spy for errors

    beforeEach(() => {
        // Clear mocks and stored data FIRST
        jest.clearAllMocks(); // Clears all mock function calls and instances created by jest.fn()
        mockEventBus.clearAllSubscriptions(); // Reset EventBus state and mock calls
        mockDataManager.clearAllData(); // Reset DataManager state and mock calls

        // --- Create FRESH instances for each test ---
        mockPlayerEntity = new Entity('player'); // Create NEW Entity
        mockQuestLogComponent = new QuestLogComponent(); // Create NEW Component
        mockPlayerEntity.addComponent(mockQuestLogComponent); // Add fresh component to fresh entity

        // --- Reset and Configure Mocks relying on fresh instances ---
        // Reset mockEntityManager completely and set its implementation for THIS test
        mockEntityManager.getEntityInstance.mockReset(); // Ensures no old implementations linger
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
            if (id === 'player') return mockPlayerEntity; // Return the FRESH player
            return undefined;
        });

        // Reset mockGameStateManager and set its implementation for THIS test
        mockGameStateManager.getPlayer.mockReset();
        mockGameStateManager.getPlayer.mockImplementation(() => mockPlayerEntity); // Return the FRESH player
        mockGameStateManager.setFlag.mockReset(); // Reset if used

        // Reset Service Mocks (jest.clearAllMocks handles the .mockClear() part)
        // Re-apply default implementations if needed after clearAllMocks
        mockQuestPrerequisiteService.check.mockReturnValue(true); // Default to prerequisites met
        mockQuestRewardService.getRewardSummary.mockImplementation((questDef) => {
            // Provide a basic default reward summary mock if needed for simple cases
            if (questDef?.rewards) return { experience: questDef.rewards.experience || 0 };
            return null;
        });

        // --- Instantiate QuestSystem with ALL mocks --- // ********** UPDATED **********
        questSystem = new QuestSystem({
            dataManager: mockDataManager,
            eventBus: mockEventBus,
            entityManager: mockEntityManager,
            gameStateManager: mockGameStateManager,
            questPrerequisiteService: mockQuestPrerequisiteService,
            questRewardService: mockQuestRewardService,
            objectiveEventListenerService: mockObjectiveEventListenerService,
            objectiveStateCheckerService: mockObjectiveStateCheckerService // Pass the new mock
        });
        // --- End Updated Section --- //

        // Initialize the system (subscribes to core events like quest acceptance/trigger)
        // This also subscribes to quest:started, quest:completed, quest:failed
        questSystem.initialize();

        // Spy on console logs/warnings/errors
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        // Restore console spies
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    // --- Helper function to setup quest and objectives ---
    const setupQuestAndObjectives = (questId, objectiveIds, rewards = { experience: 100 }) => {
        const objectiveDefs = objectiveIds.map(objId => ({
            id: objId,
            descriptionId: `desc_${objId}`,
            completionConditions: { allOf: [{ type: 'event_listener', eventName: `event:complete_${objId}` }] }, // Simple default condition
            eventsToFireOnCompletion: [],
            rewards: { experience: 10 } // Dummy objective reward
        }));

        const questDef = {
            id: questId,
            titleId: `title_${questId}`,
            descriptionId: `desc_${questId}`,
            objectiveIds: objectiveIds, // CRITICAL: Ensure this is set
            prerequisites: [],
            rewards: rewards
        };

        // Add definitions to mock DataManager
        mockDataManager.addQuestDefinition(questDef);
        objectiveDefs.forEach(objDef => mockDataManager.addObjectiveDefinition(objDef));

        // Ensure mock DataManager returns these specific definitions when asked
        mockDataManager.getQuestDefinition.mockImplementation((qId) => {
            if (qId === questId) return questDef;
            return mockDataManager._quests.get(qId); // Fallback
        });
        mockDataManager.getObjectiveDefinition.mockImplementation((oId) => {
            const found = objectiveDefs.find(def => def.id === oId);
            if (found) return found;
            return mockDataManager._objectives.get(oId); // Fallback
        });

        // Mock reward summary generation based on the quest definition rewards
        mockQuestRewardService.getRewardSummary.mockImplementation((qDef) => {
            if (qDef.id === questId) {
                // Simple summary based on passed rewards
                return { ...qDef.rewards };
            }
            return null;
        });

        // Activate the quest using the standard event flow
        mockEventBus.dispatch('event:quest_accepted', { questId: questId });

        // Assertions to confirm setup worked as expected
        expect(mockQuestLogComponent.getQuestStatus(questId)).toBe('active');
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('quest:started', { questId: questId, titleId: questDef.titleId });
        // Verify delegation to BOTH services happened during quest start
        expect(mockObjectiveEventListenerService.registerListenersForQuest).toHaveBeenCalledWith(questId, questDef, mockQuestLogComponent, expect.any(Function));
        expect(mockObjectiveStateCheckerService.registerChecksForQuest).toHaveBeenCalledWith(questId, questDef, mockQuestLogComponent, expect.any(Function));

        // Clear mocks *after* setup assertions to isolate test actions
        mockObjectiveEventListenerService.registerListenersForQuest.mockClear();
        mockObjectiveStateCheckerService.registerChecksForQuest.mockClear();
        mockEventBus.dispatch.mockClear(); // Clear dispatch calls from setup
        mockQuestPrerequisiteService.check.mockClear();

        // Return definitions for potential use in tests
        return { questDef, objectiveDefs };
    };

    // --- Test Scenarios ---

    it('Single Objective Quest: Completes quest immediately when objective is processed', () => {
        const QUEST_ID = 'quest_single';
        const OBJECTIVE_ID = 'obj_single_1';
        const REWARDS = { experience: 50, items: [{ itemId: 'gem', quantity: 1 }] };
        const { questDef } = setupQuestAndObjectives(QUEST_ID, [OBJECTIVE_ID], REWARDS);
        const expectedRewardSummary = { ...REWARDS };

        // --- Act ---
        // Simulate the service calling the callback for the completed objective
        questSystem._processObjectiveCompletion(QUEST_ID, OBJECTIVE_ID);

        // --- Assert ---
        // 1. Objective marked complete in log
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID)).toBe(true);

        // 2. Objective-specific cleanup delegated to BOTH services
        expect(mockObjectiveEventListenerService.unregisterListenersForObjective).toHaveBeenCalledTimes(1);
        expect(mockObjectiveEventListenerService.unregisterListenersForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID);
        expect(mockObjectiveStateCheckerService.unregisterChecksForObjective).toHaveBeenCalledTimes(1);
        expect(mockObjectiveStateCheckerService.unregisterChecksForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID);

        // 3. Quest Completion Check leads to completeQuest:
        //    - Reward Granting Delegated
        expect(mockQuestRewardService.grant).toHaveBeenCalledTimes(1);
        expect(mockQuestRewardService.grant).toHaveBeenCalledWith(questDef, mockPlayerEntity);
        //    - Reward Summary Retrieved
        expect(mockQuestRewardService.getRewardSummary).toHaveBeenCalledTimes(1);
        expect(mockQuestRewardService.getRewardSummary).toHaveBeenCalledWith(questDef);
        //    - `quest:completed` Event Dispatched
        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('quest:completed', {
            questId: QUEST_ID,
            titleId: questDef.titleId,
            rewardSummary: expectedRewardSummary
        });
        //    - Quest status updated in log
        expect(mockQuestLogComponent.getQuestStatus(QUEST_ID)).toBe('completed');

        // 4. Full Quest Cleanup Delegated (triggered by quest:completed event -> _handleQuestEnded)
        expect(mockObjectiveEventListenerService.unregisterAllListenersForQuest).toHaveBeenCalledTimes(1);
        expect(mockObjectiveEventListenerService.unregisterAllListenersForQuest).toHaveBeenCalledWith(QUEST_ID);
        expect(mockObjectiveStateCheckerService.unregisterAllChecksForQuest).toHaveBeenCalledTimes(1);
        expect(mockObjectiveStateCheckerService.unregisterAllChecksForQuest).toHaveBeenCalledWith(QUEST_ID);
    });

    it('Multi-Objective Quest (Partial Completion): Does NOT complete quest when first objective is processed', () => {
        const QUEST_ID = 'quest_multi_partial';
        const OBJECTIVE_ID_1 = 'obj_multi_1';
        const OBJECTIVE_ID_2 = 'obj_multi_2';
        const { questDef } = setupQuestAndObjectives(QUEST_ID, [OBJECTIVE_ID_1, OBJECTIVE_ID_2]);

        // --- Act ---
        // Simulate completion of the FIRST objective only
        questSystem._processObjectiveCompletion(QUEST_ID, OBJECTIVE_ID_1);

        // --- Assert ---
        // 1. First objective marked complete, second is not
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID_1)).toBe(true);
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID_2)).toBe(false);

        // 2. Objective-specific cleanup delegated for the completed objective (Obj 1)
        expect(mockObjectiveEventListenerService.unregisterListenersForObjective).toHaveBeenCalledTimes(1);
        expect(mockObjectiveEventListenerService.unregisterListenersForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID_1);
        expect(mockObjectiveStateCheckerService.unregisterChecksForObjective).toHaveBeenCalledTimes(1);
        expect(mockObjectiveStateCheckerService.unregisterChecksForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID_1);
        // Ensure cleanup was NOT called for the incomplete objective (Obj 2)
        expect(mockObjectiveEventListenerService.unregisterListenersForObjective).not.toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID_2);
        expect(mockObjectiveStateCheckerService.unregisterChecksForObjective).not.toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID_2);


        // 3. Quest NOT completed
        expect(mockQuestRewardService.grant).not.toHaveBeenCalled();
        expect(mockQuestRewardService.getRewardSummary).not.toHaveBeenCalled();
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('quest:completed', expect.anything()); // Check specific event didn't fire
        expect(mockQuestLogComponent.getQuestStatus(QUEST_ID)).toBe('active'); // Status remains active

        // 4. Full Quest Cleanup NOT Delegated
        expect(mockObjectiveEventListenerService.unregisterAllListenersForQuest).not.toHaveBeenCalled();
        expect(mockObjectiveStateCheckerService.unregisterAllChecksForQuest).not.toHaveBeenCalled();
    });

    it('Multi-Objective Quest (Final Completion): Completes quest when the LAST objective is processed', () => {
        const QUEST_ID = 'quest_multi_final';
        const OBJECTIVE_ID_1 = 'obj_multi_final_1';
        const OBJECTIVE_ID_2 = 'obj_multi_final_2';
        const REWARDS = { currency: { gold: 100 } };
        const { questDef } = setupQuestAndObjectives(QUEST_ID, [OBJECTIVE_ID_1, OBJECTIVE_ID_2], REWARDS);
        const expectedRewardSummary = { ...REWARDS };

        // --- Act 1: Complete the first objective ---
        questSystem._processObjectiveCompletion(QUEST_ID, OBJECTIVE_ID_1);

        // --- Assertions (Partial Completion - as sanity check) ---
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID_1)).toBe(true);
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID_2)).toBe(false);
        expect(mockQuestRewardService.grant).not.toHaveBeenCalled();
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('quest:completed', expect.anything());
        // Clear mocks related to the first completion to isolate assertions for the second
        mockObjectiveEventListenerService.unregisterListenersForObjective.mockClear();
        mockObjectiveStateCheckerService.unregisterChecksForObjective.mockClear();
        mockEventBus.dispatch.mockClear(); // Clear any unrelated dispatches if necessary


        // --- Act 2: Complete the second (final) objective ---
        questSystem._processObjectiveCompletion(QUEST_ID, OBJECTIVE_ID_2);

        // --- Assert (Final Completion) ---
        // 1. Both objectives marked complete
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID_1)).toBe(true);
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID_2)).toBe(true);

        // 2. Objective-specific cleanup delegated for the SECOND objective
        expect(mockObjectiveEventListenerService.unregisterListenersForObjective).toHaveBeenCalledTimes(1);
        expect(mockObjectiveEventListenerService.unregisterListenersForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID_2);
        expect(mockObjectiveStateCheckerService.unregisterChecksForObjective).toHaveBeenCalledTimes(1);
        expect(mockObjectiveStateCheckerService.unregisterChecksForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID_2);

        // 3. Quest Completion Check leads to completeQuest:
        //    - Reward Granting Delegated
        expect(mockQuestRewardService.grant).toHaveBeenCalledTimes(1); // Called ONCE now
        expect(mockQuestRewardService.grant).toHaveBeenCalledWith(questDef, mockPlayerEntity);
        //    - Reward Summary Retrieved
        expect(mockQuestRewardService.getRewardSummary).toHaveBeenCalledTimes(1); // Called ONCE now
        expect(mockQuestRewardService.getRewardSummary).toHaveBeenCalledWith(questDef);
        //    - `quest:completed` Event Dispatched
        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1); // Called ONCE now
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('quest:completed', {
            questId: QUEST_ID,
            titleId: questDef.titleId,
            rewardSummary: expectedRewardSummary
        });
        //    - Quest status updated in log
        expect(mockQuestLogComponent.getQuestStatus(QUEST_ID)).toBe('completed');

        // 4. Full Quest Cleanup Delegated (triggered by quest:completed event -> _handleQuestEnded)
        expect(mockObjectiveEventListenerService.unregisterAllListenersForQuest).toHaveBeenCalledTimes(1);
        expect(mockObjectiveEventListenerService.unregisterAllListenersForQuest).toHaveBeenCalledWith(QUEST_ID);
        expect(mockObjectiveStateCheckerService.unregisterAllChecksForQuest).toHaveBeenCalledTimes(1);
        expect(mockObjectiveStateCheckerService.unregisterAllChecksForQuest).toHaveBeenCalledWith(QUEST_ID);
    });

    // --- Verify Existing Test Case Logic Alignment ---
    // Reviewing Test Case 1 and Test Case 4 (from original file) against new requirements

    it('Test Case 1 (Original Logic Check): Single objective quest completes via _processObjectiveCompletion', () => {
        // This test is essentially the same as the 'Single Objective Quest' test above.
        // We re-run it here to explicitly confirm the original Test Case 1 expectation holds
        // with the automatic completion check.
        const QUEST_ID = 'quest:match'; // Using original IDs for clarity
        const OBJECTIVE_ID = 'obj:match_filter';
        const { questDef } = setupQuestAndObjectives(QUEST_ID, [OBJECTIVE_ID]); // Default rewards
        const expectedRewardSummary = { experience: 100 }; // Default from helper

        questSystem._processObjectiveCompletion(QUEST_ID, OBJECTIVE_ID);

        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID)).toBe(true);
        expect(mockQuestRewardService.grant).toHaveBeenCalledTimes(1);
        expect(mockQuestRewardService.grant).toHaveBeenCalledWith(questDef, mockPlayerEntity);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('quest:completed', {
            questId: QUEST_ID,
            titleId: questDef.titleId,
            rewardSummary: expectedRewardSummary
        });
        expect(mockObjectiveEventListenerService.unregisterAllListenersForQuest).toHaveBeenCalledWith(QUEST_ID);
        expect(mockObjectiveStateCheckerService.unregisterAllChecksForQuest).toHaveBeenCalledWith(QUEST_ID);
        // Check specific objective cleanup too
        expect(mockObjectiveEventListenerService.unregisterListenersForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID);
        expect(mockObjectiveStateCheckerService.unregisterChecksForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID);
    });

    it('Test Case 4 (Original Logic Check): Multi-objective quest requires all objectives processed for completion', () => {
        // This test combines the partial and final completion scenarios into one flow,
        // explicitly confirming the original Test Case 4 expectation.
        const QUEST_ID = 'quest:multi'; // Using original IDs
        const OBJECTIVE_ID_A = 'obj:multi_A';
        const OBJECTIVE_ID_B = 'obj:multi_B';
        const REWARDS = { currency: { gold: 50 } };
        const { questDef } = setupQuestAndObjectives(QUEST_ID, [OBJECTIVE_ID_A, OBJECTIVE_ID_B], REWARDS);
        const expectedRewardSummary = { ...REWARDS };

        // Process First Objective
        questSystem._processObjectiveCompletion(QUEST_ID, OBJECTIVE_ID_A);
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID_A)).toBe(true);
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID_B)).toBe(false);
        expect(mockQuestRewardService.grant).not.toHaveBeenCalled(); // Not completed yet
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('quest:completed', expect.anything());
        expect(mockObjectiveEventListenerService.unregisterListenersForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID_A); // Cleanup for A
        expect(mockObjectiveStateCheckerService.unregisterChecksForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID_A); // Cleanup for A
        expect(mockObjectiveEventListenerService.unregisterAllListenersForQuest).not.toHaveBeenCalled(); // No full cleanup yet
        expect(mockObjectiveStateCheckerService.unregisterAllChecksForQuest).not.toHaveBeenCalled(); // No full cleanup yet

        // Clear mocks before next step
        mockObjectiveEventListenerService.unregisterListenersForObjective.mockClear();
        mockObjectiveStateCheckerService.unregisterChecksForObjective.mockClear();

        // Process Second (Final) Objective
        questSystem._processObjectiveCompletion(QUEST_ID, OBJECTIVE_ID_B);
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID_A)).toBe(true); // Stays complete
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID_B)).toBe(true); // Now complete
        expect(mockQuestRewardService.grant).toHaveBeenCalledTimes(1); // Completed NOW
        expect(mockQuestRewardService.grant).toHaveBeenCalledWith(questDef, mockPlayerEntity);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('quest:completed', { // Completed NOW
            questId: QUEST_ID,
            titleId: questDef.titleId,
            rewardSummary: expectedRewardSummary
        });
        expect(mockObjectiveEventListenerService.unregisterListenersForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID_B); // Cleanup for B
        expect(mockObjectiveStateCheckerService.unregisterChecksForObjective).toHaveBeenCalledWith(QUEST_ID, OBJECTIVE_ID_B); // Cleanup for B
        expect(mockObjectiveEventListenerService.unregisterAllListenersForQuest).toHaveBeenCalledWith(QUEST_ID); // Full cleanup NOW
        expect(mockObjectiveStateCheckerService.unregisterAllChecksForQuest).toHaveBeenCalledWith(QUEST_ID); // Full cleanup NOW
    });

    // --- Add edge cases/safety checks if necessary ---

    it('_checkQuestCompletion safety: Does nothing if quest is not active', () => {
        const QUEST_ID = 'quest_check_inactive';
        const OBJECTIVE_ID = 'obj_check_inactive_1';
        const { questDef } = setupQuestAndObjectives(QUEST_ID, [OBJECTIVE_ID]);

        // Mark objective complete in log *manually* first (bypassing _processObjectiveCompletion)
        mockQuestLogComponent.completeObjective(QUEST_ID, OBJECTIVE_ID);
        expect(mockQuestLogComponent.isObjectiveComplete(QUEST_ID, OBJECTIVE_ID)).toBe(true);

        // Now make the quest inactive *before* the check runs
        mockQuestLogComponent.updateQuestStatus(QUEST_ID, 'failed');
        expect(mockQuestLogComponent.getQuestStatus(QUEST_ID)).toBe('failed');

        // Spy on completeQuest to ensure it's not called
        const completeQuestSpy = jest.spyOn(questSystem, 'completeQuest');
        mockEventBus.dispatch.mockClear(); // Clear dispatches before calling check

        // --- Act: Manually call the internal check method ---
        // Note: In normal flow, _checkQuestCompletion is called by _processObjectiveCompletion
        questSystem._checkQuestCompletion(QUEST_ID);

        // --- Assert ---
        expect(completeQuestSpy).not.toHaveBeenCalled();
        expect(mockQuestRewardService.grant).not.toHaveBeenCalled();
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('quest:completed', expect.anything());

        // Check the safety cleanup within _checkQuestCompletion for non-active quests
        expect(mockObjectiveEventListenerService.unregisterAllListenersForQuest).toHaveBeenCalledWith(QUEST_ID);
        expect(mockObjectiveStateCheckerService.unregisterAllChecksForQuest).toHaveBeenCalledWith(QUEST_ID);

        completeQuestSpy.mockRestore();
    });


}); // End describe block