// src/tests/commandParser.parse.prepositionEdgeCases.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CommandParser from '../../src/commands/commandParser.js'; // Class under test
// Import the *named export* for type hinting and mocking purposes
import { GameDataRepository } from '../../src/data/gameDataRepository.js'; // Use named import
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
 * Includes actions needed for the preposition edge case tests (Ticket 7).
 *
 * @type {ReadonlyArray<ActionDefinition>}
 */
const MOCK_ACTIONS = Object.freeze([
  // Actions specifically required by Ticket 7 tests
  { id: 'core:go', commandVerb: 'go', name: 'Go' },
  { id: 'core:give', commandVerb: 'give', name: 'Give' }, // Needed for CPARSE-P-041
  { id: 'core:look', commandVerb: 'look', name: 'Look' },
  { id: 'core:put', commandVerb: 'put', name: 'Put' },
  // Include others for broader context if needed
  { id: 'core:inventory', commandVerb: 'inventory', name: 'Inventory' },
  { id: 'core:take', commandVerb: 'take', name: 'Take' },
  { id: 'core:use', commandVerb: 'use', name: 'Use' },
  { id: 'core:talk', commandVerb: 'talk', name: 'Talk' },
  { id: 'core:read', commandVerb: 'read', name: 'Read' },
]);

// --- Test Suite for Parse Method (Preposition Handling Edge Cases) ---
describe('CommandParser.parse() - Preposition Handling Edge Cases', () => {
  /** @type {CommandParser} */
  let commandParser;
  /** @type {GameDataRepository} */
  let mockRepositoryInstance; // Holds the specific mock instance

  // --- Standard beforeEach Setup (From Ticket 1) ---
  beforeEach(() => {
    // Clear mock history before each test for isolation
    jest.clearAllMocks(); // Clears calls to mockGetAllActionDefinitions AND the mock constructor

    // Provide the default mock return value (a fresh copy each time)
    // Ensures this suite uses the actions defined above.
    mockGetAllActionDefinitions.mockReturnValue([...MOCK_ACTIONS]);

    // Instantiate the *mocked* GameDataRepository.
    mockRepositoryInstance = new GameDataRepository(); // Calls the mock constructor

    // Instantiate the CommandParser with the *instance* returned by the mock repository constructor
    commandParser = new CommandParser(mockRepositoryInstance);
  });

  // --- Test Cases (CPARSE-P-040 to CPARSE-P-045) ---

  // Test Case: CPARSE-P-040 (Unsupported preposition treated as DO)
  it('[CPARSE-P-040] should parse "go towards village", treating unsupported "towards" as part of DO (AC1, AC2, AC5)', () => {
    const input = 'go towards village';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:go',
      directObjectPhrase: 'towards village', // "towards" is not supported, so part of DO
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null, // Structurally valid
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC1, AC5
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
    // AC2 confirmed: 'towards' ignored as preposition
  });

  // Test Case: CPARSE-P-041 (First supported preposition dictates split)
  it('[CPARSE-P-041] should parse "give scroll to wizard with staff", splitting at the first preposition "to" (AC1, AC3, AC5)', () => {
    const input = 'give scroll to wizard with staff';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:give',
      directObjectPhrase: 'scroll',
      preposition: 'to', // First supported preposition
      indirectObjectPhrase: 'wizard with staff', // Remainder including "with"
      originalInput: input,
      error: null, // Structurally valid
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC1, AC5
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
    // AC3 confirmed: 'to' used for split, 'with' is part of IO
  });

  // Test Case: CPARSE-P-042 (Case-insensitive preposition matching)
  it('[CPARSE-P-042] should parse "look aT map", recognizing "aT" as "at" (case-insensitive) (AC1, AC2, AC5)', () => {
    const input = 'look aT map';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:look',
      directObjectPhrase: null, // V+P+IO structure
      preposition: 'at', // Matched case-insensitively, stored lowercase
      indirectObjectPhrase: 'map',
      originalInput: input,
      error: null, // Structurally valid
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC1, AC5
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
    // AC2 confirmed: Case-insensitive match successful
  });

  // Test Case: CPARSE-P-043 (Preposition requires surrounding whitespace)
  it('[CPARSE-P-043] should parse "put keyin box", treating "keyin" as part of DO due to missing whitespace (AC1, AC4, AC5)', () => {
    const input = 'put keyin box';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:put',
      directObjectPhrase: 'keyin box', // "in" not detected without whitespace
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null, // Structurally valid
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC1, AC5
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
    // AC4 confirmed: Lack of whitespace prevents 'in' detection
  });

  // Test Case: CPARSE-P-044 (Regression: V+P+IO)
  it('[CPARSE-P-044] should parse "look on table" correctly (V+P+IO regression check) (AC1, AC5)', () => {
    const input = 'look on table';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:look',
      directObjectPhrase: null,
      preposition: 'on',
      indirectObjectPhrase: 'table',
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC1, AC5
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  // Test Case: CPARSE-P-045 (Regression: V+DO+P)
  it('[CPARSE-P-045] should parse "put key on" correctly (V+DO+P regression check) (AC1, AC5)', () => {
    const input = 'put key on';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:put',
      directObjectPhrase: 'key',
      preposition: 'on',
      indirectObjectPhrase: null, // Missing IO
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);

    expect(result).toEqual(expectedOutput); // AC1, AC5
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });
});
