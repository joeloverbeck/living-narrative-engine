import { describe, it, expect } from '@jest/globals';
import ISerializer from '../../../src/persistence/iSerializer.js';

describe('ISerializer interface', () => {
  it('serialize throws if not implemented', async () => {
    const serializer = new ISerializer();
    await expect(serializer.serialize({})).rejects.toThrow(
      'ISerializer.serialize must be implemented'
    );
  });

  it('deserialize throws if not implemented', async () => {
    const serializer = new ISerializer();
    await expect(serializer.deserialize(new Uint8Array())).rejects.toThrow(
      'ISerializer.deserialize must be implemented'
    );
  });

  it('fileExtension getter throws if not implemented', () => {
    const serializer = new ISerializer();
    expect(() => serializer.fileExtension).toThrow(
      'ISerializer.fileExtension getter must be implemented'
    );
  });
});
