/**
 * DesignPage — `/admin/design`, App Design (`designView()`,
 * `darz-studio.html:30426`), reached from **two** groups (Market App and
 * Operations, `:11730`/`:11764`) — one screen, two entry points, as shipped.
 *
 * This build is the **owner's control of the collector app**: the switches the
 * old desk kept in the theme blob (`theme.navOff` per-section hiding,
 * `theme.detailBtns`, `theme.showQ`, `theme.chatAI`, `theme.storiesShow`) are
 * this codebase's one typed `FeatureFlags` table, so the desk edits exactly
 * that table and publishes it as `theme.features`. The Market App reads it
 * back on boot (`ApiProvider`), before first paint. Flip a switch, Save,
 * reload the app — no deploy.
 *
 * The two buttons are the old desk's own two, kept distinct on purpose:
 * **Save** publishes immediately (the server overwrites the theme object —
 * its wording), **Save version** cuts an explicit named checkpoint. Versions
 * list with Activate ("try it, revert it") and Delete; **Reset** clears to
 * factory — the build-time `VITE_FEATURE_SET` floor.
 *
 * **Not built here, deliberately** (the rest of `designView` — fonts, colour
 * pickers, ranges, per-page button rows, the publish-editions card): every one
 * of those keys writes into the same freeform `theme`, but nothing in the
 * collector app *reads* them yet, and an editor for keys with no consumer is a
 * lie about what Save does. They land with their consumers (§4's `theme.copy`
 * / `contact` / `social`, D17). Until then the desk shows every other stored
 * key read-only, so nothing in the theme is hidden from the person editing it.
 *
 * `market` has no switch — the catalogue is the app
 * (`resolveFeatureFlags` refuses it too, so a hand-edited theme cannot turn
 * it off either).
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { AppTheme, AppThemeVersion } from '../../api/types';
import {
  FEATURE_SET,
  features as liveFeatures,
  resolveFeatureFlags,
  type FeatureFlags,
} from '../shell/features';
import { ConfirmDialog, DeskAction, DeskBanner, DeskPage } from './kit';
import './admin.css';

/** On-screen names for the switches — UI copy, not domain data. */
const FLAG_LABELS: Partial<Record<keyof FeatureFlags, [string, string]>> = {
  records: ['Records', 'External auction-house results per artist'],
  chat: ['Chat', 'The collector ↔ Darz conversation'],
  profile: ['Profile', 'Saved works, inquiries, activity, account'],
  settings: ['Settings', 'The collector settings screen'],
  sendInquiry: ['Send inquiry', 'The one v0.1 contact CTA on the artwork detail'],
  commerceActions: [
    'Commerce actions',
    'Buy now · 24h hold · Request viewing · Make an offer · Request price',
  ],
  save: ['Save', 'Save / unsave a work'],
  auctions: ['Auctions', 'Events, lots, bidding, registration, notifications'],
  profileAuctions: ['Profile › Auctions', 'Registrations and standings on the profile'],
  questionnaire: ['Questionnaire', 'The collector questionnaire'],
  aiChat: ['Ask Darz AI', 'The AI chat mode'],
  galleryChat: ['Gallery chat', 'Collector ↔ gallery conversations'],
  stories: ['Insights & Stories', 'The editorial section'],
  recommendations: ['Curated for you', 'Recommendation surfaces'],
  membership: ['Membership', 'Membership display and redemption'],
  push: ['Web push', 'Push notification opt-in'],
  adminDesk: ['Admin desk', 'The /admin panel itself (route gate)'],
};

