type ApiErrorPayload = {
  error?: { message?: string };
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function readErrorMessage(response: Response, fallbackMessage: string) {
  const payload = (await response
    .json()
    .catch(() => null)) as ApiErrorPayload | null;
  return payload?.error?.message ?? fallbackMessage;
}

export async function requestJson<T>(
  url: string,
  init?: RequestInit,
  fallbackMessage = "処理に失敗しました。",
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new ApiClientError(
      await readErrorMessage(response, fallbackMessage),
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
