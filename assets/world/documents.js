// Documents keep their interaction coordinates. Their holders are built after
// the furniture, so a nearby desk can support a clipboard instead of a floor stand.
export function documentMount(point, supports) {
  let nearest = null,
    distance = Infinity;
  for (const support of supports) {
    if (!Number.isFinite(support.supportTop) || point.y <= support.supportTop + 0.08) continue;
    const dx = Math.max(0, Math.abs(point.x - support.x) - support.w),
      dz = Math.max(0, Math.abs(point.z - support.z) - support.d),
      d = Math.hypot(dx, dz);
    if (d > 0.28 || d >= distance) continue;
    distance = d;
    nearest = support;
  }
  const base = nearest?.supportTop ?? 0;
  const height = nearest ? Math.min(0.5, 2 * (point.y - base - 0.025)) : 0.5;
  return {
    point: {...point},
    type: nearest ? 'desk' : 'floor',
    base,
    height,
    width: height * 1.44,
    anchor: nearest
      ? {
          x: Math.max(
            nearest.x - nearest.w + 0.06,
            Math.min(nearest.x + nearest.w - 0.06, point.x),
          ),
          z: Math.max(
            nearest.z - nearest.d + 0.06,
            Math.min(nearest.z + nearest.d - 0.06, point.z),
          ),
        }
      : {x: point.x, z: point.z},
  };
}

export function buildDocumentHolder({mat, block, sign, solid}, mount, title, text) {
  const {point: p, base, height: h, width: w, anchor: a, type} = mount;
  const bottom = p.y - h / 2,
    back = p.z - 0.022;
  // A thin painted backing replaces the opaque black slab on the reverse.
  block(mat.paint, p.x, p.y, back, w + 0.045, h + 0.045, 0.028);
  sign(title, text, p.x, p.y, p.z, w, h, 0, 'paper');
  for (const side of [-1, 1]) {
    block(mat.zinc, p.x + side * (w / 2 + 0.012), p.y, back, 0.018, h + 0.065, 0.035);
    block(mat.zinc, p.x, p.y + side * (h / 2 + 0.012), back, w + 0.065, 0.018, 0.035);
  }
  block(mat.steel, p.x, p.y + h / 2 - 0.018, p.z + 0.012, 0.13, 0.045, 0.016);
  if (type === 'desk') {
    block(mat.steel, a.x, base + 0.018, a.z - 0.035, 0.32, 0.036, 0.27);
    const top = bottom + 0.025;
    block(mat.steel, a.x, (base + top) / 2, a.z - 0.05, 0.038, top - base, 0.045);
    // A short bracket joins an overhanging clipboard to the actual tabletop.
    block(
      mat.steel,
      (a.x + p.x) / 2,
      top,
      (a.z + p.z) / 2 - 0.045,
      Math.abs(a.x - p.x) + 0.04,
      0.025,
      Math.abs(a.z - p.z) + 0.045,
    );
  } else {
    for (const side of [-1, 1]) {
      const x = p.x + side * Math.min(0.2, w * 0.32),
        top = bottom + 0.035;
      block(mat.steel, x, (top + 0.045) / 2, p.z - 0.055, 0.045, top - 0.045, 0.055);
      block(mat.zinc, x, 0.035, p.z - 0.045, 0.085, 0.04, 0.4);
      for (const z of [-0.17, 0.08]) block(mat.black, x, 0.014, p.z + z, 0.095, 0.028, 0.09);
    }
    block(
      mat.steel,
      p.x,
      Math.max(0.25, bottom * 0.55),
      p.z - 0.055,
      Math.min(0.44, w * 0.7),
      0.025,
      0.035,
    );
    solid(p.x, p.z - 0.035, w + 0.065, 0.4);
  }
}

export function buildInstrumentLabel({mat, block, sign}, title, subtitle, x, y, z, w, h) {
  block(mat.paint, x, y, z - 0.023, w + 0.045, h + 0.045, 0.032);
  const bottom = y - h / 2,
    start = 0.98;
  for (const side of [-1, 1])
    block(
      mat.steel,
      x + side * Math.min(0.4, w * 0.28),
      (bottom + start) / 2,
      z - 0.055,
      0.026,
      bottom - start + 0.02,
      0.035,
    );
  sign(title, subtitle, x, y, z, w, h);
}
