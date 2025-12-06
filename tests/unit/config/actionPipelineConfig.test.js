import { describe, it, expect, jest } from '@jest/globals';

const loadModule = async ({ envMode = 'development' } = {}) => {
  jest.resetModules();

  let currentMode = envMode;
  const environmentModule = await import(
    '../../../src/utils/environmentUtils.js'
  );
  const getEnvironmentModeSpy = jest
    .spyOn(environmentModule, 'getEnvironmentMode')
    .mockImplementation(() => currentMode);

  const mod = await import('../../../src/config/actionPipelineConfig.js');

  return {
    ...mod,
    setEnvironmentMode: (mode) => {
      currentMode = mode;
    },
    envUtilsMock: {
      getEnvironmentMode: getEnvironmentModeSpy,
    },
  };
};

describe('actionPipelineConfig', () => {
  it('returns base configuration when environment has no overrides', async () => {
    const { envUtilsMock, getActionPipelineConfig, actionPipelineConfig } =
      await loadModule({
        envMode: 'staging',
      });

    const config = getActionPipelineConfig();

    expect(envUtilsMock.getEnvironmentMode).toHaveBeenCalled();

    expect(config.targetValidation.logDetails).toBe(
      actionPipelineConfig.targetValidation.logDetails
    );
    expect(config.performance.enabled).toBe(
      actionPipelineConfig.performance.enabled
    );
    expect(config.diagnostics.traceEnabled).toBe(
      actionPipelineConfig.diagnostics.traceEnabled
    );
  });

  it('merges development overrides without mutating defaults', async () => {
    const { getActionPipelineConfig, actionPipelineConfig } = await loadModule({
      envMode: 'development',
    });

    const config = getActionPipelineConfig();

    expect(config.targetValidation.logDetails).toBe(true);
    expect(config.diagnostics.traceEnabled).toBe(true);
    expect(config.diagnostics.logStageTiming).toBe(true);

    // Base configuration remains unchanged
    expect(actionPipelineConfig.targetValidation.logDetails).toBe(false);
    expect(actionPipelineConfig.diagnostics.traceEnabled).toBe(false);
  });

  it('deep merges environment arrays without mutating defaults', async () => {
    const { getActionPipelineConfig, actionPipelineConfig } = await loadModule({
      envMode: 'development',
    });

    actionPipelineConfig.environments.development.targetValidation.skipForActionTypes =
      ['stealth'];

    const config = getActionPipelineConfig();

    expect(config.targetValidation.skipForActionTypes).toEqual(['stealth']);
    expect(actionPipelineConfig.targetValidation.skipForActionTypes).toEqual(
      []
    );
  });

  it('enables production performance settings', async () => {
    const { getActionPipelineConfig } = await loadModule({
      envMode: 'production',
    });

    const config = getActionPipelineConfig();

    expect(config.performance.enabled).toBe(true);
    expect(config.performance.enableCaching).toBe(true);
    expect(config.diagnostics.traceEnabled).toBe(false);
  });

  it('determines whether target validation is enabled', async () => {
    const { isTargetValidationEnabled, actionPipelineConfig } =
      await loadModule({
        envMode: 'development',
      });

    // Enabled by default
    expect(isTargetValidationEnabled()).toBe(true);

    actionPipelineConfig.targetValidation.enabled = false;
    expect(isTargetValidationEnabled()).toBe(false);

    actionPipelineConfig.targetValidation.enabled = true;
    actionPipelineConfig.targetValidation.strictness = 'off';
    expect(isTargetValidationEnabled()).toBe(false);
  });

  it('returns validation strictness by environment', async () => {
    const { getValidationStrictness, actionPipelineConfig } = await loadModule({
      envMode: 'development',
    });

    expect(getValidationStrictness()).toBe('strict');

    actionPipelineConfig.targetValidation.strictness = 'lenient';
    expect(getValidationStrictness()).toBe('lenient');
  });

  it('evaluates stage enablement with fallbacks', async () => {
    const { isStageEnabled, actionPipelineConfig } = await loadModule({
      envMode: 'development',
    });

    expect(isStageEnabled('nonExistentStage')).toBe(true);

    actionPipelineConfig.stages.actionFormatting.enabled = false;
    expect(isStageEnabled('actionFormatting')).toBe(false);
  });

  it('detects performance mode through environment overrides', async () => {
    const { isPerformanceModeEnabled, setEnvironmentMode } = await loadModule({
      envMode: 'production',
    });

    expect(isPerformanceModeEnabled()).toBe(true);

    setEnvironmentMode('development');
    expect(isPerformanceModeEnabled()).toBe(false);
  });

  it('determines when validation should be skipped', async () => {
    const { shouldSkipValidation, actionPipelineConfig } = await loadModule({
      envMode: 'development',
    });

    actionPipelineConfig.targetValidation.enabled = false;
    expect(shouldSkipValidation({})).toBe(true);

    actionPipelineConfig.targetValidation.enabled = true;
    actionPipelineConfig.targetValidation.strictness = 'strict';
    actionPipelineConfig.targetValidation.skipForActionTypes = ['movement'];
    expect(shouldSkipValidation({ type: 'movement' })).toBe(true);

    actionPipelineConfig.targetValidation.skipForActionTypes = [];
    actionPipelineConfig.targetValidation.skipForMods = ['core'];
    expect(shouldSkipValidation({ id: 'core:inspect' })).toBe(true);

    actionPipelineConfig.targetValidation.skipForMods = [];
    actionPipelineConfig.performance.enabled = true;
    actionPipelineConfig.performance.skipNonCriticalStages = true;
    expect(shouldSkipValidation({ id: 'mod:action' })).toBe(true);

    actionPipelineConfig.performance.skipNonCriticalStages = false;
    expect(shouldSkipValidation({ id: 'mod:action' })).toBe(false);
  });

  it('exposes environment-aware configuration helpers', async () => {
    const {
      targetValidationConfig,
      performanceConfig,
      diagnosticsConfig,
      stagesConfig,
    } = await loadModule({
      envMode: 'development',
    });

    expect(targetValidationConfig().logDetails).toBe(true);
    expect(performanceConfig().enabled).toBe(false);
    expect(diagnosticsConfig().traceEnabled).toBe(true);
    expect(stagesConfig().actionFormatting.enabled).toBe(true);
  });
});
