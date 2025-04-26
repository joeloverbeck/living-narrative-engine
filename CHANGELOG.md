# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking Changes

* **Engine Version Enforcement:** The engine now strictly enforces the `gameVersion` field specified in
  `mod.manifest.json`.
    * If a mod includes a `gameVersion` field specifying a SemVer range, and the current engine version does not satisfy
      that range, the engine will **refuse to start**, logging a fatal `ModDependencyError`. Previously, this field
      might have been ignored or handled differently.
    * If a mod includes a `gameVersion` field that is present (not `null`/`undefined`), not an empty or whitespace-only
      string, but contains an invalid SemVer range string or is not a string type, the engine will **refuse to start**,
      throwing a fatal `TypeError`.
    * Mods *without* a `gameVersion` field (or where it's null, empty, or whitespace) are unaffected by this check and
      continue to load as before regarding engine compatibility.

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security