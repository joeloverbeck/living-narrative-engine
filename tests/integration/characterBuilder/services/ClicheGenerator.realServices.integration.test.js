import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ClicheGenerator,
  ClicheGenerationError,
} from '../../../../src/characterBuilder/services/ClicheGenerator.js';
import { LlmJsonService } from '../../../../src/llms/llmJsonService.js';
import { PROMPT_VERSION_INFO } from '../../../../src/characterBuilder/prompts/clicheGenerationPrompt.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  info(message, context) {
    this.infoMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
  }

  error(message, context) {
    this.errorMessages.push({ message, context });
  }
}

class TestLLMStrategyFactory {
  constructor(responses) {
    this._responses = Array.isArray(responses) ? responses : [responses];
    this.calls = [];
  }

  async getAIDecision(prompt, _abortSignal, options) {
    const callIndex = this.calls.length;
    this.calls.push({ prompt, options });

    const behavior =
      this._responses[Math.min(callIndex, this._responses.length - 1)];

    if (behavior instanceof Error) {
      throw behavior;
    }

    if (typeof behavior === 'function') {
      return await behavior({ prompt, options, callIndex });
    }

    return behavior;
  }
}

class TestLLMConfigManager {
  constructor({ activeConfigId = 'primary-model', preloadConfigs = [] } = {}) {
    this.setCalls = [];
    this.loadCalls = [];
    this._configs = new Map();
    this._failLoads = new Set();

    const activeConfig = { configId: activeConfigId };
    this._configs.set(activeConfigId, activeConfig);
    this._activeConfig = activeConfig;

    for (const configId of preloadConfigs) {
      this._configs.set(configId, { configId });
    }
  }

  registerConfig(configId, config = { configId }) {
    this._configs.set(configId, config);
    return config;
  }

  failLoadOnce(configId) {
    this._failLoads.add(configId);
  }

  async getActiveConfiguration() {
    return this._activeConfig;
  }

  async setActiveConfiguration(configId) {
    this.setCalls.push(configId);
    if (this._configs.has(configId)) {
      this._activeConfig = this._configs.get(configId);
      return true;
    }
    return false;
  }

  async loadConfiguration(configId) {
    this.loadCalls.push(configId);
    if (this._failLoads.has(configId)) {
      this._failLoads.delete(configId);
      return null;
    }
    if (!this._configs.has(configId)) {
      this.registerConfig(configId);
    }
    this._activeConfig = this._configs.get(configId);
    return this._activeConfig;
  }
}

function buildValidResponse({ tropesCount = 5, categoryItemCount = 3 } = {}) {
  const makeItems = (prefix) =>
    Array.from(
      { length: categoryItemCount },
      (_, index) => `${prefix} ${index + 1}`
    );

  return {
    categories: {
      names: makeItems('Name'),
      physicalDescriptions: makeItems('Physical'),
      personalityTraits: makeItems('Trait'),
      skillsAbilities: makeItems('Skill'),
      typicalLikes: makeItems('Like'),
      typicalDislikes: makeItems('Dislike'),
      commonFears: makeItems('Fear'),
      genericGoals: makeItems('Goal'),
      backgroundElements: makeItems('Background'),
      overusedSecrets: makeItems('Secret'),
      speechPatterns: makeItems('Speech'),
    },
    tropesAndStereotypes: Array.from(
      { length: tropesCount },
      (_, index) => `Trope ${index + 1}`
    ),
  };
}

