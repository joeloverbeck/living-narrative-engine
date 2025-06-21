import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameStateCaptureService from '../../../src/persistence/gameStateCaptureService.js';
import { CURRENT_ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { createMockEntityManager } from '../../common/mockFactories.js';

describe('GameStateCaptureService additional coverage', () => {
  let logger;
  let entityManager;
  let playtimeTracker;
  let componentCleaningService;
  let metadataBuilder;
  let activeModsManifestBuilder;
  let service;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    entityManager = createMockEntityManager();
    playtimeTracker = { getTotalPlaytime: jest.fn().mockReturnValue(5) };
    componentCleaningService = { clean: jest.fn((id, data) => data) };
    metadataBuilder = {
      build: jest.fn(() => ({
        saveFormatVersion: '1',
        engineVersion: 'x',
        gameTitle: 'Test',
        timestamp: 't',
        playtimeSeconds: 5,
        saveName: '',
      })),
    };
    activeModsManifestBuilder = {
      build: jest.fn(() => [{ modId: 'core', version: '1.0.0' }]),
    };
    service = new GameStateCaptureService({
      logger,
      entityManager,
      playtimeTracker,
      componentCleaningService,
      metadataBuilder,
      activeModsManifestBuilder,
    });
  });

  it('delegates to ActiveModsManifestBuilder', () => {
    service.captureCurrentGameState('World');
    expect(activeModsManifestBuilder.build).toHaveBeenCalled();
  });

  it('passes playtime to metadata builder', () => {
    service.captureCurrentGameState('World');
    expect(metadataBuilder.build).toHaveBeenCalledWith('World', 5);
  });
});
