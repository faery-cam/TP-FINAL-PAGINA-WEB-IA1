let images = [];
let bgBuffer = null;   // fondo denso, fijo
let movers = [];       // recortes que se mueven (sprites + velocidad)
let grainTex = null;

const CANVAS_SIZE = 800;

const MIN_IMAGES = 10;
const MAX_IMAGES = 30;
// las URLs las arma la página (index.ejs) en window.URLS_IMAGENES
const IMAGE_FILENAMES = window.URLS_IMAGENES || [];

// densidad (como el slider pero fijo). subí/bajá estos para más/menos carga
const NUM_BG_LAYERS = 4;   // texturas de fondo
const BG_BASE = 26;        // recortes grandes del fondo
const BG_SCRAPS = 220;     // recortes chicos del fondo
const NUM_MOVERS = 140;    // recortes que se mueven

// tintes de acento (sale uno random en pickTint)
const PALETTE = [
  [255, 20, 147], [0, 255, 170], [255, 210, 0], [150, 60, 255],
  [0, 200, 255], [255, 255, 255], [15, 15, 15]
];

const DEFORM_MODES = ['wave', 'stripes', 'glitch', 'noise', 'mirror', 'echo'];
const SHAPE_MODES = ['organic', 'organic', 'angular', 'spiky', 'strip'];

//opciones de cada capa del fondo
let BASE_OPTS, SCRAP_OPTS;

function defineLayerOptions() {
  BASE_OPTS = {
    fracMin: 0.16, fracMax: 0.32,
    drawScaleMin: 0.9, drawScaleMax: 1.5,
    opMin: 215, opMax: 255,
    blends: [BLEND, BLEND, BLEND, SOFT_LIGHT],
    jagMin: 0.35, jagMax: 0.6,
    tintChance: 0.25, tintStrengthMin: 0.15, tintStrengthMax: 0.35,
    filterChance: 0.1, grayChance: 0.05,
    lowOpacityChance: 0.12, lowOpacityMin: 45, lowOpacityMax: 100
  };

  SCRAP_OPTS = {
    fracMin: 0.05, fracMax: 0.15,
    drawScaleMin: 0.8, drawScaleMax: 1.3,
    opMin: 120, opMax: 210,
    blends: [BLEND, BLEND, MULTIPLY, SCREEN, OVERLAY, SOFT_LIGHT],
    jagMin: 0.5, jagMax: 0.8,
    tintChance: 0.45, tintStrengthMin: 0.25, tintStrengthMax: 0.6,
    filterChance: 0.15, grayChance: 0.07,
    lowOpacityChance: 0.15, lowOpacityMin: 35, lowOpacityMax: 90
  };
}

async function setup() {
  createCanvas(CANVAS_SIZE, CANVAS_SIZE).parent('obra-comunitaria');
  defineLayerOptions();

  //.catch() para que un nombre que no exista no rompa todo
  const loaded = await Promise.all(
    IMAGE_FILENAMES.map(filename => loadImage(filename).catch(() => null))
  );
  const loadedOk = [];
  for (let i = 0; i < loaded.length; i++) {
    const img = loaded[i];
    if (img && img.width > 0 && img.height > 0) loadedOk.push(img);
  }
  images = loadedOk;

  // menos de 10: avisa en el canvas y corta
  if (images.length < MIN_IMAGES) {
    background(20);
    fill(235); noStroke();
    textAlign(CENTER, CENTER); textSize(16);
    text('todavía no hay suficientes obras para la creación colectiva', width / 2, height / 2);
    noLoop();
    return;
  }

  if (images.length > MAX_IMAGES) images = shuffle(images).slice(0, MAX_IMAGES);

  // se achican las imágenes muy grandes
  const MAX_IMG_DIM = 1000;
  for (const img of images) {
    if (img.width > MAX_IMG_DIM || img.height > MAX_IMG_DIM) {
      if (img.width >= img.height) img.resize(MAX_IMG_DIM, 0);
      else img.resize(0, MAX_IMG_DIM);
    }
  }

  bgBuffer = buildStaticBg();   // fondo denso fijo
  buildMovers(NUM_MOVERS);      // recortes que se mueven
  // sin noLoop(): draw() corre en bucle y anima
}

