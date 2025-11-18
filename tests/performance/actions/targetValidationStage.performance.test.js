/**
 * @file Performance baseline for TargetComponentValidationStage.
 * @description Benchmarks the hardened validation stage with large action batches to detect caching regressions.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { TargetComponentValidationStage } from '../../../src/actions/pipeline/stages/TargetComponentValidationStage.js';
import ContextUpdateEmitter from '../../../src/actions/pipeline/services/implementations/ContextUpdateEmitter.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 *
 * @param root0
 * @param root0.snapshot
 * @param root0.logger
 */
function buildStage({ snapshot, logger }) {
  const componentValidator = {
    validateTargetComponents: jest.fn(() => ({ valid: true })),
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

  return new TargetComponentValidationStage({
    targetComponentValidator: componentValidator,
    targetRequiredComponentsValidator: requiredValidator,
    logger,
    actionErrorContextBuilder: {
      buildErrorContext: jest.fn((payload) => ({ ...payload })),
    },
    targetCandidatePruner: pruner,
    configProvider: { getSnapshot: () => snapshot },
    validationReporter: {
      reportStageSkipped: jest.fn(),
      reportStageStart: jest.fn(),
      reportStageCompletion: jest.fn(),
      reportValidationAnalysis: jest.fn().mockResolvedValue(),
      reportPerformanceData: jest.fn().mockResolvedValue(),
    },
    contextUpdateEmitter: new ContextUpdateEmitter(),
  });
}

/**
 *
 * @param count
 */
function buildActionsWithTargets(count) {
  return Array.from({ length: count }, (_, index) => ({
    actionDef: {
      id: `benchmark:action:${index}`,
      template: 'benchmark {primary} with {support}',
    },
    resolvedTargets: {
      primary: [{ id: `enemy:${index}`, name: `Enemy ${index}` }],
      support: [{ id: `ally:${index}`, name: `Ally ${index}` }],
    },
    targetDefinitions: {
      primary: { placeholder: 'primary' },
      support: { placeholder: 'support', optional: true },
    },
    targetContexts: [
      {
        type: 'entity',
        entityId: `enemy:${index}`,
        placeholder: 'primary',
      },
      {
        type: 'entity',
        entityId: `ally:${index}`,
        placeholder: 'support',
      },
    ],
  }));
}

describe('TargetComponentValidationStage performance baseline', () => {
  it('processes large batches within the cached configuration budget', async () => {
    const logger = createLogger();
    const snapshot = {
      validationEnabled: true,
      skipValidation: false,
      strictness: 'strict',
      logDetails: false,
      performanceThreshold: 250,
      shouldSkipAction: () => false,
    };

    const stage = buildStage({ snapshot, logger });
    const batchSize = 250;
    const actionsWithTargets = buildActionsWithTargets(batchSize);

    const context = {
      actor: { id: 'performance:actor' },
      actionsWithTargets,
    };

    const start = performance.now();
    const result = await stage.executeInternal(context);
    const duration = performance.now() - start;

    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(batchSize);

    // Emit a baseline for future comparisons without enforcing a brittle threshold
    console.log(
      `[TargetComponentValidationStage] Processed ${batchSize} actions in ${duration.toFixed(
        2
      )}ms`
    );

    expect(duration).toBeLessThan(400);
  });
});
