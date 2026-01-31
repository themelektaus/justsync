namespace JustSync.Models;

public record SyncAction(
    string RelativePath,
    ActionType Action
);
