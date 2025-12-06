import { describe, it, expect, beforeEach } from '@jest/globals';
import CommandOutcomeInterpreter from '../../../src/commands/interpreters/commandOutcomeInterpreter.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import Entity from '../../../src/entities/entity.js';
import { TurnContext } from '../../../src/turns/context/turnContext.js';
import TurnDirective from '../../../src/turns/constants/turnDirectives.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import systemErrorEventDefinition from '../../../data/mods/core/events/system_error_occurred.event.json';

const waitForDispatch = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 *
 * @param label
 */
function createRecordingLogger(label = 'logger') {
  const entries = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  const logger = {
    debug(message, ...args) {
      entries.debug.push({ message, args, label });
    },
    info(message, ...args) {
      entries.info.push({ message, args, label });
    },
    warn(message, ...args) {
      entries.warn.push({ message, args, label });
    },
    error(message, ...args) {
      entries.error.push({ message, args, label });
    },
  };

  return { logger, entries };
}

/**
 *
 */
async function createIntegrationHarness() {
  const dispatcherLog = createRecordingLogger('dispatcher');
  const registry = new InMemoryDataRegistry({ logger: dispatcherLog.logger });
  registry.store(
    'events',
    systemErrorEventDefinition.id,
    systemErrorEventDefinition
  );

  const repository = new GameDataRepository(registry, dispatcherLog.logger);
  const schemaValidator = new AjvSchemaValidator({
    logger: dispatcherLog.logger,
  });
  await schemaValidator.addSchema(
    systemErrorEventDefinition.payloadSchema,
    `${systemErrorEventDefinition.id}#payload`
  );

  const eventBus = new EventBus({ logger: dispatcherLog.logger });
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger: dispatcherLog.logger,
  });

  const dispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger: dispatcherLog.logger,
  });

  const interpreterLog = createRecordingLogger('interpreter');
  const contextLog = createRecordingLogger('turnContext');

  const definition = new EntityDefinition('test:actor', {
    description: 'Integration Test Actor',
    components: {
      'core:name': { text: 'Integration Tester' },
    },
  });
  const instanceData = new EntityInstanceData(
    'actor-1',
    definition,
    {},
    dispatcherLog.logger
  );
  const actor = new Entity(instanceData);

  const handlerInstance = {
    _isDestroyed: false,
    requestIdleStateTransition: async () => {},
    requestAwaitingInputStateTransition: async () => {},
    requestProcessingCommandStateTransition: async () => {},
    requestAwaitingExternalTurnEndStateTransition: async () => {},
  };
  const endTurnCalls = [];

  const turnContext = new TurnContext({
    actor,
    logger: contextLog.logger,
    services: {
      entityManager: {
        getComponentData: () => null,
        getEntityInstance: () => null,
      },
      safeEventDispatcher: dispatcher,
    },
    strategy: {
      decideAction: async () => ({ actionDefinitionId: 'test:default' }),
    },
    onEndTurnCallback: (error) => {
      endTurnCalls.push(error);
    },
    handlerInstance,
  });

  return {
    dispatcher,
    eventBus,
    interpreterLog,
    contextLog,
    dispatcherLog,
    turnContext,
    actor,
    endTurnCalls,
  };
}

