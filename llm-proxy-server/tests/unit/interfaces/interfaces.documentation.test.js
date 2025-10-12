import { describe, expect, test } from '@jest/globals';

const loadModule = async (relativePath) => {
  const module = await import(relativePath);
  return module;
};

describe('interface documentation modules', () => {
  test('IFileSystemReader exports no runtime members but loads cleanly', async () => {
    const module = await loadModule('../../../src/interfaces/IFileSystemReader.js');
    expect(module).toEqual({});
  });

  test('ILlmConfigService exports no runtime members but loads cleanly', async () => {
    const module = await loadModule('../../../src/interfaces/ILlmConfigService.js');
    expect(module).toEqual({});
  });

  test('coreServices exports no runtime members but loads cleanly', async () => {
    const module = await loadModule('../../../src/interfaces/coreServices.js');
    expect(module).toEqual({});
  });
});
