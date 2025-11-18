/**
 * @file Common character definition validation service for character builder pages
 * @description Provides reusable validation logic for character definitions across multiple features
 * @see EnhancedSpeechPatternsValidator.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../validation/ajvSchemaValidator.js').default} AjvSchemaValidator
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} isValid - Overall validation status
 * @property {Array<string>} errors - Blocking validation errors
 * @property {Array<string>} warnings - Non-blocking issues that should be addressed
 * @property {Array<string>} suggestions - Improvement recommendations
 * @property {object} quality - Quality assessment metrics
 * @property {object} context - Additional validation context
 */

/**
 * @typedef {object} SemanticValidationRule
 * @property {string} id - Rule identifier
 * @property {string} name - Human-readable rule name
 * @property {Function} validator - Validation function
 * @property {string} category - Rule category (consistency, completeness, etc.)
 * @property {number} priority - Rule priority (1-10, higher = more important)
 */

/**
 * @typedef {object} QualityMetric
 * @property {string} id - Metric identifier
 * @property {string} name - Human-readable metric name
 * @property {Function} assessor - Assessment function
 * @property {number} weight - Metric weight in overall score (0-1)
 * @property {object} thresholds - Quality thresholds (low, medium, high)
 */

/**
 * Common character definition validation service
 * Provides reusable validation logic for character definitions
 */
export class CharacterDefinitionValidator {
  /** @private @type {ILogger} */
  #logger;

  /** @private @type {AjvSchemaValidator|null} */
  #schemaValidator = null;

  /** @private @type {Map<string, SemanticValidationRule>} */
  #semanticRules = new Map();

  /** @private @type {Map<string, QualityMetric>} */
  #qualityMetrics = new Map();

  /** @private @type {Map<string, object>} */
  #validationCache = new Map();

  /** @private @type {number} */
  #cacheMaxSize = 50;

  /** @private @type {number} */
  #cacheTTL = 600000; // 10 minutes

  /** @private @type {object} */
  #suggestionTemplates = {};

