/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://jsoncrack.com",
  generateRobotsTxt: true,
  // Write straight into the export directory. The default outDir is `public`, but
  // `next build` copies `public` into `out` before postbuild runs, so anything written
  // there only reaches the deployed artifact on the *next* build.
  outDir: "out",
  // /editor renders the same page as the site root, so listing both would put two
  // identical URLs in the sitemap and invite Google to pick /editor as the canonical
  // for the root. /widget is an embed target, not a page to index.
  exclude: ["/widget", "/editor"],
  autoLastmod: false,
  changefreq: "never",
};
