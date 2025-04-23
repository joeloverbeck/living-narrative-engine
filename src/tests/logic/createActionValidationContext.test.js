// src/tests/logic/createActionValidationContext.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach, afterEach} from '@jest/globals';

// --- Function Under Test ---
import {createActionValidationContext} from '../../logic/createActionValidationContext.js'; // Adjust path as needed

// --- Dependencies to Mock/Use ---
import Entity from '../../entities/entity.js'; // Needed to create mock entity instances
import {ActionTargetContext} from '../../models/actionTargetContext.js'; // Needed for test inputs

// --- Mocking Dependencies ---

// Mock EntityManager
// We provide a factory function to jest.mock to control the mock instance per test run
const mockEntityManager = {
    getEntityInstance: jest.fn(),
    getComponentData: jest.fn(), // Needed by createComponentAccessor
    hasComponent: jest.fn(),     // Needed by createComponentAccessor
    // Add other methods if they were potentially called, though unlikely for this function
};
// Note: We don't need a full jest.mock for EntityManager itself,
// as we'll pass our mock object directly to the function.

// Mock ILogger
const mockLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
};

// Mock createComponentAccessor (from contextAssembler.js)
// We mock the *module* containing the function
jest.mock('../../logic/contextAssembler.js', () => ({
    createComponentAccessor: jest.fn(), // Mock the specific exported function
}));
// Import the *mocked* version after jest.mock()
import {createComponentAccessor} from '../../logic/contextAssembler.js';

// --- Test Suite ---

