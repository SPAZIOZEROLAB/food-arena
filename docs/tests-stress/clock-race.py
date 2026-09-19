"""Read current route SQL and migration; simulate expired snapshots in SQLite RAM only."""
import hashlib
import json
import pathlib
import re
import sqlite3
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).parent
source_bytes = (ROOT / 'app/api/passo/route.ts').read_bytes()
source = source_bytes.decode('utf-8')
ddl = (ROOT / 'drizzle/0000_flaky_stature.sql').read_text(encoding='utf-8')
DBNOW = re.search(r'const DBNOW="([^"]+)"', source).group(1)
hold = re.search(r'const holdSql=`([^`]+)`', source).group(1).replace('${DBNOW}', DBNOW)


def sql(prefix):
    match = re.search(r'prepare\(([\'"`])(' + re.escape(prefix) + r'.*?)\1\)', source, re.S)
    if not match:
        raise RuntimeError('Current SQL not found: ' + prefix)
    return match.group(2).replace('${holdSql}', hold).replace('${DBNOW}', DBNOW)


offer_sql = sql('INSERT OR IGNORE INTO offers(')
accept_sql = sql("UPDATE requests SET status='accepted',chosen=?")
offer_accept_sql = sql("UPDATE offers SET status='accepted' WHERE id=?")
other_cancel_sql = sql("UPDATE offers SET status='cancelled' WHERE request_id=? AND id<>?")
collect_sql = sql('UPDATE menu SET stock=stock-?')
create_request_sql = sql('INSERT INTO requests(id,owner_hash')


def setup():
    c = sqlite3.connect(':memory:')
    c.executescript(ddl)
    c.execute('PRAGMA foreign_keys=ON')
    now = c.execute('SELECT ' + DBNOW).fetchone()[0]
    c.execute('INSERT INTO venues VALUES(?,?,?,?,?,?,?,?)', ('v', 'test-owner', 'TEST', 'Test RAM', 'Test', '', 1, now))
    c.execute('INSERT INTO menu(id,venue_id,name,description,price,stock,prep,vegetarian,active,updated) VALUES(?,?,?,?,?,?,?,?,?,?)', ('m', 'v', 'TEST', 'RAM only', 600, 1, 1, 1, 1, now))
    return c, now


def add_request(c, request_id, now, status='open', pickup=None, chosen=None):
    c.execute('INSERT INTO requests(id,owner_hash,budget,quantity,zone,wish,vegetarian,pickup_by,created,status,chosen,demo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', (request_id, 'test-customer', 1800, 1, 'Test', 'RAM only', 1, pickup or now + 600000, now, status, chosen, 1))


def add_offer(c, offer_id, request_id, now, expires, status='offered', venue='v', menu='m'):
    c.execute('INSERT INTO offers(id,request_id,venue_id,menu_id,title,description,price,quantity,ready_at,expires,created,status,code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', (offer_id, request_id, venue, menu, 'TEST', 'RAM only', 600, 1, now + 240000, expires, now, status, 'TESTRAM'))


def new_offer(c, request_id, now):
    return c.execute(offer_sql, ('ob', request_id, 'v', 'm', 'TEST', 'RAM only', 600, 1, now + 240000, now + 180000, now, 'offered', 'TESTRAM', 'm', now, now, now, 1, request_id, now, now + 180000)).rowcount


tests = []
started = time.perf_counter()
c, now = setup()
add_request(c, 'ra', now)
add_request(c, 'rb', now)
add_offer(c, 'oa', 'ra', now, now - 50)
inserted = new_offer(c, 'rb', now)
accepted = c.execute(accept_sql, ('oa', 'ra', now - 100, 'oa', now - 100)).rowcount
available = c.execute(f'SELECT m.stock-({hold}) FROM menu m WHERE m.id=?', (now, now, now, 'm')).fetchone()[0]
tests.append({'name': 'accept-with-stale-clock-after-stock-reallocated', 'passed': inserted == 1 and accepted == 0 and available == 0, 'newOfferInserted': inserted, 'expiredAcceptanceRows': accepted, 'available': available})
c.close()

c, now = setup()
add_request(c, 'ra', now, status='accepted', pickup=now - 50, chosen='oa')
add_request(c, 'rb', now)
add_offer(c, 'oa', 'ra', now, now - 100, status='accepted')
inserted = new_offer(c, 'rb', now)
collected = c.execute(collect_sql, (1, 'm', 1, 'oa')).rowcount
stock = c.execute('SELECT stock FROM menu WHERE id=?', ('m',)).fetchone()[0]
tests.append({'name': 'collect-after-pickup-expired-and-stock-reallocated', 'passed': inserted == 1 and collected == 0 and stock == 1, 'newOfferInserted': inserted, 'expiredCollectionRows': collected, 'stock': stock})
c.close()

c, now = setup()
add_request(c, 'r1', now)
add_request(c, 'r2', now)
created = []
for index in range(12):
    created.append(c.execute(create_request_sql, (f'candidate{index}', 'test-customer', 1800, 1, 'Test', 'RAM only', 1, now + 600000, now, 'open', 1, 'test-customer')).rowcount)
count = c.execute('SELECT COUNT(*) FROM requests').fetchone()[0]
tests.append({'name': 'atomic-request-limit-serialized-d1-writes', 'passed': sum(created) == 1 and count == 3, 'initial': 2, 'attempts': 12, 'created': sum(created), 'finalCount': count})
c.close()

c, now = setup()
c.execute('INSERT INTO venues VALUES(?,?,?,?,?,?,?,?)', ('v2', 'test-owner2', 'TEST2', 'Test RAM', 'Test', '', 1, now))
c.execute('INSERT INTO menu(id,venue_id,name,description,price,stock,prep,updated) VALUES(?,?,?,?,?,?,?,?)', ('m2', 'v2', 'TEST2', 'RAM only', 600, 1, 1, now))
add_request(c, 'ra', now)
add_offer(c, 'oa', 'ra', now, now + 180000)
add_offer(c, 'ob', 'ra', now, now + 180000, venue='v2', menu='m2')
results = []
for offer_id in ('oa', 'ob'):
    # Both handlers originally read open/offered; each atomic batch is serialized.
    changed = c.execute(accept_sql, (offer_id, 'ra', now, offer_id, now)).rowcount
    c.execute(offer_accept_sql, (offer_id, 'ra', offer_id))
    c.execute(other_cancel_sql, ('ra', offer_id, 'ra', offer_id))
    results.append(changed)
offers = dict(c.execute('SELECT id,status FROM offers').fetchall())
chosen = c.execute('SELECT chosen FROM requests WHERE id=?', ('ra',)).fetchone()[0]
tests.append({'name': 'two-different-offers-competing-for-one-request', 'passed': results == [1, 0] and chosen == 'oa' and offers == {'oa': 'accepted', 'ob': 'cancelled'}, 'requestUpdateRows': results, 'chosen': chosen, 'offers': offers})
c.close()

report = {'source': str(ROOT / 'app/api/passo/route.ts'), 'sourceSha256': hashlib.sha256(source_bytes).hexdigest(), 'sqliteVersion': sqlite3.sqlite_version, 'scope': 'Current route SQL, actual migration, all data in :memory:, no live DB writes', 'elapsedMs': round((time.perf_counter() - started) * 1000), 'tests': tests, 'passed': all(test['passed'] for test in tests)}
(OUT / 'clock-race-result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
