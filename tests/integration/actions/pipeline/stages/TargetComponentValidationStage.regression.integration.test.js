/**
 * @file Regression harness and telemetry coverage for TargetComponentValidationStage.
 * @description Ensures the refactored validation stage stays aligned with upstream resolution,
 *              emits trace metadata through real reporters, and respects configuration caching.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TargetComponentValidationStage } from '../../../../../src/actions/pipeline/stages/TargetComponentValidationStage.js';
import ContextUpdateEmitter from '../../../../../src/actions/pipeline/services/implementations/ContextUpdateEmitter.js';
import TargetValidationReporter from '../../../../../src/actions/pipeline/stages/TargetValidationReporter.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';
import ActionTraceFilter from '../../../../../src/actions/tracing/actionTraceFilter.js';
import ActionAwareStructuredTrace from '../../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import TargetValidationConfigProvider from '../../../../../src/actions/pipeline/stages/TargetValidationConfigProvider.js';
import { createMultiTargetResolutionStage } from '../../../../common/actions/multiTargetStageTestUtilities.js';
import { EntityManagerTestBed } from '../../../../common/entities/entityManagerTestBed.js';
import EntityDefinition from '../../../../../src/entities/entityDefinition.js';
import TargetCandidatePruner from '../../../../../src/actions/pipeline/services/implementations/TargetCandidatePruner.js';
import { TargetComponentValidator } from '../../../../../src/actions/validation/TargetComponentValidator.js';
import TargetRequiredComponentsValidator from '../../../../../src/actions/validation/TargetRequiredComponentsValidator.js';
import { ActionErrorContextBuilder } from '../../../../../src/actions/errors/actionErrorContextBuilder.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const defaultSnapshot = {
  validationEnabled: true,
  skipValidation: false,
  strictness: 'strict',
  logDetails: false,
  performanceThreshold: 50,
  shouldSkipAction: () => false,
};

/**
 *
 */
async function buildResolutionFixture() {
  const logger = createLogger();
  const entityTestBed = new EntityManagerTestBed();
  const { entityManager } = entityTestBed;
  const unifiedScopeResolver = { resolve: jest.fn() };
  const targetResolver = {
    resolveTargets: jest.fn().mockResolvedValue({ success: true, value: [] }),
  };

  const multiStage = createMultiTargetResolutionStage({
    entityManager,
    logger,
    unifiedScopeResolver,
    targetResolver,
  });

  const locationDef = new EntityDefinition('regression:room', {
    description: 'Regression room',
    components: {
      'core:name': { text: 'Regression Room' },
      'core:location': { id: 'regression:room' },
    },
  });

  const actorDef = new EntityDefinition('regression:actor', {
    description: 'Regression actor',
    components: {
      'core:name': { text: 'Regression Actor' },
      'core:actor': { type: 'regression' },
      'core:position': { locationId: 'regression:room' },
    },
  });

  const enemyOneDef = new EntityDefinition('regression:enemy_one', {
    description: 'Primary enemy',
    components: {
      'core:name': { text: 'Enemy One' },
      'combat:targetable': { state: 'ready' },
    },
  });

  const enemyTwoDef = new EntityDefinition('regression:enemy_two', {
    description: 'Secondary enemy',
    components: {
      'core:name': { text: 'Enemy Two' },
    },
  });

  const allyDef = new EntityDefinition('regression:ally', {
    description: 'Support ally',
    components: {
      'core:name': { text: 'Support Ally' },
    },
  });

  entityTestBed.setupDefinitions(
    locationDef,
    actorDef,
    enemyOneDef,
    enemyTwoDef,
    allyDef
  );

  await entityManager.createEntityInstance('regression:room', {
    instanceId: 'regression:room',
  });
  const actor = await entityManager.createEntityInstance('regression:actor', {
    instanceId: 'regression:actor:1',
  });
  await entityManager.createEntityInstance('regression:enemy_one', {
    instanceId: 'regression:enemy:1',
  });
  await entityManager.createEntityInstance('regression:enemy_two', {
    instanceId: 'regression:enemy:2',
  });
  await entityManager.createEntityInstance('regression:ally', {
    instanceId: 'regression:ally:1',
  });

  unifiedScopeResolver.resolve.mockImplementation((scope) => {
    switch (scope) {
      case 'scope:enemy_one':
        return Promise.resolve(
          ActionResult.success(new Set(['regression:enemy:1']))
        );
      case 'scope:enemy_two':
        return Promise.resolve(
          ActionResult.success(new Set(['regression:enemy:2']))
        );
      case 'scope:ally':
        return Promise.resolve(
          ActionResult.success(new Set(['regression:ally:1']))
        );
      default:
        return Promise.resolve(ActionResult.success(new Set()));
    }
  });

  const candidateActions = [
    {
      id: 'regression:multi-pass',
      name: 'Regression Multi Target',
      template: 'engage {primary} with {support}',
      targets: {
        primary: { scope: 'scope:enemy_one', placeholder: 'primary' },
        support: {
          scope: 'scope:ally',
          placeholder: 'support',
          optional: true,
        },
      },
      required_components: {
        primary: ['combat:targetable'],
      },
    },
    {
      id: 'regression:pruned',
      name: 'Regression Pruned',
      template: 'engage {primary}',
      targets: {
        primary: { scope: 'scope:enemy_two', placeholder: 'primary' },
      },
      required_components: {
        primary: ['combat:targetable'],
      },
    },
  ];

  const resolutionContext = {
    candidateActions,
    actor,
    actionContext: { actor },
    data: {},
  };

  const resolutionResult = await multiStage.executeInternal(resolutionContext);
  expect(resolutionResult.success).toBe(true);

  return {
    entityTestBed,
    logger,
    actor,
    candidateActions,
    resolutionResult,
  };
}

