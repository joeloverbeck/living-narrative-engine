// tests/turns/services/AIGameStateProvider.test.js
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AIGameStateProvider } from '../../../../src/turns/services/AIGameStateProvider.js';

describe('AIGameStateProvider constructor validation', () => {
  const createDependencies = () => ({
    actorStateProvider: { build: jest.fn() },
    actorDataExtractor: { extractPromptData: jest.fn() },
    locationSummaryProvider: { build: jest.fn() },
    perceptionLogProvider: { get: jest.fn() },
    safeEventDispatcher: { dispatch: jest.fn() },
  });

  it.each([
    [
      'actorStateProvider',
      undefined,
      'Missing required dependency: actorStateProvider.',
    ],
    [
      'actorDataExtractor',
      undefined,
      'Missing required dependency: actorDataExtractor.',
    ],
    [
      'locationSummaryProvider',
      undefined,
      'Missing required dependency: locationSummaryProvider.',
    ],
    [
      'perceptionLogProvider',
      undefined,
      'Missing required dependency: perceptionLogProvider.',
    ],
    [
      'safeEventDispatcher',
      undefined,
      'Missing required dependency: safeEventDispatcher.',
    ],
  ])('throws when %s is missing', (dependencyName, value, expectedMessage) => {
    const dependencies = createDependencies();
    dependencies[dependencyName] = value;
    expect(() => new AIGameStateProvider(dependencies)).toThrow(
      expectedMessage
    );
  });

  it('throws when actorStateProvider lacks build()', () => {
    const dependencies = createDependencies();
    dependencies.actorStateProvider = {};
    expect(() => new AIGameStateProvider(dependencies)).toThrow(
      "Invalid or missing method 'build' on dependency 'actorStateProvider'."
    );
  });

  it('throws when actorDataExtractor lacks extractPromptData()', () => {
    const dependencies = createDependencies();
    dependencies.actorDataExtractor = {};
    expect(() => new AIGameStateProvider(dependencies)).toThrow(
      "Invalid or missing method 'extractPromptData' on dependency 'actorDataExtractor'."
    );
  });

  it('throws when locationSummaryProvider lacks build()', () => {
    const dependencies = createDependencies();
    dependencies.locationSummaryProvider = {};
    expect(() => new AIGameStateProvider(dependencies)).toThrow(
      "Invalid or missing method 'build' on dependency 'locationSummaryProvider'."
    );
  });

  it('throws when perceptionLogProvider lacks get()', () => {
    const dependencies = createDependencies();
    dependencies.perceptionLogProvider = {};
    expect(() => new AIGameStateProvider(dependencies)).toThrow(
      "Invalid or missing method 'get' on dependency 'perceptionLogProvider'."
    );
  });

  it('throws when safeEventDispatcher lacks dispatch()', () => {
    const dependencies = createDependencies();
    dependencies.safeEventDispatcher = {};
    expect(() => new AIGameStateProvider(dependencies)).toThrow(
      "Invalid or missing method 'dispatch' on dependency 'safeEventDispatcher'."
    );
  });
});

describe('AIGameStateProvider', () => {
  let mockActorStateProvider;
  let mockActorDataExtractor;
  let mockLocationSummaryProvider;
  let mockPerceptionLogProvider;
  let mockSafeEventDispatcher;
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
    mockSafeEventDispatcher = { dispatch: jest.fn() };

    // Instantiate the provider with mocked dependencies
    provider = new AIGameStateProvider({
      actorStateProvider: mockActorStateProvider,
      actorDataExtractor: mockActorDataExtractor,
      locationSummaryProvider: mockLocationSummaryProvider,
      perceptionLogProvider: mockPerceptionLogProvider,
      safeEventDispatcher: mockSafeEventDispatcher,
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
      expectedActorState,
      'actor-1'
    );
    expect(mockLocationSummaryProvider.build).toHaveBeenCalledWith(
      mockActor,
      mockLogger
    );
    expect(mockPerceptionLogProvider.get).toHaveBeenCalledWith(
      mockActor,
      mockLogger,
      mockSafeEventDispatcher
    );
  });

  it('awaits the actor state provider before extracting prompt data', async () => {
    const expectedActorState = { id: 'actor-1', name: 'Resolved Actor' };
    const expectedPromptData = { name: 'Resolved Actor' };

    mockActorStateProvider.build.mockResolvedValue(expectedActorState);
    mockActorDataExtractor.extractPromptData.mockReturnValue(
      expectedPromptData
    );
    mockLocationSummaryProvider.build.mockResolvedValue(null);
    mockPerceptionLogProvider.get.mockResolvedValue([]);

    await provider.buildGameState(mockActor, mockTurnContext, mockLogger);

    expect(mockActorDataExtractor.extractPromptData).toHaveBeenCalledWith(
      expectedActorState,
      'actor-1'
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