function draw() {
  if (!bgBuffer) return;
  image(bgBuffer, 0, 0);     // fondo fijo
  updateAndDrawMovers();     // recortes en movimiento encima
}

// === recortes en movimiento ===

// cada frame: desplaza, rota, hace un bob suave, y envuelve en los bordes
function updateAndDrawMovers() {
  for (const m of movers) {
    m.x += m.vx;
    m.y += m.vy;
    m.rot += m.vrot;
    m.t += 1;

    // wrap: cuando sale de un lado, reaparece del otro (sin huecos al fondo
    // porque el fondo fijo ya cubre todo)
    const r = max(m.w, m.h) * m.scale;
    if (m.x < -r) m.x = width + r;
    else if (m.x > width + r) m.x = -r;
    if (m.y < -r) m.y = height + r;
    else if (m.y > height + r) m.y = -r;

    const bob = sin(m.bobPhase + m.t * m.bobSpd) * m.bobAmp; // flotar suave

    push();
    translate(m.x, m.y + bob);
    rotate(m.rot);
    scale(m.scale);
    imageMode(CENTER);
    image(m.sprite, 0, 0);
    pop();
  }
}

// se arman por recursión en bloques chicos (no un for() largo), para no
// trabar el navegador al crear tantos sprites de una
function buildMovers(count) {
  movers = [];
  buildMoversChunk(0, count);
}

function buildMoversChunk(done, count) {
  const end = min(done + 12, count);
  for (let i = done; i < end; i++) movers.push(makeMoverSprite());
  if (end < count) buildMoversChunk(end, count); // recursión, no bucle
}

// hornea UN recorte como sprite: imagen recortada a una forma irregular,
// con transparencia alrededor. Se hace una sola vez; después solo se dibuja.
function makeMoverSprite() {
  const img = random(images);
  const sw = floor(random(img.width * 0.08, img.width * 0.26));
  const sh = floor(random(img.height * 0.08, img.height * 0.26));
  const sx = floor(random(img.width - sw));
  const sy = floor(random(img.height - sh));

  const pg = createGraphics(sw, sh);
  pg.clear(); // transparente
  pg.push();
  pg.translate(sw / 2, sh / 2);
  pg.beginClip();
  drawPieceShape(pg, sw, sh, random(0.3, 0.7), random(SHAPE_MODES));
  pg.endClip();
  pg.imageMode(CENTER);
  const tc = pickTint(0.35, 0.2, 0.5);
  pg.tint(red(tc), green(tc), blue(tc), 255);
  pg.image(img, 0, 0, sw, sh, sx, sy, sw, sh); // 9 args: recorta al vuelo
  pg.pop();

  const sprite = pg.get(); // p5.Image con transparencia
  pg.remove();             // libera el canvas, no acumulamos buffers vivos

  const ang = random(TWO_PI);
  const spd = random(0.15, 0.7); // lento = flotación tranquila
  return {
    sprite, w: sw, h: sh,
    x: random(width), y: random(height),
    vx: cos(ang) * spd, vy: sin(ang) * spd,
    rot: random(TWO_PI), vrot: random(-0.004, 0.004),
    scale: random(0.85, 1.3),
    bobPhase: random(TWO_PI), bobAmp: random(2, 8), bobSpd: random(0.01, 0.03),
    t: 0
  };
}

// === fondo denso fijo ===

