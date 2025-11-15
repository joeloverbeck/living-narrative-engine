# BASCHACUICONREF-006: Introduce PerformanceMonitor Service

**Status:** Not Started  
**Priority:** Medium  
**Estimated Effort:** 2 days  
**Phase:** 1 - Service Extraction  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.6)

## Objective

Provide a dedicated `PerformanceMonitor` (`src/characterBuilder/services/performanceMonitor.js`) responsible for performance marks, measurements, and reporting instead of ad-hoc timing code inside the base controller.

**Current state (from `BaseCharacterBuilderController.js`):**
- The controller already exposes `_performanceMark`, `_performanceMeasure`, `_getPerformanceMeasurements`, and `_clearPerformanceData`, backed by private `#performanceMarks`/`#performanceMeasurements` maps plus direct `performance.now()` calls.
- Threshold alerts currently dispatch `CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING` with a hard-coded `100ms` limit, and `SpeechPatternsGeneratorController` is the primary consumer of these helpers.
- `src/actions/tracing/performanceMonitor.js` (used by the tracing pipeline) already implements mark/measure storage, alerting, and sampling; reuse its data structures/semantics where possible so we stay aligned with the BASCHACUICONREF program overview’s goal of converging on eight shared services.

## Implementation Tasks

1. **Service Definition**
   - Constructor: `{ logger, eventBus, threshold = 100 }`.
   - Methods: `mark(markName)`, `measure(measureName, startMark, endMark = null)`, `getMeasurements()`, `clearData(prefix = null)`.
   - Use `performance` API when available; fall back to `Date.now()` polyfill for SSR/testing.
   - Store marks in Map; store measurements with metadata (duration, timestamp, tags).
   - Reference `src/actions/tracing/performanceMonitor.js` for naming/alert conventions so that both monitors evolve consistently (per BASCHACUICONREF-000 coordination guidance).

2. **Event Emission + Alerting**
   - When measurement exceeds threshold, log a warning + emit `CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING` (current event bus contract) so downstream consumers keep receiving `core:character_builder_performance_warning` payloads.
   - Provide ability to register listeners for aggregated stats (optional for future use, add TODO).

3. **Unit Tests**  
   - `tests/unit/characterBuilder/services/performanceMonitor.test.js`.  
   - Cover marking/measurement combos, threshold warnings, `clearData` (full + prefix).  
   - Mock `performance` or use `global.performance = { now: jest.fn() }`.

4. **Base Controller Integration**
   - Replace `_performanceMark`, `_performanceMeasure`, `_getPerformanceMeasurements`, `_clearPerformanceData` in `BaseCharacterBuilderController` with service delegation while keeping the protected method signatures intact for current consumers (`SpeechPatternsGeneratorController`, etc.).
   - Remove the private `#performanceMarks`/`#performanceMeasurements` fields and wire destruction (`_clearReferences`) to call the new service’s `clearData` so the lifecycle orchestrator still purges metrics when controllers are torn down.
   - Document new getter `performanceMonitor` for subclasses and add migration notes so this counts toward the eight-service extraction target in BASCHACUICONREF-000.

## Acceptance Criteria

- Base controller no longer stores `#performanceMarks` or `#performanceMeasurements`; metrics live inside the dedicated service and are cleared via lifecycle orchestration.
- Performance alerts visible via logs/events when thresholds exceeded, continuing to use `CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING`.
- Tests achieve ≥90% coverage and run with `npm run test:unit -- performanceMonitor`.
- Docs updated to describe measurement workflow.
