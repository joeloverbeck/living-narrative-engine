/**
 * @file PatternMatchingValidator - Dry-run matcher validator for recipe patterns.
 */

import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureBlueprintProcessed } from '../utils/blueprintProcessingUtils.js';
import { resolveSlotGroup } from '../../recipePatternResolver/matchers/groupMatcher.js';
import { resolveWildcardPattern } from '../../recipePatternResolver/matchers/wildcardMatcher.js';
import { resolvePropertyFilter } from '../../recipePatternResolver/matchers/propertyMatcher.js';
import { createValidatorLogger } from '../utils/validatorLoggingUtils.js';

const PATTERN_CHECK_NAME = 'pattern_matching';

/**
 * @description Validates recipe patterns by performing a dry-run of the pattern matching logic.
 *
 * Priority: 35 (warning-level validator)
 * Fail Fast: false (collects all pattern issues)
 */
export class PatternMatchingValidator extends BaseValidator {
  #dataRegistry;
  #slotGenerator;
  #anatomyBlueprintRepository;
  #logger;
  #logValidatorError;

  /**
   * @description Creates a new pattern matching validator instance.
   * @param {object} params - Constructor parameters.
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger implementation.
   * @param {import('../../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry - Data registry for templates.
   * @param {import('../../slotGenerator.js').default} params.slotGenerator - Slot generator service.
   * @param {import('../../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} params.anatomyBlueprintRepository - Blueprint repository.
   */
  constructor({ logger, dataRegistry, slotGenerator, anatomyBlueprintRepository }) {
    super({
      name: 'pattern-matching',
      priority: 35,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });

    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: [
        'extractSlotKeysFromLimbSet',
        'extractSlotKeysFromAppendage',
        'generateBlueprintSlots',
      ],
    });

    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      logger,
      {
        requiredMethods: ['getBlueprint'],
      }
    );

    this.#dataRegistry = dataRegistry;
    this.#slotGenerator = slotGenerator;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#logger = logger;
    this.#logValidatorError = createValidatorLogger({
      logger,
      validatorName: this.name,
    });
  }

  /**
   * @description Executes pattern matching validation for the provided recipe.
   * @param {object} recipe - Recipe definition containing patterns.
   * @param {object} _options - Validation options (unused placeholder).
   * @param {import('../core/ValidationResultBuilder.js').default} builder - Result builder instance.
   * @returns {Promise<void>} Resolves when validation completes.
   */
  async performValidation(recipe, _options, builder) {
    try {
      const patterns = recipe?.patterns || [];

      if (patterns.length === 0) {
        builder.addPassed('No patterns to validate', { check: PATTERN_CHECK_NAME });
        return;
      }

      const blueprintId = recipe?.blueprintId;
      const rawBlueprint = await this.#anatomyBlueprintRepository.getBlueprint(
        blueprintId
      );

      if (!rawBlueprint) {
        this.#logger.warn(
          `PatternMatchingValidator: Blueprint '${blueprintId}' not found, skipping pattern validation`
        );
        return;
      }

      const processedBlueprint = await ensureBlueprintProcessed({
        blueprint: rawBlueprint,
        dataRegistry: this.#dataRegistry,
        slotGenerator: this.#slotGenerator,
        logger: this.#logger,
      });

      if (!processedBlueprint) {
        this.#logger.warn(
          `PatternMatchingValidator: Processed blueprint is null for '${blueprintId}', skipping`
        );
        return;
      }

      const warnings = validatePatternMatching(
        recipe,
        processedBlueprint,
        this.#dataRegistry,
        this.#slotGenerator,
        this.#logger
      );

      if (warnings.length === 0) {
        builder.addPassed(
          `All ${patterns.length} pattern(s) have matching slots`,
          { check: PATTERN_CHECK_NAME }
        );
        return;
      }

      for (const warning of warnings) {
        builder.addWarning(warning.type, warning.message, {
          location: warning.location,
          pattern: warning.pattern,
          matcher: warning.matcher,
          availableSlots: warning.availableSlots,
          reason: warning.reason,
          fix: warning.fix,
        });
      }
    } catch (error) {
      this.#logValidatorError(error);
      builder.addWarning('VALIDATION_WARNING', 'Pattern matching check failed', {
        check: PATTERN_CHECK_NAME,
        error: error.message,
      });
    }
  }
}

