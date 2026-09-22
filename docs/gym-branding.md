# Image-led cards and gym branding

## Where to find it

Gym owners: open `/g/{slug}/console` → **Settings** → **Brand**. Changes remain drafts until **Publish changes**. The same hero/gallery components render both the studio preview and public storefront. Cloud writes use the existing tenant document and owner-only Firestore permissions; demo changes remain session-only.

### Branding controls

- Gym name, tagline, description, palette and custom accent (existing controls).
- Import a PNG/JPEG/WebP **logo file**, or keep using an HTTPS logo URL. Imported images take precedence over the URL until removed.
- Rounded, circular or square logo frame. A name-derived monogram appears when no usable logo exists.
- Split, banner or minimal hero layout.
- Four bundled cover-art choices, an optional custom HTTPS cover, and top/center/bottom crop focus.
- Custom membership-button label, always pointing to the gym’s existing pricing section.
- Eight selectable amenities and up to three public HTTPS gallery photos.
- Brand-colored booking/membership action buttons, with automatically selected black/white foreground. Body and link colors retain the application’s theme contrast.

### Logo handling

Files are decoded and re-encoded in the browser, bounded to 256 px and a **32 KiB data-URL string**. Source files must be PNG, JPEG or WebP and no larger than 4 MiB. Metadata and animation are not retained. SVG and document uploads are refused. This is intentionally a small-logo import, not a general file-storage service.

The resulting raster is stored in `gyms/{slug}.branding.logoData` only when the owner publishes. It works with existing Firestore sync; there is no new Storage bucket, provider credential or public upload endpoint. Logos are public branding, not private account files. Clearing an imported logo and publishing removes it from the live gym document (ordinary infrastructure backup policies are separate).

The rules bound raster type/length, supported layouts, colors, gallery URL schemes, amenity values and text lengths. Deploy the updated **firestore.rules** and **firestore.indexes.json** alongside the UI. The logo data field is exempted from indexing because it is never queried. Existing typed branding documents need no backfill.

## Visual changes

- Gym directory and admin registry cards now have cover art and recognizable logo badges.
- Published workout cards have image headers, useful duration/type badges and image fallbacks. Content managers can set a licensed HTTPS **Card cover image URL** in `/studio`; the URL is validated server-side and saved with the content revision.
- Gym timetable rows have activity thumbnails.
- Training/support/coaching workspaces have original decorative illustrations, including empty conversation states.
- Two new optimized WebP architectural illustrations live in `public/images/branding/`. They are AI-generated SmartFit artwork, **not photos of listed gyms**, and bundled-art placements are labelled. Existing category artwork is reused for activity-specific cards.
- Images have fixed dimensions or aspect ratios, lazy loading where appropriate, no-referrer requests for third-party sources, and graceful failure states. Tenant images are loaded by the browser, not fetched through a server image proxy.

## Validation

- 178 root unit tests and 253 core tests passed; 8 mocked server-handler tests passed.
- 17 browser tests passed, including three new branding tests: raster import + publish, invalid logo refusal, and image loading/mobile layout.
- Web/core/mobile typechecks and production build passed. Lint has no new warnings; the existing unrelated profile image warning remains.
- Rules coverage was added for owner permissions, valid logo/profile writes and rejection of SVG, oversized logos, unsafe URLs and unsupported settings. The Firestore emulator was not run locally (Java unavailable); run the CI emulator suite before production deployment.
- Actual production Firebase writes were not exercised. No seed or live account changes were made in this pass.
