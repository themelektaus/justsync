using JustSync.Services;
using JustSync.Endpoints;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Configure JSON serialization to use string enums
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// Register services
builder.Services.AddSingleton<FolderBrowserService>();
builder.Services.AddSingleton<ChecksumService>();
builder.Services.AddSingleton<JobManager>();
builder.Services.AddSingleton<IgnoreService>();
builder.Services.AddSingleton<CompareService>();
builder.Services.AddSingleton<SyncService>();

// CORS for development
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

app.UseCors();

// Serve static files from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

// Map API endpoints
app.MapFolderEndpoints();
app.MapCompareEndpoints();
app.MapSyncEndpoints();
app.MapIgnoreEndpoints();

app.Run();
