/**
 * @file Tests for TwoPhaseDecisionOrchestrator tool schema handling.
 * @description Verifies that the orchestrator passes the correct tool schema
 * to the LLM adapter for both Phase 1 (mood update) and Phase 2 (action) calls.
 *
 * Bug Fix Context:
 * Phase 2 was not passing a toolSchema, causing the LLM to return mood fields
 * in the action response. The V5 schema has additionalProperties: false,
 * causing validation to fail with "must NOT have additional properties".
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TwoPhaseDecisionOrchestrator } from '../../../../src/turns/orchestrators/TwoPhaseDecisionOrchestrator.js';
import {
  LLM_MOOD_UPDATE_RESPONSE_SCHEMA,
  LLM_TURN_ACTION_RESPONSE_SCHEMA_V5,
} from '../../../../src/turns/schemas/llmOutputSchemas.js';

/**
 * Creates mock dependencies for the orchestrator.
 * @param {Object} overrides - Dependencies to override
 * @returns {Object} Mock dependencies
 */
const createDeps = (overrides = {}) => {
  const deps = {
    moodUpdatePipeline: {
      generateMoodUpdatePrompt: jest.fn().mockResolvedValue('mood-prompt'),
    },
    moodResponseProcessor: {
      processMoodResponse: jest.fn().mockResolvedValue({
        moodUpdate: { valence: 10, arousal: 0, agency_control: 0, threat: 0, engagement: 0, future_expectancy: 0, self_evaluation: 0 },
        sexualUpdate: { sex_excitation: 0, sex_inhibition: 50 },
      }),
    },
    moodPersistenceService: {
      persistMoodUpdate: jest.fn().mockResolvedValue(),
    },
    aiPromptPipeline: {
      generatePrompt: jest.fn().mockResolvedValue('action-prompt'),
    },
    llmAdapter: {
      getAIDecision: jest
        .fn()
        .mockResolvedValueOnce('mood-raw-response')
        .mockResolvedValueOnce('action-raw-response'),
    },
    llmResponseProcessor: {
      processResponse: jest.fn().mockResolvedValue({
        action: { chosenIndex: 1, speech: 'Hello.' },
        extractedData: {
          thoughts: 'Thinking...',
          notes: [],
        },
      }),
    },
    logger: { debug: jest.fn() },
  };

  return { ...deps, ...overrides };
};

