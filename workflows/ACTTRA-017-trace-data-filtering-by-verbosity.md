# ACTTRA-017: Trace Data Filtering by Verbosity

## Executive Summary

Implement intelligent trace data filtering system based on configurable verbosity levels within the action tracing system. This ticket provides granular control over trace data collection, storage, and retrieval, enabling users to balance diagnostic detail with performance and storage efficiency. The system supports dynamic verbosity adjustment and intelligent data prioritization.

## Technical Requirements

### Core Objectives
- Implement hierarchical verbosity levels for trace data filtering
- Provide dynamic verbosity adjustment during runtime
- Enable category-specific verbosity configuration
- Support intelligent data prioritization based on action criticality
- Implement efficient storage optimization through selective data capture
- Maintain trace data integrity across verbosity changes
- Provide verbosity-aware data aggregation and summarization

### Performance Requirements
- Zero overhead filtering with compile-time optimizations
- Efficient runtime verbosity level evaluation (<0.1ms per check)
- Memory efficient data structures for verbosity management
- Optimized storage utilization based on verbosity settings

### Compatibility Requirements
- Seamless integration with existing ActionAwareStructuredTrace
- Backward compatibility with existing trace data capture patterns
- Support for all pipeline stages and action types
- Maintain consistency across all tracing components

## Architecture Design

### Verbosity Level Hierarchy

The system implements a hierarchical verbosity structure:

```javascript
const VERBOSITY_LEVELS = {
  NONE: 0,      // No tracing data collected
  MINIMAL: 10,  // Critical errors and basic success/failure
  BASIC: 20,    // Core action flow and major decisions
  DETAILED: 30, // Comprehensive data with performance metrics
  DEBUG: 40,    // All available data including diagnostic information
  ULTRA: 50     // Maximum detail with internal system state
};

const VERBOSITY_CATEGORIES = {
  CORE: ['action_start', 'action_complete', 'stage_complete'],
  PERFORMANCE: ['timing_data', 'resource_usage', 'optimization_metrics'],
  DIAGNOSTIC: ['error_details', 'validation_results', 'debug_info'],
  BUSINESS_LOGIC: ['component_filtering', 'prerequisite_evaluation', 'target_resolution'],
  LEGACY: ['legacy_conversion', 'compatibility_info', 'migration_data']
};
```

### Intelligent Filtering System

The filtering system provides context-aware data selection:

```javascript
class VerbosityFilterManager {
  constructor({ verbosityConfig, logger }) {
    this.config = verbosityConfig;
    this.logger = logger;
    this.filterCache = new Map();
    this.dynamicRules = new Map();
  }

  shouldCapture(category, type, level, context = {}) {
    // Fast path for disabled tracing
    if (this.config.globalLevel === VERBOSITY_LEVELS.NONE) {
      return false;
    }

    // Category-specific level checking
    const categoryLevel = this.config.categoryLevels[category] || this.config.globalLevel;
    
    if (level > categoryLevel) {
      return false;
    }

    // Apply dynamic rules
    return this.applyDynamicFiltering(category, type, level, context);
  }
}
```

## Implementation Steps

### Step 1: Create Verbosity Configuration System

**File**: `src/actions/tracing/verbosity/verbosityConfig.js`

