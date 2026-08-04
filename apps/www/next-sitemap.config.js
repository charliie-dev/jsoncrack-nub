/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || "https://jsoncrack.com",
  generateRobotsTxt: true,
  // Write straight into the export directory. The default outDir is `public`, but
  // `next build` copies `public` into `out` before postbuild runs, so anything written
  // there only reaches the deployed artifact on the *next* build.
  outDir: "out",
  exclude: ["/widget"],
  autoLastmod: false,
  changefreq: "never",
};
