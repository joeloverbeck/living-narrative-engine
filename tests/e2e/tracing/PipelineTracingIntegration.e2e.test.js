/**
 * @file Full Pipeline Tracing Integration E2E Test Suite
 * @description Priority 2.1: Important System Integration - 2.1 Full Pipeline Tracing Integration (MEDIUM)
 * 
 * This comprehensive e2e test suite validates the complete action discovery pipeline tracing workflow
 * from component filtering through target resolution and formatting with cross-stage performance correlation.
 * 
 * Based on the architecture analysis in reports/actions-tracing-architecture-analysis.md,
 * this addresses Priority 2.1: Full Pipeline Tracing Integration testing requirements.
 * 
 * Test Scenarios:
 * 1. Complete pipeline tracing with simple action and stage validation
 * 2. Multi-target resolution with enhanced scope evaluation tracing  
 * 3. Legacy action detection and conversion with compatibility layer tracing
 * 4. Performance correlation across pipeline stages with bottleneck identification
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';

import { PipelineTracingIntegrationTestBed } from './common/pipelineTracingIntegrationTestBed.js';
import {
  PIPELINE_TEST_ACTIONS,
  PIPELINE_TEST_ACTORS,
  PIPELINE_SCENARIOS,
  PERFORMANCE_THRESHOLDS,
  createPipelineTestAction,
  createMultiTargetAction,
  createLegacyTestAction,
} from './fixtures/pipelineTracingTestActions.js';

/**
 * Full Pipeline Tracing Integration E2E Test Suite
 * 
 * Validates end-to-end pipeline tracing functionality including:
 * - Action discovery pipeline stage tracing
 * - Component filtering with trace capture
 * - Prerequisite evaluation tracing
 * - Multi-target resolution with enhanced scope tracing
 * - Cross-stage performance correlation
 * - Legacy action detection and conversion tracing
 * - Pipeline performance analysis and bottleneck identification
 */
