import { describe, it, expect } from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';
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

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

class TestTrace {
  constructor() {
    this.spans = [];
    this.events = [];
    this.logs = [];
  }

  withSpan(name, fn, attributes = {}) {
    this.spans.push({ name, attributes });
    return fn();
  }

  #record(type, message, source = 'ActionTrace', data = undefined) {
    const entry = {
      type,
      message,
      source,
      data,
      timestamp: Date.now(),
      success: type === 'success',
    };

    this.logs.push(entry);
    this.events.push({ type, message, source, data });
  }

  step(message, source, data) {
    this.#record('step', message, source, data);
  }

  info(message, source, data) {
    this.#record('info', message, source, data);
  }

  success(message, source, data) {
    this.#record('success', message, source, data);
  }

  failure(message, source, data) {
    this.#record('failure', message, source, data);
  }

  data(message, source, data) {
    this.#record('data', message, source, data);
  }

  error(message, source, data) {
    this.#record('error', message, source, data);
  }
}

class ConfigurablePrerequisiteService {
  constructor(handler) {
    this.handler = handler;
    this.calls = [];
  }

  evaluate(prerequisites, actionDef, actor, trace) {
    this.calls.push({ prerequisites, actionDef, actorId: actor.id, trace });
    return this.handler({ prerequisites, actionDef, actor, trace });
  }
}

class TrackingTargetResolver {
  constructor(handler) {
    this.handler = handler;
    this.calls = [];
  }

  resolveTargets(scope, actor, actionContext, trace, actionId) {
    this.calls.push({
      scope,
      actorId: actor.id,
      actionContext,
      trace,
      actionId,
    });
    return this.handler({ scope, actor, actionContext, trace, actionId });
  }
}

class FailingFormatter extends ActionCommandFormatter {
  constructor(options) {
    super();
    this.result = options.result;
    this.shouldThrow = options.shouldThrow ?? false;
  }

  format(actionDefinition, targetContext) {
    if (this.shouldThrow) {
      throw new Error('formatter crash');
    }
    return this.result({ actionDefinition, targetContext });
  }
}

/**
 *
 * @param logger
 */
function createFixSuggestionEngine(logger) {
  const gameDataRepository = {
    getComponentDefinition: () => ({ id: 'core:traits' }),
    getConditionDefinition: () => ({
      id: 'friendly-check',
      logic: { '==': [true, true] },
    }),
  };

  const actionIndex = {
    getCandidateActions: () => [],
  };

  return new FixSuggestionEngine({
    logger,
    gameDataRepository,
    actionIndex,
  });
}

/**
 *
 * @param options
 */
function createEnvironment(options = {}) {
  const logger = options.logger ?? new RecordingLogger();
  const dispatcher = options.dispatcher ?? new RecordingDispatcher();
  const entityManager =
    options.entityManager ??
    new SimpleEntityManager([
      {
        id: 'hero',
        components: {
          'identity:name': { text: 'Astra' },
          'core:traits': { friendly: true },
          'core:location': { value: 'plaza' },
        },
      },
      {
        id: 'companion',
        components: {
          'identity:name': { text: 'Talia' },
        },
      },
      {
        id: 'stranger',
        components: {
          'identity:name': { text: 'Orion' },
        },
      },
    ]);

  const fixSuggestionEngine =
    options.fixSuggestionEngine ?? createFixSuggestionEngine(logger);
  const actionErrorContextBuilder =
    options.actionErrorContextBuilder ??
    new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });

  const prerequisiteEvaluationService =
    options.prerequisiteEvaluationService ??
    new ConfigurablePrerequisiteService(() => true);

  const targetResolutionService =
    options.targetResolutionService ??
    new TrackingTargetResolver(() =>
      ActionResult.success([
        ActionTargetContext.forEntity('companion'),
        ActionTargetContext.forEntity('stranger'),
      ])
    );

  const commandFormatter =
    options.commandFormatter ?? new ActionCommandFormatter();

  const processor = new ActionCandidateProcessor({
    prerequisiteEvaluationService,
    targetResolutionService,
    entityManager,
    actionCommandFormatter: commandFormatter,
    safeEventDispatcher: dispatcher,
    getEntityDisplayNameFn: (entity, fallback) =>
      entity?.components?.['identity:name']?.text ?? fallback,
    logger,
    actionErrorContextBuilder,
  });

  const trace = options.trace ?? new TestTrace();

  const actionDefinition = {
    id: 'social:greet_companion',
    name: 'Greet Companion',
    description: 'Offer a friendly greeting',
    scope: 'core:companions',
    template: 'Say hello to {target}',
    visual: { icon: 'wave' },
    ...(options.actionDefinition ?? {}),
    prerequisites: options.prerequisites ??
      options.actionDefinition?.prerequisites ?? [
        {
          id: 'friendly-check',
          logic: {
            '==': [{ var: 'actor.components.core:traits.friendly' }, true],
          },
        },
      ],
  };

  const actor = entityManager.getEntityInstance('hero');
  const actionContext = { currentLocation: 'plaza' };

  return {
    processor,
    logger,
    dispatcher,
    entityManager,
    trace,
    actionDefinition,
    actor,
    actionContext,
    prerequisiteEvaluationService,
    targetResolutionService,
    actionErrorContextBuilder,
  };
}

