import { describe, it, expect } from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { FixSuggestionEngine } from '../../../src/actions/errors/fixSuggestionEngine.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';
import { createActionErrorContext } from '../../../src/actions/utils/discoveryErrorUtils.js';

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

class ConfigurableScopeResolver {
  constructor() {
    this.behaviors = new Map();
  }

  setBehavior(scopeName, behavior) {
    this.behaviors.set(scopeName, behavior);
  }

  resolve(scopeName, context) {
    const handler = this.behaviors.get(scopeName);
    if (!handler) {
      return ActionResult.success(new Set());
    }
    return handler(context);
  }
}

const displayNameFromEntity = (entity, fallback) => {
  const component = entity?.components?.['identity:name'];
  return component?.text ?? fallback;
};

class MinimalMetadataErrorBuilder extends ActionErrorContextBuilder {
  buildErrorContext(params) {
    const context = super.buildErrorContext(params);
    // Simulate legacy errors that omit timestamp metadata so the processor
    // exercises the branch that rebuilds the context.
    // Keep the phase so createActionErrorContext validation succeeds.
    const cloned = { ...context };
    delete cloned.timestamp;
    return cloned;
  }
}

class ThrowingFormatter extends ActionCommandFormatter {
  format() {
    throw new Error('formatter exploded');
  }
}

/**
 *
 * @param overrides
 */
function createHarness(overrides = {}) {
  const logger = overrides.logger ?? new RecordingLogger();
  const dispatcher = overrides.dispatcher ?? new RecordingDispatcher();
  const entityManager =
    overrides.entityManager ??
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
        id: 'observer',
        components: {
          'identity:name': { text: 'Orion' },
        },
      },
    ]);

  const defaultActionDefinition = {
    id: 'social:greet_companion',
    name: 'Greet Companion',
    description: 'Offer a friendly greeting',
    scope: 'core:other_actors',
    template: 'Greet {target}',
    prerequisites: [
      {
        id: 'friendly-check',
        description: 'Actor must be friendly',
        logic: {
          '==': [{ var: 'actor.components.core:traits.friendly' }, true],
        },
      },
    ],
    required_components: { actor: ['core:traits'] },
  };

  const actionDefinition = {
    ...defaultActionDefinition,
    ...overrides.actionDefinition,
  };

  const actionIndex = new ActionIndex({ logger, entityManager });
  actionIndex.buildIndex([actionDefinition]);

  const gameDataRepository = {
    getConditionDefinition: () => null,
    getComponentDefinition: (componentId) => ({ id: componentId }),
  };

  const fixSuggestionEngine =
    overrides.fixSuggestionEngine ??
    new FixSuggestionEngine({
      logger,
      gameDataRepository,
      actionIndex,
    });

  const errorContextBuilder =
    overrides.actionErrorContextBuilder ??
    new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });

  const validationContextBuilder = new ActionValidationContextBuilder({
    entityManager,
    logger,
  });

  const jsonLogicService = new JsonLogicEvaluationService({
    logger,
    gameDataRepository,
  });

  const prerequisiteEvaluationService =
    overrides.prerequisiteEvaluationService ??
    new PrerequisiteEvaluationService({
      logger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: validationContextBuilder,
      gameDataRepository,
    });

  const scopeResolver =
    overrides.scopeResolver ?? new ConfigurableScopeResolver();

  const targetResolutionService =
    overrides.targetResolutionService ??
    new TargetResolutionService({
      unifiedScopeResolver: scopeResolver,
      logger,
    });

  const actionCommandFormatter =
    overrides.actionCommandFormatter ?? new ActionCommandFormatter();

  const processor = new ActionCandidateProcessor({
    prerequisiteEvaluationService,
    targetResolutionService,
    entityManager,
    actionCommandFormatter,
    safeEventDispatcher: dispatcher,
    getEntityDisplayNameFn:
      overrides.getEntityDisplayNameFn ?? displayNameFromEntity,
    logger,
    actionErrorContextBuilder: errorContextBuilder,
  });

  return {
    processor,
    logger,
    dispatcher,
    entityManager,
    scopeResolver,
    actionDefinition,
    actionContext: overrides.actionContext ?? { currentLocation: 'plaza' },
    gameDataRepository,
    fixSuggestionEngine,
  };
}

