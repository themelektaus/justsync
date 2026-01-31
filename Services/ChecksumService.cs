using System.Security.Cryptography;

namespace JustSync.Services;

public class ChecksumService
{
    public async Task<string> ComputeMD5Async(string filePath, CancellationToken cancellationToken = default)
    {
        using var md5 = MD5.Create();
        await using var stream = new FileStream(
            filePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 81920,
            useAsync: true
        );

        var hash = await md5.ComputeHashAsync(stream, cancellationToken);
        return Convert.ToHexString(hash);
    }
}
