"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

const COOKIE_NAME = "irf-hide-amounts";

type PrivacyState = { hidden: boolean; toggle: () => void };

// Safe default so Masked/PrivacyToggle can render outside the provider
// (amounts simply stay visible there).
const PrivacyContext = createContext<PrivacyState>({
  hidden: false,
  toggle: () => {},
});

export function usePrivacy(): PrivacyState {
  return useContext(PrivacyContext);
}

/**
 * "Hide amounts" mode (the eye button next to the balance). The initial value
 * comes from a cookie read on the server, so SSR already renders the right
 * masked/unmasked state — no flash of visible amounts on load. Toggling flips
 * the state instantly on the client and persists it back to the cookie for
 * the next request.
 */
export function PrivacyProvider({
  initialHidden,
  children,
}: {
  initialHidden: boolean;
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(initialHidden);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      document.cookie = `${COOKIE_NAME}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>
      {children}
    </PrivacyContext.Provider>
  );
}