describe('CommandOutcomeInterpreter integration with real dispatchers', () => {
  let dispatcher;
  let eventBus;
  let interpreterLog;
  let turnContext;
  let dispatcherLog;
  let contextLog;

  beforeEach(async () => {
    ({
      dispatcher,
      eventBus,
      interpreterLog,
      turnContext,
      dispatcherLog,
      contextLog,
    } = await createIntegrationHarness());
  });

  it('returns WAIT_FOR_EVENT when the command succeeds', async () => {
    const interpreter = new CommandOutcomeInterpreter({
      dispatcher,
      logger: interpreterLog.logger,
    });
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    turnContext.setChosenAction({ actionDefinitionId: 'test:chosen' });
    const result = {
      success: true,
      actionResult: { actionId: 'test:action' },
      originalInput: '/wave',
    };

    const directive = await interpreter.interpret(result, turnContext);

    expect(directive).toBe(TurnDirective.WAIT_FOR_EVENT);
    expect(receivedEvents).toHaveLength(0);
    expect(
      interpreterLog.entries.debug.some((entry) =>
        entry.message.includes('CommandProcessor success for action')
      )
    ).toBe(true);
  });

  it('returns END_TURN_FAILURE when the command fails without turnEnded override', async () => {
    const interpreter = new CommandOutcomeInterpreter({
      dispatcher,
      logger: interpreterLog.logger,
    });
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    turnContext.setChosenAction({ actionDefinitionId: 'test:chosen' });
    const result = {
      success: false,
      actionResult: { actionId: '   ' },
      originalInput: '/fail',
    };

    const directive = await interpreter.interpret(result, turnContext);

    expect(directive).toBe(TurnDirective.END_TURN_FAILURE);
    expect(receivedEvents).toHaveLength(0);
    expect(
      interpreterLog.entries.debug.some((entry) =>
        entry.message.includes(
          "CommandOutcomeInterpreter: actor actor-1: result.actionResult.actionId ('   ') invalid/missing."
        )
      )
    ).toBe(true);
  });

  it('returns RE_PROMPT when the command fails but turn should continue', async () => {
    const interpreter = new CommandOutcomeInterpreter({
      dispatcher,
      logger: interpreterLog.logger,
    });
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    turnContext.setChosenAction({ actionDefinitionId: 'test:repeat' });
    const result = {
      success: false,
      actionResult: { actionId: 'core:unreliable' },
      turnEnded: false,
      originalInput: '/retry',
    };

    const directive = await interpreter.interpret(result, turnContext);

    expect(directive).toBe(TurnDirective.RE_PROMPT);
    expect(receivedEvents).toHaveLength(0);
  });

  it('dispatches a system error when the turn context is invalid', async () => {
    const interpreter = new CommandOutcomeInterpreter({
      dispatcher,
      logger: interpreterLog.logger,
    });
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    await expect(
      interpreter.interpret(
        { success: true, actionResult: { actionId: 'x' } },
        null
      )
    ).rejects.toThrow(InvalidArgumentError);

    await waitForDispatch();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].payload.message).toBe(
      'CommandOutcomeInterpreter: Invalid turnContext provided.'
    );
    expect(dispatcherLog.entries.error).toHaveLength(0);
  });

  it('dispatches a system error when the turn context lacks getActor', async () => {
    const interpreter = new CommandOutcomeInterpreter({
      dispatcher,
      logger: interpreterLog.logger,
    });
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    // Remove the method so the interpreter encounters an object context
    // without the expected API. This exercises the alternative ternary branch
    // inside the detailed error message.
    turnContext.getActor = undefined;

    await expect(
      interpreter.interpret(
        { success: true, actionResult: { actionId: 'x' } },
        turnContext
      )
    ).rejects.toThrow(InvalidArgumentError);

    await waitForDispatch();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].payload.message).toBe(
      'CommandOutcomeInterpreter: Invalid turnContext provided.'
    );
  });

  it('dispatches a system error when the actor id is missing', async () => {
    const interpreter = new CommandOutcomeInterpreter({
      dispatcher,
      logger: interpreterLog.logger,
    });
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    turnContext.getActor = () => ({ name: 'Anonymous' });
    turnContext.getChosenAction = () => null;

    await expect(
      interpreter.interpret(
        { success: true, actionResult: { actionId: 'core:test' } },
        turnContext
      )
    ).rejects.toThrow(InvalidArgumentError);

    await waitForDispatch();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].payload.message).toBe(
      'CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.'
    );
    expect(receivedEvents[0].payload.details).toMatchObject({
      actorInContext: { name: 'Anonymous' },
    });
  });

  it('dispatches a system error when the command result is malformed', async () => {
    const interpreter = new CommandOutcomeInterpreter({
      dispatcher,
      logger: interpreterLog.logger,
    });
    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    turnContext.setChosenAction({ actionDefinitionId: 'test:chosen' });

    await expect(
      interpreter.interpret({ actionResult: {} }, turnContext)
    ).rejects.toThrow(InvalidArgumentError);

    await waitForDispatch();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].payload.message).toBe(
      "CommandOutcomeInterpreter: Invalid CommandResult - 'success' boolean is missing. Actor: actor-1."
    );
    expect(receivedEvents[0].payload.details).toMatchObject({
      receivedResult: {},
    });
  });
});
