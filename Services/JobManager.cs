using System.Collections.Concurrent;
using JustSync.Models;

namespace JustSync.Services;

public class CompareJob
{
    public string JobId { get; set; } = string.Empty;
    public string LeftPath { get; set; } = string.Empty;
    public string RightPath { get; set; } = string.Empty;
    public bool UseChecksum { get; set; }
    public JobStatus Status { get; set; } = new();
    public List<CompareResultItem> Results { get; set; } = new();
    public CancellationTokenSource CancellationTokenSource { get; set; } = new();
}

public class SyncJob
{
    public string JobId { get; set; } = string.Empty;
    public string CompareJobId { get; set; } = string.Empty;
    public string Mode { get; set; } = string.Empty;
    public List<SyncAction> Actions { get; set; } = new();
    public JobStatus Status { get; set; } = new();
    public CancellationTokenSource CancellationTokenSource { get; set; } = new();
}

public class JobManager
{
    private readonly ConcurrentDictionary<string, CompareJob> _compareJobs = new();
    private readonly ConcurrentDictionary<string, SyncJob> _syncJobs = new();

    public CompareJob CreateCompareJob(string leftPath, string rightPath, bool useChecksum)
    {
        var jobId = Guid.NewGuid().ToString("N")[..8];
        var job = new CompareJob
        {
            JobId = jobId,
            LeftPath = leftPath,
            RightPath = rightPath,
            UseChecksum = useChecksum,
            Status = new JobStatus
            {
                JobId = jobId,
                State = JobState.Pending
            }
        };
        _compareJobs[jobId] = job;
        return job;
    }

    public CompareJob GetCompareJob(string jobId)
    {
        return _compareJobs.TryGetValue(jobId, out var job) ? job : null;
    }

    public SyncJob CreateSyncJob(string compareJobId, List<SyncAction> actions)
    {
        var jobId = Guid.NewGuid().ToString("N")[..8];
        var job = new SyncJob
        {
            JobId = jobId,
            CompareJobId = compareJobId,
            Actions = actions,
            Status = new JobStatus
            {
                JobId = jobId,
                State = JobState.Pending
            }
        };
        _syncJobs[jobId] = job;
        return job;
    }

    public SyncJob GetSyncJob(string jobId)
    {
        return _syncJobs.TryGetValue(jobId, out var job) ? job : null;
    }
}
