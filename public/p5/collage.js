let images = [];
//las tres capas de collage
let collageA = null, collageB = null, collageC = null;
//para hacer y deshacer
let workA = null, workB = null;

// cada trazo: { layer: 'A'|'B', size: px, pts: [{x,y}, ...] }
let strokes = [];       // trazos aplicados, en orden
let redoStack = [];     // trazos deshechos, listos para rehacer
let currentStroke = null; // el trazo que se dibuja ahora

// fase de raspado: 1 = raspando A (revela B), 2 = raspando B (revela C).
let scratchPhase = 1;

const CANVAS_SIZE = 800;
const BRUSH_SIZE = 38; // grosor inicial
let brushSize = BRUSH_SIZE; // se ajusta con la rueda o [ ]
const BRUSH_MIN = 6, BRUSH_MAX = 760;

// forma del pincel: 'circle' | 'square' | 'rect' | 'oval' | 'star'
let brushShape = 'circle';

// suavizado del trazo (0..1): más alto = más directo
const BRUSH_SMOOTH = 0.9;
let smoothX = 0, smoothY = 0; // posición suavizada del pincel

// distancia mínima entre puntos guardados de un trazo
const MIN_POINT_DIST = 3;

// textura de grano, se genera una vez y se reusa en los 3 collages
let grainTex = null;

const MIN_IMAGES = 10;
const MAX_IMAGES = 30;
// las URLs las arma la página (perfil.ejs) en window.URLS_IMAGENES
const IMAGE_FILENAMES = window.URLS_IMAGENES || [];

// cantidades base de recortes
const NUM_BASE = 28;
const NUM_SCRAPS = 230;
const NUM_FEATURES = 15;
const NUM_BG_LAYERS = 10; // texturas distintas que se mezclan en el fondo

let densitySlider = null;
let eraseSlider = null;

// tintes de acento (sale uno random en pickTint)
const PALETTE = [
  [255, 20, 147],  // fucsia
  [0, 255, 170],   // verde agua
  [255, 210, 0],   // dorado
  [150, 60, 255],  // violeta
  [0, 200, 255],   // cian
  [255, 255, 255], // blanco
  [15, 15, 15]     // negro
];

const DEFORM_MODES = ['wave', 'stripes', 'glitch', 'noise', 'mirror', 'echo'];
const SHAPE_MODES = ['organic', 'organic', 'angular', 'spiky', 'strip'];

//opciones de cada capa
let BASE_OPTS, SCRAP_OPTS, FEATURE_OPTS;

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

  FEATURE_OPTS = {
    fracMin: 0.18, fracMax: 0.36,
    drawScaleMin: 1.0, drawScaleMax: 1.6,
    opMin: 230, opMax: 255,
    blends: [BLEND],
    jagMin: 0.1, jagMax: 0.25,
    tintChance: 0.2, tintStrengthMin: 0.1, tintStrengthMax: 0.25,
    filterChance: 0.15, grayChance: 0,
    marginFrac: 0.1,
    lowOpacityChance: 0.08, lowOpacityMin: 60, lowOpacityMax: 120
  };
}

async function setup() {
  createCanvas(CANVAS_SIZE, CANVAS_SIZE).parent('contenedor-collage');
  defineLayerOptions();

  //.catch() para que un nombre que no exista no rompa todo (queda null)
  const loaded = await Promise.all(
    IMAGE_FILENAMES.map(filename => loadImage(filename).catch(() => null))
  );

  // nos quedamos solo con las que cargaron bien (no null, ancho/alto > 0)
  const loadedOk = [];
  for (let i = 0; i < loaded.length; i++) {
    const img = loaded[i];
    if (img && img.width > 0 && img.height > 0) loadedOk.push(img);
  }
  images = loadedOk;

  // menos de 10: no genera nada, avisa en el canvas y corta
  if (images.length < MIN_IMAGES) {
    background(20);
    fill(235); noStroke();
    textAlign(CENTER, CENTER); textSize(16);
    text('faltan imágenes (mínimo ' + MIN_IMAGES + ')', width / 2, height / 2);
    noLoop();
    return;
  }

  // si hay más de 30 se eligen 30 al azar
  if (images.length > MAX_IMAGES) images = shuffle(images).slice(0, MAX_IMAGES);

  // se achican las imágenes muy grandes
  const MAX_IMG_DIM = 1000;
  for (const img of images) {
    if (img.width > MAX_IMG_DIM || img.height > MAX_IMG_DIM) {
      if (img.width >= img.height) img.resize(MAX_IMG_DIM, 0);
      else img.resize(0, MAX_IMG_DIM);
    }
  }

  createSliders();
  await generateNewCollages();
  noLoop();
  redraw();
}

