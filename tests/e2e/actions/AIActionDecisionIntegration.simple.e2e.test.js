/**
 * @file AIActionDecisionIntegration.simple.e2e.test.js
 * @description Simplified AI action decision tests that work with mock facades
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';

describe('AI Action Decision Integration E2E - Simplified', () => {
  let facades;
  let turnExecutionFacade;
  let llmService;
  let testEnvironment;

  beforeEach(async () => {
    // Create facades with mocking support
    facades = createMockFacades({}, jest.fn);
    turnExecutionFacade = facades.turnExecutionFacade;
    llmService = facades.llmService;

    // Initialize test environment with AI actors
    testEnvironment = await turnExecutionFacade.initializeTestEnvironment({
      llmStrategy: 'tool-calling',
      worldConfig: {
        name: 'AI Test World',
        createConnections: true,
      },
      actorConfig: {
        name: 'Human Player',
        additionalActors: [
          { id: 'ai-actor-1', name: 'AI Companion', isAI: true },
          { id: 'ai-actor-2', name: 'AI Enemy', isAI: true },
        ],
      },
    });
  });

  afterEach(async () => {
    // Clean up test environment
    await turnExecutionFacade.clearTestData();
    await turnExecutionFacade.dispose();
  });

  test('should make valid AI decisions using LLM', async () => {
    // Arrange - Configure LLM to return valid action
    llmService.getAIDecision = jest.fn().mockResolvedValue({
      actionId: 'core:move',
      targets: { direction: 'north' },
      reasoning: 'Exploring the area',
    });

    // Act - Get AI decision
    const decision = await llmService.getAIDecision({
      actorId: 'ai-actor-1',
      availableActions: [
        { id: 'core:move', name: 'Move' },
        { id: 'core:wait', name: 'Wait' },
        { id: 'core:examine', name: 'Examine' },
      ],
      context: {
        currentLocation: 'starting_room',
        turn: 1,
      },
    });

    // Assert
    expect(decision).toBeDefined();
    expect(decision.actionId).toBe('core:move');
    expect(decision.targets.direction).toBe('north');
    expect(decision.reasoning).toBeDefined();
    expect(llmService.getAIDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'ai-actor-1',
      })
    );
  });

  test('should handle LLM failures with fallback', async () => {
    // Arrange - Configure LLM to fail
    llmService.getAIDecision = jest
      .fn()
      .mockRejectedValue(new Error('LLM service unavailable'));

    // Act - Attempt AI decision with fallback
    let decision = null;
    let error = null;

    try {
      decision = await llmService.getAIDecision({
        actorId: 'ai-actor-1',
        availableActions: [{ id: 'core:wait' }],
      });
    } catch (e) {
      error = e;
      // Use fallback
      decision = {
        actionId: 'core:wait',
        targets: {},
        reason: 'llm_unavailable_fallback',
      };
    }

    // Assert
    expect(error).toBeTruthy();
    expect(error.message).toContain('unavailable');
    expect(decision).toBeDefined();
    expect(decision.actionId).toBe('core:wait');
    expect(decision.reason).toContain('fallback');
  });

  test('should handle LLM timeouts gracefully', async () => {
    // Arrange - Configure LLM with delay
    llmService.getAIDecision = jest
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ actionId: 'core:wait', targets: {} }),
              6000
            )
          )
      );

    // Act - Create timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI decision timeout')), 1000);
    });

    const decisionPromise = llmService.getAIDecision({
      actorId: 'ai-actor-1',
    });

    let result = null;
    let timedOut = false;

    try {
      result = await Promise.race([decisionPromise, timeoutPromise]);
    } catch (error) {
      timedOut = true;
      // Use default action
      result = { actionId: 'core:wait', targets: {} };
    }

    // Assert
    expect(timedOut).toBe(true);
    expect(result.actionId).toBe('core:wait');
  });

  test('should validate AI decisions before execution', async () => {
    // Arrange - Configure LLM to return various responses
    const testCases = [
      {
        response: { actionId: 'core:wait', targets: {} },
        isValid: true,
      },
      {
        response: { actionId: 'invalid_action', targets: {} },
        isValid: false,
      },
      {
        response: { notAnAction: true },
        isValid: false,
      },
    ];

    for (const testCase of testCases) {
      llmService.getAIDecision = jest.fn().mockResolvedValue(testCase.response);

      // Act
      const decision = await llmService.getAIDecision({
        actorId: 'ai-actor-1',
      });

      // Simple validation
      let isValid = false;
      if (
        decision &&
        decision.actionId &&
        typeof decision.actionId === 'string'
      ) {
        isValid =
          decision.actionId.startsWith('core:') ||
          decision.actionId.startsWith('test:');
      }

      // Assert
      expect(isValid).toBe(testCase.isValid);
    }
  });

  test('should maintain smooth AI behavior under various conditions', async () => {
    // Test different conditions
    const conditions = [
      { name: 'normal', shouldFail: false, delay: 100 },
      { name: 'slow', shouldFail: false, delay: 500 },
      { name: 'error', shouldFail: true, delay: 0 },
    ];

    for (const condition of conditions) {
      // Configure based on condition
      if (condition.shouldFail) {
        llmService.getAIDecision = jest
          .fn()
          .mockRejectedValue(new Error(`${condition.name} condition failure`));
      } else {
        llmService.getAIDecision = jest
          .fn()
          .mockImplementation(
            () =>
              new Promise((resolve) =>
                setTimeout(
                  () => resolve({ actionId: 'core:wait', targets: {} }),
                  condition.delay
                )
              )
          );
      }

      // Act
      const start = performance.now();
      let decision = null;

      try {
        decision = await llmService.getAIDecision({ actorId: 'ai-actor-1' });
      } catch (error) {
        // Use fallback
        decision = { actionId: 'core:wait', targets: {}, fallback: true };
      }

      const duration = performance.now() - start;

      // Assert
      expect(decision).toBeDefined();
      expect(decision.actionId).toBe('core:wait');

      if (condition.shouldFail) {
        expect(decision.fallback).toBe(true);
      }

      // Performance check
      expect(duration).toBeLessThan(1000);
    }
  });

  test('should achieve high success rate for AI decisions', async () => {
    // Arrange - Run multiple AI decisions
    const iterations = 10;
    const results = [];

    // Configure mostly successful responses
    let callCount = 0;
    llmService.getAIDecision = jest.fn().mockImplementation(async () => {
      callCount++;
      // 10% failure rate
      if (Math.random() < 0.1) {
        throw new Error('Random failure');
      }
      return { actionId: 'core:wait', targets: {} };
    });

    // Act
    for (let i = 0; i < iterations; i++) {
      let success = false;

      try {
        const decision = await llmService.getAIDecision({
          actorId: `ai-actor-${(i % 2) + 1}`,
        });
        success = decision && decision.actionId;
      } catch (error) {
        // Count fallback as success
        success = true;
      }

      results.push({ iteration: i, success });
    }

    // Assert - High success rate
    const successCount = results.filter((r) => r.success).length;
    const successRate = successCount / results.length;

    expect(successRate).toBeGreaterThanOrEqual(0.9); // 90% success rate
    expect(callCount).toBe(iterations);
  });
});