```javascript
/**
 * @file Verbosity configuration and management system
 */

import { validateDependency } from '../../../utils/validationUtils.js';

// Verbosity level constants
export const VERBOSITY_LEVELS = {
  NONE: 0,      // No tracing
  MINIMAL: 10,  // Critical only
  BASIC: 20,    // Core flow
  DETAILED: 30, // Comprehensive
  DEBUG: 40,    // Diagnostic
  ULTRA: 50     // Everything
};

// Predefined verbosity categories
export const VERBOSITY_CATEGORIES = {
  // Core action processing
  CORE: {
    types: ['action_start', 'action_complete', 'stage_start', 'stage_complete'],
    defaultLevel: VERBOSITY_LEVELS.BASIC,
    priority: 'high'
  },
  
  // Performance and timing data
  PERFORMANCE: {
    types: ['timing_data', 'resource_usage', 'performance_metrics', 'optimization_data'],
    defaultLevel: VERBOSITY_LEVELS.DETAILED,
    priority: 'medium'
  },
  
  // Error and diagnostic information
  DIAGNOSTIC: {
    types: ['error_details', 'validation_results', 'debug_info', 'system_state'],
    defaultLevel: VERBOSITY_LEVELS.DEBUG,
    priority: 'high'
  },
  
  // Business logic processing
  BUSINESS_LOGIC: {
    types: ['component_filtering', 'prerequisite_evaluation', 'target_resolution', 'formatting'],
    defaultLevel: VERBOSITY_LEVELS.DETAILED,
    priority: 'medium'
  },
  
  // Legacy and compatibility
  LEGACY: {
    types: ['legacy_conversion', 'compatibility_info', 'migration_data', 'adapter_usage'],
    defaultLevel: VERBOSITY_LEVELS.BASIC,
    priority: 'low'
  },
  
  // Multi-target processing
  MULTI_TARGET: {
    types: ['target_specification', 'scope_evaluation', 'relationship_analysis'],
    defaultLevel: VERBOSITY_LEVELS.DETAILED,
    priority: 'medium'
  }
};

class VerbosityConfig {
  constructor({ 
    globalLevel = VERBOSITY_LEVELS.BASIC,
    categoryLevels = {},
    dynamicRules = {},
    logger 
  }) {
    validateDependency(logger, 'ILogger');
    
    this.globalLevel = globalLevel;
    this.categoryLevels = { ...categoryLevels };
    this.dynamicRules = { ...dynamicRules };
    this.logger = logger;
    
    // Initialize category levels with defaults if not specified
    this.initializeDefaultCategoryLevels();
    
    // Validate configuration
    this.validateConfiguration();
  }

  initializeDefaultCategoryLevels() {
    Object.keys(VERBOSITY_CATEGORIES).forEach(category => {
      if (!(category.toLowerCase() in this.categoryLevels)) {
        const categoryConfig = VERBOSITY_CATEGORIES[category];
        this.categoryLevels[category.toLowerCase()] = categoryConfig.defaultLevel;
      }
    });
  }

  validateConfiguration() {
    // Validate global level
    if (!Object.values(VERBOSITY_LEVELS).includes(this.globalLevel)) {
      this.logger.warn(`Invalid global verbosity level: ${this.globalLevel}, using BASIC`);
      this.globalLevel = VERBOSITY_LEVELS.BASIC;
    }

    // Validate category levels
    Object.keys(this.categoryLevels).forEach(category => {
      const level = this.categoryLevels[category];
      if (!Object.values(VERBOSITY_LEVELS).includes(level)) {
        this.logger.warn(`Invalid verbosity level for category ${category}: ${level}`);
        this.categoryLevels[category] = this.globalLevel;
      }
    });
  }

  getEffectiveLevel(category) {
    // Return category-specific level or global level as fallback
    return this.categoryLevels[category.toLowerCase()] || this.globalLevel;
  }

  setGlobalLevel(level) {
    if (Object.values(VERBOSITY_LEVELS).includes(level)) {
      this.globalLevel = level;
      this.logger.info(`Global verbosity level set to ${level}`);
    } else {
      throw new Error(`Invalid verbosity level: ${level}`);
    }
  }

  setCategoryLevel(category, level) {
    if (!Object.values(VERBOSITY_LEVELS).includes(level)) {
      throw new Error(`Invalid verbosity level: ${level}`);
    }
    
    this.categoryLevels[category.toLowerCase()] = level;
    this.logger.info(`Verbosity level for category ${category} set to ${level}`);
  }

  addDynamicRule(ruleName, ruleFunction) {
    if (typeof ruleFunction !== 'function') {
      throw new Error('Dynamic rule must be a function');
    }
    
    this.dynamicRules[ruleName] = ruleFunction;
    this.logger.info(`Dynamic verbosity rule '${ruleName}' added`);
  }

  removeDynamicRule(ruleName) {
    if (this.dynamicRules[ruleName]) {
      delete this.dynamicRules[ruleName];
      this.logger.info(`Dynamic verbosity rule '${ruleName}' removed`);
    }
  }

  getDynamicRules() {
    return Object.keys(this.dynamicRules);
  }

  // Create preset configurations
  static createPreset(presetName) {
    switch (presetName.toLowerCase()) {
      case 'production':
        return new VerbosityConfig({
          globalLevel: VERBOSITY_LEVELS.MINIMAL,
          categoryLevels: {
            core: VERBOSITY_LEVELS.BASIC,
            diagnostic: VERBOSITY_LEVELS.MINIMAL,
            performance: VERBOSITY_LEVELS.NONE,
            legacy: VERBOSITY_LEVELS.NONE
          }
        });

      case 'development':
        return new VerbosityConfig({
          globalLevel: VERBOSITY_LEVELS.DETAILED,
          categoryLevels: {
            core: VERBOSITY_LEVELS.DETAILED,
            diagnostic: VERBOSITY_LEVELS.DEBUG,
            performance: VERBOSITY_LEVELS.DETAILED,
            business_logic: VERBOSITY_LEVELS.DETAILED
          }
        });

      case 'debug':
        return new VerbosityConfig({
          globalLevel: VERBOSITY_LEVELS.DEBUG,
          categoryLevels: {
            core: VERBOSITY_LEVELS.ULTRA,
            diagnostic: VERBOSITY_LEVELS.ULTRA,
            performance: VERBOSITY_LEVELS.DEBUG,
            business_logic: VERBOSITY_LEVELS.DEBUG,
            legacy: VERBOSITY_LEVELS.DEBUG,
            multi_target: VERBOSITY_LEVELS.DEBUG
          }
        });

      case 'performance':
        return new VerbosityConfig({
          globalLevel: VERBOSITY_LEVELS.BASIC,
          categoryLevels: {
            core: VERBOSITY_LEVELS.BASIC,
            performance: VERBOSITY_LEVELS.ULTRA,
            diagnostic: VERBOSITY_LEVELS.BASIC,
            business_logic: VERBOSITY_LEVELS.MINIMAL
          }
        });

      default:
        throw new Error(`Unknown preset: ${presetName}`);
    }
  }

  // Export configuration for serialization
  toJSON() {
    return {
      globalLevel: this.globalLevel,
      categoryLevels: { ...this.categoryLevels },
      dynamicRules: Object.keys(this.dynamicRules) // Don't serialize functions
    };
  }

  // Create configuration from JSON
  static fromJSON(configData, logger) {
    return new VerbosityConfig({
      globalLevel: configData.globalLevel,
      categoryLevels: configData.categoryLevels,
      logger: logger
    });
  }
}

export default VerbosityConfig;
```

### Step 2: Create Verbosity Filter Manager

**File**: `src/actions/tracing/verbosity/verbosityFilterManager.js`