describe('Unit Test: createActionValidationContext', () => {
    /** @type {Entity} */
    let mockActorEntity;
    /** @type {ActionTargetContext} */
    let mockTargetContext;
    /** @type {object} */
    let mockActorAccessor;
    /** @type {object} */
    let mockTargetAccessor;

    // --- Test Setup ---
    beforeEach(() => {
        // Reset mocks before each test to ensure isolation
        jest.clearAllMocks();

        // Recreate mock entities/contexts for clean state
        mockActorEntity = new Entity('actor-1');
        // Add dummy components if needed for hasComponent checks within accessor creation? Not directly tested here.
        // mockActorEntity.addComponent('core:test', { value: 1 });

        // Default target context (can be overridden in tests)
        mockTargetContext = ActionTargetContext.noTarget();

        // Default mock return values for createComponentAccessor
        mockActorAccessor = {id: 'actor-1-accessor-proxy', isProxy: true};
        mockTargetAccessor = {id: 'target-1-accessor-proxy', isProxy: true};

        // Provide default implementation for createComponentAccessor mock
        // Use mockImplementation to dynamically return different values based on entityId
        createComponentAccessor.mockImplementation((entityId, _entityManager, _logger) => {
            if (entityId === 'actor-1') {
                return mockActorAccessor;
            } else if (entityId === 'target-1') {
                return mockTargetAccessor;
            }
            // Return a generic proxy or throw if unexpected ID is requested
            return {id: `${entityId}-accessor-proxy`, isProxy: true};
        });

        // Default mock implementation for EntityManager
        mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
            // Default: return undefined (entity not found)
            return undefined;
        });
        mockEntityManager.getComponentData.mockImplementation((_entityId, _componentTypeId) => undefined);
        mockEntityManager.hasComponent.mockImplementation((_entityId, _componentTypeId) => false);
    });

    afterEach(() => {
        // Optional: Verify no unexpected error logs occurred if not testing errors
        // expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // --- Test Cases ---

    describe('AC-3.1: Basic Structure', () => {
        test('should return an object with the correct top-level keys and default values', () => {
            // Arrange
            mockActorEntity = new Entity('actor-basic');
            mockTargetContext = ActionTargetContext.noTarget();
            createComponentAccessor.mockReturnValueOnce({mocked: 'actorAccessor'}); // Need one for the actor

            // Act
            const context = createActionValidationContext(
                mockActorEntity,
                mockTargetContext,
                mockEntityManager,
                mockLogger
            );

            // Assert
            expect(context).toBeDefined();
            expect(context).toHaveProperty('actor');
            expect(context).toHaveProperty('target');
            expect(context).toHaveProperty('event');
            expect(context).toHaveProperty('context');
            expect(context).toHaveProperty('globals');
            expect(context).toHaveProperty('entities');

            expect(context.event).toBeNull();
            expect(context.context).toEqual({});
            expect(context.globals).toEqual({});
            expect(context.entities).toEqual({});

            // Actor should be populated, target null in this case
            expect(context.actor).not.toBeNull();
            expect(context.target).toBeNull();
        });
    });

    describe('AC-3.2: Actor Population', () => {
        test('should populate context.actor with ID and components from createComponentAccessor', () => {
            // Arrange: Setup already done in beforeEach

            // Act
            const context = createActionValidationContext(
                mockActorEntity,
                mockTargetContext, // No target needed for this test
                mockEntityManager,
                mockLogger
            );

            // Assert
            expect(context.actor).toBeDefined();
            expect(context.actor).not.toBeNull();
            expect(context.actor.id).toBe('actor-1');

            // Verify createComponentAccessor was called correctly for the actor
            expect(createComponentAccessor).toHaveBeenCalledTimes(1); // Only called for actor
            expect(createComponentAccessor).toHaveBeenCalledWith(
                'actor-1',
                mockEntityManager,
                mockLogger
            );

            // Verify the returned accessor was assigned
            expect(context.actor.components).toBe(mockActorAccessor);
        });
    });

    describe('Target Population', () => {
        test('AC-3.3: should populate context.target when target is Entity and Found', () => {
            // Arrange
            const targetId = 'target-1';
            const mockTargetEntity = new Entity(targetId);
            mockTargetContext = ActionTargetContext.forEntity(targetId);

            // Mock EntityManager to find the target entity
            mockEntityManager.getEntityInstance.mockImplementation((id) => {
                if (id === targetId) return mockTargetEntity;
                return undefined;
            });

            // Act
            const context = createActionValidationContext(
                mockActorEntity,
                mockTargetContext,
                mockEntityManager,
                mockLogger
            );

            // Assert
            // Verify EntityManager was called
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);

            // Verify target context structure
            expect(context.target).toBeDefined();
            expect(context.target).not.toBeNull();
            expect(context.target.id).toBe(targetId); // Should use the ID from the resolved entity

            // Verify createComponentAccessor was called for both actor and target
            expect(createComponentAccessor).toHaveBeenCalledTimes(2);
            expect(createComponentAccessor).toHaveBeenCalledWith('actor-1', mockEntityManager, mockLogger);
            expect(createComponentAccessor).toHaveBeenCalledWith(targetId, mockEntityManager, mockLogger);

            // Verify the target accessor was assigned
            expect(context.target.components).toBe(mockTargetAccessor);
        });

        test('AC-3.4: should set context.target to null when target is Entity but Not Found', () => {
            // Arrange
            const targetId = 'target-nonexistent';
            mockTargetContext = ActionTargetContext.forEntity(targetId);

            // Mock EntityManager to NOT find the target entity (default beforeEach behavior)
            mockEntityManager.getEntityInstance.mockImplementation((id) => undefined);

            // Act
            const context = createActionValidationContext(
                mockActorEntity,
                mockTargetContext,
                mockEntityManager,
                mockLogger
            );

            // Assert
            // Verify EntityManager was called
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId);

            // Verify target is null
            expect(context.target).toBeNull();

            // Verify createComponentAccessor was only called for the actor
            expect(createComponentAccessor).toHaveBeenCalledTimes(1);
            expect(createComponentAccessor).toHaveBeenCalledWith('actor-1', mockEntityManager, mockLogger);
        });

        test('AC-3.5: should set context.target to null when targetContext type is entity but entityId is missing/invalid', () => {
            // Arrange
            // Manually construct invalid target contexts
            const testCases = [
                {type: 'entity', entityId: null},
                {type: 'entity', entityId: undefined},
                {type: 'entity', entityId: ''},
                {type: 'entity'}, // entityId property missing
            ];

            // Act & Assert for each case
            testCases.forEach(invalidContext => {
                // Clear mocks specific to the loop
                jest.clearAllMocks();
                createComponentAccessor.mockImplementation((entityId) => {
                    if (entityId === 'actor-1') return mockActorAccessor;
                    return {isProxy: true};
                });

                const context = createActionValidationContext(
                    mockActorEntity,
                    // @ts-ignore - Intentionally testing invalid structure
                    invalidContext,
                    mockEntityManager,
                    mockLogger
                );

                // Assert
                expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
                expect(context.target).toBeNull();
                // Accessor only called for actor
                expect(createComponentAccessor).toHaveBeenCalledTimes(1);
                expect(createComponentAccessor).toHaveBeenCalledWith('actor-1', mockEntityManager, mockLogger);
            });
        });

        test('AC-3.6: should set context.target to null when target is Direction', () => {
            // Arrange
            mockTargetContext = ActionTargetContext.forDirection('north');

            // Act
            const context = createActionValidationContext(
                mockActorEntity,
                mockTargetContext,
                mockEntityManager,
                mockLogger
            );

            // Assert
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
            expect(context.target).toBeNull();
            // Accessor only called for actor
            expect(createComponentAccessor).toHaveBeenCalledTimes(1);
            expect(createComponentAccessor).toHaveBeenCalledWith('actor-1', mockEntityManager, mockLogger);
        });

        test('AC-3.7: should set context.target to null when target is None', () => {
            // Arrange
            mockTargetContext = ActionTargetContext.noTarget(); // Already default

            // Act
            const context = createActionValidationContext(
                mockActorEntity,
                mockTargetContext,
                mockEntityManager,
                mockLogger
            );

            // Assert
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
            expect(context.target).toBeNull();
            // Accessor only called for actor
            expect(createComponentAccessor).toHaveBeenCalledTimes(1);
            expect(createComponentAccessor).toHaveBeenCalledWith('actor-1', mockEntityManager, mockLogger);
        });
    });

    describe('AC-3.8: Error Handling (Inputs)', () => {
        test('should throw error if actorEntity is missing or invalid', () => {
            const invalidActors = [null, undefined, {}, {id: ''}, {id: 'valid', hasComponent: 'not-a-function'}];
            invalidActors.forEach(invalidActor => {
                expect(() => {
                    // @ts-ignore - Intentionally passing invalid type
                    createActionValidationContext(invalidActor, mockTargetContext, mockEntityManager, mockLogger);
                }).toThrow("createActionValidationContext: invalid actorEntity");
            });
        });

        test('should throw error if targetContext is missing or invalid', () => {
            const invalidTargets = [null, undefined, {}, {type: null}];
            invalidTargets.forEach(invalidTarget => {
                expect(() => {
                    // @ts-ignore - Intentionally passing invalid type
                    createActionValidationContext(mockActorEntity, invalidTarget, mockEntityManager, mockLogger);
                }).toThrow("createActionValidationContext: invalid targetContext");
            });
        });

        test('should throw error if entityManager is missing or invalid', () => {
            const invalidManagers = [null, undefined, {}, {getEntityInstance: 'not-a-function'}];
            invalidManagers.forEach(invalidManager => {
                expect(() => {
                    // @ts-ignore - Intentionally passing invalid type
                    createActionValidationContext(mockActorEntity, mockTargetContext, invalidManager, mockLogger);
                }).toThrow("createActionValidationContext: invalid entityManager");
            });
        });

        test('should throw error if logger is missing or invalid', () => {
            const invalidLoggers = [
                null, undefined, {}, {debug: jest.fn()}, {debug: jest.fn(), warn: jest.fn(), error: null}
            ];
            invalidLoggers.forEach(invalidLogger => {
                expect(() => {
                    // @ts-ignore - Intentionally passing invalid type
                    createActionValidationContext(mockActorEntity, mockTargetContext, mockEntityManager, invalidLogger);
                }).toThrow("createActionValidationContext: invalid logger");
            });
        });
    });

    describe('AC-3.9: Error Handling (Internal - Optional)', () => {
        test('should re-throw error if entityManager.getEntityInstance throws', () => {
            // Arrange
            const targetId = 'target-error';
            mockTargetContext = ActionTargetContext.forEntity(targetId);
            const internalError = new Error('Database connection failed');

            mockEntityManager.getEntityInstance.mockImplementation((id) => {
                if (id === targetId) {
                    throw internalError;
                }
                return undefined;
            });

            // Act & Assert
            expect(() => {
                createActionValidationContext(mockActorEntity, mockTargetContext, mockEntityManager, mockLogger);
            }).toThrow(`Failed processing target entity ${targetId}: ${internalError.message}`);

            // Verify logger was called before throw
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error processing target ID [${targetId}]`),
                expect.any(Error) // Check that an Error object was logged
            );
        });

        test('should re-throw error if createComponentAccessor throws for Actor', () => {
            // Arrange
            const internalError = new Error('Accessor generation failed');
            createComponentAccessor.mockImplementation((entityId, _entityManager, _logger) => {
                if (entityId === mockActorEntity.id) {
                    throw internalError;
                }
                return {isProxy: true}; // Should not be reached in this test path
            });

            // Act & Assert
            expect(() => {
                createActionValidationContext(mockActorEntity, mockTargetContext, mockEntityManager, mockLogger);
            }).toThrow(`Accessor generation failed`);

            // Verify logger was called before throw
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error creating component accessor for actor ID [${mockActorEntity.id}]`),
                expect.any(Error) // Check that an Error object was logged
            );
        });

        test('should re-throw error if createComponentAccessor throws for Target', () => {
            // Arrange
            const targetId = 'target-1';
            const mockTargetEntity = new Entity(targetId);
            mockTargetContext = ActionTargetContext.forEntity(targetId);
            const internalError = new Error('Target accessor generation failed');

            // Mock EntityManager to find the target entity
            mockEntityManager.getEntityInstance.mockImplementation((id) => {
                if (id === targetId) return mockTargetEntity;
                return undefined;
            });

            createComponentAccessor.mockImplementation((entityId, _entityManager, _logger) => {
                if (entityId === mockActorEntity.id) {
                    return mockActorAccessor; // Actor accessor succeeds
                } else if (entityId === targetId) {
                    throw internalError; // Target accessor fails
                }
                return {isProxy: true};
            });

            // Act & Assert
            expect(() => {
                createActionValidationContext(mockActorEntity, mockTargetContext, mockEntityManager, mockLogger);
            }).toThrow(`Target accessor generation failed`); // Should be wrapped by the target processing block's catch

            // Verify logger was called before throw within the target processing block
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error processing target ID [${targetId}]`), // The error originates here
                expect.any(Error) // Check that an Error object was logged (specifically, the error from createComponentAccessor)
            );
            // Ensure the actor accessor *was* created without error log for it
            expect(createComponentAccessor).toHaveBeenCalledWith(mockActorEntity.id, mockEntityManager, mockLogger);
            expect(createComponentAccessor).toHaveBeenCalledWith(targetId, mockEntityManager, mockLogger);
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Only one error logged
        });
    });

}); // End describe Unit Test: createActionValidationContext