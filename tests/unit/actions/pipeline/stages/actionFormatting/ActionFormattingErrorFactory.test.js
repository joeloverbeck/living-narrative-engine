import { ActionFormattingErrorFactory } from '../../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingErrorFactory.js';

describe('ActionFormattingErrorFactory', () => {
  let buildErrorContext;
  let factory;

  beforeEach(() => {
    buildErrorContext = jest.fn((payload) => ({
      ...payload,
      built: true,
    }));

    factory = new ActionFormattingErrorFactory({
      errorContextBuilder: { buildErrorContext },
    });
  });

  it('converts formatter result objects into structured error payloads', () => {
    const actionDef = { id: 'action-1', name: 'Test' };
    const errorResult = {
      error: new Error('formatting failed'),
      details: { reason: 'bad target' },
    };

    const error = factory.create({
      errorOrResult: errorResult,
      actionDef,
      actorId: 'actor-1',
      trace: { id: 'trace' },
      fallbackTargetId: 'fallback-target',
    });

    expect(buildErrorContext).toHaveBeenCalledWith({
      actionDef,
      actorId: 'actor-1',
      additionalContext: {
        formatDetails: { reason: 'bad target' },
        stage: 'action_formatting',
      },
      error: errorResult.error,
      phase: 'validation',
      targetId: 'fallback-target',
      trace: { id: 'trace' },
    });
    expect(error).toEqual({
      actionDef,
      actorId: 'actor-1',
      additionalContext: {
        formatDetails: { reason: 'bad target' },
        stage: 'action_formatting',
      },
      built: true,
      error: errorResult.error,
      phase: 'validation',
      targetId: 'fallback-target',
      trace: { id: 'trace' },
    });
  });

  it('extracts target identifiers from error objects and marks thrown errors', () => {
    const actionDef = { id: 'action-2', name: 'Thrown' };
    const thrownError = new Error('boom');
    // @ts-ignore
    thrownError.target = { entityId: 'target-123' };

    const error = factory.create({
      errorOrResult: thrownError,
      actionDef,
      actorId: 'actor-2',
      trace: undefined,
    });

    expect(buildErrorContext).toHaveBeenCalledWith({
      actionDef,
      actorId: 'actor-2',
      additionalContext: {
        stage: 'action_formatting',
        thrown: true,
      },
      error: thrownError,
      phase: 'validation',
      targetId: 'target-123',
      trace: undefined,
    });
    expect(error).toEqual({
      actionDef,
      actorId: 'actor-2',
      additionalContext: {
        stage: 'action_formatting',
        thrown: true,
      },
      built: true,
      error: thrownError,
      phase: 'validation',
      targetId: 'target-123',
      trace: undefined,
    });
  });
});
