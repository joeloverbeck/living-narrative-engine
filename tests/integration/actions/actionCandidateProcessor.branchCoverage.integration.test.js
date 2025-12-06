import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../src/actions/errors/fixSuggestionEngine.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(...args) {
    this.debugMessages.push(args);
  }

  info(...args) {
    this.infoMessages.push(args);
  }

  warn(...args) {
    this.warnMessages.push(args);
  }

  error(...args) {
    this.errorMessages.push(args);
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

class RecordingActionErrorContextBuilder extends ActionErrorContextBuilder {
  constructor(dependencies) {
    super(dependencies);
    this.calls = [];
  }

  buildErrorContext(params) {
    const context = super.buildErrorContext(params);
    this.calls.push({ params, context });
    return context;
  }
}

const defaultEntities = [
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
      'core:location': { value: 'plaza' },
    },
  },
  {
    id: 'observer',
    components: {
      'identity:name': { text: 'Marek' },
      'core:location': { value: 'plaza' },
    },
  },
];

/**
 *
 * @param logger
 */
function createFixSuggestionEngine(logger) {
  const minimalRepository = {
    getComponentDefinition: () => ({ id: 'mock-component' }),
    getConditionDefinition: () => ({ id: 'always', logic: { '==': [1, 1] } }),
  };
  const minimalActionIndex = {
    getCandidateActions: () => [],
  };
  return new FixSuggestionEngine({
    logger,
    gameDataRepository: minimalRepository,
    actionIndex: minimalActionIndex,
  });
}

/**
 *
 * @param overrides
 */
function createProcessor(overrides = {}) {
  const logger = overrides.logger ?? new RecordingLogger();
  const entityManager =
    overrides.entityManager ?? new SimpleEntityManager(defaultEntities);
  const dispatcher = overrides.safeEventDispatcher ?? new RecordingDispatcher();
  const fixSuggestionEngine =
    overrides.fixSuggestionEngine ?? createFixSuggestionEngine(logger);
  const actionErrorContextBuilder =
    overrides.actionErrorContextBuilder ??
    new RecordingActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });
  const actionCommandFormatter =
    overrides.actionCommandFormatter ?? new ActionCommandFormatter({ logger });
  const prerequisiteEvaluationService =
    overrides.prerequisiteEvaluationService ?? {
      evaluate() {
        return true;
      },
    };
  const targetResolutionService = overrides.targetResolutionService ?? {
    resolveTargets() {
      return ActionResult.success([ActionTargetContext.forEntity('companion')]);
    },
  };
  const getEntityDisplayNameFn =
    overrides.getEntityDisplayNameFn ??
    ((entity) =>
      entity?.components?.['identity:name']?.text ?? entity?.id ?? 'Unknown');

  const processor = new ActionCandidateProcessor({
    prerequisiteEvaluationService,
    targetResolutionService,
    entityManager,
    actionCommandFormatter,
    safeEventDispatcher: dispatcher,
    getEntityDisplayNameFn,
    logger,
    actionErrorContextBuilder,
  });

  return {
    processor,
    logger,
    entityManager,
    dispatcher,
    actionErrorContextBuilder,
    fixSuggestionEngine,
  };
}

const baseAction = {
  id: 'social:greet_companion',
  name: 'Greet Companion',
  description: 'Offer a friendly greeting',
  scope: 'core:other_actors',
  template: 'greet {target}',
  prerequisites: [
    {
      id: 'friendly-check',
      description: 'Actor must be friendly',
      logic: { '==': [true, true] },
    },
  ],
  required_components: { actor: ['core:traits'] },
};

const simpleContext = {
  actorId: 'hero',
  currentLocation: 'plaza',
  locationId: 'plaza',
};

/**
 *
 */
function createTraceWithoutStructuredSpan() {
  const calls = { info: [], step: [], success: [], failure: [] };
  return {
    trace: {
      info(message, source) {
        calls.info.push({ message, source });
      },
      step(message, source) {
        calls.step.push({ message, source });
      },
      success(message, source) {
        calls.success.push({ message, source });
      },
      failure(message, source) {
        calls.failure.push({ message, source });
      },
    },
    calls,
  };
}

