// src/services/anatomyFormattingService.js

import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { validateDependencies } from '../utils/dependencyUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/**
 * @typedef {object} AnatomyFormattingConfig
 * @property {string} id - Unique identifier for this formatting configuration
 * @property {string[]} [descriptionOrder] - Order in which body part types appear in descriptions
 * @property {string[]} [groupedParts] - Body part types that should be grouped together
 * @property {string[]} [pairedParts] - Body part types that use 'a pair of' when there are two
 * @property {Object.<string, string>} [irregularPlurals] - Mapping of body part types to irregular plurals
 * @property {string[]} [noArticleParts] - Body part types that should not have articles
 * @property {string[]} [descriptorOrder] - Order in which descriptor types appear
 * @property {string[]} [descriptorValueKeys] - Keys to search for when extracting descriptor values
 * @property {object} [mergeStrategy] - Optional merge strategy configuration
 */

/**
 * Service for managing anatomy formatting configuration from mods.
 * Handles loading, merging, and accessing formatting rules for anatomy descriptions.
 */
export class AnatomyFormattingService {
  /**
   * @param {object} params
   * @param {IDataRegistry} params.dataRegistry - Data registry service
   * @param {ILogger} params.logger - Logging service
   * @param {ISafeEventDispatcher} params.safeEventDispatcher - Event dispatcher for error reporting
   */
  constructor({ dataRegistry, logger, safeEventDispatcher }) {
    // Validate dependencies
    validateDependencies(
      [
        {
          dependency: dataRegistry,
          name: 'dataRegistry',
          methods: ['getAll', 'get'],
        },
        {
          dependency: logger,
          name: 'logger',
          methods: ['info', 'warn', 'error', 'debug'],
        },
        {
          dependency: safeEventDispatcher,
          name: 'safeEventDispatcher',
          methods: ['dispatch'],
        },
      ],
      logger
    );

    this.dataRegistry = dataRegistry;
    this.logger = logger;
    this.safeEventDispatcher = safeEventDispatcher;

    // Cache for merged configuration
    this._mergedConfig = null;
    this._configInitialized = false;
  }

  /**
   * Initialize the service by loading and merging all formatting configurations
   */
  initialize() {
    if (this._configInitialized) {
      return;
    }

    this.logger.debug(
      'AnatomyFormattingService: Initializing formatting configuration'
    );

    // Get mod load order from meta registry (stored by ModManifestProcessor)
    const modLoadOrder = this.dataRegistry.get('meta', 'final_mod_order') || [];

    this.logger.debug(
      `AnatomyFormattingService: Using mod load order: [${modLoadOrder.join(', ')}]`
    );

    // Get all anatomy formatting configurations from registry
    const allConfigs = this.dataRegistry.getAll('anatomyFormatting') || [];

    this.logger.debug(
      `AnatomyFormattingService: Retrieved ${allConfigs.length} anatomy formatting configs from registry`
    );

    // Start with empty base configuration
    let mergedConfig = {
      descriptionOrder: [],
      groupedParts: [],
      pairedParts: [],
      irregularPlurals: {},
      noArticleParts: [],
      descriptorOrder: [],
      descriptorValueKeys: [],
      equipmentIntegration: null,
    };

    // Process configs in mod load order
    for (const modId of modLoadOrder) {
      // Look for configurations from this mod
      // The configs are stored with metadata including _modId
      const modConfigs = allConfigs.filter((config) => config._modId === modId);

      this.logger.debug(
        `AnatomyFormattingService: Found ${modConfigs.length} configs for mod '${modId}'`
      );

      for (const config of modConfigs) {
        this.logger.debug(
          `AnatomyFormattingService: Merging config from mod '${modId}':`,
          {
            hasDescriptionOrder: !!config.descriptionOrder,
            descriptionOrderLength: config.descriptionOrder?.length || 0,
            hasDescriptorOrder: !!config.descriptorOrder,
            descriptorOrderLength: config.descriptorOrder?.length || 0,
            hasDescriptorValueKeys: !!config.descriptorValueKeys,
            descriptorValueKeysLength: config.descriptorValueKeys?.length || 0,
          }
        );
        mergedConfig = this._mergeConfigurations(mergedConfig, config);
      }
    }

    this._mergedConfig = mergedConfig;
    this._configInitialized = true;

    this.logger.debug('AnatomyFormattingService: Configuration initialized', {
      descriptionOrderCount: mergedConfig.descriptionOrder.length,
      descriptorOrderCount: mergedConfig.descriptorOrder.length,
      descriptorValueKeysCount: mergedConfig.descriptorValueKeys.length,
      pairedPartsCount: mergedConfig.pairedParts.length,
      irregularPluralsCount: Object.keys(mergedConfig.irregularPlurals).length,
    });
  }

