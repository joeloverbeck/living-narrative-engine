# ESLint Mod Reference Exemptions

The `mod-architecture/no-hardcoded-mod-references` rule blocks new references to non-core mods in production code. This file documents the default exemptions and the process for requesting additional allowances.

## Why the Rule Exists

Hardcoded references such as `positioning:sitting` introduce tight coupling between the engine and specific mods. All production access should go through the Component Type Registry or approved plugin APIs so that mods stay optional and swappable.

## Default Exemptions

These paths are configured inside `eslint.config.mjs` under the `allowedFiles` option for the custom rule:

- `src/loaders/modsLoader.js` – Loads mod definitions at boot time.
- `src/loaders/ModManifestProcessor.js` – Reads manifest metadata and must touch mod IDs directly.
- `tests/**/*.js` and `tests/**/*.mjs` – Tests validate that mods behave correctly.
- `scripts/**/*.js` and `scripts/**/*.mjs` – Build and validation tooling may need to reference arbitrary mods.

> **Note:** The loader exemption also covers the historical filename `src/loaders/modLoader.js` to avoid accidental false positives in older branches.

## Requesting a New Exemption

1. **Validate the need.** Exhaust the Component Type Registry and plugin hooks before falling back to direct IDs.
2. **Explain the exception.** Add an inline comment near the reference that starts with `ESLint exemption:` and describes why the hardcoded reference is unavoidable.
3. **Update the configuration.** Append the file or glob pattern to the `allowedFiles` list in `eslint.config.mjs` under the `mod-architecture/no-hardcoded-mod-references` rule.
4. **Document here.** Add a short bullet in this document summarizing the new exemption and why it exists.
5. **Re-run linting.** Execute `npm run lint` and ensure the new exemption is the only change.

Requests without architectural justification will be rejected. This document should remain short—please remove exemptions once the referenced file no longer requires direct mod IDs.

## Generating a Baseline Report

Use the dedicated script to capture the current set of violations:

```bash
npm run lint:modrefs-report
```

The output is written to `reports/eslint-modref-report.txt` so architects can triage outstanding references.
