/**
 * @file Custom Jest matchers for GOAP integration tests
 */

/**
 * Validates action hint structure
 * @param {object} actionHint - Action hint to validate
 * @returns {boolean} True if valid
 */
export function isValidActionHint(actionHint) {
  if (!actionHint) return false;

  return (
    typeof actionHint.actionId === 'string' &&
    actionHint.actionId.includes(':') && // Namespaced format
    typeof actionHint.targetBindings === 'object' &&
    typeof actionHint.stepIndex === 'number' &&
    typeof actionHint.metadata === 'object' &&
    typeof actionHint.metadata.taskId === 'string' &&
    typeof actionHint.metadata.totalSteps === 'number'
  );
}

/**
 * Validates plan structure
 * @param {object} plan - Plan to validate
 * @returns {boolean} True if valid
 */
export function isValidPlan(plan) {
  if (!plan) return false;

  return (
    typeof plan.goal === 'object' &&
    Array.isArray(plan.tasks) &&
    typeof plan.currentStep === 'number' &&
    typeof plan.actorId === 'string' &&
    typeof plan.createdAt === 'number'
  );
}

/**
 * Validates event payload
 * @param {object} event - Event to validate
 * @param {string[]} requiredFields - Required payload fields
 * @returns {boolean} True if valid
 */
export function hasRequiredEventFields(event, requiredFields) {
  if (!event || !event.payload) return false;

  return requiredFields.every((field) => field in event.payload);
}
