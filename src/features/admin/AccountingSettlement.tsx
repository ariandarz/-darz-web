/**
 * AccountingSettlement — `/admin/accounting?view=settlement`, the ownership
 * settlement worksheet's **storage**: read it, save it (which snapshots the
 * previous state as a version), and read the snapshots back.
 *
 * ## What this is, and what it deliberately is not
 *
 * The old worksheet is `settlement.html` — a 1,162-line bilingual calculator
 * (costs by year, unpaid salary, partner contributions, per-year inflation and
 * interest adjustment, a live final figure) that the panel embedded in an
 * iframe. It kept its state in **one device-local blob**, `darz_settlement_v1`,
 * and reached other devices only by riding along inside the admin's private
 * cloud snapshot (`settlement.html:979`).
 *
 * Backend Phase 17 moved the blob to the server: one owner-only record whose
 * `state` is freeform JSON, versioned on every save. **That move is what this
 * screen delivers** — the figures stop living on whichever laptop last typed
 * them.
 *
 * **The calculator itself is not ported here.** Rebuilding it means porting
 * that page's arithmetic — the year table, the share splits, the adjustment
 * ladders — and getting any of it subtly wrong would produce a confident wrong
 * number about who owes whom. That is its own piece of work with its own
 * review, not a sub-tab of "finish Accounting". So this screen is honest about
 * being the state editor, and says where the calculator is.
 *
 * ## Why a JSON editor is the right minimal surface
 *
 * `state` has no schema on either side — the model's own docstring says so, and
 * the old blob's shape is whatever `serialize()` happened to build. Inventing a
 * form would mean inventing a schema and silently dropping every key it did not
 * know. A text editor over formatted JSON keeps every key, and makes the real
 * migration possible today: paste the existing `darz_settlement_v1` in, save,
 * and the worksheet is on the server with a version history.
 *
 * ## The version list
 *
 * `GET /settlement/versions/` is read-only — there is no activate endpoint (App
 * Design has one; this does not). So "Restore" loads a snapshot **into the
 * editor** and leaves saving to the person, which is also the safer reading: it
 * cannot overwrite the live worksheet with one click.
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { SettlementWorksheet, SettlementWorksheetVersion } from '../../api/types';
import { parseState, pretty, sizeOf } from './settlementState';
import { ConfirmDialog, DeskBanner } from './kit';
import './admin.css';

export function AccountingSettlement() {
  const { accountingAdmin } = useApi();

  const [sheet, setSheet] = useState<SettlementWorksheet | null>(null);
  const [versions, setVersions] = useState<SettlementWorksheetVersion[] | null>(null);
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const loadVersions = useCallback(() => {
    accountingAdmin.settlementVersions({ per_page: 25 }).then(
      (page) => setVersions(page.results),
      () => setVersions([]), // the worksheet still works without its history
    );
  }, [accountingAdmin]);

  useEffect(() => {
    accountingAdmin.settlement().then(
      (w) => {
        setSheet(w);
        setText(pretty(w.state));
        setDirty(false);
      },
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the worksheet.'),
    );
    loadVersions();
  }, [accountingAdmin, loadVersions]);

  /** Parsed, or the reason it will not parse — computed on every keystroke so
   * Save can be disabled rather than failing at the server. */
  const parsed = parseState(text);

  const save = async () => {
    if (busy || !parsed.ok) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await accountingAdmin.saveSettlement(parsed.value);
      setSheet(updated);
      setText(pretty(updated.state));
      setDirty(false);
      setNotice('Saved. The previous state is now in the version list.');
      loadVersions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the worksheet.');
    } finally {
      setBusy(false);
    }
  };

  const restore = (v: SettlementWorksheetVersion) => {
    setText(pretty(v.state));
    setDirty(true);
    setNotice('Loaded into the editor — nothing is saved until you press Save.');
  };

  if (error && !sheet) return <DeskBanner>{error}</DeskBanner>;
  if (!sheet) return <p className="dz-state">Loading…</p>;

  return (
    <>
      <p className="ad-deskintro">
        The ownership-settlement worksheet, on the server rather than on one laptop — saved
        with a version each time, and readable by the owner from any device.
      </p>

      <div className="ad-noteblock">
        <p>
          This is the worksheet's <strong>state</strong>, not the calculator. The old sheet's
          year tables, share splits and inflation ladders are not ported — porting that
          arithmetic wrongly would produce a confident wrong figure about who owes whom, so it
          is its own piece of work. What you can do here is keep the figures safely, move the
          old <code>darz_settlement_v1</code> blob onto the server by pasting it in, and read
          any earlier save back.
        </p>
      </div>

      {error && <DeskBanner>{error}</DeskBanner>}
      {notice && <p className="ad-deskintro">{notice}</p>}

      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">{sheet.title}</h2>
          <span className="ad-dsec-n">
            version {sheet.version} · saved{' '}
            {new Date(sheet.updated_at).toLocaleString('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        </div>

        <textarea
          className="ad-jsonedit"
          spellCheck={false}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
            setNotice(null);
          }}
          aria-label="Worksheet state, as JSON"
        />

        <div className="ad-rowacts ad-deskacts">
          <button
            type="button"
            className="ad-action"
            disabled={busy || !parsed.ok || !dirty}
            onClick={() => setConfirming(true)}
          >
            Save
          </button>
          {!parsed.ok && <span className="ad-cellsub ad-jsonerr">{parsed.error}</span>}
          {parsed.ok && !dirty && <span className="ad-cellsub">No unsaved changes.</span>}
        </div>
      </section>

      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">Earlier saves</h2>
          <span className="ad-dsec-n">
            one per save, newest first — restoring loads it into the editor, it does not
            publish
          </span>
        </div>

        {!versions && <p className="dz-state">Loading…</p>}
        {versions && versions.length === 0 && (
          <p className="dz-state">No earlier saves yet — the first Save starts the history.</p>
        )}
        {versions && versions.length > 0 && (
          <ul className="ad-grantlist">
            {versions.map((v) => (
              <li key={v.id} className="ad-grantrow">
                <span className="ad-cellmain">
                  {new Date(v.created_at).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
                <span className="ad-cellsub">{sizeOf(v.state)}</span>
                <button type="button" className="ad-rowbtn" onClick={() => restore(v)}>
                  Restore into the editor
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirming && (
        <ConfirmDialog
          message="Save the worksheet? The state currently on the server is snapshotted as a version first, so this is reversible."
          okLabel="Save"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void save();
          }}
        />
      )}
    </>
  );
}
