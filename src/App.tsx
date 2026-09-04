/**
 * Phase 2 deliverable — the design-system showcase.
 *
 * Not a product screen. It renders every token group and every base component
 * so the port can be eyeballed against the shipped `app.html`, and exercises
 * the Paper ⇄ Black theme engine. Real collector screens arrive from Phase 3+.
 */
import { useSyncExternalStore, useState, type ReactNode } from 'react';
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardImage,
  Chroma,
  Eyebrow,
  Input,
  Pill,
  Sheet,
  Textarea,
  Toast,
  Wordmark,
} from './components';
import { useApi, useSession } from './api/hooks';
import { themeController, tokens } from './design';

function useTheme() {
  return useSyncExternalStore(
    (cb) => themeController.subscribe(cb),
    () => themeController.theme,
  );
}

const swatches: Array<[string, string]> = [
  ['--bg', 'page'],
  ['--paper', 'paper'],
  ['--card', 'card'],
  ['--soft', 'soft'],
  ['--ink', 'ink'],
  ['--ink2', 'ink-2'],
  ['--ink3', 'ink-3'],
  ['--hair', 'hair'],
  ['--cyan', 'cyan'],
  ['--magenta', 'magenta'],
  ['--accent', 'accent-red'],
];

export default function App() {
  const theme = useTheme();
  const [chips, setChips] = useState<Set<string>>(new Set(['Painting']));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  const toggleChip = (c: string) =>
    setChips((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 80px' }}>
      <Chroma />
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 0 24px',
        }}
      >
        <Wordmark suffix=".art" />
        <Button variant="outline" onClick={() => themeController.toggle()}>
          {theme.isDark() ? 'Paper' : 'Black'} mode
        </Button>
      </header>

      <Eyebrow>Darz Market · design system</Eyebrow>
      <h1
        style={{
          fontFamily: 'var(--font-head)',
          fontWeight: 600,
          fontSize: 'var(--f-hero)',
          letterSpacing: '-.02em',
          lineHeight: 0.98,
          margin: '8px 0 6px',
        }}
      >
        Tokens &amp; base components
      </h1>
      <p style={{ color: 'var(--ink2)', fontSize: 14, lineHeight: 1.6, maxWidth: 460 }}>
        Ported verbatim from the shipped collector app. Active theme:{' '}
        <strong>{theme.label}</strong>.
      </p>

      <Section title="Palette">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
            gap: 10,
          }}
        >
          {swatches.map(([varName, label]) => (
            <div key={varName}>
              <div
                style={{
                  height: 56,
                  borderRadius: 10,
                  border: '1px solid var(--hair)',
                  background: `var(${varName})`,
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 5 }}>{label}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The chroma">
        <Chroma />
        <div style={{ height: 10 }} />
        <Chroma direction="v" style={{ width: 2, height: 60 }} />
      </Section>

      <Section title="Typography">
        <p style={{ fontFamily: tokens.typography.head, fontSize: 30, fontWeight: 600 }}>
          Cormorant Garamond — display
        </p>
        <p style={{ fontFamily: tokens.typography.head, fontStyle: 'italic', fontSize: 18 }}>
          Editorial italic — the reading voice
        </p>
        <p style={{ fontFamily: tokens.typography.sans, fontSize: 13.5 }}>
          Barlow — UI sans for buttons, labels, meta
        </p>
        <p style={{ fontFamily: tokens.typography.mono, fontSize: 13 }}>
          Space Mono — 120 × 150 cm · 2021
        </p>
      </Section>

      <Section title="Buttons">
        <Row>
          <Button variant="primary">Place a bid</Button>
          <Button variant="outline">Save</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Remove</Button>
          <Button variant="primary" disabled>
            Unavailable
          </Button>
        </Row>
        <div style={{ marginTop: 12, maxWidth: 360 }}>
          <Button variant="act-primary">Buy now</Button>
        </div>
      </Section>

      <Section title="Fields">
        <Input label="Full name" name="name" placeholder="Your name" defaultValue="" />
        <Input
          label="Email"
          name="email"
          type="email"
          error="Enter a valid email address."
          defaultValue="not-an-email"
        />
        <Textarea
          label="Message"
          name="msg"
          hint="A note to the gallery — plain and specific."
        />
      </Section>

      <Section title="Pills">
        <Row>
          {['Painting', 'Works on paper', 'Sculpture', 'Photography'].map((c) => (
            <Pill key={c} selected={chips.has(c)} onClick={() => toggleChip(c)}>
              {c}
            </Pill>
          ))}
        </Row>
      </Section>

      <Section title="Avatars">
        <Row>
          <Avatar name="Parviz Tanavoli" size="sm" />
          <Avatar name="Monir Farmanfarmaian" size="md" />
          <Avatar name="Charles Hossein Zenderoudi" size="lg" />
        </Row>
      </Section>

      <Section title="Card">
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, maxWidth: 420 }}
        >
          <Card interactive>
            <CardImage />
            <CardBody>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 13 }}>
                Untitled
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-head)',
                  fontStyle: 'italic',
                  fontSize: 11,
                  color: 'var(--ink2)',
                }}
              >
                oil on canvas, 2021
              </div>
            </CardBody>
          </Card>
          <Card feature interactive>
            <CardImage />
            <CardBody>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 13 }}>
                Feature card
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)' }}>chroma top bar</div>
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section title="Overlays">
        <Row>
          <Button variant="outline" onClick={() => setSheetOpen(true)}>
            Open sheet
          </Button>
          <Button variant="outline" onClick={() => setToastOpen(true)}>
            Show toast
          </Button>
        </Row>
      </Section>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        seam
        title="Make an offer"
        subtitle="The gallery will see your offer and reply."
      >
        <Input label="Your offer (USD)" name="offer" inputMode="numeric" placeholder="0" />
        <Button variant="primary" block onClick={() => setSheetOpen(false)}>
          Send offer
        </Button>
      </Sheet>

      <Section title="API / session">
        <ApiPanel />
      </Section>

      <Toast message="Saved." open={toastOpen} onClose={() => setToastOpen(false)} />
    </div>
  );
}

