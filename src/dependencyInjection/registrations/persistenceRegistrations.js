/**
 * @file Registers services related to game state persistence, including saving, loading, and reference resolution.
 * @see src/dependencyInjection/registrations/persistenceRegistrations.js
 */

/* eslint-env node */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker */
/** @typedef {import('../../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService_Interface */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry_Interface */
/** @typedef {import('../../interfaces/IStorageProvider.js').IStorageProvider} IStorageProvider */
/** @typedef {import('../../interfaces/IReferenceResolver.js').IReferenceResolver} IReferenceResolver_Interface */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';

// --- Service Imports ---
import PlaytimeTracker from '../../engine/playtimeTracker.js';
import ComponentCleaningService, {
  buildDefaultComponentCleaners,
} from '../../persistence/componentCleaningService.js';
import GamePersistenceService from '../../persistence/gamePersistenceService.js';
import GameStateCaptureService from '../../persistence/gameStateCaptureService.js';
import SaveMetadataBuilder from '../../persistence/saveMetadataBuilder.js';
import ActiveModsManifestBuilder from '../../persistence/activeModsManifestBuilder.js';
import ReferenceResolver from '../../initializers/services/referenceResolver.js';
import SaveLoadService from '../../persistence/saveLoadService.js';
import GameStateSerializer from '../../persistence/gameStateSerializer.js';
import SaveFileRepository from '../../persistence/saveFileRepository.js';
import { BrowserStorageProvider } from '../../storage/browserStorageProvider.js';

/**
 * Registers persistence-related services.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerPersistence(container) {
  const r = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Persistence Registration: Starting...');

  r.single(tokens.IStorageProvider, BrowserStorageProvider, [
    tokens.ILogger,
    tokens.ISafeEventDispatcher,
  ]);
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.IStorageProvider)}.`
  );

  r.singletonFactory(tokens.SaveFileRepository, (c) => {
    return new SaveFileRepository({
      logger: c.resolve(tokens.ILogger),
      storageProvider: c.resolve(tokens.IStorageProvider),
      serializer: new GameStateSerializer({
        logger: c.resolve(tokens.ILogger),
      }),
    });
  });
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.SaveFileRepository)}.`
  );

  r.single(tokens.ISaveLoadService, SaveLoadService, [
    tokens.ILogger,
    tokens.SaveFileRepository,
  ]);
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.ISaveLoadService)}.`
  );

  r.single(tokens.PlaytimeTracker, PlaytimeTracker, [
    tokens.ILogger,
    tokens.ISafeEventDispatcher,
  ]);
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.PlaytimeTracker)}.`
  );

  r.singletonFactory(tokens.ComponentCleaningService, (c) => {
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

  r.single(tokens.SaveMetadataBuilder, SaveMetadataBuilder, [tokens.ILogger]);
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.SaveMetadataBuilder)}.`
  );

  r.single(tokens.ActiveModsManifestBuilder, ActiveModsManifestBuilder, [
    tokens.ILogger,
    tokens.IDataRegistry,
  ]);
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.ActiveModsManifestBuilder)}.`
  );

  r.singletonFactory(tokens.GameStateCaptureService, (c) => {
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

  r.singletonFactory(tokens.GamePersistenceService, (c) => {
    return new GamePersistenceService({
      logger: c.resolve(tokens.ILogger),
      saveLoadService: c.resolve(tokens.ISaveLoadService),
      entityManager: c.resolve(tokens.IEntityManager),
      playtimeTracker: c.resolve(tokens.PlaytimeTracker),
      gameStateCaptureService: c.resolve(tokens.GameStateCaptureService),
    });
  });
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.GamePersistenceService)}.`
  );

  r.singletonFactory(tokens.IReferenceResolver, (c) => {
    return new ReferenceResolver({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `Persistence Registration: Registered ${String(tokens.IReferenceResolver)}.`
  );

  logger.debug('Persistence Registration: Completed.');
}
