import EndTurnFailureStrategy from '../../../../src/turns/strategies/endTurnFailureStrategy.js';
import TurnDirective from '../../../../src/turns/constants/turnDirectives.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../../src/entities/entityInstanceData.js';
import Entity from '../../../../src/entities/entity.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { ServiceSetup } from '../../../../src/utils/serviceInitializerUtils.js';
import { requireContextActor } from '../../../../src/turns/strategies/strategyHelpers.js';

describe('EndTurnFailureStrategy integration', () => {
  /**
   *
   */
  function createActor() {
    const definition = new EntityDefinition('integration:actor', {
      description: 'Integration actor',
      components: {
        'core:name': { text: 'Integration Actor' },
      },
    });
    const instance = new EntityInstanceData('actor-id', definition);
    return new Entity(instance);
  }

  /**
   *
   */
  function createRecordingLogger() {
    const entries = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };

    const logger = {
      debug: (message, ...args) => entries.debug.push({ message, args }),
      info: (message, ...args) => entries.info.push({ message, args }),
      warn: (message, ...args) => entries.warn.push({ message, args }),
      error: (message, ...args) => entries.error.push({ message, args }),
    };

    return { logger, entries };
  }

  /**
   *
   * @param serviceName
   */
  function createTurnContext(
    serviceName = 'EndTurnFailureStrategyIntegration'
  ) {
    const actor = createActor();
    const { logger: baseLogger, entries } = createRecordingLogger();
    const serviceSetup = new ServiceSetup();
    const prefixedLogger = serviceSetup.createLogger(serviceName, baseLogger);
    const endTurnCalls = [];

    const turnContext = new TurnContext({
      actor,
      logger: prefixedLogger,
      services: {
        entityManager: {
          getComponentData: () => null,
          getEntityInstance: () => null,
        },
      },
      strategy: {
        async decideAction() {
          return { actionDefinitionId: 'noop' };
        },
      },
      onEndTurnCallback: (error) => {
        endTurnCalls.push(error);
      },
      handlerInstance: { _isDestroyed: false },
    });

    return { actor, entries, endTurnCalls, prefixedLogger, turnContext };
  }

  it('ends the turn with the provided Error from commandResult', async () => {
    const { turnContext, endTurnCalls, entries, actor } = createTurnContext();
    const strategy = new EndTurnFailureStrategy();
    const commandError = new Error('explicit failure');

    await strategy.execute(turnContext, TurnDirective.END_TURN_FAILURE, {
      error: commandError,
    });

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBe(commandError);
    expect(entries.info[0]?.message).toContain(
      `EndTurnFailureStrategy: Executing END_TURN_FAILURE for actor ${actor.id}`
    );
  });

  it('wraps non-Error payloads into Error instances before ending the turn', async () => {
    const { turnContext, endTurnCalls } = createTurnContext();
    const strategy = new EndTurnFailureStrategy();

    await strategy.execute(turnContext, TurnDirective.END_TURN_FAILURE, {
      error: 'timeout exceeded',
    });

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0]?.message).toBe('timeout exceeded');
  });

  it('falls back to a descriptive error when commandResult lacks error details', async () => {
    const { turnContext, endTurnCalls, actor } = createTurnContext();
    const strategy = new EndTurnFailureStrategy();

    await strategy.execute(turnContext, TurnDirective.END_TURN_FAILURE, {});

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0]?.message).toBe(
      `Turn for actor ${actor.id} ended by directive 'END_TURN_FAILURE' (failure).`
    );
  });

  it('logs errors and aborts when the directive does not match', async () => {
    const { turnContext, entries } = createTurnContext();
    const strategy = new EndTurnFailureStrategy();

    await expect(
      strategy.execute(turnContext, TurnDirective.END_TURN_SUCCESS, {})
    ).rejects.toThrow(
      'EndTurnFailureStrategy: Received wrong directive (END_TURN_SUCCESS). Expected END_TURN_FAILURE.'
    );

    expect(entries.error[0]?.message).toContain(
      'EndTurnFailureStrategy: Received wrong directive (END_TURN_SUCCESS). Expected END_TURN_FAILURE.'
    );
  });

  it('still throws directive errors when the logger lacks an error method', async () => {
    const { turnContext, entries } = createTurnContext('NoErrorLoggerStrategy');
    const strategy = new EndTurnFailureStrategy();
    turnContext.getLogger = () => ({ info: () => {} });

    await expect(
      strategy.execute(turnContext, TurnDirective.END_TURN_SUCCESS, {})
    ).rejects.toThrow(
      'EndTurnFailureStrategy: Received wrong directive (END_TURN_SUCCESS). Expected END_TURN_FAILURE.'
    );

    expect(entries.error).toHaveLength(0);
  });

  it('logs and ends the turn with a generated error when the actor is missing', async () => {
    const { turnContext, endTurnCalls, entries } = createTurnContext(
      'MissingActorStrategy'
    );
    const strategy = new EndTurnFailureStrategy();
    turnContext.getActor = () => null;

    await strategy.execute(turnContext, TurnDirective.END_TURN_FAILURE, {});

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0]?.message).toBe(
      'EndTurnFailureStrategy: No actor found in ITurnContext for END_TURN_FAILURE. Critical issue.'
    );
    expect(entries.error[0]?.message).toBe(
      'MissingActorStrategy: EndTurnFailureStrategy: No actor found in ITurnContext for END_TURN_FAILURE. Critical issue.'
    );
    expect(entries.error[1]?.message).toContain(
      'Ending turn with a generic error indicating missing actor.'
    );
  });

  it('invokes endTurn even when the logger cannot emit errors', () => {
    const { turnContext, endTurnCalls, entries } =
      createTurnContext('LoggerlessStrategy');
    turnContext.getActor = () => null;

    const result = requireContextActor({
      turnContext,
      logger: null,
      className: 'LoggerlessStrategy',
      errorMsg: undefined,
    });

    expect(result).toBeNull();
    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0]?.message).toBe(
      'LoggerlessStrategy: No actor found in ITurnContext.'
    );
    expect(entries.error).toHaveLength(0);
  });
});
