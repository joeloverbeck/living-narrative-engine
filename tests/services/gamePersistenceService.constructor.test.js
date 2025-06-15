import { describe, test, expect, jest } from '@jest/globals';
import GamePersistenceService from '../../src/persistence/gamePersistenceService.js';

/**
 *
 */
function makeDeps() {
  return {
    logger: { debug: jest.fn(), error: jest.fn() },
    saveLoadService: {},
    entityManager: {},
    dataRegistry: {},
    playtimeTracker: {},
    componentCleaningService: { clean: jest.fn() },
    metadataBuilder: { build: jest.fn() },
  };
}

describe('GamePersistenceService constructor validation', () => {
  const required = [
    'logger',
    'saveLoadService',
    'entityManager',
    'dataRegistry',
    'playtimeTracker',
    'componentCleaningService',
    'metadataBuilder',
  ];

  test.each(required)('throws if %s is missing', (prop) => {
    const deps = makeDeps();
    delete deps[prop];
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    expect(() => new GamePersistenceService(deps)).toThrow();
    const calledSpy = prop === 'logger' ? consoleSpy : deps.logger.error;
    expect(calledSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
