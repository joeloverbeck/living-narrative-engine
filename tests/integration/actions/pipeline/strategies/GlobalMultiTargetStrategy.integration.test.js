/**
 * @file Integration tests for GlobalMultiTargetStrategy
 * @see src/actions/pipeline/stages/actionFormatting/strategies/GlobalMultiTargetStrategy.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';
import ActionCommandFormatter from '../../../../../src/actions/actionFormatter.js';
import { MultiTargetActionFormatter } from '../../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import { GlobalMultiTargetStrategy } from '../../../../../src/actions/pipeline/stages/actionFormatting/strategies/GlobalMultiTargetStrategy.js';
import { LegacyFallbackFormatter } from '../../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyFallbackFormatter.js';
import { TargetNormalizationService } from '../../../../../src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js';
import { FormattingAccumulator } from '../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';
import { ActionFormattingErrorFactory } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingErrorFactory.js';
import { ActionErrorContextBuilder } from '../../../../../src/actions/errors/actionErrorContextBuilder.js';
import { getEntityDisplayName } from '../../../../../src/utils/entityUtils.js';
import EntityDefinition from '../../../../../src/entities/entityDefinition.js';
import { EntityManagerTestBed } from '../../../../common/entities/entityManagerTestBed.js';
import { ActionTargetContext } from '../../../../../src/models/actionTargetContext.js';
import { createActionFormattingTask } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingTaskFactory.js';

/**
 *
 */
function createInstrumentation() {
  return {
    actionStarted: jest.fn(),
    actionCompleted: jest.fn(),
    actionFailed: jest.fn(),
  };
}

