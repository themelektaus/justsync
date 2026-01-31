namespace JustSync.Models;

public enum JobState
{
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled
}

public class JobStatus
{
    public string JobId { get; set; } = string.Empty;
    public JobState State { get; set; } = JobState.Pending;
    public int Progress { get; set; } = 0;
    public string Message { get; set; }
    public string Error { get; set; }
}
