namespace JustSync.Models;

public record CompareResultItem(
    string RelativePath,
    DiffType Type,
    FileItem Left,
    FileItem Right
);
