import { useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import {
    signInWithPopup,
    signInWithEmailAndPassword,
    linkWithCredential,
    fetchSignInMethodsForEmail,
    GoogleAuthProvider,
    type AuthCredential,
} from "firebase/auth";
import { auth, googleProvider } from "../../lib/firebase";
import { firebaseLogin } from "../../api/apiCalls";
import { mapBackendUser } from "../../lib/utils";
import { Btn, Input, FLabel } from "../ui";
import type { AppUser } from "../../lib/types";

interface LoginPageProps {
    onLogin: (user: AppUser) => void;
}

// Friendly messages for common Firebase auth errors
const friendlyAuthError = (error: any): string => {
    switch (error?.code) {
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Incorrect email or password.";
        case "auth/user-not-found":
            return "No account found with this email.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/too-many-requests":
            return "Too many attempts. Please try again later.";
        case "auth/network-request-failed":
            return "Network error. Please check your connection.";
        case "auth/popup-blocked":
            return "Your browser blocked the sign-in window. Allow popups for this site and try again.";
        case "auth/popup-closed-by-user":
            return "Sign-in window closed before completing.";
        case "auth/cancelled-popup-request":
            return "Sign-in was cancelled. Please try again.";
        case "auth/unauthorized-domain":
            return "This site is not authorized for Firebase sign-in. Add it under Firebase Console → Authentication → Settings → Authorized domains.";
        case "auth/operation-not-allowed":
            return "Google sign-in is not enabled for this project. Enable it in Firebase Console → Authentication → Sign-in method.";
        case "auth/account-exists-with-different-credential":
            return "An account with this email already exists (created with a password). Sign in with your email & password below — your Google account will be linked automatically.";
        default:
            return error?.response?.data?.msg ?? error?.message ?? "Login failed";
    }
};

export function LoginPage({ onLogin }: LoginPageProps) {
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);

    // When Google sign-in is blocked because a password account with the same
    // email already exists, keep the Google credential here. After a successful
    // password login we link it, so Google login works from then on.
    const pendingGoogleCred = useRef<AuthCredential | null>(null);

    // Shared finish: backend JWT exchange → localStorage → dashboard with user alert
    const finishLogin = (res: any) => {
        if (!res?.success || !res.data?.token) {
            setErr(res?.msg ?? "Login failed");
            return;
        }

        // This system is for staff & admin only — student JWTs are rejected
        // here (the backend also rejects their data calls).
        if (res.data.user?.roles && res.data.user.roles === "student") {
            setErr("Only staff and admin accounts can access the management system.");
            return;
        }

        // Persist session (no refresh token — single long-lived JWT)
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));

        const user = mapBackendUser(res.data.user);
        alert(`Login successful\n\n${JSON.stringify(user, null, 2)}`);
        onLogin(user); // Shell opens on the Dashboard section by default
    };

    // Email + password login (works when a password was set for the account)
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr("");
        setBusy(true);
        try {
            const userCred = await signInWithEmailAndPassword(auth, email, pass);

            // Link a Google credential that was blocked earlier, so the same
            // Google account can sign in directly next time.
            if (pendingGoogleCred.current) {
                try {
                    await linkWithCredential(userCred.user, pendingGoogleCred.current);
                    console.log("Linked Google account to existing password account.");
                } catch (linkErr: any) {
                    console.warn("Google account linking skipped:", linkErr?.code ?? linkErr);
                }
                pendingGoogleCred.current = null;
            }

            const idToken = await userCred.user.getIdToken();
            const res = await firebaseLogin(idToken);
            finishLogin(res);
        } catch (error: any) {
            console.error("Password login failed:", error);
            setErr(friendlyAuthError(error));
        } finally {
            setBusy(false);
        }
    };

    // Sign in with Google → exchange the Google ID token for a backend JWT
    const googleLogin = async () => {
        setErr("");
        setBusy(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            console.log("Google sign-in response:", result);

            // Debug: the raw Google OAuth credential (its idToken is a Google
            // token — NOT what the backend verifies, see below)
            const googleCredential = GoogleAuthProvider.credentialFromResult(result);
            if (googleCredential) console.log("Google OAuth credential:", googleCredential);

            // The backend verifies a Firebase Auth ID token, so take it from the
            // signed-in user. No refresh token is used anywhere in this system —
            // just this single access token, exchanged for the backend JWT.
            const idToken = await result.user.getIdToken();
            if (!idToken) {
                setErr("No Firebase ID token received.");
                return;
            }

            const res = await firebaseLogin(idToken);
            finishLogin(res);
        } catch (error: any) {
            console.error("Google sign-in failed:", error);
            const credential = GoogleAuthProvider.credentialFromError(error);
            if (credential) console.log("Google credential from error:", credential);

            // Email is already registered with a password: stash the credential,
            // prefill the form, and point the user at the password login. The
            // credential gets linked automatically after they sign in.
            if (error?.code === "auth/account-exists-with-different-credential") {
                pendingGoogleCred.current = credential ?? null;
                const accountEmail: string | undefined =
                    error?.customData?.email || error?.email;
                if (typeof accountEmail === "string" && accountEmail) {
                    setEmail(accountEmail);
                    try {
                        const methods = await fetchSignInMethodsForEmail(auth, accountEmail);
                        console.log("Sign-in methods for", accountEmail, ":", methods);
                    } catch (methodsErr) {
                        console.warn("Could not fetch sign-in methods:", methodsErr);
                    }
                }
            }

            setErr(friendlyAuthError(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex">
            {/* Left panel */}
            <div className="hidden lg:flex flex-col justify-between w-[44%] bg-primary p-12 text-primary-foreground">
                {/* <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.00),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.12),transparent_40%)]" /> */}
                <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:46px_46px]" />
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-accent-foreground" />
                    </div>
                    <div>
                        <p className="font-bold text-sm leading-none">Maths Institute</p>
                        <p className="text-primary-foreground/60 text-xs mt-0.5">Management System</p>
                    </div>
                </div>
                <div>
                    <p className="text-accent/80 text-sm font-medium uppercase tracking-widest mb-4">
                        Advanced Level
                    </p>
                    <h1
                        className="text-4xl font-bold leading-tight mb-4"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        Combined<br />Mathematics
                    </h1>
                    <p className="text-primary-foreground/60 text-base leading-relaxed max-w-sm">
                        Track students, manage attendance, record fees, analyse performance —
                        everything your institute needs in one place.
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-6 border-t border-primary-foreground/10 pt-8">
                    {[
                        { n: "16", l: "Students" },
                        { n: "4", l: "Batches" },
                        { n: "98%", l: "Pass Rate" },
                    ].map(({ n, l }) => (
                        <div key={l}>
                            <p className="text-3xl font-bold">{n}</p>
                            <p className="text-primary-foreground/50 text-xs mt-1">{l}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right panel */}
            <div className="flex-1 flex items-center justify-center p-8 z-10">
                <div className="w-full max-w-sm">
                    <div className="lg:hidden flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <span className="font-bold text-lg">Maths Institute</span>
                    </div>

                    <h2 className="text-2xl font-bold text-foreground mb-1">Welcome back</h2>
                    <p className="text-muted-foreground text-sm mb-8">
                        Sign in to access the management system
                    </p>

                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <FLabel>Email Address</FLabel>
                            <Input
                                type="email"
                                placeholder="your@mathsinstitute.lk"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <FLabel>Password</FLabel>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={pass}
                                onChange={(e) => setPass(e.target.value)}
                                required
                            />
                        </div>
                        {err && (
                            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                                {err}
                            </p>
                        )}
                        <Btn type="submit" className="w-full justify-center" sz="lg" disabled={busy}>
                            {busy ? "Signing In…" : "Sign In"}
                        </Btn>
                    </form>

                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">or</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    <Btn
                        type="button"
                        v="outline"
                        className="w-full justify-center"
                        sz="lg"
                        onClick={googleLogin}
                        disabled={busy}
                    >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
                            <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
                        </svg>
                        {busy ? "Signing In…" : "Sign in with Google"}
                    </Btn>   

                    <div className="mt-8 p-4 bg-muted/60 rounded-xl border border-border">
                        <p className="text-xs font-semibold text-foreground mb-2">
                            Staff &amp; Admin Accounts
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Accounts are created by the administrator. Use your email &amp; password
                            if one was set for you, or sign in with your Google account.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
