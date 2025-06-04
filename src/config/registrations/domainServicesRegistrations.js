// src/core/config/registrations/domainServicesRegistrations.js
// ****** MODIFIED FILE ******
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import {TargetResolutionService} from '../../services/targetResolutionService.js';
import {ActionValidationContextBuilder} from '../../services/actionValidationContextBuilder.js';
import {PrerequisiteEvaluationService} from '../../services/prerequisiteEvaluationService.js';
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js';
import {ActionValidationService} from '../../services/actionValidationService.js';
import CommandParser from '../../commands/commandParser.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
import WorldContext from '../../context/worldContext.js';
import {TurnOrderService} from '../../turns/order/turnOrderService.js';
import CommandProcessor from '../../commands/commandProcessor.js';
import HumanPlayerPromptService from '../../turns/services/humanPlayerPromptService.js'; // Concrete class
import SubscriptionLifecycleManager from '../../services/subscriptionLifecycleManager.js';
import PerceptionUpdateService from '../../services/perceptionUpdateService.js';
import ReferenceResolver from '../../initializers/services/referenceResolver.js';

// Import getEntityIdsForScopes directly
import {getEntityIdsForScopes} from '../../services/entityScopeService.js';

// --- PlaytimeTracker Import ---
import PlaytimeTracker from '../../services/playtimeTracker.js';

// --- GamePersistenceService Import ---
import GamePersistenceService from '../../services/gamePersistenceService.js';
import {ConcreteTurnContextFactory} from '../../turns/factories/concreteTurnContextFactory.js';
import {ConcreteAIPlayerStrategyFactory} from '../../turns/factories/concreteAIPlayerStrategyFactory.js';
import {ConcreteTurnStateFactory} from '../../turns/factories/concreteTurnStateFactory.js';
import {LLMResponseProcessor} from '../../turns/services/LLMResponseProcessor.js';
import {AIPromptContentProvider} from '../../services/AIPromptContentProvider.js';
import {AIGameStateProvider} from '../../turns/services/AIGameStateProvider.js';

// --- PromptBuilder and its dependencies (NEW IMPORTS) ---
import {PromptBuilder} from '../../services/promptBuilder.js'; // Corrected path
import {LLMConfigService} from '../../services/llmConfigService.js'; // Corrected path
import {HttpConfigurationProvider} from '../../services/httpConfigurationProvider.js'; // Corrected path
import {PlaceholderResolver} from '../../utils/placeholderResolver.js'; // Corrected path
import {StandardElementAssembler} from '../../services/promptElementAssemblers/standardElementAssembler.js'; // Corrected path
import {PerceptionLogAssembler} from '../../services/promptElementAssemblers/perceptionLogAssembler.js';
import {PromptStaticContentService} from '../../services/promptStaticContentService.js'; // Corrected path

// +++ TICKET 7 IMPORTS START +++
import {PerceptionLogFormatter} from '../../services/perceptionLogFormatter.js';
// +++ TICKET 7 IMPORTS END +++

// +++ TICKET 11 IMPORTS START +++
import {GameStateValidationServiceForPrompting} from '../../services/gameStateValidationServiceForPrompting.js';
import {EntityDisplayDataProvider} from '../../services/entityDisplayDataProvider.js';
import ThoughtsSectionAssembler from '../../services/promptElementAssemblers/thoughtsSectionAssembler.js';
import NotesSectionAssembler from "../../services/promptElementAssemblers/notesSectionAssembler.js";
// +++ TICKET 11 IMPORTS END +++

// --- Type Imports for JSDoc ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IPromptStaticContentService.js').IPromptStaticContentService} IPromptStaticContentService */
/** @typedef {import('../../interfaces/IPerceptionLogFormatter.js').IPerceptionLogFormatter} IPerceptionLogFormatter */
/** @typedef {import('../../interfaces/IGameStateValidationServiceForPrompting.js').IGameStateValidationServiceForPrompting} IGameStateValidationServiceForPrompting */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../commands/interfaces/ICommandParser.js').ICommandParser} ICommandParser */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../services/targetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../turns/ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../services/entityScopeService.js').getEntityIdsForScopes} GetEntityIdsForScopesFn */
/** @typedef {import('../../turns/interfaces/IHumanPlayerPromptService.js').IHumanPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../turns/ports/ICommandInputPort.js').ICommandInputPort} ICommandInputPort */
/** @typedef {import('../../interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker */

