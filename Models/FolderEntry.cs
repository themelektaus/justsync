namespace JustSync.Models;

public record FolderEntry(
    string Name,
    string FullPath,
    bool IsDirectory,
    long Size,
    DateTime ModifiedDate
);
