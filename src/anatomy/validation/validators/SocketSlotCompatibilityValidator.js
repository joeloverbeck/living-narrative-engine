import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { extractSocketsFromEntity } from '../socketExtractor.js';
import { levenshteinDistance } from '../../../utils/stringUtils.js';

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
 * Placeholder for structure template socket validation.
 *
 * @param {object} _blueprint - Blueprint definition.
 * @param {Map<string, object>} _availableSockets - Available sockets map.
 * @param {object} _rootEntity - Root entity definition.
 * @returns {Array<object>} Currently empty list of issues.
 */
function validateStructureTemplateSockets(
  _blueprint,
  _availableSockets,
  _rootEntity
) {
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

  const sockets = extractSocketsFromEntity(rootEntity);
  const additionalSlots = blueprint?.additionalSlots || {};

  for (const [slotName, slotConfig] of Object.entries(additionalSlots)) {
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

    if (sockets.has(slotConfig.socket) || slotConfig.optional === true) {
      continue;
    }

    errors.push({
      type: 'SOCKET_NOT_FOUND',
      severity: 'error',
      blueprintId: blueprint.id,
      slotName,
      socketId: slotConfig.socket,
      rootEntityId: blueprint.root,
      availableSockets: Array.from(sockets.keys()),
      message: `Socket '${slotConfig.socket}' not found on root entity '${blueprint.root}'`,
      fix: suggestSocketFix(
        slotConfig.socket,
        sockets,
        blueprint.root,
        rootEntity?._sourceFile
      ),
    });
  }

  if (blueprint.structureTemplate) {
    errors.push(
      ...validateStructureTemplateSockets(blueprint, sockets, rootEntity)
    );
  }

  return errors;
}

/**
 * Validates that blueprint additionalSlots reference valid sockets on the root entity.
 */
export class SocketSlotCompatibilityValidator extends BaseValidator {
  #dataRegistry;
  #anatomyBlueprintRepository;
  #logger;

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
        const slotCount = Object.keys(blueprint?.additionalSlots || {}).length;
        builder.addPassed(
          `All ${slotCount} additionalSlot socket references valid`,
          { check: 'socket_slot_compatibility' }
        );
      } else {
        builder.addIssues(issues);
      }
    } catch (error) {
      this.#logger.error('Socket/slot compatibility check failed', error);
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
