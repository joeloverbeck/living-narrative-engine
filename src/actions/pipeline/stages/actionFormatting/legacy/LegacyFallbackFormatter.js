/**
 * @file Legacy fallback formatter utilities
 */

/**
 * @typedef {import('../../../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */
/**
 * @typedef {import('../../../../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext
 */
/**
 * @typedef {import('../../../../../interfaces/IActionCommandFormatter.js').IActionCommandFormatter} IActionCommandFormatter
 */

/**
 * @description Coordinates legacy fallback preparation and formatting.
 */
export class LegacyFallbackFormatter {
  #commandFormatter;
  #entityManager;
  #getEntityDisplayNameFn;

  /**
   * @param {object} deps
   * @param {IActionCommandFormatter} deps.commandFormatter - Formatter for legacy commands
   * @param {import('../../../../../entities/entityManager.js').default} deps.entityManager - Entity manager used by formatter
   * @param {Function} deps.getEntityDisplayNameFn - Helper to resolve entity display names
   * @description Creates a new legacy fallback formatter helper.
   */
  constructor({ commandFormatter, entityManager, getEntityDisplayNameFn }) {
    this.#commandFormatter = commandFormatter;
    this.#entityManager = entityManager;
    this.#getEntityDisplayNameFn = getEntityDisplayNameFn;
  }

