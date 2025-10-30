# Anatomy Structure Template Loader Alignment Spec

## Implementation Status

**Status**: PROPOSED – Bug Fix
**Date**: 2025-03-09
**Version**: 1.0.0
**Author**: AI Contributor

## 1. Overview

### 1.1 Executive Summary

Kraken anatomy generation fails under the V2 pipeline because the structure template referenced by the blueprint is never registered. The data loader expects structure templates to appear under the `structureTemplates` manifest key, but the shipping anatomy mod (and the schema backing it) publish the assets under `structure-templates`. As a result the loader silently skips all templates, leaving the registry empty and causing `BodyBlueprintFactory` to raise `ValidationError: Structure template not found: anatomy:structure_octopoid` when the visualizer tries to assemble the anatomy. Aligning the manifest key that the loader reads with the actual manifest/schema convention restores structure template registration and unblocks V2 creature generation.

### 1.2 Current Symptoms

- Anatomy visualizer displays multiple retry/rollback errors while loading `patrol:kraken_elder` because `BodyBlueprintFactory` cannot resolve `anatomy:structure_octopoid`.
- Kraken blueprint (`schemaVersion: "2.0"`) references the correct template ID, but `_processV2Blueprint` throws once it fails to locate the template in the registry, aborting anatomy generation and triggering cascading error recovery warnings.
- Any other V2 blueprints that rely on templates (e.g., spiders, dragons) would likewise fail when executed through the runtime visualizer even if validation passes.

### 1.3 Affected Assets

- Loader meta configuration: `src/loaders/loaderMeta.js` (structure template `contentKey`)
- Anatomy mod manifest(s): `data/mods/anatomy/mod-manifest.json`
- Anatomy documentation: `docs/anatomy/non-human-quickstart.md`
- Runtime blueprint processing: `src/anatomy/bodyBlueprintFactory.js`

## 2. Root Cause Analysis

### 2.1 Manifest Key Drift

`loaderMeta` declares the structure template `contentKey` as `structureTemplates`, so `SimpleItemLoader` looks for that camelCase property in each mod manifest. The anatomy mod manifest and its schema both expose the templates under the dashed key `structure-templates`, matching the authoring docs. Because the loader never sees the camelCase property, no structure templates are read from disk and the registry remains empty. The kraken blueprint, however, successfully loads and requests the template, surfacing a runtime `ValidationError` when the template cannot be found.【F:src/loaders/loaderMeta.js†L105-L109】【F:data/mods/anatomy/mod-manifest.json†L124-L178】【F:data/schemas/mod-manifest.schema.json†L110-L126】

### 2.2 Blueprint-Level Failure Mode

V2 blueprints legitimately rely on templates for socket generation, as documented in the anatomy guides. When `_processV2Blueprint` cannot retrieve the template, it throws early, preventing socket generation and causing the orchestrator to roll back the entire anatomy creation sequence. This manifests as repeated selection retries and error recovery warnings in the UI logs.【F:src/anatomy/bodyBlueprintFactory.js†L342-L372】【F:docs/anatomy/blueprints-v2.md†L62-L140】【F:docs/anatomy/structure-templates.md†L21-L112】

### 2.3 Documentation Mismatch

The non-human quickstart still instructs authors to use the camelCase `structureTemplates` manifest key, which no longer matches the schema or the shipping mod content. Even after fixing the loader, we should correct the documentation to avoid reintroducing the mismatch when content authors follow the guide.【F:docs/anatomy/non-human-quickstart.md†L221-L243】

## 3. Proposed Fix

### 3.1 Align Loader Meta with Manifest Schema

- Update `loaderMeta.anatomyStructureTemplates.contentKey` from `structureTemplates` to `structure-templates` so the loader reads the correct manifest section.
- Double-check any helper constants or hard-coded references to the old key (e.g., custom loader registration, integration tests) and update them if present.
- Add or adjust a regression test that loads a minimal manifest containing `structure-templates` to confirm the loader ingests at least one template path.

### 3.2 Verify Runtime Registration

- After the loader change, execute the existing integration tests (`tests/integration/anatomy/templateProcessorPipeline.integration.test.js`) or add a targeted test to assert that `DataRegistry.get('anatomyStructureTemplates', 'anatomy:structure_octopoid')` returns a template when the anatomy mod is loaded.
- Manually sanity check via `npm run validate` or the anatomy visualizer that kraken, spider, and dragon recipes now produce generated sockets instead of throwing.

### 3.3 Update Authoring Documentation

- Adjust the manifest snippet in `docs/anatomy/non-human-quickstart.md` (and any related guides) to use the dashed `structure-templates` key so modders follow the schema-supported convention.
- Optionally note in the guide that the loader expects `structure-templates` and that each entry should live under `data/mods/<modId>/structure-templates/` to reinforce the correct folder.

## 4. Acceptance Criteria

1. Loading the anatomy mod registers all structure templates, and `BodyBlueprintFactory` no longer throws `Structure template not found` when generating kraken anatomy.
2. Integration or unit coverage fails if the loader ignores a manifest containing `structure-templates`, preventing regressions.
3. Anatomy documentation shows the dashed manifest key, matching both the schema and loader expectations.
4. Anatomy visualizer successfully loads at least one V2 creature (e.g., kraken elder) without triggering error recovery retries.

## 5. Open Questions

- Do any external mods or internal tools still rely on the camelCase key? A quick content search returned none, but confirm with mod authors before merging.
- Should we add schema support for both dashed and camelCase keys for backward compatibility, or is enforcing the dashed form sufficient?
- Would it be valuable to emit a warning when the loader finds zero structure templates to surface configuration issues earlier in the boot process?
