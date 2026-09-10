/**
 * Leaflet (the raster fallback engine) ships its stylesheet as a plain CSS
 * file. The bundler and Next understand a CSS side-effect import; `tsc`
 * needs this one line to agree.
 */
declare module 'leaflet/dist/leaflet.css';
