import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import ActionTraceFilter from '../../../src/actions/tracing/actionTraceFilter.js';
import { ActionExecutionTraceFactory } from '../../../src/actions/tracing/actionExecutionTraceFactory.js';
import { ActionTraceOutputService } from '../../../src/actions/tracing/actionTraceOutputService.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import MultiTargetEventBuilder from '../../../src/entities/multiTarget/multiTargetEventBuilder.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

class TestLogger {
  constructor(label = 'command-processor-error-paths') {
    this.label = label;
    this.entries = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  #record(level, message, context) {
    this.entries[level].push({ message, context });
  }

  debug(message, context) {
    this.#record('debug', message, context);
  }

  info(message, context) {
    this.#record('info', message, context);
  }

  warn(message, context) {
    this.#record('warn', message, context);
  }

  error(message, context) {
    this.#record('error', message, context);
  }

  hasWarnContaining(substring) {
    return this.entries.warn.some(
      ({ message }) =>
        typeof message === 'string' && message.includes(substring)
    );
  }

  hasErrorContaining(substring) {
    return this.entries.error.some(
      ({ message }) =>
        typeof message === 'string' && message.includes(substring)
    );
  }

  hasInfoContaining(substring) {
    return this.entries.info.some(
      ({ message }) =>
        typeof message === 'string' && message.includes(substring)
    );
  }

  get warnEntries() {
    return this.entries.warn;
  }

  get errorEntries() {
    return this.entries.error;
  }

  get infoEntries() {
    return this.entries.info;
  }
}

