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

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { user, loading, signInWithEmail, signUpWithEmail } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) {
      startTransition(() => {
        router.replace("/");
      });
    }
  }, [user, loading]);

  const friendlyError = (code: string): string => {
    switch (code) {
      case "auth/invalid-email": return t.login_error_invalid_email;
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential": return t.login_error_wrong_password;
      case "auth/email-already-in-use": return t.login_error_email_exists;
      case "auth/weak-password": return t.login_error_weak_password;
      case "auth/too-many-requests": return t.login_error_too_many_requests;
      case "auth/popup-closed-by-user": return t.login_error_popup_closed;
      default: return t.login_error_generic;
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, displayName);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t.login_title}</CardTitle>
          <CardDescription>
            {mode === "signin" ? t.login_sign_in_description : t.login_sign_up_description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Email / password form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName">{t.login_name}</Label>
                <Input
                  id="displayName"
                  placeholder={t.login_name_placeholder}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

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
                  placeholder={mode === "signup" ? t.login_password_signup_placeholder : t.login_password_signin_placeholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
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
              {submitting
                ? mode === "signin" ? t.login_signing_in : t.login_creating
                : mode === "signin" ? t.login_sign_in : t.login_create_account}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                {t.login_no_account}{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => { setMode("signup"); setError(""); }}
                >
                  {t.login_create_one}
                </button>
              </>
            ) : (
              <>
                {t.login_have_account}{" "}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => { setMode("signin"); setError(""); }}
                >
                  {t.login_sign_in_link}
                </button>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