const buildPruner = () => ({
  prune: jest.fn(({ actionDef, resolvedTargets }) => {
    if (actionDef.id === 'regression:pruned') {
      return {
        keptTargets: null,
        removedTargets: [
          {
            role: 'primary',
            targetId: 'regression:enemy:2',
            placeholder: 'primary',
            reason: 'Missing required component',
            reasonCode: 'missing_component',
          },
        ],
        removalReasons: ['Missing required component'],
      };
    }

    return {
      keptTargets: resolvedTargets,
      removedTargets: [],
      removalReasons: [],
    };
  }),
});

describe('TargetComponentValidationStage regression harness', () => {
  let entityTestBed;

  afterEach(async () => {
    if (entityTestBed) {
      await entityTestBed.cleanup();
      entityTestBed = null;
    }
  });

  it('keeps candidateActions context aligned with adapter rebuilds across pruning', async () => {
    const {
      entityTestBed: bed,
      logger,
      actor,
      candidateActions,
      resolutionResult,
    } = await buildResolutionFixture();
    entityTestBed = bed;

    const componentValidator = {
      validateTargetComponents: jest.fn((actionDef) =>
        actionDef.id === 'regression:pruned'
          ? { valid: false, reason: 'forbidden component detected' }
          : { valid: true }
      ),
    };
    const requiredValidator = {
      validateTargetRequirements: jest.fn(() => ({ valid: true })),
    };

    const actionErrorContextBuilder = {
      buildErrorContext: jest.fn((payload) => ({ ...payload })),
    };

    const pruner = buildPruner();
    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(),
      reportPerformanceData: jest.fn().mockResolvedValue(),
    };

    const realEmitter = new ContextUpdateEmitter();
    const emitterCalls = [];
    const contextUpdateEmitter = {
      applyTargetValidationResults: jest.fn((payload) => {
        emitterCalls.push(payload);
        return realEmitter.applyTargetValidationResults(payload);
      }),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: componentValidator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder,
      targetCandidatePruner: pruner,
      configProvider: { getSnapshot: jest.fn(() => defaultSnapshot) },
      validationReporter: reporter,
      contextUpdateEmitter,
    });

    const candidateContext = {
      actor,
      candidateActions,
      resolvedTargets: resolutionResult.data.resolvedTargets || {},
      targetContexts: resolutionResult.data.targetContexts || [],
    };

    const result = await stage.executeInternal(candidateContext);

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1);
    expect(result.data.candidateActions[0].id).toBe('regression:multi-pass');
    expect(candidateContext.candidateActions).toHaveLength(1);
    expect(candidateContext.candidateActions[0].id).toBe(
      'regression:multi-pass'
    );

    expect(
      contextUpdateEmitter.applyTargetValidationResults
    ).toHaveBeenCalledTimes(1);
    const [{ metadata, validatedItems }] = emitterCalls;
    expect(validatedItems).toHaveLength(1);
    expect(metadata.stageUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'regression:pruned',
          removalReasons: ['Missing required component'],
          removedTargets: expect.arrayContaining([
            expect.objectContaining({
              targetId: 'regression:enemy:2',
              placeholder: 'primary',
            }),
          ]),
        }),
      ])
    );

    expect(candidateContext.resolvedTargets).toEqual({
      primary: expect.any(Array),
      support: expect.any(Array),
    });
    expect(candidateContext.resolvedTargets.primary[0].id).toBe(
      'regression:enemy:1'
    );
    expect(result.data.candidateActions).toEqual(
      candidateContext.candidateActions
    );
  });

  it('rebuilds actionsWithTargets payloads while preserving target metadata', async () => {
    const {
      entityTestBed: bed,
      logger,
      actor,
      resolutionResult,
    } = await buildResolutionFixture();
    entityTestBed = bed;

    const componentValidator = {
      validateTargetComponents: jest.fn((actionDef) =>
        actionDef.id === 'regression:pruned'
          ? { valid: false, reason: 'forbidden component detected' }
          : { valid: true }
      ),
    };
    const requiredValidator = {
      validateTargetRequirements: jest.fn(() => ({ valid: true })),
    };

    const actionErrorContextBuilder = {
      buildErrorContext: jest.fn((payload) => ({ ...payload })),
    };

    const pruner = buildPruner();
    const reporter = {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(),
      reportPerformanceData: jest.fn().mockResolvedValue(),
    };

    const realEmitter = new ContextUpdateEmitter();
    const emitterCalls = [];
    const contextUpdateEmitter = {
      applyTargetValidationResults: jest.fn((payload) => {
        emitterCalls.push(payload);
        return realEmitter.applyTargetValidationResults(payload);
      }),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: componentValidator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder,
      targetCandidatePruner: pruner,
      configProvider: { getSnapshot: jest.fn(() => defaultSnapshot) },
      validationReporter: reporter,
      contextUpdateEmitter,
    });

    const context = {
      actor,
      actionsWithTargets: resolutionResult.data.actionsWithTargets.map(
        (entry) => ({
          ...entry,
          targetContexts: entry.targetContexts
            ? entry.targetContexts.map((ctx) => ({ ...ctx }))
            : [],
        })
      ),
    };

    const result = await stage.executeInternal(context);

    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(1);
    expect(result.data.actionsWithTargets[0].actionDef.id).toBe(
      'regression:multi-pass'
    );
    expect(context.actionsWithTargets).toHaveLength(1);
    expect(context.actionsWithTargets[0].targetContexts).toEqual(
      result.data.actionsWithTargets[0].targetContexts
    );

    const [{ metadata }] = emitterCalls;
    expect(metadata.stageUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionId: 'regression:pruned' }),
      ])
    );
  });
});

