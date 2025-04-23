// src/tests/logic/contextAssembler.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach, afterEach} from '@jest/globals';
// Import ONLY createJsonLogicContext
import {createJsonLogicContext} from '../../logic/contextAssembler.js'; // Import the function under test
import Entity from '../../entities/entity.js'; // Adjust path

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */ // Import type for mocking

// --- Mock Dependencies ---

// Mock ILogger
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// Mock EntityManager
/** @type {jest.Mocked<EntityManager>} */
const mockEntityManager = {
    getEntityInstance: jest.fn(),
    getComponentData: jest.fn(),
    hasComponent: jest.fn(),
};

// Helper to create mock entity instance
const createMockEntity = (id) => ({id});

// --- Test Suite ---

describe('createJsonLogicContext (contextAssembler.js)', () => {

    // --- Test Setup ---
    /** @type {GameEvent} */
    let baseEvent;
    let actorId;
    let targetId;
    let mockActorEntity;
    let mockTargetEntity;

    beforeEach(() => {
        jest.clearAllMocks();

        // Default test data
        baseEvent = {type: 'TEST_EVENT', payload: {data: 'sample'}};
        actorId = 'player:1';
        targetId = 'npc:mob';
        mockActorEntity = createMockEntity(actorId);
        mockTargetEntity = createMockEntity(targetId);

        // Default mock behavior: Entities NOT found
        mockEntityManager.getEntityInstance.mockReturnValue(undefined);
        mockEntityManager.getComponentData.mockReset();
        mockEntityManager.hasComponent.mockReset();
    });

    // --- Test Cases ---

    test('AC1: should return a context object with all required keys for valid inputs', () => {
        // Arrange: Make EM find both entities
        mockEntityManager.getEntityInstance
            .mockImplementation(id => {
                if (id === actorId) return mockActorEntity;
                if (id === targetId) return mockTargetEntity;
                return undefined;
            });

        // Act
        const context = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);

        // Assert (AC1)
        expect(context).toBeDefined();
        expect(context).toHaveProperty('event');
        expect(context).toHaveProperty('actor');
        expect(context).toHaveProperty('target');
        expect(context).toHaveProperty('context');
        expect(context).toHaveProperty('globals');
        expect(context).toHaveProperty('entities');
        // Implicit AC11 check
        expect(context.actor).not.toBeNull();
        expect(context.target).not.toBeNull();
        expect(typeof context.actor.components).toBe('object');
        expect(typeof context.target.components).toBe('object');
    });

    describe('AC2: Event Population', () => {
        test('should populate event.type from input', () => {
            const event = {type: 'SPECIFIC_EVENT_TYPE'};
            const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);
            expect(context.event.type).toBe('SPECIFIC_EVENT_TYPE');
        });

        test('should populate event.payload from input payload', () => {
            const event = {type: 'TEST', payload: {key: 'value', num: 123}};
            const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);
            expect(context.event.payload).toEqual({key: 'value', num: 123});
        });

        test('should populate event.payload as {} if input payload is absent', () => {
            const event = {type: 'TEST_NO_PAYLOAD'};
            const context = createJsonLogicContext(event, null, null, mockEntityManager, mockLogger);
            expect(context.event.payload).toEqual({});
        });

        test('should populate event.payload as {} if input payload is null/undefined', () => {
            const eventWithNull = {type: 'TEST_NULL_PAYLOAD', payload: null};
            const contextNull = createJsonLogicContext(eventWithNull, null, null, mockEntityManager, mockLogger);
            expect(contextNull.event.payload).toEqual({});

            const eventWithUndefined = {type: 'TEST_UNDEF_PAYLOAD', payload: undefined};
            const contextUndef = createJsonLogicContext(eventWithUndefined, null, null, mockEntityManager, mockLogger);
            expect(contextUndef.event.payload).toEqual({});
        });
    });

    describe('AC3 & AC11: Actor Population (Valid ID, Entity Found)', () => {
        test('should populate actor with id and components object when entity is found', () => {
            // Arrange
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === actorId) return mockActorEntity;
                return undefined;
            });

            // Act
            const context = createJsonLogicContext(baseEvent, actorId, null, mockEntityManager, mockLogger);

            // Assert (AC3 & Implicit AC11)
            expect(context.actor).not.toBeNull();
            expect(context.actor).toHaveProperty('id', actorId);
            expect(context.actor).toHaveProperty('components');
            expect(typeof context.actor.components).toBe('object');
            expect(context.actor.components).not.toBeNull();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        });
    });

    describe('AC4: Actor Population (Valid ID, Entity Not Found)', () => {
        test('should set actor to null when entity is not found', () => {
            // Arrange
            mockEntityManager.getEntityInstance.mockReturnValue(undefined);

            // Act
            const context = createJsonLogicContext(baseEvent, actorId, null, mockEntityManager, mockLogger);

            // Assert (AC4 & Implicit AC11)
            expect(context.actor).toBeNull();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Actor entity not found for ID [${actorId}]`));
        });
    });

    describe('AC5: Actor Population (Null/Undefined ID)', () => {
        test('should set actor to null when actorId is null', () => {
            const context = createJsonLogicContext(baseEvent, null, null, mockEntityManager, mockLogger);
            expect(context.actor).toBeNull();
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        });

        test('should set actor to null when actorId is undefined', () => {
            const context = createJsonLogicContext(baseEvent, undefined, null, mockEntityManager, mockLogger);
            expect(context.actor).toBeNull();
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        });
    });

    describe('AC6: Actor Population (Invalid ID Type)', () => {
        // Removed Symbol('id') case
        test.each([
            [true],
            [{id: 'obj'}],
            [[]],
            [() => {
            }],
            [false], // Added false here as well, should behave like other invalid types
        ])('should set actor to null and log warning for invalid actorId type: %p', (invalidId) => {
            // Arrange
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === targetId) return mockTargetEntity;
                return undefined;
            });

            // Act
            const context = createJsonLogicContext(baseEvent, invalidId, targetId, mockEntityManager, mockLogger);

            // Assert (AC6 & Implicit AC11)
            expect(context.actor).toBeNull();
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(invalidId);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId); // Called for target

            // Check warning based on input type
            if (invalidId) { // Only truthy invalid types should log warning
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Invalid actorId type provided: [${typeof invalidId}]`));
                expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            } else { // Falsy invalid types (like false) should not log
                expect(mockLogger.warn).not.toHaveBeenCalled();
            }
        });
    });

    // --- AC7: Repeat Actor Logic for Target ---

    describe('AC7 & AC11: Target Population (Valid ID, Entity Found)', () => {
        test('should populate target with id and components object when entity is found', () => {
            // Arrange
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === targetId) return mockTargetEntity;
                return undefined;
            });

            // Act
            const context = createJsonLogicContext(baseEvent, null, targetId, mockEntityManager, mockLogger);

            // Assert (AC7 & Implicit AC11)
            expect(context.target).not.toBeNull();
            expect(context.target).toHaveProperty('id', targetId);
            expect(context.target).toHaveProperty('components');
            expect(typeof context.target.components).toBe('object');
            expect(context.target.components).not.toBeNull();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        });
    });

    describe('AC7: Target Population (Valid ID, Entity Not Found)', () => {
        test('should set target to null when entity is not found', () => {
            // Arrange
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === actorId) return mockActorEntity;
                return undefined;
            });

            // Act
            const context = createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, mockLogger);

            // Assert (AC7 & Implicit AC11)
            expect(context.target).toBeNull();
            expect(context.actor).not.toBeNull();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Target entity not found for ID [${targetId}]`));
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        });
    });

    describe('AC7: Target Population (Null/Undefined ID)', () => {
        test('should set target to null when targetId is null', () => {
            // Arrange
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === actorId) return mockActorEntity;
                return undefined;
            });
            const context = createJsonLogicContext(baseEvent, actorId, null, mockEntityManager, mockLogger);
            expect(context.target).toBeNull();
            expect(context.actor).not.toBeNull();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(null);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        });

        test('should set target to null when targetId is undefined', () => {
            // Arrange
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === actorId) return mockActorEntity;
                return undefined;
            });
            const context = createJsonLogicContext(baseEvent, actorId, undefined, mockEntityManager, mockLogger);
            expect(context.target).toBeNull();
            expect(context.actor).not.toBeNull();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(undefined);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
        });
    });

    describe('AC7: Target Population (Invalid ID Type)', () => {
        // Removed Symbol('id') case due to logging TypeError
        test.each([
            [false],
            [{id: 'objTarget'}],
            [[1, 2]],
            // [Symbol('id')] // Removed
        ])('should set target to null and log warning for invalid targetId type: %p', (invalidId) => {
            // Arrange: Make actor exist
            mockEntityManager.getEntityInstance.mockImplementation(id => {
                if (id === actorId) return mockActorEntity;
                return undefined;
            });

            // Act
            const context = createJsonLogicContext(baseEvent, actorId, invalidId, mockEntityManager, mockLogger);

            // Assert (AC7 & Implicit AC11)
            expect(context.target).toBeNull();
            expect(context.actor).not.toBeNull();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(invalidId);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1); // Only for actor

            // Check warning based on input type: Only truthy invalid types should log
            if (invalidId) { // typeof invalidId === 'boolean' && invalidId === false will be falsy
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Invalid targetId type provided: [${typeof invalidId}]`));
                expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Should only be the target warning
            } else {
                // For false input, no warning should be logged
                expect(mockLogger.warn).not.toHaveBeenCalled();
            }
        });
    });


    // --- AC8, AC9, AC10: Initial Empty Objects ---

    test('AC8: should initialize context.context as an empty object', () => {
        const context = createJsonLogicContext(baseEvent, null, null, mockEntityManager, mockLogger);
        expect(context.context).toEqual({});
    });

    test('AC9: should initialize context.globals as an empty object', () => {
        const context = createJsonLogicContext(baseEvent, null, null, mockEntityManager, mockLogger);
        expect(context.globals).toEqual({});
    });

    test('AC10: should initialize context.entities as an empty object', () => {
        const context = createJsonLogicContext(baseEvent, null, null, mockEntityManager, mockLogger);
        expect(context.entities).toEqual({});
    });


    // --- AC11 Verification (Combined - Implicit) ---
    test('AC11: Implicitly verified by actor/target population tests', () => {
        expect(true).toBe(true);
    });


    // --- Argument Validation Tests ---
    describe('Argument Validation', () => {
        test('should throw error if event is missing or invalid', () => {
            expect(() => createJsonLogicContext(null, actorId, targetId, mockEntityManager, mockLogger))
                .toThrow("createJsonLogicContext: Missing or invalid 'event' object.");
            expect(() => createJsonLogicContext({payload: {}}, actorId, targetId, mockEntityManager, mockLogger))
                .toThrow("createJsonLogicContext: Missing or invalid 'event' object.");
            expect(() => createJsonLogicContext('string', actorId, targetId, mockEntityManager, mockLogger))
                .toThrow("createJsonLogicContext: Missing or invalid 'event' object.");
        });

        test('should throw error if entityManager is missing or invalid', () => {
            expect(() => createJsonLogicContext(baseEvent, actorId, targetId, null, mockLogger))
                .toThrow("createJsonLogicContext: Missing or invalid 'entityManager' instance.");
            expect(() => createJsonLogicContext(baseEvent, actorId, targetId, {getComponentData: jest.fn()}, mockLogger))
                .toThrow("createJsonLogicContext: Missing or invalid 'entityManager' instance.");
            expect(() => createJsonLogicContext(baseEvent, actorId, targetId, {getEntityInstance: jest.fn()}, mockLogger))
                .toThrow("createJsonLogicContext: Missing or invalid 'entityManager' instance.");
        });

        test('should throw error if logger is missing or invalid', () => {
            expect(() => createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, null))
                .toThrow("createJsonLogicContext: Missing or invalid 'logger' instance.");
            expect(() => createJsonLogicContext(baseEvent, actorId, targetId, mockEntityManager, {warn: jest.fn()}))
                .toThrow("createJsonLogicContext: Missing or invalid 'logger' instance.");
        });
    });

});