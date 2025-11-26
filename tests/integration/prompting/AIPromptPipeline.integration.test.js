import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { AIPromptPipeline } from '../../../src/prompting/AIPromptPipeline.js';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { PromptBuilder } from '../../../src/prompting/promptBuilder.js';
import { PromptTemplateService } from '../../../src/prompting/promptTemplateService.js';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';
import { PerceptionLogFormatter } from '../../../src/formatting/perceptionLogFormatter.js';
import { GameStateValidationServiceForPrompting } from '../../../src/validation/gameStateValidationServiceForPrompting.js';
import ActionCategorizationService from '../../../src/entities/utils/ActionCategorizationService.js';
import { SHORT_TERM_MEMORY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

/**
 *
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 */
function createStaticContentService() {
  return {
    getCoreTaskDescriptionText: jest.fn(
      () => 'Core Task: Resolve the anomaly without escalating conflict.'
    ),
    getCharacterPortrayalGuidelines: jest.fn(
      () => 'Guidelines: Maintain authority and empathise with the crew.'
    ),
    getNc21ContentPolicyText: jest.fn(
      () => 'Policy: Stay within PG-13 tone and avoid explicit content.'
    ),
    getFinalLlmInstructionText: jest.fn(
      () => 'Final Instructions: Reply with a concise action plan.'
    ),
  };
}

/**
 *
 */
function createGameStateDto() {
  return {
    actorPromptData: {
      name: 'Commander Nyra',
      description:
        'Veteran starship captain with a calm presence and strategic mindset.',
      personality: 'Measured, diplomatic, decisive when pressured.',
      profile: {
        background: 'Graduate of the Helios Academy with 15 years of command.',
        demeanor: 'Keeps a reassuring tone even during crises.',
      },
      motivations: 'Protect her crew and resolve the anomaly peacefully.',
      internalTensions:
        'Duty to protocol versus compassion for the people under her command.',
      coreDilemmas:
        'Balancing aggression with diplomacy to safeguard the frontier.',
    },
    currentUserInput: 'How should we respond to the sudden energy surge?',
    perceptionLog: [
      {
        descriptionText: 'Sensors detect an energy spike near the nebula rim.',
        timestamp: 'T+12',
        perceptionType: 'sensor',
        eventId: 'evt-001',
      },
      {
        descriptionText: 'Crew reports minor tremors along the outer hull.',
        timestamp: 'T+13',
        perceptionType: 'status',
        eventId: 'evt-002',
      },
    ],
    currentLocation: { name: 'Bridge of the ISS Horizon' },
    actorState: {
      components: {
        [SHORT_TERM_MEMORY_COMPONENT_ID]: {
          thoughts: [
            { text: 'Keep the crew calm and informed.', timestamp: 'T+11' },
            {
              text: 'Weigh the diplomatic options carefully.',
              timestamp: 'T+10',
            },
          ],
        },
        'core:notes': {
          notes: [
            {
              text: 'Engineering is prepared to reroute power if needed.',
              subject: 'Engineering',
              subjectType: 'organization',
              context: 'daily-briefing',
              timestamp: 'T+09',
            },
          ],
        },
        'core:goals': {
          goals: [
            {
              text: 'Protect the crew from potential harm.',
              timestamp: 'T+08',
            },
            {
              text: 'Understand the source of the anomaly.',
              timestamp: 'T+07',
            },
          ],
        },
      },
    },
  };
}

/**
 *
 */
function createAvailableActions() {
  return [
    {
      index: 0,
      actionId: 'core:scan',
      commandString: 'scan-sector',
      description: 'Perform a detailed scan of the anomaly',
    },
    {
      index: 1,
      actionId: 'core:defend',
      commandString: 'raise-shields',
      description: 'Raise the shields to defensive levels',
    },
    {
      index: 2,
      actionId: 'affection:calm',
      commandString: 'steady-crew',
      description: 'Calm the crew with a reassuring address',
    },
    {
      index: 3,
      actionId: 'core:navigate',
      commandString: 'reposition-ship',
      description: 'Adjust course to maintain a safe distance',
    },
    {
      index: 4,
      actionId: 'core:communicate',
      commandString: 'hail-fleet',
      description: 'Open a channel to coordinate with the allied fleet',
    },
  ];
}

/**
 *
 * @param root0
 * @param root0.currentLlmId
 * @param root0.llmConfig
 */
function createPipelineSetup({
  currentLlmId = 'llm-primary',
  llmConfig = { configId: 'test-config', displayName: 'Primary LLM' },
} = {}) {
  const pipelineLogger = createLogger();
  const promptLogger = createLogger();
  const builderLogger = createLogger();

  const llmAdapter = {
    getCurrentActiveLlmId: jest.fn(async () => currentLlmId),
    getAIDecision: jest.fn(),
  };

  const gameStateProvider = {
    buildGameState: jest.fn(async () => createGameStateDto()),
  };

  const staticContentService = createStaticContentService();
  const safeEventDispatcher = { dispatch: jest.fn() };

  const perceptionLogFormatter = new PerceptionLogFormatter({
    logger: promptLogger,
  });
  const gameStateValidationService = new GameStateValidationServiceForPrompting(
    {
      logger: promptLogger,
      safeEventDispatcher,
    }
  );
  const actionCategorizationService = new ActionCategorizationService({
    logger: promptLogger,
  });

  const characterDataXmlBuilder = {
    buildCharacterDataXml: jest.fn((actorPromptData) => {
      const name = actorPromptData?.name || 'Unknown';
      return `<character_data>\n<identity>\nYOU ARE ${name}.\nThis is your identity. All thoughts, actions, and words must stem from this core truth.\n</identity>\n</character_data>`;
    }),
  };

  const modActionMetadataProvider = {
    getMetadataForMod: jest.fn(() => null),
  };

  const promptContentProvider = new AIPromptContentProvider({
    logger: promptLogger,
    promptStaticContentService: staticContentService,
    perceptionLogFormatter,
    gameStateValidationService,
    actionCategorizationService,
    characterDataXmlBuilder,
    modActionMetadataProvider,
  });

  const llmConfigService = {
    loadConfiguration: jest.fn(async (requestedId) => {
      if (!llmConfig) return null;
      return requestedId === currentLlmId
        ? {
            ...llmConfig,
            id: requestedId,
            modelIdentifier: 'test-model',
            endpointUrl: 'https://llm.example.test',
          }
        : null;
    }),
  };

  const templateService = new PromptTemplateService({ logger: builderLogger });
  const dataFormatter = new PromptDataFormatter({ logger: builderLogger });
  const promptBuilder = new PromptBuilder({
    logger: builderLogger,
    llmConfigService,
    templateService,
    dataFormatter,
  });

  const pipeline = new AIPromptPipeline({
    llmAdapter,
    gameStateProvider,
    promptContentProvider,
    promptBuilder,
    logger: pipelineLogger,
  });

  return {
    pipeline,
    pipelineLogger,
    llmAdapter,
    gameStateProvider,
    promptContentProvider,
    promptBuilder,
    llmConfigService,
    staticContentService,
    safeEventDispatcher,
  };
}

describe('AIPromptPipeline integration', () => {
  const actor = { id: 'actor-nyra' };
  const context = { sceneId: 'bridge', turnNumber: 42 };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('produces a fully assembled prompt using concrete prompting services', async () => {
    const setup = createPipelineSetup({ currentLlmId: 'llm-anomaly' });
    const availableActions = createAvailableActions();
    const promptSpy = jest.spyOn(setup.promptContentProvider, 'getPromptData');

    const prompt = await setup.pipeline.generatePrompt(
      actor,
      context,
      availableActions
    );

    expect(setup.llmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
    expect(setup.gameStateProvider.buildGameState).toHaveBeenCalledWith(
      actor,
      context,
      setup.pipelineLogger
    );
    expect(promptSpy).toHaveBeenCalledTimes(1);
    const [promptDto] = promptSpy.mock.calls[0];
    expect(promptDto.availableActions).toBe(availableActions);

    // Check task_definition with processing hint
    expect(prompt).toContain('<task_definition>');
    expect(prompt).toContain('<!-- *** CRITICAL: Your core task - all output stems from this -->');
    expect(prompt).toContain('Core Task: Resolve the anomaly without escalating conflict.');
    expect(prompt).toContain('</task_definition>');
    expect(prompt).toContain('YOU ARE Commander Nyra.');
    expect(prompt).toContain(
      '[Index: 1] Command: "raise-shields". Description: Raise the shields to defensive levels.'
    );
    expect(prompt).toContain(
      'Sensors detect an energy spike near the nebula rim.'
    );
    expect(prompt).toContain(
      'Engineering is prepared to reroute power if needed.'
    );

    expect(setup.pipelineLogger.debug).toHaveBeenCalledWith(
      'AIPromptPipeline: Generating prompt for actor actor-nyra.'
    );
    expect(setup.pipelineLogger.debug).toHaveBeenCalledWith(
      "AIPromptPipeline: Generated final prompt string for actor actor-nyra using LLM config for 'llm-anomaly'."
    );
  });

  it('throws when the active LLM cannot be determined', async () => {
    const setup = createPipelineSetup({ currentLlmId: '' });
    const availableActions = createAvailableActions();

    await expect(
      setup.pipeline.generatePrompt(actor, context, availableActions)
    ).rejects.toThrow('Could not determine active LLM ID.');

    expect(setup.gameStateProvider.buildGameState).not.toHaveBeenCalled();
  });

  it('propagates builder failures when the assembled prompt is empty', async () => {
    const setup = createPipelineSetup({
      currentLlmId: 'llm-anomaly',
      llmConfig: null,
    });
    const availableActions = createAvailableActions();
    const buildSpy = jest.spyOn(setup.promptBuilder, 'build');

    await expect(
      setup.pipeline.generatePrompt(actor, context, availableActions)
    ).rejects.toThrow('PromptBuilder returned an empty or invalid prompt.');

    expect(setup.gameStateProvider.buildGameState).toHaveBeenCalledTimes(1);
    expect(buildSpy).toHaveBeenCalled();
  });
});
