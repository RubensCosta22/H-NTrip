"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/client";
import type { SupabasePublicConfig } from "@/src/lib/supabase/config";
import { describeStorageUploadError } from "@/src/lib/supabase/storage-error";

const allowedImages: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const maxPhotoSize = 15 * 1024 * 1024;

export function PhotoUploadForm({ workspaceId, tripId, supabaseConfig }: { workspaceId: string; tripId: string; supabaseConfig: SupabasePublicConfig }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [progress, setProgress] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = Array.from(fileRef.current?.files ?? []);
    if (!files.length) return setMessage("Selecione ao menos uma foto.");
    if (files.length > 10) return setMessage("Envie no máximo 10 fotos por vez.");
    for (const file of files) {
      if (!allowedImages[file.type]) return setMessage(`${file.name}: use JPG, PNG ou WebP.`);
      if (file.size < 1 || file.size > maxPhotoSize) return setMessage(`${file.name}: cada foto deve ter até 15 MB.`);
    }

    const caption = String(form.get("caption") ?? "").trim();
    const takenOn = String(form.get("takenOn") ?? "");
    const locationName = String(form.get("locationName") ?? "").trim();
    const latitudeValue = String(form.get("latitude") ?? "").trim();
    const longitudeValue = String(form.get("longitude") ?? "").trim();
    if (caption.length > 500) return setMessage("A legenda deve ter até 500 caracteres.");
    if (takenOn && !/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) return setMessage("Revise a data da foto.");
    if (locationName.length > 180) return setMessage("O nome do local deve ter até 180 caracteres.");
    if (Boolean(latitudeValue) !== Boolean(longitudeValue)) return setMessage("Informe latitude e longitude juntas.");
    const latitude = latitudeValue ? Number(latitudeValue) : null;
    const longitude = longitudeValue ? Number(longitudeValue) : null;
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) return setMessage("A latitude deve estar entre -90 e 90.");
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return setMessage("A longitude deve estar entre -180 e 180.");

    setPending(true);
    setMessage(undefined);
    setProgress(`Enviando 1 de ${files.length}`);
    const supabase = createBrowserSupabaseClient(supabaseConfig);
    for (const [index, file] of files.entries()) {
      setProgress(`Enviando ${index + 1} de ${files.length}`);
      const storagePath = `${workspaceId}/${tripId}/${crypto.randomUUID()}.${allowedImages[file.type]}`;
      const { error: uploadError } = await supabase.storage.from("trip-photos").upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setPending(false); setProgress(undefined);
        return setMessage(`${index} foto(s) enviada(s). ${describeStorageUploadError(uploadError.message, "foto")}`);
      }
      const { data: attachedPhoto, error: attachError } = await supabase.rpc("attach_trip_photo", {
        target_trip_id: tripId, object_path: storagePath, photo_original_name: file.name.slice(0, 180),
        photo_mime_type: file.type, photo_size_bytes: file.size, photo_caption: caption, photo_taken_on: takenOn || null,
      });
      if (attachError) {
        await supabase.storage.from("trip-photos").remove([storagePath]);
        setPending(false); setProgress(undefined);
        return setMessage(`${index} foto(s) enviada(s). A próxima foto foi recusada pela validação segura.`);
      }
      if (attachedPhoto?.id && (locationName || latitude !== null)) {
        const { error: locationError } = await supabase.rpc("set_trip_photo_location", { target_photo_id: attachedPhoto.id, photo_location_name: locationName, photo_latitude: latitude, photo_longitude: longitude });
        if (locationError) { setPending(false); setProgress(undefined); return setMessage(`${index + 1} foto(s) enviada(s), mas a localização foi recusada.`); }
      }
    }

    formRef.current?.reset();
    setPending(false);
    setProgress(undefined);
    router.refresh();
  }

  return (
    <form className="photo-upload-form" onSubmit={handleSubmit} ref={formRef}>
      <label className="app-field photo-file-field"><span>Fotos <small>(até 10)</small></span><input accept="image/jpeg,image/png,image/webp" multiple ref={fileRef} required type="file" /></label>
      <label className="app-field"><span>Data <small>(opcional)</small></span><input name="takenOn" type="date" /></label>
      <label className="app-field photo-caption-field"><span>Legenda <small>(opcional)</small></span><input name="caption" maxLength={500} placeholder="Um momento que vale lembrar" /></label>
      <label className="app-field photo-location-field"><span>Local <small>(opcional)</small></span><input name="locationName" maxLength={180} placeholder="Ex.: Praça do Comércio" /></label>
      <label className="app-field"><span>Latitude <small>(opcional)</small></span><input name="latitude" type="number" min="-90" max="90" step="0.000001" inputMode="decimal" /></label>
      <label className="app-field"><span>Longitude <small>(opcional)</small></span><input name="longitude" type="number" min="-180" max="180" step="0.000001" inputMode="decimal" /></label>
      {message && <p className="app-form-message" role="alert">{message}</p>}
      {progress && <p className="photo-upload-progress" role="status">{progress}</p>}
      <button className="app-primary-button" disabled={pending} type="submit"><ImagePlus aria-hidden="true" size={18} /> {pending ? "Enviando…" : "Adicionar ao álbum"}</button>
    </form>
  );
}
