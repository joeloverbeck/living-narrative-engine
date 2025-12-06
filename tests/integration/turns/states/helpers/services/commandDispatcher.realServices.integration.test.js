import { describe, it, expect, jest } from '@jest/globals';
import { CommandDispatcher } from '../../../../../../src/turns/states/helpers/services/commandDispatcher.js';
import { UnifiedErrorHandler } from '../../../../../../src/actions/errors/unifiedErrorHandler.js';
import { ActionErrorContextBuilder } from '../../../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionIndex } from '../../../../../../src/actions/actionIndex.js';
import SimpleEntityManager from '../../../../../common/entities/simpleEntityManager.js';
import { TestDataFactory } from '../../../../../common/actions/testDataFactory.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(...args) {
    this.debugEntries.push(args);
  }

  info(...args) {
    this.infoEntries.push(args);
  }

  warn(...args) {
    this.warnEntries.push(args);
  }

  error(...args) {
    this.errorEntries.push(args);
  }
}

class TestGameDataRepository {
  getComponentDefinition(componentId) {
    return { id: componentId, name: `Component ${componentId}` };
  }

  getConditionDefinition(conditionId) {
    return {
      id: conditionId,
      description: `Condition ${conditionId}`,
      logic: { var: conditionId },
    };
  }
}

class HarnessCommandProcessor {
  constructor({ onDispatch } = {}) {
    this.onDispatch = onDispatch;
    this.dispatchCalls = [];
  }

  async dispatchAction(actor, turnAction) {
    this.dispatchCalls.push({ actor, turnAction });

    if (this.onDispatch) {
      return await this.onDispatch(actor, turnAction);
    }

    return {
      success: true,
      turnEnded: false,
      originalInput: turnAction.commandString ?? turnAction.actionDefinitionId,
      actionResult: { actionId: turnAction.actionDefinitionId },
    };
  }
}

/**
 *
 * @param root0
 * @param root0.onDispatch
 */
function createCommandDispatcherHarness({ onDispatch } = {}) {
  const logger = new RecordingLogger();

  const entityManager = new SimpleEntityManager([
    {
      id: 'hero-1',
      components: {
        'core:location': { value: 'command-center' },
        'core:status': { state: 'wounded', stamina: 2 },
        'core:inventory': { items: [] },
      },
    },
    {
      id: 'friend-1',
      components: {
        'core:location': { value: 'command-center' },
        'core:position': { locationId: 'command-center' },
      },
    },
  ]);

  const actions = TestDataFactory.createBasicActions();
  const actionIndex = new ActionIndex({ logger, entityManager });
  actionIndex.buildIndex(actions);

  const fixSuggestionEngine = new FixSuggestionEngine({
    logger,
    gameDataRepository: new TestGameDataRepository(),
    actionIndex,
  });

  const actionErrorContextBuilder = new ActionErrorContextBuilder({
    entityManager,
    logger,
    fixSuggestionEngine,
  });

  const unifiedErrorHandler = new UnifiedErrorHandler({
    actionErrorContextBuilder,
    logger,
  });

  const commandProcessor = new HarnessCommandProcessor({ onDispatch });

  const dispatcher = new CommandDispatcher({
    commandProcessor,
    unifiedErrorHandler,
    logger,
  });

  return {
    dispatcher,
    commandProcessor,
    unifiedErrorHandler,
    actionErrorContextBuilder,
    fixSuggestionEngine,
    actionIndex,
    entityManager,
    logger,
  };
}