function buildStaticBg() {
  const bgLayers = [];
  buildBgLayers(bgLayers, 0, NUM_BG_LAYERS);

  const overlayA = buildRepeatingLayer({ fracMin: 0.04, fracMax: 0.09, deformMin: 8, deformMax: 20 });
  const overlayB = buildRepeatingLayer({ fracMin: 0.03, fracMax: 0.07, deformMin: 10, deformMax: 24 });

  const bgBase = buildPiecesChunked(BASE_OPTS, BG_BASE);
  const bgScraps = buildPiecesChunked(SCRAP_OPTS, BG_SCRAPS);

  const g = createGraphics(width, height);
  g.background(12);

  drawRepeatingLayerFull(g, bgLayers[0], { opacity: 255, blend: BLEND });

  const BG_BLENDS = [MULTIPLY, SCREEN, OVERLAY, SOFT_LIGHT, BLEND];
  for (let i = 1; i < bgLayers.length; i++) {
    drawRepeatingLayerPatches(g, bgLayers[i], {
      numPatches: 2, patchFracMin: 0.3, patchFracMax: 0.5,
      opacity: random(110, 190), blend: random(BG_BLENDS)
    });
  }

  drawPieces(g, bgBase);
  drawPieces(g, bgScraps);

  drawRepeatingLayerPatches(g, overlayA, { numPatches: 4, patchFracMin: 0.22, patchFracMax: 0.4, opacity: 120, blend: OVERLAY });
  drawRepeatingLayerPatches(g, overlayB, { numPatches: 3, patchFracMin: 0.18, patchFracMax: 0.35, opacity: 100, blend: SCREEN });

  g.blendMode(OVERLAY);
  g.image(getGrainTexture(), 0, 0);
  g.blendMode(BLEND);

  return g;
}

// === capa repetida: 1 fragmento → filtro → deformación → mosaico ===

function buildBgLayers(out, i, total) {
  const fine = i === 0;
  out.push(buildRepeatingLayer({
    fracMin: fine ? random(0.05, 0.08) : random(0.1, 0.16),
    fracMax: fine ? random(0.09, 0.14) : random(0.18, 0.28),
    deformMin: random(5, 10), deformMax: random(14, 26)
  }));
  if (i + 1 < total) buildBgLayers(out, i + 1, total);
}

function buildRepeatingLayer(opts) {
  const img = random(images);
  const sw = max(30, floor(random(img.width * opts.fracMin, img.width * opts.fracMax)));
  const sh = max(30, floor(random(img.height * opts.fracMin, img.height * opts.fracMax)));
  const sx = floor(random(max(1, img.width - sw)));
  const sy = floor(random(max(1, img.height - sh)));

  let tile = img.get(sx, sy, sw, sh);

  const TILE_MAX = 240;
  if (tile.width > TILE_MAX || tile.height > TILE_MAX) {
    if (tile.width >= tile.height) tile.resize(TILE_MAX, 0);
    else tile.resize(0, TILE_MAX);
  }

  const fr = random();
  if (fr < 0.4) tile.filter(POSTERIZE, floor(random(3, 6)));
  else if (fr < 0.6) tile.filter(GRAY);
  else if (fr < 0.72) tile.filter(INVERT);

  const mode = random(DEFORM_MODES);
  const amp = random(opts.deformMin, opts.deformMax);
  tile = deformImage(tile, mode, amp);

  return { gfx: tile, w: tile.width, h: tile.height };
}

function deformImage(img, mode, amp) {
  if (mode === 'stripes') return deformStripes(img, amp);
  if (mode === 'glitch') return deformGlitch(img, amp);
  if (mode === 'noise') return deformNoise(img, amp);
  if (mode === 'mirror') return deformMirror(img);
  if (mode === 'echo') return deformEcho(img, amp);
  return deformWave(img, amp, random(0.04, 0.14));
}

function deformMirror(img) {
  const g = createGraphics(img.width, img.height);
  g.image(img, 0, 0);
  g.push();
  g.translate(img.width, 0);
  g.scale(-1, 1);
  g.image(img, 0, 0, img.width / 2, img.height, 0, 0, img.width / 2, img.height);
  g.pop();
  return g.get();
}

function deformEcho(img, amp) {
  const g = createGraphics(img.width, img.height);
  g.image(img, 0, 0);
  g.tint(255, 110);
  g.image(img, amp, amp);
  g.image(img, -amp, -amp);
  g.noTint();
  return g.get();
}

function deformWave(img, amp, freq) {
  const g = createGraphics(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    const offsetX = round(sin(y * freq) * amp);
    wrapCopyRow(g, img, y, offsetX);
  }
  return g.get();
}

