import { jest } from '@jest/globals';
import { createSimpleMock } from './coreServices.js';
import { createEventBus, createMockValidatedEventBus, createCapturingEventBus } from './eventBus.js';

export const createMockSafeEventDispatcher = () =>
  createSimpleMock(['dispatch']);

export const createMockValidatedEventDispatcher = () =>
  createSimpleMock(['dispatch'], {
    dispatch: jest.fn().mockResolvedValue(undefined),
  });

// Re-export the unified event bus implementations
export { createEventBus, createMockValidatedEventBus, createCapturingEventBus };

export const createMockValidatedEventDispatcherForIntegration = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
  subscribe: jest.fn().mockReturnValue(() => {}),
  unsubscribe: jest.fn(),
});
