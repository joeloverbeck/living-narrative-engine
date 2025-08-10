import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionExecutionTraceFactory } from '../../../../src/actions/tracing/actionExecutionTraceFactory.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('ActionExecutionTrace Integration', () => {
  let traceFactory;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    traceFactory = new ActionExecutionTraceFactory({ logger: mockLogger });
  });

  it('should integrate with CommandProcessor workflow', async () => {
    // Simulate CommandProcessor workflow
    const turnAction = {
      actionDefinitionId: 'core:go',
      commandString: 'go north',
      parameters: { direction: 'north' },
    };

    // Create trace
    const trace = traceFactory.createFromTurnAction(turnAction, 'player-1');

    // Simulate execution flow
    trace.captureDispatchStart();

    // Simulate event creation and dispatch
    const eventPayload = {
      eventType: 'ATTEMPT_ACTION_ID',
      actor: 'player-1',
      action: turnAction,
      timestamp: Date.now(),
    };

    trace.captureEventPayload(eventPayload);

    // Simulate successful dispatch
    await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate async work
    trace.captureDispatchResult({ success: true, timestamp: Date.now() });

    // Verify trace completeness
    expect(trace.isComplete).toBe(true);
    expect(trace.hasError).toBe(false);
    expect(trace.duration).toBeGreaterThan(0);

    // Verify JSON output is complete and valid
    const traceData = trace.toJSON();
    expect(traceData.metadata.actionId).toBe('core:go');
    expect(traceData.execution.status).toBe('success');
    expect(traceData.eventPayload.eventType).toBe('ATTEMPT_ACTION_ID');
    expect(traceData.execution.phases.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle error scenarios gracefully', async () => {
    const turnAction = {
      actionDefinitionId: 'core:invalid',
      commandString: 'invalid command',
    };

    const trace = traceFactory.createFromTurnAction(turnAction, 'player-1');
    trace.captureDispatchStart();

    // Simulate dispatch error
    const dispatchError = new Error('Dispatch failed');
    dispatchError.code = 'DISPATCH_ERROR';

    trace.captureError(dispatchError);

    // Verify error handling
    expect(trace.isComplete).toBe(true);
    expect(trace.hasError).toBe(true);

    const traceData = trace.toJSON();
    expect(traceData.error.message).toBe('Dispatch failed');
    expect(traceData.error.code).toBe('DISPATCH_ERROR');
    expect(traceData.execution.status).toBe('error');
  });

  it('should validate turn action structure properly', () => {
    // Test missing actionDefinitionId
    expect(() => {
      traceFactory.createFromTurnAction({}, 'player-1');
    }).toThrow('Turn action missing actionDefinitionId');

    // Test invalid actorId
    expect(() => {
      traceFactory.createFromTurnAction(
        { actionDefinitionId: 'core:test' },
        ''
      );
    }).toThrow();

    // Test valid creation
    const trace = traceFactory.createFromTurnAction(
      { actionDefinitionId: 'core:test', commandString: 'test' },
      'player-1'
    );
    expect(trace).toBeDefined();
    expect(trace.actionId).toBe('core:test');
  });

  it('should handle complex payloads with sensitive data', () => {
    const complexPayload = {
      actor: {
        id: 'player-1',
        auth: {
          token: 'bearer-token',
          password: 'secret',
        },
      },
      action: {
        type: 'secure-action',
        apiKey: 'api-key-123',
      },
      metadata: {
        timestamp: Date.now(),
        normal: 'data',
      },
    };

    const trace = traceFactory.createTrace({
      actionId: 'core:secure',
      actorId: 'player-1',
      turnAction: { actionDefinitionId: 'core:secure' },
    });

    trace.captureDispatchStart();
    trace.captureEventPayload(complexPayload);

    const json = trace.toJSON();

    // Verify sensitive data is redacted
    expect(json.eventPayload.actor.auth.token).toBe('[REDACTED]');
    expect(json.eventPayload.actor.auth.password).toBe('[REDACTED]');
    expect(json.eventPayload.action.apiKey).toBe('[REDACTED]');

    // Verify normal data is preserved
    expect(json.eventPayload.metadata.normal).toBe('data');
    expect(json.eventPayload.actor.id).toBe('player-1');
  });

  it('should track execution phases accurately', () => {
    const trace = traceFactory.createTrace({
      actionId: 'core:phased',
      actorId: 'player-1',
      turnAction: { actionDefinitionId: 'core:phased' },
    });

    // Execute all phases
    trace.captureDispatchStart();
    trace.captureEventPayload({ test: 'payload' });
    trace.captureDispatchResult({ success: true });

    const phases = trace.getExecutionPhases();

    expect(phases).toHaveLength(3);
    expect(phases[0].phase).toBe('dispatch_start');
    expect(phases[1].phase).toBe('payload_captured');
    expect(phases[2].phase).toBe('dispatch_completed');

    // Verify phases are in chronological order
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i].timestamp).toBeGreaterThanOrEqual(
        phases[i - 1].timestamp
      );
    }
  });
});
