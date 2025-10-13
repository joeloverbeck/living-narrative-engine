import { describe, expect, it } from '@jest/globals';

const interfaceModules = [
  [
    'IFileSystemReaderMetadata',
    '../../../src/interfaces/IFileSystemReader.js',
    {
      name: 'IFileSystemReader',
      methodCount: 1,
    },
  ],
  [
    'ILlmConfigServiceMetadata',
    '../../../src/interfaces/ILlmConfigService.js',
    {
      name: 'ILlmConfigService',
      methodCount: 7,
    },
  ],
  [
    'ILoggerMetadata',
    '../../../src/interfaces/coreServices.js',
    {
      name: 'ILogger',
      methodCount: 4,
    },
  ],
];

describe('interface documentation modules', () => {
  it.each(interfaceModules)(
    'exposes %s metadata describing its contract',
    async (exportName, relativePath, expectation) => {
      const loadedModule = await import(relativePath);

      expect(loadedModule).toHaveProperty(exportName);
      const metadata = loadedModule[exportName];

      expect(Object.isFrozen(metadata)).toBe(true);
      expect(metadata.name).toBe(expectation.name);
      expect(Array.isArray(metadata.methods)).toBe(true);
      expect(metadata.methods).toHaveLength(expectation.methodCount);
      metadata.methods.forEach((method) => {
        expect(method).toHaveProperty('name');
        expect(method).toHaveProperty('description');
      });
    }
  );

  it('can be imported together without generating runtime exports', async () => {
    const modules = await Promise.all(
      interfaceModules.map(([, relativePath]) => import(relativePath))
    );

    modules.forEach((loadedModule) => {
      const exportNames = Object.keys(loadedModule).filter(
        (key) => key !== '__esModule'
      );
      exportNames.forEach((name) => {
        const metadata = loadedModule[name];
        expect(Object.isFrozen(metadata)).toBe(true);
      });
    });
  });
});
