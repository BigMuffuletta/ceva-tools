// Security rules tests for cycle count requests.
// Run from this folder:  npm install  &&  npm test
// (Starts the Firestore emulator, so it needs Java 11+.)
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch, runTransaction
} from 'firebase/firestore';

let env;
const NOW = 1_762_300_000_000;

const ROLES = {
  admin:  { role: 'admin', name: 'Pat Admin' },
  agent:  { role: 'agent', name: 'K. Bell' },
  custA:  { role: 'customer', name: 'Dana Lee', account: 'Northwind Apparel' },
  custA2: { role: 'customer', name: 'Sam Ortiz', account: 'Northwind Apparel' },
  custB:  { role: 'customer', name: 'Priya Shah', account: 'Contoso Medical' },
  broken: { role: 'customer', name: 'No account' }
};

const LINES = [{ product: 'NW104233', bin: 'A-12-03', batch: '', uom: 'EA', book: 120 }, { product: 'NW104240', bin: '', batch: '', uom: 'EA', book: null }];
const RESULTS = [{ product: 'NW104233', bin: 'A-12-03', batch: '', uom: 'EA', book: 120, counted: 116, recount: true, note: '' }];
function req(over = {}) {
  return Object.assign({
    account: 'Northwind Apparel', reason: 'Our system doesn’t match your inventory report', priority: 'high',
    subject: 'Count NW104233 before promo', details: 'EWM shows 120, store says less.', refs: '', neededBy: '',
    status: 'new', owner: '', resolution: '', source: 'portal',
    createdAt: NOW, createdBy: 'custA', createdByName: 'Dana Lee', createdByEmail: 'dana@northwind.example', updatedAt: NOW,
    closedAt: null, firstResponseAt: null, lastReplyAt: null, lastReplyBy: '',
    lines: LINES, results: [], piDoc: '', scheduledFor: '', countedAt: null,
    approval: '', approvalBy: '', approvalAt: null
  }, over);
}
const posted = { status: 'review', results: RESULTS, countedAt: NOW + 100, owner: 'K. Bell' };
const note = (by, over = {}) => Object.assign({ text: 'Hello', at: NOW, by, byName: 'Someone', side: 'customer', kind: 'msg' }, over);

const db = uid => env.authenticatedContext(uid, { email: uid + '@example.com' }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

// Submit the way the app does: bump the counter and create the request in one transaction.
async function submit(fs, data) {
  return runTransaction(fs, async tx => {
    const c = await tx.get(doc(fs, 'counters/requests'));
    const n = c.exists() ? c.data().n + 1 : 1001;
    if (c.exists()) tx.update(doc(fs, 'counters/requests'), { n }); else tx.set(doc(fs, 'counters/requests'), { n });
    tx.set(doc(fs, 'requests', String(n)), data);
    return String(n);
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ceva-cycle-counts',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const fs = ctx.firestore();
    for (const [uid, r] of Object.entries(ROLES)) await setDoc(doc(fs, 'roles', uid), r);
    await setDoc(doc(fs, 'counters/requests'), { n: 1002 });
    await setDoc(doc(fs, 'requests/1001'), req());
    await setDoc(doc(fs, 'requests/1002'), req({ account: 'Contoso Medical', createdBy: 'custB', createdByName: 'Priya Shah' }));
    await setDoc(doc(fs, 'requests/1001/thread/n1'), note('agent', { side: 'ceva', text: 'On it' }));
    await setDoc(doc(fs, 'requests/1001/internal/i1'), note('agent', { side: 'ceva', text: 'Carrier is late again' }));
  });
});

const setReq = async (id, over) => env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'requests', id), over));

/* ---------- reading ---------- */
test('signed-out visitors and people without a role see nothing', async () => {
  await assertFails(getDoc(doc(anon(), 'requests/1001')));
  await assertFails(getDoc(doc(db('stranger'), 'requests/1001')));
  await assertFails(getDocs(query(collection(db('stranger'), 'requests'), where('account', '==', 'Northwind Apparel'))));
  await assertFails(getDoc(doc(db('stranger'), 'config/portal')));
});

