import { describe, it, expect, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TraitsGenerator } from '../../../../src/characterBuilder/services/TraitsGenerator.js';
import { LlmJsonService } from '../../../../src/llms/llmJsonService.js';
import { GameDataRepository } from '../../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import EventBus from '../../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import { TraitsGenerationError } from '../../../../src/characterBuilder/errors/TraitsGenerationError.js';
import { NoDelayRetryManager } from '../../../common/mocks/noDelayRetryManager.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDir, '../../../..');

const EVENT_FILES = {
  'core:traits_generation_started': 'data/mods/core/events/traits_generation_started.event.json',
  'core:traits_generation_completed': 'data/mods/core/events/traits_generation_completed.event.json',
  'core:traits_generation_failed': 'data/mods/core/events/traits_generation_failed.event.json',
};

const EVENT_DEFINITIONS = Object.fromEntries(
  Object.entries(EVENT_FILES).map(([eventId, relativePath]) => {
    const absolutePath = path.resolve(repoRoot, relativePath);
    const contents = fs.readFileSync(absolutePath, 'utf8');
    return [eventId, JSON.parse(contents)];
  })
);

const EVENT_SCHEMA = JSON.parse(
  fs.readFileSync(
    path.resolve(repoRoot, 'data/schemas/event.schema.json'),
    'utf8'
  )
);

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
    const behavior =
      this._responses[Math.min(callIndex, this._responses.length - 1)];

    if (typeof behavior === 'function') {
      return await behavior({ prompt, options, callIndex });
    }

    return behavior;
  }
}

class TestLLMConfigManager {
  constructor({ initialActiveConfigId = 'default-model', knownConfigs } = {}) {
    this.setCalls = [];
    this.loadCalls = [];
    this._knownConfigs = new Map();

    const initialConfig = { configId: initialActiveConfigId };
    this._knownConfigs.set(initialActiveConfigId, initialConfig);

    if (knownConfigs) {
      for (const configId of knownConfigs) {
        this._knownConfigs.set(configId, { configId });
      }
    }

    this._activeConfig = initialConfig;
    this._failedLoads = new Set();
  }

  registerConfig(configId) {
    const config = { configId };
    this._knownConfigs.set(configId, config);
    return config;
  }

  markLoadFailure(configId) {
    this._failedLoads.add(configId);
  }

  async getActiveConfiguration() {
    return this._activeConfig;
  }

  async setActiveConfiguration(configId) {
    this.setCalls.push(configId);
    if (this._knownConfigs.has(configId)) {
      this._activeConfig = this._knownConfigs.get(configId);
      return true;
    }
    return false;
  }

  async loadConfiguration(configId) {
    this.loadCalls.push(configId);
    if (this._failedLoads.has(configId)) {
      return null;
    }
    const config = this._knownConfigs.get(configId) || { configId };
    this._knownConfigs.set(configId, config);
    this._activeConfig = config;
    return config;
  }
}

class DeterministicTokenEstimator {
  constructor(divisor = 7) {
    this.calls = [];
    this._divisor = divisor;
  }

