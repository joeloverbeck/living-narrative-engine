/**
 * @file Configuration file support for mod validation CLI
 * @description Loads and merges configuration from multiple sources with proper precedence
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads configuration from various sources
 *
 * @param {object} cliConfig - CLI-provided configuration
 * @returns {Promise<object>} Merged configuration
 */
export async function loadConfiguration(cliConfig = {}) {
  const configs = [];

  // 1. Default configuration
  configs.push(await loadDefaultConfig());

  // 2. Global configuration
  const globalConfig = await loadGlobalConfig();
  if (globalConfig) configs.push(globalConfig);

  // 3. Project configuration
  const projectConfig = await loadProjectConfig();
  if (projectConfig) configs.push(projectConfig);

  // 4. Local configuration
  const localConfig = await loadLocalConfig();
  if (localConfig) configs.push(localConfig);

  // 5. CLI configuration (highest priority)
  configs.push(cliConfig);

  // Merge configurations
  return mergeConfigurations(configs);
}

/**
 * Loads default configuration
 */
async function loadDefaultConfig() {
  return {
    validation: {
      dependencies: true,
      crossReferences: true,
      loadOrder: false,
      strictMode: false,
      continueOnError: true,
      timeout: 60000,
      concurrency: 3,
    },
    output: {
      format: 'console',
      colors: null, // auto-detect
      verbose: false,
      quiet: false,
      showSuggestions: true,
      showSummary: true,
    },
    filters: {
      severity: null,
      violationType: null,
      modFilter: null,
    },
  };
}

/**
 * Loads global configuration from user home directory
 */
async function loadGlobalConfig() {
  const configPaths = [
    path.join(process.env.HOME || '', '.living-narrative-validate.json'),
    path.join(
      process.env.HOME || '',
      '.config',
      'living-narrative-validate',
      'config.json'
    ),
  ];

  for (const configPath of configPaths) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      // Config file doesn't exist or is invalid
      continue;
    }
  }

  return null;
}

/**
 * Loads project-specific configuration
 */
async function loadProjectConfig() {
  const configPaths = [
    'living-narrative-validate.json',
    '.living-narrative-validate.json',
    'validate.config.json',
  ];

  for (const configPath of configPaths) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      continue;
    }
  }

  return null;
}

/**
 * Loads local configuration (project/.validate directory)
 */
async function loadLocalConfig() {
  try {
    const content = await fs.readFile('.validate/config.json', 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Merges multiple configuration objects
 *
 * @param {object[]} configs - Configuration objects to merge
 * @returns {object} Merged configuration
 */
function mergeConfigurations(configs) {
  return configs.reduce((merged, config) => {
    return deepMerge(merged, config);
  }, {});
}

/**
 * Deep merge utility for configuration objects
 *
 * @param target
 * @param source
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Saves configuration to file
 *
 * @param {object} config - Configuration to save
 * @param {string} filePath - Path to save configuration
 * @returns {Promise<void>}
 */
export async function saveConfiguration(config, filePath) {
  const content = JSON.stringify(config, null, 2);
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Creates a default configuration file
 *
 * @param {string} type - Type of config file to create ('project' | 'global' | 'local')
 * @returns {Promise<void>}
 */
export async function createDefaultConfigFile(type = 'project') {
  const defaultConfig = {
    validation: {
      dependencies: true,
      crossReferences: true,
      loadOrder: false,
      strictMode: false,
    },
    output: {
      format: 'console',
      verbose: false,
      showSuggestions: true,
    },
    performance: {
      concurrency: 3,
      timeout: 60000,
    },
  };

  let filePath;
  switch (type) {
    case 'global':
      filePath = path.join(process.env.HOME || '', '.living-narrative-validate.json');
      break;
    case 'local':
      await fs.mkdir('.validate', { recursive: true });
      filePath = '.validate/config.json';
      break;
    case 'project':
    default:
      filePath = 'living-narrative-validate.json';
      break;
  }

  await saveConfiguration(defaultConfig, filePath);
  console.log(`Created default configuration file: ${filePath}`);
}

/**
 * Validates a configuration object
 *
 * @param {object} config - Configuration to validate
 * @returns {object} Validation result with errors array
 */
export function validateConfig(config) {
  const errors = [];
  
  // Validate format
  if (config.output?.format) {
    const validFormats = ['console', 'json', 'html', 'markdown', 'junit', 'csv'];
    if (!validFormats.includes(config.output.format)) {
      errors.push(`Invalid format: ${config.output.format}`);
    }
  }
  
  // Validate concurrency
  if (config.performance?.concurrency) {
    if (config.performance.concurrency < 1 || config.performance.concurrency > 20) {
      errors.push('Concurrency must be between 1 and 20');
    }
  }
  
  // Validate timeout
  if (config.performance?.timeout) {
    if (config.performance.timeout < 1000) {
      errors.push('Timeout must be at least 1000ms');
    }
  }
  
  // Validate severity filter
  if (config.filters?.severity) {
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    if (!validSeverities.includes(config.filters.severity)) {
      errors.push(`Invalid severity: ${config.filters.severity}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}