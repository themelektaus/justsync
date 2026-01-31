using JustSync.Models;
using System.Text.RegularExpressions;

namespace JustSync.Services;

public class IgnoreService
{
    private const string IgnoreFileName = ".ignore";

    /// <summary>
    /// Loads and merges .ignore patterns from both left and right folders
    /// </summary>
    public IgnorePatterns LoadAndMergePatterns(string leftPath, string rightPath)
    {
        var result = new IgnorePatterns();
        var allPatterns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Load from left folder
        var leftIgnorePath = Path.Combine(leftPath, IgnoreFileName);
        if (File.Exists(leftIgnorePath))
        {
            result.LeftSourceFile = leftIgnorePath;
            var leftPatterns = File.ReadAllLines(leftIgnorePath);
            foreach (var pattern in leftPatterns)
            {
                allPatterns.Add(pattern);
            }
        }

        // Load from right folder
        var rightIgnorePath = Path.Combine(rightPath, IgnoreFileName);
        if (File.Exists(rightIgnorePath))
        {
            result.RightSourceFile = rightIgnorePath;
            var rightPatterns = File.ReadAllLines(rightIgnorePath);
            foreach (var pattern in rightPatterns)
            {
                allPatterns.Add(pattern);
            }
        }

        // Parse all patterns
        foreach (var patternText in allPatterns)
        {
            var parsed = ParsePattern(patternText);
            if (parsed != null)
            {
                result.Patterns.Add(parsed);
            }
        }

        return result;
    }

