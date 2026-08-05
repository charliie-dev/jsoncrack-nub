import React from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { createTheme, MantineProvider, useMantineColorScheme } from "@mantine/core";
import "@mantine/core/styles.css";
import { CodeHighlightAdapterProvider, createShikiAdapter } from "@mantine/code-highlight";
import "@mantine/code-highlight/styles.css";
import { ThemeProvider } from "styled-components";
import { mixHex, mocha } from "jsoncrack-react/palette";
import "jsoncrack-react/style.css";
import { SoftwareApplicationJsonLd } from "next-seo";
import { generateDefaultSeo } from "next-seo/pages";
import { GoogleAnalytics } from "nextjs-google-analytics";
import { Toaster } from "react-hot-toast";
import GlobalStyle from "../constants/globalStyle";
import { SEO } from "../constants/seo";
import { lightTheme } from "../constants/theme";
import { isDynamicColorSchemePath, smartColorSchemeManager } from "../lib/utils/mantineColorScheme";

const DYNAMIC_COLOR_SCHEME_PATHS = ["/", "/editor", "/widget"];

/**
 * Forces the dark scheme when navigating onto a static page.
 *
 * The colour-scheme manager decides fixed-vs-dynamic from the pathname, but Mantine only
 * consults it while mounting, so a client-side navigation from a dynamic route to a static
 * one would otherwise leave whichever scheme the editor was last on. Static pages are
 * Catppuccin Mocha and have no toggle, so they need to be pinned on every navigation.
 */
const ColorSchemeSync = ({ pathname }: { pathname: string }) => {
  const { setColorScheme } = useMantineColorScheme();

  React.useEffect(() => {
    if (!isDynamicColorSchemePath(pathname, DYNAMIC_COLOR_SCHEME_PATHS)) {
      setColorScheme("dark");
    }
  }, [pathname, setColorScheme]);

  return null;
};

async function loadShiki() {
  const { createHighlighter } = await import("shiki");
  const shiki = await createHighlighter({
    langs: ["typescript", "json", "go", "kotlin", "rust", "html", "bash", "javascript"],
    themes: [],
  });

  return shiki;
}

const shikiAdapter = createShikiAdapter(loadShiki);

/**
 * Mantine wants ten steps per colour. Interpolate from the flavour base to the accent so
 * every shade stays inside the palette instead of shipping a second hand-picked ramp.
 */
const shades = (accent: string, base: string) =>
  Array.from({ length: 10 }, (_, index) => mixHex(accent, base, (index + 1) / 10)) as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];

const theme = createTheme({
  autoContrast: true,
  fontSmoothing: false,
  respectReducedMotion: true,
  cursorType: "pointer",
  fontFamily:
    'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"',
  defaultGradient: {
    from: mocha.blue,
    to: mocha.mauve,
    deg: 180,
  },
  primaryShade: 8,
  primaryColor: "mauve",
  colors: {
    mauve: shades(mocha.mauve, mocha.base),
    /**
     * Mantine resolves every dark-scheme surface through `colors.dark`: dropdown and modal
     * backgrounds, borders, dimmed text. Leaving it at the default meant menus stayed on
     * Mantine's own grey-blue while everything around them was Catppuccin.
     *
     * Ordered brightest to darkest, which is the convention Mantine's components assume:
     * 0 is body text, 4 is the border, 6 is the body background, 7 is a raised surface.
     */
    dark: [
      mocha.text,
      mocha.subtext1,
      mocha.subtext0,
      mocha.overlay1,
      mocha.surface2,
      mocha.surface1,
      mocha.surface0,
      mocha.base,
      mocha.mantle,
      mocha.crust,
    ],
  },
  radius: {
    lg: "12px",
  },
  components: {
    Button: {
      defaultProps: {
        fw: 500,
      },
    },
  },
});

function JSONCrackApp({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();

  // Create a single smart manager that handles pathname logic internally.
  // "/" is in the dynamic set because this fork serves the editor at the site root;
  // without it the manager forces light on the homepage while the editor paints dark,
  // flashing on every load, and `set()` silently drops theme toggles made there.
  const colorSchemeManager = smartColorSchemeManager({
    key: "editor-color-scheme",
    getPathname: () => pathname,
    dynamicPaths: DYNAMIC_COLOR_SCHEME_PATHS,
  });

  return (
    <>
      <Head>{generateDefaultSeo(SEO)}</Head>
      <SoftwareApplicationJsonLd
        name="JSON Crack"
        type="SoftwareApplication"
        operatingSystem="Browser"
        applicationCategory="DeveloperApplication"
        aggregateRating={{ ratingValue: 4.9, ratingCount: 19 }}
        datePublished="2022-17-02"
      />
      <MantineProvider
        colorSchemeManager={colorSchemeManager}
        defaultColorScheme="dark"
        theme={theme}
      >
        <ColorSchemeSync pathname={pathname} />
        <CodeHighlightAdapterProvider adapter={shikiAdapter}>
          <ThemeProvider theme={lightTheme}>
            <Toaster
              position="bottom-right"
              containerStyle={{
                bottom: 34,
                right: 8,
                fontSize: 14,
              }}
              toastOptions={{
                style: {
                  background: mocha.surface0,
                  color: mocha.text,
                  borderRadius: 4,
                },
              }}
            />
            <GlobalStyle />
            {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && <GoogleAnalytics trackPageViews />}
            <Component {...pageProps} />
          </ThemeProvider>
        </CodeHighlightAdapterProvider>
      </MantineProvider>
    </>
  );
}

export default JSONCrackApp;