export function DesignPage() {
  const { theme } = useApi();

  const [serverTheme, setServerTheme] = useState<AppTheme | null>(null);
  const [draft, setDraft] = useState<FeatureFlags | null>(null);
  const [versions, setVersions] = useState<AppThemeVersion[]>([]);
  const [versionName, setVersionName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<null | {
    message: string;
    ok: string;
    run: () => Promise<void>;
  }>(null);

  const load = useCallback(() => {
    theme.adminTheme().then(
      (t) => {
        setServerTheme(t);
        // the draft opens on what is LIVE: build-time set + the stored switches
        setDraft(
          resolveFeatureFlags(
            { ...liveFeatures },
            (t.theme as Record<string, unknown> | null)?.features,
          ),
        );
      },
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the theme.'),
    );
    theme.versions({ per_page: 50 }).then(
      (page) => setVersions(page.results),
      () => {},
    );
  }, [theme]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      load();
      setNotice(done);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The action failed.');
    } finally {
      setBusy(false);
    }
  };

  // Save publishes the whole object, so every key that is not ours passes
  // through untouched — the server's PUT overwrites, the merge is our job.
  const save = () =>
    run(async () => {
      const rest = (serverTheme?.theme as Record<string, unknown> | null) ?? {};
      const { market: _market, ...switches } = draft!;
      await theme.publish({ ...rest, features: switches });
    }, 'Theme published — the app reads it on its next load.');

  const saveVersion = () =>
    run(async () => {
      const name = versionName.trim() || new Date().toLocaleString('en-GB');
      await theme.saveVersion(name);
      setVersionName('');
    }, 'Version saved.');

  const otherKeys = Object.entries(
    ((serverTheme?.theme as Record<string, unknown> | null) ?? {}) as Record<string, unknown>,
  ).filter(([k]) => k !== 'features');

  return (
    <DeskPage
      title="App Design"
      action={
        <DeskAction onClick={() => void save()} disabled={busy || !draft}>
          Save
        </DeskAction>
      }
      subtitle={
        <>
          What the collector app shows. Changes publish immediately on Save; the build-time
          floor is <b>{FEATURE_SET}</b>, and a failed read of this theme falls back to it.
        </>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}
      {notice && <p className="ad-sent">{notice}</p>}
      {!draft && !error && <p className="dz-state">Loading…</p>}

      {draft && (
        <section className="ad-dsec">
          <div className="ad-dsec-h">
            <h2 className="ad-dsec-t">Features</h2>
            <span className="ad-dsec-n">the Market App reads these on every load</span>
          </div>
          <div className="ad-card ad-switches">
            {(Object.keys(FLAG_LABELS) as Array<keyof FeatureFlags>).map((key) => {
              const [name, desc] = FLAG_LABELS[key]!;
              const on = Boolean(draft[key]);
              return (
                <label key={key} className="ad-switch">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
                  />
                  <span className="ad-switch-t">
                    <span className="ad-cellmain">{name}</span>
                    <span className="ad-cellsub">{desc}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">Versions</h2>
          <span className="ad-dsec-n">
            an explicit checkpoint — Save publishes, Save version remembers
          </span>
        </div>
        <div className="ad-verrow">
          <input
            className="ad-verin"
            placeholder="Version name…"
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
          />
          <button
            type="button"
            className="ad-ghostbtn"
            disabled={busy}
            onClick={() => void saveVersion()}
          >
            Save version
          </button>
          <button
            type="button"
            className="ad-ghostbtn is-danger"
            disabled={busy}
            onClick={() =>
              setConfirming({
                message:
                  'Reset the theme to factory defaults? The app falls back to the build-time feature set.',
                ok: 'Reset',
                run: async () => {
                  await theme.reset();
                },
              })
            }
          >
            Reset
          </button>
        </div>
        {versions.length === 0 && <p className="dz-state">No versions saved yet.</p>}
        {versions.length > 0 && (
          <div className="ad-card ad-logins">
            {versions.map((v) => (
              <div key={v.id} className="ad-recrow">
                <span className="ad-recv">
                  <b>{v.name}</b>
                  <span className="ad-cellsub">
                    {new Date(v.created_at).toLocaleString('en-GB')}
                    {v.created_by?.name ? ` · ${v.created_by.name}` : ''}
                  </span>
                </span>
                <span className="ad-keyacts">
                  <button
                    type="button"
                    className="ad-rowbtn"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await theme.activateVersion(v.id);
                      }, `“${v.name}” is live.`)
                    }
                  >
                    Activate
                  </button>
                  <button
                    type="button"
                    className="ad-rowbtn is-danger"
                    disabled={busy}
                    onClick={() =>
                      setConfirming({
                        message: `Delete the version “${v.name}”? This cannot be undone.`,
                        ok: 'Delete',
                        run: async () => {
                          await theme.deleteVersion(v.id);
                        },
                      })
                    }
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {otherKeys.length > 0 && (
        <section className="ad-dsec">
          <div className="ad-dsec-h">
            <h2 className="ad-dsec-t">Also stored</h2>
            <span className="ad-dsec-n">
              keys this desk does not edit yet — they pass through Save untouched
            </span>
          </div>
          <div className="ad-card ad-record">
            {otherKeys.map(([k, v]) => (
              <div key={k} className="ad-recrow">
                <span className="ad-reck">{k}</span>
                <span className="ad-recv">
                  <code>{JSON.stringify(v)}</code>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {confirming && (
        <ConfirmDialog
          message={confirming.message}
          okLabel={confirming.ok}
          danger
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const c = confirming;
            setConfirming(null);
            void run(c.run, 'Done.');
          }}
        />
      )}
    </DeskPage>
  );
}
