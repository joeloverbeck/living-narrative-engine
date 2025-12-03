/**
 * @file Action definition validation proxy
 * Validates action definitions against schema and common patterns
 * Provides clear, actionable error messages for typos and mistakes
 */

import { findSimilarProperty } from '../strictObjectProxy.js';

/**
 * Helper function adapter for action validation context
 *
 * @param {string} target - Property name to find similar matches for
 * @param {string[]} availableProps - Array of available property names
 * @returns {string|null} Most similar property name or null
 */
function findSimilarString(target, availableProps) {
  return findSimilarProperty(target, availableProps);
}

/**
 * Validates action definition and provides detailed error messages
 *
 * @param {object} actionDef - Action definition to validate
 * @param {string} context - Context description for error messages
 * @returns {object} Validated action definition
 * @throws {Error} If validation fails with formatted error report
 */
export function createActionValidationProxy(actionDef, context = 'Action') {
  const validator = {
    // Known correct property names from action schema
    validProperties: [
      '$schema', // JSON Schema reference
      'id',
      'name',
      'description',
      'chanceBased',
      'targets',
      'scope',
      'required_components',
      'forbidden_components',
      'template',
      'prerequisites',
      'visual',
      'metadata', // Action metadata (category, tags, etc.)
      'generateCombinations', // For multi-target actions
    ],

    // Common typos mapped to correct properties
    commonTypos: {
      action_id: 'id',
      actionId: 'id',
      actionName: 'name',
      action_name: 'name',
      requiredComponents: 'required_components',
      forbiddenComponents: 'forbidden_components',
      templateText: 'template',
    },

    validate(obj) {
      const errors = [];

      // Check for typos in root properties
      Object.keys(obj).forEach((key) => {
        if (!this.validProperties.includes(key)) {
          const suggestion =
            this.commonTypos[key] ||
            findSimilarString(key, this.validProperties);
          errors.push({
            type: 'invalid_property',
            property: key,
            suggestion,
            message: `Invalid property '${key}' in ${context}. Did you mean '${suggestion}'?`,
          });
        }
      });

      // Validate required properties exist
      if (!obj.id) {
        errors.push({
          type: 'missing_required',
          property: 'id',
          message: `${context} missing required property 'id'`,
          suggestion: 'Add: "id": "modId:actionId"',
        });
      }

      // Validate ID format (should be modId:actionId)
      if (obj.id && !obj.id.includes(':')) {
        errors.push({
          type: 'invalid_format',
          property: 'id',
          value: obj.id,
          message: `Action ID '${obj.id}' missing namespace separator ':'`,
          suggestion:
            'Use format: "modId:actionId" (e.g., "personal-space:scoot_closer" or "personal-space:scoot_closer_right")',
        });
      }

      // Validate targets structure if present
      if (obj.targets) {
        errors.push(...this.validateTargets(obj.targets));
      }

      // Validate required_components structure
      if (obj.required_components) {
        errors.push(
          ...this.validateComponentConstraints(obj.required_components, 'required')
        );
      }

      // Validate forbidden_components structure
      if (obj.forbidden_components) {
        errors.push(
          ...this.validateComponentConstraints(
            obj.forbidden_components,
            'forbidden'
          )
        );
      }

      return errors;
    },

    validateTargets(targets) {
      const errors = [];

      // Handle legacy string format (old single-target format)
      if (typeof targets === 'string') {
        // Legacy format is valid - it's a scope string
        return errors;
      }

      const validTargetTypes = ['primary', 'secondary', 'tertiary'];

      if (typeof targets === 'string') {
        // Single scope string form – nothing further to validate
        return errors;
      }

      if (!targets || typeof targets !== 'object') {
        errors.push({
          type: 'invalid_structure',
          property: 'targets',
          value: targets,
          message: 'Targets must be either a scope string or an object keyed by target role.',
          suggestion: 'Use a string for single-target actions or { "primary": { "scope": "mod:scope" } } for multi-target actions.',
        });
        return errors;
      }

      Object.keys(targets).forEach((targetType) => {
        if (!validTargetTypes.includes(targetType)) {
          errors.push({
            type: 'invalid_property',
            property: `targets.${targetType}`,
            message: `Invalid target type '${targetType}'. Must be one of: ${validTargetTypes.join(', ')}`,
          });
          return;
        }

        const target = targets[targetType];

        // Check for runtime-only properties that shouldn't be in action files
        if (target.target_id !== undefined) {
          errors.push({
            type: 'invalid_property',
            property: `targets.${targetType}.target_id`,
            message: `targets.${targetType}.target_id should not be defined in action file`,
            suggestion: 'Remove this property - target_id is resolved at runtime',
          });
        }

        // Validate required target properties
        if (!target.scope) {
          errors.push({
            type: 'missing_required',
            property: `targets.${targetType}.scope`,
            message: `Target ${targetType} missing required 'scope' property`,
            suggestion: 'Add: "scope": "modId:scopeName"',
          });
        }

        if (!target.placeholder) {
          errors.push({
            type: 'missing_required',
            property: `targets.${targetType}.placeholder`,
            message: `Target ${targetType} missing required 'placeholder' property`,
            suggestion: 'Add: "placeholder": "descriptive text for UI"',
          });
        }

        // Validate contextFrom references
        if (target.contextFrom) {
          const validSources = ['primary', 'secondary'];
          if (!validSources.includes(target.contextFrom)) {
            errors.push({
              type: 'invalid_value',
              property: `targets.${targetType}.contextFrom`,
              value: target.contextFrom,
              expected: validSources,
              message: `Invalid contextFrom '${target.contextFrom}'. Must be one of: ${validSources.join(', ')}`,
            });
          }

          // Ensure contextFrom doesn't create circular reference
          if (target.contextFrom === targetType) {
            errors.push({
              type: 'circular_reference',
              property: `targets.${targetType}.contextFrom`,
              message: `Target ${targetType} cannot reference itself in contextFrom`,
            });
          }
        }
      });

      return errors;
    },

    validateComponentConstraints(constraints, type) {
      const errors = [];
      const validRoles = ['actor', 'primary', 'secondary', 'tertiary'];

      if (typeof constraints !== 'object' || Array.isArray(constraints)) {
        errors.push({
          type: 'invalid_structure',
          property: `${type}_components`,
          message: `${type}_components must be an object with role keys (actor, primary, etc.)`,
          suggestion: `Use: { "actor": ["component1", "component2"] }`,
        });
        return errors;
      }

      Object.keys(constraints).forEach((role) => {
        if (!validRoles.includes(role)) {
          errors.push({
            type: 'invalid_property',
            property: `${type}_components.${role}`,
            message: `Invalid role '${role}'. Must be one of: ${validRoles.join(', ')}`,
          });
        }

        if (!Array.isArray(constraints[role])) {
          errors.push({
            type: 'invalid_structure',
            property: `${type}_components.${role}`,
            message: `${type}_components.${role} must be an array of component IDs`,
            suggestion: `Use: ["modId:componentId"]`,
          });
        }
      });

      return errors;
    },
  };

  const errors = validator.validate(actionDef);

  if (errors.length > 0) {
    const errorReport = formatValidationErrors(errors, context);
    throw new Error(errorReport);
  }

  return actionDef; // Valid - return as-is
}

