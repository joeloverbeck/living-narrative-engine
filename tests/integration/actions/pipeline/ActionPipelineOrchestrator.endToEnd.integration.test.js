/**
 * @file High-fidelity integration tests for ActionPipelineOrchestrator.
 * @description Exercises the orchestrator with real pipeline stages and collaborators to
 *              validate end-to-end discovery flows and error propagation without relying on mocks.
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

class RecordingTrace {
  constructor() {
    this.events = [];
  }

  info(message, source, payload) {
    this.events.push({ type: 'info', message, source, payload });
  }

  step(message, source, payload) {
    this.events.push({ type: 'step', message, source, payload });
  }

  success(message, source, payload) {
    this.events.push({ type: 'success', message, source, payload });
  }

  failure(message, source, payload) {
    this.events.push({ type: 'failure', message, source, payload });
  }

  data(message, source, payload) {
    this.events.push({ type: 'data', message, source, payload });
  }
}

class SimplePrerequisiteService {
  evaluate(prerequisites, actionDef) {
    if (!prerequisites || prerequisites.length === 0) {
      return true;
    }

    if (Array.isArray(prerequisites)) {
      return !prerequisites.some((rule) => rule && rule.shouldFail);
    }

    return true;
  }
}

class SimpleCommandFormatter {
  constructor() {
    this.formatted = [];
  }

  format(actionDef, targetContext) {
    if (actionDef.shouldFailFormatting) {
      return {
        ok: false,
        error: new Error(`Unable to format ${actionDef.id}`),
      };
    }

    const value = `${actionDef.command}:${targetContext.entityId}`;
    this.formatted.push({
      actionId: actionDef.id,
      targetId: targetContext.entityId,
      value,
    });
    return { ok: true, value };
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
    if (!actionDef?.target_entity?.id) {
      return [];
    }

    const entity = this.entityManager.getEntityInstance(
      actionDef.target_entity.id
    );
    return entity
      ? [
          {
            entityId: entity.id,
            entity,
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
      const targetId = actionDef.target_entity?.id || null;
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

      // Build resolvedTargets to match real MultiTargetResolutionStage output
      // Use legacy format (resolvedTargets.primary with single-element array)
      // since test actions use forbidden_components: { target: [...] }
      const resolvedTargets = targetEntity
        ? {
            primary: [
              {
                id: targetEntity.id,
                displayName: `Display:${targetEntity.id}`,
                entity: targetEntity,
              },
            ],
          }
        : {};

      // For legacy single-target actions, also set target property for validation
      // Real MultiTargetResolutionStage does this in #resolveLegacyTarget (line 446-455)
      const targetForValidation = targetEntity
        ? {
            id: targetEntity.id,
            displayName: `Display:${targetEntity.id}`,
            entity: targetEntity,
          }
        : undefined;

      // Return action with attached metadata (matching real stage behavior)
      return {
        actionDef: {
          ...actionDef,
          resolvedTargets: targetForValidation
            ? { ...resolvedTargets, target: targetForValidation } // Add legacy 'target' property
            : resolvedTargets,
        },
        targetContexts,
      };
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
    throw new Error('Target stage exploded');
  }
}

class TestGameDataRepository {
  getComponentDefinition(componentId) {
    return { id: componentId, name: `Component ${componentId}` };
  }

  getConditionDefinition(conditionId) {
    return {
      id: conditionId,
      description: `Condition ${conditionId}`,
      logic: { var: conditionId },
    };
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
function createOrchestratorHarness({
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

  const trace = new RecordingTrace();
  const actionIndex = new ActionIndex({ logger, entityManager });

  const defaultActions = () => {
    const friendlyTarget = entityManager.getEntityInstance('friend-1');
    const rivalTarget = entityManager.getEntityInstance('rival-1');

    return [
      {
        id: 'social:wave',
        name: 'Wave',
        command: 'wave',
        description: 'Offer a greeting',
        required_components: { actor: ['core:talker'] },
        target_entity: friendlyTarget,
      },
      {
        id: 'social:hug',
        name: 'Hug',
        command: 'hug',
        description: 'Give a warm hug',
        required_components: { actor: ['core:talker'] },
        target_entity: friendlyTarget,
        forbidden_components: { target: ['core:blocked'] },
      },
      {
        id: 'social:taunt',
        name: 'Taunt',
        command: 'taunt',
        description: 'Taunt the rival',
        required_components: { actor: ['core:talker'] },
        target_entity: rivalTarget,
        forbidden_components: { target: ['core:blocked'] },
      },
      {
        id: 'social:secret',
        name: 'Share Secret',
        command: 'whisper',
        description: 'Share a secret',
        required_components: { actor: ['core:talker'] },
        target_entity: friendlyTarget,
        prerequisites: [{ shouldFail: true }],
      },
    ];
  };

  const actions = actionsFactory
    ? actionsFactory({ entityManager })
    : defaultActions();

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

  // Use real validators instead of mocks to properly test forbidden/required component validation
  const targetComponentValidator = new TargetComponentValidator({
    logger,
    entityManager,
  });
  const targetRequiredComponentsValidator =
    new TargetRequiredComponentsValidator({
      logger,
    });

  const safeEventDispatcher = new SimpleSafeEventDispatcher();
  const formatter = commandFormatter || new SimpleCommandFormatter();
  const prerequisiteSvc =
    prerequisiteService || new SimplePrerequisiteService();
  const resolutionStage =
    multiTargetStage || new SimpleMultiTargetStage(entityManager);

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
    safeEventDispatcher,
    actionIndex,
    actions,
    actor: entityManager.getEntityInstance('hero-1'),
    trace,
  };
}

describe('ActionPipelineOrchestrator end-to-end integration', () => {
  it('discovers actions using real pipeline stages and filters invalid candidates', async () => {
    const harness = createOrchestratorHarness();

    const result = await harness.orchestrator.discoverActions(
      harness.actor,
      { mood: 'friendly' },
      { trace: harness.trace }
    );

    const discoveredIds = result.actions.map((action) => action.id);

    expect(discoveredIds).toEqual(['social:wave', 'social:hug']);
    expect(result.actions[0].command).toBe('wave:friend-1');
    expect(result.actions[1].command).toBe('hug:friend-1');
    expect(result.errors).toHaveLength(0);

    expect(harness.safeEventDispatcher.dispatchedEvents).toHaveLength(0);
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
  });

  it('propagates stage failures through pipeline results', async () => {
    const harness = createOrchestratorHarness({
      multiTargetStage: new ThrowingStage(),
    });

    const result = await harness.orchestrator.discoverActions(
      harness.actor,
      { mood: 'tense' },
      { trace: harness.trace }
    );

    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].stageName).toBe('MultiTargetResolution');
    expect(result.errors[0].error).toBe('Target stage exploded');

    expect(
      harness.logger.errorMessages.some((entry) =>
        entry.message.includes(
          'Pipeline stage MultiTargetResolution threw an error'
        )
      )
    ).toBe(true);
  });
});

describe('ActionPipelineOrchestrator target requirements integration', () => {
  it('filters actions missing required target components while keeping valid candidates', async () => {
    const harness = createOrchestratorHarness({
      actionsFactory: ({ entityManager }) => {
        const friend = entityManager.getEntityInstance('friend-1');
        const rival = entityManager.getEntityInstance('rival-1');

        return [
          {
            id: 'friendly:embrace',
            name: 'Friendly Embrace',
            command: 'embrace',
            description: 'Give a warm embrace',
            required_components: {
              actor: ['core:talker'],
              target: ['core:friend'],
            },
            target_entity: friend,
          },
          {
            id: 'friendly:blocked',
            name: 'Blocked Greeting',
            command: 'blocked-greet',
            description: 'Attempt to greet without required traits',
            required_components: {
              actor: ['core:talker'],
              target: ['core:blocked'],
            },
            target_entity: friend,
          },
          {
            id: 'friendly:multi-target',
            name: 'Coordinated Cheer',
            command: 'cheer',
            description: 'Cheer with a friendly companion',
            required_components: {
              actor: ['core:talker'],
              primary: ['core:friend'],
            },
            target_entities: {
              secondary: rival,
            },
          },
        ];
      },
    });

    const result = await harness.orchestrator.discoverActions(
      harness.actor,
      { mood: 'curious' },
      { trace: harness.trace }
    );

    const discoveredIds = result.actions.map((action) => action.id);

    expect(discoveredIds).toContain('friendly:embrace');
    expect(discoveredIds).not.toContain('friendly:blocked');
    expect(discoveredIds).not.toContain('friendly:multi-target');
    expect(result.errors).toHaveLength(0);

    const debugMessages = harness.logger.debugMessages.map(
      ({ message }) => message
    );
    expect(
      debugMessages.some((message) =>
        message.includes(
          "Action 'friendly:blocked' filtered out: Target (target) must have component: core:blocked"
        )
      )
    ).toBe(true);
    expect(
      debugMessages.some((message) =>
        message.includes(
          'No primary target entity found for required components validation'
        )
      )
    ).toBe(true);
  });

  it('discovers actions without a trace context using the default pipeline flow', async () => {
    const harness = createOrchestratorHarness();

    const result = await harness.orchestrator.discoverActions(harness.actor, {
      mood: 'calm',
    });

    expect(result.trace).toBeUndefined();
    expect(result.actions.length).toBeGreaterThan(0);
    expect(
      harness.logger.debugMessages.some(({ message }) =>
        message.includes('Action discovery pipeline completed')
      )
    ).toBe(true);
  });
});
