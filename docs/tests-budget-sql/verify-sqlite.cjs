const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {DatabaseSync} = require('node:sqlite');

const checkout = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../..');
const ts = require(path.join(checkout, 'node_modules/typescript'));
const files = {
  budget: path.join(checkout, 'app/budget-server.ts'),
  route: path.join(checkout, 'app/api/passo/route.ts'),
  seed: path.join(checkout, 'app/arena-demo.ts'),
  ticket: path.join(checkout, 'app/r/[id]/ticket.tsx'),
};
const sources = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));

// Extract the SQL from the reviewed source, rather than maintaining a second query implementation.
function sqlStatements(text) {
  const source = ts.createSourceFile('review.ts', text, ts.ScriptTarget.Latest, true);
  const values = new Map();
  function literal(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isIdentifier(node)) return values.get(node.text);
    if (ts.isTemplateExpression(node)) {
      let result = node.head.text;
      for (const part of node.templateSpans) {
        const value = literal(part.expression);
        if (value === undefined) return undefined;
        result += value + part.literal.text;
      }
      return result;
    }
    return undefined;
  }
  const statements = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const value = literal(node.initializer);
      if (value !== undefined) values.set(node.name.text, value);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'prepare') {
      const value = node.arguments[0] && literal(node.arguments[0]);
      if (value !== undefined) statements.push(value);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return {statements, values};
}
const route = sqlStatements(sources.route), budget = sqlStatements(sources.budget);
function query(owner, prefix) {
  const candidates = owner.statements.filter(sql => sql.startsWith(prefix));
  assert.equal(candidates.length, 1, `Expected one source SQL query: ${prefix}`);
  return candidates[0];
}
const now = Date.now(), future = now + 600000;
const schema = `
CREATE TABLE menu(id TEXT PRIMARY KEY,venue_id TEXT,name TEXT,description TEXT,price INTEGER,stock INTEGER,prep INTEGER,vegetarian INTEGER,active INTEGER DEFAULT 1,updated INTEGER);
CREATE TABLE requests(id TEXT PRIMARY KEY,status TEXT,chosen TEXT,pickup_by INTEGER);
CREATE TABLE offers(id TEXT PRIMARY KEY,request_id TEXT,venue_id TEXT,menu_id TEXT,title TEXT,description TEXT,price INTEGER,quantity INTEGER,ready_at INTEGER,expires INTEGER,created INTEGER,status TEXT,code TEXT,proof_hash TEXT,tx_hash TEXT,UNIQUE(request_id,venue_id));
CREATE TABLE budget_offers(offer_id TEXT PRIMARY KEY,order_id TEXT,merchant TEXT,amount TEXT,expires_at INTEGER,terms_hash TEXT,signature TEXT NOT NULL,status TEXT,hold_tx TEXT,settle_tx TEXT,release_tx TEXT);
`;
function fresh() { const db = new DatabaseSync(':memory:'); db.exec(schema); return db; }
function batch(db, statements) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = statements.map(([sql, args]) => db.prepare(sql).run(...args));
    db.exec('COMMIT');
    return result;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
