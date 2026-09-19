// Demo Arena integration test: all writes go through the localhost API.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const BASE = 'http://localhost:5173';
const ROOT = path.resolve(__dirname, '../..');
const SOURCES = ['app/api/passo/route.ts', 'app/arena-demo.ts'];
const hashes = () => Object.fromEntries(SOURCES.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
const tag = `ARENA_TEST_${new Date().toISOString().replace(/[:.]/g, '-')}`;
const owner = { name: 'owner', cookies: new Map(), ids: [] };
const stranger = { name: 'stranger', cookies: new Map(), ids: [] };
const report = { tag, startedAt: new Date().toISOString(), sourceHashes: hashes(), tests: [], calls: [], cleanup: [], ownerPeakActive: 0, validOwnerAttestCalls: 0 };
const check = (condition, message) => { if (!condition) throw new Error(message); };
const sanitize = value => JSON.parse(JSON.stringify(value, (key, item) => ['code', 'owner_hash', 'owner'].includes(key) ? '[redacted]' : item));
function save() { fs.writeFileSync(path.join(__dirname, 'arena-result.json'), JSON.stringify(report, null, 2)); }
function record(name, passed, detail) { const item = { name, passed, detail }; report.tests.push(item); console.log(JSON.stringify(item)); save(); }
async function api(session, payloadOrQuery) {
  const data = typeof payloadOrQuery === 'string' ? null : payloadOrQuery;
  if (data?.action === 'attest' || (data?.action === 'demoAttest' && session === owner)) throw new Error('Safety stop: owner blockchain attest is forbidden in this test.');
  const headers = { origin: BASE };
  if (session.cookies.size) headers.cookie = [...session.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  if (data) headers['content-type'] = 'application/json';
  const started = performance.now();
  const response = await fetch(BASE + '/api/passo' + (data ? '' : '?' + payloadOrQuery), { method: data ? 'POST' : 'GET', headers, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(30000) });
  for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], index = pair.indexOf('='); session.cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
  const body = await response.json();
  const result = { status: response.status, body, elapsedMs: Math.round(performance.now() - started) };
  report.calls.push({ session: session.name, action: data?.action || payloadOrQuery, ...result, body: sanitize(body) });
  return result;
}
const ticket = (session, id) => api(session, 'view=request&id=' + encodeURIComponent(id));
async function create(session, overrides = {}) {
  const body = { action: 'request', budget: 1000, quantity: 1, minutes: 30, zone: 'Università / Viale Pindaro', wish: tag + ' offerta solo dimostrativa', vegetarian: false, demo: true, arena: true, ...overrides };
  const response = await api(session, body);
  if (response.status === 429) throw new Error('QUOTA: ' + response.body.error + ' No bypass attempted.');
  check(response.status === 201 && response.body.id, 'Could not create isolated Arena demo request: ' + JSON.stringify(response));
  session.ids.push(response.body.id);
  const mine = await api(session, 'view=mine');
  const active = mine.body.requests.filter(row => ['open', 'accepted'].includes(row.status) && row.pickup_by > Date.now());
  check(active.length <= 3, 'More than three active requests in test session');
  if (session === owner) report.ownerPeakActive = Math.max(report.ownerPeakActive, active.length);
  const state = await ticket(session, response.body.id);
  check(state.body.mine && state.body.request.demo === 1, 'Request is not verified as our own demo');
  return state.body;
}
async function cancel(session, id) {
  const state = await ticket(session, id);
  check(state.body.mine && state.body.request.demo === 1, 'Refusing cleanup of non-owned/non-demo data');
  if (state.body.request.status === 'open') {
    const response = await api(session, { action: 'cancel', requestId: id });
    check(response.status === 200, 'Cancellation failed');
  }
}

(async () => {
  // Anonymous customer: no sign-in endpoint, no merchant credentials.
  const first = await create(owner);
  const firstId = first.request.id;
  record('anonymous-10-euro-three-scripted-offers', first.offers.length === 3 && first.offers.every(offer => offer.scripted === 1 && offer.demo === 1 && offer.quantity === 1 && offer.price <= 1000) && first.offers.map(offer => offer.price).sort((a, b) => a - b).join(',') === '790,850,990', { requestId: firstId, budget: first.request.budget, offers: first.offers.map(({ id, venue_id, title, price, quantity, scripted, address }) => ({ id, venue_id, title, price, quantity, scripted, address })) });
  check(first.offers.length === 3, 'Missing baseline offers');
  record('pre-selection-codes-hidden', first.offers.every(offer => !Object.hasOwn(offer, 'code')), { hiddenCount: first.offers.filter(offer => !Object.hasOwn(offer, 'code')).length });
  const chosenBefore = [...first.offers].sort((a, b) => a.ready_at - b.ready_at)[0];
  const accept = await api(owner, { action: 'accept', requestId: firstId, offerId: chosenBefore.id });
  check(accept.status === 200, 'Baseline offer acceptance failed');
  let chosenState = (await ticket(owner, firstId)).body;
  let chosen = chosenState.offers.find(offer => offer.id === chosenBefore.id);
  record('one-choice-cancels-other-two', chosenState.request.status === 'accepted' && chosenState.request.chosen === chosen.id && chosen.status === 'accepted' && chosenState.offers.filter(offer => offer.id !== chosen.id).every(offer => offer.status === 'cancelled' && !Object.hasOwn(offer, 'code')), { statuses: chosenState.offers.map(({ id, status }) => ({ id, status })), chosen: chosenState.request.chosen, ownerChosenCodePresent: typeof chosen.code === 'string' });

  // A different legitimate customer cookie, immediately closed after creation.
  const foreign = await create(stranger, { arena: false, wish: tag + ' stranger session' });
  await cancel(stranger, foreign.request.id);
  const collectForeign = await api(stranger, { action: 'demoCollect', offerId: chosen.id, code: chosen.code });
  const attestForeign = await api(stranger, { action: 'demoAttest', offerId: chosen.id });
  record('stranger-cannot-collect-or-attest', collectForeign.status === 403 && attestForeign.status === 403, { demoCollectStatus: collectForeign.status, demoAttestStatus: attestForeign.status, hasDifferentCustomerCookie: true, attestSentBeforeCollection: true });

  const multi = await create(owner, { quantity: 2, budget: 1700, wish: tag + ' multi quantity total budget' });
  record('multi-quantity-uses-total-price', multi.request.quantity === 2 && multi.offers.length === 2 && multi.offers.every(offer => offer.quantity === 2 && offer.price <= 1700) && multi.offers.map(offer => offer.price).sort((a, b) => a - b).join(',') === '1580,1700', { quantity: multi.request.quantity, totalBudget: multi.request.budget, offers: multi.offers.map(({ title, price, quantity }) => ({ title, price, quantity })) });
  await cancel(owner, multi.request.id);

  const veggie = await create(owner, { quantity: 2, budget: 2200, vegetarian: true, wish: tag + ' vegetarian only' });
  record('vegetarian-excludes-affordable-chicken', veggie.request.vegetarian === 1 && veggie.offers.length === 2 && veggie.offers.every(offer => !offer.title.toLowerCase().includes('pollo')) && veggie.offers.map(offer => offer.price).sort((a, b) => a - b).join(',') === '1580,1700', { totalBudget: veggie.request.budget, vegetarian: veggie.request.vegetarian, offers: veggie.offers.map(({ title, price, quantity }) => ({ title, price, quantity })) });
  await cancel(owner, veggie.request.id);

  const empty = await create(owner, { budget: 700, wish: tag + ' below minimum price' });
  record('below-minimum-budget-honest-empty', empty.request.budget === 700 && empty.offers.length === 0 && empty.request.status === 'open', { budget: empty.request.budget, offers: empty.offers.length, status: empty.request.status });
  await cancel(owner, empty.request.id);

  const previousVenueIds = new Set(first.offers.map(offer => offer.venue_id));
  for (const zone of ['Porta Nuova', 'Pescara centro']) {
    const otherZone = await create(owner, { zone, wish: tag + ' zone isolation ' + zone });
    const noCollision = otherZone.offers.every(offer => !previousVenueIds.has(offer.venue_id));
    record('scripted-venue-zone-' + zone, otherZone.offers.length === 3 && noCollision && otherZone.offers.every(offer => offer.address.includes(zone) && offer.venue_id.includes(encodeURIComponent(zone))), { zone, offers: otherZone.offers.map(({ venue_id, address, price }) => ({ venue_id, address, price })), noCollisionWithEarlierZones: noCollision });
    otherZone.offers.forEach(offer => previousVenueIds.add(offer.venue_id));
    await cancel(owner, otherZone.request.id);
  }

  chosenState = (await ticket(owner, firstId)).body;
  chosen = chosenState.offers.find(offer => offer.id === chosenBefore.id);
  const wrong = await api(owner, { action: 'demoCollect', offerId: chosen.id, code: 'WRONG0' });
  // Respect an actual server readiness guard; never change times, rows, or browser clocks.
  let waitMs = 0;
  if (wrong.status !== 200 && !/codice/i.test(wrong.body.error || '') && chosen.ready_at > chosenState.now) {
    waitMs = chosen.ready_at - chosenState.now + 500;
    check(waitMs <= 16 * 60000, 'Readiness wait exceeds bounded sixteen-minute test');
    console.log(JSON.stringify({ waitingForServerReadyAt: chosen.ready_at, waitMs }));
    while (waitMs > 0) {
      const pause = Math.min(waitMs, 30000);
      await new Promise(resolve => setTimeout(resolve, pause));
      waitMs -= pause;
      console.log(JSON.stringify({ readyWaitRemainingMs: waitMs }));
    }
  }
  const wrongReady = waitMs === 0 && /codice/i.test(wrong.body.error || '') ? wrong : await api(owner, { action: 'demoCollect', offerId: chosen.id, code: 'WRONG0' });
  record('owner-wrong-pickup-code-rejected', wrongReady.status === 400 && /codice/i.test(wrongReady.body.error || ''), { status: wrongReady.status, message: wrongReady.body.error });
  const collects = await Promise.all(Array.from({ length: 2 }, () => api(owner, { action: 'demoCollect', offerId: chosen.id, code: chosen.code })));
  const collected = (await ticket(owner, firstId)).body;
  const finalOffer = collected.offers.find(offer => offer.id === chosen.id);
  record('owner-correct-code-single-demo-collection', collects.filter(result => result.status === 200).length === 1 && collected.request.status === 'collected' && finalOffer.status === 'collected' && /^[a-f0-9]{64}$/.test(finalOffer.proof_hash || '') && !finalOffer.tx_hash, { statuses: collects.map(result => result.status), requestStatus: collected.request.status, offerStatus: finalOffer.status, proofHashPresent: !!finalOffer.proof_hash, txHash: finalOffer.tx_hash, validOwnerAttestCalls: 0 });
})().catch(error => { report.error = error.stack; console.error(error); }).finally(async () => {
  for (const session of [owner, stranger]) {
    for (const id of session.ids) {
      try {
        await cancel(session, id);
        const result = (await ticket(session, id)).body;
        report.cleanup.push({ session: session.name, id, demo: result.request.demo, status: result.request.status });
      } catch (error) { report.cleanup.push({ session: session.name, id, error: error.message }); }
    }
  }
  report.cleanupPassed = report.cleanup.every(item => item.demo === 1 && ['collected', 'cancelled'].includes(item.status));
  report.sourceHashesEnd = hashes();
  report.sourceChangedDuringRun = JSON.stringify(report.sourceHashes) !== JSON.stringify(report.sourceHashesEnd);
  report.finishedAt = new Date().toISOString();
  report.elapsedMs = Date.parse(report.finishedAt) - Date.parse(report.startedAt);
  report.passed = !report.error && report.tests.every(test => test.passed) && report.cleanupPassed;
  save();
  console.log(JSON.stringify({ report: path.join(__dirname, 'arena-result.json'), passed: report.passed, cleanupPassed: report.cleanupPassed, ownerPeakActive: report.ownerPeakActive, validOwnerAttestCalls: 0, sourceChangedDuringRun: report.sourceChangedDuringRun, elapsedMs: report.elapsedMs }));
});
