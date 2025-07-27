/**
 * @file Shared interface definitions for tracing components
 * This file exists to break circular dependencies between tracing classes
 */

/**
 * @typedef {object} IStructuredTrace
 * @property {() => Map<string, import('./span.js').default>} getSpans - Get all spans
 * @property {() => import('./span.js').default|null} getActiveSpan - Get current active span
 * @property {() => import('./span.js').default|null} getRootSpan - Get root span
 * @property {() => import('./traceContext.js').TraceContext} getTraceContext - Get underlying trace context
 * @property {(spanId: string) => import('./span.js').default|null} getSpan - Get span by ID
 * @property {() => string} generateSpanId - Generate new span ID
 * @property {() => import('./types.js').HierarchicalSpan[]} exportSpans - Export spans as hierarchy
 * @property {() => import('./types.js').PerformanceSummary} getPerformanceSummary - Get performance summary
 * @property {(name: string, options?: import('./types.js').SpanOptions) => import('./span.js').default} startSpan - Start a new span
 * @property {(spanId: string) => void} endSpan - End a span
 * @property {(attributes: import('./types.js').SpanAttributes) => void} addAttributes - Add attributes to active span
 * @property {(eventName: string, attributes?: import('./types.js').SpanAttributes) => void} addEvent - Add event to active span
 * @property {(error: Error, attributes?: import('./types.js').SpanAttributes) => void} recordError - Record error in active span
 * @property {() => void} clear - Clear all trace data
 * @property {() => Promise<import('./traceAnalyzer.js').default|null>} getAnalyzer - Get trace analyzer
 * @property {() => Promise<import('./traceVisualizer.js').default|null>} getVisualizer - Get trace visualizer
 * @property {() => Promise<import('./performanceMonitor.js').default|null>} getPerformanceMonitor - Get performance monitor
 */

export {};
