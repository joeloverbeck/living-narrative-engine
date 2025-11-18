/**
 * @file Structured trace integration tests for the ActionPipelineOrchestrator.
 * @description Exercises orchestrator behaviour with structured tracing and
 *              mixed success/error outcomes using real pipeline stages.
 */

import { describe, it, expect } from '@jest/globals';
import { ActionPipelineOrchestrator } from '../../../../src/actions/actionPipelineOrchestrator.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { TargetComponentValidator } from '../../../../src/actions/validation/TargetComponentValidator.js';
import TargetRequiredComponentsValidator from '../../../../src/actions/validation/TargetRequiredComponentsValidator.js';
import { PipelineStage } from '../../../../src/actions/pipeline/PipelineStage.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, details) {
    this.debugMessages.push({ message, details });
  }

  info(message, details) {
    this.infoMessages.push({ message, details });
  }

  warn(message, details) {
    this.warnMessages.push({ message, details });
  }

  error(message, details) {
    this.errorMessages.push({ message, details });
  }
}

class StructuredTrace {
  constructor() {
    this.events = [];
    this.spans = [];
    this.logs = [];
  }

  async withSpanAsync(name, executor, metadata) {
    this.spans.push({ name, metadata });
    this.events.push({ type: 'span-start', name, metadata });
    try {
      const result = await executor();
      this.events.push({ type: 'span-end', name, status: 'success' });
      return result;
    } catch (error) {
      this.events.push({ type: 'span-end', name, status: 'error', error });
      throw error;
    }
  }

  info(message, source, payload) {
    const entry = {
      type: 'info',
      message,
      source,
      payload,
      timestamp: Date.now(),
      data: payload,
    };
    this.events.push(entry);
    this.logs.push(entry);
  }

  step(message, source, payload) {
    const entry = {
      type: 'step',
      message,
      source,
      payload,
      timestamp: Date.now(),
      data: payload,
    };
    this.events.push(entry);
    this.logs.push(entry);
  }

  success(message, source, payload) {
    const entry = {
      type: 'success',
      message,
      source,
      payload,
      timestamp: Date.now(),
      data: payload,
    };
    this.events.push(entry);
    this.logs.push(entry);
  }

  failure(message, source, payload) {
    const entry = {
      type: 'failure',
      message,
      source,
      payload,
      timestamp: Date.now(),
      data: payload,
    };
    this.events.push(entry);
    this.logs.push(entry);
  }

  data(message, source, payload) {
    const entry = {
      type: 'data',
      message,
      source,
      payload,
      timestamp: Date.now(),
      data: payload,
    };
    this.events.push(entry);
    this.logs.push(entry);
  }

  captureActionData(category, actionId, payload) {
    const entry = {
      type: 'action-data',
      category,
      actionId,
      payload,
      timestamp: Date.now(),
      source: `${category}:${actionId}`,
      message: `action:${category}`,
      data: payload,
    };
    this.events.push(entry);
    this.logs.push(entry);
  }
}

class SimplePrerequisiteService {
  evaluate(prerequisites) {
    if (!prerequisites || prerequisites.length === 0) {
      return true;
    }

    if (Array.isArray(prerequisites)) {
      return prerequisites.every((rule) => !rule?.shouldFail);
    }

    return true;
  }
}

class ScenarioCommandFormatter {
  constructor() {
    this.formatted = [];
    this.failed = [];
  }

  format(actionDef, targetContext) {
    if (actionDef.shouldFailFormatting) {
      const error = new Error(`Unable to format ${actionDef.id}`);
      this.failed.push({ actionId: actionDef.id, error });
      return { ok: false, error };
    }

    const command = `${actionDef.command}:${targetContext?.entityId ?? 'none'}`;
    this.formatted.push({ actionId: actionDef.id, command });
    return {
      ok: true,
      value: command,
      params: { targetId: targetContext?.entityId ?? null },
    };
  }
}

class SimpleSafeEventDispatcher {
  constructor() {
    this.dispatchedEvents = [];
  }

