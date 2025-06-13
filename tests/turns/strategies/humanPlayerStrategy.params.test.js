/**
 * @file Test suite that proves the behavior of the new params that must be included when returning the decision of an action.
 * @see tests/turns/strategies/humanPlayerStrategy.params.test.js
 */

import { describe, beforeEach, expect } from '@jest/globals';
import { HumanPlayerStrategy } from '../../../src/turns/strategies/humanPlayerStrategy.js';
import { mock, mockDeep } from 'jest-mock-extended';
import Entity from '../../../src/entities/entity.js';

describe('HumanPlayerStrategy', () => {
  let strategy;
  let mockContext;
  let mockPlayerPromptService;
  let mockActor;
  let mockLogger;

  beforeEach(() => {
    strategy = new HumanPlayerStrategy();
    mockActor = new Entity('player-1', 'core:player');

    // Deep mock the turn context to mock chained calls like context.getLogger().debug()
    mockContext = mockDeep();

    // mockContext.getPlayerPromptService() needs to return our mock service
    mockPlayerPromptService = mock();
    mockContext.getPlayerPromptService.mockReturnValue(mockPlayerPromptService);

    // Mock other context methods used by the strategy
    mockContext.getActor.mockReturnValue(mockActor);

    // Provide a mock logger through the context
    mockLogger = mock();
    mockContext.getLogger.mockReturnValue(mockLogger);
  });

  it('should include resolvedParameters in the turn action from playerData.action.params', async () => {
    // Arrange
    const mockPlayerData = {
      action: {
        id: 'combat:attack',
        command: 'attack orc',
        params: { targetId: 'orc-1' }, // The parameters to test
      },
      speech: 'For the kingdom!',
    };
    mockPlayerPromptService.prompt.mockResolvedValue(mockPlayerData);

    // Act
    const result = await strategy.decideAction(mockContext);

    // Assert
    expect(result.kind).toBe('success');
    expect(result.action).toBeDefined();
    expect(result.action.actionDefinitionId).toBe('combat:attack');
    expect(result.action.commandString).toBe('attack orc');
    expect(result.action.speech).toBe('For the kingdom!');

    // Key assertion for parameters
    expect(result.action.resolvedParameters).toBeDefined();
    expect(result.action.resolvedParameters.targetId).toBe('orc-1');
  });

  it('should return a frozen action object to ensure immutability', async () => {
    // Arrange
    const mockPlayerData = {
      action: {
        id: 'core:move',
        command: 'go north',
        params: { direction: 'north' },
      },
      speech: null,
    };
    mockPlayerPromptService.prompt.mockResolvedValue(mockPlayerData);

    // Act
    const result = await strategy.decideAction(mockContext);

    // Assert
    expect(result.kind).toBe('success');
    expect(Object.isFrozen(result.action)).toBe(true);
  });

  it('should return the full success envelope including all extractedData fields', async () => {
    // Arrange
    const mockPlayerData = {
      action: {
        id: 'core:wait',
        command: 'wait',
      },
      speech: 'I will wait here.',
      thoughts: 'This seems like a good spot to rest.',
      notes: ['Remember to check the west corridor later.'],
    };
    mockPlayerPromptService.prompt.mockResolvedValue(mockPlayerData);

    // Act
    const result = await strategy.decideAction(mockContext);

    // Assert
    expect(result).toEqual({
      kind: 'success',
      action: expect.any(Object),
      extractedData: {
        speech: 'I will wait here.',
        thoughts: 'This seems like a good spot to rest.',
        notes: ['Remember to check the west corridor later.'],
      },
    });
  });

  it('should handle null or undefined for optional playerData fields gracefully', async () => {
    // Arrange
    const mockPlayerData = {
      action: {
        id: 'core:wait',
        command: 'wait',
        params: undefined, // Explicitly test undefined params
      },
      speech: null,
      thoughts: undefined,
      notes: null,
    };
    mockPlayerPromptService.prompt.mockResolvedValue(mockPlayerData);

    // Act
    const result = await strategy.decideAction(mockContext);

    // Assert
    expect(result.kind).toBe('success');
    // resolvedParameters should default to an empty object if params is null or undefined
    expect(result.action.resolvedParameters).toEqual({});
    // The speech property should not exist on the action object if it's null in playerData
    expect(result.action).not.toHaveProperty('speech');
    // extractedData should reflect the null/undefined values as null
    expect(result.extractedData).toEqual({
      speech: null,
      thoughts: null,
      notes: null,
    });
  });

  it('should trim whitespace from speech property when present', async () => {
    // Arrange
    const mockPlayerData = {
      action: {
        id: 'core:speak',
        command: 'say hello',
      },
      speech: '  Hello world!  ', // Speech with leading/trailing whitespace
    };
    mockPlayerPromptService.prompt.mockResolvedValue(mockPlayerData);

    // Act
    const result = await strategy.decideAction(mockContext);

    // Assert
    expect(result.action.speech).toBe('Hello world!');
    expect(result.extractedData.speech).toBe('  Hello world!  '); // Extracted data preserves original
  });
});
