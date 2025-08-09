/**
 * @file Enhanced action trace filter with backward compatibility
 */

import ActionTraceFilter from './actionTraceFilter.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { string } from '../../utils/validationCore.js';

// Enhanced categorization for the existing 4-level system
export const TRACE_CATEGORIES = {
  CORE: {
    types: ['action_start', 'action_complete', 'stage_start', 'stage_complete'],
    defaultLevel: 'standard',
    priority: 'high',
  },
  PERFORMANCE: {
    types: [
      'timing_data',
      'resource_usage',
      'performance_metrics',
      'optimization_data',
    ],
    defaultLevel: 'detailed',
    priority: 'medium',
  },
  DIAGNOSTIC: {
    types: [
      'error_details',
      'validation_results',
      'debug_info',
      'system_state',
    ],
    defaultLevel: 'verbose',
    priority: 'high',
  },
  BUSINESS_LOGIC: {
    types: [
      'component_filtering',
      'prerequisite_evaluation',
      'target_resolution',
      'formatting',
    ],
    defaultLevel: 'detailed',
    priority: 'medium',
  },
  LEGACY: {
    types: [
      'legacy_conversion',
      'compatibility_info',
      'migration_data',
      'adapter_usage',
    ],
    defaultLevel: 'standard',
    priority: 'low',
  },
};

class EnhancedActionTraceFilter extends ActionTraceFilter {
  #filterCache;
  #dynamicRules;
  #logger;
  #filterStats;
  #typeToCategory;
  #categoryConfig;

  constructor({
    enabled = true,
    tracedActions = ['*'],
    excludedActions = [],
    verbosityLevel = 'standard',
    inclusionConfig = {
      componentData: false,
      prerequisites: false,
      targets: false,
    },
    logger = null,
    categoryConfig = null,
  }) {
    // Call parent constructor with existing signature
    super({
      enabled,
      tracedActions,
      excludedActions,
      verbosityLevel,
      inclusionConfig,
      logger,
    });

    // Validate additional dependencies
    this.#logger = ensureValidLogger(logger, 'EnhancedActionTraceFilter');

    // Enhanced features (opt-in)
    this.#categoryConfig = categoryConfig || this.#initializeDefaultCategories();
    this.#filterCache = new Map();
    this.#dynamicRules = new Map();

    // Performance tracking
    this.#filterStats = {
      totalChecks: 0,
      filteredOut: 0,
      cacheHits: 0,
      dynamicRuleApplications: 0,
    };

