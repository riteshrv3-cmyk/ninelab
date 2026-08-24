import { Home, Target, Briefcase, FileText, User } from "lucide-react";

/**
 * Shared between BottomNav (mobile) and SideNav (lg+ desktop) so the two
 * shells can never drift out of sync on routes/labels.
 *
 * Explore-first shell: ninelab.in opens straight into the app at "/", the
 * feature-cards Home that anonymous visitors browse in demo mode. Home leads
 * the 5-tab bar; the rest of the pipeline (Resume, Jobs, Practice) and the
 * Profile/account surface follow. "/" must match EXACTLY for active state —
 * see BottomNav/SideNav — so Home doesn't light up on every route.
 */
export const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/resume", icon: FileText, label: "Resume" },
  { href: "/opportunities", icon: Briefcase, label: "Jobs" },
  { href: "/practice", icon: Target, label: "Practice" },
  { href: "/profile", icon: User, label: "Profile" },
];