/**
 * @description Validates that recipe patterns have matching slots (dry-run).
 * @param {object} recipe - Recipe to validate.
 * @param {object} blueprint - Blueprint with slots from structure template.
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} dataRegistry - Data registry for templates.
 * @param {import('../../slotGenerator.js').default} slotGenerator - Slot generator for matcher helpers.
 * @param {import('../../../interfaces/coreServices.js').ILogger} logger - Logger instance.
 * @returns {Array<object>} Array of warnings for zero-match patterns.
 */
export function validatePatternMatching(
  recipe,
  blueprint,
  dataRegistry,
  slotGenerator,
  logger
) {
  const warnings = [];
  const patterns = recipe?.patterns || [];

  if (patterns.length === 0) {
    return warnings;
  }

  logger.debug(
    `Pattern matching dry-run: validating ${patterns.length} pattern(s)`
  );

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const patternDesc = getPatternDescription(pattern);

    const result = findMatchingSlots(
      pattern,
      blueprint,
      dataRegistry,
      slotGenerator,
      logger
    );

    if (result.matches.length === 0) {
      warnings.push({
        type: 'NO_MATCHING_SLOTS',
        location: { type: 'pattern', description: patternDesc, index: i },
        pattern,
        matcher: extractMatcherInfo(pattern),
        availableSlots: result.availableSlots,
        message: `Pattern ${patternDesc} has no matching slots`,
        reason: identifyBlockingMatcher(pattern, result, blueprint),
        fix: suggestPatternFix(pattern, result, blueprint),
        severity: 'warning',
      });
    } else {
      logger.debug(
        `Pattern ${patternDesc} matched ${result.matches.length} slot(s)`
      );
    }
  }

  return warnings;
}

/**
 * @description Finds slots matching pattern matchers.
 * @param {object} pattern - Pattern definition (v1 or v2).
 * @param {object} blueprint - Blueprint with slots.
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} dataRegistry - Data registry for templates.
 * @param {import('../../slotGenerator.js').default} slotGenerator - Slot generator instance.
 * @param {import('../../../interfaces/coreServices.js').ILogger} logger - Logger instance.
 * @returns {object} Match results with available slots info.
 */
export function findMatchingSlots(
  pattern,
  blueprint,
  dataRegistry,
  slotGenerator,
  logger
) {
  const matches = [];
  const blueprintSlots = blueprint?.slots || {};
  const blueprintSlotKeys = Object.keys(blueprintSlots);

  if (Array.isArray(pattern?.matches)) {
    for (const slotKey of pattern.matches) {
      if (blueprintSlots[slotKey]) {
        matches.push(slotKey);
      }
    }
    return {
      matches,
      availableSlots: blueprintSlotKeys,
      matcherType: 'v1_explicit',
    };
  }

  if (pattern?.matchesGroup) {
    try {
      const deps = { dataRegistry, slotGenerator, logger };
      const resolvedSlots = resolveSlotGroup(
        pattern.matchesGroup,
        blueprint,
        { throwOnZeroMatches: false, allowMissing: true },
        deps
      );
      matches.push(...resolvedSlots);
    } catch (error) {
      logger.debug(
        `matchesGroup '${pattern.matchesGroup}' resolution failed: ${error.message}`
      );
    }
    return {
      matches,
      availableSlots: blueprintSlotKeys,
      matcherType: 'matchesGroup',
      matcherValue: pattern.matchesGroup,
    };
  }

  if (pattern?.matchesPattern !== undefined) {
    const matchedSlots = resolveWildcardPattern(
      pattern.matchesPattern,
      blueprintSlotKeys,
      logger
    );
    matches.push(...matchedSlots);
    return {
      matches,
      availableSlots: blueprintSlotKeys,
      matcherType: 'matchesPattern',
      matcherValue: pattern.matchesPattern,
    };
  }

  if (pattern?.matchesAll) {
    const matchedSlots = resolvePropertyFilter(
      pattern.matchesAll,
      blueprintSlots,
      logger
    );
    matches.push(...matchedSlots);
    return {
      matches,
      availableSlots: blueprintSlotKeys,
      matcherType: 'matchesAll',
      matcherValue: pattern.matchesAll,
    };
  }

  return {
    matches: [],
    availableSlots: blueprintSlotKeys,
    matcherType: 'none',
  };
}

/**
 * @description Helper to get pattern description for logging.
 * @param {object} pattern - Pattern definition.
 * @returns {string} Human-readable pattern description.
 */
