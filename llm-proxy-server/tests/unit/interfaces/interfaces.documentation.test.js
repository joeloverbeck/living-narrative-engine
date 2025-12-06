import { describe, expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const interfacesDir = path.resolve(process.cwd(), 'src/interfaces');

const interfaceModules = [
  {
    name: 'IFileSystemReader',
    file: 'IFileSystemReader.js',
    exportName: 'IFileSystemReaderMetadata',
    expectedDocSnippets: [
      '@interface IFileSystemReader',
      'IFileSystemReaderMetadata',
      "returns: 'Promise<string>'",
    ],
  },
  {
    name: 'ILlmConfigService',
    file: 'ILlmConfigService.js',
    exportName: 'ILlmConfigServiceMetadata',
    expectedDocSnippets: [
      '@interface ILlmConfigService',
      'initialization completes',
      'hasFileBasedApiKeys',
    ],
  },
  {
    name: 'coreServices',
    file: 'coreServices.js',
    exportName: 'ILoggerMetadata',
    expectedDocSnippets: [
      '@interface ILogger',
      'ILoggerMetadata',
      "name: 'debug'",
    ],
  },
];

describe('interface documentation modules', () => {
  interfaceModules.forEach(
    ({ name, file, exportName, expectedDocSnippets }) => {
      const moduleImportPath = `../../../src/interfaces/${file}`;
      const absoluteFilePath = path.join(interfacesDir, file);

      test(`${name} exports frozen runtime metadata while remaining documentation-focused`, async () => {
        const module = await import(moduleImportPath);
        expect(module).toHaveProperty(exportName);
        expect(Object.isFrozen(module[exportName])).toBe(true);
      });

      test(`${name} documentation retains key interface details`, async () => {
        const fileContents = await readFile(absoluteFilePath, 'utf8');
        expectedDocSnippets.forEach((snippet) => {
          expect(fileContents).toContain(snippet);
        });
      });
    }
  );
});
