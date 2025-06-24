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
});
