import { useState } from 'react';
import { Chrome, Github } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSignIn } from '@clerk/react';
import { CLERK_ENABLED } from '../lib/clerk';

const BUTTON_CLASS =
  'flex items-center justify-center gap-3 px-4 py-4 border border-slate-100 rounded-[1.5rem] hover:bg-slate-50 transition-all text-xs font-black text-slate-500 hover:text-slate-900 uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed';

type SocialStrategy = 'oauth_google' | 'oauth_github';

function SocialButtons() {
  const { signIn, fetchStatus } = useSignIn();
  const [pending, setPending] = useState<SocialStrategy | null>(null);

  const start = async (strategy: SocialStrategy) => {
    if (!signIn || pending) return;
    setPending(strategy);
    try {
      const { error } = await signIn.sso({
        strategy,
        redirectCallbackUrl: `${window.location.origin}/sso-callback`,
        redirectUrl: `${window.location.origin}/app`,
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Social sign-in failed:', error);
      toast.error(
        error?.message || 'Social sign-in is unavailable. Enable this provider in Clerk.'
      );
      setPending(null);
    }
  };

  const busy = pending !== null || fetchStatus === 'fetching';

  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => start('oauth_google')}
        className={BUTTON_CLASS}
      >
        <Chrome size={18} />
        Google
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => start('oauth_github')}
        className={BUTTON_CLASS}
      >
        <Github size={18} />
        GitHub
      </button>
    </div>
  );
}

function UnconfiguredButtons() {
  const notify = () => toast.error('Social sign-in is not configured in this build.');
  return (
    <div className="grid grid-cols-2 gap-4">
      <button type="button" onClick={notify} className={BUTTON_CLASS}>
        <Chrome size={18} />
        Google
      </button>
      <button type="button" onClick={notify} className={BUTTON_CLASS}>
        <Github size={18} />
        GitHub
      </button>
    </div>
  );
}

export default function ClerkSocialButtons() {
  return CLERK_ENABLED ? <SocialButtons /> : <UnconfiguredButtons />;
}
