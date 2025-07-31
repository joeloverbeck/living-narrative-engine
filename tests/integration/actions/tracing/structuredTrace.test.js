/**
 * @file Integration tests for StructuredTrace class
 * @see src/actions/tracing/structuredTrace.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { ComponentFilteringStage } from '../../../../src/actions/pipeline/stages/ComponentFilteringStage.js';
import { PrerequisiteEvaluationStage } from '../../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js';

describe('StructuredTrace - Integration Tests', () => {
  let mockLogger;
  let mockActionIndex;
  let mockErrorContextBuilder;
  let mockPrerequisiteEvaluationService;

  beforeEach(() => {
    // Create mocks for dependencies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockActionIndex = {
      getCandidateActions: jest.fn(),
    };

    mockErrorContextBuilder = {
      buildErrorContext: jest.fn().mockImplementation((params) => ({
        error: params.error?.message || params.error,
        phase: params.phase,
        actorId: params.actorId,
        additionalContext: params.additionalContext,
      })),
    };

    mockPrerequisiteEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };
  });

  describe('TraceContext Backward Compatibility Integration', () => {
    it('should preserve trace logs when upgrading from TraceContext to StructuredTrace', () => {
      // Create existing TraceContext with logs
      const existingContext = new TraceContext();
      existingContext.info('System startup', 'Bootstrap');
      existingContext.step('Loading configuration', 'ConfigLoader');
      existingContext.success('Configuration loaded', 'ConfigLoader');

      // Upgrade to StructuredTrace
      const structuredTrace = new StructuredTrace(existingContext);

      // Verify logs are preserved
      expect(structuredTrace.logs).toHaveLength(3);
      expect(structuredTrace.logs[0].message).toBe('System startup');
      expect(structuredTrace.logs[1].type).toBe('step');
      expect(structuredTrace.logs[2].type).toBe('success');

      // Add new logs using delegation methods
      structuredTrace.addLog('info', 'Using delegation', 'Test', { data: 'value' });
      expect(structuredTrace.logs).toHaveLength(4);
      expect(structuredTrace.logs[3]).toMatchObject({
        type: 'info',
        message: 'Using delegation',
        source: 'Test',
        data: { data: 'value' },
      });
    });

    it('should use failure method in error recovery scenarios', async () => {
      const structuredTrace = new StructuredTrace();
      
      // Simulate a pipeline with error recovery
      const stages = [
        new ComponentFilteringStage(
          mockActionIndex,
          mockErrorContextBuilder,
          mockLogger
        ),
      ];

      // Make component filtering fail
      mockActionIndex.getCandidateActions.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const pipeline = new Pipeline(stages, mockLogger);
      
      const result = await pipeline.execute({
        actor: { id: 'test_actor', components: {} },
        actionContext: { actorId: 'test_actor' },
        candidateActions: [],
        trace: structuredTrace,
      });

      // Pipeline handles errors internally and returns result
      expect(result.success).toBe(false);
      
      // Log failure using the delegation method
      structuredTrace.failure(
        'Pipeline execution failed - attempting recovery',
        'ErrorHandler'
      );

      // Verify failure was logged
      const failureLogs = structuredTrace.logs.filter(log => log.type === 'failure');
      expect(failureLogs).toHaveLength(1);
      expect(failureLogs[0].message).toContain('attempting recovery');
    });

    it('should use error and data methods in diagnostic scenarios', () => {
      const structuredTrace = new StructuredTrace();
      
      // Simulate diagnostic logging scenario
      const diagnosticData = {
        memoryUsage: process.memoryUsage(),
        timestamp: Date.now(),
        environment: 'test',
      };

      // Log error with context
      structuredTrace.error(
        'Memory threshold exceeded',
        'MemoryMonitor',
        { threshold: '1GB', actual: '1.2GB' }
      );

      // Log diagnostic data
      structuredTrace.data(
        'System diagnostics captured',
        'DiagnosticCollector',
        diagnosticData
      );

      // Verify logs
      const errorLogs = structuredTrace.logs.filter(log => log.type === 'error');
      const dataLogs = structuredTrace.logs.filter(log => log.type === 'data');

      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].data).toMatchObject({ threshold: '1GB' });
      
      expect(dataLogs).toHaveLength(1);
      expect(dataLogs[0].data).toHaveProperty('memoryUsage');
      expect(dataLogs[0].data).toHaveProperty('timestamp');
    });

    it('should support mixed usage of TraceContext methods and spans', async () => {
      const structuredTrace = new StructuredTrace();

      // Start with traditional logging
      structuredTrace.info('Starting mixed operation', 'MixedTest');

      // Use spans for structured work
      await structuredTrace.withSpanAsync('DataProcessing', async () => {
        structuredTrace.step('Loading data', 'DataLoader');
        
        await structuredTrace.withSpanAsync('Validation', async () => {
          structuredTrace.info('Validating records', 'Validator');
          // Simulate validation work
          await new Promise(resolve => setTimeout(resolve, 10));
        });

        structuredTrace.success('Data processed', 'DataProcessor');
      });

      // Back to traditional logging
      structuredTrace.info('Operation complete', 'MixedTest');

      // Verify both systems work together
      expect(structuredTrace.logs).toHaveLength(5);
      expect(structuredTrace.getSpans()).toHaveLength(2);
      
      const hierarchicalView = structuredTrace.getHierarchicalView();
      expect(hierarchicalView.operation).toBe('DataProcessing');
      expect(hierarchicalView.children[0].operation).toBe('Validation');
    });
  });

  describe('Error Handling in Complex Scenarios', () => {
    it('should handle invalid span parameter in endSpan', () => {
      const structuredTrace = new StructuredTrace();
      
      // Test null parameter
      expect(() => structuredTrace.endSpan(null)).toThrow(
        'endSpan requires a valid Span instance'
      );

      // Test non-Span object
      expect(() => structuredTrace.endSpan({ id: 1, operation: 'fake' })).toThrow(
        'endSpan requires a valid Span instance'
      );

      // Test undefined
      expect(() => structuredTrace.endSpan(undefined)).toThrow(
        'endSpan requires a valid Span instance'
      );
    });

    it('should handle endSpan when wrong span is active in nested scenarios', () => {
      const structuredTrace = new StructuredTrace();
      
      // Create nested spans
      const span1 = structuredTrace.startSpan('OuterOperation');
      const span2 = structuredTrace.startSpan('InnerOperation');
      const span3 = structuredTrace.startSpan('DeepOperation');

      // Try to end span1 while span3 is active
      expect(() => structuredTrace.endSpan(span1)).toThrow(
        'Cannot end span 1 - it is not the currently active span'
      );

      // Try to end span2 while span3 is active
      expect(() => structuredTrace.endSpan(span2)).toThrow(
        'Cannot end span 2 - it is not the currently active span'
      );

      // Correct order works
      structuredTrace.endSpan(span3);
      structuredTrace.endSpan(span2);
      structuredTrace.endSpan(span1);

      // Verify all spans ended correctly
      expect(span1.duration).not.toBeNull();
      expect(span2.duration).not.toBeNull();
      expect(span3.duration).not.toBeNull();
    });

    it('should handle multiple span errors in complex scenarios', async () => {
      const structuredTrace = new StructuredTrace();
      
      // Create nested spans where some fail
      await structuredTrace.withSpanAsync('MainOperation', async () => {
        // First operation succeeds
        await structuredTrace.withSpanAsync('Setup', async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
        });

        // Second operation fails but is caught
        try {
          await structuredTrace.withSpanAsync('Processing', async () => {
            throw new Error('Processing failed');
          });
        } catch (error) {
          // Error is handled, continue with cleanup
        }

        // Cleanup succeeds
        await structuredTrace.withSpanAsync('Cleanup', async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
        });
      });

      // Verify span statuses
      const spans = structuredTrace.getSpans();
      expect(spans.find(s => s.operation === 'MainOperation').status).toBe('success');
      expect(spans.find(s => s.operation === 'Setup').status).toBe('success');
      expect(spans.find(s => s.operation === 'Processing').status).toBe('error');
      expect(spans.find(s => s.operation === 'Cleanup').status).toBe('success');
    });
  });

  describe('Synchronous Operations Integration', () => {
    it('should use withSpan for configuration validation', () => {
      const structuredTrace = new StructuredTrace();
      
      // Configuration validation scenario
      const validateConfig = (config) => {
        return structuredTrace.withSpan('ConfigValidation', () => {
          // Validation sub-operations
          structuredTrace.withSpan('SchemaValidation', () => {
            if (!config.version) {
              throw new Error('Missing version field');
            }
          });

          structuredTrace.withSpan('DependencyCheck', () => {
            if (!config.dependencies || config.dependencies.length === 0) {
              throw new Error('No dependencies specified');
            }
          });

          return { valid: true, config };
        }, { configFile: 'app.config.json' });
      };

      // Test successful validation
      const validConfig = {
        version: '1.0.0',
        dependencies: ['core', 'utils'],
      };

      const result = validateConfig(validConfig);
      expect(result.valid).toBe(true);

      // Check spans
      const spans = structuredTrace.getSpans();
      expect(spans).toHaveLength(3);
      expect(spans[0].operation).toBe('ConfigValidation');
      expect(spans[0].attributes).toMatchObject({ configFile: 'app.config.json' });
      expect(spans[0].status).toBe('success');
    });

    it('should handle errors in withSpan during synchronous operations', () => {
      const structuredTrace = new StructuredTrace();
      
      // Synchronous operation that fails
      const performOperation = () => {
        return structuredTrace.withSpan('SyncOperation', () => {
          // Nested operation that fails
          return structuredTrace.withSpan('NestedSync', () => {
            throw new Error('Sync operation failed');
          });
        });
      };

      // Test error propagation
      expect(() => performOperation()).toThrow('Sync operation failed');

      // Check spans captured the error
      const spans = structuredTrace.getSpans();
      expect(spans).toHaveLength(2);
      
      // Both spans should have error status
      expect(spans[0].status).toBe('error');
      expect(spans[1].status).toBe('error');
      expect(spans[1].error.message).toBe('Sync operation failed');
    });

    it('should support nested synchronous spans in initialization workflows', () => {
      const structuredTrace = new StructuredTrace();
      
      // Initialization workflow
      const initializeSystem = () => {
        return structuredTrace.withSpan('SystemInitialization', () => {
          const modules = [];

          // Initialize core modules
          structuredTrace.withSpan('CoreModulesInit', () => {
            modules.push(
              structuredTrace.withSpan('LoggerInit', () => {
                return { name: 'logger', status: 'ready' };
              })
            );

            modules.push(
              structuredTrace.withSpan('ConfigInit', () => {
                return { name: 'config', status: 'ready' };
              })
            );
          });

          // Initialize features
          structuredTrace.withSpan('FeaturesInit', () => {
            modules.push(
              structuredTrace.withSpan('AuthInit', () => {
                return { name: 'auth', status: 'ready' };
              })
            );
          });

          return { initialized: true, modules };
        });
      };

      const result = initializeSystem();
      expect(result.initialized).toBe(true);
      expect(result.modules).toHaveLength(3);

      // Verify span hierarchy
      const hierarchy = structuredTrace.getHierarchicalView();
      expect(hierarchy.operation).toBe('SystemInitialization');
      expect(hierarchy.children).toHaveLength(2);
      expect(hierarchy.children[0].operation).toBe('CoreModulesInit');
      expect(hierarchy.children[0].children).toHaveLength(2);
    });
  });

  describe('Analysis Tools Lazy Loading', () => {
    it('should lazy load analyzer when trace analysis is enabled', async () => {
      const traceConfig = {
        traceAnalysisEnabled: true,
        analysis: {
          enabled: true,
          patterns: ['performance', 'errors'],
        },
      };

      const structuredTrace = new StructuredTrace(null, traceConfig);

      // Analyzer should not be loaded initially
      expect(structuredTrace.isTraceAnalysisEnabled()).toBe(true);

      // First call should trigger lazy loading
      const analyzer = await structuredTrace.getAnalyzer();
      expect(analyzer).not.toBeNull();

      // Second call should return cached instance
      const analyzer2 = await structuredTrace.getAnalyzer();
      expect(analyzer2).toBe(analyzer);
    });

    it('should return null when analysis is disabled', async () => {
      const traceConfig = {
        traceAnalysisEnabled: false,
      };

      const structuredTrace = new StructuredTrace(null, traceConfig);

      const analyzer = await structuredTrace.getAnalyzer();
      expect(analyzer).toBeNull();

      const visualizer = await structuredTrace.getVisualizer();
      expect(visualizer).toBeNull();

      const monitor = await structuredTrace.getPerformanceMonitor();
      expect(monitor).toBeNull();
    });

    it('should lazy load visualizer with configuration', async () => {
      const traceConfig = {
        traceAnalysisEnabled: true,
        visualization: {
          enabled: true,
          format: 'html',
          theme: 'dark',
        },
      };

      const structuredTrace = new StructuredTrace(null, traceConfig);

      // Create some spans to visualize
      structuredTrace.withSpan('TestOperation', () => {
        structuredTrace.withSpan('SubOperation', () => {});
      });

      const visualizer = await structuredTrace.getVisualizer();
      expect(visualizer).not.toBeNull();
    });

    it('should lazy load performance monitor with thresholds', async () => {
      const traceConfig = {
        traceAnalysisEnabled: true,
        performanceMonitoring: {
          enabled: true,
          thresholds: {
            operationDuration: 100,
            totalDuration: 500,
          },
          sampling: {
            rate: 0.5,
            conditions: ['high-load'],
          },
        },
      };

      const structuredTrace = new StructuredTrace(null, traceConfig);

      const monitor = await structuredTrace.getPerformanceMonitor();
      expect(monitor).not.toBeNull();

      // Verify monitor is configured with thresholds
      // Note: Implementation details would depend on PerformanceMonitor class
    });

    it('should handle configuration updates', () => {
      const structuredTrace = new StructuredTrace();

      // Initially disabled
      expect(structuredTrace.isTraceAnalysisEnabled()).toBe(false);

      // Update configuration
      structuredTrace.setTraceConfiguration({
        traceAnalysisEnabled: true,
        analysis: { enabled: true },
      });

      expect(structuredTrace.isTraceAnalysisEnabled()).toBe(true);
    });
  });

  describe('Mixed Usage Patterns', () => {
    it('should support gradual migration from TraceContext to spans', async () => {
      // Start with existing TraceContext
      const existingContext = new TraceContext();
      existingContext.info('Legacy system starting', 'LegacyModule');
      
      // Upgrade to StructuredTrace
      const structuredTrace = new StructuredTrace(existingContext);

      // Phase 1: Continue using TraceContext methods
      structuredTrace.step('Phase 1: Using legacy methods', 'Migration');
      structuredTrace.info('Processing with old style', 'LegacyModule');

      // Phase 2: Start introducing spans for new features
      await structuredTrace.withSpanAsync('NewFeature', async () => {
        structuredTrace.info('New feature with spans', 'ModernModule');
        
        await structuredTrace.withSpanAsync('SubFeature', async () => {
          // Still can use old logging inside spans
          structuredTrace.step('Hybrid approach', 'Migration');
        });
      });

      // Phase 3: Continue with legacy for existing code
      structuredTrace.success('Migration phase complete', 'LegacyModule');

      // Verify both systems coexist
      expect(structuredTrace.logs).toHaveLength(6);
      expect(structuredTrace.getSpans()).toHaveLength(2);

      // Performance summary includes span data
      const perfSummary = structuredTrace.getPerformanceSummary();
      expect(perfSummary.operationCount).toBe(2);
      expect(perfSummary.operationStats).toHaveProperty('NewFeature');
    });

    it('should handle complex scenarios with pipeline and mixed tracing', async () => {
      const structuredTrace = new StructuredTrace();

      // Traditional logging for pipeline setup
      structuredTrace.info('Setting up pipeline', 'PipelineManager');

      // Create pipeline with stages
      const stages = [
        new ComponentFilteringStage(
          mockActionIndex,
          mockErrorContextBuilder,
          mockLogger
        ),
      ];

      mockActionIndex.getCandidateActions.mockReturnValue([
        { id: 'action1', name: 'Test Action', prerequisites: [] }
      ]);

      const pipeline = new Pipeline(stages, mockLogger);

      // Execute pipeline with structured trace
      const result = await pipeline.execute({
        actor: { id: 'test_actor', components: {} },
        actionContext: { actorId: 'test_actor' },
        candidateActions: [],
        trace: structuredTrace,
      });

      // Add traditional logging after pipeline
      structuredTrace.success('Pipeline completed', 'PipelineManager');

      // Verify mixed usage
      expect(result.success).toBe(true);
      
      // Should have both logs and spans
      const logs = structuredTrace.logs.filter(log => 
        log.source === 'PipelineManager'
      );
      expect(logs).toHaveLength(2);

      const spans = structuredTrace.getSpans();
      expect(spans.some(s => s.operation === 'Pipeline')).toBe(true);
      expect(spans.some(s => s.operation === 'ComponentFilteringStage')).toBe(true);
    });
  });

  describe('Async Error Handling Edge Cases', () => {
    it('should preserve error status in withSpanAsync when nested operations fail', async () => {
      const structuredTrace = new StructuredTrace();

      await structuredTrace.withSpanAsync('ParentOperation', async () => {
        try {
          await structuredTrace.withSpanAsync('ChildOperation', async () => {
            // This sets the child span to error
            throw new Error('Child failed');
          });
        } catch (error) {
          // Parent catches but continues with other work
          await structuredTrace.withSpanAsync('RecoveryOperation', async () => {
            // Recovery succeeds
            await new Promise(resolve => setTimeout(resolve, 10));
          });
        }
      });

      const spans = structuredTrace.getSpans();
      
      // Parent should be success (it handled the error)
      expect(spans.find(s => s.operation === 'ParentOperation').status).toBe('success');
      
      // Child should remain error
      expect(spans.find(s => s.operation === 'ChildOperation').status).toBe('error');
      
      // Recovery should be success
      expect(spans.find(s => s.operation === 'RecoveryOperation').status).toBe('success');
    });

    it('should handle errors thrown after async operations in withSpanAsync', async () => {
      const structuredTrace = new StructuredTrace();

      try {
        await structuredTrace.withSpanAsync('AsyncWithSyncError', async () => {
          // Async operation succeeds
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // But then sync error is thrown
          throw new Error('Sync error after async');
        });
      } catch (error) {
        // Expected
      }

      const span = structuredTrace.getSpans()[0];
      expect(span.status).toBe('error');
      expect(span.error.message).toBe('Sync error after async');
    });
  });
});