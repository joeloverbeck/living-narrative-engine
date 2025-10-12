import { describe, expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const interfacesDir = path.resolve(process.cwd(), 'src/interfaces');

const interfaceModules = [
  {
    name: 'IFileSystemReader',
    file: 'IFileSystemReader.js',
    expectedDocSnippets: [
      '@interface IFileSystemReader',
      'readFile',
      'A Promise that resolves with the file content as a string.',
    ],
  },
  {
    name: 'ILlmConfigService',
    file: 'ILlmConfigService.js',
    expectedDocSnippets: [
      '@interface ILlmConfigService',
      'initialization completes',
      'hasFileBasedApiKeys',
    ],
  },
  {
    name: 'coreServices',
    file: 'coreServices.js',
    expectedDocSnippets: [
      '@interface ILogger',
      'ILogger#info',
      'ILogger#debug',
    ],
  },
];

describe('interface documentation modules', () => {
  interfaceModules.forEach(({ name, file, expectedDocSnippets }) => {
    const moduleImportPath = `../../../src/interfaces/${file}`;
    const absoluteFilePath = path.join(interfacesDir, file);

    test(`${name} exports no runtime members but loads cleanly`, async () => {
      const module = await import(moduleImportPath);
      expect(module).toEqual({});
    });

    test(`${name} documentation retains key interface details`, async () => {
      const fileContents = await readFile(absoluteFilePath, 'utf8');
      expectedDocSnippets.forEach((snippet) => {
        expect(fileContents).toContain(snippet);
      });
    });
  });
});
