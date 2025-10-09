import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SaveMetadataBuilder from '../../../src/persistence/saveMetadataBuilder.js';
import { ENGINE_VERSION } from '../../../src/engine/engineVersion.js';

describe('SaveMetadataBuilder', () => {
  let logger;
  let builder;
  let timeProvider;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    timeProvider = jest.fn(() => new Date('2023-01-01T00:00:00Z'));
    builder = new SaveMetadataBuilder({ logger, timeProvider });
  });

  it('builds metadata with provided parameters', () => {
    const meta = builder.build('World', 12);
    expect(meta.gameTitle).toBe('World');
    expect(meta.playtimeSeconds).toBe(12);
    expect(meta.engineVersion).toBe(ENGINE_VERSION);
    expect(meta.saveFormatVersion).toBe('1.0.0');
    expect(meta.timestamp).toBe('2023-01-01T00:00:00.000Z');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('defaults world name and logs warning when missing', () => {
    const meta = builder.build(undefined, 5);
    expect(meta.gameTitle).toBe('Unknown Game');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('honors overridden versions when provided', () => {
    const customLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const customTimeProvider = jest.fn(() => new Date('2024-05-05T12:00:00Z'));
    const customBuilder = new SaveMetadataBuilder({
      logger: customLogger,
      timeProvider: customTimeProvider,
      engineVersion: 'test-engine',
      saveFormatVersion: '2.5.0',
    });

    const result = customBuilder.build('Custom World', 42, 'override-engine');

    expect(result).toMatchObject({
      engineVersion: 'override-engine',
      saveFormatVersion: '2.5.0',
      gameTitle: 'Custom World',
      playtimeSeconds: 42,
    });
    expect(result.timestamp).toBe('2024-05-05T12:00:00.000Z');
    expect(customTimeProvider).toHaveBeenCalled();
    expect(customLogger.warn).not.toHaveBeenCalled();
  });

  it('throws when constructed without a logger', () => {
    expect(() => new SaveMetadataBuilder({})).toThrow(
      'SaveMetadataBuilder requires a logger.'
    );
  });

  it('falls back to default time provider when omitted', () => {
    jest.useFakeTimers({ now: new Date('2025-02-02T08:30:00Z') });

    const builderWithDefaults = new SaveMetadataBuilder({ logger });
    const meta = builderWithDefaults.build('Default World', 7);

    expect(meta.timestamp).toBe('2025-02-02T08:30:00.000Z');
    jest.useRealTimers();
  });
});
