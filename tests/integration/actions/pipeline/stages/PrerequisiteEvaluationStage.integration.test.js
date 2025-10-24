import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrerequisiteEvaluationStage } from '../../../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js';
import { PrerequisiteEvaluationService } from '../../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../../../src/actions/validation/actionValidationContextBuilder.js';
import { ActionErrorContextBuilder } from '../../../../../src/actions/errors/actionErrorContextBuilder.js';
import JsonLogicEvaluationService from '../../../../../src/logic/jsonLogicEvaluationService.js';
import ActionAwareStructuredTrace from '../../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../../../../src/actions/tracing/actionTraceFilter.js';
import ConsoleLogger, { LogLevel } from '../../../../../src/logging/consoleLogger.js';

class FakeEntityManager {
  constructor() {
    this.entities = new Map();
  }

  registerEntity({ id, type = 'test:actor', components = {} }) {
    const entity = {
      id,
      type,
      components: { ...components },
    };
    this.entities.set(id, entity);
    return entity;
  }

  getEntityInstance(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      throw new Error(`Unknown entity ${entityId}`);
    }
    return entity;
  }

  getAllComponentTypesForEntity(entityId) {
    const entity = this.getEntityInstance(entityId);
    return Object.keys(entity.components);
  }

  getComponentData(entityId, componentType) {
    const entity = this.getEntityInstance(entityId);
    if (!(componentType in entity.components)) {
      throw new Error(`Component ${componentType} not found on ${entityId}`);
    }
    return entity.components[componentType];
  }

  hasComponent(entityId, componentType) {
    const entity = this.getEntityInstance(entityId);
    return Object.prototype.hasOwnProperty.call(entity.components, componentType);
  }
}

class FakeGameDataRepository {
  constructor() {
    this.conditions = new Map();
  }

  registerCondition(id, logic) {
    this.conditions.set(id, { id, logic });
  }

  getConditionDefinition(id) {
    return this.conditions.get(id) || null;
  }
}

class StubFixSuggestionEngine {
  suggestFixes() {
    return [];
  }
}

class ControlledLogger {
  constructor(baseLogger) {
    this.baseLogger = baseLogger;
    this.failures = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
    this.records = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  failNext(level, predicate, errorMessage) {
    this.failures[level].push({
      predicate,
      errorMessage,
      triggered: false,
    });
  }

  failNextDebugWhen(predicate, errorMessage) {
    this.failNext('debug', predicate, errorMessage);
  }

  failNextInfoWhen(predicate, errorMessage) {
    this.failNext('info', predicate, errorMessage);
  }

  failNextWarnWhen(predicate, errorMessage) {
    this.failNext('warn', predicate, errorMessage);
  }

  failNextErrorWhen(predicate, errorMessage) {
    this.failNext('error', predicate, errorMessage);
  }

  getEntries(level) {
    return [...this.records[level]];
  }

  #maybeThrow(level, message, args) {
    for (const failure of this.failures[level]) {
      if (!failure.triggered && failure.predicate(message, args)) {
        failure.triggered = true;
        throw new Error(failure.errorMessage || `${level} failure`);
      }
    }
  }

  debug(message, ...args) {
    this.#maybeThrow('debug', message, args);
    this.records.debug.push({ message, args });
    this.baseLogger.debug(message, ...args);
  }

  info(message, ...args) {
    this.#maybeThrow('info', message, args);
    this.records.info.push({ message, args });
    this.baseLogger.info(message, ...args);
  }

  warn(message, ...args) {
    this.#maybeThrow('warn', message, args);
    this.records.warn.push({ message, args });
    this.baseLogger.warn(message, ...args);
  }

  error(message, ...args) {
    this.#maybeThrow('error', message, args);
    this.records.error.push({ message, args });
    this.baseLogger.error(message, ...args);
  }
}

class FaultyActionAwareStructuredTrace extends ActionAwareStructuredTrace {
  constructor(options, plan = {}) {
    super(options);
    this.plan = plan;
  }

  #maybeThrow(handler, payload) {
    if (!handler) {
      return;
    }

    const result = handler(payload);
    if (!result) {
      return;
    }

    if (result instanceof Error) {
      throw result;
    }

    throw new Error(String(result));
  }

  success(message, source, data) {
    this.#maybeThrow(this.plan.onSuccess, { message, source, data });
    return super.success(message, source, data);
  }

  info(message, source, data) {
    this.#maybeThrow(this.plan.onInfo, { message, source, data });
    return super.info(message, source, data);
  }

  async captureActionData(stage, actionId, data) {
    await this.#maybeMaybeAsyncThrow(this.plan.onCapture, {
      stage,
      actionId,
      data,
    });
    return super.captureActionData(stage, actionId, data);
  }

  async #maybeMaybeAsyncThrow(handler, payload) {
    if (!handler) {
      return;
    }

    const result = handler(payload);
    const errorCandidate = result instanceof Promise ? await result : result;

    if (!errorCandidate) {
      return;
    }

    if (errorCandidate instanceof Error) {
      throw errorCandidate;
    }

    throw new Error(String(errorCandidate));
  }
}

