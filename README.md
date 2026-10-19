# Norseman 2030 – demo

**Live demo:** https://jehkis.github.io/norseman-demo/

A no-login demo of the Norseman 2030 training diary, a Finnish-language PWA that plans and logs training from a first marathon all the way to the Norseman Xtreme Triathlon in 2030.

The real app lives in [norseman-diary/norseman](https://github.com/norseman-diary/norseman) and stores data in Supabase behind a login. This demo runs the same app code with the backend swapped out:

- No login: the app opens straight to sample data generated from the app's own training plan (the last few weeks, strength sets with progressing weights, and two runs with Strava-style splits and heart-rate/pace charts).
- Everything works: logging, editing, moving and swapping workouts, settings. Changes are saved only in your own browser (`localStorage`).
- **Palauta esimerkkidata** in the top bar (or logging out) resets the demo.
- Strava sync is disabled and no network calls go to Supabase or Strava.

## How it works

`demo.js` loads in place of the Supabase client library and defines `window.supabase.createClient()` returning a small fake client. It implements the queries the app uses (`select`, `insert`, `update`, `delete`, `upsert`) against `localStorage`, plus a fake session, so the app code itself is unchanged.

`build.sh` fetches the latest `index.html`, manifest and icons from the official repo, swaps the Supabase script tag for `demo.js`, removes the real project URL and key, and adds the demo bar. To update the demo after the app changes:

```bash
./build.sh
git commit -am "Update demo from the official app"
git push
```
