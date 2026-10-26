import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { CLERK_ENABLED, CLERK_PUBLISHABLE_KEY } from './lib/clerk';
import './index.css';

const routerApp = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {CLERK_ENABLED ? (
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/login">
          {routerApp}
        </ClerkProvider>
      ) : (
        routerApp
      )}
    </ErrorBoundary>
  </StrictMode>,
);