```javascript
/**
 * @file Verbosity-based filtering manager
 */

import { validateDependency } from '../../../utils/validationUtils.js';
import { VERBOSITY_LEVELS, VERBOSITY_CATEGORIES } from './verbosityConfig.js';

class VerbosityFilterManager {
  constructor({ verbosityConfig, logger }) {
    validateDependency(verbosityConfig, 'VerbosityConfig');
    validateDependency(logger, 'ILogger');
    
    this.config = verbosityConfig;
    this.logger = logger;
    
    // Performance optimization caches
    this.filterCache = new Map();
    this.typeToLevelCache = new Map();
    
    // Statistics tracking
    this.filterStats = {
      totalChecks: 0,
      filteredOut: 0,
      cacheHits: 0,
      dynamicRuleApplications: 0
    };
    
    // Initialize type-to-level mapping cache
    this.initializeTypeLevelCache();
  }

  initializeTypeLevelCache() {
    // Pre-compute verbosity levels for known types to optimize filtering
    Object.keys(VERBOSITY_CATEGORIES).forEach(categoryName => {
      const category = VERBOSITY_CATEGORIES[categoryName];
      const categoryLevel = this.config.getEffectiveLevel(categoryName);
      
      category.types.forEach(type => {
        // Map each type to its category's verbosity level
        this.typeToLevelCache.set(type, {
          category: categoryName.toLowerCase(),
          level: categoryLevel,
          priority: category.priority
        });
      });
    });
  }

  shouldCapture(category, type, data = {}, context = {}) {
    this.filterStats.totalChecks++;
    
    // Fast path: global level check
    if (this.config.globalLevel === VERBOSITY_LEVELS.NONE) {
      this.filterStats.filteredOut++;
      return false;
    }

    // Create cache key for frequently accessed combinations
    const cacheKey = `${category}:${type}`;
    
    // Check cache first
    if (this.filterCache.has(cacheKey)) {
      this.filterStats.cacheHits++;
      const cached = this.filterCache.get(cacheKey);
      
      // Apply dynamic rules if they exist
      if (cached.hasDynamicRules) {
        return this.applyDynamicFiltering(category, type, cached.baseLevel, data, context);
      }
      
      return cached.shouldCapture;
    }

    // Determine base capture decision
    const baseDecision = this.evaluateBaseCapture(category, type);
    
    // Check for dynamic rules
    const hasDynamicRules = this.config.getDynamicRules().length > 0;
    
    // Cache the base decision
    this.filterCache.set(cacheKey, {
      shouldCapture: baseDecision,
      baseLevel: this.getTypeLevel(type),
      hasDynamicRules: hasDynamicRules,
      timestamp: Date.now()
    });

    // Apply dynamic rules if they exist
    if (hasDynamicRules) {
      return this.applyDynamicFiltering(category, type, this.getTypeLevel(type), data, context);
    }

    // Return base decision
    if (!baseDecision) {
      this.filterStats.filteredOut++;
    }
    
    return baseDecision;
  }

  evaluateBaseCapture(category, type) {
    // Get effective level for the category
    const categoryLevel = this.config.getEffectiveLevel(category);
    
    // Get the required level for this type
    const typeInfo = this.typeToLevelCache.get(type);
    
    if (typeInfo) {
      // Use pre-computed type information
      return categoryLevel >= typeInfo.level;
    }

    // Fallback: estimate level based on type naming patterns
    const estimatedLevel = this.estimateTypeLevel(type);
    return categoryLevel >= estimatedLevel;
  }

  getTypeLevel(type) {
    const typeInfo = this.typeToLevelCache.get(type);
    return typeInfo ? typeInfo.level : this.estimateTypeLevel(type);
  }

  estimateTypeLevel(type) {
    // Heuristic-based level estimation for unknown types
    const typeLower = type.toLowerCase();
    
    // Error and critical types
    if (typeLower.includes('error') || typeLower.includes('critical') || typeLower.includes('fail')) {
      return VERBOSITY_LEVELS.MINIMAL;
    }
    
    // Performance and timing types
    if (typeLower.includes('performance') || typeLower.includes('timing') || typeLower.includes('metric')) {
      return VERBOSITY_LEVELS.DETAILED;
    }
    
    // Debug and diagnostic types
    if (typeLower.includes('debug') || typeLower.includes('diagnostic') || typeLower.includes('trace')) {
      return VERBOSITY_LEVELS.DEBUG;
    }
    
    // Core processing types
    if (typeLower.includes('start') || typeLower.includes('complete') || typeLower.includes('process')) {
      return VERBOSITY_LEVELS.BASIC;
    }
    
    // Default to detailed level for unknown types
    return VERBOSITY_LEVELS.DETAILED;
  }

  applyDynamicFiltering(category, type, baseLevel, data, context) {
    this.filterStats.dynamicRuleApplications++;
    
    // Apply all dynamic rules
    for (const [ruleName, ruleFunction] of Object.entries(this.config.dynamicRules)) {
      try {
        const ruleResult = ruleFunction({
          category,
          type,
          baseLevel,
          data,
          context,
          config: this.config
        });
        
        // If any rule returns false, filter out the data
        if (ruleResult === false) {
          this.filterStats.filteredOut++;
          return false;
        }
        
        // If rule returns a specific level, use it instead of base level
        if (typeof ruleResult === 'number' && Object.values(VERBOSITY_LEVELS).includes(ruleResult)) {
          const categoryLevel = this.config.getEffectiveLevel(category);
          const shouldCapture = categoryLevel >= ruleResult;
          
          if (!shouldCapture) {
            this.filterStats.filteredOut++;
          }
          
          return shouldCapture;
        }
        
      } catch (error) {
        this.logger.error(`Error applying dynamic rule '${ruleName}':`, error);
        // Continue with other rules on error
      }
    }

    // All dynamic rules passed or returned true, use base decision
    const categoryLevel = this.config.getEffectiveLevel(category);
    const shouldCapture = categoryLevel >= baseLevel;
    
    if (!shouldCapture) {
      this.filterStats.filteredOut++;
    }
    
    return shouldCapture;
  }

  // Create intelligent data summarization based on verbosity
  summarizeData(category, type, data, targetVerbosity) {
    const currentLevel = this.config.getEffectiveLevel(category);
    
    // If current level is sufficient, return full data
    if (currentLevel >= targetVerbosity) {
      return data;
    }

    // Apply intelligent summarization
    return this.applySummarization(data, currentLevel, targetVerbosity);
  }

  applySummarization(data, currentLevel, targetLevel) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const summarized = { ...data };

    // Remove detailed fields based on level difference
    const levelDifference = targetLevel - currentLevel;
    
    if (levelDifference >= 20) { // DETAILED -> BASIC or lower
      // Remove performance details
      delete summarized.performance;
      delete summarized.timing;
      delete summarized.metrics;
      
      // Truncate arrays
      Object.keys(summarized).forEach(key => {
        if (Array.isArray(summarized[key]) && summarized[key].length > 3) {
          summarized[key] = summarized[key].slice(0, 3);
          summarized[`${key}_truncated`] = true;
          summarized[`${key}_original_length`] = data[key].length;
        }
      });
    }

    if (levelDifference >= 30) { // DEBUG -> BASIC or lower
      // Remove diagnostic information
      delete summarized.diagnostic;
      delete summarized.debug;
      delete summarized.internal;
      
      // Truncate strings
      Object.keys(summarized).forEach(key => {
        if (typeof summarized[key] === 'string' && summarized[key].length > 200) {
          summarized[key] = summarized[key].substring(0, 197) + '...';
        }
      });
    }

    return summarized;
  }

  // Clear filter cache (useful when configuration changes)
  clearCache() {
    this.filterCache.clear();
    this.typeToLevelCache.clear();
    this.initializeTypeLevelCache();
    this.logger.info('Verbosity filter cache cleared');
  }

  // Get filtering statistics
  getFilterStats() {
    const stats = { ...this.filterStats };
    
    // Calculate derived metrics
    stats.filterRate = stats.totalChecks > 0 ? 
      (stats.filteredOut / stats.totalChecks) * 100 : 0;
    
    stats.cacheHitRate = stats.totalChecks > 0 ? 
      (stats.cacheHits / stats.totalChecks) * 100 : 0;
    
    return stats;
  }

  // Reset statistics
  resetStats() {
    this.filterStats = {
      totalChecks: 0,
      filteredOut: 0,
      cacheHits: 0,
      dynamicRuleApplications: 0
    };
  }

  // Optimize cache by removing old entries
  optimizeCache(maxAge = 300000) { // 5 minutes default
    const now = Date.now();
    const toRemove = [];
    
    this.filterCache.forEach((value, key) => {
      if (now - value.timestamp > maxAge) {
        toRemove.push(key);
      }
    });
    
    toRemove.forEach(key => this.filterCache.delete(key));
    
    if (toRemove.length > 0) {
      this.logger.info(`Removed ${toRemove.length} expired entries from verbosity cache`);
    }
  }
}

export default VerbosityFilterManager;
```

