import { describe, it, expect } from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';

class TestLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, details) {
    this.debugLogs.push({ message, details });
  }

  info(message, details) {
    this.infoLogs.push({ message, details });
  }

  warn(message, details) {
    this.warnLogs.push({ message, details });
  }

  error(message, details) {
    this.errorLogs.push({ message, details });
  }
}

class StubEntityManager {
  constructor() {
    this.entities = new Map();
  }

  addEntity(entity) {
    this.entities.set(entity.id, entity);
  }

  getEntityInstance(id) {
    return this.entities.get(id);
  }

  getAllComponentTypesForEntity(id) {
    const entity = this.entities.get(id);
    return entity ? Object.keys(entity.components ?? {}) : [];
  }

  getComponentData(id, componentType) {
    const entity = this.entities.get(id);
    return entity?.components?.[componentType] ?? null;
  }
}

class StubFixSuggestionEngine {
  suggestFixes() {
    return [];
  }
}

class TimestampStrippingErrorBuilder extends ActionErrorContextBuilder {
  buildErrorContext(params) {
    const context = super.buildErrorContext(params);
    delete context.timestamp;
    if (context.environmentContext) {
      delete context.environmentContext.timestamp;
    }
    return context;
  }
}

class StubPrerequisiteService {
  constructor(impl) {
    this.impl = impl;
    this.calls = [];
  }

  evaluate(prereqs, actionDef, actor, trace) {
    this.calls.push({ prereqs, actionDef, actor, trace });
    return this.impl(prereqs, actionDef, actor, trace);
  }
}

class StubTargetResolutionService {
  constructor(impl) {
    this.impl = impl;
    this.calls = [];
  }

  resolveTargets(scope, actor, context, trace, actionId) {
    this.calls.push({ scope, actor, context, trace, actionId });
    return this.impl(scope, actor, context, trace, actionId);
  }
}

class StubCommandFormatter {
  format(actionDef, targetContext) {
    return {
      ok: true,
      value: `${actionDef.commandVerb ?? actionDef.id}:${targetContext?.entityId ?? 'none'}`,
    };
  }
}

class NoopEventDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    return true;
  }
}

/**
 *
 * @param root0
 * @param root0.prerequisiteImpl
 * @param root0.targetImpl
 * @param root0.logger
 */
function createProcessor({
  prerequisiteImpl,
  targetImpl,
  logger = new TestLogger(),
}) {
  const entityManager = new StubEntityManager();
  entityManager.addEntity({
    id: 'actor-1',
    type: 'test:actor',
    name: 'Test Actor',
    components: {
      'core:location': { value: 'room-7' },
      'core:identity': { value: 'test-identity' },
    },
  });

  const builder = new TimestampStrippingErrorBuilder({
    entityManager,
    logger,
    fixSuggestionEngine: new StubFixSuggestionEngine(),
  });

  const prerequisiteService = new StubPrerequisiteService(prerequisiteImpl);
  const targetService = new StubTargetResolutionService(targetImpl);
  const safeEventDispatcher = new NoopEventDispatcher();
  const commandFormatter = new StubCommandFormatter();

  const processor = new ActionCandidateProcessor({
    prerequisiteEvaluationService: prerequisiteService,
    targetResolutionService: targetService,
    entityManager,
    actionCommandFormatter: commandFormatter,
    safeEventDispatcher,
    getEntityDisplayNameFn: (entity, fallback) => entity?.name ?? fallback,
    logger,
    actionErrorContextBuilder: builder,
  });

  return {
    processor,
    logger,
    entityManager,
    builder,
    prerequisiteService,
    targetService,
    safeEventDispatcher,
    commandFormatter,
  };
}

describe('ActionCandidateProcessor integration error paths', () => {
  const baseAction = {
    id: 'action:test',
    name: 'Test Action',
    commandVerb: 'test',
    scope: 'scope:test',
    prerequisites: [{ logic: { always: true } }],
  };

  const actorEntity = { id: 'actor-1', name: 'Test Actor' };
  const baseContext = { currentLocation: 'room-7' };

  it('wraps raw prerequisite errors into actionable error contexts', () => {
    const { processor, targetService } = createProcessor({
      prerequisiteImpl: () => {
        throw new Error('Prerequisite evaluation failed');
      },
      targetImpl: () => {
        throw new Error('Target resolution should not run');
      },
    });

    const result = processor.process(baseAction, actorEntity, baseContext);

    expect(targetService.calls).toHaveLength(0);
    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('prerequisite-error');
    expect(result.value.errors).toHaveLength(1);

    const [errorContext] = result.value.errors;
    expect(errorContext.actionId).toBe(baseAction.id);
    expect(errorContext.actorId).toBe(actorEntity.id);
    expect(
      errorContext.error.environmentContext.errorStack
    ).toContain('Prerequisite evaluation failed');
    expect(errorContext.environmentContext).toMatchObject({
      phase: 'validation',
      errorName: 'Error',
    });
  });

  it('adds contextual details when target resolution returns raw errors', () => {
    const { processor, targetService } = createProcessor({
      prerequisiteImpl: () => true,
      targetImpl: (scope, actor, context) => {
        expect(scope).toBe(baseAction.scope);
        expect(actor.id).toBe(actorEntity.id);
        expect(context).toMatchObject(baseContext);
        return ActionResult.failure([new Error('target resolution failed')]);
      },
    });

    const result = processor.process(baseAction, actorEntity, baseContext);

    expect(targetService.calls).toHaveLength(1);
    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);

    const [errorContext] = result.value.errors;
    expect(errorContext.actionId).toBe(baseAction.id);
    expect(errorContext.environmentContext.scope).toBe(baseAction.scope);
    expect(errorContext.environmentContext.errorStack).toContain(
      'target resolution failed'
    );
  });

  it('gracefully handles prerequisite failures without explicit error arrays', () => {
    const originalFailure = ActionResult.failure;
    const { processor, targetService } = createProcessor({
      prerequisiteImpl: () => {
        throw new Error('synthetic prerequisite failure');
      },
      targetImpl: () => {
        throw new Error('target service should not be invoked');
      },
    });

    ActionResult.failure = () => ({ success: false });

    try {
      const result = processor.process(baseAction, actorEntity, baseContext);

      expect(targetService.calls).toHaveLength(0);
      expect(result.success).toBe(true);
      expect(result.value.cause).toBe('prerequisite-error');
      expect(result.value.errors).toEqual([]);
    } finally {
      ActionResult.failure = originalFailure;
    }
  });

  it('returns resolution errors even when no error payload is provided', () => {
    const { processor, targetService } = createProcessor({
      prerequisiteImpl: () => true,
      targetImpl: () => ({ success: false }),
    });

    const result = processor.process(baseAction, actorEntity, baseContext);

    expect(targetService.calls).toHaveLength(1);
    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toEqual([]);
  });

  it('logs and surfaces target resolution exceptions via ActionResult failure', () => {
    const logger = new TestLogger();
    const thrown = new Error('scope exploded');
    const { processor, logger: serviceLogger, targetService } = createProcessor({
      prerequisiteImpl: () => true,
      targetImpl: () => {
        throw thrown;
      },
      logger,
    });

    const result = processor.process(baseAction, actorEntity, baseContext);

    expect(targetService.calls).toHaveLength(1);
    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);
    expect(
      result.value.errors[0].error.environmentContext.errorStack
    ).toContain('scope exploded');

    expect(serviceLogger.errorLogs.some(({ message }) =>
      message.includes("Error resolving scope for action 'action:test'"),
    )).toBe(true);
  });
});
