// tests/persistence/gameStateCaptureService.test.js
// --- FILE START ---

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
  let captureService;

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = { activeEntities: new Map() };
    playtimeTracker = { getTotalPlaytime: jest.fn().mockReturnValue(123) };
    componentCleaningService = { clean: jest.fn((id, data) => data) };
    metadataBuilder = {
      build: jest.fn(() => ({
        saveFormatVersion: '1',
        engineVersion: 'x',
        gameTitle: 'Test',
        timestamp: 't',
        playtimeSeconds: 123,
      })),
    };
    activeModsManifestBuilder = { build: jest.fn().mockReturnValue([]) };
    captureService = new GameStateCaptureService({
      logger,
      entityManager,
      playtimeTracker,
      componentCleaningService,
      metadataBuilder,
      activeModsManifestBuilder,
    });
  });

  it('returns cleaned components and metadata', () => {
    // Arrange: Set up a mock entity and mock the behavior of dependencies
    const mockEntity = {
      id: 'e1',
      definitionId: 'core:test',
      componentEntries: new Map([['comp', { raw: 'data' }]]),
    };
    entityManager.activeEntities.set(mockEntity.id, mockEntity);

    componentCleaningService.clean.mockReturnValue({ cleaned: 'comp' });
    metadataBuilder.build.mockReturnValue({
      foo: 'bar',
    });

    // Act: Call the method under test
    const result = captureService.captureCurrentGameState('TestWorld');

    // Assert: Check that the output matches the expected structure
    expect(result.gameState.entities).toEqual([
      {
        instanceId: 'e1',
        definitionId: 'core:test',
        // FIXED: The test now correctly expects the 'overrides' property
        overrides: {
          comp: {
            cleaned: 'comp',
          },
        },
      },
    ]);

    // Also verify that the metadata was built correctly
    expect(metadataBuilder.build).toHaveBeenCalledWith('TestWorld', 123);
    expect(result.metadata).toEqual({
      foo: 'bar',
    });
  });
});
// --- FILE END ---