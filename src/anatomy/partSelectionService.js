// src/anatomy/partSelectionService.js

/**
 * @file Service responsible for selecting anatomy parts based on requirements
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { ValidationError } from '../errors/validationError.js';

/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../utils/eventDispatchService.js').EventDispatchService} EventDispatchService */

/**
 * @typedef {object} PartRequirements
 * @property {string} [partType] - Required part type
 * @property {string[]} [components] - Required component IDs
 * @property {Object<string, object>} [properties] - Required component properties
 */

/**
 * @typedef {object} SlotDefinition
 * @property {string} partType
 * @property {string} [preferId] - Preferred entity definition ID
 * @property {string[]} [tags] - Required component tags
 * @property {string[]} [notTags] - Excluded component tags
 * @property {Object<string, object>} [properties] - Required properties
 */

/**
 * Service that handles part selection logic for anatomy generation
 */
export class PartSelectionService {
  /** @type {IDataRegistry} */
  #dataRegistry;
  /** @type {ILogger} */
  #logger;
  /** @type {EventDispatchService} */
  #eventDispatchService;

  /**
   * @param {object} deps
   * @param {IDataRegistry} deps.dataRegistry
   * @param {ILogger} deps.logger
   * @param {EventDispatchService} deps.eventDispatchService
   */
  constructor({ dataRegistry, logger, eventDispatchService }) {
    if (!dataRegistry) {
      throw new InvalidArgumentError('dataRegistry is required');
    }
    if (!logger) {
      throw new InvalidArgumentError('logger is required');
    }
    if (!eventDispatchService) {
      throw new InvalidArgumentError('eventDispatchService is required');
    }

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#eventDispatchService = eventDispatchService;
  }