/** Phase 3 wiring check — exercises the real OOP client against the running
 * backend: options fetch, collector access-key login, /me, logout. */
function ApiPanel() {
  const api = useApi();
  const { isAuthenticated, principal, me } = useSession();
  const [accessKey, setAccessKey] = useState('');
  const [note, setNote] = useState<string>('');
  const [optionCount, setOptionCount] = useState<number | null>(null);

  const run = (label: string, p: Promise<unknown>) => {
    setNote(`${label}…`);
    p.then(
      () => setNote(`${label} ✓`),
      (err: unknown) => setNote(`${label} ✗ ${(err as Error).message}`),
    );
  };

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
      <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
        {isAuthenticated ? (
          <>
            Signed in as <strong>{me?.display_name ?? me?.email ?? principal}</strong>
            {me?.tier ? ` · ${me.tier}` : ''}
          </>
        ) : (
          'Not signed in.'
        )}
      </div>

      <Row>
        <Button
          variant="outline"
          onClick={() =>
            run(
              'options',
              api.options.all().then((o) => setOptionCount(Object.keys(o).length)),
            )
          }
        >
          Fetch options{optionCount !== null ? ` (${optionCount})` : ''}
        </Button>
        {isAuthenticated ? (
          <Button variant="outline" onClick={() => run('logout', api.auth.logout())}>
            Log out
          </Button>
        ) : null}
      </Row>

      {!isAuthenticated && (
        <Row>
          <Input
            name="accessKey"
            placeholder="Collector access key"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
          />
          <Button
            variant="primary"
            onClick={() => run('login', api.auth.loginCollector(accessKey))}
          >
            Sign in
          </Button>
        </Row>
      )}

      {note && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{note}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 34 }}>
      <Eyebrow style={{ marginBottom: 12 }}>{title}</Eyebrow>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      {children}
    </div>
  );
}
