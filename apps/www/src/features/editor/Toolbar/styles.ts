import styled from "styled-components";

/**
 * `$outlined` gives the icon-only actions a visible button shape.
 *
 * Bare glyphs floating in the bar read as decoration; a border and a filled surface say
 * they can be clicked, which is how the reference UI treats the same controls.
 */
export const StyledToolElement = styled.button<{
  $hide?: boolean;
  $highlight?: boolean;
  $outlined?: boolean;
}>`
  display: ${({ $hide }) => ($hide ? "none" : "flex")};
  align-items: center;
  gap: 4px;
  place-content: center;
  font-size: 14px;
  background: ${({ $highlight }) =>
    $highlight ? "linear-gradient(rgba(0, 0, 0, 0.1) 0 0)" : "none"};
  color: ${({ theme }) => theme.INTERACTIVE_NORMAL};
  padding: ${({ $outlined }) => ($outlined ? "6px 8px" : "6px")};
  border: 1px solid ${({ theme, $outlined }) => ($outlined ? theme.BORDER : "transparent")};
  border-radius: ${({ $outlined }) => ($outlined ? "8px" : "6px")};
  white-space: nowrap;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease;

  &:hover {
    background-image: linear-gradient(rgba(0, 0, 0, 0.1) 0 0);
    border-color: ${({ theme, $outlined }) => ($outlined ? theme.SILVER_DARK : "transparent")};
  }

  &:hover {
    color: ${({ theme }) => theme.INTERACTIVE_HOVER};
    opacity: 1;
    box-shadow: none;
  }

  /* Mantine sets data-expanded on a Menu.Target while its dropdown is open. Holding the
     hover fill keeps the button and the dropdown reading as one thing: without it the fill
     drops the moment the cursor leaves the button for the menu, and the open dropdown ends
     up next to a button that looks untouched. */
  &[data-expanded] {
    background-image: linear-gradient(rgba(0, 0, 0, 0.1) 0 0);
    color: ${({ theme }) => theme.INTERACTIVE_HOVER};
  }

  svg:last-of-type {
    transition: transform 150ms ease;
  }

  &[data-expanded] svg:last-of-type {
    transform: rotate(180deg);
  }
`;
