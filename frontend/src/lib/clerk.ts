export const CLERK_PUBLISHABLE_KEY =
  ((import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim() || '';

export const CLERK_ENABLED = CLERK_PUBLISHABLE_KEY.startsWith('pk_');
