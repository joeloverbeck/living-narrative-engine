# Living Narrative Engine - Project Planning

## Project Overview

Living Narrative Engine is a browser-based platform for creating and playing adventure games, RPGs, immersive sims, and similar narrative-driven experiences. The engine operates as an interpreter and processor of mod data, following a "modding-first" philosophy where all game content exists as mods in the `data/mods/` folder.

## Core Goals

### 1. **Total Moddability**
- Every aspect of gameplay should be definable through data files
- Even core mechanics are implemented as replaceable mods
- No hardcoded game logic in the engine itself

### 2. **AI-Powered Narrative**
- NPCs powered by Large Language Models for dynamic conversations
- Memory systems that allow characters to remember and evolve
- Natural language understanding for player actions

### 3. **Browser-Based Accessibility**
- Run entirely in web browsers without plugins
- Cross-platform compatibility
- Easy distribution and instant play

### 4. **Developer-Friendly Architecture**
- Clear separation between engine and content
- Comprehensive JSON schemas for validation
- Hot-reload during development

## Architecture

The project consists of two main parts:

- **Main Application** (`/`): Browser-based game engine
- **LLM Proxy Server** (`/llm-proxy-server`): Node.js microservice for LLM communication

### Entity Component System (ECS)

The engine uses a pure ECS architecture:

```
Entity (ID) → Components (Data) → Systems (Logic)
```

- **Entities**: Simple IDs that group components
- **Components**: JSON data files defining properties
- **Systems**: Rule definitions in JSON that, relying on coded OperationHandlers, process entities with specific components

### Event-Driven Communication

All parts communicate through a central event bus:

```
Component A → Event → Event Bus → Component B
                           ↓
                      Component C
```

This ensures loose coupling and easy extension.

### Modular Content System

```
data/mods/
├── core/           # Essential mechanics (required)
├── anatomy/        # Body systems
├── intimacy/       # Social interactions
└── custom-mod/     # User-created content
```

Each mod contains:
- `mod-manifest.json` - Metadata and dependencies
- Components, actions, rules, entities, etc.
- Optional UI assets (icons, labels)

### Scope DSL

Custom language to determine the target scope of actions without hardcoded JavaScript:

- Files use `.scope` extension
- Located in mod directories
- Max expression depth: 4
- See `docs/scope-dsl.md` for syntax

## Critical Configuration

### game.json

Required file at `./data/game.json` that controls mod loading:

```json
{
  "mods": ["core", "your-mod"] // Load order matters - later mods override earlier
}
```

### LLM Integration

```
Game Engine ←→ LLM Proxy Server ←→ LLM Provider
   (Browser)      (Node.js)         (OpenAI, etc.)
```

The proxy server handles:
- API key security
- Request formatting
- Error handling
- Rate limiting

## Technical Constraints

### 1. **Data-Driven Design**
- All game logic must be expressible in JSON
- Use JSON Logic for conditions
- Scope DSL for entity queries when determining target scope (max depth: 4)

### 2. **Browser Limitations**
- No file system access
- LocalStorage for saves
- Memory constraints for large worlds

### 3. **Performance Considerations**
- Entity queries must be efficient
- Event cascades need cycle detection
- Memory components have size limits

### 4. **Mod Compatibility**
- Mods can conflict or depend on each other
- Load order matters (defined in `game.json`)
- Version compatibility checks

## Code Style & Patterns

### Testing Requirements
- **Framework**: Jest with jsdom
- **Coverage**: 80% branches, 90% functions/lines
- **Approach**: Test-driven development for new features
- **Focus**: Unit tests for components, integration tests for systems
- Run tests after every complete modification
- When tests pass without changes after code modifications, write new focused tests to cover the new behavior
- If in the process of creating or fixing tests, if you detect a bug in the SUT, fix the bug. Don't correct the test code to adapt to a bug in the SUT. The tests should only cover non-buggy production code.

### Development Workflow
1. **Test-Driven Development**: Write tests first for new modules
2. **Check for duplicates**: Search for existing functionality before creating new code
3. Implement minimal code to pass
4. **Lint compliance**: Always run `npm run lint` regarding the modified files after modifications
5. Format code: `npm run format`
6. Validate schemas and scopes

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

### Error Handling
- Fail fast on critical errors (missing deps, invalid schemas)
- Instead of logging errors, dispatch SYSTEM_ERROR_OCCURRED_ID events, ensuring the payload validates against system_error_occurred.event.json
- Provide clear error messages for mod developers

## Content Creation Guidelines

### Action Definition
- Ensure they validate against action.schema.json

### Component Structure
- Ensure they validate against component.schema.json

### Rule System
- Ensure they validate against rule.schema.json

## Future Considerations

### Scalability
- Optimize entity queries for large worlds

### Extensibility
- Plugin system for engine extensions
- Custom UI framework support
- Additional LLM provider integrations

### Performance
- WebAssembly for compute-intensive operations
- Worker threads for AI processing
- Incremental loading for large mods

## Development Principles

1. **Engine as Interpreter**: The engine should never contain game-specific logic
2. **Mods Define Everything**: From UI to game rules, all through data files
3. **Fail Fast**: Invalid configurations should error immediately
4. **Developer Experience**: Clear errors, hot reload, comprehensive docs
5. **Player Agency**: Support emergent gameplay through flexible systems