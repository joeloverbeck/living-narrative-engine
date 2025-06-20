import { jest, describe, expect } from '@jest/globals';
import { GenericTurnStrategy } from '../../../../src/turns/strategies/genericTurnStrategy.js';

describe('GenericTurnStrategy', () => {
  it('builds choices, delegates decision, creates turnAction, and returns a frozen result', async () => {
    // Arrange
    const fakeActor = { id: 'actor1' };
    const fakeContext = {
      getActor: () => fakeActor,
      getPromptSignal: () => null,
    };

    const fakeComposite = {
      actionDefinitionId: 'testAction',
      resolvedParameters: {},
    };
    const fakeTurnAction = {
      actionDefinitionId: 'testAction',
      resolvedParameters: {},
    };

    const choicePipeline = {
      buildChoices: jest.fn().mockResolvedValue([fakeComposite]),
    };
    const decisionProvider = {
      decide: jest.fn().mockResolvedValue({ chosenIndex: 1 }),
    };
    const turnActionFactory = {
      create: jest.fn().mockReturnValue(fakeTurnAction),
    };
    const logger = { debug: jest.fn() };

    const strategy = new GenericTurnStrategy({
      choicePipeline,
      decisionProvider,
      turnActionFactory,
      logger,
    });

    // Act
    const result = await strategy.decideAction(fakeContext);

    // Assert calls
    expect(choicePipeline.buildChoices).toHaveBeenCalledWith(
      fakeActor,
      fakeContext
    );
    expect(decisionProvider.decide).toHaveBeenCalledWith(
      fakeActor,
      fakeContext,
      [fakeComposite],
      null
    );
    expect(turnActionFactory.create).toHaveBeenCalledWith(fakeComposite, null);
    expect(logger.debug).toHaveBeenCalledWith(
      `[GenericStrategy] actor1 chose testAction`
    );

    // Assert returned value
    expect(result).toEqual(
      Object.freeze({
        kind: 'success',
        action: fakeTurnAction,
        extractedData: Object.freeze({
          speech: null,
          thoughts: null,
          notes: null,
        }),
      })
    );

    // Assert immutability
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.extractedData)).toBe(true);
  });

  it('returns fallback decision when an error occurs and factory provided', async () => {
    const fakeActor = { id: 'actor2' };
    const fakeContext = {
      getActor: () => fakeActor,
      getPromptSignal: () => null,
    };

    const choicePipeline = {
      buildChoices: jest.fn().mockResolvedValue([]),
    };
    const decisionProvider = {
      decide: jest.fn().mockRejectedValue(new Error('fail')),
    };
    const turnActionFactory = { create: jest.fn() };
    const fallbackAction = { actionDefinitionId: 'fb', speech: 'wait' };
    const fallbackFactory = {
      create: jest.fn().mockReturnValue(fallbackAction),
    };
    const logger = { debug: jest.fn() };

    const strategy = new GenericTurnStrategy({
      choicePipeline,
      decisionProvider,
      turnActionFactory,
      logger,
      fallbackFactory,
    });

    const result = await strategy.decideAction(fakeContext);

    expect(result).toEqual({
      kind: 'fallback',
      action: fallbackAction,
      extractedData: { speech: 'wait', thoughts: null, notes: null },
    });
  });
});
