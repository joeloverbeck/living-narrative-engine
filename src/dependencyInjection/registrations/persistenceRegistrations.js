/**
 * @file Registers services related to game state persistence, including saving, loading, and reference resolution.
 * @see src/dependencyInjection/registrations/persistenceRegistrations.js
 */

/* eslint-env node */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IPlaytimeTracker.js').IPlaytimeTracker} IPlaytimeTracker */
/** @typedef {import('../../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService_Interface */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry_Interface */
/** @typedef {import('../../interfaces/IStorageProvider.js').IStorageProvider} IStorageProvider */
// /** @typedef {import('../../interfaces/IReferenceResolver.js').IReferenceResolver} IReferenceResolver_Interface */ // Removed - service is deprecated

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';

// --- Service Imports ---
import PlaytimeTracker from '../../engine/playtimeTracker.js';
import ComponentCleaningService, {
  buildDefaultComponentCleaners,
} from '../../persistence/componentCleaningService.js';
import GamePersistenceService from '../../persistence/gamePersistenceService.js';
import GameStateCaptureService from '../../persistence/gameStateCaptureService.js';
import ManualSaveCoordinator from '../../persistence/manualSaveCoordinator.js';
import GameStateRestorer from '../../persistence/gameStateRestorer.js';
import SaveMetadataBuilder from '../../persistence/saveMetadataBuilder.js';
import ActiveModsManifestBuilder from '../../persistence/activeModsManifestBuilder.js';
// import ReferenceResolver from '../../initializers/services/referenceResolver.js'; // Removed - service is deprecated
import createSaveLoadService from '../../persistence/createSaveLoadService.js';
import GameStateSerializer from '../../persistence/gameStateSerializer.js';
import ChecksumService from '../../persistence/checksumService.js';
import SaveFileRepository from '../../persistence/saveFileRepository.js';
import SaveFileParser from '../../persistence/saveFileParser.js';
import { BrowserStorageProvider } from '../../storage/browserStorageProvider.js';

/**
 * Registers persistence-related services.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerPersistence(container) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Persistence Registration: Starting...');

  registrar.single(tokens.IStorageProvider, BrowserStorageProvider, [
    tokens.ILogger,
    tokens.ISafeEventDispatcher,
  ]);
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.IStorageProvider)}.`
  );

  registrar.singletonFactory(tokens.ISaveFileRepository, (c) => {
    const logger = c.resolve(tokens.ILogger);
    const storageProvider = c.resolve(tokens.IStorageProvider);
    const checksumService = new ChecksumService({ logger });
    const serializer = new GameStateSerializer({
      logger,
      checksumService,
    });
    const parser = new SaveFileParser({
      logger,
      storageProvider,
      serializer,
    });
    return new SaveFileRepository({
      logger,
      storageProvider,
      parser,
    });
  });
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.ISaveFileRepository)}.`
  );

  registrar.singletonFactory(tokens.ISaveLoadService, (c) =>
    createSaveLoadService({
      logger: c.resolve(tokens.ILogger),
      storageProvider: c.resolve(tokens.IStorageProvider),
    })
  );
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.ISaveLoadService)}.`
  );

  registrar.single(tokens.PlaytimeTracker, PlaytimeTracker, [
    tokens.ILogger,
    tokens.ISafeEventDispatcher,
  ]);
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.PlaytimeTracker)}.`
  );

  registrar.singletonFactory(tokens.ComponentCleaningService, (c) => {
    const logger = c.resolve(tokens.ILogger);
    return new ComponentCleaningService({
      logger,
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      defaultCleaners: buildDefaultComponentCleaners(logger),
    });
  });
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.ComponentCleaningService)}.`
  );

  registrar.single(tokens.SaveMetadataBuilder, SaveMetadataBuilder, [
    tokens.ILogger,
  ]);
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.SaveMetadataBuilder)}.`
  );

  registrar.single(
    tokens.ActiveModsManifestBuilder,
    ActiveModsManifestBuilder,
    [tokens.ILogger, tokens.IDataRegistry]
  );
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.ActiveModsManifestBuilder)}.`
  );

  registrar.singletonFactory(tokens.GameStateCaptureService, (c) => {
    return new GameStateCaptureService({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      playtimeTracker: c.resolve(tokens.PlaytimeTracker),
      componentCleaningService: c.resolve(tokens.ComponentCleaningService),
      metadataBuilder: c.resolve(tokens.SaveMetadataBuilder),
      activeModsManifestBuilder: c.resolve(tokens.ActiveModsManifestBuilder),
    });
  });
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.GameStateCaptureService)}.`
  );

  registrar.singletonFactory(tokens.ManualSaveCoordinator, (c) => {
    return new ManualSaveCoordinator({
      logger: c.resolve(tokens.ILogger),
      gameStateCaptureService: c.resolve(tokens.GameStateCaptureService),
      saveLoadService: c.resolve(tokens.ISaveLoadService),
    });
  });
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.ManualSaveCoordinator)}.`
  );

  registrar.singletonFactory(tokens.GamePersistenceService, (c) => {
    return new GamePersistenceService({
      logger: c.resolve(tokens.ILogger),
      saveLoadService: c.resolve(tokens.ISaveLoadService),
      entityManager: c.resolve(tokens.IEntityManager),
      playtimeTracker: c.resolve(tokens.PlaytimeTracker),
      gameStateCaptureService: c.resolve(tokens.GameStateCaptureService),
      manualSaveCoordinator: c.resolve(tokens.ManualSaveCoordinator),
      gameStateRestorer: new GameStateRestorer({
        logger: c.resolve(tokens.ILogger),
        entityManager: c.resolve(tokens.IEntityManager),
        playtimeTracker: c.resolve(tokens.PlaytimeTracker),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      }),
    });
  });
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.GamePersistenceService)}.`
  );

  // registrar.singletonFactory(tokens.IReferenceResolver, (c) => { // Removed - service is deprecated
  //   return new ReferenceResolver({
  //     entityManager: c.resolve(tokens.IEntityManager),
  //     logger: c.resolve(tokens.ILogger),
  //   });
  // });
  // logger.debug(
  //   `Persistence Registration: Registered ${String(tokens.IReferenceResolver)}.`
  // );

  logger.debug('Persistence Registration: Completed.');
}
