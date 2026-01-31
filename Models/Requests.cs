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
