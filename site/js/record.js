// Record what's on the globe as a short video: the map canvas, composited
// with a title, the date and the data credit, encoded in the browser with
// MediaRecorder and handed to the viewer as a download. Nothing is uploaded.

import { map } from './globe.js';
import { t } from './i18n.js';

// WebM first (Chrome, Firefox); MP4 for Safari, which has no WebM recorder.
const TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4'];

export const canRecord = () =>
  typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream && TYPES.some((t) => MediaRecorder.isTypeSupported(t));

// getText() → { title, subtitle, date, year } read every frame.
export function record({ seconds = 12, getText, onTick, onDone }) {
  const src = map.getCanvas();
  const scale = Math.min(1, 1920 / src.width);
  const W = Math.round(src.width * scale / 2) * 2;
  const H = Math.round(src.height * scale / 2) * 2;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d');
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(out.captureStream(30), { mimeType, videoBitsPerSecond: 10_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const u = W / 1280; // type scale
  const font = (w, px, fam) => `${w} ${Math.round(px * u)}px ${fam}`;
  let raf = 0;
  const t0 = performance.now();

  const draw = () => {
    g.fillStyle = '#05070c';
    g.fillRect(0, 0, W, H);
    g.drawImage(src, 0, 0, W, H);
    const text = getText();
    // A soft gradient so the captions read on any imagery.
    const grad = g.createLinearGradient(0, H * 0.62, 0, H);
    grad.addColorStop(0, 'rgba(5,7,12,0)');
    grad.addColorStop(1, 'rgba(5,7,12,0.75)');
    g.fillStyle = grad;
    g.fillRect(0, H * 0.6, W, H * 0.4);
    g.fillStyle = '#ffffff';
    g.textBaseline = 'alphabetic';
    g.font = font(600, 46, 'Fraunces, Georgia, serif');
    g.fillText(text.date, 40 * u, H - 78 * u);
    g.font = font(500, 22, 'Inter, system-ui, sans-serif');
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillText(text.year || '', 40 * u, H - 46 * u);
    g.textAlign = 'right';
    g.fillStyle = '#ffffff';
    g.font = font(600, 28, 'Fraunces, Georgia, serif');
    g.fillText(text.title, W - 40 * u, H - 78 * u);
    g.font = font(400, 17, 'Inter, system-ui, sans-serif');
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText(text.subtitle || '', W - 40 * u, H - 50 * u);
    g.font = font(400, 13, 'Inter, system-ui, sans-serif');
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillText(t('Track the Migration · tracks: Movebank Data Repository · imagery: Sentinel-2 cloudless by EOX'), W - 40 * u, H - 24 * u);
    g.textAlign = 'left';
    onTick?.(Math.max(0, seconds - (performance.now() - t0) / 1000));
    if (rec.state !== 'inactive') raf = requestAnimationFrame(draw);
  };

  rec.onstop = () => {
    cancelAnimationFrame(raf);
    const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
    onDone?.(blob, ext);
  };
  rec.start(250);
  draw();
  // A wall-clock stop, so a hidden tab (no animation frames) still finishes.
  const timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), seconds * 1000);
  return { stop: () => { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop(); } };
}
