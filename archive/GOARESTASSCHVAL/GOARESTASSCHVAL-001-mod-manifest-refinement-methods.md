# GOARESTASSCHVAL-001 – Allow mod manifests to list refinement-method assets

**Status:** Completed

## Problem
Refinement-method loaders already exist (`src/goap/loaders/refinementMethodLoader.js` is wired into `createDefaultContentLoadersConfig`), but mod manifests cannot list the matching files. The manifest schema forbids a `refinement-methods` entry, so manifests fail validation if they try to declare method files. In addition, `StaticConfiguration.getContentTypeSchemaId` never returns the refinement-method schema ID, which means the refinement loader silently skips schema validation. Until the schema and configuration are updated, the content pipeline cannot enumerate or validate refinement methods even though the loader is present.

## Proposed scope
Allow mod manifests to safely list refinement methods by:
- Extending `mod-manifest.schema.json` with a `refinement-methods` content section that accepts relative `.refinement.json` files.
- Teaching `StaticConfiguration` (and the essential schema list) about the refinement-method schema ID so loader validation is enabled and startup asserts that schema is loaded.
- Updating the core manifest (and relevant fixtures) to include the new, optional content block so downstream mods have an example key even if they do not yet ship files.

No changes are required in `ModManifestLoader` or `ModManifestProcessor`; once the schema and config accept the new section, the existing loader pipeline already resolves `content['refinement-methods']` and hands the file list to `RefinementMethodLoader`.

## File list
- `data/schemas/mod-manifest.schema.json`
- `src/configuration/staticConfiguration.js`
- `src/constants/essentialSchemas.js`
- `data/mods/core/mod-manifest.json`
- `tests/unit/schemas/modManifest.schema.test.js`
- `tests/integration/validation/modManifest*` (update fixtures/expectations if they assert on allowed keys)

## Out of scope
- Creating or editing any `*.task.json` or refinement-method content (covered by other tickets).
- Changing how manifests load unrelated asset types (events, rules, etc.).
- Altering load-order or dependency-resolution semantics beyond what the new content type requires.

## Acceptance criteria
### Tests
- `npm run test:unit -- tests/unit/schemas/modManifest.schema.test.js`
- `npm run test:integration -- tests/integration/validation/modManifest*`
- `npm run validate:quick`

### Invariants
- Existing manifest keys keep identical validation rules (no regression for mods that do not declare refinement methods).
- Manifest loaders still reject undeclared or missing files using current error formats.
- Mod load order resolution and dependency declarations remain unchanged apart from the new content block.

## Outcome
- Added `refinement-methods` to the manifest schema plus updated fixtures/tests so manifests can include canonical `.refinement.json` files while keeping enforcement for invalid paths.
- Extended `StaticConfiguration` and the essential schema list so refinement method schemas are loaded/validated at startup, and set the core manifest’s `content` block to include the empty key for discoverability.
- Confirmed no loader or processor changes were required because the existing pipeline already consumes the new manifest key once schema/config support exists.
