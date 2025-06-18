import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameStateCaptureService from '../../src/persistence/gameStateCaptureService.js';
import { createMockLogger } from '../testUtils.js';

describe('GameStateCaptureService persistence tests', () => {
  let logger;
  let entityManager;
  let playtimeTracker;
  let componentCleaningService;
  let metadataBuilder;
  let activeModsManifestBuilder;
  let service;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = { activeEntities: new Map() };
    playtimeTracker = { getTotalPlaytime: jest.fn().mockReturnValue(0) };
    componentCleaningService = {
      clean: jest.fn((id, data) => ({ cleaned: id })),
    };
    metadataBuilder = {
      build: jest.fn(() => ({
        saveFormatVersion: '1',
        engineVersion: 'x',
        gameTitle: 'Meta',
        timestamp: 't',
        playtimeSeconds: 0,
        saveName: '',
      })),
    };
    activeModsManifestBuilder = { build: jest.fn(() => []) };
    service = new GameStateCaptureService({
      logger,
      entityManager,
      playtimeTracker,
      componentCleaningService,
      metadataBuilder,
      activeModsManifestBuilder,
    });
  });

  it('returns cleaned components and metadata', () => {
    const entity = {
      id: 'e1',
      definitionId: 'core:test',
      componentEntries: new Map([['comp', { foo: 'bar' }]]),
    };
    entityManager.activeEntities.set('e1', entity);

    const result = service.captureCurrentGameState('World');

    expect(componentCleaningService.clean).toHaveBeenCalledWith('comp', {
      foo: 'bar',
    });
    expect(result.gameState.entities).toEqual([
      {
        instanceId: 'e1',
        definitionId: 'core:test',
        components: { comp: { cleaned: 'comp' } },
      },
    ]);
    expect(result.metadata.gameTitle).toBe('Meta');
  });
});