function deformStripes(img, amp) {
  const g = createGraphics(img.width, img.height);
  const stripeH = floor(random(4, 14));
  for (let y = 0; y < img.height; y++) {
    const stripeIndex = floor(y / stripeH);
    const offsetX = (stripeIndex % 2 === 0) ? round(amp) : -round(amp);
    wrapCopyRow(g, img, y, offsetX);
  }
  return g.get();
}

function deformGlitch(img, amp) {
  const g1 = createGraphics(img.width, img.height);
  g1.background(0);
  g1.blendMode(ADD);
  const shift = floor(random(2, max(3, amp)));
  g1.tint(255, 60, 60); g1.image(img, -shift, 0);
  g1.tint(60, 255, 60); g1.image(img, 0, 0);
  g1.tint(60, 60, 255); g1.image(img, shift, 0);
  g1.blendMode(BLEND);
  const snapshot = g1.get();

  const g2 = createGraphics(img.width, img.height);
  let y = 0;
  while (y < img.height) {
    const blockH = min(floor(random(3, 14)), img.height - y);
    const jump = random() < 0.5 ? floor(random(-amp * 2, amp * 2)) : 0;
    wrapCopyBlock(g2, snapshot, y, blockH, jump);
    y += blockH;
  }
  return g2.get();
}

function deformNoise(img, amp) {
  const g1 = createGraphics(img.width, img.height);
  g1.image(img, 0, 0);
  g1.noStroke();
  const density = min(1500, floor((img.width * img.height) / 70));
  for (let i = 0; i < density; i++) {
    const v = random(0, 255);
    g1.fill(v, v, v, random(40, 140));
    g1.rect(random(img.width), random(img.height), random(1, 3), random(1, 3));
  }
  const snapshot = g1.get();

  const g2 = createGraphics(img.width, img.height);
  let y = 0;
  while (y < img.height) {
    const blockH = min(floor(random(1, 4)), img.height - y);
    const jump = random() < 0.3 ? floor(random(-amp, amp)) : 0;
    wrapCopyBlock(g2, snapshot, y, blockH, jump);
    y += blockH;
  }
  return g2.get();
}

function wrapCopyRow(destG, srcImg, y, offsetX) {
  destG.copy(srcImg, 0, y, srcImg.width, 1, offsetX, y, srcImg.width, 1);
  if (offsetX > 0) {
    destG.copy(srcImg, srcImg.width - offsetX, y, offsetX, 1, offsetX - srcImg.width, y, offsetX, 1);
  } else if (offsetX < 0) {
    destG.copy(srcImg, 0, y, -offsetX, 1, srcImg.width + offsetX, y, -offsetX, 1);
  }
}

function wrapCopyBlock(destG, srcImg, y, blockH, offsetX) {
  destG.copy(srcImg, 0, y, srcImg.width, blockH, offsetX, y, srcImg.width, blockH);
  if (offsetX > 0) {
    destG.copy(srcImg, srcImg.width - offsetX, y, offsetX, blockH, offsetX - srcImg.width, y, offsetX, blockH);
  } else if (offsetX < 0) {
    destG.copy(srcImg, 0, y, -offsetX, blockH, srcImg.width + offsetX, y, -offsetX, blockH);
  }
}

function drawTileGrid(g, layer, areaW, areaH, opacity, blend) {
  const MAX_TILES_PER_SIDE = 22;
  const cols = min(ceil(areaW / layer.w) + 2, MAX_TILES_PER_SIDE);
  const rows = min(ceil(areaH / layer.h) + 2, MAX_TILES_PER_SIDE);

  g.blendMode(blend);
  g.tint(255, opacity);
  g.imageMode(CENTER);

  for (let ry = -1; ry < rows; ry++) {
    for (let rx = -1; rx < cols; rx++) {
      g.push();
      const flip = (rx + ry) % 2 === 0;
      g.translate(rx * layer.w - areaW / 2 + layer.w / 2, ry * layer.h - areaH / 2 + layer.h / 2);
      g.scale(flip ? -1 : 1, 1);
      g.image(layer.gfx, 0, 0);
      g.pop();
    }
  }
  g.blendMode(BLEND);
}

