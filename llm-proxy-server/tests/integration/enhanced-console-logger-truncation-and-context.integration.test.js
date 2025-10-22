import { getEnhancedConsoleLogger } from '../../src/logging/enhancedConsoleLogger.js';
import { getLoggerConfiguration } from '../../src/logging/loggerConfiguration.js';

describe('Enhanced console logger truncation and context integration', () => {
  let logger;
  let configuration;
  let originalConfig;

  beforeAll(() => {
    logger = getEnhancedConsoleLogger();
    configuration = getLoggerConfiguration();
  });

  beforeEach(() => {
    originalConfig = configuration.getConfig();
  });

  afterEach(() => {
    configuration.updateConfig(originalConfig);
    jest.restoreAllMocks();
  });

  it('truncates info messages while formatting multiline context and details', () => {
    configuration.updateConfig({
      maxMessageLength: 25,
      showContext: true,
      prettyFormat: true,
      enableIcons: false,
      enableColors: false,
    });

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const message = `CacheService: ${'A'.repeat(60)}`;
    const context = {
      scope: 'cache.write',
      metadata: {
        attempt: 2,
        errors: ['timeout', 'retry'],
      },
    };
    const details = { branch: 'multiline-context' };

    logger.info(message, context, details);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [output] = infoSpy.mock.calls[0];
    const [mainLine, ...contextLines] = output.split('\n');

    expect(mainLine).toContain('CacheService');
    expect(mainLine).toContain('...');
    expect(contextLines.some((line) => line.includes('↳ Context: {'))).toBe(true);
    expect(contextLines.some((line) => line.includes('metadata'))).toBe(true);
    expect(contextLines.some((line) => line.includes('↳ Details[0]:'))).toBe(true);
  });

  it('avoids truncation for warn level messages and reports context serialization issues', () => {
    configuration.updateConfig({
      maxMessageLength: 12,
      showContext: true,
      prettyFormat: true,
      enableIcons: false,
      enableColors: false,
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const message = `HttpAgentService: ${'B'.repeat(40)}`;
    const context = {
      requestId: 'abc-123',
      payload: { size: 42n },
    };

    logger.warn(message, context);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [output] = warnSpy.mock.calls[0];
    const [mainLine, ...contextLines] = output.split('\n');

    expect(mainLine).toContain('HttpAgentService');
    expect(mainLine).not.toContain('...');
    expect(
      contextLines.some((line) => line.includes('↳ Context: [Unable to format'))
    ).toBe(true);
  });

  it('disables truncation when configured maximum length is non-positive', () => {
    configuration.updateConfig({
      maxMessageLength: 0,
      showContext: true,
      prettyFormat: true,
      enableIcons: false,
      enableColors: false,
    });

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const message = `TraceRoutes: ${'C'.repeat(50)}`;
    logger.info(message, { detail: 'retained' });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [output] = infoSpy.mock.calls[0];
    const mainLine = output.split('\n')[0];

    expect(mainLine).toContain('TraceRoutes');
    expect(mainLine).not.toContain('...');
  });
});
