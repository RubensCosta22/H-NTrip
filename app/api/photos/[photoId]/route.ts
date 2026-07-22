import { NextResponse } from "next/server";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { data: photo } = await supabase.from("trip_photos")
    .select("storage_path, original_filename")
    .eq("id", photoId).eq("workspace_id", member.workspaceId).is("archived_at", null).maybeSingle();
  if (!photo) return new NextResponse("Foto não encontrada.", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data, error } = await supabase.storage.from("trip-photos")
    .createSignedUrl(photo.storage_path, 60, download ? { download: photo.original_filename } : undefined);
  if (error || !data?.signedUrl) return new NextResponse("Imagem indisponível.", { status: 503 });

  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
