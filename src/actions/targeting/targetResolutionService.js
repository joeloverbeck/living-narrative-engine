// src/actions/targeting/targetResolutionService.js

import { ITargetResolutionService } from '../../interfaces/ITargetResolutionService.js';
import { ResolutionStatus } from '../../types/resolutionStatus.js';
import {
  EQUIPMENT_COMPONENT_ID,
  INVENTORY_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { matchNames } from '../../utils/nameMatcher.js';
import { getEntityDisplayName } from '../../utils/entityUtils.js';
import { validateDependency } from '../../utils/validationUtils.js';
import { getAvailableExits } from '../../utils/locationUtils.js';
// import { getEntityIdsForScopes } from './entityScopeService.js'; // Import if not injected

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityScopeService.js').getEntityIdsForScopes} GetEntityIdsForScopesFn */

/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../types/actionContext.js').ActionContext} ActionContext */
/** @typedef {import('../../types/targetResolutionResult.js').TargetResolutionResult} TargetResolutionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../utils/nameMatcher.js').NameMatchCandidate} NameMatchCandidate */

/**
 * @description Options for constructing a TargetResolutionService.
 * @typedef {object} TargetResolutionServiceOptions
 * @property {IEntityManager} entityManager - The entity manager instance.
 * @property {IWorldContext} worldContext - The world context instance.
 * @property {IGameDataRepository} gameDataRepository - The game data repository instance.
 * @property {ILogger} logger - The logger instance.
 * @property {GetEntityIdsForScopesFn} getEntityIdsForScopes - Function to retrieve entity IDs for given scopes.
 */

/**
 * @description Service responsible for resolving the target of an action based on player input,
 * action definitions, and the current game state.
 * @implements {ITargetResolutionService}
 */
class TargetResolutionService extends ITargetResolutionService {
  /** @type {IEntityManager} */ #entityManager;
  /** @type {IWorldContext} */ #worldContext;
  /** @type {IGameDataRepository} */ #gameDataRepository;
  /** @type {ILogger} */ #logger;
  /** @type {GetEntityIdsForScopesFn} */ #getEntityIdsForScopes;

  // Private validation method removed in favor of centralized utility

  /**
   * @description Constructor for TargetResolutionService. It injects and validates all required dependencies.
   * The logger is validated first so it can be used for reporting issues with other dependencies.
   * @param {TargetResolutionServiceOptions} options - Configuration object containing all necessary service dependencies.
   * @throws {Error} If the logger dependency is invalid or any other critical dependency is missing or malformed.
   */
  constructor(options) {
    super();
    const {
      entityManager,
      worldContext,
      gameDataRepository,
      logger,
      getEntityIdsForScopes,
    } = options || {};

    // 1. Validate the logger dependency first using console for error reporting
    try {
      validateDependency(logger, 'TargetResolutionService: logger', console, {
        requiredMethods: ['info', 'error', 'debug', 'warn'],
      });
      this.#logger = logger;
    } catch (e) {
      const errorMsg = `TargetResolutionService Constructor: CRITICAL - Invalid or missing ILogger instance. Dependency validation utility reported: ${e.message}`;
      console.error(errorMsg); // eslint-disable-line no-console
      throw new Error(errorMsg);
    }

    // 2. Validate remaining dependencies using the validated logger
    try {
      validateDependency(
        entityManager,
        'TargetResolutionService: entityManager',
        this.#logger,
        { requiredMethods: ['getEntityInstance', 'getEntitiesInLocation'] }
      );
      validateDependency(
        worldContext,
        'TargetResolutionService: worldContext',
        this.#logger,
        {
          requiredMethods: [
            'getLocationOfEntity',
            'getCurrentActor',
            'getCurrentLocation',
          ],
        }
      );
      validateDependency(
        gameDataRepository,
        'TargetResolutionService: gameDataRepository',
        this.#logger,
        {
          requiredMethods: ['getActionDefinition', 'getAllActionDefinitions'],
        }
      );
      validateDependency(
        getEntityIdsForScopes,
        'TargetResolutionService: getEntityIdsForScopes',
        this.#logger,
        { isFunction: true }
      );
    } catch (e) {
      this.#logger.error(
        `TargetResolutionService Constructor: Dependency validation failed. Error: ${e.message}`
      );
      throw e;
    }

    this.#entityManager = entityManager;
    this.#worldContext = worldContext;
    this.#gameDataRepository = gameDataRepository;
    this.#getEntityIdsForScopes = getEntityIdsForScopes;

    this.#logger.info(
      'TargetResolutionService: Instance created and dependencies validated.'
    );
  }

  // #region Error Message Utilities
  /**
   * @description Generates "You need to specify which {itemType}..." messages.
   * @param {string} itemType - Type of item (e.g., "item", "equipped item").
   * @param {string} [domainDetails] - Optional details like "from your inventory".
   * @returns {string} Formatted error message.
   * @private
   */
  #_msgSpecifyItem(itemType, domainDetails = '') {
    let message = `You need to specify which ${itemType}`;
    if (domainDetails && domainDetails.trim() !== '') {
      message += ` ${domainDetails.trim()}`;
    }
    message += '.';
    return message;
  }

  /**
   * @description Generates "You don't have/see '{nounPhrase}'..." messages.
   * @param {string} nounPhrase - The specific item name.
   * @param {string} context - How/where it's missing (e.g., "in your inventory", "equipped", "here").
   * @param {object} [options] - Optional parameters.
   * @param {string} [options.verb] - The verb to use (e.g., "have", "see").
   * @param {boolean} [options.useAny] - Whether to prefix the nounPhrase with "any ".
   * @returns {string} Formatted error message.
   * @private
   */
  #_msgNounPhraseNotFound(
    nounPhrase,
    context,
    { verb = 'have', useAny = false } = {}
  ) {
    const anyPrefix = useAny ? 'any ' : '';
    let currentVerb = verb;
    if (context.toLowerCase() === 'here') {
      currentVerb = 'see'; // Override verb for "here" context
    }
    return `You don't ${currentVerb} ${anyPrefix}"${nounPhrase}" ${context}.`;
  }

  /**
   * @description Generates "You don't have anything like that..." messages.
   * @param {string} context - Where this applies (e.g., "in your inventory", "equipped").
   * @returns {string} Formatted error message.
   * @private
   */
  #_msgNothingOfKind(context) {
    return `You don't have anything like that ${context}.`;
  }
  // #endregion Error Message Utilities

  /**
   * @private
   * @description Gathers and prepares a list of name match candidates from a given source of entity IDs.
   * It fetches entity instances, retrieves their names, and filters them.
   * @param {function(): string[] | Set<string>} getEntityIdsFn - A function that returns entity IDs from the specific domain source.
   * @param {string} domainContextForLogging - E.g., "inventory", "equipment", "environment" (for log messages).
   * @param {string} [actorEntityIdToExclude] - Optional ID of an entity to exclude from candidates (e.g., the actor in environment).
   * @returns {Promise<NameMatchCandidate[]>} An array of valid name match candidates.
   */
  async #_gatherNameMatchCandidates(
    getEntityIdsFn,
    domainContextForLogging,
    actorEntityIdToExclude = null
  ) {
    this.#logger.debug(
      `TargetResolutionService.#_gatherNameMatchCandidates called for domain: ${domainContextForLogging}`
    );
    const entityIds = getEntityIdsFn();

    if (!entityIds || entityIds.size === 0) {
      this.#logger.debug(
        `TargetResolutionService.#_gatherNameMatchCandidates: No entity IDs provided by source for ${domainContextForLogging}.`
      );
      return [];
    }

    const candidates = [];
    for (const itemId of entityIds) {
      if (actorEntityIdToExclude && itemId === actorEntityIdToExclude) {
        this.#logger.debug(
          `TargetResolutionService.#_gatherNameMatchCandidates: Excluding entity ID '${itemId}' (actor) from domain '${domainContextForLogging}'.`
        );
        continue;
      }

      if (typeof itemId !== 'string' || !itemId) {
        this.#logger.warn(
          `TargetResolutionService.#_gatherNameMatchCandidates: Invalid (non-string or empty) entity ID encountered in ${domainContextForLogging}: ${JSON.stringify(itemId)}. Skipping.`
        );
        continue;
      }

      const itemEntity = this.#entityManager.getEntityInstance(itemId);

      if (itemEntity) {
        const name = getEntityDisplayName(
          itemEntity,
          itemEntity.id,
          this.#logger
        );
        if (name && typeof name === 'string' && name.trim() !== '') {
          candidates.push({ id: itemEntity.id, name: name });
        } else {
          this.#logger.warn(
            `TargetResolutionService.#_gatherNameMatchCandidates: Entity '${itemId}' in ${domainContextForLogging} returned no valid name from getEntityDisplayName. Skipping. Name resolved to: ${name}`
          );
        }
      } else {
        this.#logger.warn(
          `TargetResolutionService.#_gatherNameMatchCandidates: Entity '${itemId}' from ${domainContextForLogging} not found via entityManager. Skipping.`
        );
      }
    }
    this.#logger.debug(
      `TargetResolutionService.#_gatherNameMatchCandidates: Produced ${candidates.length} candidates for domain: ${domainContextForLogging}.`
    );
    return candidates;
  }

  /**
   * @private
   * @description Helper to construct a minimal ActionContext for getEntityIdsForScopes.
   * @param {Entity | null} actorEntity - The acting entity, or null.
   * @returns {ActionContext} A partial ActionContext sufficient for getEntityIdsForScopes.
   */
  #_buildMinimalContextForScopes(actorEntity) {
    let currentLocation = null;
    if (actorEntity && typeof actorEntity.id === 'string' && actorEntity.id) {
      currentLocation = this.#worldContext.getLocationOfEntity(actorEntity.id);
    } else if (
      actorEntity &&
      (typeof actorEntity.id !== 'string' || !actorEntity.id)
    ) {
      this.#logger.warn(
        `TargetResolutionService.#_buildMinimalContextForScopes: actorEntity was provided but its 'id' property is missing or invalid. actorEntity: ${JSON.stringify(actorEntity)}`
      );
    }

    return /** @type {ActionContext} */ ({
      playerEntity: actorEntity,
      actingEntity: actorEntity,
      currentLocation: currentLocation,
      entityManager: this.#entityManager,
      logger: this.#logger,
      worldContext: this.#worldContext,
      gameDataRepository: this.#gameDataRepository,
    });
  }

  /**
   * Resolves the target for a given action based on the action definition and context.
   *
   * @param {ActionDefinition} actionDefinition - The definition of the action being performed.
   * @param {ActionContext} actionContext - The context in which the action is being performed.
   * @returns {Promise<TargetResolutionResult>} A promise that resolves to the target resolution result.
   * @async
   * @override
   */
  async resolveActionTarget(actionDefinition, actionContext) {
    // --- MOVED GUARD CLAUSE UP ---
    if (!actionDefinition || !actionContext) {
      const logActionId = actionDefinition
        ? actionDefinition.id
        : 'undefined_action_definition';
      this.#logger.error(
        `TargetResolutionService.resolveActionTarget: Missing actionDefinition or actionContext. Action ID: ${logActionId}.`
      );
      return {
        status: ResolutionStatus.ERROR,
        targetType: 'none',
        targetId: null,
        error: 'Internal error: Invalid action setup.',
      };
    }
    // --- END MOVED GUARD CLAUSE ---

    // --- CORRECTED NOUNPHRASE AND ACTINGENTITY EXTRACTION (POST-GUARD) ---
    const { parsedCommand, actingEntity } = actionContext; // Destructure after actionContext is confirmed non-null
    const nounPhrase = parsedCommand ? parsedCommand.directObjectPhrase : null;
    // --- END CORRECTION ---

    this.#logger.debug(
      `TargetResolutionService.resolveActionTarget called for action: '${actionDefinition.id}', actor: '${actingEntity?.id}', noun: "${nounPhrase}"`
    );

    const { target_domain } = actionDefinition;

    // This check is now safe, as actingEntity is from a non-null actionContext (though actingEntity itself could be null)
    if (
      target_domain === 'self' ||
      target_domain === 'inventory' ||
      target_domain === 'equipment' ||
      target_domain === 'environment'
    ) {
      if (!actingEntity) {
        this.#logger.error(
          `TargetResolutionService.resolveActionTarget: Missing actingEntity for target_domain '${target_domain}' which requires an actor. Action: '${actionDefinition.id}'.`
        );
        return {
          status: ResolutionStatus.ERROR,
          targetType: 'none',
          targetId: null,
          error: `Internal error: Action '${actionDefinition.id}' requires an actor but none was provided for domain '${target_domain}'.`,
        };
      }
    }

    try {
      let result;
      const minimalContext = this.#_buildMinimalContextForScopes(actingEntity); // Handles potentially null actingEntity

      switch (target_domain) {
        case 'none':
          result = this.#_resolveNone();
          break;
        case 'self':
          result = this.#_resolveSelf(actingEntity); // actingEntity is guaranteed non-null by earlier check for 'self' domain
          break;
        case 'inventory':
          result = await this.#_resolveInventoryDomain(
            actingEntity,
            nounPhrase,
            minimalContext
          ); // actingEntity guaranteed non-null
          break;
        case 'equipment':
          result = await this.#_resolveEquipment(
            actingEntity,
            nounPhrase,
            minimalContext
          ); // actingEntity guaranteed non-null
          break;
        case 'environment':
          result = await this.#_resolveEnvironment(
            actingEntity,
            nounPhrase,
            minimalContext
          ); // actingEntity guaranteed non-null
          break;
        case 'direction':
          result = this.#_resolveDirection(nounPhrase, actingEntity); // _resolveDirection handles potentially null actingEntity for its logic
          break;
        default:
          this.#logger.warn(
            `TargetResolutionService.resolveActionTarget: Unknown target domain '${target_domain}' for action '${actionDefinition.id}'.`
          );
          result = {
            status: ResolutionStatus.NOT_FOUND,
            targetType: 'none',
            targetId: null,
            error: `Action '${actionDefinition.id}' has an unsupported target domain: ${target_domain}.`,
          };
          break;
      }
      return result;
    } catch (err) {
      this.#logger.error(
        `TargetResolutionService.resolveActionTarget: Unexpected error during target resolution for action '${actionDefinition.id}', domain '${target_domain}'. Error: ${err.message}`,
        err
      );
      return {
        status: ResolutionStatus.ERROR,
        targetType: 'none',
        targetId: null,
        error: `An unexpected internal error occurred while trying to resolve the target for action '${actionDefinition.id}'. Please contact support.`,
      };
    }
  }

  #_resolveNone() {
    this.#logger.debug('TargetResolutionService.#_resolveNone called');
    return {
      status: ResolutionStatus.NONE,
      targetType: 'none',
      targetId: null,
    };
  }

  #_resolveSelf(actorEntity) {
    this.#logger.debug(
      `TargetResolutionService.#_resolveSelf called with actorEntity: ${actorEntity?.id}`
    );
    // actingEntity is guaranteed non-null by the check in resolveActionTarget for the 'self' domain.
    // A redundant check here for actorEntity.id adds safety.
    if (!actorEntity || !actorEntity.id) {
      // Should ideally not be hit if prior checks are correct
      this.#logger.error(
        'TargetResolutionService.#_resolveSelf: actorEntity is missing or has no valid .id despite domain check.'
      );
      return {
        status: ResolutionStatus.ERROR,
        targetType: 'self',
        targetId: null,
        error:
          "Internal error: Actor not available or invalid for 'self' target.",
      };
    }
    this.#logger.debug(
      `TargetResolutionService.#_resolveSelf resolved to actor: ${actorEntity.id}`
    );
    return {
      status: ResolutionStatus.SELF,
      targetType: 'self',
      targetId: actorEntity.id,
    };
  }

  #_buildTargetResolutionResultFromMatcher(
    matcherResult,
    defaultTargetType = 'entity'
  ) {
    const trResult = {
      status: matcherResult.status,
      targetId: matcherResult.target?.id || null,
      targetType: 'none',
    };

    if (
      matcherResult.status === ResolutionStatus.FOUND_UNIQUE ||
      matcherResult.status === ResolutionStatus.AMBIGUOUS
    ) {
      trResult.targetType = defaultTargetType;
    } else if (
      matcherResult.status === ResolutionStatus.NOT_FOUND &&
      defaultTargetType === 'entity'
    ) {
      trResult.targetType = defaultTargetType;
    }

    if (matcherResult.error) {
      trResult.error = matcherResult.error;
    }

    if (
      matcherResult.status === ResolutionStatus.AMBIGUOUS &&
      matcherResult.candidates
    ) {
      trResult.candidates = matcherResult.candidates.map((c) => c.id);
    }
    return trResult;
  }

  async #_resolveInventoryDomain(actorEntity, nounPhrase, minimalContext) {
    this.#logger.debug(
      `TargetResolutionService.#_resolveInventoryDomain called for actor: '${actorEntity.id}', nounPhrase: "${nounPhrase}"`
    );
    // actorEntity is guaranteed non-null for this domain.

    const itemIdsSet = this.#getEntityIdsForScopes('inventory', minimalContext);

    if (itemIdsSet.size === 0) {
      const inventoryComponent = actorEntity.getComponentData(
        INVENTORY_COMPONENT_ID
      );
      if (!inventoryComponent) {
        this.#logger.warn(
          `TargetResolutionService.#_resolveInventoryDomain: Actor '${actorEntity.id}' is missing '${INVENTORY_COMPONENT_ID}' component (checked after getEntityIdsForScopes returned empty).`
        );
        return {
          status: ResolutionStatus.NOT_FOUND,
          targetType: 'entity',
          targetId: null,
          error: 'You are not carrying anything.',
        };
      }
      this.#logger.debug(
        `TargetResolutionService.#_resolveInventoryDomain: Actor '${actorEntity.id}' inventory is empty (getEntityIdsForScopes returned empty set).`
      );
      return {
        status: ResolutionStatus.NOT_FOUND,
        targetType: 'entity',
        targetId: null,
        error: 'Your inventory is empty.',
      };
    }

    const getEntityIdsFn = () => itemIdsSet;
    const candidates = await this.#_gatherNameMatchCandidates(
      getEntityIdsFn,
      'inventory'
    );
    const matcherResult = matchNames(candidates, nounPhrase, this.#logger);
    let finalResult = this.#_buildTargetResolutionResultFromMatcher(
      matcherResult,
      'entity'
    );

    if (finalResult.status === ResolutionStatus.NONE) {
      finalResult.error = this.#_msgSpecifyItem('item', 'from your inventory');
      finalResult.targetType = 'entity';
    } else if (finalResult.status === ResolutionStatus.NOT_FOUND) {
      finalResult.targetType = 'entity';
      if (nounPhrase && nounPhrase.trim() !== '') {
        if (candidates.length === 0 && itemIdsSet.size > 0) {
          this.#logger.debug(
            `TargetResolutionService.#_resolveInventoryDomain: No valid named item candidates found in actor '${actorEntity.id}'s inventory (original item IDs count from scope: ${itemIdsSet.size}) when searching for "${nounPhrase}".`
          );
          finalResult.error = this.#_msgNothingOfKind('in your inventory');
        } else {
          finalResult.error = this.#_msgNounPhraseNotFound(
            nounPhrase,
            'in your inventory'
          );
        }
      } else {
        this.#logger.debug(
          `TargetResolutionService.#_resolveInventoryDomain: No valid named item candidates found in actor '${actorEntity.id}'s inventory for empty nounPhrase. ItemIds count from scope: ${itemIdsSet.size}, Candidates count: ${candidates.length}`
        );
        finalResult.error = this.#_msgNothingOfKind('in your inventory');
      }
    }
    return finalResult;
  }

  async #_resolveEquipment(actorEntity, nounPhrase, minimalContext) {
    this.#logger.debug(
      `TargetResolutionService.#_resolveEquipment called for actor: ${actorEntity.id}, noun: "${nounPhrase}"`
    );
    // actorEntity is guaranteed non-null.

    const equippedItemIdsSet = this.#getEntityIdsForScopes(
      'equipment',
      minimalContext
    );

    if (equippedItemIdsSet.size === 0) {
      const equipmentComponent = actorEntity.getComponentData(
        EQUIPMENT_COMPONENT_ID
      );
      if (!equipmentComponent) {
        this.#logger.warn(
          `TargetResolutionService.#_resolveEquipment: Actor '${actorEntity.id}' is missing '${EQUIPMENT_COMPONENT_ID}' component.`
        );
        return {
          status: ResolutionStatus.NOT_FOUND,
          targetType: 'entity',
          targetId: null,
          error: 'You are not wearing or wielding anything.',
        };
      }
      this.#logger.debug(
        `TargetResolutionService.#_resolveEquipment: Actor '${actorEntity.id}' has nothing equipped (getEntityIdsForScopes returned empty set).`
      );
      return {
        status: ResolutionStatus.NOT_FOUND,
        targetType: 'entity',
        targetId: null,
        error: 'You have nothing equipped.',
      };
    }

    const getEntityIdsFn = () => equippedItemIdsSet;
    const candidates = await this.#_gatherNameMatchCandidates(
      getEntityIdsFn,
      'equipment'
    );
    const matcherResult = matchNames(candidates, nounPhrase, this.#logger);
    let finalResult = this.#_buildTargetResolutionResultFromMatcher(
      matcherResult,
      'entity'
    );

    if (finalResult.status === ResolutionStatus.NONE) {
      finalResult.error = this.#_msgSpecifyItem('equipped item');
      finalResult.targetType = 'entity';
    } else if (finalResult.status === ResolutionStatus.NOT_FOUND) {
      finalResult.targetType = 'entity';
      if (nounPhrase && nounPhrase.trim() !== '') {
        if (candidates.length === 0 && equippedItemIdsSet.size > 0) {
          this.#logger.debug(
            `TargetResolutionService.#_resolveEquipment: Searched for "${nounPhrase}", but no nameable/valid candidates found from ${equippedItemIdsSet.size} equipped item IDs (from scope).`
          );
          finalResult.error = this.#_msgNothingOfKind('equipped');
        } else {
          this.#logger.debug(
            `TargetResolutionService.#_resolveEquipment: Searched for "${nounPhrase}". Candidates count: ${candidates.length}, initial item IDs from scope: ${equippedItemIdsSet.size}. No match found.`
          );
          finalResult.error = this.#_msgNounPhraseNotFound(
            nounPhrase,
            'equipped'
          );
        }
      } else {
        this.#logger.debug(
          `TargetResolutionService.#_resolveEquipment: No nounPhrase and no nameable candidates found. Initial item IDs from scope: ${equippedItemIdsSet.size}.`
        );
        finalResult.error = this.#_msgNothingOfKind('equipped');
      }
    }
    return finalResult;
  }

  async #_resolveEnvironment(actorEntity, nounPhrase, minimalContext) {
    this.#logger.debug(
      `TargetResolutionService.#_resolveEnvironment called for actor: ${actorEntity.id}, noun: "${nounPhrase}"`
    );
    // actorEntity is guaranteed non-null.

    if (!minimalContext.currentLocation) {
      this.#logger.warn(
        `TargetResolutionService.#_resolveEnvironment: Actor '${actorEntity.id}' has no valid location according to worldContext (checked via minimalContext).`
      );
      return {
        status: ResolutionStatus.ERROR,
        targetType: 'none',
        targetId: null,
        error: 'Internal error: Cannot determine your current location.',
      };
    }
    if (!minimalContext.currentLocation.id) {
      this.#logger.warn(
        `TargetResolutionService.#_resolveEnvironment: Actor '${actorEntity.id}' is in a location entity that has no ID (via minimalContext). Location data: ${JSON.stringify(minimalContext.currentLocation)}`
      );
      return {
        status: ResolutionStatus.ERROR,
        targetType: 'none',
        targetId: null,
        error: 'Internal error: Cannot determine your current location.',
      };
    }
    const actorLocationId = minimalContext.currentLocation.id;

    this.#logger.debug(
      `TargetResolutionService.#_resolveEnvironment: Actor '${actorEntity.id}' is in location '${actorLocationId}'. Using 'location' scope.`
    );
    const entityIdsInLocationSet = this.#getEntityIdsForScopes(
      'location',
      minimalContext
    );

    if (entityIdsInLocationSet.size === 0) {
      this.#logger.debug(
        `TargetResolutionService.#_resolveEnvironment: No entities (excluding actor) found in location '${actorLocationId}' via scope 'location'.`
      );
      const isSearchingSpecific = nounPhrase && nounPhrase.trim() !== '';
      return {
        status: ResolutionStatus.NOT_FOUND,
        targetType: isSearchingSpecific ? 'entity' : 'none',
        targetId: null,
        error: isSearchingSpecific
          ? this.#_msgNounPhraseNotFound(nounPhrase, 'here', { useAny: true })
          : 'There is nothing here.',
      };
    }

    const getEntityIdsFn = () => entityIdsInLocationSet;
    const candidates = await this.#_gatherNameMatchCandidates(
      getEntityIdsFn,
      'environment',
      actorEntity.id
    );

    if (candidates.length === 0) {
      this.#logger.debug(
        `TargetResolutionService.#_resolveEnvironment: No valid targetable candidates (excluding actor, with names) found in location '${actorLocationId}' from ${entityIdsInLocationSet.size} IDs from scope.`
      );
      const isSearchingSpecific = nounPhrase && nounPhrase.trim() !== '';
      return {
        status: ResolutionStatus.NOT_FOUND,
        targetType: isSearchingSpecific ? 'entity' : 'none',
        targetId: null,
        error: isSearchingSpecific
          ? this.#_msgNounPhraseNotFound(nounPhrase, 'here', { useAny: true })
          : 'There is nothing else of interest here.',
      };
    }

    this.#logger.debug(
      `TargetResolutionService.#_resolveEnvironment: Gathered ${candidates.length} candidates in location '${actorLocationId}' for matching against "${nounPhrase}".`
    );
    const matcherResult = matchNames(candidates, nounPhrase, this.#logger);
    let finalResult = this.#_buildTargetResolutionResultFromMatcher(
      matcherResult,
      'entity'
    );

    if (finalResult.status === ResolutionStatus.NONE) {
      finalResult.error = this.#_msgSpecifyItem('item', 'here');
      finalResult.targetType = 'entity';
    } else if (finalResult.status === ResolutionStatus.NOT_FOUND) {
      finalResult.targetType = 'entity';
      finalResult.error = this.#_msgNounPhraseNotFound(nounPhrase, 'here'); // No useAny here, direct not found.
    }
    return finalResult;
  }

  #_resolveDirection(nounPhrase, actorEntity) {
    this.#logger.debug(
      `TargetResolutionService.#_resolveDirection called with noun: "${nounPhrase}", actorId: ${actorEntity?.id}`
    );

    const currentLocationEntity =
      this.#worldContext.getCurrentLocation(actorEntity); // actorEntity might be null, getCurrentLocation should handle this or rely on global context

    if (!currentLocationEntity || !currentLocationEntity.id) {
      this.#logger.warn(
        `TargetResolutionService.#_resolveDirection: Could not determine current location. actorEntity ID: ${actorEntity?.id}`
      );
      return {
        status: ResolutionStatus.ERROR,
        targetType: 'direction',
        targetId: null,
        error: 'Internal error: Your location is unknown.',
      };
    }
    this.#logger.debug(
      `TargetResolutionService.#_resolveDirection: Current location is '${currentLocationEntity.id}'.`
    );

    const availableExits = getAvailableExits(
      currentLocationEntity,
      this.#entityManager,
      this.#logger
    );

    if (!availableExits || availableExits.length === 0) {
      this.#logger.debug(
        `TargetResolutionService.#_resolveDirection: Location '${currentLocationEntity.id}' has no valid exits according to getAvailableExits.`
      );
      return {
        status: ResolutionStatus.NOT_FOUND,
        targetType: 'direction',
        targetId: null,
        error: 'There are no obvious exits from here.',
      };
    }

    if (
      !nounPhrase ||
      typeof nounPhrase !== 'string' ||
      nounPhrase.trim() === ''
    ) {
      this.#logger.debug(
        'TargetResolutionService.#_resolveDirection: No nounPhrase (direction) provided.'
      );
      return {
        status: ResolutionStatus.NONE,
        targetType: 'direction',
        targetId: null,
        error: 'Which direction do you want to go?',
      };
    }

    const normalizedNounPhrase = nounPhrase.toLowerCase().trim();
    const matchedDirections = [];

    for (const exit of availableExits) {
      if (exit.direction.toLowerCase() === normalizedNounPhrase) {
        matchedDirections.push(exit.direction);
      }
    }

    if (matchedDirections.length === 1) {
      this.#logger.debug(
        `TargetResolutionService.#_resolveDirection: Found unique direction: '${matchedDirections[0]}'`
      );
      return {
        status: ResolutionStatus.FOUND_UNIQUE,
        targetType: 'direction',
        targetId: matchedDirections[0],
      };
    } else if (matchedDirections.length > 1) {
      this.#logger.warn(
        `TargetResolutionService.#_resolveDirection: Ambiguous direction due to duplicate exit definitions for '${normalizedNounPhrase}'. Matched: ${matchedDirections.join(', ')}.`
      );
      return {
        status: ResolutionStatus.AMBIGUOUS,
        targetType: 'direction',
        targetId: null,
        candidates: matchedDirections,
        error: `The direction "${nounPhrase}" is ambiguously defined here.`,
      };
    } else {
      this.#logger.debug(
        `TargetResolutionService.#_resolveDirection: No exit matches direction '${nounPhrase}'. Valid exits were: ${availableExits.map((e) => e.direction).join(', ')}`
      );
      return {
        status: ResolutionStatus.NOT_FOUND,
        targetType: 'direction',
        targetId: null,
        error: `You can't go "${nounPhrase}".`,
      };
    }
  }
}

export { TargetResolutionService };
