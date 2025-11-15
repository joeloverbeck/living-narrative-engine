import noHardcodedModReferencesRule from './eslint-rules/no-hardcoded-mod-references.js';

const modArchitecturePlugin = {
  rules: {
    'no-hardcoded-mod-references': noHardcodedModReferencesRule,
  },
};

export default [
  {
    files: ['src/**/*.js', 'src/**/*.mjs'],
    plugins: {
      'mod-architecture': modArchitecturePlugin,
    },
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      'mod-architecture/no-hardcoded-mod-references': [
        'warn',
        {
          allowedMods: ['core'],
          allowedFiles: [
            'src/loaders/modsLoader.js',
            'src/loaders/modLoader.js',
            'src/loaders/ModManifestProcessor.js',
            'tests/**/*.js',
            'tests/**/*.mjs',
            'scripts/**/*.js',
            'scripts/**/*.mjs',
          ],
        },
      ],
    },
  },
];
