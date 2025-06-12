import { jest, describe, beforeEach, test, expect } from '@jest/globals';

import { AIPlayerStrategy } from '../../src/turns/strategies/aiPlayerStrategy.js';
import { ActionIndexingService } from '../../src/turns/services/actionIndexingService.js';
import { AIFallbackActionFactory } from '../../src/turns/services/AIFallbackActionFactory.js';
import Entity from '../../src/entities/entity.js';

// ─── minimal logger stub ──────────────────────────────────────────────────────
const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

// ─── ultra-light ITurnContext stub (only what AIPlayerStrategy uses) ──────────
class ContextStub {
  constructor(actor, logger) {
    this._actor = actor;
    this._logger = logger;
  }

  getActor() {
    return this._actor;
  }

  getLogger() {
    return this._logger;
  }

  // Provide prompt signal for orchestrator
  getPromptSignal() {
    return undefined;
  }
}

// ─── helper producing two discovered actions producing two discovered actions ──────────────────────────────────
const buildDiscoveredActions = () => [
  {
    id: 'core:wait',
    name: 'Wait',
    command: 'wait',
    description: 'Do nothing for a turn.',
    params: {},
  },
  {
    id: 'combat:attack',
    name: 'Attack Goblin',
    command: 'attack the goblin',
    description: 'Strike the nearby goblin with your weapon.',
    params: { targetId: 'enemy-goblin-001' },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
describe('AIPlayerStrategy – decideAction integration (index round-trip)', () => {
  let logger;
  let actionDiscoveryMock;
  let aiPromptPipelineMock;
  let llmAdapterMock;
  let llmResponseProcessorMock;
  let actionIndexingService;
  let strategy;
  let actor;
  let context;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = makeLogger();

    // concrete bits
    actionIndexingService = new ActionIndexingService(logger);
    const fallbackFactory = new AIFallbackActionFactory({ logger });

    // mocks / stubs
    const discovered = buildDiscoveredActions();
    actionDiscoveryMock = {
      getValidActions: jest.fn().mockResolvedValue(discovered),
    };

    aiPromptPipelineMock = {
      generatePrompt: jest.fn().mockResolvedValue('<<prompt body>>'),
    };

    // LLM will “choose” the second action (index = 2)
    const llmJson = JSON.stringify({
      chosenIndex: 2,
      speech: 'For glory!',
      thoughts: 'Defeating the foe is paramount.',
    });
    llmAdapterMock = {
      getAIDecision: jest.fn().mockResolvedValue(llmJson),
    };

    // very thin validator – just parse & echo the structure AIPlayerStrategy expects
    llmResponseProcessorMock = {
      processResponse: jest.fn(async (json) => {
        const parsed = JSON.parse(json);
        return {
          success: true,
          action: {
            chosenIndex: parsed.chosenIndex,
            speech: parsed.speech,
          },
          extractedData: { thoughts: parsed.thoughts },
        };
      }),
    };

    // actor & context
    actor = new Entity('actor-001', 'test:dummy');
    context = new ContextStub(actor, logger);

    // build orchestrator to wrap existing AI parts
    const llmChooser = {
      choose: jest.fn(async ({ actor, context, actions }) => {
        const prompt = await aiPromptPipelineMock.generatePrompt(
          actor,
          context,
          actions
        );
        const json = await llmAdapterMock.getAIDecision(prompt);
        const processed = await llmResponseProcessorMock.processResponse(json);
        return {
          index: processed.action.chosenIndex,
          speech: processed.action.speech,
        };
      }),
    };
    const turnActionFactory = {
      create: (composite, speech) => {
        const action = {
          actionDefinitionId: composite.actionId,
          resolvedParameters: composite.params,
          commandString: composite.commandString,
        };
        if (speech) action.speech = speech;
        return action;
      },
    };
    const {
      AIDecisionOrchestrator,
    } = require('../../src/turns/orchestration/aiDecisionOrchestrator.js');
    const {
      ActionIndexerAdapter,
    } = require('../../src/turns/adapters/actionIndexerAdapter.js');
    const indexerAdapter = new ActionIndexerAdapter(actionIndexingService);
    const orchestrator = new AIDecisionOrchestrator({
      discoverySvc: actionDiscoveryMock,
      indexer: indexerAdapter,
      llmChooser,
      turnActionFactory,
      fallbackFactory,
      logger,
    });
    strategy = new AIPlayerStrategy({ orchestrator, logger });
  });

  test('returns the ITurnAction that corresponds to the index chosen by the LLM', async () => {
    const decision = await strategy.decideAction(context);

    // structure checks
    expect(decision).toBeDefined();
    expect(decision.action).toBeDefined();

    // → should map to the 2nd discovered action
    expect(decision.action.actionDefinitionId).toBe('combat:attack');
    expect(decision.action.resolvedParameters).toEqual({
      targetId: 'enemy-goblin-001',
    });

    // speech piped through
    expect(decision.action.speech).toBe('For glory!');

    // sanity: all mocks hit once
    expect(actionDiscoveryMock.getValidActions).toHaveBeenCalledTimes(1);
    expect(aiPromptPipelineMock.generatePrompt).toHaveBeenCalledTimes(1);
    expect(llmAdapterMock.getAIDecision).toHaveBeenCalledTimes(1);
    expect(llmResponseProcessorMock.processResponse).toHaveBeenCalledTimes(1);
  });
});
