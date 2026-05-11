import { SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';

export default function Login() {
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  return (
    <>
      <SignedIn>
        <Navigate to={from} replace />
      </SignedIn>
      <SignedOut>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-orange-400 text-2xl">⚡</span>
            <span className="text-slate-900 font-bold text-xl tracking-tight">ShiftSaver AI</span>
          </div>
          <SignIn
            routing="path"
            path="/login"
            signUpUrl="/login"
            afterSignInUrl={from}
            afterSignUpUrl={from}
            appearance={{
              variables: { colorPrimary: '#f97316' },
            }}
          />
        </div>
      </SignedOut>
    </>
  );
}
