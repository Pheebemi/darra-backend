"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Heading2 } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] px-4 py-3 text-sm text-foreground focus:outline-none prose prose-sm max-w-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  const toolbarBtn = (active: boolean, onClick: () => void, label: React.ReactNode) => (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`rounded p-1.5 transition-colors ${
        active
          ? "bg-[#3800ff] text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      title={typeof label === "string" ? label : undefined}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-xl border border-input focus-within:ring-2 focus-within:ring-[#3800ff] focus-within:border-[#3800ff] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5">
        {toolbarBtn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold className="h-3.5 w-3.5" />)}
        {toolbarBtn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic className="h-3.5 w-3.5" />)}
        {toolbarBtn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="h-3.5 w-3.5" />)}
        {toolbarBtn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <List className="h-3.5 w-3.5" />)}
        {toolbarBtn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="h-3.5 w-3.5" />)}
      </div>
      {/* Editor area */}
      <div className="bg-background">
        {!editor.getText() && (
          <p className="pointer-events-none absolute px-4 py-3 text-sm text-muted-foreground select-none" aria-hidden>
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