export function getPatternDescription(pattern) {
  if (pattern?.matchesGroup) return `matchesGroup '${pattern.matchesGroup}'`;
  if (pattern?.matchesPattern !== undefined)
    return `matchesPattern '${pattern.matchesPattern}'`;
  if (pattern?.matchesAll)
    return `matchesAll ${JSON.stringify(pattern.matchesAll)}`;
  if (Array.isArray(pattern?.matches))
    return `explicit matches [${pattern.matches.join(', ')}]`;
  return 'no matcher defined';
}

/**
 * @description Extracts matcher information for display.
 * @param {object} pattern - Pattern definition.
 * @returns {object} Formatted matcher info.
 */
export function extractMatcherInfo(pattern) {
  if (pattern?.matchesGroup) {
    return { type: 'matchesGroup', value: pattern.matchesGroup };
  }
  if (pattern?.matchesPattern !== undefined) {
    return { type: 'matchesPattern', value: pattern.matchesPattern };
  }
  if (pattern?.matchesAll) {
    return { type: 'matchesAll', value: pattern.matchesAll };
  }
  if (Array.isArray(pattern?.matches)) {
    return { type: 'v1_explicit', value: pattern.matches };
  }
  return { type: 'none', value: null };
}

/**
 * @description Identifies which matcher is blocking slot matches.
 * @param {object} pattern - Pattern definition.
 * @param {object} result - Match result from findMatchingSlots.
 * @param {object} blueprint - Blueprint being validated.
 * @returns {string} Description of blocking matcher.
 */
export function identifyBlockingMatcher(pattern, result, blueprint) {
  const { matcherType, matcherValue, availableSlots } = result;

  if (matcherType === 'none') {
    return 'No matcher defined (requires matchesGroup, matchesPattern, matchesAll, or matches array)';
  }

  if (matcherType === 'matchesGroup') {
    const templateId = blueprint?.structureTemplate || 'unknown template';
    return `Slot group '${matcherValue}' not found in structure template '${templateId}' or produced 0 slots`;
  }

  if (matcherType === 'matchesPattern') {
    if (availableSlots.length === 0) {
      return `Blueprint has no slots defined`;
    }
    return `Pattern '${matcherValue}' does not match any of ${availableSlots.length} available slot keys`;
  }

  if (matcherType === 'matchesAll') {
    const filterStr = JSON.stringify(matcherValue);
    return `Property filter ${filterStr} does not match any blueprint slots`;
  }

  if (matcherType === 'v1_explicit') {
    return `None of the explicit slot keys ${JSON.stringify(matcherValue)} exist in blueprint`;
  }

  return 'Unknown matcher blocking issue';
}

/**
 * @description Suggests how to fix pattern matching issue.
 * @param {object} pattern - Pattern definition.
 * @param {object} result - Match result from findMatchingSlots.
 * @param {object} blueprint - Blueprint being validated.
 * @returns {string} Fix suggestion.
 */
export function suggestPatternFix(pattern, result, blueprint) {
  const { matcherType, matcherValue, availableSlots } = result;

  if (matcherType === 'none') {
    return 'Add a matcher property: matchesGroup (e.g., "limbSet:leg"), matchesPattern (e.g., "leg_*"), matchesAll, or matches array';
  }

  if (matcherType === 'matchesGroup') {
    const [groupType, groupId] = matcherValue.split(':');
    const templateId = blueprint?.structureTemplate || 'unknown template';
    return `Add ${groupType} with type '${groupId}' to structure template '${templateId}' topology, or use a different slot group`;
  }

  if (matcherType === 'matchesPattern') {
    if (availableSlots.length === 0) {
      return 'Blueprint has no slots - verify blueprint has structureTemplate with limbSets/appendages';
    }
    const suggestions = availableSlots.slice(0, 5).join(', ');
    return `Adjust pattern to match available slots. Available: ${suggestions}${
      availableSlots.length > 5 ? '...' : ''
    }`;
  }

  if (matcherType === 'matchesAll') {
    return `Adjust property filter criteria or add slots to blueprint that match the filter`;
  }

  if (matcherType === 'v1_explicit') {
    const available = availableSlots.slice(0, 5).join(', ');
    return `Update matches array to use existing slot keys. Available: ${available}${
      availableSlots.length > 5 ? '...' : ''
    }`;
  }

  return 'Adjust pattern matcher or update blueprint structure';
}
