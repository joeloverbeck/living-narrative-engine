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

const metadataExpectations = {
  IFileSystemReader: {
    exportName: 'IFileSystemReaderMetadata',
    name: 'IFileSystemReader',
    methodNames: ['readFile'],
  },
  ILlmConfigService: {
    exportName: 'ILlmConfigServiceMetadata',
    name: 'ILlmConfigService',
    methodNames: [
      'initialize',
      'isOperational',
      'getLlmConfigs',
      'getLlmById',
      'getResolvedConfigPath',
      'getInitializationErrorDetails',
      'hasFileBasedApiKeys',
    ],
  },
  coreServices: {
    exportName: 'ILoggerMetadata',
    name: 'ILogger',
    methodNames: ['info', 'warn', 'error', 'debug'],
  },
};

const moduleTestCases = Object.entries(metadataExpectations).map(
  ([key, expectation]) => ({
    label: key,
    url: interfaceModuleUrls[key],
    expectation,
  })
);

async function loadModule(url) {
  return import(url);
}

describe('interface module exports', () => {
  it.each(moduleTestCases)(
    '%s exposes frozen metadata to describe its contract',
    async ({ label, url, expectation }) => {
      expect(url).toBeDefined();
      const module = await loadModule(url);

      expect(module).toHaveProperty(expectation.exportName);
      const metadata = module[expectation.exportName];

      expect(Object.isFrozen(metadata)).toBe(true);
      expect(metadata.name).toBe(expectation.name);
      expect(metadata.methods.map((method) => method.name)).toEqual(
        expectation.methodNames
      );
      expect(metadata.description).toEqual(expect.any(String));
    }
  );
});
