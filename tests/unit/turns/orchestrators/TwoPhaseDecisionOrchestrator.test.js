import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TwoPhaseDecisionOrchestrator } from '../../../../src/turns/orchestrators/TwoPhaseDecisionOrchestrator.js';
import {
  LLM_MOOD_UPDATE_RESPONSE_SCHEMA,
  LLM_TURN_ACTION_RESPONSE_SCHEMA_V5,
} from '../../../../src/turns/schemas/llmOutputSchemas.js';

const createDeps = (overrides = {}) => {
  const deps = {
    moodUpdatePipeline: {
      generateMoodUpdatePrompt: jest.fn().mockResolvedValue('mood-prompt'),
    },
    moodResponseProcessor: {
      processMoodResponse: jest.fn().mockResolvedValue({
        moodUpdate: { valence: 1 },
        sexualUpdate: { sex_excitation: 2 },
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
        .mockResolvedValueOnce('mood-raw')
        .mockResolvedValueOnce('action-raw'),
    },
    llmResponseProcessor: {
      processResponse: jest.fn().mockResolvedValue({
        action: { chosenIndex: 2, speech: 'Hi.' },
        extractedData: {
          thoughts: 'Thinking...',
          notes: [{ text: 'Note', subject: 'Test' }],
        },
      }),
    },
    logger: { debug: jest.fn() },
  };

  return { ...deps, ...overrides };
};

describe('TwoPhaseDecisionOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when moodUpdatePipeline is missing', () => {
    expect(
      () =>
        new TwoPhaseDecisionOrchestrator({
          ...createDeps(),
          moodUpdatePipeline: null,
        })
    ).toThrow('TwoPhaseDecisionOrchestrator: moodUpdatePipeline required');
  });

  it('throws when moodResponseProcessor is missing', () => {
    expect(
      () =>
        new TwoPhaseDecisionOrchestrator({
          ...createDeps(),
          moodResponseProcessor: null,
        })
    ).toThrow('TwoPhaseDecisionOrchestrator: moodResponseProcessor required');
  });

  it('throws when moodPersistenceService is missing', () => {
    expect(
      () =>
        new TwoPhaseDecisionOrchestrator({
          ...createDeps(),
          moodPersistenceService: null,
        })
    ).toThrow('TwoPhaseDecisionOrchestrator: moodPersistenceService required');
  });

  it('throws when aiPromptPipeline is missing', () => {
    expect(
      () =>
        new TwoPhaseDecisionOrchestrator({
          ...createDeps(),
          aiPromptPipeline: null,
        })
    ).toThrow('TwoPhaseDecisionOrchestrator: aiPromptPipeline required');
  });

  it('throws when llmAdapter is missing', () => {
    expect(
      () =>
        new TwoPhaseDecisionOrchestrator({
          ...createDeps(),
          llmAdapter: null,
        })
    ).toThrow('TwoPhaseDecisionOrchestrator: llmAdapter required');
  });

  it('throws when llmResponseProcessor is missing', () => {
    expect(
      () =>
        new TwoPhaseDecisionOrchestrator({
          ...createDeps(),
          llmResponseProcessor: null,
        })
    ).toThrow('TwoPhaseDecisionOrchestrator: llmResponseProcessor required');
  });

  it('throws when logger is missing', () => {
    expect(
      () =>
        new TwoPhaseDecisionOrchestrator({
          ...createDeps(),
          logger: null,
        })
    ).toThrow('TwoPhaseDecisionOrchestrator: logger required');
  });

  it('runs both phases and returns the combined result', async () => {
    const deps = createDeps();
    const orchestrator = new TwoPhaseDecisionOrchestrator(deps);
    const actor = { id: 'actor-1' };
    const context = { scene: 'intro' };
    const actions = [{ id: 'action-1' }];

    const result = await orchestrator.orchestrate({ actor, context, actions });

    expect(deps.moodUpdatePipeline.generateMoodUpdatePrompt).toHaveBeenCalledWith(
      actor,
      context
    );
    expect(deps.llmAdapter.getAIDecision).toHaveBeenNthCalledWith(
      1,
      'mood-prompt',
      undefined,
      {
        toolSchema: LLM_MOOD_UPDATE_RESPONSE_SCHEMA,
        toolName: 'mood_update',
        toolDescription:
          'Update character mood and sexual state based on recent events',
      }
    );
    expect(deps.moodResponseProcessor.processMoodResponse).toHaveBeenCalledWith(
      'mood-raw',
      actor.id
    );
    expect(deps.moodPersistenceService.persistMoodUpdate).toHaveBeenCalledWith(
      actor.id,
      { valence: 1 },
      { sex_excitation: 2 }
    );

    expect(deps.aiPromptPipeline.generatePrompt).toHaveBeenCalledWith(
      actor,
      context,
      actions
    );
    expect(deps.llmAdapter.getAIDecision).toHaveBeenNthCalledWith(
      2,
      'action-prompt',
      undefined,
      {
        toolSchema: LLM_TURN_ACTION_RESPONSE_SCHEMA_V5,
        toolName: 'turn_action',
        toolDescription: 'Select action, speech, and thoughts for character turn',
      }
    );
    expect(deps.llmResponseProcessor.processResponse).toHaveBeenCalledWith(
      'action-raw',
      actor.id
    );

    expect(result).toEqual({
      index: 2,
      speech: 'Hi.',
      thoughts: 'Thinking...',
      notes: [{ text: 'Note', subject: 'Test' }],
      moodUpdate: { valence: 1 },
      sexualUpdate: { sex_excitation: 2 },
    });
  });

  it('persists mood before generating the action prompt', async () => {
    const order = [];
    const deps = createDeps({
      moodPersistenceService: {
        persistMoodUpdate: jest.fn().mockImplementation(() => {
          order.push('persist');
          return Promise.resolve();
        }),
      },
      aiPromptPipeline: {
        generatePrompt: jest.fn().mockImplementation(() => {
          order.push('prompt');
          return Promise.resolve('action-prompt');
        }),
      },
    });

    const orchestrator = new TwoPhaseDecisionOrchestrator(deps);
    await orchestrator.orchestrate({
      actor: { id: 'actor-2' },
      context: {},
      actions: [],
    });

    expect(order).toEqual(['persist', 'prompt']);
  });

  it('stops before Phase 2 when Phase 1 fails', async () => {
    const deps = createDeps({
      moodResponseProcessor: {
        processMoodResponse: jest.fn().mockRejectedValue(new Error('fail')),
      },
    });
    const orchestrator = new TwoPhaseDecisionOrchestrator(deps);

    await expect(
      orchestrator.orchestrate({
        actor: { id: 'actor-3' },
        context: {},
        actions: [],
      })
    ).rejects.toThrow('fail');

    expect(deps.aiPromptPipeline.generatePrompt).not.toHaveBeenCalled();
    expect(deps.llmResponseProcessor.processResponse).not.toHaveBeenCalled();
    expect(deps.moodPersistenceService.persistMoodUpdate).not.toHaveBeenCalled();
  });

  it('throws on Phase 2 failure after persisting mood', async () => {
    const deps = createDeps({
      llmResponseProcessor: {
        processResponse: jest.fn().mockRejectedValue(new Error('phase2-fail')),
      },
    });
    const orchestrator = new TwoPhaseDecisionOrchestrator(deps);

    await expect(
      orchestrator.orchestrate({
        actor: { id: 'actor-4' },
        context: {},
        actions: [],
      })
    ).rejects.toThrow('phase2-fail');

    expect(deps.moodPersistenceService.persistMoodUpdate).toHaveBeenCalled();
  });

  it('forwards AbortSignal to both LLM calls', async () => {
    const deps = createDeps();
    const orchestrator = new TwoPhaseDecisionOrchestrator(deps);
    const controller = new AbortController();

    await orchestrator.orchestrate({
      actor: { id: 'actor-5' },
      context: {},
      actions: [],
      abortSignal: controller.signal,
    });

    expect(deps.llmAdapter.getAIDecision).toHaveBeenNthCalledWith(
      1,
      'mood-prompt',
      controller.signal,
      {
        toolSchema: LLM_MOOD_UPDATE_RESPONSE_SCHEMA,
        toolName: 'mood_update',
        toolDescription:
          'Update character mood and sexual state based on recent events',
      }
    );
    expect(deps.llmAdapter.getAIDecision).toHaveBeenNthCalledWith(
      2,
      'action-prompt',
      controller.signal,
      {
        toolSchema: LLM_TURN_ACTION_RESPONSE_SCHEMA_V5,
        toolName: 'turn_action',
        toolDescription: 'Select action, speech, and thoughts for character turn',
      }
    );
  });
});
