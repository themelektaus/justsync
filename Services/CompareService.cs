using JustSync.Models;

namespace JustSync.Services;

public class CompareService
{
    private readonly ChecksumService _checksumService;
    private readonly JobManager _jobManager;

    public CompareService(ChecksumService checksumService, JobManager jobManager)
    {
        _checksumService = checksumService;
        _jobManager = jobManager;
    }

    public async Task RunCompareAsync(CompareJob job)
    {
        job.Status.State = JobState.Running;
        job.Status.Message = "Scanning directories...";

        try
        {
            var leftFiles = ScanDirectory(job.LeftPath, job.LeftPath);
            var rightFiles = ScanDirectory(job.RightPath, job.RightPath);

            var allPaths = leftFiles.Keys.Union(rightFiles.Keys).OrderBy(p => p).ToList();
            var results = new List<CompareResultItem>();

            int processed = 0;
            int total = allPaths.Count;

            foreach (var relativePath in allPaths)
            {
                if (job.CancellationTokenSource.Token.IsCancellationRequested)
                {
                    job.Status.State = JobState.Cancelled;
                    job.Status.Message = "Comparison cancelled";
                    return;
                }

                leftFiles.TryGetValue(relativePath, out var leftItem);
                rightFiles.TryGetValue(relativePath, out var rightItem);

                var diffType = await DetermineTypeAsync(
                    job.LeftPath,
                    job.RightPath,
                    leftItem,
                    rightItem,
                    job.UseChecksum,
                    job.CancellationTokenSource.Token
                );

                results.Add(new CompareResultItem(relativePath, diffType, leftItem, rightItem));

                processed++;
                job.Status.Progress = (int)((double)processed / total * 100);
                job.Status.Message = $"Comparing: {relativePath}";
            }

            job.Results = results;
            job.Status.State = JobState.Completed;
            job.Status.Progress = 100;
            job.Status.Message = $"Comparison complete. Found {results.Count} items.";
        }
        catch (Exception ex)
        {
            job.Status.State = JobState.Failed;
            job.Status.Error = ex.Message;
            job.Status.Message = "Comparison failed";
        }
    }

    private Dictionary<string, FileItem> ScanDirectory(string basePath, string currentPath)
    {
        var items = new Dictionary<string, FileItem>(StringComparer.OrdinalIgnoreCase);
        ScanDirectoryRecursive(basePath, currentPath, items);
        return items;
    }

    private void ScanDirectoryRecursive(string basePath, string currentPath, Dictionary<string, FileItem> items)
    {
        try
        {
            var dirInfo = new DirectoryInfo(currentPath);

            foreach (var file in dirInfo.GetFiles())
            {
                try
                {
                    var relativePath = Path.GetRelativePath(basePath, file.FullName);
                    items[relativePath] = new FileItem(
                        relativePath,
                        file.Name,
                        file.Length,
                        file.LastWriteTimeUtc,
                        false
                    );
                }
                catch (UnauthorizedAccessException) { }
            }

            foreach (var dir in dirInfo.GetDirectories())
            {
                try
                {
                    var relativePath = Path.GetRelativePath(basePath, dir.FullName);
                    items[relativePath] = new FileItem(
                        relativePath,
                        dir.Name,
                        0,
                        dir.LastWriteTimeUtc,
                        true
                    );
                    ScanDirectoryRecursive(basePath, dir.FullName, items);
                }
                catch (UnauthorizedAccessException) { }
            }
        }
        catch (UnauthorizedAccessException) { }
    }

    private async Task<DiffType> DetermineTypeAsync(
        string leftBasePath,
        string rightBasePath,
        FileItem left,
        FileItem right,
        bool useChecksum,
        CancellationToken cancellationToken)
    {
        if (left == null && right != null)
            return DiffType.RightOnly;

        if (left != null && right == null)
            return DiffType.LeftOnly;

        if (left == null || right == null)
            return DiffType.Different;

        // Both exist - compare
        if (left.IsDirectory && right.IsDirectory)
            return DiffType.Identical;

        if (left.IsDirectory != right.IsDirectory)
            return DiffType.Different;

        // Compare files
        if (left.Size != right.Size)
        {
            return left.ModifiedDate > right.ModifiedDate ? DiffType.LeftNewer : DiffType.RightNewer;
        }

        // Same size - check date
        var timeDiff = Math.Abs((left.ModifiedDate - right.ModifiedDate).TotalSeconds);
        if (timeDiff > 2) // Allow 2 second tolerance for FAT filesystem
        {
            return left.ModifiedDate > right.ModifiedDate ? DiffType.LeftNewer : DiffType.RightNewer;
        }

        // Same size and date - check checksum if requested
        if (useChecksum)
        {
            var leftPath = Path.Combine(leftBasePath, left.RelativePath);
            var rightPath = Path.Combine(rightBasePath, right.RelativePath);

            var leftChecksum = await _checksumService.ComputeMD5Async(leftPath, cancellationToken);
            var rightChecksum = await _checksumService.ComputeMD5Async(rightPath, cancellationToken);

            if (leftChecksum != rightChecksum)
                return DiffType.Different;
        }

        return DiffType.Identical;
    }
}
