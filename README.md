# CEVA tools

Operational tools for CEVA sites, served with GitHub Pages.

| Tool | Path | What it does |
|---|---|---|
| Receiving dock board | [`dock-board/`](dock-board/) | Floor TV display of trailers in the drop and today's appointments, with priority, door, pathway owner and status. Supervisors update it from a phone. |
| Customer request tracker | [`requests/`](requests/) | A portal for a 3PL customer: they submit requests (expedites, inventory checks, claims, reports…), CEVA works each one to closed with a written resolution, and both sides see the same tracker and dashboard. |

Shared files live in [`assets/`](assets/): `ceva-logo-white.svg` is the logo used on the navy headers; `ceva-logo.svg` (navy and red) is only the browser-tab icon.

---

## Receiving dock board

**Live page:** `https://bigmuffuletta.github.io/ceva-tools/dock-board/`

- **TV:** open the page, sign in once with the TV's account, tap **Full screen**. It stays signed in, keeps the screen awake where the browser allows, and pages through long lists every 12 seconds.
- **Supervisors:** open the same page on a phone. It opens on the update screen: add trucks, move them along (Arrived → At door → Unloading → Received), set priority and pathway owner, post a notice.
- **No connection:** the TV keeps showing the last saved board and marks itself Offline. Supervisor changes save on the phone and sync when the network is back.

Data lives in a Firebase project (Firestore + Authentication). The page only talks to Firebase; GitHub just serves the files.

### One-time Firebase setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it (e.g. `ceva-dock-board`) → Google Analytics off → **Create**.
2. **Build → Authentication → Get started → Email/Password → Enable → Save.**
3. **Authentication → Settings → Authorized domains → Add domain:** `bigmuffuletta.github.io`.
4. **Build → Firestore Database → Create database →** pick a US location → **Start in production mode**.
5. **Firestore → Rules:** replace everything with the contents of [`dock-board/firestore.rules`](dock-board/firestore.rules) → **Publish**.
6. **Project settings (gear) → General → Your apps → Web (`</>`)** → nickname `dock-board` → **Register app** (skip Hosting). Copy the `firebaseConfig` values into [`dock-board/firebase-config.js`](dock-board/firebase-config.js) and commit.
7. **Authentication → Users → Add user:** your email and a password. Copy your **User UID** from the list.
8. **Firestore → Data → Start collection** `roles` → Document ID = your User UID → fields: `role` (string) = `admin`, `name` (string) = your name → **Save**.
9. Open the live page, sign in, go to **Update board → Settings → People**.

### Adding people and TVs

1. Firebase console → **Authentication → Users → Add user** (email + password). Copy the new **User UID**.
2. On the board: **Settings → People** → paste the UID, add a name, pick a role → **Add or update person**.

| Role | Use for | Can do |
|---|---|---|
| Viewer | TV screens | See the board |
| Supervisor | Floor leads | Add and update trucks, notice, owner names, clock format |
| Admin | You | Everything, plus site name, TV colors and people |

Anyone who signs in without a role sees only their User UID and a request to send it to the admin.

### Changing the logo

Replace [`assets/ceva-logo-white.svg`](assets/ceva-logo-white.svg) with the same file name. It sits directly on the navy header, so use the white (reversed) version of the logo.

### Limits

Firebase's free Spark plan allows 50,000 reads and 20,000 writes per day. A board with a few screens and a few hundred truck updates a day uses a small fraction of that. Clear received trucks weekly from **Settings → Received trucks**.

### Network

The TV and phones need to reach `gstatic.com`, `googleapis.com` and `firebaseapp.com`, plus `fonts.googleapis.com` for the typeface. If the floor network blocks any of these, ask IT to allow them.

---

## Customer request tracker

**Live page:** `https://bigmuffuletta.github.io/ceva-tools/requests/`

Open it and tap **Preview with example requests** to click through the whole thing (as a customer or as the CEVA team) before any setup. Nothing in the preview is saved.

### How it works

- **Customer** signs in and taps **New request**: request type, priority, subject, details, order/PO/SKU numbers, optional needed-by date. They get a number (`#1001`, `#1002`, …) straight away.
- **CEVA team** sees every customer account in one list, sorted overdue first. Open a request to set status (New → In progress → Waiting on customer → Closed), assign an owner, reply to the customer, or add an internal note the customer never sees. Closing needs a written resolution.
- **Customer** sees each update and the resolution on the request, and replies there. A reply on a "Waiting on you" request moves it back to In progress. Closed requests offer **Start a follow-up** instead of reopening, so close-time numbers stay honest.
- **Dashboard** (both sides, customers see only their own account): open now, submitted and closed for the period, on-time close rate, median time to close, median first response, a submitted-vs-closed trend, open by status and age, requests by type, and a per-account table for CEVA. **Print or save PDF** gives a clean copy for a business review.
- **Download CSV** on the Requests tab exports whatever the list is showing, for Excel or Power BI.

