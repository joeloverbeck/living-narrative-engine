import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

// Additional tests focused on rarely executed branches

describe('AnatomyInitializationService coverage additions', () => {
  let service;
  let mockEventDispatcher;
  let mockLogger;
  let mockAnatomyGenerationService;

  beforeEach(() => {
    mockEventDispatcher = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockAnatomyGenerationService = {
      generateAnatomyIfNeeded: jest.fn().mockResolvedValue(false),
    };
    service = new AnatomyInitializationService({
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
      anatomyGenerationService: mockAnatomyGenerationService,
    });
  });

  it('destroy should handle missing unsubscribe function gracefully', () => {
    // Subscribe returns undefined which leaves #unsubscribeEntityCreated falsy
    mockEventDispatcher.subscribe.mockReturnValueOnce(undefined);

    service.initialize();

    // Calling dispose should not throw even though unsubscribe fn is missing
    expect(() => service.destroy()).not.toThrow();

    // After disposal we can initialize again meaning internal state reset
    service.initialize();

    expect(mockEventDispatcher.subscribe).toHaveBeenCalledTimes(2);
    // The debug log for "Removing event listeners" was removed from production code
    // Only the info log for "Destroyed" remains
    expect(mockLogger.info).toHaveBeenCalledWith(
      'AnatomyInitializationService: Destroyed'
    );
  });
});