describe('CommandDispatcher integration with real services', () => {
  it('dispatches actions successfully and preserves turn context', async () => {
    const harness = createCommandDispatcherHarness();
    const {
      dispatcher,
      commandProcessor,
      actionErrorContextBuilder,
      entityManager,
      logger,
    } = harness;

    const actor = entityManager.getEntityInstance('hero-1');
    const turnContext = { getActor: () => actor };
    const turnAction = {
      actionDefinitionId: 'movement:go',
      commandString: 'go to the plaza',
      resolvedParameters: { targetId: 'plaza' },
    };

    const buildSpy = jest.spyOn(actionErrorContextBuilder, 'buildErrorContext');

    const result = await dispatcher.dispatch({
      turnContext,
      actor,
      turnAction,
      stateName: 'ProcessingCommandState',
    });

    expect(result).not.toBeNull();
    expect(result?.turnContext).toBe(turnContext);
    expect(result?.commandResult).toEqual(
      expect.objectContaining({
        success: true,
        actionResult: { actionId: 'movement:go' },
        originalInput: 'go to the plaza',
      })
    );
    expect(commandProcessor.dispatchCalls).toHaveLength(1);

    const startLog = logger.debugEntries.find(([message]) =>
      message.includes('Invoking commandProcessor.dispatchAction')
    );
    expect(startLog).toBeDefined();
    const completionLog = logger.debugEntries.find(([message]) =>
      message.includes('Action dispatch completed')
    );
    expect(completionLog).toBeDefined();
    expect(buildSpy).not.toHaveBeenCalled();
  });

  it('handles dispatch failures by building actionable error context', async () => {
    const dispatchError = new Error(
      "Missing component 'core:position' on actor hero-1"
    );
    dispatchError.name = 'ComponentNotFoundError';

    const harness = createCommandDispatcherHarness({
      onDispatch: async () => {
        throw dispatchError;
      },
    });

    const { dispatcher, actionErrorContextBuilder, entityManager, logger } =
      harness;
    const actor = entityManager.getEntityInstance('hero-1');
    const turnContext = { getActor: () => actor };
    const turnAction = {
      actionDefinitionId: 'movement:go',
      commandString: 'go north',
    };

    const buildSpy = jest.spyOn(actionErrorContextBuilder, 'buildErrorContext');

    const result = await dispatcher.dispatch({
      turnContext,
      actor,
      turnAction,
      stateName: 'CommandPhase',
    });

    expect(result).toBeNull();
    expect(buildSpy).toHaveBeenCalledTimes(1);

    const context = buildSpy.mock.results[0].value;
    expect(context.phase).toBe('execution');
    expect(context.additionalContext).toEqual(
      expect.objectContaining({ stage: 'command_processing_dispatch' })
    );
    expect(context.environmentContext).toEqual(
      expect.objectContaining({
        stateName: 'CommandPhase',
        commandString: 'go north',
      })
    );
    expect(context.suggestedFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          details: expect.objectContaining({
            componentId: 'core:position',
            actorId: 'hero-1',
          }),
        }),
      ])
    );

    const errorLog = logger.errorEntries.find(([message]) =>
      message.includes('Error in execution phase')
    );
    expect(errorLog).toBeDefined();
    expect(errorLog?.[1]).toEqual(
      expect.objectContaining({
        actionId: 'movement:go',
        actorId: 'hero-1',
        stateName: 'CommandPhase',
        commandString: 'go north',
      })
    );
  });

  it('validates dispatch context integrity across scenarios', () => {
    const invalidHarness = createCommandDispatcherHarness();
    const invalidResult =
      invalidHarness.dispatcher.validateContextAfterDispatch({
        turnContext: null,
        expectedActorId: 'hero-1',
        stateName: 'PostDispatchCheck',
      });
    expect(invalidResult).toBe(false);
    expect(
      invalidHarness.logger.warnEntries.some(([message]) =>
        message.includes('Turn context is invalid after dispatch')
      )
    ).toBe(true);

    const mismatchHarness = createCommandDispatcherHarness();
    const mismatchContext = { getActor: () => ({ id: 'someone-else' }) };
    const mismatchResult =
      mismatchHarness.dispatcher.validateContextAfterDispatch({
        turnContext: mismatchContext,
        expectedActorId: 'hero-1',
        stateName: 'PostDispatchCheck',
      });
    expect(mismatchResult).toBe(false);
    expect(
      mismatchHarness.logger.warnEntries.some(([message]) =>
        message.includes('Context actor changed after dispatch')
      )
    ).toBe(true);

    const validHarness = createCommandDispatcherHarness();
    const actor = validHarness.entityManager.getEntityInstance('hero-1');
    const validContext = { getActor: () => actor };
    const validResult = validHarness.dispatcher.validateContextAfterDispatch({
      turnContext: validContext,
      expectedActorId: actor.id,
      stateName: 'PostDispatchCheck',
    });
    expect(validResult).toBe(true);
    expect(validHarness.logger.warnEntries).toHaveLength(0);
  });
});
