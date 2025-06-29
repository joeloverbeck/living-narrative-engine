// src/services/anatomyFormattingService.js

/**
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {Object} AnatomyFormattingConfig
 * @property {string} id - Unique identifier for this formatting configuration
 * @property {string[]} [descriptionOrder] - Order in which body part types appear in descriptions
 * @property {string[]} [groupedParts] - Body part types that should be grouped together
 * @property {string[]} [pairedParts] - Body part types that use 'a pair of' when there are two
 * @property {Object.<string, string>} [irregularPlurals] - Mapping of body part types to irregular plurals
 * @property {string[]} [noArticleParts] - Body part types that should not have articles
 * @property {string[]} [descriptorOrder] - Order in which descriptor types appear
 * @property {string[]} [commaSeparatedDescriptors] - Descriptor types using commas instead of hyphens
 * @property {string[]} [descriptorValueKeys] - Keys to search for when extracting descriptor values
 * @property {Object} [mergeStrategy] - Optional merge strategy configuration
 */

/**
 * Service for managing anatomy formatting configuration from mods.
 * Handles loading, merging, and accessing formatting rules for anatomy descriptions.
 */
export class AnatomyFormattingService {
  /**
   * @param {Object} params
   * @param {IDataRegistry} params.dataRegistry - Data registry service
   * @param {ILogger} params.logger - Logging service
   * @param {string[]} params.modLoadOrder - Array of mod IDs in load order
   */
  constructor({ dataRegistry, logger, modLoadOrder }) {
    this.dataRegistry = dataRegistry;
    this.logger = logger;
    this.modLoadOrder = modLoadOrder || [];
    
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

    this.logger.debug('AnatomyFormattingService: Initializing formatting configuration');
    
    // Get all anatomy formatting configurations from registry
    const allConfigs = this.dataRegistry.getAll('anatomyFormatting') || {};
    
    // Start with empty base configuration
    let mergedConfig = {
      descriptionOrder: [],
      groupedParts: [],
      pairedParts: [],
      irregularPlurals: {},
      noArticleParts: [],
      descriptorOrder: [],
      commaSeparatedDescriptors: [],
      descriptorValueKeys: []
    };

    // Process configs in mod load order
    for (const modId of this.modLoadOrder) {
      // Look for configurations from this mod
      const modConfigs = Object.entries(allConfigs)
        .filter(([key]) => key.startsWith(`${modId}:`))
        .map(([, config]) => config);

      for (const config of modConfigs) {
        mergedConfig = this._mergeConfigurations(mergedConfig, config);
      }
    }

    this._mergedConfig = mergedConfig;
    this._configInitialized = true;
    
    this.logger.debug('AnatomyFormattingService: Configuration initialized', {
      descriptionOrderCount: mergedConfig.descriptionOrder.length,
      descriptorOrderCount: mergedConfig.descriptorOrder.length
    });
  }

  /**
   * Merge two anatomy formatting configurations
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
      'commaSeparatedDescriptors',
      'descriptorValueKeys'
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
          ...overlay.irregularPlurals
        };
      }
    }

    return merged;
  }

  /**
   * Get the configured description order for body parts
   * @returns {string[]} Array of body part types in order
   */
  getDescriptionOrder() {
    this._ensureInitialized();
    return [...this._mergedConfig.descriptionOrder];
  }

  /**
   * Get the set of body parts that should be grouped together
   * @returns {Set<string>} Set of grouped part types
   */
  getGroupedParts() {
    this._ensureInitialized();
    return new Set(this._mergedConfig.groupedParts);
  }

  /**
   * Get the set of body parts that use "a pair of"
   * @returns {Set<string>} Set of paired part types
   */
  getPairedParts() {
    this._ensureInitialized();
    return new Set(this._mergedConfig.pairedParts);
  }

  /**
   * Get irregular plural mappings
   * @returns {Object.<string, string>} Mapping of singular to plural forms
   */
  getIrregularPlurals() {
    this._ensureInitialized();
    return { ...this._mergedConfig.irregularPlurals };
  }

  /**
   * Get the set of body parts that don't use articles
   * @returns {Set<string>} Set of no-article part types
   */
  getNoArticleParts() {
    this._ensureInitialized();
    return new Set(this._mergedConfig.noArticleParts);
  }

  /**
   * Get the configured descriptor order
   * @returns {string[]} Array of descriptor types in order
   */
  getDescriptorOrder() {
    this._ensureInitialized();
    return [...this._mergedConfig.descriptorOrder];
  }

  /**
   * Get the set of descriptors that use comma separation
   * @returns {Set<string>} Set of comma-separated descriptor types
   */
  getCommaSeparatedDescriptors() {
    this._ensureInitialized();
    return new Set(this._mergedConfig.commaSeparatedDescriptors);
  }

  /**
   * Get the list of keys to search for descriptor values
   * @returns {string[]} Array of possible descriptor value keys
   */
  getDescriptorValueKeys() {
    this._ensureInitialized();
    return [...this._mergedConfig.descriptorValueKeys];
  }

  /**
   * Ensure the service has been initialized
   * @private
   */
  _ensureInitialized() {
    if (!this._configInitialized) {
      throw new Error('AnatomyFormattingService not initialized. Call initialize() first.');
    }
  }
}