### Step 3: Integrate Verbosity Filtering into ActionAwareStructuredTrace

**File**: `src/actions/tracing/actionAwareStructuredTrace.js` (Enhancement)

```javascript
/**
 * Enhanced ActionAwareStructuredTrace with verbosity filtering
 */

import { StructuredTrace } from '../../tracing/structuredTrace.js';
import { validateDependency, assertNonBlankString } from '../../utils/validationUtils.js';
import VerbosityConfig, { VERBOSITY_LEVELS } from './verbosity/verbosityConfig.js';
import VerbosityFilterManager from './verbosity/verbosityFilterManager.js';

class ActionAwareStructuredTrace extends StructuredTrace {
  constructor({ 
    traceId, 
    verbosity = 'basic',
    verbosityConfig = null,
    logger 
  }) {
    super({ traceId });
    
    assertNonBlankString(traceId, 'Trace ID');
    validateDependency(logger, 'ILogger');
    
    // Initialize verbosity system
    this.verbosityConfig = verbosityConfig || this.createDefaultVerbosityConfig(verbosity, logger);
    this.filterManager = new VerbosityFilterManager({
      verbosityConfig: this.verbosityConfig,
      logger: logger
    });
    
    this.logger = logger;
    this.actionData = {};
    
    // Track verbosity changes
    this.verbosityHistory = [{
      timestamp: new Date().toISOString(),
      globalLevel: this.verbosityConfig.globalLevel,
      reason: 'initialization'
    }];
  }

  createDefaultVerbosityConfig(verbosityString, logger) {
    // Convert string verbosity to configuration
    let globalLevel;
    
    switch (verbosityString.toLowerCase()) {
      case 'none':
        globalLevel = VERBOSITY_LEVELS.NONE;
        break;
      case 'minimal':
        globalLevel = VERBOSITY_LEVELS.MINIMAL;
        break;
      case 'basic':
        globalLevel = VERBOSITY_LEVELS.BASIC;
        break;
      case 'detailed':
        globalLevel = VERBOSITY_LEVELS.DETAILED;
        break;
      case 'debug':
        globalLevel = VERBOSITY_LEVELS.DEBUG;
        break;
      case 'ultra':
        globalLevel = VERBOSITY_LEVELS.ULTRA;
        break;
      default:
        globalLevel = VERBOSITY_LEVELS.BASIC;
        logger.warn(`Unknown verbosity level '${verbosityString}', using BASIC`);
    }

    return new VerbosityConfig({
      globalLevel: globalLevel,
      logger: logger
    });
  }

  // Enhanced captureActionData with verbosity filtering
  captureActionData(category, type, data, options = {}) {
    // Apply verbosity filtering
    const shouldCapture = this.filterManager.shouldCapture(
      category, 
      type, 
      data, 
      options.context || {}
    );
    
    if (!shouldCapture) {
      return; // Data filtered out based on verbosity settings
    }

    // Apply data summarization if requested
    let processedData = data;
    if (options.summarize) {
      const targetVerbosity = options.targetVerbosity || this.verbosityConfig.globalLevel;
      processedData = this.filterManager.summarizeData(category, type, data, targetVerbosity);
    }

    // Add verbosity metadata
    const enhancedData = {
      ...processedData,
      _verbosity: {
        category: category,
        type: type,
        captureLevel: this.verbosityConfig.getEffectiveLevel(category),
        timestamp: new Date().toISOString()
      }
    };

    // Delegate to parent class for actual storage
    super.captureActionData(category, type, enhancedData);
  }

  // Dynamic verbosity adjustment
  setVerbosity(level, reason = 'manual_adjustment') {
    const oldLevel = this.verbosityConfig.globalLevel;
    
    try {
      this.verbosityConfig.setGlobalLevel(level);
      
      // Clear filter cache to apply new settings immediately
      this.filterManager.clearCache();
      
      // Record verbosity change
      this.verbosityHistory.push({
        timestamp: new Date().toISOString(),
        previousLevel: oldLevel,
        newLevel: level,
        reason: reason
      });
      
      // Capture verbosity change event
      this.captureActionData('verbosity', 'level_changed', {
        previousLevel: oldLevel,
        newLevel: level,
        reason: reason,
        timestamp: new Date().toISOString()
      });
      
      this.logger.info(`Trace verbosity changed from ${oldLevel} to ${level} (${reason})`);
      
    } catch (error) {
      this.logger.error('Failed to set verbosity level:', error);
      throw error;
    }
  }

  setCategoryVerbosity(category, level, reason = 'manual_adjustment') {
    const oldLevel = this.verbosityConfig.getEffectiveLevel(category);
    
    try {
      this.verbosityConfig.setCategoryLevel(category, level);
      
      // Clear filter cache to apply new settings immediately
      this.filterManager.clearCache();
      
      // Capture category verbosity change
      this.captureActionData('verbosity', 'category_level_changed', {
        category: category,
        previousLevel: oldLevel,
        newLevel: level,
        reason: reason,
        timestamp: new Date().toISOString()
      });
      
      this.logger.info(`Category '${category}' verbosity changed from ${oldLevel} to ${level} (${reason})`);
      
    } catch (error) {
      this.logger.error(`Failed to set category verbosity for '${category}':`, error);
      throw error;
    }
  }

  // Add dynamic filtering rules
  addDynamicVerbosityRule(ruleName, ruleFunction) {
    this.verbosityConfig.addDynamicRule(ruleName, ruleFunction);
    this.filterManager.clearCache(); // Clear cache to apply new rules
    
    this.captureActionData('verbosity', 'dynamic_rule_added', {
      ruleName: ruleName,
      timestamp: new Date().toISOString()
    });
  }

  removeDynamicVerbosityRule(ruleName) {
    this.verbosityConfig.removeDynamicRule(ruleName);
    this.filterManager.clearCache(); // Clear cache to remove rule effects
    
    this.captureActionData('verbosity', 'dynamic_rule_removed', {
      ruleName: ruleName,
      timestamp: new Date().toISOString()
    });
  }

  // Get verbosity statistics
  getVerbosityStats() {
    return {
      currentConfig: this.verbosityConfig.toJSON(),
      filterStats: this.filterManager.getFilterStats(),
      verbosityHistory: [...this.verbosityHistory],
      activeRules: this.verbosityConfig.getDynamicRules()
    };
  }

  // Export filtered data based on target verbosity
  exportFilteredData(targetVerbosity, categories = null) {
    const filteredData = {};
    const categoriesToExport = categories || Object.keys(this.actionData);
    
    for (const category of categoriesToExport) {
      if (!this.actionData[category]) continue;
      
      const categoryData = this.actionData[category];
      filteredData[category] = {};
      
      for (const [type, entries] of Object.entries(categoryData)) {
        const filteredEntries = entries.filter(entry => {
          const entryLevel = entry._verbosity?.captureLevel || VERBOSITY_LEVELS.BASIC;
          return targetVerbosity >= entryLevel;
        }).map(entry => {
          // Apply summarization if needed
          return this.filterManager.summarizeData(category, type, entry, targetVerbosity);
        });
        
        if (filteredEntries.length > 0) {
          filteredData[category][type] = filteredEntries;
        }
      }
    }
    
    return filteredData;
  }

  // Create verbosity report
  createVerbosityReport() {
    const stats = this.getVerbosityStats();
    const dataAnalysis = this.analyzeDataDistribution();
    
    return {
      traceId: this.traceId,
      verbosityConfiguration: stats.currentConfig,
      filteringStatistics: stats.filterStats,
      dataDistribution: dataAnalysis,
      verbosityHistory: stats.verbosityHistory,
      recommendations: this.generateVerbosityRecommendations(stats, dataAnalysis),
      generatedAt: new Date().toISOString()
    };
  }

  analyzeDataDistribution() {
    const distribution = {};
    let totalEntries = 0;
    
    for (const [category, categoryData] of Object.entries(this.actionData)) {
      distribution[category] = {
        types: {},
        totalEntries: 0,
        levelDistribution: {}
      };
      
      for (const [type, entries] of Object.entries(categoryData)) {
        distribution[category].types[type] = entries.length;
        distribution[category].totalEntries += entries.length;
        totalEntries += entries.length;
        
        // Analyze level distribution
        entries.forEach(entry => {
          const level = entry._verbosity?.captureLevel || 'unknown';
          distribution[category].levelDistribution[level] = 
            (distribution[category].levelDistribution[level] || 0) + 1;
        });
      }
    }
    
    return {
      byCategory: distribution,
      totalEntries: totalEntries,
      captureEfficiency: this.calculateCaptureEfficiency()
    };
  }

  calculateCaptureEfficiency() {
    const filterStats = this.filterManager.getFilterStats();
    
    return {
      totalChecks: filterStats.totalChecks,
      capturedEntries: filterStats.totalChecks - filterStats.filteredOut,
      filterRate: filterStats.filterRate,
      cacheHitRate: filterStats.cacheHitRate,
      efficiency: filterStats.cacheHitRate > 0 ? 
        (100 - filterStats.filterRate + filterStats.cacheHitRate) / 2 : 
        (100 - filterStats.filterRate)
    };
  }

  generateVerbosityRecommendations(stats, dataAnalysis) {
    const recommendations = [];
    
    // Check for excessive filtering
    if (stats.filterStats.filterRate > 80) {
      recommendations.push({
        type: 'verbosity_too_low',
        message: 'High filter rate suggests verbosity levels may be too restrictive',
        suggestion: 'Consider increasing verbosity for key categories',
        priority: 'medium'
      });
    }
    
    // Check for low cache hit rate
    if (stats.filterStats.cacheHitRate < 50 && stats.filterStats.totalChecks > 100) {
      recommendations.push({
        type: 'cache_inefficiency',
        message: 'Low cache hit rate indicates frequent unique category/type combinations',
        suggestion: 'Review dynamic rules or consider cache optimization',
        priority: 'low'
      });
    }
    
    // Check for categories with no data
    const categoriesWithoutData = Object.keys(this.verbosityConfig.categoryLevels).filter(
      category => !dataAnalysis.byCategory[category] || dataAnalysis.byCategory[category].totalEntries === 0
    );
    
    if (categoriesWithoutData.length > 0) {
      recommendations.push({
        type: 'unused_categories',
        message: `Categories with no captured data: ${categoriesWithoutData.join(', ')}`,
        suggestion: 'Consider lowering verbosity for these categories or verify they are being used',
        priority: 'low'
      });
    }
    
    return recommendations;
  }

  // Cleanup method for performance optimization
  optimizePerformance() {
    // Optimize filter cache
    this.filterManager.optimizeCache();
    
    // Reset statistics if they're getting large
    const stats = this.filterManager.getFilterStats();
    if (stats.totalChecks > 100000) {
      this.filterManager.resetStats();
      this.logger.info('Verbosity filter statistics reset for performance optimization');
    }
  }
}

export { ActionAwareStructuredTrace, VERBOSITY_LEVELS };
```

