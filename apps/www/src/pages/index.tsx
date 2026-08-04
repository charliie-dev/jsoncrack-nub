import React from "react";
import { SEO } from "../constants/seo";
import EditorPage from "./editor";

/**
 * This fork serves the editor at the site root instead of a marketing landing
 * page. It renders the editor component rather than re-exporting its default so
 * the homepage keeps its own canonical, title and description — a bare
 * `export { default } from "./editor"` inherits the editor's `<Head>`, which
 * makes `/` canonicalize to `/editor` and drops the site root from search
 * indexes while the sitemap still advertises it.
 */
const HomePage = () => (
  <EditorPage canonicalPath="/" title={SEO.title} description={SEO.description} />
);

export default HomePage;
