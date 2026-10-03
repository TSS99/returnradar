import { useEffect, useState } from "react";

export function useRoute() {
  const [route, setRoute] = useState(
    window.location.hash.slice(1) || "overview",
  );
  useEffect(() => {
    const change = () => {
      setRoute(window.location.hash.slice(1) || "overview");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return [
    route,
    (page: string) => {
      window.location.hash = page;
    },
  ] as const;
}
