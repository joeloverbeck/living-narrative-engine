/**
 * @file Action execution validation and error formatting
 * Provides pre-flight validation for action execution
 */

/**
 * Custom error for action execution validation failures
 */
export class ActionValidationError extends Error {
  constructor(errors, context) {
    const formatted = formatActionValidationErrors(errors, context);
    super(formatted);
    this.name = 'ActionValidationError';
    this.errors = errors;
    this.context = context;
  }
}

/**
 * Validates that all prerequisites are met before executing action
 *
 * @param {object} params - Validation parameters
 * @param {string} params.actorId - The actor entity ID
 * @param {string} params.targetId - The target entity ID
 * @param {string} params.secondaryTargetId - The secondary target entity ID
 * @param {string} params.tertiaryTargetId - The tertiary target entity ID
 * @param {object} params.actionDefinition - The action definition
 * @param {object} params.entityManager - The entity manager
 * @param {string} params.actionId - The action ID
 * @returns {Array} Array of validation errors (empty if valid)
 */
export function validateActionExecution({
  actorId,
  targetId,
  secondaryTargetId,
  tertiaryTargetId,
  actionDefinition,
  entityManager,
  actionId,
}) {
  const errors = [];

  // Validate actor exists
  // Note: EntityManager uses getEntityInstance() which returns entity or undefined
  const actorEntity = entityManager.getEntityInstance(actorId);
  if (!actorEntity) {
    errors.push({
      type: 'entity_not_found',
      entityId: actorId,
      role: 'actor',
      message: `Actor entity '${actorId}' does not exist`,
      suggestion: 'Ensure entity was added to testFixture.reset([...entities])',
      severity: 'critical',
    });
    // If actor doesn't exist, skip further validation
    return errors;
  }

  // Validate targets exist (skip special values 'none' and 'self')
  const targets = [
    { id: targetId, role: 'primary target' },
    { id: secondaryTargetId, role: 'secondary target' },
    { id: tertiaryTargetId, role: 'tertiary target' },
  ];

  targets.forEach(({ id, role }) => {
    // Skip validation for special values
    if (id && id !== 'none' && id !== 'self') {
      const targetEntity = entityManager.getEntityInstance(id);
      if (!targetEntity) {
        errors.push({
          type: 'entity_not_found',
          entityId: id,
          role,
          message: `${role} entity '${id}' does not exist`,
          suggestion:
            'Ensure entity was added to testFixture.reset([...entities])',
          severity: 'critical',
        });
      }
    }
  });

  // If any entities don't exist, skip component validation
  if (errors.length > 0) {
    return errors;
  }

  // Validate required components on actor
  if (actionDefinition?.required_components?.actor) {
    const actorRequired = actionDefinition.required_components.actor;

    actorRequired.forEach((componentType) => {
      if (!entityManager.hasComponent(actorId, componentType)) {
        errors.push({
          type: 'missing_required_component',
          entityId: actorId,
          role: 'actor',
          componentType,
          message: `Actor '${actorId}' missing required component '${componentType}'`,
          suggestion: `Add component: actor.withComponent('${componentType}', {...data})`,
          reason: `Required by ${actionId} action definition`,
          severity: 'high',
        });
      }
    });
  }

  // Validate required components on primary target
  if (targetId && actionDefinition?.required_components?.primary) {
    const primaryRequired = actionDefinition.required_components.primary;

    primaryRequired.forEach((componentType) => {
      if (!entityManager.hasComponent(targetId, componentType)) {
        errors.push({
          type: 'missing_required_component',
          entityId: targetId,
          role: 'primary target',
          componentType,
          message: `Primary target '${targetId}' missing required component '${componentType}'`,
          suggestion: `Add component: target.withComponent('${componentType}', {...data})`,
          reason: `Required by ${actionId} action definition`,
          severity: 'high',
        });
      }
    });
  }

  // Validate required components on secondary target
  if (secondaryTargetId && actionDefinition?.required_components?.secondary) {
    const secondaryRequired = actionDefinition.required_components.secondary;

    secondaryRequired.forEach((componentType) => {
      if (!entityManager.hasComponent(secondaryTargetId, componentType)) {
        errors.push({
          type: 'missing_required_component',
          entityId: secondaryTargetId,
          role: 'secondary target',
          componentType,
          message: `Secondary target '${secondaryTargetId}' missing required component '${componentType}'`,
          suggestion: `Add component: secondaryTarget.withComponent('${componentType}', {...data})`,
          reason: `Required by ${actionId} action definition`,
          severity: 'high',
        });
      }
    });
  }

  // Validate required components on tertiary target
  if (tertiaryTargetId && actionDefinition?.required_components?.tertiary) {
    const tertiaryRequired = actionDefinition.required_components.tertiary;

    tertiaryRequired.forEach((componentType) => {
      if (!entityManager.hasComponent(tertiaryTargetId, componentType)) {
        errors.push({
          type: 'missing_required_component',
          entityId: tertiaryTargetId,
          role: 'tertiary target',
          componentType,
          message: `Tertiary target '${tertiaryTargetId}' missing required component '${componentType}'`,
          suggestion: `Add component: tertiaryTarget.withComponent('${componentType}', {...data})`,
          reason: `Required by ${actionId} action definition`,
          severity: 'high',
        });
      }
    });
  }

  // Validate forbidden components on actor
  if (actionDefinition?.forbidden_components?.actor) {
    const actorForbidden = actionDefinition.forbidden_components.actor;

    actorForbidden.forEach((componentType) => {
      if (entityManager.hasComponent(actorId, componentType)) {
        errors.push({
          type: 'forbidden_component_present',
          entityId: actorId,
          role: 'actor',
          componentType,
          message: `Actor '${actorId}' has forbidden component '${componentType}'`,
          suggestion: `This action cannot be performed while actor has ${componentType}`,
          reason: `Action is blocked by forbidden_components constraint in ${actionId}`,
          severity: 'medium',
        });
      }
    });
  }

  // Validate forbidden components on primary target
  if (targetId && actionDefinition?.forbidden_components?.primary) {
    const primaryForbidden = actionDefinition.forbidden_components.primary;

    primaryForbidden.forEach((componentType) => {
      if (entityManager.hasComponent(targetId, componentType)) {
        errors.push({
          type: 'forbidden_component_present',
          entityId: targetId,
          role: 'primary target',
          componentType,
          message: `Primary target '${targetId}' has forbidden component '${componentType}'`,
          suggestion: `This action cannot be performed while target has ${componentType}`,
          reason: `Action is blocked by forbidden_components constraint in ${actionId}`,
          severity: 'medium',
        });
      }
    });
  }

  // Validate forbidden components on target (legacy single-target format)
  if (targetId && actionDefinition?.forbidden_components?.target) {
    const targetForbidden = actionDefinition.forbidden_components.target;

    targetForbidden.forEach((componentType) => {
      if (entityManager.hasComponent(targetId, componentType)) {
        errors.push({
          type: 'forbidden_component_present',
          entityId: targetId,
          role: 'target',
          componentType,
          message: `Target '${targetId}' has forbidden component '${componentType}'`,
          suggestion: `This action cannot be performed while target has ${componentType}`,
          reason: `Action is blocked by forbidden_components constraint in ${actionId}`,
          severity: 'medium',
        });
      }
    });
  }

  return errors;
}

