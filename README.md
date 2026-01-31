# JustSync

A lightweight file synchronization tool with a web-based interface. Compare directories, review differences, and sync files with precision.

![.NET 8](https://img.shields.io/badge/.NET-8.0-512BD4)

## Features

- **Directory Comparison** - Compare two folders with detailed diff information
- **Selective Sync** - Choose which files to copy, delete, or skip
- **Ignore Patterns** - Gitignore-style `.ignore` file support for excluding files
- **Checksum Verification** - Optional MD5 checksums for accurate change detection
- **Dark Mode** - Automatic dark theme based on system preference
- **Real-time Progress** - Live progress tracking with cancellation support

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/JustSync.git
cd JustSync

# Run the application
dotnet run
```

Open http://localhost:80 in your browser.

## Requirements

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

## Usage

1. **Select Folders** - Enter paths or use the Browse button to select left and right directories
2. **Compare** - Click Compare to scan both directories and identify differences
3. **Review** - Examine the results showing files that are identical, only on one side, or different
4. **Set Actions** - For each difference, choose an action:
   - Copy to Right (→)
   - Copy to Left (←)
   - Delete from Left
   - Delete from Right
   - Skip
5. **Sync** - Click Sync to execute the selected actions

### Ignore Patterns

Create a `.ignore` file in either directory to exclude files from comparison. Patterns follow gitignore syntax:

```
# Comments start with #
*.log           # Ignore all .log files
/node_modules/  # Ignore node_modules in root
temp/           # Ignore any temp directory
**/*.bak        # Ignore .bak files in any subdirectory
```

Click "Edit .ignore" to manage patterns through the UI.

## Comparison Logic

Files are compared using:
1. **Size** - Different sizes indicate different content
2. **Modified Date** - 2-second tolerance for FAT32 compatibility
3. **MD5 Checksum** - Optional deep comparison for files with matching size and date

Diff types:
- **Identical** - Files match in both directories
- **Left Only** - File exists only in the left directory
- **Right Only** - File exists only in the right directory
- **Left Newer** - Left file has a more recent modification date
- **Right Newer** - Right file has a more recent modification date
- **Different** - Files have the same date but different content (requires checksum)

## Project Structure

```
JustSync/
├── Program.cs           # Application entry point
├── Services/            # Core business logic
├── Endpoints/           # HTTP API endpoints
├── Models/              # Data models and enums
└── wwwroot/             # Frontend (HTML, CSS, JS)
```

## License

MIT
