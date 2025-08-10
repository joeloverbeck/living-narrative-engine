import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ExecutionPhaseTimer } from '../../../../../src/actions/tracing/timing/executionPhaseTimer.js';

describe('ExecutionPhaseTimer', () => {
  let timer;

  beforeEach(() => {
    timer = new ExecutionPhaseTimer();
  });

  describe('Execution Lifecycle', () => {
    it('should track complete execution lifecycle', () => {
      timer.startExecution('test_execution');
      expect(timer.isActive()).toBe(true);

      timer.startPhase('phase1');
      timer.endPhase('phase1');

      timer.startPhase('phase2');
      timer.addMarker('checkpoint1');
      timer.endPhase('phase2');

      timer.endExecution();
      expect(timer.isActive()).toBe(false);

      const summary = timer.getSummary();
      expect(summary.isComplete).toBe(true);
      expect(summary.phaseCount).toBe(2);
      expect(summary.totalDuration).toBeGreaterThan(0);
    });

    it('should handle phase transitions correctly', () => {
      timer.startExecution();

      timer.startPhase('phase1');
      timer.startPhase('phase2'); // Should auto-end phase1

      const phase1Data = timer.getPhaseData('phase1');
      const phase2Data = timer.getPhaseData('phase2');

      expect(phase1Data.endTime).toBeTruthy();
      expect(phase1Data.duration).toBeGreaterThan(0);
      expect(phase2Data.startTime).toBeTruthy();
      expect(phase2Data.endTime).toBeNull();
    });

    it('should calculate total duration correctly', () => {
      timer.startExecution();

      // Add small delay
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }

      timer.endExecution();

      const totalDuration = timer.getTotalDuration();
      expect(totalDuration).toBeGreaterThan(0);
      expect(totalDuration).toBeLessThan(100); // Should be fast
    });
  });

  describe('Phase Data Management', () => {
    it('should track phase metadata', () => {
      timer.startExecution();
      timer.startPhase('test_phase', {
        operation: 'database_query',
        complexity: 'high',
      });

      const phaseData = timer.getPhaseData('test_phase');
      expect(phaseData.metadata.operation).toBe('database_query');
      expect(phaseData.metadata.complexity).toBe('high');
    });

    it('should track markers within phases', () => {
      timer.startExecution();
      timer.startPhase('test_phase');
      timer.addMarker('checkpoint1', 'test_phase', { step: 'validation' });
      timer.addMarker('checkpoint2', 'test_phase', { step: 'processing' });
      timer.endPhase('test_phase');

      const phaseData = timer.getPhaseData('test_phase');
      expect(phaseData.markers.length).toBeGreaterThanOrEqual(3); // start, checkpoint1, checkpoint2, end

      const checkpointMarkers = phaseData.markers.filter(
        (m) => m.label === 'checkpoint1' || m.label === 'checkpoint2'
      );
      expect(checkpointMarkers.length).toBe(2);
    });

    it('should return null for non-existent phase', () => {
      const phaseData = timer.getPhaseData('non_existent');
      expect(phaseData).toBeNull();
    });

    it('should get all phases data', () => {
      timer.startExecution();
      timer.startPhase('phase1');
      timer.endPhase('phase1');
      timer.startPhase('phase2');
      timer.endPhase('phase2');
      timer.endExecution();

      const allPhases = timer.getAllPhases();
      expect(allPhases.length).toBe(2);
      expect(allPhases.map((p) => p.name)).toEqual(['phase1', 'phase2']);
    });
  });

  describe('Performance Analysis', () => {
    it('should generate performance summary', () => {
      timer.startExecution();
      timer.startPhase('fast_phase');
      timer.endPhase('fast_phase');

      timer.startPhase('slow_phase');
      // Simulate some work
      let sum = 0;
      for (let i = 0; i < 100000; i++) {
        sum += i;
      }
      timer.endPhase('slow_phase');

      timer.endExecution();

      const summary = timer.getSummary();
      expect(summary.phases.length).toBe(2);

      const slowPhase = summary.phases.find((p) => p.name === 'slow_phase');
      const fastPhase = summary.phases.find((p) => p.name === 'fast_phase');

      expect(slowPhase.duration).toBeGreaterThan(fastPhase.duration);
      expect(slowPhase.percentage).toBeTruthy();
      expect(parseFloat(slowPhase.percentage)).toBeGreaterThan(0);
    });

    it('should create human-readable reports', () => {
      timer.startExecution();
      timer.startPhase('test_phase');
      timer.endPhase('test_phase');
      timer.endExecution();

      const report = timer.createReport();
      expect(report).toContain('EXECUTION TIMING REPORT');
      expect(report).toContain('Total Duration:');
      expect(report).toContain('test_phase');
    });

    it('should handle incomplete timing reports', () => {
      timer.startExecution();
      timer.startPhase('incomplete_phase');
      // Don't end execution

      const report = timer.createReport();
      expect(report).toBe('Execution timing not complete');
    });

    it('should export timing data for serialization', () => {
      timer.startExecution();
      timer.startPhase('test_phase');
      timer.addMarker('test_marker');
      timer.endPhase('test_phase');
      timer.endExecution();

      const exportData = timer.exportTimingData();

      expect(exportData.summary).toBeTruthy();
      expect(exportData.phases).toBeTruthy();
      expect(exportData.markers).toBeTruthy();
      expect(exportData.precision).toBeTruthy();
      expect(exportData.phases.test_phase).toBeTruthy();
      expect(exportData.markers.test_marker).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when starting phase before execution', () => {
      expect(() => {
        timer.startPhase('invalid_phase');
      }).toThrow('Must start execution before starting phases');
    });

    it('should throw error when ending non-existent phase', () => {
      timer.startExecution();
      expect(() => {
        timer.endPhase('non_existent_phase');
      }).toThrow("Phase 'non_existent_phase' was not started");
    });

    it('should throw error when starting execution twice', () => {
      timer.startExecution();
      expect(() => {
        timer.startExecution();
      }).toThrow('Execution timing already started');
    });

    it('should throw error when ending execution twice', () => {
      timer.startExecution();
      timer.endExecution();
      expect(() => {
        timer.endExecution();
      }).toThrow('Execution timing already ended');
    });

    it('should throw error when ending phase twice', () => {
      timer.startExecution();
      timer.startPhase('test_phase');
      timer.endPhase('test_phase');
      expect(() => {
        timer.endPhase('test_phase');
      }).toThrow("Phase 'test_phase' already ended");
    });

    it('should throw error when adding marker without active phase', () => {
      timer.startExecution();
      expect(() => {
        timer.addMarker('test_marker');
      }).toThrow('No active phase and no phase specified for marker');
    });

    it('should throw error when ending execution before starting', () => {
      expect(() => {
        timer.endExecution();
      }).toThrow('Execution timing was not started');
    });
  });

  describe('Reset and State Management', () => {
    it('should reset all timing data', () => {
      timer.startExecution();
      timer.startPhase('test_phase');
      timer.addMarker('test_marker');
      timer.endPhase('test_phase');
      timer.endExecution();

      timer.reset();

      expect(timer.isActive()).toBe(false);
      expect(timer.getTotalDuration()).toBeNull();
      expect(timer.getAllPhases().length).toBe(0);
      expect(timer.getPhaseData('test_phase')).toBeNull();
    });

    it('should track active state correctly', () => {
      expect(timer.isActive()).toBe(false);

      timer.startExecution();
      expect(timer.isActive()).toBe(true);

      timer.endExecution();
      expect(timer.isActive()).toBe(false);
    });
  });

  describe('Marker Management', () => {
    it('should add markers to current active phase', () => {
      timer.startExecution();
      timer.startPhase('active_phase');
      timer.addMarker('auto_marker');

      const phaseData = timer.getPhaseData('active_phase');
      const autoMarkers = phaseData.markers.filter((m) => m.label === 'auto_marker');
      expect(autoMarkers.length).toBe(1);
      expect(autoMarkers[0].phase).toBe('active_phase');
    });

    it('should add markers to specified phase', () => {
      timer.startExecution();
      timer.startPhase('phase1');
      timer.startPhase('phase2');
      timer.addMarker('explicit_marker', 'phase1');

      const phase1Data = timer.getPhaseData('phase1');
      const explicitMarkers = phase1Data.markers.filter((m) => m.label === 'explicit_marker');
      expect(explicitMarkers.length).toBe(1);
      expect(explicitMarkers[0].phase).toBe('phase1');
    });
  });
});