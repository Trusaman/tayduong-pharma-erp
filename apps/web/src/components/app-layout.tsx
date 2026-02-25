import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useState } from "react";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import UserMenu from "@/components/user-menu";
import Sidebar from "@/components/sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <>
      <Authenticated>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="flex h-14 items-center justify-between border-b bg-white px-6 shadow-sm">
              <h1 className="text-lg font-semibold text-slate-800">ERP Dashboard</h1>
              <UserMenu />
            </div>
            <div className="p-6 bg-slate-50/50 min-h-[calc(100vh-3.5rem)]">{children}</div>
          </main>
        </div>
      </Authenticated>
      <Unauthenticated>
        <div className="flex min-h-screen items-center justify-center bg-muted/40">
          <div className="w-full max-w-md p-6">
            {showSignIn ? (
              <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
            ) : (
              <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
            )}
          </div>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AuthLoading>
    </>
  );
}
