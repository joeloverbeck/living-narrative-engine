// src/tests/commands/commandParser.parse.direction.test.js

// --- Imports ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CommandParser from '../../src/commands/commandParser.js'; // Adjusted path to CommandParser
import { GameDataRepository } from '../../src/data/gameDataRepository.js'; // Adjusted path for GameDataRepository

// --- Type Imports ---
// Adjust paths assuming this test file is in src/tests/commands/
/** @typedef {import('../../../../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */

// --- Mock GameDataRepository ---
// This function will be the mock for GameDataRepository.prototype.getAllActionDefinitions
const mockGetAllActionDefinitions = jest.fn();

// Mock the GameDataRepository module
jest.mock('../../src/data/gameDataRepository.js', () => {
  // Adjusted path for mocking
  // Define the mock constructor function for GameDataRepository
  const MockGameDataRepository = jest.fn().mockImplementation(() => {
    // The instance of the mocked repository will have this structure
    return {
      getAllActionDefinitions: mockGetAllActionDefinitions,
      // Add other methods if CommandParser constructor or other logic needs them
    };
  });
  // The factory function must return an object mapping named exports to their mocks
  return {
    GameDataRepository: MockGameDataRepository, // Ensure GameDataRepository is correctly mocked as a named export
  };
});

// --- Define Mock Action Definitions for These Tests ---
/**
 * Reusable set of mock ActionDefinition objects, including target_domain.
 *
 * @type {ReadonlyArray<ActionDefinition>}
 */
const MOCK_ACTIONS_DIRECTION_HANDLING = Object.freeze([
  { id: 'core:go', commandVerb: 'go', name: 'Go', target_domain: 'direction' },
  {
    id: 'core:move',
    commandVerb: 'move',
    name: 'Move',
    target_domain: 'direction',
  },
  {
    id: 'core:put',
    commandVerb: 'put',
    name: 'Put',
    target_domain: 'item_on_surface',
  }, // Not 'direction'
  { id: 'core:examine', commandVerb: 'examine', name: 'Examine' }, // target_domain might be undefined or different
  {
    id: 'core:take',
    commandVerb: 'take',
    name: 'Take',
    target_domain: 'item_in_room',
  }, // Not 'direction'
  {
    id: 'core:look',
    commandVerb: 'look',
    name: 'Look',
    target_domain: 'general',
  }, // Example, not 'direction'
]);

// --- Test Suite for CommandParser.parse() - Direction Handling ---
describe('CommandParser.parse() - Direction Handling Tests', () => {
  /** @type {CommandParser} */
  let commandParser;

  beforeEach(() => {
    // Clear mock history and any previous implementations/return values
    jest.clearAllMocks();

    // Set the mock return value for getAllActionDefinitions for this suite
    mockGetAllActionDefinitions.mockReturnValue([
      ...MOCK_ACTIONS_DIRECTION_HANDLING,
    ]);

    // Instantiate CommandParser with a new (mocked) GameDataRepository instance
    // The 'new GameDataRepository()' will call our mock constructor from jest.mock
    commandParser = new CommandParser(new GameDataRepository());
  });

  it('should parse "go out to town" correctly when target_domain is "direction"', () => {
    const input = 'go out to town';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:go',
      directObjectPhrase: 'out to town',
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
    expect(mockGetAllActionDefinitions).toHaveBeenCalledTimes(1);
  });

  it('should parse "go to the market" correctly (preposition part of direction) when target_domain is "direction"', () => {
    const input = 'go to the market';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:go',
      directObjectPhrase: 'to the market',
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };

    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
  });

  it('should parse "move north-east" correctly (single phrase direction) when target_domain is "direction"', () => {
    const input = 'move north-east';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:move',
      directObjectPhrase: 'north-east',
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };
    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
  });

  it('should parse "go quickly to the west exit" (adverb before multi-word direction) when target_domain is "direction"', () => {
    const input = 'go quickly to the west exit';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:go',
      directObjectPhrase: 'quickly to the west exit',
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };
    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
  });

  it('should still parse "put book on table" with preposition when target_domain is not "direction"', () => {
    const input = 'put book on table';
    // MOCK_ACTIONS_DIRECTION_HANDLING has 'core:put' with target_domain: 'item_on_surface'
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:put',
      directObjectPhrase: 'book',
      preposition: 'on',
      indirectObjectPhrase: 'table',
      originalInput: input,
      error: null,
    };
    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
  });

  it('should parse "examine the old manuscript" (no preposition in input) when target_domain is not "direction"', () => {
    const input = 'examine the old manuscript';
    // MOCK_ACTIONS_DIRECTION_HANDLING has 'core:examine' without target_domain or one that isn't 'direction'
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:examine',
      directObjectPhrase: 'the old manuscript',
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };
    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
  });

  it('should parse "take note with feather" (preposition present) when target_domain is not "direction"', () => {
    const input = 'take note with feather';
    // MOCK_ACTIONS_DIRECTION_HANDLING has 'core:take' with target_domain: 'item_in_room'
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:take',
      directObjectPhrase: 'note',
      preposition: 'with',
      indirectObjectPhrase: 'feather',
      originalInput: input,
      error: null,
    };
    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
  });

  it('should parse "look" (simple command) correctly when its target_domain is not "direction"', () => {
    const input = 'look';
    // MOCK_ACTIONS_DIRECTION_HANDLING has 'core:look' with target_domain: 'general'
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:look',
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };
    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
  });

  it('should parse "go" (verb only, target_domain "direction") correctly, resulting in null phrases', () => {
    const input = 'go';
    /** @type {ParsedCommand} */
    const expectedOutput = {
      actionId: 'core:go',
      directObjectPhrase: null,
      preposition: null,
      indirectObjectPhrase: null,
      originalInput: input,
      error: null,
    };
    const result = commandParser.parse(input);
    expect(result).toEqual(expectedOutput);
  });
});
