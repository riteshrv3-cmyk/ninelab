import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useClerk,
  useUser,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  Switch,
  Route,
  Router as WouterRouter,
  useLocation,
} from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import Join from "@/pages/Join";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthBridge } from "@/components/AuthBridge";
const Landing = lazy(() => import("@/pages/Landing"));
const ExploreHome = lazy(() => import("@/pages/ExploreHome"));
const Home = lazy(() => import("@/pages/Home"));
const AIChat = lazy(() => import("@/pages/AIChat"));
const Prep = lazy(() => import("@/pages/Prep"));
const Interview = lazy(() => import("@/pages/Interview"));
const InterviewHistory = lazy(() => import("@/pages/InterviewHistory"));
const Notebook = lazy(() => import("@/pages/Notebook"));
const Opportunities = lazy(() => import("@/pages/Opportunities"));
const Course = lazy(() => import("@/pages/Course"));
const CourseLibrary = lazy(() => import("@/pages/CourseLibrary"));
const Profile = lazy(() => import("@/pages/Profile"));
const Resume = lazy(() => import("@/pages/Resume"));
const Inbox = lazy(() => import("@/pages/Inbox"));
const DriveCheck = lazy(() => import("@/pages/DriveCheck"));
const Pipeline = lazy(() => import("@/pages/Pipeline"));
const RecruiterPortalShortcut = lazy(
  () => import("@/pages/RecruiterPortalShortcut"),
);
const PublicResume = lazy(() => import("@/pages/PublicResume"));
const PublicCertificate = lazy(() => import("@/pages/PublicCertificate"));
const TrackView = lazy(() => import("@/pages/TrackView"));
const TpoApp = lazy(() => import("@/pages/tpo/TpoApp"));

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
setBaseUrl(basePath);

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/favicon.png`,
    socialButtonsPlacement: "bottom" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  // Canopy tokens, not a parallel slate/indigo-600 palette. These were
  // Tailwind defaults (#4f46e5 indigo-600, #0f172a slate-900, #64748b
  // slate-500, #e2e8f0 slate-200, #f8fafc slate-50), so sign-in and sign-up
  // rendered in a colder, bluer palette than every other screen. Values below
  // mirror index.css: brand #4a55c7, ink #1a1d2e, ink-muted #9aa0ae,
  // line #ecedf3, canvas #f4f5f7, danger #dc2626.
  variables: {
    colorPrimary: "#4a55c7",
    colorForeground: "#1a1d2e",
    colorMutedForeground: "#9aa0ae",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#f4f5f7",
    colorInputForeground: "#1a1d2e",
    colorNeutral: "#ecedf3",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-ink font-bold text-xl",
    headerSubtitle: "text-ink-muted text-sm",
    socialButtonsBlockButtonText: "text-ink font-semibold",
    formFieldLabel: "text-ink font-semibold text-sm",
    footerActionLink: "text-brand font-semibold",
    footerActionText: "text-ink-muted text-sm",
    dividerText: "text-ink-muted text-xs font-medium",
    logoBox: "mb-4",
    logoImage: "w-10 h-10",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-line hover:bg-canvas",
    // Solid brand, not a gradient. The blue-to-violet gradient CTA was the
    // loudest element on the first screen a new user sees, and the design
    // system rules out gradients on buttons outright.
    formButtonPrimary:
      "h-11 rounded-xl bg-brand font-bold hover:opacity-90",
    formFieldInput:
      "h-11 rounded-xl bg-canvas border-line text-ink",
    footerAction: "mt-4",
    dividerLine: "bg-line",
    alert: "rounded-xl",
    otpCodeFieldInput: "h-11 rounded-xl",
    formFieldRow: "gap-3",
    main: "gap-4",
  },
};

// Shaped after the canopy+sheet pattern nearly every page uses (301 hits
// across 31 files), so the loading flash reads as "this page" rather than a
// generic placeholder. Bare `-mx-*` pulls the canopy block out to the edges
// of whatever container it's rendered in (AppLayout's <main>, or standalone
// for /r/:slug) since PageSkeleton doesn't know that container's padding.
function PageSkeleton() {
  return (
    <div className="-mx-6 lg:mx-0 -mt-8 lg:mt-0" data-testid="page-loading-skeleton">
      <div className="bg-brand/90 h-28 lg:h-20 lg:rounded-2xl animate-pulse" />
      <div className="bg-canvas rounded-t-3xl lg:rounded-2xl -mt-6 lg:mt-4 px-6 pt-6 pb-4 space-y-3">
        <Skeleton className="h-[72px] w-full rounded-2xl" />
        <Skeleton className="h-[72px] w-full rounded-2xl" />
        <Skeleton className="h-[72px] w-full rounded-2xl" />
      </div>
    </div>
  );
}

// "/" decides between the first-visit landing and the app's explore home.
// The landing shows ONCE per device: any prior entry (Explore CTA, a created
// student row, or a Clerk session) sends "/" straight into the app. Installed
// PWA users always have a studentId, so start_url "/" never re-shows it.
function HomeGate() {
  const { isSignedIn, isLoaded } = useUser();
  const [entered, setEntered] = useState(
    () =>
      Boolean(localStorage.getItem("kt:entered")) ||
      Boolean(localStorage.getItem("studentId")),
  );

  const appHome = (
    <AppLayout>
      <Suspense fallback={<PageSkeleton />}>
        <ExploreHome />
      </Suspense>
    </AppLayout>
  );

  if (entered) return appHome;
  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-paper">
        <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }
  if (isSignedIn) return appHome;
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-paper" />
      }
    >
      <Landing onEnter={() => setEntered(true)} />
    </Suspense>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/`}
      />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeGate} />
      <Route path="/join/:code">{(p) => <Join code={p.code} />}</Route>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/r/:slug">
        {(p) => (
          <Suspense fallback={<PageSkeleton />}>
            <PublicResume slug={p.slug} />
          </Suspense>
        )}
      </Route>
      <Route path="/certs/:slug">
        {(p) => (
          <Suspense fallback={<PageSkeleton />}>
            <PublicCertificate slug={p.slug} />
          </Suspense>
        )}
      </Route>
      {/* TPO surface — nested, above the student catch-all so it never inherits
          the student AppLayout chrome. Its own gate + layout live in TpoApp. */}
      <Route path="/tpo" nest>
        <Suspense fallback={<PageSkeleton />}>
          <TpoApp />
        </Suspense>
      </Route>
      <Route>
        <AppLayout>
          <Suspense fallback={<PageSkeleton />}>
            <Switch>
              <Route path="/home" component={Home} />
              <Route path="/track" component={TrackView} />
              <Route path="/notebook" component={Notebook} />
              <Route path="/chat" component={AIChat} />
              <Route path="/practice" component={Prep} />
              <Route path="/practice/history" component={InterviewHistory} />
              <Route path="/practice/interview/:id" component={Interview} />
              <Route path="/practice/courses" component={CourseLibrary} />
              <Route path="/opportunities" component={Opportunities} />
              <Route path="/opportunities/course" component={Course} />
              <Route path="/profile" component={Profile} />
              <Route path="/resume" component={Resume} />
              <Route path="/inbox" component={Inbox} />
              <Route path="/drive-check" component={DriveCheck} />
              <Route path="/pipeline" component={Pipeline} />
              <Route path="/recruiter" component={RecruiterPortalShortcut} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to ninelab",
          },
        },
        signUp: {
          start: {
            title: "Join ninelab",
            subtitle: "Start your AI career journey",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthBridge />
          <ClerkQueryClientCacheInvalidator />
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
