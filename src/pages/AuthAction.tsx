import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset, checkActionCode } from "firebase/auth";
import { auth } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

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
                        // Verify the code first
                        await verifyPasswordResetCode(auth, oobCode);
                        setStatus("input");
                        break;
                    case "recoverEmail":
                        // Revert the email change
                        await checkActionCode(auth, oobCode);
                        await applyActionCode(auth, oobCode);
                        setStatus("success");
                        setMessage("Your email address has been successfully recovered.");
                        break;
                    case "verifyEmail":
                        // Apply the email verification
                        await applyActionCode(auth, oobCode);
                        setStatus("success");
                        setMessage("Your email address has been successfully verified.");
                        break;
                    default:
                        setStatus("error");
                        setMessage("Invalid mode.");
                        break;
                }
            } catch (error: any) {
                setStatus("error");
                setMessage(error.message || "An error occurred while processing your request. The link may have expired or already been used.");
            }
        };

        handleAction();
    }, [mode, oobCode]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage("Passwords do not match.");
            return;
        }
        if (newPassword.length < 6) {
            setMessage("Password must be at least 6 characters.");
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
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-xl border-foreground/10 bg-foreground/5 backdrop-blur-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        {status === "loading" && <Loader2 className="h-5 w-5 animate-spin" />}
                        {status === "success" && <CheckCircle className="h-6 w-6 text-green-500" />}
                        {status === "error" && <AlertCircle className="h-6 w-6 text-red-500" />}
                        {mode === "resetPassword" ? "Reset Password" : mode === "recoverEmail" ? "Recover Email" : mode === "verifyEmail" ? "Verify Email" : "Authentication Action"}
                    </CardTitle>
                    {status !== "input" && (
                        <CardDescription className="text-base text-muted-foreground mt-2">
                            {status === "loading" ? "Processing your request..." : message}
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent>
                    {status === "input" && mode === "resetPassword" && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            {message && (
                                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                                    {message}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="bg-foreground/5 border-foreground/10 h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="bg-foreground/5 border-foreground/10 h-11"
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                Save Password
                            </Button>
                        </form>
                    )}

                    {(status === "success" || status === "error") && (
                        <div className="space-y-3 mt-4">
                            <Button
                                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => navigate("/login")}
                            >
                                Continue to Login
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
