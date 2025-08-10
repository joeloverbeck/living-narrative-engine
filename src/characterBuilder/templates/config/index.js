/**
 * @file Template configuration system exports
 * @module characterBuilder/templates/config
 */

import { DEFAULT_TEMPLATE_CONFIGS, getDefaultConfig, mergeWithDefaults } from './defaultConfigs.js';
import { TemplateConfigManager } from '../utilities/templateConfigManager.js';
import { EnvironmentConfigLoader } from './environmentConfig.js';
import { ConfigValidator } from './configValidator.js';
import { TemplateConfigBuilder } from './configBuilder.js';
import { PageConfigRegistry } from './pageConfigs.js';

export {
  DEFAULT_TEMPLATE_CONFIGS,
  getDefaultConfig,
  mergeWithDefaults,
  TemplateConfigManager,
  EnvironmentConfigLoader,
  ConfigValidator,
  TemplateConfigBuilder,
  PageConfigRegistry,
};

// Re-export error classes
export {
  TemplateConfigurationError,
  InvalidConfigError,
  MissingConfigError,
  EnvironmentDetectionError,
  ConfigMergeError,
} from '../errors/templateConfigurationError.js';

/**
 * Create a fully configured template configuration system
 * 
 * @param {object} [options] - System options
 * @returns {object} Configuration system components
 */
export function createConfigurationSystem(options = {}) {
  const {
    enableCache = true,
    forceEnvironment = null,
    validateOnBuild = true,
  } = options;

  // Create environment loader
  const environmentLoader = new EnvironmentConfigLoader({
    forceEnvironment,
  });

  // Create validator
  const validator = new ConfigValidator();

  // Create config manager
  const configManager = new TemplateConfigManager({
    defaults: DEFAULT_TEMPLATE_CONFIGS,
    environment: environmentLoader.getEnvironment(),
    validator,
    enableCache,
  });

  // Create page registry
  const pageRegistry = new PageConfigRegistry();

  // Apply environment configs to manager
  const envConfig = environmentLoader.getConfig();
  for (const [templateType, config] of Object.entries(envConfig)) {
    configManager.setConfig('environment', templateType, config);
  }

  // Apply page configs to manager
  for (const pageName of pageRegistry.getRegisteredPages()) {
    const pageConfig = pageRegistry.getPageConfig(pageName);
    configManager.setConfig('page', pageName, pageConfig);
  }

  return {
    configManager,
    environmentLoader,
    validator,
    pageRegistry,
    createBuilder: (templateType) => new TemplateConfigBuilder({}, templateType, validateOnBuild),
  };
}