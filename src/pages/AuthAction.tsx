import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset, checkActionCode } from "firebase/auth";
import { auth } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { getPasswordPolicyChecks, isPasswordPolicyValid, PASSWORD_POLICY_ERROR_MESSAGE } from "@/lib/passwordPolicy";

export default function AuthAction() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");

    const [status, setStatus] = useState<"loading" | "success" | "error" | "input">("loading");
    const [message, setMessage] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const passwordChecks = getPasswordPolicyChecks(newPassword);
    const isPasswordValid = isPasswordPolicyValid(newPassword);
    const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

    const title =
        mode === "resetPassword"
            ? "Reset password"
            : mode === "recoverEmail"
              ? "Recover email"
              : mode === "verifyEmail"
                ? "Verify email"
                : "Authentication";

    const badge =
        mode === "resetPassword"
            ? "Password reset"
            : mode === "recoverEmail"
              ? "Email recovery"
              : mode === "verifyEmail"
                ? "Email verification"
                : "Account action";

    useEffect(() => {
        if (!mode || !oobCode) {
            setStatus("error");
            setMessage("Invalid link. Missing action code or mode.");
            return;
        }

        const handleAction = async () => {
            try {
                switch (mode) {
                    case "resetPassword":
                        await verifyPasswordResetCode(auth, oobCode);
                        setStatus("input");
                        break;
                    case "recoverEmail":
                        await checkActionCode(auth, oobCode);
                        await applyActionCode(auth, oobCode);
                        setStatus("success");
                        setMessage("Your email address has been successfully recovered.");
                        break;
                    case "verifyEmail":
                        await applyActionCode(auth, oobCode);
                        setStatus("success");
                        setMessage("Your email has been verified. You can now sign in and access your Pharma SocII account.");
                        break;
                    default:
                        setStatus("error");
                        setMessage("Invalid mode.");
                        break;
                }
            } catch (error: any) {
                setStatus("error");
                setMessage(
                    error.message ||
                        "An error occurred while processing your request. The link may have expired or already been used.",
                );
            }
        };

        handleAction();
    }, [mode, oobCode]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("");
        if (!isPasswordValid) {
            setMessage(PASSWORD_POLICY_ERROR_MESSAGE);
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);
        try {
            await confirmPasswordReset(auth, oobCode!, newPassword);
            setStatus("success");
            setMessage("Your password has been successfully reset. You can now log in with your new password.");
        } catch (error: any) {
            setStatus("error");
            setMessage(error.message || "Failed to reset password.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center w-full bg-background text-foreground relative overflow-hidden min-h-[80vh] px-4">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[128px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-md border border-foreground/10 rounded-2xl bg-foreground/[0.02] p-8 shadow-xl">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="inline-flex items-center py-1 px-3 mb-6 rounded-full border border-foreground/10 bg-foreground/5 text-sm font-medium">
                        {badge}
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        {status === "loading" && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                        {status === "success" && <CheckCircle className="h-6 w-6 text-emerald-600" />}
                        {status === "error" && <AlertCircle className="h-6 w-6 text-destructive" />}
                        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                    </div>
                    {status === "loading" && (
                        <p className="text-sm text-muted-foreground">Processing your request…</p>
                    )}
                    {status !== "loading" && status !== "input" && message && (
                        <p className="text-sm text-muted-foreground mt-1">{message}</p>
                    )}
                    {status === "input" && mode === "resetPassword" && (
                        <p className="text-sm text-muted-foreground mt-1">
                            Choose a new password for your Pharma SocII account.
                        </p>
                    )}
                </div>

                {status === "input" && mode === "resetPassword" && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        {message && (
                            <p className="text-sm text-destructive">{message}</p>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New password</Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="bg-foreground/5 border-foreground/10 h-11 pr-10"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {newPassword && (
                                <ul className="text-xs text-muted-foreground space-y-1 mt-2 p-3 rounded-md border border-foreground/10 bg-foreground/5">
                                    <li className={passwordChecks.minLength ? "text-emerald-600" : ""}>At least 8 characters</li>
                                    <li className={passwordChecks.uppercase ? "text-emerald-600" : ""}>At least 1 uppercase letter</li>
                                    <li className={passwordChecks.lowercase ? "text-emerald-600" : ""}>At least 1 lowercase letter</li>
                                    <li className={passwordChecks.special ? "text-emerald-600" : ""}>At least 1 special character</li>
                                </ul>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm new password</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="bg-foreground/5 border-foreground/10 h-11 pr-10"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    tabIndex={-1}
                                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {passwordsMismatch && (
                                <p className="text-xs text-destructive">Passwords do not match.</p>
                            )}
                        </div>
                        <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                            Save password
                        </Button>
                    </form>
                )}

                {(status === "success" || status === "error") && (
                    <div className="space-y-3">
                        <Button className="w-full h-11" onClick={() => navigate("/login")}>
                            Continue to login
                        </Button>
                        <Button variant="ghost" asChild className="w-full">
                            <Link to="/" className="flex items-center justify-center gap-2">
                                <ArrowLeft className="w-4 h-4" /> Back to Home
                            </Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
