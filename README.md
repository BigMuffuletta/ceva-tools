# CEVA tools

Operational tools for CEVA sites, served with GitHub Pages.

| Tool | Path | What it does |
|---|---|---|
| Receiving dock board | [`dock-board/`](dock-board/) | Floor TV display of trailers in the drop and today's appointments, with priority, door, pathway owner and status. Supervisors update it from a phone. |

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
