using System.Reflection;
using System.Xml.Linq;
using RoomReservations.Application;
using RoomReservations.Domain;

namespace RoomReservations.Api.Tests;

public sealed class ArchitectureTests
{
    [Fact]
    public void Domain_has_no_application_infrastructure_or_web_dependencies()
    {
        var references = ReferencedNames(typeof(Reservation).Assembly);

        Assert.DoesNotContain(references, name =>
            name.StartsWith("RoomReservations.", StringComparison.Ordinal) ||
            name.StartsWith("Microsoft.Extensions.", StringComparison.Ordinal) ||
            IsPersistenceOrWebFramework(name));
    }

    [Fact]
    public void Application_depends_on_domain_without_persistence_or_web_frameworks()
    {
        var references = ReferencedNames(typeof(ReservationService).Assembly);

        Assert.Multiple(
            () => Assert.Contains("RoomReservations.Domain", references),
            () => Assert.DoesNotContain(references, name =>
                name is "RoomReservations.Infrastructure" or "RoomReservations.Api" ||
                IsPersistenceOrWebFramework(name)));
    }

    [Theory]
    [InlineData("Domain", new string[0])]
    [InlineData("Application", new[] { "RoomReservations.Domain" })]
    [InlineData("Infrastructure", new[] { "RoomReservations.Application", "RoomReservations.Domain" })]
    public void Project_references_follow_the_dependency_direction(string layer, string[] allowedReferences)
    {
        // Also inspect declared references: unused forbidden dependencies must not slip through compilation.
        var projectPath = Path.Combine(RepositoryRoot(), "src", $"RoomReservations.{layer}", $"RoomReservations.{layer}.csproj");
        var project = XDocument.Load(projectPath);
        var references = project.Descendants("ProjectReference")
            .Select(reference => Path.GetFileNameWithoutExtension(reference.Attribute("Include")!.Value))
            .Order(StringComparer.Ordinal).ToArray();

        Assert.Equal(allowedReferences.Order(StringComparer.Ordinal), references);
        if (layer is "Domain" or "Application")
        {
            var dependencies = project.Descendants()
                .Where(element => element.Name.LocalName is "PackageReference" or "FrameworkReference")
                .Select(element => element.Attribute("Include")?.Value ?? "");
            Assert.DoesNotContain(dependencies, IsPersistenceOrWebFramework);
            if (layer == "Domain")
                Assert.DoesNotContain(dependencies, name => name.StartsWith("Microsoft.Extensions.", StringComparison.Ordinal));
        }
    }

    private static string[] ReferencedNames(Assembly assembly) =>
        assembly.GetReferencedAssemblies().Select(reference => reference.Name!).ToArray();

    private static bool IsPersistenceOrWebFramework(string name) =>
        name.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) ||
        name.StartsWith("Microsoft.AspNetCore", StringComparison.Ordinal);

    private static string RepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
            if (File.Exists(Path.Combine(directory.FullName, "RoomReservations.slnx"))) return directory.FullName;
        throw new DirectoryNotFoundException("Cannot locate the solution for project-boundary verification.");
    }
}