describe('ActionCandidateProcessor integration edge coverage', () => {
  let actor;

  beforeEach(() => {
    const { entityManager } = createProcessor();
    actor = entityManager.getEntityInstance('hero');
  });

  it('falls back to direct processing when trace lacks withSpan and handles actions without prerequisites', () => {
    const { processor, logger, entityManager } = createProcessor({
      targetResolutionService: {
        resolveTargets() {
          return ActionResult.success([
            ActionTargetContext.forEntity('companion'),
            ActionTargetContext.forEntity('observer'),
          ]);
        },
      },
    });
    const { trace, calls } = createTraceWithoutStructuredSpan();

    const actionDef = {
      ...baseAction,
      id: 'social:wave',
      prerequisites: [],
      description: undefined,
      visual: undefined,
    };
    const actorEntity = entityManager.getEntityInstance('hero');

    const result = processor.process(
      actionDef,
      actorEntity,
      simpleContext,
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(2);
    expect(result.value.actions.map((a) => a.command)).toEqual([
      'greet Talia',
      'greet Marek',
    ]);
    expect(result.value.errors).toHaveLength(0);
    expect(
      calls.step.some((entry) =>
        entry.message.includes('Processing candidate action')
      )
    ).toBe(true);
  });

  it('wraps prerequisite evaluation failures into structured error contexts even when timestamps are falsy', () => {
    const originalNow = Date.now;
    Date.now = () => 0;
    try {
      const failingPrereqService = {
        evaluate() {
          throw new Error('evaluation exploded');
        },
      };
      const { processor, actionErrorContextBuilder } = createProcessor({
        prerequisiteEvaluationService: failingPrereqService,
        targetResolutionService: {
          resolveTargets() {
            throw new Error('should not be reached');
          },
        },
      });

      const actionDef = { ...baseAction, id: 'social:handshake' };
      const result = processor.process(actionDef, actor, simpleContext);

      expect(result.success).toBe(true);
      expect(result.value.cause).toBe('prerequisite-error');
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(actionErrorContextBuilder.calls).toHaveLength(2);
      const context = actionErrorContextBuilder.calls[0].context;
      expect(context.phase).toBe(ERROR_PHASES.VALIDATION);
      expect(context.timestamp).toBe(0);
    } finally {
      Date.now = originalNow;
    }
  });

  it('passes through builder-generated ActionErrorContext when prerequisites throw with standard timestamp', () => {
    const failingPrereqService = {
      evaluate() {
        throw new Error('evaluation exploded');
      },
    };
    const { processor, actionErrorContextBuilder } = createProcessor({
      prerequisiteEvaluationService: failingPrereqService,
      targetResolutionService: {
        resolveTargets() {
          throw new Error('should not be reached');
        },
      },
    });

    const result = processor.process(baseAction, actor, simpleContext);

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('prerequisite-error');
    expect(result.value.errors).toHaveLength(1);
    expect(actionErrorContextBuilder.calls).toHaveLength(1);
    const [firstCall] = actionErrorContextBuilder.calls;
    expect(firstCall.context.timestamp).toBeGreaterThan(0);
  });

  it('returns prerequisites-failed when evaluation returns false without errors', () => {
    const prereqService = {
      evaluate() {
        return false;
      },
    };
    const { processor } = createProcessor({
      prerequisiteEvaluationService: prereqService,
      targetResolutionService: {
        resolveTargets() {
          throw new Error('should not be reached');
        },
      },
    });
    const { trace, calls } = createTraceWithoutStructuredSpan();

    const result = processor.process(baseAction, actor, simpleContext, trace);

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('prerequisites-failed');
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.errors).toHaveLength(0);
    expect(calls.failure).toHaveLength(1);
  });

  it('supports prerequisite failures without explicit error payloads', () => {
    const originalFailure = ActionResult.failure;
    ActionResult.failure = () => ({ success: false });
    try {
      const failingPrereqService = {
        evaluate() {
          throw new Error('evaluation exploded');
        },
      };
      const { processor } = createProcessor({
        prerequisiteEvaluationService: failingPrereqService,
        targetResolutionService: {
          resolveTargets() {
            throw new Error('should not be reached');
          },
        },
      });

      const result = processor.process(baseAction, actor, simpleContext);

      expect(result.success).toBe(true);
      expect(result.value.cause).toBe('prerequisite-error');
      expect(result.value.errors).toHaveLength(0);
    } finally {
      ActionResult.failure = originalFailure;
    }
  });

  it('reuses prebuilt ActionErrorContext objects returned by target resolution failures', () => {
    const prebuiltError = {
      actionId: baseAction.id,
      actorId: 'hero',
      phase: ERROR_PHASES.VALIDATION,
      timestamp: 123456,
      error: new Error('scope validation failed'),
    };
    const spanCalls = { info: [], step: [], success: [], failure: [] };
    const spanTrace = {
      withSpan(name, executor) {
        expect(name).toBe('candidate.process');
        return executor();
      },
      info: (message, source) => spanCalls.info.push({ message, source }),
      step: (message, source) => spanCalls.step.push({ message, source }),
      success: (message, source) => spanCalls.success.push({ message, source }),
      failure: (message, source) => spanCalls.failure.push({ message, source }),
    };
    const { processor, actionErrorContextBuilder } = createProcessor({
      targetResolutionService: {
        resolveTargets() {
          return ActionResult.failure(prebuiltError);
        },
      },
    });

    const result = processor.process(
      baseAction,
      actor,
      simpleContext,
      spanTrace
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);
    const [errorContext] = result.value.errors;
    expect(errorContext.actionId).toBe(prebuiltError.actionId);
    expect(errorContext.phase).toBe(prebuiltError.phase);
    expect(errorContext.timestamp).toBe(prebuiltError.timestamp);
    expect(errorContext.error.message).toBe('scope validation failed');
    expect(actionErrorContextBuilder.calls).toHaveLength(0);
  });

  it('builds error context when target resolution returns raw errors', () => {
    const rawFailureService = {
      resolveTargets() {
        return ActionResult.failure(new Error('unresolved scope'));
      },
    };
    const { processor, actionErrorContextBuilder } = createProcessor({
      targetResolutionService: rawFailureService,
    });

    const result = processor.process(baseAction, actor, simpleContext);

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);
    expect(actionErrorContextBuilder.calls).toHaveLength(1);
    expect(result.value.errors[0].error.message).toContain('unresolved scope');
  });

  it('handles target resolution failures that omit error arrays', () => {
    const { processor } = createProcessor({
      targetResolutionService: {
        resolveTargets() {
          return { success: false };
        },
      },
    });

    const result = processor.process(baseAction, actor, simpleContext);

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(0);
  });

  it('returns no-targets when scope resolves without targets', () => {
    const emptyScopeService = {
      resolveTargets() {
        return ActionResult.success([]);
      },
    };
    const { processor, logger } = createProcessor({
      targetResolutionService: emptyScopeService,
    });

    const result = processor.process(baseAction, actor, simpleContext);

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('no-targets');
    expect(result.value.actions).toHaveLength(0);
    expect(
      logger.debugMessages.some((args) =>
        args[0].includes('resolved to 0 targets')
      )
    ).toBe(true);
  });

  it('captures thrown errors from target resolution and enriches them with context', () => {
    const throwingService = {
      resolveTargets() {
        throw new Error('scope exploded');
      },
    };
    const { processor, actionErrorContextBuilder, logger } = createProcessor({
      targetResolutionService: throwingService,
    });

    const result = processor.process(baseAction, actor, simpleContext);

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);
    expect(actionErrorContextBuilder.calls).toHaveLength(1);
    expect(logger.errorMessages[0][0]).toContain('Error resolving scope');
  });

  it('collects formatting errors when command formatter returns a structured failure', () => {
    class ResultFailingFormatter extends ActionCommandFormatter {
      constructor(options, failingTargetId) {
        super(options);
        this.failingTargetId = failingTargetId;
      }

      format(actionDef, targetContext, entityManager, options, deps) {
        if (targetContext.entityId === this.failingTargetId) {
          return {
            ok: false,
            error: 'formatter rejected target',
            details: { reason: 'custom' },
          };
        }
        return super.format(
          actionDef,
          targetContext,
          entityManager,
          options,
          deps
        );
      }
    }

    const customFormatter = new ResultFailingFormatter(
      { logger: new RecordingLogger() },
      'companion'
    );
    const { processor, logger } = createProcessor({
      actionCommandFormatter: customFormatter,
      targetResolutionService: {
        resolveTargets() {
          return ActionResult.success([
            ActionTargetContext.forEntity('observer'),
            ActionTargetContext.forEntity('companion'),
          ]);
        },
      },
    });

    const result = processor.process(baseAction, actor, simpleContext);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(1);
    expect(result.value.errors).toHaveLength(1);
    const [errorContext] = result.value.errors;
    expect(errorContext.additionalContext.formatDetails.reason).toBe('custom');
    expect(
      logger.warnMessages.some((args) =>
        args[0].includes('Failed to format command')
      )
    ).toBe(true);
  });

  it('continues processing when one target formats successfully and another throws', () => {
    class PartiallyThrowingFormatter extends ActionCommandFormatter {
      constructor(options, failingTargetId) {
        super(options);
        this.failingTargetId = failingTargetId;
      }

      format(actionDef, targetContext, entityManager, options, deps) {
        if (targetContext.entityId === this.failingTargetId) {
          throw new Error('formatting failure');
        }
        return super.format(
          actionDef,
          targetContext,
          entityManager,
          options,
          deps
        );
      }
    }

    const customFormatter = new PartiallyThrowingFormatter(
      {
        logger: new RecordingLogger(),
      },
      'companion'
    );

    const { processor, logger } = createProcessor({
      actionCommandFormatter: customFormatter,
      targetResolutionService: {
        resolveTargets() {
          return ActionResult.success([
            ActionTargetContext.forEntity('observer'),
            ActionTargetContext.forEntity('companion'),
          ]);
        },
      },
    });

    const result = processor.process(baseAction, actor, simpleContext);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(1);
    expect(result.value.actions[0].params.targetId).toBe('observer');
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0].targetId).toBe('companion');
    expect(
      logger.errorMessages.some((args) =>
        args[0].includes('Error formatting action')
      )
    ).toBe(true);
  });
});
