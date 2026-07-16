"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, BarChart3, BookOpen, Camera, CircleDollarSign, ClipboardCheck, FileText, History, LayoutDashboard, MapPinned, Route } from "lucide-react";

const sections = [
  { slug: "", label: "Resumo", icon: LayoutDashboard },
  { slug: "itinerary", label: "Roteiro", icon: Route },
  { slug: "finance", label: "Financeiro", icon: CircleDollarSign },
  { slug: "checklist", label: "Checklist", icon: ClipboardCheck },
  { slug: "places", label: "Locais", icon: MapPinned },
  { slug: "documents", label: "Documentos", icon: FileText },
  { slug: "photos", label: "Fotos", icon: Camera },
  { slug: "album", label: "Álbum", icon: BookOpen },
  { slug: "statistics", label: "Estatísticas", icon: BarChart3 },
  { slug: "activity", label: "Histórico", icon: History },
  { slug: "archived", label: "Arquivados", icon: Archive },
];

export function TripSectionNav({ tripId, tripName, destination }: { tripId: string; tripName: string; destination: string }) {
  const pathname = usePathname();
  const base = `/trips/${tripId}`;

  return <div className="trip-context-bar"><div className="trip-context-title"><strong>{tripName}</strong><span>{destination}</span></div><nav aria-label={`Seções de ${tripName}`}>{sections.map((section) => {
    const href = section.slug ? `${base}/${section.slug}` : base;
    const active = section.slug ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base;
    const Icon = section.icon;
    return <Link aria-current={active ? "page" : undefined} href={href} key={section.slug || "summary"}><Icon aria-hidden="true" size={16} /> {section.label}</Link>;
  })}</nav></div>;
}
