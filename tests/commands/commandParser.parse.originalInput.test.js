// src/tests/commandParser.parse.originalInput.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CommandParser from '../../src/commands/commandParser.js'; // Class under test
// Import the *named export* for type hinting and mocking purposes
import { GameDataRepository } from '../../src/data/gameDataRepository.js';
import { freeze } from '../../src/utils/objectUtils'; // Use named import
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../src/actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock GameDataRepository ---
// Mock function for the specific method we need
const mockGetAllActionDefinitions = jest.fn();

// Mock the entire GameDataRepository module
jest.mock('../../src/data/gameDataRepository.js', () => {
  // Define the mock constructor function
  const MockGameDataRepository = jest.fn().mockImplementation(() => {
    // This is what the mock constructor will return when called with 'new'
    return {
      getAllActionDefinitions: mockGetAllActionDefinitions,
      // Add mocks for other methods if CommandParser constructor or other tests need them
    };
  });
  // The factory function MUST return an object mapping named exports to their mocks
  return {
    GameDataRepository: MockGameDataRepository, // Map the named export
  };
});

// --- Define Mock Action Definitions (MOCK_ACTIONS) ---
/**
 * Reusable set of mock ActionDefinition objects for testing the parse method.
 * Includes actions relevant to the originalInput tests (look, take, put).
 *
 * @type {ReadonlyArray<ActionDefinition>}
 */
const MOCK_ACTIONS = freeze([
  // Actions potentially matched in the tests
  { id: 'core:look', commandVerb: 'look', name: 'Look' },
  { id: 'core:take', commandVerb: 'take', name: 'Take' },
  { id: 'core:put', commandVerb: 'put', name: 'Put' },
  // Include others for general repository completeness if desired, though not strictly needed here
  { id: 'core:inventory', commandVerb: 'inventory', name: 'Inventory' },
  { id: 'core:go', commandVerb: 'go', name: 'Go' },
]);

// --- Test Suite for Parse Method (Original Input Preservation) ---
describe('CommandParser.parse() - Original Input Preservation Tests (Ticket 8)', () => {
  /** @type {CommandParser} */
  let commandParser;
  /** @type {GameDataRepository} */
  let mockRepositoryInstance; // Holds the specific mock instance

  // --- Standard beforeEach Setup (From Ticket 1) ---
  beforeEach(() => {
    // Clear mock history before each test for isolation
    jest.clearAllMocks(); // Clears calls to mockGetAllActionDefinitions AND the mock constructor

    // Provide the default mock return value (a fresh copy each time)
    mockGetAllActionDefinitions.mockReturnValue([...MOCK_ACTIONS]);

    // Instantiate the *mocked* GameDataRepository.
    mockRepositoryInstance = new GameDataRepository(); // Calls the mock constructor

    // Instantiate the CommandParser with the *instance* returned by the mock repository constructor
    commandParser = new CommandParser(mockRepositoryInstance);
  });

  // --- Test Cases (CPARSE-P-050 to CPARSE-P-054) ---

  // Test Case: CPARSE-P-050
  it('[CPARSE-P-050] should preserve originalInput as "look" when parsing "look" (AC1, AC2)', () => {
    const input = 'look';
    const result = commandParser.parse(input);

    // AC2: Explicitly assert strict equality for originalInput
    expect(result.originalInput).toBe(input); // toBe performs strict equality (===) for primitives

    // Optional: Verify the rest of the parsing for context
    expect(result.actionId).toBe('core:look');
    expect(result.error).toBeNull();
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-051
  it('[CPARSE-P-051] should preserve originalInput as " take key " when parsing " take key " (AC1, AC2)', () => {
    const input = ' take key '; // Includes leading/trailing whitespace
    const result = commandParser.parse(input);

    // AC2: Explicitly assert strict equality for originalInput
    expect(result.originalInput).toBe(input); // Preserves whitespace

    // Optional: Verify the rest of the parsing for context
    expect(result.actionId).toBe('core:take');
    expect(result.directObjectPhrase).toBe('key'); // Parsing trims whitespace from DO
    expect(result.error).toBeNull();
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-052
  it('[CPARSE-P-052] should preserve originalInput as "PUT Key ON Table" when parsing "PUT Key ON Table" (AC1, AC2)', () => {
    const input = 'PUT Key ON Table'; // Includes mixed casing
    const result = commandParser.parse(input);

    // AC2: Explicitly assert strict equality for originalInput
    expect(result.originalInput).toBe(input); // Preserves original casing

    // Optional: Verify the rest of the parsing for context
    expect(result.actionId).toBe('core:put'); // Verb matched case-insensitively
    expect(result.directObjectPhrase).toBe('Key'); // DO preserves original case
    expect(result.preposition).toBe('on'); // Preposition stored lowercase
    expect(result.indirectObjectPhrase).toBe('Table'); // IO preserves original case
    expect(result.error).toBeNull();
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-053
  it('[CPARSE-P-053] should preserve originalInput as "flY High" when parsing unknown verb "flY High" (AC1, AC2)', () => {
    const input = 'flY High'; // Unknown verb, mixed case
    const result = commandParser.parse(input);

    // AC2: Explicitly assert strict equality for originalInput
    expect(result.originalInput).toBe(input); // Preserves original case even on error

    // Optional: Verify the rest of the parsing for context (error state)
    expect(result.actionId).toBeNull();
    expect(result.error).toBe('Internal Error: Command verb mismatch.');
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-054
  it('[CPARSE-P-054] should preserve originalInput as "" when parsing "" (empty string) (AC1, AC2)', () => {
    const input = ''; // Empty string input
    const result = commandParser.parse(input);

    // AC2: Explicitly assert strict equality for originalInput
    expect(result.originalInput).toBe(input);

    // Optional: Verify the rest of the parsing for context (empty input state)
    expect(result.actionId).toBeNull();
    expect(result.error).toBeNull();
    // Verify repository was still consulted even for empty string AFTER trim check
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });
});