describe('ActionCandidateProcessor real service edge cases', () => {
  it('falls back to internal processing and rebuilds context for legacy prerequisite errors', () => {
    const base = createHarness();
    const legacyActionIndex = new ActionIndex({
      logger: base.logger,
      entityManager: base.entityManager,
    });
    legacyActionIndex.buildIndex([base.actionDefinition]);

    const legacyFixSuggestionEngine = new FixSuggestionEngine({
      logger: base.logger,
      gameDataRepository: base.gameDataRepository,
      actionIndex: legacyActionIndex,
    });

    const legacyErrorBuilder = new MinimalMetadataErrorBuilder({
      entityManager: base.entityManager,
      logger: base.logger,
      fixSuggestionEngine: legacyFixSuggestionEngine,
    });

    const harness = createHarness({
      logger: base.logger,
      dispatcher: base.dispatcher,
      entityManager: base.entityManager,
      fixSuggestionEngine: legacyFixSuggestionEngine,
      actionDefinition: base.actionDefinition,
      actionErrorContextBuilder: legacyErrorBuilder,
      prerequisiteEvaluationService: {
        evaluate() {
          throw new Error('legacy failure');
        },
      },
    });

    const actor = harness.entityManager.getEntityInstance('hero');
    const rawTrace = {
      logs: [],
      step: () => {},
      success: () => {},
      failure: () => {},
      info: () => {},
      data: () => {},
    };

    const result = harness.processor.process(
      harness.actionDefinition,
      actor,
      harness.actionContext,
      rawTrace
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('prerequisite-error');
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0].phase).toBe(ERROR_PHASES.VALIDATION);
    expect(result.value.errors[0].error.error.message).toBe('legacy failure');
  });

  it('propagates structured target resolution errors without rebuilding metadata', () => {
    const harness = createHarness();

    harness.scopeResolver.setBehavior('core:other_actors', () =>
      ActionResult.failure(
        createActionErrorContext({
          actionId: harness.actionDefinition.id,
          actorId: 'hero',
          phase: ERROR_PHASES.VALIDATION,
          error: new Error('downstream failure'),
          timestamp: Date.now(),
          environmentContext: {
            scope: 'core:other_actors',
            timestamp: Date.now(),
          },
        })
      )
    );

    const actor = harness.entityManager.getEntityInstance('hero');
    const result = harness.processor.process(
      harness.actionDefinition,
      actor,
      harness.actionContext,
      null
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0].error.message).toBe('downstream failure');
    expect(result.value.errors[0].environmentContext.scope).toBe(
      'core:other_actors'
    );
  });

  it('returns actions when prerequisites are omitted entirely', () => {
    const harness = createHarness({
      actionDefinition: {
        prerequisites: [],
        description: undefined,
        visual: { icon: 'wave' },
      },
    });

    harness.scopeResolver.setBehavior('core:other_actors', () =>
      ActionResult.success(new Set(['companion', 'observer']))
    );

    const actor = harness.entityManager.getEntityInstance('hero');
    const result = harness.processor.process(
      harness.actionDefinition,
      actor,
      harness.actionContext,
      undefined
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(2);
    expect(result.value.actions[0]).toEqual(
      expect.objectContaining({
        description: '',
        visual: { icon: 'wave' },
      })
    );
  });

  it('captures thrown errors from the target resolution service', () => {
    const throwingResolver = {
      resolveTargets() {
        throw new Error('scope explosion');
      },
    };

    const harness = createHarness({
      targetResolutionService: throwingResolver,
    });

    const actor = harness.entityManager.getEntityInstance('hero');
    const result = harness.processor.process(
      harness.actionDefinition,
      actor,
      harness.actionContext,
      null
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors[0].error.message).toBe('scope explosion');
    expect(
      harness.logger.errorLogs.some(([message]) =>
        message.includes(
          "Error resolving scope for action 'social:greet_companion'"
        )
      )
    ).toBe(true);
  });

  it('captures formatter exceptions and surfaces them as validation errors', () => {
    const harness = createHarness({
      actionCommandFormatter: new ThrowingFormatter(),
    });

    harness.scopeResolver.setBehavior('core:other_actors', () =>
      ActionResult.success(new Set(['companion']))
    );

    const actor = harness.entityManager.getEntityInstance('hero');
    const trace = {
      withSpan: (name, fn) => fn(),
      logs: [],
      step: () => {},
      success: () => {},
      failure: () => {},
      info: () => {},
      data: () => {},
    };

    const result = harness.processor.process(
      harness.actionDefinition,
      actor,
      harness.actionContext,
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0].error.message).toBe('formatter exploded');
    expect(
      harness.logger.errorLogs.some(([message]) =>
        message.includes("Error formatting action 'social:greet_companion'")
      )
    ).toBe(true);
  });
});
