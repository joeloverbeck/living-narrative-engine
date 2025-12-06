/**
 * @file Test helpers for strict property access validation
 * Automatically wraps test objects in proxies during development
 */

import { createStrictProxy } from './strictObjectProxy.js';

/**
 * Wrap discovered actions in strict proxies for property access validation
 * Only enabled in test/development environments
 *
 * @param {Array<object>} actions - Discovered actions
 * @returns {Array<Proxy>} Actions wrapped in strict proxies
 */
export function wrapActionsWithStrictValidation(actions) {
  // Only enable in test environment
  if (process.env.NODE_ENV !== 'test') {
    return actions;
  }

  return actions.map((action, index) => {
    // Create strict proxy for the action
    const wrappedAction = createStrictProxy(
      action,
      `Action[${index}] (${action.id || 'unknown'})`,
      [] // No properties allowed to be undefined
    );

    // If action has targets, wrap those too
    if (action.targets && typeof action.targets === 'object') {
      // For multi-target actions (object with primary/secondary)
      if (action.targets.primary || action.targets.secondary) {
        const wrappedTargets = {};

        if (action.targets.primary) {
          wrappedTargets.primary = createStrictProxy(
            action.targets.primary,
            `Action[${index}].targets.primary`,
            ['target_id', 'target_name'] // These might be undefined if not resolved
          );
        }

        if (action.targets.secondary) {
          wrappedTargets.secondary = createStrictProxy(
            action.targets.secondary,
            `Action[${index}].targets.secondary`,
            ['target_id', 'target_name'] // These might be undefined if not resolved
          );
        }

        // Replace targets with wrapped version
        Object.defineProperty(wrappedAction, 'targets', {
          value: wrappedTargets,
          writable: false,
          enumerable: true,
          configurable: true,
        });
      }
    }

    return wrappedAction;
  });
}

/**
 * Wrap entity objects in strict proxies
 *
 * @param {object} entity - Entity to wrap
 * @returns {Proxy} Wrapped entity
 */
export function wrapEntityWithStrictValidation(entity) {
  if (process.env.NODE_ENV !== 'test' || !entity) {
    return entity;
  }

  const wrappedEntity = createStrictProxy(
    entity,
    `Entity (${entity.id || 'unknown'})`,
    []
  );

  // Wrap components object
  if (entity.components) {
    const wrappedComponents = createStrictProxy(
      entity.components,
      `Entity(${entity.id}).components`,
      [] // Component names must exist
    );

    Object.defineProperty(wrappedEntity, 'components', {
      value: wrappedComponents,
      writable: false,
      enumerable: true,
      configurable: true,
    });
  }

  return wrappedEntity;
}
