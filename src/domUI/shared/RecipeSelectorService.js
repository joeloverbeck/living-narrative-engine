/**
 * @file RecipeSelectorService.js
 * @description Service for populating select elements with entity definitions
 * that have a specific component. Reusable across visualizers.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Service for populating select elements with filtered entity definitions.
 * Provides reusable entity selector population logic for visualizers.
 */
class RecipeSelectorService {
  /** @type {import('../../interfaces/IDataRegistry.js').IDataRegistry} */
  #dataRegistry;

  /** @type {import('../../interfaces/ILogger.js').ILogger} */
  #logger;

  /**
   * Creates a new RecipeSelectorService instance.
   *
   * @param {object} dependencies - The service dependencies
   * @param {import('../../interfaces/IDataRegistry.js').IDataRegistry} dependencies.dataRegistry - Registry for entity definitions
   * @param {import('../../interfaces/ILogger.js').ILogger} dependencies.logger - Logger instance
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', console, {
      requiredMethods: ['getAllEntityDefinitions'],
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Populate a select element with entities having the specified component.
   *
   * @param {HTMLSelectElement} selectElement - The select element to populate
   * @param {string} requiredComponent - Component ID to filter by (e.g., 'anatomy:body')
   * @param {object} options - Population options
   * @param {string} options.placeholderText - Text for the default option (defaults to 'Select...')
   * @returns {Array<object>} Array of filtered entity definitions
   */
  populateWithComponent(selectElement, requiredComponent, options = {}) {
    const { placeholderText = 'Select...' } = options;

    if (!selectElement) {
      this.#logger.warn(
        'RecipeSelectorService: No select element provided, returning empty array'
      );
      return [];
    }

    // Clear existing options
    selectElement.innerHTML = '';

    // Add default placeholder option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = placeholderText;
    selectElement.appendChild(defaultOption);

    try {
      // Get all entity definitions from registry
      const definitions = this.#dataRegistry.getAllEntityDefinitions();

      if (!definitions || definitions.length === 0) {
        this.#logger.debug(
          'RecipeSelectorService: Registry returned no definitions'
        );
        return [];
      }

      // Filter entities with the required component
      const filteredEntities = [];
      for (const definition of definitions) {
        if (
          definition &&
          definition.components &&
          definition.components[requiredComponent]
        ) {
          filteredEntities.push(definition);
        }
      }

      // Sort alphabetically by name (falling back to ID)
      filteredEntities.sort((a, b) => {
        const nameA = a.components?.['core:name']?.text || a.id;
        const nameB = b.components?.['core:name']?.text || b.id;
        return nameA.localeCompare(nameB);
      });

      // Add options to select element
      for (const definition of filteredEntities) {
        const option = document.createElement('option');
        option.value = definition.id;

        // Use the entity's name if available, otherwise use ID
        const nameComponent = definition.components['core:name'];
        const displayName = nameComponent?.text || definition.id;
        option.textContent = `${displayName} (${definition.id})`;

        selectElement.appendChild(option);
      }

      this.#logger.info(
        `RecipeSelectorService: Found ${filteredEntities.length} entities with ${requiredComponent}`
      );

      return filteredEntities;
    } catch (error) {
      this.#logger.error(
        'RecipeSelectorService: Failed to populate selector:',
        error
      );
      selectElement.innerHTML = '<option value="">Error loading entities</option>';
      return [];
    }
  }
}

export default RecipeSelectorService;
