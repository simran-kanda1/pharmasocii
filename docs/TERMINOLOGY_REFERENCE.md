# System Terminology Reference Guide

This document preserves the official definitions and rules for listing, plan, and payment statuses across PharmaSocii.

---

## 1. Status Definitions

### **Cancelled by the Partner**
* **Definition**: The partner explicitly turned off or cancelled renewal for their listing or feature, but it remains active through the end of the already-paid billing period.
* **Lifecycle**: `Active` $\rightarrow$ Partner cancels $\rightarrow$ `Cancelled` (paid period running) $\rightarrow$ Paid period ends $\rightarrow$ `Expired`.
* **Technical Behavior**:
  * Stripe subscription set to `cancel_at_period_end: true`.
  * Date check: `now <= billingPeriodEnd` (or `cancelAt`).
  * Badge: **Cancelled** (`bg-rose-50 text-rose-700 border-rose-200`).

---

### **Expired**
* **Definition**: The paid window is completely over and Stripe is no longer billing (happens after the cancelled plan paid period ends, or an unrenewed listing passes its expiration date).
* **Lifecycle**: Occurs strictly after the paid coverage window ends (`now > billingPeriodEnd`).
* **Technical Behavior**:
  * Date check: `expiryDate <= now`.
  * Stripe subscription is canceled/ended and not billing.
  * Badge: **Expired** (`bg-orange-50 text-orange-700 border-orange-200`).

---

### **Incomplete Payment / Failed Payment**
* **Definition**: A charge or renewal did not go through, including an expired card, insufficient funds, card decline, or authentication error from Stripe.
* **Lifecycle**: Triggered on failed invoice payment, subscription `past_due`, or declined transaction.
* **Technical Behavior**:
  * Stripe status: `past_due`, `unpaid`, `incomplete_expired`, or webhook event `invoice.payment_failed` / `charge.failed`.
  * Badge: **Failed Payment** / **Incomplete Payment** (`bg-red-50 text-red-700 border-red-200`).
  * Overview Card: **Failed Payments** (*Charges or renewals where payment did not go through*).

---

### **Pending Payment**
* **Definition**: Checkout was started and never finished (abandoned checkout session), or temporarily pending while in a server/Stripe communication queue without a failed payment response.
* **Lifecycle**: Checkout session created $\rightarrow$ customer hasn't completed Stripe payment form or webhook is processing.
* **Technical Behavior**:
  * Listing created with `status: "pending_payment"`, no successful Stripe charge received, and not in payment-failure status.
  * Badge: **Pending Payment** (`bg-amber-50 text-amber-700 border-amber-200`).
  * Overview Card: **Pending Payments** (*Checkouts started that have not been completed*).

---

### **Disabled**
* **Definition**: An administrative or manual inactive flag applied by an admin or system control (not caused by billing cycle).
* **Lifecycle**: Admin toggles listing/partner status to disabled/inactive.
* **Technical Behavior**:
  * `status: "disabled"` or `active: false`.
  * Badge: **Disabled** (`bg-slate-100 text-slate-700 border-slate-300`).

---

## 2. Plan and Feature Upgrades Rule

> **Important**:
> * **A plan upgrade keeps the same plan record.**
> * **A feature upgrade keeps the same feature record.**
> * **Neither one creates a second plan or a second feature.**

### Technical Implementation:
* When a customer upgrades from *Basic* to *Standard* or *Standard* to *Premium Plus*:
  * Stripe subscription item is updated in place via Stripe API with proration.
  * The existing document in `partnersCollection/{partnerId}/planCollection/{planDocId}` is updated in place (`planId: newPlanId`, `planName: newPlanName`, `billingPeriodEnd`, `upgradedAt`).
  * No duplicate plan document is created in Firestore.
* When a customer upgrades a spotlight/featured placement:
  * The existing spotlight record (`featureSpotlightId` or `featureDocId`) is updated in place with new placement tier and dates.
  * No duplicate feature document is created.
