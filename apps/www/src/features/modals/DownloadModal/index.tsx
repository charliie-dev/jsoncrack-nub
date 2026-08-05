import React from "react";
import type { ModalProps } from "@mantine/core";
import {
  ColorPicker,
  TextInput,
  SegmentedControl,
  Group,
  Modal,
  Button,
  Divider,
  ColorInput,
} from "@mantine/core";
import { toBlob, toJpeg, toPng, toSvg } from "html-to-image";
import { event as gaEvent } from "nextjs-google-analytics";
import toast from "react-hot-toast";
import { FiCopy, FiDownload } from "react-icons/fi";
import {
  defaultExportBackground,
  EXPORT_SWATCHES,
  exportBaseName,
  exportFileName,
  IMAGE_FORMATS,
  type ImageFormat,
} from "../../../lib/utils/exportImage";
import useConfig from "../../../store/useConfig";
import useFile from "../../../store/useFile";

const RENDERERS: Record<ImageFormat, typeof toPng> = {
  png: toPng,
  jpeg: toJpeg,
  svg: toSvg,
};

function downloadURI(uri: string, name: string) {
  const link = document.createElement("a");

  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * The element the image is taken from.
 *
 * reaflow's canvas, not the wrapper around it: the wrapper carries the dot grid, which is
 * texture for working on screen and clutter in an exported image, and the wrapper is also
 * the size of the viewport rather than of the graph. The canvas is sized to the laid-out
 * graph, so what comes out is the whole diagram whatever the camera happens to be showing.
 */
const getExportElement = () => document.querySelector<HTMLElement>(".jsoncrack-canvas");

export const DownloadModal = ({ opened, onClose }: ModalProps) => {
  const darkmodeEnabled = useConfig(state => state.darkmodeEnabled);
  const documentName = useFile(state => state.documentName);

  const [extension, setExtension] = React.useState<ImageFormat>("png");
  const [fileDetails, setFileDetails] = React.useState({
    filename: "",
    backgroundColor: defaultExportBackground(darkmodeEnabled),
    quality: 1,
  });

  // Every modal is mounted for the life of the app, so initial state is whatever was true
  // at start-up — before any document was loaded or the theme was touched. Re-seeding on
  // open is what makes the name follow the document and the background follow the canvas.
  React.useEffect(() => {
    if (!opened) return;
    setFileDetails(current => ({
      ...current,
      filename: exportBaseName(documentName),
      backgroundColor: defaultExportBackground(darkmodeEnabled),
    }));
  }, [opened, documentName, darkmodeEnabled]);

  const clipboardImage = async () => {
    try {
      toast.loading("Copying to clipboard...", { id: "toastClipboard" });

      const imageElement = getExportElement();
      if (!imageElement) {
        toast.error("Canvas not found.");
        return;
      }
      const imageOptions = {
        quality: fileDetails.quality,
        backgroundColor: fileDetails.backgroundColor,
        skipFonts: true,
      };

      const blob = await toBlob(imageElement, imageOptions);

      if (!blob) return;

      await navigator.clipboard?.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);

      toast.success("Copied to clipboard");
      gaEvent("clipboard_img");
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") {
        toast.error(
          "Clipboard write permission denied. Please allow clipboard access in your browser settings."
        );
      } else {
        toast.error("Failed to copy to clipboard");
      }
    } finally {
      toast.dismiss("toastClipboard");
      onClose();
    }
  };

  const exportAsImage = async () => {
    try {
      toast.loading("Downloading...", { id: "toastDownload" });

      const imageElement = getExportElement();
      if (!imageElement) {
        toast.error("Canvas not found.");
        return;
      }
      const imageOptions = {
        quality: fileDetails.quality,
        backgroundColor: fileDetails.backgroundColor,
        skipFonts: true,
      };

      const dataURI = await RENDERERS[extension](imageElement, imageOptions);

      downloadURI(dataURI, exportFileName(fileDetails.filename, extension));
      gaEvent("download_img", { label: extension });
    } catch {
      toast.error("Failed to download image!");
    } finally {
      toast.dismiss("toastDownload");
      onClose();
    }
  };

  const updateDetails = (key: keyof typeof fileDetails, value: string | number) =>
    setFileDetails({ ...fileDetails, [key]: value });

  return (
    <Modal opened={opened} onClose={onClose} title="Export Image" centered>
      <TextInput
        label="File name"
        value={fileDetails.filename}
        onChange={e => updateDetails("filename", e.target.value)}
        rightSection={`.${extension}`}
        rightSectionWidth={54}
        mb="lg"
      />
      <SegmentedControl
        value={extension}
        onChange={value => setExtension(value as ImageFormat)}
        fullWidth
        data={IMAGE_FORMATS.map(format => ({ label: format.toUpperCase(), value: format }))}
        mb="lg"
      />
      <ColorInput
        label="Background"
        value={fileDetails.backgroundColor}
        onChange={color => updateDetails("backgroundColor", color)}
        withEyeDropper={false}
        mb="lg"
      />
      <ColorPicker
        format="rgba"
        value={fileDetails.backgroundColor}
        onChange={color => updateDetails("backgroundColor", color)}
        swatches={EXPORT_SWATCHES}
        withPicker={false}
        fullWidth
      />
      <Divider my="xs" />
      <Group justify="right">
        {/* Default variant, so the two read as secondary and primary rather than as two
            equally weighted choices. The download is what the dialog is for. */}
        <Button variant="default" leftSection={<FiCopy />} onClick={clipboardImage}>
          Clipboard
        </Button>
        <Button leftSection={<FiDownload />} onClick={exportAsImage}>
          Download
        </Button>
      </Group>
    </Modal>
  );
};