test('a customer reads only its own account', async () => {
  const fs = db('custA');
  await assertSucceeds(getDoc(doc(fs, 'requests/1001')));
  await assertSucceeds(getDocs(query(collection(fs, 'requests'), where('account', '==', 'Northwind Apparel'))));
  await assertFails(getDoc(doc(fs, 'requests/1002')));
  await assertFails(getDocs(query(collection(fs, 'requests'), where('account', '==', 'Contoso Medical'))));
  await assertFails(getDocs(collection(fs, 'requests')));
  await assertSucceeds(getDocs(query(collection(db('custA2'), 'requests'), where('account', '==', 'Northwind Apparel'))));
});

test('a customer role without an account sees nothing', async () => {
  await assertFails(getDoc(doc(db('broken'), 'requests/1001')));
});

test('customers see replies but never internal notes', async () => {
  await assertSucceeds(getDocs(collection(db('custA'), 'requests/1001/thread')));
  await assertFails(getDocs(collection(db('custA'), 'requests/1001/internal')));
  await assertFails(getDocs(collection(db('custB'), 'requests/1001/thread')));
  await assertSucceeds(getDocs(collection(db('agent'), 'requests/1001/internal')));
});

test('CEVA team reads every account', async () => {
  const fs = db('agent');
  await assertSucceeds(getDocs(collection(fs, 'requests')));
  await assertSucceeds(getDocs(query(collection(fs, 'requests'), where('status', 'in', ['new', 'scheduled', 'counting', 'review', 'approved']))));
  await assertSucceeds(getDoc(doc(fs, 'requests/1002')));
});

/* ---------- submitting ---------- */
test('a customer submits a numbered request for its own account', async () => {
  const id = await assertSucceeds(submit(db('custA'), req({ createdAt: NOW + 1 })));
  assert(id === '1003', 'expected #1003, got ' + id);
});

test('the very first request starts the counter at 1001', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const fs = ctx.firestore();
    await deleteDoc(doc(fs, 'counters/requests'));
    await deleteDoc(doc(fs, 'requests/1001'));
    await deleteDoc(doc(fs, 'requests/1002'));
  });
  const id = await assertSucceeds(submit(db('custA'), req()));
  assert(id === '1001', 'expected #1001, got ' + id);
});

test('a customer cannot submit for another account or pre-fill CEVA fields', async () => {
  const fs = db('custA');
  await assertFails(submit(fs, req({ account: 'Contoso Medical' })));
  await assertFails(submit(fs, req({ status: 'closed' })));
  await assertFails(submit(fs, req({ owner: 'K. Bell' })));
  await assertFails(submit(fs, req({ source: 'ceva' })));
  await assertFails(submit(fs, req({ createdBy: 'custA2' })));
  await assertFails(submit(fs, req({ extra: 'field' })));
  await assertFails(submit(fs, req({ subject: '' })));
  await assertFails(submit(fs, req({ priority: 'asap' })));
  await assertFails(submit(fs, req({ results: RESULTS })));
  await assertFails(submit(fs, req({ countedAt: NOW })));
  await assertFails(submit(fs, req({ approval: 'approved', approvalBy: 'Dana Lee', approvalAt: NOW })));
  await assertFails(submit(fs, req({ scheduledFor: '2026-11-07' })));
  await assertFails(submit(fs, req({ lines: [] })));
  await assertFails(submit(fs, req({ lines: 'NW104233' })));
});

test('a customer can name an EWM PI document when requesting', async () => {
  await assertSucceeds(submit(db('custA'), req({ piDoc: '2000001234' })));
});

test('request numbers cannot be skipped or reused', async () => {
  const fs = db('custA');
  await assertFails(setDoc(doc(fs, 'requests/5000'), req()));
  await assertFails(runTransaction(fs, async tx => {
    tx.update(doc(fs, 'counters/requests'), { n: 5000 });
    tx.set(doc(fs, 'requests/5000'), req());
  }));
  // Writing over an existing number is an update, and its creation time cannot change.
  await assertFails(setDoc(doc(fs, 'requests/1001'), req({ createdAt: NOW + 5 })));
});

/* ---------- customer replies ---------- */
test('a customer replies on its own open request', async () => {
  const fs = db('custA');
  const b = writeBatch(fs);
  b.set(doc(fs, 'requests/1001/thread/c1'), note('custA'));
  b.update(doc(fs, 'requests/1001'), { lastReplyAt: NOW + 10, lastReplyBy: 'customer', updatedAt: NOW + 10 });
  await assertSucceeds(b.commit());
});

