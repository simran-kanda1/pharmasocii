export const isValidBusinessAddress = (value: string): boolean => {
    const address = (value || "").trim();
    if (address.length < 8) return false;
    // Basic sanity checks: requires both letters and numbers.
    if (!/[A-Za-z]/.test(address)) return false;
    if (!/\d/.test(address)) return false;
    return true;
};
