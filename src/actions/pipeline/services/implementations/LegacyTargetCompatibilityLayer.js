/**
 * @file LegacyTargetCompatibilityLayer - Service for handling legacy single-target actions
 * @see MultiTargetResolutionStage.js
 */

import { BaseService } from '../base/BaseService.js';

/**
 * @typedef {import('../../../actionTypes.js').ActionDefinition} ActionDefinition
 * @typedef {import('../../../../entities/entity.js').default} Entity
 * @typedef {import('../interfaces/ILegacyTargetCompatibilityLayer.js').LegacyCompatibilityResult} LegacyCompatibilityResult
 * @typedef {import('../interfaces/ILegacyTargetCompatibilityLayer.js').TargetDefinition} TargetDefinition
 * @typedef {import('../interfaces/ILegacyTargetCompatibilityLayer.js').ValidationResult} ValidationResult
 */

/**
 * Service for handling legacy single-target action compatibility
 *
 * This service is responsible for:
 * - Detecting legacy action formats (string targets, scope property, targetType/targetCount)
 * - Converting legacy formats to modern multi-target format
 * - Maintaining backward compatibility with existing actions
 * - Providing migration paths for legacy content
 *
 * Legacy formats supported:
 * 1. String targets: { targets: "actor.partners" }
 * 2. Scope property: { scope: "actor.items" } (without targets)
 * 3. Legacy targetType: { targetType: "partner", targetCount: 1 }
 */
export class LegacyTargetCompatibilityLayer extends BaseService {
  /**
   * Creates a new LegacyTargetCompatibilityLayer service instance
   *
   * @param {object} deps - Service dependencies
   * @param {import('../../../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance for operation logging
   */
  constructor({ logger }) {
    super({ logger });

    this.logOperation('initialized', {
      service: 'LegacyTargetCompatibilityLayer',
    });
  }

  /**
   * Check if an action uses legacy target format
   *
   * Legacy actions are identified by:
   * - Having targets as a string (not object)
   * - Having a scope property but no targets property
   * - Having targetType or targetCount properties (old format)
   *
   * @param {ActionDefinition} actionDef - Action definition to check
   * @returns {boolean} True if action uses legacy format
   */
  isLegacyAction(actionDef) {
    if (!actionDef || typeof actionDef !== 'object') {
      return false;
    }

    const hasStringTargets = typeof actionDef.targets === 'string';
    const hasScopeOnly = !!(actionDef.scope && !actionDef.targets);
    const hasLegacyFields = !!(actionDef.targetType || actionDef.targetCount);

    const isLegacy = hasStringTargets || hasScopeOnly || hasLegacyFields;

    this.logOperation(
      'isLegacyAction',
      {
        actionId: actionDef.id,
        hasStringTargets,
        hasScopeOnly,
        hasLegacyFields,
        isLegacy,
      },
      'debug'
    );

    return isLegacy;
  }

  /**
   * Convert legacy action format to modern multi-target format
   *
   * @param {ActionDefinition} actionDef - Legacy action definition
   * @param {Entity} actor - Acting entity for context
   * @returns {LegacyCompatibilityResult} Conversion result with target definitions
   */
  convertLegacyFormat(actionDef, actor) {
    this.validateParams({ actionDef, actor }, ['actionDef', 'actor']);

    if (!this.isLegacyAction(actionDef)) {
      return {
        isLegacy: false,
        error: 'Action is not in legacy format',
      };
    }

    try {
      const scope = this.#extractLegacyScope(actionDef);
      const placeholder = this.#extractPlaceholder(actionDef);

      // Create modern target definition
      const targetDefinitions = {
        primary: {
          scope,
          placeholder,
          description: this.#generateDescription(actionDef, scope),
          // 'none' targets are always optional (no target required)
          ...(scope === 'none' && { optional: true }),
        },
      };

      this.logOperation('convertLegacyFormat', {
        actionId: actionDef.id,
        scope,
        placeholder,
        converted: true,
      });

      return {
        isLegacy: true,
        targetDefinitions,
      };
    } catch (error) {
      this.logOperation(
        'convertLegacyFormat',
        {
          actionId: actionDef.id,
          error: error.message,
        },
        'error'
      );

      return {
        isLegacy: true,
        error: `Failed to convert legacy format: ${error.message}`,
      };
    }
  }