function drawRepeatingLayerFull(g, layer, opts) {
  if (!layer || layer.w < 2 || layer.h < 2) return;
  g.push();
  g.translate(g.width / 2, g.height / 2);
  drawTileGrid(g, layer, g.width, g.height, opts.opacity, opts.blend);
  g.pop();
}

function drawRepeatingLayerPatches(g, layer, opts) {
  if (!layer || layer.w < 2 || layer.h < 2) return;
  for (let i = 0; i < opts.numPatches; i++) {
    const patchW = g.width * random(opts.patchFracMin, opts.patchFracMax);
    const patchH = g.height * random(opts.patchFracMin, opts.patchFracMax);
    g.push();
    g.translate(random(g.width), random(g.height));
    g.beginClip();
    organicShape(g, patchW, patchH, random(0.3, 0.5));
    g.endClip();
    drawTileGrid(g, layer, patchW, patchH, opts.opacity, opts.blend);
    g.pop();
  }
}

// === construcción de un pedazo del fondo ===

const CHUNK_SIZE = 20;

function buildPiecesChunked(opts, count) {
  const pieces = [];
  buildPiecesChunk(pieces, opts, 0, count);
  return pieces;
}

function buildPiecesChunk(pieces, opts, start, count) {
  const end = min(start + CHUNK_SIZE, count);
  for (let i = start; i < end; i++) pieces.push(createPiece(opts));
  if (end < count) buildPiecesChunk(pieces, opts, end, count);
}

function createPiece(opts) {
  const img = random(images);
  const sw = floor(random(img.width * opts.fracMin, img.width * opts.fracMax));
  const sh = floor(random(img.height * opts.fracMin, img.height * opts.fracMax));
  const sx = floor(random(img.width - sw));
  const sy = floor(random(img.height - sh));

  let rendered = null;
  const doPost = random() < opts.filterChance;
  const doGray = random() < opts.grayChance;
  if (doPost || doGray) {
    rendered = img.get(sx, sy, sw, sh);
    const PIECE_FILTER_MAX = 200;
    if (rendered.width > PIECE_FILTER_MAX || rendered.height > PIECE_FILTER_MAX) {
      if (rendered.width >= rendered.height) rendered.resize(PIECE_FILTER_MAX, 0);
      else rendered.resize(0, PIECE_FILTER_MAX);
    }
    if (doPost) rendered.filter(POSTERIZE, floor(random(3, 7)));
    if (doGray) rendered.filter(GRAY);
  }

  const margin = opts.marginFrac ? width * opts.marginFrac : 0;
  return {
    src: img, rendered,
    sx, sy, sw, sh,
    w: sw, h: sh,
    drawScale: random(opts.drawScaleMin, opts.drawScaleMax),
    x: random(margin, width - margin),
    y: random(margin, height - margin),
    rotation: random(TWO_PI),
    opacity: (random() < opts.lowOpacityChance)
      ? random(opts.lowOpacityMin, opts.lowOpacityMax)
      : random(opts.opMin, opts.opMax),
    blend: random(opts.blends),
    jag: random(opts.jagMin, opts.jagMax),
    shapeMode: random(SHAPE_MODES),
    tintCol: pickTint(opts.tintChance, opts.tintStrengthMin, opts.tintStrengthMax)
  };
}

function pickTint(chance, strengthMin, strengthMax) {
  if (random() > chance) return color(255);
  const base = random(PALETTE);
  const strength = random(strengthMin, strengthMax);
  return lerpColor(color(255), color(base[0], base[1], base[2]), strength);
}

// === dibujo de los pedazos del fondo (sobre el buffer "g") ===

function drawPieces(g, pieces) {
  drawPiecesChunk(g, pieces, 0);
  g.blendMode(BLEND);
}

function drawPiecesChunk(g, pieces, start) {
  const end = min(start + CHUNK_SIZE, pieces.length);
  for (let i = start; i < end; i++) drawOnePiece(g, pieces[i]);
  if (end < pieces.length) drawPiecesChunk(g, pieces, end);
}

