/**
 * @file Additional integration coverage for TargetComponentValidationStage.
 * Exercises configuration edge cases and tracing fallbacks that were previously untested.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { TargetComponentValidationStage } from '../../../../src/actions/pipeline/stages/TargetComponentValidationStage.js';
import TargetRequiredComponentsValidator from '../../../../src/actions/validation/TargetRequiredComponentsValidator.js';
import * as actionPipelineConfigModule from '../../../../src/config/actionPipelineConfig.js';

const { actionPipelineConfig } = actionPipelineConfigModule;

/**
 * Simple logger that records messages for assertions while satisfying the ILogger contract.
 */
class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message) {
    this.debugMessages.push(message);
  }

  info(message) {
    this.infoMessages.push(message);
  }

  warn(message) {
    this.warnMessages.push(message);
  }

  error(message) {
    this.errorMessages.push(message);
  }
}

/**
 * Minimal error context builder used by the stage under test.
 */
const dummyErrorContextBuilder = {
  buildErrorContext: (options) => ({ ...options }),
};

const clone = (value) =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
const originalBaseTargetConfig = clone(actionPipelineConfig.targetValidation);
const originalEnvTargetConfig = clone(
  actionPipelineConfig.environments.test.targetValidation
);

/**
 *
 */
function restoreTargetValidationConfig() {
  const baseClone = clone(originalBaseTargetConfig);
  Object.assign(actionPipelineConfig.targetValidation, baseClone);
  actionPipelineConfig.targetValidation.skipForActionTypes = [
    ...baseClone.skipForActionTypes,
  ];
  actionPipelineConfig.targetValidation.skipForMods = [
    ...baseClone.skipForMods,
  ];

  actionPipelineConfig.environments.test.targetValidation = clone(
    originalEnvTargetConfig
  );
}

afterEach(() => {
  restoreTargetValidationConfig();
  jest.restoreAllMocks();
});

