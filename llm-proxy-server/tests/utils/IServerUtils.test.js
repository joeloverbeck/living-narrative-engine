import { describe, test, expect } from '@jest/globals';
import {
  IFileSystemReader,
  IEnvironmentVariableReader,
} from '../../src/utils/IServerUtils.js';

describe('IServerUtils interfaces', () => {
  test('IFileSystemReader.readFile throws not implemented error', async () => {
    const reader = new IFileSystemReader();
    await expect(reader.readFile('some.txt', 'utf-8')).rejects.toThrow(
      'IFileSystemReader.readFile method not implemented.'
    );
  });

  test('IEnvironmentVariableReader.getEnv throws not implemented error', () => {
    const envReader = new IEnvironmentVariableReader();
    expect(() => envReader.getEnv('VAR')).toThrow(
      'IEnvironmentVariableReader.getEnv method not implemented.'
    );
  });
});
