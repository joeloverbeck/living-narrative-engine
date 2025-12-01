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
      index: 1,
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
          chosenIndex: 1,
        }),
        availableActions: [fakeComposite],
        suggestedIndex: 1,
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

  it('throws NoDecisionMadeError when decisionProvider returns null chosenIndex and no fallback factory', async () => {
    // Arrange
    const fakeActor = { id: 'actor3' };
    const fakeContext = {
      getActor: () => fakeActor,
      getPromptSignal: () => null,
    };

    const fakeComposite = { actionDefinitionId: 'testAction' };
    const choicePipeline = {
      buildChoices: jest.fn().mockResolvedValue([fakeComposite]),
    };
    const decisionProvider = {
      decide: jest
        .fn()
        .mockResolvedValue({ chosenIndex: null, speech: null, thoughts: null }),
    };
    const turnActionFactory = { create: jest.fn() };
    const logger = { debug: jest.fn() };

    const strategy = new GenericTurnStrategy({
      choicePipeline,
      decisionProvider,
      turnActionFactory,
      logger,
      fallbackFactory: null,
    });

    // Act & Assert
    await expect(strategy.decideAction(fakeContext)).rejects.toThrow(
      'No decision could be made for actor actor3'
    );
    await expect(strategy.decideAction(fakeContext)).rejects.toMatchObject({
      name: 'NoDecisionMadeError',
    });

    // Verify that turnActionFactory.create was never called with undefined
    expect(turnActionFactory.create).not.toHaveBeenCalled();
  });

  it('returns fallback decision when decisionProvider returns null chosenIndex and fallback factory provided', async () => {
    // Arrange
    const fakeActor = { id: 'actor4' };
    const fakeContext = {
      getActor: () => fakeActor,
      getPromptSignal: () => null,
    };

    const fakeComposite = { actionDefinitionId: 'testAction' };
    const choicePipeline = {
      buildChoices: jest.fn().mockResolvedValue([fakeComposite]),
    };
    const decisionProvider = {
      decide: jest.fn().mockResolvedValue({
        chosenIndex: null,
        speech: 'I am uncertain what to do.',
        thoughts: null,
        notes: null,
      }),
    };
    const turnActionFactory = { create: jest.fn() };
    const fallbackAction = {
      actionDefinitionId: 'fallback:wait',
      speech: 'fallback speech',
    };
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

    // Act
    const result = await strategy.decideAction(fakeContext);

    // Assert
    expect(result).toEqual({
      kind: 'fallback',
      action: fallbackAction,
      extractedData: { speech: 'fallback speech', thoughts: null, notes: null },
    });

    // Verify fallback factory was called with correct parameters
    expect(fallbackFactory.create).toHaveBeenCalledWith(
      'NoDecisionMadeError',
      expect.any(Error),
      'actor4',
      {}
    );

    // Verify that turnActionFactory.create was never called with undefined
    expect(turnActionFactory.create).not.toHaveBeenCalled();
  });
});
