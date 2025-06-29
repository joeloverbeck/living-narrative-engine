import { describe, it, expect } from '@jest/globals';
import {
  _translateSerializedError,
  _translateInvalidInstanceError,
  _translateDuplicateEntityError,
} from '../../../../src/entities/services/errorTranslator.js';
import { SerializedEntityError } from '../../../../src/errors/serializedEntityError.js';
import { InvalidInstanceIdError } from '../../../../src/errors/invalidInstanceIdError.js';
import { DuplicateEntityError } from '../../../../src/errors/duplicateEntityError.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';

describe('_translateSerializedError', () => {
  it('translates SerializedEntityError instances', () => {
    const logger = createMockLogger();
    const err = new SerializedEntityError('bad');
    const result = _translateSerializedError(err, logger);
    expect(result).toBeInstanceOf(SerializedEntityError);
    expect(result.message).toContain(
      'serializedEntity data is missing or invalid'
    );
  });

  it('translates factory serialization messages', () => {
    const logger = createMockLogger();
    const err = new Error(
      'EntityFactory.reconstruct: serializedEntity data is missing or invalid.'
    );
    const result = _translateSerializedError(err, logger);
    expect(result).toBeInstanceOf(SerializedEntityError);
  });

  it('returns null for unrelated errors', () => {
    const logger = createMockLogger();
    const result = _translateSerializedError(new Error('oops'), logger);
    expect(result).toBeNull();
  });
});

describe('_translateInvalidInstanceError', () => {
  it('translates InvalidInstanceIdError instances', () => {
    const logger = createMockLogger();
    const err = new InvalidInstanceIdError('bad');
    const result = _translateInvalidInstanceError(err, logger);
    expect(result).toBeInstanceOf(InvalidInstanceIdError);
    expect(result.message).toContain('instanceId is missing or invalid');
  });

  it('translates factory invalid instance messages', () => {
    const logger = createMockLogger();
    const err = new Error(
      'EntityFactory.reconstruct: instanceId is missing or invalid in serialized data.'
    );
    const result = _translateInvalidInstanceError(err, logger);
    expect(result).toBeInstanceOf(InvalidInstanceIdError);
  });

  it('returns null for unrelated errors', () => {
    const logger = createMockLogger();
    const result = _translateInvalidInstanceError(new Error('oops'), logger);
    expect(result).toBeNull();
  });
});

describe('_translateDuplicateEntityError', () => {
  it('translates factory reconstruction duplicate messages', () => {
    const logger = createMockLogger();
    const err = new Error(
      "EntityFactory.reconstruct: Entity with ID 'foo' already exists."
    );
    const result = _translateDuplicateEntityError(err, logger);
    expect(result).toBeInstanceOf(DuplicateEntityError);
    expect(result.message).toContain('reconstructEntity');
  });

  it('translates DuplicateEntityError instances', () => {
    const logger = createMockLogger();
    const err = new DuplicateEntityError('foo');
    const result = _translateDuplicateEntityError(err, logger);
    expect(result).toBeInstanceOf(DuplicateEntityError);
    expect(result.message).toContain('createEntityInstance');
  });

  it('translates generic duplicate messages', () => {
    const logger = createMockLogger();
    const err = new Error("Entity with ID 'bar' already exists.");
    const result = _translateDuplicateEntityError(err, logger);
    expect(result).toBeInstanceOf(DuplicateEntityError);
    expect(result.message).toContain('createEntityInstance');
  });

  it('returns null for unrelated errors', () => {
    const logger = createMockLogger();
    const result = _translateDuplicateEntityError(new Error('nothing'), logger);
    expect(result).toBeNull();
  });
});
