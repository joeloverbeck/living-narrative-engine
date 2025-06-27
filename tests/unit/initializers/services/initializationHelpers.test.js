import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  validateWorldName,
  buildActionIndex,
} from '../../../../src/initializers/services/initHelpers.js';

describe('InitializationService helper functions', () => {
  describe('validateWorldName', () => {
    let logger;
    beforeEach(() => {
      logger = { error: jest.fn() };
    });

    it('does nothing for a valid name', () => {
      expect(() => validateWorldName('world', logger)).not.toThrow();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it.each([[null], [undefined], [''], ['   ']])('throws for %p', (bad) => {
      expect(() => validateWorldName(bad, logger)).toThrow(TypeError);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('buildActionIndex', () => {
    let logger;
    let repo;
    let index;
    beforeEach(() => {
      logger = { debug: jest.fn() };
      repo = { getAllActionDefinitions: jest.fn().mockReturnValue(['a']) };
      index = { buildIndex: jest.fn() };
    });

    it('builds the index using repository data', () => {
      buildActionIndex(index, repo, logger);
      expect(repo.getAllActionDefinitions).toHaveBeenCalled();
      expect(index.buildIndex).toHaveBeenCalledWith(['a']);
      expect(logger.debug).toHaveBeenCalled();
    });

    it('throws when dependencies are invalid', () => {
      expect(() => buildActionIndex({}, repo, logger)).toThrow(Error);
      expect(() => buildActionIndex(index, {}, logger)).toThrow(Error);
    });
  });
});
