/**
 * @file Integration tests that exercise validateActionInputs indirectly
 *       through PrerequisiteEvaluationService working with real collaborators.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../../src/actions/validation/actionValidationContextBuilder.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

class RecordingLogger {
  constructor() {
    this.records = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  debug(...args) {
    this.records.debug.push(args);
  }

  info(...args) {
    this.records.info.push(args);
  }

  warn(...args) {
    this.records.warn.push(args);
  }

  error(...args) {
    this.records.error.push(args);
  }

  getMessages(level) {
    return this.records[level] ?? [];
  }
}

class InMemoryGameDataRepository {
  constructor(definitions = {}) {
    this.definitions = definitions;
  }

  getConditionDefinition(id) {
    return this.definitions[id] ?? null;
  }
}

describe('validateActionInputs integration via prerequisite evaluation', () => {
  /** @type {RecordingLogger} */
  let logger;
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {PrerequisiteEvaluationService} */
  let prerequisiteService;
  /** @type {import('../../../../src/entities/entity.js').default} */
  let validActor;
  /** @type {TraceContext} */
  let trace;

  const prerequisites = [
    {
      logic: {
        '==': [{ var: 'actor.components.core:status.stance' }, 'ready'],
      },
      failure_message: 'Actor must be ready.',
    },
  ];

  beforeEach(() => {
    logger = new RecordingLogger();
    entityManager = new SimpleEntityManager([
      {
        id: 'hero-1',
        components: {
          'core:profile': { name: 'Hero' },
          'core:status': { stance: 'ready' },
          'core:position': { locationId: 'bridge' },
        },
      },
    ]);

    const gameDataRepository = new InMemoryGameDataRepository();
    const jsonLogicService = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });
    const contextBuilder = new ActionValidationContextBuilder({
      entityManager,
      logger,
    });

    prerequisiteService = new PrerequisiteEvaluationService({
      logger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: contextBuilder,
      gameDataRepository,
    });

    validActor = entityManager.getEntityInstance('hero-1');
    trace = new TraceContext();
  });

  it('builds a prerequisite context for valid inputs and logs validation details', () => {
    const actionDefinition = { id: 'core:salute' };

    const result = prerequisiteService.evaluate(
      prerequisites,
      actionDefinition,
      validActor,
      trace
    );

    expect(result).toBe(true);

    const debugMessages = logger
      .getMessages('debug')
      .flat()
      .filter((value) => typeof value === 'string');

    expect(
      debugMessages.some((message) =>
        message.includes(
          'Validated inputs - Action: core:salute, Actor: hero-1'
        )
      )
    ).toBe(true);
    expect(
      debugMessages.some((message) =>
        message.includes('Evaluation Context Built Successfully')
      )
    ).toBe(true);

    expect(
      trace.logs.some(
        (entry) =>
          entry.type === 'step' &&
          entry.message === 'Checking prerequisites' &&
          entry.source === 'PrerequisiteEvaluationService.evaluate'
      )
    ).toBe(true);
  });

  it('returns false and logs a validation error when the action definition lacks an id', () => {
    const invalidAction = { name: 'nameless-action' };

    const result = prerequisiteService.evaluate(
      prerequisites,
      invalidAction,
      validActor,
      trace
    );

    expect(result).toBe(false);

    const errorEntries = logger.getMessages('error');
    expect(
      errorEntries.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('Failed to build evaluation context')
      )
    ).toBe(true);
    expect(
      errorEntries.some(
        ([message, context]) =>
          typeof message === 'string' &&
          message.includes(
            'ActionValidationContextBuilder.buildContext: Action definition must have a valid id property'
          ) &&
          context?.actorId === 'hero-1'
      )
    ).toBe(true);

    expect(
      trace.logs.some(
        (entry) =>
          entry.type === 'failure' &&
          entry.message === 'Failed to build evaluation context'
      )
    ).toBe(true);
  });

  it('returns false and records a validation error when the action definition is missing entirely', () => {
    const result = prerequisiteService.evaluate(
      prerequisites,
      null,
      validActor,
      trace
    );

    expect(result).toBe(false);

    const errorMessages = logger
      .getMessages('error')
      .map(([message]) => message)
      .filter((message) => typeof message === 'string');

    expect(
      errorMessages.some((message) =>
        message.includes(
          'ActionValidationContextBuilder.buildContext: Action definition must be a valid object'
        )
      )
    ).toBe(true);
  });

  it('returns false when the actor object is missing', () => {
    const result = prerequisiteService.evaluate(
      prerequisites,
      { id: 'core:salute' },
      null,
      trace
    );

    expect(result).toBe(false);

    const errorMessages = logger
      .getMessages('error')
      .map(([message]) => message)
      .filter((message) => typeof message === 'string');

    expect(
      errorMessages.some((message) =>
        message.includes(
          'ActionValidationContextBuilder.buildContext: Actor must be a valid object'
        )
      )
    ).toBe(true);
  });

  it('returns false when the actor id is not a valid string', () => {
    const invalidActor = { id: null };

    const result = prerequisiteService.evaluate(
      prerequisites,
      { id: 'core:salute' },
      invalidActor,
      trace
    );

    expect(result).toBe(false);

    const errorMessages = logger
      .getMessages('error')
      .map(([message]) => message)
      .filter((message) => typeof message === 'string');

    expect(
      errorMessages.some((message) =>
        message.includes(
          'ActionValidationContextBuilder.buildContext: Actor must have a valid id property'
        )
      )
    ).toBe(true);
  });
});