describe('TargetComponentValidationStage telemetry contract', () => {
  let entityTestBed;

  afterEach(async () => {
    if (entityTestBed) {
      await entityTestBed.cleanup();
      entityTestBed = null;
    }
  });

  it('streams validation analysis and performance data through ActionAwareStructuredTrace', async () => {
    const {
      entityTestBed: bed,
      logger,
      actor,
      resolutionResult,
    } = await buildResolutionFixture();
    entityTestBed = bed;

    const componentValidator = {
      validateTargetComponents: jest.fn(() => ({ valid: true })),
    };
    const requiredValidator = {
      validateTargetRequirements: jest.fn(() => ({ valid: true })),
    };

    const actionErrorContextBuilder = {
      buildErrorContext: jest.fn((payload) => ({ ...payload })),
    };

    const reporter = new TargetValidationReporter({ logger });
    const pruner = {
      prune: jest.fn(({ resolvedTargets }) => ({
        keptTargets: resolvedTargets,
        removedTargets: [],
        removalReasons: [],
      })),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: componentValidator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder,
      targetCandidatePruner: pruner,
      configProvider: { getSnapshot: jest.fn(() => defaultSnapshot) },
      validationReporter: reporter,
      contextUpdateEmitter: new ContextUpdateEmitter(),
    });

    const trace = new ActionAwareStructuredTrace({
      actionTraceFilter: new ActionTraceFilter({
        tracedActions: ['*'],
        verbosityLevel: 'verbose',
        inclusionConfig: {
          componentData: true,
          prerequisites: true,
          targets: true,
        },
      }),
      actorId: actor.id,
      logger,
    });

    const context = {
      actor,
      actionsWithTargets: resolutionResult.data.actionsWithTargets,
      trace,
    };

    const result = await stage.executeInternal(context);
    expect(result.success).toBe(true);

    const traced = trace.getActionTrace('regression:multi-pass');
    expect(traced).not.toBeNull();
    expect(traced?.stages).toHaveProperty('target_component_validation');
    expect(traced?.stages).toHaveProperty('stage_performance');
    expect(
      traced?.stages['target_component_validation'].data.validationPassed
    ).toBe(true);

    const hasCompletionLog = trace.logs.some((entry) =>
      entry.message.includes('Target component validation completed')
    );
    expect(hasCompletionLog).toBe(true);
  });

  it('reports skip notifications when validation is disabled', async () => {
    const {
      entityTestBed: bed,
      logger,
      actor,
      resolutionResult,
    } = await buildResolutionFixture();
    entityTestBed = bed;

    const componentValidator = {
      validateTargetComponents: jest.fn(() => ({ valid: true })),
    };
    const requiredValidator = {
      validateTargetRequirements: jest.fn(() => ({ valid: true })),
    };

    const actionErrorContextBuilder = {
      buildErrorContext: jest.fn((payload) => ({ ...payload })),
    };

    const reporter = new TargetValidationReporter({ logger });
    const pruner = {
      prune: jest.fn(({ resolvedTargets }) => ({
        keptTargets: resolvedTargets,
        removedTargets: [],
        removalReasons: [],
      })),
    };

    const disabledSnapshot = {
      ...defaultSnapshot,
      validationEnabled: false,
      skipValidation: true,
      strictness: 'off',
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: componentValidator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder,
      targetCandidatePruner: pruner,
      configProvider: { getSnapshot: jest.fn(() => disabledSnapshot) },
      validationReporter: reporter,
      contextUpdateEmitter: new ContextUpdateEmitter(),
    });

    const trace = new ActionAwareStructuredTrace({
      actionTraceFilter: new ActionTraceFilter({
        tracedActions: ['*'],
        verbosityLevel: 'verbose',
        inclusionConfig: {
          componentData: true,
          prerequisites: true,
          targets: true,
        },
      }),
      actorId: actor.id,
      logger,
    });

    const context = {
      actor,
      actionsWithTargets: resolutionResult.data.actionsWithTargets,
      trace,
    };

    const result = await stage.executeInternal(context);
    expect(result.success).toBe(true);
    expect(trace.logs.some((entry) => entry.message.includes('skipped'))).toBe(
      true
    );
  });
});

