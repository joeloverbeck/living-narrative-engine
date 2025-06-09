// src/actions/targeting/targetResolutionService.js

import { ITargetResolutionService } from '../../interfaces/ITargetResolutionService.js';
import { ResolutionStatus } from '../../types/resolutionStatus.js';
import {
  EQUIPMENT_COMPONENT_ID,
  INVENTORY_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { matchNames } from '../../utils/nameMatcher.js';
import { getEntityDisplayName } from '../../utils/entityUtils.js';
import { prepareNameMatchCandidates } from '../../utils/targetingUtils.js';
import { validateDependency } from '../../utils/validationUtils.js';
import { getAvailableExits } from '../../utils/locationUtils.js';
import {
  formatSpecifyItemMessage,
  formatNounPhraseNotFoundMessage,
  formatNothingOfKindMessage,
} from '../../utils/messages.js';

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
  /** @type {Object<string, object>} */ #entityDomainConfigs;

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
    this.#entityDomainConfigs = this.#initializeDomainConfigs();

    this.#logger.debug(
      'TargetResolutionService: Instance created and dependencies validated.'
    );
  }

  // --- REFACTOR START: Centralized Domain Configuration ---
  /**
   * @private
   * @description Initializes and returns the configuration for all entity-based domains.
   * This centralizes domain-specific logic like error messages and empty-scope checks.
   * @returns {Object<string, object>} The configuration map.
   */
  #initializeDomainConfigs() {
    return {
      inventory: {
        loggingContext: 'inventory',
        errorMsg_SpecifyItem: formatSpecifyItemMessage(
          'item',
          'from your inventory'
        ),
        errorMsg_NothingOfKind: formatNothingOfKindMessage('in your inventory'),
        errorMsg_NounPhraseNotFoundContext: 'in your inventory',
        emptyScopeCheck: ({ actorEntity }) => {
          const inventoryComponent = actorEntity.getComponentData(
            INVENTORY_COMPONENT_ID
          );
          if (!inventoryComponent) {
            this.#logger.warn(
              `T-Service(inventory): Actor '${actorEntity.id}' is missing '${INVENTORY_COMPONENT_ID}'.`
            );
            return {
              status: ResolutionStatus.NOT_FOUND,
              targetType: 'entity',
              targetId: null,
              error: 'You are not carrying anything.',
            };
          }
          this.#logger.debug(
            `T-Service(inventory): Actor '${actorEntity.id}' inventory is empty.`
          );
          return {
            status: ResolutionStatus.NOT_FOUND,
            targetType: 'entity',
            targetId: null,
            error: 'Your inventory is empty.',
          };
        },
      },
      equipment: {
        loggingContext: 'equipment',
        errorMsg_SpecifyItem: formatSpecifyItemMessage('equipped item'),
        errorMsg_NothingOfKind: formatNothingOfKindMessage('equipped'),
        errorMsg_NounPhraseNotFoundContext: 'equipped',
        emptyScopeCheck: ({ actorEntity }) => {
          const equipmentComponent = actorEntity.getComponentData(
            EQUIPMENT_COMPONENT_ID
          );
          if (!equipmentComponent) {
            this.#logger.warn(
              `T-Service(equipment): Actor '${actorEntity.id}' is missing '${EQUIPMENT_COMPONENT_ID}'.`
            );
            return {
              status: ResolutionStatus.NOT_FOUND,
              targetType: 'entity',
              targetId: null,
              error: 'You are not wearing or wielding anything.',
            };
          }
          this.#logger.debug(
            `T-Service(equipment): Actor '${actorEntity.id}' has nothing equipped.`
          );
          return {
            status: ResolutionStatus.NOT_FOUND,
            targetType: 'entity',
            targetId: null,
            error: 'You have nothing equipped.',
          };
        },
      },
      environment: {
        loggingContext: 'environment',
        errorMsg_SpecifyItem: formatSpecifyItemMessage('item', 'here'),
        errorMsg_NothingOfKind: null,
        errorMsg_NounPhraseNotFoundContext: 'here',
        excludeActor: true,
        emptyScopeCheck: ({ nounPhrase }) => {
          const isSearchingSpecific = nounPhrase && nounPhrase.trim() !== '';
          return {
            status: ResolutionStatus.NOT_FOUND,
            targetType: isSearchingSpecific ? 'entity' : 'none',
            targetId: null,
            error: isSearchingSpecific
              ? formatNounPhraseNotFoundMessage(nounPhrase, 'here', {
                  useAny: true,
                })
              : 'There is nothing here.',
          };
        },
        candidateEmptyCheck: ({ nounPhrase }) => {
          const isSearchingSpecific = nounPhrase && nounPhrase.trim() !== '';
          return {
            status: ResolutionStatus.NOT_FOUND,
            targetType: isSearchingSpecific ? 'entity' : 'none',
            targetId: null,
            error: isSearchingSpecific
              ? formatNounPhraseNotFoundMessage(nounPhrase, 'here', {
                  useAny: true,
                })
              : 'There is nothing else of interest here.',
          };
        },
      },
      followers: {
        loggingContext: 'followers',
        errorMsg_SpecifyItem: formatSpecifyItemMessage('follower'),
        errorMsg_NothingOfKind: "You don't have any followers.",
        errorMsg_NounPhraseNotFoundContext: 'among your followers',
        emptyScopeCheck: ({ nounPhrase }) => {
          const isSearchingSpecific = nounPhrase && nounPhrase.trim() !== '';
          return {
            status: ResolutionStatus.NOT_FOUND,
            targetType: 'entity',
            targetId: null,
            error: isSearchingSpecific
              ? `You have no follower named "${nounPhrase}".`
              : "You don't have any followers.",
          };
        },
      },
    };
  }
  // --- REFACTOR END ---

  // Error message utilities removed in favor of shared helpers in messages.js

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

    const { parsedCommand, actingEntity } = actionContext;
    const nounPhrase = parsedCommand ? parsedCommand.directObjectPhrase : null;

    this.#logger.debug(
      `TargetResolutionService.resolveActionTarget called for action: '${actionDefinition.id}', actor: '${actingEntity?.id}', noun: "${nounPhrase}"`
    );

    const { target_domain } = actionDefinition;
    const domainConfig = this.#entityDomainConfigs[target_domain];

    // An actor is required for any of our configured entity domains, or for 'self'.
    if (domainConfig || target_domain === 'self') {
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
      const minimalContext = this.#_buildMinimalContextForScopes(actingEntity);

      if (domainConfig) {
        // FIX: Also check for currentLocation.id to catch invalid location entities.
        if (
          target_domain === 'environment' &&
          (!minimalContext.currentLocation ||
            !minimalContext.currentLocation.id)
        ) {
          this.#logger.warn(
            `T-Service(environment): Actor '${actingEntity.id}' has no valid location or location is missing an ID.`
          );
          return {
            status: ResolutionStatus.ERROR,
            targetType: 'none',
            targetId: null,
            error: 'Internal error: Cannot determine your current location.',
          };
        }

        const fullOptions = { ...domainConfig, scopeName: target_domain };
        return await this.#_resolveEntityDomainTarget(
          actingEntity,
          nounPhrase,
          minimalContext,
          fullOptions
        );
      }

      // Handle non-entity domains with the switch.
      switch (target_domain) {
        case 'none':
          return this.#_resolveNone();
        case 'self':
          return this.#_resolveSelf(actingEntity); // actingEntity guaranteed non-null
        case 'direction':
          return this.#_resolveDirection(nounPhrase, actingEntity);
        default:
          this.#logger.warn(
            `TargetResolutionService.resolveActionTarget: Unknown target domain '${target_domain}' for action '${actionDefinition.id}'.`
          );
          return {
            status: ResolutionStatus.NOT_FOUND,
            targetType: 'none',
            targetId: null,
            error: `Action '${actionDefinition.id}' has an unsupported target domain: ${target_domain}.`,
          };
      }
      // --- REFACTOR END ---
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
    if (!actorEntity || !actorEntity.id) {
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

  /**
   * @private
   * @description Generic helper to resolve targets from common entity domains
   * like inventory, equipment or environment.
   * @param {Entity} actorEntity - The acting entity performing the action.
   * @param {string} nounPhrase - Raw noun phrase from the command.
   * @param {ActionContext} minimalContext - Minimal context for scope lookups.
   * @param {object} domainOptions - Configuration for domain specific behaviour.
   * @param {string} domainOptions.scopeName - Scope name used with getEntityIdsForScopes.
   * @param {string} domainOptions.loggingContext - Context string for log messages.
   * @param {string} domainOptions.errorMsg_SpecifyItem - Message when noun phrase is missing.
   * @param {string} domainOptions.errorMsg_NothingOfKind - Message when nothing of that kind exists.
   * @param {string} domainOptions.errorMsg_NounPhraseNotFoundContext - Context for formatNounPhraseNotFoundMessage.
   * @param {boolean} [domainOptions.excludeActor] - Exclude actor from candidates.
   * @param {Function} [domainOptions.emptyScopeCheck] - Optional handler when initial ID set is empty.
   * Should return a TargetResolutionResult or null.
   * @param {Function} [domainOptions.candidateEmptyCheck] - Optional handler when
   * no valid candidates are found after gathering.
   * Should return a TargetResolutionResult or null.
   * @returns {Promise<TargetResolutionResult>} Resolution result for the domain.
   */
  async #_resolveEntityDomainTarget(
    actorEntity,
    nounPhrase,
    minimalContext,
    domainOptions
  ) {
    const {
      scopeName,
      loggingContext,
      errorMsg_SpecifyItem,
      errorMsg_NothingOfKind,
      errorMsg_NounPhraseNotFoundContext,
      excludeActor = false,
      emptyScopeCheck,
      candidateEmptyCheck,
    } = domainOptions;

    const idsSet = this.#getEntityIdsForScopes(scopeName, minimalContext);

    if (idsSet.size === 0) {
      if (typeof emptyScopeCheck === 'function') {
        const earlyResult = emptyScopeCheck({
          actorEntity,
          nounPhrase,
          minimalContext,
          idsSet,
        });
        if (earlyResult) return earlyResult;
      }
    }

    const getEntityIdsFn = () => idsSet;
    const candidates = await prepareNameMatchCandidates(
      getEntityIdsFn,
      this.#entityManager,
      getEntityDisplayName,
      this.#logger,
      {
        entityIdToExclude: excludeActor ? actorEntity.id : undefined,
        domainContextForLogging: loggingContext,
      }
    );

    if (candidates.length === 0 && typeof candidateEmptyCheck === 'function') {
      const earlyResult = candidateEmptyCheck({
        actorEntity,
        nounPhrase,
        minimalContext,
        idsSet,
        candidates,
      });
      if (earlyResult) return earlyResult;
    }

    const matcherResult = matchNames(candidates, nounPhrase, this.#logger);
    let finalResult = this.#_buildTargetResolutionResultFromMatcher(
      matcherResult,
      'entity'
    );

    if (finalResult.status === ResolutionStatus.NONE) {
      finalResult.error = errorMsg_SpecifyItem;
      finalResult.targetType = 'entity';
    } else if (finalResult.status === ResolutionStatus.NOT_FOUND) {
      finalResult.targetType = 'entity';
      if (nounPhrase && nounPhrase.trim() !== '') {
        if (candidates.length === 0 && idsSet.size > 0) {
          if (errorMsg_NothingOfKind) {
            finalResult.error = errorMsg_NothingOfKind;
          }
        } else {
          finalResult.error = formatNounPhraseNotFoundMessage(
            nounPhrase,
            errorMsg_NounPhraseNotFoundContext
          );
        }
      } else if (errorMsg_NothingOfKind) {
        finalResult.error = errorMsg_NothingOfKind;
      }
    }

    return finalResult;
  }

  // --- REFACTOR: The following methods are now deleted ---
  // #_resolveInventoryDomain
  // #_resolveEquipment
  // #_resolveEnvironment
  // #_resolveFollowersDomain
  // They have been replaced by the #entityDomainConfigs map.
  // ---

  #_resolveDirection(nounPhrase, actorEntity) {
    this.#logger.debug(
      `TargetResolutionService.#_resolveDirection called with noun: "${nounPhrase}", actorId: ${actorEntity?.id}`
    );

    const currentLocationEntity =
      this.#worldContext.getCurrentLocation(actorEntity);

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
        `TargetResolutionService.#_resolveDirection: Location '${currentLocationEntity.id}' has no valid exits.`
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
      // FIX: Add the matched directions to the log message for better debugging.
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
        `TargetResolutionService.#_resolveDirection: No exit matches direction '${nounPhrase}'.`
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