  /**
   * Merge two anatomy formatting configurations
   *
   * @private
   * @param {AnatomyFormattingConfig} base - Base configuration
   * @param {AnatomyFormattingConfig} overlay - Configuration to merge on top
   * @returns {AnatomyFormattingConfig} Merged configuration
   */
  _mergeConfigurations(base, overlay) {
    const merged = { ...base };
    const mergeStrategy = overlay.mergeStrategy || {};

    // Handle arrays
    const arrayFields = [
      'descriptionOrder',
      'groupedParts',
      'pairedParts',
      'noArticleParts',
      'descriptorOrder',
      'descriptorValueKeys',
    ];

    for (const field of arrayFields) {
      if (overlay[field]) {
        if (mergeStrategy.replaceArrays) {
          // Replace entirely
          merged[field] = [...overlay[field]];
        } else {
          // Append unique values
          const existing = new Set(merged[field]);
          for (const value of overlay[field]) {
            if (!existing.has(value)) {
              merged[field].push(value);
            }
          }
        }
      }
    }

    // Handle objects (irregularPlurals)
    if (overlay.irregularPlurals) {
      if (mergeStrategy.replaceObjects) {
        merged.irregularPlurals = { ...overlay.irregularPlurals };
      } else {
        // Deep merge
        merged.irregularPlurals = {
          ...merged.irregularPlurals,
          ...overlay.irregularPlurals,
        };
      }
    }

    // Handle equipmentIntegration configuration
    if (overlay.equipmentIntegration) {
      if (mergeStrategy.replaceObjects) {
        merged.equipmentIntegration = { ...overlay.equipmentIntegration };
      } else {
        // Deep merge
        merged.equipmentIntegration = {
          ...merged.equipmentIntegration,
          ...overlay.equipmentIntegration,
        };
      }
    }

    return merged;
  }

  /**
   * Get the configured description order for body parts
   *
   * @returns {string[]} Array of body part types in order
   */
  getDescriptionOrder() {
    this._ensureInitialized();
    const descriptionOrder = this._mergedConfig.descriptionOrder;
    this._validateConfiguration(
      'descriptionOrder',
      descriptionOrder,
      'getDescriptionOrder'
    );
    return [...descriptionOrder];
  }

  /**
   * Get the set of body parts that should be grouped together
   *
   * @returns {Set<string>} Set of grouped part types
   */
  getGroupedParts() {
    this._ensureInitialized();
    const groupedParts = this._mergedConfig.groupedParts;
    // Note: groupedParts is optional and can be empty, so we don't validate it
    return new Set(groupedParts);
  }

  /**
   * Get the set of body parts that use "a pair of"
   *
   * @returns {Set<string>} Set of paired part types
   */
  getPairedParts() {
    this._ensureInitialized();
    const pairedParts = this._mergedConfig.pairedParts;
    this._validateConfiguration('pairedParts', pairedParts, 'getPairedParts');
    return new Set(pairedParts);
  }

  /**
   * Get irregular plural mappings
   *
   * @returns {Object.<string, string>} Mapping of singular to plural forms
   */
  getIrregularPlurals() {
    this._ensureInitialized();
    const irregularPlurals = this._mergedConfig.irregularPlurals;
    this._validateConfiguration(
      'irregularPlurals',
      irregularPlurals,
      'getIrregularPlurals'
    );
    return { ...irregularPlurals };
  }

