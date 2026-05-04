import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export const DEFAULT_MAP_LAT = 23.0456;
export const DEFAULT_MAP_LNG = 72.5271;
export const DEFAULT_MAP_ADDRESS = '1st Floor, D Block, Satyam Corporate Square, Sindhu Bhavan Rd, Bodakdev, Ahmedabad, Gujarat 380054';

export default function EventMap({ lat, lng, address, label }) {
  const mapLat = Number(lat) || DEFAULT_MAP_LAT;
  const mapLng = Number(lng) || DEFAULT_MAP_LNG;
  const mapAddress = address || DEFAULT_MAP_ADDRESS;

  return (
    <div className="event-map-wrap">
      <MapContainer
        center={[mapLat, mapLng]}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: '280px', width: '100%', zIndex: 0 }}
        key={`map-${mapLat}-${mapLng}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Marker position={[mapLat, mapLng]}>
          <Popup maxWidth={220}>
            {label ? <strong style={{ display: 'block', marginBottom: 4 }}>{label}</strong> : null}
            <span style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>{mapAddress}</span>
          </Popup>
        </Marker>
      </MapContainer>
      <div className="event-map-footer">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6c0-2.485-2.015-4.5-4.5-4.5zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" fill="currentColor" opacity="0.5"/>
        </svg>
        <span>{mapAddress}</span>
      </div>
    </div>
  );
}
