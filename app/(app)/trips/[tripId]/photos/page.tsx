import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, HardDrive, Images } from "lucide-react";
import { PhotoUploadForm } from "@/src/features/photos/photo-upload-form";
import { PhotoGalleryViewer } from "@/src/features/photos/photo-gallery-viewer";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { getSupabasePublicConfig } from "@/src/lib/supabase/config";
import { ListPagination } from "@/src/components/list-pagination";

export const dynamic = "force-dynamic";
type PhotosPageProps = { params: Promise<{ tripId: string }>; searchParams: Promise<{ photo?: string; error?: string; q?: string; favorite?: string; page?: string }> };

export default async function PhotosPage({ params, searchParams }: PhotosPageProps) {
  const { tripId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const supabaseConfig = getSupabasePublicConfig();
  const notices = await searchParams;
  const q = (notices.q ?? "").replace(/[,%()]/g, " ").trim().slice(0, 80);
  const favorite = notices.favorite === "1";
  const pageSize = 12; const requestedPage = Math.max(1, Number.parseInt(notices.page ?? "1", 10) || 1);
  let photoQuery = supabase.from("trip_photos").select("id, original_filename, size_bytes, caption, taken_on, created_at, is_favorite, is_cover, location_name, location_latitude, location_longitude", { count: "exact" }).eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null);
  if (q) photoQuery = photoQuery.or(`caption.ilike.%${q}%,location_name.ilike.%${q}%,original_filename.ilike.%${q}%`);
  if (favorite) photoQuery = photoQuery.eq("is_favorite", true);
  const [{ data: trip }, { data: photos, error, count }, { data: storageRows }] = await Promise.all([
    supabase.from("trips").select("id, name, destination").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    photoQuery.order("is_cover", { ascending: false }).order("is_favorite", { ascending: false }).order("taken_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).range((requestedPage - 1) * pageSize, requestedPage * pageSize - 1),
    supabase.from("trip_photos").select("size_bytes").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null),
  ]);
  if (!trip) notFound();
  const totalBytes = (storageRows ?? []).reduce((sum, photo) => sum + Number(photo.size_bytes), 0); const total = count ?? 0; const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));

  return <main className="app-page photos-page">
    <div className="page-heading compact"><Link href={`/trips/${trip.id}`} className="back-link"><ArrowLeft aria-hidden="true" size={18} /> {trip.name}</Link><p className="page-eyebrow">Memórias privadas</p><h1>Álbum da viagem</h1><p>Reúna os momentos de {trip.destination} em uma galeria acessível somente ao workspace.</p></div>
    {notices.photo === "archived" && <p className="success-banner" role="status">Foto arquivada.</p>}
    {notices.photo === "updated" && <p className="success-banner" role="status">Informações da foto atualizadas.</p>}
    {(notices.error || error) && <p className="app-form-message" role="alert">Não foi possível concluir a operação.</p>}

    <section className="photo-summary"><article><Images aria-hidden="true" /><div><strong>{total}</strong><span>fotos encontradas</span></div></article><article><HardDrive aria-hidden="true" /><div><strong>{(totalBytes / 1024 / 1024).toFixed(1)} MB</strong><span>armazenamento utilizado</span></div></article></section>
    <form className="list-filters" method="get"><label><span>Buscar fotos</span><input defaultValue={q} maxLength={80} name="q" placeholder="Legenda, local ou arquivo" /></label><label className="filter-check"><input defaultChecked={favorite} name="favorite" type="checkbox" value="1" /> Somente favoritas</label><button className="app-secondary-button" type="submit">Filtrar</button>{(q || favorite) && <Link href={`/trips/${trip.id}/photos`}>Limpar</Link>}</form>
    <section className="photo-upload-panel"><div className="section-heading"><div><p className="page-eyebrow">Nova memória</p><h2>Adicionar foto</h2></div><Camera aria-hidden="true" /></div><p className="section-copy">JPG, PNG ou WebP de até 15 MB. A visualização usa links privados temporários.</p><PhotoUploadForm workspaceId={member.workspaceId} tripId={trip.id} supabaseConfig={supabaseConfig} /></section>

    {photos?.length ? <PhotoGalleryViewer photos={photos} tripId={trip.id} destination={trip.destination} /> : <section className="photo-gallery"><div className="empty-state photo-empty"><Camera aria-hidden="true" /><h2>{q || favorite ? "Nenhuma foto encontrada" : "O álbum ainda está vazio"}</h2><p>{q || favorite ? "Altere ou limpe os filtros para ver outras fotos." : "Adicione a primeira foto para começar a guardar suas memórias."}</p></div></section>}
    <ListPagination page={page} total={total} pageSize={pageSize} pathname={`/trips/${trip.id}/photos`} params={{ q, favorite: favorite ? "1" : undefined }} />
  </main>;
}
