// src/tests/core/turnManager.constructor.test.js
// --- FILE START (Corrected) ---

import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js';
import {beforeEach, describe, expect, it, jest, test} from "@jest/globals"; // Use 'it' alias for test cases

// Define mocks in a broader scope to be accessible in all describe blocks
let mockTurnOrderService;
let mockEntityManager;
let mockLogger;
let mockDispatcher;
let mockTurnHandlerResolver; // Mock for the resolver
let mockPlayerEntity;
let mockAiEntity1;
let mockAiEntity2;

// Helper function to create basic mock entities
const createMockEntity = (id, isActor = false, isPlayer = false) => {
    const entity = {
        id: id,
        hasComponent: jest.fn((componentId) => {
            if (componentId === ACTOR_COMPONENT_ID) {
                return isActor;
            }
            if (componentId === PLAYER_COMPONENT_ID) {
                return isPlayer;
            }
            return false; // Default mock behavior
        }),
    };
    return entity;
};

// Function to create a full set of valid mocks
const createValidMocks = () => ({
    turnOrderService: {
        isEmpty: jest.fn(),
        startNewRound: jest.fn(),
        getNextEntity: jest.fn(),
        clearCurrentRound: jest.fn(),
        peekNextEntity: jest.fn(),
        addEntity: jest.fn(),
        removeEntity: jest.fn(),
        getCurrentOrder: jest.fn(),
    },
    entityManager: {
        get activeEntities() {
            return this._mockActiveEntities;
        },
        _mockActiveEntities: new Map(),
        getEntityInstance: jest.fn(),
        _setActiveEntities: function (entities) {
            this._mockActiveEntities.clear();
            entities.forEach(entity => this._mockActiveEntities.set(entity.id, entity));
        },
        createEntityInstance: jest.fn(),
        addComponent: jest.fn(),
        removeComponent: jest.fn(),
        getComponentData: jest.fn(),
        hasComponent: jest.fn(),
        removeEntityInstance: jest.fn(),
        getEntitiesInLocation: jest.fn(),
        buildInitialSpatialIndex: jest.fn(),
        clearAll: jest.fn(),
    },
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
    dispatcher: {
        dispatchValidated: jest.fn(),
    },
    // *** FIXED: Use correct method name 'resolveHandler' in mock ***
    turnHandlerResolver: {
        resolveHandler: jest.fn(), // <<< CORRECTED METHOD NAME
    }
});