### Step 4: Verbosity System Tests

**File**: `tests/unit/actions/tracing/verbosity/verbosityConfig.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import VerbosityConfig, { VERBOSITY_LEVELS, VERBOSITY_CATEGORIES } from '../../../../../src/actions/tracing/verbosity/verbosityConfig.js';

describe('VerbosityConfig', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  });

  describe('Configuration Management', () => {
    it('should initialize with default settings', () => {
      const config = new VerbosityConfig({ logger: mockLogger });

      expect(config.globalLevel).toBe(VERBOSITY_LEVELS.BASIC);
      expect(config.getEffectiveLevel('core')).toBeDefined();
      expect(config.getEffectiveLevel('performance')).toBeDefined();
    });

    it('should set global verbosity level', () => {
      const config = new VerbosityConfig({ logger: mockLogger });

      config.setGlobalLevel(VERBOSITY_LEVELS.DETAILED);

      expect(config.globalLevel).toBe(VERBOSITY_LEVELS.DETAILED);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should reject invalid verbosity levels', () => {
      const config = new VerbosityConfig({ logger: mockLogger });

      expect(() => {
        config.setGlobalLevel(999);
      }).toThrow('Invalid verbosity level: 999');
    });

    it('should set category-specific levels', () => {
      const config = new VerbosityConfig({ logger: mockLogger });

      config.setCategoryLevel('performance', VERBOSITY_LEVELS.DEBUG);

      expect(config.getEffectiveLevel('performance')).toBe(VERBOSITY_LEVELS.DEBUG);
      expect(config.getEffectiveLevel('core')).toBe(VERBOSITY_LEVELS.BASIC); // Should remain unchanged
    });

    it('should manage dynamic rules', () => {
      const config = new VerbosityConfig({ logger: mockLogger });
      const testRule = ({ category, type }) => category === 'test';

      config.addDynamicRule('testRule', testRule);

      expect(config.getDynamicRules()).toContain('testRule');
      expect(config.dynamicRules.testRule).toBe(testRule);

      config.removeDynamicRule('testRule');

      expect(config.getDynamicRules()).not.toContain('testRule');
    });
  });

  describe('Preset Configurations', () => {
    it('should create production preset', () => {
      const config = VerbosityConfig.createPreset('production');

      expect(config.globalLevel).toBe(VERBOSITY_LEVELS.MINIMAL);
      expect(config.getEffectiveLevel('core')).toBe(VERBOSITY_LEVELS.BASIC);
      expect(config.getEffectiveLevel('performance')).toBe(VERBOSITY_LEVELS.NONE);
    });

    it('should create development preset', () => {
      const config = VerbosityConfig.createPreset('development');

      expect(config.globalLevel).toBe(VERBOSITY_LEVELS.DETAILED);
      expect(config.getEffectiveLevel('diagnostic')).toBe(VERBOSITY_LEVELS.DEBUG);
    });

    it('should create debug preset', () => {
      const config = VerbosityConfig.createPreset('debug');

      expect(config.globalLevel).toBe(VERBOSITY_LEVELS.DEBUG);
      expect(config.getEffectiveLevel('core')).toBe(VERBOSITY_LEVELS.ULTRA);
    });

    it('should throw error for unknown preset', () => {
      expect(() => {
        VerbosityConfig.createPreset('unknown');
      }).toThrow('Unknown preset: unknown');
    });
  });

  describe('Serialization', () => {
    it('should serialize configuration to JSON', () => {
      const config = new VerbosityConfig({
        globalLevel: VERBOSITY_LEVELS.DETAILED,
        categoryLevels: { core: VERBOSITY_LEVELS.DEBUG },
        logger: mockLogger
      });

      const json = config.toJSON();

      expect(json.globalLevel).toBe(VERBOSITY_LEVELS.DETAILED);
      expect(json.categoryLevels.core).toBe(VERBOSITY_LEVELS.DEBUG);
      expect(json.dynamicRules).toEqual([]);
    });

    it('should create configuration from JSON', () => {
      const configData = {
        globalLevel: VERBOSITY_LEVELS.DEBUG,
        categoryLevels: { performance: VERBOSITY_LEVELS.ULTRA }
      };

      const config = VerbosityConfig.fromJSON(configData, mockLogger);

      expect(config.globalLevel).toBe(VERBOSITY_LEVELS.DEBUG);
      expect(config.getEffectiveLevel('performance')).toBe(VERBOSITY_LEVELS.ULTRA);
    });
  });

  describe('Validation', () => {
    it('should validate configuration and fix invalid levels', () => {
      const config = new VerbosityConfig({
        globalLevel: 999, // Invalid level
        logger: mockLogger
      });

      expect(config.globalLevel).toBe(VERBOSITY_LEVELS.BASIC);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should initialize missing category levels with defaults', () => {
      const config = new VerbosityConfig({ logger: mockLogger });

      // All defined categories should have levels
      Object.keys(VERBOSITY_CATEGORIES).forEach(category => {
        expect(config.getEffectiveLevel(category.toLowerCase())).toBeDefined();
      });
    });
  });
});
```

