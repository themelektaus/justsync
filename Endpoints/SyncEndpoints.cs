using JustSync.Models;
using JustSync.Services;

namespace JustSync.Endpoints;

public static class SyncEndpoints
{
    public static void MapSyncEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/sync");

        group.MapPost("/", async (SyncRequest request, SyncService syncService, JobManager jobManager) =>
        {
            var compareJob = jobManager.GetCompareJob(request.CompareJobId);
            if (compareJob == null)
            {
                return Results.BadRequest(new { error = "Compare job not found" });
            }

            if (compareJob.Status.State != JobState.Completed)
            {
                return Results.BadRequest(new { error = "Compare job not completed" });
            }

            var syncJob = jobManager.CreateSyncJob(request.CompareJobId, request.Actions);

            // Run sync in background
            _ = Task.Run(async () => await syncService.RunSyncAsync(syncJob));

            return Results.Ok(new { jobId = syncJob.JobId });
        });

        group.MapGet("/{jobId}/status", (string jobId, JobManager jobManager) =>
        {
            var job = jobManager.GetSyncJob(jobId);
            if (job == null)
            {
                return Results.NotFound(new { error = "Job not found" });
            }

            return Results.Ok(job.Status);
        });

        group.MapPost("/{jobId}/cancel", (string jobId, JobManager jobManager) =>
        {
            var job = jobManager.GetSyncJob(jobId);
            if (job == null)
            {
                return Results.NotFound(new { error = "Job not found" });
            }

            job.CancellationTokenSource.Cancel();
            return Results.Ok(new { message = "Cancellation requested" });
        });
    }
}
