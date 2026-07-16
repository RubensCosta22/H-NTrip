"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/client";
import type { SupabasePublicConfig } from "@/src/lib/supabase/config";
import { describeStorageUploadError } from "@/src/lib/supabase/storage-error";

const allowedFiles: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const maxFileSize = 10 * 1024 * 1024;

type DocumentFileFormProps = {
  workspaceId: string;
  tripId: string;
  documentId: string;
  supabaseConfig: SupabasePublicConfig;
};

export function DocumentFileForm({ workspaceId, tripId, documentId, supabaseConfig }: DocumentFileFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const file = inputRef.current?.files?.[0];
    if (!file) return setMessage("Selecione um arquivo.");
    const extension = allowedFiles[file.type];
    if (!extension) return setMessage("Use PDF, JPG, PNG ou WebP.");
    if (file.size < 1 || file.size > maxFileSize) return setMessage("O arquivo deve ter até 10 MB.");

    setPending(true);
    setMessage(undefined);
    const supabase = createBrowserSupabaseClient(supabaseConfig);
    const storagePath = `${workspaceId}/${tripId}/${documentId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("trip-documents")
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setPending(false);
      return setMessage(describeStorageUploadError(uploadError.message, "arquivo"));
    }

    const { error: attachError } = await supabase.rpc("attach_trip_document_file", {
      target_document_id: documentId,
      object_path: storagePath,
      file_original_name: file.name.slice(0, 180),
      file_mime_type: file.type,
      file_size_bytes: file.size,
    });
    if (attachError) {
      await supabase.storage.from("trip-documents").remove([storagePath]);
      setPending(false);
      return setMessage("O arquivo foi recusado pela validação segura.");
    }

    formElement.reset();
    setPending(false);
    router.refresh();
  }

  return (
    <form className="document-upload" onSubmit={handleSubmit}>
      <label><span className="sr-only">Selecionar arquivo</span><input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" /></label>
      <button disabled={pending} type="submit"><Upload aria-hidden="true" size={16} /> {pending ? "Enviando…" : "Enviar arquivo"}</button>
      {message && <small role="alert">{message}</small>}
    </form>
  );
}
