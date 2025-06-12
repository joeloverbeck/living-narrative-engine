// src/tests/commandParser.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CommandParser from '../../src/commands/commandParser.js'; // Class under test
// Import the actual dependency for type hinting and mocking purposes
import GameDataRepository from '../../src/data/gameDataRepository.js';
import { freeze } from '../utils/objectUtils';
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../src/actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Task 1 & 2: Mock GameDataRepository ---
// Mock function for the getAllActionDefinitions method
const mockGetAllActionDefinitions = jest.fn();

// Mock the entire GameDataRepository module
jest.mock('../../src/data/gameDataRepository.js', () => {
  // Mock constructor function for GameDataRepository
  return jest.fn().mockImplementation(() => {
    // Instances created via 'new GameDataRepository()' in tests will have this structure
    return {
      getAllActionDefinitions: mockGetAllActionDefinitions,
    };
  });
});

// --- Task 5: Define Mock Action Definitions (MOCK_ACTIONS) ---
/**
 * Reusable set of mock ActionDefinition objects for testing.
 *
 * @type {ReadonlyArray<ActionDefinition>}
 */
const MOCK_ACTIONS = freeze([
  { id: 'core:look', commandVerb: 'look', name: 'Look' },
  { id: 'core:inventory', commandVerb: 'inventory', name: 'Inventory' },
  { id: 'core:take', commandVerb: 'take', name: 'Take' },
  { id: 'core:put', commandVerb: 'put', name: 'Put' },
  { id: 'core:go', commandVerb: 'go', name: 'Go' },
  // Add other mock actions as needed based on MOCK_ACTIONS from the source file
]);

