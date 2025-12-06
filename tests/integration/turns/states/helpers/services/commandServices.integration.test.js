import { describe, it, expect, beforeEach } from '@jest/globals';
import { CommandDispatcher } from '../../../../../../src/turns/states/helpers/services/commandDispatcher.js';
import { ResultInterpreter } from '../../../../../../src/turns/states/helpers/services/resultInterpreter.js';
import { DirectiveExecutor } from '../../../../../../src/turns/states/helpers/services/directiveExecutor.js';
import { UnifiedErrorHandler } from '../../../../../../src/actions/errors/unifiedErrorHandler.js';

class TestLogger {
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

class TestActionErrorContextBuilder {
  constructor() {
    this.contexts = [];
  }

  buildErrorContext(context) {
    const snapshot = {
      ...context,
      additionalContext: { ...context.additionalContext },
    };
    this.contexts.push(snapshot);
    return snapshot;
  }
}

class TestTurnContext {
  constructor(actor, logger) {
    this._actor = actor;
    this._logger = logger;
  }

  getActor() {
    return this._actor;
  }

  setActor(actor) {
    this._actor = actor;
  }

  getLogger() {
    return this._logger;
  }
}

class TestCommandProcessor {
  constructor({ onDispatch, result } = {}) {
    this.onDispatch = onDispatch;
    this.result = result ?? { success: true, data: 'ok' };
    this.calls = [];
  }

  async dispatchAction(actor, turnAction) {
    this.calls.push({ actor, turnAction });
    if (this.onDispatch) {
      return await this.onDispatch(actor, turnAction);
    }
    return this.result;
  }
}

class TestCommandOutcomeInterpreter {
  constructor({ onInterpret, directive } = {}) {
    this.onInterpret = onInterpret;
    this.directive = directive ?? 'END_TURN_SUCCESS';
    this.calls = [];
  }

  async interpret(commandResult, turnContext) {
    this.calls.push({ commandResult, turnContext });
    if (this.onInterpret) {
      return await this.onInterpret(commandResult, turnContext);
    }
    return this.directive;
  }
}

class RecordingDirectiveStrategy {
  constructor() {
    this.executions = [];
  }

  async execute(turnContext, directiveType, commandResult) {
    this.executions.push({ turnContext, directiveType, commandResult });
  }
}

class TestDirectiveResolver {
  constructor(map = {}, { throwOnResolve = false } = {}) {
    this.map = map;
    this.throwOnResolve = throwOnResolve;
  }

