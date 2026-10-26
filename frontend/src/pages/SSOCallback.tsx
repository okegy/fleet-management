import { HandleSSOCallback } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { CLERK_ENABLED } from '../lib/clerk';

export default function SSOCallback() {
  const navigate = useNavigate();

  if (!CLERK_ENABLED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 text-center">
        <p className="text-slate-500 font-bold">
          Social sign-in is not configured for this deployment.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      <HandleSSOCallback
        navigateToApp={() => navigate('/app', { replace: true })}
        navigateToSignIn={() => navigate('/login', { replace: true })}
        navigateToSignUp={() => navigate('/register', { replace: true })}
      />
    </div>
  );
}
