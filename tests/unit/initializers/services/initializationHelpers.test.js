import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { buildActionIndex } from '../../../../src/initializers/services/initHelpers.js';

describe('InitializationService helper functions', () => {
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
