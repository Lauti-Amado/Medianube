
"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

export interface Coordinates {
  latitud: number;
  longitud: number;
}

interface LocationPickerProps {
  value: Coordinates | null;
  onChange: (coordinates: Coordinates) => void;
  city: string;
}

const markerIcon = L.icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DEFAULT_POSITION: Coordinates = {
  latitud: -34.9214,
  longitud: -57.9544,
};

function MapEvents({
  onChange,
}: {
  onChange: (coordinates: Coordinates) => void;
}) {
  useMapEvents({
    click(event) {
      onChange({
        latitud: event.latlng.lat,
        longitud: event.latlng.lng,
      });
    },
  });

  return null;
}

function MapCenter({
  position,
}: {
  position: Coordinates;
}) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([position.latitud, position.longitud], 15);
  }, [position, map]);

  return null;
}

export default function LocationPicker({
  value,
  onChange,
  city,
}: LocationPickerProps) {
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const position = value ?? DEFAULT_POSITION;

  async function searchCity() {
    if (!city.trim()) {
      setSearchError("Primero ingresá una ciudad.");
      return;
    }

    setSearching(true);
    setSearchError("");

    try {
      const params = new URLSearchParams({
        q: city.trim(),
        format: "jsonv2",
        limit: "1",
        countrycodes: "ar",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("No se pudo realizar la búsqueda.");
      }

      const results = await response.json();

      if (!results.length) {
        setSearchError("No encontramos esa ciudad. Revisá el nombre.");
        return;
      }

      onChange({
        latitud: Number(results[0].lat),
        longitud: Number(results[0].lon),
      });
    } catch {
      setSearchError("Ocurrió un error al buscar la ciudad.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          onClick={searchCity}
          disabled={searching || !city.trim()}
          className="btn btn-danger"
        >
          {searching ? "buscando..." : "buscar ciudad en el mapa"}
        </button>
      </div>

      {searchError && (
        <p style={{ color: "var(--color-danger)", fontSize: "12px" }}>
          {searchError}
        </p>
      )}

      <div
        style={{
          width: "100%",
          height: "350px",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid var(--color-border)",
        }}
      >
        <MapContainer
          center={[position.latitud, position.longitud]}
          zoom={value ? 15 : 12}
          scrollWheelZoom
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapEvents onChange={onChange} />
          <MapCenter position={position} />

          {value && (
            <Marker
              position={[value.latitud, value.longitud]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend(event) {
                  const marker = event.target;
                  const coordinates = marker.getLatLng();

                  onChange({
                    latitud: coordinates.lat,
                    longitud: coordinates.lng,
                  });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <p
        style={{
          fontSize: "12px",
          color: "var(--color-text-secondary)",
          margin: 0,
        }}
      >
        Hacé clic en el mapa para colocar el marcador o arrastralo para ajustar
        la ubicación exacta de tu negocio.
      </p>

      {value && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor: "var(--color-accent-tint)",
            fontSize: "12px",
          }}
        >
          <strong>Ubicación seleccionada</strong>
          <p style={{ margin: "5px 0 0" }}>
            Latitud: {value.latitud.toFixed(6)}
            <br />
            Longitud: {value.longitud.toFixed(6)}
          </p>
        </div>
      )}
    </div>
  );
}
