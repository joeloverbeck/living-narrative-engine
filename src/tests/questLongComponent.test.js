// questLogComponent.test.js
import {describe, it, expect, beforeEach} from '@jest/globals';
import {QuestLogComponent} from '../components/questLogComponent.js'; // Adjust path if needed

describe('QuestLogComponent', () => {
    let questLog;
    const questId1 = 'test:quest_01';
    const questId2 = 'test:quest_02';
    const objectiveId1a = 'test:obj_01a';
    const objectiveId1b = 'test:obj_01b';

    beforeEach(() => {
        questLog = new QuestLogComponent();
    });

    it('should initialize with an empty quest map', () => {
        expect(questLog.quests).toBeInstanceOf(Map);
        expect(questLog.quests.size).toBe(0);
    });

    // --- startQuest ---
    describe('startQuest', () => {
        it('should start a new quest with active status and empty objectives', () => {
            const result = questLog.startQuest(questId1);
            expect(result).toBe(true);
            expect(questLog.quests.has(questId1)).toBe(true);
            const progress = questLog.quests.get(questId1);
            expect(progress.status).toBe('active');
            expect(progress.completedObjectives).toBeInstanceOf(Set);
            expect(progress.completedObjectives.size).toBe(0);
        });

        it('should not start a quest if it already exists', () => {
            questLog.startQuest(questId1);
            const result = questLog.startQuest(questId1);
            expect(result).toBe(false);
            expect(questLog.quests.size).toBe(1); // Should not add duplicates
        });

        it('should return false for invalid questId', () => {
            expect(questLog.startQuest('')).toBe(false);
            expect(questLog.startQuest(null)).toBe(false);
            expect(questLog.startQuest(undefined)).toBe(false);
            expect(questLog.startQuest('   ')).toBe(false);
            expect(questLog.quests.size).toBe(0);
        });
    });

    // --- getQuestStatus ---
    describe('getQuestStatus', () => {
        beforeEach(() => {
            questLog.startQuest(questId1); // Active
            questLog.startQuest(questId2);
            questLog.updateQuestStatus(questId2, 'completed'); // Completed
        });

        it('should return the correct status for a tracked quest', () => {
            expect(questLog.getQuestStatus(questId1)).toBe('active');
            expect(questLog.getQuestStatus(questId2)).toBe('completed');
        });

        it('should return undefined for an unknown quest', () => {
            expect(questLog.getQuestStatus('unknown:quest')).toBeUndefined();
        });
    });

    // --- getCompletedObjectives ---
    describe('getCompletedObjectives', () => {
        beforeEach(() => {
            questLog.startQuest(questId1);
            questLog.completeObjective(questId1, objectiveId1a);
            questLog.startQuest(questId2);
            questLog.updateQuestStatus(questId2, 'failed'); // Failed quest still has history
        });

        it('should return a copy of the set of completed objectives for a tracked quest', () => {
            const objectives = questLog.getCompletedObjectives(questId1);
            expect(objectives).toBeInstanceOf(Set);
            expect(objectives.size).toBe(1);
            expect(objectives.has(objectiveId1a)).toBe(true);

            // Verify it's a copy
            objectives.add('external_mod');
            expect(questLog.quests.get(questId1).completedObjectives.has('external_mod')).toBe(false);

            const objectivesQ2 = questLog.getCompletedObjectives(questId2);
            expect(objectivesQ2).toBeInstanceOf(Set);
            expect(objectivesQ2.size).toBe(0);
        });

        it('should return undefined for an unknown quest', () => {
            expect(questLog.getCompletedObjectives('unknown:quest')).toBeUndefined();
        });
    });

    // --- isObjectiveComplete ---
    describe('isObjectiveComplete', () => {
        beforeEach(() => {
            questLog.startQuest(questId1);
            questLog.completeObjective(questId1, objectiveId1a);
        });

        it('should return true if the objective is completed', () => {
            expect(questLog.isObjectiveComplete(questId1, objectiveId1a)).toBe(true);
        });

        it('should return false if the objective is not completed', () => {
            expect(questLog.isObjectiveComplete(questId1, objectiveId1b)).toBe(false);
        });

        it('should return false if the quest is not tracked', () => {
            expect(questLog.isObjectiveComplete('unknown:quest', objectiveId1a)).toBe(false);
        });

        it('should return false for invalid objectiveId', () => {
            expect(questLog.isObjectiveComplete(questId1, '')).toBe(false);
            expect(questLog.isObjectiveComplete(questId1, null)).toBe(false);
        });
    });

    // --- updateQuestStatus ---
    describe('updateQuestStatus', () => {
        beforeEach(() => {
            questLog.startQuest(questId1);
            questLog.completeObjective(questId1, objectiveId1a); // Add objective history
        });

        it('should update the status of an existing quest', () => {
            const result = questLog.updateQuestStatus(questId1, 'completed');
            expect(result).toBe(true);
            expect(questLog.getQuestStatus(questId1)).toBe('completed');
        });

        it('should not clear completed objectives when status changes', () => {
            questLog.updateQuestStatus(questId1, 'failed');
            const objectives = questLog.getCompletedObjectives(questId1);
            expect(objectives.has(objectiveId1a)).toBe(true);
            expect(questLog.quests.get(questId1).completedObjectives.has(objectiveId1a)).toBe(true);
        });

        it('should throw an error for an invalid status', () => {
            expect(() => questLog.updateQuestStatus(questId1, 'invalid_status')).toThrow(/Invalid status/);
        });

        it('should throw an error if the quest is not found', () => {
            expect(() => questLog.updateQuestStatus('unknown:quest', 'completed')).toThrow(/Quest "unknown:quest" not found/);
        });

        it('should do nothing and return true if status is already set', () => {
            const result = questLog.updateQuestStatus(questId1, 'active'); // Already active
            expect(result).toBe(true);
            expect(questLog.getQuestStatus(questId1)).toBe('active');
        });
    });

    // --- completeObjective ---
    describe('completeObjective', () => {
        beforeEach(() => {
            questLog.startQuest(questId1);
            questLog.startQuest(questId2);
            questLog.updateQuestStatus(questId2, 'completed'); // Make inactive
        });

        it('should add the objective to the set for an active quest', () => {
            const result = questLog.completeObjective(questId1, objectiveId1a);
            expect(result).toBe(true);
            const objectives = questLog.getCompletedObjectives(questId1);
            expect(objectives.has(objectiveId1a)).toBe(true);
        });

        it('should return false if the objective was already complete', () => {
            questLog.completeObjective(questId1, objectiveId1a);
            const result = questLog.completeObjective(questId1, objectiveId1a);
            expect(result).toBe(false);
            expect(questLog.getCompletedObjectives(questId1).size).toBe(1); // No duplicates
        });

        it('should throw an error if the quest is not found', () => {
            expect(() => questLog.completeObjective('unknown:quest', objectiveId1a)).toThrow(/Quest "unknown:quest" not found/);
        });

        it('should throw an error if the quest is not active', () => {
            expect(() => questLog.completeObjective(questId2, objectiveId1a)).toThrow(/status is "completed".*must be "active"/);
        });

        it('should throw an error for invalid objectiveId', () => {
            expect(() => questLog.completeObjective(questId1, '')).toThrow(/Invalid objectiveId/);
            expect(() => questLog.completeObjective(questId1, null)).toThrow(/Invalid objectiveId/);
            expect(() => questLog.completeObjective(questId1, '   ')).toThrow(/Invalid objectiveId/);
        });
    });

    // --- getAllQuestIds ---
    describe('getAllQuestIds', () => {
        it('should return an array of all tracked quest IDs', () => {
            questLog.startQuest(questId1);
            questLog.startQuest(questId2);
            const ids = questLog.getAllQuestIds();
            expect(ids).toBeInstanceOf(Array);
            expect(ids).toHaveLength(2);
            expect(ids).toContain(questId1);
            expect(ids).toContain(questId2);
        });

        it('should return an empty array if no quests are tracked', () => {
            const ids = questLog.getAllQuestIds();
            expect(ids).toEqual([]);
        });
    });

    // --- Serialization ---
    describe('Serialization', () => {
        let stateToLoad;

        beforeEach(() => {
            questLog.startQuest(questId1);
            questLog.completeObjective(questId1, objectiveId1a);
            questLog.completeObjective(questId1, objectiveId1b);
            questLog.updateQuestStatus(questId1, 'completed');

            questLog.startQuest(questId2); // Active, no objectives completed

            stateToLoad = {
                'load:quest_A': {status: 'active', completedObjectives: ['load:obj_A1']},
                'load:quest_B': {status: 'failed', completedObjectives: []},
            };
        });

        // --- getSerializableState ---
        it('should return a plain object representation with Sets converted to Arrays', () => {
            const state = questLog.getSerializableState();
            expect(state).not.toBeInstanceOf(Map);
            expect(state[questId1]).toBeDefined();
            expect(state[questId1].status).toBe('completed');
            expect(state[questId1].completedObjectives).toBeInstanceOf(Array);
            expect(state[questId1].completedObjectives).toHaveLength(2);
            expect(state[questId1].completedObjectives).toContain(objectiveId1a);
            expect(state[questId1].completedObjectives).toContain(objectiveId1b);

            expect(state[questId2]).toBeDefined();
            expect(state[questId2].status).toBe('active');
            expect(state[questId2].completedObjectives).toEqual([]);
        });

        // --- loadFromSerializableState ---
        it('should clear existing state and load from a plain object representation', () => {
            questLog.loadFromSerializableState(stateToLoad);

            expect(questLog.quests.size).toBe(2);
            expect(questLog.getQuestStatus(questId1)).toBeUndefined(); // Old quest gone
            expect(questLog.getQuestStatus(questId2)).toBeUndefined(); // Old quest gone

            expect(questLog.getQuestStatus('load:quest_A')).toBe('active');
            const objectivesA = questLog.getCompletedObjectives('load:quest_A');
            expect(objectivesA.size).toBe(1);
            expect(objectivesA.has('load:obj_A1')).toBe(true);
            // Check internal structure restored correctly
            expect(questLog.quests.get('load:quest_A').completedObjectives).toBeInstanceOf(Set);


            expect(questLog.getQuestStatus('load:quest_B')).toBe('failed');
            expect(questLog.getCompletedObjectives('load:quest_B').size).toBe(0);
            expect(questLog.quests.get('load:quest_B').completedObjectives).toBeInstanceOf(Set);
        });

        it('should handle empty or invalid state object during load', () => {
            questLog.loadFromSerializableState(null);
            expect(questLog.quests.size).toBe(0); // Cleared, but nothing loaded

            questLog.loadFromSerializableState({});
            expect(questLog.quests.size).toBe(0);

            // Invalid entry should be skipped
            questLog.loadFromSerializableState({'bad:quest': {status: 'invalid', completedObjectives: []}});
            expect(questLog.quests.size).toBe(0);
            questLog.loadFromSerializableState({'bad:quest2': {status: 'active', completedObjectives: 'not-an-array'}});
            expect(questLog.quests.size).toBe(0);

        });
    });


});