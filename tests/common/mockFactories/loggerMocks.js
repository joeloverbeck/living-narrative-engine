import { createSimpleMock } from './coreServices.js';

export const createMockLogger = () =>
  createSimpleMock([
    // Core ILogger methods
    'info',
    'warn',
    'error',
    'debug',
    // Extended ConsoleLogger methods
    'groupCollapsed',
    'groupEnd',
    'table',
    'setLogLevel',
  ]);
