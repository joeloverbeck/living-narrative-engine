/**
 * @file Comprehensive integration tests for CoreMotivationsGenerator using
 * production collaborators wherever feasible. These tests exercise retry
 * flows, schema validation, quality checks, token estimation fallbacks, and
 * event dispatch semantics using the real event infrastructure.
 */

import {
  describe,
  it,
  expect,
  afterEach,
  jest,
} from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CoreMotivationsGenerator,
  CoreMotivationsGenerationError,
} from '../../../../src/characterBuilder/services/CoreMotivationsGenerator.js';
import { CoreMotivation } from '../../../../src/characterBuilder/models/coreMotivation.js';
import {
  CORE_MOTIVATIONS_RESPONSE_SCHEMA,
  buildCoreMotivationsGenerationPrompt,
  PROMPT_VERSION_INFO,
} from '../../../../src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js';
import { LlmJsonService } from '../../../../src/llms/llmJsonService.js';
import { GameDataRepository } from '../../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import EventBus from '../../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDir, '../../../..');

const EVENT_FILES = {
  'core:core_motivations_generation_started':
    'data/mods/core/events/core_motivations_generation_started.event.json',
  'core:core_motivations_generation_completed':
    'data/mods/core/events/core_motivations_generation_completed.event.json',
  'core:core_motivations_generation_failed':
    'data/mods/core/events/core_motivations_generation_failed.event.json',
};

const EVENT_DEFINITIONS = Object.fromEntries(
  Object.entries(EVENT_FILES).map(([eventId, relativePath]) => {
    const absolutePath = path.resolve(repoRoot, relativePath);
    return [eventId, JSON.parse(fs.readFileSync(absolutePath, 'utf8'))];
  })
);

const EVENT_SCHEMA = JSON.parse(
  fs.readFileSync(
    path.resolve(repoRoot, 'data/schemas/event.schema.json'),
    'utf8'
  )
);

const COMMON_SCHEMA = JSON.parse(
  fs.readFileSync(
    path.resolve(repoRoot, 'data/schemas/common.schema.json'),
    'utf8'
  )
);

/**
 *
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 * @param seed
 * @param minLength
 */
function createLongText(seed, minLength) {
  let output = seed.trim();
  while (output.length < minLength) {
    output += ` ${seed.trim()}`;
  }
  return output;
}

/**
 *
 */
function createSampleConcept() {
  return {
    id: 'concept-auric-mage',
    concept: createLongText(
      'A reluctant mage born with luminous blood who fears the political wars it might ignite.',
      120
    ),
  };
}

/**
 *
 */
function createSampleDirection() {
  return {
    id: 'direction-haunted-duty',
    title: 'Burden of Radiance',
    description: createLongText(
      'Stories that explore the tension between personal freedom and ancestral expectations anchored in mysterious cosmic lore.',
      160
    ),
    coreTension: createLongText(
      'The cost of wielding forbidden light versus the devastation unleashed if that power is suppressed.',
      140
    ),
    uniqueTwist:
      'The magic intensifies only when the mage admits terrifying truths aloud to confidants.',
    narrativePotential: createLongText(
      'Opportunities for mentorship betrayals, political realignments, and tender alliances built on transparency.',
      140
    ),
  };
}

/**
 *
 */
function createSampleCliches() {
  return {
    categories: {
      personalityTraits: [
        'Brooding loner who refuses help',
        'Chosen one with destiny angst',
      ],
      genericGoals: [
        'Save the entire world single-handedly',
        'Find the one prophecy-breaking artifact',
      ],
      overusedSecrets: [
        'Secret royal bloodline revealed in act three',
        'Hidden demonic bargain that invalidates agency',
      ],
    },
    tropesAndStereotypes: [
      'Reluctant hero who constantly quits',
      'Mysterious mentor who vanishes before finale',
    ],
  };
}

/**
 *
 */
