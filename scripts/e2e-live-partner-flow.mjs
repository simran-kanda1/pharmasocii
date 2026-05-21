/**
 * Live E2E: register → buy basic event → upgrade → add spotlight → verify placement.
 * Run: node scripts/e2e-live-partner-flow.mjs
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const BASE = "https://orange-bear-967180.hostingersite.com";
const STAMP = Date.now();
const EMAIL = `e2e.partner.${STAMP}@mailinator.test`;
const PASSWORD = "TestPass1!";
const EVENT_NAME = `E2E Summit ${STAMP}`;
const OUT_DIR = join(process.cwd(), "scripts", "e2e-output");

const results = [];

function log(step, ok, detail = "") {
    const line = `${ok ? "✓" : "✗"} ${step}${detail ? `: ${detail}` : ""}`;
    console.log(line);
    results.push({ step, ok, detail });
}

async function fillStripeCheckout(page) {
    if (!/checkout\.stripe\.com|stripe\.com/.test(page.url())) {
        await page.waitForURL(/checkout\.stripe\.com|stripe\.com/, { timeout: 60000 });
    }
    await page.waitForTimeout(2000);

    const tryFill = async (selectors, value) => {
        for (const sel of selectors) {
            const loc = page.locator(sel).first();
            if ((await loc.count()) > 0) {
                await loc.fill(value, { timeout: 5000 });
                return true;
            }
        }
        for (const frame of page.frames()) {
            for (const sel of selectors) {
                const loc = frame.locator(sel).first();
                if ((await loc.count()) > 0) {
                    await loc.fill(value, { timeout: 5000 });
                    return true;
                }
            }
        }
        return false;
    };

    await tryFill(
        ['input[name="cardNumber"]', 'input[autocomplete="cc-number"]', '[placeholder*="1234"]'],
        "4242424242424242"
    );
    await tryFill(
        ['input[name="cardExpiry"]', 'input[autocomplete="cc-exp"]', '[placeholder*="MM"]'],
        "04 / 29"
    );
    await tryFill(
        ['input[name="cardCvc"]', 'input[autocomplete="cc-csc"]', '[placeholder*="CVC"]'],
        "123"
    );
    await tryFill(
        ['input[name="billingPostalCode"]', 'input[autocomplete="postal-code"]', '[placeholder*="Postal"]'],
        "l5m5b6"
    );

    const payBtn = page.getByRole("button", { name: /pay|subscribe|complete/i }).first();
    await payBtn.click({ timeout: 30000 });
    await page.waitForURL(/hostingersite\.com/, { timeout: 180000 });
}

async function selectRadixOption(page, triggerText, optionText) {
    const trigger = page.locator("button", { hasText: triggerText }).first();
    if ((await trigger.count()) === 0) {
        await page.getByText(triggerText, { exact: false }).first().click();
    } else {
        await trigger.click();
    }
    await page.waitForTimeout(400);
    await page.getByRole("option", { name: optionText }).click();
}

async function main() {
    await mkdir(OUT_DIR, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(90000);

    try {
        // ── 1. Register ──
        await page.goto(`${BASE}/partner/register`, { waitUntil: "networkidle" });
        await page.locator("#firstName").fill("E2E");
        await page.locator("#lastName").fill("Tester");
        await page.locator("#email").fill(EMAIL);
        await page.locator("#password").fill(PASSWORD);
        await page.locator("#confirmPassword").fill(PASSWORD);
        await page.locator(".PhoneInputInput").fill("+14165551234");
        await page.locator("#companyName").fill(`E2E Labs ${STAMP}`);
        await page.locator("#altFirstName").fill("Alt");
        await page.locator("#altLastName").fill("Contact");
        await page.locator("#altEmail").fill(`alt.${EMAIL}`);
        await page.getByRole("button", { name: /Set up profile/i }).click();
        await page.waitForSelector("text=Account Created", { timeout: 60000 });
        await page.goto(`${BASE}/partner/complete-profile`, { waitUntil: "networkidle" });
        log("Register + open complete profile", true, EMAIL);

        // ── 2. Complete profile (basic event) ──
        await page.locator("#companyWebsite").fill("https://example.com");
        await page.locator("#businessPhone").locator("..").locator(".PhoneInputInput").fill("+14165559876");
        await page.locator("#companyProfile").fill("E2E test company profile for automated partner flow validation.");
        await page.locator("#businessAddress").fill("123 Main Street, Toronto ON M5V 1A1");
        await page.getByText("Business Headquarters").locator("..").getByRole("combobox").click();
        await page.getByRole("option", { name: "Canada" }).click();

        await page.getByText("Select group", { exact: true }).click();
        await page.getByRole("option", { name: /Events/i }).click();
        await page.waitForTimeout(500);
        await page.getByText("Select plan", { exact: true }).click();
        await page.getByRole("option", { name: /Basic.*500/i }).click();
        await page.waitForTimeout(800);

        await page.getByText("Event name").locator("..").locator("input").fill(EVENT_NAME);
        await page.getByText("Event link").locator("..").locator("input").fill("https://example.com/e2e-event");
        const today = new Date();
        const start = today.toISOString().slice(0, 10);
        await page.getByText(/Event date|Start date/i).first().locator("..").locator('input[type="date"]').fill(start);
        await page.getByText("Country", { exact: true }).nth(2).click().catch(() => {});
        await page.getByRole("option", { name: "Canada" }).click().catch(async () => {
            await page.locator('input[type="date"]').nth(0).fill(start);
        });
        await page.getByText("State").locator("..").locator("input").fill("Ontario");
        await page.getByText("City").locator("..").locator("input").fill("Toronto");
        await page.getByText(/Venue|location/i).first().locator("..").locator("input").fill("Convention Centre");
        await page.getByText("Agenda highlights").locator("..").locator("textarea").fill("Day one highlights for E2E automated test event listing.");
        await page.getByPlaceholder("https://…").fill("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
        await page.getByText("Event profile").locator("..").locator("textarea").fill("Full event profile text for E2E validation of partner event listing purchase flow.");

        await page.getByLabel("Oncology").check().catch(async () => {
            await page.locator('label:has-text("Oncology")').click();
        });

        const checkoutRespPromise = page.waitForResponse(
            (r) => r.url().includes("create-checkout-session") && r.request().method() === "POST",
            { timeout: 180000 }
        );
        await page.getByRole("button", { name: /Continue to Payment/i }).click();
        const checkoutResp = await checkoutRespPromise;
        const checkoutData = await checkoutResp.json();
        if (!checkoutResp.ok() || !checkoutData?.url) {
            const pageErr = await page.locator(".text-red-500, .text-destructive").first().textContent().catch(() => "");
            throw new Error(`Checkout failed (${checkoutResp.status()}): ${checkoutData?.error || pageErr || "no url"}`);
        }
        await page.goto(checkoutData.url, { waitUntil: "domcontentloaded" });
        log("Submit complete profile + checkout session", true);

        // ── 3. Stripe checkout (initial plan) ──
        await fillStripeCheckout(page);
        await page.waitForURL(/partner\/dashboard/, { timeout: 180000 });
        await page.waitForTimeout(5000);
        log("Initial plan checkout", true);

        // ── 4. Upgrade plan basic → standard ──
        await page.getByRole("button", { name: /Upgrade plan/i }).first().click();
        await page.waitForTimeout(1000);
        await page.getByText(/Standard.*850/i).first().click();
        await page.getByRole("button", { name: /Continue/i }).click();
        await page.waitForSelector("text=Edit Listing", { timeout: 30000 });

        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 7);
        const end = endDate.toISOString().slice(0, 10);
        const endInput = page.locator('input[type="date"]').nth(1);
        await endInput.fill(end);
        await page.getByRole("button", { name: /Save.*Stripe/i }).click();
        await fillStripeCheckout(page);
        await page.waitForURL(/partner\/dashboard/, { timeout: 180000 });
        await page.waitForTimeout(8000);
        log("Plan upgrade checkout", true, `end date target ${end}`);

        // ── 5. Add landing page spotlight ──
        await page.getByRole("button", { name: /Add spotlight/i }).first().click();
        await page.waitForTimeout(1000);
        await page.getByText(/Landing Page Spotlight/i).first().click();
        await page.getByRole("button", { name: /Continue to payment|Purchase/i }).click();
        await fillStripeCheckout(page);
        await page.waitForURL(/partner\/dashboard/, { timeout: 180000 });
        await page.waitForTimeout(10000);
        log("Feature spotlight checkout", true);

        // ── 6. Verify placement on events category page (landing_page) ──
        await page.goto(`${BASE}/all-categories/events`, { waitUntil: "networkidle" });
        await page.waitForTimeout(5000);
        const onCategory = await page.getByText(EVENT_NAME).first().isVisible().catch(() => false);
        await page.screenshot({ path: join(OUT_DIR, `category-events-${STAMP}.png`), fullPage: true });

        await page.goto(BASE, { waitUntil: "networkidle" });
        await page.waitForTimeout(3000);
        const onHome = await page.getByText(EVENT_NAME).first().isVisible().catch(() => false);
        await page.screenshot({ path: join(OUT_DIR, `home-${STAMP}.png`), fullPage: true });

        log(
            "Featured on events category page (landing spotlight)",
            onCategory,
            onCategory ? EVENT_NAME : "not found — check scripts/e2e-output screenshot"
        );
        log(
            "Featured on home page",
            onHome,
            onHome ? EVENT_NAME : "expected hidden for landing_page-only spotlight"
        );

        const summary = {
            email: EMAIL,
            password: PASSWORD,
            eventName: EVENT_NAME,
            results,
            pass: results.every((r) => r.ok || r.step.includes("home page")),
        };
        await writeFile(join(OUT_DIR, `report-${STAMP}.json`), JSON.stringify(summary, null, 2));
        console.log("\n--- Summary ---");
        console.log(JSON.stringify(summary, null, 2));

        if (!results.filter((r) => !r.step.includes("home page")).every((r) => r.ok)) {
            process.exitCode = 1;
        }
    } catch (err) {
        log("FATAL", false, err.message);
        await page.screenshot({ path: join(OUT_DIR, `error-${STAMP}.png`), fullPage: true }).catch(() => {});
        console.error(err);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

main();
