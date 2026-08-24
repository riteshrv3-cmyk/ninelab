import { useEffect } from "react";
import { useLocation } from "wouter";

export default function RecruiterPortalShortcut() {
  const [, setLocation] = useLocation();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    const recruiter = localStorage.getItem("recruiter");
    if (recruiter) {
      window.location.assign(`${base}/recruiter-portal/dashboard`);
      return;
    }
    window.location.assign(`${base}/recruiter-portal/welcome`);
  }, [setLocation]);

  return null;
}