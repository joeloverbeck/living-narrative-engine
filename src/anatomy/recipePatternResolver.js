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
   * Validates all patterns before resolution.
   * Ensures patterns meet structural and semantic requirements.
   *
   * @param {object[]} patterns - Array of pattern definitions
   * @param {object} blueprint - Blueprint context for validation
   * @throws {ValidationError} If any pattern fails validation
   * @private
   */
  #validateAllPatterns(patterns, blueprint) {
    assertPresent(patterns, 'Patterns array is required');
    assertPresent(blueprint, 'Blueprint is required');

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      this.#logger.debug(`Validating pattern ${i + 1}/${patterns.length}`);

      // Phase 1: Core validation
      this.#validatePatternMutualExclusivity(pattern, i);
      this.#validateBlueprintVersion(pattern, blueprint, i);

      // Phase 2: Pattern-specific validation
      if (pattern.matchesGroup) {
        this.#validateMatchesGroup(pattern, blueprint, i);
      } else if (pattern.matchesPattern !== undefined) {
        this.#validateMatchesPattern(pattern, Object.keys(blueprint.slots || {}), i);
      } else if (pattern.matchesAll) {
        this.#validateMatchesAll(pattern, blueprint.slots || {}, i);
      }

      // Phase 3: Exclusion validation
      if (pattern.exclude) {
        this.#validateExclusions(pattern, blueprint, i);
      }
    }

    // Phase 3: Pattern precedence warnings
    this.#validatePatternPrecedence(patterns, blueprint);
  }

  /**
   * Validates that pattern uses exactly one matcher type.
   * Ensures mutual exclusivity of matches, matchesGroup, matchesPattern, matchesAll.
   *
   * @param {object} pattern - Pattern definition to validate
   * @param {number} patternIndex - Pattern index for error messages
   * @throws {ValidationError} If pattern has multiple or no matchers
   * @private
   */
  #validatePatternMutualExclusivity(pattern, patternIndex) {
    const matchers = ['matches', 'matchesGroup', 'matchesPattern', 'matchesAll'];
    const presentMatchers = matchers.filter(m => pattern[m] !== undefined);

    if (presentMatchers.length === 0) {
      throw new ValidationError(
        `Pattern ${patternIndex + 1} has no matcher: must specify exactly one of 'matches', 'matchesGroup', 'matchesPattern', or 'matchesAll'.`
      );
    }

    if (presentMatchers.length > 1) {
      throw new ValidationError(
        `Pattern ${patternIndex + 1} has multiple matchers: found ${presentMatchers.map(m => `'${m}'`).join(' and ')}. Only one is allowed per pattern.`
      );
    }
  }

  /**
   * Validates blueprint version compatibility with pattern type.
   * V2 patterns require schemaVersion: "2.0" and structureTemplate.
   *
   * @param {object} pattern - Pattern definition to validate
   * @param {object} blueprint - Blueprint to check version
   * @param {number} patternIndex - Pattern index for error messages
   * @throws {ValidationError} If version requirements not met
   * @private
   */
  #validateBlueprintVersion(pattern, blueprint, patternIndex) {
    // Only matchesGroup requires V2 blueprint with structure template
    // matchesPattern and matchesAll work with any blueprint version
    if (!pattern.matchesGroup) {
      return;
    }

    // matchesGroup requires schemaVersion: "2.0"
    if (blueprint.schemaVersion !== '2.0') {
      throw new ValidationError(
        `Pattern ${patternIndex + 1} uses 'matchesGroup' but blueprint '${blueprint.id}' has schemaVersion '${blueprint.schemaVersion || '1.0'}'. matchesGroup requires schemaVersion '2.0'.`
      );
    }

    // Check blueprint has structureTemplate
    if (!blueprint.structureTemplate) {
      throw new ValidationError(
        `Blueprint '${blueprint.id}' has schemaVersion '2.0' but no 'structureTemplate' property. matchesGroup requires a structure template.`
      );
    }

    // Check structure template exists
    const template = this.#dataRegistry.get(
      'anatomyStructureTemplates',
      blueprint.structureTemplate
    );

    if (!template) {
      throw new ValidationError(
        `Structure template '${blueprint.structureTemplate}' not found. Ensure template exists and is loaded before blueprint.`
      );
    }
  }

  /**
   * Validates matchesGroup pattern.
   * Checks group format, existence in template, and match count.
   *
   * @param {object} pattern - Pattern with matchesGroup
   * @param {object} blueprint - Blueprint with structure template
   * @param {number} patternIndex - Pattern index for error messages
   * @throws {ValidationError} If group validation fails
   * @private
   */
  #validateMatchesGroup(pattern, blueprint, patternIndex) {
    const groupRef = pattern.matchesGroup;

    // Validate format
    const [groupType, groupName] = groupRef.split(':');

    if (!groupType || !groupName) {
      throw new ValidationError(
        `Pattern ${patternIndex + 1}: Slot group '${groupRef}' format invalid. Expected 'limbSet:{type}' or 'appendage:{type}'.`
      );
    }

    if (groupType !== 'limbSet' && groupType !== 'appendage') {
      throw new ValidationError(
        `Pattern ${patternIndex + 1}: Slot group '${groupRef}' format invalid. Expected 'limbSet:{type}' or 'appendage:{type}'.`
      );
    }

    // Load structure template
    const template = this.#dataRegistry.get(
      'anatomyStructureTemplates',
      blueprint.structureTemplate
    );

    // Check group exists in template
    let groupExists = false;
    const availableGroups = [];

    if (groupType === 'limbSet') {
      const limbSets = template.topology?.limbSets || [];
      groupExists = limbSets.some(ls => ls.type === groupName);
      availableGroups.push(
        ...limbSets.map(ls => `limbSet:${ls.type}`)
      );
    } else if (groupType === 'appendage') {
      const appendages = template.topology?.appendages || [];
      groupExists = appendages.some(a => a.type === groupName);
      availableGroups.push(
        ...appendages.map(a => `appendage:${a.type}`)
      );
    }

    if (!groupExists) {
      const availableStr = availableGroups.length > 0
        ? ` Available groups: ${availableGroups.map(g => `'${g}'`).join(', ')}`
        : '';
      throw new ValidationError(
        `Pattern ${patternIndex + 1}: Slot group '${groupRef}' not found in structure template '${blueprint.structureTemplate}'.${availableStr}`
      );
    }

    // Warning if group matches 0 slots
    const matchedKeys = this.#resolveSlotGroup(groupRef, blueprint);
    if (matchedKeys.length === 0) {
      this.#logger.warn(
        `Pattern ${patternIndex + 1}: Slot group '${groupRef}' matched 0 slots. Template may not generate any slots of this type.`
      );
    }
  }

  /**
   * Validates matchesPattern wildcard pattern.
   * Checks pattern is non-empty and warns if no matches.
   *
   * @param {object} pattern - Pattern with matchesPattern
   * @param {string[]} blueprintSlotKeys - Available slot keys
   * @param {number} patternIndex - Pattern index for error messages
   * @throws {ValidationError} If pattern is invalid
   * @private
   */
  #validateMatchesPattern(pattern, blueprintSlotKeys, patternIndex) {
    const patternStr = pattern.matchesPattern;

    // Check pattern is non-empty string
    if (typeof patternStr !== 'string' || patternStr.length === 0) {
      throw new ValidationError(
        `Pattern ${patternIndex + 1}: Pattern must be a non-empty string.`
      );
    }

    // Warning if pattern matches 0 slots
    const matchedKeys = this.#resolveWildcardPattern(patternStr, blueprintSlotKeys);
    if (matchedKeys.length === 0) {
      this.#logger.warn(
        `Pattern ${patternIndex + 1}: Pattern '${patternStr}' matched 0 slots. Check blueprint slot keys and pattern syntax.`
      );
    }
  }

  /**
   * Validates matchesAll property-based filter.
   * Checks at least one filter property exists, validates wildcard usage.
   *
   * @param {object} pattern - Pattern with matchesAll
   * @param {object} blueprintSlots - Blueprint slot definitions
   * @param {number} patternIndex - Pattern index for error messages
   * @throws {ValidationError} If filter is invalid
   * @private
   */
  #validateMatchesAll(pattern, blueprintSlots, patternIndex) {
    const filter = pattern.matchesAll;

    // Check at least one filter property
    const filterProps = ['slotType', 'orientation', 'socketId'];
    const presentProps = filterProps.filter(p => filter[p] !== undefined);

    if (presentProps.length === 0) {
      throw new ValidationError(
        `Pattern ${patternIndex + 1}: matchesAll must have at least one filter property: 'slotType', 'orientation', or 'socketId'.`
      );
    }

    // Validate wildcard restrictions: slotType doesn't support wildcards
    if (filter.slotType && typeof filter.slotType === 'string' && filter.slotType.includes('*')) {
      throw new ValidationError(
        `Pattern ${patternIndex + 1}: matchesAll wildcard pattern on 'slotType' is not supported. Wildcards only work on 'orientation' and 'socketId'.`
      );
    }

    // Warning if filter matches 0 slots
    const matchedKeys = this.#resolvePropertyFilter(filter, blueprintSlots);
    if (matchedKeys.length === 0) {
      const filterDesc = JSON.stringify(filter);
      this.#logger.warn(
        `Pattern ${patternIndex + 1}: matchesAll filter ${filterDesc} matched 0 slots.`
      );
    }
  }

  /**
   * Validates pattern exclusions.
   * Checks excluded slot groups exist and exclusion properties are valid.
   *
   * @param {object} pattern - Pattern with exclude property
   * @param {object} blueprint - Blueprint for slot group resolution
   * @param {number} patternIndex - Pattern index for error messages
   * @throws {ValidationError} If exclusions are invalid
   * @private
   */
  #validateExclusions(pattern, blueprint, patternIndex) {
    const exclusions = pattern.exclude;

    // Validate excluded slot groups
    if (exclusions.slotGroups && Array.isArray(exclusions.slotGroups)) {
      const template = this.#dataRegistry.get(
        'anatomyStructureTemplates',
        blueprint.structureTemplate
      );

      for (const groupRef of exclusions.slotGroups) {
        const [groupType, groupName] = groupRef.split(':');

        let groupExists = false;
        if (groupType === 'limbSet') {
          const limbSets = template?.topology?.limbSets || [];
          groupExists = limbSets.some(ls => ls.type === groupName);
        } else if (groupType === 'appendage') {
          const appendages = template?.topology?.appendages || [];
          groupExists = appendages.some(a => a.type === groupName);
        }

        if (!groupExists) {
          throw new ValidationError(
            `Pattern ${patternIndex + 1}: Exclusion slot group '${groupRef}' not found in structure template.`
          );
        }
      }
    }

    // Validate exclusion properties
    if (exclusions.properties !== undefined) {
      if (
        exclusions.properties === null ||
        typeof exclusions.properties !== 'object' ||
        Array.isArray(exclusions.properties)
      ) {
        throw new ValidationError(
          `Pattern ${patternIndex + 1}: Exclusion property filter must be a valid object with slot properties.`
        );
      }
    }
  }

  /**
   * Validates pattern precedence and warns about potential conflicts.
   * Detects overlapping patterns with equal specificity.
   *
   * @param {object[]} patterns - All patterns to check
   * @param {object} blueprint - Blueprint for slot resolution
   * @private
   */
  #validatePatternPrecedence(patterns, blueprint) {
    // Check for overlapping patterns
    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        const pattern1 = patterns[i];
        const pattern2 = patterns[j];

        // Resolve both patterns
        const keys1 = this.#resolvePatternToKeys(pattern1, blueprint);
        const keys2 = this.#resolvePatternToKeys(pattern2, blueprint);

        // Check for overlap
        const overlap = keys1.filter(k => keys2.includes(k));

        if (overlap.length > 0) {
          const spec1 = this.#getPatternSpecificity(pattern1);
          const spec2 = this.#getPatternSpecificity(pattern2);

          if (spec1 === spec2) {
            const desc1 = this.#getPatternDescription(pattern1);
            const desc2 = this.#getPatternDescription(pattern2);

            this.#logger.warn(
              `Pattern ${i + 1} (${desc1}) and Pattern ${j + 1} (${desc2}) have equal specificity and may match the same slots (${overlap.length} overlapping). Consider making patterns more specific.`
            );
          }
        }
      }
    }
  }

  /**
   * Resolves a pattern to its matching slot keys (for precedence validation).
   *
   * @param {object} pattern - Pattern to resolve
   * @param {object} blueprint - Blueprint context
   * @returns {string[]} Array of slot keys
   * @private
   */
  #resolvePatternToKeys(pattern, blueprint) {
    try {
      if (pattern.matches) {
        return pattern.matches;
      } else if (pattern.matchesGroup) {
        return this.#resolveSlotGroup(pattern.matchesGroup, blueprint);
      } else if (pattern.matchesPattern) {
        return this.#resolveWildcardPattern(
          pattern.matchesPattern,
          Object.keys(blueprint.slots || {})
        );
      } else if (pattern.matchesAll) {
        return this.#resolvePropertyFilter(pattern.matchesAll, blueprint.slots || {});
      }
      return [];
    } catch (error) {
      // Validation errors already thrown, return empty for precedence check
      return [];
    }
  }

  /**
   * Gets pattern specificity score for precedence ordering.
   * Higher score = more specific.
   *
   * @param {object} pattern - Pattern to score
   * @returns {number} Specificity score (1-4)
   * @private
   */
  #getPatternSpecificity(pattern) {
    if (pattern.matches) return 4; // Explicit list
    if (pattern.matchesAll) return 3; // Property-based
    if (pattern.matchesPattern) return 2; // Wildcard pattern
    if (pattern.matchesGroup) return 1; // Slot group
    return 0;
  }

  /**
   * Gets human-readable pattern description.
   *
   * @param {object} pattern - Pattern to describe
   * @returns {string} Pattern description
   * @private
   */
  #getPatternDescription(pattern) {
    if (pattern.matches) {
      return `matches: explicit list`;
    } else if (pattern.matchesGroup) {
      return `matchesGroup: '${pattern.matchesGroup}'`;
    } else if (pattern.matchesPattern) {
      return `matchesPattern: '${pattern.matchesPattern}'`;
    } else if (pattern.matchesAll) {
      return `matchesAll: ${JSON.stringify(pattern.matchesAll)}`;
    }
    return 'unknown pattern';
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

    // Validate all patterns before resolution
    this.#validateAllPatterns(recipe.patterns, blueprint);

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
      let patternIndex = recipe.patterns.indexOf(pattern) + 1;
      for (const slotKey of matchedSlotKeys) {
        // Skip if explicitly defined in recipe slots (explicit definitions take precedence)
        if (expandedSlots[slotKey]) {
          const patternDesc = this.#getPatternDescription(pattern);
          this.#logger.info(
            `Explicit slot '${slotKey}' overrides Pattern ${patternIndex} (${patternDesc}). This is expected behavior.`
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
