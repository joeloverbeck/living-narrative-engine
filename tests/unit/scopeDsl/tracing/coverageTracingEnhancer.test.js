/**
 * @file Unit tests for CoverageTracingEnhancer
 * @see ../../../../src/scopeDsl/tracing/coverageTracingEnhancer.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CoverageTracingEnhancer } from '../../../../src/scopeDsl/tracing/coverageTracingEnhancer.js';

describe('CoverageTracingEnhancer', () => {
  let enhancer;
  let mockStructuredTraceFactory;
  let mockPerformanceMonitor;
  let mockTraceFormatter;
  let mockLogger;
  let mockStructuredTrace;
  let mockSpan;

  beforeEach(() => {
    // Mock structured trace and span
    mockSpan = {
      id: 'span-1',
      addAttributes: jest.fn(),
      addEvent: jest.fn(),
      setStatus: jest.fn(),
      recordError: jest.fn()
    };

    mockStructuredTrace = {
      startSpan: jest.fn().mockReturnValue(mockSpan),
      endSpan: jest.fn(),
      getActiveSpan: jest.fn().mockReturnValue(mockSpan),
      getSpans: jest.fn().mockReturnValue([])
    };

    mockStructuredTraceFactory = {
      create: jest.fn().mockReturnValue(mockStructuredTrace)
    };

    mockPerformanceMonitor = {
      startMeasurement: jest.fn().mockReturnValue('measurement-1'),
      endMeasurement: jest.fn().mockReturnValue(42),
      recordMetrics: jest.fn()
    };

    mockTraceFormatter = {
      formatCoverageTrace: jest.fn().mockReturnValue('formatted trace output')
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    enhancer = new CoverageTracingEnhancer({
      structuredTraceFactory: mockStructuredTraceFactory,
      performanceMonitor: mockPerformanceMonitor,
      traceFormatter: mockTraceFormatter,
      logger: mockLogger
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(enhancer).toBeDefined();
      expect(mockLogger.debug).not.toHaveBeenCalled(); // No debug logging during construction
    });

    it('should validate required dependencies', () => {
      expect(() => {
        new CoverageTracingEnhancer({
          structuredTraceFactory: null,
          performanceMonitor: mockPerformanceMonitor,
          traceFormatter: mockTraceFormatter,
          logger: mockLogger
        });
      }).toThrow();
    });

    it('should validate structured trace factory methods', () => {
      expect(() => {
        new CoverageTracingEnhancer({
          structuredTraceFactory: { /* missing create method */ },
          performanceMonitor: mockPerformanceMonitor,
          traceFormatter: mockTraceFormatter,
          logger: mockLogger
        });
      }).toThrow();
    });
  });

  describe('enhanceSlotAccessResolver', () => {
    let mockSlotAccessResolver;
    let mockConfig;

    beforeEach(() => {
      mockSlotAccessResolver = {
        canResolve: jest.fn().mockReturnValue(true),
        resolve: jest.fn().mockReturnValue(new Set(['item1']))
      };

      mockConfig = {
        scopeDslTracing: {
          coverageResolution: {
            enabled: true,
            verbosity: 'standard'
          }
        }
      };
    });

    it('should return unmodified resolver when tracing disabled', () => {
      const disabledConfig = {
        scopeDslTracing: {
          coverageResolution: {
            enabled: false
          }
        }
      };

      const result = enhancer.enhanceSlotAccessResolver(mockSlotAccessResolver, disabledConfig);
      
      expect(result).toBe(mockSlotAccessResolver);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Coverage resolution tracing disabled, returning unmodified resolver'
      );
    });

    it('should return enhanced resolver when tracing enabled', () => {
      const result = enhancer.enhanceSlotAccessResolver(mockSlotAccessResolver, mockConfig);
      
      expect(result).not.toBe(mockSlotAccessResolver);
      expect(result.canResolve).toBeDefined();
      expect(result.resolve).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Enhancing SlotAccessResolver with structured tracing capabilities'
      );
    });

    it('should preserve canResolve method', () => {
      const result = enhancer.enhanceSlotAccessResolver(mockSlotAccessResolver, mockConfig);
      
      result.canResolve('test-node');
      
      expect(mockSlotAccessResolver.canResolve).toHaveBeenCalledWith('test-node');
    });

    it('should enhance resolve method with structured tracing', () => {
      const result = enhancer.enhanceSlotAccessResolver(mockSlotAccessResolver, mockConfig);
      
      const mockNode = {
        type: 'Step',
        field: 'torso_upper',
        parent: {
          type: 'Step',
          field: 'topmost_clothing'
        }
      };
      
      const mockCtx = {
        trace: { addLog: jest.fn() }
      };
      
      result.resolve(mockNode, mockCtx);
      
      expect(mockCtx.structuredTrace).toBeDefined();
      expect(mockCtx.performanceMonitor).toBeDefined();
      expect(mockCtx.coverageTraceFormatter).toBeDefined();
    });

    it('should validate slot access resolver dependencies', () => {
      expect(() => {
        enhancer.enhanceSlotAccessResolver(null, mockConfig);
      }).toThrow();
    });
  });

  describe('tracing wrapper functionality', () => {
    let enhancedResolver;
    let mockConfig;

    beforeEach(() => {
      const mockSlotAccessResolver = {
        canResolve: jest.fn().mockReturnValue(true),
        resolve: jest.fn().mockReturnValue(new Set(['item1']))
      };

      mockConfig = {
        scopeDslTracing: {
          coverageResolution: {
            enabled: true,
            verbosity: 'standard'
          }
        }
      };

      enhancedResolver = enhancer.enhanceSlotAccessResolver(mockSlotAccessResolver, mockConfig);
    });

    it('should add structured trace to context when not present', () => {
      const mockNode = {
        type: 'Step',
        field: 'torso_upper',
        parent: {
          type: 'Step',
          field: 'topmost_clothing'
        }
      };
      
      const mockCtx = {};
      
      enhancedResolver.resolve(mockNode, mockCtx);
      
      expect(mockCtx.structuredTrace).toBe(mockStructuredTrace);
      expect(mockCtx.performanceMonitor).toBe(mockPerformanceMonitor);
      expect(mockCtx.coverageTraceFormatter).toBe(mockTraceFormatter);
    });

    it('should use existing structured trace when present', () => {
      const existingTrace = { existing: true };
      const mockNode = {
        type: 'Step',
        field: 'torso_upper',
        parent: {
          type: 'Step',
          field: 'topmost_clothing'
        }
      };
      
      const mockCtx = {
        structuredTrace: existingTrace
      };
      
      enhancedResolver.resolve(mockNode, mockCtx);
      
      expect(mockCtx.structuredTrace).toBe(existingTrace);
    });

    it('should trace clothing slot access nodes', () => {
      const clothingNode = {
        type: 'Step',
        field: 'torso_upper',
        parent: {
          type: 'Step',
          field: 'topmost_clothing'
        }
      };
      
      const mockCtx = {};
      
      enhancedResolver.resolve(clothingNode, mockCtx);
      
      expect(mockStructuredTrace.startSpan).toHaveBeenCalledWith('coverage_resolution', expect.objectContaining({
        targetSlot: 'torso_upper',
        nodeType: 'Step',
        parentField: 'topmost_clothing'
      }));
    });

    it('should not trace non-clothing nodes', () => {
      const nonClothingNode = {
        type: 'Step',
        field: 'name',
        parent: {
          type: 'Step',
          field: 'actor'
        }
      };
      
      const mockCtx = {};
      
      enhancedResolver.resolve(nonClothingNode, mockCtx);
      
      expect(mockStructuredTrace.startSpan).not.toHaveBeenCalled();
    });

    it('should handle successful resolution', () => {
      const mockNode = {
        type: 'Step',
        field: 'torso_upper',
        parent: {
          type: 'Step',
          field: 'topmost_clothing'
        }
      };
      
      const mockCtx = {};
      
      const result = enhancedResolver.resolve(mockNode, mockCtx);
      
      expect(result).toEqual(new Set(['item1']));
      expect(mockSpan.addAttributes).toHaveBeenCalledWith(expect.objectContaining({
        resultCount: 1,
        success: true
      }));
      expect(mockSpan.setStatus).toHaveBeenCalledWith('success');
      expect(mockStructuredTrace.endSpan).toHaveBeenCalledWith(mockSpan);
    });

    it('should handle resolution errors', () => {
      const mockSlotAccessResolver = {
        canResolve: jest.fn().mockReturnValue(true),
        resolve: jest.fn().mockImplementation(() => {
          throw new Error('Resolution failed');
        })
      };

      const errorEnhancedResolver = enhancer.enhanceSlotAccessResolver(mockSlotAccessResolver, mockConfig);

      const mockNode = {
        type: 'Step',
        field: 'torso_upper',
        parent: {
          type: 'Step',
          field: 'topmost_clothing'
        }
      };
      
      const mockCtx = {};
      
      expect(() => {
        errorEnhancedResolver.resolve(mockNode, mockCtx);
      }).toThrow('Resolution failed');

      expect(mockSpan.recordError).toHaveBeenCalled();
      expect(mockSpan.addAttributes).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Resolution failed',
        errorType: 'Error'
      }));
      expect(mockStructuredTrace.endSpan).toHaveBeenCalledWith(mockSpan);
    });
  });

  describe('createPerformanceMonitoring', () => {
    it('should create performance monitoring utilities', () => {
      const mockCtx = {
        performanceMonitor: mockPerformanceMonitor
      };

      const perfUtils = enhancer.createPerformanceMonitoring(mockCtx);

      expect(perfUtils.markPhaseStart).toBeDefined();
      expect(perfUtils.markPhaseEnd).toBeDefined();
      expect(perfUtils.getMetrics).toBeDefined();
    });

    it('should handle missing performance monitor', () => {
      const mockCtx = {};

      const perfUtils = enhancer.createPerformanceMonitoring(mockCtx);

      // Should return no-op functions
      expect(perfUtils.markPhaseStart()).toBeUndefined();
      expect(perfUtils.markPhaseEnd()).toBe(0);
      expect(perfUtils.getMetrics()).toEqual({});
    });

    it('should track phase performance', () => {
      const mockCtx = {
        performanceMonitor: mockPerformanceMonitor
      };

      const perfUtils = enhancer.createPerformanceMonitoring(mockCtx);
      const marker = perfUtils.markPhaseStart('candidate_collection');
      const duration = perfUtils.markPhaseEnd('candidate_collection', marker, { extra: 'data' });

      expect(mockPerformanceMonitor.startMeasurement).toHaveBeenCalledWith('coverage_candidate_collection');
      expect(mockPerformanceMonitor.endMeasurement).toHaveBeenCalledWith(marker);
      expect(mockPerformanceMonitor.recordMetrics).toHaveBeenCalledWith({
        coverage_candidate_collection_duration: 42,
        extra: 'data'
      });
      expect(duration).toBe(42);
    });
  });

  describe('createTraceEventHelper', () => {
    it('should create trace event helper', () => {
      const eventHelper = enhancer.createTraceEventHelper(mockSpan, 'candidate_collection');

      expect(eventHelper.logCandidateFound).toBeDefined();
      expect(eventHelper.logCandidateFiltered).toBeDefined();
      expect(eventHelper.logSelection).toBeDefined();
      expect(eventHelper.logPhaseComplete).toBeDefined();
    });

    it('should validate phase name parameter', () => {
      expect(() => {
        enhancer.createTraceEventHelper(mockSpan, '');
      }).toThrow();

      expect(() => {
        enhancer.createTraceEventHelper(mockSpan, null);
      }).toThrow();
    });

    it('should log candidate found events', () => {
      const eventHelper = enhancer.createTraceEventHelper(mockSpan, 'candidate_collection');
      
      eventHelper.logCandidateFound('item1', 'outer', 100);

      expect(mockSpan.addEvent).toHaveBeenCalledWith('candidate_found', {
        phase: 'candidate_collection',
        itemId: 'item1',
        layer: 'outer',
        priority: 100
      });
    });

    it('should log candidate filtered events', () => {
      const eventHelper = enhancer.createTraceEventHelper(mockSpan, 'mode_filtering');
      
      eventHelper.logCandidateFiltered('item1', 'mode_mismatch');

      expect(mockSpan.addEvent).toHaveBeenCalledWith('candidate_filtered', {
        phase: 'mode_filtering',
        itemId: 'item1',
        reason: 'mode_mismatch'
      });
    });

    it('should log selection events', () => {
      const eventHelper = enhancer.createTraceEventHelper(mockSpan, 'final_selection');
      
      eventHelper.logSelection('item1', 'highest_priority', 3);

      expect(mockSpan.addEvent).toHaveBeenCalledWith('selection_made', {
        phase: 'final_selection',
        selectedItem: 'item1',
        reason: 'highest_priority',
        totalCandidates: 3
      });
    });

    it('should handle missing parameters gracefully', () => {
      const eventHelper = enhancer.createTraceEventHelper(mockSpan, 'test_phase');
      
      eventHelper.logCandidateFound(null, undefined, 0);

      expect(mockSpan.addEvent).toHaveBeenCalledWith('candidate_found', {
        phase: 'test_phase',
        itemId: 'unknown',
        layer: 'unknown',
        priority: 0
      });
    });
  });
});