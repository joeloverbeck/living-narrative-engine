import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import {
  extractSocketsFromEntity,
  extractHierarchicalSockets,
} from '../socketExtractor.js';
import { levenshteinDistance } from '../../../utils/stringUtils.js';
import { createValidatorLogger } from '../utils/validatorLoggingUtils.js';

/** @typedef {import('../../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */

/**
 * @file SocketSlotCompatibilityValidator - ensures blueprint slots reference valid sockets.
 * @see ../../../docs/anatomy/blueprints-and-recipes.md for socket anatomy documentation.
 */

/**
 * Finds similar socket name using string similarity.
 *
 * @param {string} requested - Requested socket name.
 * @param {Array<string>} available - Available socket names.
 * @returns {string|null} Most similar socket name or null.
 */
function findSimilarSocketName(requested, available) {
  if (!requested || available.length === 0) {
    return null;
  }

  let closest = null;
  let minDistance = Infinity;

  for (const socket of available) {
    const distance = levenshteinDistance(
      requested.toLowerCase(),
      socket.toLowerCase()
    );

    if (distance < minDistance && distance <= 3) {
      minDistance = distance;
      closest = socket;
    }
  }

  return closest;
}

/**
 * Builds a best-effort entity definition path for user-facing error messages.
 *
 * @param {string} rootEntityId - Root entity identifier.
 * @returns {string} Path hint for the entity definition file.
 */
function buildEntityDefinitionPath(rootEntityId) {
  if (typeof rootEntityId !== 'string' || rootEntityId.length === 0) {
    return 'data/mods/*/entities/definitions/unknown.entity.json';
  }

  const parts = rootEntityId.split(':');
  const fileId = parts.length > 1 ? parts[1] : parts[0];
  return `data/mods/*/entities/definitions/${fileId}.entity.json`;
}

/**
 * Suggests how to fix socket mismatch.
 *
 * @param {string} requestedSocket - Socket ID that was requested.
 * @param {Map<string, object>} availableSockets - Available sockets on entity.
 * @param {string} rootEntityId - Root entity ID.
 * @param {string} [entitySourceFile] - Source filename of entity (optional).
 * @returns {string} Fix suggestion.
 */
function suggestSocketFix(
  requestedSocket,
  availableSockets,
  rootEntityId,
  entitySourceFile
) {
  const sourceFile = entitySourceFile || buildEntityDefinitionPath(rootEntityId);

  if (!availableSockets || availableSockets.size === 0) {
    return `Root entity has no sockets. Add anatomy:sockets component to entity file: ${sourceFile}`;
  }

  const socketList = Array.from(availableSockets.keys());
  const similar = findSimilarSocketName(requestedSocket, socketList);

  if (similar) {
    return `Socket '${requestedSocket}' not found. Did you mean '${similar}'? Available: [${socketList.join(', ')}]`;
  }

  return `Add socket '${requestedSocket}' to entity file '${sourceFile}' or use one of: [${socketList.join(', ')}]`;
}

/**
 * Validates structure template socket compatibility (DEPRECATED - now handled hierarchically).
 * This function is kept for backward compatibility but returns empty array.
 * Hierarchical validation now happens in validateSocketSlotCompatibility.
 *
 * @param {object} _blueprint - Blueprint definition.
 * @param {Map<string, object>} _availableSockets - Available sockets map.
 * @param {object} _rootEntity - Root entity definition.
 * @returns {Array<object>} Empty list (validation moved to hierarchical approach).
 * @deprecated Use extractHierarchicalSockets instead
 */
function validateStructureTemplateSockets(
  _blueprint,
  _availableSockets,
  _rootEntity
) {
  // Validation now happens in validateSocketSlotCompatibility via extractHierarchicalSockets
  return [];
}

/**
 * Resolves the root entity definition from the registry regardless of API variant.
 *
 * @param {IDataRegistry|object} dataRegistry - Registry used during validation.
 * @param {string} entityId - Identifier of the root entity.
 * @returns {object|undefined} Matching entity definition if found.
 */
