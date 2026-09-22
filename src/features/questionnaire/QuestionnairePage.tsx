/**
 * QuestionnairePage — `/questionnaire`, the collector profile questionnaire.
 *
 * Port of the old app's four screens, in its own order and wording:
 *
 *   intro   `qintro()`  app.html:10022-10056 — the eyebrow / title / lede, the
 *                       hairline, the fine print, Begin. (Its three
 *                       Roman-numeral points are built and never rendered
 *                       there — G-Q-2, `questions.ts`.)
 *   step    `qform()`   app.html:10082-10128 — the contact step (0) then one
 *                       question per screen, with the progress bar, "n / N",
 *                       single- vs multi-select, the optional extra field and
 *                       its note, and the free-text step.
 *   review  `qreview()` app.html:10133-10162 — Contact and Your responses as
 *                       summary cards, the "Sent to Darz · date" badge for a
 *                       returning collector, and the two-button footer whose
 *                       labels change once a profile has been sent.
 *   done    `qDone()`   app.html:10166-10181 — the seam, "Thank you", back to
 *                       profile, and a read-only copy of what was sent.
 *
 * The flow itself is `QuestionnaireController`; this file is the view. What is
 * NOT ported, and why, is recorded there — chiefly that the contact step
 * cannot write back to the collector's account record, because this backend
 * has no collector self-update endpoint (G-Q-1).
 *
 * Two of the old screen's trailing actions are deliberately absent, and both
 * are dead ends rather than features: `qSummaryText` / `qSummaryHTML`
 * (:10183-10193) rendered a download/share copy of the answers, and nothing in
 * the shipped app called them — the confirm handler (`:11430`) sends and
 * navigates. Building a download button here would be inventing a control the
 * old app has the code for but does not show.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dropdown } from '../../components';
import { useApi } from '../../api/hooks';
import {
  QuestionnaireController,
  type QuestionnaireSnapshot,
} from './QuestionnaireController';
import { COMM_LANGS, liveIntro } from './questions';
import './questionnaire.css';

export function QuestionnairePage() {
  const { recommendations } = useApi();
  const navigate = useNavigate();
  const [controller] = useState(() => new QuestionnaireController(recommendations));
  const [intro] = useState(liveIntro);

  useEffect(() => {
    void controller.load();
  }, [controller]);

  const state = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );

  // `main.scrollTop = 0` — the last line of every one of the old app's four
  // screens (:10056, :10128, :10162, :10181). Without it the thank-you screen
  // opens scrolled to wherever the review was left, which is what a capture
  // of this flow showed before it was added. `#dzMain` is the app shell's
  // scroller (`AppShell.tsx:165`); the window is a harmless fallback for a
  // layout that ever stops using it.
  useEffect(() => {
    document.getElementById('dzMain')?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [state.stage, state.step]);

  /** `qexit()` — the flow's only way out is back to the profile it was opened
   * from, which is also where the old app's ‹ on step 0 goes. */
  const exit = useCallback(() => navigate('/profile'), [navigate]);
  const back = useCallback(() => {
    if (!controller.back()) exit();
  }, [controller, exit]);

  if (state.status === 'loading') {
    return <p className="dz-state">Loading your profile…</p>;
  }

  switch (state.stage) {
    case 'intro':
      return <Intro intro={intro} onBegin={() => controller.begin()} onExit={exit} />;
    case 'step':
      return <Step controller={controller} state={state} onBack={back} />;
    case 'review':
      return <Review controller={controller} state={state} />;
    case 'done':
      return <Done state={state} onExit={exit} />;
  }
}

/* ---- intro (app.html:10022-10056) ------------------------------------ */

function Intro({
  intro,
  onBegin,
  onExit,
}: {
  intro: ReturnType<typeof liveIntro>;
  onBegin: () => void;
  onExit: () => void;
}) {
  return (
    <div className="qstep">
      <div className="qsbar">
        <a
          className="qsback"
          onClick={onExit}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onExit()}
        >
          ‹
        </a>
        <span className="qstitle">{intro.stitle}</span>
        <span className="qstepn" />
      </div>
      <div className="qintro-body">
        <div className="qintro-eyebrow">{intro.eyebrow}</div>
        {/* The old copy carries a `<br>`; the theme's version may not. A
            `white-space: pre-line` title renders either, without this file
            interpreting owner-supplied text as markup. */}
        <h1 className="qintro-title">{intro.title}</h1>
        <p className="qintro-lede">{intro.lede}</p>
        <div className="qintro-rule" />
        {/* The three Roman-numeral points the old file builds here are dead
            code in it and are deliberately not built — see `questions.ts`
            (G-Q-2) for the reading that establishes that. */}
        <div className="qintro-fine">{intro.fine}</div>
      </div>
      <div className="qfoot">
        <button type="button" className="qcont" onClick={onBegin}>
          {intro.button}&nbsp;&nbsp;&rarr;
        </button>
      </div>
    </div>
  );
}