class StageIntegrationHarness {
  constructor({ logger } = {}) {
    const baseLogger = logger ?? new ConsoleLogger(LogLevel.DEBUG);
    this.logger = new ControlledLogger(baseLogger);
    this.entityManager = new FakeEntityManager();
    this.gameDataRepository = new FakeGameDataRepository();
    this.fixSuggestionEngine = new StubFixSuggestionEngine();
    this.forcedErrors = new Map();
    this.actionBehaviors = new Map();

    this.errorContextBuilder = new ActionErrorContextBuilder({
      entityManager: this.entityManager,
      logger: this.logger,
      fixSuggestionEngine: this.fixSuggestionEngine,
    });

    this.actionValidationContextBuilder = new ActionValidationContextBuilder({
      entityManager: this.entityManager,
      logger: this.logger,
    });

    this.jsonLogicEvaluationService = new JsonLogicEvaluationService({
      logger: this.logger,
      gameDataRepository: this.gameDataRepository,
    });

    this.prerequisiteService = new PrerequisiteEvaluationService({
      logger: this.logger,
      jsonLogicEvaluationService: this.jsonLogicEvaluationService,
      actionValidationContextBuilder: this.actionValidationContextBuilder,
      gameDataRepository: this.gameDataRepository,
    });

    this.stage = new PrerequisiteEvaluationStage(
      this.prerequisiteService,
      this.errorContextBuilder,
      this.logger
    );

    this.#installTraceIntrospection();
  }

  configureActionBehavior(actionId, behavior) {
    this.actionBehaviors.set(actionId, behavior);
  }

  #installTraceIntrospection() {
    const originalEvaluate = this.prerequisiteService.evaluate.bind(
      this.prerequisiteService
    );

    this.prerequisiteService.evaluate = (
      prerequisites,
      actionDefinition,
      actor,
      trace
    ) => {
      const result = originalEvaluate(
        prerequisites,
        actionDefinition,
        actor,
        trace
      );

      if (trace) {
        const behavior = this.actionBehaviors.get(actionDefinition?.id) ?? {};

        const context =
          typeof behavior.createContext === 'function'
            ? behavior.createContext({ actionDefinition, actor, trace, result })
            : {
                actorId: actor?.id,
                actionId: actionDefinition?.id,
                longDescription: 'x'.repeat(520),
              };

        context.self = context;

        if (behavior.includeBigIntContext) {
          context.massiveValue = 42n;
        }

        if (behavior.freezeJsonLogicTraces) {
          trace._jsonLogicTraces = Object.freeze([]);
        }

        trace.captureEvaluationContext?.(context);

        const logicExpression =
          behavior.logicExpression || { var: 'actor.components.core:stats.mana' };

        const logicContext = behavior.logicContext || context;

        const jsonLogicResult =
          behavior.jsonLogicResult !== undefined
            ? behavior.jsonLogicResult
            : result;

        const logicSteps =
          behavior.jsonLogicSteps ||
          [
            {
              step: 'mock-evaluation',
              result: jsonLogicResult,
            },
          ];

        trace.captureJsonLogicTrace?.(
          logicExpression,
          logicContext,
          jsonLogicResult,
          logicSteps
        );

        behavior.afterTraceCapture?.({
          actionDefinition,
          actor,
          trace,
          result,
        });
      }

      const forcedError = this.forcedErrors.get(actionDefinition?.id);
      if (forcedError) {
        throw forcedError;
      }

      return result;
    };
  }

  registerActor(actorId, components) {
    this.currentActorId = actorId;
    return this.entityManager.registerEntity({
      id: actorId,
      components,
    });
  }

  registerCondition(id, logic) {
    this.gameDataRepository.registerCondition(id, logic);
  }

  createTrace(tracedActions, options = {}) {
    const actionTraceFilter = new ActionTraceFilter({
      tracedActions,
      verbosityLevel: 'verbose',
      inclusionConfig: {
        componentData: true,
        prerequisites: true,
        targets: true,
      },
      logger: this.logger,
    });

    const TraceClass = options.TraceClass || ActionAwareStructuredTrace;
    const traceOptions = {
      actionTraceFilter,
      actorId: this.currentActorId ?? 'unknown-actor',
      context: options.context ?? { sessionId: 'integration-test' },
      logger: this.logger,
    };

    if (TraceClass === ActionAwareStructuredTrace) {
      return new ActionAwareStructuredTrace(traceOptions);
    }

    return new TraceClass(traceOptions, options.tracePlan || {});
  }

  forceEvaluationFailureFor(actionId, errorMessage) {
    this.forcedErrors.set(actionId, new Error(errorMessage));
  }
}

