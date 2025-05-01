// src/tests/core/turnManager.constructor.test.js

import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js';
import {beforeEach, describe, expect, it, jest, test} from "@jest/globals"; // Use 'it' alias for test cases

// Define mocks in a broader scope to be accessible in all describe blocks
let mockTurnOrderService;
let mockEntityManager;
let mockLogger;
let mockDispatcher;
let mockTurnHandlerResolver; // <<< ADDED
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
        // Add other properties or methods if TurnManager interacts with them directly
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
    // <<< ADDED TurnHandlerResolver mock >>>
    turnHandlerResolver: {
        resolve: jest.fn(),
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
        mockTurnHandlerResolver = mocks.turnHandlerResolver; // <<< ADDED assignment

        // Reset mock EntityManager's internal state
        mockEntityManager._setActiveEntities([]); // Clear entities

        // Re-initialize basic mock configurations if needed (e.g., default return values)
        mockTurnOrderService.isEmpty.mockResolvedValue(true);
        mockTurnOrderService.getNextEntity.mockResolvedValue(null);
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        mockTurnHandlerResolver.resolve.mockReturnValue({handleTurn: jest.fn()}); // Default valid resolver

        // Create fresh mock entities for each test run
        mockPlayerEntity = createMockEntity('player-1', true, true);
        mockAiEntity1 = createMockEntity('ai-1', true, false);
        mockAiEntity2 = createMockEntity('ai-2', true, false);
    });

    // --- Constructor Tests (Ticket 2.1.6.2 and subsequent additions) ---
    describe('constructor', () => {
        it('should instantiate successfully with valid dependencies', () => {
            let turnManager;
            expect(() => {
                turnManager = new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver, // <<< ADDED dependency
                });
            }).not.toThrow();

            expect(turnManager).toBeInstanceOf(TurnManager);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
            expect(turnManager.getCurrentActor()).toBeNull();
            // Internal state #isRunning is private, tested via start/stop behavior.
        });

        // --- Dependency Validation Failures ---

        // TurnOrderService
        it('should throw an error if turnOrderService is missing', () => {
            const expectedErrorMsg = 'TurnManager requires a valid ITurnOrderService instance.';
            expect(() => {
                new TurnManager({
                    // turnOrderService: undefined, // Missing
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg); // Check message specifically
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

        // EntityManager
        it('should throw an error if entityManager is missing', () => {
            const expectedErrorMsg = 'TurnManager requires a valid EntityManager instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    // entityManager: undefined, // Missing
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

        // Logger
        it('should throw an error if logger is missing', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const expectedErrorMsg = 'TurnManager requires a valid ILogger instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    // logger: undefined, // Missing
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
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
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
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
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

        // Dispatcher
        it('should throw an error if dispatcher is missing', () => {
            const expectedErrorMsg = 'TurnManager requires a valid IValidatedEventDispatcher instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    // dispatcher: undefined, // Missing
                    turnHandlerResolver: mockTurnHandlerResolver,
                });
            }).toThrow(expectedErrorMsg);
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
        });

        // <<< ADDED TurnHandlerResolver validation tests >>>
        it('should throw an error if turnHandlerResolver is missing', () => {
            const expectedErrorMsg = 'TurnManager requires a valid ITurnHandlerResolver instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                    // turnHandlerResolver: undefined, // Missing
                });
            }).toThrow(expectedErrorMsg);
        });

        it('should throw an error if turnHandlerResolver is invalid (missing resolve)', () => {
            const invalidResolver = {...mockTurnHandlerResolver, resolve: undefined};
            const expectedErrorMsg = 'TurnManager requires a valid ITurnHandlerResolver instance.';
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                    turnHandlerResolver: invalidResolver,
                });
            }).toThrow(expectedErrorMsg);
        });
        // <<< END Added tests >>>
    });

    // --- Other Test Suites ---
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

    // --- Test cases for start, stop, advanceTurn etc. will be added in subsequent tickets ---

});