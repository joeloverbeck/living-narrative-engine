/**
 * @file Action Definition Builder - Fluent API for creating action definitions
 * @description Provides a fluent API for creating valid action definitions, reducing
 * test complexity and preventing common errors while maintaining backward compatibility
 */

import { ActionDefinitionValidator } from './actionDefinitionValidator.js';
import { InvalidActionDefinitionError } from '../../errors/invalidActionDefinitionError.js';

/**
 * Action Definition Builder - Fluent API for creating action definitions
 *
 * Provides a fluent interface for constructing valid action definitions with built-in
 * validation and convenience methods for common patterns.
 *
 * @example
 * // Basic action
 * const waitAction = new ActionDefinitionBuilder('core:wait')
 *   .withName('Wait')
 *   .withDescription('Wait for a moment')
 *   .asBasicAction()
 *   .build();
 * @example
 * // Complex targeted action
 * const attackAction = new ActionDefinitionBuilder('core:attack')
 *   .withName('Attack')
 *   .withDescription('Attack a target')
 *   .asTargetedAction('core:nearby_actors')
 *   .asCombatAction()
 *   .build();
 * @example
 * // Custom configuration
 * const customAction = new ActionDefinitionBuilder('mod:custom')
 *   .withName('Custom Action')
 *   .withDescription('A custom action')
 *   .withScope('mod:targets')
 *   .withTemplate('perform {target}')
 *   .requiresComponents(['mod:component1', 'mod:component2'])
 *   .withPrerequisite('mod:condition', 'Cannot perform action')
 *   .build();
 */
export class ActionDefinitionBuilder {
  #definition;
  #validator;

  /**
   * Creates a new ActionDefinitionBuilder instance
   *
   * @param {string} id - The action ID in namespace:identifier format
   * @throws {InvalidActionDefinitionError} If ID is missing or invalid type
   * @example
   * const builder = new ActionDefinitionBuilder('core:attack');
   */
  constructor(id) {
    if (!id || typeof id !== 'string') {
      throw new InvalidActionDefinitionError(
        'Action ID is required and must be a string'
      );
    }

    this.#definition = {
      id,
      prerequisites: [],
      required_components: {
        actor: [],
      },
    };

