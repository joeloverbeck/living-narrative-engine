/**
 * @file Additional integration coverage for TargetComponentValidationStage.
 * @description Exercises configuration-driven branches and trace handling paths
 *              that are not covered by the primary integration suite.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, jest } from '@jest/globals';
import { TargetComponentValidationStage } from '../../../../../src/actions/pipeline/stages/TargetComponentValidationStage.js';
import * as pipelineConfig from '../../../../../src/config/actionPipelineConfig.js';

const { actionPipelineConfig } = pipelineConfig;

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, ...args) {
    this.debugLogs.push({ message, args });
  }

  info(message, ...args) {
    this.infoLogs.push({ message, args });
  }

  warn(message, ...args) {
    this.warnLogs.push({ message, args });
  }

  error(message, ...args) {
    this.errorLogs.push({ message, args });
  }
}

class NoOpErrorContextBuilder {
  buildErrorContext(payload) {
    return { ...payload };
  }
}

class DeterministicComponentValidator {
  constructor(resultFactory) {
    this.resultFactory = resultFactory;
    this.calls = [];
  }

  validateTargetComponents(actionDef, targetEntities) {
    this.calls.push({ actionDef, targetEntities });
    return this.resultFactory(actionDef, targetEntities);
  }
}

class DeterministicRequiredValidator {
  constructor(result) {
    this.result = result;
    this.calls = [];
  }

  validateTargetRequirements(actionDef, targetEntities) {
    this.calls.push({ actionDef, targetEntities });
    return this.result;
  }
}

class RecordingTrace {
  constructor() {
    this.steps = [];
    this.successEvents = [];
    this.captured = [];
  }

  step(message, source) {
    this.steps.push({ message, source });
  }

  success(message, source, metadata) {
    this.successEvents.push({ message, source, metadata });
  }

  captureActionData(stage, actionId, payload) {
    this.captured.push({ stage, actionId, payload });
  }
}

class ErroringTrace extends RecordingTrace {
  captureActionData() {
    throw new Error('trace capture failed');
  }
}

const defaultConfigSnapshot = JSON.parse(JSON.stringify(actionPipelineConfig));

/**
 *
 */
function restoreConfig() {
  const snapshot = JSON.parse(JSON.stringify(defaultConfigSnapshot));
  Object.assign(actionPipelineConfig, snapshot);
}

/**
 *
 * @param overrides
 */
function applyTargetValidationOverrides(overrides) {
  Object.assign(actionPipelineConfig.targetValidation, overrides);

  if (!actionPipelineConfig.environments.test) {
    actionPipelineConfig.environments.test = {};
  }
  actionPipelineConfig.environments.test.targetValidation = {
    ...(actionPipelineConfig.environments.test.targetValidation || {}),
    ...overrides,
  };
}