  resolveStrategy(directiveType) {
    if (this.throwOnResolve) {
      throw new Error('resolution failure');
    }
    return this.map[directiveType] ?? null;
  }
}

describe('Command helper services integration', () => {
  let logger;
  let actionErrorContextBuilder;
  let errorHandler;
  let actor;
  let turnContext;

  beforeEach(() => {
    logger = new TestLogger();
    actionErrorContextBuilder = new TestActionErrorContextBuilder();
    errorHandler = new UnifiedErrorHandler({
      actionErrorContextBuilder,
      logger,
    });
    actor = { id: 'actor-123' };
    turnContext = new TestTurnContext(actor, logger);
  });

  it('runs dispatch → interpretation → directive execution successfully', async () => {
    const commandProcessor = new TestCommandProcessor();
    const dispatcher = new CommandDispatcher({
      commandProcessor,
      unifiedErrorHandler: errorHandler,
      logger,
    });

    const outcomeInterpreter = new TestCommandOutcomeInterpreter({
      directive: 'END_TURN_SUCCESS',
    });
    const interpreter = new ResultInterpreter({
      commandOutcomeInterpreter: outcomeInterpreter,
      unifiedErrorHandler: errorHandler,
      logger,
    });

    const strategy = new RecordingDirectiveStrategy();
    const resolver = new TestDirectiveResolver({
      END_TURN_SUCCESS: strategy,
    });
    const executor = new DirectiveExecutor({
      directiveStrategyResolver: resolver,
      unifiedErrorHandler: errorHandler,
      logger,
    });

    const turnAction = {
      actionDefinitionId: 'action:test',
      commandString: 'perform action',
    };

    const dispatchResult = await dispatcher.dispatch({
      turnContext,
      actor,
      turnAction,
      stateName: 'ProcessingCommandState',
    });

    expect(dispatchResult).not.toBeNull();
    expect(dispatchResult?.commandResult).toEqual({
      success: true,
      data: 'ok',
    });
    expect(commandProcessor.calls).toHaveLength(1);

    const interpretation = await interpreter.interpret({
      commandResult: dispatchResult.commandResult,
      turnContext,
      actorId: actor.id,
      stateName: 'ProcessingCommandState',
    });

    expect(interpretation).toEqual({ directiveType: 'END_TURN_SUCCESS' });
    expect(outcomeInterpreter.calls).toHaveLength(1);

    const executionResult = await executor.execute({
      turnContext,
      directiveType: interpretation.directiveType,
      commandResult: dispatchResult.commandResult,
      stateName: 'ProcessingCommandState',
    });

    expect(executionResult).toEqual({ executed: true, stateChanged: false });
    expect(strategy.executions).toHaveLength(1);
    expect(actionErrorContextBuilder.contexts).toHaveLength(0);
    expect(executor.validateDirective('END_TURN_SUCCESS')).toBe(true);
    expect(executor.hasStrategy('END_TURN_SUCCESS')).toBe(true);
  });

  it('reports dispatch failures and invalid contexts through the unified error handler', async () => {
    const commandProcessor = new TestCommandProcessor({
      onDispatch: async () => {
        throw new Error('dispatch blew up');
      },
    });
    const dispatcher = new CommandDispatcher({
      commandProcessor,
      unifiedErrorHandler: errorHandler,
      logger,
    });

    const turnAction = {
      actionDefinitionId: 'action:test',
      commandString: 'perform action',
    };

    const dispatchResult = await dispatcher.dispatch({
      turnContext,
      actor,
      turnAction,
      stateName: 'ProcessingCommandState',
    });

    expect(dispatchResult).toBeNull();
    expect(actionErrorContextBuilder.contexts).toHaveLength(1);
    const [context] = actionErrorContextBuilder.contexts;
    expect(context.phase).toBe('execution');
    expect(context.actorId).toBe(actor.id);
    expect(context.additionalContext.stage).toBe('command_processing_dispatch');

    const invalidContextResult = dispatcher.validateContextAfterDispatch({
      turnContext: {},
      expectedActorId: actor.id,
      stateName: 'ProcessingCommandState',
    });
    expect(invalidContextResult).toBe(false);
    expect(
      logger.warnEntries.some(([message]) =>
        message.includes('Turn context is invalid after dispatch')
      )
    ).toBe(true);

    const otherActorContext = new TestTurnContext(
      { id: 'different-actor' },
      logger
    );
    const mismatchResult = dispatcher.validateContextAfterDispatch({
      turnContext: otherActorContext,
      expectedActorId: actor.id,
      stateName: 'ProcessingCommandState',
    });
    expect(mismatchResult).toBe(false);
    expect(
      logger.warnEntries.some(([message]) =>
        message.includes('Context actor changed after dispatch')
      )
    ).toBe(true);
  });

  it('validates command results and surfaces interpretation errors', async () => {
    const outcomeInterpreter = new TestCommandOutcomeInterpreter({
      onInterpret: async () => 'FOLLOW_UP',
    });
    const interpreter = new ResultInterpreter({
      commandOutcomeInterpreter: outcomeInterpreter,
      unifiedErrorHandler: errorHandler,
      logger,
    });

    const validResult = { success: true, data: 'ok' };
    expect(interpreter.validateCommandResult(validResult)).toBe(true);

    const invalidResult = interpreter.validateCommandResult(null);
    expect(invalidResult).toBe(false);
    expect(
      logger.errorEntries.some(([message]) =>
        message.includes('Invalid command result')
      )
    ).toBe(true);

    const interpretation = await interpreter.interpret({
      commandResult: validResult,
      turnContext,
      actorId: actor.id,
      stateName: 'ProcessingCommandState',
    });
    expect(interpretation).toEqual({ directiveType: 'FOLLOW_UP' });

    const failingInterpreter = new ResultInterpreter({
      commandOutcomeInterpreter: new TestCommandOutcomeInterpreter({
        onInterpret: async () => null,
      }),
      unifiedErrorHandler: errorHandler,
      logger,
    });

    const failedInterpretation = await failingInterpreter.interpret({
      commandResult: validResult,
      turnContext,
      actorId: actor.id,
      stateName: 'ProcessingCommandState',
    });

    expect(failedInterpretation).toBeNull();
    expect(actionErrorContextBuilder.contexts).toHaveLength(1);
    const [{ additionalContext }] = actionErrorContextBuilder.contexts;
    expect(additionalContext.stage).toBe('command_processing_interpretation');
  });

  it('executes directive strategies and handles lookup or execution failures', async () => {
    const resolver = new TestDirectiveResolver({
      END_TURN_SUCCESS: new RecordingDirectiveStrategy(),
    });
    const executor = new DirectiveExecutor({
      directiveStrategyResolver: resolver,
      unifiedErrorHandler: errorHandler,
      logger,
    });

    const commandResult = { success: true };
    const executionResult = await executor.execute({
      turnContext,
      directiveType: 'END_TURN_SUCCESS',
      commandResult,
      stateName: 'ProcessingCommandState',
    });
    expect(executionResult).toEqual({ executed: true, stateChanged: false });

    const missingResult = await executor.execute({
      turnContext,
      directiveType: 'MISSING_DIRECTIVE',
      commandResult,
      stateName: 'ProcessingCommandState',
    });
    expect(missingResult).toEqual({ executed: false, stateChanged: false });
    expect(actionErrorContextBuilder.contexts).toHaveLength(1);
    expect(actionErrorContextBuilder.contexts[0].additionalContext.stage).toBe(
      'command_processing_directive_execution'
    );

    const throwingResolver = new TestDirectiveResolver(
      {},
      { throwOnResolve: true }
    );
    const throwingExecutor = new DirectiveExecutor({
      directiveStrategyResolver: throwingResolver,
      unifiedErrorHandler: errorHandler,
      logger,
    });

    expect(throwingExecutor.hasStrategy('ANY')).toBe(false);
    expect(
      logger.debugEntries.some(([message]) =>
        message.includes('No strategy found for directive')
      )
    ).toBe(true);

    const failingStrategy = new RecordingDirectiveStrategy();
    failingStrategy.execute = async () => {
      throw new Error('strategy failure');
    };

    const failingExecutor = new DirectiveExecutor({
      directiveStrategyResolver: new TestDirectiveResolver({
        FAILURE_DIRECTIVE: failingStrategy,
      }),
      unifiedErrorHandler: errorHandler,
      logger,
    });

    const failureOutcome = await failingExecutor.execute({
      turnContext,
      directiveType: 'FAILURE_DIRECTIVE',
      commandResult,
      stateName: 'ProcessingCommandState',
    });

    expect(failureOutcome).toEqual({ executed: false, stateChanged: false });
    expect(actionErrorContextBuilder.contexts).toHaveLength(2);
    expect(actionErrorContextBuilder.contexts[1].additionalContext.stage).toBe(
      'command_processing_directive_execution'
    );

    expect(executor.validateDirective('  ')).toBe(false);
    expect(
      logger.errorEntries.some(
        ([message]) =>
          message.includes('Invalid directive type') ||
          message.includes('Empty directive type')
      )
    ).toBe(true);
  });
});