  /**
   * Selects a part definition based on requirements and constraints
   *
   * @param {PartRequirements} requirements - Base requirements for the part
   * @param {string[]} allowedTypes - Allowed part types from socket
   * @param {SlotDefinition} [recipeSlot] - Recipe slot with overrides
   * @param {Function} rng - Random number generator function
   * @returns {Promise<string|null>} Selected entity definition ID or null
   */
  async selectPart(requirements, allowedTypes, recipeSlot, rng) {
    // Check for preferred ID first
    if (recipeSlot?.preferId) {
      const preferredDef = this.#dataRegistry.get(
        'entityDefinitions',
        recipeSlot.preferId
      );

      if (preferredDef && this.#meetsAllRequirements(
        preferredDef,
        requirements,
        allowedTypes,
        recipeSlot
      )) {
        this.#logger.debug(
          `PartSelectionService: Using preferred part '${recipeSlot.preferId}'`
        );
        return recipeSlot.preferId;
      }
    }

    // Find all candidates
    const candidates = await this.#findCandidates(
      requirements,
      allowedTypes,
      recipeSlot
    );

    if (candidates.length === 0) {
      return null;
    }

    // Random selection from candidates
    const index = Math.floor(rng() * candidates.length);
    const selected = candidates[index];

    this.#logger.debug(
      `PartSelectionService: Selected '${selected}' from ${candidates.length} candidates`
    );

    return selected;
  }

  /**
   * Finds all entity definitions that match the given requirements
   *
   * @param {PartRequirements} requirements - Base requirements
   * @param {string[]} allowedTypes - Allowed part types
   * @param {SlotDefinition} [recipeSlot] - Recipe slot overrides
   * @returns {Promise<string[]>} Array of matching entity definition IDs
   */
  async #findCandidates(requirements, allowedTypes, recipeSlot) {
    const candidates = [];
    const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');

    for (const entityDef of allEntityDefs) {
      if (this.#meetsAllRequirements(
        entityDef,
        requirements,
        allowedTypes,
        recipeSlot
      )) {
        candidates.push(entityDef.id);
      }
    }

    if (candidates.length === 0) {
      const errorContext = this.#buildErrorContext(
        requirements,
        allowedTypes,
        recipeSlot,
        allEntityDefs.length
      );

      await this.#eventDispatchService.safeDispatchEvent(
        'system:error_occurred',
        {
          error: errorContext.message,
          context: 'PartSelectionService.findCandidates',
          details: errorContext,
        }
      );

      throw new ValidationError(errorContext.message);
    }

    return candidates;
  }

  /**
   * Checks if an entity definition meets all requirements
   *
   * @param {object} entityDef - Entity definition to check
   * @param {PartRequirements} requirements - Base requirements
   * @param {string[]} allowedTypes - Allowed part types
   * @param {SlotDefinition} [recipeSlot] - Recipe slot overrides
   * @returns {boolean} True if all requirements are met
   */
  #meetsAllRequirements(entityDef, requirements, allowedTypes, recipeSlot) {
    // Must be an anatomy part
    const anatomyPart = entityDef.components?.['anatomy:part'];
    if (!anatomyPart) return false;

    // Check allowed types (handle wildcard)
    if (!allowedTypes.includes('*') && !allowedTypes.includes(anatomyPart.subType)) {
      return false;
    }

    // Check part type requirement
    if (requirements.partType && anatomyPart.subType !== requirements.partType) {
      return false;
    }

    // Check required components
    if (requirements.components && requirements.components.length > 0) {
      const hasAllComponents = requirements.components.every(
        (comp) => entityDef.components[comp] !== undefined
      );
      if (!hasAllComponents) return false;
    }

    // Check recipe slot requirements
    if (recipeSlot) {
      // Check required tags
      if (recipeSlot.tags && recipeSlot.tags.length > 0) {
        const hasAllTags = recipeSlot.tags.every(
          (tag) => entityDef.components[tag] !== undefined
        );
        if (!hasAllTags) return false;
      }

      // Check excluded tags
      if (recipeSlot.notTags && recipeSlot.notTags.length > 0) {
        const hasExcludedTag = recipeSlot.notTags.some(
          (tag) => entityDef.components[tag] !== undefined
        );
        if (hasExcludedTag) return false;
      }

      // Check property requirements
      if (recipeSlot.properties && !this.#matchesProperties(entityDef, recipeSlot.properties)) {
        return false;
      }
    }

    // Check base property requirements
    if (requirements.properties && !this.#matchesProperties(entityDef, requirements.properties)) {
      return false;
    }

    return true;
  }

  /**
   * Checks if entity definition matches property requirements
   *
   * @param {object} entityDef - Entity definition
   * @param {Object<string, object>} propertyRequirements - Required properties
   * @returns {boolean} True if properties match
   */
  #matchesProperties(entityDef, propertyRequirements) {
    for (const [componentId, requiredProps] of Object.entries(propertyRequirements)) {
      const component = entityDef.components[componentId];
      if (!component) return false;

      for (const [propKey, propValue] of Object.entries(requiredProps)) {
        if (component[propKey] !== propValue) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Builds error context for missing part candidates
   *
   * @param {PartRequirements} requirements - Requirements that failed
   * @param {string[]} allowedTypes - Allowed types from socket
   * @param {SlotDefinition} [recipeSlot] - Recipe slot requirements
   * @param {number} totalDefinitions - Total definitions checked
   * @returns {object} Error context object
   */
  #buildErrorContext(requirements, allowedTypes, recipeSlot, totalDefinitions) {
    const context = {
      partType: requirements.partType,
      allowedTypes: allowedTypes,
      requirements: {
        components: requirements.components || [],
        properties: requirements.properties || {},
      },
      checkedDefinitions: totalDefinitions,
    };

    if (recipeSlot) {
      context.recipeRequirements = {
        tags: recipeSlot.tags || [],
        notTags: recipeSlot.notTags || [],
        properties: recipeSlot.properties || {},
        preferId: recipeSlot.preferId || null,
      };
    }

    let message = 'No entity definitions found matching anatomy requirements. ';
    
    if (requirements.partType) {
      message += `Need part type: '${requirements.partType}'. `;
    }
    
    message += `Allowed types: [${allowedTypes.join(', ')}]. `;
    
    if (requirements.components?.length > 0) {
      message += `Required components: [${requirements.components.join(', ')}]. `;
    }
    
    if (recipeSlot?.tags?.length > 0) {
      message += `Required tags: [${recipeSlot.tags.join(', ')}]. `;
    }
    
    if (recipeSlot?.notTags?.length > 0) {
      message += `Excluded tags: [${recipeSlot.notTags.join(', ')}]. `;
    }
    
    message += `Checked ${totalDefinitions} entity definitions.`;

    context.message = message;
    context.suggestion = this.#buildSuggestion(requirements, allowedTypes, recipeSlot);

    return context;
  }

  /**
   * Builds a suggestion for creating missing entity definitions
   *
   * @param {PartRequirements} requirements - Requirements
   * @param {string[]} allowedTypes - Allowed types
   * @param {SlotDefinition} [recipeSlot] - Recipe slot
   * @returns {string} Suggestion text
   */
  #buildSuggestion(requirements, allowedTypes, recipeSlot) {
    let suggestion = `Create an entity definition with 'anatomy:part' component where subType is one of: [${allowedTypes.join(', ')}]`;
    
    if (requirements.components?.length > 0) {
      suggestion += ` and components: [${requirements.components.join(', ')}]`;
    }
    
    if (recipeSlot?.tags?.length > 0) {
      suggestion += ` and tags: [${recipeSlot.tags.join(', ')}]`;
    }
    
    return suggestion;
  }
}

export default PartSelectionService;