describe('ActionCandidateProcessor integration coverage', () => {
  it('formats actions for each resolved target and records tracing spans', () => {
    const trace = new TestTrace();
    const env = createEnvironment({ trace });

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext,
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value.errors).toHaveLength(0);
    expect(result.value.actions).toHaveLength(2);
    expect(result.value.actions[0]).toEqual(
      expect.objectContaining({
        id: env.actionDefinition.id,
        command: 'Say hello to Talia',
        params: { targetId: 'companion' },
      })
    );
    expect(result.value.actions[1]).toEqual(
      expect.objectContaining({ command: 'Say hello to Orion' })
    );
    expect(trace.spans).toEqual([
      expect.objectContaining({ name: 'candidate.process' }),
    ]);
    expect(
      trace.events.some(
        (evt) =>
          evt.type === 'success' &&
          evt.message.includes(
            "Action 'social:greet_companion' passed actor prerequisite check."
          )
      )
    ).toBe(true);
  });

  it('halts discovery when prerequisites evaluate to false without invoking scope resolution', () => {
    const prerequisiteEvaluationService = new ConfigurablePrerequisiteService(
      () => false
    );
    const targetResolutionService = new TrackingTargetResolver(() =>
      ActionResult.success([ActionTargetContext.forEntity('companion')])
    );

    const env = createEnvironment({
      prerequisiteEvaluationService,
      targetResolutionService,
    });

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext,
      null
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.errors).toHaveLength(0);
    expect(result.value.cause).toBe('prerequisites-failed');
    expect(targetResolutionService.calls).toHaveLength(0);
  });

  it('skips prerequisite evaluation entirely when an action defines no prerequisites', () => {
    const prerequisiteEvaluationService = new ConfigurablePrerequisiteService(
      () => {
        throw new Error('prerequisite service should not be invoked');
      }
    );

    const env = createEnvironment({
      prerequisites: [],
      prerequisiteEvaluationService,
      trace: new TestTrace(),
    });

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext,
      env.trace
    );

    expect(result.success).toBe(true);
    expect(prerequisiteEvaluationService.calls).toHaveLength(0);
    expect(result.value.actions).toHaveLength(2);
  });

  it('captures prerequisite evaluation errors with enhanced error context', () => {
    const prerequisiteEvaluationService = new ConfigurablePrerequisiteService(
      () => {
        throw new Error('prerequisite explosion');
      }
    );
    const trace = new TestTrace();
    const env = createEnvironment({
      prerequisiteEvaluationService,
      trace,
    });

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext,
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('prerequisite-error');
    expect(result.value.errors).toHaveLength(1);
    const [errorContext] = result.value.errors;
    expect(errorContext.actionId).toBe(env.actionDefinition.id);
    expect(errorContext.phase).toBe(ERROR_PHASES.VALIDATION);
    expect(errorContext.error.message).toBe('prerequisite explosion');
    expect(
      env.logger.errorLogs.some(([message]) =>
        message.includes('Error checking prerequisites')
      )
    ).toBe(true);
  });

  it('wraps raw prerequisite failures into structured contexts when builder omits trace metadata', () => {
    const minimalBuilder = {
      buildErrorContext({ error, actionDef, actorId, phase }) {
        return {
          actionId: actionDef.id,
          actorId,
          phase,
          error,
        };
      },
    };

    const prerequisiteEvaluationService = new ConfigurablePrerequisiteService(
      () => {
        throw new Error('missing component');
      }
    );

    const env = createEnvironment({
      actionErrorContextBuilder: minimalBuilder,
      prerequisiteEvaluationService,
    });

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext,
      new TestTrace()
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('prerequisite-error');
    const [errorContext] = result.value.errors;
    expect(errorContext.actionId).toBe(env.actionDefinition.id);
    expect(errorContext.error).toBeInstanceOf(Error);
  });

  it('returns resolution errors when the scope resolver reports failures', () => {
    const targetResolutionService = new TrackingTargetResolver(() =>
      ActionResult.failure({
        message: 'scope evaluation failed',
        detail: 'no nearby actors',
      })
    );

    const env = createEnvironment({ targetResolutionService });

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext,
      new TestTrace()
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);
    const [errorContext] = result.value.errors;
    expect(errorContext.actionId).toBe(env.actionDefinition.id);
    expect(errorContext.environmentContext.scope).toBe(
      env.actionDefinition.scope
    );
  });

  it('propagates existing error contexts returned by the scope resolver', () => {
    const env = createEnvironment();
    const trace = new TestTrace();

    const existingContext = env.actionErrorContextBuilder.buildErrorContext({
      error: new Error('prebuilt failure'),
      actionDef: env.actionDefinition,
      actorId: env.actor.id,
      phase: ERROR_PHASES.VALIDATION,
      trace,
    });

    env.targetResolutionService.handler = () => ({
      success: false,
      errors: [existingContext],
    });

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext,
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toEqual([existingContext]);
  });

  it('converts scope resolver exceptions into structured errors', () => {
    const targetResolutionService = new TrackingTargetResolver(() => {
      throw new Error('resolver crash');
    });

    const env = createEnvironment({ targetResolutionService });

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext,
      new TestTrace()
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(
      env.logger.errorLogs.some(([message]) =>
        message.includes('Error resolving scope for action')
      )
    ).toBe(true);
  });

  it('skips actions when no targets are resolved and logs diagnostic details', () => {
    const targetResolutionService = new TrackingTargetResolver(() =>
      ActionResult.success([])
    );
    const env = createEnvironment({ targetResolutionService });

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext,
      new TestTrace()
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('no-targets');
    expect(result.value.actions).toHaveLength(0);
    expect(
      env.logger.debugLogs.some(([message]) =>
        message.includes('resolved to 0 targets')
      )
    ).toBe(true);
  });

  it('collects formatting failures as structured error contexts', () => {
    const formatter = new FailingFormatter({
      result: () => ({
        ok: false,
        error: 'format-broken',
        details: { reason: 'missing placeholder' },
      }),
    });

    const targetResolutionService = new TrackingTargetResolver(() =>
      ActionResult.success([ActionTargetContext.forEntity('companion')])
    );

    const env = createEnvironment({
      targetResolutionService,
      commandFormatter: formatter,
    });

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext,
      new TestTrace()
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.errors).toHaveLength(1);
    const [errorContext] = result.value.errors;
    expect(errorContext.environmentContext.formatDetails).toEqual({
      reason: 'missing placeholder',
    });
    expect(
      env.logger.warnLogs.some(([message]) =>
        message.includes('Failed to format command for action')
      )
    ).toBe(true);
  });

  it('captures formatter exceptions and returns rich error metadata', () => {
    const formatter = new FailingFormatter({
      shouldThrow: true,
      result: () => ({ ok: true, value: 'irrelevant' }),
    });
    const targetResolutionService = new TrackingTargetResolver(() =>
      ActionResult.success([ActionTargetContext.forEntity('companion')])
    );

    const env = createEnvironment({
      targetResolutionService,
      commandFormatter: formatter,
    });

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext,
      new TestTrace()
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.errors).toHaveLength(1);
    const [errorContext] = result.value.errors;
    expect(errorContext.error.message).toBe('formatter crash');
    expect(errorContext.phase).toBe(ERROR_PHASES.VALIDATION);
    expect(
      env.logger.errorLogs.some(([message]) =>
        message.includes('Error formatting action')
      )
    ).toBe(true);
  });
});
