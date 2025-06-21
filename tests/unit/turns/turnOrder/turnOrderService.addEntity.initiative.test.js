// src/tests/turns/order/turnOrderService.addEntity.initiative.test.js

/**
 * @file Unit tests for the TurnOrderService class, focusing on the
 * addEntity method when the active strategy is 'initiative'.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket: TEST-TURN-ORDER-001.11.10
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import { TurnOrderService } from '../../../../src/turns/order/turnOrderService.js';
// Import the actual module so Jest can track it and we can refer to its name
import { InitiativePriorityQueue } from '../../../../src/turns/order/queues/initiativePriorityQueue.js';

// Mock the InitiativePriorityQueue module using its path
// This should be done *before* the describe block or at the top level
jest.mock('../../../../src/turns/order/queues/initiativePriorityQueue.js');

// Mock ILogger interface
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// Mock Entity type for testing
/** @typedef {{ id: string; name?: string; }} Entity */

// No need for the explicit cast here anymore
// const MockedInitiativePriorityQueue = InitiativePriorityQueue; // We just use InitiativePriorityQueue directly

describe('TurnOrderService', () => {
  /** @type {ReturnType<typeof createMockLogger>} */
  let mockLogger;
  /** @type {TurnOrderService} */
  let service;
  /** @type {Entity[]} */
  let initialEntities;
  /** @type {Map<string, number>} */
  let initialInitiativeData;
  // Declare variable to hold the specific mock instance returned by the constructor
  /** @type {any} */ // Using 'any' or a more specific JSDoc type if preferred
  let mockInitiativeQueueInstance;

  beforeEach(() => {
    // No longer async
    // Clear all previous mock calls and instances before each test
    // This includes clearing calls on the mocked constructor itself
    jest.clearAllMocks();

    // Setup common mocks and instances
    mockLogger = createMockLogger();
    service = new TurnOrderService({ logger: mockLogger });
    initialEntities = [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ];
    initialInitiativeData = new Map([
      ['a', 10],
      ['b', 5],
    ]);

    // --- Corrected Mocking ---
    // 1. Create the mock object instance structure we want the constructor to return
    mockInitiativeQueueInstance = {
      add: jest.fn(),
      clear: jest.fn(),
      peek: jest.fn(),
      isEmpty: jest.fn().mockReturnValue(false), // Assume not empty after init
      toArray: jest.fn().mockReturnValue(initialEntities), // Return initial entities
      getNext: jest.fn(),
      remove: jest.fn(),
      size: jest.fn().mockReturnValue(initialEntities.length), // Reflect initial size
    };
    // Removed the 'as' cast here

    // 2. Configure the *mocked constructor* (accessed via the imported name InitiativePriorityQueue)
    //    to return *this specific object instance* whenever 'new InitiativePriorityQueue()' is called.
    //    We access InitiativePriorityQueue directly, knowing jest.mock replaced it.
    InitiativePriorityQueue.mockImplementation(() => {
      return mockInitiativeQueueInstance;
    });
    // --- End Corrected Mocking ---

    // Start an 'initiative' round to set the service's state
    // This will call the mocked constructor, which returns mockInitiativeQueueInstance
    service.startNewRound(initialEntities, 'initiative', initialInitiativeData);

    // Optional Sanity Check: Verify the constructor was called
    // expect(InitiativePriorityQueue).toHaveBeenCalledTimes(1);
    // expect(InitiativePriorityQueue.mock.instances[0]).toBe(mockInitiativeQueueInstance);

    // --- IMPORTANT: Clear mock function calls *on the instance* ---
    // Clear calls made *during* startNewRound (e.g., the initial .add calls)
    // We don't clear InitiativePriorityQueue itself here, only the methods on the returned instance.
    Object.values(mockInitiativeQueueInstance).forEach((mockFn) => {
      // Check if it's a Jest mock function before clearing
      if (jest.isMockFunction(mockFn)) {
        mockFn.mockClear();
      }
    });
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
  });

  afterEach(() => {
    // Optional: Verify no unexpected errors were logged during any test
    // eslint-disable-next-line jest/no-standalone-expect
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // --- Test Suite for addEntity with 'initiative' strategy (TEST-TURN-ORDER-001.11.10) ---
  describe("addEntity ('initiative' strategy active)", () => {
    // Test Case: Add Entity with Valid Priority
    it('Test Case 11.10.1: should add an entity with a valid priority', () => {
      // Arrange
      const entityToAdd = { id: 'newEntity', name: 'Charlie' };
      const priority = 20;

      // Act
      service.addEntity(entityToAdd, priority);

      // Assert
      // 1. Queue Interaction
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledTimes(1); // Should pass now
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledWith(
        entityToAdd,
        priority
      );

      // 2. Logging
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        `TurnOrderService: Adding entity "${entityToAdd.id}" with initiative ${priority} to the current round.`
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        `TurnOrderService: Entity "${entityToAdd.id}" successfully added to the turn order.`
      );
      expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings for valid input
    });

    // Test Case: Add Entity with Missing Priority (should default to 0)
    it('Test Case 11.10.2: should add an entity with default priority 0 if priority is missing', () => {
      // Arrange
      const entityToAdd = { id: 'newDefault', name: 'David' };
      const expectedPriority = 0;

      // Act
      service.addEntity(entityToAdd); // No priority provided

      // Assert
      // 1. Queue Interaction
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledTimes(1); // Should pass now
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledWith(
        entityToAdd,
        expectedPriority
      );

      // 2. Logging
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        `TurnOrderService: Adding entity "${entityToAdd.id}" with initiative ${expectedPriority} to the current round.`
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        `TurnOrderService: Entity "${entityToAdd.id}" successfully added to the turn order.`
      );
      expect(mockLogger.warn).not.toHaveBeenCalled(); // Explicit default is not a warning case
    });

    // Test Case: Add Entity with Invalid Priority (null)
    it('Test Case 11.10.3: should add an entity with default priority 0 and log warning if priority is null', () => {
      // Arrange
      const entityToAdd = { id: 'newInvalidNull', name: 'Eve' };
      const invalidPriority = null;
      const expectedPriority = 0;

      // Act
      // @ts-ignore - Testing invalid input type
      service.addEntity(entityToAdd, invalidPriority);

      // Assert
      // 1. Queue Interaction
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledTimes(1); // Should pass now
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledWith(
        entityToAdd,
        expectedPriority
      );

      // 2. Logging
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `TurnOrderService.addEntity (initiative): Invalid initiative value "${invalidPriority}" provided for entity "${entityToAdd.id}". Defaulting to ${expectedPriority}.`
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        `TurnOrderService: Adding entity "${entityToAdd.id}" with initiative ${expectedPriority} to the current round.`
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        `TurnOrderService: Entity "${entityToAdd.id}" successfully added to the turn order.`
      );
    });

    // Test Case: Add Entity with Invalid Priority (string)
    it('Test Case 11.10.4: should add an entity with default priority 0 and log warning if priority is a string', () => {
      // Arrange
      const entityToAdd = { id: 'newInvalidString', name: 'Frank' };
      const invalidPriority = 'high';
      const expectedPriority = 0;

      // Act
      // @ts-ignore - Testing invalid input type
      service.addEntity(entityToAdd, invalidPriority);

      // Assert
      // 1. Queue Interaction
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledTimes(1); // Should pass now
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledWith(
        entityToAdd,
        expectedPriority
      );

      // 2. Logging
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `TurnOrderService.addEntity (initiative): Invalid initiative value "${invalidPriority}" provided for entity "${entityToAdd.id}". Defaulting to ${expectedPriority}.`
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        `TurnOrderService: Adding entity "${entityToAdd.id}" with initiative ${expectedPriority} to the current round.`
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        `TurnOrderService: Entity "${entityToAdd.id}" successfully added to the turn order.`
      );
    });

    // Test Case: Add Entity with Invalid Priority (undefined) - Handled like missing
    it('Test Case 11.10.5: should add an entity with default priority 0 if priority is explicitly undefined', () => {
      // Arrange
      const entityToAdd = { id: 'newUndefined', name: 'Grace' };
      const invalidPriority = undefined; // Explicitly undefined
      const expectedPriority = 0;

      // Act
      service.addEntity(entityToAdd, invalidPriority);

      // Assert
      // 1. Queue Interaction
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledTimes(1); // Should pass now
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledWith(
        entityToAdd,
        expectedPriority
      );

      // 2. Logging
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        `TurnOrderService: Adding entity "${entityToAdd.id}" with initiative ${expectedPriority} to the current round.`
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        `TurnOrderService: Entity "${entityToAdd.id}" successfully added to the turn order.`
      );
      expect(mockLogger.warn).not.toHaveBeenCalled(); // Undefined defaults gracefully, no warning needed
    });

    // Test Case: Add Entity with Invalid Priority (NaN)
    it('Test Case 11.10.6: should add an entity with default priority 0 and log warning if priority is NaN', () => {
      // Arrange
      const entityToAdd = { id: 'newInvalidNaN', name: 'Heidi' };
      const invalidPriority = NaN;
      const expectedPriority = 0;

      // Act
      service.addEntity(entityToAdd, invalidPriority);

      // Assert
      // 1. Queue Interaction
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledTimes(1); // Should pass now
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledWith(
        entityToAdd,
        expectedPriority
      );

      // 2. Logging
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `TurnOrderService.addEntity (initiative): Invalid initiative value "${invalidPriority}" provided for entity "${entityToAdd.id}". Defaulting to ${expectedPriority}.`
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        `TurnOrderService: Adding entity "${entityToAdd.id}" with initiative ${expectedPriority} to the current round.`
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        `TurnOrderService: Entity "${entityToAdd.id}" successfully added to the turn order.`
      );
    });

    // Test Case: Add Entity with Invalid Priority (Infinity)
    it('Test Case 11.10.7: should add an entity with default priority 0 and log warning if priority is Infinity', () => {
      // Arrange
      const entityToAdd = { id: 'newInvalidInfinity', name: 'Ivan' };
      const invalidPriority = Infinity;
      const expectedPriority = 0;

      // Act
      service.addEntity(entityToAdd, invalidPriority);

      // Assert
      // 1. Queue Interaction
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledTimes(1); // Should pass now
      expect(mockInitiativeQueueInstance.add).toHaveBeenCalledWith(
        entityToAdd,
        expectedPriority
      );

      // 2. Logging
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `TurnOrderService.addEntity (initiative): Invalid initiative value "${invalidPriority}" provided for entity "${entityToAdd.id}". Defaulting to ${expectedPriority}.`
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        `TurnOrderService: Adding entity "${entityToAdd.id}" with initiative ${expectedPriority} to the current round.`
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        `TurnOrderService: Entity "${entityToAdd.id}" successfully added to the turn order.`
      );
    });
  }); // End describe("addEntity ('initiative' strategy active)")
}); // End describe('TurnOrderService')