/* ---- one step (app.html:10082-10128) --------------------------------- */

function Step({
  controller,
  state,
  onBack,
}: {
  controller: QuestionnaireController;
  state: QuestionnaireSnapshot;
  onBack: () => void;
}) {
  const visible = controller.visibleSteps();
  const pos = Math.max(0, visible.indexOf(state.step));
  const segs = visible.length;
  const last = pos === segs - 1;
  const contact = state.step === 0;
  const b = contact ? null : state.bank[state.step - 1];
  const single = !!b && /choose one/i.test(b.hint);

  const headTitle = contact ? 'About you' : (b?.sec ?? '');
  const qTitle = contact ? 'How can Darz reach you?' : (b?.q ?? '');
  const sub = contact
    ? 'Private — used only for Darz advisory & pricelist curation'
    : b?.opts.length
      ? single
        ? 'Choose one'
        : 'Select as many as you like'
      : 'Optional — write a little, or skip';

  return (
    <div className="qstep">
      <div className="qsbar">
        <a
          className="qsback"
          onClick={onBack}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onBack()}
        >
          ‹
        </a>
        <span className="qstitle">Collector profile</span>
        <span className="qstepn">
          {pos + 1} / {segs}
        </span>
      </div>
      <div className="qprog" aria-hidden="true">
        {Array.from({ length: segs }, (_, i) => (
          <span key={i} className={i <= pos ? 'f' : undefined} />
        ))}
      </div>
      <div className="qbody">
        <div className="qeyebrow">{headTitle}</div>
        <h1 className="qbig">{qTitle}</h1>
        <div className="qbigsub">{sub}</div>

        {contact ? (
          <>
            {/* The old form asks only for email and phone — the name is
                dropped there too, because "Darz already knows the collector
                from Admin" (:10092-10093). */}
            <label className="qfld-l" htmlFor="q-email">
              Email
            </label>
            <input
              id="q-email"
              className="qin2"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={state.contact.email}
              onChange={(e) => controller.setContact('email', e.target.value)}
            />
            <label className="qfld-l" htmlFor="q-phone">
              Phone
            </label>
            <input
              id="q-phone"
              className="qin2"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09…"
              value={state.contact.phone}
              onChange={(e) => controller.setContact('phone', e.target.value)}
            />
            <span className="qfld-l">Preferred communication language</span>
            <Dropdown
              label="Preferred communication language"
              placeholder="Select language"
              options={COMM_LANGS.map((l) => ({ value: l, label: l }))}
              value={state.contact.lang}
              onChange={(v) => controller.setContact('lang', v)}
            />
            <div className="qhelp">For WhatsApp communication with Darz.</div>
          </>
        ) : b && b.opts.length > 0 ? (
          <>
            <div className="qopts">
              {b.opts.map((o) => {
                const on = (state.answers[state.step] ?? []).includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    className={`qopt${on ? ' on' : ''}`}
                    aria-pressed={on}
                    onClick={() => controller.pick(state.step, o, single)}
                  >
                    <span className="qopt-l">{o}</span>
                    <span className="qopt-box">✓</span>
                  </button>
                );
              })}
            </div>
            {b.extra && (
              <input
                className="qin2"
                style={{ marginTop: 14, marginBottom: 0 }}
                type="text"
                placeholder={b.extra}
                aria-label={b.extra}
                value={state.extras[state.step] ?? ''}
                onChange={(e) => controller.setExtra(state.step, e.target.value)}
              />
            )}
            {b.note && <div className="qnote">{b.note}</div>}
          </>
        ) : (
          <textarea
            className="qta2"
            rows={4}
            placeholder="Your answer…"
            aria-label={qTitle}
            value={(state.answers[state.step] ?? [])[0] ?? ''}
            onChange={(e) => controller.setText(state.step, e.target.value)}
          />
        )}
      </div>
      <div className="qfoot">
        <button
          type="button"
          className="qcont"
          disabled={!controller.canContinue()}
          onClick={() => controller.next()}
        >
          {last ? 'Review →' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

/* ---- review (app.html:10133-10162) ----------------------------------- */

function Review({
  controller,
  state,
}: {
  controller: QuestionnaireController;
  state: QuestionnaireSnapshot;
}) {
  const sent = state.submitted;
  return (
    <div className="qwrap">
      {/* No ‹ here, deliberately: the old review's head is the title and the
          sub-line only (`head`, :10145). Going back is "Edit answers" at the
          foot, and leaving is the app's own nav — adding a third control
          would be inventing one. */}
      <div className="qhead">
        <div className="qttl">{sent ? 'Your profile' : 'Review & send'}</div>
        <div className="qsub">
          {sent
            ? 'Already sent to Darz — you can update it anytime.'
            : 'A last glance before it reaches Darz.'}
        </div>
      </div>

      {sent && (
        <div className="qsent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M7.4 12.4 L10.8 15.8 L17 8"
              stroke="var(--ink)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Sent to Darz{formatSentDate(state.submittedAt)}</span>
        </div>
      )}

      <div className="qsum-h">Contact</div>
      <div className="qsum-card">
        <SumRow q="Email" a={state.contact.email || '—'} />
        <SumRow q="Phone" a={state.contact.phone || '—'} />
        <SumRow q="Communication language" a={state.contact.lang || '—'} />
      </div>

      <div className="qsum-h">Your responses</div>
      <div className="qsum-card">
        <Responses controller={controller} state={state} blank="—" />
      </div>

      {state.error && (
        <p className="dz-state err" role="alert">
          {state.error}
        </p>
      )}

      <div className="qrev-acts">
        {sent ? (
          <>
            <Button
              className="qrev-btn"
              disabled={state.status === 'saving'}
              onClick={() => controller.edit()}
            >
              Update answers
            </Button>
            <Button
              variant="outline"
              className="qrev-btn"
              disabled={state.status === 'saving'}
              onClick={() => void controller.submit()}
            >
              {state.status === 'saving' ? 'Sending…' : 'Resend to Darz'}
            </Button>
          </>
        ) : (
          <>
            <Button
              className="qrev-btn"
              disabled={state.status === 'saving'}
              onClick={() => void controller.submit()}
            >
              {state.status === 'saving' ? 'Sending…' : 'Confirm & send'}
            </Button>
            <Button
              variant="outline"
              className="qrev-btn"
              disabled={state.status === 'saving'}
              onClick={() => controller.edit()}
            >
              Edit answers
            </Button>
          </>
        )}
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}

/* ---- done (app.html:10166-10181) ------------------------------------- */

function Done({ state, onExit }: { state: QuestionnaireSnapshot; onExit: () => void }) {
  return (
    <div className="qwrap">
      <div className="qdone-top">
        <div className="qdone-seam" />
        <div className="qeyebrow">Sent to Darz</div>
        <h1 className="qdone-h">Thank you</h1>
        <p className="qdone-p">
          Your answers have been sent to Darz. They help us understand you better and serve you
          with more relevant selections, insights, and opportunities.
        </p>
      </div>
      <Button block style={{ marginTop: 22 }} onClick={onExit}>
        ← Back to profile
      </Button>
      <div className="qsum-h">Your responses</div>
      <div className="qsum-card">
        <SumRow q="Email" a={state.contact.email || '—'} />
        <SumRow q="Phone" a={state.contact.phone || '—'} />
        {state.contact.lang && <SumRow q="Communication language" a={state.contact.lang} />}
      </div>
      <div className="qsum-card">
        {/* The done screen drops unanswered rows entirely (`if(!v)return ''`,
            :10167) where the review shows them as "—". */}
        <Responses state={state} blank="" />
      </div>
      <div style={{ height: 32 }} />
    </div>
  );
}

/* ---- shared pieces ---------------------------------------------------- */

function SumRow({ q, a }: { q: string; a: string }) {
  return (
    <div className="qsum-row">
      <div className="qsum-q">{q}</div>
      <div className="qsum-a">{a}</div>
    </div>
  );
}

/** The bank's answers as summary rows. `blank` is what an unanswered question
 * shows — "—" on the review, nothing at all on the done screen, which is the
 * one difference between the two lists in the old app. */
function Responses({
  controller,
  state,
  blank,
}: {
  controller?: QuestionnaireController;
  state: QuestionnaireSnapshot;
  blank: string;
}) {
  const rows = state.bank
    .map((b, i) => {
      const n = i + 1;
      if (controller?.isHidden(n)) return null;
      const picked = (state.answers[n] ?? []).join(' · ');
      const extra = b.extra ? (state.extras[n] ?? '').trim() : '';
      let v = picked || blank;
      if (extra) v = (picked ? `${picked} · ` : '') + `${b.extra}: ${extra}`;
      if (!v) return null;
      return <SumRow key={b.q} q={b.q} a={v} />;
    })
    .filter(Boolean);
  return rows.length > 0 ? <>{rows}</> : <div className="qsum-empty">—</div>;
}

/** " · 12 Sep 2026", or "" when the server sent no timestamp or an unusable
 * one — the badge still reads correctly without a date (`:10149`). */
function formatSentDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return ` · ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
