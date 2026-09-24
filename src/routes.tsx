/**
 * Route table. The Phase 2 design-system showcase lives at `/_design`; the
 * catalogue is the real app.
 *
 * Every collector route sits behind one layout route: `RequireAuth` (the API's
 * default permission is `IsAuthenticated`) wrapping the session-scoped
 * providers — `SavedProvider` (Phase 6), `RequestProvider` (Phase 5),
 * `ConversationsProvider` (v0.1: inquiries + chat threads) and, only when the
 * feature is on, `AuctionNotificationsProvider` (Phase 8) — and the `AppShell`
 * that renders the one nav bar. The providers are inside the guard because
 * their endpoints need a session to answer at all.
 *
 * v0.1 visibility (`features/shell/features.ts`): a hidden feature's routes
 * stay registered but redirect to Market, so a deep link, a bookmark or a
 * typed URL cannot reach it — the old app's `render()` guard (app.html:5673).
 */
import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import App from './App';
import { useSession } from './api/hooks';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { RequireTeam } from './features/auth/RequireTeam';
import { ArtistDetailPage } from './features/catalogue/ArtistDetailPage';
import { ArtistListPage } from './features/catalogue/ArtistListPage';
import { ArtworkCacheProvider } from './features/catalogue/ArtworkCacheProvider';
import { ArtworkDetailPage } from './features/catalogue/ArtworkDetailPage';
import { CataloguePage } from './features/catalogue/CataloguePage';
// The admin panel is 41% of the app and no collector loads it, so every admin
// page (and the team-login gate) is code-split with `React.lazy`: the pages
// leave the main bundle and download only when a team session opens `/admin`.
// The route table below is unchanged — only HOW these components arrive is —
// so paths and structure stay byte-for-byte identical. Each `.then` maps the
// module's named export onto `lazy`'s expected `{ default }`. The `<Suspense>`
// that catches them is inside `AdminShell` (around its `<Outlet/>`); the one
// eager path, `/admin/login`, carries its own inline `<Suspense>` below.
const TeamLoginPage = lazy(() =>
  import('./features/auth/TeamLoginPage').then((m) => ({ default: m.TeamLoginPage })),
);
const AdminRequestsPage = lazy(() =>
  import('./features/admin/AdminRequestsPage').then((m) => ({ default: m.AdminRequestsPage })),
);
const ArtistsPage = lazy(() =>
  import('./features/admin/ArtistsPage').then((m) => ({ default: m.ArtistsPage })),
);
const AuctionAdminDetailPage = lazy(() =>
  import('./features/admin/AuctionAdminDetailPage').then((m) => ({
    default: m.AuctionAdminDetailPage,
  })),
);
const AccountingPage = lazy(() =>
  import('./features/admin/AccountingPage').then((m) => ({ default: m.AccountingPage })),
);
const DealEditorPage = lazy(() =>
  import('./features/admin/DealEditorPage').then((m) => ({ default: m.DealEditorPage })),
);
const LedgerEntryPage = lazy(() =>
  import('./features/admin/LedgerEntryPage').then((m) => ({ default: m.LedgerEntryPage })),
);
const AuctionsAdminPage = lazy(() =>
  import('./features/admin/AuctionsAdminPage').then((m) => ({ default: m.AuctionsAdminPage })),
);
const RegistrationsPage = lazy(() =>
  import('./features/admin/RegistrationsPage').then((m) => ({ default: m.RegistrationsPage })),
);
const RecordEditorPage = lazy(() =>
  import('./features/admin/RecordEditorPage').then((m) => ({ default: m.RecordEditorPage })),
);
const RecordsAdminPage = lazy(() =>
  import('./features/admin/RecordsAdminPage').then((m) => ({ default: m.RecordsAdminPage })),
);
const DocumentDetailPage = lazy(() =>
  import('./features/admin/DocumentDetailPage').then((m) => ({
    default: m.DocumentDetailPage,
  })),
);
const DocumentsPage = lazy(() =>
  import('./features/admin/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
const PublishedPage = lazy(() =>
  import('./features/admin/PublishedPage').then((m) => ({ default: m.PublishedPage })),
);
const SaleDetailPage = lazy(() =>
  import('./features/admin/SaleDetailPage').then((m) => ({ default: m.SaleDetailPage })),
);
const SourceDetailPage = lazy(() =>
  import('./features/admin/SourceDetailPage').then((m) => ({ default: m.SourceDetailPage })),
);
const ExhibitionComposePage = lazy(() =>
  import('./features/admin/ExhibitionComposePage').then((m) => ({
    default: m.ExhibitionComposePage,
  })),
);
const ExhibitionServicesPage = lazy(() =>
  import('./features/admin/exhibitions/ExhibitionServicesPage').then((m) => ({
    default: m.ExhibitionServicesPage,
  })),
);
const IssueDocumentPage = lazy(() =>
  import('./features/admin/exhibitions/IssueDocumentPage').then((m) => ({
    default: m.IssueDocumentPage,
  })),
);
const SourcesPage = lazy(() =>
  import('./features/admin/SourcesPage').then((m) => ({ default: m.SourcesPage })),
);
const SalesPage = lazy(() =>
  import('./features/admin/SalesPage').then((m) => ({ default: m.SalesPage })),
);
const ArtworkEditorPage = lazy(() =>
  import('./features/admin/ArtworkEditorPage').then((m) => ({ default: m.ArtworkEditorPage })),
);
const ArtworksPage = lazy(() =>
  import('./features/admin/ArtworksPage').then((m) => ({ default: m.ArtworksPage })),
);
const AccessRequestsPage = lazy(() =>
  import('./features/admin/AccessRequestsPage').then((m) => ({
    default: m.AccessRequestsPage,
  })),
);
const AdminChatPage = lazy(() =>
  import('./features/admin/AdminChatPage').then((m) => ({ default: m.AdminChatPage })),
);
const CollectorDetailPage = lazy(() =>
  import('./features/admin/CollectorDetailPage').then((m) => ({
    default: m.CollectorDetailPage,
  })),
);
const CollectorsPage = lazy(() =>
  import('./features/admin/CollectorsPage').then((m) => ({ default: m.CollectorsPage })),
);
const ClubPage = lazy(() =>
  import('./features/admin/ClubPage').then((m) => ({ default: m.ClubPage })),
);
const DesignPage = lazy(() =>
  import('./features/admin/DesignPage').then((m) => ({ default: m.DesignPage })),
);
const DataHealthPage = lazy(() =>
  import('./features/admin/DataHealthPage').then((m) => ({ default: m.DataHealthPage })),
);
const ImportBatchPage = lazy(() =>
  import('./features/admin/ImportBatchPage').then((m) => ({ default: m.ImportBatchPage })),
);
const ImportPage = lazy(() =>
  import('./features/admin/ImportPage').then((m) => ({ default: m.ImportPage })),
);
const MembershipsPage = lazy(() =>
  import('./features/admin/MembershipsPage').then((m) => ({ default: m.MembershipsPage })),
);
const TeamPage = lazy(() =>
  import('./features/admin/TeamPage').then((m) => ({ default: m.TeamPage })),
);
const AdminSettingsPage = lazy(() =>
  import('./features/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const ProjectsDashboardPage = lazy(() =>
  import('./features/admin/projects/ProjectsDashboardPage').then((m) => ({
    default: m.ProjectsDashboardPage,
  })),
);
const ProjectsListPage = lazy(() =>
  import('./features/admin/projects/ProjectsListPage').then((m) => ({
    default: m.ProjectsListPage,
  })),
);
const NewProjectPage = lazy(() =>
  import('./features/admin/projects/NewProjectPage').then((m) => ({
    default: m.NewProjectPage,
  })),
);
const ProjectPage = lazy(() =>
  import('./features/admin/projects/ProjectPage').then((m) => ({ default: m.ProjectPage })),
);
const ProjectReportPage = lazy(() =>
  import('./features/admin/projects/ProjectReportPage').then((m) => ({
    default: m.ProjectReportPage,
  })),
);
const ProjectPipelinePage = lazy(() =>
  import('./features/admin/projects/ProjectPipelinePage').then((m) => ({
    default: m.ProjectPipelinePage,
  })),
);
const PackagesPage = lazy(() =>
  import('./features/admin/projects/PackagesPage').then((m) => ({ default: m.PackagesPage })),
);
const PackageEditorPage = lazy(() =>
  import('./features/admin/projects/PackageEditorPage').then((m) => ({
    default: m.PackageEditorPage,
  })),
);
const ProjectsCalculatorPage = lazy(() =>
  import('./features/admin/projects/ProjectsCalculatorPage').then((m) => ({
    default: m.ProjectsCalculatorPage,
  })),
);
const ProjectPartnersPage = lazy(() =>
  import('./features/admin/projects/ProjectPartnersPage').then((m) => ({
    default: m.ProjectPartnersPage,
  })),
);
const ProjectsReportsPage = lazy(() =>
  import('./features/admin/projects/ProjectsReportsPage').then((m) => ({
    default: m.ProjectsReportsPage,
  })),
);
const AdminThreadPage = lazy(() =>
  import('./features/admin/AdminThreadPage').then((m) => ({ default: m.AdminThreadPage })),
);
const DashboardPage = lazy(() =>
  import('./features/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
// Eager: the desk layout, its guards and its nav helpers. `AdminShell` is the
// route element that hosts the lazy pages (and holds their `<Suspense>`), so it
// must resolve synchronously; the guards and `adminNav` run before any page.
import { RequireOwner } from './features/admin/RequireOwner';
import { AdminShell } from './features/admin/AdminShell';
import { asAdminRole, firstVisiblePath } from './features/admin/adminNav';
import { AuctionEventPage } from './features/auctions/AuctionEventPage';
import { AuctionListPage } from './features/auctions/AuctionListPage';
import { AuctionNotificationsPage } from './features/auctions/AuctionNotificationsPage';
import { AuctionNotificationsProvider } from './features/auctions/AuctionNotificationsProvider';
import { LotDetailPage } from './features/auctions/LotDetailPage';
import { RecordDetailPage } from './features/auctions/RecordDetailPage';
import { ChatPage } from './features/chat/ChatPage';
import { ThreadPage } from './features/chat/ThreadPage';
import { ConversationsProvider } from './features/conversations/ConversationsProvider';
import { PortalPage } from './features/portal/PortalPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { QuestionnairePage } from './features/questionnaire/QuestionnairePage';
import { ArtistRecordsPage } from './features/records/ArtistRecordsPage';
import { RecordsArchiveProvider } from './features/records/RecordsArchiveProvider';
import { RecordsPage } from './features/records/RecordsPage';
import { RequestProvider } from './features/requests/RequestProvider';
import { SavedItemsPage } from './features/saved/SavedItemsPage';
import { SavedProvider } from './features/saved/SavedProvider';
import { SettingsPage } from './features/settings/SettingsPage';
import { AppShell } from './features/shell/AppShell';
import { ScreenBoundary } from './features/shell/ScreenBoundary';
import { features, isHiddenPath, type FeatureFlags } from './features/shell/features';

/** Build-time only — see the `/_boom` route. `undefined` in every build that
 * does not set it, which is every build but the E2E one. */
const BOOM = import.meta.env.VITE_E2E_BOOM === '1';

function Boom(): never {
  throw new Error('E2E — forced render failure');
}

function CollectorLayout() {
  const location = useLocation();
  if (isHiddenPath(location.pathname)) return <Navigate to="/" replace />;

  const shell = (
    <AppShell>
      {/* The screen, behind the boundary that keeps a thrown render from
          taking the header, the chroma line and the nav down with it. Until
          2026-09-22 a collector screen had nothing under it, so an
          unexpected response shape was a white page — `/auctions/lots/:id`
          was exactly that. Keyed on the pathname the way `DeskBoundary` is,
          so leaving a broken screen clears it, and NOT on the search string,
          which would remount a screen every time a filter changed. */}
      <ScreenBoundary key={location.pathname}>
        <Outlet />
      </ScreenBoundary>
    </AppShell>
  );
  return (
    <RequireAuth>
      <SavedProvider>
        <RequestProvider>
          <ConversationsProvider>
            <ArtworkCacheProvider>
              <RecordsArchiveProvider>
                {features.auctions ? (
                  <AuctionNotificationsProvider>{shell}</AuctionNotificationsProvider>
                ) : (
                  shell
                )}
              </RecordsArchiveProvider>
            </ArtworkCacheProvider>
          </ConversationsProvider>
        </RequestProvider>
      </SavedProvider>
    </RequireAuth>
  );
}

/**
 * `/admin` itself has no desk — it clamps to the first page this role can
 * actually open, the way the old panel does when the current page is not in the
 * allowed set (`darz-studio.html:11815`:
 * `if(!set[page])page=set.dashboard?'dashboard':'database';`). Market is the
 * fallback for the case that cannot arise today: a team session whose role
 * unlocks nothing at all.
 */
function AdminIndex() {
  const { me } = useSession();
  return <Navigate to={firstVisiblePath(asAdminRole(me?.role)) ?? '/'} replace />;
}

/** Renders `children` only when the feature is on; otherwise Market. */
function Gate({ flag, children }: { flag: keyof FeatureFlags; children: React.ReactElement }) {
  return features[flag] ? children : <Navigate to="/" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<CollectorLayout />}>
        {/* A route that throws, so `ScreenBoundary` can be a GATE rather than
            an afternoon's hand-check. It exists only when
            `VITE_E2E_BOOM` is set, which only `npm run e2e:build` sets —
            `resolveBoom()` reads it the way every other value in this app is
            read (`.env.example` documents it), so no real build ever carries a
            crash switch. Without this, removing the boundary would break
            nothing that fails. */}
        {BOOM && <Route path="/_boom" element={<Boom />} />}

        <Route path="/" element={<CataloguePage />} />
        <Route path="/artwork/:id" element={<ArtworkDetailPage />} />
        <Route path="/artists" element={<ArtistListPage />} />
        <Route path="/artists/:id" element={<ArtistDetailPage />} />
        <Route path="/saved" element={<SavedItemsPage />} />

        {/* Records — external auction-house results per artist (DEC-13). */}
        <Route
          path="/records"
          element={
            <Gate flag="records">
              <RecordsPage />
            </Gate>
          }
        />
        <Route
          path="/records/artist/:id"
          element={
            <Gate flag="records">
              <ArtistRecordsPage />
            </Gate>
          }
        />
        <Route
          path="/records/:id"
          element={
            <Gate flag="records">
              <RecordDetailPage />
            </Gate>
          }
        />

        {/* Chat — collector ↔ Darz Admin. */}
        <Route
          path="/chat"
          element={
            <Gate flag="chat">
              <ChatPage />
            </Gate>
          }
        />
        <Route
          path="/chat/:id"
          element={
            <Gate flag="chat">
              <ThreadPage />
            </Gate>
          }
        />

        <Route
          path="/profile"
          element={
            <Gate flag="profile">
              <ProfilePage />
            </Gate>
          }
        />
        {/* The collector questionnaire (`theme.showQ` → `features.questionnaire`).
            Opened from the Profile overview's "Get to know you" card, which is
            behind the same flag, and exits back to /profile. */}
        <Route
          path="/questionnaire"
          element={
            <Gate flag="questionnaire">
              <QuestionnairePage />
            </Gate>
          }
        />
        <Route
          path="/settings"
          element={
            <Gate flag="settings">
              <SettingsPage />
            </Gate>
          }
        />

        {/* Auctions (Phase 8) — preserved, hidden in v0.1. */}
        <Route
          path="/auctions"
          element={
            <Gate flag="auctions">
              <AuctionListPage />
            </Gate>
          }
        />
        <Route
          path="/auctions/notifications"
          element={
            <Gate flag="auctions">
              <AuctionNotificationsPage />
            </Gate>
          }
        />
        <Route
          path="/auctions/:id"
          element={
            <Gate flag="auctions">
              <AuctionEventPage />
            </Gate>
          }
        />
        <Route
          path="/auctions/lots/:lotId"
          element={
            <Gate flag="auctions">
              <LotDetailPage />
            </Gate>
          }
        />
      </Route>

      {/* Admin desk — its own world. Not inside `CollectorLayout`: the desk
          needs no collector provider (it reads `crm`/`options` only) and must
          not wear the collector nav. `RequireTeam` is the principal-aware guard
          the old TODO here asked for — `RequireAuth` proves only that *a*
          session exists, and a collector token just collects 403s from
          `/api/crm/admin/...`.

          The desk's own tabs live in `features/admin/adminNav.ts`, ported from
          the old panel's `ADGROUPS`; `AdminShell` renders them. A route added
          below must be given a `path` in that table too, or the navbar will not
          know it exists. */}
      <Route
        path="/admin/login"
        element={
          /* Gated too, so the whole `/admin` prefix obeys FEATURE_ROUTES: with
             `adminDesk` off there must be no team gate to find either. */
          <Gate flag="adminDesk">
            {/* Inline Suspense: this is the one lazy admin route that does not
                render inside `AdminShell`, so it cannot use the shell's
                boundary. */}
            <Suspense fallback={null}>
              <TeamLoginPage />
            </Suspense>
          </Gate>
        }
      />
      <Route
        element={
          /* One gate for the whole prefix rather than one per desk — the
             children are all `/admin/...`, so `FEATURE_ROUTES`' own
             `['adminDesk', '/admin']` entry is the rule being enforced. */
          <Gate flag="adminDesk">
            <RequireTeam>
              <AdminShell />
            </RequireTeam>
          </Gate>
        }
      >
        {/* the Dashboard is the desk an admin starts on (:11815's clamp
            lands here now that it exists) */}
        <Route path="/admin" element={<DashboardPage />} />
        <Route path="/admin/requests" element={<AdminRequestsPage />} />
        <Route path="/admin/chat" element={<AdminChatPage />} />
        <Route path="/admin/chat/:id" element={<AdminThreadPage />} />
        <Route path="/admin/artworks" element={<ArtworksPage />} />
        <Route path="/admin/artworks/new" element={<ArtworkEditorPage />} />
        <Route path="/admin/artworks/:id" element={<ArtworkEditorPage />} />
        <Route path="/admin/artists" element={<ArtistsPage />} />
        <Route path="/admin/documents" element={<DocumentsPage />} />
        <Route path="/admin/documents/:id" element={<DocumentDetailPage />} />
        <Route path="/admin/published" element={<PublishedPage />} />
        <Route path="/admin/auctions" element={<AuctionsAdminPage />} />
        <Route path="/admin/auctions/:id" element={<AuctionAdminDetailPage />} />
        <Route path="/admin/auction-registrations" element={<RegistrationsPage />} />
        <Route path="/admin/auction-records" element={<RecordsAdminPage />} />
        <Route path="/admin/auction-records/new" element={<RecordEditorPage />} />
        <Route path="/admin/auction-records/:id" element={<RecordEditorPage />} />
        <Route path="/admin/sources" element={<SourcesPage />} />
        <Route path="/admin/sources/:id" element={<SourceDetailPage />} />
        <Route
          path="/admin/sources/:id/exhibitions/:eventId"
          element={<ExhibitionComposePage />}
        />
        {/* Exhibition Services — its own section (owner, 2026-09-19): the
            price list, and the one page that turns a show into a proposal or
            an invoice. `/admin/issue/:eventId` arrives with the show chosen,
            which is how every "issue a document" link into it is built. */}
        <Route path="/admin/exhibition-services" element={<ExhibitionServicesPage />} />
        <Route path="/admin/issue" element={<IssueDocumentPage />} />
        <Route path="/admin/issue/:eventId" element={<IssueDocumentPage />} />
        <Route path="/admin/sales" element={<SalesPage />} />
        <Route path="/admin/sales/:id" element={<SaleDetailPage />} />
        <Route path="/admin/collectors" element={<CollectorsPage />} />
        <Route path="/admin/design" element={<DesignPage />} />
        <Route path="/admin/data-health" element={<DataHealthPage />} />
        <Route path="/admin/import" element={<ImportPage />} />
        <Route path="/admin/import/:id" element={<ImportBatchPage />} />
        <Route
          path="/admin/memberships"
          element={
            <RequireOwner title="Memberships">
              <MembershipsPage />
            </RequireOwner>
          }
        />
        <Route
          path="/admin/team"
          element={
            <RequireOwner title="Team">
              <TeamPage />
            </RequireOwner>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RequireOwner title="Settings">
              <AdminSettingsPage />
            </RequireOwner>
          }
        />
        <Route
          path="/admin/accounting"
          element={
            <RequireOwner title="Accounting">
              <AccountingPage />
            </RequireOwner>
          }
        />
        <Route
          path="/admin/accounting/deals/new"
          element={
            <RequireOwner title="Accounting">
              <DealEditorPage />
            </RequireOwner>
          }
        />
        <Route
          path="/admin/accounting/entries/:id"
          element={
            <RequireOwner title="Accounting">
              <LedgerEntryPage />
            </RequireOwner>
          }
        />
        <Route
          path="/admin/accounting/deals/:id"
          element={
            <RequireOwner title="Accounting">
              <DealEditorPage />
            </RequireOwner>
          }
        />
        {/* Projects (Phase 11c) — the old group's eight sub-tabs (:13580-13587)
            as routes; the record and its print report ride /:id, reached from
            the list, the board and the dashboard cards. Static segments come
            first so react-router ranks them above /:id. */}
        <Route path="/admin/projects" element={<ProjectsDashboardPage />} />
        <Route path="/admin/projects/list" element={<ProjectsListPage />} />
        <Route path="/admin/projects/new" element={<NewProjectPage />} />
        <Route path="/admin/projects/pipeline" element={<ProjectPipelinePage />} />
        <Route path="/admin/projects/packages" element={<PackagesPage />} />
        <Route path="/admin/projects/packages/new" element={<PackageEditorPage />} />
        <Route path="/admin/projects/packages/:id" element={<PackageEditorPage />} />
        <Route path="/admin/projects/calculator" element={<ProjectsCalculatorPage />} />
        <Route path="/admin/projects/partners" element={<ProjectPartnersPage />} />
        <Route path="/admin/projects/reports" element={<ProjectsReportsPage />} />
        <Route path="/admin/projects/:id" element={<ProjectPage />} />
        <Route path="/admin/projects/:id/report" element={<ProjectReportPage />} />
        <Route path="/admin/collectors/:id" element={<CollectorDetailPage />} />
        <Route path="/admin/club" element={<ClubPage />} />
        {/* owner-only (`OWNER_ONLY` has `system`): the nav hides the tab from a
            standard admin and RequireOwner answers a typed URL with the old
            panel's own refusal card (:33116) rather than a redirect. */}
        <Route
          path="/admin/access-requests"
          element={
            <RequireOwner title="Access Requests">
              <AccessRequestsPage />
            </RequireOwner>
          }
        />
        {/* An unknown `/admin/...` clamps to the desk, not to the collector
            Market the global catch-all would send it to: a team session has no
            business being dropped into the catalogue, and clamping is what the
            old panel does with a page it cannot open (:11815). */}
        <Route path="/admin/*" element={<AdminIndex />} />
      </Route>
      {/* The no-login partner portal (Phase 14) — its own world, like the
          desk but with no session guard at all: the token in the URL plus
          the PIN is the door, verified server-side on every request. No
          collector providers, no app shell, the LINK's theme. */}
      <Route
        path="/portal/:token"
        element={
          <Gate flag="galleryPortal">
            <PortalPage />
          </Gate>
        }
      />
      <Route path="/_design" element={<App />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
