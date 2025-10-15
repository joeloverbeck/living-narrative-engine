/**
 * @file Integration tests covering ActionTraceFilter working alongside
 *       ActionAwareStructuredTrace to validate real tracing behaviour.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, payload) {
    this.debugLogs.push({ message, payload });
  }

  info(message, payload) {
    this.infoLogs.push({ message, payload });
  }

  warn(message, payload) {
    this.warnLogs.push({ message, payload });
  }

  error(message, payload) {
    this.errorLogs.push({ message, payload });
  }
}

describe('ActionTraceFilter real integration behaviour', () => {
  /** @type {RecordingLogger} */
  let logger;

  beforeEach(() => {
    logger = new RecordingLogger();
  });

  it('applies inclusion and exclusion patterns when capturing trace data', () => {
    const filter = new ActionTraceFilter({
      logger,
      tracedActions: ['movement:*', '/core:.*$/'],
      excludedActions: ['movement:stop'],
      inclusionConfig: {
        componentData: true,
        prerequisites: true,
        targets: true,
      },
    });

    const trace = new ActionAwareStructuredTrace({
      actionTraceFilter: filter,
      actorId: 'actor-1',
      context: { reason: 'integration' },
      logger,
    });

    trace.captureActionData('component_filtering', 'movement:go', {
      passed: true,
      requiredComponents: ['core:movement'],
    });
    trace.captureActionData('component_filtering', 'movement:stop', {
      passed: false,
    });
    trace.captureActionData('component_filtering', 'core:wait', {
      passed: true,
    });
    trace.captureActionData('component_filtering', 'dialogue:say', {
      passed: true,
    });

    const tracedActions = trace.getTracedActions();
    expect(tracedActions.has('movement:go')).toBe(true);
    expect(tracedActions.has('core:wait')).toBe(true);
    expect(tracedActions.has('movement:stop')).toBe(false);
    expect(tracedActions.has('dialogue:say')).toBe(false);

    // ensure system actions bypass patterns
    expect(filter.shouldTrace('__system:heartbeat')).toBe(true);
    // wildcard should allow matching without exclusions
    expect(filter.shouldTrace('movement:dash')).toBe(true);
    // action outside inclusions should be ignored
    expect(filter.shouldTrace('dialogue:question')).toBe(false);
    // suffix wildcard patterns enable opt-in tracing later
    filter.addTracedActions('*:question');
    expect(filter.shouldTrace('dialogue:question')).toBe(true);

    // summary should expose the configured patterns
    const summary = filter.getConfigurationSummary();
    expect(summary.tracedActions).toEqual(
      expect.arrayContaining(['movement:*', '/core:.*$/'])
    );
    expect(summary.excludedActions).toContain('movement:stop');

    // logger recorded debug entries for trace decisions
    expect(
      logger.debugLogs.some((entry) =>
        entry.message?.includes("Action 'movement:go' tracing decision")
      )
    ).toBe(true);
  });

  it('updates configuration dynamically and honours regex caching', () => {
    const filter = new ActionTraceFilter({
      logger,
      tracedActions: ['dialogue:*'],
      excludedActions: ['dialogue:loud'],
    });

    filter.updateFromConfig({
      enabled: true,
      tracedActions: ['core:sleep', 'movement:*'],
      excludedActions: ['/(movement:(dash|sprint))/'],
      verbosity: 'verbose',
      includeComponentData: true,
      includePrerequisites: true,
      includeTargets: true,
    });

    expect(filter.isEnabled()).toBe(true);
    expect(filter.getVerbosityLevel()).toBe('verbose');
    expect(filter.getInclusionConfig()).toEqual({
      componentData: true,
      prerequisites: true,
      targets: true,
    });

    expect(filter.shouldTrace('movement:go')).toBe(true);
    expect(filter.shouldTrace('movement:dash')).toBe(false);
    expect(filter.shouldTrace('core:sleep')).toBe(true);

    filter.setVerbosityLevel('minimal');
    expect(filter.getVerbosityLevel()).toBe('minimal');

    filter.updateInclusionConfig({ componentData: false });
    expect(filter.getInclusionConfig()).toMatchObject({ componentData: false });

    filter.addTracedActions(['dialogue:*', '/core:secret/']);
    filter.addExcludedActions(['/core:secret/', 'dialogue:shout']);
    // add invalid regex to trigger warning path
    filter.addTracedActions('/(broken[/');
    expect(
      logger.warnLogs.some((entry) =>
        entry.message?.includes('Invalid regex pattern will be ignored')
      )
    ).toBe(true);

    // cached regex branch - adding the same exclusion again should not recompile
    filter.addExcludedActions('/core:secret/');

    expect(filter.shouldTrace('dialogue:quiet')).toBe(true);
    expect(filter.shouldTrace('dialogue:shout')).toBe(false);

    filter.removeTracedActions('dialogue:*');
    expect(filter.shouldTrace('dialogue:quiet')).toBe(false);

    // wildcard exclusion should stop all tracing when configured
    filter.addExcludedActions('*');
    expect(filter.shouldTrace('core:sleep')).toBe(false);

    const summary = filter.getConfigurationSummary();
    expect(summary.excludedActionCount).toBeGreaterThan(0);
    expect(summary.tracedActionCount).toBeGreaterThan(0);
    expect(summary.verbosityLevel).toBe('minimal');
    expect(summary.inclusionConfig.componentData).toBe(false);
  });

  it('validates inputs and falls back to wildcard tracing defaults', () => {
    expect(
      () =>
        new ActionTraceFilter({
          logger,
          verbosityLevel: 'extreme',
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new ActionTraceFilter({
          logger,
          inclusionConfig: null,
        })
    ).toThrow(InvalidArgumentError);

    const defaultFilter = new ActionTraceFilter({ logger });
    expect(defaultFilter.shouldTrace('core:alpha')).toBe(true);

    const filter = new ActionTraceFilter({
      logger,
      tracedActions: 'movement:*',
      excludedActions: 'movement:block',
    });
    // Reset constructor defaults that collapse to universal wildcard
    filter.removeTracedActions('*');
    filter.addTracedActions('movement:*');
    filter.addExcludedActions('movement:block');

    expect(() => filter.shouldTrace('')).toThrow(InvalidArgumentError);
    expect(() => filter.setVerbosityLevel('super-verbose')).toThrow(
      InvalidArgumentError
    );

    filter.updateFromConfig({
      enabled: false,
      tracedActions: [],
      excludedActions: null,
      includeComponentData: false,
      includePrerequisites: false,
      includeTargets: false,
    });
    expect(filter.shouldTrace('core:anything')).toBe(false);

    filter.updateFromConfig({
      enabled: true,
      tracedActions: ['  core:whatever  '],
      excludedActions: ['  core:ignore  '],
      verbosity: 'standard',
      includeComponentData: false,
      includePrerequisites: false,
      includeTargets: false,
    });
    expect(filter.shouldTrace('core:whatever')).toBe(true);
    expect(filter.shouldTrace('core:ignore')).toBe(false);
  });
});
