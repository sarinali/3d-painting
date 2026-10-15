# Étang — an infinite impression

A browser painting experiment inspired by Claude Monet’s water lilies, built with React 19, React Three Fiber, Three.js, simplex-noise, and Vite. Every mark is generated in JavaScript; no painting image is used as a background.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. `npm run build` creates the production app in `dist`.

## The approach

- **Placement:** domain-warped, three-octave simplex noise. Two low-frequency noise samples displace world coordinates before a fractal noise field is evaluated. Thresholding this field gathers lily pads into islands rather than uniformly scattering them.
- **Brush direction:** the 2D curl of a scalar noise potential `ψ = 3.2N(0.15x,0.15z) + 0.65N(0.34x+17,0.34z−9) + 0.12z`, `v = (∂ψ/∂z, −∂ψ/∂x)`, evaluated with central differences. Its vector is integrated into curved paths of textured brush-shaped planes; this is an artistic use of curl noise, not a fluid simulation or a claim to model Monet’s actual hand.
- **Depth:** a continuous layered height function, `h(x,z) = d × (0.44 × fBm(0.085x,0.085z) + 0.065 × N(0.27x,0.27z))`. Simplex noise interpolates between gradient contributions; `d` controls relief. The painting interaction mesh samples the same function on a triangulated grid, so the pointer targets the water surface.
- **Painting:** Fiber pointer events raycast the water mesh. Blossoms, lily pads, reflections, and swirl ribbons become world-space marks, grouped by gesture for undo. Custom colors, brush size, and a PNG export are included. Marks are saved to localStorage in this browser.
- **Infinity:** deterministic 28-unit chunks, streamed across the visible camera footprint (with a margin). The footprint is found by intersecting the four corner rays with the ground plane, so orbiting and zooming also reveal generated world. Chunks outside the visible region unmount. A coordinate hash and seed reproduce the same scene on return. GPU-instanced textured planes keep draw calls low. World coordinates still have normal JavaScript/graphics floating-point limits.

## Sampled reference colors and advection

The default **Monet · sampled** palette comes from all 97,295 pixels in the user’s 319×305 reference. `src/paintings/monet-water-lilies/reference-palette.json` contains the extracted colors and method. `scripts/sample-palette.py` groups pixels into water, foliage, flowers, and highlights by HSV, then uses weighted sRGB k-means to extract representative colors. These are approximations of the supplied digital image, not measurements of original paint pigments. The painting uses these colors for marks and a smoothly interpolated underpainting. Filmic tone mapping is disabled so it does not remap the sampled colors; transparent marks still blend with the underpainting.

The **Swirl** brush starts three nearby pigment strands across the current and advects each through the same velocity field. Reflections and procedural water marks use shorter paths. The field stays static; deposited trails remain still. This is forward particle advection used to draw brush paths, not a full fluid solver or texture advection simulation.

The simple Euler rule is `p_next = p + dt × v(p)`. We use the more accurate midpoint (RK2) version:

```js
const a = velocity(x, z);
const b = velocity(x + a.x * dt / 2, z + a.z * dt / 2);
const next = { x: x + b.x * dt, z: z + b.z * dt };
```

For a time-independent stream function, `∇ψ · v = 0`: the current follows contours of ψ. Also `∇·v = ψ_zx − ψ_xz = 0` for smooth ψ. Finite differences and integration have numerical error; we keep the raw velocity magnitude instead of normalizing it. A **Flow length** slider controls how long the brush is advected, and **Size** controls ribbon width. The pond uses x/z for the horizontal plane; this is the same equation as x/y in a 2D drawing.

## Controls

Camera navigation uses Three.js’s bundled `OrbitControls`, mounted independently in `src/engine/rendering/CameraRig.jsx`. Panning stays parallel to the pond; tilt and distance limits keep the camera above the surface.

- **Paint (B):** drag to paint; hold Space and drag to pan temporarily.
- **Pan (V):** drag to move across the world.
- **Orbit (O):** drag to rotate around the area you are looking at.
- **Any tool:** right-drag to orbit, middle-drag to pan, scroll to zoom. With OrbitControls, modifier keys can switch the mapped pan/orbit action.
- **Keyboard:** WASD / arrow keys travel relative to the current viewing direction, including after orbiting.
- **Touch:** use one finger with the selected tool; two fingers pan and pinch to zoom. Switch to Pan or Orbit before navigating with one finger.
- **Camera dock:** zoom buttons, top view at the current location, and return to the starting view. Reset also stops automatic drift.
- **Undo:** Cmd/Ctrl+Z undoes one painting gesture.

 “Let it drift” moves automatically. Settings change the palette, relief, lily abundance, or garden seed. Save impression downloads the current 3D view.