function request(db, id, status = 'open', chosen = null) { db.prepare('INSERT INTO requests VALUES(?,?,?,?)').run(id, status, chosen, future); }
function menu(db, id = 'Y', stock = 1) { db.prepare('INSERT INTO menu VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, 'venue-' + id, 'Meal', 'Demo', 900, stock, 5, 1, 1, now); }
function offer(db, id, req, dish, status = 'offered') { db.prepare('INSERT INTO offers(id,request_id,venue_id,menu_id,quantity,status,expires) VALUES(?,?,?,?,?,?,?)').run(id, req, 'venue-' + dish, dish, 1, status, future); }
function mandate(db, id, status = 'holding') { db.prepare('INSERT INTO budget_offers(offer_id,signature,status) VALUES(?,?,?)').run(id, 'test-signature', status); }
function held(db, dish = 'Y') {
  return db.prepare(`SELECT (${route.values.get('holdSql')}) AS held FROM menu m WHERE m.id=?`).get(now, now, now, dish).held;
}
const results = [];
function test(name, run) {
  const db = fresh();
  try { results.push({name, passed: true, evidence: run(db)}); }
  finally { db.close(); }
}

const failureBatch = (req, chosen) => [
  [query(budget, "UPDATE requests SET status='cancelled',chosen=NULL"), [req, chosen]],
  [query(budget, "UPDATE offers SET status='cancelled' WHERE request_id=? AND status IN"), [req]],
  [query(budget, "UPDATE budget_offers SET status='failed'"), [chosen]],
];
test('Failed hold does not reactivate a competing offer or oversell the last portion', db => {
  menu(db); menu(db, 'X'); request(db, 'R1'); request(db, 'R2');
  offer(db, 'R1-Y', 'R1', 'Y'); offer(db, 'R1-X', 'R1', 'X'); mandate(db, 'R1-X');
  assert.equal(held(db), 1);
  db.exec("UPDATE requests SET status='reserving',chosen='R1-X' WHERE id='R1'; UPDATE offers SET status='reserving' WHERE id='R1-X'");
  assert.equal(held(db), 0);
  offer(db, 'R2-Y', 'R2', 'Y', 'accepted');
  db.exec("UPDATE requests SET status='accepted',chosen='R2-Y' WHERE id='R2'");
  batch(db, failureBatch('R1', 'R1-X'));
  assert.equal(db.prepare("SELECT status FROM requests WHERE id='R1'").get().status, 'cancelled');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM offers WHERE request_id='R1' AND status<>'cancelled'").get().n, 0);
  assert.equal(held(db), 1);
  const retry = db.prepare(query(route, "UPDATE requests SET status='reserving',chosen=?")).run('R1-Y', 'R1', 'R1-Y');
  assert.equal(retry.changes, 0);
  return {stock: 1, held: held(db), available: 1 - held(db), oldChoiceAccepted: false};
});

const insertOffer = query(route, 'INSERT OR IGNORE INTO offers(');
const insertBudget = query(route, 'INSERT INTO budget_offers(');
function newOfferBatch(id, signature = 'test-signature') {
  return [
    [insertOffer, [id, 'R1', 'venue-Y', 'Y', 'Meal', 'Demo', 900, 1, now + 60000, future, now, 'offered', 'ABC123', 'Y', now, now, now, 1, 'R1', now, future]],
    [insertBudget, [id, 'order-' + id, 'merchant', '100', Math.floor(future / 1000), 'terms', signature, 'offered', id]],
  ];
}
test('An injected mandate insert failure rolls back the offer as well', db => {
  menu(db); request(db, 'R1');
  assert.throws(() => batch(db, newOfferBatch('O1', null)), /NOT NULL constraint failed/);
  const counts = {offers: db.prepare('SELECT COUNT(*) AS n FROM offers').get().n, mandates: db.prepare('SELECT COUNT(*) AS n FROM budget_offers').get().n};
  assert.deepEqual(counts, {offers: 0, mandates: 0});
  assert.equal(held(db), 0);
  return counts;
});
test('Successful offer and duplicate retry never leave an orphan mandate', db => {
  menu(db, 'Y', 2); request(db, 'R1');
  const first = batch(db, newOfferBatch('O1'));
  const duplicate = batch(db, newOfferBatch('O2'));
  assert.equal(first[0].changes, 1); assert.equal(first[1].changes, 1);
  assert.equal(duplicate[0].changes, 0); assert.equal(duplicate[1].changes, 0);
  return {offers: db.prepare('SELECT COUNT(*) AS n FROM offers').get().n, mandates: db.prepare('SELECT COUNT(*) AS n FROM budget_offers').get().n, duplicateChanges: duplicate.map(r => r.changes)};
});

const collectBatch = () => [
  [query(budget, 'UPDATE menu SET stock=stock-?'), [1, 'Y', 1, 'O1']],
  [query(budget, "UPDATE offers SET status='collected'"), ['proof', 'tx', 'O1']],
  [query(budget, "UPDATE requests SET status='collected'"), ['R1', 'O1']],
  [query(budget, "UPDATE budget_offers SET status='settled'"), ['O1', 'O1']],
];
function settlingFixture(db, stock = 1) { menu(db, 'Y', stock); request(db, 'R1', 'settling', 'O1'); offer(db, 'O1', 'R1', 'Y', 'settling'); mandate(db, 'O1', 'settling'); }
test('Two stale settlement reconciliations decrement stock exactly once', db => {
  settlingFixture(db);
  const first = batch(db, collectBatch()), staleSecond = batch(db, collectBatch());
  assert.equal(first[0].changes, 1); assert.equal(staleSecond[0].changes, 0); assert.equal(staleSecond[1].changes, 0);
  assert.equal(db.prepare("SELECT stock FROM menu WHERE id='Y'").get().stock, 0);
  assert.equal(db.prepare("SELECT status FROM offers WHERE id='O1'").get().status, 'collected');
  assert.equal(db.prepare("SELECT status FROM budget_offers WHERE offer_id='O1'").get().status, 'settled');
  return {firstStockChanges: first[0].changes, staleStockChanges: staleSecond[0].changes, finalStock: 0, finalOffer: 'collected'};
});
test('Insufficient stock cannot be marked collected by an unrelated earlier write', db => {
  settlingFixture(db, 0);
  db.prepare("UPDATE requests SET status='settling' WHERE id='R1'").run();
  const result = batch(db, collectBatch());
  assert.equal(result[0].changes, 0); assert.equal(result[1].changes, 0);
  assert.equal(db.prepare("SELECT status FROM offers WHERE id='O1'").get().status, 'settling');
  assert.equal(db.prepare("SELECT status FROM budget_offers WHERE offer_id='O1'").get().status, 'settling');
  return {stockChanges: 0, offerChanges: 0, remainingState: 'settling', serverCodeThrowsReconciliationError: sources.budget.includes("confirmed?.status!=='collected'")};
});
test('Stale held and failed-hold reconciliation cannot regress a collected order', db => {
  settlingFixture(db); batch(db, collectBatch());
  batch(db, [
    [query(budget, "UPDATE requests SET status='accepted'"), ['R1', 'O1']],
    [query(budget, "UPDATE offers SET status='accepted'"), ['O1']],
    [query(budget, "UPDATE offers SET status='cancelled' WHERE request_id=? AND id<>?"), ['R1', 'O1']],
    [query(budget, "UPDATE budget_offers SET status='held'"), ['O1']],
  ]);
  batch(db, failureBatch('R1', 'O1'));
  const states = {request: db.prepare("SELECT status FROM requests WHERE id='R1'").get().status, offer: db.prepare("SELECT status FROM offers WHERE id='O1'").get().status, mandate: db.prepare("SELECT status FROM budget_offers WHERE offer_id='O1'").get().status, stock: db.prepare("SELECT stock FROM menu WHERE id='Y'").get().stock};
  assert.deepEqual(states, {request: 'collected', offer: 'collected', mandate: 'settled', stock: 0});
  return states;
});

const report = {
  runAt: new Date().toISOString(),
  runtime: process.version,
  engine: 'node:sqlite, SQLite in-memory; source SQL executed in explicit transactions',
  sourceHashes: Object.fromEntries(Object.entries(sources).map(([key, text]) => [key, crypto.createHash('sha256').update(text).digest('hex')])),
  tests: results,
  readOnlyChecks: {
    demoSeedBudgetStatementsBeforeSingleBatch: sources.seed.includes("statements.push(db().prepare('INSERT INTO budget_offers") && sources.seed.indexOf("statements.push(db().prepare('INSERT INTO budget_offers") < sources.seed.indexOf('await db().batch(statements)'),
    ticketReconcilesHeldAfterThreeSecondsPastPickup: sources.ticket.includes("next.budgetSettlement?.state==='held'&&Date.now()>next.request.pickup_by+3000"),
  },
  limits: ['No RPC or transaction calls.', 'No Cloudflare D1 deployment execution.', 'Stale concurrent readers modeled by serial transaction batches; no multi-process load test.', 'Demo seeding and browser polling inspected in source, not executed in this script.'],
};
fs.writeFileSync(path.join(__dirname, 'sqlite-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