    /// <summary>
    /// Checks if a relative path should be ignored based on patterns
    /// </summary>
    public bool IsIgnored(string relativePath, bool isDirectory, IgnorePatterns patterns)
    {
        // Always ignore the .ignore file itself
        if (!isDirectory && relativePath.Equals(IgnoreFileName, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (patterns.Patterns.Count == 0)
            return false;

        // Normalize path: use forward slashes for consistency
        var normalizedPath = NormalizePath(relativePath);

        // Add trailing slash for directories
        var pathToMatch = isDirectory ? normalizedPath + "/" : normalizedPath;

        foreach (var pattern in patterns.Patterns)
        {
            if (MatchesPattern(pathToMatch, pattern, isDirectory))
            {
                return true;
            }

            // If pattern is directory-only, check if current path is inside that directory
            if (pattern.IsDirectoryOnly)
            {
                var dirPattern = pattern.NormalizedPattern;

                // Check if the current path starts with the directory pattern
                // This makes /Test/Test/ match all files inside like /Test/Test/**
                if (pattern.IsRootAnchored)
                {
                    // Root-anchored: /Test/Test/ should match Test/Test/file.txt
                    if (normalizedPath.StartsWith(dirPattern + "/", StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
                else
                {
                    // Non-root-anchored: Test/ should match any path containing Test/
                    var segments = normalizedPath.Split('/');
                    for (int i = 0; i < segments.Length; i++)
                    {
                        var segmentPath = string.Join("/", segments.Skip(i));
                        if (segmentPath.StartsWith(dirPattern + "/", StringComparison.OrdinalIgnoreCase))
                        {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    /// <summary>
    /// Saves patterns to .ignore file (can save to left or right folder)
    /// </summary>
    public async Task SavePatternsAsync(string targetPath, string[] patterns)
    {
        var ignorePath = Path.Combine(targetPath, IgnoreFileName);

        // Filter out empty lines and normalize line endings
        var validPatterns = patterns
            .Select(p => p.Trim())
            .Where(p => !string.IsNullOrWhiteSpace(p));

        await File.WriteAllLinesAsync(ignorePath, validPatterns);
    }

    /// <summary>
    /// Gets all patterns as text array (for UI editor)
    /// </summary>
    public string[] GetPatternsAsText(IgnorePatterns patterns)
    {
        return patterns.Patterns
            .Select(p => p.RawPattern)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    /// <summary>
    /// Parses a pattern line into an IgnorePattern object
    /// </summary>
    private IgnorePattern? ParsePattern(string patternText)
    {
        if (string.IsNullOrWhiteSpace(patternText))
            return null;

        var trimmed = patternText.Trim();

        // Skip comments
        if (trimmed.StartsWith('#'))
            return null;

        var pattern = new IgnorePattern
        {
            RawPattern = trimmed
        };

        // Check if root-anchored (starts with /)
        if (trimmed.StartsWith('/'))
        {
            pattern.IsRootAnchored = true;
            trimmed = trimmed.Substring(1);
        }

        // Check if directory-only (ends with /)
        if (trimmed.EndsWith('/'))
        {
            pattern.IsDirectoryOnly = true;
            trimmed = trimmed.TrimEnd('/');
        }

        // Normalize slashes
        trimmed = NormalizePath(trimmed);
        pattern.NormalizedPattern = trimmed;

        // Determine pattern type
        if (trimmed.Contains("**"))
        {
            pattern.Type = PatternType.DoubleWildcard;
        }
        else if (trimmed.Contains('*') || trimmed.Contains('?'))
        {
            pattern.Type = PatternType.Wildcard;
        }
        else
        {
            pattern.Type = PatternType.Exact;
        }

        return pattern;
    }

    /// <summary>
    /// Checks if a path matches a pattern
    /// </summary>
    private bool MatchesPattern(string path, IgnorePattern pattern, bool isDirectory)
    {
        // Directory-only patterns only match directories
        if (pattern.IsDirectoryOnly && !isDirectory)
            return false;

        // Remove trailing slash from path for matching (we already checked IsDirectoryOnly)
        path = path.TrimEnd('/');

        var patternStr = pattern.NormalizedPattern;

        if (pattern.IsRootAnchored)
        {
            // Root-anchored: must match from start
            return MatchesPatternInternal(path, patternStr, pattern.Type);
        }
        else
        {
            // Not root-anchored: can match anywhere in path
            // For files: match basename or full path
            // For directories: match basename or full path

            // Try matching full path
            if (MatchesPatternInternal(path, patternStr, pattern.Type))
                return true;

            // Try matching any path segment (for patterns like "Test.txt" or "node_modules/")
            var segments = path.Split('/');
            for (int i = 0; i < segments.Length; i++)
            {
                var segmentPath = string.Join("/", segments.Skip(i));
                if (MatchesPatternInternal(segmentPath, patternStr, pattern.Type))
                    return true;
            }

            return false;
        }
    }

    /// <summary>
    /// Internal pattern matching logic
    /// </summary>
    private bool MatchesPatternInternal(string path, string pattern, PatternType type)
    {
        switch (type)
        {
            case PatternType.Exact:
                return string.Equals(path, pattern, StringComparison.OrdinalIgnoreCase);

            case PatternType.Wildcard:
                return MatchesWildcard(path, pattern);

            case PatternType.DoubleWildcard:
                return MatchesDoubleWildcard(path, pattern);

            default:
                return false;
        }
    }

    /// <summary>
    /// Matches wildcard patterns (* and ?)
    /// </summary>
    private bool MatchesWildcard(string path, string pattern)
    {
        // Convert glob pattern to regex
        var regexPattern = "^" + Regex.Escape(pattern)
            .Replace("\\*", "[^/]*")  // * matches anything except /
            .Replace("\\?", "[^/]")   // ? matches single char except /
            + "$";

        return Regex.IsMatch(path, regexPattern, RegexOptions.IgnoreCase);
    }

    /// <summary>
    /// Matches double wildcard patterns (**)
    /// </summary>
    private bool MatchesDoubleWildcard(string path, string pattern)
    {
        // Convert glob pattern to regex
        // ** matches any path segment including /
        var regexPattern = "^" + Regex.Escape(pattern)
            .Replace("\\*\\*/", "(.*/)?")      // **/ at start or middle
            .Replace("/\\*\\*", "(/.*)?")      // /** at end
            .Replace("\\*\\*", ".*")           // ** standalone
            .Replace("\\*", "[^/]*")           // * matches anything except /
            .Replace("\\?", "[^/]")            // ? matches single char except /
            + "$";

        return Regex.IsMatch(path, regexPattern, RegexOptions.IgnoreCase);
    }

    /// <summary>
    /// Normalizes path separators to forward slashes
    /// </summary>
    private string NormalizePath(string path)
    {
        return path.Replace('\\', '/');
    }
}
