import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-canvas">
      <Card className="w-full max-w-md lg:max-w-lg mx-4 border-0 shadow-soft rounded-2xl">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <Compass className="h-10 w-10 text-brand mb-4" />

          <h1 className="text-2xl font-bold text-ink">This page does not exist.</h1>

          <p className="mt-2 text-sm text-ink-muted">
            The link you followed might be broken, or the page may have moved.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3 w-full">
            <Link
              href="/"
              className="bg-brand text-white font-bold rounded-full px-6 py-3.5 w-full text-center"
            >
              Go to home
            </Link>
            <Link
              href="/opportunities"
              className="bg-paper text-brand border border-line rounded-full px-6 py-3.5 w-full text-center"
            >
              Explore jobs
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
