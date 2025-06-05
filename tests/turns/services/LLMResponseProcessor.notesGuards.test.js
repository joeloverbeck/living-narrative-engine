// tests/LLMResponseProcessor.test.js

import {LLMResponseProcessor} from '../../../src/turns/services/LLMResponseProcessor.js';
import {beforeEach, describe, expect, jest, test} from "@jest/globals";

// --- Mocks & Helpers ---

/**
 * Simple in-memory “entity” that mimics the minimal shape of an IEntityManager-backed entity.
 */
function createFakeActorEntity(id) {
    return {
        id,
        components: {},

        // getComponentData is used by persistThoughts (not by notes). But define it for completeness.
        getComponentData(componentId) {
            return this.components[componentId] || null;
        },

        // addComponent is used by _mergeNotesIntoEntity to create a new notes component.
        addComponent(componentId, data) {
            this.components[componentId] = data;
        },
    };
}

describe('LLMResponseProcessor - merge notes logic', () => {
    let schemaValidatorMock;
    let entityManagerMock;
    let loggerMock;
    let processor;

    beforeEach(() => {
        // A fake schema validator that always “passes” for our tests
        schemaValidatorMock = {
            isSchemaLoaded: jest.fn().mockReturnValue(true),
            validate: jest.fn().mockReturnValue({isValid: true, errors: []}),
        };

        // Fake entity manager with spies
        entityManagerMock = {
            getEntityInstance: jest.fn(),
            addComponent: jest.fn((entityId, compId, data) => {
                // we’ll call actorEntity.addComponent manually from the entity
            }),
            saveEntity: jest.fn().mockResolvedValue(undefined),
        };

        // Fake logger with jest.fn() methods
        loggerMock = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        processor = new LLMResponseProcessor({
            schemaValidator: schemaValidatorMock,
            entityManager: entityManagerMock,
        });
    });

    test('When notes is present and valid → _mergeNotesIntoEntity is called once, notes are merged, and saveEntity is awaited', async () => {
        const actorId = 'actor-123';
        const actorEntity = createFakeActorEntity(actorId);
        entityManagerMock.getEntityInstance.mockReturnValue(actorEntity);

        // Start with one existing note, to test dedup logic
        actorEntity.components['core:notes'] = {
            notes: [
                {text: 'Existing note', timestamp: '2025-06-01T12:00:00Z'},
            ],
        };

        const validJson = {
            actionDefinitionId: 'some:action',
            commandString: 'do something',
            speech: 'hello',
            thoughts: 'thinking...',
            notes: [
                {text: 'New note', timestamp: '2025-06-02T15:00:00Z'},
                // duplicate text (normalized) should be skipped
                {text: 'existing NOTE', timestamp: '2025-06-03T16:00:00Z'},
            ],
        };

        // Turn validJson into a JSON string. processResponse will parse it and validate.
        const jsonString = JSON.stringify(validJson);

        const result = await processor.processResponse(jsonString, actorId, loggerMock);

        // Assert that the action returned is correct
        expect(result).toEqual({
            actionDefinitionId: 'some:action',
            commandString: 'do something',
            speech: 'hello',
        });

        // Check that getEntityInstance was called
        expect(entityManagerMock.getEntityInstance).toHaveBeenCalledWith(actorId);

        // After merging, actorEntity.components['core:notes'].notes should contain both original and the new note
        const notesComp = actorEntity.components['core:notes'];
        expect(Array.isArray(notesComp.notes)).toBe(true);
        expect(notesComp.notes).toEqual([
            {text: 'Existing note', timestamp: '2025-06-01T12:00:00Z'},
            {text: 'New note', timestamp: '2025-06-02T15:00:00Z'},
        ]);

        // saveEntity must be called once with the updated actorEntity
        expect(entityManagerMock.saveEntity).toHaveBeenCalledTimes(1);
        expect(entityManagerMock.saveEntity).toHaveBeenCalledWith(actorEntity);

        // No errors should be logged for valid notes
        expect(loggerMock.error).not.toHaveBeenCalledWith("'notes' field is not an array; skipping merge");
    });

    test('When notes is absent → _mergeNotesIntoEntity is not invoked, and saveEntity is never called', async () => {
        const actorId = 'actor-456';
        const actorEntity = createFakeActorEntity(actorId);
        entityManagerMock.getEntityInstance.mockReturnValue(actorEntity);

        const noNotesJson = {
            actionDefinitionId: 'another:action',
            commandString: 'do something else',
            speech: '',
            thoughts: 'no notes here',
            // no "notes" key at all
        };

        const jsonString = JSON.stringify(noNotesJson);
        const result = await processor.processResponse(jsonString, actorId, loggerMock);

        // Check return action
        expect(result).toEqual({
            actionDefinitionId: 'another:action',
            commandString: 'do something else',
            speech: '',
        });

        // The entityManager should have been asked for the entity,
        // but since there's no "notes" key, saveEntity is never called
        expect(entityManagerMock.getEntityInstance).toHaveBeenCalledWith(actorId);
        expect(entityManagerMock.saveEntity).not.toHaveBeenCalled();

        // No error about "'notes' field is not an array; skipping merge"
        expect(loggerMock.error).not.toHaveBeenCalledWith("'notes' field is not an array; skipping merge");
    });

    test('When notes is not an array → _mergeNotesIntoEntity logs an error and does not call saveEntity', async () => {
        const actorId = 'actor-789';
        const actorEntity = createFakeActorEntity(actorId);
        entityManagerMock.getEntityInstance.mockReturnValue(actorEntity);

        // notes is a string (invalid)
        const invalidNotesJson = {
            actionDefinitionId: 'invalid:action',
            commandString: 'broken',
            speech: '',
            thoughts: 'thoughtless',
            notes: 'not-an-array',
        };

        const jsonString = JSON.stringify(invalidNotesJson);
        const result = await processor.processResponse(jsonString, actorId, loggerMock);

        // Return value should still be the valid action
        expect(result).toEqual({
            actionDefinitionId: 'invalid:action',
            commandString: 'broken',
            speech: '',
        });

        // Confirm the error was logged
        expect(loggerMock.error).toHaveBeenCalledWith("'notes' field is not an array; skipping merge");

        // Since merge returned early, saveEntity should not be called
        expect(entityManagerMock.saveEntity).not.toHaveBeenCalled();
    });
});