import { NextResponse } from "next/server";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { data: file } = await supabase
    .from("trip_document_files")
    .select("storage_path, original_filename, document_id")
    .eq("id", fileId)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (!file) return new NextResponse("Arquivo não encontrado.", { status: 404 });

  const { data: document } = await supabase
    .from("trip_documents")
    .select("id")
    .eq("id", file.document_id)
    .eq("workspace_id", member.workspaceId)
    .is("archived_at", null)
    .maybeSingle();
  if (!document) return new NextResponse("Arquivo não encontrado.", { status: 404 });

  const { data, error } = await supabase.storage
    .from("trip-documents")
    .createSignedUrl(file.storage_path, 60, { download: file.original_filename });
  if (error || !data?.signedUrl) return new NextResponse("Download indisponível.", { status: 503 });

  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
