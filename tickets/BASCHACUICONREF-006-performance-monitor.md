# BASCHACUICONREF-006: Introduce PerformanceMonitor Service

**Status:** Not Started  
**Priority:** Medium  
**Estimated Effort:** 2 days  
**Phase:** 1 - Service Extraction  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.6)

## Objective

Provide a dedicated `PerformanceMonitor` (`src/characterBuilder/services/performanceMonitor.js`) responsible for performance marks, measurements, and reporting instead of ad-hoc timing code inside the base controller.

## Implementation Tasks

1. **Service Definition**  
   - Constructor: `{ logger, eventBus, threshold = 100 }`.  
   - Methods: `mark(markName)`, `measure(measureName, startMark, endMark = null)`, `getMeasurements()`, `clearData(prefix = null)`.  
   - Use `performance` API when available; fall back to `Date.now()` polyfill for SSR/testing.  
   - Store marks in Map; store measurements with metadata (duration, timestamp, tags).

2. **Event Emission + Alerting**  
   - When measurement exceeds threshold, log warning + emit `characterBuilder:perfAlert` event with payload.  
   - Provide ability to register listeners for aggregated stats (optional for future use, add TODO).

3. **Unit Tests**  
   - `tests/unit/characterBuilder/services/performanceMonitor.test.js`.  
   - Cover marking/measurement combos, threshold warnings, `clearData` (full + prefix).  
   - Mock `performance` or use `global.performance = { now: jest.fn() }`.

4. **Base Controller Integration**  
   - Replace `_performanceMark`, `_performanceMeasure`, `_getPerformanceMeasurements`, `_clearPerformanceData` in controller with service delegation.  
   - Ensure lifecycle orchestrator clears data on destroy.  
   - Document new getter `performanceMonitor` for subclasses.

## Acceptance Criteria

- Base controller no longer stores `#performanceMarks` or `#performanceMeasurements`.  
- Performance alerts visible via logs/events when thresholds exceeded.  
- Tests achieve ≥90% coverage and run with `npm run test:unit -- performanceMonitor`.  
- Docs updated to describe measurement workflow.
