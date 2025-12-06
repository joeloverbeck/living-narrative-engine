/**
 * @file ActionCategorizationService - Shared categorization logic for actions
 * Provides namespace-based categorization for both UI rendering and LLM prompts
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { DEFAULT_CATEGORIZATION_CONFIG } from './actionCategorizationConfig.js';
import { validateCategorizationConfig } from './actionCategorizationConfigValidator.js';

/** @typedef {import('./actionCategorizationConfig.js').CategorizationConfig} CategorizationConfig */

/**
 * Shared service for action categorization logic
 * Provides consistent categorization behavior across UI and LLM components
 */
class ActionCategorizationService {
  #logger;
  #config;

  constructor({ logger, config = DEFAULT_CATEGORIZATION_CONFIG }) {
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;

    // Validate and store configuration
    this.#config = validateCategorizationConfig(config, logger);
  }

  /**
   * Get the default categorization configuration
   *
   * @returns {CategorizationConfig} Default configuration object
   */
  static getDefaultConfig() {
    return { ...DEFAULT_CATEGORIZATION_CONFIG };
  }

  /**
   * Extract namespace from actionId (e.g., "core:wait" → "core")
   *
   * @param {string} actionId - The action identifier
   * @returns {string} Extracted namespace or 'unknown'
   */
  extractNamespace(actionId) {
    // Input validation
    if (!actionId || typeof actionId !== 'string') {
      this.#logger.debug(
        'ActionCategorizationService: Invalid actionId provided',
        { actionId }
      );
      return 'unknown';
    }

    // Handle special cases (these don't have namespaces in the current implementation)
    if (actionId === 'none' || actionId === 'self') {
      return actionId;
    }

    // Extract namespace
    const colonIndex = actionId.indexOf(':');
    if (colonIndex === -1) {
      this.#logger.debug(
        'ActionCategorizationService: No namespace separator found',
        { actionId }
      );
      return 'unknown';
    }

    const namespace = actionId.substring(0, colonIndex).trim();
    return namespace || 'unknown';
  }

  /**
   * Determine if actions should be grouped based on configuration
   *
   * @param {ActionComposite[]} actions - Array of actions
   * @returns {boolean} Whether to use grouping
   */
  shouldUseGrouping(actions) {
    try {
      // Validate inputs
      if (!Array.isArray(actions)) {
        this.#logger.warn(
          'ActionCategorizationService: Invalid actions array',
          { actions }
        );
        return false;
      }

      if (!this.#config.enabled) {
        return false;
      }

      // Check action count threshold
      if (actions.length < this.#config.minActionsForGrouping) {
        return false;
      }

      // Check namespace count threshold
      const namespaces = new Set();
      for (const action of actions) {
        if (action?.actionId) {
          namespaces.add(this.extractNamespace(action.actionId));
        }
      }

      return namespaces.size >= this.#config.minNamespacesForGrouping;
    } catch (error) {
      this.#logger.error(
        'ActionCategorizationService: Error in shouldUseGrouping',
        {
          error: error.message,
          actionCount: actions?.length,
        }
      );
      return false;
    }
  }

  /**
   * Group actions by namespace with priority ordering
   *
   * @param {ActionComposite[]} actions - Array of actions
   * @returns {Map<string, ActionComposite[]>} Grouped actions by namespace
   */
  groupActionsByNamespace(actions) {
    const result = new Map();

    try {
      // Validate inputs
      if (!Array.isArray(actions)) {
        this.#logger.warn(
          'ActionCategorizationService: Invalid actions for grouping',
          { actions }
        );
        return result;
      }

      // Group by namespace
      for (const action of actions) {
        if (!action?.actionId) {
          this.#logger.debug(
            'ActionCategorizationService: Skipping action without actionId',
            { action }
          );
          continue;
        }

        const namespace = this.extractNamespace(action.actionId);

        if (!result.has(namespace)) {
          result.set(namespace, []);
        }

        result.get(namespace).push(action);
      }

      // Sort namespaces by priority
      const sortedMap = new Map();
      const sortedNamespaces = this.getSortedNamespaces([...result.keys()]);

      for (const namespace of sortedNamespaces) {
        sortedMap.set(namespace, result.get(namespace));
      }

      return sortedMap;
    } catch (error) {
      this.#logger.error(
        'ActionCategorizationService: Error grouping actions',
        {
          error: error.message,
          actionCount: actions?.length,
        }
      );
      return result;
    }
  }

  /**
   * Sort namespaces by priority configuration
   *
   * @param {string[]} namespaces - Array of namespace strings
   * @returns {string[]} Sorted namespace array
   */
  getSortedNamespaces(namespaces) {
    try {
      if (!Array.isArray(namespaces)) {
        this.#logger.warn(
          'ActionCategorizationService: Invalid namespaces for sorting',
          { namespaces }
        );
        return [];
      }

      const { namespaceOrder } = this.#config;

      return [...namespaces].sort((a, b) => {
        const indexA = namespaceOrder.indexOf(a);
        const indexB = namespaceOrder.indexOf(b);

        // Both in priority order - use priority order
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }

        // Only A in priority order - A comes first
        if (indexA !== -1) {
          return -1;
        }

        // Only B in priority order - B comes first
        if (indexB !== -1) {
          return 1;
        }

        // Neither in priority order - alphabetical
        return a.localeCompare(b);
      });
    } catch (error) {
      this.#logger.error(
        'ActionCategorizationService: Error sorting namespaces',
        {
          error: error.message,
          namespaces,
        }
      );
      return namespaces || [];
    }
  }

  /**
   * Format namespace for display (e.g., "core" → "CORE", "unknown" → "OTHER")
   *
   * @param {string} namespace - Raw namespace string
   * @returns {string} Formatted display name
   */
  formatNamespaceDisplayName(namespace) {
    if (!namespace || typeof namespace !== 'string') {
      this.#logger.debug(
        'ActionCategorizationService: Invalid namespace for formatting',
        { namespace }
      );
      return 'UNKNOWN';
    }

    // Handle special cases
    const specialCases = {
      unknown: 'OTHER',
    };

    if (specialCases[namespace]) {
      return specialCases[namespace];
    }

    return namespace.toUpperCase();
  }

  /**
   * Check if counts should be shown in section headers
   *
   * @returns {boolean} Whether to show counts in UI
   */
  shouldShowCounts() {
    return this.#config.showCounts;
  }
}

export default ActionCategorizationService;