## Future Gaussian splat layer

This is a Three.js 3D scene with a perspective camera, a horizontal height field, and raised textured brush planes. It currently has no Gaussian splat renderer. The `painted-world` group and independent `CameraRig` allow a separate scene layer to share the same camera and coordinate system (Y up, X/Z ground). Future splat assets should remain separate from the water painting raycast mesh.

A possible integration is [GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D), which supports a Three.js `DropInViewer`. Actual integration still needs asset placement/scale, transparent rendering and depth-order checks, and performance testing. A single reference painting does not provide a scanned 3D scene; splats would need to be authored or reconstructed separately.

## Research

- [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) — reused pan, orbit, dolly, damping, and touch input.
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber) — React renderer and React-version compatibility.
- [Fiber events and interaction](https://r3f.docs.pmnd.rs/tutorials/events-and-interaction) — raycast pointer interaction.
- [Karl Sims: Fluid Flow Tutorial](https://www.karlsims.com/fluid-flow.html) — carrying tracer particles and textures through a flow field.
- [Bridson, Houriham & Nordenstam: Curl-Noise for Procedural Fluid Flow](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf) — divergence-free flow from noise derivatives.
- [Red Blob Games: Making maps with noise functions](https://www.redblobgames.com/maps/terrain-from-noise/) — layered noise and terrain distribution.

## Limits

This is an impressionist procedural interpretation, not a reconstruction of the reference. The scene uses a 3D height field and raised brush marks rather than volumetric paint or a water simulation. User marks currently remain in memory when exploring and are stored locally; very long painting sessions can grow memory and browser storage. Settings and camera position reset on reload; saved marks remain. PNG exports contain the scene, without interface labels or the decorative CSS grain. The interface uses system fonts.

## Light on water

The **Light on water** switch compares the original painted look with an optical surface. Three.js `MeshPhysicalMaterial` supplies dielectric Fresnel reflection, screen-space transmission/refraction, microfacet roughness, and volume attenuation.

- Water uses index of refraction **1.333**, full transmission, **no clearcoat**, and moderate roughness. This removes the extra varnish-like coating and milky diffuse component of the first experiment.
- Three.js’s bundled **Sky** addon supplies an atmosphere with Rayleigh/Mie scattering. Its solar disk is excluded from the PMREM environment; one distant directional light supplies direct sunlight. **Sun elevation** changes the shared sky/sun direction; **Sunlight** changes direct irradiance while the sky provides softer ambient lighting. ACES tone mapping rolls off highlights on lit surfaces; the unlit underpainting and brush colors bypass tone mapping.
- **Ripples** controls small-amplitude wave slopes evaluated in world coordinates in the water fragment shader. Five directions, wavelengths, phases, and speeds replace the visibly tiled scrolling normal map. For each wave, `h_i = A_i sin(k_i d_i·p − ω_i t + φ_i)` with the deep-water approximation `ω_i² = g k_i`. Analytic height derivatives produce shading normals. The painted relief contributes only 25% of its normal tilt so its sculpted shapes do not read as molded plastic.
- **Disturb** is a temporary ripple brush: click/drag to emit outward wave packets. The shader keeps up to eight recent disturbances. The approximate packet is `h(r,t) = A exp(−0.55t − (r−1.5t)²/0.55) sin(7(r−1.5t)) / sqrt(1+r)`, with a nine-second lifetime. Its derivative changes reflected/refracted directions as the ring travels and fades. It is a visual wave-packet approximation, not a PDE fluid solver. Disturbances do not save paint marks or consume undo history.
- **Optical depth** controls the material's path-length approximation and absorption. These controls use scene units, not calibrated watts or meters. The wind dispersion is a deep-water model; shallow-water boundaries, capillary effects, and interactions with lilies are not solved.
- Color/reflection strokes sit beneath the water; lilies and blossoms sit above it. The interaction mesh stays stable. Waves affect shading normals rather than moving geometry, so the pointer does not chase an animated mesh.
- Reflections come from the atmosphere environment, not live mirrors of the lilies. Refraction is screen-space and cannot reconstruct content absent from its render buffer. There are no ray-traced caustics, multiple scattering, or volumetric water simulation. Turn the effect off for the original low-cost painting view.

References: [GPU Gems: Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models), [Three.js Sky](https://threejs.org/docs/pages/Sky.html), [PBRT: Distant Lights](https://www.pbr-book.org/4ed/Light_Sources/Distant_Lights).

## Brush-shaped lilies and quieter accents

Pads are clusters of broad dark strokes and smaller colored dabs, with no circular backing mesh. The default **Lily size** is 1.8×. Raised blossoms use three rings of curved, brush-textured petals and small centers/stems. Existing blossom gestures are visually spaced to avoid continuous flower garlands; saved strokes remain intact.

Lily brush planes cast alpha-tested shadows using their paint texture. A directional shadow map follows the streamed world; the lit underpainting receives those shadows beneath the transmissive water. These are standard shadow maps, without bent-light caustics. The water-lighting switch has fallback lights so raised flowers remain visible when the optical layer is off.

**Swirl accents** controls the proportion of legacy ribbons that retain their original paint colors (default 2%). More legacy paths remain visible in subdued water colors, preserving the curl/advection structure without covering the pond in pink. Newly painted swirls keep the chosen paint color. Procedural water trails also trace longer sections of the same curl field. No saved artwork is deleted by this filtering.

## Patchy Gaussian diffusion

**Water diffusion** (0–100%, default 82%) blends submerged brush colors through a normalized 25-tap Gaussian convolution of Three.js's existing transmission buffer. It runs in the optical surface shader rather than as a CSS blur or a global camera effect. Raised lilies and brush-shaped pads are rendered separately and are not included in this blur.

Gaussian islands in warped world coordinates vary their centers, orientation, axes, and intensity using the garden seed. They stay attached to the pond as the camera pans. The local mask controls both kernel width and the blend with the original refraction sample. Radius scales with screen-space derivatives of world position, with a safety cap near the camera; samples clamp at screen edges. Zero intensity bypasses the added sampling. This is an artistic diffusion effect, not time-evolving pigment transport or a solution of the diffusion equation.

`src/engine/math/water-diffusion.js` generates the kernel and checks that the installed Three.js transmission shader still has the expected integration point. Changing the water or Three.js shader requires a browser GPU-compilation check in addition to a JavaScript production build.

## Project structure and new paintings

```text
src/
  engine/
    math/                  # Seeded randomness, noise, curl, RK2, waves, Gaussian diffusion
    rendering/             # Camera controls, optical water, raised flower rendering
    garden.js              # Painting-configured pond/brushwork generator
  paintings/
    index.js               # Painting registry and URL selection
    monet-water-lilies/     # First painting: palette, sampled colors, defaults, composition
  main.jsx                 # App, brush interaction, scene assembly, menu overlays
  style.css                # Full-viewport interface
```

The first painting is selected by default, or explicitly with
`/?painting=monet-water-lilies`. Unknown IDs fall back to Monet.

To add another pond painting:

1. Create `src/paintings/<id>/index.js`, using the Monet module as a template.
2. Give it a unique `id` and `storageKey` to keep saved artwork separate.
3. Supply palettes with `water`, `leaf`, `flower`, and `highlights` color arrays;
   set `defaults.palette` to an existing palette key and choose `brushColors`.
4. Adjust `math.noiseSeed`, composition counts/thresholds, and scene defaults.
5. Import and register it in `src/paintings/index.js`; open `/?painting=<id>`.

`createFields({noiseSeed})` exposes pure noise, height, potential, velocity,
RK2 advection, and tracing functions without any rendering or painting imports.
`createGarden(painting)` adds the current pond composition and brush generators.
A future landscape or portrait can reuse the math and camera while providing its
own composition/rendering; the existing generator still specifically draws a pond
with lily pads and flowers. No image-to-scene model or music training is included.

Run `npm test` for deterministic generation, seed isolation, numerical curl
divergence, and alternate palette/composition checks. Run `npm run build` for
production validation. Press **H** or use the eye button to hide/show menus.
