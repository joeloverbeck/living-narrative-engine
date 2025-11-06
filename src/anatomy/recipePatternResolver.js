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
} from '../utils/dependencyUtils.js';
import { ValidationError } from '../errors/validationError.js';
import {
  resolveSlotGroup,
  validateMatchesGroup
} from './recipePatternResolver/matchers/groupMatcher.js';
import {
  resolveWildcardPattern,
  validateMatchesPattern,
} from './recipePatternResolver/matchers/wildcardMatcher.js';
import {
  resolvePropertyFilter,
  validateMatchesAll
} from './recipePatternResolver/matchers/propertyMatcher.js';

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
        const deps = {
          dataRegistry: this.#dataRegistry,
          slotGenerator: this.#slotGenerator,
          logger: this.#logger
        };
        validateMatchesGroup(pattern, blueprint, i, deps);
      } else if (pattern.matchesPattern !== undefined) {
        validateMatchesPattern(pattern, blueprint, i, this.#logger);
      } else if (pattern.matchesAll) {
        validateMatchesAll(pattern, blueprint, i, this.#logger);
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
   * Determines whether a pattern currently exposes a matcher definition.
   *
   * @param {object} pattern - Pattern definition to inspect
   * @returns {boolean} True when any matcher is defined
   * @private
   */
  #hasMatcher(pattern) {
    if (Array.isArray(pattern.matches) && pattern.matches.length > 0) {
      return true;
    }

    if (pattern.matchesGroup !== undefined) {
      return true;
    }

    if (pattern.matchesPattern !== undefined) {
      return true;
    }

    return pattern.matchesAll !== undefined;
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
        const topology = template?.topology;

        if (groupType === 'limbSet') {
          const limbSets = Array.isArray(topology?.limbSets)
            ? topology.limbSets
            : [];
          groupExists = limbSets.some(ls => ls.type === groupName);
        } else {
          const appendages = Array.isArray(topology?.appendages)
            ? topology.appendages
            : [];
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
        const deps = {
          dataRegistry: this.#dataRegistry,
          slotGenerator: this.#slotGenerator,
          logger: this.#logger
        };
        return resolveSlotGroup(pattern.matchesGroup, blueprint, {}, deps);
      } else if (pattern.matchesPattern) {
        return resolveWildcardPattern(
          pattern.matchesPattern,
          Object.keys(blueprint.slots || {}),
          this.#logger
        );
      } else if (pattern.matchesAll) {
        return resolvePropertyFilter(pattern.matchesAll, blueprint.slots || {}, this.#logger);
      }
      return [];
    } catch {
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
    // At this point validation guarantees a matchesGroup pattern
    return 1;
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
    }

    if (pattern.matchesGroup) {
      return `matchesGroup: '${pattern.matchesGroup}'`;
    }

    if (pattern.matchesPattern) {
      return `matchesPattern: '${pattern.matchesPattern}'`;
    }

    return `matchesAll: ${JSON.stringify(pattern.matchesAll ?? {})}`;
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

    const expandedSlots = { ...(recipe.slots || {}) };
    const patternHints = [];
    const patternConflicts = [];
    const blueprintSlots = blueprint.slots || {};
    const blueprintSlotKeys = Object.keys(blueprintSlots);
    const blueprintAdditionalSlots = blueprint.additionalSlots || {};
    const defaultMatcherHint =
      'Pattern skipped: no matcher defined. Use matchesGroup selectors such as limbSet:leg or appendage:tail, matchesPattern wildcards, or matchesAll filters.';

    this.#logger.info(
      `Resolving ${recipe.patterns.length} patterns against ${blueprintSlotKeys.length} blueprint slots`
    );

    // Validate all patterns before resolution
    this.#validateAllPatterns(recipe.patterns, blueprint);

    for (let index = 0; index < recipe.patterns.length; index += 1) {
      const pattern = recipe.patterns[index];
      const patternNumber = index + 1;
      const usesExplicitMatches = Array.isArray(pattern.matches);
      const hasExplicitMatches =
        usesExplicitMatches && pattern.matches.length !== 0;
      const matchesGroupRef = pattern.matchesGroup;
      const matchesPatternStr = pattern.matchesPattern;
      const matchesAllFilter = pattern.matchesAll;
      const hadMatcherAtStart = this.#hasMatcher(pattern);
      let matchedSlotKeys = [];

      // V1 pattern: explicit slot list (backward compatibility)
      if (usesExplicitMatches) {
        matchedSlotKeys = hasExplicitMatches ? [...pattern.matches] : [];
        this.#logger.debug(
          `V1 pattern: explicit matches for ${matchedSlotKeys.length} slots`
        );
      }
      // V2 pattern: slot group selector
      else if (matchesGroupRef !== undefined) {
        try {
          const deps = {
            dataRegistry: this.#dataRegistry,
            slotGenerator: this.#slotGenerator,
            logger: this.#logger
          };
          matchedSlotKeys = resolveSlotGroup(
            matchesGroupRef,
            blueprint,
            {},
            deps
          );
        } catch (error) {
          if (error instanceof ValidationError) {
            if (
              error.message.startsWith('Pattern ') ||
              error.message.startsWith('Structure template not found')
            ) {
              throw error;
            }

            if (error.message.includes('matched 0 slots')) {
              this.#raiseZeroMatchError({
                pattern,
                blueprint,
                patternIndex: index,
                slotGroupRef: matchesGroupRef,
              });
            }

            const wrappedMessage = `Pattern ${patternNumber}: ${error.message}`;
            this.#logger.warn(wrappedMessage);
            if (matchesGroupRef) {
              const templateId =
                blueprint?.structureTemplate || 'unknown template';
              this.#logger.warn(
                `Slot group '${matchesGroupRef}' not found or produced 0 slots in structure template '${templateId}'.`
              );
            }

            throw new ValidationError(wrappedMessage);
          }
          throw error;
        }
        this.#logger.debug(
          `matchesGroup '${matchesGroupRef}' resolved to ${matchedSlotKeys.length} slots`
        );
      }
      // V2 pattern: wildcard pattern
      else if (matchesPatternStr !== undefined) {
        matchedSlotKeys = resolveWildcardPattern(
          matchesPatternStr,
          blueprintSlotKeys,
          this.#logger
        );
        this.#logger.debug(
          `matchesPattern '${matchesPatternStr}' resolved to ${matchedSlotKeys.length} slots`
        );
      }
      // V2 pattern: property-based filter
      else if (matchesAllFilter) {
        matchedSlotKeys = resolvePropertyFilter(
          matchesAllFilter,
          blueprintSlots,
          this.#logger
        );
        this.#logger.debug(
          `matchesAll resolved to ${matchedSlotKeys.length} slots`
        );
      } else {
        this.#logger.warn('Pattern has no recognized matcher type', pattern);
        if (!patternHints.includes(defaultMatcherHint)) {
          patternHints.push(defaultMatcherHint);
        }
        continue;
      }

      if (!usesExplicitMatches && matchedSlotKeys.length === 0) {
        this.#raiseZeroMatchError({
          pattern,
          blueprint,
          patternIndex: index,
          slotGroupRef: matchesGroupRef,
        });
      }

      // Apply exclusions if present
      let filteredSlotKeys = matchedSlotKeys;

      if (pattern.exclude) {
        const beforeExclusion = filteredSlotKeys.length;
        filteredSlotKeys = this.#applyExclusions(
          filteredSlotKeys,
          pattern.exclude,
          blueprint
        );
        this.#logger.debug(
          `Exclusions filtered ${beforeExclusion} → ${filteredSlotKeys.length} slots`
        );

        if (!usesExplicitMatches && filteredSlotKeys.length === 0) {
          this.#raiseZeroMatchError({
            pattern,
            blueprint,
            patternIndex: index,
            stage: 'after applying exclusions',
            slotGroupRef: matchesGroupRef,
          });
        }
      }

      // Create slot definitions for matched slots
      const patternDesc = this.#getPatternDescription(pattern);

      for (const slotKey of filteredSlotKeys) {
        // Skip if explicitly defined in recipe slots (explicit definitions take precedence)
        if (expandedSlots[slotKey]) {
          if (hadMatcherAtStart) {
            this.#logger.info(
              `Explicit slot '${slotKey}' overrides Pattern ${patternNumber} (${patternDesc}). This is expected behavior.`
            );
            patternConflicts.push({
              severity: 'info',
              slotKey,
              pattern: patternDesc,
              hint: `Explicit slot '${slotKey}' overrides pattern output from Pattern ${patternNumber}.`,
              patternIndex: patternNumber,
            });
          }
          continue;
        }

        if (Object.prototype.hasOwnProperty.call(blueprintAdditionalSlots, slotKey)) {
          if (hadMatcherAtStart) {
            this.#logger.info(
              `Blueprint additionalSlots for slot '${slotKey}' overrides Pattern ${patternNumber} (${patternDesc}).`
            );
            patternConflicts.push({
              severity: 'warning',
              slotKey,
              pattern: patternDesc,
              hint: `Blueprint additionalSlots overrides Pattern ${patternNumber} output for slot '${slotKey}'.`,
              patternIndex: patternNumber,
            });
          }
          continue;
        }

        expandedSlots[slotKey] = {
          partType: pattern.partType,
          preferId: pattern.preferId,
          tags: Array.isArray(pattern.tags) ? [...pattern.tags] : pattern.tags,
          notTags: Array.isArray(pattern.notTags)
            ? [...pattern.notTags]
            : pattern.notTags,
          properties: pattern.properties ? { ...pattern.properties } : undefined,
        };
      }

      const hasMatcherAtEnd = this.#hasMatcher(pattern);
      if (
        !hasMatcherAtEnd &&
        !patternHints.includes(defaultMatcherHint)
      ) {
        patternHints.push(defaultMatcherHint);
      }
    }

    const addedSlots =
      Object.keys(expandedSlots).length -
      Object.keys(recipe.slots || {}).length;
    this.#logger.info(`Pattern resolution added ${addedSlots} slot definitions`);

    return {
      ...recipe,
      slots: expandedSlots,
      ...(patternHints.length > 0 ? { _patternHints: patternHints } : {}),
      _patternConflicts: patternConflicts,
    };
  }


  /**
   * Collects blueprint availability summaries for error hints.
   *
   * @param {object} blueprint - Blueprint definition
   * @returns {{slotKeys: string[], orientations: string[], socketIds: string[]}} Object with blueprint availability info
   * @private
   */
  #collectBlueprintAvailability(blueprint) {
    const slotKeys = new Set();
    const orientations = new Set();
    const socketIds = new Set();

    const collect = slots => {
      if (!slots) return;
      for (const [key, slotDef] of Object.entries(slots)) {
        slotKeys.add(key);
        if (slotDef?.orientation) {
          orientations.add(slotDef.orientation);
        }
        if (slotDef?.socket) {
          socketIds.add(slotDef.socket);
        }
      }
    };

    collect(blueprint?.slots);
    collect(blueprint?.additionalSlots);

    return {
      slotKeys: Array.from(slotKeys).sort(),
      orientations: Array.from(orientations).sort(),
      socketIds: Array.from(socketIds).sort(),
    };
  }

  /**
   * Throws a validation error with helpful availability hints when no slots are matched.
   *
   * @param {object} options - Error context options
   * @param {object} options.pattern - Pattern that failed to match
   * @param {object} options.blueprint - Blueprint being resolved
   * @param {number} [options.patternIndex] - Pattern index for error messages
   * @param {string} [options.stage] - Stage descriptor (e.g., 'after applying exclusions')
   * @param {string} [options.slotGroupRef] - Slot group reference context
   * @throws {ValidationError} Always throws with composed message
   * @private
   */
  #raiseZeroMatchError({
    pattern,
    blueprint,
    stage,
    slotGroupRef,
    patternIndex,
  }) {
    const patternNumber =
      typeof patternIndex === 'number' ? patternIndex + 1 : '?';
    const blueprintId = blueprint?.id || 'unknown blueprint';
    const availability = this.#collectBlueprintAvailability(blueprint);

    let logMessage = `Pattern ${patternNumber}: ${this.#getPatternDescription(
      pattern
    )} matched 0 slots`;
    let errorMessage = logMessage;

    if (pattern.matchesGroup || slotGroupRef) {
      if (stage) {
        const base = `Pattern ${this.#getPatternDescription(pattern)} matched 0 slots`;
        logMessage = base;
        errorMessage = base;
      } else {
        const matcherLabel = `Slot group '${slotGroupRef ?? pattern.matchesGroup}'`;
        const base = `Pattern ${patternNumber}: ${matcherLabel} matched 0 slots`;
        logMessage = base;
        errorMessage = base;
      }
    } else if (pattern.matchesPattern) {
      const baseLog = `Pattern ${patternNumber}: Pattern '${pattern.matchesPattern}' matched 0 slots`;
      const baseError = `Pattern ${patternNumber}: matchesPattern '${pattern.matchesPattern}' matched 0 slots`;
      logMessage = baseLog;
      errorMessage = baseError;
    } else if (pattern.matchesAll) {
      const filterStr = JSON.stringify(pattern.matchesAll);
      const base = `Pattern ${patternNumber}: matchesAll filter ${filterStr} matched 0 slots`;
      logMessage = base;
      errorMessage = base;
    }

    if (stage) {
      logMessage += ` ${stage}`;
      errorMessage += ` ${stage}`;
    }

    if (pattern.matchesGroup || slotGroupRef) {
      const templateId = blueprint?.structureTemplate || 'unknown template';
      logMessage += ` in structure template '${templateId}'.`;
      errorMessage += ` in structure template '${templateId}'.`;
    } else {
      logMessage += ` in blueprint '${blueprintId}'.`;
      errorMessage += ` in blueprint '${blueprintId}'.`;
    }

    if (availability.slotKeys.length > 0) {
      logMessage += ` Available slot keys: ${availability.slotKeys.join(', ')}.`;
      errorMessage += ` Available slot keys: ${availability.slotKeys.join(', ')}.`;
    } else {
      logMessage += ' Available slot keys: none.';
      errorMessage += ' Available slot keys: none.';
    }

    if (availability.orientations.length > 0) {
      logMessage += ` Available orientations: ${availability.orientations.join(', ')}.`;
      errorMessage += ` Available orientations: ${availability.orientations.join(', ')}.`;
    }

    if (availability.socketIds.length > 0) {
      logMessage += ` Available sockets: ${availability.socketIds.join(', ')}.`;
      errorMessage += ` Available sockets: ${availability.socketIds.join(', ')}.`;
    }

    this.#logger.warn(logMessage);

    if (pattern.matchesGroup || slotGroupRef) {
      const groupRef = slotGroupRef ?? pattern.matchesGroup;
      const templateId = blueprint?.structureTemplate || 'unknown template';
      this.#logger.warn(
        `Slot group '${groupRef}' not found or produced 0 slots in structure template '${templateId}'.`
      );
    }

    throw new ValidationError(errorMessage);
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
        const deps = {
          dataRegistry: this.#dataRegistry,
          slotGenerator: this.#slotGenerator,
          logger: this.#logger
        };
        const excludedKeys = resolveSlotGroup(groupRef, blueprint, {}, deps);
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
