import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import LegacyAnalytics from '../../../../src/actions/tracing/legacyAnalytics.js';

describe('LegacyAnalytics', () => {
  let testBed;
  let analytics;
  let trace;

  beforeEach(() => {
    testBed = createTestBed();
    analytics = new LegacyAnalytics({ logger: testBed.mockLogger });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Legacy Report Generation', () => {
    beforeEach(async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        verbosity: 'detailed',
        tracedActions: [
          'fast-action',
          'slow-action',
          'failed-action',
          'modern-action',
        ],
      });

      // Set up comprehensive test data
      trace.captureLegacyConversion('fast-action', {
        isLegacy: true,
        originalAction: { targets: 'actor.partners' },
        processingTime: 1.2,
      });

      trace.captureLegacyConversion('slow-action', {
        isLegacy: true,
        originalAction: { scope: 'actor.items' },
        processingTime: 13.8,
      });

      trace.captureLegacyConversion('failed-action', {
        isLegacy: true,
        originalAction: { targetType: 'invalid' },
        error: 'Unknown target type',
        processingTime: 0.3,
      });

      // Modern action for contrast
      trace.captureActionData('component_filtering', 'modern-action', {
        passed: true,
        actorComponents: ['core:position'],
      });
    });

    it('should generate comprehensive legacy report', () => {
      const report = analytics.generateLegacyReport(trace);

      expect(report).toHaveProperty('overview');
      expect(report).toHaveProperty('formatBreakdown');
      expect(report).toHaveProperty('performanceImpact');
      expect(report).toHaveProperty('migrationPriority');
      expect(report).toHaveProperty('recommendations');

      expect(report.overview.totalLegacyActions).toBe(3);
      expect(report.overview.successfulConversions).toBe(2);
      expect(report.overview.failedConversions).toBe(1);
    });

    it('should analyze format distribution correctly', () => {
      const report = analytics.generateLegacyReport(trace);

      expect(report.formatBreakdown.string_targets).toBe(1);
      expect(report.formatBreakdown.scope_property).toBe(1);
      expect(report.formatBreakdown.legacy_target_type).toBe(1);
    });

    it('should analyze performance impact', () => {
      const report = analytics.generateLegacyReport(trace);
      const perf = report.performanceImpact;

      expect(perf.totalConversions).toBe(3);
      expect(perf.maxTime).toBe(13.8);
      expect(perf.minTime).toBe(0.3);
      expect(perf.averageTime).toBeCloseTo(5.1, 2);
      expect(perf.totalTime).toBe(15.3);
    });

    it('should prioritize actions for migration', () => {
      const report = analytics.generateLegacyReport(trace);
      const priorities = report.migrationPriority;

      expect(priorities.high).toHaveLength(2); // failed action + slow action
      expect(priorities.medium).toHaveLength(0);
      expect(priorities.low).toHaveLength(1); // fast action

      const failedPriority = priorities.high.find(
        (p) => p.actionId === 'failed-action'
      );
      expect(failedPriority.reason).toBe('conversion_errors');

      const slowPriority = priorities.high.find(
        (p) => p.actionId === 'slow-action'
      );
      expect(slowPriority.reason).toBe('slow_conversion');

      expect(priorities.low[0].actionId).toBe('fast-action');
      expect(priorities.low[0].reason).toBe('fast_conversion');
    });

    it('should generate appropriate recommendations', () => {
      const report = analytics.generateLegacyReport(trace);
      const recommendations = report.recommendations;

      expect(recommendations).toHaveLength(3);

      const migrationRec = recommendations.find(
        (r) => r.type === 'migration_opportunity'
      );
      expect(migrationRec).toBeDefined();
      expect(migrationRec.priority).toBe('medium');
      expect(migrationRec.description).toContain('3 legacy actions');

      const performanceRec = recommendations.find(
        (r) => r.type === 'performance_concern'
      );
      expect(performanceRec).toBeDefined();
      expect(performanceRec.priority).toBe('high');

      const reliabilityRec = recommendations.find(
        (r) => r.type === 'reliability_issue'
      );
      expect(reliabilityRec).toBeDefined();
      expect(reliabilityRec.priority).toBe('high');
      expect(reliabilityRec.description).toContain(
        '1 legacy conversions failed'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle trace with no legacy actions', async () => {
      const emptyTrace = await testBed.createActionAwareTrace({
        actorId: 'empty-actor',
        tracedActions: ['modern-1', 'modern-2'],
      });

      // Add only modern actions
      emptyTrace.captureActionData('component_filtering', 'modern-1', {
        passed: true,
      });
      emptyTrace.captureActionData('prerequisite_evaluation', 'modern-2', {
        passed: false,
      });

      const report = analytics.generateLegacyReport(emptyTrace);

      expect(report.overview.totalLegacyActions).toBe(0);
      expect(report.formatBreakdown).toEqual({});
      expect(report.performanceImpact.totalConversions).toBe(0);
      expect(report.migrationPriority.high).toHaveLength(0);
      expect(report.migrationPriority.medium).toHaveLength(0);
      expect(report.migrationPriority.low).toHaveLength(0);
      expect(report.recommendations).toHaveLength(0);
    });

    it('should handle trace with only fast conversions', async () => {
      const fastTrace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['fast1', 'fast2'],
      });

      fastTrace.captureLegacyConversion('fast1', {
        isLegacy: true,
        originalAction: { targets: 'actor.items' },
        processingTime: 0.8,
      });

      fastTrace.captureLegacyConversion('fast2', {
        isLegacy: true,
        originalAction: { scope: 'actor.partners' },
        processingTime: 1.2,
      });

      const report = analytics.generateLegacyReport(fastTrace);

      expect(report.migrationPriority.high).toHaveLength(0);
      expect(report.migrationPriority.low).toHaveLength(2);

      const perfRecommendation = report.recommendations.find(
        (r) => r.type === 'performance_concern'
      );
      expect(perfRecommendation).toBeUndefined();
    });

    it('should handle trace with only failed conversions', async () => {
      const failedTrace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['fail1', 'fail2'],
      });

      failedTrace.captureLegacyConversion('fail1', {
        isLegacy: true,
        originalAction: { targets: 'invalid' },
        error: 'Error 1',
        processingTime: 0.5,
      });

      failedTrace.captureLegacyConversion('fail2', {
        isLegacy: true,
        originalAction: { scope: 'invalid' },
        error: 'Error 2',
        processingTime: 0.3,
      });

      const report = analytics.generateLegacyReport(failedTrace);

      expect(report.overview.failedConversions).toBe(2);
      expect(report.overview.successfulConversions).toBe(0);
      expect(report.migrationPriority.high).toHaveLength(2);

      const reliabilityRec = report.recommendations.find(
        (r) => r.type === 'reliability_issue'
      );
      expect(reliabilityRec).toBeDefined();
      expect(reliabilityRec.description).toContain(
        '2 legacy conversions failed'
      );
    });

    it('should handle missing conversion time data', async () => {
      const noTimeTrace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['action1', 'action2'],
      });

      noTimeTrace.captureLegacyConversion('action1', {
        isLegacy: true,
        originalAction: { targets: 'actor.partners' },
        // No processingTime
      });

      noTimeTrace.captureLegacyConversion('action2', {
        isLegacy: true,
        originalAction: { scope: 'actor.items' },
        // No processingTime
      });

      const report = analytics.generateLegacyReport(noTimeTrace);

      expect(report.performanceImpact.totalConversions).toBe(0);
      expect(report.performanceImpact.averageTime).toBe(0);
      expect(report.performanceImpact.minTime).toBe(0);
      expect(report.performanceImpact.maxTime).toBe(0);
    });
  });

  describe('Recommendations Generation', () => {
    it('should not recommend performance optimization for fast conversions', async () => {
      const fastTrace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['action1', 'action2', 'action3'],
      });

      fastTrace.captureLegacyConversion('action1', {
        isLegacy: true,
        originalAction: { targets: 'actor.partners' },
        processingTime: 2.0,
      });

      fastTrace.captureLegacyConversion('action2', {
        isLegacy: true,
        originalAction: { scope: 'actor.items' },
        processingTime: 3.0,
      });

      fastTrace.captureLegacyConversion('action3', {
        isLegacy: true,
        originalAction: { targetType: 'partner' },
        processingTime: 1.5,
      });

      const report = analytics.generateLegacyReport(fastTrace);

      const perfRec = report.recommendations.find(
        (r) => r.type === 'performance_concern'
      );
      expect(perfRec).toBeUndefined(); // Average is ~2.17ms, under 5ms threshold
    });

    it('should recommend performance optimization for slow conversions', async () => {
      const slowTrace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['action1', 'action2'],
      });

      slowTrace.captureLegacyConversion('action1', {
        isLegacy: true,
        originalAction: { targets: 'actor.partners' },
        processingTime: 7.0,
      });

      slowTrace.captureLegacyConversion('action2', {
        isLegacy: true,
        originalAction: { scope: 'actor.items' },
        processingTime: 6.0,
      });

      const report = analytics.generateLegacyReport(slowTrace);

      const perfRec = report.recommendations.find(
        (r) => r.type === 'performance_concern'
      );
      expect(perfRec).toBeDefined();
      expect(perfRec.priority).toBe('high');
      expect(perfRec.description).toContain('6.5ms on average');
    });

    it('should provide medium priority migration recommendations for legacy actions', async () => {
      const mixedTrace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['legacy1', 'legacy2'],
      });

      mixedTrace.captureLegacyConversion('legacy1', {
        isLegacy: true,
        originalAction: { targets: 'actor.partners' },
        processingTime: 2.0,
      });

      mixedTrace.captureLegacyConversion('legacy2', {
        isLegacy: true,
        originalAction: { scope: 'actor.items' },
        processingTime: 1.5,
      });

      const report = analytics.generateLegacyReport(mixedTrace);

      const migrationRec = report.recommendations.find(
        (r) => r.type === 'migration_opportunity'
      );
      expect(migrationRec).toBeDefined();
      expect(migrationRec.priority).toBe('medium');
      expect(migrationRec.actions).toContain(
        'Review migration suggestions in trace data'
      );
      expect(migrationRec.actions).toContain('Plan gradual modernization');
    });
  });

  describe('Input Validation', () => {
    it('should validate trace dependency', () => {
      expect(() => {
        analytics.generateLegacyReport(null);
      }).toThrow();
    });

    it('should handle invalid trace object', () => {
      const invalidTrace = { notATrace: true };

      expect(() => {
        analytics.generateLegacyReport(invalidTrace);
      }).toThrow();
    });
  });
});
