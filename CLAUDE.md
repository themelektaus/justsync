# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JustSync is a file synchronization and comparison tool with an ASP.NET Core 8.0 backend and vanilla JavaScript frontend. It provides a web UI to compare and synchronize files between two directories with support for ignore patterns and checksums.

## Build and Run Commands

```bash
# Build the project
dotnet build

# Run the application (starts on http://localhost:80)
dotnet run
```

No test framework is currently configured.

## Architecture

### Backend Structure (C# / .NET 8)

- **Program.cs** - Entry point, DI configuration, middleware setup
- **Services/** - Business logic as Singletons:
  - `CompareService` - Directory comparison logic
  - `SyncService` - File synchronization executor
  - `IgnoreService` - .ignore pattern parsing & matching
  - `FolderBrowserService` - Disk browsing, drive enumeration
  - `ChecksumService` - MD5 hash computation
  - `JobManager` - Job lifecycle management
- **Endpoints/** - HTTP API endpoints (Minimal APIs with endpoint groups)
- **Models/** - Data models, records, and enums

### Frontend Structure (Vanilla JS)

- **wwwroot/index.html** - Single HTML page with modal dialogs
- **wwwroot/js/**:
  - `api.js` - API client (fetch-based)
  - `app.js` - Main app orchestration
  - `ui.js` - UI rendering functions
  - `dialog.js` - Dialog/modal management
- **wwwroot/css/** - Styles with CSS variables for theming

### Key Patterns

**Job-Based Async Processing**: Compare and Sync operations run asynchronously in background threads. JobManager maintains ConcurrentDictionaries of active jobs. Status polling via API endpoints with CancellationTokenSource for graceful cancellation.

**Two-Phase Operations**: Phase 1 (Compare) scans directories and identifies differences; Phase 2 (Sync) executes user-selected actions based on results.

**Ignore Pattern System**: Merges patterns from both left and right `.ignore` files. Supports gitignore-like syntax including root-anchored (`/file`), directory-only (`dir/`), wildcards (`*`, `?`, `**`), and comments (`#`).

## API Endpoints

- `GET /api/folders/browse?path=` - List directory contents (or drives if empty)
- `POST /api/compare` - Start comparison job
- `GET /api/compare/{jobId}/status` - Get job progress
- `GET /api/compare/{jobId}/result` - Get full results
- `POST /api/sync` - Start sync job with actions
- `GET /api/sync/{jobId}/status` - Get sync progress
- `GET /api/ignore/patterns` - Load merged patterns
- `POST /api/ignore/patterns` - Save patterns

## Code Conventions

- Namespace pattern: `JustSync.<Category>` (Services, Endpoints, Models)
- Static extension methods for endpoint mapping
- Record types for immutable DTOs
- Enums serialized as strings in JSON
- Global `api` object in frontend for all backend calls
- CSS variables in `:root` for theming consistency