// sliders HTML, metidos en el contenedor de controles
function createSliders() {
  const l1 = createDiv('Densidad de recortes (menos ←→ más):');
  l1.style('font-family', 'sans-serif'); l1.style('font-size', '12px'); l1.style('margin-top', '6px');
  l1.parent('controles-collage');
  densitySlider = createSlider(0.3, 1.8, 1.0, 0.1);
  densitySlider.style('width', CANVAS_SIZE + 'px');
  densitySlider.parent('controles-collage');
  densitySlider.changed(onDensityChanged);

  const l2 = createDiv('Opacidad del borrado (suave ←→ total):');
  l2.style('font-family', 'sans-serif'); l2.style('font-size', '12px'); l2.style('margin-top', '6px');
  l2.parent('controles-collage');
  eraseSlider = createSlider(5, 100, 100, 5);
  eraseSlider.style('width', CANVAS_SIZE + 'px');
  eraseSlider.parent('controles-collage');
}

async function onDensityChanged() {
  await generateNewCollages(); // usa el nuevo valor del slider
  redraw();
}

// fuerza de borrado 0..255 según el slider (255 = total)
function currentEraseStrength() {
  if (!eraseSlider) return 255;
  return round(map(eraseSlider.value(), 0, 100, 0, 255));
}

// no corre en bucle: redibuja a pedido (mouse/teclas llaman redraw())
function draw() {
  if (!collageA) return; //avisa si faltan imagenes

  background(12);
  if (collageC) image(collageC, 0, 0);
  if (workB) image(workB, 0, 0);
  if (workA) image(workA, 0, 0);

  drawBrushCursor();
}

function drawBrushCursor() {
  if (!insideCanvas()) { cursor(ARROW); return; }
  noCursor(); // el anillo es el cursor

  push();
  noFill();
  stroke(0, 180); strokeWeight(3);
  stampShape(window, brushShape, brushSize, mouseX, mouseY, 0);
  stroke(255, 230); strokeWeight(1.5);
  stampShape(window, brushShape, brushSize, mouseX, mouseY, 0);
  stroke(255, 220); strokeWeight(2);
  point(mouseX, mouseY); // punto central
  pop();
}

async function keyPressed() {
  if (!collageA) return; // sin collages: las teclas no hacen nada
  if (key === 't' || key === 'T') {
    scratchPhase = 2; // desactiva raspar A, activa raspar B
    redraw();
  } else if (key === 'z' || key === 'Z') {
    undo();
  } else if (key === 'x' || key === 'X') {
    redo();
  } else if (key === 'r' || key === 'R') {
    clearScratch();   // reinicia sin cambiar las composisiones
  } else if (key === 'n' || key === 'N') {
    await generateNewCollages(); // genera otros tres
    redraw();
  } else if (key === '-') {
    brushSize = constrain(brushSize - 6, BRUSH_MIN, BRUSH_MAX);
    redraw();
  } else if (key === '+') {
    brushSize = constrain(brushSize + 6, BRUSH_MIN, BRUSH_MAX);
    redraw();
  } else if (key === '1') { brushShape = 'circle'; redraw(); }
  else if (key === '2') { brushShape = 'square'; redraw(); }
  else if (key === '3') { brushShape = 'rect'; redraw(); }
  else if (key === '4') { brushShape = 'oval'; redraw(); }
  else if (key === '5') { brushShape = 'star'; redraw(); }
  else if (key === 'a' || key === 'A') { regenLayer('A'); } // regenerar solo A
  else if (key === 'b' || key === 'B') { regenLayer('B'); } // regenerar solo B
  else if (key === 'c' || key === 'C') { regenLayer('C'); } // regenerar solo C
  else if (key === 'd' || key === 'D') { downloadCollage(); } // descargar PNG
}

