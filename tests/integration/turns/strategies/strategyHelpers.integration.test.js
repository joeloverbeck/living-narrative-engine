import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../../src/entities/entityInstanceData.js';
import Entity from '../../../../src/entities/entity.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import {
  assertDirective,
  buildWrongDirectiveMessage,
  getLoggerAndClass,
  requireContextActor,
  resolveTurnEndError,
} from '../../../../src/turns/strategies/strategyHelpers.js';
import { ServiceSetup } from '../../../../src/utils/serviceInitializerUtils.js';

/**
 * Creates an in-memory entity instance with a minimal definition so the real
 * TurnContext can operate on it.
 *
 * @returns {Entity}
 */
function createTestActor() {
  const definition = new EntityDefinition('test:actor', {
    description: 'Test actor',
    components: {
      'core:name': { text: 'Integration Tester' },
    },
  });
  const instanceData = new EntityInstanceData('actor-instance', definition);
  return new Entity(instanceData);
}

/**
 * Creates a logger that records every call without relying on Jest mocks. The
 * logger is later wrapped by ServiceSetup to test the integration path through
 * loggerUtils.
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
 * Builds a fully wired TurnContext instance using concrete implementations so
 * strategyHelpers interacts with the same objects the engine uses at runtime.
 *
 * @param {object} [options]
 * @param {string} [options.serviceName]
 */
function createTurnContext(options = {}) {
  const actor = createTestActor();
  const { logger: baseLogger, entries } = createRecordingLogger();
  const serviceSetup = new ServiceSetup();
  const prefixedLogger = serviceSetup.createLogger(
    options.serviceName ?? 'StrategyIntegration',
    baseLogger
  );

  const endTurnCalls = [];
  const context = new TurnContext({
    actor,
    logger: prefixedLogger,
    services: {
      entityManager: {
        getComponentData: () => null,
        getEntityInstance: () => null,
      },
    },
    strategy: {
      decideAction: async () => ({ actionDefinitionId: 'noop' }),
    },
    onEndTurnCallback: (error) => {
      endTurnCalls.push(error);
    },
    handlerInstance: { _isDestroyed: false },
  });

  return { actor, context, entries, endTurnCalls, prefixedLogger };
}

describe('strategyHelpers integration', () => {
  it('retrieves the prefixed logger from TurnContext along with the strategy class name', () => {
    const { context, entries } = createTurnContext({
      serviceName: 'DirectiveStrategy',
    });

    class DirectiveStrategy {}

    const { logger, className } = getLoggerAndClass(
      new DirectiveStrategy(),
      context
    );

    expect(className).toBe('DirectiveStrategy');

    logger.info('ready to act');
    expect(entries.info).toEqual([
      {
        message: 'DirectiveStrategy: ready to act',
        args: [],
      },
    ]);
  });

  it('allows matching directives without emitting errors', () => {
    const { context, entries } = createTurnContext();

    class MatchingStrategy {}

    const { logger, className } = getLoggerAndClass(
      new MatchingStrategy(),
      context
    );

    expect(() =>
      assertDirective({
        expected: 'ADVANCE',
        actual: 'ADVANCE',
        logger,
        className,
      })
    ).not.toThrow();
    expect(entries.error).toHaveLength(0);
  });

  it('logs and throws when directives differ, using the prefixed logger path', () => {
    const { context, entries } = createTurnContext({
      serviceName: 'ConflictStrategy',
    });

    class ConflictStrategy {}

    const { logger, className } = getLoggerAndClass(
      new ConflictStrategy(),
      context
    );
    const expectedMessage = buildWrongDirectiveMessage(
      className,
      'WRONG',
      'EXPECTED'
    );

    expect(() =>
      assertDirective({
        expected: 'EXPECTED',
        actual: 'WRONG',
        logger,
        className,
      })
    ).toThrow(expectedMessage);
    expect(entries.error).toEqual([
      {
        message: `ConflictStrategy: ${expectedMessage}`,
        args: [],
      },
    ]);
  });

  it('returns the active actor without ending the turn when one is present', () => {
    const { context, actor, endTurnCalls, entries } = createTurnContext();

    class ActiveStrategy {}

    const { logger, className } = getLoggerAndClass(
      new ActiveStrategy(),
      context
    );

    const retrieved = requireContextActor({
      turnContext: context,
      logger,
      className,
      errorMsg: 'Actor missing',
    });

    expect(retrieved).toBe(actor);
    expect(endTurnCalls).toHaveLength(0);
    expect(entries.error).toHaveLength(0);
  });

  it('logs and ends the turn when the actor is missing, using a custom message', () => {
    const { context, endTurnCalls, entries } = createTurnContext({
      serviceName: 'MissingActorStrategy',
    });

    // Simulate an unexpected loss of actor data inside the TurnContext.
    context.getActor = () => null;

    class MissingActorStrategy {}

    const { logger, className } = getLoggerAndClass(
      new MissingActorStrategy(),
      context
    );

    const result = requireContextActor({
      turnContext: context,
      logger,
      className,
      errorMsg: 'Custom missing actor message',
    });

    expect(result).toBeNull();
    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0]?.message).toBe('Custom missing actor message');
    expect(entries.error[0]).toEqual({
      message: 'MissingActorStrategy: Custom missing actor message',
      args: [],
    });
  });

  it('falls back to the default error message when none is provided', () => {
    const { context, endTurnCalls, entries } = createTurnContext({
      serviceName: 'DefaultErrorStrategy',
    });

    context.getActor = () => null;

    class DefaultErrorStrategy {}

    const { logger, className } = getLoggerAndClass(
      new DefaultErrorStrategy(),
      context
    );

    const result = requireContextActor({
      turnContext: context,
      logger,
      className,
      errorMsg: undefined,
    });

    expect(result).toBeNull();
    expect(endTurnCalls).toHaveLength(1);
    const expectedMessage = `${className}: No actor found in ITurnContext.`;
    expect(endTurnCalls[0]?.message).toBe(expectedMessage);
    expect(entries.error[0]).toEqual({
      message: `DefaultErrorStrategy: ${expectedMessage}`,
      args: [],
    });
  });

  it('resolves command errors for turn endings through resolveTurnEndError', () => {
    const { context, endTurnCalls } = createTurnContext({
      serviceName: 'ResolutionStrategy',
    });
    const actorId = context.getActor().id;

    const directError = new Error('Explicit failure');
    expect(
      resolveTurnEndError({ error: directError }, actorId, 'DIRECTIVE')
    ).toBe(directError);

    const derivedError = resolveTurnEndError(
      { error: 'Something went wrong' },
      actorId,
      'DIRECTIVE'
    );
    expect(derivedError).toBeInstanceOf(Error);
    expect(derivedError.message).toBe('Something went wrong');

    const fallbackError = resolveTurnEndError({}, actorId, 'DIRECTIVE');
    expect(fallbackError.message).toBe(
      `Turn for actor ${actorId} ended by directive 'DIRECTIVE' (failure).`
    );

    context.endTurn(fallbackError);
    expect(endTurnCalls).toContain(fallbackError);
  });
});