const flushMicrotasks = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe('CommandProcessor integration error and fallback coverage', () => {
  let logger;
  let registry;
  let schemaValidator;
  let gameDataRepository;
  let eventBus;
  let validatedEventDispatcher;
  let safeEventDispatcher;
  let eventDispatchService;
  let actionTraceFilter;
  let actionTraceFactory;
  let writtenTraces;
  let actionTraceOutputService;

  const createCommandProcessor = (overrides = {}) =>
    new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
      actionTraceFilter,
      actionExecutionTraceFactory: actionTraceFactory,
      actionTraceOutputService,
      ...overrides,
    });

  const createActor = (id = 'actor-1') => ({
    id,
    name: `Actor ${id}`,
  });

  const createTurnAction = (actionId, overrides = {}) => ({
    actionDefinitionId: actionId,
    commandString: `${actionId} command`,
    resolvedParameters: {},
    ...overrides,
  });

  beforeEach(() => {
    logger = new TestLogger();
    registry = new InMemoryDataRegistry({ logger });
    registry.setEventDefinition(ATTEMPT_ACTION_ID, {
      id: ATTEMPT_ACTION_ID,
      payloadSchema: {},
    });

    schemaValidator = {
      isSchemaLoaded: jest.fn().mockReturnValue(false),
      validate: jest.fn().mockReturnValue({ isValid: true }),
    };

    gameDataRepository = new GameDataRepository(registry, logger);
    eventBus = new EventBus({ logger });
    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator,
      logger,
    });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });
    eventDispatchService = new EventDispatchService({
      safeEventDispatcher,
      logger,
    });

    actionTraceFilter = new ActionTraceFilter({
      enabled: true,
      tracedActions: ['*'],
      logger,
    });

    actionTraceFactory = new ActionExecutionTraceFactory({ logger });
    writtenTraces = [];
    actionTraceOutputService = new ActionTraceOutputService({
      logger,
      outputHandler: async (writeData, trace) => {
        writtenTraces.push({ writeData, trace });
      },
      testMode: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a warning when execution trace creation fails but dispatch continues', async () => {
    const failingFactory = {
      createFromTurnAction: () => {
        throw new Error('trace factory failure');
      },
    };

    const processor = createCommandProcessor({
      actionExecutionTraceFactory: failingFactory,
    });

    const actor = createActor('hero-1');
    const turnAction = createTurnAction('core:trace_failure');

    const result = await processor.dispatchAction(actor, turnAction);

    expect(result.success).toBe(true);
    expect(logger.hasWarnContaining('Failed to create execution trace')).toBe(
      true
    );
  });

  it('captures warnings when trace payload and result capture fail', async () => {
    const originalFactory = actionTraceFactory;

    const processor = createCommandProcessor({
      actionExecutionTraceFactory: {
        createFromTurnAction: (turnAction, actorId) => {
          const trace = originalFactory.createFromTurnAction(
            turnAction,
            actorId
          );
          trace.captureEventPayload = () => {
            throw new Error('payload capture failure');
          };
          trace.captureDispatchResult = () => {
            throw new Error('result capture failure');
          };
          return trace;
        },
      },
    });

    const actor = createActor('hero-2');
    const turnAction = createTurnAction('core:capture_failures');

    const result = await processor.dispatchAction(actor, turnAction);
    await flushMicrotasks();

    expect(result.success).toBe(true);
    expect(
      logger.hasWarnContaining('Failed to capture event payload in trace')
    ).toBe(true);
    expect(
      logger.hasWarnContaining('Failed to capture dispatch result in trace')
    ).toBe(true);
  });

  it('handles dispatch failure path and records trace output', async () => {
    schemaValidator.isSchemaLoaded.mockImplementation(
      (schemaId) => schemaId === `${ATTEMPT_ACTION_ID}#payload`
    );
    schemaValidator.validate.mockReturnValue({
      isValid: false,
      errors: [{ instancePath: '', message: 'payload invalid for test' }],
    });

    const processor = createCommandProcessor();

    const actor = createActor('hero-3');
    const turnAction = createTurnAction('core:validation_failure');

    const result = await processor.dispatchAction(actor, turnAction);
    await flushMicrotasks();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Internal error: Failed to initiate action.');
    expect(
      logger.hasErrorContaining('CRITICAL: Failed to dispatch pre-resolved')
    ).toBe(true);
    expect(writtenTraces.length).toBeGreaterThanOrEqual(1);
  });

  it('logs warning when captureError throws during dispatch exception handling', async () => {
    const originalFactory = actionTraceFactory;
    const processor = createCommandProcessor({
      actionExecutionTraceFactory: {
        createFromTurnAction: (turnAction, actorId) => {
          const trace = originalFactory.createFromTurnAction(
            turnAction,
            actorId
          );
          trace.captureError = () => {
            throw new Error('error capture failure');
          };
          return trace;
        },
      },
      eventDispatchService: {
        dispatchWithErrorHandling: async () => {
          throw new Error('dispatch explosion');
        },
      },
    });

    const actor = createActor('hero-4');
    const turnAction = createTurnAction('core:error_capture');

    const result = await processor.dispatchAction(actor, turnAction);
    await flushMicrotasks();

    expect(result.success).toBe(false);
    expect(logger.hasWarnContaining('Failed to capture error in trace')).toBe(
      true
    );
    expect(writtenTraces.length).toBeGreaterThanOrEqual(1);
  });

  it('produces enriched multi-target payloads with context metadata', async () => {
    const processor = createCommandProcessor();
    const capturedPayloads = [];
    const unsubscribe = eventBus.subscribe(ATTEMPT_ACTION_ID, (payload) => {
      capturedPayloads.push(payload);
    });

    const actor = createActor('storyteller');
    const turnAction = createTurnAction('core:give', {
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: [{ entityId: 'npc-guardian' }],
          secondary: [{ entityId: 'artifact-sword' }],
          target: ['altar-sanctum'],
        },
      },
    });

    const result = await processor.dispatchAction(actor, turnAction);
    await flushMicrotasks();
    unsubscribe?.();

    expect(result.success).toBe(true);
    expect(capturedPayloads).toHaveLength(1);

    const payloadRecord = capturedPayloads[0];
    const payload = payloadRecord?.payload || payloadRecord;
    expect(payload.targets.primary.entityId).toBe('npc-guardian');
    expect(payload.targets.secondary.contextSource).toBe('primary');
    expect(payload.targets.secondary.resolvedFromContext).toBe(true);
    expect(payload.resolvedTargetCount).toBe(3);
    expect(payload.hasContextDependencies).toBe(true);
    expect(payload.primaryId).toBe('npc-guardian');
    expect(payload.secondaryId).toBe('artifact-sword');
  });

  it('falls back to legacy payload when enhanced builder throws', async () => {
    const buildSpy = jest
      .spyOn(MultiTargetEventBuilder.prototype, 'build')
      .mockImplementation(() => {
        throw new Error('builder failure');
      });

    const processor = createCommandProcessor();
    const capturedPayloads = [];
    const unsubscribe = eventBus.subscribe(ATTEMPT_ACTION_ID, (payload) => {
      capturedPayloads.push(payload);
    });

    const actor = createActor('hero-5');
    const turnAction = createTurnAction('core:fallback', {
      resolvedParameters: {
        targetId: 'npc-trader',
      },
    });

    const result = await processor.dispatchAction(actor, turnAction);
    await flushMicrotasks();
    unsubscribe?.();

    expect(result.success).toBe(true);
    expect(buildSpy).toHaveBeenCalled();
    expect(
      logger.hasErrorContaining(
        'Enhanced payload creation failed, using fallback'
      )
    ).toBe(true);
    expect(logger.hasWarnContaining('Creating fallback payload')).toBe(true);
    expect(capturedPayloads).toHaveLength(1);
    const fallbackRecord = capturedPayloads[0];
    const fallbackPayload = fallbackRecord?.payload || fallbackRecord;
    expect(fallbackPayload.targetId).toBe('npc-trader');
    expect(fallbackPayload.targets).toBeUndefined();
  });

  it('warns when payload creation exceeds performance threshold', async () => {
    let currentTime = 0;
    const nowSpy = jest.spyOn(performance, 'now');
    nowSpy.mockImplementation(() => {
      currentTime += 25;
      return currentTime;
    });

    const processor = createCommandProcessor();
    const actor = createActor('hero-6');
    const turnAction = createTurnAction('core:timing');

    const result = await processor.dispatchAction(actor, turnAction);
    await flushMicrotasks();

    expect(result.success).toBe(true);
    expect(
      logger.hasWarnContaining('Payload creation took longer than expected')
    ).toBe(true);

    nowSpy.mockRestore();
  });

  it('logs periodic payload metrics updates after one hundred dispatches', async () => {
    actionTraceFilter = new ActionTraceFilter({
      enabled: false,
      tracedActions: [],
      logger,
    });

    const processor = createCommandProcessor({ actionTraceFilter });
    const actor = createActor('hero-7');
    const turnAction = createTurnAction('core:metrics');

    for (let i = 0; i < 100; i += 1) {
      const result = await processor.dispatchAction(actor, turnAction);
      expect(result.success).toBe(true);
    }

    expect(logger.hasInfoContaining('Payload creation metrics update')).toBe(
      true
    );
    expect(processor.getPayloadCreationStatistics().totalPayloadsCreated).toBe(
      100
    );
  });

  it('logs trace write failures when output service rejects', async () => {
    const processor = createCommandProcessor({
      actionTraceOutputService: {
        writeTrace: () => Promise.reject(new Error('write rejection for test')),
      },
    });

    const actor = createActor('hero-10');
    const turnAction = createTurnAction('core:trace-write');

    const result = await processor.dispatchAction(actor, turnAction);
    await flushMicrotasks();

    expect(result.success).toBe(true);
    expect(logger.hasWarnContaining('Failed to write execution trace')).toBe(
      true
    );
  });
});