  /**
   * Get suggested migration for a legacy action
   *
   * @param {ActionDefinition} actionDef - Legacy action definition
   * @returns {string} Suggested modern format as a string
   */
  getMigrationSuggestion(actionDef) {
    this.validateParams({ actionDef }, ['actionDef']);

    if (!this.isLegacyAction(actionDef)) {
      return 'Action is already in modern format';
    }

    const scope = this.#extractLegacyScope(actionDef);
    const placeholder = this.#extractPlaceholder(actionDef);

    // Build suggested format
    const suggestion = {
      id: actionDef.id,
      targets: {
        primary: {
          scope,
          placeholder,
        },
      },
    };

    // Copy over other properties (excluding legacy ones)
    const legacyKeys = ['targets', 'scope', 'targetType', 'targetCount'];
    Object.keys(actionDef).forEach((key) => {
      if (!legacyKeys.includes(key)) {
        suggestion[key] = actionDef[key];
      }
    });

    return JSON.stringify(suggestion, null, 2);
  }

  /**
   * Validate that a converted action maintains semantic equivalence
   *
   * @param {ActionDefinition} legacyAction - Original legacy action
   * @param {Record<string, TargetDefinition>} modernTargets - Converted targets
   * @returns {ValidationResult} Validation results
   */
  validateConversion(legacyAction, modernTargets) {
    this.validateParams({ legacyAction, modernTargets }, [
      'legacyAction',
      'modernTargets',
    ]);

    const errors = [];

    // Check that we have a primary target
    if (!modernTargets.primary) {
      errors.push('Modern format must include a primary target');
    }

    // Validate scope preservation
    const legacyScope = this.#extractLegacyScope(legacyAction);
    if (modernTargets.primary && modernTargets.primary.scope !== legacyScope) {
      errors.push(
        `Scope mismatch: legacy='${legacyScope}', modern='${modernTargets.primary.scope}'`
      );
    }

    // Validate placeholder
    const expectedPlaceholder = this.#extractPlaceholder(legacyAction);
    if (
      modernTargets.primary &&
      modernTargets.primary.placeholder !== expectedPlaceholder
    ) {
      errors.push(
        `Placeholder mismatch: expected='${expectedPlaceholder}', actual='${modernTargets.primary.placeholder}'`
      );
    }

    // Check for unexpected additional targets
    const targetKeys = Object.keys(modernTargets);
    if (targetKeys.length > 1) {
      errors.push(
        `Legacy actions should only have primary target, found: ${targetKeys.join(
          ', '
        )}`
      );
    }

    this.logOperation('validateConversion', {
      actionId: legacyAction.id,
      valid: errors.length === 0,
      errorCount: errors.length,
    });

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Extract scope from legacy action
   *
   * @private
   * @param {ActionDefinition} actionDef - Legacy action definition to extract scope from
   * @returns {string} Extracted scope string
   */
  #extractLegacyScope(actionDef) {
    // Priority: targets (string) > scope > targetType
    if (typeof actionDef.targets === 'string') {
      return actionDef.targets;
    }

    if (actionDef.scope) {
      return actionDef.scope;
    }

    // Handle old targetType format
    if (actionDef.targetType) {
      // Map old targetType to scope expressions
      const targetTypeMap = {
        actor: 'actor',
        self: 'self',
        partner: 'actor.partners',
        item: 'actor.items',
        location: 'actor.location',
      };

      return targetTypeMap[actionDef.targetType] || 'none';
    }

    return 'none';
  }

  /**
   * Extract or generate placeholder name
   *
   * @private
   * @param {ActionDefinition} actionDef - Action definition to extract/generate placeholder for
   * @returns {string} Generated placeholder name
   */
  #extractPlaceholder(actionDef) {
    // Check if action has explicit placeholder
    if (actionDef.placeholder) {
      return actionDef.placeholder;
    }

    // Check if the template has a placeholder we can use
    if (actionDef.template) {
      const placeholderMatch = actionDef.template.match(/\{(\w+)\}/);
      if (placeholderMatch && placeholderMatch[1]) {
        return placeholderMatch[1];
      }
    }

    // Generate based on target type
    const scope = this.#extractLegacyScope(actionDef);

    // Common scope to placeholder mappings
    if (scope.includes('partner')) return 'partner';
    if (scope.includes('item')) return 'item';
    if (scope.includes('location')) return 'location';
    if (scope === 'self') return 'self';
    if (scope === 'actor') return 'actor';

    // Default
    return 'target';
  }

  /**
   * Generate description for converted target
   *
   * @private
   * @param {ActionDefinition} actionDef - Action definition containing target description
   * @param {string} scope - Scope string to generate description for
   * @returns {string} Generated description text
   */
  #generateDescription(actionDef, scope) {
    // Use action description if available
    if (actionDef.targetDescription) {
      return actionDef.targetDescription;
    }

    // Generate based on scope
    const descriptions = {
      'actor.partners': 'Partner entities',
      'actor.items': 'Items held by the actor',
      'actor.location': 'Current location',
      self: 'The actor themselves',
      actor: 'The acting entity',
      none: 'No target required',
    };

    return descriptions[scope] || `Target from scope: ${scope}`;
  }
}