// funciones que llaman los botones de la página
async function nuevoCollage() { if (!collageA) return; await generateNewCollages(); redraw(); }
function rasparCapa(n) { scratchPhase = n; redraw(); }
function setForma(f) { brushShape = f; redraw(); }
function pincelMas()  { brushSize = constrain(brushSize + 10, BRUSH_MIN, BRUSH_MAX); redraw(); }
function pincelMenos(){ brushSize = constrain(brushSize - 10, BRUSH_MIN, BRUSH_MAX); redraw(); }

// regenera una sola capa y vuelve el raspado al estado inicial (los
// agujeros viejos no pegan con la imagen nueva)
function regenLayer(which) {
  if (which === 'A') collageA = generateOneCollage();
  else if (which === 'B') collageB = generateOneCollage();
  else if (which === 'C') collageC = generateOneCollage();

  strokes = [];
  redoStack = [];
  currentStroke = null;
  scratchPhase = 1;
  resetWorkFromMasters();
  redraw();
}

function downloadCollage() {
  background(12);
  if (collageC) image(collageC, 0, 0);
  if (workB) image(workB, 0, 0);
  if (workA) image(workA, 0, 0);
  saveCanvas('entrecapas', 'png');
  redraw();
}

// mover el mouse: redibuja para que el anillo del cursor siga la posición
function mouseMoved() {
  redraw();
}

// rueda del mouse: cambia el tamaño del pincel
function mouseWheel(event) {
  brushSize = constrain(brushSize - event.delta * 0.1, BRUSH_MIN, BRUSH_MAX);
  redraw();
  return false; // que no scrollee la página
}

// === raspado como lista de trazos ===

//cambio de capa
function activeWork() {
  return (scratchPhase === 1) ? workA : workB;
}

function mousePressed() {
  if (!insideCanvas() || !activeWork()) return;
  // el trazo arranca exacto donde clickeás (sin lag)
  smoothX = mouseX;
  smoothY = mouseY;
  currentStroke = {
    layer: (scratchPhase === 1) ? 'A' : 'B',
    size: brushSize,
    shape: brushShape,
    strength: currentEraseStrength(), // opacidad del borrado, fija por trazo
    pts: [{ x: smoothX, y: smoothY }]
  };
  redoStack = []; // trazo nuevo invalida el rehacer
  eraseSegment(activeWork(), currentStroke.size, currentStroke.shape, currentStroke.strength, smoothX, smoothY, smoothX, smoothY);
  redraw();
}

function mouseDragged() {
  if (!currentStroke) return false;
  // suavizado: el punto de raspado persigue al mouse con inercia
  smoothX = lerp(smoothX, mouseX, BRUSH_SMOOTH);
  smoothY = lerp(smoothY, mouseY, BRUSH_SMOOTH);

  const pts = currentStroke.pts;
  const last = pts[pts.length - 1];
  if (dist(last.x, last.y, smoothX, smoothY) >= MIN_POINT_DIST) {
    eraseSegment(activeWork(), currentStroke.size, currentStroke.shape, currentStroke.strength, last.x, last.y, smoothX, smoothY);
    pts.push({ x: smoothX, y: smoothY });
    redraw();
  }
  return false; // que arrastrar no seleccione texto
}

function mouseReleased() {
  if (currentStroke) {
    strokes.push(currentStroke);
    currentStroke = null;
  }
}

function insideCanvas() {
  return mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height;
}

// borra (perfora transparencia) un tramo, estampando la forma a lo largo
function eraseSegment(work, size, shape, strength, x1, y1, x2, y2) {
  work.erase(strength, strength); // 0..255: cuánto perfora
  work.noStroke();
  work.fill(255);
  stampAlong(work, shape, size, x1, y1, x2, y2);
  work.noErase();
}