test('a customer approves the difference once results are posted', async () => {
  await setReq('1001', posted);
  await assertSucceeds(updateDoc(doc(db('custA2'), 'requests/1001'), { status: 'approved', approval: 'approved', approvalBy: 'Sam Ortiz', approvalAt: NOW + 200, updatedAt: NOW + 200 }));
});

test('a customer sends results back for a recount, with a reply', async () => {
  await setReq('1001', posted);
  const fs = db('custA');
  const b = writeBatch(fs);
  b.set(doc(fs, 'requests/1001/thread/r1'), note('custA', { text: 'EWM shows 120 in that bin, please recount.' }));
  b.update(doc(fs, 'requests/1001'), { status: 'counting', approval: 'recount', approvalBy: 'Dana Lee', approvalAt: NOW + 200, updatedAt: NOW + 200, lastReplyAt: NOW + 200, lastReplyBy: 'customer' });
  await assertSucceeds(b.commit());
});

test('approving only works on posted results, for your own account, the right way', async () => {
  const ok = { status: 'approved', approval: 'approved', approvalBy: 'Dana Lee', approvalAt: NOW, updatedAt: NOW };
  await assertFails(updateDoc(doc(db('custA'), 'requests/1001'), ok));            // nothing posted yet
  await setReq('1001', posted);
  await assertFails(updateDoc(doc(db('custB'), 'requests/1001'), ok));            // other account
  await assertFails(updateDoc(doc(db('custA'), 'requests/1001'), Object.assign({}, ok, { status: 'closed' })));
  await assertFails(updateDoc(doc(db('custA'), 'requests/1001'), Object.assign({}, ok, { status: 'counting' })));
  await assertFails(updateDoc(doc(db('custA'), 'requests/1001'), Object.assign({}, ok, { approvalBy: '' })));
  await assertFails(updateDoc(doc(db('custA'), 'requests/1001'), Object.assign({}, ok, { results: [] })));
  await assertFails(updateDoc(doc(db('custA'), 'requests/1001'), Object.assign({}, ok, { lastReplyBy: 'ceva' })));
});

test('a customer cannot write results, edit lines, or change status, owner, priority or account', async () => {
  const fs = db('custA');
  const base = { lastReplyAt: NOW, lastReplyBy: 'customer', updatedAt: NOW };
  await assertFails(updateDoc(doc(fs, 'requests/1001'), Object.assign({ results: RESULTS, countedAt: NOW }, base)));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), Object.assign({ lines: [LINES[0]] }, base)));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), Object.assign({ piDoc: '2000009999' }, base)));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), Object.assign({ status: 'closed' }, base)));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), Object.assign({ owner: 'Me' }, base)));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), Object.assign({ priority: 'urgent' }, base)));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), Object.assign({ account: 'Contoso Medical' }, base)));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), { lastReplyAt: NOW, lastReplyBy: 'ceva', updatedAt: NOW }));
});

test('a customer cannot reply on another account, as CEVA, or on a closed request', async () => {
  await assertFails(setDoc(doc(db('custB'), 'requests/1001/thread/x'), note('custB')));
  await assertFails(setDoc(doc(db('custA'), 'requests/1001/thread/x'), note('custA', { side: 'ceva' })));
  await assertFails(setDoc(doc(db('custA'), 'requests/1001/thread/x'), note('custA', { kind: 'status' })));
  await assertFails(setDoc(doc(db('custA'), 'requests/1001/thread/x'), note('custB')));
  await assertFails(setDoc(doc(db('custA'), 'requests/1001/internal/x'), note('custA')));
  await setReq('1001', { status: 'closed', closedAt: NOW, resolution: 'Done' });
  await assertFails(setDoc(doc(db('custA'), 'requests/1001/thread/x'), note('custA')));
  await assertFails(updateDoc(doc(db('custA'), 'requests/1001'), { lastReplyAt: NOW, lastReplyBy: 'customer', updatedAt: NOW }));
});

test('nobody edits or deletes the history', async () => {
  await assertFails(updateDoc(doc(db('custA'), 'requests/1001/thread/n1'), { text: 'changed' }));
  await assertFails(deleteDoc(doc(db('agent'), 'requests/1001/thread/n1')));
  await assertFails(updateDoc(doc(db('admin'), 'requests/1001/internal/i1'), { text: 'changed' }));
});

