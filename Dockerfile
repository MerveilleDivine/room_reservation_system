FROM node:24-bookworm-slim AS web
WORKDIR /source/web
COPY web/package.json web/package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci
COPY web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /source
# Build stages must not leave persistent MSBuild/diagnostic sockets in layers.
ENV DOTNET_CLI_USE_MSBUILD_SERVER=0 MSBUILDDISABLENODEREUSE=1 DOTNET_EnableDiagnostics=0
COPY Directory.Build.props global.json ./
COPY src/RoomReservations.Api/RoomReservations.Api.csproj src/RoomReservations.Api/
COPY src/RoomReservations.Domain/RoomReservations.Domain.csproj src/RoomReservations.Domain/
COPY src/RoomReservations.Application/RoomReservations.Application.csproj src/RoomReservations.Application/
COPY src/RoomReservations.Infrastructure/RoomReservations.Infrastructure.csproj src/RoomReservations.Infrastructure/
RUN --mount=type=secret,id=ca_bundle \
    if [ -f /run/secrets/ca_bundle ]; then export SSL_CERT_FILE=/run/secrets/ca_bundle; fi; \
    dotnet restore src/RoomReservations.Api/RoomReservations.Api.csproj --disable-build-servers
COPY src/ src/
RUN dotnet publish src/RoomReservations.Api --configuration Release --no-restore --disable-build-servers --output /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV PORT=8080
EXPOSE 8080
COPY --from=api /app/ ./
COPY --from=web /source/web/dist/ ./wwwroot/
USER $APP_UID
ENTRYPOINT ["sh", "-c", "exec dotnet RoomReservations.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
