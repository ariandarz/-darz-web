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
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import App from './App';
import { useSession } from './api/hooks';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { RequireTeam } from './features/auth/RequireTeam';
import { TeamLoginPage } from './features/auth/TeamLoginPage';
import { ArtistDetailPage } from './features/catalogue/ArtistDetailPage';
import { ArtistListPage } from './features/catalogue/ArtistListPage';
import { ArtworkCacheProvider } from './features/catalogue/ArtworkCacheProvider';
import { ArtworkDetailPage } from './features/catalogue/ArtworkDetailPage';
import { CataloguePage } from './features/catalogue/CataloguePage';
import { AdminRequestsPage } from './features/admin/AdminRequestsPage';
import { ArtistsPage } from './features/admin/ArtistsPage';
import { AuctionAdminDetailPage } from './features/admin/AuctionAdminDetailPage';
import { AccountingPage } from './features/admin/AccountingPage';
import { DealEditorPage } from './features/admin/DealEditorPage';
import { LedgerEntryPage } from './features/admin/LedgerEntryPage';
import { AuctionsAdminPage } from './features/admin/AuctionsAdminPage';
import { RegistrationsPage } from './features/admin/RegistrationsPage';
import { RecordEditorPage } from './features/admin/RecordEditorPage';
import { RecordsAdminPage } from './features/admin/RecordsAdminPage';
import { DocumentDetailPage } from './features/admin/DocumentDetailPage';
import { DocumentsPage } from './features/admin/DocumentsPage';
import { PublishedPage } from './features/admin/PublishedPage';
import { SaleDetailPage } from './features/admin/SaleDetailPage';
import { SourceDetailPage } from './features/admin/SourceDetailPage';
import { ExhibitionComposePage } from './features/admin/ExhibitionComposePage';
import { ExhibitionServicesPage } from './features/admin/exhibitions/ExhibitionServicesPage';
import { IssueDocumentPage } from './features/admin/exhibitions/IssueDocumentPage';
import { SourcesPage } from './features/admin/SourcesPage';
import { SalesPage } from './features/admin/SalesPage';
import { ArtworkEditorPage } from './features/admin/ArtworkEditorPage';
import { ArtworksPage } from './features/admin/ArtworksPage';
import { AccessRequestsPage } from './features/admin/AccessRequestsPage';
import { AdminChatPage } from './features/admin/AdminChatPage';
import { CollectorDetailPage } from './features/admin/CollectorDetailPage';
import { CollectorsPage } from './features/admin/CollectorsPage';
import { ClubPage } from './features/admin/ClubPage';
import { DesignPage } from './features/admin/DesignPage';
import { DataHealthPage } from './features/admin/DataHealthPage';
import { ImportBatchPage } from './features/admin/ImportBatchPage';
import { ImportPage } from './features/admin/ImportPage';
import { MembershipsPage } from './features/admin/MembershipsPage';
import { TeamPage } from './features/admin/TeamPage';
import { SettingsPage as AdminSettingsPage } from './features/admin/SettingsPage';
import { RequireOwner } from './features/admin/RequireOwner';
import { AdminShell } from './features/admin/AdminShell';
import { ProjectsDashboardPage } from './features/admin/projects/ProjectsDashboardPage';
import { ProjectsListPage } from './features/admin/projects/ProjectsListPage';
import { NewProjectPage } from './features/admin/projects/NewProjectPage';
import { ProjectPage } from './features/admin/projects/ProjectPage';
import { ProjectReportPage } from './features/admin/projects/ProjectReportPage';
import { ProjectPipelinePage } from './features/admin/projects/ProjectPipelinePage';
import { PackagesPage } from './features/admin/projects/PackagesPage';
import { PackageEditorPage } from './features/admin/projects/PackageEditorPage';
import { ProjectsCalculatorPage } from './features/admin/projects/ProjectsCalculatorPage';
import { ProjectPartnersPage } from './features/admin/projects/ProjectPartnersPage';
import { ProjectsReportsPage } from './features/admin/projects/ProjectsReportsPage';
import { AdminThreadPage } from './features/admin/AdminThreadPage';
import { DashboardPage } from './features/admin/DashboardPage';
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
import { ArtistRecordsPage } from './features/records/ArtistRecordsPage';
import { RecordsArchiveProvider } from './features/records/RecordsArchiveProvider';
import { RecordsPage } from './features/records/RecordsPage';
import { RequestProvider } from './features/requests/RequestProvider';
import { SavedItemsPage } from './features/saved/SavedItemsPage';
import { SavedProvider } from './features/saved/SavedProvider';
import { SettingsPage } from './features/settings/SettingsPage';
import { AppShell } from './features/shell/AppShell';
import { features, isHiddenPath, type FeatureFlags } from './features/shell/features';

function CollectorLayout() {
  const location = useLocation();
  if (isHiddenPath(location.pathname)) return <Navigate to="/" replace />;

  const shell = (
    <AppShell>
      <Outlet />
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
            <TeamLoginPage />
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
              <Route
                path="/admin/accounting/entries/:id"
                element={
                  <RequireOwner title="Accounting">
                    <LedgerEntryPage />
                  </RequireOwner>
                }
              />
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