describe('TargetComponentValidationStage configuration edge cases', () => {
  it('short-circuits when validation is disabled via configuration', async () => {
    const logger = new RecordingLogger();
    const previousTestConfig = clone(
      actionPipelineConfig.environments.test.targetValidation
    );

    actionPipelineConfig.environments.test.targetValidation = {
      ...previousTestConfig,
      enabled: false,
      strictness: 'off',
      logDetails: true,
    };
    actionPipelineConfig.targetValidation.logDetails = true;

    class NoopValidator {
      validateTargetComponents() {
        return { valid: true };
      }
    }

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: new NoopValidator(),
      targetRequiredComponentsValidator: new TargetRequiredComponentsValidator({
        logger,
      }),
      logger,
      actionErrorContextBuilder: dummyErrorContextBuilder,
    });

    const candidateActions = [{ id: 'skipped:alpha' }, { id: 'skipped:beta' }];

    class TraceRecorder {
      constructor() {
        this.steps = [];
      }

      step(message, source) {
        this.steps.push({ message, source });
      }
    }

    const trace = new TraceRecorder();

    const result = await stage.executeInternal({
      actor: { id: 'actor-001' },
      candidateActions,
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toEqual(candidateActions);
    expect(result.continueProcessing).toBe(true);

    expect(
      logger.debugMessages.includes(
        'Target component validation is disabled via configuration'
      )
    ).toBe(true);
    expect(
      trace.steps.some(
        ({ message }) =>
          message === 'Target component validation skipped (disabled in config)'
      )
    ).toBe(true);
  });

  it('returns existing candidates when validation is disabled without configuration data', async () => {
    const logger = new RecordingLogger();

    jest
      .spyOn(actionPipelineConfigModule, 'isTargetValidationEnabled')
      .mockReturnValue(false);
    jest
      .spyOn(actionPipelineConfigModule, 'targetValidationConfig')
      .mockReturnValue(null);

    class ValidatingStageBypass {
      validateTargetComponents() {
        return { valid: true };
      }
    }

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: new ValidatingStageBypass(),
      targetRequiredComponentsValidator: new TargetRequiredComponentsValidator({
        logger,
      }),
      logger,
      actionErrorContextBuilder: dummyErrorContextBuilder,
    });

    const candidateActions = [{ id: 'disabled:one' }];

    const result = await stage.executeInternal({
      actor: { id: 'actor-disabled' },
      candidateActions,
      trace: null,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toEqual(candidateActions);
    expect(
      logger.debugMessages.some((message) =>
        message.includes(
          'Target component validation is disabled via configuration'
        )
      )
    ).toBe(false);
  });

  it('applies skip lists and lenient overrides while capturing trace fallbacks', async () => {
    const logger = new RecordingLogger();

    actionPipelineConfig.targetValidation.logDetails = true;
    actionPipelineConfig.targetValidation.strictness = 'lenient';
    actionPipelineConfig.targetValidation.skipForActionTypes = ['ambient'];
    actionPipelineConfig.targetValidation.skipForMods = [];

    actionPipelineConfig.environments.test.targetValidation = {
      ...actionPipelineConfig.environments.test.targetValidation,
      strictness: 'lenient',
      logDetails: true,
    };

    class LenientTargetValidator {
      constructor() {
        this.receivedTargets = [];
      }

      validateTargetComponents(actionDef, targetEntities) {
        this.receivedTargets.push(targetEntities);
        return { valid: false, reason: 'non-critical: decorative constraint' };
      }
    }

    const lenientValidator = new LenientTargetValidator();
    const requiredValidator = new TargetRequiredComponentsValidator({ logger });

    class ThrowingTrace {
      constructor() {
        this.steps = [];
        this.successes = [];
      }

      captureActionData(stage, actionId, data) {
        this.steps.push({ stage, actionId, data });
        throw new Error('trace capture failed');
      }

      step(message, source) {
        this.steps.push({ message, source });
      }

      success(message, source, payload) {
        this.successes.push({ message, source, payload });
      }
    }

    const trace = new ThrowingTrace();

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: lenientValidator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: dummyErrorContextBuilder,
    });

    const skipAction = {
      id: 'ambient:skip-me',
      type: 'ambient',
    };

    const lenientAction = {
      id: 'story:lenient',
      forbidden_components: {
        target: ['core:forbidden-state'],
      },
      resolvedTargets: {
        target: {
          id: 'friend-01',
          components: {
            'core:allowed': {},
          },
        },
      },
    };

    const result = await stage.executeInternal({
      actor: { id: 'actor-002', components: ['core:actor'] },
      candidateActions: [skipAction, lenientAction],
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(2);
    expect(result.data.candidateActions[0]).toBe(skipAction);
    expect(result.data.candidateActions[1]).toBe(lenientAction);

    expect(lenientValidator.receivedTargets).toHaveLength(1);
    expect(lenientValidator.receivedTargets[0].actor?.id).toBe('actor-002');

    expect(
      logger.debugMessages.some((message) =>
        message.includes(
          "Skipping validation for action 'ambient:skip-me' based on configuration"
        )
      )
    ).toBe(true);
    expect(
      logger.debugMessages.some((message) =>
        message.includes(
          'allowed in lenient mode despite: Allowed in lenient mode'
        )
      )
    ).toBe(true);
    expect(
      logger.warnMessages.some((message) =>
        message.includes('Failed to capture validation analysis for action')
      )
    ).toBe(true);
    expect(
      logger.debugMessages.some((message) =>
        message.includes('Failed to capture performance data for action')
      )
    ).toBe(true);
  });

  it('falls back to default configuration when providers return null', async () => {
    const logger = new RecordingLogger();

    jest
      .spyOn(actionPipelineConfigModule, 'isTargetValidationEnabled')
      .mockReturnValue(true);
    jest
      .spyOn(actionPipelineConfigModule, 'targetValidationConfig')
      .mockReturnValue(null);

    class AlwaysValidValidator {
      validateTargetComponents() {
        return { valid: true };
      }
    }

    class PassiveTrace {
      constructor() {
        this.captured = [];
        this.steps = [];
        this.successes = [];
      }

      captureActionData(stage, actionId, data) {
        this.captured.push({ stage, actionId, data });
        return Promise.resolve();
      }

      step(message, source) {
        this.steps.push({ message, source });
      }

      success(message, source, payload) {
        this.successes.push({ message, source, payload });
      }
    }

    const trace = new PassiveTrace();

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: new AlwaysValidValidator(),
      targetRequiredComponentsValidator: new TargetRequiredComponentsValidator({
        logger,
      }),
      logger,
      actionErrorContextBuilder: dummyErrorContextBuilder,
    });

    const fallbackActions = [
      {
        id: 'fallback:multi-target',
        target_entities: {
          primary: { id: 'primary-1', components: { 'core:ally': {} } },
          secondary: { components: { 'core:tool': {} } },
          tertiary: { id: 'tertiary-1', components: { 'core:support': {} } },
        },
      },
      {
        id: 'fallback:legacy',
        target_entity: {
          id: 'target-legacy',
          components: { 'core:friend': {} },
        },
      },
      {
        id: 'fallback:legacy-unknown',
        target_entity: { components: { 'core:observer': {} } },
      },
      {
        id: 'fallback:resolved',
        resolvedTargets: {
          target: {
            id: 'resolved-target',
            components: { 'core:observer': {} },
          },
        },
      },
      {
        id: 'fallback:no-targets',
      },
    ];

    const result = await stage.executeInternal({
      actor: undefined,
      candidateActions: fallbackActions,
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(fallbackActions.length);
    expect(
      trace.captured.some(
        (entry) =>
          entry.stage === 'target_component_validation' &&
          entry.data.targetEntityIds.secondary === 'unknown'
      )
    ).toBe(true);
    expect(
      trace.captured.some(
        (entry) =>
          entry.stage === 'target_component_validation' &&
          entry.actionId === 'fallback:legacy-unknown' &&
          entry.data.targetEntityIds.target === 'unknown'
      )
    ).toBe(true);
    expect(
      trace.captured.some(
        (entry) =>
          entry.stage === 'target_component_validation' &&
          entry.actionId === 'fallback:resolved' &&
          !('actor' in entry.data.targetEntityIds)
      )
    ).toBe(true);
    expect(
      trace.captured.some((entry) => entry.stage === 'stage_performance')
    ).toBe(true);
  });

  it('skips validation for configured action types without emitting verbose logs', async () => {
    const logger = new RecordingLogger();

    actionPipelineConfig.targetValidation.skipForActionTypes = ['ambient'];

    class PassThroughValidator {
      validateTargetComponents() {
        return { valid: true };
      }
    }

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: new PassThroughValidator(),
      targetRequiredComponentsValidator: new TargetRequiredComponentsValidator({
        logger,
      }),
      logger,
      actionErrorContextBuilder: dummyErrorContextBuilder,
    });

    const skipAction = { id: 'ambient:silence', type: 'ambient' };

    const result = await stage.executeInternal({
      actor: { id: 'actor-skip' },
      candidateActions: [skipAction],
      trace: null,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1);
    expect(
      logger.debugMessages.some((message) =>
        message.includes("Skipping validation for action 'ambient:silence'")
      )
    ).toBe(false);
  });

  it('excludes invalid actions in lenient mode when failures are critical', async () => {
    const logger = new RecordingLogger();

    jest
      .spyOn(actionPipelineConfigModule, 'isTargetValidationEnabled')
      .mockReturnValue(true);
    jest
      .spyOn(actionPipelineConfigModule, 'getValidationStrictness')
      .mockReturnValue('lenient');
    jest
      .spyOn(actionPipelineConfigModule, 'targetValidationConfig')
      .mockReturnValue({ logDetails: false });

    class CriticalFailureValidator {
      validateTargetComponents() {
        return { valid: false, reason: 'critical failure detected' };
      }
    }

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: new CriticalFailureValidator(),
      targetRequiredComponentsValidator: new TargetRequiredComponentsValidator({
        logger,
      }),
      logger,
      actionErrorContextBuilder: dummyErrorContextBuilder,
    });

    const criticalAction = {
      id: 'lenient:critical',
      forbidden_components: {
        target: ['core:blocked'],
      },
    };

    const result = await stage.executeInternal({
      actor: { id: 'actor-crit' },
      candidateActions: [criticalAction],
      trace: null,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(0);
    expect(
      logger.debugMessages.some((message) =>
        message.includes(
          "Action 'lenient:critical' filtered out: critical failure detected"
        )
      )
    ).toBe(true);
  });

  it('allows lenient overrides silently when diagnostics are disabled', async () => {
    const logger = new RecordingLogger();

    const configProvider = {
      getSnapshot: () => ({
        skipValidation: false,
        logDetails: false,
        strictness: 'lenient',
        performanceThreshold: 5,
        skipForActionTypes: [],
        skipForMods: [],
        performanceModeEnabled: false,
        skipNonCriticalStages: false,
        shouldSkipAction: () => false,
      }),
    };

    class LenientNonCriticalValidator {
      validateTargetComponents() {
        return { valid: false, reason: 'non-critical: temporary condition' };
      }
    }

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: new LenientNonCriticalValidator(),
      targetRequiredComponentsValidator: new TargetRequiredComponentsValidator({
        logger,
      }),
      logger,
      actionErrorContextBuilder: dummyErrorContextBuilder,
      configProvider,
    });

    const lenientAction = {
      id: 'lenient:quiet',
      forbidden_components: { target: ['core:blocked'] },
    };

    const result = await stage.executeInternal({
      actor: { id: 'actor-lenient' },
      candidateActions: [lenientAction],
      trace: null,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1);
    expect(
      logger.debugMessages.some((message) =>
        message.includes("Action 'lenient:quiet' allowed in lenient mode")
      )
    ).toBe(false);
  });

  it('reports missing required target components as validation failures', async () => {
    const logger = new RecordingLogger();

    class AlwaysValidValidator {
      validateTargetComponents() {
        return { valid: true };
      }
    }

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: new AlwaysValidValidator(),
      targetRequiredComponentsValidator: new TargetRequiredComponentsValidator({
        logger,
      }),
      logger,
      actionErrorContextBuilder: dummyErrorContextBuilder,
    });

    const missingComponentsAction = {
      id: 'missing:components',
      target_entity: { id: 'npc-missing', components: {} },
      required_components: { target: ['core:friend'] },
    };

    const result = await stage.executeInternal({
      actor: { id: 'actor-missing' },
      candidateActions: [missingComponentsAction],
      trace: { step() {}, success() {} },
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(0);
    expect(
      logger.debugMessages.some((message) =>
        message.includes('Target (target) must have component: core:friend')
      )
    ).toBe(true);
  });
});
