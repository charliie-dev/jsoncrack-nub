import React from "react";
import { Flex, Menu } from "@mantine/core";
import { event as gaEvent } from "nextjs-google-analytics";
import { LuChevronDown, LuDownload, LuFile, LuFolderOpen, LuImageDown } from "react-icons/lu";
import { exportBaseName } from "../../../lib/utils/exportImage";
import useFile from "../../../store/useFile";
import { useModal } from "../../../store/useModal";
import { StyledToolElement } from "./styles";

export const FileMenu = () => {
  const setVisible = useModal(state => state.setVisible);
  const getContents = useFile(state => state.getContents);
  const getFormat = useFile(state => state.getFormat);
  const documentName = useFile(state => state.documentName);

  const handleSave = () => {
    const a = document.createElement("a");
    const file = new Blob([getContents()], { type: "text/plain" });

    a.href = window.URL.createObjectURL(file);
    // Named after the document rather than after the app, and sharing the image export's
    // rules so the two land next to each other in a downloads folder.
    a.download = `${exportBaseName(documentName)}.${getFormat()}`;
    a.click();

    gaEvent("save_file", { label: getFormat() });
  };

  return (
    <Menu shadow="md" withArrow>
      <Menu.Target>
        <StyledToolElement title="File">
          <Flex align="center" gap={3}>
            <LuFile size={14} />
            File
            <LuChevronDown size={14} />
          </Flex>
        </StyledToolElement>
      </Menu.Target>
      <Menu.Dropdown>
        {/* Every item says what it moves, not just which direction: there are two exports
            now, so neither can be called "Export" on its own, and Import reads as its
            counterpart only if it is named the same way. */}
        <Menu.Item leftSection={<LuFolderOpen />} onClick={() => setVisible("ImportModal", true)}>
          Import Data
        </Menu.Item>
        <Menu.Item leftSection={<LuDownload />} onClick={handleSave}>
          Export Data
        </Menu.Item>
        <Menu.Item leftSection={<LuImageDown />} onClick={() => setVisible("DownloadModal", true)}>
          Export Image
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