  dispatch(eventName, payload) {
    this.dispatchedEvents.push({ eventName, payload });
    return { ok: true };
  }

  subscribe() {}

  unsubscribe() {}
}

class SimpleTargetResolutionService {
  resolveTargets() {
    return { success: true, value: [] };
  }
}

class SimpleUnifiedScopeResolver {
  resolve() {
    return [];
  }
}

class SimpleTargetContextBuilder {
  constructor(entityManager) {
    this.entityManager = entityManager;
  }

  build(actionDef) {
    const targetId = actionDef.target_entity?.id;
    if (!targetId) {
      return [];
    }

    const targetEntity = this.entityManager.getEntityInstance(targetId);
    return targetEntity
      ? [
          {
            entityId: targetEntity.id,
            entity: targetEntity,
            displayName: `Display:${targetEntity.id}`,
          },
        ]
      : [];
  }
}

class SimpleMultiTargetStage extends PipelineStage {
  constructor(entityManager) {
    super('MultiTargetResolution');
    this.entityManager = entityManager;
  }

  async executeInternal(context) {
    const { candidateActions = [] } = context;

    const actionsWithTargets = candidateActions.map((actionDef) => {
      const targetId = actionDef.target_entity?.id ?? null;
      const targetEntity = targetId
        ? this.entityManager.getEntityInstance(targetId)
        : null;

      const targetContexts = targetEntity
        ? [
            {
              entityId: targetEntity.id,
              entity: targetEntity,
              displayName: `Display:${targetEntity.id}`,
            },
          ]
        : [];

      return { actionDef, targetContexts };
    });

    return PipelineResult.success({
      data: {
        actionsWithTargets,
      },
    });
  }
}

class ThrowingStage extends PipelineStage {
  constructor() {
    super('MultiTargetResolution');
  }

  async executeInternal() {
    throw new Error('Target resolution failed');
  }
}

class TestGameDataRepository {
  getComponentDefinition(componentId) {
    return { id: componentId, name: componentId };
  }

  getConditionDefinition(conditionId) {
    return { id: conditionId, logic: { var: conditionId } };
  }
}

/**
 *
 * @param root0
 * @param root0.multiTargetStage
 * @param root0.commandFormatter
 * @param root0.prerequisiteService
 * @param root0.actionsFactory
 */
function createHarness({
  multiTargetStage,
  commandFormatter,
  prerequisiteService,
  actionsFactory,
} = {}) {
  const logger = new RecordingLogger();
  const entityManager = new SimpleEntityManager([
    {
      id: 'hero-1',
      components: {
        'core:talker': {},
        'core:location': { value: 'lounge' },
      },
    },
    {
      id: 'friend-1',
      components: {
        'core:friend': {},
      },
    },
    {
      id: 'rival-1',
      components: {
        'core:friend': {},
        'core:blocked': {},
      },
    },
  ]);

  const defaultActions = () => {
    const friend = entityManager.getEntityInstance('friend-1');
    const rival = entityManager.getEntityInstance('rival-1');

    return [
      {
        id: 'social:wave',
        name: 'Wave',
        command: 'wave',
        required_components: { actor: ['core:talker'] },
        target_entity: friend,
      },
      {
        id: 'social:hug',
        name: 'Hug',
        command: 'hug',
        required_components: { actor: ['core:talker'] },
        shouldFailFormatting: true,
        target_entity: friend,
      },
      {
        id: 'social:taunt',
        name: 'Taunt',
        command: 'taunt',
        required_components: { actor: ['core:talker'] },
        target_entity: rival,
        forbidden_components: { target: ['core:blocked'] },
      },
      {
        id: 'social:secret',
        name: 'Share Secret',
        command: 'whisper',
        required_components: { actor: ['core:talker'] },
        target_entity: friend,
        prerequisites: [{ shouldFail: true }],
      },
    ];
  };

  const actions = actionsFactory
    ? actionsFactory({ entityManager })
    : defaultActions();

  const actionIndex = new ActionIndex({ logger, entityManager });
  actionIndex.buildIndex(actions);

  const fixSuggestionEngine = new FixSuggestionEngine({
    logger,
    gameDataRepository: new TestGameDataRepository(),
    actionIndex,
  });

  const errorBuilder = new ActionErrorContextBuilder({
    entityManager,
    logger,
    fixSuggestionEngine,
  });

  const targetComponentValidator = new TargetComponentValidator({
    logger,
    entityManager,
  });
  const targetRequiredComponentsValidator =
    new TargetRequiredComponentsValidator({
      logger,
    });

  const formatter = commandFormatter || new ScenarioCommandFormatter();
  const prerequisiteSvc =
    prerequisiteService || new SimplePrerequisiteService();
  const resolutionStage =
    multiTargetStage || new SimpleMultiTargetStage(entityManager);

  const safeEventDispatcher = new SimpleSafeEventDispatcher();

  const orchestrator = new ActionPipelineOrchestrator({
    actionIndex,
    prerequisiteService: prerequisiteSvc,
    targetService: new SimpleTargetResolutionService(),
    formatter,
    entityManager,
    safeEventDispatcher,
    getEntityDisplayNameFn: (entityId) => `Display:${entityId}`,
    errorBuilder,
    logger,
    unifiedScopeResolver: new SimpleUnifiedScopeResolver(),
    targetContextBuilder: new SimpleTargetContextBuilder(entityManager),
    multiTargetResolutionStage: resolutionStage,
    targetComponentValidator,
    targetRequiredComponentsValidator,
  });

  return {
    orchestrator,
    logger,
    entityManager,
    actionIndex,
    safeEventDispatcher,
    actions,
    actor: entityManager.getEntityInstance('hero-1'),
  };
}

