/* ============================================================
   Norseman 2030 – demotila
   Korvaa Supabase-yhteyden selaimen localStoragella, jotta sovellusta
   voi esitellä ilman kirjautumista. Sovelluksen oma koodi pysyy
   muuttumattomana: se kutsuu window.supabase.createClient() kuten
   ennenkin, mutta saa tämän tiedoston tekaistun asiakkaan.
   Esimerkkidata luodaan sovelluksen omasta treeniohjelmasta.
   ============================================================ */
(function () {
  const DB_KEY = 'norseman-demo-db-v1';
  const DEMO_URL = 'https://demo.invalid';
  const USER = { id: 'demo-user', email: 'demo@norseman.invalid' };
  const SESSION = { user: USER, access_token: 'demo' };

  /* ---------- Tietovarasto ---------- */
  const empty = () => ({ entries: [], moves: [], settings: [], seeded: false });
  function loadDb() {
    try { return { ...empty(), ...JSON.parse(localStorage.getItem(DB_KEY) || 'null') }; }
    catch (e) { return empty(); }
  }
  let db = loadDb();
  function saveDb() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) {} }
  function resetDb() {
    db = empty();
    saveDb();
    // Sovelluksen omat välimuistit ja luonnos tyhjiksi, jotta näkymä alkaa puhtaalta pöydältä
    try { Object.keys(localStorage).filter(k => k.startsWith('norseman-') && k !== DB_KEY).forEach(k => localStorage.removeItem(k)); } catch (e) {}
  }

  /* ---------- Esimerkkidata ---------- */
  // Toistettava satunnaisluku päivän perusteella: sama päivä tuottaa aina saman datan
  function rng(seed) {
    let h = 2166136261;
    for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  const round = (v, step) => Math.round(v / step) * step;

  // Aloituspainot liikkeen nimen perusteella; 0 = kehonpaino (vain toistot)
  const BASE_KG = [
    [/maastaveto/i, 95], [/kyykky/i, 75], [/penkki/i, 62.5], [/pystypunnerrus/i, 40],
    [/romanialai|rdl|suorin jaloin/i, 65], [/lantionnosto|hip thrust/i, 80], [/soutu/i, 26],
    [/askel|bulgar|lunge|vipunosto/i, 16], [/leuanveto|dippi|punnerrus|lankku|kierto|nosto riipp/i, 0]
  ];
  const baseKg = name => (BASE_KG.find(([re]) => re.test(name)) || [null, 20])[1];
  const NOTES = ['Kulki kevyesti.', 'Jalat tukossa alussa, avautui puolivälissä.', 'Hyvä fiilis koko treenin.', 'Tuulista, mutta meni.', 'Vähän väsynyt huonon yön jälkeen.', ''];

  function strengthSets(x, k, r) {
    let rows = null;
    try { rows = detailFor(x, k, false).ex; } catch (e) {}
    if (!rows) return null;
    const weeks = Math.max(0, Math.floor((dayNum(k) - dayNum(PLAN_START)) / 7));
    return rows.map(([name, rx]) => {
      const n = typeof setCount === 'function' ? setCount(rx) : 3;
      const reps = +((String(rx).match(/×\s*(\d+)/) || [])[1]) || 8;
      const b = baseKg(name);
      const kg = b ? round(b + weeks * 2.5 + (r() < 0.3 ? 2.5 : 0), 2.5) : null;
      return { ex: name, sets: Array.from({ length: n }, () => ({ kg, reps })) };
    });
  }

  // Strava-tyyliset tarkat tiedot juoksulle: kilometriajat ja käyrät
  function runDetails(distKm, durMin, r) {
    const N = 300, dist = distKm * 1000, moving = durMin * 60, avgV = dist / moving;
    const s = { d: [], hr: [], v: [], alt: [] };
    let dv = 0, dh = 0; // tasoitettu satunnaisvaihtelu, jotta käyrät näyttävät oikeilta
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const climb = Math.cos(t * Math.PI * 3);           // ylämäessä hidastuu ja syke nousee
      dv = 0.9 * dv + (r() - 0.5) * 0.06;
      dh = 0.9 * dh + (r() - 0.5) * 1.2;
      s.d.push(Math.round(dist * t));
      s.hr.push(Math.round(118 + 20 * Math.min(1, t * 5) + 6 * t + 3 * climb + dh));
      s.v.push(Math.round(avgV * (1 - 0.04 * climb + dv) * 100) / 100);
      s.alt.push(Math.round(32 + 14 * Math.sin(t * Math.PI * 3)));
    }
    const splits = [];
    for (let km = 0; km < Math.floor(distKm); km++) {
      splits.push({ d: 1000, t: Math.round(1000 / avgV * (0.97 + r() * 0.06)), hr: 128 + km * 2 + Math.round(r() * 4), el: Math.round((r() - 0.5) * 12) });
    }
    const rest = Math.round((distKm % 1) * 1000);
    if (rest > 50) splits.push({ d: rest, t: Math.round(rest / avgV), hr: 142, el: 1 });
    return {
      src: 'demo', moving, elapsed: moving + 40, dist, avgV: Math.round(avgV * 100) / 100, maxV: Math.round(avgV * 1.25 * 100) / 100,
      avgHr: 138, maxHr: 156, elev: 96, cad: 83, watts: null, splits, laps: [], s
    };
  }

  function seed() {
    const today = todayKey();
    let k = PLAN_START > addDays(today, -27) ? PLAN_START : addDays(today, -27);
    const rows = [];
    for (; k < today; k = addDays(k, 1)) {
      const r = rng(k);
      basePlan(k).items.forEach((x, i) => {
        if (x.s === 'rest' || x.s === 'race' || r() < 0.12) return; // välillä treeni jää väliin
        const dur = Math.max(15, round(x.d * (0.9 + r() * 0.2), 5));
        const e = { id: `demo-${k}-${i}`, date: k, sport: x.s, dur, dist: null, hr: null, rpe: null, title: x.t, note: '', sets: null, details: null, created_at: `${k}T17:00:00Z` };
        if (x.s === 'run') { e.dist = x.k || Math.round(dur / 6.3 * 10) / 10; e.hr = x.q ? 152 + Math.round(r() * 6) : 132 + Math.round(r() * 8); e.rpe = x.q ? 7 : 4; }
        else if (x.s === 'swim') { e.dist = Math.round(dur * 0.04 * 10) / 10; e.hr = 128 + Math.round(r() * 8); e.rpe = 4; }
        else if (x.s === 'bike') { e.dist = Math.round(dur / 60 * 26); e.hr = 126 + Math.round(r() * 8); e.rpe = 4; }
        else if (x.s === 'str') { e.sets = strengthSets(x, k, r); e.rpe = 7; }
        else { e.rpe = 5; }
        if (r() < 0.35) e.note = NOTES[Math.floor(r() * NOTES.length)];
        rows.push(e);
      });
    }
    // Kaksi viimeisintä juoksua näytetään Stravasta tuotuina, jotta käyrät ja kilometriajat näkyvät
    rows.filter(e => e.sport === 'run').slice(-2).forEach(e => {
      e.id = 'strava-' + e.id;
      e.details = runDetails(e.dist, e.dur, rng(e.id));
    });
    db.entries = rows;
    db.seeded = true;
    saveDb();
  }

  /* ---------- Tekaistu Supabase-kysely ---------- */
  // Tukee vain niitä kutsuja, joita sovellus käyttää: select/order/maybeSingle,
  // insert, update/eq, delete/eq ja upsert onConflict-avaimilla.
  class Query {
    constructor(table) { this.table = table; this.op = 'select'; this.filters = []; }
    select() { return this; }
    order(col, opt) { this.sort = { col, asc: !opt || opt.ascending !== false }; return this; }
    maybeSingle() { this.single = true; return this; }
    insert(rows) { this.op = 'insert'; this.rows = [].concat(rows); return this; }
    update(patch) { this.op = 'update'; this.patch = patch; return this; }
    delete() { this.op = 'delete'; return this; }
    upsert(rows, opt) { this.op = 'upsert'; this.rows = [].concat(rows); this.keys = ((opt && opt.onConflict) || 'id').split(','); return this; }
    eq(col, val) { this.filters.push([col, val]); return this; }
    match(row) { return this.filters.every(([c, v]) => row[c] === v); }
    run() {
      if (this.table === 'entries' && !db.seeded) seed();
      const list = db[this.table] || (db[this.table] = []);
      const now = new Date().toISOString();
      if (this.op === 'select') {
        let data = list.filter(r => this.match(r)).map(r => ({ ...r }));
        if (this.sort) { const { col, asc } = this.sort; data.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1)); }
        return { data: this.single ? data[0] || null : data, error: null };
      }
      if (this.op === 'insert') {
        this.rows.forEach(r => list.push({ created_at: now, ...r }));
      } else if (this.op === 'update') {
        list.forEach((r, i) => { if (this.match(r)) list[i] = { ...r, ...this.patch }; });
      } else if (this.op === 'delete') {
        db[this.table] = list.filter(r => !this.match(r));
      } else if (this.op === 'upsert') {
        this.rows.forEach(row => {
          const i = list.findIndex(r => this.keys.every(c => r[c] === row[c]));
          if (i === -1) list.push({ created_at: now, ...row }); else list[i] = { ...list[i], ...row };
        });
      }
      saveDb();
      return { data: null, error: null };
    }
    then(resolve, reject) { try { resolve(this.run()); } catch (e) { reject(e); } }
  }

  let authListener = null;
  const client = {
    from: table => new Query(table),
    auth: {
      getSession: async () => ({ data: { session: SESSION } }),
      onAuthStateChange: cb => { authListener = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async () => ({ error: null }),
      // Uloskirjautuminen palauttaa demon alkutilaan ja kirjaa heti takaisin sisään
      signOut: async () => {
        resetDb();
        if (authListener) { authListener('SIGNED_OUT', null); authListener('SIGNED_IN', SESSION); }
        return { error: null };
      }
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } })
  };
  window.supabase = { createClient: () => client };

  // Strava-funktiota ei ole demossa: vastataan suoraan ilman verkkoyhteyttä
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opt) => String(url).startsWith(DEMO_URL)
    ? Promise.resolve(new Response(JSON.stringify({ connected: false, error: 'Strava-yhteys ei ole käytössä demossa. Kaksi viimeisintä juoksua on esimerkkejä Stravasta tuoduista suorituksista.' }), { headers: { 'Content-Type': 'application/json' } }))
    : realFetch(url, opt);

  /* ---------- Demopalkki ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.setAttribute('role', 'note');
    bar.innerHTML = '<span><b>Demo</b> · Esimerkkidata, ei kirjautumista. Muutokset tallentuvat vain tähän selaimeen.</span><button type="button">Palauta esimerkkidata</button>';
    bar.querySelector('button').onclick = () => { resetDb(); location.reload(); };
    document.body.prepend(bar);
  });
})();
