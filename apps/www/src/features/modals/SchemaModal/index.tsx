import React from "react";
import type { ModalProps } from "@mantine/core";
import { Stack, Modal, Button, Text, Anchor, Code, Group, Paper } from "@mantine/core";
import Editor from "@monaco-editor/react";
import { event as gaEvent } from "nextjs-google-analytics";
import { toast } from "react-hot-toast";
import { VscLinkExternal } from "react-icons/vsc";
import { defineCatppuccinThemes, MONACO_THEME } from "../../../lib/utils/monacoTheme";
import useConfig from "../../../store/useConfig";
import useFile from "../../../store/useFile";

export const SchemaModal = ({ opened, onClose }: ModalProps) => {
  const setJsonSchema = useFile(state => state.setJsonSchema);
  const darkmodeEnabled = useConfig(state =>
    state.darkmodeEnabled ? MONACO_THEME.dark : MONACO_THEME.light
  );
  const [schema, setSchema] = React.useState(
    JSON.stringify(
      {
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "Product",
        description: "A product from catalog",
        type: "object",
        properties: {
          id: {
            description: "The unique identifier for a product",
            type: "integer",
          },
        },
        required: ["id"],
      },
      null,
      2
    )
  );

  const onApply = () => {
    try {
      const parsedSchema = JSON.parse(schema);
      setJsonSchema(parsedSchema);

      gaEvent("apply_json_schema");
      toast.success("Applied schema!");
      onClose();
    } catch {
      toast.error("Invalid Schema");
    }
  };

  const onClear = () => {
    setJsonSchema(null);
    setSchema("");
    toast("Disabled JSON Schema");
    onClose();
  };

  return (
    <Modal title="JSON Schema" size="lg" opened={opened} onClose={onClose} centered>
      <Stack>
        <Text fz="sm">
          Draft-07 schemas only. JSON and YAML show violations inline in the editor; XML and CSV
          list them in the pane header, addressed by JSON Pointer.
        </Text>
        <Text fz="sm" c="dimmed">
          XML is validated after conversion to JSON, not as XML. Attributes become keys prefixed
          with <Code>$</Code>, and a single child element is an object while repeated ones are an
          array, so write the schema against that shape.
        </Text>
        <Anchor
          fz="sm"
          target="_blank"
          href="https://niem.github.io/json/sample-schema/"
          rel="noopener noreferrer"
        >
          View Examples <VscLinkExternal />
        </Anchor>
        <Paper withBorder radius="sm" style={{ overflow: "hidden" }}>
          <Editor
            value={schema ?? ""}
            theme={darkmodeEnabled}
            beforeMount={defineCatppuccinThemes}
            onChange={e => setSchema(e!)}
            height={300}
            language="json"
            options={{
              formatOnPaste: true,
              tabSize: 2,
              formatOnType: true,
              scrollBeyondLastLine: false,
              stickyScroll: { enabled: false },
              minimap: { enabled: false },
            }}
          />
        </Paper>
        <Group p="0" justify="right">
          <Button variant="subtle" color="gray" onClick={onClear} disabled={!schema}>
            Clear
          </Button>
          <Button variant="default" onClick={onApply} disabled={!schema}>
            Apply
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