function drawOnePiece(g, p) {
  g.push();
  g.translate(p.x, p.y);
  g.rotate(p.rotation);
  g.scale(p.drawScale);
  g.blendMode(p.blend);
  g.tint(red(p.tintCol), green(p.tintCol), blue(p.tintCol), p.opacity);

  g.beginClip();
  drawPieceShape(g, p.w, p.h, p.jag, p.shapeMode);
  g.endClip();

  g.imageMode(CENTER);
  if (p.rendered) {
    g.image(p.rendered, 0, 0, p.w, p.h);
  } else {
    g.image(p.src, 0, 0, p.sw, p.sh, p.sx, p.sy, p.sw, p.sh);
  }
  g.pop();
}

function drawPieceShape(g, w, h, jag, mode) {
  if (mode === 'angular') angularShape(g, w, h, jag);
  else if (mode === 'spiky') spikyShape(g, w, h, jag);
  else if (mode === 'strip') stripShape(g, w, h, jag);
  else organicShape(g, w, h, jag);
}

function organicShape(g, w, h, jag) {
  const rx = w / 2, ry = h / 2;
  const n = floor(random(10, 16));
  const seed = random(1000);
  g.beginShape();
  for (let i = 0; i <= n; i++) {
    const angle = (TWO_PI / n) * i;
    const nVal = noise(cos(angle) * 0.7 + seed, sin(angle) * 0.7 + seed);
    const rFactor = map(nVal, 0, 1, 1 - jag, 1 + jag * 0.6);
    g.vertex(cos(angle) * rx * rFactor, sin(angle) * ry * rFactor);
  }
  g.endShape(CLOSE);
}

function angularShape(g, w, h, jag) {
  const rx = w / 2, ry = h / 2;
  const n = floor(random(5, 9));
  g.beginShape();
  for (let i = 0; i < n; i++) {
    const angle = (TWO_PI / n) * i + random(-0.2, 0.2);
    const rFactor = random(1 - jag, 1 + jag * 0.5);
    g.vertex(cos(angle) * rx * rFactor, sin(angle) * ry * rFactor);
  }
  g.endShape(CLOSE);
}

function spikyShape(g, w, h, jag) {
  const rx = w / 2, ry = h / 2;
  const points = floor(random(5, 9));
  const n = points * 2;
  g.beginShape();
  for (let i = 0; i < n; i++) {
    const angle = (TWO_PI / n) * i;
    const isTip = i % 2 === 0;
    const rFactor = isTip ? random(0.85, 1.15) : random(0.2, 0.5) * (1 + jag * 0.3);
    g.vertex(cos(angle) * rx * rFactor, sin(angle) * ry * rFactor);
  }
  g.endShape(CLOSE);
}

function stripShape(g, w, h, jag) {
  const halfW = w / 2;
  const halfH = (h * random(0.25, 0.45)) / 2;
  const n = 8;
  const seed = random(1000);
  g.beginShape();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = map(t, 0, 1, -halfW, halfW);
    const nVal = noise(t * 3 + seed);
    const y = -halfH + map(nVal, 0, 1, -halfH * jag, halfH * jag);
    g.vertex(x, y);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const x = map(t, 0, 1, -halfW, halfW);
    const nVal = noise(t * 3 + seed + 50);
    const y = halfH + map(nVal, 0, 1, -halfH * jag, halfH * jag);
    g.vertex(x, y);
  }
  g.endShape(CLOSE);
}

function getGrainTexture() {
  if (grainTex) return grainTex;
  const t = createGraphics(CANVAS_SIZE, CANVAS_SIZE);
  t.clear();
  t.noStroke();
  const total = floor((CANVAS_SIZE * CANVAS_SIZE) / 260);
  fillGrainChunk(t, 0, total);
  grainTex = t;
  return grainTex;
}

function fillGrainChunk(t, done, total) {
  const end = min(done + 400, total);
  for (let i = done; i < end; i++) {
    const v = random(60, 255);
    t.fill(v, v, v, random(15, 45));
    const s = random(1, 2.2);
    t.rect(random(CANVAS_SIZE), random(CANVAS_SIZE), s, s);
  }
  if (end < total) fillGrainChunk(t, end, total);
}