function buildHighQualityResponse() {
  return {
    motivations: [
      {
        coreDesire:
          'She imagines a coalition of luminous healers who transform contested borders into sanctuaries, replacing whispered prophecies of conquest with shared recipes, letters from home, and murals celebrating survival.',
        internalContradiction:
          'Yet each time her radiance spills across the cobblestones, rival courts circulate fresh decrees that the glow signals rebellion, and friends start to wonder whether sheltering her invites armies to their doorsteps.',
        centralQuestion:
          'Can she share her forbidden brilliance without reigniting the wars that shattered her lineage?',
      },
      {
        coreDesire:
          'He longs to transform the auric bloodline from a myth whispered by generals into a network of shelters where refugees learn new trades, repaint damaged theatres, and elect councils who answer to the displaced instead of monarchs.',
        internalContradiction:
          'Protecting travelers requires miracles performed in crowded marketplaces, but every public demonstration yields invitations from empires offering gilded laboratories, chains of debt, or scalpels dipped in the promise of progress.',
        centralQuestion:
          'Is there a path where visibility becomes protection rather than a death sentence for those he saves?',
      },
      {
        coreDesire:
          'They ache for companionship that recognises the exhaustion hidden beneath practiced smiles, someone who will sketch future floor plans with them instead of repeating sermons about destiny or glory.',
        internalContradiction:
          'To stay safe they deliver rehearsed jokes, redirect probing questions, and stage nightly disappearances, but the disguises prevent confidants from witnessing the ordinary vulnerabilities that would earn reciprocal devotion.',
        centralQuestion:
          'Will hiding their pain forever sever the connections required to survive the looming purge?',
      },
    ],
  };
}

/**
 *
 */
function buildLowQualityResponse() {
  return {
    motivations: [
      {
        coreDesire: 'Protect friends quickly.',
        internalContradiction: 'He wants safety but danger happens.',
        centralQuestion: 'Can he stay safe?',
      },
      {
        coreDesire: 'Find peace soon.',
        internalContradiction: 'She fears truth.',
        centralQuestion: 'Will she face fears?',
      },
      {
        coreDesire: 'Keep running away.',
        internalContradiction: 'Hiding hurts inside.',
        centralQuestion: 'Does hiding work?',
      },
    ],
  };
}

class TestLLMStrategyFactory {
  constructor(responses) {
    if (!responses || responses.length === 0) {
      throw new Error('TestLLMStrategyFactory requires at least one response');
    }
    this._responses = responses;
    this.calls = [];
  }

  async getAIDecision(prompt, _abortSignal, options) {
    const callIndex = this.calls.length;
    this.calls.push({ prompt, options });
    const behavior = this._responses[Math.min(callIndex, this._responses.length - 1)];

    if (behavior instanceof Error) {
      throw behavior;
    }

    if (typeof behavior === 'function') {
      const result = await behavior({ prompt, options, callIndex });
      if (result instanceof Error) {
        throw result;
      }
      return result;
    }

    return behavior;
  }
}

class TestLLMConfigManager {
  constructor({
    initialActiveConfigId = 'default-auric-model',
    knownConfigs,
    setShouldFailFor = [],
    loadReturnsNullFor = [],
    getActiveBehavior = null,
  } = {}) {
    this.setCalls = [];
    this.loadCalls = [];
    this.getActiveCalls = [];
    this._setShouldFailFor = new Set(setShouldFailFor);
    this._loadReturnsNullFor = new Set(loadReturnsNullFor);
    this._getActiveBehaviorQueue = Array.isArray(getActiveBehavior)
      ? [...getActiveBehavior]
      : null;

    this._knownConfigs = new Map();
    this._activeConfig = null;

    if (initialActiveConfigId) {
      const initialConfig = { configId: initialActiveConfigId };
      this._knownConfigs.set(initialActiveConfigId, initialConfig);
      this._activeConfig = initialConfig;
    }

    if (Array.isArray(knownConfigs)) {
      for (const configId of knownConfigs) {
        if (!this._knownConfigs.has(configId)) {
          this._knownConfigs.set(configId, { configId });
        }
      }
    }
  }

  async getActiveConfiguration() {
    const behavior = this._getActiveBehaviorQueue?.shift();
    if (behavior?.type === 'returnNull') {
      this.getActiveCalls.push({ behavior: 'returnNull' });
      this._activeConfig = null;
      return null;
    }
    if (behavior?.type === 'throw') {
      this.getActiveCalls.push({ behavior: 'throw', message: behavior.message });
      throw new Error(behavior.message || 'Configuration lookup failed');
    }

    this.getActiveCalls.push({ configId: this._activeConfig?.configId || null });
    return this._activeConfig;
  }

