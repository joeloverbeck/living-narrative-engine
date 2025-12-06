/**
 * @file RecipePatternResolver - Resolves V2 recipe patterns against blueprint slots
 * Main facade orchestrating pattern matching, validation, and resolution
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
} from '../../utils/dependencyUtils.js';
import { ValidationError } from '../../errors/validationError.js';

// Import matchers
import {
  resolveSlotGroup,
  validateMatchesGroup,
} from './matchers/groupMatcher.js';
import {
  resolveWildcardPattern,
  validateMatchesPattern,
} from './matchers/wildcardMatcher.js';
import {
  resolvePropertyFilter,
  validateMatchesAll,
} from './matchers/propertyMatcher.js';

// Import validators
import {
  validatePatternMutualExclusivity,
  validateBlueprintVersion,
} from './validators/patternValidator.js';
import {
  validateExclusions,
  applyExclusions,
} from './validators/exclusionValidator.js';
import {
  validatePatternPrecedence,
  getPatternDescription,
} from './validators/precedenceValidator.js';

// Import utilities
import { hasMatcher } from './utils/patternUtils.js';

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
      validatePatternMutualExclusivity(pattern, i);
      validateBlueprintVersion(pattern, blueprint, i, this.#dataRegistry);

      // Phase 2: Pattern-specific validation
      if (pattern.matchesGroup) {
        const deps = {
          dataRegistry: this.#dataRegistry,
          slotGenerator: this.#slotGenerator,
          logger: this.#logger,
        };
        validateMatchesGroup(pattern, blueprint, i, deps);
      } else if (pattern.matchesPattern !== undefined) {
        validateMatchesPattern(pattern, blueprint, i, this.#logger);
      } else if (pattern.matchesAll) {
        validateMatchesAll(pattern, blueprint, i, this.#logger);
      }

      // Phase 3: Exclusion validation
      if (pattern.exclude) {
        validateExclusions(pattern, blueprint, i, this.#dataRegistry);
      }
    }

    // Phase 4: Pattern precedence warnings
    const deps = {
      dataRegistry: this.#dataRegistry,
      slotGenerator: this.#slotGenerator,
      logger: this.#logger,
    };
    validatePatternPrecedence(patterns, blueprint, deps);
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

    const collect = (slots) => {
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

    let logMessage = `Pattern ${patternNumber}: ${getPatternDescription(
      pattern
    )} matched 0 slots`;
    let errorMessage = logMessage;

    if (pattern.matchesGroup || slotGroupRef) {
      if (stage) {
        const base = `Pattern ${getPatternDescription(pattern)} matched 0 slots`;
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
      const hadMatcherAtStart = hasMatcher(pattern);
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
            logger: this.#logger,
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
        const deps = {
          dataRegistry: this.#dataRegistry,
          slotGenerator: this.#slotGenerator,
          logger: this.#logger,
        };
        filteredSlotKeys = applyExclusions(
          filteredSlotKeys,
          pattern.exclude,
          blueprint,
          deps
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
      const patternDesc = getPatternDescription(pattern);

      for (const slotKey of filteredSlotKeys) {
        // Skip if explicitly defined in recipe slots (explicit definitions take precedence)
        if (expandedSlots[slotKey]) {
          // Only log override if pattern still has an active matcher
          if (hadMatcherAtStart && hasMatcher(pattern)) {
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

        if (
          Object.prototype.hasOwnProperty.call(
            blueprintAdditionalSlots,
            slotKey
          )
        ) {
          // Only log override if pattern still has an active matcher
          if (hadMatcherAtStart && hasMatcher(pattern)) {
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
          properties: pattern.properties
            ? { ...pattern.properties }
            : undefined,
        };
      }

      const hasMatcherAtEnd = hasMatcher(pattern);
      if (!hasMatcherAtEnd && !patternHints.includes(defaultMatcherHint)) {
        patternHints.push(defaultMatcherHint);
      }
    }

    const addedSlots =
      Object.keys(expandedSlots).length -
      Object.keys(recipe.slots || {}).length;
    this.#logger.info(
      `Pattern resolution added ${addedSlots} slot definitions`
    );

    return {
      ...recipe,
      slots: expandedSlots,
      ...(patternHints.length > 0 ? { _patternHints: patternHints } : {}),
      _patternConflicts: patternConflicts,
    };
  }
}

export default RecipePatternResolver;
