/**
 * tests/entities/entityManager.notes.test.js
 *
 * Verify that actor creation with/without core:notes works,
 * and that Ajv validation passes in both scenarios.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import EntityManager from '../../src/entities/entityManager.js';
import {
    ACTOR_COMPONENT_ID,
    NOTES_COMPONENT_ID,
} from '../../src/constants/componentIds.js';
import {beforeEach, describe, expect, jest, test} from "@jest/globals";

// -----------------------------
// Inlined core:notes schema (from the ticket):
// -----------------------------
const coreNotesSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'core:notes',
    title: 'Core Notes',
    description:
        "Schema for the core:notes component. An object with a single 'notes' array, where each note has exactly two fields: 'text' (non-empty string) and 'timestamp' (ISO 8601 date-time). No extra properties are allowed at any level.",
    type: 'object',
    properties: {
        notes: {
            type: 'array',
            minItems: 0,
            items: {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        minLength: 1,
                        description: 'The note content; must be a non-empty string.',
                    },
                    timestamp: {
                        type: 'string',
                        format: 'date-time',
                        description:
                            'ISO 8601 date-time string representing when the note was created.',
                    },
                },
                required: ['text', 'timestamp'],
                additionalProperties: false,
            },
        },
    },
    required: ['notes'],
    additionalProperties: false,
};

// -----------------------------
// Build an Ajv validator for core:notes
// -----------------------------
const ajv = new Ajv({allErrors: true});
addFormats(ajv);
const validateCoreNotes = ajv.compile(coreNotesSchema);

describe('EntityManager - core:notes injection', () => {
    let registryMock;
    let validatorMock;
    let loggerMock;
    let spatialIndexMock;
    let entityManager;

    beforeEach(() => {
        // A no-op IDataRegistry mock whose getEntityDefinition will be set per-test
        registryMock = {
            getEntityDefinition: jest.fn(),
        };

        // Stubbed ISchemaValidator:
        validatorMock = {
            validate: jest.fn((componentTypeId, data) => {
                if (componentTypeId === NOTES_COMPONENT_ID) {
                    const isValid = validateCoreNotes(data);
                    return {
                        isValid,
                        errors: isValid ? null : validateCoreNotes.errors,
                    };
                }
                // All other components are assumed valid
                return {isValid: true, errors: null};
            }),
        };

        // A minimal ILogger that captures calls but does nothing
        loggerMock = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };

        // A dummy ISpatialIndexManager: methods are no-ops
        spatialIndexMock = {
            addEntity: jest.fn(),
            removeEntity: jest.fn(),
            updateEntityLocation: jest.fn(),
            getEntitiesInLocation: jest.fn().mockReturnValue([]),
            clearIndex: jest.fn(),
        };

        entityManager = new EntityManager(
            registryMock,
            validatorMock,
            loggerMock,
            spatialIndexMock
        );
    });

    test('Creating an actor WITH explicit valid core:notes preserves those notes', () => {
        const definitionId = 'test:heroWithNotes';
        // Provide a valid "notes" array according to schema
        const explicitNotes = [
            {
                text: 'First test note',
                timestamp: '2025-06-01T12:00:00.000Z',
            },
            {
                text: 'Second test note',
                timestamp: '2025-06-02T08:30:00.000Z',
            },
        ];

        const actorDefinition = {
            definitionId,
            components: {
                [ACTOR_COMPONENT_ID]: { /* actor-specific data */},
                [NOTES_COMPONENT_ID]: {notes: explicitNotes},
            },
        };

        registryMock.getEntityDefinition.mockReturnValue(actorDefinition);

        const created = entityManager.createEntityInstance(definitionId);

        // The registry should have been called once
        expect(registryMock.getEntityDefinition).toHaveBeenCalledWith(definitionId);
        expect(created).not.toBeNull();

        // Ensure validator.validate was called for the explicit notes
        expect(validatorMock.validate).toHaveBeenCalledWith(
            NOTES_COMPONENT_ID,
            {notes: explicitNotes}
        );
        expect(loggerMock.error).not.toHaveBeenCalled();

        // Confirm that the entity actually carries the same notes
        const storedNotes = created.getComponentData(NOTES_COMPONENT_ID);
        expect(storedNotes).toBeDefined();
        expect(storedNotes.notes).toEqual(explicitNotes);
    });

    test('Creating an actor WITHOUT core:notes injects { notes: [] } and passes Ajv', () => {
        const definitionId = 'test:heroWithoutNotes';

        const actorDefinition = {
            definitionId,
            components: {
                [ACTOR_COMPONENT_ID]: { /* actor-specific data */},
                // no "core:notes" here
            },
        };

        registryMock.getEntityDefinition.mockReturnValue(actorDefinition);

        const created = entityManager.createEntityInstance(definitionId);

        expect(registryMock.getEntityDefinition).toHaveBeenCalledWith(definitionId);
        expect(created).not.toBeNull();

        // Validator should have been called for the injected default notes
        expect(validatorMock.validate).toHaveBeenCalledWith(
            NOTES_COMPONENT_ID,
            {notes: []}
        );
        expect(loggerMock.error).not.toHaveBeenCalled();

        // The entity should have a "core:notes" component with an empty array
        const storedNotes = created.getComponentData(NOTES_COMPONENT_ID);
        expect(storedNotes).toBeDefined();
        expect(storedNotes).toEqual({notes: []});
    });

    test('Creating a non-actor entity absolutely does NOT inject core:notes', () => {
        const definitionId = 'test:nonActor';

        const nonActorDefinition = {
            definitionId,
            components: {
                // No core:actor, so we should not inject anything
                'core:name': {value: 'JustAnItem'},
            },
        };

        registryMock.getEntityDefinition.mockReturnValue(nonActorDefinition);

        const created = entityManager.createEntityInstance(definitionId);
        expect(created).not.toBeNull();

        // We should never call validator.validate for NOTES_COMPONENT_ID here
        const callsForNotes = validatorMock.validate.mock.calls.filter(
            ([componentTypeId]) => componentTypeId === NOTES_COMPONENT_ID
        );
        expect(callsForNotes).toHaveLength(0);

        // And the entity simply should not have a notes component
        expect(created.hasComponent(NOTES_COMPONENT_ID)).toBe(false);
    });
});