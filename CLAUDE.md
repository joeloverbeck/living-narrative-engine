# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Living Narrative Engine is a browser-based platform for creating highly moddable, data-driven adventure games with AI-powered NPCs. The engine uses an Entity Component System (ECS) architecture and integrates with LLMs for dynamic character interactions.

## Architecture

The project consists of two main parts:
- **Main Application** (`/`): Browser-based game engine
- **LLM Proxy Server** (`/llm-proxy-server`): Node.js microservice for LLM communication

Key architectural patterns:
- **Entity Component System (ECS)** for game objects
- **Event-driven architecture** with centralized event bus
- **Dependency injection** using IoC container
- **Data-driven design** - all game logic defined in JSON files
- **Modular content system** - even core content is a replaceable mod

## Essential Commands

```bash
# Development
npm run dev              # Start app + proxy server concurrently
npm run start            # Build and serve main app only
npm run start:all        # Start both services

# Code Quality (run after modifications)
npm run format           # Format code with Prettier
npm run lint            # Fix ESLint issues
npm run scope:lint      # Validate scope DSL files

# Testing
npm run test            # Run all tests with coverage
npm run test:single     # Run tests sequentially (for debugging)

# Build
npm run build           # Bundle for browser with esbuild

# Utilities
npm run create-mod      # Create new mod scaffold
npm run update-manifest # Update mod manifests
npm run find-condition-refs # Find condition usage
```

For LLM proxy server (from `/llm-proxy-server`):
```bash
npm install
npm run dev             # Start proxy server
npm run test           # Run proxy tests
```

## Critical Configuration

### game.json
Required file at `./data/game.json` that controls mod loading:
```json
{
  "mods": ["core", "your-mod"]  // Load order matters - later mods override earlier
}
```

### Project Structure
```
src/
├── actions/           # Action discovery and execution
├── entities/          # ECS implementation
├── scopeDsl/          # Scope DSL engine (max depth: 4)
├── turns/             # Turn management system
└── loaders/           # Content loading system

data/
├── mods/              # Modular content packs
├── schemas/           # JSON schemas for validation
└── game.json          # Mod configuration

tests/
├── unit/              # Component tests
├── integration/       # Cross-system tests
└── common/            # Test utilities
```

## Development Guidelines

### Coding Patterns
- **Test-Driven Development**: Write tests first for new modules
- **Lint compliance**: Always run `npm run lint` after modifications
- **No production mocking**: Only mock in test files
- **Check for duplicates**: Search for existing functionality before creating new code

### Testing Requirements
- Framework: Jest with jsdom
- Coverage targets: 80% branches, 90% functions/lines
- Run tests after every complete modification
- When tests pass without changes after code modifications, write new focused tests

### Mod System
- Mod IDs are case-insensitive for validation but preserve original casing
- Each mod requires `mod-manifest.json`
- UI assets in optional `ui/` folder with `icons.json` and `labels.json`

### Memory Components
Actors use four distinct memory systems:
- `core:short_term_memory` - Internal monologue (max 10 entries)
- `core:perception_log` - Event history (max 50 entries)
- `core:notes` - Persistent thoughts (uncapped, deduped)
- `core:goals` - Designer-defined objectives (uncapped)

### Scope DSL
Custom language for entity queries without hardcoded JavaScript:
- Files use `.scope` extension
- Located in mod directories
- Max expression depth: 4
- See `docs/scope-dsl.md` for syntax

## Important Notes

- Engine requires `game.json` to start - fails fast without it
- All game logic is data-driven through JSON files
- JSON files must match their schemas (in `data/schemas/`)
- Entity references in perception logs use runtime IDs
- System errors are logged to `error_logs.txt` and dispatched as events

## Key Documentation

- `README.md` - Project setup and overview
- `docs/scope-dsl.md` - Scope DSL specification
- `docs/mods/` - Mod system documentation
- `AGENTS.md` - AI agent configuration
- `.cursor/rules/` - Additional coding patterns