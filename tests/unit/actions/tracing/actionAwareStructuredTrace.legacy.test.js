import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('ActionAwareStructuredTrace - Legacy Support', () => {
  let testBed;
  let trace;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Legacy Conversion Capture', () => {
    beforeEach(async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        verbosity: 'detailed',
        tracedActions: [
          'core:test-action',
          'core:legacy-scope',
          'core:old-target-type',
          'core:failed-conversion',
        ],
      });
    });

    it('should capture string targets legacy conversion', () => {
      const actionId = 'core:test-action';
      const conversionData = {
        isLegacy: true,
        originalAction: { id: actionId, targets: 'actor.partners' },
        targetDefinitions: {
          primary: {
            scope: 'actor.partners',
            placeholder: 'partner',
          },
        },
        processingTime: 2.5,
        migrationSuggestion: JSON.stringify({ modern: 'format' }, null, 2),
      };

      trace.captureLegacyConversion(actionId, conversionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.legacy_processing).toBeDefined();
      expect(actionTrace.stages.legacy_processing.data.originalFormat).toBe(
        'string_targets'
      );
      expect(actionTrace.stages.legacy_processing.data.success).toBe(true);
      expect(actionTrace.stages.legacy_processing.data.conversionTime).toBe(
        2.5
      );
    });

    it('should capture scope property legacy conversion', () => {
      const actionId = 'core:legacy-scope';
      const conversionData = {
        isLegacy: true,
        originalAction: { id: actionId, scope: 'actor.items' },
        targetDefinitions: {
          primary: {
            scope: 'actor.items',
            placeholder: 'item',
          },
        },
        processingTime: 1.8,
      };

      trace.captureLegacyConversion(actionId, conversionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_processing.data.originalFormat).toBe(
        'scope_property'
      );
      expect(actionTrace.stages.legacy_processing.data.conversionTime).toBe(
        1.8
      );
    });

    it('should capture legacy targetType conversion', () => {
      const actionId = 'core:old-target-type';
      const conversionData = {
        isLegacy: true,
        originalAction: { id: actionId, targetType: 'partner', targetCount: 1 },
        targetDefinitions: {
          primary: {
            scope: 'actor.partners',
            placeholder: 'partner',
          },
        },
        processingTime: 3.2,
      };

      trace.captureLegacyConversion(actionId, conversionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_processing.data.originalFormat).toBe(
        'legacy_target_type'
      );
      expect(actionTrace.stages.legacy_processing.data.conversionTime).toBe(
        3.2
      );
    });

    it('should capture failed conversions', () => {
      const actionId = 'core:failed-conversion';
      const conversionData = {
        isLegacy: true,
        originalAction: { id: actionId, invalidProperty: 'test' },
        error: 'Unable to convert invalid legacy format',
        processingTime: 0.5,
      };

      trace.captureLegacyConversion(actionId, conversionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_processing.data.success).toBe(false);
      expect(actionTrace.stages.legacy_processing.data.error).toBe(
        'Unable to convert invalid legacy format'
      );
    });

    it('should not capture data for non-traced actions', async () => {
      const nonTracedActionId = 'core:not-traced';
      const conversionData = {
        isLegacy: true,
        originalAction: { id: nonTracedActionId, targets: 'actor.partners' },
        processingTime: 1.0,
      };

      trace.captureLegacyConversion(nonTracedActionId, conversionData);

      const actionTrace = trace.getActionTrace(nonTracedActionId);
      expect(actionTrace).toBeNull();
    });
  });

  describe('Legacy Detection Capture', () => {
    beforeEach(async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        verbosity: 'detailed',
        tracedActions: ['core:detect-legacy', 'core:modern-action'],
      });
    });

    it('should capture legacy detection data', () => {
      const actionId = 'core:detect-legacy';
      const detectionData = {
        hasStringTargets: true,
        hasScopeOnly: false,
        hasLegacyFields: false,
        detectedFormat: 'string_targets',
        requiresConversion: true,
      };

      trace.captureLegacyDetection(actionId, detectionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_detection).toBeDefined();
      expect(actionTrace.stages.legacy_detection.data.hasStringTargets).toBe(
        true
      );
      expect(actionTrace.stages.legacy_detection.data.legacyFormat).toBe(
        'string_targets'
      );
      expect(actionTrace.stages.legacy_detection.data.requiresConversion).toBe(
        true
      );
    });

    it('should capture modern action detection', () => {
      const actionId = 'core:modern-action';
      const detectionData = {
        hasStringTargets: false,
        hasScopeOnly: false,
        hasLegacyFields: false,
        detectedFormat: 'modern',
        requiresConversion: false,
      };

      trace.captureLegacyDetection(actionId, detectionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_detection.data.requiresConversion).toBe(
        false
      );
      expect(actionTrace.stages.legacy_detection.data.legacyFormat).toBe(
        'modern'
      );
    });

    it('should include timestamp in detection data', () => {
      const actionId = 'core:detect-legacy';
      const detectionData = {
        hasStringTargets: false,
        hasScopeOnly: true,
        hasLegacyFields: false,
        detectedFormat: 'scope_property',
        requiresConversion: true,
      };

      const beforeTime = Date.now();
      trace.captureLegacyDetection(actionId, detectionData);
      const afterTime = Date.now();

      const actionTrace = trace.getActionTrace(actionId);
      expect(
        actionTrace.stages.legacy_detection.data.timestamp
      ).toBeGreaterThanOrEqual(beforeTime);
      expect(
        actionTrace.stages.legacy_detection.data.timestamp
      ).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Legacy Processing Summary', () => {
    beforeEach(async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        verbosity: 'detailed',
        tracedActions: ['action1', 'action2', 'action3', 'action4'],
      });

      // Set up test data with multiple legacy conversions
      trace.captureLegacyConversion('action1', {
        isLegacy: true,
        originalAction: { targets: 'actor.partners' },
        processingTime: 2.0,
      });

      trace.captureLegacyConversion('action2', {
        isLegacy: true,
        originalAction: { scope: 'actor.items' },
        processingTime: 1.5,
      });

      trace.captureLegacyConversion('action3', {
        isLegacy: true,
        originalAction: { targetType: 'partner' },
        error: 'Conversion failed',
        processingTime: 0.8,
      });

      // Non-legacy action for contrast
      trace.captureLegacyConversion('action4', {
        isLegacy: false,
        originalAction: { targets: { primary: { scope: 'actor.partners' } } },
        processingTime: 0.5,
      });
    });

    it('should generate accurate legacy processing summary', () => {
      const summary = trace.getLegacyProcessingSummary();

      expect(summary.totalLegacyActions).toBe(3);
      expect(summary.successfulConversions).toBe(2);
      expect(summary.failedConversions).toBe(1);
      expect(summary.conversionsByFormat.string_targets).toBe(1);
      expect(summary.conversionsByFormat.scope_property).toBe(1);
      expect(summary.conversionsByFormat.legacy_target_type).toBe(1);
      expect(summary.averageConversionTime).toBeCloseTo(1.43, 2);
      expect(summary.totalConversionTime).toBe(4.3);
    });

    it('should handle empty trace data', async () => {
      const emptyTrace = await testBed.createActionAwareTrace({
        actorId: 'empty-actor',
      });

      const summary = emptyTrace.getLegacyProcessingSummary();

      expect(summary.totalLegacyActions).toBe(0);
      expect(summary.successfulConversions).toBe(0);
      expect(summary.failedConversions).toBe(0);
      expect(summary.averageConversionTime).toBe(0);
      expect(summary.totalConversionTime).toBe(0);
      expect(summary.conversionsByFormat).toEqual({});
    });

    it('should only count legacy actions in summary', () => {
      const summary = trace.getLegacyProcessingSummary();

      // Should not count action4 which has isLegacy: false
      expect(summary.totalLegacyActions).toBe(3);
    });

    it('should correctly track conversion formats', () => {
      const summary = trace.getLegacyProcessingSummary();

      // Check all formats are tracked
      expect(Object.keys(summary.conversionsByFormat)).toHaveLength(3);
      expect(summary.conversionsByFormat.string_targets).toBe(1);
      expect(summary.conversionsByFormat.scope_property).toBe(1);
      expect(summary.conversionsByFormat.legacy_target_type).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        verbosity: 'detailed',
        tracedActions: ['edge-case-1', 'edge-case-2'],
      });
    });

    it('should handle missing originalAction in conversion data', () => {
      const actionId = 'edge-case-1';
      const conversionData = {
        isLegacy: true,
        // Missing originalAction
        processingTime: 1.0,
      };

      trace.captureLegacyConversion(actionId, conversionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_processing.data.originalFormat).toBe(
        'unknown'
      );
    });

    it('should handle missing processingTime', () => {
      const actionId = 'edge-case-2';
      const conversionData = {
        isLegacy: true,
        originalAction: { targets: 'actor.partners' },
        // Missing processingTime
      };

      trace.captureLegacyConversion(actionId, conversionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(
        actionTrace.stages.legacy_processing.data.conversionTime
      ).toBeUndefined();
    });

    it('should handle unknown legacy format', () => {
      const actionId = 'edge-case-1';
      const conversionData = {
        isLegacy: true,
        originalAction: { unknownProperty: 'value' },
        processingTime: 1.0,
      };

      trace.captureLegacyConversion(actionId, conversionData);

      const actionTrace = trace.getActionTrace(actionId);
      expect(actionTrace.stages.legacy_processing.data.originalFormat).toBe(
        'unknown'
      );
    });
  });

  describe('Integration with Verbosity Levels', () => {
    it('should respect verbosity settings for legacy data', async () => {
      const minimalTrace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        verbosity: 'minimal',
        tracedActions: ['test-action'],
      });

      const conversionData = {
        isLegacy: true,
        originalAction: { targets: 'actor.partners' },
        processingTime: 2.5,
        migrationSuggestion: 'long suggestion text',
      };

      minimalTrace.captureLegacyConversion('test-action', conversionData);

      const actionTrace = minimalTrace.getActionTrace('test-action');
      // Minimal verbosity should still capture legacy data as it's a special stage
      expect(actionTrace.stages.legacy_processing).toBeDefined();
      expect(actionTrace.stages.legacy_processing.data.isLegacy).toBe(true);
    });
  });
});