describe('TargetComponentValidationStage configuration snapshot reuse', () => {
  it('reuses cached snapshots until invalidated while honoring lenient mode after reset', async () => {
    const logger = createLogger();

    const configLoader = jest
      .fn()
      .mockImplementationOnce(() => ({
        targetValidation: { enabled: true, strictness: 'strict' },
        performance: {},
      }))
      .mockImplementation(() => ({
        targetValidation: {
          enabled: true,
          strictness: 'lenient',
          logDetails: true,
        },
        performance: {},
      }));

    const configProvider = new TargetValidationConfigProvider({
      configLoader,
    });

    const componentValidator = {
      validateTargetComponents: jest.fn(() => ({
        valid: false,
        reason: 'non-critical imbalance',
      })),
    };
    const requiredValidator = {
      validateTargetRequirements: jest.fn(() => ({ valid: true })),
    };

    const pruner = {
      prune: jest.fn(({ resolvedTargets }) => ({
        keptTargets: resolvedTargets,
        removedTargets: [],
        removalReasons: [],
      })),
    };

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: componentValidator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: {
        buildErrorContext: jest.fn((payload) => ({ ...payload })),
      },
      targetCandidatePruner: pruner,
      configProvider,
      validationReporter: {
        reportStageSkipped: jest.fn(),
        reportStageStart: jest.fn(),
        reportStageCompletion: jest.fn(),
        reportValidationAnalysis: jest.fn().mockResolvedValue(),
        reportPerformanceData: jest.fn().mockResolvedValue(),
      },
      contextUpdateEmitter: new ContextUpdateEmitter(),
    });

    const createContext = () => ({
      actor: { id: 'config:actor' },
      candidateActions: [
        {
          id: 'config:lenient',
          resolvedTargets: {
            primary: [{ id: 'regression:enemy:1' }],
          },
        },
      ],
    });

    let result = await stage.executeInternal(createContext());
    expect(result.data.candidateActions).toHaveLength(0);
    expect(configLoader).toHaveBeenCalledTimes(1);

    result = await stage.executeInternal(createContext());
    expect(result.data.candidateActions).toHaveLength(0);
    expect(configLoader).toHaveBeenCalledTimes(1);

    configProvider.invalidateCache();

    result = await stage.executeInternal(createContext());
    expect(result.data.candidateActions).toHaveLength(1);
    expect(configLoader).toHaveBeenCalledTimes(2);
  });
});

