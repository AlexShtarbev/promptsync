import { useState, useCallback, type DragEvent } from "react";

interface Props {
  slug: string;
  code: string;
  children: React.ReactNode;
  onUploaded?: () => void;
}

export function DropZone({ slug, code, children, onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);

      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;

      setUploading(true);
      try {
        const res = await fetch(`/api/assets/${slug}/shots/${code}/image/upload`, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const result = await res.json();
        if (result.ok) onUploaded?.();
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setUploading(false);
      }
    },
    [slug, code, onUploaded]
  );

  return (
    <div
      className={`dropzone ${dragging ? "dropzone-active" : ""} ${uploading ? "dropzone-uploading" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {dragging && <div className="dropzone-overlay">Drop image for {code}</div>}
      {uploading && <div className="dropzone-overlay uploading">Uploading...</div>}
    </div>
  );
}
