using JustSync.Services;

namespace JustSync.Endpoints;

public static class FolderEndpoints
{
    public static void MapFolderEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/folders");

        group.MapGet("/browse", (string path, FolderBrowserService service) =>
        {
            try
            {
                var entries = service.Browse(path);
                return Results.Ok(entries);
            }
            catch (DirectoryNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        group.MapGet("/validate", (string path, FolderBrowserService service) =>
        {
            var isValid = service.ValidatePath(path);
            return Results.Ok(new { valid = isValid, path });
        });
    }
}
