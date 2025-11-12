import { describe, it, expect, beforeEach } from '@jest/globals';
import { ExecutionPhaseTimer } from '../../../../src/actions/tracing/timing/executionPhaseTimer.js';

/**
 * @description Pause execution for the provided duration to allow measurable timing gaps.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>} Promise resolved after the requested delay.
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ExecutionPhaseTimer integration', () => {
  let timer;

  beforeEach(() => {
    timer = new ExecutionPhaseTimer();
  });

  it('should coordinate multi-phase execution timing with rich reporting', async () => {
    timer.startExecution('complex_flow');
    expect(timer.isActive()).toBe(true);

    timer.startPhase('initialization', { stage: 'pre' });
    timer.addMarker('init-checkpoint', null, { checkpoint: 'post-initialization' });

    await wait(1);

    timer.startPhase('processing', { stage: 'mid' });
    timer.addMarker('processing-midpoint', 'processing', { detail: 'midpoint' });

    await wait(1);

    timer.endPhase('processing');

    timer.startPhase('finalization', { stage: 'post' });
    timer.addMarker('final-check', null, { status: 'ready' });

    timer.endExecution({ result: 'success' });

    expect(timer.isActive()).toBe(false);

    const summary = timer.getSummary();
    expect(summary.isComplete).toBe(true);
    expect(summary.phaseCount).toBe(3);
    expect(summary.totalHumanReadable).toEqual(expect.any(String));

    const phaseNames = summary.phases.map((phase) => phase.name);
    expect(phaseNames).toEqual(
      expect.arrayContaining(['initialization', 'processing', 'finalization'])
    );

    summary.phases.forEach((phase) => {
      expect(phase.humanReadable).toEqual(expect.any(String));
      expect(phase.percentage).toMatch(/%$/);
    });

    const processingPhase = timer.getPhaseData('processing');
    expect(processingPhase.metadata).toEqual({ stage: 'mid' });
    expect(processingPhase.markers.some((marker) => marker.label === 'processing-midpoint'))
      .toBe(true);

    const exported = timer.exportTimingData();
    expect(exported.summary.markerCount).toBe(summary.markerCount);
    expect(exported.phases.processing.metadata).toEqual({ stage: 'mid' });
    expect(exported.markers['processing-midpoint'].metadata).toEqual({ detail: 'midpoint' });
    expect(exported.markers['final-check'].metadata).toEqual({ status: 'ready' });
    expect(exported.precision.api).toBeDefined();

    const report = timer.createReport();
    expect(report).toContain('EXECUTION TIMING REPORT');
    expect(report).toContain('Phase Breakdown:');
    expect(report).toContain('processing');
  });

  it('should enforce lifecycle guard rails for execution and phases', () => {
    expect(timer.isActive()).toBe(false);
    expect(() => timer.endExecution()).toThrow('Execution timing was not started');
    expect(() => timer.startPhase('orphan')).toThrow(
      'Must start execution before starting phases'
    );
    expect(() => timer.addMarker('no-phase')).toThrow(
      'No active phase and no phase specified for marker'
    );
    expect(() => timer.endPhase('missing')).toThrow("Phase 'missing' was not started");

    timer.startExecution('guard_flow');
    expect(() => timer.startExecution()).toThrow('Execution timing already started');

    timer.startPhase('guard');
    timer.endPhase('guard');
    expect(() => timer.endPhase('guard')).toThrow("Phase 'guard' already ended");

    timer.endExecution();
    expect(() => timer.endExecution()).toThrow('Execution timing already ended');
    expect(timer.getPhaseData('unknown')).toBeNull();
  });

  it('should reset timing state and report incomplete executions', () => {
    timer.startExecution('initial_run');
    timer.startPhase('first');
    timer.endExecution();

    const completedSummary = timer.getSummary();
    expect(completedSummary.isComplete).toBe(true);

    timer.reset();

    const resetSummary = timer.getSummary();
    expect(resetSummary.isComplete).toBe(false);
    expect(timer.getTotalDuration()).toBeNull();

    timer.startExecution('reused_flow');
    timer.startPhase('warmup');
    expect(timer.createReport()).toBe('Execution timing not complete');
    timer.addMarker('warmup-marker');
    timer.endPhase('warmup');
    timer.endExecution();

    const reusedSummary = timer.getSummary();
    expect(reusedSummary.isComplete).toBe(true);
    expect(reusedSummary.phaseCount).toBe(1);
  });
});
