// Local demo-only integration stress test. No database internals or forged auth/IP headers.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const BASE = 'http://localhost:5173';
const SOURCE = path.resolve(__dirname, '../../app/api/passo/route.ts');
const tag = `STRESS_${new Date().toISOString().replace(/[:.]/g, '-')}`;
const report = { tag, base: BASE, startedAt: new Date().toISOString(), maxConcurrency: 12, peakConcurrency: 0, tests: [], requests: [], createdRequestIds: [], createdMenuIds: [], cleanup: [], sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(SOURCE)).digest('hex') };
let active = 0;
let limitedByIp = false;
const merchant = { cookies: new Map() };
const customer = { cookies: new Map() };

function check(condition, message) { if (!condition) throw new Error(message); }
function safeBody(body) {
  if (!body || typeof body !== 'object') return body;
  return JSON.parse(JSON.stringify(body, (key, value) => ['code', 'owner_hash', 'owner'].includes(key) ? '[redacted]' : value));
}
async function request(session, pathname, data) {
  check(active < 12, 'Client concurrency exceeds 12');
  active++; report.peakConcurrency = Math.max(report.peakConcurrency, active);
  const started = performance.now();
  try {
    const headers = { origin: BASE };
    if (session.cookies.size) headers.cookie = [...session.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (data) headers['content-type'] = 'application/json';
    const response = await fetch(BASE + pathname, { method: data ? 'POST' : 'GET', headers, body: data ? JSON.stringify(data) : undefined, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'); const index = pair.indexOf('='); session.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const text = await response.text();
    let body; try { body = JSON.parse(text); } catch { body = { text: text.slice(0, 300) }; }
    const result = { status: response.status, body, elapsedMs: Math.round(performance.now() - started) };
    report.requests.push({ action: data?.action || pathname, ...result, body: safeBody(body) });
    if (response.status === 429 && /Troppe richieste|limite.*orari/i.test(body.error || '')) limitedByIp = true;
    return result;
  } finally { active--; }
}
const post = (session, data) => request(session, '/api/passo', data);
const getMerchant = () => request(merchant, '/api/passo?view=merchant');
const getTicket = (id) => request(customer, '/api/passo?view=request&id=' + encodeURIComponent(id));
function record(name, passed, detail) { report.tests.push({ name, passed, detail }); console.log(JSON.stringify({ test: name, passed, detail })); }

(async () => {
  const signin = await request(merchant, '/signin-with-chatgpt?return_to=%2Fgestore');
  check(signin.status === 302 && merchant.cookies.has('__sites_local_auth'), 'Local sign-in did not issue its expected cookie');
  let state = await getMerchant(); check(state.status === 200, 'Merchant API unavailable');
  if (!state.body.venue) {
    const create = await post(merchant, { action: 'venue', name: `Test Food Arena ${tag}`, address: 'Punto di ritiro fittizio per test locale', phone: '', zone: 'Università / Viale Pindaro', authorized: true, demo: true });
    check(create.status === 200, 'Demo venue could not be created');
    state = await getMerchant();
  }
  const venue = state.body.venue;
  check(venue?.demo === 1, 'Safety stop: authenticated venue is not demo');
  report.demoVenue = { id: venue.id, name: venue.name, demo: venue.demo, zone: venue.zone };
  const body = { action: 'request', budget: 1800, quantity: 1, minutes: 30, zone: venue.zone, wish: `${tag} pranzo vegetariano TEST`, vegetarian: true, demo: true };
  const seed = await post(customer, body);
  if (seed.status === 429 && limitedByIp) { record('setup', null, 'Blocked by existing per-IP/hour quota; no bypass attempted.'); return; }
  check(seed.status === 201 && seed.body.id, 'First isolated demo request was not created');
  report.createdRequestIds.push(seed.body.id);
  // Reuse the cookie issued by the first POST. Never forge or rotate it to evade quota.
  const burst = await Promise.all(Array.from({ length: 4 }, (_, index) => post(customer, { ...body, wish: `${tag} session cap candidate ${index}` })));
  for (const result of burst) if (result.status === 201) report.createdRequestIds.push(result.body.id);
  const mine = await request(customer, '/api/passo?view=mine');
  const ourActive = mine.body.requests?.filter(row => report.createdRequestIds.includes(row.id) && ['open', 'accepted'].includes(row.status));
  const successes = burst.filter(result => result.status === 201).length;
  record('three-active-requests-same-session', limitedByIp ? null : successes === 2 && ourActive?.length === 3 && burst.filter(result => result.status === 429).length === 2, { initial: 1, parallel: 4, createdInBurst: successes, active: ourActive?.length, statuses: burst.map(x => x.status), errors: burst.filter(x => x.status !== 201).map(x => x.body.error), limitedByIp });
  if (report.createdRequestIds.length < 2) { record('stock-and-acceptance-setup', null, 'Insufficient demo requests after quota response.'); return; }
  const menuName = `${tag} ultima porzione`;
  const menu = await post(merchant, { action: 'menu', name: menuName, description: 'Piatto vegetariano fittizio. Test tecnico locale, non acquistabile.', price: 600, stock: 1, prep: 1, vegetarian: true });
  check(menu.status === 200, 'Test menu creation failed');
  state = await getMerchant();
  const testMenu = state.body.menu.find(item => item.name === menuName);
  check(testMenu && testMenu.venue_id === venue.id, 'New test menu could not be identified');
  report.createdMenuIds.push(testMenu.id);
  const offers = await Promise.all(report.createdRequestIds.map(requestId => post(merchant, { action: 'offer', requestId, menuId: testMenu.id })));
  const winnerIndex = offers.findIndex(result => result.status === 200 && result.body.id);
  const acceptedOffers = offers.filter(result => result.status === 200 && result.body.id);
  state = await getMerchant();
  const afterOffers = state.body.menu.find(item => item.id === testMenu.id);
  record('last-serving-concurrent-offers', acceptedOffers.length === 1 && afterOffers.stock === 1 && afterOffers.available === 0, { contenders: offers.length, statuses: offers.map(x => x.status), offersCreated: acceptedOffers.length, stock: afterOffers.stock, available: afterOffers.available });
  check(winnerIndex >= 0 && acceptedOffers.length === 1, 'Cannot continue without exactly one stock winner');
  const requestId = report.createdRequestIds[winnerIndex], offerId = offers[winnerIndex].body.id;
  const nonOwner = await post({ cookies: new Map() }, { action: 'accept', requestId, offerId });
  record('non-owner-accept-rejected', nonOwner.status === 403, { status: nonOwner.status });
  const acceptance = await Promise.all(Array.from({ length: 12 }, () => post(customer, { action: 'accept', requestId, offerId })));
  const ticket = await getTicket(requestId);
  const chosen = ticket.body.offers.find(offer => offer.id === offerId);
  record('twelve-simultaneous-accepts', acceptance.filter(x => x.status === 200).length === 1 && ticket.body.request.status === 'accepted' && ticket.body.request.chosen === offerId, { successes: acceptance.filter(x => x.status === 200).length, statuses: acceptance.map(x => x.status), requestStatus: ticket.body.request.status, chosenMatches: ticket.body.request.chosen === offerId });
  check(chosen?.code && ticket.body.request.status === 'accepted', 'Chosen customer pickup code unavailable');
  state = await getMerchant();
  const merchantOffer = state.body.offers.find(offer => offer.id === offerId);
  const anonymous = await request({ cookies: new Map() }, '/api/passo?view=request&id=' + encodeURIComponent(requestId));
  record('pickup-secret-scope', !Object.hasOwn(merchantOffer, 'code') && !Object.hasOwn(anonymous.body.offers.find(offer => offer.id === offerId), 'code') && !Object.hasOwn(anonymous.body.request, 'owner_hash'), { merchantHasCode: Object.hasOwn(merchantOffer, 'code'), anonymousHasCode: Object.hasOwn(anonymous.body.offers.find(offer => offer.id === offerId), 'code'), ownerHasChosenCode: true });
  const collection = await Promise.all(Array.from({ length: 12 }, () => post(merchant, { action: 'collect', offerId, code: chosen.code })));
  state = await getMerchant();
  const afterCollect = state.body.menu.find(item => item.id === testMenu.id);
  const finalTicket = await getTicket(requestId);
  record('twelve-simultaneous-collections', collection.filter(x => x.status === 200).length === 1 && afterCollect.stock === 0 && afterCollect.available === 0 && finalTicket.body.request.status === 'collected', { successes: collection.filter(x => x.status === 200).length, statuses: collection.map(x => x.status), stock: afterCollect.stock, available: afterCollect.available, requestStatus: finalTicket.body.request.status });
})().catch(error => { report.error = error.stack; console.error(error); }).finally(async () => {
  // Cleanup only own run: cancel its still-open demo requests and pause its test menus.
  for (const requestId of report.createdRequestIds) {
    try {
      const current = await getTicket(requestId);
      if (current.body.request?.demo !== 1 || !current.body.mine) { report.cleanup.push({ requestId, skipped: 'not verified own demo' }); continue; }
      if (current.body.request.status === 'open') {
        const result = await post(customer, { action: 'cancel', requestId });
        report.cleanup.push({ requestId, action: 'cancel', status: result.status });
      } else report.cleanup.push({ requestId, keptStatus: current.body.request.status });
    } catch (error) { report.cleanup.push({ requestId, error: error.message }); }
  }
  for (const menuId of report.createdMenuIds) {
    try { const result = await post(merchant, { action: 'pauseMenu', id: menuId }); report.cleanup.push({ menuId, action: 'pause', status: result.status }); }
    catch (error) { report.cleanup.push({ menuId, error: error.message }); }
  }
  report.finishedAt = new Date().toISOString();
  report.elapsedMs = Date.parse(report.finishedAt) - Date.parse(report.startedAt);
  report.limitedByIp = limitedByIp;
  report.sourceSha256End = crypto.createHash('sha256').update(fs.readFileSync(SOURCE)).digest('hex');
  report.sourceChangedDuringRun = report.sourceSha256 !== report.sourceSha256End;
  report.passed = !report.error && !report.tests.some(test => test.passed === false) && !report.tests.some(test => test.passed === null);
  fs.writeFileSync(path.join(__dirname, 'stress-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path.join(__dirname, 'stress-result.json'), passed: report.passed, limitedByIp, peakConcurrency: report.peakConcurrency, elapsedMs: report.elapsedMs, sourceChangedDuringRun: report.sourceChangedDuringRun }));
});
