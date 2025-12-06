import { beforeEach, describe, expect, it } from '@jest/globals';

var mockResolveStructure;
var mockExtractContextPath;

jest.mock('../../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: jest.fn(),
}));

jest.mock('../../../src/utils/placeholderSources.js', () => ({
  buildResolutionSources: jest.fn(),
}));

jest.mock('../../../src/utils/placeholderPathResolver.js', () => {
  mockExtractContextPath = jest.fn();
  return {
    resolvePlaceholderPath: jest.fn(),
    extractContextPath: mockExtractContextPath,
  };
});

jest.mock('../../../src/utils/placeholderResolverUtils.js', () => {
  mockResolveStructure = jest.fn();
  return {
    PlaceholderResolver: jest.fn().mockImplementation(() => ({
      resolveStructure: mockResolveStructure,
    })),
  };
});

import {
  ExecutionPlaceholderResolver,
  extractContextPath as exportedExtractContextPath,
} from '../../../src/utils/executionPlaceholderResolver.js';
import { ensureValidLogger } from '../../../src/utils/loggerUtils.js';
import { buildResolutionSources } from '../../../src/utils/placeholderSources.js';
import { resolvePlaceholderPath } from '../../../src/utils/placeholderPathResolver.js';
import { PlaceholderResolver } from '../../../src/utils/placeholderResolverUtils.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ExecutionPlaceholderResolver context-aware behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveStructure.mockReset();
    mockResolveStructure.mockReturnValue('resolved-structure');
    mockExtractContextPath.mockReset();
    buildResolutionSources.mockReset();
    buildResolutionSources.mockReturnValue({ sources: [], fallback: {} });
    resolvePlaceholderPath.mockReset();
    resolvePlaceholderPath.mockReturnValue('path-value');
  });

  const instantiateResolver = () => {
    const providedLogger = createMockLogger();
    const validatedLogger = createMockLogger();
    ensureValidLogger.mockReturnValue(validatedLogger);

    const resolver = new ExecutionPlaceholderResolver(providedLogger);

    return {
      resolver,
      providedLogger,
      validatedLogger,
      wrappedLogger: PlaceholderResolver.mock.calls[0][0],
    };
  };

  it('wraps the logger to suppress context warnings while forwarding other messages', () => {
    const { wrappedLogger, providedLogger, validatedLogger } =
      instantiateResolver();

    expect(ensureValidLogger).toHaveBeenCalledWith(
      providedLogger,
      'ExecutionPlaceholderResolver'
    );
    expect(PlaceholderResolver).toHaveBeenCalledTimes(1);
    expect(wrappedLogger).not.toBe(validatedLogger);

    wrappedLogger.debug('debug-message', 42);
    wrappedLogger.info('info-message');
    wrappedLogger.error('error-message', { code: 500 });

    expect(validatedLogger.debug).toHaveBeenCalledWith('debug-message', 42);
    expect(validatedLogger.info).toHaveBeenCalledWith('info-message');
    expect(validatedLogger.error).toHaveBeenCalledWith('error-message', {
      code: 500,
    });

    wrappedLogger.warn(
      'executionContext.evaluationContext.context is missing or invalid'
    );
    wrappedLogger.warn('Cannot resolve placeholder path "context.someValue"');
    expect(validatedLogger.warn).not.toHaveBeenCalled();

    wrappedLogger.warn({ text: 'non-string warning payload' });
    wrappedLogger.warn('different warning');

    expect(validatedLogger.warn).toHaveBeenNthCalledWith(1, {
      text: 'non-string warning payload',
    });
    expect(validatedLogger.warn).toHaveBeenNthCalledWith(
      2,
      'different warning'
    );
  });

  it('resolves placeholder paths using the wrapped logger and default log path', () => {
    const { resolver, wrappedLogger } = instantiateResolver();

    const context = { actor: { id: 'actor-42' } };
    const firstResult = resolver.resolvePathFromContext('actor.id', context);

    expect(firstResult).toBe('path-value');
    expect(resolvePlaceholderPath).toHaveBeenCalledWith(
      'actor.id',
      context,
      wrappedLogger,
      ''
    );

    resolver.resolvePathFromContext('context.stats', context, 'trace.id');
    expect(resolvePlaceholderPath).toHaveBeenLastCalledWith(
      'context.stats',
      context,
      wrappedLogger,
      'trace.id'
    );
  });

  it('builds resolution sources and forwards skip keys to the resolver', () => {
    const sources = [{ scope: 'primary' }];
    const fallback = { scope: 'fallback' };
    buildResolutionSources.mockReturnValue({ sources, fallback });
    mockResolveStructure.mockReturnValue('final-value');

    const { resolver } = instantiateResolver();

    const executionContext = { evaluationContext: { context: { value: 7 } } };
    const skipKeys = new Set(['secret']);
    const structure = { text: 'Value is {{context.value}}' };

    const resolved = resolver.resolveFromContext(structure, executionContext, {
      skipKeys,
    });

    expect(buildResolutionSources).toHaveBeenCalledWith(executionContext);
    expect(mockResolveStructure).toHaveBeenCalledWith(
      structure,
      sources,
      fallback,
      skipKeys
    );
    expect(resolved).toBe('final-value');
  });

  it('defaults skip keys to undefined when options are omitted', () => {
    const { resolver } = instantiateResolver();

    const payload = 'No placeholders';
    const executionContext = { actor: { id: 'no-skip' } };

    resolver.resolveFromContext(payload, executionContext);

    expect(mockResolveStructure).toHaveBeenCalledWith(
      payload,
      [],
      {},
      undefined
    );
  });

  it('proxies buildSources to buildResolutionSources', () => {
    const proxyResult = { sources: ['s'], fallback: { note: true } };
    buildResolutionSources.mockReturnValue(proxyResult);

    const { resolver } = instantiateResolver();
    const context = { evaluationContext: {} };

    const result = resolver.buildSources(context);

    expect(buildResolutionSources).toHaveBeenCalledWith(context);
    expect(result).toBe(proxyResult);
  });

  it('re-exports extractContextPath from placeholderPathResolver', () => {
    mockExtractContextPath.mockReturnValue('context.path');

    const result = exportedExtractContextPath('context.some.path');

    expect(mockExtractContextPath).toHaveBeenCalledWith('context.some.path');
    expect(result).toBe('context.path');
  });
});
