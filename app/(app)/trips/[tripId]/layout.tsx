import { notFound } from "next/navigation";
import { TripSectionNav } from "@/src/components/trip-section-nav";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export default async function TripWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { data: trip } = await supabase.from("trips").select("id, name, destination").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle();
  if (!trip) notFound();

  return <div className="trip-workspace-shell"><TripSectionNav tripId={trip.id} tripName={trip.name} destination={trip.destination} />{children}</div>;
}