describe('TwoPhaseDecisionOrchestrator - Tool Schema Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Phase 1 (Mood Update) Tool Schema', () => {
    it('passes mood-specific tool schema to LLM for Phase 1 call', async () => {
      const deps = createDeps();
      const orchestrator = new TwoPhaseDecisionOrchestrator(deps);

      await orchestrator.orchestrate({
        actor: { id: 'actor-1' },
        context: { scene: 'test' },
        actions: [{ id: 'action-1' }],
      });

      // Phase 1 call (first call) should include toolSchema in requestOptions
      expect(deps.llmAdapter.getAIDecision).toHaveBeenNthCalledWith(
        1,
        'mood-prompt',
        undefined,
        expect.objectContaining({
          toolSchema: LLM_MOOD_UPDATE_RESPONSE_SCHEMA,
        })
      );
    });

    it('includes tool name and description in Phase 1 requestOptions', async () => {
      const deps = createDeps();
      const orchestrator = new TwoPhaseDecisionOrchestrator(deps);

      await orchestrator.orchestrate({
        actor: { id: 'actor-2' },
        context: {},
        actions: [],
      });

      // Verify requestOptions includes tool metadata
      const phase1CallArgs = deps.llmAdapter.getAIDecision.mock.calls[0];
      const requestOptions = phase1CallArgs[2];

      expect(requestOptions).toHaveProperty('toolSchema');
      expect(requestOptions).toHaveProperty('toolName');
      expect(requestOptions).toHaveProperty('toolDescription');
      expect(typeof requestOptions.toolName).toBe('string');
      expect(typeof requestOptions.toolDescription).toBe('string');
    });

    it('passes AbortSignal correctly with tool schema in Phase 1', async () => {
      const deps = createDeps();
      const orchestrator = new TwoPhaseDecisionOrchestrator(deps);
      const controller = new AbortController();

      await orchestrator.orchestrate({
        actor: { id: 'actor-3' },
        context: {},
        actions: [],
        abortSignal: controller.signal,
      });

      // Phase 1 should have both AbortSignal and requestOptions
      expect(deps.llmAdapter.getAIDecision).toHaveBeenNthCalledWith(
        1,
        'mood-prompt',
        controller.signal,
        expect.objectContaining({
          toolSchema: LLM_MOOD_UPDATE_RESPONSE_SCHEMA,
        })
      );
    });
  });

  describe('Phase 2 (Action Decision) Tool Schema', () => {
    it('passes action-specific tool schema to LLM for Phase 2 call', async () => {
      const deps = createDeps();
      const orchestrator = new TwoPhaseDecisionOrchestrator(deps);

      await orchestrator.orchestrate({
        actor: { id: 'actor-4' },
        context: {},
        actions: [{ id: 'action-1' }],
      });

      // Phase 2 call (second call) should include toolSchema in requestOptions
      expect(deps.llmAdapter.getAIDecision).toHaveBeenNthCalledWith(
        2,
        'action-prompt',
        undefined,
        expect.objectContaining({
          toolSchema: LLM_TURN_ACTION_RESPONSE_SCHEMA_V5,
        })
      );
    });

    it('includes tool name and description in Phase 2 requestOptions', async () => {
      const deps = createDeps();
      const orchestrator = new TwoPhaseDecisionOrchestrator(deps);

      await orchestrator.orchestrate({
        actor: { id: 'actor-5' },
        context: {},
        actions: [],
      });

      // Verify requestOptions includes tool metadata
      const phase2CallArgs = deps.llmAdapter.getAIDecision.mock.calls[1];
      const requestOptions = phase2CallArgs[2];

      expect(requestOptions).toHaveProperty('toolSchema');
      expect(requestOptions).toHaveProperty('toolName');
      expect(requestOptions).toHaveProperty('toolDescription');
      expect(requestOptions.toolName).toBe('turn_action');
      expect(typeof requestOptions.toolDescription).toBe('string');
    });

    it('passes AbortSignal correctly with tool schema in Phase 2', async () => {
      const deps = createDeps();
      const orchestrator = new TwoPhaseDecisionOrchestrator(deps);
      const controller = new AbortController();

      await orchestrator.orchestrate({
        actor: { id: 'actor-6' },
        context: {},
        actions: [],
        abortSignal: controller.signal,
      });

      // Phase 2 should have AbortSignal and requestOptions with schema
      expect(deps.llmAdapter.getAIDecision).toHaveBeenNthCalledWith(
        2,
        'action-prompt',
        controller.signal,
        expect.objectContaining({
          toolSchema: LLM_TURN_ACTION_RESPONSE_SCHEMA_V5,
        })
      );
    });

    it('action schema does NOT include mood fields', async () => {
      const deps = createDeps();
      const orchestrator = new TwoPhaseDecisionOrchestrator(deps);

      await orchestrator.orchestrate({
        actor: { id: 'actor-7' },
        context: {},
        actions: [],
      });

      const phase2CallArgs = deps.llmAdapter.getAIDecision.mock.calls[1];
      const requestOptions = phase2CallArgs[2];
      const schema = requestOptions?.toolSchema;

      // Verify no mood-related fields in the action schema
      expect(schema.properties).not.toHaveProperty('moodUpdate');
      expect(schema.properties).not.toHaveProperty('sexualUpdate');
    });

    it('action schema has additionalProperties: false to reject unexpected fields', async () => {
      const deps = createDeps();
      const orchestrator = new TwoPhaseDecisionOrchestrator(deps);

      await orchestrator.orchestrate({
        actor: { id: 'actor-8' },
        context: {},
        actions: [],
      });

      const phase2CallArgs = deps.llmAdapter.getAIDecision.mock.calls[1];
      const requestOptions = phase2CallArgs[2];
      const schema = requestOptions?.toolSchema;

      // This is the key: additionalProperties: false rejects LLM mood fields
      expect(schema.additionalProperties).toBe(false);
    });
  });

  describe('Schema Content Validation', () => {
    it('uses the correct mood schema with additionalProperties: false', async () => {
      const deps = createDeps();
      const orchestrator = new TwoPhaseDecisionOrchestrator(deps);

      await orchestrator.orchestrate({
        actor: { id: 'actor-9' },
        context: {},
        actions: [],
      });

      const phase1CallArgs = deps.llmAdapter.getAIDecision.mock.calls[0];
      const requestOptions = phase1CallArgs[2];
      const schema = requestOptions?.toolSchema;

      // Verify the schema structure matches what we expect
      expect(schema).toBeDefined();
      expect(schema.additionalProperties).toBe(false);
      expect(schema.properties).toHaveProperty('moodUpdate');
      expect(schema.properties).toHaveProperty('sexualUpdate');
      expect(schema.required).toEqual(['moodUpdate', 'sexualUpdate']);
    });

    it('mood schema does NOT include action fields', async () => {
      const deps = createDeps();
      const orchestrator = new TwoPhaseDecisionOrchestrator(deps);

      await orchestrator.orchestrate({
        actor: { id: 'actor-10' },
        context: {},
        actions: [],
      });

      const phase1CallArgs = deps.llmAdapter.getAIDecision.mock.calls[0];
      const requestOptions = phase1CallArgs[2];
      const schema = requestOptions?.toolSchema;

      // Verify no action-related fields in the mood schema
      expect(schema.properties).not.toHaveProperty('chosenIndex');
      expect(schema.properties).not.toHaveProperty('speech');
      expect(schema.properties).not.toHaveProperty('thoughts');
      expect(schema.properties).not.toHaveProperty('notes');
    });
  });
});