describe('TargetComponentValidationStage configuration-sensitive integration', () => {
  beforeEach(() => {
    restoreConfig();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    restoreConfig();
  });

  it('returns candidate actions unchanged when validation is disabled via configuration', async () => {
    applyTargetValidationOverrides({ enabled: false, logDetails: true });

    const logger = new RecordingLogger();
    const stage = new TargetComponentValidationStage({
      targetComponentValidator: new DeterministicComponentValidator(() => {
        throw new Error('validator should not run when validation is disabled');
      }),
      targetRequiredComponentsValidator: new DeterministicRequiredValidator({ valid: true }),
      logger,
      actionErrorContextBuilder: new NoOpErrorContextBuilder(),
    });

    const trace = new RecordingTrace();
    const candidateActions = [{ id: 'mod:disable-check' }];

    const result = await stage.executeInternal({
      actor: { id: 'actor:disable' },
      candidateActions,
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toEqual(candidateActions);
    expect(result.continueProcessing).toBe(true);

    expect(logger.debugLogs.map((entry) => entry.message)).toContain(
      'Target component validation is disabled via configuration'
    );
    expect(trace.steps[0]).toMatchObject({
      message: 'Target component validation skipped (disabled in config)',
    });
  });

  it('skips configured action types and allows lenient non-critical validation failures while tracing targets', async () => {
    applyTargetValidationOverrides({
      strictness: 'lenient',
      logDetails: true,
    });
    actionPipelineConfig.targetValidation.skipForActionTypes = ['skip-me'];

    const logger = new RecordingLogger();
    const componentValidator = new DeterministicComponentValidator(() => ({
      valid: false,
      reason: 'non-critical target state mismatch',
    }));
    const requiredValidator = new DeterministicRequiredValidator({ valid: true });

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: componentValidator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: new NoOpErrorContextBuilder(),
    });

    const trace = new RecordingTrace();
    const actor = { id: 'actor:lenient' };
    const candidateActions = [
      {
        id: 'mod:skipped',
        type: 'skip-me',
        target_entity: { id: 'entity:skipped' },
      },
      {
        id: 'mod:lenient',
        type: 'regular',
        resolvedTargets: {
          primary: { id: 'entity:primary' },
        },
      },
    ];

    const result = await stage.executeInternal({
      actor,
      candidateActions,
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(2);
    expect(componentValidator.calls).toHaveLength(1);
    expect(componentValidator.calls[0].actionDef.id).toBe('mod:lenient');

    const debugMessages = logger.debugLogs.map((entry) => entry.message);
    expect(debugMessages).toContain(
      "Skipping validation for action 'mod:skipped' based on configuration"
    );
    expect(debugMessages.some((msg) => msg.includes('allowed in lenient mode'))).toBe(true);
    expect(
      debugMessages
        .filter((msg) => msg.startsWith('Validated '))
        .some((msg) => msg.includes('2 actions, 2 passed validation (strictness: lenient)'))
    ).toBe(true);

    expect(trace.captured.map((entry) => entry.stage)).toEqual([
      'target_component_validation',
      'stage_performance',
    ]);
    expect(trace.captured[0].payload.targetEntityIds).toMatchObject({
      actor: actor.id,
      primary: 'entity:primary',
    });
  });

  it('uses default configuration fallbacks when targetValidationConfig returns null', async () => {
    applyTargetValidationOverrides({ strictness: 'strict', logDetails: false });

    jest
      .spyOn(pipelineConfig, 'targetValidationConfig')
      .mockReturnValue(null);

    const logger = new RecordingLogger();
    const componentValidator = new DeterministicComponentValidator(() => ({
      valid: true,
    }));
    const requiredValidator = new DeterministicRequiredValidator({ valid: true });

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: componentValidator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: new NoOpErrorContextBuilder(),
    });

    const trace = new RecordingTrace();
    const candidateActions = [
      { id: 'mod:fallback', target_entity: { id: 'entity:fallback' } },
    ];

    const originalNow = performance.now;
    let callCount = 0;
    performance.now = () => (callCount++ === 0 ? 0 : 12);
    try {
      const result = await stage.executeInternal({
        actor: { id: 'actor:fallback' },
        candidateActions,
        trace,
      });

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1);
      expect(logger.debugLogs).toEqual([
        {
          message: 'Target component validation took 12.00ms for 1 actions',
          args: [],
        },
      ]);
    } finally {
      performance.now = originalNow;
    }
  });

  it('filters actions when lenient failures are critical and logging is suppressed', async () => {
    applyTargetValidationOverrides({ strictness: 'lenient', logDetails: false });
    actionPipelineConfig.targetValidation.skipForActionTypes = ['skip-me'];

    const logger = new RecordingLogger();
    const componentValidator = new DeterministicComponentValidator(() => ({
      valid: false,
      reason: 'critical validation failure',
    }));
    const requiredValidator = new DeterministicRequiredValidator({ valid: true });

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: componentValidator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: new NoOpErrorContextBuilder(),
    });

    const trace = new RecordingTrace();
    const candidateActions = [
      { id: 'mod:skipped', type: 'skip-me' },
      { id: 'mod:critical', type: 'regular', target_entity: { id: 'entity:critical' } },
    ];

    const result = await stage.executeInternal({
      candidateActions,
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1);
    expect(result.data.candidateActions[0].id).toBe('mod:skipped');
    expect(
      logger.debugLogs.some((entry) => entry.message.includes('allowed in lenient mode'))
    ).toBe(false);
  });

  it('extracts targets safely when optional definitions are absent', async () => {
    applyTargetValidationOverrides({ logDetails: true });

    const logger = new RecordingLogger();
    const componentValidator = new DeterministicComponentValidator(() => ({ valid: true }));
    const requiredValidator = new DeterministicRequiredValidator({ valid: true });

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: componentValidator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: new NoOpErrorContextBuilder(),
    });

    const trace = new RecordingTrace();
    const candidateActions = [
      {
        id: 'mod:secondary-only',
        target_entities: { secondary: { id: 'entity:secondary' } },
      },
      {
        id: 'mod:no-targets',
      },
    ];

    const result = await stage.executeInternal({
      candidateActions,
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(2);

    const validationEvents = trace.captured.filter(
      (entry) => entry.stage === 'target_component_validation'
    );
    const secondaryEvent = validationEvents.find(
      (entry) => entry.actionId === 'mod:secondary-only'
    );
    const noTargetEvent = validationEvents.find(
      (entry) => entry.actionId === 'mod:no-targets'
    );

    expect(secondaryEvent?.payload.targetEntityIds).toMatchObject({
      secondary: 'entity:secondary',
    });
    expect(noTargetEvent?.payload.targetEntityIds).toEqual({});
  });


  it('filters resolved targets lacking required components within actionsWithTargets', async () => {
    applyTargetValidationOverrides({ enabled: true, logDetails: false });

    const logger = new RecordingLogger();
    const componentValidator = new DeterministicComponentValidator(() => ({
      valid: true,
    }));
    const requiredValidator = new DeterministicRequiredValidator({ valid: true });

    const stage = new TargetComponentValidationStage({
      targetComponentValidator: componentValidator,
      targetRequiredComponentsValidator: requiredValidator,
      logger,
      actionErrorContextBuilder: new NoOpErrorContextBuilder(),
    });

    const readableTarget = {
      id: 'items:readable-letter',
      displayName: 'Readable Letter',
      entity: {
        id: 'items:readable-letter',
        components: {
          'items:readable': { text: 'A farewell written in hurried script.' },
        },
        hasComponent: (componentId) => componentId === 'items:readable',
      },
    };

    const nonReadableTarget = {
      id: 'items:plain-stone',
      displayName: 'Plain Stone',
      entity: {
        id: 'items:plain-stone',
        components: {},
        hasComponent: () => false,
      },
    };

    const actionDef = {
      id: 'items:read_item',
      required_components: {
        primary: ['items:readable'],
      },
      resolvedTargets: {
        primary: [readableTarget, nonReadableTarget],
      },
      targetDefinitions: {
        primary: {
          scope: 'items:examinable_items',
          placeholder: 'item',
        },
      },
    };

    const actionsWithTargets = [
      {
        actionDef,
        resolvedTargets: {
          primary: [readableTarget, nonReadableTarget],
        },
        targetDefinitions: actionDef.targetDefinitions,
        targetContexts: [
          { type: 'entity', entityId: 'items:readable-letter', placeholder: 'item' },
          { type: 'entity', entityId: 'items:plain-stone', placeholder: 'item' },
        ],
        isMultiTarget: true,
      },
    ];

    const trace = new RecordingTrace();

    const result = await stage.executeInternal({
      actor: { id: 'actor:reader' },
      actionsWithTargets,
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(1);

    const [filteredAction] = result.data.actionsWithTargets;
    expect(filteredAction.resolvedTargets.primary).toHaveLength(1);
    expect(filteredAction.resolvedTargets.primary[0].id).toBe('items:readable-letter');
    expect(filteredAction.targetContexts).toEqual([
      { type: 'entity', entityId: 'items:readable-letter', placeholder: 'item' },
    ]);

    expect(actionDef.resolvedTargets.primary).toEqual([
      readableTarget,
      nonReadableTarget,
    ]);

    expect(componentValidator.calls).toHaveLength(1);
    expect(componentValidator.calls[0].targetEntities.primary).toHaveLength(1);
    expect(componentValidator.calls[0].targetEntities.primary[0].id).toBe(
      'items:readable-letter'
    );
    expect(requiredValidator.calls).toHaveLength(1);
    expect(requiredValidator.calls[0].targetEntities.primary).toHaveLength(1);
    expect(requiredValidator.calls[0].targetEntities.primary[0].id).toBe(
      'items:readable-letter'
    );
  });

  it('logs trace capture failures without interrupting validation flow', async () => {
    applyTargetValidationOverrides({ logDetails: true });

    const logger = new RecordingLogger();
    const stage = new TargetComponentValidationStage({
      targetComponentValidator: new DeterministicComponentValidator(() => ({ valid: true })),
      targetRequiredComponentsValidator: new DeterministicRequiredValidator({ valid: true }),
      logger,
      actionErrorContextBuilder: new NoOpErrorContextBuilder(),
    });

    const trace = new ErroringTrace();
    const candidateActions = [
      {
        id: 'mod:trace-errors',
        target_entity: { id: 'entity:trace' },
      },
    ];

    const result = await stage.executeInternal({
      actor: { id: 'actor:trace' },
      candidateActions,
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1);

    expect(
      logger.warnLogs.some((entry) =>
        entry.message.includes("Failed to capture validation analysis for action 'mod:trace-errors'")
      )
    ).toBe(true);
    expect(
      logger.debugLogs.some((entry) =>
        entry.message.includes("Failed to capture performance data for action 'mod:trace-errors'")
      )
    ).toBe(true);
  });

  it('handles trace objects without captureActionData gracefully', async () => {
    const logger = new RecordingLogger();
    const stage = new TargetComponentValidationStage({
      targetComponentValidator: new DeterministicComponentValidator(() => ({ valid: true })),
      targetRequiredComponentsValidator: new DeterministicRequiredValidator({ valid: true }),
      logger,
      actionErrorContextBuilder: new NoOpErrorContextBuilder(),
    });

    const traceWithoutCapture = {
      step: () => {},
      success: () => {},
    };

    const candidateActions = [
      {
        id: 'mod:minimal-trace',
      },
    ];

    const result = await stage.executeInternal({
      candidateActions,
      trace: traceWithoutCapture,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1);
  });
});
