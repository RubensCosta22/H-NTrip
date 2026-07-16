/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { Archive, ChevronLeft, ChevronRight, Download, Heart, MapPin, PanelsTopLeft, Pencil, X } from "lucide-react";
import { archiveTripPhotoAction, setPhotoFavoriteAction, setTripCoverPhotoAction, updateTripPhotoAction } from "./actions";

type Photo = { id: string; original_filename: string; caption: string | null; taken_on: string | null; is_favorite: boolean; is_cover: boolean; location_name: string | null; location_latitude: number | null; location_longitude: number | null };
const formatDate = (date: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

export function PhotoGalleryViewer({ photos, tripId, destination }: { photos: Photo[]; tripId: string; destination: string }) {
  const [active, setActive] = useState<number | null>(null);
  const move = (step: number) => setActive((current) => current === null ? null : (current + step + photos.length) % photos.length);
  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowLeft") setActive((current) => current === null ? null : (current - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight") setActive((current) => current === null ? null : (current + 1) % photos.length);
    };
    document.addEventListener("keydown", onKey); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [active, photos.length]);
  const selected = active === null ? null : photos[active];

  return <><section className="photo-gallery" aria-label="Fotos da viagem">{photos.map((photo, index) => <article className={`photo-card ${photo.is_cover ? "cover" : ""}`} key={photo.id}>
    <div className="photo-media"><button className="photo-image-link" onClick={() => setActive(index)} type="button"><img alt={photo.caption || `Foto de ${destination}`} loading="lazy" src={`/api/photos/${photo.id}`} /></button>
    {photo.is_cover && <span className="photo-cover-badge"><PanelsTopLeft aria-hidden="true" size={14} /> Capa</span>}
    {photo.location_name && <span className="photo-location-badge"><MapPin aria-hidden="true" size={13} /> {photo.location_name}</span>}</div>
    <div className="photo-card-body"><div><strong>{photo.caption || "Sem legenda"}</strong><p>{photo.taken_on ? formatDate(photo.taken_on) : "Data não informada"}</p></div><div className="photo-actions"><form action={setPhotoFavoriteAction}><input name="tripId" type="hidden" value={tripId} /><input name="photoId" type="hidden" value={photo.id} /><input name="favorite" type="hidden" value={photo.is_favorite ? "false" : "true"} /><button className={photo.is_favorite ? "active" : ""} aria-label={photo.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} type="submit"><Heart size={17} fill={photo.is_favorite ? "currentColor" : "none"} /></button></form>{!photo.is_cover && <form action={setTripCoverPhotoAction}><input name="tripId" type="hidden" value={tripId} /><input name="photoId" type="hidden" value={photo.id} /><button aria-label="Usar como capa" type="submit"><PanelsTopLeft size={17} /></button></form>}<a aria-label={`Baixar ${photo.original_filename}`} href={`/api/photos/${photo.id}?download=1`}><Download size={17} /></a><form action={archiveTripPhotoAction}><input name="tripId" type="hidden" value={tripId} /><input name="photoId" type="hidden" value={photo.id} /><button aria-label="Arquivar foto" type="submit"><Archive size={17} /></button></form></div></div>
    <details className="metadata-editor"><summary><Pencil aria-hidden="true" size={15} /> Editar informações</summary><form action={updateTripPhotoAction}><input name="tripId" type="hidden" value={tripId} /><input name="photoId" type="hidden" value={photo.id} /><label>Legenda<input defaultValue={photo.caption ?? ""} maxLength={500} name="caption" /></label><label>Data<input defaultValue={photo.taken_on ?? ""} name="takenOn" type="date" /></label><label className="wide">Local<input defaultValue={photo.location_name ?? ""} maxLength={180} name="locationName" /></label><label>Latitude<input defaultValue={photo.location_latitude ?? ""} min="-90" max="90" step="0.000001" name="latitude" type="number" /></label><label>Longitude<input defaultValue={photo.location_longitude ?? ""} min="-180" max="180" step="0.000001" name="longitude" type="number" /></label><button className="app-primary-button wide" type="submit">Salvar alterações</button></form></details>
  </article>)}</section>{selected && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Visualização da foto"><button className="lightbox-close" onClick={() => setActive(null)} aria-label="Fechar"><X /></button><button className="lightbox-previous" onClick={() => move(-1)} aria-label="Foto anterior"><ChevronLeft /></button><figure><img src={`/api/photos/${selected.id}`} alt={selected.caption || `Foto de ${destination}`} /><figcaption><strong>{selected.caption || "Sem legenda"}</strong><span>{(active ?? 0) + 1} de {photos.length}</span></figcaption></figure><button className="lightbox-next" onClick={() => move(1)} aria-label="Próxima foto"><ChevronRight /></button></div>}</>;
}
