/**
 * @file RecipePatternResolver - Resolves V2 recipe patterns against blueprint slots
 * Handles three types of advanced pattern matching:
 * - matchesGroup: Slot group selectors ('limbSet:leg', 'appendage:tail')
 * - matchesPattern: Wildcard patterns ('leg_*', '*_left', '*tentacle*')
 * - matchesAll: Property-based filters (slotType, orientation, socketId)
 * @see src/anatomy/recipeProcessor.js - Handles V1 pattern expansion
 * @see src/anatomy/bodyBlueprintFactory.js - Integration point for pattern resolution
 */

import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from '../utils/dependencyUtils.js';
import { ValidationError } from '../errors/validationError.js';

/**
 * Resolves V2 recipe patterns into concrete slot definitions
 * using blueprint context and structure templates.
 *
 * Pattern resolution occurs during blueprint processing when
 * both recipe and blueprint context are available.
 */
class RecipePatternResolver {
  #dataRegistry;
  #slotGenerator;
  #logger;

  /**
   * Creates a new RecipePatternResolver instance
   *
   * @param {object} dependencies - Dependency injection container
   * @param {object} dependencies.dataRegistry - IDataRegistry implementation
   * @param {object} dependencies.slotGenerator - ISlotGenerator implementation
   * @param {object} dependencies.logger - ILogger implementation
   */
  constructor({ dataRegistry, slotGenerator, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: [
        'extractSlotKeysFromLimbSet',
        'extractSlotKeysFromAppendage',
      ],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#dataRegistry = dataRegistry;
    this.#slotGenerator = slotGenerator;
    this.#logger = logger;
  }

  /**
   * Resolves V2 recipe patterns against blueprint slots.
   *
   * @param {object} recipe - Recipe with patterns to resolve
   * @param {object} blueprint - Blueprint with generated slots and structure template
   * @returns {object} Recipe with expanded slots from pattern matching
   * @example
   * const recipe = {
   *   patterns: [
   *     { matchesGroup: 'limbSet:leg', partType: 'leg_segment' }
   *   ]
   * };
   * const resolved = resolver.resolveRecipePatterns(recipe, blueprint);
   * // resolved.slots now includes all leg slots with leg_segment requirement
   */
  resolveRecipePatterns(recipe, blueprint) {
    assertPresent(recipe, 'Recipe is required');
    assertPresent(blueprint, 'Blueprint is required');

    if (!recipe.patterns || recipe.patterns.length === 0) {
      this.#logger.debug('No patterns to resolve in recipe');
      return recipe;
    }

    const expandedSlots = { ...recipe.slots };
    const blueprintSlotKeys = Object.keys(blueprint.slots || {});

    this.#logger.info(
      `Resolving ${recipe.patterns.length} patterns against ${blueprintSlotKeys.length} blueprint slots`
    );

    for (const pattern of recipe.patterns) {
      let matchedSlotKeys;

      // V1 pattern: explicit slot list (backward compatibility)
      if (pattern.matches) {
        matchedSlotKeys = pattern.matches;
        this.#logger.debug(
          `V1 pattern: explicit matches for ${matchedSlotKeys.length} slots`
        );
      }
      // V2 pattern: slot group selector
      else if (pattern.matchesGroup) {
        matchedSlotKeys = this.#resolveSlotGroup(
          pattern.matchesGroup,
          blueprint
        );
        this.#logger.debug(
          `matchesGroup '${pattern.matchesGroup}' resolved to ${matchedSlotKeys.length} slots`
        );
      }
      // V2 pattern: wildcard pattern
      else if (pattern.matchesPattern) {
        matchedSlotKeys = this.#resolveWildcardPattern(
          pattern.matchesPattern,
          blueprintSlotKeys
        );
        this.#logger.debug(
          `matchesPattern '${pattern.matchesPattern}' resolved to ${matchedSlotKeys.length} slots`
        );
      }
      // V2 pattern: property-based filter
      else if (pattern.matchesAll) {
        matchedSlotKeys = this.#resolvePropertyFilter(
          pattern.matchesAll,
          blueprint.slots
        );
        this.#logger.debug(
          `matchesAll resolved to ${matchedSlotKeys.length} slots`
        );
      } else {
        this.#logger.warn('Pattern has no recognized matcher type', pattern);
        continue;
      }

      // Apply exclusions if present
      if (pattern.exclude) {
        const beforeExclusion = matchedSlotKeys.length;
        matchedSlotKeys = this.#applyExclusions(
          matchedSlotKeys,
          pattern.exclude,
          blueprint
        );
        this.#logger.debug(
          `Exclusions filtered ${beforeExclusion} → ${matchedSlotKeys.length} slots`
        );
      }

      // Create slot definitions for matched slots
      for (const slotKey of matchedSlotKeys) {
        // Skip if explicitly defined in recipe slots (explicit definitions take precedence)
        if (expandedSlots[slotKey]) {
          this.#logger.debug(
            `Skipping slot '${slotKey}' - already explicitly defined`
          );
          continue;
        }

        expandedSlots[slotKey] = {
          partType: pattern.partType,
          preferId: pattern.preferId,
          tags: pattern.tags,
          notTags: pattern.notTags,
          properties: pattern.properties,
        };
      }
    }

    const addedSlots = Object.keys(expandedSlots).length - Object.keys(recipe.slots || {}).length;
    this.#logger.info(`Pattern resolution added ${addedSlots} slot definitions`);

    return { ...recipe, slots: expandedSlots };
  }

  /**
   * Resolves matchesGroup pattern to slot keys.
   *
   * Format: "limbSet:leg" or "appendage:tail"
   *
   * @param {string} groupRef - Group reference in format "type:name"
   * @param {object} blueprint - Blueprint with structure template reference
   * @returns {string[]} Array of matching slot keys
   * @private
   */
  #resolveSlotGroup(groupRef, blueprint) {
    assertNonBlankString(
      groupRef,
      'Group reference',
      'resolveSlotGroup',
      this.#logger
    );

    if (!blueprint.structureTemplate) {
      this.#logger.warn(
        `Cannot resolve slot group '${groupRef}': blueprint has no structure template`
      );
      return [];
    }

    // Load structure template from DataRegistry
    const template = this.#dataRegistry.get(
      'anatomyStructureTemplates',
      blueprint.structureTemplate
    );

    if (!template) {
      throw new ValidationError(
        `Structure template not found: ${blueprint.structureTemplate}`
      );
    }

    const [groupType, groupName] = groupRef.split(':');

    if (!groupType || !groupName) {
      throw new ValidationError(
        `Invalid slot group reference format: '${groupRef}'. Expected 'type:name'`
      );
    }

    const slotKeys = [];

    // Find matching limb sets or appendages
    if (groupType === 'limbSet') {
      const matchingLimbSets =
        template.topology?.limbSets?.filter(ls => ls.type === groupName) || [];

      this.#logger.debug(
        `Found ${matchingLimbSets.length} limb sets matching type '${groupName}'`
      );

      for (const limbSet of matchingLimbSets) {
        const keys = this.#generateSlotKeysFromLimbSet(limbSet);
        slotKeys.push(...keys);
      }
    } else if (groupType === 'appendage') {
      const matchingAppendages =
        template.topology?.appendages?.filter(a => a.type === groupName) ||
        [];

      this.#logger.debug(
        `Found ${matchingAppendages.length} appendages matching type '${groupName}'`
      );

      for (const appendage of matchingAppendages) {
        const keys = this.#generateSlotKeysFromAppendage(appendage);
        slotKeys.push(...keys);
      }
    } else {
      throw new ValidationError(
        `Invalid slot group type: '${groupType}'. Expected 'limbSet' or 'appendage'`
      );
    }

    if (slotKeys.length === 0) {
      this.#logger.warn(
        `Slot group '${groupRef}' not found in template '${blueprint.structureTemplate}'`
      );
    }

    return slotKeys;
  }

  /**
   * Generates slot keys from limb set definition.
   *
   * @param {object} limbSet - Limb set definition from structure template
   * @returns {string[]} Array of slot keys
   * @private
   */
  #generateSlotKeysFromLimbSet(limbSet) {
    assertPresent(limbSet, 'Limb set is required');

    // Leverage existing SlotGenerator logic
    return this.#slotGenerator.extractSlotKeysFromLimbSet(limbSet);
  }

  /**
   * Generates slot keys from appendage definition.
   *
   * @param {object} appendage - Appendage definition from structure template
   * @returns {string[]} Array of slot keys
   * @private
   */
  #generateSlotKeysFromAppendage(appendage) {
    assertPresent(appendage, 'Appendage is required');

    // Leverage existing SlotGenerator logic
    return this.#slotGenerator.extractSlotKeysFromAppendage(appendage);
  }

  /**
   * Resolves matchesPattern with wildcards to matching slot keys.
   *
   * Pattern examples: "leg_*", "*_left", "*tentacle*"
   *
   * @param {string} pattern - Wildcard pattern
   * @param {string[]} slotKeys - Available slot keys to match against
   * @returns {string[]} Array of matching slot keys
   * @private
   */
  #resolveWildcardPattern(pattern, slotKeys) {
    assertNonBlankString(
      pattern,
      'Pattern',
      'resolveWildcardPattern',
      this.#logger
    );
    assertPresent(slotKeys, 'Slot keys array is required');

    const regex = this.#wildcardToRegex(pattern);
    const matches = slotKeys.filter(key => regex.test(key));

    this.#logger.debug(
      `Wildcard pattern '${pattern}' matched ${matches.length} of ${slotKeys.length} slots`
    );

    return matches;
  }

  /**
   * Converts wildcard pattern to regular expression.
   *
   * Escapes regex special characters and replaces * with .*
   *
   * @param {string} pattern - Wildcard pattern (e.g., "leg_*", "*_left")
   * @returns {RegExp} Compiled regular expression
   * @private
   */
  #wildcardToRegex(pattern) {
    // Escape all regex special characters except *
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Replace * with .*
    const regexPattern = escaped.replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Resolves matchesAll with property filters to matching slot keys.
   *
   * Filters slots by:
   * - slotType: Exact match on slot's partType requirement
   * - orientation: Pattern match on slot's orientation (supports wildcards)
   * - socketId: Pattern match on slot's socket (supports wildcards)
   *
   * @param {object} filter - Property filter criteria
   * @param {object} blueprintSlots - Blueprint's slot definitions
   * @returns {string[]} Array of matching slot keys
   * @private
   */
  #resolvePropertyFilter(filter, blueprintSlots) {
    assertPresent(filter, 'Filter is required');
    assertPresent(blueprintSlots, 'Blueprint slots are required');

    const matchedKeys = [];

    for (const [slotKey, slotDef] of Object.entries(blueprintSlots)) {
      let matches = true;

      // Filter by slotType (exact match on partType requirement)
      if (
        filter.slotType &&
        slotDef.requirements?.partType !== filter.slotType
      ) {
        matches = false;
      }

      // Filter by orientation (with wildcard support)
      if (filter.orientation && slotDef.orientation) {
        const orientationRegex = this.#wildcardToRegex(filter.orientation);
        if (!orientationRegex.test(slotDef.orientation)) {
          matches = false;
        }
      } else if (filter.orientation && !slotDef.orientation) {
        // Filter specifies orientation but slot has none
        matches = false;
      }

      // Filter by socketId (with wildcard support)
      if (filter.socketId && slotDef.socket) {
        const socketRegex = this.#wildcardToRegex(filter.socketId);
        if (!socketRegex.test(slotDef.socket)) {
          matches = false;
        }
      } else if (filter.socketId && !slotDef.socket) {
        // Filter specifies socket but slot has none
        matches = false;
      }

      if (matches) {
        matchedKeys.push(slotKey);
      }
    }

    this.#logger.debug(
      `Property filter matched ${matchedKeys.length} of ${Object.keys(blueprintSlots).length} slots`
    );

    return matchedKeys;
  }

  /**
   * Applies pattern exclusions to filter out unwanted slots.
   *
   * Supports:
   * - slotGroups: Array of group references to exclude
   * - properties: Property-based exclusion criteria
   *
   * @param {string[]} slotKeys - Slot keys to filter
   * @param {object} exclusions - Exclusion criteria
   * @param {object} blueprint - Blueprint for resolving slot groups
   * @returns {string[]} Filtered slot keys
   * @private
   */
  #applyExclusions(slotKeys, exclusions, blueprint) {
    assertPresent(slotKeys, 'Slot keys are required');
    assertPresent(exclusions, 'Exclusions are required');

    let filtered = [...slotKeys];

    // Exclude slot groups
    if (exclusions.slotGroups && Array.isArray(exclusions.slotGroups)) {
      for (const groupRef of exclusions.slotGroups) {
        const excludedKeys = this.#resolveSlotGroup(groupRef, blueprint);
        filtered = filtered.filter(key => !excludedKeys.includes(key));
        this.#logger.debug(
          `Excluded ${excludedKeys.length} slots from group '${groupRef}'`
        );
      }
    }

    // Exclude by properties
    if (exclusions.properties && blueprint.slots) {
      filtered = filtered.filter(key => {
        const slotDef = blueprint.slots[key];
        if (!slotDef) return true;

        for (const [prop, value] of Object.entries(exclusions.properties)) {
          if (slotDef[prop] === value) {
            this.#logger.debug(
              `Excluding slot '${key}' due to property ${prop}=${value}`
            );
            return false;
          }
        }
        return true;
      });
    }

    return filtered;
  }
}

export default RecipePatternResolver;
