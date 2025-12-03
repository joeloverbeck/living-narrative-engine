import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { extractSocketsFromEntity } from '../socketExtractor.js';
import { ensureBlueprintProcessed } from '../utils/blueprintProcessingUtils.js';
import { findMatchingSlots } from './PatternMatchingValidator.js';
import { createValidatorLogger } from '../utils/validatorLoggingUtils.js';

const CHECK_NAME = 'preferred_part_sockets';

function addPreferredId(targetMap, slotName, preferId) {
  if (!slotName || !preferId) {
    return;
  }

  const normalizedSlot = String(slotName).trim();
  if (!normalizedSlot) {
    return;
  }

  if (!targetMap.has(normalizedSlot)) {
    targetMap.set(normalizedSlot, new Set());
  }

  targetMap.get(normalizedSlot).add(preferId);
}

function buildParentSocketRequirements(blueprint) {
  const parentRequirements = new Map();
  const allSlots = {
    ...(blueprint?.slots || {}),
    ...(blueprint?.additionalSlots || {}),
  };

  for (const slotConfig of Object.values(allSlots)) {
    if (!slotConfig || typeof slotConfig !== 'object') {
      continue;
    }

    if (!slotConfig.parent || !slotConfig.socket || slotConfig.optional === true) {
      continue;
    }

    const parentSlot = slotConfig.parent;
    if (!parentRequirements.has(parentSlot)) {
      parentRequirements.set(parentSlot, new Set());
    }

    parentRequirements.get(parentSlot).add(slotConfig.socket);
  }

  return parentRequirements;
}

function collectPreferredIds(recipe, blueprint, dataRegistry, slotGenerator, logger) {
  const preferred = new Map();

  const slots = recipe?.slots || {};
  for (const [slotName, slotConfig] of Object.entries(slots)) {
    if (slotConfig?.preferId) {
      addPreferredId(preferred, slotName, slotConfig.preferId);
    }
  }

  const patterns = recipe?.patterns || [];
  for (const pattern of patterns) {
    if (!pattern?.preferId) {
      continue;
    }

    const explicitMatches = Array.isArray(pattern.matches)
      ? pattern.matches.filter((slot) => typeof slot === 'string')
      : [];

    for (const slotName of explicitMatches) {
      addPreferredId(preferred, slotName, pattern.preferId);
    }

    if (pattern.matchesPattern) {
      const matchResult = findMatchingSlots(
        pattern,
        blueprint,
        dataRegistry,
        slotGenerator,
        logger
      );
      for (const slotName of matchResult.matches || []) {
        addPreferredId(preferred, slotName, pattern.preferId);
      }
    }
  }

  return preferred;
}

function getEntityDefinition(dataRegistry, entityId) {
  if (!dataRegistry || !entityId) {
    return undefined;
  }

  if (typeof dataRegistry.getEntityDefinition === 'function') {
    return dataRegistry.getEntityDefinition(entityId);
  }

  if (typeof dataRegistry.get === 'function') {
    return dataRegistry.get('entityDefinitions', entityId);
  }

  return undefined;
}

export class PreferredPartSocketValidator extends BaseValidator {
  #dataRegistry;
  #slotGenerator;
  #anatomyBlueprintRepository;
  #logger;
  #logValidatorError;

  constructor({ logger, dataRegistry, slotGenerator, anatomyBlueprintRepository }) {
    super({
      name: 'preferred-part-sockets',
      priority: 23,
      failFast: false,
      logger,
    });

    const hasEntityLookup =
      typeof dataRegistry?.getEntityDefinition === 'function' ||
      typeof dataRegistry?.get === 'function';

    if (!hasEntityLookup) {
      throw new Error(
        'PreferredPartSocketValidator requires IDataRegistry with getEntityDefinition() or get() method'
      );
    }

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

  async performValidation(recipe, _options, builder) {
    try {
      const blueprintId = recipe?.blueprintId;
      const rawBlueprint = await this.#anatomyBlueprintRepository.getBlueprint(
        blueprintId
      );

      if (!rawBlueprint) {
        this.#logger.warn(
          `PreferredPartSocketValidator: Blueprint '${blueprintId}' not found, skipping preferred part socket validation`
        );
        return;
      }

      const blueprint = await ensureBlueprintProcessed({
        blueprint: rawBlueprint,
        dataRegistry: this.#dataRegistry,
        slotGenerator: this.#slotGenerator,
        logger: this.#logger,
      });

      if (!blueprint) {
        this.#logger.warn(
          `PreferredPartSocketValidator: Processed blueprint is null for '${blueprintId}', skipping`
        );
        return;
      }

      const parentSocketRequirements = buildParentSocketRequirements(blueprint);
      const preferredIds = collectPreferredIds(
        recipe,
        blueprint,
        this.#dataRegistry,
        this.#slotGenerator,
        this.#logger
      );

      if (preferredIds.size === 0 || parentSocketRequirements.size === 0) {
        builder.addPassed('No preferred parts with child socket requirements to validate', {
          check: CHECK_NAME,
        });
        return;
      }

      const issues = [];
      let checksPerformed = 0;

      for (const [slotName, preferIds] of preferredIds.entries()) {
        const requiredSockets = parentSocketRequirements.get(slotName);

        if (!requiredSockets || requiredSockets.size === 0) {
          continue;
        }

        for (const preferId of preferIds) {
          checksPerformed += 1;
          const entityDef = getEntityDefinition(this.#dataRegistry, preferId);

          if (!entityDef) {
            issues.push({
              type: 'PREFERRED_ENTITY_NOT_FOUND',
              severity: 'error',
              recipeId: recipe?.recipeId,
              blueprintId: blueprint.id,
              slotName,
              preferId,
              message: `Preferred entity '${preferId}' for slot '${slotName}' not found in registry`,
              fix: `Create entity definition for '${preferId}' or remove the preferId override from slot '${slotName}'.`,
            });
            continue;
          }

          const socketMap = extractSocketsFromEntity(entityDef);
          const missingSockets = Array.from(requiredSockets).filter(
            (socketId) => !socketMap.has(socketId)
          );

          if (missingSockets.length > 0) {
            issues.push({
              type: 'PREFERRED_PART_MISSING_SOCKETS',
              severity: 'error',
              recipeId: recipe?.recipeId,
              blueprintId: blueprint.id,
              slotName,
              preferId,
              missingSockets,
              requiredSockets: Array.from(requiredSockets),
              availableSockets: Array.from(socketMap.keys()),
              message: `Preferred entity '${preferId}' for slot '${slotName}' is missing socket(s) required by child slots: ${missingSockets.join(', ')}`,
              fix: `Add missing socket(s) [${missingSockets.join(', ')}] to ${preferId}.entity.json or remove/replace the preferId override on slot '${slotName}'.`,
            });
          }
        }
      }

      if (issues.length === 0) {
        builder.addPassed(
          `All ${checksPerformed} preferred part override(s) expose required child sockets`,
          { check: CHECK_NAME }
        );
        return;
      }

      builder.addIssues(issues);
    } catch (error) {
      this.#logValidatorError(error);
      builder.addWarning(
        'VALIDATION_WARNING',
        'Preferred part socket compatibility check failed',
        {
          check: CHECK_NAME,
          error: error.message,
        }
      );
    }
  }
}

export const __testables__ = {
  addPreferredId,
  buildParentSocketRequirements,
  collectPreferredIds,
  getEntityDefinition,
};
