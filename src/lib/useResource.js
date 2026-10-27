import { useEffect, useState } from "react";

export function useResource(url, revision = 0) {
  const [state, setState] = useState({
    url: null,
    revision: null,
    data: null,
    error: null,
  });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-cache" })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok)
          throw new Error(value.error || "The data service is unavailable.");
        return value;
      })
      .then((data) => setState({ url, revision, data, error: null }))
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ url, revision, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [url, revision]);
  const current = state.url === url && state.revision === revision;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: Boolean(url) && (!current || (!state.data && !state.error)),
  };
}