/** @typedef {import('../../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager_Type */
/** @typedef {import('../../services/perceptionUpdateService.js').default} PerceptionUpdateService_Type */
/** @typedef {import('../../services/gamePersistenceService.js').default} GamePersistenceService_Type */
/** @typedef {import('../../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService_Interface */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry_Interface */
/** @typedef {import('../../../initializers/services/referenceResolver.js').default} ReferenceResolver_Concrete */ // Note: path might be '../../initializers/services/referenceResolver.js'
/** @typedef {import('../../interfaces/IReferenceResolver.js').IReferenceResolver} IReferenceResolver_Interface */
// --- NEW Type Imports for PromptBuilder dependencies ---
/** @typedef {import('../../interfaces/IConfigurationProvider.js').IConfigurationProvider} IConfigurationProvider */ // Note: path might be '../../interfaces/IConfigurationProvider.js'
/** @typedef {import('../../services/llmConfigService.js').LLMConfigService} LLMConfigService_Concrete */
/** @typedef {import('../../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver_Concrete */
/** @typedef {import('../../services/promptElementAssemblers/standardElementAssembler.js').StandardElementAssembler} StandardElementAssembler_Concrete */
/** @typedef {import('../../services/promptElementAssemblers/perceptionLogAssembler.js').PerceptionLogAssembler} PerceptionLogAssembler_Concrete */

/** @typedef {import('../../interfaces/IPromptBuilder.js').IPromptBuilder} IPromptBuilder_Interface */