  async estimateTokens(text, model) {
    this.calls.push({ text, model });
    return Math.ceil(text.length / this._divisor);
  }
}

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
function buildValidTraitsResponse() {
  const profileText = createLongText(
    'He keeps meticulous journals that chronicle every strategic insight, emotional setback, and fragile victory, revisiting them nightly to ensure he never repeats the mistakes that once cost him his command.',
    260
  );
  const descriptionText = createLongText(
    'A weathered strategist with deliberate movements, carrying silvered scars across a disciplined frame and eyes that constantly assess the balance of every room he enters.',
    140
  );

  return {
    names: [
      {
        name: 'Cedric Holloway',
        justification: createLongText(
          'Chosen to evoke a storied lineage and the hollow echo of past regrets that now motivate his disciplined compassion.',
          70
        ),
      },
      {
        name: 'Bastian Mirecourt',
        justification: createLongText(
          'Reflects the mire of difficult choices he has navigated and the courteous persona he wields as armor in courtly intrigue.',
          70
        ),
      },
      {
        name: 'Orin Thales',
        justification: createLongText(
          'A deliberate name that suggests philosophical depth and the enduring patience he applies to rebuilding trust with allies.',
          70
        ),
      },
    ],
    physicalDescription: descriptionText,
    personality: [
      {
        trait: 'Measured Compassion',
        explanation: createLongText(
          'He offers guidance with gentle precision, ensuring those around him feel supported while never allowing sentiment to undermine strategic clarity.',
          120
        ),
        behavioral_examples: [
          'Keeps informal debriefs after tense missions to reassure allies.',
          'Shares quietly encouraging stories from his past when morale dips.',
        ],
      },
      {
        trait: 'Strategic Restraint',
        explanation: createLongText(
          'Years of command taught him that holding back can be the most decisive action, so he constantly evaluates ripple effects before committing to any bold move.',
          120
        ),
        behavioral_examples: [
          'Requests a full accounting of resources before approving campaigns.',
          'Defers retaliation until he can dismantle an opponent without collateral damage.',
        ],
      },
      {
        trait: 'Quiet Resolve',
        explanation: createLongText(
          'Despite the scars of failure, he maintains a steady composure that inspires confidence, revealing vulnerability only when it serves to strengthen trust.',
          120
        ),
        behavioral_examples: [
          'Invites confidants to morning strategy walks that double as mutual check-ins.',
          'Maintains composure under provocation, choosing decisive action only after calm analysis.',
        ],
      },
    ],
    strengths: [
      'Unwavering commitment to ally safety',
      'Extensive tactical memory informed by past mistakes',
      'Ability to coordinate complex alliances quickly',
    ],
    weaknesses: [
      'Haunted by the loss of former comrades',
      'Instinct to shoulder burdens alone until exhaustion sets in',
    ],
    likes: [
      'Meticulous morning tea rituals that center his focus',
      'Archival research into forgotten diplomatic accords',
      'Cooking elaborate meals to honor fallen companions',
    ],
    dislikes: [
      'Political manipulation that disregards collateral damage',
      'Empty bravado unbacked by responsibility',
      'Carelessness with sacred promises or oaths',
    ],
    fears: [
      'Failing to protect the allies who have rebuilt their trust in him',
    ],
    goals: {
      shortTerm: [
        'Secure an alliance with the fractured border sentinels',
        'Rebuild the confidence of his newest recruits through shared victories',
      ],
      longTerm:
        'Can he restore the honor he lost decades ago and build a sanctuary where no ally faces abandonment again?',
    },
    notes: [
      'Keeps a weathered signet ring that once represented his command, wearing it only during critical negotiations.',
      'Secretly funds memorial scholarships for families impacted by his past failures.',
    ],
    profile: profileText,
    secrets: [
      'He covertly corresponded with the adversary who ruined his career to prevent an even greater catastrophe.',
    ],
  };
}

/**
 *
 */
function buildQualityIssueResponse() {
  const base = buildValidTraitsResponse();
  return {
    ...base,
    names: base.names.map((entry, index) => ({
      ...entry,
      justification: index === 0 ? 'Too short' : entry.justification,
    })),
  };
}

/**
 *
 */
function buildConcept() {
  return {
    id: 'concept-heroic-redemption',
    concept:
      'A once-disgraced commander seeking to protect a fragile coalition from collapsing into war.',
  };
}

/**
 *
 */
function buildDirection() {
  return {
    id: 'direction-path-of-restoration',
    title: 'The Path of Restoration',
    description:
      'Explores the tension between atonement and the fear that past mistakes will repeat.',
    coreTension: 'Duty to others versus self-forgiveness.',
  };
}

/**
 *
 */
function buildUserInputs() {
  return {
    coreMotivation: 'To protect every ally who places trust in them.',
    internalContradiction:
      'Craves genuine connection yet hides behind strategic distance.',
    centralQuestion: 'Will sacrifice finally balance the scales of past failure?',
  };
}

/**
 *
 */
function buildCliches() {
  return {
    categories: {
      redemption: ['Brooding hero who refuses to forgive himself'],
    },
    tropesAndStereotypes: ['Lone wolf who pushes allies away to keep them safe'],
  };
}

