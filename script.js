(() => {
  "use strict";
  const REC_SIZE = 20;                       // TinyTask record: msg, paramL, paramH, time, hwnd (uint32 LE each)
  const BTN = { 513: 0x0002, 514: 0x0004, 516: 0x0008, 517: 0x0010, 519: 0x0020, 520: 0x0040 };
  const KEY_DOWN = [256, 260], KEY_UP = [257, 261];

  const drop = document.getElementById("drop");
  const input = document.getElementById("file");
  const list = document.getElementById("results");
  const errBox = document.getElementById("error");

  // type: 0 move, 1 mouse button, 2 key, 3 wheel
  function convert(buf) {
    const count = Math.floor(buf.byteLength / REC_SIZE);
    if (!count) throw new Error("File is empty or too small to be a TinyTask .rec");
    const dv = new DataView(buf), events = [];
    let t0 = null;
    for (let i = 0; i < count; i++) {
      const o = i * REC_SIZE;
      const msg = dv.getUint32(o, true), pl = dv.getUint32(o + 4, true), ph = dv.getUint32(o + 8, true), tm = dv.getUint32(o + 12, true);
      if (t0 === null) t0 = tm;
      const t = (tm - t0) >>> 0;
      if (KEY_DOWN.includes(msg) || KEY_UP.includes(msg)) {
        events.push({ t, type: 2, up: KEY_UP.includes(msg) ? 1 : 0, sc: (pl >> 8) & 0xff, x: 0, y: 0, data: ph & 0x8000 ? 1 : 0 });
      } else if (msg === 512) {
        events.push({ t, type: 0, up: 0, sc: 0, x: pl | 0, y: ph | 0, data: 0 });
      } else if (BTN[msg] !== undefined) {
        events.push({ t, type: 1, up: 0, sc: 0, x: pl | 0, y: ph | 0, data: BTN[msg] });
      } else if (msg === 522) {
        events.push({ t, type: 3, up: 0, sc: 0, x: 0, y: 0, data: ((ph >>> 16) << 16) >> 16 });
      }
    }
    if (!events.length) throw new Error("No keyboard or mouse events found. Is this a TinyTask .rec file?");

    const out = new ArrayBuffer(8 + events.length * 20), v = new DataView(out);
    "SQM1".split("").forEach((c, i) => v.setUint8(i, c.charCodeAt(0)));
    v.setInt32(4, events.length, true);
    events.forEach((e, i) => {
      const o = 8 + i * 20;
      v.setUint32(o, e.t, true); v.setUint8(o + 4, e.type); v.setUint8(o + 5, e.up); v.setUint16(o + 6, e.sc, true);
      v.setInt32(o + 8, e.x, true); v.setInt32(o + 12, e.y, true); v.setInt32(o + 16, e.data, true);
    });
    const c = (ty) => events.filter((e) => e.type === ty).length;
    return { out, stats: { events: events.length, seconds: events[events.length - 1].t / 1000, keys: c(2), clicks: c(1), moves: c(0) } };
  }

  function card(name, node) {
    const li = document.createElement("li");
    li.className = "item"; li.append(...node);
    list.prepend(li);
    return li;
  }
  function info(name, meta) {
    const d = document.createElement("div"); d.className = "info";
    const n = document.createElement("div"); n.className = "name"; n.textContent = name;
    const m = document.createElement("div"); m.className = "meta"; m.textContent = meta;
    d.append(n, m); return d;
  }

  async function handle(file) {
    try {
      const { out, stats } = convert(await file.arrayBuffer());
      const outName = file.name.replace(/\.rec$/i, "") + ".sqm";
      const btn = document.createElement("button");
      btn.className = "dl"; btn.textContent = "Download .sqm";
      btn.onclick = () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([out], { type: "application/octet-stream" }));
        a.download = outName; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      };
      card(outName, [info(outName, `${stats.events} events, ${stats.seconds.toFixed(1)} s, ${stats.keys} key, ${stats.clicks} clicks, ${stats.moves} moves`), btn]);
    } catch (e) {
      const li = card(file.name, [info(file.name, e.message)]); li.classList.add("fail");
    }
  }

  function take(files) {
    errBox.hidden = true;
    const recs = [...files].filter((f) => /\.rec$/i.test(f.name));
    if (!recs.length) { errBox.textContent = "Please choose a .rec file."; errBox.hidden = false; return; }
    recs.forEach(handle);
  }

  input.addEventListener("change", () => { take(input.files); input.value = ""; });
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => take(e.dataTransfer.files));
})();
