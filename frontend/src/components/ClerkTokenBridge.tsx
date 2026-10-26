import { useEffect, useRef } from 'react';
import { useAuth as useClerkAuth } from '@clerk/react';
import { useAuth } from '../context/AuthContext';
import { fleetService } from '../services/api';
import { CLERK_ENABLED } from '../lib/clerk';

/**
 * Once Clerk has an active session (e.g. after a Google/GitHub redirect),
 * exchange its token for FleetFlow's own HTTP-only cookie so every existing
 * page and API route keeps working unchanged.
 */
function Bridge() {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { isAuthenticated, isLoading, login } = useAuth();
  const running = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || isAuthenticated || isLoading || running.current) return;

    running.current = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fleetService.clerkLogin(token);
        login(response.data.user);
      } catch (error) {
        console.error('Clerk session exchange failed:', error);
      } finally {
        running.current = false;
      }
    })();
  }, [isLoaded, isSignedIn, isAuthenticated, isLoading, getToken, login]);

  return null;
}

export default function ClerkTokenBridge() {
  return CLERK_ENABLED ? <Bridge /> : null;
}
