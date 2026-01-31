using JustSync.Models;

namespace JustSync.Services;

public class SyncService
{
    private readonly JobManager _jobManager;

    public SyncService(JobManager jobManager)
    {
        _jobManager = jobManager;
    }

    public async Task RunSyncAsync(SyncJob syncJob)
    {
        syncJob.Status.State = JobState.Running;
        syncJob.Status.Message = "Starting synchronization...";

        var compareJob = _jobManager.GetCompareJob(syncJob.CompareJobId);
        if (compareJob == null)
        {
            syncJob.Status.State = JobState.Failed;
            syncJob.Status.Error = "Compare job not found";
            return;
        }

        try
        {
            var actionsToProcess = syncJob.Actions
                .Where(a => a.Action != ActionType.Skip)
                .ToList();

            int processed = 0;
            int total = actionsToProcess.Count;

            foreach (var action in actionsToProcess)
            {
                if (syncJob.CancellationTokenSource.Token.IsCancellationRequested)
                {
                    syncJob.Status.State = JobState.Cancelled;
                    syncJob.Status.Message = "Sync cancelled";
                    return;
                }

                await ExecuteActionAsync(action, compareJob.LeftPath, compareJob.RightPath);

                processed++;
                syncJob.Status.Progress = (int)((double)processed / total * 100);
                syncJob.Status.Message = $"Processing: {action.RelativePath}";
            }

            syncJob.Status.State = JobState.Completed;
            syncJob.Status.Progress = 100;
            syncJob.Status.Message = $"Sync complete. Processed {processed} items.";
        }
        catch (Exception ex)
        {
            syncJob.Status.State = JobState.Failed;
            syncJob.Status.Error = ex.Message;
            syncJob.Status.Message = "Sync failed";
        }
    }

    private async Task ExecuteActionAsync(SyncAction action, string leftPath, string rightPath)
    {
        var leftFullPath = Path.Combine(leftPath, action.RelativePath);
        var rightFullPath = Path.Combine(rightPath, action.RelativePath);

        switch (action.Action)
        {
            case ActionType.CopyToRight:
                await CopyAsync(leftFullPath, rightFullPath);
                break;

            case ActionType.CopyToLeft:
                await CopyAsync(rightFullPath, leftFullPath);
                break;

            case ActionType.DeleteLeft:
                Delete(leftFullPath);
                break;

            case ActionType.DeleteRight:
                Delete(rightFullPath);
                break;
        }
    }

    private async Task CopyAsync(string source, string destination)
    {
        var sourceInfo = new FileInfo(source);

        if (Directory.Exists(source))
        {
            // Copy directory
            CopyDirectory(source, destination);
        }
        else if (sourceInfo.Exists)
        {
            // Copy file
            var destDir = Path.GetDirectoryName(destination);
            if (!string.IsNullOrEmpty(destDir))
            {
                Directory.CreateDirectory(destDir);
            }

            // Copy file content
            {
                await using var sourceStream = new FileStream(source, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, true);
                await using var destStream = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true);
                await sourceStream.CopyToAsync(destStream);
            }

            // Preserve timestamps after streams are closed
            File.SetLastWriteTimeUtc(destination, sourceInfo.LastWriteTimeUtc);
        }
    }

    private void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);

        foreach (var file in Directory.GetFiles(source))
        {
            var destFile = Path.Combine(destination, Path.GetFileName(file));
            File.Copy(file, destFile, true);
            File.SetLastWriteTimeUtc(destFile, File.GetLastWriteTimeUtc(file));
        }

        foreach (var dir in Directory.GetDirectories(source))
        {
            var destDir = Path.Combine(destination, Path.GetFileName(dir));
            CopyDirectory(dir, destDir);
        }
    }

    private void Delete(string path)
    {
        if (Directory.Exists(path))
        {
            Directory.Delete(path, true);
        }
        else if (File.Exists(path))
        {
            File.Delete(path);
        }
    }
}
