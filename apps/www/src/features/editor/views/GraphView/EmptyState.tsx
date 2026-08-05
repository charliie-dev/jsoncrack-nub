import React from "react";
import { Button, Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import styled from "styled-components";
import { event as gaEvent } from "nextjs-google-analytics";
import { LuFolderOpen } from "react-icons/lu";
import { VscJson, VscListTree, VscSymbolNamespace, VscTable } from "react-icons/vsc";
import exampleJson from "../../../../data/example.json";
import { FileFormat } from "../../../../enums/file.enum";
import { jsonToContent } from "../../../../lib/utils/jsonAdapter";
import useFile from "../../../../store/useFile";
import { useModal } from "../../../../store/useModal";

const StyledOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
`;

const FORMAT_CARDS = [
  {
    format: FileFormat.JSON,
    label: "JSON",
    hint: "Objects, arrays & nested data",
    icon: <VscJson size={28} />,
  },
  {
    format: FileFormat.YAML,
    label: "YAML",
    hint: "Config files & pipelines",
    icon: <VscListTree size={28} />,
  },
  {
    format: FileFormat.XML,
    label: "XML",
    hint: "Markup & structured documents",
    icon: <VscSymbolNamespace size={28} />,
  },
  {
    format: FileFormat.CSV,
    label: "CSV",
    hint: "Tables & spreadsheets",
    icon: <VscTable size={28} />,
  },
] as const;

export const EmptyState = () => {
  const setContents = useFile(state => state.setContents);
  const setVisible = useModal(state => state.setVisible);

  const loadExample = async (format: FileFormat) => {
    // Converted from the one bundled JSON example rather than shipping four fixtures.
    // jsonToContent already backs the format dropdown, so what lands in the editor is
    // exactly what switching format would have produced.
    const contents = await jsonToContent(JSON.stringify(exampleJson, null, 2), format);

    setContents({ contents, format, hasChanges: false });
    gaEvent("empty_state_pick_format", { label: format });
  };

  return (
    <StyledOverlay>
      <Stack gap="lg" align="center" maw={640} w="100%">
        <Stack gap={4} align="center">
          <Title order={3}>Start with a format</Title>
          <Text c="dimmed" fz="sm" ta="center">
            Pick a format to load an example, or just start typing in the editor.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" w="100%">
          {FORMAT_CARDS.map(card => (
            <Card
              key={card.format}
              withBorder
              radius="md"
              padding="md"
              component="button"
              type="button"
              onClick={() => void loadExample(card.format)}
            >
              <Stack gap={6} align="center">
                {card.icon}
                <Text fw={600} fz="sm">
                  {card.label}
                </Text>
                <Text c="dimmed" fz="xs" ta="center">
                  {card.hint}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Button
          variant="default"
          fullWidth
          leftSection={<LuFolderOpen />}
          onClick={() => {
            setVisible("ImportModal", true);
            gaEvent("empty_state_open_file");
          }}
        >
          Open File
        </Button>
      </Stack>
    </StyledOverlay>
  );
};
