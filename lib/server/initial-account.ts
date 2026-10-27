import "server-only";

// Used only when the private account store is empty. Never imported by client code.
// Password changes are stored separately and are not overwritten on deployment.
export const initialEmail = "rabbikhan11002299@gmail.com";
export const initialPasswordHash = process.env.AUTH_INITIAL_PASSWORD_HASH?.trim() || "";
