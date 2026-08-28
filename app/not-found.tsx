import { BookOpen } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="recovery-screen">
      <div className="recovery-card">
        <BookOpen size={28} />
        <p className="eyebrow">Page not found</p>
        <h1>This page is not on the shelf</h1>
        <p>Return to your Pagewise library and continue reading.</p>
        <Link className="button button-primary" href="/">
          Return to Pagewise
        </Link>
      </div>
    </main>
  );
}