  async setActiveConfiguration(configId) {
    this.setCalls.push(configId);
    if (this._setShouldFailFor.has(configId)) {
      return false;
    }
    if (this._knownConfigs.has(configId)) {
      this._activeConfig = this._knownConfigs.get(configId);
      return true;
    }
    return false;
  }

  async loadConfiguration(configId) {
    this.loadCalls.push(configId);
    if (this._loadReturnsNullFor.has(configId)) {
      return null;
    }
    const config = this._knownConfigs.get(configId) || { configId };
    this._knownConfigs.set(configId, config);
    this._activeConfig = config;
    return config;
  }
}

class DeterministicTokenEstimator {
  constructor(divisor = 9) {
    this._divisor = divisor;
    this.calls = [];
  }

  async estimateTokens(text, model) {
    this.calls.push({ text, model });
    return Math.ceil(text.length / this._divisor);
  }
}

class FlakyTokenEstimator {
  constructor({ throwOnCalls = 1, divisor = 7 } = {}) {
    this._divisor = divisor;
    this._throwsRemaining = throwOnCalls;
    this.calls = [];
  }

  async estimateTokens(text, model) {
    this.calls.push({ text, model });
    if (this._throwsRemaining > 0) {
      this._throwsRemaining -= 1;
      throw new Error('Token estimation service unavailable');
    }
    return Math.ceil(text.length / this._divisor);
  }
}

/**
 *
 * @param root0
 * @param root0.responses
 * @param root0.tokenEstimator
 * @param root0.configManagerOptions
 */
async function createGeneratorHarness({
  responses,
  tokenEstimator,
  configManagerOptions,
} = {}) {
  const logger = createTestLogger();
  const registry = new InMemoryDataRegistry({ logger });

  const schemaValidator = new AjvSchemaValidator({ logger });
  await schemaValidator.addSchema(COMMON_SCHEMA, COMMON_SCHEMA.$id);
  await schemaValidator.addSchema(EVENT_SCHEMA, EVENT_SCHEMA.$id);

  for (const [eventId, definition] of Object.entries(EVENT_DEFINITIONS)) {
    const definitionClone = JSON.parse(JSON.stringify(definition));
    registry.store('events', eventId, definitionClone);
    if (definitionClone.payloadSchema) {
      const payloadSchemaId = `${eventId}#payload`;
      await schemaValidator.addSchema(
        { $id: payloadSchemaId, ...definitionClone.payloadSchema },
        payloadSchemaId
      );
    }
  }

  const gameDataRepository = new GameDataRepository(registry, logger);
  const eventBus = new EventBus({ logger });
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator,
    logger,
  });
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });

  const llmJsonService = new LlmJsonService();
  const strategyFactory = new TestLLMStrategyFactory(responses);
  const configManager = new TestLLMConfigManager(configManagerOptions);

  const generator = new CoreMotivationsGenerator({
    logger,
    llmJsonService,
    llmStrategyFactory: strategyFactory,
    llmConfigManager: configManager,
    eventBus: safeDispatcher,
    tokenEstimator,
  });

  const capturedEvents = [];
  const unsubscribers = [
    eventBus.subscribe('core:core_motivations_generation_started', (event) => {
      capturedEvents.push(event);
    }),
    eventBus.subscribe(
      'core:core_motivations_generation_completed',
      (event) => {
        capturedEvents.push(event);
      }
    ),
    eventBus.subscribe('core:core_motivations_generation_failed', (event) => {
      capturedEvents.push(event);
    }),
  ].filter(Boolean);

  return {
    generator,
    logger,
    strategyFactory,
    configManager,
    tokenEstimator,
    capturedEvents,
    cleanup() {
      unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    },
  };
}

/**
 *
 * @param events
 */
function extractEventTypes(events) {
  return events.map((event) => event.type);
}

