"use client";

import { useMemo, useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";

type MapLocation = {
  id: string;
  title: string;
  location: string | null;
  latitude: number;
  longitude: number;
};

function mapUrls(location: MapLocation) {
  const delta = 0.012;
  const bbox = [
    location.longitude - delta,
    location.latitude - delta,
    location.longitude + delta,
    location.latitude + delta,
  ].join(",");
  const marker = `${location.latitude},${location.longitude}`;
  return {
    embed: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`,
    external: `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`,
  };
}

export function TripMap({ locations }: { locations: MapLocation[] }) {
  const [selectedId, setSelectedId] = useState(locations[0]?.id);
  const selected = locations.find((location) => location.id === selectedId) ?? locations[0];
  const urls = useMemo(() => selected ? mapUrls(selected) : undefined, [selected]);
  if (!selected || !urls) return null;

  return (
    <section className="trip-map" aria-labelledby="trip-map-title">
      <div className="section-heading"><div><p className="page-eyebrow">Visão geográfica</p><h2 id="trip-map-title">Locais do roteiro</h2></div><MapPin aria-hidden="true" /></div>
      <div className="trip-map-layout">
        <div className="trip-map-list" aria-label="Selecionar local no mapa">
          {locations.map((location) => <button aria-pressed={location.id === selected.id} key={location.id} onClick={() => setSelectedId(location.id)} type="button"><MapPin aria-hidden="true" size={16} /><span><strong>{location.title}</strong><small>{location.location || `${location.latitude}, ${location.longitude}`}</small></span></button>)}
        </div>
        <div className="trip-map-frame">
          <iframe loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups" src={urls.embed} title={`Mapa de ${selected.title}`} />
          <a href={urls.external} rel="noreferrer" target="_blank">Abrir no OpenStreetMap <ExternalLink aria-hidden="true" size={16} /></a>
        </div>
      </div>
      <p className="map-attribution">Mapa e dados © colaboradores do OpenStreetMap.</p>
    </section>
  );
}
