/**
 * @file Unit tests for the ChecksumService class.
 */

import { describe, it, expect, jest } from '@jest/globals';
import ChecksumService from '../../../src/persistence/checksumService.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from '../../../src/persistence/persistenceErrors.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ChecksumService', () => {
  it('generates a hex checksum for Uint8Array input', async () => {
    const logger = createLogger();
    const digestMock = jest
      .fn()
      .mockResolvedValue(new Uint8Array([0x00, 0x01, 0x02, 0xfe]).buffer);
    const crypto = { subtle: { digest: digestMock } };
    const service = new ChecksumService({ logger, crypto });

    const payload = new Uint8Array([5, 6, 7]);
    const checksum = await service.generateChecksum(payload);

    expect(checksum).toBe('000102fe');
    expect(digestMock).toHaveBeenCalledTimes(1);
    expect(digestMock).toHaveBeenCalledWith('SHA-256', payload);
    expect(digestMock.mock.calls[0][1]).toBe(payload);
  });

  it('encodes string input using UTF-8 before hashing', async () => {
    const logger = createLogger();
    const digestMock = jest
      .fn()
      .mockResolvedValue(new Uint8Array([0xab, 0xcd]).buffer);
    const crypto = { subtle: { digest: digestMock } };
    const service = new ChecksumService({ logger, crypto });

    const checksum = await service.generateChecksum('hello world');

    expect(checksum).toBe('abcd');
    const inputBuffer = digestMock.mock.calls[0][1];
    const decoded = new TextDecoder().decode(inputBuffer);
    expect(decoded).toBe('hello world');
  });

  it('stringifies non-string input before hashing', async () => {
    const logger = createLogger();
    const digestMock = jest
      .fn()
      .mockResolvedValue(new Uint8Array([0xff]).buffer);
    const crypto = { subtle: { digest: digestMock } };
    const service = new ChecksumService({ logger, crypto });

    const payload = { id: 42, name: 'Test' };
    const checksum = await service.generateChecksum(payload);

    expect(checksum).toBe('ff');
    const inputBuffer = digestMock.mock.calls[0][1];
    const decoded = new TextDecoder().decode(inputBuffer);
    expect(decoded).toBe(JSON.stringify(payload));
  });

  it('uses global crypto implementation when none is provided', async () => {
    const logger = createLogger();
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'crypto'
    );
    const digestMock = jest
      .fn()
      .mockResolvedValue(new Uint8Array([0x12, 0x34]).buffer);
    const globalCrypto = { subtle: { digest: digestMock } };

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: globalCrypto,
    });

    try {
      const service = new ChecksumService({ logger });
      const checksum = await service.generateChecksum('global source');

      expect(checksum).toBe('1234');
      expect(digestMock).toHaveBeenCalledTimes(1);
      const inputBuffer = digestMock.mock.calls[0][1];
      expect(new TextDecoder().decode(inputBuffer)).toBe('global source');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'crypto', originalDescriptor);
      } else {
        delete globalThis.crypto;
      }
    }
  });

  it('wraps digest failures in a PersistenceError and logs details', async () => {
    const logger = createLogger();
    const digestError = new Error('boom');
    const digestMock = jest.fn().mockRejectedValue(digestError);
    const crypto = { subtle: { digest: digestMock } };
    const service = new ChecksumService({ logger, crypto });

    let caughtError;
    try {
      await service.generateChecksum('fail');
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(PersistenceError);
    expect(caughtError.code).toBe(
      PersistenceErrorCodes.CHECKSUM_GENERATION_FAILED
    );
    expect(caughtError.message).toBe(
      `Checksum generation failed: ${digestError.message}`
    );
    expect(logger.error).toHaveBeenCalledWith(
      'ChecksumService: Error generating checksum using Web Crypto API:',
      digestError
    );
    expect(digestMock).toHaveBeenCalledTimes(1);
  });
});