describe('GlobalMultiTargetStrategy - Integration', () => {
  let testBed;
  let logger;
  let entityManager;
  let baseFormatter;
  let multiFormatter;
  let targetNormalizationService;
  let fallbackFormatter;
  let strategy;
  let errorFactory;
  let createError;

  beforeEach(() => {
    testBed = new EntityManagerTestBed();
    entityManager = testBed.entityManager;

    logger = new ConsoleLogger('DEBUG');
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    baseFormatter = new ActionCommandFormatter();
    multiFormatter = new MultiTargetActionFormatter(baseFormatter, logger);
    multiFormatter.formatMultiTarget =
      multiFormatter.formatMultiTarget.bind(multiFormatter);
    multiFormatter.format = multiFormatter.format.bind(multiFormatter);

    targetNormalizationService = new TargetNormalizationService({ logger });
    fallbackFormatter = new LegacyFallbackFormatter({
      commandFormatter: multiFormatter,
      entityManager,
      getEntityDisplayNameFn: getEntityDisplayName,
    });

    const fixSuggestionEngine = { suggestFixes: () => [] };
    const errorContextBuilder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });
    errorFactory = new ActionFormattingErrorFactory({
      errorContextBuilder,
    });
    createError = (context) => errorFactory.create(context);

    strategy = new GlobalMultiTargetStrategy({
      commandFormatter: multiFormatter,
      entityManager,
      safeEventDispatcher: testBed.mocks.eventDispatcher,
      getEntityDisplayNameFn: getEntityDisplayName,
      logger,
      fallbackFormatter,
      targetNormalizationService,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('canFormat', () => {
    it('returns true only when batch metadata is present', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor for canFormat checks',
        components: {
          'core:name': { text: 'Actor' },
          'core:actor': { name: 'Actor' },
        },
      });
      testBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'actor-1',
      });

      const actionDef = {
        id: 'test:sample',
        name: 'Sample',
        template: 'sample {target}',
      };

      const formatterOptions = { debug: false };

      const perActionTask = createActionFormattingTask({
        actor,
        actionWithTargets: {
          actionDef,
          targetContexts: [ActionTargetContext.forEntity('actor-1')],
          resolvedTargets: { primary: [{ id: 'actor-1' }] },
          targetDefinitions: { primary: { placeholder: 'target' } },
          isMultiTarget: true,
        },
        formatterOptions,
      });

      const batchTask = createActionFormattingTask({
        actor,
        actionWithTargets: {
          actionDef,
          targetContexts: [ActionTargetContext.forEntity('actor-1')],
        },
        formatterOptions,
        batchResolvedTargets: { primary: [{ id: 'actor-1' }] },
        batchTargetDefinitions: { primary: { placeholder: 'target' } },
      });

      const legacyTask = createActionFormattingTask({
        actor,
        actionWithTargets: {
          actionDef,
          targetContexts: [ActionTargetContext.forEntity('actor-1')],
        },
        formatterOptions,
      });

      expect(strategy.canFormat(perActionTask)).toBe(false);
      expect(strategy.canFormat(batchTask)).toBe(true);
      expect(strategy.canFormat(legacyTask)).toBe(false);
      expect(strategy.canFormat(null)).toBe(false);
    });
  });

  describe('format', () => {
    it('formats multi-target actions and records instrumentation', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor entity',
        components: {
          'core:name': { text: 'Scout' },
          'core:actor': { name: 'Scout' },
        },
      });
      const daggerDef = new EntityDefinition('test:dagger', {
        description: 'Dagger weapon',
        components: {
          'core:name': { text: 'Silver Dagger' },
        },
      });
      const axeDef = new EntityDefinition('test:axe', {
        description: 'Axe weapon',
        components: {
          'core:name': { text: 'War Axe' },
        },
      });
      const goblinDef = new EntityDefinition('test:goblin', {
        description: 'Goblin enemy',
        components: {
          'core:name': { text: 'Goblin' },
          'core:actor': { name: 'Goblin' },
        },
      });
      const orcDef = new EntityDefinition('test:orc', {
        description: 'Orc enemy',
        components: {
          'core:name': { text: 'Orc' },
          'core:actor': { name: 'Orc' },
        },
      });

      testBed.setupDefinitions(actorDef, daggerDef, axeDef, goblinDef, orcDef);

      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'actor-1',
      });
      await entityManager.createEntityInstance('test:dagger', {
        instanceId: 'weapon-1',
      });
      await entityManager.createEntityInstance('test:axe', {
        instanceId: 'weapon-2',
      });
      await entityManager.createEntityInstance('test:goblin', {
        instanceId: 'enemy-1',
      });
      await entityManager.createEntityInstance('test:orc', {
        instanceId: 'enemy-2',
      });

      const actionDef = {
        id: 'combat:throw',
        name: 'Throw',
        description: 'Throw a weapon at an enemy',
        template: 'throw {weapon} at {target}',
      };

      const resolvedTargets = {
        primary: [
          { id: 'weapon-1', displayName: 'Silver Dagger' },
          { id: 'weapon-2', displayName: 'War Axe' },
        ],
        secondary: [
          { id: 'enemy-1', displayName: 'Goblin' },
          { id: 'enemy-2', displayName: 'Orc' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'weapon' },
        secondary: { placeholder: 'target' },
      };

      const formatterOptions = { debug: false, allowDuplicates: false };
      const task = createActionFormattingTask({
        actor,
        actionWithTargets: {
          actionDef,
          targetContexts: [
            ActionTargetContext.forEntity('weapon-1'),
            ActionTargetContext.forEntity('enemy-1'),
          ],
        },
        formatterOptions,
        batchResolvedTargets: resolvedTargets,
        batchTargetDefinitions: targetDefinitions,
      });

      const accumulator = new FormattingAccumulator();
      const instrumentation = createInstrumentation();

      await strategy.format({
        task,
        accumulator,
        instrumentation,
        createError,
        trace: null,
      });

      expect(instrumentation.actionStarted).toHaveBeenCalledTimes(1);
      expect(instrumentation.actionCompleted).toHaveBeenCalledTimes(1);
      expect(instrumentation.actionFailed).not.toHaveBeenCalled();

      const completedPayload =
        instrumentation.actionCompleted.mock.calls[0][0].payload;
      expect(completedPayload.fallbackUsed).toBe(false);
      expect(completedPayload.commandCount).toBe(4);
      expect(completedPayload.successCount).toBe(4);

      const formattedActions = accumulator.getFormattedActions();
      expect(formattedActions).toHaveLength(4);
      const commands = formattedActions.map((entry) => entry.command);
      expect(commands).toEqual(
        expect.arrayContaining([
          'throw Silver Dagger at Goblin',
          'throw Silver Dagger at Orc',
          'throw War Axe at Goblin',
          'throw War Axe at Orc',
        ])
      );

      formattedActions.forEach((entry) => {
        expect(entry.params.targetIds.primary).toHaveLength(1);
        expect(entry.params.targetIds.secondary).toHaveLength(1);
      });

      const summary = accumulator.getActionSummary('combat:throw');
      expect(summary?.path).toBe('multi-target');
      expect(summary?.successes).toBe(1);
      expect(summary?.failures).toBe(0);
    });

    it('falls back to legacy formatting when multi-target formatter fails', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor entity',
        components: {
          'core:name': { text: 'Scout' },
          'core:actor': { name: 'Scout' },
        },
      });
      const statueDef = new EntityDefinition('test:statue', {
        description: 'Ancient statue',
        components: {
          'core:name': { text: 'Ancient Statue' },
        },
      });
      testBed.setupDefinitions(actorDef, statueDef);

      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'actor-2',
      });
      await entityManager.createEntityInstance('test:statue', {
        instanceId: 'statue-1',
      });

      const actionDef = {
        id: 'explore:inspect',
        name: 'Inspect',
        template: 'inspect {object}',
      };

      const resolvedTargets = {
        primary: [{ id: 'statue-1', displayName: 'Ancient Statue' }],
        secondary: [],
      };

      const targetDefinitions = {
        primary: { placeholder: 'object' },
        secondary: { placeholder: 'target' },
      };

      const task = createActionFormattingTask({
        actor,
        actionWithTargets: {
          actionDef,
          targetContexts: [ActionTargetContext.forEntity('statue-1')],
        },
        formatterOptions: { debug: true },
        batchResolvedTargets: resolvedTargets,
        batchTargetDefinitions: targetDefinitions,
      });

      const accumulator = new FormattingAccumulator();
      const instrumentation = createInstrumentation();

      await strategy.format({
        task,
        accumulator,
        instrumentation,
        createError,
        trace: null,
      });

      expect(instrumentation.actionCompleted).toHaveBeenCalledTimes(1);
      const payload = instrumentation.actionCompleted.mock.calls[0][0].payload;
      expect(payload.fallbackUsed).toBe(true);
      expect(payload.formatterMethod).toBe('format');
      expect(payload.commandCount).toBe(1);

      const formattedActions = accumulator.getFormattedActions();
      expect(formattedActions).toHaveLength(1);
      expect(formattedActions[0].command).toBe('inspect');
      expect(formattedActions[0].params.targetIds.primary).toEqual(['statue-1']);

      const summary = accumulator.getActionSummary('explore:inspect');
      expect(summary?.successes).toBe(1);
      expect(summary?.path).toBe('multi-target');
    });

    it('supports command formatters without multi-target support by using fallback directly', async () => {
      const fallbackOnlyFormatter = new ActionCommandFormatter();
      const fallbackOnlyStrategy = new GlobalMultiTargetStrategy({
        commandFormatter: fallbackOnlyFormatter,
        entityManager,
        safeEventDispatcher: testBed.mocks.eventDispatcher,
        getEntityDisplayNameFn: getEntityDisplayName,
        logger,
        fallbackFormatter: new LegacyFallbackFormatter({
          commandFormatter: fallbackOnlyFormatter,
          entityManager,
          getEntityDisplayNameFn: getEntityDisplayName,
        }),
        targetNormalizationService,
      });

      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor entity',
        components: {
          'core:name': { text: 'Scout' },
          'core:actor': { name: 'Scout' },
        },
      });
      const relicDef = new EntityDefinition('test:relic', {
        description: 'Ancient relic',
        components: {
          'core:name': { text: 'Ancient Relic' },
        },
      });
      testBed.setupDefinitions(actorDef, relicDef);

      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'actor-3',
      });
      await entityManager.createEntityInstance('test:relic', {
        instanceId: 'relic-1',
      });

      const actionDef = {
        id: 'explore:examine',
        name: 'Examine',
        template: 'examine {target}',
      };

      const task = createActionFormattingTask({
        actor,
        actionWithTargets: {
          actionDef,
          targetContexts: [ActionTargetContext.forEntity('relic-1')],
        },
        formatterOptions: { debug: false },
        batchResolvedTargets: {
          primary: [{ id: 'relic-1', displayName: 'Ancient Relic' }],
        },
        batchTargetDefinitions: {
          primary: { placeholder: 'target' },
        },
      });

      const accumulator = new FormattingAccumulator();
      const instrumentation = createInstrumentation();

      await fallbackOnlyStrategy.format({
        task,
        accumulator,
        instrumentation,
        createError,
        trace: null,
      });

      expect(instrumentation.actionCompleted).toHaveBeenCalledTimes(1);
      const payload = instrumentation.actionCompleted.mock.calls[0][0].payload;
      expect(payload.fallbackUsed).toBe(true);
      expect(payload.commandCount).toBe(1);
      expect(accumulator.getFormattedActions()[0].command).toBe(
        'examine Ancient Relic'
      );
    });

    it('records normalization failures and emits structured errors', async () => {
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Actor entity',
        components: {
          'core:name': { text: 'Scout' },
          'core:actor': { name: 'Scout' },
        },
      });
      testBed.setupDefinitions(actorDef);

      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'actor-4',
      });

      const actionDef = {
        id: 'explore:broken',
        name: 'Broken Action',
        template: 'do something',
      };

      const task = createActionFormattingTask({
        actor,
        actionWithTargets: {
          actionDef,
          targetContexts: [ActionTargetContext.forEntity('actor-4')],
        },
        formatterOptions: { debug: true },
        batchResolvedTargets: {
          primary: [{ label: 'missing-id' }],
        },
        batchTargetDefinitions: {
          primary: { placeholder: 'target' },
        },
      });

      const accumulator = new FormattingAccumulator();
      const instrumentation = createInstrumentation();

      await strategy.format({
        task,
        accumulator,
        instrumentation,
        createError,
        trace: null,
      });

      expect(instrumentation.actionFailed).toHaveBeenCalledTimes(1);
      expect(accumulator.getFormattedActions()).toHaveLength(0);
      expect(accumulator.getErrors()).toHaveLength(1);

      const summary = accumulator.getActionSummary('explore:broken');
      expect(summary?.failures).toBe(1);
    });
  });
});
