import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import MemoryAnalyzer from '../../../../src/entities/monitoring/MemoryAnalyzer.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import * as dependencyUtils from '../../../../src/utils/dependencyUtils.js';

const MB = 1024 * 1024;

const buildSamples = (values, stepMs = 60_000) =>
  values.map((value, index) => ({
    timestamp: index * stepMs,
    heapUsed: value * MB,
  }));

describe('MemoryAnalyzer', () => {
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('validates dependencies and merges configuration defaults', () => {
      const validateSpy = jest.spyOn(dependencyUtils, 'validateDependency');
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 5, outlierThreshold: 1.1 }
      );

      expect(validateSpy).toHaveBeenCalledWith(logger, 'ILogger', console, {
        requiredMethods: ['info', 'error', 'warn', 'debug'],
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('MemoryAnalyzer initialized'),
        expect.objectContaining({
          minSamplesForAnalysis: 5,
          outlierThreshold: 1.1,
          patternConfidenceThreshold: 0.7,
        })
      );

      analyzer.destroy();
    });
  });

  describe('analyzeTrend', () => {
    it('throws when samples are missing', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 2 }
      );

      expect(() => analyzer.analyzeTrend(undefined)).toThrow('Memory samples');
    });

    it('reports insufficient data when below minimum sample count', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 5 }
      );
      const samples = buildSamples([100, 110, 120]);

      const result = analyzer.analyzeTrend(samples);

      expect(result).toEqual({
        trend: 'insufficient_data',
        slope: 0,
        rSquared: 0,
        volatility: 0,
        confidence: 0,
      });
    });

    it('treats non-progressing timestamps as a stable trend', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 2 }
      );
      const samples = [
        { timestamp: 1_000, heapUsed: 100 * MB },
        { timestamp: 1_000, heapUsed: 120 * MB },
      ];

      const result = analyzer.analyzeTrend(samples);

      expect(result.trend).toBe('stable');
      expect(result.slope).toBe(0);
      expect(result.confidence).toBe(0.5);
    });

    it('detects growing and shrinking trends with correct slope polarity', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 5 }
      );

      const growing = analyzer.analyzeTrend(
        buildSamples([100, 110, 120, 130, 140])
      );
      expect(growing.trend).toBe('growing');
      expect(growing.slope).toBeGreaterThan(0);
      expect(growing.rSquared).toBeGreaterThan(0.9);

      const shrinking = analyzer.analyzeTrend(
        buildSamples([140, 130, 120, 110, 100])
      );
      expect(shrinking.trend).toBe('shrinking');
      expect(shrinking.slope).toBeLessThan(0);
    });

    it('flags volatile series when variance dominates the slope', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 5 }
      );
      const noisySamples = buildSamples([100, 160, 40, 150, 50, 140, 60, 130]);

      const result = analyzer.analyzeTrend(noisySamples);

      expect(result.trend).toBe('volatile');
      expect(result.volatility).toBeGreaterThan(0);
    });
  });

  describe('detectPatterns', () => {
    it('returns an empty array when the dataset is too small', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 6 }
      );

      expect(analyzer.detectPatterns(buildSamples([100, 110, 120]))).toEqual(
        []
      );
    });

    it('skips pattern detection for stable memory usage', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 5 }
      );
      const patterns = analyzer.detectPatterns(
        buildSamples([120, 119, 121, 120, 119, 121])
      );

      expect(patterns).toEqual([]);
    });

    it('detects consistent linear growth', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 5 }
      );
      const patterns = analyzer.detectPatterns(
        buildSamples([100, 110, 120, 130, 140, 150])
      );

      expect(patterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'linear',
            characteristics: expect.any(Object),
          }),
        ])
      );
    });

    it('detects exponential growth after analysing the log-series', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 5 }
      );
      const originalAnalyze = analyzer.analyzeTrend.bind(analyzer);

      jest.spyOn(analyzer, 'analyzeTrend').mockImplementation((samples) => {
        if (samples.every((sample) => sample.heapUsed < 1_000)) {
          return {
            trend: 'growing',
            slope: 12,
            rSquared: 0.95,
            volatility: 0.1,
            confidence: 0.9,
          };
        }
        return originalAnalyze(samples);
      });

      const patterns = analyzer.detectPatterns(
        buildSamples([2, 4, 8, 16, 32, 64], 60_000)
      );

      expect(patterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'exponential',
            characteristics: expect.objectContaining({
              doublingTime: expect.any(Number),
            }),
          }),
        ])
      );
    });

    it('detects repeated step changes in memory usage', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 5, outlierThreshold: 0 }
      );
      const patterns = analyzer.detectPatterns(
        buildSamples([100, 101, 150, 151, 200, 201, 250, 251])
      );

      expect(patterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'step',
            characteristics: expect.any(Object),
          }),
        ])
      );
    });

    it('detects sawtooth patterns with regular peaks and valleys', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 5 }
      );
      const patterns = analyzer.detectPatterns(
        buildSamples([100, 150, 100, 150, 100, 150, 100, 150, 100])
      );

      expect(patterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'sawtooth',
            characteristics: expect.any(Object),
          }),
        ])
      );
    });
  });

  describe('generateReport', () => {
    it('returns guidance requesting more samples when insufficient data is provided', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 5 }
      );
      const report = analyzer.generateReport(buildSamples([100, 110]));

      expect(report).toEqual({
        trend: {
          trend: 'insufficient_data',
          slope: 0,
          rSquared: 0,
          volatility: 0,
          confidence: 0,
        },
        patterns: [],
        statistics: {
          sampleCount: 2,
          minRequired: 5,
        },
        recommendations: ['Collect more data samples for accurate analysis'],
        riskScore: 0,
      });
    });

    it('produces a comprehensive report with recommendations and a capped risk score', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 3 }
      );
      const trendSummary = {
        trend: 'growing',
        slope: 12,
        rSquared: 0.97,
        volatility: 4,
        confidence: 0.9,
      };
      const detectedPatterns = [
        {
          type: 'linear',
          severity: 3,
          description: 'linear',
          characteristics: {},
        },
        {
          type: 'exponential',
          severity: 5,
          description: 'exp',
          characteristics: {},
        },
        { type: 'step', severity: 4, description: 'step', characteristics: {} },
        {
          type: 'sawtooth',
          severity: 2,
          description: 'saw',
          characteristics: {},
        },
      ];

      jest.spyOn(analyzer, 'analyzeTrend').mockReturnValue(trendSummary);
      jest.spyOn(analyzer, 'detectPatterns').mockReturnValue(detectedPatterns);

      const report = analyzer.generateReport(
        buildSamples([100, 150, 200, 230, 250])
      );

      expect(report.trend).toBe(trendSummary);
      expect(report.patterns).toBe(detectedPatterns);
      expect(report.statistics).toEqual(
        expect.objectContaining({
          sampleCount: 5,
          timeSpan: 4,
          minHeap: 100 * MB,
          maxHeap: 250 * MB,
          currentHeap: 250 * MB,
        })
      );
      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          'URGENT: Rapid memory growth detected. Investigate immediately.',
          'Implement periodic memory cleanup or resource pooling.',
          'Critical: Exponential growth indicates severe leak. Immediate action required.',
          'Investigate operations causing memory jumps. Consider caching strategy.',
          'GC cycles detected. Consider tuning garbage collection parameters.',
          'Memory has more than doubled. Review resource management.',
          'Extend monitoring period for more accurate analysis.',
        ])
      );
      expect(report.riskScore).toBe(100);
    });

    it('includes monitoring guidance for moderate growth without escalation', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 3 }
      );
      jest.spyOn(analyzer, 'analyzeTrend').mockReturnValue({
        trend: 'growing',
        slope: 7,
        rSquared: 0.82,
        volatility: 3,
        confidence: 0.6,
      });
      jest.spyOn(analyzer, 'detectPatterns').mockReturnValue([]);

      const report = analyzer.generateReport(
        buildSamples([100, 130, 160, 190], 600_000)
      );

      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          'Monitor closely: Steady memory growth detected.',
        ])
      );
      expect(report.recommendations).not.toEqual(
        expect.arrayContaining([
          'URGENT: Rapid memory growth detected. Investigate immediately.',
          'Minor memory growth detected. Schedule investigation.',
          'Memory has more than doubled. Review resource management.',
          'Extend monitoring period for more accurate analysis.',
        ])
      );
      expect(report.riskScore).toBeGreaterThan(0);
    });

    it('flags minor growth and volatile trends with stable recommendations', () => {
      const analyzer = new MemoryAnalyzer(
        { logger },
        { minSamplesForAnalysis: 3 }
      );
      const trendSpy = jest
        .spyOn(analyzer, 'analyzeTrend')
        .mockReturnValueOnce({
          trend: 'growing',
          slope: 3,
          rSquared: 0.75,
          volatility: 2,
          confidence: 0.5,
        })
        .mockReturnValueOnce({
          trend: 'volatile',
          slope: 0,
          rSquared: 0.1,
          volatility: 40,
          confidence: 0.2,
        });
      jest
        .spyOn(analyzer, 'detectPatterns')
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const minorGrowthReport = analyzer.generateReport(
        buildSamples([100, 110, 115, 118], 600_000)
      );
      expect(minorGrowthReport.recommendations).toEqual(
        expect.arrayContaining([
          'Minor memory growth detected. Schedule investigation.',
        ])
      );

      const volatileReport = analyzer.generateReport(
        buildSamples([120, 120, 120, 120], 600_000)
      );
      expect(trendSpy).toHaveBeenCalledTimes(2);
      expect(volatileReport.recommendations).toEqual([
        'Memory usage appears stable.',
      ]);
      expect(volatileReport.riskScore).toBe(20);
    });
  });

  describe('lifecycle helpers', () => {
    it('clears the internal cache and logs a debug entry', () => {
      const analyzer = new MemoryAnalyzer({ logger });

      analyzer.clearCache();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Analysis cache cleared')
      );
    });

    it('destroys the analyzer by clearing cached data and logging cleanup', () => {
      const analyzer = new MemoryAnalyzer({ logger });
      const clearSpy = jest.spyOn(analyzer, 'clearCache');

      analyzer.destroy();

      expect(clearSpy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenLastCalledWith(
        expect.stringContaining('MemoryAnalyzer destroyed')
      );
    });
  });
});