/**
 *
 * @param root0
 * @param root0.responses
 * @param root0.tokenEstimator
 * @param root0.configManagerOptions
 */
async function createTraitsGeneratorHarness({
  responses,
  tokenEstimator,
  configManagerOptions,
} = {}) {
  const logger = createTestLogger();
  const registry = new InMemoryDataRegistry({ logger });

  const schemaValidator = new AjvSchemaValidator({ logger });
  await schemaValidator.addSchema(EVENT_SCHEMA, EVENT_SCHEMA.$id);

  for (const eventId of Object.keys(EVENT_DEFINITIONS)) {
    const definition = JSON.parse(JSON.stringify(EVENT_DEFINITIONS[eventId]));
    if (
      definition.id === 'core:traits_generation_failed' &&
      definition.payloadSchema?.properties?.failureStage?.enum
    ) {
      const enumValues = definition.payloadSchema.properties.failureStage.enum;
      const stagesToEnsure = [
        'response_parsing',
        'quality_validation',
        'processing',
      ];
      for (const stage of stagesToEnsure) {
        if (!enumValues.includes(stage)) {
          enumValues.push(stage);
        }
      }
    }
    registry.store('events', eventId, definition);
    if (definition.payloadSchema) {
      const payloadSchemaId = `${eventId}#payload`;
      await schemaValidator.addSchema(
        { $id: payloadSchemaId, ...definition.payloadSchema },
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
  const retryManager = new NoDelayRetryManager();

  const traitsGenerator = new TraitsGenerator({
    logger,
    llmJsonService,
    llmStrategyFactory: strategyFactory,
    llmConfigManager: configManager,
    eventBus: safeDispatcher,
    tokenEstimator,
    retryManager,
  });

  const capturedEvents = [];
  eventBus.subscribe('*', (event) => {
    capturedEvents.push(event);
  });

  return {
    traitsGenerator,
    capturedEvents,
    strategyFactory,
    configManager,
    logger,
  };
}

/**
 *
 */
async function waitForDispatchResolution() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('TraitsGenerator real module integration', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('generates traits end-to-end with real event validation and metadata tracking', async () => {
    const validResponse = buildValidTraitsResponse();
    const responses = [() => JSON.stringify(validResponse)];
    const tokenEstimator = new DeterministicTokenEstimator(9);

    const harness = await createTraitsGeneratorHarness({
      responses,
      tokenEstimator,
      configManagerOptions: { initialActiveConfigId: 'default-model' },
    });

    const concept = buildConcept();
    const direction = buildDirection();
    const userInputs = buildUserInputs();
    const cliches = buildCliches();

    const result = await harness.traitsGenerator.generateTraits(
      { concept, direction, userInputs, cliches },
      { llmConfigId: 'alternate-model', maxRetries: 0 }
    );

    await waitForDispatchResolution();

    expect(result.names).toHaveLength(3);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.model).toBe('alternate-model');
    expect(result.metadata.totalTokens).toBe(
      result.metadata.promptTokens + result.metadata.responseTokens
    );
    expect(tokenEstimator.calls.length).toBeGreaterThanOrEqual(2);

    expect(harness.strategyFactory.calls).toHaveLength(1);
    expect(harness.strategyFactory.calls[0].prompt).toContain(concept.concept);
    expect(harness.configManager.setCalls).toContain('alternate-model');
    expect(harness.configManager.loadCalls).toContain('alternate-model');

    const eventNames = harness.capturedEvents.map((event) => event.type);
    expect(eventNames).toEqual([
      'core:traits_generation_started',
      'core:traits_generation_completed',
    ]);

    const completedEvent = harness.capturedEvents[1];
    expect(completedEvent.payload.metadata.totalTokens).toBe(
      result.metadata.totalTokens
    );
    expect(completedEvent.payload.metadata.promptVersion).toBeDefined();
  });

  it('dispatches structured failure events when parsing fails', async () => {
    const responses = [() => 'not valid json'];
    const harness = await createTraitsGeneratorHarness({
      responses,
      configManagerOptions: { initialActiveConfigId: 'default-model' },
    });

    const concept = buildConcept();
    const direction = buildDirection();
    const userInputs = buildUserInputs();
    const cliches = buildCliches();

    await expect(
      harness.traitsGenerator.generateTraits(
        { concept, direction, userInputs, cliches },
        { llmConfigId: 'alternate-model', maxRetries: 0 }
      )
    ).rejects.toBeInstanceOf(TraitsGenerationError);

    await waitForDispatchResolution();

    expect(harness.capturedEvents[0].type).toBe(
      'core:traits_generation_started'
    );
    const failureEvent = harness.capturedEvents.find(
      (event) => event.type === 'core:traits_generation_failed'
    );
    expect(failureEvent).toBeDefined();
    expect(failureEvent.payload.failureStage).toBe('response_parsing');
  });

  it('reports quality validation issues through failure events', async () => {
    const qualityIssueResponse = buildQualityIssueResponse();
    const responses = [() => JSON.stringify(qualityIssueResponse)];
    const harness = await createTraitsGeneratorHarness({
      responses,
      configManagerOptions: { initialActiveConfigId: 'default-model' },
    });

    const concept = buildConcept();
    const direction = buildDirection();
    const userInputs = buildUserInputs();
    const cliches = buildCliches();

    await expect(
      harness.traitsGenerator.generateTraits(
        { concept, direction, userInputs, cliches },
        { llmConfigId: 'alternate-model', maxRetries: 0 }
      )
    ).rejects.toBeInstanceOf(TraitsGenerationError);

    await waitForDispatchResolution();

    const failureEvent = harness.capturedEvents.find(
      (event) => event.type === 'core:traits_generation_failed'
    );
    expect(failureEvent).toBeDefined();
    expect(failureEvent.payload.failureStage).toBe('quality_validation');
    expect(failureEvent.payload.error).toContain('Response quality issues');
  });

  it('aborts before dispatching events when validation fails', async () => {
    const responses = [() => JSON.stringify(buildValidTraitsResponse())];
    const harness = await createTraitsGeneratorHarness({
      responses,
      configManagerOptions: { initialActiveConfigId: 'default-model' },
    });

    const concept = buildConcept();
    const invalidDirection = { ...buildDirection(), title: '' };
    const userInputs = buildUserInputs();
    const cliches = buildCliches();

    await expect(
      harness.traitsGenerator.generateTraits(
        { concept, direction: invalidDirection, userInputs, cliches },
        { llmConfigId: 'default-model', maxRetries: 0 }
      )
    ).rejects.toThrow(/Validation failed/);

    await waitForDispatchResolution();

    expect(harness.capturedEvents).toHaveLength(0);
    expect(harness.strategyFactory.calls).toHaveLength(0);
    expect(harness.configManager.setCalls).toHaveLength(0);
  });

  it('retries transient failures and falls back to heuristic token estimation', async () => {
    const immediateTimer = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((callback) => {
        if (typeof callback === 'function') {
          callback();
        }
        return 0;
      });
    const clearTimer = jest
      .spyOn(global, 'clearTimeout')
      .mockImplementation(() => {});

    try {
      const validResponse = buildValidTraitsResponse();
      const responses = [
        () => {
          throw new Error('temporary issue');
        },
        () => JSON.stringify(validResponse),
      ];

      const harness = await createTraitsGeneratorHarness({
        responses,
        configManagerOptions: { initialActiveConfigId: 'default-model' },
      });

      const concept = buildConcept();
      const direction = buildDirection();
      const userInputs = buildUserInputs();
      const cliches = buildCliches();

      const result = await harness.traitsGenerator.generateTraits(
        { concept, direction, userInputs, cliches },
        { llmConfigId: 'default-model', maxRetries: 1 }
      );

      await waitForDispatchResolution();

      expect(result.metadata.totalTokens).toBeGreaterThan(0);
      expect(harness.strategyFactory.calls).toHaveLength(2);
      expect(harness.capturedEvents.map((event) => event.type)).toEqual([
        'core:traits_generation_started',
        'core:traits_generation_completed',
      ]);
    } finally {
      immediateTimer.mockRestore();
      clearTimer.mockRestore();
    }
  });
});
