namespace JustSync.Models;

public class IgnorePatterns
{
    public List<IgnorePattern> Patterns { get; set; } = new();
    public string? LeftSourceFile { get; set; }  // Path to left .ignore
    public string? RightSourceFile { get; set; } // Path to right .ignore
}

public class IgnorePattern
{
    public string RawPattern { get; set; } = string.Empty;
    public bool IsRootAnchored { get; set; }
    public bool IsDirectoryOnly { get; set; }
    public PatternType Type { get; set; }
    public string NormalizedPattern { get; set; } = string.Empty;
}

public enum PatternType
{
    Exact,           // Test.txt
    Wildcard,        // *.txt
    DoubleWildcard   // **/Test.txt or Test/**/*.txt
}
