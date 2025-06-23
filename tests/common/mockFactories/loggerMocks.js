import { createSimpleMock } from './coreServices.js';

export const createMockLogger = () =>
  createSimpleMock(['info', 'warn', 'error', 'debug']);