Targets: Urgent 24 h, High 72 h, Standard 120 h from submit (an admin can change these). A needed-by date replaces the target. Admins can hide targets, overdue counts and on-time rate from customers.

Data lives in a Firebase project (Firestore + Authentication). Use a **separate Firebase project from the dock board**, since outside customers sign in here.

### One-time Firebase setup

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it (e.g. `ceva-customer-requests`) → Google Analytics off → **Create**.
2. **Build → Authentication → Get started → Email/Password → Enable → Save.**
3. **Authentication → Settings → Authorized domains → Add domain:** `bigmuffuletta.github.io`.
4. **Authentication → Templates → Password reset:** set the sender name (e.g. `CEVA Customer Requests`) so reset emails are recognisable.
5. **Build → Firestore Database → Create database →** pick a US location → **Start in production mode**.
6. **Firestore → Rules:** replace everything with the contents of [`requests/firestore.rules`](requests/firestore.rules) → **Publish**.
7. **Project settings (gear) → General → Your apps → Web (`</>`)** → nickname `requests` → **Register app** (skip Hosting). Copy the `firebaseConfig` values into [`requests/firebase-config.js`](requests/firebase-config.js) and commit.
8. Open the live page → **New here? Create an account** with your own email. You'll land on "Almost there". Under **Details for your CEVA admin**, copy your **User ID**.
9. Firebase console → **Firestore → Data → Start collection** `roles` → Document ID = your User ID → fields: `role` (string) = `admin`, `name` (string) = your name → **Save**. The page opens by itself.
10. In the portal: **Settings → Portal** to set the portal name, request types and targets.

### Adding customers and CEVA staff

1. Send customers the live page link. They tap **New here? Create an account** (name, company, work email, password).
2. They appear under **Settings → People → Waiting for access**. Check the customer account name (it's prefilled from the company they typed; keep it spelled the same for everyone at that company) and tap **Approve as customer**, or **CEVA team** for your own staff.
3. Their page opens on its own once approved. Forgotten passwords: **Forgot password?** on the sign-in page.

| Role | Use for | Can do |
|---|---|---|
| Customer | People at the customer | Submit requests, reply, see their own account's requests and dashboard. Never sees other accounts or internal notes. |
| CEVA team | Your team | See every account, reply, set status, owner and priority, close with a resolution, log requests from calls or emails |
| Admin | You | Everything, plus people and portal settings |

To stop strangers making accounts, turn off **Authentication → Settings → User actions → Enable create (sign-up)** and add people yourself under **Authentication → Users → Add user**, then **Settings → People → Add or change someone by user ID**.

### Security

[`requests/firestore.rules`](requests/firestore.rules) does the enforcing, not the page: a customer account can only read and write its own account's requests, can't see internal notes, can't change status, owner or priority, and can't reply to closed requests; the update history can't be edited or deleted. [`requests/tests/`](requests/tests/) checks all of this against the Firestore emulator:

```bash
cd requests/tests && npm install && npm test
```

(Needs Node 18+ and Java 11+.)

### Limits

The free Spark plan allows 50,000 reads and 20,000 writes per day. The CEVA list loads everything open plus the last 400 days; a customer loads their own account's history. At a few hundred requests a month that is well inside the free tier. If the portal ever shows "hit its daily free limit", switch the project to the pay-as-you-go Blaze plan (reads cost about $0.06 per 100,000).

### Not built yet

- **Email alerts.** Today the CEVA page pops up new requests while it's open (and can send desktop notifications from **Settings**). For email on new requests and replies, add the Firebase **Trigger Email** extension (needs the Blaze plan and an SMTP account), or a Power Automate flow if your Microsoft 365 tenant allows it.
- **Attachments** (photos of damage, packing lists). Needs Firebase Storage; until then customers paste links or email files.
- **Pausing the clock** while a request waits on the customer. Targets run in calendar hours from submit.

### Network

Browsers need to reach `gstatic.com`, `googleapis.com` and `firebaseapp.com`, plus `fonts.googleapis.com` for the typeface. Customer networks almost always allow these.
