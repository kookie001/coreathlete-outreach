# ⚡ COREATHLETE — Founder Outreach CRM & Lead Research OS

Private, production-grade Founder Sales Outreach CRM and Coach Research OS for **COREATHLETE**.

Designed specifically for founder-led sales outreach to high-performance Strength & Conditioning coaches, sports performance trainers, combat sports coaches, sports dietitians, and fitness practitioners across India.

---

## 🔒 Security Architecture & Privacy Safeguards

1. **Fail-Closed Founder Authentication**:
   - Access to the CRM is locked behind a secure session system using cryptographic HMAC-SHA256 tokens and constant-time password comparison (`crypto.timingSafeEqual`).
   - Requires `FOUNDER_PASSWORD` in Vercel environment variables. **No hardcoded fallback password exists.**
   - If `FOUNDER_PASSWORD` is absent on the server, the application strictly **fails closed** (HTTP 500) and completely blocks dashboard access.
2. **Zero Client Data Leakage**:
   - `index.html` and `app.js` contain **zero** hardcoded phone numbers, names, or lead data.
   - All lead records are dynamically requested from protected API routes (`/api/leads`) only after successful authentication.
3. **No Leads in Git History**:
   - Persistent lead records, database dumps, CSVs, and `.env` files are strictly `.gitignore`d.
   - GitHub serves purely as the application source code repository — never as a public or plaintext lead database.
4. **End-to-End API Route Protection**:
   - Every single API route (`/api/leads`, `/api/stats`, `/api/settings`, `/api/export`, `/api/import`) mandates valid authentication and returns HTTP 401 otherwise.

---

## 🚀 Core Features

- **⚡ Today's Work Strip**: Instant count and 1-click filters for Follow-ups Due Today, Overdue, Hot Leads, New to Contact, and Replied leads.
- **📊 Real-Time Pipeline Funnel**: Live conversion stages (`Total Leads → Contacted → Replied → Interested → Demo Sent → Trial → Paid / Won`) with conversion rates at each transition.
- **🖥️ 17-Column Desktop Outreach Table**: Sortable, searchable table with inline quick actions (WhatsApp, Call, Instagram, View), Lead Scores (0-5 stars), status dropdown, priority badges, and follow-up alerts.
- **📱 Mobile Touch Cards (<840px)**: Compact mobile cards with 1-tap `[ 📞 CALL ]`, `[ 💬 WA ]`, `[ 📷 IG ]`, and `[ 👁️ VIEW ]` actions.
- **📋 Lead Detail Drawer**: Multi-tab slideout panel:
  - Identity & Contact Info
  - Online Presence (Instagram, Website, Google Maps)
  - Coaching Profile & Athletes Managed
  - Current System (WhatsApp, Google Sheets, Trainerize, TrueCoach, Everfit)
  - Qualification & 0-5 Lead Scoring Breakdown
  - Outreach Stage, Next Follow-Up Date Picker & Call Notes
  - Full Chronological Activity Timeline
- **⚡ Google Maps Quick Add with Duplicate Detection**: Rapid data entry for research with real-time duplicate warning as phone or Instagram handle is typed.
- **💬 Smart Role-Based Pitch Generator**: 1-click personalized pitch templates (S&C Coach, Online Coach, Strength Coach, Combat Sports, Running/Endurance, Sports Dietitian) with auto variable replacement and direct WhatsApp Web/Mobile launcher.
- **📥 CSV Batch Import & Duplicate Checker**: Previews duplicates prior to committing.
- **📤 Filtered CSV Export**: Download all leads, hot leads, or current filtered view.

---

## ⚙️ Environment Variables (Vercel)

| Variable | Description | Required |
|---|---|---|
| `FOUNDER_PASSWORD` | Secure password to access the private CRM dashboard | **Yes (Fails closed if missing)** |
| `DATABASE_URL` | PostgreSQL / Supabase connection string | Recommended for persistent cloud database |
| `SESSION_SECRET` | HMAC signing secret for session tokens | Optional (auto-derived from password if unset) |

---

## 🧪 Automated Security & API Verification

Run the full automated test suite locally:
```bash
node test/security_and_api_test.js
```
Runs 24 automated tests covering:
- Fail-closed auth when `FOUNDER_PASSWORD` is absent
- Password verification & token issuance
- 401 unauthorized lockdown across all endpoints
- Real-time duplicate detection
- Lead scoring (0-5) calculation
- Lead lifecycle (Create, Patch, Status update, Timeline logging, Delete)
- Cookie invalidation on logout
- Zero client-side data leakage audit in HTML/JS source
