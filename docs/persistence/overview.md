# Persistence Overview

This document provides a quick reference for the game's save file storage components.

## SaveFileRepository

`SaveFileRepository` is the sole entry point for storage operations such as writing, reading, listing, and deleting save files. All filesystem access is encapsulated within this class.

## SaveFileParser

`SaveFileParser` focuses exclusively on reading and parsing save files. It validates metadata and deserializes save contents but does not perform any filesystem writes or deletions.
