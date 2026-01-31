namespace JustSync.Models;

public enum DiffType
{
    Identical,
    LeftOnly,
    RightOnly,
    LeftNewer,
    RightNewer,
    Different
}
