import { describe, it, beforeEach, expect } from '@jest/globals';
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

  resolve(scopeName, context, options) {
    const behavior = this.behaviors.get(scopeName);
    if (!behavior) {
      return ActionResult.success([]);
    }
    return behavior(context, options);
  }
}

class TestTrace {
  constructor() {
    this.spans = [];
    this.events = [];
    this.logs = [];
  }

  #record(type, message, source = 'TestTrace', data) {
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

  withSpan(name, fn, attrs) {
    this.spans.push({ name, attrs });
    return fn();
  }

  step(message, source, data) {
    this.#record('step', message, source, data);
  }

  success(message, source, data) {
    this.#record('success', message, source, data);
  }

  failure(message, source, data) {
    this.#record('failure', message, source, data);
  }

  info(message, source, data) {
    this.#record('info', message, source, data);
  }

  data(message, source, data) {
    this.#record('data', message, source, data);
  }

  error(message, source, data) {
    this.#record('error', message, source, data);
  }
}

const displayNameFromEntity = (entity, fallback) => {
  const component = entity?.components?.['identity:name'];
  return component?.text ?? fallback;
};

describe('ActionCandidateProcessor with real collaborators', () => {
  /** @type {RecordingLogger} */
  let logger;
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {ActionIndex} */
  let actionIndex;
  /** @type {FixSuggestionEngine} */
  let fixSuggestionEngine;
  /** @type {ActionErrorContextBuilder} */
  let errorContextBuilder;
  /** @type {ActionValidationContextBuilder} */
  let validationContextBuilder;
  /** @type {JsonLogicEvaluationService} */
  let jsonLogicService;
  /** @type {PrerequisiteEvaluationService} */
  let prerequisiteEvaluationService;
  /** @type {ConfigurableScopeResolver} */
  let scopeResolver;
  /** @type {TargetResolutionService} */
  let targetResolutionService;
  /** @type {ActionCommandFormatter} */
  let formatter;
  /** @type {RecordingDispatcher} */
  let dispatcher;
  /** @type {ActionCandidateProcessor} */
  let processor;
  /** @type {TestTrace} */
  let trace;
  /** @type {object} */
  let gameDataRepository;
  /** @type {object} */
  let actionDefinition;
  const actionContext = { currentLocation: 'plaza', weather: 'clear' };

  beforeEach(() => {
    logger = new RecordingLogger();
    dispatcher = new RecordingDispatcher();
    trace = new TestTrace();

    const entities = [
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
    ];

    entityManager = new SimpleEntityManager(entities);

    actionDefinition = {
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

    actionIndex = new ActionIndex({ logger, entityManager });
    actionIndex.buildIndex([actionDefinition]);

    gameDataRepository = {
      getConditionDefinition: () => null,
      getComponentDefinition: (componentId) => ({ id: componentId }),
    };

    fixSuggestionEngine = new FixSuggestionEngine({
      logger,
      gameDataRepository,
      actionIndex,
    });

    errorContextBuilder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });

    validationContextBuilder = new ActionValidationContextBuilder({
      entityManager,
      logger,
    });

    jsonLogicService = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });

    prerequisiteEvaluationService = new PrerequisiteEvaluationService({
      logger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: validationContextBuilder,
      gameDataRepository,
    });

    scopeResolver = new ConfigurableScopeResolver();
    targetResolutionService = new TargetResolutionService({
      unifiedScopeResolver: scopeResolver,
      logger,
    });

    formatter = new ActionCommandFormatter();

    processor = new ActionCandidateProcessor({
      prerequisiteEvaluationService,
      targetResolutionService,
      entityManager,
      actionCommandFormatter: formatter,
      safeEventDispatcher: dispatcher,
      getEntityDisplayNameFn: displayNameFromEntity,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
    });
  });

  const processAction = () => {
    const actor = entityManager.getEntityInstance('hero');
    return processor.process(actionDefinition, actor, actionContext, trace);
  };

  it('processes actions end-to-end with prerequisite evaluation and formatting', () => {
    scopeResolver.setBehavior('core:other_actors', () =>
      ActionResult.success(new Set(['companion']))
    );

    const result = processAction();

    expect(result.success).toBe(true);
    expect(result.value.actions).toEqual([
      {
        id: 'social:greet_companion',
        name: 'Greet Companion',
        command: 'Greet Talia',
        description: 'Offer a friendly greeting',
        params: { targetId: 'companion' },
        visual: null,
      },
    ]);
    expect(result.value.errors).toHaveLength(0);
    expect(trace.spans.map((span) => span.name)).toContain('candidate.process');
    expect(
      trace.events.some(
        (event) =>
          event.type === 'info' &&
          event.message.includes(
            "Scope for action 'social:greet_companion' resolved"
          )
      )
    ).toBe(true);
  });

  it('returns cause "prerequisites-failed" when evaluation returns false', async () => {
    await entityManager.addComponent('hero', 'core:traits', {
      friendly: false,
    });

    scopeResolver.setBehavior('core:other_actors', () =>
      ActionResult.success(new Set(['companion']))
    );

    const result = processAction();

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('prerequisites-failed');
    expect(result.value.errors).toHaveLength(0);
  });

  it('wraps prerequisite evaluation errors with enhanced context', () => {
    const crashingPrereqService = {
      evaluate() {
        throw new Error('evaluation crashed');
      },
    };

    const errorProcessor = new ActionCandidateProcessor({
      prerequisiteEvaluationService: crashingPrereqService,
      targetResolutionService,
      entityManager,
      actionCommandFormatter: formatter,
      safeEventDispatcher: dispatcher,
      getEntityDisplayNameFn: displayNameFromEntity,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
    });

    const actor = entityManager.getEntityInstance('hero');
    const localTrace = new TestTrace();
    const result = errorProcessor.process(
      actionDefinition,
      actor,
      actionContext,
      localTrace
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('prerequisite-error');
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0].error.message).toBe('evaluation crashed');
  });

  it('captures target resolution failures and builds actionable errors', () => {
    scopeResolver.setBehavior('core:other_actors', () =>
      ActionResult.failure({
        message: 'No valid targets',
        phase: ERROR_PHASES.VALIDATION,
      })
    );

    const result = processAction();

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0].phase).toBe(ERROR_PHASES.VALIDATION);
    expect(result.value.errors[0].environmentContext.scope).toBe(
      'core:other_actors'
    );
  });

  it('skips formatting when no targets are resolved', () => {
    scopeResolver.setBehavior('core:other_actors', () =>
      ActionResult.success(new Set())
    );

    const result = processAction();

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('no-targets');
  });

  it('collects formatting errors while continuing processing', () => {
    scopeResolver.setBehavior('core:other_actors', () =>
      ActionResult.success(new Set(['companion']))
    );

    const failingDisplayName = () => {
      throw new Error('display name failure');
    };

    const errorProcessor = new ActionCandidateProcessor({
      prerequisiteEvaluationService,
      targetResolutionService,
      entityManager,
      actionCommandFormatter: formatter,
      safeEventDispatcher: dispatcher,
      getEntityDisplayNameFn: failingDisplayName,
      logger,
      actionErrorContextBuilder: errorContextBuilder,
    });

    const actor = entityManager.getEntityInstance('hero');
    const localTrace = new TestTrace();
    const result = errorProcessor.process(
      actionDefinition,
      actor,
      actionContext,
      localTrace
    );

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.errors).toHaveLength(1);
    expect(
      logger.warnLogs.some((entry) =>
        entry[0].includes(
          "Failed to format command for action 'social:greet_companion'"
        )
      )
    ).toBe(true);
    expect(dispatcher.events).not.toHaveLength(0);
  });
});