// --- Task 6: Test Suite Structure ---
describe('CommandParser', () => {
  /** @type {CommandParser} */
  let commandParser;
  /** @type {GameDataRepository} */
  let mockRepositoryInstance; // Holds the specific mock instance

  // --- Task 8: Standard beforeEach Setup ---
  beforeEach(() => {
    // Clear mock history before each test for isolation
    mockGetAllActionDefinitions.mockClear();
    // Optionally reset mock implementation if tests change it
    // mockGetAllActionDefinitions.mockReset();

    // Provide a default return value for the mocked method
    // Return a shallow copy to prevent accidental mutation between tests
    mockGetAllActionDefinitions.mockReturnValue([...MOCK_ACTIONS]);

    // Instantiate the *mocked* GameDataRepository
    // The import 'GameDataRepository' now refers to the mocked constructor
    mockRepositoryInstance = new GameDataRepository();

    // Instantiate the CommandParser with the fresh mock repository instance
    // This implicitly covers part of CPARSE-C-001 (successful setup)
    commandParser = new CommandParser(mockRepositoryInstance);
  });

  // --- Basic Setup Tests (Provided for context, assume passed from Ticket 1) ---
  describe('Initial Test Setup Verification', () => {
    it('AC1: should run the test file successfully', () => {
      expect(true).toBe(true);
    });

    it('AC2: should have a mock GameDataRepository with a configurable getAllActionDefinitions', () => {
      expect(mockRepositoryInstance).toBeDefined();
      expect(typeof mockRepositoryInstance.getAllActionDefinitions).toBe(
        'function'
      );
      expect(
        jest.isMockFunction(mockRepositoryInstance.getAllActionDefinitions)
      ).toBe(true);

      // Demonstrate configurability
      const customReturnValue = [
        { id: 'custom:action', commandVerb: 'custom', name: 'Custom' },
      ];
      mockGetAllActionDefinitions.mockReturnValueOnce(customReturnValue);
      const result = mockRepositoryInstance.getAllActionDefinitions();
      expect(result).toEqual(customReturnValue);

      const defaultResult = mockRepositoryInstance.getAllActionDefinitions();
      expect(defaultResult).toEqual([...MOCK_ACTIONS]);
    });

    it('AC3: should have MOCK_ACTIONS array defined and accessible', () => {
      expect(MOCK_ACTIONS).toBeDefined();
      expect(Array.isArray(MOCK_ACTIONS)).toBe(true);
      expect(MOCK_ACTIONS.length).toBeGreaterThan(0);
    });

    it('AC4: beforeEach block should create a new CommandParser instance with the mock repository', () => {
      expect(commandParser).toBeDefined();
      expect(commandParser).toBeInstanceOf(CommandParser);
      // Verify the instance uses the mock by triggering an internal call
      commandParser.parse('look'); // Example command
      expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
    });
  });

  // --- Ticket 2: Constructor Tests (Section 6.1) ---
  describe('constructor', () => {
    // Test Case: CPARSE-C-001
    it('[CPARSE-C-001] should successfully instantiate with a valid mock GameDataRepository (AC1, AC3)', () => {
      // The instance 'commandParser' is created in beforeEach.
      // If beforeEach completes without error and the instance exists,
      // this test passes, confirming successful instantiation with the mock.
      expect(commandParser).toBeDefined();
      expect(commandParser).toBeInstanceOf(CommandParser);
      // Optional: Verify the internal repository was set (though it's private)
      // This can be implicitly verified by checking if parse calls the mock method
      commandParser.parse('test');
      expect(mockGetAllActionDefinitions).toHaveBeenCalled();
    });

    // Test Case: CPARSE-C-002
    it('[CPARSE-C-002] should throw specific error if repository is null (AC2)', () => {
      // We need to bypass the beforeEach setup for this specific test
      // by calling the constructor directly with invalid input.
      const expectedError =
        'CommandParser requires a GameDataRepository instance.';
      // The arrow function wrapper is necessary for Jest to catch the thrown error.
      expect(() => new CommandParser(null)).toThrow(expectedError);
    });

    // Test Case: CPARSE-C-003
    it('[CPARSE-C-003] should throw specific error if repository is undefined (AC2)', () => {
      const expectedError =
        'CommandParser requires a GameDataRepository instance.';
      expect(() => new CommandParser(undefined)).toThrow(expectedError);
    });

    // Test Case: CPARSE-C-004
    it('[CPARSE-C-004] should throw specific error if repository object lacks getAllActionDefinitions method (AC2)', () => {
      const invalidRepo = { name: 'InvalidRepoWithoutMethod' }; // Missing the required method
      const expectedError =
        "CommandParser requires GameDataRepository with 'getAllActionDefinitions'.";
      // Need to cast to 'any' or use // @ts-ignore if using TypeScript to bypass type checks during test setup
      expect(() => new CommandParser(invalidRepo)).toThrow(expectedError);

      // Also test with an empty object
      expect(() => new CommandParser({})).toThrow(expectedError);
    });

    // Test Case: CPARSE-C-005
    it('[CPARSE-C-005] should throw specific error if repository.getAllActionDefinitions is not a function (AC2)', () => {
      // Create mock repositories where getAllActionDefinitions exists but is the wrong type
      const repoWithWrongTypeString = {
        getAllActionDefinitions: 'i am not a function',
      };
      const repoWithWrongTypeNumber = { getAllActionDefinitions: 123 };
      const repoWithWrongTypeNull = { getAllActionDefinitions: null };
      const repoWithWrongTypeObject = { getAllActionDefinitions: {} };

      const expectedError =
        "CommandParser requires GameDataRepository with 'getAllActionDefinitions'.";

      expect(() => new CommandParser(repoWithWrongTypeString)).toThrow(
        expectedError
      );
      expect(() => new CommandParser(repoWithWrongTypeNumber)).toThrow(
        expectedError
      );
      expect(() => new CommandParser(repoWithWrongTypeNull)).toThrow(
        expectedError
      );
      expect(() => new CommandParser(repoWithWrongTypeObject)).toThrow(
        expectedError
      );
    });
  });

  // --- Placeholder for future Parse Method Tests ---
  describe('parse() method', () => {
    // --- Tests for parse() method will be added in subsequent tickets ---
    it('should exist as a method on the CommandParser instance', () => {
      expect(typeof commandParser.parse).toBe('function');
    });

    it('placeholder test: should call repository.getAllActionDefinitions when invoked', () => {
      // Clear mocks from beforeEach call if necessary, though beforeEach already clears
      // mockGetAllActionDefinitions.mockClear();
      commandParser.parse('some command');
      expect(mockGetAllActionDefinitions).toHaveBeenCalled();
      expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1); // Since beforeEach doesn't call parse
    });
  });
});