function getRootEntityDefinition(dataRegistry, entityId) {
  if (!dataRegistry) {
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

/**
 * Validates additionalSlots against available sockets for a blueprint/root entity pair.
 * Supports hierarchical socket architecture where sockets can exist on:
 * - Root entity (direct attachments)
 * - Structure template generated parts (limbs, head, tail with nested sockets)
 *
 * @param {object} blueprint - Blueprint definition being validated.
 * @param {IDataRegistry|object} dataRegistry - Registry for entity lookups.
 * @returns {Promise<Array<object>>} Validation errors.
 */
export async function validateSocketSlotCompatibility(blueprint, dataRegistry) {
  const errors = [];

  if (!blueprint || !dataRegistry) {
    return errors;
  }

  const rootEntity = getRootEntityDefinition(dataRegistry, blueprint.root);

  if (!rootEntity) {
    errors.push({
      type: 'ROOT_ENTITY_NOT_FOUND',
      severity: 'error',
      blueprintId: blueprint.id,
      rootEntityId: blueprint.root,
      message: `Root entity '${blueprint.root}' not found`,
      fix: `Create entity at ${buildEntityDefinitionPath(blueprint.root)}`,
    });
    return errors;
  }

  // Get structure template if exists
  let structureTemplate = null;
  if (blueprint.structureTemplate) {
    structureTemplate = await getStructureTemplate(
      dataRegistry,
      blueprint.structureTemplate
    );
  }

  // Extract hierarchical sockets (root + structure template generated parts)
  const hierarchicalSockets = await extractHierarchicalSockets(
    blueprint,
    rootEntity,
    structureTemplate,
    dataRegistry
  );

  // Combine both older `slots` format and newer `additionalSlots` format
  // This ensures validation coverage for both blueprint versions
  const allSlots = {
    ...(blueprint?.slots || {}),
    ...(blueprint?.additionalSlots || {}),
  };

  for (const [slotName, slotConfig] of Object.entries(allSlots)) {
    if (!slotConfig || typeof slotConfig !== 'object') {
      continue;
    }

    if (!slotConfig.socket) {
      errors.push({
        type: 'MISSING_SOCKET_REFERENCE',
        severity: 'error',
        blueprintId: blueprint.id,
        slotName,
        message: `Slot '${slotName}' has no socket reference`,
        fix: `Add "socket" property to additionalSlots.${slotName}`,
      });
      continue;
    }

    // Check if socket exists in hierarchical socket map
    if (hierarchicalSockets.has(slotConfig.socket) || slotConfig.optional === true) {
      continue;
    }

    // Socket not found - check if it has a parent reference
    if (slotConfig.parent) {
      errors.push({
        type: 'SOCKET_NOT_FOUND_ON_PARENT',
        severity: 'error',
        blueprintId: blueprint.id,
        slotName,
        socketId: slotConfig.socket,
        parentSlot: slotConfig.parent,
        rootEntityId: blueprint.root,
        availableSockets: Array.from(hierarchicalSockets.keys()),
        message: `Socket '${slotConfig.socket}' not found on parent slot '${slotConfig.parent}'`,
        fix: suggestHierarchicalSocketFix(
          slotConfig.socket,
          slotConfig.parent,
          hierarchicalSockets,
          blueprint
        ),
      });
    } else {
      // No parent - socket should be on root entity
      const rootSockets = extractSocketsFromEntity(rootEntity);
      errors.push({
        type: 'SOCKET_NOT_FOUND',
        severity: 'error',
        blueprintId: blueprint.id,
        slotName,
        socketId: slotConfig.socket,
        rootEntityId: blueprint.root,
        availableSockets: Array.from(rootSockets.keys()),
        message: `Socket '${slotConfig.socket}' not found on root entity '${blueprint.root}'`,
        fix: suggestSocketFix(
          slotConfig.socket,
          rootSockets,
          blueprint.root,
          rootEntity?._sourceFile
        ),
      });
    }
  }

  return errors;
}

/**
 * Gets structure template definition from registry.
 *
 * @param {object} dataRegistry - Data registry
 * @param {string} templateId - Structure template ID
 * @returns {Promise<object|undefined>} Structure template if found
 * @private
 */
async function getStructureTemplate(dataRegistry, templateId) {
  if (!dataRegistry) {
    return undefined;
  }

  // Try the correct registry key
  if (typeof dataRegistry.get === 'function') {
    return dataRegistry.get('anatomyStructureTemplates', templateId);
  }

  return undefined;
}

/**
 * Suggests fix for hierarchical socket issues (parent-child relationships).
 *
 * @param {string} requestedSocket - Socket ID that was requested
 * @param {string} parentSlot - Parent slot name
 * @param {Map<string, object>} hierarchicalSockets - All available sockets
 * @param {object} blueprint - Blueprint definition
 * @returns {string} Fix suggestion
 * @private
 */
function suggestHierarchicalSocketFix(
  requestedSocket,
  parentSlot,
  hierarchicalSockets,
  blueprint
) {
  // Find sockets with matching parent
  const parentSockets = Array.from(hierarchicalSockets.values())
    .filter((s) => s.parent === parentSlot)
    .map((s) => s.id);

  if (parentSockets.length === 0) {
    return `Parent slot '${parentSlot}' not found in structure template. Verify structure template '${blueprint.structureTemplate}' generates slot '${parentSlot}'`;
  }

  const similar = findSimilarSocketName(requestedSocket, parentSockets);

  if (similar) {
    return `Socket '${requestedSocket}' not found on parent '${parentSlot}'. Did you mean '${similar}'? Available on parent: [${parentSockets.join(', ')}]`;
  }

  return `Add socket '${requestedSocket}' to parent entity or use one of: [${parentSockets.join(', ')}]`;
}

/**
 * Validates that blueprint additionalSlots reference valid sockets on the root entity.
 */
export class SocketSlotCompatibilityValidator extends BaseValidator {
  #dataRegistry;
  #anatomyBlueprintRepository;
  #logger;
  #logValidatorError;

  /**
   * Creates a socket/slot compatibility validator instance.
   *
   * @param {object} params - Constructor parameters.
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger implementation.
   * @param {import('../../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry - Data registry service.
   * @param {import('../../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} params.anatomyBlueprintRepository - Blueprint repository.
   */
  constructor({ logger, dataRegistry, anatomyBlueprintRepository }) {
    super({
      name: 'socket-slot-compatibility',
      priority: 20,
      failFast: false,
      logger,
    });

    const hasEntityDefinitionLookup =
      typeof dataRegistry?.getEntityDefinition === 'function';
    const hasLegacyLookup = typeof dataRegistry?.get === 'function';

    if (hasEntityDefinitionLookup) {
      validateDependency(dataRegistry, 'IDataRegistry', logger, {
        requiredMethods: ['getEntityDefinition'],
      });
    } else if (hasLegacyLookup) {
      validateDependency(dataRegistry, 'IDataRegistry', logger, {
        requiredMethods: ['get'],
      });
    } else {
      throw new Error(
        'SocketSlotCompatibilityValidator requires IDataRegistry with getEntityDefinition() or get() method'
      );
    }

    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      logger,
      {
        requiredMethods: ['getBlueprint'],
      }
    );

    this.#dataRegistry = dataRegistry;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#logger = logger;
    this.#logValidatorError = createValidatorLogger({
      logger,
      validatorName: this.name,
    });
  }

  /**
   * Executes socket-slot validation logic.
   *
   * @param {object} recipe - Recipe undergoing validation.
   * @param {object} _options - Validation options (unused placeholder).
   * @param {import('../core/ValidationResultBuilder.js').default} builder - Validation result builder.
   * @returns {Promise<void>}
   */
  async performValidation(recipe, _options, builder) {
    try {
      const blueprintId = recipe?.blueprintId;
      const blueprint = await this.#anatomyBlueprintRepository.getBlueprint(
        blueprintId
      );

      if (!blueprint) {
        return;
      }

      const issues = await validateSocketSlotCompatibility(
        blueprint,
        this.#dataRegistry
      );

      if (issues.length === 0) {
        const slotsCount = Object.keys(blueprint?.slots || {}).length;
        const additionalSlotsCount = Object.keys(
          blueprint?.additionalSlots || {}
        ).length;
        const totalCount = slotsCount + additionalSlotsCount;
        builder.addPassed(
          `All ${totalCount} slot socket references valid`,
          { check: 'socket_slot_compatibility' }
        );
      } else {
        builder.addIssues(issues);
      }
    } catch (error) {
      this.#logValidatorError(error);
      builder.addWarning(
        'VALIDATION_WARNING',
        'Failed to validate socket/slot compatibility',
        {
          check: 'socket_slot_compatibility',
          error: error.message,
        }
      );
    }
  }

}

export const __testables__ = {
  findSimilarSocketName,
  suggestSocketFix,
  validateStructureTemplateSockets,
  getRootEntityDefinition,
};