describe('TurnManager', () => {

    beforeEach(() => {
        // Create fresh mocks for each test run
        const mocks = createValidMocks();
        mockTurnOrderService = mocks.turnOrderService;
        mockEntityManager = mocks.entityManager;
        mockLogger = mocks.logger;
        mockDispatcher = mocks.dispatcher;
        mockTurnHandlerResolver = mocks.turnHandlerResolver; // Assign the corrected mock

        // Reset mock EntityManager's internal state
        mockEntityManager._setActiveEntities([]); // Clear entities

        // Re-initialize basic mock configurations if needed (e.g., default return values)
        mockTurnOrderService.isEmpty.mockResolvedValue(true);
        mockTurnOrderService.getNextEntity.mockResolvedValue(null);
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        // *** FIXED: Set default return value for the correct mock method ***
        mockTurnHandlerResolver.resolveHandler.mockReturnValue({handleTurn: jest.fn()}); // Default valid resolved handler

        // Create fresh mock entities for each test run
        mockPlayerEntity = createMockEntity('player-1', true, true);
        mockAiEntity1 = createMockEntity('ai-1', true, false);
        mockAiEntity2 = createMockEntity('ai-2', true, false);
    });

    // --- Constructor Tests ---
    describe('constructor', () => {
        it('should instantiate successfully with valid dependencies', () => {
            let turnManager;
            expect(() => {
                turnManager = new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver, // Pass the corrected mock
                });
            }).not.toThrow(); // This should now pass

            expect(turnManager).toBeInstanceOf(TurnManager);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
            expect(turnManager.getCurrentActor()).toBeNull();
        });

        // --- Dependency Validation Failures ---

        // TurnOrderService (Keep these as they are)
        it('should throw an error if turnOrderService is missing', () => {
            const expectedErrorMsg = 'TurnManager requires a valid ITurnOrderService instance.';
            expect(() => {
                new TurnManager({
                    // turnOrderService: undefined,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg);
        });

        it('should throw an error if turnOrderService is invalid (missing clearCurrentRound)', () => {
            const invalidService = {...mockTurnOrderService, clearCurrentRound: undefined};
            const expectedErrorMsg = 'TurnManager requires a valid ITurnOrderService instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: invalidService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg);
        });

        // EntityManager (Keep these as they are)
        it('should throw an error if entityManager is missing', () => {
            const expectedErrorMsg = 'TurnManager requires a valid EntityManager instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    // entityManager: undefined,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg);
        });

        it('should throw an error if entityManager is invalid (missing getEntityInstance)', () => {
            const invalidManager = {...mockEntityManager, getEntityInstance: undefined};
            const expectedErrorMsg = 'TurnManager requires a valid EntityManager instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: invalidManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg);
        });

        // Logger (Keep these as they are, assuming console spy logic is intended)
        it('should throw an error if logger is missing', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const expectedErrorMsg = 'TurnManager requires a valid ILogger instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    // logger: undefined,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg);
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if logger is invalid (missing info)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const invalidLogger = {...mockLogger, info: undefined};
            const expectedErrorMsg = 'TurnManager requires a valid ILogger instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: invalidLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg);
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if logger is invalid (missing warn)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const invalidLogger = {...mockLogger, warn: undefined};
            const expectedErrorMsg = 'TurnManager requires a valid ILogger instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: invalidLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg);
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if logger is invalid (missing error)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const invalidLogger = {...mockLogger, error: undefined};
            const expectedErrorMsg = 'TurnManager requires a valid ILogger instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: invalidLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg);
            consoleErrorSpy.mockRestore();
        });


        // Dispatcher (Keep these as they are)
        it('should throw an error if dispatcher is missing', () => {
            const expectedErrorMsg = 'TurnManager requires a valid IValidatedEventDispatcher instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    // dispatcher: undefined,
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg);
            // Check logger was called correctly
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        });

        it('should throw an error if dispatcher is invalid (missing dispatchValidated)', () => {
            const invalidDispatcher = {...mockDispatcher, dispatchValidated: undefined};
            const expectedErrorMsg = 'TurnManager requires a valid IValidatedEventDispatcher instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: invalidDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        });

        // --- TurnHandlerResolver validation tests (Corrected) ---
        it('should throw an error if turnHandlerResolver is missing', () => {
            // *** FIXED: Expect the NEW error message ***
            const expectedErrorMsgRegex = /requires a valid ITurnHandlerResolver instance \(with resolveHandler method\)/;
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                    // turnHandlerResolver: undefined, // Missing
                });
            }).toThrow(expectedErrorMsgRegex);
            // Check logger was called with the correct message part
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('requires a valid ITurnHandlerResolver instance (with resolveHandler method)'));
        });

        // *** FIXED: Test description and expected error message ***
        it('should throw an error if turnHandlerResolver is invalid (missing resolveHandler)', () => {
            // Provide an object that is explicitly missing the 'resolveHandler' function
            const invalidResolver = { someOtherMethod: jest.fn() };
            const expectedErrorMsgRegex = /requires a valid ITurnHandlerResolver instance \(with resolveHandler method\)/;
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: invalidResolver, // Pass the object missing the correct method
                });
            }).toThrow(expectedErrorMsgRegex);
            // Check logger was called with the correct message part
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('requires a valid ITurnHandlerResolver instance (with resolveHandler method)'));
        });
        // <<< END Corrected tests >>>
    });

    // --- Mock Sanity Checks (Keep these) ---
    test('mock entities should behave as configured', () => {
        expect(mockPlayerEntity.id).toBe('player-1');
        expect(mockPlayerEntity.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);
        expect(mockPlayerEntity.hasComponent(PLAYER_COMPONENT_ID)).toBe(true);
        expect(mockPlayerEntity.hasComponent('some-other-component')).toBe(false);

        expect(mockAiEntity1.id).toBe('ai-1');
        expect(mockAiEntity1.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);
        expect(mockAiEntity1.hasComponent(PLAYER_COMPONENT_ID)).toBe(false);
    });

    test('EntityManager mock allows setting active entities', () => {
        const entities = [mockPlayerEntity, mockAiEntity1];
        mockEntityManager._setActiveEntities(entities);
        expect(Array.from(mockEntityManager.activeEntities.values())).toEqual(entities);
        expect(mockEntityManager.activeEntities.get('player-1')).toBe(mockPlayerEntity);
    });

    // --- Placeholder for future tests ---
    // --- Test cases for start, stop, advanceTurn etc. will be added in subsequent tickets ---

});
// --- FILE END ---