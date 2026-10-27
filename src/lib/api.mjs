const unavailable = "The data service is unavailable. Please try again.";

export async function fetchJson(url, signal, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(url, { signal, cache: "no-cache" });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(unavailable);
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(unavailable);
  }
  let value;
  try {
    value = await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "The data service returned an unreadable response. Please try again.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof value?.error === "string" ? value.error : unavailable,
    );
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      "The data service returned an unexpected response. Please try again.",
    );
  }
  return value;
}
