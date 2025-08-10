import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';

describe('ActionExecutionTrace', () => {
  let trace;

  const validParams = {
    actionId: 'core:go',
    actorId: 'player-1',
    turnAction: {
      actionDefinitionId: 'core:go',
      commandString: 'go north',
      parameters: { direction: 'north' },
    },
  };

  beforeEach(() => {
    trace = new ActionExecutionTrace(validParams);
  });

  describe('Constructor', () => {
    it('should create trace with valid parameters', () => {
      expect(trace.actionId).toBe('core:go');
      expect(trace.actorId).toBe('player-1');
      expect(trace.isComplete).toBe(false);
      expect(trace.hasError).toBe(false);
    });

    it('should throw error for invalid actionId', () => {
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            actionId: null,
          })
      ).toThrow('ActionExecutionTrace requires valid actionId string');
    });

    it('should throw error for invalid actorId', () => {
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            actorId: '',
          })
      ).toThrow('ActionExecutionTrace requires valid actorId string');
    });

    it('should throw error for invalid turnAction', () => {
      expect(
        () =>
          new ActionExecutionTrace({
            ...validParams,
            turnAction: null,
          })
      ).toThrow('ActionExecutionTrace requires valid turnAction object');
    });
  });

  describe('Execution Lifecycle', () => {
    it('should capture dispatch start correctly', () => {
      trace.captureDispatchStart();

      expect(trace.isComplete).toBe(false);
      const phases = trace.getExecutionPhases();
      expect(phases).toHaveLength(1);
      expect(phases[0].phase).toBe('dispatch_start');
      expect(typeof phases[0].timestamp).toBe('number');
    });

    it('should prevent multiple dispatch starts', () => {
      trace.captureDispatchStart();

      expect(() => trace.captureDispatchStart()).toThrow(
        'Dispatch already started for this trace'
      );
    });

    it('should capture event payload after start', () => {
      trace.captureDispatchStart();

      const payload = {
        actor: 'player-1',
        action: 'core:go',
        password: 'secret123', // Will be sanitized
      };

      trace.captureEventPayload(payload);

      const traceData = trace.toJSON();
      expect(traceData.eventPayload.password).toBe('[REDACTED]');
      expect(traceData.eventPayload.actor).toBe('player-1');
    });

    it('should require dispatch start before payload capture', () => {
      const payload = { actor: 'player-1' };

      expect(() => trace.captureEventPayload(payload)).toThrow(
        'Must call captureDispatchStart() before capturing payload'
      );
    });

    it('should capture dispatch result and complete execution', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({
        success: true,
        metadata: { duration: 100 },
      });

      expect(trace.isComplete).toBe(true);
      expect(trace.hasError).toBe(false);
      expect(typeof trace.duration).toBe('number');
      expect(trace.duration).toBeGreaterThan(0);
    });

    it('should capture error information', () => {
      trace.captureDispatchStart();

      const error = new Error('Test error');
      trace.captureError(error);

      expect(trace.isComplete).toBe(true);
      expect(trace.hasError).toBe(true);

      const traceData = trace.toJSON();
      expect(traceData.error.message).toBe('Test error');
      expect(traceData.error.type).toBe('Error');
      expect(traceData.error.stack).toBeTruthy();
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize to valid JSON structure', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const json = trace.toJSON();

      expect(json).toHaveProperty('metadata');
      expect(json).toHaveProperty('turnAction');
      expect(json).toHaveProperty('execution');
      expect(json.metadata.actionId).toBe('core:go');
      expect(json.metadata.traceType).toBe('execution');
      expect(json.execution.status).toBe('success');
    });

    it('should include execution phases in JSON', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const json = trace.toJSON();
      const phases = json.execution.phases;

      expect(Array.isArray(phases)).toBe(true);
      expect(phases.length).toBeGreaterThan(0);
      expect(phases[0]).toHaveProperty('phase');
      expect(phases[0]).toHaveProperty('timestamp');
      expect(phases[0]).toHaveProperty('description');
    });
  });

  describe('Summary Generation', () => {
    it('should generate human-readable summary', () => {
      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const summary = trace.toSummary();

      expect(summary).toContain('core:go');
      expect(summary).toContain('player-1');
      expect(summary).toContain('success');
      expect(summary).toContain('ms');
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize sensitive fields in payloads', () => {
      trace.captureDispatchStart();

      const sensitivePayload = {
        username: 'player1',
        password: 'secret123',
        apiKey: 'key123',
        token: 'bearer-token',
        normalData: 'safe',
      };

      trace.captureEventPayload(sensitivePayload);
      const json = trace.toJSON();

      expect(json.eventPayload.password).toBe('[REDACTED]');
      expect(json.eventPayload.apiKey).toBe('[REDACTED]');
      expect(json.eventPayload.token).toBe('[REDACTED]');
      expect(json.eventPayload.normalData).toBe('safe');
      expect(json.eventPayload.username).toBe('player1');
    });

    it('should handle nested object sanitization', () => {
      trace.captureDispatchStart();

      const nestedPayload = {
        user: {
          name: 'player1',
          credentials: {
            password: 'secret',
            token: 'bearer',
          },
        },
        metadata: { safe: true },
      };

      trace.captureEventPayload(nestedPayload);
      const json = trace.toJSON();

      expect(json.eventPayload.user.credentials.password).toBe('[REDACTED]');
      expect(json.eventPayload.user.credentials.token).toBe('[REDACTED]');
      expect(json.eventPayload.user.name).toBe('player1');
      expect(json.eventPayload.metadata.safe).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should create traces quickly', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        new ActionExecutionTrace({
          actionId: 'core:test',
          actorId: `actor-${i}`,
          turnAction: { actionDefinitionId: 'core:test' },
        });
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // 1000 traces in <100ms
    });

    it('should serialize efficiently', () => {
      const trace = new ActionExecutionTrace({
        actionId: 'core:test',
        actorId: 'player-1',
        turnAction: { actionDefinitionId: 'core:test' },
      });

      trace.captureDispatchStart();
      trace.captureDispatchResult({ success: true });

      const startTime = performance.now();
      const json = trace.toJSON();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1); // Serialization in <1ms
      expect(JSON.stringify(json).length).toBeGreaterThan(0);
    });
  });
});
