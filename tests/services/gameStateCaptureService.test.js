import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameStateCaptureService from '../../src/persistence/gameStateCaptureService.js';
import { CURRENT_ACTOR_COMPONENT_ID } from '../../src/constants/componentIds.js';
import { createMockLogger } from '../testUtils.js';

describe('GameStateCaptureService', () => {
  let logger;
  let entityManager;
  let dataRegistry;
  let playtimeTracker;
  let componentCleaningService;
  let metadataBuilder;
  let captureService;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = { activeEntities: new Map() };
    dataRegistry = { getAll: jest.fn().mockReturnValue([]) };
    playtimeTracker = { getTotalPlaytime: jest.fn().mockReturnValue(0) };
    componentCleaningService = { clean: jest.fn() };
    metadataBuilder = {
      build: jest.fn(() => ({
        saveFormatVersion: '1',
        engineVersion: 'x',
        gameTitle: 'Test',
        timestamp: 't',
        playtimeSeconds: 0,
        saveName: '',
      })),
    };
    captureService = new GameStateCaptureService({
      logger,
      entityManager,
      dataRegistry,
      playtimeTracker,
      componentCleaningService,
      metadataBuilder,
    });
  });

  it('skips empty object components and keeps meaningful data', () => {
    const entity = {
      id: 'e1',
      definitionId: 'core:test',
      componentEntries: new Map(
        Object.entries({
          empty: { foo: 'bar' },
          object: { val: 1 },
          primitive: 7,
          nullComp: null,
          [CURRENT_ACTOR_COMPONENT_ID]: { active: true },
        })
      ),
    };
    entityManager.activeEntities.set('e1', entity);

    componentCleaningService.clean.mockImplementation((id, data) => {
      if (id === 'empty') return {};
      if (id === 'object') return { val: 1 };
      if (id === 'primitive') return 7;
      if (id === 'nullComp') return null;
      return data;
    });

    const result = captureService.captureCurrentGameState('World');
    const comps = result.gameState.entities[0].components;

    expect(comps).not.toHaveProperty('empty');
    expect(comps).toHaveProperty('object', { val: 1 });
    expect(comps).toHaveProperty('primitive', 7);
    expect(comps).not.toHaveProperty('nullComp');
    expect(comps).not.toHaveProperty(CURRENT_ACTOR_COMPONENT_ID);
  });
});
