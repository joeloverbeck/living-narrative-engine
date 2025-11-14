import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { extractSocketsFromEntity } from '../socketExtractor.js';
import { levenshteinDistance } from '../../../utils/stringUtils.js';

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
 * Suggests how to fix socket mismatch.
 *
 * @param {string} requestedSocket - Socket ID that was requested.
 * @param {Map<string, object>} availableSockets - Available sockets on entity.
 * @param {string} rootEntityId - Root entity ID.
 * @param {string} [entitySourceFile] - Source filename of entity (optional).
 * @returns {string} Fix suggestion.
 */
function buildEntityDefinitionPath(rootEntityId) {
  if (typeof rootEntityId !== 'string' || rootEntityId.length === 0) {
    return 'data/mods/*/entities/definitions/unknown.entity.json';
  }

  const parts = rootEntityId.split(':');
  const fileId = parts.length > 1 ? parts[1] : parts[0];
  return `data/mods/*/entities/definitions/${fileId}.entity.json`;
}

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

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getEntityDefinition'],
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

      const rootEntity = this.#dataRegistry.getEntityDefinition(blueprint.root);

      if (!rootEntity) {
        builder.addError(
          'ROOT_ENTITY_NOT_FOUND',
          `Root entity '${blueprint.root}' not found`,
          {
            blueprintId: blueprint.id,
            rootEntityId: blueprint.root,
            fix: `Create entity at ${buildEntityDefinitionPath(blueprint.root)}`,
          }
        );
        return;
      }

      const sockets = extractSocketsFromEntity(rootEntity);
      const issues = this.#validateAdditionalSlots(
        blueprint,
        sockets,
        rootEntity
      );

      if (blueprint.structureTemplate) {
        issues.push(
          ...validateStructureTemplateSockets(blueprint, sockets, rootEntity)
        );
      }

      if (issues.length === 0) {
        builder.addPassed(
          `All ${this.#countAdditionalSlots(
            blueprint
          )} additionalSlot socket references valid`,
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

  /**
   * Counts blueprint additional slots.
   *
   * @param {object} blueprint - Blueprint definition.
   * @returns {number} Total additional slot count.
   * @private
   */
  #countAdditionalSlots(blueprint) {
    return Object.keys(blueprint?.additionalSlots || {}).length;
  }

  /**
   * Validates additionalSlots against available sockets.
   *
   * @param {object} blueprint - Blueprint definition.
   * @param {Map<string, object>} sockets - Available sockets map.
   * @param {object} rootEntity - Root entity definition.
   * @returns {Array<object>} Validation issues.
   * @private
   */
  #validateAdditionalSlots(blueprint, sockets, rootEntity) {
    const issues = [];
    const additionalSlots = blueprint?.additionalSlots || {};

    for (const [slotName, slotConfig] of Object.entries(additionalSlots)) {
      if (!slotConfig || typeof slotConfig !== 'object') {
        continue;
      }

      if (!slotConfig.socket) {
        issues.push({
          type: 'MISSING_SOCKET_REFERENCE',
          severity: 'error',
          blueprintId: blueprint.id,
          slotName,
          message: `Slot '${slotName}' has no socket reference`,
          fix: `Add "socket" property to additionalSlots.${slotName}`,
        });
        continue;
      }

      if (sockets.has(slotConfig.socket)) {
        continue;
      }

      if (slotConfig.optional === true) {
        continue;
      }

      issues.push({
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

    return issues;
  }
}

export const __testables__ = {
  findSimilarSocketName,
  suggestSocketFix,
  validateStructureTemplateSockets,
};
