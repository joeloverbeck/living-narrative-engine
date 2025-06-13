/**
 * @file This test suite fulfills TKT-006. It verifies that the `ITurnAction`
 * payload generated for a given action is identical whether it originates from
 * the HumanPlayerStrategy or the AIPlayerStrategy.
 * @see tests/integration/actionPayloadEquality.integration.test.js
 */

import { describe, beforeEach, test, expect } from '@jest/globals';
import { mockDeep } from 'jest-mock-extended';

// SUTs (Systems Under Test)
import { HumanPlayerStrategy } from '../../src/turns/strategies/humanPlayerStrategy.js';
import { AIPlayerStrategy } from '../../src/turns/strategies/aiPlayerStrategy.js';

// Factories and DTOs
import { createActionComposite } from '../../src/turns/dtos/actionComposite.js';
import Entity from '../../src/entities/entity.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

// Type Imports
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/interfaces/IPromptCoordinator.js').IPromptCoordinator} IPromptCoordinator */
/** @typedef {import('../../src/turns/ports/IAIDecisionOrchestrator.js').IAIDecisionOrchestrator} IAIDecisionOrchestrator */
/** @typedef {import('../../src/turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../src/turns/dtos/actionComposite.js').ActionComposite} ActionComposite */
/** @typedef {import('../../src/turns/interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */

describe('TKT-006: ATTEMPT_ACTION_ID payload equality', () => {
  /** @type {ILogger} */
  let logger;
  /** @type {IPromptCoordinator} */
  let mockPromptCoordinator;
  /** @type {IAIDecisionOrchestrator} */
  let mockDecisionOrchestrator;
  /** @type {ITurnContext} */
  let mockTurnContext;
  /** @type {Entity} */
  let humanEntity;
  /** @type {Entity} */
  let aiEntity;
  /** @type {ActionComposite} */
  let sharedActionComposite;

  beforeEach(() => {
    // Mock the logger to avoid polluting test output
    logger = mockDeep();

    // Mock all the service dependencies
    mockPromptCoordinator = mockDeep();
    mockDecisionOrchestrator = mockDeep();
    mockTurnContext = mockDeep();

    // Create the actors
    humanEntity = new Entity('human-1', 'player-character');
    humanEntity.addComponent(ACTOR_COMPONENT_ID, {});
    humanEntity.addComponent(PLAYER_COMPONENT_ID, {});

    aiEntity = new Entity('ai-1', 'npc');
    aiEntity.addComponent(ACTOR_COMPONENT_ID, {});

    // Create a shared action that both actors will "choose"
    // Using a parameter to ensure resolvedParameters are compared robustly
    sharedActionComposite = createActionComposite(
      1,
      'core:wait',
      'Wait a moment',
      { duration: 10 },
      'Do nothing and bide your time.'
    );

    // Common mock setup for the Turn Context
    mockTurnContext.getLogger.mockReturnValue(logger);
    // getPromptSignal is required by the strategies
    const abortController = new AbortController();
    mockTurnContext.getPromptSignal.mockReturnValue(abortController.signal);
  });

  test('generates identical ITurnAction payloads with no speech', async () => {
    // ARRANGE
    // 1. Setup Human Strategy
    const humanStrategy = new HumanPlayerStrategy();
    mockTurnContext.getActor.mockReturnValue(humanEntity);
    mockTurnContext.getPlayerPromptService.mockReturnValue(
      mockPromptCoordinator
    );

    const humanPromptResolution = {
      action: {
        id: sharedActionComposite.actionId,
        command: sharedActionComposite.commandString,
        params: sharedActionComposite.params,
        name: sharedActionComposite.description,
        description: sharedActionComposite.description,
      },
      speech: null,
      thoughts: 'I should wait.',
      notes: null,
    };
    mockPromptCoordinator.prompt.mockResolvedValue(humanPromptResolution);

    // 2. Setup AI Strategy
    const aiStrategy = new AIPlayerStrategy({
      orchestrator: mockDecisionOrchestrator,
      logger,
    });
    // This is the expected output object that both strategies should create
    const expectedPayload = {
      actionDefinitionId: sharedActionComposite.actionId,
      resolvedParameters: sharedActionComposite.params,
      commandString: sharedActionComposite.commandString,
    };

    const aiDecisionResult = {
      kind: 'success',
      action: expectedPayload,
      extractedData: {
        speech: null,
        thoughts: 'The simulation dictates I wait.',
        notes: null,
      },
    };
    mockDecisionOrchestrator.decideOrFallback.mockResolvedValue(
      aiDecisionResult
    );

    // ACT
    // 1. Get the payload from the human strategy
    const humanDecision = await humanStrategy.decideAction(mockTurnContext);
    const humanPayload = humanDecision.action;

    // 2. Get the payload from the AI strategy
    mockTurnContext.getActor.mockReturnValue(aiEntity); // Switch context to AI
    const aiDecision = await aiStrategy.decideAction(mockTurnContext);
    const aiPayload = aiDecision.action;

    // ASSERT
    logger.debug('Human Payload:', humanPayload);
    logger.debug('AI Payload:', aiPayload);

    expect(humanPayload).toBeDefined();
    expect(aiPayload).toBeDefined();

    // The core assertion: the generated action objects must be identical
    expect(humanPayload).toStrictEqual(expectedPayload);
    expect(aiPayload).toStrictEqual(expectedPayload);
    expect(humanPayload).toStrictEqual(aiPayload);
  });

  test('generates identical ITurnAction payloads WITH speech', async () => {
    // ARRANGE
    const speechText = 'I have decided to wait.';

    // 1. Setup Human Strategy
    const humanStrategy = new HumanPlayerStrategy();
    mockTurnContext.getActor.mockReturnValue(humanEntity);
    mockTurnContext.getPlayerPromptService.mockReturnValue(
      mockPromptCoordinator
    );

    const humanPromptResolution = {
      action: {
        id: sharedActionComposite.actionId,
        command: sharedActionComposite.commandString,
        params: sharedActionComposite.params,
      },
      speech: speechText,
      thoughts: null,
      notes: null,
    };
    mockPromptCoordinator.prompt.mockResolvedValue(humanPromptResolution);

    // 2. Setup AI Strategy
    const aiStrategy = new AIPlayerStrategy({
      orchestrator: mockDecisionOrchestrator,
      logger,
    });
    // This is the expected output, now including the speech property
    const expectedPayloadWithSpeech = {
      actionDefinitionId: sharedActionComposite.actionId,
      resolvedParameters: sharedActionComposite.params,
      commandString: sharedActionComposite.commandString,
      speech: speechText,
    };

    const aiDecisionResult = {
      kind: 'success',
      action: expectedPayloadWithSpeech,
      extractedData: { speech: speechText, thoughts: null, notes: null },
    };
    mockDecisionOrchestrator.decideOrFallback.mockResolvedValue(
      aiDecisionResult
    );

    // ACT
    const humanDecision = await humanStrategy.decideAction(mockTurnContext);
    const humanPayload = humanDecision.action;

    mockTurnContext.getActor.mockReturnValue(aiEntity);
    const aiDecision = await aiStrategy.decideAction(mockTurnContext);
    const aiPayload = aiDecision.action;

    // ASSERT
    logger.debug('Human Payload (with speech):', humanPayload);
    logger.debug('AI Payload (with speech):', aiPayload);

    expect(humanPayload).toStrictEqual(aiPayload);
    expect(humanPayload.speech).toBe(speechText);
  });
});
