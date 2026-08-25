/**
 * Utility to convert raw Firebase / backend errors into clean, user-friendly
 * error messages matching site styling without technical codes or "Firebase" references.
 */
export function getFriendlyErrorMessage(
  error: unknown,
  defaultMessage = "An error occurred. Please try again."
): string {
  if (!error) return defaultMessage;

  let code = "";
  let message = "";

  if (typeof error === "object" && error !== null) {
    if ("code" in error && typeof (error as any).code === "string") {
      code = (error as any).code;
    }
    if ("message" in error && typeof (error as any).message === "string") {
      message = (error as any).message;
    }
  } else if (typeof error === "string") {
    message = error;
  }

  const combined = `${code} ${message}`.toLowerCase();

  if (
    combined.includes("email-already-in-use") ||
    combined.includes("already in use") ||
    combined.includes("already exists") ||
    combined.includes("already-exists")
  ) {
    return "This email address is already registered. Please sign in or use another email.";
  }
  if (
    combined.includes("invalid-credential") ||
    combined.includes("wrong-password") ||
    combined.includes("user-not-found")
  ) {
    return "Invalid email or password. Please check your credentials and try again.";
  }
  if (combined.includes("invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (combined.includes("user-disabled")) {
    return "This account has been disabled. Please contact support.";
  }
  if (combined.includes("too-many-requests")) {
    return "Too many attempts. Please wait a few moments and try again.";
  }
  if (combined.includes("weak-password")) {
    return "Password is too weak. Please choose a stronger password.";
  }
  if (combined.includes("requires-recent-login")) {
    return "Please log out and log back in before making this change.";
  }
  if (
    combined.includes("network-request-failed") ||
    combined.includes("network error")
  ) {
    return "Network connection issue. Please check your internet connection and try again.";
  }
  if (combined.includes("expired-action-code")) {
    return "This link has expired. Please request a new verification or reset link.";
  }
  if (combined.includes("invalid-action-code")) {
    return "This link is invalid or has already been used. Please request a new one.";
  }
  if (combined.includes("popup-closed-by-user")) {
    return "The sign-in window was closed before completing. Please try again.";
  }
  if (
    combined.includes("permission-denied") ||
    combined.includes("permission_denied")
  ) {
    return "You do not have permission to perform this action.";
  }
  if (combined.includes("quota-exceeded")) {
    return "Service limit reached. Please try again later.";
  }
  if (combined.includes("unavailable")) {
    return "Service is temporarily unavailable. Please try again in a moment.";
  }
  if (
    combined.includes("username_taken") ||
    combined.includes("username is already taken")
  ) {
    return "That username is already taken. Try another.";
  }

  if (message) {
    // Strip technical Firebase wrappers
    let clean = message
      .replace(/^FirebaseError:\s*/i, "")
      .replace(/^Firebase:\s*/i, "")
      .replace(/^Error\s*\([a-z0-9_\-\/]+\):\s*/i, "")
      .replace(/\(auth\/[a-z0-9_\-]+\)\.?/gi, "")
      .replace(/\(firestore\/[a-z0-9_\-]+\)\.?/gi, "")
      .replace(/Firebase/gi, "")
      .trim();

    clean = clean.replace(/^[:\s\-.]+/, "").replace(/[:\s\-.]+$/, "").trim();

    if (clean && !clean.toLowerCase().startsWith("error (")) {
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  }

  return defaultMessage;
}