/**
 * Registers core domain logic services.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerDomainServices(container) {
    const r = new Registrar(container);
    /** @type {ILogger} */
    const log = container.resolve(tokens.ILogger);
    log.debug('Domain-services Registration: starting...');

    // ------------------------------------------------------------------
    // NEW -- PromptStaticContentService
    // ------------------------------------------------------------------
    r.singletonFactory(tokens.IPromptStaticContentService, (c) => {
        const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
        return new PromptStaticContentService({logger});
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.IPromptStaticContentService)}.`
    );
    // ------------------------------------------------------------------

    // +++ TICKET 7 REGISTRATION START +++
    r.singletonFactory(tokens.IPerceptionLogFormatter, (c) => {
        const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
        return new PerceptionLogFormatter({logger});
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.IPerceptionLogFormatter)}.`
    );
    // +++ TICKET 7 REGISTRATION END +++

    // +++ TICKET 11 REGISTRATION START +++
    r.singletonFactory(tokens.IGameStateValidationServiceForPrompting, (c) => {
        const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
        if (!logger) {
            const errorMsg = `Domain-services Registration: Factory for ${String(tokens.IGameStateValidationServiceForPrompting)} FAILED to resolve dependency "logger".`;
            log.error(errorMsg); // Use the main log instance for this error
            throw new Error(errorMsg);
        }
        return new GameStateValidationServiceForPrompting({logger});
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.IGameStateValidationServiceForPrompting)}.`
    );
    // +++ TICKET 11 REGISTRATION END +++

    r.singletonFactory(tokens.EntityDisplayDataProvider, (c) => {
        log.debug(
            `Domain-services Registration: Factory creating ${String(tokens.EntityDisplayDataProvider)}...`
        );
        const eddpDeps = {
            entityManager: /** @type {IEntityManager} */ (
                c.resolve(tokens.IEntityManager)
            ),
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        };
        if (!eddpDeps.entityManager || !eddpDeps.logger) {
            const errorMsg = `Domain-services Registration: Factory for ${String(tokens.EntityDisplayDataProvider)} FAILED to resolve dependencies. EntityManager: ${!!eddpDeps.entityManager}, Logger: ${!!eddpDeps.logger}`;
            log.error(errorMsg);
            throw new Error(errorMsg);
        }
        log.debug(
            `Domain-services Registration: Dependencies for ${String(tokens.EntityDisplayDataProvider)} resolved, creating instance.`
        );
        return new EntityDisplayDataProvider(eddpDeps);
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.EntityDisplayDataProvider)} factory.`
    );

    r.singletonFactory(tokens.TargetResolutionService, (c) => {
        log.debug(
            `Domain-services Registration: Factory creating ${String(tokens.TargetResolutionService)}...`
        );
        const dependencies = {
            entityManager: /** @type {IEntityManager} */ (
                c.resolve(tokens.IEntityManager)
            ),
            worldContext: /** @type {IWorldContext} */ (
                c.resolve(tokens.IWorldContext)
            ),
            gameDataRepository: /** @type {IGameDataRepository} */ (
                c.resolve(tokens.IGameDataRepository)
            ),
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            getEntityIdsForScopes: getEntityIdsForScopes,
        };

        for (const [key, value] of Object.entries(dependencies)) {
            if (!value) {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.TargetResolutionService)} FAILED to resolve dependency "${key}".`;
                log.error(errorMsg);
                throw new Error(
                    `Missing dependency "${key}" for ${String(tokens.TargetResolutionService)}`
                );
            }
            if (key === 'getEntityIdsForScopes' && typeof value !== 'function') {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.TargetResolutionService)} FAILED, dependency "${key}" is not a function.`;
                log.error(errorMsg);
                throw new Error(
                    `Dependency "${key}" for ${String(tokens.TargetResolutionService)} must be a function.`
                );
            }
        }
        log.debug(
            `Domain-services Registration: Dependencies for ${String(tokens.TargetResolutionService)} resolved, creating instance.`
        );
        return new TargetResolutionService(dependencies);
    });
    log.debug(
        `Domain-services Registration: Registered ${String(tokens.TargetResolutionService)} factory.`
    );

    r.single(tokens.JsonLogicEvaluationService, JsonLogicEvaluationService, [
        tokens.ILogger,
    ]);
    r.single(
        tokens.ActionValidationContextBuilder,
        ActionValidationContextBuilder,
        [tokens.IEntityManager, tokens.ILogger]
    );
    r.single(
        tokens.PrerequisiteEvaluationService,
        PrerequisiteEvaluationService,
        [
            tokens.ILogger,
            tokens.JsonLogicEvaluationService,
            tokens.ActionValidationContextBuilder,
        ]
    );
    r.single(
        tokens.DomainContextCompatibilityChecker,
        DomainContextCompatibilityChecker,
        [tokens.ILogger]
    );
    r.single(tokens.ActionValidationService, ActionValidationService, [
        tokens.IEntityManager,
        tokens.ILogger,
        tokens.DomainContextCompatibilityChecker,
        tokens.PrerequisiteEvaluationService,
    ]);

    r.singletonFactory(
        tokens.IWorldContext,
        (c) =>
            new WorldContext(
                /** @type {IEntityManager} */ (c.resolve(tokens.IEntityManager)),
                /** @type {ILogger} */ (c.resolve(tokens.ILogger))
            )
    );
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.IWorldContext)}.`
    );

    container.register(
        tokens.ICommandParser,
        (c) => {
            const gameDataRepoInstance = /** @type {IGameDataRepository} */ (
                c.resolve(tokens.IGameDataRepository)
            );
            return new CommandParser(gameDataRepoInstance);
        },
        {lifecycle: 'singleton'}
    );
    log.debug(
        `Domain-services Registration: Registered ${String(tokens.ICommandParser)}.`
    );

    r.singletonFactory(tokens.ICommandProcessor, (c) => {
        log.debug(
            `Domain-services Registration: Factory creating ${String(tokens.ICommandProcessor)}...`
        );
        const commandProcessorDeps = {
            commandParser: /** @type {ICommandParser} */ (
                c.resolve(tokens.ICommandParser)
            ),
            targetResolutionService: /** @type {ITargetResolutionService} */ (
                c.resolve(tokens.TargetResolutionService)
            ),
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            validatedEventDispatcher: /** @type {IValidatedEventDispatcher} */ (
                c.resolve(tokens.IValidatedEventDispatcher)
            ),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (
                c.resolve(tokens.ISafeEventDispatcher)
            ),
            worldContext: /** @type {IWorldContext} */ (
                c.resolve(tokens.IWorldContext)
            ),
            entityManager: /** @type {IEntityManager} */ (
                c.resolve(tokens.IEntityManager)
            ),
            gameDataRepository: /** @type {IGameDataRepository} */ (
                c.resolve(tokens.IGameDataRepository)
            ),
        };

        for (const [key, value] of Object.entries(commandProcessorDeps)) {
            if (!value) {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.ICommandProcessor)} FAILED to resolve dependency "${key}".`;
                log.error(errorMsg);
                throw new Error(
                    `Missing dependency "${key}" for ${String(tokens.ICommandProcessor)}`
                );
            }
        }
        log.debug(
            `Domain-services Registration: Dependencies for ${String(tokens.ICommandProcessor)} resolved, creating instance.`
        );
        return new CommandProcessor(commandProcessorDeps);
    });
    log.debug(
        `Domain-services Registration: Registered ${String(tokens.ICommandProcessor)} factory.`
    );

    r.singletonFactory(tokens.ITurnOrderService, (c) => {
        const dependencies = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        };
        if (!dependencies.logger) {
            const errorMsg = `Domain-services Registration: Factory for ${String(tokens.ITurnOrderService)} FAILED to resolve dependency "logger".`;
            log.error(errorMsg);
            throw new Error(
                `Missing dependency "logger" for ${String(tokens.ITurnOrderService)}`
            );
        }
        return new TurnOrderService(dependencies);
    });
    log.debug(
        `Domain-services Registration: Registered ${String(tokens.ITurnOrderService)}.`
    );

    r.singletonFactory(tokens.IPlayerPromptService, (c) => {
        log.debug(
            `Domain-services Registration: Factory creating ${String(tokens.IPlayerPromptService)}...`
        );
        const playerPromptDeps = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            actionDiscoverySystem: /** @type {IActionDiscoverySystem} */ (
                c.resolve(tokens.IActionDiscoverySystem)
            ),
            promptOutputPort: /** @type {IPromptOutputPort} */ (
                c.resolve(tokens.IPromptOutputPort)
            ),
            worldContext: /** @type {IWorldContext} */ (
                c.resolve(tokens.IWorldContext)
            ),
            entityManager: /** @type {IEntityManager} */ (
                c.resolve(tokens.IEntityManager)
            ),
            gameDataRepository: /** @type {IGameDataRepository} */ (
                c.resolve(tokens.IGameDataRepository)
            ),
            validatedEventDispatcher: /** @type {IValidatedEventDispatcher} */ (
                c.resolve(tokens.IValidatedEventDispatcher)
            ),
        };
        for (const [key, value] of Object.entries(playerPromptDeps)) {
            if (!value) {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.IPlayerPromptService)} FAILED to resolve dependency "${key}".`;
                log.error(errorMsg);
                throw new Error(
                    `Missing dependency "${key}" for ${String(tokens.IPlayerPromptService)}`
                );
            }
        }
        log.debug(
            `Domain-services Registration: Dependencies for ${String(tokens.IPlayerPromptService)} resolved, creating instance.`
        );
        return new HumanPlayerPromptService(playerPromptDeps);
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.IPlayerPromptService)} factory.`
    );

    r.singletonFactory(tokens.SubscriptionLifecycleManager, (c) => {
        log.debug(
            `Domain-services Registration: Factory creating ${String(tokens.SubscriptionLifecycleManager)}...`
        );
        const slmDeps = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            commandInputPort: /** @type {ICommandInputPort} */ (
                c.resolve(tokens.ICommandInputPort)
            ),
            safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (
                c.resolve(tokens.ISafeEventDispatcher)
            ),
        };
        for (const [key, value] of Object.entries(slmDeps)) {
            if (!value) {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.SubscriptionLifecycleManager)} FAILED to resolve dependency "${key}".`;
                log.error(errorMsg);
                throw new Error(
                    `Missing dependency "${key}" for ${String(tokens.SubscriptionLifecycleManager)}`
                );
            }
        }
        log.debug(
            `Domain-services Registration: Dependencies for ${String(tokens.SubscriptionLifecycleManager)} resolved, creating instance.`
        );
        return new SubscriptionLifecycleManager(slmDeps);
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.SubscriptionLifecycleManager)} factory.`
    );

    r.singletonFactory(tokens.PerceptionUpdateService, (c) => {
        log.debug(
            `Domain-services Registration: Factory creating ${String(tokens.PerceptionUpdateService)}...`
        );
        const pusDeps = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            entityManager: /** @type {IEntityManager} */ (
                c.resolve(tokens.IEntityManager)
            ),
        };
        if (!pusDeps.logger || !pusDeps.entityManager) {
            const errorMsg = `Domain-services Registration: Factory for ${String(tokens.PerceptionUpdateService)} FAILED to resolve dependencies. Logger: ${!!pusDeps.logger}, EntityManager: ${!!pusDeps.entityManager}`;
            log.error(errorMsg);
            throw new Error(errorMsg);
        }
        log.debug(
            `Domain-services Registration: Dependencies for ${String(tokens.PerceptionUpdateService)} resolved, creating instance.`
        );
        return new PerceptionUpdateService(pusDeps);
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.PerceptionUpdateService)} factory.`
    );

    // Registration for PlaytimeTracker
    r.single(tokens.PlaytimeTracker, PlaytimeTracker, [tokens.ILogger]);
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.PlaytimeTracker)}.`
    );

    // Registration for GamePersistenceService
    r.singletonFactory(tokens.GamePersistenceService, (c) => {
        log.debug(
            `Domain-services Registration: Factory creating ${String(tokens.GamePersistenceService)}...`
        );
        const gpsDeps = {
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
            saveLoadService: /** @type {ISaveLoadService_Interface} */ (
                c.resolve(tokens.ISaveLoadService)
            ),
            entityManager: /** @type {IEntityManager} */ (
                c.resolve(tokens.IEntityManager)
            ),
            dataRegistry: /** @type {IDataRegistry_Interface} */ (
                c.resolve(tokens.IDataRegistry)
            ),
            playtimeTracker: /** @type {IPlaytimeTracker} */ (
                c.resolve(tokens.PlaytimeTracker)
            ),
            container: /** @type {AppContainer} */ (c),
        };
        for (const [key, value] of Object.entries(gpsDeps)) {
            if (!value && key !== 'container') {
                const errorMsg = `Domain-services Registration: Factory for ${String(tokens.GamePersistenceService)} FAILED to resolve dependency "${key}".`;
                log.error(errorMsg);
                throw new Error(errorMsg);
            }
        }
        log.debug(
            `Domain-services Registration: Dependencies for ${String(tokens.GamePersistenceService)} resolved, creating instance.`
        );
        return new GamePersistenceService(gpsDeps);
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.GamePersistenceService)} (via factory).`
    );

    // --- Register ReferenceResolver ---
    r.singletonFactory(tokens.IReferenceResolver, (c) => {
        // Using IReferenceResolver token
        log.debug(
            `Domain-services Registration: Factory creating ${String(tokens.IReferenceResolver)}...`
        );
        const resolverDeps = {
            entityManager: /** @type {IEntityManager} */ (
                c.resolve(tokens.IEntityManager)
            ),
            logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        };
        if (!resolverDeps.entityManager || !resolverDeps.logger) {
            const errorMsg = `Domain-services Registration: Factory for ${String(tokens.IReferenceResolver)} FAILED to resolve dependencies. EntityManager: ${!!resolverDeps.entityManager}, Logger: ${!!resolverDeps.logger}`;
            log.error(errorMsg);
            throw new Error(errorMsg);
        }
        log.debug(
            `Domain-services Registration: Dependencies for ${String(tokens.IReferenceResolver)} resolved, creating instance.`
        );
        return new ReferenceResolver(resolverDeps);
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.IReferenceResolver)} implemented by ReferenceResolver.`
    );

    // --- Services for PromptBuilder, AITurnHandler and AIPlayerStrategy ---

    // Register IConfigurationProvider (implemented by HttpConfigurationProvider)
    r.singletonFactory(tokens.IConfigurationProvider, (c) => {
        const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
        return new HttpConfigurationProvider({logger});
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.IConfigurationProvider)} (HttpConfigurationProvider).`
    );

    // Register LLMConfigService
    r.singletonFactory(tokens.LLMConfigService, (c) => {
        const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
        const configurationProvider = /** @type {IConfigurationProvider} */ (
            c.resolve(tokens.IConfigurationProvider)
        );
        // This path was previously hardcoded in PromptBuilder's factory.
        // It's assumed to be a URL if HttpConfigurationProvider is used.
        const llmConfigsPath = './config/llm-configs.json';
        log.info(
            `${String(tokens.LLMConfigService)} factory: Using configSourceIdentifier: "${llmConfigsPath}"`
        );
        return new LLMConfigService({
            logger,
            configurationProvider,
            configSourceIdentifier: llmConfigsPath,
        });
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.LLMConfigService)}.`
    );

    // Register PlaceholderResolver
    r.singletonFactory(tokens.PlaceholderResolver, (c) => {
        const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
        return new PlaceholderResolver(logger); // PlaceholderResolver constructor takes logger directly
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.PlaceholderResolver)}.`
    );

    // Register StandardElementAssembler
    r.singletonFactory(tokens.StandardElementAssembler, (c) => {
        const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
        return new StandardElementAssembler({logger});
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.StandardElementAssembler)}.`
    );

    // Register PerceptionLogAssembler
    r.singletonFactory(tokens.PerceptionLogAssembler, (c) => {
        const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
        return new PerceptionLogAssembler({logger});
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.PerceptionLogAssembler)}.`
    );

    // Register ThoughtsSectionAssembler
    r.singletonFactory(tokens.ThoughtsSectionAssembler, (c) => {
        const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
        return new ThoughtsSectionAssembler({logger});
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.ThoughtsSectionAssembler)}.`
    );

    // PromptBuilder registration
    r.singletonFactory(tokens.IPromptBuilder, (c) => {
        const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
        const llmConfigService = /** @type {LLMConfigService_Concrete} */ (
            c.resolve(tokens.LLMConfigService)
        );
        const placeholderResolver = /** @type {PlaceholderResolver_Concrete} */ (
            c.resolve(tokens.PlaceholderResolver)
        );
        const standardElementAssembler =
            /** @type {StandardElementAssembler_Concrete} */ (
            c.resolve(tokens.StandardElementAssembler)
        );
        const perceptionLogAssembler =
            /** @type {PerceptionLogAssembler_Concrete} */ (
            c.resolve(tokens.PerceptionLogAssembler)
        );
        const thoughtsSectionAssembler = c.resolve(tokens.ThoughtsSectionAssembler);

        r.singletonFactory(tokens.NotesSectionAssembler, (c) => {
            const logger = c.resolve(tokens.ILogger);
            return new NotesSectionAssembler({logger});
        });
        log.debug(`Domain Services Registration: Registered ${String(tokens.NotesSectionAssembler)}.`);

        log.info(
            `${String(tokens.IPromptBuilder)} factory: Creating PromptBuilder with new dependencies.`
        );
        return new PromptBuilder({
            logger,
            llmConfigService,
            placeholderResolver,
            standardElementAssembler,
            perceptionLogAssembler,
            thoughtsSectionAssembler,
            notesSectionAssembler
        });
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.IPromptBuilder)} with new dependencies.`
    );

    r.single(tokens.IAIGameStateProvider, AIGameStateProvider);
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.IAIGameStateProvider)}.`
    );

    // MODIFIED IAIPromptContentProvider registration
    r.singletonFactory(tokens.IAIPromptContentProvider, (c) => {
        const logger = /** @type {ILogger} */ (c.resolve(tokens.ILogger));
        const promptStaticContentService =
            /** @type {IPromptStaticContentService} */ (
            c.resolve(tokens.IPromptStaticContentService)
        );
        const perceptionLogFormatter = /** @type {IPerceptionLogFormatter} */ (
            c.resolve(tokens.IPerceptionLogFormatter)
        );
        const gameStateValidationService =
            /** @type {IGameStateValidationServiceForPrompting} */ (
            c.resolve(tokens.IGameStateValidationServiceForPrompting)
        );

        return new AIPromptContentProvider({
            logger,
            promptStaticContentService,
            perceptionLogFormatter,
            gameStateValidationService,
        });
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.IAIPromptContentProvider)} with new dependencies.`
    );

    r.singletonFactory(tokens.ILLMResponseProcessor, (c) => {
        return new LLMResponseProcessor({
            schemaValidator: c.resolve(tokens.ISchemaValidator),
            entityManager: c.resolve(tokens.IEntityManager), // new
        });
    });
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.ILLMResponseProcessor)}.`
    );

    // --- Register Turn System Factories ---
    r.single(tokens.ITurnStateFactory, ConcreteTurnStateFactory);
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.ITurnStateFactory)}.`
    );

    r.single(tokens.IAIPlayerStrategyFactory, ConcreteAIPlayerStrategyFactory); // This factory might need updates if AIPlayerStrategy's direct deps changed significantly due to PromptBuilder
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.IAIPlayerStrategyFactory)}.`
    );

    r.single(tokens.ITurnContextFactory, ConcreteTurnContextFactory);
    log.debug(
        `Domain Services Registration: Registered ${String(tokens.ITurnContextFactory)}.`
    );

    log.info('Domain-services Registration: complete.');
}

// --- FILE END ---