    // Initialize category mappings
    this.#initializeCategoryMappings();
  }

  #initializeDefaultCategories() {
    const config = {};
    Object.entries(TRACE_CATEGORIES).forEach(([category, settings]) => {
      config[category.toLowerCase()] = settings.defaultLevel;
    });
    return config;
  }

  #initializeCategoryMappings() {
    this.#typeToCategory = new Map();
    Object.entries(TRACE_CATEGORIES).forEach(([categoryName, category]) => {
      category.types.forEach((type) => {
        this.#typeToCategory.set(type, {
          category: categoryName.toLowerCase(),
          level:
            this.#categoryConfig[categoryName.toLowerCase()] ||
            category.defaultLevel,
          priority: category.priority,
        });
      });
    });
  }

  // Enhanced filtering method (opt-in, doesn't break existing code)
  shouldCaptureEnhanced(category, type, data = {}, context = {}) {
    this.#filterStats.totalChecks++;

    // Use parent's existing filtering as base
    const baseDecision = this.shouldTrace(context.actionId || type);

    if (!baseDecision) {
      this.#filterStats.filteredOut++;
      return false;
    }

    // Check cache for enhanced filtering
    const cacheKey = `${category}:${type}`;
    if (this.#filterCache.has(cacheKey)) {
      this.#filterStats.cacheHits++;
      const cached = this.#filterCache.get(cacheKey);

      if (cached.hasDynamicRules) {
        return this.#applyDynamicFiltering(category, type, data, context);
      }

      return cached.shouldCapture;
    }

    // Apply enhanced category-based filtering
    const enhancedDecision = this.#evaluateEnhancedCapture(category, type);

    // Cache the decision
    this.#filterCache.set(cacheKey, {
      shouldCapture: enhancedDecision,
      hasDynamicRules: this.#dynamicRules.size > 0,
      timestamp: Date.now(),
    });

    // Apply dynamic rules if present
    if (this.#dynamicRules.size > 0) {
      return this.#applyDynamicFiltering(category, type, data, context);
    }

    if (!enhancedDecision) {
      this.#filterStats.filteredOut++;
    }

    return enhancedDecision;
  }

  #evaluateEnhancedCapture(category, type) {
    const typeInfo = this.#typeToCategory.get(type);
    const currentLevel = this.getVerbosityLevel(); // Use parent's method

    if (!typeInfo) {
      // Unknown type - use heuristics
      return this.#estimateTypeAcceptance(type, currentLevel);
    }

    // Map string levels to numeric for comparison
    const levelMap = {
      minimal: 0,
      standard: 1,
      detailed: 2,
      verbose: 3,
    };
    const requiredLevel = levelMap[typeInfo.level] || 1;
    const actualLevel = levelMap[currentLevel] || 1;

    return actualLevel >= requiredLevel;
  }

  #estimateTypeAcceptance(type, currentLevel) {
    const typeLower = type.toLowerCase();
    const levelMap = { minimal: 0, standard: 1, detailed: 2, verbose: 3 };
    const actualLevel = levelMap[currentLevel] || 1;

    // Error and critical types - always capture at minimal+
    if (typeLower.includes('error') || typeLower.includes('critical')) {
      return actualLevel >= 0;
    }

    // Performance types - require detailed+
    if (typeLower.includes('performance') || typeLower.includes('timing')) {
      return actualLevel >= 2;
    }

    // Debug types - require verbose
    if (typeLower.includes('debug') || typeLower.includes('diagnostic')) {
      return actualLevel >= 3;
    }

    // Default to standard level requirement
    return actualLevel >= 1;
  }

  #applyDynamicFiltering(category, type, data, context) {
    this.#filterStats.dynamicRuleApplications++;

    for (const [ruleName, ruleFunction] of this.#dynamicRules) {
      try {
        const result = ruleFunction({
          category,
          type,
          data,
          context,
          verbosityLevel: this.getVerbosityLevel(),
        });

        if (result === false) {
          this.#filterStats.filteredOut++;
          return false;
        }
      } catch (error) {
        this.#logger.error(`Error applying dynamic rule '${ruleName}':`, error);
      }
    }

    return true;
  }

  // Add dynamic rule (new opt-in feature)
  addDynamicRule(ruleName, ruleFunction) {
    string.assertNonBlank(ruleName, 'Rule name');
    if (typeof ruleFunction !== 'function') {
      throw new Error('Dynamic rule must be a function');
    }

    this.#dynamicRules.set(ruleName, ruleFunction);
    this.#filterCache.clear(); // Clear cache to apply new rule
    this.#logger.info(`Dynamic filter rule '${ruleName}' added`);
  }

  // Remove dynamic rule
  removeDynamicRule(ruleName) {
    if (this.#dynamicRules.delete(ruleName)) {
      this.#filterCache.clear();
      this.#logger.info(`Dynamic filter rule '${ruleName}' removed`);
    }
  }

  // Get filtering statistics
  getEnhancedStats() {
    const stats = { ...this.#filterStats };

    stats.filterRate =
      stats.totalChecks > 0
        ? (stats.filteredOut / stats.totalChecks) * 100
        : 0;

    stats.cacheHitRate =
      stats.totalChecks > 0 ? (stats.cacheHits / stats.totalChecks) * 100 : 0;

    return stats;
  }

  // Reset statistics
  resetEnhancedStats() {
    this.#filterStats = {
      totalChecks: 0,
      filteredOut: 0,
      cacheHits: 0,
      dynamicRuleApplications: 0,
    };
  }

  // Clear cache (useful after configuration changes)
  clearEnhancedCache() {
    this.#filterCache.clear();
    this.#logger.info('Enhanced filter cache cleared');
  }

  // Optimize cache by removing old entries
  optimizeCache(maxAge = 300000) {
    // 5 minutes default
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.#filterCache) {
      if (now - value.timestamp > maxAge) {
        this.#filterCache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.#logger.info(
        `Removed ${removed} expired entries from enhanced filter cache`
      );
    }
  }
}

export default EnhancedActionTraceFilter;