    this.#validator = new ActionDefinitionValidator();
  }

  /**
   * Sets the action name
   *
   * @param {string} name - The human-readable action name
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @throws {InvalidActionDefinitionError} If name is not a non-empty string
   * @example
   * builder.withName('Attack');
   */
  withName(name) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new InvalidActionDefinitionError('Name must be a non-empty string');
    }
    this.#definition.name = name.trim();
    return this;
  }

  /**
   * Sets the action description
   *
   * @param {string} description - The action description
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @throws {InvalidActionDefinitionError} If description is not a non-empty string
   * @example
   * builder.withDescription('Attack a target');
   */
  withDescription(description) {
    if (
      !description ||
      typeof description !== 'string' ||
      description.trim().length === 0
    ) {
      throw new InvalidActionDefinitionError(
        'Description must be a non-empty string'
      );
    }
    this.#definition.description = description.trim();
    return this;
  }

  /**
   * Sets the action scope
   *
   * @param {string} scope - The scope ID ('none' or namespace:identifier format)
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @throws {InvalidActionDefinitionError} If scope is not a non-empty string
   * @example
   * builder.withScope('core:nearby_actors');
   * builder.withScope('none');
   */
  withScope(scope) {
    if (!scope || typeof scope !== 'string' || scope.trim().length === 0) {
      throw new InvalidActionDefinitionError(
        'Scope must be a non-empty string'
      );
    }
    this.#definition.scope = scope.trim();
    return this;
  }

  /**
   * Sets the action template
   *
   * @param {string} template - The action template string
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @throws {InvalidActionDefinitionError} If template is not a non-empty string
   * @example
   * builder.withTemplate('attack {target}');
   */
  withTemplate(template) {
    if (
      !template ||
      typeof template !== 'string' ||
      template.trim().length === 0
    ) {
      throw new InvalidActionDefinitionError(
        'Template must be a non-empty string'
      );
    }
    this.#definition.template = template.trim();
    return this;
  }

  /**
   * Adds a single required component
   *
   * @param {string} componentId - The component ID in namespace:identifier format
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @throws {InvalidActionDefinitionError} If componentId is not a non-empty string
   * @example
   * builder.requiresComponent('core:position');
   */
  requiresComponent(componentId) {
    if (
      !componentId ||
      typeof componentId !== 'string' ||
      componentId.trim().length === 0
    ) {
      throw new InvalidActionDefinitionError(
        'Component ID must be a non-empty string'
      );
    }

    const trimmedId = componentId.trim();
    if (!this.#definition.required_components.actor.includes(trimmedId)) {
      this.#definition.required_components.actor.push(trimmedId);
    }
    return this;
  }

  /**
   * Adds multiple required components
   *
   * @param {string[]} componentIds - Array of component IDs
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @throws {InvalidActionDefinitionError} If componentIds is not an array
   * @example
   * builder.requiresComponents(['core:position', 'core:health']);
   */
  requiresComponents(componentIds) {
    if (!Array.isArray(componentIds)) {
      throw new InvalidActionDefinitionError('Component IDs must be an array');
    }

    componentIds.forEach((id) => this.requiresComponent(id));
    return this;
  }

  /**
   * Adds a single prerequisite condition
   *
   * @param {string} conditionId - The condition ID in namespace:identifier format
   * @param {string|null} [failureMessage] - Optional failure message
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @throws {InvalidActionDefinitionError} If conditionId is not a non-empty string
   * @example
   * builder.withPrerequisite('core:actor-can-move');
   * builder.withPrerequisite('core:has-health', 'You need health to attack');
   */
  withPrerequisite(conditionId, failureMessage = null) {
    if (
      !conditionId ||
      typeof conditionId !== 'string' ||
      conditionId.trim().length === 0
    ) {
      throw new InvalidActionDefinitionError(
        'Condition ID must be a non-empty string'
      );
    }

    const trimmedId = conditionId.trim();
    const prerequisite = failureMessage
      ? { logic: { condition_ref: trimmedId }, failure_message: failureMessage }
      : trimmedId;

    this.#definition.prerequisites.push(prerequisite);
    return this;
  }

  /**
   * Adds multiple prerequisite conditions
   *
   * @param {(string|{condition: string, message: string})[]} prerequisites - Array of prerequisites
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @throws {InvalidActionDefinitionError} If prerequisites is not an array or contains invalid items
   * @example
   * builder.withPrerequisites(['core:actor-can-move', 'core:has-health']);
   * builder.withPrerequisites([
   *   { condition: 'core:actor-can-move', message: 'Cannot move' },
   *   { condition: 'core:has-health', message: 'No health' }
   * ]);
   */
  withPrerequisites(prerequisites) {
    if (!Array.isArray(prerequisites)) {
      throw new InvalidActionDefinitionError('Prerequisites must be an array');
    }

    prerequisites.forEach((prereq) => {
      if (typeof prereq === 'string') {
        this.withPrerequisite(prereq);
      } else if (
        prereq &&
        typeof prereq === 'object' &&
        prereq.condition &&
        prereq.message
      ) {
        this.withPrerequisite(prereq.condition, prereq.message);
      } else {
        throw new InvalidActionDefinitionError(
          'Invalid prerequisite format. Expected string or {condition, message} object'
        );
      }
    });
    return this;
  }

  /**
   * Configures action as a basic action (scope: 'none', simple template)
   *
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @example
   * builder.asBasicAction(); // Sets scope to 'none' and template to action name
   */
  asBasicAction() {
    const template = this.#definition.name
      ? this.#definition.name.toLowerCase()
      : 'action';
    return this.withScope('none').withTemplate(template);
  }

  /**
   * Configures action as a targeted action
   *
   * @param {string} scopeId - The scope ID for target resolution
   * @param {string} [templateSuffix] - Template suffix (default: '{target}')
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @throws {InvalidActionDefinitionError} If scopeId is not provided
   * @example
   * builder.asTargetedAction('core:nearby_actors');
   * builder.asTargetedAction('core:items', 'from {target}');
   */
  asTargetedAction(scopeId, templateSuffix = '{target}') {
    if (
      !scopeId ||
      typeof scopeId !== 'string' ||
      scopeId.trim().length === 0
    ) {
      throw new InvalidActionDefinitionError(
        'Scope ID is required for targeted actions'
      );
    }

    const actionName = this.#definition.name
      ? this.#definition.name.toLowerCase()
      : 'action';
    const template = `${actionName} ${templateSuffix}`;
    return this.withScope(scopeId.trim()).withTemplate(template);
  }

  /**
   * Adds common movement requirements (position component + movement prerequisite)
   *
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @example
   * builder.asMovementAction(); // Adds core:position and anatomy:actor-can-move
   */
  asMovementAction() {
    return this.requiresComponent('core:position').withPrerequisite(
      'anatomy:actor-can-move',
      'You cannot move right now'
    );
  }

  /**
   * Adds common combat requirements (position + health components, movement + health prerequisites)
   *
   * @returns {ActionDefinitionBuilder} This builder for chaining
   * @example
   * builder.asCombatAction(); // Adds position/health components and prerequisites
   */
  asCombatAction() {
    return this.requiresComponent('core:position')
      .requiresComponent('core:health')
      .withPrerequisite('anatomy:actor-can-move', 'You cannot move right now')
      .withPrerequisite(
        'core:has-health',
        'You need health to perform this action'
      );
  }

  /**
   * Validates the current definition without building
   *
   * @returns {{isValid: boolean, errors: string[]}} Validation result
   * @example
   * const result = builder.validate();
   * if (!result.isValid) {
   *   console.error('Validation errors:', result.errors);
   * }
   */
  validate() {
    return this.#validator.validate(this.#definition);
  }

  /**
   * Builds and returns the final action definition
   *
   * @returns {object} The complete action definition
   * @throws {InvalidActionDefinitionError} If validation fails
   * @example
   * const actionDef = builder.build();
   */
  build() {
    const validation = this.validate();
    if (!validation.isValid) {
      throw new InvalidActionDefinitionError(
        `Invalid action definition: ${validation.errors.join(', ')}`
      );
    }

    // Return deep clone to prevent mutation
    return JSON.parse(JSON.stringify(this.#definition));
  }

  /**
   * Returns the current definition state without validation (for debugging)
   *
   * @returns {object} Current definition state (deep copy)
   * @example
   * const partial = builder.toPartial();
   * console.log('Current state:', partial);
   */
  toPartial() {
    return JSON.parse(JSON.stringify(this.#definition));
  }

  /**
   * Creates a builder from an existing action definition
   *
   * @param {object} definition - Existing action definition
   * @returns {ActionDefinitionBuilder} New builder instance
   * @throws {InvalidActionDefinitionError} If definition is invalid or missing ID
   * @example
   * const existingDef = { id: 'core:attack', name: 'Attack', ... };
   * const builder = ActionDefinitionBuilder.fromDefinition(existingDef);
   */
  static fromDefinition(definition) {
    if (!definition || !definition.id) {
      throw new InvalidActionDefinitionError('Definition must have an ID');
    }

    const builder = new ActionDefinitionBuilder(definition.id);

    if (definition.name) builder.withName(definition.name);
    if (definition.description) builder.withDescription(definition.description);
    if (definition.scope) builder.withScope(definition.scope);
    if (definition.template) builder.withTemplate(definition.template);

    if (definition.required_components?.actor) {
      builder.requiresComponents(definition.required_components.actor);
    }

    if (definition.prerequisites) {
      definition.prerequisites.forEach((prereq) => {
        if (typeof prereq === 'string') {
          builder.withPrerequisite(prereq);
        } else if (prereq.logic?.condition_ref) {
          builder.withPrerequisite(
            prereq.logic.condition_ref,
            prereq.failure_message
          );
        }
      });
    }

    return builder;
  }
}

export default ActionDefinitionBuilder;
