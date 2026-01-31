using JustSync.Models;

namespace JustSync.Services;

public class FolderBrowserService
{
    public List<FolderEntry> Browse(string path)
    {
        var entries = new List<FolderEntry>();

        // If no path provided, return available drives
        if (string.IsNullOrWhiteSpace(path))
        {
            foreach (var drive in DriveInfo.GetDrives())
            {
                if (drive.IsReady)
                {
                    entries.Add(new FolderEntry(
                        drive.Name,
                        drive.Name,
                        true,
                        0,
                        DateTime.MinValue
                    ));
                }
            }
            return entries;
        }

        var dirInfo = new DirectoryInfo(path);
        if (!dirInfo.Exists)
        {
            throw new DirectoryNotFoundException($"Directory not found: {path}");
        }

        // Add directories first
        try
        {
            foreach (var dir in dirInfo.GetDirectories())
            {
                try
                {
                    entries.Add(new FolderEntry(
                        dir.Name,
                        dir.FullName,
                        true,
                        0,
                        dir.LastWriteTime
                    ));
                }
                catch (UnauthorizedAccessException)
                {
                    // Skip directories we can't access
                }
            }
        }
        catch (UnauthorizedAccessException)
        {
            // Skip if we can't enumerate directories
        }

        // Add files
        try
        {
            foreach (var file in dirInfo.GetFiles())
            {
                try
                {
                    entries.Add(new FolderEntry(
                        file.Name,
                        file.FullName,
                        false,
                        file.Length,
                        file.LastWriteTime
                    ));
                }
                catch (UnauthorizedAccessException)
                {
                    // Skip files we can't access
                }
            }
        }
        catch (UnauthorizedAccessException)
        {
            // Skip if we can't enumerate files
        }

        return entries;
    }

    public bool ValidatePath(string path)
    {
        return Directory.Exists(path);
    }
}
