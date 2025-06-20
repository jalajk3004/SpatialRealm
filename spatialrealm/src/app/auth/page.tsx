"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSession, signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';


export default function Auth() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-4 h-4 bg-cyan-400 animate-pulse"></div>
        <div className="absolute top-40 right-32 w-3 h-3 bg-pink-400 animate-pulse delay-300"></div>
        <div className="absolute bottom-32 left-40 w-5 h-5 bg-yellow-400 animate-pulse delay-700"></div>
        <div className="absolute bottom-20 right-20 w-4 h-4 bg-green-400 animate-pulse delay-500"></div>
        <div className="absolute top-60 left-1/2 w-3 h-3 bg-red-400 animate-pulse delay-1000"></div>
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      ></div>

      <Card className="w-full max-w-md bg-slate-800/90 border-2 border-cyan-400 shadow-2xl shadow-cyan-400/20 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-2xl font-bold text-slate-900 shadow-lg">
            SR
          </div>
          <CardTitle className="text-3xl font-bold text-cyan-400 font-mono tracking-wider">SPATIAL REALM</CardTitle>
          <CardDescription className="text-slate-300 font-mono text-sm">{"> INITIALIZE_CONNECTION"}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-slate-400 font-mono text-xs mb-6">{"[AUTHENTICATION_REQUIRED]"}</p>
          </div>

          {status === "loading" ? (
            <div className="text-center text-white">Loading session...</div>
          ) : session ? (
            <Button
              onClick={handleSignOut}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-mono font-bold text-sm tracking-wider border-2 border-transparent hover:border-white/20 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              SIGN OUT
            </Button>
          ) : (
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white font-mono font-bold text-sm tracking-wider border-2 border-transparent hover:border-white/20 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{"CONNECTING..."}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>{"CONNECT_WITH_GOOGLE"}</span>
                </div>
              )}
            </Button>
          )}

          <div className="text-center">
            <p className="text-slate-500 font-mono text-xs">{"> SECURE_PORTAL_ACCESS"}</p>
          </div>

          <div className="flex justify-center space-x-2 pt-4">
            <div className="w-2 h-2 bg-cyan-400 animate-pulse"></div>
            <div className="w-2 h-2 bg-purple-400 animate-pulse delay-200"></div>
            <div className="w-2 h-2 bg-pink-400 animate-pulse delay-400"></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
