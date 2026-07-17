type OAuthOriginOptions = {
  configuredAppUrl: string;
  nodeEnv: string | undefined;
  requestHost: string | null;
  requestOrigin: string | null;
};

function isLoopbackOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export function resolveOAuthOrigin({
  configuredAppUrl,
  nodeEnv,
  requestHost,
  requestOrigin,
}: OAuthOriginOptions) {
  if (nodeEnv === "development") {
    if (requestOrigin && isLoopbackOrigin(requestOrigin)) {
      return requestOrigin;
    }

    if (!requestOrigin && requestHost) {
      const hostOrigin = `http://${requestHost}`;
      if (isLoopbackOrigin(hostOrigin)) {
        return hostOrigin;
      }
    }
  }

  return configuredAppUrl;
}

export function buildOAuthCallbackUrl(origin: string) {
  return new URL("/auth/callback", origin).toString();
}
