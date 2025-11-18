import { describe, it, expect, jest } from '@jest/globals';
import { LlmConfigLoader } from '../../../src/llms/services/llmConfigLoader.js';
import { SemanticErrorTypes } from '../../../src/validation/llmConfigSemanticValidator.js';

class PassthroughSchemaValidator {
  validate() {
    return { isValid: true, errors: [] };
  }
}

class InMemoryDataFetcher {
  #responses;

  constructor(responses) {
    this.#responses = responses;
  }

  async fetch(identifier) {
    if (!Object.prototype.hasOwnProperty.call(this.#responses, identifier)) {
      throw new Error(`No fixture available for ${identifier}`);
    }
    return this.#responses[identifier];
  }
}

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
 * @param fixtures
 */
function createLoaderWithData(fixtures) {
  return new LlmConfigLoader({
    logger: createLogger(),
    schemaValidator: new PassthroughSchemaValidator(),
    configuration: {
      getContentTypeSchemaId: (registryKey) =>
        registryKey === 'llm-configs'
          ? 'schema://living-narrative-engine/llm-configs.schema.json'
          : undefined,
    },
    safeEventDispatcher: {
      dispatch: jest.fn().mockResolvedValue(true),
    },
    dataFetcher: new InMemoryDataFetcher(fixtures),
  });
}

describe('LlmConfigLoader semantic validation integration', () => {
  it('surfaces semantic validation failure for invalid configs map', async () => {
    const loader = createLoaderWithData({
      'configs-invalid.json': {
        defaultConfigId: 'broken',
        configs: null,
      },
    });

    const result = await loader.loadConfigs('configs-invalid.json');

    expect(result.error).toBe(true);
    expect(result.stage).toBe('semantic_validation');
    expect(result.semanticErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          errorType: SemanticErrorTypes.INVALID_CONFIGS_STRUCTURE,
          configId: 'N/A (root property)',
          path: 'configs',
        }),
      ])
    );
  });

  it('collects semantic issues across multiple configurations', async () => {
    const complexConfig = {
      defaultConfigId: 'primary',
      configs: {
        primary: {
          configId: 'primary',
          displayName: 'Primary configuration',
          modelIdentifier: 'model-primary',
          endpointUrl: 'https://example.com/llm',
          apiType: 'custom',
          jsonOutputStrategy: { method: 'manual_prompting' },
          promptElements: [
            { key: 'intro', prefix: '<<', suffix: '>>' },
          ],
          promptAssemblyOrder: ['intro', 42, 'missing'],
        },
        missingElements: {
          configId: 'missingElements',
          displayName: 'Missing prompt elements',
          modelIdentifier: 'model-missing',
          endpointUrl: 'https://example.com/llm',
          apiType: 'custom',
          jsonOutputStrategy: { method: 'manual_prompting' },
          promptAssemblyOrder: ['intro'],
        },
        malformed: null,
      },
    };

    const loader = createLoaderWithData({
      'complex-config.json': complexConfig,
    });

    const result = await loader.loadConfigs('complex-config.json');

    expect(result.error).toBe(true);
    expect(result.stage).toBe('semantic_validation');
    expect(result.semanticErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          errorType: SemanticErrorTypes.INVALID_CONFIG_OBJECT,
          configId: 'malformed',
        }),
        expect.objectContaining({
          errorType: SemanticErrorTypes.MISSING_PROMPT_ELEMENTS_FOR_ASSEMBLY,
          configId: 'missingElements',
          path: 'configs.missingElements.promptElements',
        }),
        expect.objectContaining({
          errorType: SemanticErrorTypes.INVALID_ASSEMBLY_KEY_TYPE,
          configId: 'primary',
          path: 'configs.primary.promptAssemblyOrder[1]',
        }),
        expect.objectContaining({
          errorType: SemanticErrorTypes.MISSING_ASSEMBLY_KEY,
          configId: 'primary',
          path: 'configs.primary.promptAssemblyOrder[2]',
        }),
      ])
    );

    const invalidKeyTypeError = result.semanticErrors.find(
      (error) => error.errorType === SemanticErrorTypes.INVALID_ASSEMBLY_KEY_TYPE
    );
    expect(invalidKeyTypeError?.details.problematic_key_ref).toBe('42');

    const missingKeyError = result.semanticErrors.find(
      (error) => error.errorType === SemanticErrorTypes.MISSING_ASSEMBLY_KEY
    );
    expect(missingKeyError?.details.problematic_key_ref).toBe('missing');
    expect(missingKeyError?.details.available_prompt_element_keys).toEqual(['intro']);
  });
});
