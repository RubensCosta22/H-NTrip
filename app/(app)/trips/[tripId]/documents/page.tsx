import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, CalendarClock, Download, FileCheck2, FileText, Pencil, ShieldCheck, UserRound } from "lucide-react";
import { DocumentForm } from "@/src/features/documents/document-form";
import { DocumentFileForm } from "@/src/features/documents/document-file-form";
import { archiveTripDocumentAction, updateTripDocumentAction } from "@/src/features/documents/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { getSupabasePublicConfig } from "@/src/lib/supabase/config";
import { ListPagination } from "@/src/components/list-pagination";

export const dynamic = "force-dynamic";

type DocumentsPageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ document?: string; error?: string; q?: string; category?: string; page?: string }>;
};

const categoryLabels: Record<string, string> = {
  identity: "Identificação",
  reservation: "Reserva",
  insurance: "Seguro",
  transport: "Transporte",
  health: "Saúde",
  other: "Outro",
};

const formatDate = (date: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

export default async function DocumentsPage({ params, searchParams }: DocumentsPageProps) {
  const { tripId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const supabaseConfig = getSupabasePublicConfig();
  const notices = await searchParams; const q = (notices.q ?? "").replace(/[,%()]/g, " ").trim().slice(0, 80);
  const category = Object.hasOwn(categoryLabels, notices.category ?? "") ? notices.category! : "";
  const pageSize = 12; const requestedPage = Math.max(1, Number.parseInt(notices.page ?? "1", 10) || 1);
  let documentQuery = supabase.from("trip_documents").select("id, title, category, holder_name, issued_on, expires_on, notes", { count: "exact" }).eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null);
  if (q) documentQuery = documentQuery.or(`title.ilike.%${q}%,holder_name.ilike.%${q}%,notes.ilike.%${q}%`);
  if (category) documentQuery = documentQuery.eq("category", category);
  const [{ data: trip }, { data: documents, error, count }] = await Promise.all([
    supabase.from("trips").select("id, name").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    documentQuery.order("expires_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }).range((requestedPage - 1) * pageSize, requestedPage * pageSize - 1),
  ]);
  if (!trip) notFound();
  const documentIds = (documents ?? []).map((document) => document.id);
  const { data: files } = documentIds.length ? await supabase.from("trip_document_files").select("id, document_id, original_filename, mime_type, size_bytes").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).in("document_id", documentIds).order("created_at", { ascending: true }) : { data: [] };
  const total = count ?? 0; const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));

  const today = new Date().toISOString().slice(0, 10);
  const warningDate = new Date();
  warningDate.setUTCDate(warningDate.getUTCDate() + 60);
  const warningLimit = warningDate.toISOString().slice(0, 10);
  const expired = documents?.filter((document) => document.expires_on && document.expires_on < today).length ?? 0;
  const expiring = documents?.filter((document) => document.expires_on && document.expires_on >= today && document.expires_on <= warningLimit).length ?? 0;
  const successMessage = notices.document === "added" ? "Documento adicionado." : notices.document === "archived" ? "Documento arquivado." : notices.document === "updated" ? "Documento atualizado." : undefined;
  const filesByDocument = new Map<string, Array<{ id: string; document_id: string; original_filename: string; mime_type: string; size_bytes: number }>>();
  for (const file of files ?? []) { const group = filesByDocument.get(file.document_id) ?? []; group.push(file); filesByDocument.set(file.document_id, group); }

  return (
    <main className="app-page documents-page">
      <div className="page-heading compact"><Link href={`/trips/${trip.id}`} className="back-link"><ArrowLeft aria-hidden="true" size={18} /> {trip.name}</Link><p className="page-eyebrow">Organização segura</p><h1>Documentos da viagem</h1><p>Centralize validade e observações sem registrar senhas ou dados bancários.</p></div>
      {successMessage && <p className="success-banner" role="status">{successMessage}</p>}
      {(notices.error || error) && <p className="app-form-message" role="alert">Não foi possível concluir a operação.</p>}

      <section className="document-summary" aria-label="Resumo dos documentos">
        <article><FileCheck2 aria-hidden="true" /><div><strong>{total}</strong><span>documentos encontrados</span></div></article>
        <article className={expiring ? "warning" : ""}><CalendarClock aria-hidden="true" /><div><strong>{expiring}</strong><span>vencem em até 60 dias</span></div></article>
        <article className={expired ? "danger" : ""}><FileText aria-hidden="true" /><div><strong>{expired}</strong><span>documentos vencidos</span></div></article>
      </section>
      <form className="list-filters" method="get"><label><span>Buscar documentos</span><input defaultValue={q} maxLength={80} name="q" placeholder="Título, titular ou observação" /></label><label><span>Categoria</span><select defaultValue={category} name="category"><option value="">Todas</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="app-secondary-button" type="submit">Filtrar</button>{(q || category) && <Link href={`/trips/${trip.id}/documents`}>Limpar</Link>}</form>

      <section className="new-document-panel">
        <div className="section-heading"><div><p className="page-eyebrow">Novo registro</p><h2>Adicionar documento</h2></div><ShieldCheck aria-hidden="true" /></div>
        <p className="section-copy">Os metadados ficam isolados por workspace. Depois de criar o registro, envie PDFs ou imagens ao bucket privado.</p>
        <DocumentForm tripId={trip.id} />
      </section>
      <ListPagination page={page} total={total} pageSize={pageSize} pathname={`/trips/${trip.id}/documents`} params={{ q, category }} />

      <section className="document-grid" aria-label="Documentos ativos">
        {documents?.length ? documents.map((document) => {
          const documentFiles = filesByDocument.get(document.id) ?? [];
          const isExpired = Boolean(document.expires_on && document.expires_on < today);
          const isExpiring = Boolean(document.expires_on && document.expires_on >= today && document.expires_on <= warningLimit);
          return <article className={`document-card ${isExpired ? "expired" : isExpiring ? "expiring" : ""}`} key={document.id}>
            <header><span>{categoryLabels[document.category] ?? "Documento"}</span><FileText aria-hidden="true" /></header>
            <h2>{document.title}</h2>
            {document.holder_name && <p><UserRound aria-hidden="true" size={15} /> {document.holder_name}</p>}
            <div className="document-dates">{document.issued_on && <span>Emitido em <strong>{formatDate(document.issued_on)}</strong></span>}{document.expires_on && <span>Validade <strong>{formatDate(document.expires_on)}</strong></span>}</div>
            {isExpired && <strong className="document-alert">Documento vencido</strong>}{isExpiring && <strong className="document-alert">Validade próxima</strong>}
            {document.notes && <small>{document.notes}</small>}
            <div className="document-files">{documentFiles.map((file) => <a href={`/api/documents/${file.id}/download`} key={file.id}><Download aria-hidden="true" size={15} /><span>{file.original_filename}</span><small>{(Number(file.size_bytes) / 1024 / 1024).toFixed(1)} MB</small></a>)}</div>
            <DocumentFileForm workspaceId={member.workspaceId} tripId={trip.id} documentId={document.id} supabaseConfig={supabaseConfig} />
            <details className="metadata-editor"><summary><Pencil aria-hidden="true" size={15} /> Editar informações</summary><form action={updateTripDocumentAction}><input name="tripId" type="hidden" value={trip.id} /><input name="documentId" type="hidden" value={document.id} /><label className="wide">Documento<input defaultValue={document.title} maxLength={140} name="title" required /></label><label>Categoria<select defaultValue={document.category} name="category"><option value="identity">Identificação</option><option value="reservation">Reserva</option><option value="insurance">Seguro</option><option value="transport">Transporte</option><option value="health">Saúde</option><option value="other">Outro</option></select></label><label>Titular<input defaultValue={document.holder_name ?? ""} maxLength={120} name="holderName" /></label><label>Emissão<input defaultValue={document.issued_on ?? ""} name="issuedOn" type="date" /></label><label>Validade<input defaultValue={document.expires_on ?? ""} name="expiresOn" type="date" /></label><label className="wide">Observações<textarea defaultValue={document.notes ?? ""} maxLength={1000} name="notes" rows={3} /></label><button className="app-primary-button wide" type="submit">Salvar alterações</button></form></details>
            <form action={archiveTripDocumentAction}><input name="tripId" type="hidden" value={trip.id} /><input name="documentId" type="hidden" value={document.id} /><button className="danger-outline" type="submit"><Archive aria-hidden="true" size={16} /> Arquivar</button></form>
          </article>;
        }) : <div className="empty-state document-empty"><FileText aria-hidden="true" /><h2>{q || category ? "Nenhum documento encontrado" : "Nenhum documento registrado"}</h2><p>{q || category ? "Altere ou limpe os filtros para ver outros documentos." : "Adicione passaportes, seguros, reservas e comprovantes importantes."}</p></div>}
      </section>
    </main>
  );
}