describe('ActionPipelineOrchestrator with structured tracing', () => {
  it('returns formatted actions and captures formatting errors under structured tracing', async () => {
    const harness = createHarness();
    const trace = new StructuredTrace();

    const result = await harness.orchestrator.discoverActions(
      harness.actor,
      { mood: 'optimistic' },
      { trace }
    );

    expect(result.trace).toBe(trace);
    expect(trace.spans).toHaveLength(1);
    expect(trace.spans[0]).toEqual(
      expect.objectContaining({
        name: 'Pipeline',
        metadata: { stageCount: 5 },
      })
    );

    const discoveredIds = result.actions.map((action) => action.id);
    expect(discoveredIds).toContain('social:wave');
    expect(discoveredIds).not.toContain('social:hug');
    expect(discoveredIds).not.toContain('social:taunt');
    expect(discoveredIds).not.toContain('social:secret');

    const errorActionIds = result.errors.map((error) => error.actionId);
    expect(errorActionIds).toContain('social:hug');

    expect(
      harness.logger.debugMessages.some((entry) =>
        entry.message.includes('Starting action discovery pipeline')
      )
    ).toBe(true);
    expect(
      harness.logger.debugMessages.some((entry) =>
        entry.message.includes('Action discovery pipeline completed')
      )
    ).toBe(true);

    expect(
      trace.events.some(
        (event) =>
          event.type === 'action-data' && event.actionId === 'social:hug'
      )
    ).toBe(true);
    expect(trace.events.some((event) => event.type === 'success')).toBe(true);
  });

  it('propagates pipeline failures from multi-target stage while preserving trace reference', async () => {
    const harness = createHarness({
      multiTargetStage: new ThrowingStage(),
    });
    const trace = new StructuredTrace();

    const result = await harness.orchestrator.discoverActions(
      harness.actor,
      { mood: 'tense' },
      { trace }
    );

    expect(result.trace).toBe(trace);
    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual(
      expect.objectContaining({
        stageName: 'MultiTargetResolution',
        error: 'Target resolution failed',
      })
    );

    expect(
      harness.logger.errorMessages.some((entry) =>
        entry.message.includes(
          'Pipeline stage MultiTargetResolution threw an error'
        )
      )
    ).toBe(true);

    expect(trace.events.some((event) => event.type === 'failure')).toBe(true);
  });
});