/**
 *
 * @param value
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('CoreMotivationsGenerator - real service integration', () => {
  const activeCleanups = [];

  afterEach(() => {
    while (activeCleanups.length > 0) {
      const cleanup = activeCleanups.pop();
      cleanup();
    }
    jest.clearAllMocks();
  });

  it('generates core motivations with production collaborators and detailed metadata', async () => {
    const validResponse = buildHighQualityResponse();
    const responseText = JSON.stringify(validResponse);
    const tokenEstimator = new DeterministicTokenEstimator(9);
    const harness = await createGeneratorHarness({
      responses: [responseText],
      tokenEstimator,
    });
    activeCleanups.push(harness.cleanup);

    const concept = createSampleConcept();
    const direction = createSampleDirection();
    const cliches = createSampleCliches();

    const motivations = await harness.generator.generate({
      concept,
      direction,
      clichés: cliches,
    });

    expect(motivations).toHaveLength(3);
    motivations.forEach((motivation) => {
      expect(motivation).toBeInstanceOf(CoreMotivation);
      expect(motivation.metadata.promptVersion).toBe(
        PROMPT_VERSION_INFO.version
      );
    });

    const promptUsed = harness.strategyFactory.calls[0].prompt;
    const expectedPromptTokens = Math.ceil(promptUsed.length / 9);
    const expectedResponseTokens = Math.ceil(
      JSON.stringify(validResponse).length / 9
    );

    expect(motivations[0].metadata.promptTokens).toBe(expectedPromptTokens);
    expect(motivations[0].metadata.responseTokens).toBe(
      expectedResponseTokens
    );
    expect(motivations[0].metadata.totalTokens).toBe(
      expectedPromptTokens + expectedResponseTokens
    );
    expect(motivations[0].metadata.clicheIds).toEqual([
      'personalityTraits_0',
      'personalityTraits_1',
      'genericGoals_0',
      'genericGoals_1',
      'overusedSecrets_0',
      'overusedSecrets_1',
      'trope_0',
      'trope_1',
    ]);

    expect(harness.tokenEstimator.calls).toHaveLength(2);
    expect(harness.strategyFactory.calls[0].options).toMatchObject({
      toolSchema: CORE_MOTIVATIONS_RESPONSE_SCHEMA,
      toolName: 'generate_core_motivations',
    });

    const eventTypes = extractEventTypes(harness.capturedEvents);
    expect(eventTypes).toEqual([
      'core:core_motivations_generation_started',
      'core:core_motivations_generation_completed',
    ]);

    const completedEvent = harness.capturedEvents[1];
    expect(completedEvent.payload.conceptId).toBe(concept.id);
    expect(completedEvent.payload.directionId).toBe(direction.id);
    expect(completedEvent.payload.motivationIds).toHaveLength(3);
    expect(completedEvent.payload.totalCount).toBe(3);

    const rebuiltPrompt = buildCoreMotivationsGenerationPrompt(
      concept.concept,
      direction,
      cliches
    );
    expect(rebuiltPrompt).toBe(promptUsed);
  });

  it('falls back to heuristic token estimation when no estimator is provided', async () => {
    const validResponse = buildHighQualityResponse();
    const responseText = JSON.stringify(validResponse);
    const harness = await createGeneratorHarness({
      responses: [responseText],
      tokenEstimator: undefined,
    });
    activeCleanups.push(harness.cleanup);

    const concept = createSampleConcept();
    const direction = createSampleDirection();
    const cliches = createSampleCliches();

    const motivations = await harness.generator.generate({
      concept,
      direction,
      clichés: cliches,
    });

    const promptUsed = harness.strategyFactory.calls[0].prompt;
    const expectedPromptTokens = Math.ceil(promptUsed.length / 4);
    const expectedResponseTokens = Math.ceil(
      JSON.stringify(validResponse).length / 4
    );

    expect(motivations[0].metadata.promptTokens).toBe(expectedPromptTokens);
    expect(motivations[0].metadata.responseTokens).toBe(
      expectedResponseTokens
    );
    expect(motivations[0].metadata.totalTokens).toBe(
      expectedPromptTokens + expectedResponseTokens
    );
  });

  it('recovers from token estimator outages by using fallback values', async () => {
    const validResponse = buildHighQualityResponse();
    const responseText = JSON.stringify(validResponse);
    const tokenEstimator = new FlakyTokenEstimator({ throwOnCalls: 1, divisor: 6 });
    const harness = await createGeneratorHarness({
      responses: [responseText],
      tokenEstimator,
    });
    activeCleanups.push(harness.cleanup);

    const concept = createSampleConcept();
    const direction = createSampleDirection();
    const cliches = createSampleCliches();

    const motivations = await harness.generator.generate({
      concept,
      direction,
      clichés: cliches,
    });

    const promptUsed = harness.strategyFactory.calls[0].prompt;
    const expectedPromptTokens = Math.ceil(promptUsed.length / 4);
    const expectedResponseTokens = Math.ceil(
      JSON.stringify(validResponse).length / 6
    );

    expect(motivations[0].metadata.promptTokens).toBe(expectedPromptTokens);
    expect(motivations[0].metadata.responseTokens).toBe(
      expectedResponseTokens
    );
    expect(tokenEstimator.calls.length).toBeGreaterThanOrEqual(2);
    expect(harness.logger.warn).toHaveBeenCalledWith(
      'CoreMotivationsGenerator: Token estimation failed, using fallback',
      expect.objectContaining({ textLength: promptUsed.length })
    );
  });

  it('rejects low quality responses and emits a failure event', async () => {
    const lowQualityResponse = buildLowQualityResponse();
    const responseText = JSON.stringify(lowQualityResponse);
    const harness = await createGeneratorHarness({
      responses: [responseText],
    });
    activeCleanups.push(harness.cleanup);

    const concept = createSampleConcept();
    const direction = createSampleDirection();
    const cliches = createSampleCliches();

    await expect(
      harness.generator.generate({
        concept,
        direction,
        clichés: cliches,
      })
    ).rejects.toThrow(/Response quality issues/);

    const eventTypes = extractEventTypes(harness.capturedEvents);
    expect(eventTypes).toEqual([
      'core:core_motivations_generation_started',
      'core:core_motivations_generation_failed',
    ]);

    const failureEvent = harness.capturedEvents[1];
    expect(failureEvent.payload.failureStage).toBe('quality_validation');
    expect(failureEvent.payload.error).toContain('quality issues');
  });

  it('classifies parsing failures after exhausting retries', async () => {
    const malformedResponse = '{ not valid json';
    const harness = await createGeneratorHarness({
      responses: [malformedResponse],
    });
    activeCleanups.push(harness.cleanup);

    const concept = createSampleConcept();
    const direction = createSampleDirection();
    const cliches = createSampleCliches();

    await expect(
      harness.generator.generate({
        concept,
        direction,
        clichés: cliches,
      })
    ).rejects.toThrow(/Failed to parse LLM response: .*after 3 attempts/);

    expect(harness.strategyFactory.calls.length).toBe(3);

    const eventTypes = extractEventTypes(harness.capturedEvents);
    expect(eventTypes).toEqual([
      'core:core_motivations_generation_started',
      'core:core_motivations_generation_failed',
    ]);

    const failureEvent = harness.capturedEvents[1];
    expect(failureEvent.payload.failureStage).toBe('response_parsing');
  });

  it('loads configuration when activation requires fetching the definition', async () => {
    const validResponse = buildHighQualityResponse();
    const responseText = JSON.stringify(validResponse);
    const harness = await createGeneratorHarness({
      responses: [responseText],
      configManagerOptions: {
        knownConfigs: ['specialized-model'],
        setShouldFailFor: ['specialized-model'],
      },
    });
    activeCleanups.push(harness.cleanup);

    const concept = createSampleConcept();
    const direction = createSampleDirection();
    const cliches = createSampleCliches();

    const motivations = await harness.generator.generate(
      {
        concept,
        direction,
        clichés: cliches,
      },
      { llmConfigId: 'specialized-model' }
    );

    expect(motivations).toHaveLength(3);
    expect(harness.configManager.setCalls).toContain('specialized-model');
    expect(harness.configManager.loadCalls).toContain('specialized-model');
  });

  it('detects configuration failures occurring after LLM execution', async () => {
    const validResponse = buildHighQualityResponse();
    const responseText = JSON.stringify(validResponse);
    const harness = await createGeneratorHarness({
      responses: [responseText],
      configManagerOptions: {
        getActiveBehavior: [
          { type: 'default' },
          { type: 'throw', message: 'Configuration lookup failed' },
          { type: 'default' },
          { type: 'throw', message: 'Configuration lookup failed' },
          { type: 'default' },
          { type: 'throw', message: 'Configuration lookup failed' },
        ],
      },
    });
    activeCleanups.push(harness.cleanup);

    const concept = createSampleConcept();
    const direction = createSampleDirection();
    const cliches = createSampleCliches();

    await expect(
      harness.generator.generate({
        concept,
        direction,
        clichés: cliches,
      })
    ).rejects.toThrow(/Configuration lookup failed/);

    const failureEvent = harness.capturedEvents.find(
      (event) => event.type === 'core:core_motivations_generation_failed'
    );
    expect(failureEvent.payload.failureStage).toBe('configuration');
  });

  it('derives failure stage from nested CoreMotivationsGenerationError causes', async () => {
    const harness = await createGeneratorHarness({
      responses: [() => {
        throw new CoreMotivationsGenerationError(
          'outer stage',
          new Error('Network unreachable during request')
        );
      }],
    });
    activeCleanups.push(harness.cleanup);

    const concept = createSampleConcept();
    const direction = createSampleDirection();
    const cliches = createSampleCliches();

    await expect(
      harness.generator.generate({
        concept,
        direction,
        clichés: cliches,
      })
    ).rejects.toThrow(/outer stage/);

    const failureEvent = harness.capturedEvents.find(
      (event) => event.type === 'core:core_motivations_generation_failed'
    );
    expect(failureEvent.payload.failureStage).toBe('llm_request');
  });

  it.each([
    {
      name: 'missing concept object',
      mutate: (payload) => {
        payload.concept = null;
      },
      error: 'concept must be a valid object',
    },
    {
      name: 'missing concept id',
      mutate: (payload) => {
        payload.concept.id = '  ';
      },
      error: 'concept.id must be a non-empty string',
    },
    {
      name: 'missing concept text',
      mutate: (payload) => {
        payload.concept.concept = '';
      },
      error: 'concept.concept must be a non-empty string',
    },
    {
      name: 'missing direction object',
      mutate: (payload) => {
        payload.direction = undefined;
      },
      error: 'direction must be a valid object',
    },
    {
      name: 'missing direction id',
      mutate: (payload) => {
        payload.direction.id = '';
      },
      error: 'direction.id must be a non-empty string',
    },
    {
      name: 'missing cliches object',
      mutate: (payload) => {
        payload.clichés = null;
      },
      error: 'clichés must be a valid object',
    },
  ])('validates inputs before dispatch ($name)', async ({ mutate, error }) => {
    const harness = await createGeneratorHarness({
      responses: [JSON.stringify(buildHighQualityResponse())],
    });
    activeCleanups.push(harness.cleanup);

    const payload = {
      concept: createSampleConcept(),
      direction: createSampleDirection(),
      clichés: createSampleCliches(),
    };
    mutate(payload);

    await expect(
      harness.generator.generate(payload)
    ).rejects.toThrow(error);

    expect(harness.capturedEvents).toHaveLength(0);
  });

  it('exposes prompt metadata accessors for external tooling', () => {
    const harness = {
      generator: new CoreMotivationsGenerator({
        logger: createTestLogger(),
        llmJsonService: new LlmJsonService(),
        llmStrategyFactory: { getAIDecision: async () => '{}' },
        llmConfigManager: {
          loadConfiguration: async () => null,
          getActiveConfiguration: async () => ({ configId: 'default' }),
          setActiveConfiguration: async () => true,
        },
        eventBus: { dispatch: async () => {} },
      }),
    };

    expect(harness.generator.getResponseSchema()).toBe(
      CORE_MOTIVATIONS_RESPONSE_SCHEMA
    );
    expect(harness.generator.getLLMParameters()).toEqual(
      expect.objectContaining({ temperature: expect.any(Number) })
    );
    expect(harness.generator.getPromptVersionInfo()).toBe(
      PROMPT_VERSION_INFO
    );
  });
});

