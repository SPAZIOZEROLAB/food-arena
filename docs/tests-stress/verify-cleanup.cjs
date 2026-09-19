const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, 'stress-result.json');
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
(async () => {
  const base = 'http://localhost:5173';
  const signin = await fetch(base + '/signin-with-chatgpt?return_to=%2Fgestore', { redirect: 'manual' });
  const cookie = signin.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const merchant = await fetch(base + '/api/passo?view=merchant', { headers: { cookie } }).then(r => r.json());
  const tickets = [];
  for (const id of report.createdRequestIds) {
    const ticket = await fetch(base + '/api/passo?view=request&id=' + encodeURIComponent(id)).then(r => r.json());
    tickets.push({ id, demo: ticket.request.demo, status: ticket.request.status });
  }
  const activeOwnMenus = merchant.menu.filter(menu => report.createdMenuIds.includes(menu.id)).map(menu => menu.id);
  const result = { checkedAt: new Date().toISOString(), activeOwnMenus, tickets, passed: activeOwnMenus.length === 0 && tickets.every(ticket => ticket.demo === 1 && ['collected', 'cancelled'].includes(ticket.status)) };
  report.cleanupVerified = result;
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