describe('TargetComponentValidationStage items action regression', () => {
  let entityTestBed;
  let entityManager;
  let logger;
  let multiStage;
  let validationStage;
  let actor;
  let unifiedScopeResolver;
  let fixSuggestionEngine;

  beforeEach(async () => {
    logger = createLogger();
    entityTestBed = new EntityManagerTestBed();
    ({ entityManager } = entityTestBed);

    const roomDefinition = new EntityDefinition('test:room', {
      description: 'Test room',
      components: {
        'core:name': { text: 'Test Room' },
        'core:location': { id: 'test:room' },
      },
    });

    const actorDefinition = new EntityDefinition('test:actor', {
      description: 'Pipeline actor',
      components: {
        'core:name': { text: 'Pipeline Actor' },
        'core:actor': { type: 'test' },
        'core:position': { locationId: 'test:room' },
        'items:inventory': {
          items: ['test:letter_instance', 'test:photo_instance'],
          capacity: { maxWeight: 10, maxItems: 5 },
        },
      },
    });

    const readableLetterDefinition = new EntityDefinition('test:letter', {
      description: 'Readable letter',
      components: {
        'core:name': { text: 'Faded Letter' },
        'items:item': {},
        'core:description': { text: 'A faded farewell letter.' },
        'items:readable': { content: 'The final goodbye.' },
      },
    });

    const photoDefinition = new EntityDefinition('test:photo', {
      description: 'Photo missing item component',
      components: {
        'core:name': { text: 'Old Photo' },
        'core:description': { text: 'A worn photograph.' },
      },
    });

    entityTestBed.setupDefinitions(
      roomDefinition,
      actorDefinition,
      readableLetterDefinition,
      photoDefinition
    );

    await entityManager.createEntityInstance('test:room', {
      instanceId: 'test:room',
    });
    actor = await entityManager.createEntityInstance('test:actor', {
      instanceId: 'test:actor:1',
    });
    await entityManager.createEntityInstance('test:letter', {
      instanceId: 'test:letter_instance',
    });
    await entityManager.createEntityInstance('test:photo', {
      instanceId: 'test:photo_instance',
    });

    unifiedScopeResolver = {
      resolve: jest.fn((scopeName) => {
        if (scopeName === 'items:examinable_items') {
          return ActionResult.success(
            new Set(['test:letter_instance', 'test:photo_instance'])
          );
        }
        return ActionResult.success(new Set());
      }),
    };

    const targetResolver = { resolveTargets: jest.fn() };

    multiStage = createMultiTargetResolutionStage({
      entityManager,
      logger,
      unifiedScopeResolver,
      targetResolver,
    });

    fixSuggestionEngine = { suggestFixes: jest.fn().mockReturnValue([]) };

    validationStage = new TargetComponentValidationStage({
      targetComponentValidator: new TargetComponentValidator({
        logger,
        entityManager,
      }),
      targetRequiredComponentsValidator: new TargetRequiredComponentsValidator({
        logger,
      }),
      logger,
      actionErrorContextBuilder: new ActionErrorContextBuilder({
        entityManager,
        logger,
        fixSuggestionEngine,
      }),
      targetCandidatePruner: new TargetCandidatePruner({ logger }),
      configProvider: new TargetValidationConfigProvider(),
      validationReporter: new TargetValidationReporter({ logger }),
      contextUpdateEmitter: new ContextUpdateEmitter(),
    });
  });

  afterEach(async () => {
    await entityTestBed.cleanup();
  });

  /**
   *
   * @param actionDef
   */
  async function runValidationForAction(actionDef) {
    const actionContext = {
      currentLocation: 'test:room',
      location: { id: 'test:room' },
    };

    const resolutionResult = await multiStage.executeInternal({
      actor,
      candidateActions: [actionDef],
      actionContext,
      trace: null,
    });

    expect(resolutionResult.success).toBe(true);
    expect(resolutionResult.data.actionsWithTargets).toBeDefined();

    const validationResult = await validationStage.executeInternal({
      actor,
      actionsWithTargets: resolutionResult.data.actionsWithTargets,
    });

    expect(validationResult.success).toBe(true);
    return validationResult.data.actionsWithTargets;
  }

  it('retains items:examine_item when a valid examinable target is present', async () => {
    const examineAction = {
      id: 'items:examine_item',
      name: 'Examine Item',
      template: 'examine {item}',
      targets: {
        primary: {
          scope: 'items:examinable_items',
          placeholder: 'item',
          description: 'Item to examine',
        },
      },
      required_components: {
        primary: ['items:item', 'core:description'],
      },
    };

    const actions = await runValidationForAction(examineAction);

    expect(actions).toHaveLength(1);
    const [actionEntry] = actions;
    expect(actionEntry.actionDef.id).toBe('items:examine_item');
    const candidates = actionEntry.resolvedTargets.primary;
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe('test:letter_instance');
    expect(candidates[0].entity?.components?.['items:item']).toBeDefined();
  });

  it('retains items:read_item when a readable target meets all requirements', async () => {
    const readAction = {
      id: 'items:read_item',
      name: 'Read Item',
      template: 'read {item}',
      targets: {
        primary: {
          scope: 'items:examinable_items',
          placeholder: 'item',
          description: 'Readable item to read',
        },
      },
      required_components: {
        primary: ['items:item', 'items:readable'],
      },
    };

    const actions = await runValidationForAction(readAction);

    expect(actions).toHaveLength(1);
    const [actionEntry] = actions;
    expect(actionEntry.actionDef.id).toBe('items:read_item');
    const candidates = actionEntry.resolvedTargets.primary;
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe('test:letter_instance');
    expect(candidates[0].entity?.components?.['items:readable']).toBeDefined();
  });
});