**File**: `tests/unit/actions/tracing/verbosity/verbosityFilterManager.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import VerbosityFilterManager from '../../../../../src/actions/tracing/verbosity/verbosityFilterManager.js';
import VerbosityConfig, { VERBOSITY_LEVELS } from '../../../../../src/actions/tracing/verbosity/verbosityConfig.js';

describe('VerbosityFilterManager', () => {
  let filterManager;
  let verbosityConfig;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    verbosityConfig = new VerbosityConfig({
      globalLevel: VERBOSITY_LEVELS.BASIC,
      logger: mockLogger
    });

    filterManager = new VerbosityFilterManager({
      verbosityConfig: verbosityConfig,
      logger: mockLogger
    });
  });

  describe('Basic Filtering', () => {
    it('should allow capture when level is sufficient', () => {
      verbosityConfig.setGlobalLevel(VERBOSITY_LEVELS.DETAILED);
      filterManager.clearCache(); // Apply new config

      const shouldCapture = filterManager.shouldCapture('core', 'action_start', {});

      expect(shouldCapture).toBe(true);
    });

    it('should filter out when level is insufficient', () => {
      verbosityConfig.setGlobalLevel(VERBOSITY_LEVELS.MINIMAL);
      filterManager.clearCache(); // Apply new config

      const shouldCapture = filterManager.shouldCapture('diagnostic', 'debug_info', {});

      expect(shouldCapture).toBe(false);
    });

    it('should respect category-specific levels', () => {
      verbosityConfig.setGlobalLevel(VERBOSITY_LEVELS.MINIMAL);
      verbosityConfig.setCategoryLevel('performance', VERBOSITY_LEVELS.DETAILED);
      filterManager.clearCache();

      const coreCapture = filterManager.shouldCapture('core', 'timing_data', {});
      const perfCapture = filterManager.shouldCapture('performance', 'timing_data', {});

      expect(coreCapture).toBe(false); // Global level is MINIMAL
      expect(perfCapture).toBe(true);  // Performance category is DETAILED
    });

    it('should filter out everything when global level is NONE', () => {
      verbosityConfig.setGlobalLevel(VERBOSITY_LEVELS.NONE);
      filterManager.clearCache();

      const shouldCapture = filterManager.shouldCapture('core', 'action_start', {});

      expect(shouldCapture).toBe(false);
    });
  });

  describe('Dynamic Rule Processing', () => {
    it('should apply dynamic rules', () => {
      const dynamicRule = ({ category, type }) => {
        return !(category === 'test' && type === 'filtered_type');
      };

      verbosityConfig.addDynamicRule('testFilter', dynamicRule);

      const allowedCapture = filterManager.shouldCapture('test', 'allowed_type', {});
      const filteredCapture = filterManager.shouldCapture('test', 'filtered_type', {});

      expect(allowedCapture).toBe(true);
      expect(filteredCapture).toBe(false);
    });

    it('should handle dynamic rule errors gracefully', () => {
      const errorRule = () => {
        throw new Error('Rule error');
      };

      verbosityConfig.addDynamicRule('errorRule', errorRule);

      const shouldCapture = filterManager.shouldCapture('core', 'action_start', {});

      expect(shouldCapture).toBe(true); // Should continue despite rule error
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should support level-returning dynamic rules', () => {
      const levelRule = ({ type }) => {
        return type === 'special' ? VERBOSITY_LEVELS.ULTRA : true;
      };

      verbosityConfig.setGlobalLevel(VERBOSITY_LEVELS.DEBUG);
      verbosityConfig.addDynamicRule('levelRule', levelRule);

      const normalCapture = filterManager.shouldCapture('core', 'normal', {});
      const specialCapture = filterManager.shouldCapture('core', 'special', {});

      expect(normalCapture).toBe(true);
      expect(specialCapture).toBe(false); // Requires ULTRA but only have DEBUG
    });
  });

  describe('Performance Optimization', () => {
    it('should cache filter decisions', () => {
      // First call
      const result1 = filterManager.shouldCapture('core', 'action_start', {});
      
      // Second call should use cache
      const result2 = filterManager.shouldCapture('core', 'action_start', {});

      expect(result1).toBe(result2);
      
      const stats = filterManager.getFilterStats();
      expect(stats.cacheHits).toBeGreaterThan(0);
    });

    it('should optimize cache by removing old entries', () => {
      // Add entries to cache
      filterManager.shouldCapture('core', 'test1', {});
      filterManager.shouldCapture('core', 'test2', {});
      
      // Optimize with very short max age to force removal
      filterManager.optimizeCache(0);

      const stats = filterManager.getFilterStats();
      expect(stats.cacheHits).toBe(0); // Cache should be cleared
    });

    it('should estimate levels for unknown types', () => {
      const errorLevel = filterManager.estimateTypeLevel('error_occurred');
      const performanceLevel = filterManager.estimateTypeLevel('performance_metric');
      const debugLevel = filterManager.estimateTypeLevel('debug_trace');

      expect(errorLevel).toBe(VERBOSITY_LEVELS.MINIMAL);
      expect(performanceLevel).toBe(VERBOSITY_LEVELS.DETAILED);
      expect(debugLevel).toBe(VERBOSITY_LEVELS.DEBUG);
    });
  });

  describe('Data Summarization', () => {
    it('should summarize data when level is insufficient', () => {
      const fullData = {
        id: 'test',
        performance: { timing: 100, memory: 500 },
        details: ['item1', 'item2', 'item3', 'item4', 'item5'],
        diagnostic: { debug: true }
      };

      const summarized = filterManager.summarizeData(
        'core', 
        'test', 
        fullData, 
        VERBOSITY_LEVELS.DETAILED
      );

      // Should remove performance data and truncate arrays for BASIC level
      expect(summarized.performance).toBeUndefined();
      expect(summarized.details).toHaveLength(3);
      expect(summarized.details_truncated).toBe(true);
    });

    it('should return full data when level is sufficient', () => {
      const fullData = { id: 'test', details: 'full details' };

      verbosityConfig.setGlobalLevel(VERBOSITY_LEVELS.ULTRA);
      
      const result = filterManager.summarizeData(
        'core', 
        'test', 
        fullData, 
        VERBOSITY_LEVELS.BASIC
      );

      expect(result).toEqual(fullData);
    });

    it('should truncate long strings in high summarization', () => {
      const longString = 'x'.repeat(500);
      const data = { longField: longString };

      verbosityConfig.setGlobalLevel(VERBOSITY_LEVELS.MINIMAL);

      const summarized = filterManager.summarizeData(
        'core', 
        'test', 
        data, 
        VERBOSITY_LEVELS.DEBUG
      );

      expect(summarized.longField.length).toBeLessThan(longString.length);
      expect(summarized.longField).toEndWith('...');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track filter statistics', () => {
      verbosityConfig.setGlobalLevel(VERBOSITY_LEVELS.BASIC);
      filterManager.clearCache();

      // Generate some activity
      filterManager.shouldCapture('core', 'action_start', {}); // Should capture
      filterManager.shouldCapture('diagnostic', 'debug_info', {}); // Should filter
      filterManager.shouldCapture('core', 'action_start', {}); // Cache hit

      const stats = filterManager.getFilterStats();

      expect(stats.totalChecks).toBe(3);
      expect(stats.filteredOut).toBe(1);
      expect(stats.cacheHits).toBe(1);
      expect(stats.filterRate).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeGreaterThan(0);
    });

    it('should reset statistics', () => {
      // Generate activity
      filterManager.shouldCapture('core', 'test', {});

      filterManager.resetStats();

      const stats = filterManager.getFilterStats();
      expect(stats.totalChecks).toBe(0);
      expect(stats.filteredOut).toBe(0);
    });
  });
});
```

