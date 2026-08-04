import type { DefaultSeoProps } from "next-seo/pages";

/**
 * Public base URL of this deployment, without a trailing slash.
 *
 * A self-hosted instance sets NEXT_PUBLIC_SITE_URL so its canonicals and Open
 * Graph URLs point at itself; leaving canonicals hard-coded to jsoncrack.com
 * makes crawlers discard every URL the sitemap just handed them, and makes
 * social previews of a private deployment fetch their image from jsoncrack.com.
 * The same variable feeds next-sitemap, so the sitemap and the pages agree.
 *
 * NEXT_PUBLIC_ is required: the value is read while rendering, so it has to be
 * inlined into the client bundle for the static export.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://jsoncrack.com").replace(
  /\/+$/,
  ""
);

/** Absolute URL for a site-root-relative path, e.g. `absoluteUrl("/docs")`. */
export const absoluteUrl = (path: string) =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export const SEO: DefaultSeoProps = {
  title: "JSON Crack | Online JSON Viewer - Transform your data into interactive graphs",
  description:
    "JSON Crack Editor is a tool for visualizing into graphs, analyzing, editing, formatting, querying, transforming and validating JSON, CSV, YAML, XML, and more.",
  themeColor: "#36393E",
  openGraph: {
    type: "website",
    images: [
      {
        url: `${SITE_URL}/assets/jsoncrack.png`,
        width: 1200,
        height: 627,
      },
    ],
  },
  twitter: {
    handle: "@jsoncrack",
    cardType: "summary_large_image",
  },
  additionalLinkTags: [
    {
      rel: "manifest",
      href: "/manifest.json",
    },
    {
      rel: "icon",
      href: "/favicon.ico",
      sizes: "48x48",
    },
  ],
};
