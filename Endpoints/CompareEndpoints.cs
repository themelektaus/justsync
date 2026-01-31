using JustSync.Models;
using JustSync.Services;

namespace JustSync.Endpoints;

public static class CompareEndpoints
{
    public static void MapCompareEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/compare");

        group.MapPost("/", async (CompareRequest request, CompareService compareService, JobManager jobManager) =>
        {
            if (!Directory.Exists(request.LeftPath))
            {
                return Results.BadRequest(new { error = $"Left path does not exist: {request.LeftPath}" });
            }

            if (!Directory.Exists(request.RightPath))
            {
                return Results.BadRequest(new { error = $"Right path does not exist: {request.RightPath}" });
            }

            var job = jobManager.CreateCompareJob(request.LeftPath, request.RightPath, request.UseChecksum);

            // Run comparison in background
            _ = Task.Run(async () => await compareService.RunCompareAsync(job));

            return Results.Ok(new { jobId = job.JobId });
        });

        group.MapGet("/{jobId}/status", (string jobId, JobManager jobManager) =>
        {
            var job = jobManager.GetCompareJob(jobId);
            if (job == null)
            {
                return Results.NotFound(new { error = "Job not found" });
            }

            return Results.Ok(job.Status);
        });

        group.MapGet("/{jobId}/result", (string jobId, JobManager jobManager) =>
        {
            var job = jobManager.GetCompareJob(jobId);
            if (job == null)
            {
                return Results.NotFound(new { error = "Job not found" });
            }

            if (job.Status.State != JobState.Completed)
            {
                return Results.BadRequest(new { error = "Job not completed", state = job.Status.State.ToString() });
            }

            return Results.Ok(new
            {
                leftPath = job.LeftPath,
                rightPath = job.RightPath,
                results = job.Results
            });
        });

        group.MapPost("/{jobId}/cancel", (string jobId, JobManager jobManager) =>
        {
            var job = jobManager.GetCompareJob(jobId);
            if (job == null)
            {
                return Results.NotFound(new { error = "Job not found" });
            }

            job.CancellationTokenSource.Cancel();
            return Results.Ok(new { message = "Cancellation requested" });
        });
    }
}
