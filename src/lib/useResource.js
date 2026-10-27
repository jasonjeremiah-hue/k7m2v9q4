import { useEffect, useState } from "react";
import { fetchJson } from "./api.mjs";

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
    let active = true;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);
    fetchJson(url, controller.signal)
      .then((data) => {
        if (active) setState({ url, revision, data, error: null });
      })
      .catch((error) => {
        if (active && (error.name !== "AbortError" || timedOut))
          setState({
            url,
            revision,
            data: null,
            error: timedOut
              ? "The data service took too long. Please try again."
              : error.message,
          });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, revision]);
  const current = state.url === url && state.revision === revision;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: Boolean(url) && (!current || (!state.data && !state.error)),
  };
}
