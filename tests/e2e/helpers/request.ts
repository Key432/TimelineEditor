import type { APIRequestContext, APIResponse } from "@playwright/test";

type PostOptions = Parameters<APIRequestContext["post"]>[1];

export async function postAfterConnectionReset(
  request: APIRequestContext,
  url: string,
  options?: PostOptions,
): Promise<APIResponse> {
  try {
    return await request.post(url, options);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ECONNRESET")) {
      throw error;
    }
    return request.post(url, options);
  }
}
