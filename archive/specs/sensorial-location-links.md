# Sensorial Location Links Spec

## Context

The dredgers locations below are separated by iron grates, but characters can still see and hear across those boundaries:

- `dredgers:access_point_segment_a`
- `dredgers:segment_b`
- `dredgers:segment_c`
- `dredgers:flooded_approach`

Current behavior only delivers speech/perceptible events to actors in the exact same location via `dispatchSpeechHandler.js` and `dispatchPerceptibleEventHandler.js`, based on rules in `data/mods/*/rules/`.

We need a data-driven way to declare locations as sensorially connected so that speech and perceptible events propagate across those links without recursive re-broadcast.

## Goals

- Allow mod data to declare explicit, directed sensorial links between locations.
- Propagate speech and perceptible event logs to actors in linked locations.
- Prefix the forwarded log entries with the origin location name.
- Prevent recursive/chain propagation (only the origin location broadcasts).
- Keep the system fully data-driven via a new component in `data/mods/locations/components/`.

## Non-Goals

- No pathfinding or distance-based propagation.
- No automatic inferences from `locations:exits`.
- No audio attenuation or visibility checks beyond explicit links.
- No reformatting of existing logs for actors in the origin location.

## Data Model

Add a new locations component to `data/mods/locations/components/`:

- `locations:sensorial_links`
- Shape:
  - `targets`: array of location entity ids (instances)
  - `mode`: optional, default `both` (reserved for future use)

Example component data in location definitions:

```json
"locations:sensorial_links": {
  "targets": ["dredgers:segment_b_instance"]
}
```

For the dredgers locations in scope, data should explicitly declare:

- `access_point_segment_a` -> `segment_b`, `segment_c`, `flooded_approach`
- `segment_b` -> `access_point_segment_a`, `segment_c`, `flooded_approach`
- `segment_c` -> `access_point_segment_a`, `segment_b`, `flooded_approach`
- `flooded_approach` -> `access_point_segment_a`, `segment_b`, `segment_c`

Use explicit targets (no implicit reciprocity). This ensures content authors can model asymmetric acoustics later.

## Runtime Behavior

### Event propagation

When `DISPATCH_PERCEPTIBLE_EVENT` or speech processing runs:

1. Identify the origin location for the actor/event.
2. Deliver logs to actors in the origin location (existing behavior).
3. If the origin location has `locations:sensorial_links.targets`:
   - Find actors in each linked location (note that the location of an entity is found through components on entities. Look at the instances in data/mods/dredgers/instances/ )
   - Deliver a forwarded log entry with origin prefix.

### Loop prevention

Add/forward an `originLocationId` value with the dispatch payload.

- If `originLocationId` is already set, do not propagate to `locations:sensorial_links` again.
- Only the initial handler call (where `originLocationId` is absent) may perform propagation.
- The handler should avoid dispatching a new `DISPATCH_PERCEPTIBLE_EVENT` for forwarded logs and instead directly enqueue the log entries for linked actors.

This ensures no A->B->A feedback or multi-hop chains.

## Log Formatting

For actors in linked locations, prefix the log message using the origin location name:

- Example: `(From Segment B) Bobby says: "Is anyone else here?"`
- The origin name should come from `core:name.text` on the origin location.
- Keep existing message formatting intact after the prefix.

Actors in the origin location keep the existing message format (no prefix).

## Edge Cases

- If the origin location lacks `core:name`, fall back to `originLocationId` for prefix.
- If a linked location has no actors, no extra work is needed.
- If `locations:sensorial_links.targets` is empty or missing, behavior is unchanged.
- If the origin actor is in a linked location as well (should not happen), avoid duplicate logs.

## Required Tests

Add/extend tests to cover:

1. **Direct propagation**: speech in segment B is delivered to segment, segment C, and flooded approach actors with `(From Segment B)` prefix.
2. **Reverse propagation**: speech in flooded approach reaches segment C, segment B, and segment A with prefix.
3. **Perceptible events**: non-speech perceptible events in segment A reach segment B, segment C, and flooded approach with prefix.
4. **Origin formatting**: actors in the origin location receive the unprefixed message.
5. **Missing component**: locations without `locations:sensorial_links` behave exactly as they do today.
6. **Loop guard**: dispatch payloads with `originLocationId` skip propagation.

Favor unit tests around `dispatchSpeechHandler.js` and `dispatchPerceptibleEventHandler.js` plus a focused integration test that loads the dredgers locations with the new component data.