  /**
   * Get the set of body parts that don't use articles
   *
   * @returns {Set<string>} Set of no-article part types
   */
  getNoArticleParts() {
    this._ensureInitialized();
    const noArticleParts = this._mergedConfig.noArticleParts;
    // Note: noArticleParts is optional and can be empty, so we don't validate it
    return new Set(noArticleParts);
  }

  /**
   * Get the configured descriptor order
   *
   * @returns {string[]} Array of descriptor types in order
   */
  getDescriptorOrder() {
    this._ensureInitialized();
    const descriptorOrder = this._mergedConfig.descriptorOrder;
    this._validateConfiguration(
      'descriptorOrder',
      descriptorOrder,
      'getDescriptorOrder'
    );
    return [...descriptorOrder];
  }

  /**
   * Get the list of keys to search for descriptor values
   *
   * @returns {string[]} Array of possible descriptor value keys
   */
  getDescriptorValueKeys() {
    this._ensureInitialized();
    const descriptorValueKeys = this._mergedConfig.descriptorValueKeys;
    this._validateConfiguration(
      'descriptorValueKeys',
      descriptorValueKeys,
      'getDescriptorValueKeys'
    );
    return [...descriptorValueKeys];
  }

  /**
   * Get equipment integration configuration
   *
   * @returns {object} Equipment integration configuration
   */
  getEquipmentIntegrationConfig() {
    this._ensureInitialized();
    return (
      this._mergedConfig.equipmentIntegration || {
        enabled: false,
        prefix: 'Wearing: ',
        suffix: '.',
        separator: ', ',
        itemSeparator: ' | ',
        placement: 'after_anatomy',
      }
    );
  }

  /**
   * Get activity integration configuration.
   * Controls how activity descriptions are formatted and displayed.
   *
   * @returns {object} Activity configuration
   */
  getActivityIntegrationConfig() {
    this._ensureInitialized();
    return (
      this._mergedConfig.activityIntegration || {
        // Formatting
        prefix: 'Activity: ',
        suffix: '',
        separator: '. ',
        enableContextAwareness: true,

        // Name resolution (Phase 2) - ACTDESC-014 Implementation
        nameResolution: {
          usePronounsWhenAvailable: true, // Phase 2: Enabled for pronoun resolution
          fallbackToNames: true,
          respectGenderComponents: true, // Optional: defaults to true
        },

        // Priority filtering (Phase 2)
        maxActivities: 10,
        respectPriorityTiers: true, // Enable in Phase 3

        // Performance (Phase 3)
        enableCaching: false, // Enable in Phase 3
        cacheTimeout: 5000, // 5 seconds
      }
    );
  }

  /**
   * Ensure the service has been initialized
   *
   * @private
   */
  _ensureInitialized() {
    if (!this._configInitialized) {
      throw new Error(
        'AnatomyFormattingService not initialized. Call initialize() first.'
      );
    }
  }

  /**
   * Validate that configuration arrays are not empty and dispatch errors if they are
   *
   * @private
   * @param {string} configKey - The configuration key being validated
   * @param {*} configValue - The configuration value to validate
   * @param {string} method - The getter method name calling this validation
   */
  _validateConfiguration(configKey, configValue, method) {
    // Check if the value is empty (array, set, or object)
    let isEmpty = false;

    if (Array.isArray(configValue)) {
      isEmpty = configValue.length === 0;
    } else if (configValue instanceof Set) {
      isEmpty = configValue.size === 0;
    } else if (configValue && typeof configValue === 'object') {
      isEmpty = Object.keys(configValue).length === 0;
    } else {
      isEmpty = !configValue;
    }

    if (isEmpty) {
      const message = `AnatomyFormattingService.${method}: ${configKey} configuration is empty`;
      const details = {
        method,
        configKey,
        expected: `Non-empty ${configKey} configuration`,
        actual: configValue,
        impact: 'Body part descriptions will be incomplete or empty',
        suggestion:
          'Ensure "anatomy" mod is loaded in /data/game.json mods list',
        affectedFeature: 'Body part description generation',
      };

      this.logger.error(message, details);

      this.safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message,
        details: {
          raw: JSON.stringify(details),
          timestamp: new Date().toISOString(),
        },
      });

      throw new Error(message);
    }
  }
}