/**
 * Formats validation errors into a readable report
 *
 * @param {Array} errors - Array of validation error objects
 * @param {string} context - Context description for error messages
 * @returns {string} Formatted error report
 */
function formatValidationErrors(errors, context) {
  let report = `\n${'='.repeat(80)}\n`;
  report += `❌ VALIDATION ERRORS IN ${context}\n`;
  report += `${'='.repeat(80)}\n\n`;

  errors.forEach((error, index) => {
    report += `${index + 1}. ${error.message}\n`;
    if (error.suggestion) {
      report += `   💡 Suggestion: ${error.suggestion}\n`;
    }
    if (error.expected) {
      report += `   📋 Expected: ${Array.isArray(error.expected) ? error.expected.join(', ') : error.expected}\n`;
    }
    report += `\n`;
  });

  report += `${'='.repeat(80)}\n`;
  return report;
}

/**
 * Creates a validation proxy for rule definitions
 *
 * @param {object} ruleDef - Rule definition to validate
 * @param {string} context - Context description for error messages
 * @returns {object} Validated rule definition
 * @throws {Error} If validation fails with formatted error report
 */
export function createRuleValidationProxy(ruleDef, context = 'Rule') {
  const validator = {
    validProperties: [
      'id',
      'rule_id',
      'description',
      'event_type',
      'condition',
      'actions',
      'operations',
      'priority',
    ],

    validate(obj) {
      const errors = [];

      // Check for typos
      Object.keys(obj).forEach((key) => {
        if (!this.validProperties.includes(key)) {
          errors.push({
            type: 'invalid_property',
            property: key,
            message: `Invalid property '${key}' in ${context}`,
            suggestion: findSimilarString(key, this.validProperties),
          });
        }
      });

      // Validate required properties
      if (!obj.id && !obj.rule_id) {
        errors.push({
          type: 'missing_required',
          property: 'id',
          message: `${context} missing required property 'id'`,
        });
      }

      const hasOperations = Array.isArray(obj.operations);
      const hasActions = Array.isArray(obj.actions);
      if (!hasOperations && !hasActions) {
        errors.push({
          type: 'missing_required',
          property: 'operations',
          message: `${context} missing required 'operations' or 'actions' array`,
        });
      }

      return errors;
    },
  };

  const errors = validator.validate(ruleDef);

  if (errors.length > 0) {
    const errorReport = formatValidationErrors(errors, context);
    throw new Error(errorReport);
  }

  return ruleDef;
}