/**
 * Format validation errors into readable report
 *
 * @param {Array} errors - The validation errors
 * @param {object} context - The context information
 * @returns {string} Formatted error message
 */
function formatActionValidationErrors(errors, context) {
  let msg = `\n${'='.repeat(80)}\n`;
  msg += `❌ ACTION EXECUTION VALIDATION FAILED\n`;
  msg += `${'='.repeat(80)}\n\n`;
  msg += `Action: ${context.actionId || 'unknown'}\n`;
  msg += `Actor: ${context.actorId || 'unknown'}\n`;
  if (context.targetId) {
    msg += `Primary Target: ${context.targetId}\n`;
  }
  if (context.secondaryTargetId) {
    msg += `Secondary Target: ${context.secondaryTargetId}\n`;
  }
  if (context.tertiaryTargetId) {
    msg += `Tertiary Target: ${context.tertiaryTargetId}\n`;
  }
  msg += `\n`;

  // Group errors by severity
  const critical = errors.filter((e) => e.severity === 'critical');
  const high = errors.filter((e) => e.severity === 'high');
  const medium = errors.filter((e) => e.severity === 'medium');

  let errorNumber = 1;

  if (critical.length > 0) {
    msg += `🚨 CRITICAL ERRORS (${critical.length}):\n\n`;
    critical.forEach((error) => {
      msg += formatError(error, errorNumber++);
    });
  }

  if (high.length > 0) {
    msg += `⚠️  HIGH PRIORITY ERRORS (${high.length}):\n\n`;
    high.forEach((error) => {
      msg += formatError(error, errorNumber++);
    });
  }

  if (medium.length > 0) {
    msg += `ℹ️  MEDIUM PRIORITY ERRORS (${medium.length}):\n\n`;
    medium.forEach((error) => {
      msg += formatError(error, errorNumber++);
    });
  }

  msg += `${'='.repeat(80)}\n`;
  return msg;
}

/**
 * Format single error with details
 *
 * @param {object} error - The error object
 * @param {number} number - The error number
 * @returns {string} Formatted error message
 */
function formatError(error, number) {
  let msg = `${number}. ${error.message}\n`;
  if (error.reason) {
    msg += `   📋 Reason: ${error.reason}\n`;
  }
  if (error.suggestion) {
    msg += `   💡 Suggestion: ${error.suggestion}\n`;
  }
  msg += `\n`;
  return msg;
}
