import { describe, it, expect } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

class InMemoryConditionRepository {
  constructor(definitions) {
    this.definitions = { ...definitions };
  }

  getConditionDefinition(id) {
    return this.definitions[id] ?? null;
  }
}

/**
 *
 * @param root0
 * @param root0.actorComponents
 * @param root0.conditionDefinitions
 */
function createServiceEnvironment({ actorComponents, conditionDefinitions }) {
  const logger = new RecordingLogger();
  const entityManager = new SimpleEntityManager([
    {
      id: 'actor-1',
      components: {
        'core:location': { value: 'plaza' },
        ...actorComponents,
      },
    },
  ]);

  const gameDataRepository = new InMemoryConditionRepository(
    conditionDefinitions
  );
  const contextBuilder = new ActionValidationContextBuilder({
    entityManager,
    logger,
  });
  const jsonLogicService = new JsonLogicEvaluationService({
    logger,
    gameDataRepository,
  });

  const service = new PrerequisiteEvaluationService({
    logger,
    jsonLogicEvaluationService: jsonLogicService,
    actionValidationContextBuilder: contextBuilder,
    gameDataRepository,
  });

  return {
    logger,
    entityManager,
    service,
    actionDefinition: { id: 'test:action' },
    actor: entityManager.getEntityInstance('actor-1'),
  };
}

describe('PrerequisiteEvaluationService circular reference integration', () => {
  it('detects circular condition_ref chains and surfaces descriptive errors', () => {
    const conditionDefinitions = {
      'logic:cyclicA': {
        id: 'logic:cyclicA',
        logic: { condition_ref: 'logic:cyclicB' },
      },
      'logic:cyclicB': {
        id: 'logic:cyclicB',
        logic: { condition_ref: 'logic:cyclicA' },
      },
    };

    const { service, logger, actionDefinition, actor } =
      createServiceEnvironment({
        actorComponents: {
          'core:traits': { friendly: true },
        },
        conditionDefinitions,
      });

    const trace = new TraceContext();
    const result = service.evaluate(
      [
        {
          id: 'prereq:cycle',
          logic: { condition_ref: 'logic:cyclicA' },
          failure_message: 'Should not succeed',
        },
      ],
      actionDefinition,
      actor,
      trace
    );

    expect(result).toBe(false);
    const circularErrorLog = logger.errorLogs.find(([, details]) => {
      if (!details || typeof details !== 'object') {
        return false;
      }
      const { error } = details;
      return (
        typeof error === 'string' &&
        error.includes('Circular reference detected')
      );
    });
    expect(circularErrorLog).toBeDefined();
    expect(
      trace.logs.some(
        (entry) =>
          entry.type === 'failure' &&
          (entry.message.includes('Prerequisite failed') ||
            entry.message.includes('Rule 1 failed'))
      )
    ).toBe(true);
  });

  it('resolves nested condition references and records evaluation context data', () => {
    const conditionDefinitions = {
      'logic:healthy': {
        id: 'logic:healthy',
        logic: { '>': [{ var: 'actor.components.core:health.current' }, 50] },
      },
      'logic:in-location': {
        id: 'logic:in-location',
        logic: {
          '==': [{ var: 'actor.components.core:location.value' }, 'plaza'],
        },
      },
      'logic:healthyAndPresent': {
        id: 'logic:healthyAndPresent',
        logic: {
          and: [
            { condition_ref: 'logic:healthy' },
            { condition_ref: 'logic:in-location' },
          ],
        },
      },
    };

    const { service, logger, actionDefinition, actor } =
      createServiceEnvironment({
        actorComponents: {
          'core:health': { current: 92, max: 100 },
        },
        conditionDefinitions,
      });

    const trace = new TraceContext();
    const result = service.evaluate(
      [
        {
          id: 'prereq:healthy',
          logic: { condition_ref: 'logic:healthyAndPresent' },
          failure_message: 'Actor is unwell',
        },
      ],
      actionDefinition,
      actor,
      trace
    );

    expect(result).toBe(true);
    expect(
      trace.logs.some(
        (entry) =>
          entry.type === 'data' &&
          entry.message === 'Condition reference resolved' &&
          entry.data?.resolvedLogic
      )
    ).toBe(true);
    expect(
      logger.debugLogs.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes(
            'PrereqEval[test:action]:   - Evaluating resolved rule:'
          )
      )
    ).toBe(true);
  });
});
