/**
 * @file Tracer Memory Tests
 * @description Memory leak tests for scope tracing to ensure repeated usage
 * cleans up resources correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ScopeTracingTestBed } from '../../common/scopeDsl/scopeTracingTestBed.js';

describe('Tracer Memory Usage', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await ScopeTracingTestBed.create();

    // Register scope for tracing
    await testBed.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should not leak memory with repeated tracing', () => {
    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.enableScopeTracing();

    // Run many iterations with clear between
    for (let i = 0; i < 1000; i++) {
      testBed.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );
      testBed.clearScopeTrace();
    }

    // Verify trace is cleared and no memory growth
    const trace = testBed.getScopeTraceData();
    expect(trace.steps.length).toBe(0);
  });
});
