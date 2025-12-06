/**
 * @file Integration tests validating ProcessingCommandState thought dispatch behavior
 *        to ensure buildThoughtPayload is exercised with real collaborators.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import { ENTITY_THOUGHT_ID } from '../../../../src/constants/eventIds.js';

/**
 * Helper to create a minimal ProcessingCommandState configured with simple stubs.
 * The goal is to exercise the real _dispatchSpeech flow without mocking
 * buildThoughtPayload or dispatchThoughtEvent.
 */
describe('ProcessingCommandState thought payload integration', () => {
  let dispatcher;
  let turnContext;
  let handler;
  let mockLogger;
  let state;

  const createState = () =>
    new ProcessingCommandState({
      handler,
      commandProcessor: {},
      commandOutcomeInterpreter: {},
      commandString: 'examine surroundings',
      turnAction: { actionDefinitionId: 'core:examine' },
      directiveResolver: { resolve: jest.fn() },
      processingWorkflowFactory: jest.fn(() => ({
        run: jest.fn().mockResolvedValue(undefined),
      })),
      commandProcessingWorkflowFactory: jest.fn(() => ({
        processCommand: jest.fn().mockResolvedValue(undefined),
      })),
    });

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    dispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    turnContext = {
      getSafeEventDispatcher: jest.fn(() => dispatcher),
      getLogger: jest.fn(() => mockLogger),
    };

    handler = {
      getLogger: jest.fn(() => mockLogger),
      getTurnContext: jest.fn(() => turnContext),
      getSafeEventDispatcher: jest.fn(() => dispatcher),
      resetStateAndResources: jest.fn().mockResolvedValue(undefined),
      requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
    };

    state = createState();
  });

  it('dispatches ENTITY_THOUGHT_ID with sanitized payload when only thoughts are provided', async () => {
    const actor = { id: 'actor-7' };
    const decisionMeta = {
      thoughts: '  Evaluate the control room layout before moving forward.  ',
      notes: 'Remember to disable the alarms first.',
    };

    await state._dispatchSpeech(turnContext, actor, decisionMeta);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      ENTITY_THOUGHT_ID,
      expect.objectContaining({
        entityId: actor.id,
        thoughts: 'Evaluate the control room layout before moving forward.',
        notes: 'Remember to disable the alarms first.',
      })
    );

    const debugMessages = mockLogger.debug.mock.calls.map(
      ([message]) => message
    );
    expect(
      debugMessages.some(
        (msg) =>
          typeof msg === 'string' &&
          msg.includes(`Dispatching ${ENTITY_THOUGHT_ID}`)
      )
    ).toBe(true);
  });

  it('omits notes when not supplied while still dispatching trimmed thoughts', async () => {
    const actor = { id: 'actor-8' };
    const decisionMeta = {
      thoughts: '\nPlan the extraction route.  ',
    };

    await state._dispatchSpeech(turnContext, actor, decisionMeta);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const [, payload] = dispatcher.dispatch.mock.calls[0];
    expect(payload).toEqual({
      entityId: actor.id,
      thoughts: 'Plan the extraction route.',
    });
  });

  it('does not dispatch a thought event when thought content is missing or blank', async () => {
    const actor = { id: 'actor-9' };

    await state._dispatchSpeech(turnContext, actor, {
      thoughts: '   ',
      notes: 'Leftover note',
    });
    await state._dispatchSpeech(turnContext, actor, null);

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalled();
  });
});
