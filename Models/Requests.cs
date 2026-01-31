namespace JustSync.Models;

public record CompareRequest(
    string LeftPath,
    string RightPath,
    bool UseChecksum = false
);

public record SyncRequest(
    string CompareJobId,
    List<SyncAction> Actions
);

// Ignore pattern requests
public record GetIgnorePatternsRequest(
    string LeftPath,
    string RightPath
);

public record SaveIgnorePatternsRequest(
    string TargetPath,
    string[] Patterns
);

public record IgnorePatternsResponse(
    string[] Patterns,
    string? LeftSourceFile,
    string? RightSourceFile
);
