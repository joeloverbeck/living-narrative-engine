import { describe, it, expect } from '@jest/globals';
import { ProductionPathConfiguration } from '../../../src/configuration/productionPathConfiguration.js';
import { IPathConfiguration } from '../../../src/interfaces/IPathConfiguration.js';

describe('ProductionPathConfiguration', () => {
  /** @returns {ProductionPathConfiguration} */
  const createConfig = () => new ProductionPathConfiguration();

  it('implements the IPathConfiguration contract', () => {
    const config = createConfig();
    expect(config).toBeInstanceOf(IPathConfiguration);
  });

  it('provides the production LLM configuration path', () => {
    const config = createConfig();
    expect(config.getLLMConfigPath()).toBe('./config/llm-configs.json');
  });

  it('exposes the production prompt text filename', () => {
    const config = createConfig();
    expect(config.getPromptTextFilename()).toBe('corePromptText.json');
  });

  it('returns the production configuration directory', () => {
    const config = createConfig();
    expect(config.getConfigDirectory()).toBe('./config');
  });

  it('returns the production prompts directory', () => {
    const config = createConfig();
    expect(config.getPromptsDirectory()).toBe('./data/prompts');
  });
});
