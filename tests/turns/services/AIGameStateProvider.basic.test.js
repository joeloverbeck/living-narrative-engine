// tests/turns/services/AIGameStateProvider.test.js
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AIGameStateProvider } from '../../../src/turns/services/AIGameStateProvider.js';

describe('AIGameStateProvider', () => {
  let mockActorStateProvider;
  let mockActorDataExtractor;
  let mockLocationSummaryProvider;
  let mockPerceptionLogProvider;
  let provider;
  let mockActor;
  let mockTurnContext;
  let mockLogger;

  beforeEach(() => {
    // Mock all direct dependencies of AIGameStateProvider
    mockActorStateProvider = { build: jest.fn() };
    mockActorDataExtractor = { extractPromptData: jest.fn() };
    mockLocationSummaryProvider = { build: jest.fn() };
    mockPerceptionLogProvider = { get: jest.fn() };

    // Instantiate the provider with mocked dependencies
    provider = new AIGameStateProvider({
      actorStateProvider: mockActorStateProvider,
      actorDataExtractor: mockActorDataExtractor,
      locationSummaryProvider: mockLocationSummaryProvider,
      perceptionLogProvider: mockPerceptionLogProvider,
    });

    // Setup common test data
    mockActor = { id: 'actor-1' };
    mockTurnContext = {
      /* context properties */
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('should correctly orchestrate calls to its dependent providers', async () => {
    // Arrange: Define the return values for each mock
    const expectedActorState = { id: 'actor-1', name: 'Mock Actor' };
    const expectedPromptData = { name: 'Mock Actor', description: 'A mock.' };
    const expectedLocationSummary = { name: 'Mock Location', exits: [] };
    const expectedPerceptionLog = [{ description: 'Something happened.' }];

    mockActorStateProvider.build.mockReturnValue(expectedActorState);
    mockActorDataExtractor.extractPromptData.mockReturnValue(
      expectedPromptData
    );
    mockLocationSummaryProvider.build.mockResolvedValue(
      expectedLocationSummary
    );
    mockPerceptionLogProvider.get.mockResolvedValue(expectedPerceptionLog);

    // Act: Call the method under test
    await provider.buildGameState(mockActor, mockTurnContext, mockLogger);

    // Assert: Verify that each dependency was called correctly
    expect(mockActorStateProvider.build).toHaveBeenCalledWith(
      mockActor,
      mockLogger
    );
    expect(mockActorDataExtractor.extractPromptData).toHaveBeenCalledWith(
      expectedActorState
    );
    expect(mockLocationSummaryProvider.build).toHaveBeenCalledWith(
      mockActor,
      mockLogger
    );
    expect(mockPerceptionLogProvider.get).toHaveBeenCalledWith(
      mockActor,
      mockLogger
    );
  });

  it('should build a complete AIGameStateDTO with availableActions set to null', async () => {
    // Arrange: Define mock return values
    const expectedActorState = { id: 'actor-1' };
    const expectedPromptData = { name: 'Actor' };
    const expectedLocationSummary = { name: 'Location' };
    const expectedPerceptionLog = [];

    mockActorStateProvider.build.mockReturnValue(expectedActorState);
    mockActorDataExtractor.extractPromptData.mockReturnValue(
      expectedPromptData
    );
    mockLocationSummaryProvider.build.mockResolvedValue(
      expectedLocationSummary
    );
    mockPerceptionLogProvider.get.mockResolvedValue(expectedPerceptionLog);

    // Act: Call the method under test
    const gameState = await provider.buildGameState(
      mockActor,
      mockTurnContext,
      mockLogger
    );

    // Assert: Verify the structure and content of the returned DTO
    expect(gameState).toBeDefined();
    expect(gameState.actorState).toBe(expectedActorState);
    expect(gameState.actorPromptData).toBe(expectedPromptData);
    expect(gameState.currentLocation).toBe(expectedLocationSummary);
    expect(gameState.perceptionLog).toBe(expectedPerceptionLog);
    expect(gameState.availableActions).toBeNull(); // Crucial check for the refactor
  });

  it('should throw an error if the actor is invalid', async () => {
    await expect(
      provider.buildGameState(null, mockTurnContext, mockLogger)
    ).rejects.toThrow('AIGameStateProvider: Actor is invalid or missing ID.');
  });

  it('should throw an error if the turn context is invalid', async () => {
    await expect(
      provider.buildGameState(mockActor, null, mockLogger)
    ).rejects.toThrow(
      'AIGameStateProvider: TurnContext is invalid for actor actor-1.'
    );
  });
});
