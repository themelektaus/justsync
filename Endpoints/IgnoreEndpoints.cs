using JustSync.Models;
using JustSync.Services;

namespace JustSync.Endpoints;

public static class IgnoreEndpoints
{
    public static void MapIgnoreEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/ignore");

        // GET /api/ignore/patterns?leftPath=...&rightPath=...
        group.MapGet("/patterns", async (
            string leftPath,
            string rightPath,
            IgnoreService service) =>
        {
            try
            {
                if (!Directory.Exists(leftPath) || !Directory.Exists(rightPath))
                    return Results.BadRequest(new { error = "Invalid paths" });

                var patterns = service.LoadAndMergePatterns(leftPath, rightPath);
                var response = new IgnorePatternsResponse(
                    service.GetPatternsAsText(patterns),
                    patterns.LeftSourceFile,
                    patterns.RightSourceFile
                );

                return Results.Ok(response);
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // POST /api/ignore/patterns
        group.MapPost("/patterns", async (
            SaveIgnorePatternsRequest request,
            IgnoreService service) =>
        {
            try
            {
                if (!Directory.Exists(request.TargetPath))
                    return Results.BadRequest(new { error = "Invalid target path" });

                await service.SavePatternsAsync(request.TargetPath, request.Patterns);
                return Results.Ok(new { message = "Patterns saved successfully" });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });
    }
}