// estampa la forma varias veces entre dos puntos para que el trazo quede
// continuo. el paso depende del tamaño del pincel.
function stampAlong(work, shape, size, x1, y1, x2, y2) {
  const ang = atan2(y2 - y1, x2 - x1); // las formas giran con el trazo
  const d = dist(x1, y1, x2, y2);
  const stepPx = max(1.5, size * 0.2);
  const n = min(100, max(1, ceil(d / stepPx))); // tope: evita el "infinite loop"
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    stampShape(work, shape, size, lerp(x1, x2, t), lerp(y1, y2, t), ang);
  }
}

// dibuja una forma de pincel, centrada en (x,y) y rotada "angle". el estilo
// (fill/stroke) ya lo puso quien llama. "t" = buffer o window (el cursor).
// se arma con vértices ya rotados (push/rotate se pelea con erase()).
function stampShape(t, shape, size, x, y, angle) {
  if (shape === 'circle') { t.circle(x, y, size); return; }
  const c = cos(angle || 0), s = sin(angle || 0);

  if (shape === 'square' || shape === 'rect') {
    const hx = size / 2;
    const hy = (shape === 'square') ? size / 2 : size * 0.25;
    t.beginShape();
    rv(t, x, y, -hx, -hy, c, s); rv(t, x, y, hx, -hy, c, s);
    rv(t, x, y, hx, hy, c, s);   rv(t, x, y, -hx, hy, c, s);
    t.endShape(CLOSE);
  } else if (shape === 'oval') {
    const rx = size / 2, ry = size * 0.3, n = 16;
    t.beginShape();
    for (let i = 0; i < n; i++) {
      const a = (TWO_PI / n) * i;
      rv(t, x, y, cos(a) * rx, sin(a) * ry, c, s);
    }
    t.endShape(CLOSE);
  } else if (shape === 'star') {
    const n = 10;
    t.beginShape();
    for (let i = 0; i < n; i++) {
      const a = (TWO_PI / n) * i - HALF_PI;
      const r = (i % 2 === 0) ? size * 0.5 : size * 0.22;
      rv(t, x, y, cos(a) * r, sin(a) * r, c, s);
    }
    t.endShape(CLOSE);
  }
}

// vértice rotado alrededor del centro (cx,cy)
function rv(t, cx, cy, px, py, c, s) {
  t.vertex(cx + px * c - py * s, cy + px * s + py * c);
}

function undo() {
  if (strokes.length === 0) return;
  const s = strokes.pop();
  redoStack.push(s);
  rebuildLayer(s.layer); // rehace la capa desde el original + trazos restantes
  redraw();
}

function redo() {
  if (redoStack.length === 0) return;
  const s = redoStack.pop();
  strokes.push(s);
  rebuildLayer(s.layer);
  redraw();
}

// limpia todo el raspado pero deja los mismos tres collages
function clearScratch() {
  strokes = [];
  redoStack = [];
  currentStroke = null;
  scratchPhase = 1;
  resetWorkFromMasters();
  redraw();
}

// reconstruye un buffer desde su original + todos los trazos de esa capa.
// solo corre al deshacer/rehacer/limpiar. dibuja en bloques por recursión
// para no pasarse del tiempo del editor.
function rebuildLayer(which) {
  const master = (which === 'A') ? collageA : collageB;
  const work = (which === 'A') ? workA : workB;
  if (!master || !work) return;

  work.clear();
  work.image(master, 0, 0);

  // aplana los trazos de esta capa en estampas sueltas {x,y,size,shape,...}
  const stamps = [];
  for (const s of strokes) {
    if (s.layer !== which) continue;
    const pts = s.pts;
    const strength = (s.strength == null) ? 255 : s.strength;
    if (pts.length === 1) {
      stamps.push({ x: pts[0].x, y: pts[0].y, size: s.size, shape: s.shape, angle: 0, strength });
    } else {
      for (let i = 1; i < pts.length; i++) {
        collectStamps(stamps, s, pts[i - 1], pts[i]);
      }
    }
  }

  work.noStroke();
  work.fill(255);
  drawStampsChunk(work, stamps, 0);
}

