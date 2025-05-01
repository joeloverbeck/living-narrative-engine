// src/tests/core/turnManager.constructor.test.js

import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js';
import {beforeEach, describe, expect, it, jest, test} from "@jest/globals"; // Use 'it' alias for test cases

// Define mocks in a broader scope to be accessible in all describe blocks
let mockTurnOrderService;
let mockEntityManager;
let mockLogger;
let mockDispatcher;
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
        peekNextEntity: jest.fn(), // Add other methods from interface if needed later
        addEntity: jest.fn(),
        removeEntity: jest.fn(),
        getCurrentOrder: jest.fn(),
    },
    entityManager: {
        // Mock activeEntities as a getter returning a Map
        get activeEntities() {
            return this._mockActiveEntities;
        },
        _mockActiveEntities: new Map(), // Internal map to hold mock entities
        getEntityInstance: jest.fn(),
        // Helper to easily set active entities for tests
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

        // Reset mock EntityManager's internal state
        mockEntityManager._setActiveEntities([]); // Clear entities

        // Re-initialize basic mock configurations if needed (e.g., default return values)
        mockTurnOrderService.isEmpty.mockResolvedValue(true); // Default to empty queue
        mockTurnOrderService.getNextEntity.mockResolvedValue(null); // Default to no next entity
        mockDispatcher.dispatchValidated.mockResolvedValue(true); // Default successful dispatch

        // Create fresh mock entities for each test run
        mockPlayerEntity = createMockEntity('player-1', true, true);
        mockAiEntity1 = createMockEntity('ai-1', true, false);
        mockAiEntity2 = createMockEntity('ai-2', true, false);

        // Note: TurnManager is instantiated within specific describe blocks below as needed
    });

    // --- Constructor Tests (Ticket 2.1.6.2) ---
    describe('constructor', () => {
        it('should instantiate successfully with valid dependencies', () => {
            let turnManager;
            expect(() => {
                turnManager = new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                });
            }).not.toThrow();

            expect(turnManager).toBeInstanceOf(TurnManager);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
            expect(turnManager.getCurrentActor()).toBeNull();
            // Internal state #isRunning is private and has no getter.
            // We assume it's initialized to false based on code inspection
            // and verify through start/stop behavior tests later.
        });

        // --- Dependency Validation Failures ---

        // TurnOrderService
        it('should throw an error if turnOrderService is missing', () => {
            const expectedError = new Error('TurnManager requires a valid ITurnOrderService instance.');
            expect(() => {
                new TurnManager({
                    turnOrderService: undefined,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                });
            }).toThrow(expectedError);
        });

        it('should throw an error if turnOrderService is invalid (missing clearCurrentRound)', () => {
            const invalidService = {...mockTurnOrderService, clearCurrentRound: undefined};
            const expectedError = new Error('TurnManager requires a valid ITurnOrderService instance.');
            expect(() => {
                new TurnManager({
                    turnOrderService: invalidService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                });
            }).toThrow(expectedError);
        });

        // EntityManager
        it('should throw an error if entityManager is missing', () => {
            const expectedError = new Error('TurnManager requires a valid EntityManager instance.');
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: undefined,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                });
            }).toThrow(expectedError);
        });

        it('should throw an error if entityManager is invalid (missing getEntityInstance)', () => {
            const invalidManager = {...mockEntityManager, getEntityInstance: undefined};
            const expectedError = new Error('TurnManager requires a valid EntityManager instance.');
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: invalidManager,
                    logger: mockLogger,
                    dispatcher: mockDispatcher,
                });
            }).toThrow(expectedError);
        });

        // Logger
        it('should throw an error if logger is missing', () => {
            // Suppress console.error during this specific test where logger is invalid
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const expectedError = new Error('TurnManager requires a valid ILogger instance.');
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: undefined,
                    dispatcher: mockDispatcher,
                });
            }).toThrow(expectedError);
            consoleErrorSpy.mockRestore(); // Restore console.error
        });

        it('should throw an error if logger is invalid (missing info)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const invalidLogger = {...mockLogger, info: undefined};
            const expectedError = new Error('TurnManager requires a valid ILogger instance.');
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: invalidLogger,
                    dispatcher: mockDispatcher,
                });
            }).toThrow(expectedError);
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if logger is invalid (missing warn)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const invalidLogger = {...mockLogger, warn: undefined};
            const expectedError = new Error('TurnManager requires a valid ILogger instance.');
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: invalidLogger,
                    dispatcher: mockDispatcher,
                });
            }).toThrow(expectedError);
            consoleErrorSpy.mockRestore();
        });

        it('should throw an error if logger is invalid (missing error)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const invalidLogger = {...mockLogger, error: undefined};
            const expectedError = new Error('TurnManager requires a valid ILogger instance.');
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: invalidLogger,
                    dispatcher: mockDispatcher,
                });
            }).toThrow(expectedError);
            consoleErrorSpy.mockRestore();
        });

        // Dispatcher
        it('should throw an error if dispatcher is missing', () => {
            const expectedError = new Error('TurnManager requires a valid IValidatedEventDispatcher instance.');
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: undefined,
                });
            }).toThrow(expectedError);
        });

        it('should throw an error if dispatcher is invalid (missing dispatchValidated)', () => {
            const invalidDispatcher = {...mockDispatcher, dispatchValidated: undefined};
            const expectedError = new Error('TurnManager requires a valid IValidatedEventDispatcher instance.');
            expect(() => {
                new TurnManager({
                    turnOrderService: mockTurnOrderService,
                    entityManager: mockEntityManager,
                    logger: mockLogger,
                    dispatcher: invalidDispatcher,
                });
            }).toThrow(expectedError);
        });
    });

    // --- Other Test Suites ---
    // Existing sanity check - can be kept or removed if constructor tests are sufficient
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