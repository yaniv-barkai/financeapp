"use client";

import React, { useState, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { user, loading, signInWithEmail, accountBlocked, signOutUser } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user && !accountBlocked) {
      startTransition(() => {
        router.replace("/");
      });
    }
  }, [user, loading, accountBlocked, router]);

  const friendlyError = (code: string): string => {
    switch (code) {
      case "auth/invalid-email":
        return t.login_error_invalid_email;
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return t.login_error_wrong_password;
      case "auth/user-disabled":
        return t.login_error_disabled;
      case "auth/too-many-requests":
        return t.login_error_too_many_requests;
      case "auth/popup-closed-by-user":
        return t.login_error_popup_closed;
      default:
        return t.login_error_generic;
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && user && accountBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-sm shadow-xl">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t.login_title}</CardTitle>
            <CardDescription>{t.login_account_blocked}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full h-11" variant="outline" onClick={() => signOutUser()}>
              {t.login_sign_out_blocked}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t.login_title}</CardTitle>
          <CardDescription>{t.login_sign_in_description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t.login_email}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t.login_email_placeholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t.login_password}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t.login_password_signin_placeholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pe-10"
                />
                <button
                  type="button"
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {submitting ? t.login_signing_in : t.login_sign_in}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