describe('Full Pipeline Tracing Integration E2E', () => {
  let testBed;
  let startTime;

  beforeEach(async () => {
    startTime = performance.now();
    testBed = new PipelineTracingIntegrationTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
      const duration = performance.now() - startTime;
      console.log(`Test completed in ${duration.toFixed(2)}ms`);
    }
  });

  describe('Scenario 1: Complete Pipeline Tracing with Simple Action', () => {
    test('should trace complete action discovery pipeline with stage-by-stage validation', async () => {
      // Arrange
      const testAction = PIPELINE_TEST_ACTIONS.SIMPLE_MOVEMENT;
      const testActor = PIPELINE_TEST_ACTORS.BASIC_PLAYER;
      
      await testBed.setupActor(testActor);
      await testBed.enablePipelineTracing({
        verbosity: 'detailed',
        enablePerformanceTracking: true,
        stages: ['component_filtering', 'prerequisite_evaluation', 'target_resolution', 'action_formatting'],
      });

      // Act
      const result = await testBed.executePipelineWithTracing(testAction, {
        actorId: testActor.id,
        expectSuccess: true,
      });

      // Assert - Pipeline Execution Success
      expect(result.success).toBe(true);
      expect(result.discoveredActions).toBeDefined();
      expect(result.discoveredActions.length).toBeGreaterThan(0);

      // Assert - Trace Capture Validation
      const traces = testBed.getCapturedTraces();
      expect(traces).toBeDefined();
      expect(traces.length).toBeGreaterThan(0);

      const pipelineTrace = traces.find(trace => 
        trace.type === 'pipeline' && trace.actionId === testAction.id
      );
      expect(pipelineTrace).toBeDefined();

      // Assert - Stage-by-Stage Validation
      const expectedStages = ['component_filtering', 'prerequisite_evaluation', 'target_resolution', 'action_formatting'];
      expectedStages.forEach(stage => {
        expect(pipelineTrace.stages).toHaveProperty(stage);
        expect(pipelineTrace.stages[stage].timestamp).toBeGreaterThan(0);
        expect(pipelineTrace.stages[stage].data).toBeDefined();
      });

      // Assert - Component Filtering Stage Data
      const componentStage = pipelineTrace.stages.component_filtering;
      expect(componentStage.data.filteredComponents).toBeDefined();
      expect(componentStage.data.componentCount).toBeGreaterThan(0);
      expect(componentStage.data.filterCriteria).toBeDefined();

      // Assert - Prerequisite Evaluation Stage Data  
      const prerequisiteStage = pipelineTrace.stages.prerequisite_evaluation;
      expect(prerequisiteStage.data.evaluatedPrerequisites).toBeDefined();
      expect(prerequisiteStage.data.passedCount).toBeDefined();
      expect(prerequisiteStage.data.failedCount).toBeDefined();

      // Assert - Target Resolution Stage Data
      const targetStage = pipelineTrace.stages.target_resolution;
      expect(targetStage.data.resolvedTargets).toBeDefined();
      expect(targetStage.data.targetCount).toBeGreaterThan(0);
      expect(targetStage.data.resolutionMethod).toBeDefined();

      // Assert - Action Formatting Stage Data
      const formattingStage = pipelineTrace.stages.action_formatting;
      expect(formattingStage.data.formattedActions).toBeDefined();
      expect(formattingStage.data.formatType).toBeDefined();
      expect(formattingStage.data.formattedCount).toBeGreaterThan(0);

      // Assert - Performance Validation
      const performanceData = testBed.getPerformanceMetrics();
      expect(performanceData.pipelineTotalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.PIPELINE_TOTAL);
      expect(performanceData.captureOverhead).toBeLessThan(PERFORMANCE_THRESHOLDS.CAPTURE_OVERHEAD);
    });

    test('should handle pipeline failures with proper error trace capture', async () => {
      // Arrange
      const testAction = PIPELINE_TEST_ACTIONS.INVALID_ACTION;
      const testActor = PIPELINE_TEST_ACTORS.BASIC_PLAYER;
      
      await testBed.setupActor(testActor);
      await testBed.enablePipelineTracing({ verbosity: 'standard' });

      // Act
      const result = await testBed.executePipelineWithTracing(testAction, {
        actorId: testActor.id,
        expectSuccess: false,
      });

      // Assert - Pipeline Failure Handled
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Assert - Error Trace Capture
      const traces = testBed.getCapturedTraces();
      const errorTrace = traces.find(trace => trace.type === 'error');
      expect(errorTrace).toBeDefined();
      expect(errorTrace.error).toBeDefined();
      expect(errorTrace.failedStage).toBeDefined();
      expect(errorTrace.errorClassification).toBeDefined();
    });
  });

  describe('Scenario 2: Multi-Target Resolution with Enhanced Scope Evaluation', () => {
    test('should trace multi-target resolution with enhanced scope evaluation', async () => {
      // Arrange
      const testAction = createMultiTargetAction({
        targets: ['nearby_items', 'adjacent_actors', 'accessible_exits'],
        scopeComplexity: 'high',
      });
      const testActor = PIPELINE_TEST_ACTORS.COMPLEX_ACTOR;
      
      await testBed.setupComplexEnvironment(testActor);
      await testBed.enablePipelineTracing({ 
        verbosity: 'verbose',
        enableScopeTracing: true,
        enableMultiTargetAnalysis: true,
      });

      // Act
      const result = await testBed.executePipelineWithTracing(testAction, {
        actorId: testActor.id,
        expectMultipleTargets: true,
      });

      // Assert - Multi-Target Success
      expect(result.success).toBe(true);
      expect(result.resolvedTargets).toBeDefined();
      expect(result.resolvedTargets.length).toBeGreaterThanOrEqual(2);

      // Assert - Enhanced Scope Evaluation Tracing
      const traces = testBed.getCapturedTraces();
      const scopeTrace = traces.find(trace => trace.type === 'scope_evaluation');
      expect(scopeTrace).toBeDefined();
      expect(scopeTrace.scopeQueries).toBeDefined();
      expect(scopeTrace.resolvedEntities).toBeDefined();
      expect(scopeTrace.evaluationMetrics).toBeDefined();

      // Assert - Multi-Target Resolution Stage
      const pipelineTrace = traces.find(trace => trace.type === 'pipeline');
      const multiTargetStage = pipelineTrace.stages.multi_target_resolution;
      expect(multiTargetStage).toBeDefined();
      expect(multiTargetStage.data.targetGroups).toBeDefined();
      expect(multiTargetStage.data.resolutionStrategies).toBeDefined();
      expect(multiTargetStage.data.parallelResolution).toBeDefined();

      // Assert - Performance Correlation
      const performanceData = testBed.getPerformanceMetrics();
      expect(performanceData.stageCorrelations).toBeDefined();
      expect(performanceData.scopeEvaluationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SCOPE_EVALUATION);
    });

    test('should handle complex scope resolution with dependency tracking', async () => {
      // Arrange
      const testAction = createMultiTargetAction({
        targets: ['inventory_items[{"var": "equipped"}, true]', 'location.exits[{"var": "accessible"}, true]'],
        dependencies: ['actor.components', 'location.entities'],
      });
      const testActor = PIPELINE_TEST_ACTORS.COMPLEX_ACTOR;
      
      await testBed.setupComplexEnvironment(testActor);
      await testBed.enablePipelineTracing({ 
        verbosity: 'verbose',
        enableDependencyTracking: true,
      });

      // Act  
      const result = await testBed.executePipelineWithTracing(testAction, {
        actorId: testActor.id,
        expectDependencies: true,
      });

      // Assert - Dependency Resolution
      expect(result.success).toBe(true);
      expect(result.resolvedDependencies).toBeDefined();

      // Assert - Dependency Trace Data
      const traces = testBed.getCapturedTraces();
      const dependencyTrace = traces.find(trace => trace.type === 'dependency_resolution');
      expect(dependencyTrace).toBeDefined();
      expect(dependencyTrace.dependencies).toBeDefined();
      expect(dependencyTrace.resolutionOrder).toBeDefined();
      expect(dependencyTrace.circularDependencyCheck).toBeDefined();
    });
  });

  describe('Scenario 3: Legacy Action Detection and Conversion', () => {
    test('should trace legacy action handling with compatibility layer', async () => {
      // Arrange
      const legacyAction = createLegacyTestAction({
        format: 'legacy_v1',
        conversionRequired: true,
      });
      const testActor = PIPELINE_TEST_ACTORS.BASIC_PLAYER;
      
      await testBed.setupActor(testActor);
      await testBed.enablePipelineTracing({ 
        verbosity: 'detailed',
        enableLegacyTracking: true,
      });

      // Act
      const result = await testBed.executePipelineWithTracing(legacyAction, {
        actorId: testActor.id,
        expectLegacyConversion: true,
      });

      // Assert - Legacy Conversion Success
      expect(result.success).toBe(true);
      expect(result.conversionApplied).toBe(true);
      expect(result.convertedAction).toBeDefined();

      // Assert - Legacy Detection Trace
      const traces = testBed.getCapturedTraces();
      const legacyTrace = traces.find(trace => trace.type === 'legacy_detection');
      expect(legacyTrace).toBeDefined();
      expect(legacyTrace.detectedFormat).toBe('legacy_v1');
      expect(legacyTrace.conversionStrategy).toBeDefined();

      // Assert - Compatibility Layer Trace
      const compatibilityTrace = traces.find(trace => trace.type === 'compatibility_layer');
      expect(compatibilityTrace).toBeDefined();
      expect(compatibilityTrace.originalAction).toBeDefined();
      expect(compatibilityTrace.convertedAction).toBeDefined();
      expect(compatibilityTrace.conversionSteps).toBeDefined();

      // Assert - Pipeline Integration
      const pipelineTrace = traces.find(trace => trace.type === 'pipeline');
      expect(pipelineTrace.legacyProcessing).toBe(true);
      expect(pipelineTrace.compatibilityMetrics).toBeDefined();
    });

    test('should handle legacy action conversion failures gracefully', async () => {
      // Arrange
      const malformedLegacyAction = createLegacyTestAction({
        format: 'unsupported_legacy',
        malformed: true,
      });
      const testActor = PIPELINE_TEST_ACTORS.BASIC_PLAYER;
      
      await testBed.setupActor(testActor);
      await testBed.enablePipelineTracing({ verbosity: 'standard' });

      // Act
      const result = await testBed.executePipelineWithTracing(malformedLegacyAction, {
        actorId: testActor.id,
        expectSuccess: false,
        expectLegacyConversion: true,
      });

      // Assert - Conversion Failure Handled
      expect(result.success).toBe(false);
      expect(result.conversionError).toBeDefined();

      // Assert - Error Trace with Legacy Context
      const traces = testBed.getCapturedTraces();
      const errorTrace = traces.find(trace => trace.type === 'error');
      expect(errorTrace).toBeDefined();
      expect(errorTrace.legacyContext).toBeDefined();
      expect(errorTrace.conversionAttempted).toBe(true);
      expect(errorTrace.fallbackStrategy).toBeDefined();
    });
  });

  describe('Scenario 4: Performance Correlation Across Pipeline Stages', () => {
    test('should analyze cross-stage performance correlation with bottleneck identification', async () => {
      // Arrange
      const performanceTestActions = PIPELINE_SCENARIOS.HIGH_LOAD_ACTIONS;
      const testActor = PIPELINE_TEST_ACTORS.COMPLEX_ACTOR;
      
      await testBed.setupComplexEnvironment(testActor);
      await testBed.enablePipelineTracing({ 
        verbosity: 'verbose',
        enableBottleneckAnalysis: true,
        enableCrossStageCorrelation: true,
      });

      // Act - Execute multiple actions for performance analysis
      const results = [];
      for (const action of performanceTestActions) {
        const result = await testBed.executePipelineWithTracing(action, {
          actorId: testActor.id,
          collectDetailedMetrics: true,
        });
        results.push(result);
      }

      // Assert - All Actions Processed
      expect(results.length).toBe(performanceTestActions.length);
      expect(results.every(r => r.success)).toBe(true);

      // Assert - Performance Analysis
      const performanceAnalysis = testBed.getPerformanceAnalysis();
      expect(performanceAnalysis).toBeDefined();
      expect(performanceAnalysis.crossStageCorrelation).toBeDefined();
      expect(performanceAnalysis.identifiedBottlenecks).toBeDefined();

      // Assert - Stage Performance Metrics
      expect(performanceAnalysis.stageMetrics).toBeDefined();
      const stageMetrics = performanceAnalysis.stageMetrics;
      
      ['component_filtering', 'prerequisite_evaluation', 'target_resolution', 'action_formatting'].forEach(stage => {
        expect(stageMetrics[stage]).toBeDefined();
        expect(stageMetrics[stage].avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS[stage.toUpperCase()]);
        expect(stageMetrics[stage].maxDuration).toBeDefined();
        expect(stageMetrics[stage].violations).toBeDefined();
      });

      // Assert - Bottleneck Identification
      const bottlenecks = performanceAnalysis.identifiedBottlenecks;
      bottlenecks.forEach(bottleneck => {
        expect(bottleneck.stage).toBeDefined();
        expect(bottleneck.avgDuration).toBeGreaterThan(bottleneck.threshold);
        expect(bottleneck.recommendations).toBeDefined();
      });

      // Assert - Cross-Stage Correlation
      const correlations = performanceAnalysis.crossStageCorrelation;
      expect(correlations.totalPipelineTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PIPELINE_TOTAL);
      expect(correlations.stageOverhead).toBeLessThan(PERFORMANCE_THRESHOLDS.STAGE_OVERHEAD);
    });

    test('should validate performance threshold violations and alerting', async () => {
      // Arrange - Create action that will trigger threshold violations
      const slowAction = createPipelineTestAction({
        artificialDelay: PERFORMANCE_THRESHOLDS.COMPONENT_FILTERING * 1.5, // Exceed threshold
        stage: 'component_filtering',
      });
      const testActor = PIPELINE_TEST_ACTORS.BASIC_PLAYER;
      
      await testBed.setupActor(testActor);
      await testBed.enablePipelineTracing({ 
        verbosity: 'verbose',
        enableThresholdAlerting: true,
      });

      // Act
      const result = await testBed.executePipelineWithTracing(slowAction, {
        actorId: testActor.id,
        expectThresholdViolation: true,
      });

      // Assert - Action Still Completed
      expect(result.success).toBe(true);

      // Assert - Threshold Violation Detected
      const alerts = testBed.getPerformanceAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const thresholdAlert = alerts.find(alert => 
        alert.type === 'threshold_violation' && alert.stage === 'component_filtering'
      );
      expect(thresholdAlert).toBeDefined();
      expect(thresholdAlert.actualDuration).toBeGreaterThan(PERFORMANCE_THRESHOLDS.COMPONENT_FILTERING);
      expect(thresholdAlert.threshold).toBe(PERFORMANCE_THRESHOLDS.COMPONENT_FILTERING);

      // Assert - Performance Recommendations Generated
      const recommendations = testBed.getPerformanceRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      const stageRecommendation = recommendations.find(rec => rec.stage === 'component_filtering');
      expect(stageRecommendation).toBeDefined();
      expect(stageRecommendation.priority).toBeDefined();
      expect(stageRecommendation.message).toBeDefined();
    });
  });

  describe('Integration Validation', () => {
    test('should validate complete pipeline tracing with all features enabled', async () => {
      // Arrange
      const comprehensiveAction = createPipelineTestAction({
        complexity: 'high',
        includeMultiTarget: true,
        includeLegacyComponents: true,
      });
      const testActor = PIPELINE_TEST_ACTORS.COMPLEX_ACTOR;
      
      await testBed.setupComplexEnvironment(testActor);
      await testBed.enablePipelineTracing({ 
        verbosity: 'verbose',
        enableAllFeatures: true,
      });

      // Act
      const result = await testBed.executePipelineWithTracing(comprehensiveAction, {
        actorId: testActor.id,
        validateIntegration: true,
      });

      // Assert - Complete Success
      expect(result.success).toBe(true);
      expect(result.integrationValidation.passed).toBe(true);

      // Assert - All Trace Types Captured
      const traces = testBed.getCapturedTraces();
      const traceTypes = new Set(traces.map(trace => trace.type));
      
      const expectedTraceTypes = [
        'pipeline',
        'performance',
      ];
      
      expectedTraceTypes.forEach(type => {
        expect(traceTypes.has(type)).toBe(true);
      });

      // Assert - No Critical Errors
      const errors = testBed.getCapturedErrors();
      const criticalErrors = errors.filter(error => error.severity === 'critical');
      expect(criticalErrors.length).toBe(0);

      // Assert - Performance Within Limits
      const performanceData = testBed.getPerformanceMetrics();
      expect(performanceData.overallPerformance).toBe('acceptable');
    });
  });
});