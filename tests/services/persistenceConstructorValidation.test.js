import { describe, it, expect, jest } from '@jest/globals';
import GameStateCaptureService from '../../src/persistence/gameStateCaptureService.js';
import ManualSaveCoordinator from '../../src/persistence/manualSaveCoordinator.js';
import SaveLoadService from '../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../src/persistence/saveFileRepository.js';
import {
  createMockLogger,
  createMockSaveValidationService,
} from '../testUtils.js';

/**
 * Minimal serializer stub for SaveLoadService and SaveFileRepository.
 */
const serializer = {};

describe('Persistence service constructor validation', () => {
  it('GameStateCaptureService validates required methods', () => {
    const logger = createMockLogger();
    const entityManager = { activeEntities: new Map() };
    const playtimeTracker = {}; // missing getTotalPlaytime
    const componentCleaningService = { clean: jest.fn() };
    const metadataBuilder = { build: jest.fn() };
    const activeModsManifestBuilder = { build: jest.fn() };
    expect(
      () =>
        new GameStateCaptureService({
          logger,
          entityManager,
          playtimeTracker,
          componentCleaningService,
          metadataBuilder,
          activeModsManifestBuilder,
        })
    ).toThrow();
  });

  it('ManualSaveCoordinator validates dependencies', () => {
    const logger = createMockLogger();
    const gameStateCaptureService = {}; // missing captureCurrentGameState
    const saveLoadService = { saveManualGame: jest.fn() };
    expect(
      () =>
        new ManualSaveCoordinator({
          logger,
          gameStateCaptureService,
          saveLoadService,
        })
    ).toThrow();
  });

  it('SaveLoadService validates repository methods', () => {
    const logger = createMockLogger();
    const saveFileRepository = {}; // missing required methods
    const validationService = createMockSaveValidationService();
    expect(
      () =>
        new SaveLoadService({
          logger,
          saveFileRepository,
          gameStateSerializer: serializer,
          saveValidationService: validationService,
        })
    ).toThrow();
  });

  it('SaveFileRepository validates storage provider', () => {
    const logger = createMockLogger();
    const storageProvider = {}; // missing required methods
    expect(
      () => new SaveFileRepository({ logger, storageProvider, serializer })
    ).toThrow();
  });
});