/* ---------- CEVA team ---------- */
test('CEVA team schedules, posts results and completes', async () => {
  const fs = db('agent');
  await assertSucceeds(updateDoc(doc(fs, 'requests/1001'), { status: 'scheduled', scheduledFor: '2026-11-07', piDoc: '2000001234', owner: 'K. Bell', firstResponseAt: NOW + 5, updatedAt: NOW + 5 }));
  await assertSucceeds(updateDoc(doc(fs, 'requests/1001'), { status: 'review', results: RESULTS, countedAt: NOW + 50, updatedAt: NOW + 50 }));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), { results: 'counted' }));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), { scheduledFor: 'tomorrow' }));
  const b = writeBatch(fs);
  b.update(doc(fs, 'requests/1001'), { status: 'closed', resolution: 'Difference posted in EWM', closedAt: NOW + 90, updatedAt: NOW + 90 });
  b.set(doc(fs, 'requests/1001/thread/s1'), note('agent', { side: 'ceva', kind: 'status', text: 'Completed: Difference posted in EWM' }));
  await assertSucceeds(b.commit());
  await assertSucceeds(setDoc(doc(fs, 'requests/1002/internal/i9'), note('agent', { side: 'ceva' })));
  await assertFails(setDoc(doc(fs, 'requests/1002/thread/t9'), note('agent', { side: 'customer' })));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), { createdAt: 1 }));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), { status: 'done' }));
  await assertFails(updateDoc(doc(fs, 'requests/1001'), { lines: [] }));
});

test('CEVA team logs a request on behalf of any account', async () => {
  await assertSucceeds(submit(db('agent'), req({ account: 'Fabrikam Foods', source: 'ceva', createdBy: 'agent', status: 'scheduled', scheduledFor: '2026-11-07', owner: 'K. Bell' })));
});

test('only admins delete requests', async () => {
  await assertFails(deleteDoc(doc(db('agent'), 'requests/1002')));
  await assertFails(deleteDoc(doc(db('custB'), 'requests/1002')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'requests/1002')));
});

/* ---------- settings, people, access ---------- */
test('only admins change portal settings; everyone with a role reads them', async () => {
  await assertSucceeds(getDoc(doc(db('custA'), 'config/portal')));
  await assertFails(setDoc(doc(db('agent'), 'config/portal'), { portalName: 'x' }));
  await assertFails(setDoc(doc(db('custA'), 'config/portal'), { portalName: 'x' }));
  await assertSucceeds(setDoc(doc(db('admin'), 'config/portal'), { portalName: 'Atlanta Customer Requests' }));
});

test('roles: read your own, admins manage the rest', async () => {
  await assertSucceeds(getDoc(doc(db('custA'), 'roles/custA')));
  await assertFails(getDoc(doc(db('custA'), 'roles/custB')));
  await assertFails(getDocs(collection(db('agent'), 'roles')));
  await assertSucceeds(getDocs(collection(db('admin'), 'roles')));
  await assertFails(setDoc(doc(db('custA'), 'roles/custA'), { role: 'admin', name: 'x' }));
  await assertFails(setDoc(doc(db('agent'), 'roles/new1'), { role: 'agent', name: 'x' }));
  await assertSucceeds(setDoc(doc(db('admin'), 'roles/new1'), { role: 'customer', name: 'New', account: 'Fabrikam Foods' }));
  await assertFails(setDoc(doc(db('admin'), 'roles/new2'), { role: 'customer', name: 'No account' }));
  await assertFails(setDoc(doc(db('admin'), 'roles/admin'), { role: 'agent', name: 'Pat Admin' }));
  await assertFails(deleteDoc(doc(db('admin'), 'roles/admin')));
});

test('anyone signed in can ask for access for themselves only', async () => {
  const fs = db('stranger');
  await assertSucceeds(setDoc(doc(fs, 'access/stranger'), { name: 'New Person', company: 'Fabrikam Foods', email: 'stranger@example.com', at: NOW }));
  await assertFails(setDoc(doc(fs, 'access/someoneElse'), { name: 'New Person', company: '', email: 'stranger@example.com', at: NOW }));
  await assertFails(setDoc(doc(fs, 'access/stranger'), { name: 'New Person', company: '', email: 'ceo@example.com', at: NOW }));
  await assertFails(getDocs(collection(fs, 'access')));
  await assertSucceeds(getDocs(collection(db('admin'), 'access')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'access/stranger')));
});

function assert(ok, msg) { if (!ok) throw new Error(msg); }