function collectStamps(out, stroke, p1, p2) {
  const angle = atan2(p2.y - p1.y, p2.x - p1.x);
  const d = dist(p1.x, p1.y, p2.x, p2.y);
  const stepPx = max(1.5, stroke.size * 0.2);
  const n = min(100, max(1, ceil(d / stepPx))); // tope: evita el "infinite loop"
  const strength = (stroke.strength == null) ? 255 : stroke.strength;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({
      x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t),
      size: stroke.size, shape: stroke.shape, angle, strength
    });
  }
}

// dibuja las estampas en bloques por recursión (no un bucle largo). cada
// estampa abre/cierra su erase() con su fuerza (trazos con opacidades distintas).
function drawStampsChunk(work, stamps, start) {
  const end = min(start + 200, stamps.length);
  for (let i = start; i < end; i++) {
    const s = stamps[i];
    work.erase(s.strength, s.strength);
    stampShape(work, s.shape, s.size, s.x, s.y, s.angle);
    work.noErase();
  }
  if (end < stamps.length) drawStampsChunk(work, stamps, end); // recursión, no bucle
}

// === generación: cada collage de una vez, sobre un buffer aparte ===

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureWorkBuffers() {
  if (!workA) workA = createGraphics(CANVAS_SIZE, CANVAS_SIZE);
  if (!workB) workB = createGraphics(CANVAS_SIZE, CANVAS_SIZE);
}

// copia los originales (sin raspar) a los buffers de trabajo
function resetWorkFromMasters() {
  ensureWorkBuffers();
  workA.clear(); if (collageA) workA.image(collageA, 0, 0);
  workB.clear(); if (collageB) workB.image(collageB, 0, 0);
}

// genera tres collages nuevos y resetea el raspado. el await sleep(0) entre
// cada uno le devuelve el control al navegador para que no se congele.
async function generateNewCollages() {
  collageA = generateOneCollage();
  await sleep(0);
  collageB = generateOneCollage();
  await sleep(0);
  collageC = generateOneCollage();

  strokes = [];
  redoStack = [];
  currentStroke = null;
  scratchPhase = 1;
  resetWorkFromMasters();
}

function generateOneCollage() {
  // varias texturas de fondo (recorte + filtro + deformación random c/u).
  // por recursión, no for(): cada una es pesada y en un for() el cronómetro
  // del editor suma el costo de todas y salta.
  const bgLayers = [];
  buildBgLayers(bgLayers, 0, NUM_BG_LAYERS);

  const overlayA = buildRepeatingLayer({ fracMin: 0.04, fracMax: 0.09, deformMin: 8, deformMax: 20 });
  const overlayB = buildRepeatingLayer({ fracMin: 0.03, fracMax: 0.07, deformMin: 10, deformMax: 24 });

  // densidad ajustable: el slider multiplica las cantidades base
  const dm = densitySlider ? densitySlider.value() : 1;
  const bgBase = buildPiecesChunked(BASE_OPTS, max(1, round(NUM_BASE * dm)));
  const bgScraps = buildPiecesChunked(SCRAP_OPTS, max(1, round(NUM_SCRAPS * dm)));
  const features = buildPiecesChunked(FEATURE_OPTS, max(1, round(NUM_FEATURES * dm)));

  const g = createGraphics(width, height);
  g.background(12); // red de seguridad; lo tapa la primera textura

  // primera capa de fondo: cubre todo, opaca (nunca se ve el negro)
  drawRepeatingLayerFull(g, bgLayers[0], { opacity: 255, blend: BLEND });

  // el resto se mezcla encima en zonas sueltas, semitransparente y con
  // blend random, así el fondo queda hecho de texturas combinadas
  const BG_BLENDS = [MULTIPLY, SCREEN, OVERLAY, SOFT_LIGHT, BLEND];
  for (let i = 1; i < bgLayers.length; i++) {
    drawRepeatingLayerPatches(g, bgLayers[i], {
      numPatches: 2,
      patchFracMin: 0.3, patchFracMax: 0.5,
      opacity: random(110, 190),
      blend: random(BG_BLENDS)
    });
  }

  drawPieces(g, bgBase);
  drawPieces(g, bgScraps);
  drawPieces(g, features, true); // con sombra tipo "recorte pegado"

  // texturas de encima de todo: en parches sueltos, no todo el canvas
  drawRepeatingLayerPatches(g, overlayA, {
    numPatches: 4, patchFracMin: 0.22, patchFracMax: 0.4,
    opacity: 120, blend: OVERLAY
  });
  drawRepeatingLayerPatches(g, overlayB, {
    numPatches: 3, patchFracMin: 0.18, patchFracMax: 0.35,
    opacity: 100, blend: SCREEN
  });

  // grano final: una textura de grano reusada en los 3 collages
  g.blendMode(OVERLAY);
  g.image(getGrainTexture(), 0, 0);
  g.blendMode(BLEND);

  return g;
}

