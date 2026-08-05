import React from "react";
import { Inter } from "next/font/google";
import styled, { ThemeProvider } from "styled-components";
import { darkTheme } from "../../constants/theme";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

const inter = Inter({
  subsets: ["latin-ext"],
});

const StyledLayoutWrapper = styled.div`
  background: ${({ theme }) => theme.BACKGROUND_PRIMARY};
  color: ${({ theme }) => theme.TEXT_NORMAL};
  font-family: ${inter.style.fontFamily};
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const ContentWrapper = styled.div`
  flex: 1;
`;

const PageLayout = ({ children }: React.PropsWithChildren) => {
  return (
    <ThemeProvider theme={darkTheme}>
      <StyledLayoutWrapper>
        <Navbar />
        <ContentWrapper>{children}</ContentWrapper>
        <Footer />
      </StyledLayoutWrapper>
    </ThemeProvider>
  );
};

export default PageLayout;
