import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { TripSectionNav } from "@/src/components/trip-section-nav";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export default async function TripWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const [{ data: trip }, { data: coverPhoto }] = await Promise.all([
    supabase.from("trips").select("id, name, destination").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("trip_photos").select("id").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).eq("is_cover", true).is("archived_at", null).maybeSingle(),
  ]);
  if (!trip) notFound();

  const backgroundStyle = coverPhoto
    ? ({ "--trip-background-image": `url("/api/photos/${coverPhoto.id}")` } as CSSProperties)
    : undefined;

  return (
    <div className={`trip-workspace-shell${coverPhoto ? " trip-workspace-shell-with-background" : ""}`} style={backgroundStyle}>
      <div className="trip-workspace-background" aria-hidden="true" />
      <TripSectionNav tripId={trip.id} tripName={trip.name} destination={trip.destination} />
      <div className="trip-workspace-content">{children}</div>
    </div>
  );
}
