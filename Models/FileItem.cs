namespace JustSync.Models;

public record FileItem(
    string RelativePath,
    string Name,
    long Size,
    DateTime ModifiedDate,
    bool IsDirectory,
    string Checksum = null,
    bool IsIgnored = false
);
