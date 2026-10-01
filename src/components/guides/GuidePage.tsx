import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Public, server-rendered guide pages (for people searching e.g. "play music
// in a taxi"). Plain content + FAQ structured data + links to the other pages.

export interface GuideFaq {
  q: string;
  a: string;
}

export const GUIDES = [
  { href: "/play-music-in-a-taxi", title: "How to play your own music in a taxi or Uber" },
  { href: "/taxi-music-app", title: "Taxi DJ for drivers: the music app for taxis" },
  { href: "/driver/help", title: "Driver help: step by step" },
];

export function GuidePage({
  path,
  title,
  intro,
  children,
  faq,
}: {
  path: string;
  title: string;
  intro: string;
  children: ReactNode;
  faq: GuideFaq[];
}) {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: title, item: `${SITE_URL}${path}` },
      ],
    },
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8 safe-top safe-bottom">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Link href="/" aria-label="Taxi DJ home" className="inline-block">
        <Logo size="md" />
      </Link>
      <h1 className="mt-8 text-3xl font-black leading-tight tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-4 text-lg text-mist">{intro}</p>

      <div className="guide mt-8 space-y-6 text-white [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-black [&_li]:mt-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:text-mist [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-6 [&_li]:text-mist">
        {children}
      </div>

      <Link
        href="/"
        className="mt-10 flex min-h-14 items-center justify-center rounded-2xl bg-taxi text-lg font-black text-ink hover:bg-taxi-light"
      >
        Open Taxi DJ
      </Link>

      <h2 className="mt-12 text-xl font-black">Frequently asked questions</h2>
      <div className="mt-4 space-y-2">
        {faq.map(({ q, a }) => (
          <details key={q} className="rounded-2xl border border-line bg-night-2 p-4 open:bg-night-3">
            <summary className="cursor-pointer list-none font-bold marker:hidden">{q}</summary>
            <p className="mt-2 text-sm text-mist">{a}</p>
          </details>
        ))}
      </div>

      <nav aria-label="More from Taxi DJ" className="mt-12 border-t border-line pt-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-mist">More from Taxi DJ</h2>
        <ul className="mt-3 space-y-2">
          {GUIDES.filter((g) => g.href !== path).map((g) => (
            <li key={g.href}>
              <Link href={g.href} className="font-bold text-taxi underline-offset-4 hover:underline">
                {g.title}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/" className="font-bold text-taxi underline-offset-4 hover:underline">
              Taxi DJ home
            </Link>
          </li>
        </ul>
      </nav>
      <p className="mt-8 text-xs text-mist">
        Taxi DJ is an independent app. It isn&apos;t affiliated with or endorsed by YouTube, Google, Spotify, Apple,
        Uber, Bolt, Lyft or FREENOW.
      </p>
    </main>
  );
}