  /**
   * Create character definition validator instance
   *
   * @param {object} dependencies - Service dependencies
   */
  constructor(dependencies) {
    validateDependency(dependencies.logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = dependencies.logger;

    // Schema validator is optional
    if (dependencies.schemaValidator) {
      this.#schemaValidator = dependencies.schemaValidator;
    }

    this.#initializeSemanticRules();
    this.#initializeQualityMetrics();
    this.#initializeSuggestionTemplates();

    this.#logger.debug('CharacterDefinitionValidator initialized', {
      semanticRules: this.#semanticRules.size,
      qualityMetrics: this.#qualityMetrics.size,
    });
  }

  /**
   * Validate character definition
   *
   * @param {object} characterData - Character definition to validate
   * @param {object} options - Validation options
   * @returns {Promise<ValidationResult>} Comprehensive validation result
   */
  async validateCharacterDefinition(characterData, options = {}) {
    const cacheKey = this.#generateCacheKey(characterData, options);

    // Check cache first
    const cached = this.#getCachedValidation(cacheKey);
    if (cached) {
      this.#logger.debug('Returning cached validation result');
      return cached;
    }

    const startTime = Date.now();
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      quality: {},
      context: {
        validationTime: 0,
        cacheKey,
        layers: {},
      },
    };

    try {
      // Layer 1: Structural validation
      const structuralStart = Date.now();
      const structuralResult =
        this.#validateCharacterDefinitionStructure(characterData);
      result.context.layers.structural = {
        duration: Date.now() - structuralStart,
        isValid: structuralResult.isValid,
      };

      if (!structuralResult.isValid) {
        result.errors.push(...structuralResult.errors);
        result.isValid = false;
      }

      // Continue with additional layers even if structural validation fails
      // to provide comprehensive feedback

      // Layer 2: Semantic validation
      if (characterData && typeof characterData === 'object') {
        const semanticStart = Date.now();
        const semanticResult = this.#performSemanticValidation(
          characterData,
          options
        );
        result.context.layers.semantic = {
          duration: Date.now() - semanticStart,
          rulesApplied: semanticResult.rulesApplied,
        };

        result.warnings.push(...semanticResult.warnings);
        result.suggestions.push(...semanticResult.suggestions);

        // Semantic errors are treated as warnings to avoid blocking
        if (semanticResult.errors.length > 0) {
          result.warnings.push(...semanticResult.errors);
        }
      }

      // Layer 3: Quality assessment
      if (characterData && typeof characterData === 'object') {
        const qualityStart = Date.now();
        const qualityResult = this.#performQualityAssessment(
          characterData,
          options
        );
        result.context.layers.quality = {
          duration: Date.now() - qualityStart,
          metricsApplied: qualityResult.metricsApplied,
        };

        result.quality = qualityResult.metrics;
        result.suggestions.push(...qualityResult.suggestions);

        // Add quality-based warnings
        const overallScore =
          qualityResult.metrics?.overallScore ?? qualityResult.overallScore ?? 0;
        if (overallScore < 0.4) {
          result.warnings.push(
            'Character definition may need more detail for optimal results'
          );
        }
      }

      // Generate contextual suggestions based on validation results
      const suggestionsResult = this.#generateContextualSuggestions(
        characterData,
        result,
        options
      );
      result.suggestions.push(...suggestionsResult);

      // Limit total suggestions to avoid overwhelming users
      result.suggestions = [...new Set(result.suggestions)].slice(0, 8);

      // Final processing
      result.context.validationTime = Date.now() - startTime;

      // Cache successful validation
      this.#setCachedValidation(cacheKey, result);

      this.#logger.debug('Character definition validation completed', {
        validationTime: result.context.validationTime,
        errors: result.errors.length,
        warnings: result.warnings.length,
        suggestions: result.suggestions.length,
        qualityScore: result.quality.overallScore,
      });

      return result;
    } catch (error) {
      this.#logger.error('Character definition validation failed', error);
      return {
        isValid: false,
        errors: [`Validation system error: ${error.message}`],
        warnings: [],
        suggestions: [],
        quality: {},
        context: {
          validationTime: Date.now() - startTime,
          error: error.message,
        },
      };
    }
  }

  /**
   * Extract character name from various component formats
   *
   * @param {object} characterData - Character definition data
   * @returns {string|null} Character name or null
   */
  extractCharacterName(characterData) {
    if (!characterData || typeof characterData !== 'object') {
      return null;
    }

    const components = characterData.components || characterData;
    const nameComponent = components['core:name'];

    if (!nameComponent) {
      return null;
    }

    return this.#extractCharacterNameFromComponent(nameComponent);
  }

  /**
   * Extract specific traits from character definition
   *
   * @param {object} characterData - Character definition data
   * @param {Array<string>} traitKeys - List of trait keys to extract (e.g., ['core:likes', 'core:fears'])
   * @returns {object} Object with trait keys and their values
   */
  extractTraits(characterData, traitKeys) {
    if (!characterData || typeof characterData !== 'object') {
      return {};
    }

    const components = characterData.components || characterData;
    const traits = {};

    for (const key of traitKeys) {
      if (components[key]) {
        traits[key] = components[key];
      }
    }

    return traits;
  }

  /**
   * Validate character definition structure
   *
   * @private
   * @param {object} characterData - Character definition data
   * @returns {object} Validation result
   */
  #validateCharacterDefinitionStructure(characterData) {
    const errors = [];

    // Check if it's an object
    if (!characterData || typeof characterData !== 'object') {
      errors.push('Character definition must be a JSON object');
      return { isValid: false, errors };
    }

    // Support both formats:
    // 1. New format: { "components": { "core:name": {...} } }
    // 2. Legacy format: { "core:name": {...} }
    const componentsToCheck = characterData.components || characterData;

    // Check for character components
    const componentKeys = Object.keys(componentsToCheck).filter((key) =>
      key.includes(':')
    );

    if (componentKeys.length === 0) {
      errors.push(
        'No character components found. Expected components like core:name, core:personality, etc.'
      );
      return { isValid: false, errors };
    }

    // Validate core:name component if present
    const nameComponent = componentsToCheck['core:name'];
    if (nameComponent) {
      const characterName =
        this.#extractCharacterNameFromComponent(nameComponent);

      const candidateFields = ['text', 'name', 'value'];
      const hasWhitespaceOnlyExplicitName = candidateFields.some((field) => {
        const value = nameComponent[field];
        return typeof value === 'string' && value.trim().length === 0;
      });

      let hasWhitespaceOnlyPersonalName = false;
      if (
        nameComponent.personal &&
        typeof nameComponent.personal === 'object'
      ) {
        const { firstName, lastName } = nameComponent.personal;
        const firstTrimmed =
          typeof firstName === 'string' ? firstName.trim() : '';
        const lastTrimmed =
          typeof lastName === 'string' ? lastName.trim() : '';

        if (
          (typeof firstName === 'string' || typeof lastName === 'string') &&
          firstTrimmed.length === 0 &&
          lastTrimmed.length === 0
        ) {
          hasWhitespaceOnlyPersonalName = true;
        }
      }

      if (!characterName) {
        if (hasWhitespaceOnlyExplicitName || hasWhitespaceOnlyPersonalName) {
          errors.push('Character name cannot be empty');
        } else {
          errors.push(
            'Character name component exists but does not contain a valid name. Expected text, name, or value field.'
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      componentCount: componentKeys.length,
      characterName: nameComponent
        ? this.#extractCharacterNameFromComponent(nameComponent)
        : null,
    };
  }

  /**
   * Extract character name from core:name component
   *
   * @private
   * @param {object} nameComponent - The core:name component data
   * @returns {string|null} Extracted character name or null if not found
   */
  #extractCharacterNameFromComponent(nameComponent) {
    if (!nameComponent || typeof nameComponent !== 'object') {
      return null;
    }

    // Try different common field names
    if (nameComponent.text && typeof nameComponent.text === 'string') {
      return nameComponent.text.trim();
    }

    if (nameComponent.name && typeof nameComponent.name === 'string') {
      return nameComponent.name.trim();
    }

    if (nameComponent.value && typeof nameComponent.value === 'string') {
      return nameComponent.value.trim();
    }

    // Check for nested structures
    if (nameComponent.personal && nameComponent.personal.firstName) {
      const firstName = nameComponent.personal.firstName;
      const lastName = nameComponent.personal.lastName || '';
      return `${firstName} ${lastName}`.trim();
    }

    return null;
  }

  /**
   * Initialize semantic validation rules
   *
   * @private
   */
  #initializeSemanticRules() {
    // Character consistency rules
    this.#addSemanticRule({
      id: 'character_name_consistency',
      name: 'Character Name Consistency',
      category: 'consistency',
      priority: 9,
      validator: (data) => this.#validateCharacterNameConsistency(data),
    });

    this.#addSemanticRule({
      id: 'personality_trait_alignment',
      name: 'Personality Trait Alignment',
      category: 'consistency',
      priority: 8,
      validator: (data) => this.#validatePersonalityAlignment(data),
    });

    this.#addSemanticRule({
      id: 'component_completeness',
      name: 'Component Completeness',
      category: 'completeness',
      priority: 7,
      validator: (data) => this.#validateComponentCompleteness(data),
    });

    this.#addSemanticRule({
      id: 'content_depth',
      name: 'Content Depth Assessment',
      category: 'quality',
      priority: 5,
      validator: (data) => this.#validateContentDepth(data),
    });
  }

  /**
   * Initialize quality assessment metrics
   *
   * @private
   */
  #initializeQualityMetrics() {
    // Character depth metrics
    this.#addQualityMetric({
      id: 'character_completeness',
      name: 'Character Completeness',
      weight: 0.3,
      thresholds: { low: 0.3, medium: 0.6, high: 0.8 },
      assessor: (data) => this.#assessCharacterCompleteness(data),
    });

    this.#addQualityMetric({
      id: 'personality_depth',
      name: 'Personality Depth',
      weight: 0.25,
      thresholds: { low: 0.4, medium: 0.7, high: 0.9 },
      assessor: (data) => this.#assessPersonalityDepth(data),
    });

    this.#addQualityMetric({
      id: 'background_richness',
      name: 'Background Richness',
      weight: 0.2,
      thresholds: { low: 0.3, medium: 0.6, high: 0.8 },
      assessor: (data) => this.#assessBackgroundRichness(data),
    });

    this.#addQualityMetric({
      id: 'narrative_potential',
      name: 'Narrative Potential',
      weight: 0.25,
      thresholds: { low: 0.3, medium: 0.6, high: 0.9 },
      assessor: (data) => this.#assessNarrativePotential(data),
    });
  }

  /**
   * Initialize suggestion templates
   *
   * @private
   */
  #initializeSuggestionTemplates() {
    this.#suggestionTemplates = {
      missingComponents: {
        'core:personality':
          'Add personality traits to define how the character thinks and behaves',
        'core:profile':
          'Include background information like age, occupation, and history',
        'core:likes': 'Define what the character enjoys or values',
        'core:dislikes': 'Specify what the character avoids or opposes',
        'core:fears': 'Add fears or anxieties that drive character behavior',
        'core:goals':
          'Include short-term and long-term goals that motivate the character',
        'core:strengths': 'Define character strengths and capabilities',
        'core:weaknesses': 'Add character weaknesses and limitations',
        'core:secrets': 'Include hidden information about the character',
        'core:notes': 'Add additional notes about the character',
      },
      improvementSuggestions: {
        lowDetail:
          'Consider expanding component details with specific examples and descriptions',
        genericContent:
          'Replace generic descriptions with specific, unique character traits',
        inconsistencies:
          'Review components for consistency in tone, background, and personality',
        missingContext:
          'Add contextual information about relationships, environment, and history',
      },
      structuralSuggestions: {
        formatIssues:
          'Ensure all components follow the proper format with descriptive content',
        organizationTips:
          'Group related information within appropriate components',
        namingConventions:
          'Use consistent component naming (namespace:component format)',
      },
    };
  }

  /**
   * Add semantic validation rule
   *
   * @private
   * @param {SemanticValidationRule} rule - Rule to add
   */
  #addSemanticRule(rule) {
    this.#semanticRules.set(rule.id, rule);
  }

  /**
   * Register custom semantic validation rule
   *
   * @description Allows dynamic registration of additional semantic validation rules for extensibility and testing.
   * @param {SemanticValidationRule} rule - Rule to register
   * @returns {void}
   */
  registerSemanticRule(rule) {
    if (!rule || typeof rule !== 'object') {
      throw new Error('Semantic rule must be an object');
    }

    if (!rule.id || typeof rule.id !== 'string') {
      throw new Error('Semantic rule must include an id');
    }

    if (typeof rule.validator !== 'function') {
      throw new Error('Semantic rule must provide a validator function');
    }

    const normalizedRule = {
      priority: typeof rule.priority === 'number' ? rule.priority : 5,
      name: rule.name || rule.id,
      category: rule.category || 'custom',
      ...rule,
    };

    this.#addSemanticRule(normalizedRule);
  }

  /**
   * Add quality assessment metric
   *
   * @private
   * @param {QualityMetric} metric - Metric to add
   */
  #addQualityMetric(metric) {
    this.#qualityMetrics.set(metric.id, metric);
  }

  /**
   * Register custom quality assessment metric
   *
   * @description Allows dynamic registration of quality metrics for extensibility and focused testing scenarios.
   * @param {QualityMetric} metric - Metric definition to register
   * @returns {void}
   */
  registerQualityMetric(metric) {
    if (!metric || typeof metric !== 'object') {
      throw new Error('Quality metric must be an object');
    }

    if (!metric.id || typeof metric.id !== 'string') {
      throw new Error('Quality metric must include an id');
    }

    if (typeof metric.assessor !== 'function') {
      throw new Error('Quality metric must provide an assessor function');
    }

    if (typeof metric.weight !== 'number' || Number.isNaN(metric.weight)) {
      throw new Error('Quality metric must include a numeric weight');
    }

    const normalizedMetric = {
      thresholds: metric.thresholds || {
        low: 0.3,
        medium: 0.6,
        high: 0.9,
      },
      ...metric,
    };

    this.#addQualityMetric(normalizedMetric);
  }

  /**
   * Perform semantic validation
   *
   * @private
   * @param {object} data - Data to validate
   * @param {object} options - Validation options
   * @returns {object} Semantic validation result
   */
  #performSemanticValidation(data, options = {}) {
    const result = {
      errors: [],
      warnings: [],
      suggestions: [],
      rulesApplied: [],
    };

    // Sort rules by priority (higher first)
    const sortedRules = Array.from(this.#semanticRules.values()).sort(
      (a, b) => b.priority - a.priority
    );

    for (const rule of sortedRules) {
      try {
        const ruleResult = rule.validator(data, options);
        result.rulesApplied.push(rule.id);

        if (ruleResult.errors) {
          result.errors.push(...ruleResult.errors);
        }
        if (ruleResult.warnings) {
          result.warnings.push(...ruleResult.warnings);
        }
        if (ruleResult.suggestions) {
          result.suggestions.push(...ruleResult.suggestions);
        }
      } catch (error) {
        this.#logger.warn(`Semantic rule '${rule.id}' failed`, error);
        result.warnings.push(
          `Internal validation warning: ${rule.name} check encountered an issue`
        );
      }
    }

    return result;
  }

  /**
   * Perform quality assessment
   *
   * @private
   * @param {object} data - Data to assess
   * @param {object} options - Assessment options
   * @returns {object} Quality assessment result
   */
  #performQualityAssessment(data, options = {}) {
    const result = {
      metrics: {
        overallScore: 0,
        breakdown: {},
      },
      suggestions: [],
      metricsApplied: [],
    };

    let totalWeight = 0;
    let weightedScore = 0;

    // Apply each quality metric
    for (const [metricId, metric] of this.#qualityMetrics) {
      try {
        const assessment = metric.assessor(data, options);
        result.metricsApplied.push(metricId);

        result.metrics.breakdown[metricId] = {
          score: assessment.score,
          level: this.#getQualityLevel(assessment.score, metric.thresholds),
          details: assessment.details || {},
        };

        // Accumulate weighted score
        weightedScore += assessment.score * metric.weight;
        totalWeight += metric.weight;

        // Add metric-specific suggestions
        if (assessment.suggestions) {
          result.suggestions.push(...assessment.suggestions);
        }
      } catch (error) {
        this.#logger.warn(`Quality metric '${metricId}' failed`, error);
        result.metrics.breakdown[metricId] = {
          score: 0,
          level: 'error',
          details: { error: error.message },
        };
      }
    }

    // Calculate overall score
    result.metrics.overallScore =
      totalWeight > 0 ? weightedScore / totalWeight : 0;
    result.metrics.overallLevel = this.#getOverallQualityLevel(
      result.metrics.overallScore
    );

    return result;
  }

  /**
   * Generate contextual suggestions based on validation results
   *
   * @private
   * @param {object} input - Original input
   * @param {ValidationResult} validationResult - Current validation result
   * @param {object} options - Options
   * @returns {Array<string>} Generated suggestions
   */
  #generateContextualSuggestions(input, validationResult, options = {}) {
    const suggestions = [];

    // Input-based suggestions
    if (input && typeof input === 'object') {
      const components = input.components || input;
      const componentKeys = Object.keys(components).filter((key) =>
        key.includes(':')
      );

      // Missing component suggestions
      const expectedComponents = [
        'core:name',
        'core:personality',
        'core:profile',
      ];
      const missingComponents = expectedComponents.filter(
        (comp) => !componentKeys.includes(comp)
      );

      for (const missing of missingComponents) {
        const suggestion = this.#suggestionTemplates.missingComponents[missing];
        if (suggestion) {
          suggestions.push(`Missing ${missing}: ${suggestion}`);
        }
      }

      // Content depth suggestions
      const shallowComponents = componentKeys.filter((key) => {
        const component = components[key];
        const contentLength = JSON.stringify(component).length;
        return contentLength < 50;
      });

      if (shallowComponents.length > 0) {
        suggestions.push(
          `Components with minimal detail: ${shallowComponents.join(', ')}. Consider adding more specific information.`
        );
      }
    }

    // Error-based suggestions
    if (validationResult.errors.length > 0) {
      const hasJsonErrors = validationResult.errors.some(
        (err) =>
          err.toLowerCase().includes('json') ||
          err.toLowerCase().includes('syntax')
      );

      if (hasJsonErrors) {
        suggestions.push(
          'Use a JSON validator or formatter to fix syntax issues'
        );
        suggestions.push(
          'Check for missing quotes, commas, or brackets in your JSON'
        );
      }
    }

    // Quality-based suggestions
    if (
      validationResult.quality &&
      validationResult.quality.overallScore < 0.5
    ) {
      suggestions.push(
        'Consider adding more detailed descriptions to improve quality'
      );
      suggestions.push(
        'Include specific examples and context in component descriptions'
      );
    }

    // Remove duplicates
    return [...new Set(suggestions)];
  }

  // Semantic validation rule implementations

  /**
   * Validate character name consistency across components
   *
   * @param data
   * @private
   */
  #validateCharacterNameConsistency(data) {
    const result = { errors: [], warnings: [], suggestions: [] };

    const components = data.components || data;
    const nameComponent = components['core:name'];

    if (!nameComponent) {
      return result; // Handled by completeness validation
    }

    const characterName =
      this.#extractCharacterNameFromComponent(nameComponent);
    if (!characterName) {
      result.warnings.push(
        'Character name component exists but lacks a clear name value'
      );
      result.suggestions.push(
        'Ensure the name component includes a "text" or "name" field with the character\'s name'
      );
    }

    return result;
  }

  /**
   * Validate personality trait alignment
   *
   * @param data
   * @private
   */
  #validatePersonalityAlignment(data) {
    const result = { errors: [], warnings: [], suggestions: [] };

    const components = data.components || data;
    const personality = components['core:personality'];

    if (!personality) {
      return result; // Handled by completeness validation
    }

    // Check for contradictory traits
    const personalityText = JSON.stringify(personality).toLowerCase();

    const contradictions = [
      { traits: ['introverted', 'extroverted'], severity: 'warning' },
      { traits: ['optimistic', 'pessimistic'], severity: 'warning' },
      { traits: ['trusting', 'suspicious', 'paranoid'], severity: 'info' },
      { traits: ['calm', 'anxious', 'nervous'], severity: 'info' },
      { traits: ['generous', 'selfish', 'greedy'], severity: 'warning' },
    ];

    for (const contradiction of contradictions) {
      const foundTraits = contradiction.traits.filter((trait) =>
        personalityText.includes(trait)
      );

      if (foundTraits.length > 1) {
        if (contradiction.severity === 'warning') {
          result.warnings.push(
            `Potentially contradictory personality traits: ${foundTraits.join(', ')}`
          );
          result.suggestions.push(
            'Consider if these contradictory traits are intentional or if they represent character complexity'
          );
        }
      }
    }

    return result;
  }

  /**
   * Validate component completeness
   *
   * @param data
   * @private
   */
  #validateComponentCompleteness(data) {
    const result = { errors: [], warnings: [], suggestions: [] };

    const components = data.components || data;
    const componentKeys = Object.keys(components).filter((key) =>
      key.includes(':')
    );

    const coreComponents = ['core:name', 'core:personality', 'core:profile'];
    const recommendedComponents = [
      'core:likes',
      'core:dislikes',
      'core:fears',
      'core:goals',
    ];

    // Check core components
    const missingCore = coreComponents.filter(
      (comp) => !componentKeys.includes(comp)
    );
    if (missingCore.length > 0) {
      result.warnings.push(
        `Missing essential components: ${missingCore.join(', ')}`
      );
      missingCore.forEach((comp) => {
        const suggestion = this.#suggestionTemplates.missingComponents[comp];
        if (suggestion) {
          result.suggestions.push(`Add ${comp}: ${suggestion}`);
        }
      });
    }

    // Check recommended components
    const missingRecommended = recommendedComponents.filter(
      (comp) => !componentKeys.includes(comp)
    );
    if (missingRecommended.length > 0) {
      result.suggestions.push(
        `Consider adding: ${missingRecommended.join(', ')} for richer character definition`
      );
    }

    return result;
  }

  /**
   * Validate content depth
   *
   * @param data
   * @private
   */
  #validateContentDepth(data) {
    const result = { errors: [], warnings: [], suggestions: [] };

    const components = data.components || data;
    const totalContent = JSON.stringify(components);

    if (totalContent.length < 200) {
      result.warnings.push(
        'Character definition appears brief - more detail will improve results'
      );
      result.suggestions.push(
        'Add specific examples, background details, and character quirks for better results'
      );
    }

    // Check individual component depth
    const shallowComponents = Object.entries(components)
      .filter(([key, component]) => {
        if (!key.includes(':')) return false;
        const content = JSON.stringify(component);
        return content.length < 30;
      })
      .map(([key]) => key);

    if (shallowComponents.length > 0) {
      result.suggestions.push(
        `Components needing more detail: ${shallowComponents.join(', ')}`
      );
    }

    return result;
  }

  // Quality assessment implementations

  /**
   * Assess character completeness
   *
   * @param data
   * @private
   */
  #assessCharacterCompleteness(data) {
    const components = data.components || data;
    const componentKeys = Object.keys(components).filter((key) =>
      key.includes(':')
    );

    const expectedComponents = [
      'core:name',
      'core:personality',
      'core:profile',
      'core:likes',
      'core:dislikes',
      'core:fears',
      'core:goals',
      'core:strengths',
      'core:weaknesses',
    ];

    const presentComponents = expectedComponents.filter((comp) =>
      componentKeys.includes(comp)
    );
    const presenceScore = presentComponents.length / expectedComponents.length;

    // Assess content quality of present components
    let qualityScore = 0;
    let assessedComponents = 0;

    for (const comp of presentComponents) {
      if (components[comp]) {
        assessedComponents++;
        const componentContent = JSON.stringify(components[comp]);
        const wordCount = componentContent.split(/\s+/).length;

        // Score based on content richness
        if (comp === 'core:personality') {
          // Personality needs more detail
          qualityScore += Math.min(wordCount / 10, 1);
        } else if (comp === 'core:profile') {
          // Profile needs substantial background
          qualityScore += Math.min(wordCount / 12, 1);
        } else {
          // Other components need moderate detail
          qualityScore += Math.min(wordCount / 8, 1);
        }
      }
    }

    const avgQualityScore =
      assessedComponents > 0 ? qualityScore / assessedComponents : 0;

    // Combined score: 60% presence, 40% quality
    const score = presenceScore * 0.6 + avgQualityScore * 0.4;

    const suggestions = [];
    if (score < 0.7) {
      if (presenceScore < 0.8) {
        suggestions.push(
          'Add more character components for comprehensive definition'
        );
      }
      if (avgQualityScore < 0.6) {
        suggestions.push(
          'Expand existing component descriptions with more specific details'
        );
      }
    }

    return {
      score,
      details: {
        present: presentComponents.length,
        expected: expectedComponents.length,
        missing: expectedComponents.filter(
          (comp) => !componentKeys.includes(comp)
        ),
        presenceScore,
        qualityScore: avgQualityScore,
        assessedComponents,
      },
      suggestions,
    };
  }

  /**
   * Assess personality depth
   *
   * @param data
   * @private
   */
  #assessPersonalityDepth(data) {
    const components = data.components || data;
    const personality = components['core:personality'];

    if (!personality) {
      return {
        score: 0,
        details: { reason: 'No personality component found' },
        suggestions: ['Add core:personality component'],
      };
    }

    const personalityText = JSON.stringify(personality);
    const wordCount = personalityText.split(/\s+/).length;
    const score = Math.min(wordCount / 50, 1);

    const suggestions = [];
    if (score < 0.5) {
      suggestions.push(
        'Expand personality description with specific traits, quirks, and behavioral patterns'
      );
    }

    return {
      score,
      details: { wordCount, targetWords: 50 },
      suggestions,
    };
  }

  /**
   * Assess background richness
   *
   * @param data
   * @private
   */
  #assessBackgroundRichness(data) {
    const components = data.components || data;
    const profile = components['core:profile'];

    if (!profile) {
      return {
        score: 0,
        details: { reason: 'No profile component found' },
        suggestions: ['Add core:profile component with background information'],
      };
    }

    const profileText = JSON.stringify(profile);
    const hasAge =
      /\b(age|years?\s+old|born|\d{1,2}\s*years?\s*old|\d{1,2})\b/i.test(
        profileText
      );
    const hasOccupation = /\b(work|job|profession|career|occupation)\b/i.test(
      profileText
    );
    const hasLocation = /\b(live|from|hometown|city|country|location)\b/i.test(
      profileText
    );
    const hasHistory = /\b(history|past|background|grew up|childhood)\b/i.test(
      profileText
    );

    const richnessFactor =
      [hasAge, hasOccupation, hasLocation, hasHistory].filter(Boolean).length /
      4;
    const lengthFactor = Math.min(profileText.length / 200, 1);
    const score = richnessFactor * 0.6 + lengthFactor * 0.4;

    const suggestions = [];
    if (!hasAge) suggestions.push('Include character age information');
    if (!hasOccupation) suggestions.push('Add occupation or role information');
    if (!hasLocation)
      suggestions.push('Specify where the character lives or comes from');
    if (!hasHistory)
      suggestions.push('Include background history or significant past events');

    return {
      score,
      details: {
        hasAge,
        hasOccupation,
        hasLocation,
        hasHistory,
        textLength: profileText.length,
      },
      suggestions,
    };
  }

  /**
   * Assess narrative potential
   *
   * @param data
   * @private
   */
  #assessNarrativePotential(data) {
    const components = data.components || data;
    const goals = components['core:goals'];
    const fears = components['core:fears'];
    const conflicts = components['core:conflicts'];
    const secrets = components['core:secrets'];

    let score = 0;
    const details = {};
    const suggestions = [];

    if (goals) {
      score += 0.3;
      details.hasGoals = true;
    } else {
      suggestions.push('Add character goals to drive narrative direction');
      details.hasGoals = false;
    }

    if (fears) {
      score += 0.25;
      details.hasFears = true;
    } else {
      suggestions.push('Include character fears to create dramatic tension');
      details.hasFears = false;
    }

    if (conflicts) {
      score += 0.25;
      details.hasConflicts = true;
    } else {
      suggestions.push(
        'Define character conflicts for compelling story development'
      );
      details.hasConflicts = false;
    }

    if (secrets) {
      score += 0.2;
      details.hasSecrets = true;
    } else {
      suggestions.push('Add character secrets for narrative depth');
      details.hasSecrets = false;
    }

    return { score, details, suggestions };
  }

  // Utility methods

  /**
   * Get quality level from score
   *
   * @param score
   * @param thresholds
   * @private
   */
  #getQualityLevel(score, thresholds) {
    if (score >= thresholds.high) return 'high';
    if (score >= thresholds.medium) return 'medium';
    if (score >= thresholds.low) return 'low';
    return 'very-low';
  }

  /**
   * Get overall quality level
   *
   * @param score
   * @private
   */
  #getOverallQualityLevel(score) {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'fair';
    if (score >= 0.2) return 'poor';
    return 'inadequate';
  }

  /**
   * Generate cache key for validation results
   *
   * @param input
   * @param options
   * @private
   */
  #generateCacheKey(input, options) {
    const inputHash = this.#hashObject(input);
    const optionsHash = this.#hashObject(options);
    return `character_validation_${inputHash}_${optionsHash}`;
  }

  /**
   * Simple hash function for objects
   *
   * @param obj
   * @private
   */
  #hashObject(obj) {
    const str = JSON.stringify(obj) || 'null';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get cached validation result
   *
   * @param cacheKey
   * @private
   */
  #getCachedValidation(cacheKey) {
    const cached = this.#validationCache.get(cacheKey);
    if (!cached) return null;

    // Check expiration
    if (Date.now() - cached.timestamp > this.#cacheTTL) {
      this.#validationCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Set cached validation result
   *
   * @param cacheKey
   * @param result
   * @private
   */
  #setCachedValidation(cacheKey, result) {
    // Implement LRU eviction
    if (this.#validationCache.size >= this.#cacheMaxSize) {
      const firstKey = this.#validationCache.keys().next().value;
      this.#validationCache.delete(firstKey);
    }

    this.#validationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear validation cache
   *
   * @public
   */
  clearCache() {
    const size = this.#validationCache.size;
    this.#validationCache.clear();
    this.#logger.info('Validation cache cleared', { entriesRemoved: size });
  }

  /**
   * Get validation statistics
   *
   * @public
   */
  getValidationStats() {
    return {
      semanticRules: this.#semanticRules.size,
      qualityMetrics: this.#qualityMetrics.size,
      cacheSize: this.#validationCache.size,
      cacheMaxSize: this.#cacheMaxSize,
      cacheTTL: this.#cacheTTL,
    };
  }
}

export default CharacterDefinitionValidator;
