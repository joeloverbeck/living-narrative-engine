/**
 * @file Character Builder dependency injection registrations
 * @description Registers character builder services with unified LLM infrastructure
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';

// --- Character Builder Service Imports ---
import { CharacterDatabase } from '../../characterBuilder/storage/characterDatabase.js';
import { CharacterStorageService } from '../../characterBuilder/services/characterStorageService.js';
import { ThematicDirectionGenerator } from '../../characterBuilder/services/thematicDirectionGenerator.js';
import { CharacterBuilderService } from '../../characterBuilder/services/characterBuilderService.js';

/**
 * Registers character builder storage services.
 *
 * @param {Registrar} registrar - The service registrar.
 * @param {ILogger} logger - Logger instance for debug output.
 * @returns {void}
 */
function registerCharacterBuilderStorage(registrar, logger) {
  registrar.singletonFactory(tokens.CharacterDatabase, (c) => {
    return new CharacterDatabase({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.CharacterDatabase}.`
  );

  registrar.singletonFactory(tokens.CharacterStorageService, (c) => {
    return new CharacterStorageService({
      logger: c.resolve(tokens.ILogger),
      database: c.resolve(tokens.CharacterDatabase),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.CharacterStorageService}.`
  );
}

/**
 * Registers character builder services using unified LLM infrastructure.
 *
 * @param {Registrar} registrar - The service registrar.
 * @param {ILogger} logger - Logger instance for debug output.
 * @returns {void}
 */
function registerCharacterBuilderServices(registrar, logger) {
  registrar.singletonFactory(tokens.ThematicDirectionGenerator, (c) => {
    return new ThematicDirectionGenerator({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      llmStrategyFactory: c.resolve(tokens.LLMAdapter), // Use the ConfigurableLLMAdapter
      llmConfigManager: c.resolve(tokens.ILLMConfigurationManager),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.ThematicDirectionGenerator}.`
  );

  registrar.singletonFactory(tokens.CharacterBuilderService, (c) => {
    return new CharacterBuilderService({
      logger: c.resolve(tokens.ILogger),
      storageService: c.resolve(tokens.CharacterStorageService),
      directionGenerator: c.resolve(tokens.ThematicDirectionGenerator),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.CharacterBuilderService}.`
  );
}

/**
 * Registers all character builder services with unified LLM infrastructure.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerCharacterBuilder(container) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Character Builder Registration: Starting...');

  registerCharacterBuilderStorage(registrar, logger);
  registerCharacterBuilderServices(registrar, logger);

  logger.debug('Character Builder Registration: All registrations complete.');
}