const extractActionIdFromMessage = (message) => {
  const match = /Action '([^']+)'/.exec(message);
  return match ? match[1] : null;
};

const createArrayLikePrerequisites = (items) => ({
  length: items.length,
  items: [...items],
  entries() {
    return this.items.entries();
  },
  [Symbol.iterator]() {
    return this.items[Symbol.iterator]();
  },
});

describe('PrerequisiteEvaluationStage integration', () => {
  let harness;
  let actor;

  beforeEach(() => {
    harness = new StageIntegrationHarness();
    actor = harness.registerActor('actor-1', {
      'core:actor': { name: 'Integration Hero' },
      'core:stats': { mana: 50, level: 7 },
    });
  });

  it('evaluates prerequisites and captures detailed tracing data', async () => {
    harness.registerCondition('conditions:high_level', {
      '>=': [{ var: 'actor.components.core:stats.level' }, 5],
    });

    harness.configureActionBehavior('core:cast_spell', {
      includeBigIntContext: true,
    });

    harness.configureActionBehavior('core:ritual_object', {
      jsonLogicExpression: { '<=': [{ var: 'actor.components.core:stats.mana' }, 100] },
    });

    const candidateActions = [
      {
        id: 'core:cast_spell',
        name: 'Cast Spell',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'actor.components.core:stats.mana' }, 20] },
            failure_message: 'Not enough mana',
          },
          {
            logic: { condition_ref: 'conditions:high_level' },
            failure_message: 'Level too low',
          },
        ],
      },
      {
        id: 'core:low_mana',
        name: 'Expensive Spell',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'actor.components.core:stats.mana' }, 80] },
            failure_message: 'Insufficient mana reserve',
          },
        ],
      },
      {
        id: 'core:ritual_object',
        name: 'Perform Ritual',
        prerequisites: createArrayLikePrerequisites([
          {
            logic: {
              and: [
                { '>=': [{ var: 'actor.components.core:stats.level' }, 5] },
                { '<=': [{ var: 'actor.components.core:stats.mana' }, 60] },
              ],
            },
          },
        ]),
      },
      {
        id: 'core:inspect',
        name: 'Inspect',
        prerequisites: null,
      },
    ];

    const actionContext = { mood: 'focused' };
    actionContext.circular = actionContext;

    const trace = harness.createTrace([
      'core:cast_spell',
      'core:low_mana',
      'core:ritual_object',
      'core:inspect',
    ]);

    const result = await harness.stage.executeInternal({
      actor,
      candidateActions,
      trace,
      actionContext,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions.map((action) => action.id)).toEqual([
      'core:cast_spell',
      'core:ritual_object',
      'core:inspect',
    ]);

    const tracedActions = trace.getTracedActions();
    const castSpellTrace = tracedActions.get('core:cast_spell');
    expect(castSpellTrace).toBeDefined();
    expect(castSpellTrace.stages.prerequisite_evaluation.data.evaluationPassed).toBe(
      true
    );
    expect(
      castSpellTrace.stages.prerequisite_evaluation.data.evaluationDetails
        .hasJsonLogicTraces
    ).toBe(true);
    expect(
      castSpellTrace.stages.prerequisite_evaluation.data.evaluationDetails
        .hasEvaluationContext
    ).toBe(true);
    expect(
      castSpellTrace.stages.prerequisite_evaluation.data.evaluationDetails
        .evaluationContext.longDescription
    ).toBeUndefined();
    expect(
      castSpellTrace.stages.prerequisite_evaluation.data.evaluationDetails
        .evaluationContext.self
    ).toBeUndefined();
    expect(
      castSpellTrace.stages.prerequisite_evaluation.data.evaluationDetails
        .evaluationContext.massiveValue
    ).toBeUndefined();
    expect(
      castSpellTrace.stages.prerequisite_evaluation.data.evaluationDetails
        .evaluationContext.contextError
    ).toBe('Failed to serialize context safely');
    expect(
      castSpellTrace.stages.stage_performance.data.itemsProcessed
    ).toBe(candidateActions.length);

    const ritualTrace = tracedActions.get('core:ritual_object');
    expect(ritualTrace).toBeDefined();
    expect(
      ritualTrace.stages.prerequisite_evaluation.data.evaluationDetails
        .prerequisiteCount
    ).toBe(1);
    expect(
      Array.isArray(
        ritualTrace.stages.prerequisite_evaluation.data.prerequisites
      )
    ).toBe(false);
    expect(
      ritualTrace.stages.prerequisite_evaluation.data.prerequisites.length
    ).toBe(1);

    const lowManaTrace = tracedActions.get('core:low_mana');
    expect(lowManaTrace.stages.prerequisite_evaluation.data.evaluationPassed).toBe(
      false
    );
    expect(
      lowManaTrace.stages.prerequisite_evaluation.data.evaluationReason
    ).toBe('One or more prerequisites failed');

    const inspectTrace = tracedActions.get('core:inspect');
    expect(inspectTrace.stages.prerequisite_evaluation.data.hasPrerequisites).toBe(
      false
    );
    expect(inspectTrace.stages.prerequisite_evaluation.data.evaluationReason).toBe(
      'No prerequisites defined'
    );
  });

  it('gracefully handles trace capture failures and logging exceptions', async () => {
    harness.logger.failNextDebugWhen(
      (message) => message.includes('Captured pre-evaluation data'),
      'pre-evaluation logging failure'
    );
    harness.logger.failNextDebugWhen(
      (message) => message.includes('Captured post-evaluation summary'),
      'post-evaluation logging failure'
    );

    harness.configureActionBehavior('core:object_style', {
      freezeJsonLogicTraces: true,
    });

    harness.configureActionBehavior('core:volatile', {
      includeBigIntContext: true,
    });

    harness.forceEvaluationFailureFor('core:volatile', 'JSON Logic failure');

    const candidateActions = [
      {
        id: 'core:object_style',
        name: 'Object Style',
        prerequisites: createArrayLikePrerequisites([
          {
            logic: { '>=': [{ var: 'actor.components.core:stats.mana' }, 40] },
          },
        ]),
      },
      {
        id: 'core:volatile',
        name: 'Volatile Action',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'actor.components.core:stats.mana' }, 10] },
          },
        ],
      },
      {
        id: 'core:no_prereq',
        name: 'Simple Interaction',
        prerequisites: null,
      },
    ];

    const captureFailurePlan = new Map([
      [
        'prerequisite_evaluation',
        new Map([
          ['core:object_style', 1],
          ['core:volatile', 1],
          ['core:no_prereq', 1],
        ]),
      ],
      [
        'stage_performance',
        new Map([
          ['core:object_style', 1],
        ]),
      ],
    ]);

    const tracePlan = {
      onCapture: ({ stage, actionId }) => {
        const stageMap = captureFailurePlan.get(stage);
        if (!stageMap) {
          return null;
        }
        const remaining = stageMap.get(actionId);
        if (!remaining) {
          return null;
        }
        stageMap.set(actionId, remaining - 1);
        return new Error(`capture failure for ${stage}:${actionId}`);
      },
      onInfo: ({ message }) => {
        const actionId = extractActionIdFromMessage(message);
        if (actionId === 'core:volatile') {
          return new Error('trace info failure');
        }
        return null;
      },
    };

    const trace = harness.createTrace(
      ['core:object_style', 'core:volatile', 'core:no_prereq'],
      {
        TraceClass: FaultyActionAwareStructuredTrace,
        tracePlan,
      }
    );

    const result = await harness.stage.executeInternal({
      actor,
      candidateActions,
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions.map((action) => action.id)).toEqual([
      'core:object_style',
      'core:no_prereq',
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.data.prerequisiteErrors).toHaveLength(1);
    expect(result.data.prerequisiteErrors[0].actionId).toBe('core:volatile');

    const warnings = harness.logger.getEntries('warn').map((entry) => entry.message);
    expect(warnings).toContain(
      'Failed to capture pre-evaluation data for tracing'
    );
    expect(warnings).toContain(
      "Failed to capture prerequisite evaluation data for action 'core:object_style'"
    );
    expect(warnings).toContain(
      "Failed to capture JSON Logic trace for action 'core:object_style'"
    );
    expect(warnings).toContain(
      "Failed to capture no-prerequisites data for action 'core:no_prereq'"
    );
    expect(warnings).toContain(
      "Failed to capture prerequisite error data for action 'core:volatile'"
    );
    expect(warnings).toContain(
      'Failed to capture post-evaluation summary for tracing'
    );

    const debugMessages = harness.logger
      .getEntries('debug')
      .map((entry) => entry.message);
    expect(debugMessages).toContain(
      "Failed to capture performance data for action 'core:object_style': capture failure for stage_performance:core:object_style"
    );

    const traceData = trace.getTracedActions();
    const objectStyleTrace = traceData.get('core:object_style');
    expect(objectStyleTrace?.stages.stage_performance).toBeUndefined();

    const volatileTrace = traceData.get('core:volatile');
    expect(volatileTrace?.stages.prerequisite_evaluation).toBeUndefined();
  });
});
