import { useRef, useCallback } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { registerUsdaLanguage, USDA_LANGUAGE_ID } from '../languages/usda';

const DEFAULT_USDA_CONTENT = `#usda 1.0
(
    defaultPrim = "World"
)

def Xform "World"
{
    def Sphere "MySphere"
    {
        double radius = 1.0
        color3f[] primvars:displayColor = [(1.0, 0.0, 0.0)]
    }
}
`;

interface UsdaEditorProps {
  initialValue?: string;
  onSave?: (content: string) => void;
  onChange?: (content: string | undefined) => void;
}

export function UsdaEditor({
  initialValue = DEFAULT_USDA_CONTENT,
  onSave,
  onChange,
}: UsdaEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    registerUsdaLanguage(monaco);
  }, []);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // Add save action (Ctrl+S / Cmd+S)
      editor.addAction({
        id: 'save-usda',
        label: 'Save USDA',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: (ed) => {
          const content = ed.getValue();
          onSave?.(content);
        },
      });

      // Focus the editor
      editor.focus();
    },
    [onSave]
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      onChange?.(value);
    },
    [onChange]
  );

  return (
    <Editor
      height="100%"
      defaultLanguage={USDA_LANGUAGE_ID}
      defaultValue={initialValue}
      theme="usda-dark"
      beforeMount={handleBeforeMount}
      onMount={handleEditorMount}
      onChange={handleChange}
      options={{
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
        fontLigatures: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
        guides: {
          bracketPairs: true,
          indentation: true,
        },
        lineNumbers: 'on',
        wordWrap: 'off',
        folding: true,
        foldingStrategy: 'indentation',
      }}
    />
  );
}

export default UsdaEditor;
