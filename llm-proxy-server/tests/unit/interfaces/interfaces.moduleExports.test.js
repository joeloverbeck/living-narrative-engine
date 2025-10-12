import { describe, expect, it } from '@jest/globals';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const interfaceModuleUrls = {
  IFileSystemReader: pathToFileURL(
    path.resolve(process.cwd(), 'src/interfaces/IFileSystemReader.js')
  ).href,
  ILlmConfigService: pathToFileURL(
    path.resolve(process.cwd(), 'src/interfaces/ILlmConfigService.js')
  ).href,
  coreServices: pathToFileURL(
    path.resolve(process.cwd(), 'src/interfaces/coreServices.js')
  ).href,
};

async function loadModule(url) {
  return import(url);
}

describe('interface module exports', () => {
  it('treats IFileSystemReader as a pure documentation module', async () => {
    const module = await loadModule(interfaceModuleUrls.IFileSystemReader);
    expect(module).toEqual({});
    expect(Object.keys(module)).toHaveLength(0);
  });

  it('treats ILlmConfigService as a pure documentation module', async () => {
    const module = await loadModule(interfaceModuleUrls.ILlmConfigService);
    expect(module).toEqual({});
    expect(Object.keys(module)).toHaveLength(0);
  });

  it('treats coreServices as a pure documentation module', async () => {
    const module = await loadModule(interfaceModuleUrls.coreServices);
    expect(module).toEqual({});
    expect(Object.keys(module)).toHaveLength(0);
  });
});