describe('ClicheGenerator integration with real collaborators', () => {
  let logger;
  let llmJsonService;

  beforeEach(() => {
    logger = new TestLogger();
    llmJsonService = new LlmJsonService();
  });

  it('generates clichés with standard prompt and aggregates metadata', async () => {
    const configManager = new TestLLMConfigManager({
      activeConfigId: 'primary',
    });
    const responsePayload = buildValidResponse();
    const llmFactory = new TestLLMStrategyFactory([
      JSON.stringify(responsePayload),
    ]);

    const generator = new ClicheGenerator({
      logger,
      llmJsonService,
      llmStrategyFactory: llmFactory,
      llmConfigManager: configManager,
    });

    const direction = {
      title: 'Stoic Guardian',
      description: 'A disciplined protector struggling with vulnerability.',
      coreTension: 'Duty versus personal needs',
      uniqueTwist: 'Harbors a forbidden talent',
      narrativePotential: 'Redemption through partnership',
    };

    const result = await generator.generateCliches(
      'concept-123',
      'An elite bodyguard with a hidden artistic calling.',
      direction,
      { llmConfigId: 'alternate-model' }
    );

    expect(result.categories.names).toEqual(responsePayload.categories.names);
    expect(result.tropesAndStereotypes).toHaveLength(5);
    expect(result.metadata.model).toBe('alternate-model');
    expect(result.metadata.promptVersion).toBe('1.0.0');
    expect(typeof result.metadata.tokens).toBe('number');
    expect(result.metadata.tokens).toBeGreaterThan(0);

    expect(configManager.setCalls).toEqual(['alternate-model']);
    expect(configManager.loadCalls).toEqual(['alternate-model']);
    expect(llmFactory.calls[0].options.toolSchema).toBeDefined();
    expect(
      logger.infoMessages.some((entry) =>
        entry.message.includes('Successfully generated clichés')
      )
    ).toBe(true);

    expect(generator.validateResponse(responsePayload)).toBeTruthy();
    expect(generator.getResponseSchema()).toBeDefined();
    expect(generator.getPromptVersionInfo()).toBe(PROMPT_VERSION_INFO);
    expect(generator.getDefaultEnhancementOptions()).toMatchObject({
      includeFewShotExamples: false,
      enableAdvancedValidation: true,
    });
  });

  it('uses enhanced prompt with advanced validation and surfaces warnings', async () => {
    const configManager = new TestLLMConfigManager({
      activeConfigId: 'creative-model',
    });
    const sparseResponse = buildValidResponse({
      tropesCount: 2,
      categoryItemCount: 1,
    });
    const llmFactory = new TestLLMStrategyFactory([
      JSON.stringify(sparseResponse),
    ]);

    const generator = new ClicheGenerator({
      logger,
      llmJsonService,
      llmStrategyFactory: llmFactory,
      llmConfigManager: configManager,
    });

    const result = await generator.generateEnhancedCliches(
      'concept-enhanced',
      'A charismatic thief turned reluctant hero.',
      {
        title: 'Reluctant Legend',
        description: 'A famed thief forced into heroism for the greater good.',
        coreTension: 'Freedom versus responsibility',
      },
      { genre: 'fantasy' }
    );

    expect(result.metadata.promptVersion).toBe(PROMPT_VERSION_INFO.version);
    expect(result.metadata.model).toBe('creative-model');
    expect(
      logger.warnMessages.some((entry) =>
        entry.message.includes('Quality warnings detected')
      )
    ).toBe(true);
    expect(llmFactory.calls[0].options.toolSchema).toBeDefined();
    expect(llmFactory.calls[0].options.toolName).toBe(
      'generate_character_cliches'
    );
  });

  it('falls back to structural validation when advanced validation disabled', async () => {
    const configManager = new TestLLMConfigManager({
      activeConfigId: 'balanced-model',
    });
    const responsePayload = buildValidResponse({
      tropesCount: 6,
      categoryItemCount: 4,
    });
    const llmFactory = new TestLLMStrategyFactory([
      JSON.stringify(responsePayload),
    ]);

    const generator = new ClicheGenerator({
      logger,
      llmJsonService,
      llmStrategyFactory: llmFactory,
      llmConfigManager: configManager,
    });

    const result = await generator.generateCliches(
      'concept-advanced-disabled',
      'A diplomat navigating interstellar politics.',
      {
        title: 'Galactic Arbiter',
        description: 'An envoy holding together a fragile alliance.',
        coreTension: 'Truth versus diplomacy',
      },
      {
        useEnhancedPrompt: true,
        enhancementOptions: { enableAdvancedValidation: false },
      }
    );

    expect(result.metadata.promptVersion).toBe(PROMPT_VERSION_INFO.version);
    expect(logger.warnMessages).toHaveLength(0);
  });

  it('throws detailed error when requested configuration cannot be loaded', async () => {
    const configManager = new TestLLMConfigManager({
      activeConfigId: 'stable-model',
    });
    configManager.failLoadOnce('missing-config');
    const llmFactory = new TestLLMStrategyFactory([
      JSON.stringify(buildValidResponse()),
    ]);

    const generator = new ClicheGenerator({
      logger,
      llmJsonService,
      llmStrategyFactory: llmFactory,
      llmConfigManager: configManager,
    });

    await expect(
      generator.generateCliches(
        'concept-missing-config',
        'An investigator searching forbidden knowledge.',
        {
          title: 'Arcane Investigator',
          description: 'Solves mysteries entwined with forbidden magic.',
          coreTension: 'Curiosity versus sanity',
        },
        { llmConfigId: 'missing-config' }
      )
    ).rejects.toThrow(ClicheGenerationError);

    expect(
      logger.errorMessages.some((entry) =>
        entry.message.includes('Generation failed')
      )
    ).toBe(true);
    expect(llmFactory.calls).toHaveLength(0);
  });

  it('propagates parsing failures from LLM responses', async () => {
    const configManager = new TestLLMConfigManager({
      activeConfigId: 'analysis-model',
    });
    const llmFactory = new TestLLMStrategyFactory(['{"incomplete']);

    const generator = new ClicheGenerator({
      logger,
      llmJsonService,
      llmStrategyFactory: llmFactory,
      llmConfigManager: configManager,
    });

    await expect(
      generator.generateCliches(
        'concept-parse-failure',
        'A scholar obsessed with lost civilizations.',
        {
          title: 'Archivist of Echoes',
          description: 'Catalogues artifacts that whisper forgotten truths.',
          coreTension: 'Discovery versus preservation',
        }
      )
    ).rejects.toThrow('Failed to parse LLM response');

    expect(
      logger.errorMessages.some((entry) =>
        entry.message.includes('Generation failed')
      )
    ).toBe(true);
    expect(llmFactory.calls[0].options.toolSchema).toBeDefined();
  });
});
