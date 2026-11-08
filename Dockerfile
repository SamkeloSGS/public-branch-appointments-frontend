# The frontend image: the production build served by nginx, which also proxies /api to the backend.
#   docker build -t branch-appointments-frontend .
#   docker run -p 4200:8080 -e BACKEND_URL=http://backend:8081 branch-appointments-frontend
# Lint, unit tests and the API contract check run in CI before this (the build here is `ng build` only).
# The Keycloak address is built in from src/environments/environment.ts.

# The bundle is the same for every platform, so it is built once, natively, even for a multi-platform image
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
RUN npx ng build --configuration production

# Unprivileged nginx: runs as a non-root user and listens on 8080
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /build/dist/branch-appointments-frontend/browser /usr/share/nginx/html
# Where nginx sends /api; the image's entrypoint fills the template with it at start-up
ENV BACKEND_URL=http://backend:8081
EXPOSE 8080