  /**
   * @param {object} params
   * @param {ActionDefinition} params.actionDefinition - Action definition to prepare
   * @param {ActionTargetContext|null} params.targetContext - Context used for fallback formatting
   * @param {object|undefined} params.targetDefinitions - Multi-target definition map
   * @param {Record<string, import('../../../../../interfaces/IActionCommandFormatter.js').ResolvedTarget[]>|undefined} params.resolvedTargets - Targets grouped by placeholder
   * @returns {{ actionDefinition: ActionDefinition, targetContext: ActionTargetContext|null }} Prepared fallback payload
   * @description Prepares action definition and context for fallback formatting.
   */
  prepareFallback({
    actionDefinition,
    targetContext,
    targetDefinitions,
    resolvedTargets,
  }) {
    return {
      actionDefinition: this.#buildFallbackAction(
        actionDefinition,
        targetDefinitions,
        resolvedTargets
      ),
      targetContext: this.#createFallbackTargetContext(targetContext),
    };
  }

  /**
   * @param {object} params
   * @param {{ actionDefinition: ActionDefinition, targetContext: ActionTargetContext|null }|undefined} [params.preparedFallback] - Precomputed fallback payload
   * @param {ActionDefinition} [params.actionDefinition] - Action definition (used when preparedFallback omitted)
   * @param {ActionTargetContext|null} [params.targetContext] - Target context (used when preparedFallback omitted)
   * @param {object|undefined} [params.targetDefinitions] - Multi-target definitions for placeholders
   * @param {Record<string, import('../../../../../interfaces/IActionCommandFormatter.js').ResolvedTarget[]>|undefined} [params.resolvedTargets] - Resolved targets for substitutions
   * @param {object|undefined} params.formatterOptions - Options forwarded to command formatter
   * @returns {import('../../../../formatters/formatActionTypedefs.js').FormatActionCommandResult} Formatter result
   * @description Executes the legacy formatter with fallback payload.
   */
  formatWithFallback({
    preparedFallback,
    actionDefinition,
    targetContext,
    targetDefinitions,
    resolvedTargets,
    formatterOptions,
  }) {
    const fallback =
      preparedFallback ||
      this.prepareFallback({
        actionDefinition,
        targetContext,
        targetDefinitions,
        resolvedTargets,
      });

    if (!fallback.targetContext) {
      return {
        ok: false,
        error: 'Legacy fallback target context not available',
      };
    }

    const sanitizedOptions = this.#sanitizeFormatterOptions(formatterOptions);

    return this.#commandFormatter.format(
      fallback.actionDefinition,
      fallback.targetContext,
      this.#entityManager,
      sanitizedOptions,
      { displayNameFn: this.#getEntityDisplayNameFn }
    );
  }

  /**
   * @param {ActionTargetContext|null} targetContext
   * @returns {ActionTargetContext|null}
   * @description Removes unsupported properties and trims values for legacy formatter consumption.
   */
  #createFallbackTargetContext(targetContext) {
    if (!targetContext) {
      return null;
    }

    const { placeholder, ...rest } = targetContext;
    const sanitizedContext = { ...rest };

    if (typeof sanitizedContext.displayName === 'string') {
      sanitizedContext.displayName = sanitizedContext.displayName.trim();
    }

    return sanitizedContext;
  }

  /**
   * @param {ActionDefinition} actionDefinition
   * @param {object|undefined} targetDefinitions
   * @param {Record<string, import('../../../../../interfaces/IActionCommandFormatter.js').ResolvedTarget[]>|undefined} resolvedTargets
   * @returns {ActionDefinition}
   * @description Creates an action definition suitable for fallback formatting.
   */
  #buildFallbackAction(actionDefinition, targetDefinitions, resolvedTargets) {
    if (!actionDefinition) {
      return actionDefinition;
    }

    const transformedTemplate = this.#transformTemplateForFallback(
      actionDefinition.template,
      targetDefinitions,
      resolvedTargets
    );

    if (transformedTemplate === actionDefinition.template) {
      return actionDefinition;
    }

    return {
      ...actionDefinition,
      template: transformedTemplate,
    };
  }

  /**
   * @param {string} template
   * @param {object|undefined} targetDefinitions
   * @param {Record<string, import('../../../../../interfaces/IActionCommandFormatter.js').ResolvedTarget[]>|undefined} resolvedTargets
   * @returns {string}
   * @description Converts multi-target placeholders into a legacy-friendly template.
   */
  #transformTemplateForFallback(template, targetDefinitions, resolvedTargets) {
    if (typeof template !== 'string' || template.length === 0) {
      return template;
    }

    const placeholderMap = new Map();

    if (targetDefinitions && typeof targetDefinitions === 'object') {
      for (const [key, definition] of Object.entries(targetDefinitions)) {
        if (definition?.placeholder) {
          placeholderMap.set(key, definition.placeholder);
        }
      }
    }

    if (placeholderMap.size === 0 && resolvedTargets) {
      for (const key of Object.keys(resolvedTargets)) {
        placeholderMap.set(key, key);
      }
    }

    if (placeholderMap.size === 0) {
      placeholderMap.set('primary', 'primary');
    }

    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const primaryPlaceholder =
      placeholderMap.get('primary') ??
      (placeholderMap.values().next().value || null);

    let transformedTemplate = template;

    if (primaryPlaceholder) {
      const primaryRegex = new RegExp(
        `\\{${escapeRegex(primaryPlaceholder)}\\}`,
        'g'
      );
      transformedTemplate = transformedTemplate.replace(
        primaryRegex,
        '{target}'
      );
    }

    const fallbackValues = new Map();
    if (resolvedTargets && typeof resolvedTargets === 'object') {
      for (const [key, targets] of Object.entries(resolvedTargets)) {
        if (!Array.isArray(targets) || targets.length === 0) {
          continue;
        }

        const target = targets[0];
        const value = target?.displayName ?? target?.name ?? target?.id ?? '';
        const placeholderName = placeholderMap.get(key) ?? key;

        if (value) {
          fallbackValues.set(placeholderName, value);
        }
      }
    }

    for (const [key, placeholder] of placeholderMap.entries()) {
      if (!placeholder || placeholder === primaryPlaceholder) {
        continue;
      }

      const placeholderRegex = new RegExp(
        `\\{${escapeRegex(placeholder)}\\}`,
        'g'
      );
      const replacement = fallbackValues.get(placeholder) ?? '';
      transformedTemplate = transformedTemplate.replace(
        placeholderRegex,
        replacement
      );
    }

    transformedTemplate = transformedTemplate.replace(
      /\{(?!target\})[^}]+\}/g,
      ''
    );

    return transformedTemplate.replace(/\s+/g, ' ').trim();
  }

  /**
   * @param {object|undefined} formatterOptions
   * @returns {object}
   * @description Normalises formatter options for legacy formatter compatibility.
   */
  #sanitizeFormatterOptions(formatterOptions) {
    if (!formatterOptions || typeof formatterOptions !== 'object') {
      return {};
    }

    const sanitized = {};

    if ('logger' in formatterOptions) {
      sanitized.logger = formatterOptions.logger;
    }

    if ('debug' in formatterOptions) {
      sanitized.debug = Boolean(formatterOptions.debug);
    }

    if ('safeEventDispatcher' in formatterOptions) {
      sanitized.safeEventDispatcher = formatterOptions.safeEventDispatcher;
    }

    return sanitized;
  }
}

export default LegacyFallbackFormatter;
