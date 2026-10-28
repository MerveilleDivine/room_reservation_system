FROM node:24-bookworm-slim AS web
WORKDIR /source/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /source
COPY Directory.Build.props global.json ./
COPY src/RoomReservations.Api/RoomReservations.Api.csproj src/RoomReservations.Api/
RUN dotnet restore src/RoomReservations.Api/RoomReservations.Api.csproj
COPY src/ src/
RUN dotnet publish src/RoomReservations.Api --configuration Release --no-restore --output /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV PORT=8080
EXPOSE 8080
COPY --from=api /app/ ./
COPY --from=web /source/web/dist/ ./wwwroot/
USER $APP_UID
ENTRYPOINT ["sh", "-c", "exec dotnet RoomReservations.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
