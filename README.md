# CEVA tools

Operational tools for CEVA sites, served with GitHub Pages.

| Tool | Path | What it does |
|---|---|---|
| Receiving dock board | [`dock-board/`](dock-board/) | Floor TV display of trailers in the drop and today's appointments, with priority, door, pathway owner and status. Supervisors update it from a phone. |
| Cycle count requests | [`cycle-counts/`](cycle-counts/) | A portal for a 3PL customer on SAP EWM: they request cycle counts by product, storage bin and batch; CEVA counts and posts book qty, counted qty and difference; the customer approves the difference (or asks for a recount) before it's posted in EWM; both sides see accuracy on a dashboard. |

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

## Cycle count requests

**Live page:** `https://bigmuffuletta.github.io/ceva-tools/cycle-counts/`

Open it and tap **Preview with example counts** to click through the whole thing (as a customer or as the CEVA team) before any setup. Nothing in the preview is saved.

Words follow SAP EWM: product, storage bin, batch, UoM, book qty, counted, difference, and the EWM physical inventory (PI) document.

### How it works

1. **Customer requests a count.** Reason, priority, optional results-needed-by date, and the lines to count: product, storage bin, batch, UoM and the book qty EWM shows today (bin, batch and qty are optional; a blank bin means every bin the product is in). **Paste from EWM or Excel** takes rows copied from an EWM stock overview export or any spreadsheet; with a header row (Product, Storage Bin, Batch, Quantity, BUn) columns are matched by name. Up to 200 lines per request. The customer can name an EWM PI document if they already created one. Each request gets a number: `CC-1001`, `CC-1002`, …
2. **CEVA schedules it.** Set the count date, the counter and the EWM PI document. The customer sees all three.
3. **CEVA enters results.** For each line: book qty, counted qty, a recounted tick and a note. The difference is worked out as you type. Add rows when a product turns up in another bin. **Save counts so far** keeps a draft the customer doesn't see; **Post results** publishes them.
4. **Customer approves or asks for a recount.** If any line is off, the count waits on the customer: **Approve difference** (two taps), or **Ask for a recount** with a reason, which sends it back to Counting. A count with no difference completes on its own.
5. **CEVA posts the difference in EWM and completes the count** with a note (prefilled, e.g. "Difference of net −4 EA posted in EWM, PI document 2000001234").

Statuses: Requested → Scheduled → Counting → Awaiting approval → Approved → Completed. Replies and internal CEVA-only notes sit on each count.

**Dashboard** (customers see only their own account): open counts, counts completed, lines counted, **line accuracy** (lines where counted matched book), **unit accuracy** (1 − units off ÷ book units), results on time, median time to results, requested-vs-completed and line-accuracy trends, open counts by status and age, largest differences by product, counts by reason, and a per-account table for CEVA. **Print or save PDF** gives a clean copy for a business review.

**Download results (CSV)** on the Counts tab gives one row per line (count, account, product, storage bin, batch, UoM, customer book qty, book qty, counted, difference, recounted, note, PI document, approval, completion) for Excel, Power BI, or checking against EWM.

Results are due 24 h (Urgent), 48 h (High) or 72 h (Standard) after the request; "on time" means results were posted by then. An admin can change the targets, hide targets from customers, and turn off customer approval (then a difference completes the count straight away).

The portal doesn't connect to EWM directly; people enter and paste the numbers. Data lives in a Firebase project (Firestore + Authentication). Use a **separate Firebase project from the dock board**, since outside customers sign in here.

### One-time Firebase setup

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it (e.g. `ceva-cycle-counts`) → Google Analytics off → **Create**.
2. **Build → Authentication → Get started → Email/Password → Enable → Save.**
3. **Authentication → Settings → Authorized domains → Add domain:** `bigmuffuletta.github.io`.
4. **Authentication → Templates → Password reset:** set the sender name (e.g. `CEVA Cycle Counts`) so reset emails are recognisable.
5. **Build → Firestore Database → Create database →** pick a US location → **Start in production mode**.
6. **Firestore → Rules:** replace everything with the contents of [`cycle-counts/firestore.rules`](cycle-counts/firestore.rules) → **Publish**.
7. **Project settings (gear) → General → Your apps → Web (`</>`)** → nickname `cycle-counts` → **Register app** (skip Hosting). Copy the `firebaseConfig` values into [`cycle-counts/firebase-config.js`](cycle-counts/firebase-config.js) and commit.
8. Open the live page → **New here? Create an account** with your own email. You'll land on "Almost there". Under **Details for your CEVA admin**, copy your **User ID**.
9. Firebase console → **Firestore → Data → Start collection** `roles` → Document ID = your User ID → fields: `role` (string) = `admin`, `name` (string) = your name → **Save**. The page opens by itself.
10. In the portal: **Settings → Portal** to set the portal name, count reasons, targets and the approval setting.

### Adding customers and CEVA staff

1. Send customers the live page link. They tap **New here? Create an account** (name, company, work email, password).
2. They appear under **Settings → People → Waiting for access**. Check the customer account name (it's prefilled from the company they typed; keep it spelled the same for everyone at that company) and tap **Approve as customer**, or **CEVA team** for your own staff.
3. Their page opens on its own once approved. Forgotten passwords: **Forgot password?** on the sign-in page.

| Role | Use for | Can do |
|---|---|---|
| Customer | People at the customer | Request counts, see results, approve differences or ask for recounts, reply; their own account only. Never sees other accounts or internal notes. |
| CEVA team | Your team | See every account, schedule, enter and post results, complete, reply, log counts from calls or emails |
| Admin | You | Everything, plus people and portal settings |

To stop strangers making accounts, turn off **Authentication → Settings → User actions → Enable create (sign-up)** and add people yourself under **Authentication → Users → Add user**, then **Settings → People → Add or change someone by user ID**.

### Security

[`cycle-counts/firestore.rules`](cycle-counts/firestore.rules) does the enforcing, not the page: a customer account can only read and write its own account's counts; can't write results, edit lines, or change status, counter or priority; can approve or ask for a recount only while results are waiting for approval; and can't see internal notes. The update history can't be edited or deleted. [`cycle-counts/tests/`](cycle-counts/tests/) checks all of this against the Firestore emulator:

```bash
cd cycle-counts/tests && npm install && npm test
```

(Needs Node 18+ and Java 11+.)

### Limits

The free Spark plan allows 50,000 reads and 20,000 writes per day. The CEVA list loads everything open plus the last 400 days; a customer loads their own account's history. At a few hundred counts a month that is well inside the free tier. If the portal ever shows "hit its daily free limit", switch the project to the pay-as-you-go Blaze plan (reads cost about $0.06 per 100,000).

### Not built yet

- **A live link to EWM.** Book quantities and results are typed or pasted. S/4HANA EWM has OData APIs for warehouse physical inventory that could create PI documents and pull counts automatically, but that needs the customer's SAP team and a small server; it can't run from this page.
- **Email alerts.** Today the CEVA page pops up new requests while it's open (and can send desktop notifications from **Settings**). For email on new requests, posted results and approvals, add the Firebase **Trigger Email** extension (needs the Blaze plan and an SMTP account), or a Power Automate flow.
- **Stock type and owner** (e.g. F2 unrestricted vs B6 blocked) as separate fields; put them in the line note for now.
- **Attachments** (photos of damaged stock, count sheets). Needs Firebase Storage.

### Network

Browsers need to reach `gstatic.com`, `googleapis.com` and `firebaseapp.com`, plus `fonts.googleapis.com` for the typeface. Customer networks almost always allow these.