## Testing Requirements

### Unit Tests Required
- [ ] VerbosityConfig initialization and configuration management
- [ ] Verbosity level validation and error handling
- [ ] Preset configuration creation and validation
- [ ] VerbosityFilterManager filtering logic
- [ ] Dynamic rule processing and error handling
- [ ] Cache optimization and performance
- [ ] Data summarization algorithms
- [ ] ActionAwareStructuredTrace verbosity integration

### Integration Tests Required
- [ ] End-to-end verbosity filtering across all pipeline stages
- [ ] Dynamic verbosity adjustment during trace execution
- [ ] Performance impact measurement with different verbosity levels
- [ ] Memory usage analysis with large data sets

### Performance Tests Required
- [ ] Filter decision performance (<0.1ms per check)
- [ ] Cache hit rate optimization
- [ ] Memory efficiency with different verbosity levels
- [ ] Data summarization performance

## Acceptance Criteria

### Functional Requirements
- [ ] Hierarchical verbosity levels properly implemented
- [ ] Category-specific verbosity configuration works correctly
- [ ] Dynamic verbosity rules apply correctly
- [ ] Data summarization produces appropriate results
- [ ] Verbosity changes apply immediately without restart
- [ ] Filter statistics provide meaningful insights

### Performance Requirements
- [ ] Filter decisions complete within 0.1ms
- [ ] Cache hit rate exceeds 70% for typical usage patterns
- [ ] Memory usage scales linearly with verbosity level
- [ ] No measurable performance impact at NONE verbosity level