// === capa repetida: 1 fragmento → filtro → deformación → mosaico ===

// arma las capas de fondo por recursión. la primera (i===0) es la base
// fina que cubre todo; las demás usan tiles más grandes.
function buildBgLayers(out, i, total) {
  const fine = i === 0;
  out.push(buildRepeatingLayer({
    fracMin: fine ? random(0.05, 0.08) : random(0.1, 0.16),
    fracMax: fine ? random(0.09, 0.14) : random(0.18, 0.28),
    deformMin: random(5, 10), deformMax: random(14, 26)
  }));
  if (i + 1 < total) buildBgLayers(out, i + 1, total); // recursión, no bucle
}

function buildRepeatingLayer(opts) {
  const img = random(images);

  // piso de tamaño: con tiles muy chicos hacen falta muchísimos para
  // cubrir y el mosaico dispara el "infinite loop"
  const sw = max(30, floor(random(img.width * opts.fracMin, img.width * opts.fracMax)));
  const sh = max(30, floor(random(img.height * opts.fracMin, img.height * opts.fracMax)));
  const sx = floor(random(max(1, img.width - sw)));
  const sy = floor(random(max(1, img.height - sh)));

  let tile = img.get(sx, sy, sw, sh);

  // achicar antes de filtrar: filter() escanea todos los píxeles, un tile
  // grande filtrado adentro del armado era una causa del "infinite loop".
  // como se repite en mosaico, la baja de resolución no se nota.
  const TILE_MAX = 240;
  if (tile.width > TILE_MAX || tile.height > TILE_MAX) {
    if (tile.width >= tile.height) tile.resize(TILE_MAX, 0);
    else tile.resize(0, TILE_MAX);
  }

  // un solo filtro por tile, al azar
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

// espejo: refleja la mitad izquierda sobre la derecha (tipo rorschach)
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

// eco: doble/triple exposición desplazada (tipo foto movida)
function deformEcho(img, amp) {
  const g = createGraphics(img.width, img.height);
  g.image(img, 0, 0);
  g.tint(255, 110);
  g.image(img, amp, amp);
  g.image(img, -amp, -amp);
  g.noTint();
  return g.get();
}

// onda: corre cada fila horizontalmente según un seno, con wraparound
function deformWave(img, amp, freq) {
  const g = createGraphics(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    const offsetX = round(sin(y * freq) * amp);
    wrapCopyRow(g, img, y, offsetX);
  }
  return g.get();
}

// rayas: franjas horizontales que alternan el corrimiento izq/der
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

// glitch: separación de canales (aberración cromática) + bloques de filas
// que saltan al azar
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

// ruido: grano/estática + algunas filas corridas al azar (tipo VHS)
function deformNoise(img, amp) {
  const g1 = createGraphics(img.width, img.height);
  g1.image(img, 0, 0);
  g1.noStroke();
  // densidad con tope: este bucle corre por cada tile; sin tope se iba a
  // decenas de miles de rect() y disparaba el error
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

// copia una fila corrida en X, repitiendo la parte que se sale (sin huecos)
function wrapCopyRow(destG, srcImg, y, offsetX) {
  destG.copy(srcImg, 0, y, srcImg.width, 1, offsetX, y, srcImg.width, 1);
  if (offsetX > 0) {
    destG.copy(srcImg, srcImg.width - offsetX, y, offsetX, 1, offsetX - srcImg.width, y, offsetX, 1);
  } else if (offsetX < 0) {
    destG.copy(srcImg, 0, y, -offsetX, 1, srcImg.width + offsetX, y, -offsetX, 1);
  }
}

// igual que wrapCopyRow pero con un bloque de varias filas
function wrapCopyBlock(destG, srcImg, y, blockH, offsetX) {
  destG.copy(srcImg, 0, y, srcImg.width, blockH, offsetX, y, srcImg.width, blockH);
  if (offsetX > 0) {
    destG.copy(srcImg, srcImg.width - offsetX, y, offsetX, blockH, offsetX - srcImg.width, y, offsetX, blockH);
  } else if (offsetX < 0) {
    destG.copy(srcImg, 0, y, -offsetX, blockH, srcImg.width + offsetX, y, -offsetX, blockH);
  }
}

// tilea "layer" en un área de areaW x areaH, centrada en el origen actual
function drawTileGrid(g, layer, areaW, areaH, opacity, blend) {
  // tope de tiles: este bucle anidado es el que más itera; se llama muchas
  // veces por generación, así que lo limitamos
  const MAX_TILES_PER_SIDE = 22;
  const cols = min(ceil(areaW / layer.w) + 2, MAX_TILES_PER_SIDE);
  const rows = min(ceil(areaH / layer.h) + 2, MAX_TILES_PER_SIDE);

  g.blendMode(blend);
  g.tint(255, opacity);
  g.imageMode(CENTER);

  for (let ry = -1; ry < rows; ry++) {
    for (let rx = -1; rx < cols; rx++) {
      g.push();
      const flip = (rx + ry) % 2 === 0; // espejado para disimular la repetición
      g.translate(rx * layer.w - areaW / 2 + layer.w / 2, ry * layer.h - areaH / 2 + layer.h / 2);
      g.scale(flip ? -1 : 1, 1);
      g.image(layer.gfx, 0, 0);
      g.pop();
    }
  }
  g.blendMode(BLEND);
}

// cobertura total del canvas (fondo base, tiene que taparlo todo)
function drawRepeatingLayerFull(g, layer, opts) {
  if (!layer || layer.w < 2 || layer.h < 2) return;
  g.push();
  g.translate(g.width / 2, g.height / 2);
  drawTileGrid(g, layer, g.width, g.height, opts.opacity, opts.blend);
  g.pop();
}

// cobertura parcial, en parches sueltos de forma irregular (texturas de encima)
function drawRepeatingLayerPatches(g, layer, opts) {
  if (!layer || layer.w < 2 || layer.h < 2) return;

  for (let i = 0; i < opts.numPatches; i++) {
    const patchW = g.width * random(opts.patchFracMin, opts.patchFracMax);
    const patchH = g.height * random(opts.patchFracMin, opts.patchFracMax);

    g.push();
    g.translate(random(g.width), random(g.height));

    // la forma del parche es irregular (reusa el generador de blobs)
    g.beginClip();
    organicShape(g, patchW, patchH, random(0.3, 0.5));
    g.endClip();

    drawTileGrid(g, layer, patchW, patchH, opts.opacity, opts.blend);

    g.pop();
  }
}

// === construcción de un pedazo ===

// tamaño de bloque para cortar los bucles largos. el detector de "infinite
// loop" mide el tiempo que un mismo bucle corre sin parar. encadenamos los
// bloques por recursión (no un for/while, que acumularían el tiempo).
const CHUNK_SIZE = 20;

function buildPiecesChunked(opts, count) {
  const pieces = [];
  buildPiecesChunk(pieces, opts, 0, count);
  return pieces;
}

function buildPiecesChunk(pieces, opts, start, count) {
  const end = min(start + CHUNK_SIZE, count);
  for (let i = start; i < end; i++) pieces.push(createPiece(opts));
  if (end < count) buildPiecesChunk(pieces, opts, end, count); // recursión, no bucle
}

function createPiece(opts) {
  const img = random(images);

  const sw = floor(random(img.width * opts.fracMin, img.width * opts.fracMax));
  const sh = floor(random(img.height * opts.fracMin, img.height * opts.fracMax));
  const sx = floor(random(img.width - sw));
  const sy = floor(random(img.height - sh));

  // no recortamos cada pedazo en una imagen nueva (eran cientos en memoria).
  // guardamos la imagen + el rectángulo y lo dibujamos directo con image()
  // de 9 argumentos. solo los pocos con filtro necesitan una copia.
  let rendered = null;
  const doPost = random() < opts.filterChance;
  const doGray = random() < opts.grayChance;
  if (doPost || doGray) {
    rendered = img.get(sx, sy, sw, sh);
    // achicar antes de filtrar (se dibuja escalado, no se nota)
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
    src: img, rendered,        // rendered != null solo si llevó filtro
    sx, sy, sw, sh,
    w: sw, h: sh,
    drawScale: random(opts.drawScaleMin, opts.drawScaleMax),
    x: random(margin, width - margin),
    y: random(margin, height - margin),
    rotation: random(TWO_PI),
    // casi siempre opacidad normal; a veces uno bien transparente (fantasma)
    opacity: (random() < opts.lowOpacityChance)
      ? random(opts.lowOpacityMin, opts.lowOpacityMax)
      : random(opts.opMin, opts.opMax),
    blend: random(opts.blends),
    jag: random(opts.jagMin, opts.jagMax),
    shapeMode: random(SHAPE_MODES),
    tintCol: pickTint(opts.tintChance, opts.tintStrengthMin, opts.tintStrengthMax)
  };
}

// a veces devuelve un tinte random de la paleta, casi siempre blanco (sin tinte)
function pickTint(chance, strengthMin, strengthMax) {
  if (random() > chance) return color(255);
  const base = random(PALETTE);
  const strength = random(strengthMin, strengthMax);
  return lerpColor(color(255), color(base[0], base[1], base[2]), strength);
}

// === dibujo (sobre el buffer "g") ===

// dibuja los pedazos en bloques por recursión (igual que al construir)
function drawPieces(g, pieces, withShadow) {
  drawPiecesChunk(g, pieces, withShadow, 0);
  g.blendMode(BLEND);
}

function drawPiecesChunk(g, pieces, withShadow, start) {
  const end = min(start + CHUNK_SIZE, pieces.length);
  for (let i = start; i < end; i++) drawOnePiece(g, pieces[i], withShadow);
  if (end < pieces.length) drawPiecesChunk(g, pieces, withShadow, end); // recursión, no bucle
}

function drawOnePiece(g, p, withShadow) {
  g.push();
  g.translate(p.x, p.y);
  g.rotate(p.rotation);
  g.scale(p.drawScale);
  g.blendMode(p.blend);
  g.tint(red(p.tintCol), green(p.tintCol), blue(p.tintCol), p.opacity);

  if (withShadow) {
    g.drawingContext.shadowOffsetX = 5;
    g.drawingContext.shadowOffsetY = 6;
    g.drawingContext.shadowBlur = 14;
    g.drawingContext.shadowColor = 'rgba(0,0,0,0.5)';
  }

  g.beginClip();
  drawPieceShape(g, p.w, p.h, p.jag, p.shapeMode);
  g.endClip();

  g.imageMode(CENTER);
  if (p.rendered) {
    g.image(p.rendered, 0, 0, p.w, p.h); // copia filtrada, escalada al tamaño real
  } else {
    // image() de 9 args: recorta [sx,sy,sw,sh] de la imagen y lo dibuja centrado
    g.image(p.src, 0, 0, p.sw, p.sh, p.sx, p.sy, p.sw, p.sh);
  }

  if (withShadow) g.drawingContext.shadowBlur = 0;
  g.pop();
}

function drawPieceShape(g, w, h, jag, mode) {
  if (mode === 'angular') angularShape(g, w, h, jag);
  else if (mode === 'spiky') spikyShape(g, w, h, jag);
  else if (mode === 'strip') stripShape(g, w, h, jag);
  else organicShape(g, w, h, jag);
}

// mancha suave (ruido Perlin). "jag" = qué tan irregular es el borde.
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

// polígono filoso: pocos vértices, radios random sin suavizar
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

// estrella/espiga: alterna radio largo y corto
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

// tira alargada con bordes ondulados
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

// grano sutil tipo fotocopia. se genera una vez y se cachea; los 3 collages
// lo reusan con image()+OVERLAY. el bucle se parte en bloques por recursión.
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