### Quality Requirements
- [ ] 90% test coverage for verbosity system components
- [ ] Comprehensive error handling for invalid configurations
- [ ] Clear documentation for verbosity levels and categories
- [ ] Performance benchmarks documented

## Dependencies

### Prerequisite Tickets
- ACTTRA-009: ActionAwareStructuredTrace class (Foundation)

### Related Systems
- All pipeline stages for verbosity-aware trace capture
- Action discovery and processing systems
- Performance monitoring and optimization systems

### External Dependencies
- Logger system for configuration and error reporting
- Performance timing APIs for optimization
- Memory management utilities

## Effort Estimation

**Total Effort: 14 hours**

- Verbosity configuration system: 4 hours
- Filter manager implementation: 5 hours
- ActionAwareStructuredTrace integration: 2 hours
- Unit tests: 2 hours
- Integration tests: 1 hour

## Implementation Notes

### Performance Optimization
- Pre-computed type-to-level mappings for common cases
- LRU cache with automatic expiration for filter decisions
- Efficient data summarization algorithms
- Lazy evaluation of dynamic rules

### Configuration Management
- Support for preset configurations (production, development, debug)
- JSON serialization for configuration persistence
- Runtime configuration updates without service restart
- Validation and error recovery for invalid configurations

### Data Management
- Intelligent summarization preserving critical information
- Category-specific filtering rules
- Historical verbosity tracking
- Comprehensive filtering statistics and recommendations

This ticket provides comprehensive verbosity-based filtering for the action tracing system, enabling fine-grained control over trace data collection while maintaining optimal performance and storage efficiency.