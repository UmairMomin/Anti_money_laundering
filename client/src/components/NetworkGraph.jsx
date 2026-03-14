"use client";
// components/GraphSearchViz.jsx
// npm install d3
// Drop-in for your Next.js app: <GraphSearchViz height={680} />

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

// ── Graph Data ─────────────────────────────────────────────────────────────────
const NODES = [
  { id: "1", label: "Alice", group: "person", size: 20 },
  { id: "2", label: "Bob", group: "person", size: 18 },
  { id: "3", label: "Carol", group: "person", size: 22 },
  { id: "4", label: "Dave", group: "person", size: 16 },
  { id: "5", label: "Eve", group: "person", size: 19 },
  { id: "6", label: "GraphDB", group: "database", size: 28 },
  { id: "7", label: "Auth API", group: "service", size: 24 },
  { id: "8", label: "Cache", group: "service", size: 20 },
  { id: "9", label: "Frontend", group: "app", size: 26 },
  { id: "10", label: "Mobile", group: "app", size: 22 },
  { id: "11", label: "Analytics", group: "service", size: 18 },
  { id: "12", label: "Storage", group: "database", size: 24 },
];

const LINKS = [
  { source: "1", target: "7", label: "USES", strength: 0.8 },
  { source: "2", target: "7", label: "USES", strength: 0.6 },
  { source: "3", target: "9", label: "ACCESSES", strength: 0.9 },
  { source: "4", target: "10", label: "ACCESSES", strength: 0.7 },
  { source: "5", target: "9", label: "ACCESSES", strength: 0.8 },
  { source: "7", target: "6", label: "QUERIES", strength: 1.0 },
  { source: "7", target: "8", label: "CACHES", strength: 0.7 },
  { source: "9", target: "7", label: "CALLS", strength: 0.9 },
  { source: "10", target: "7", label: "CALLS", strength: 0.8 },
  { source: "6", target: "12", label: "STORES", strength: 1.0 },
  { source: "9", target: "11", label: "TRACKS", strength: 0.5 },
  { source: "10", target: "11", label: "TRACKS", strength: 0.5 },
  { source: "1", target: "2", label: "KNOWS", strength: 0.4 },
  { source: "2", target: "3", label: "KNOWS", strength: 0.6 },
  { source: "3", target: "5", label: "KNOWS", strength: 0.5 },
  { source: "4", target: "1", label: "KNOWS", strength: 0.3 },
];

// ── Palettes ───────────────────────────────────────────────────────────────────
const GC = {
  person: "#38bdf8",
  database: "#f472b6",
  service: "#4ade80",
  app: "#fbbf24",
  default: "#a78bfa",
};

const PHASE_COLOR = {
  idle: "#1e3a5a",
  scanning: "#38bdf8",
  matching: "#fbbf24",
  routing: "#a78bfa",
  zooming: "#6366f1",
  complete: "#4ade80",
  notfound: "#f87171",
};

// ── BFS ────────────────────────────────────────────────────────────────────────
function bfs(startIds, links, maxDepth = 2) {
  const visited = new Set(startIds);
  const layers = [new Set(startIds)];
  const edgeSets = [new Set()];
  let frontier = new Set(startIds);

  for (let d = 0; d < maxDepth; d++) {
    const nextN = new Set();
    const nextE = new Set();
    links.forEach((l) => {
      const s = l.source?.id ?? l.source;
      const t = l.target?.id ?? l.target;
      if (frontier.has(s) && !visited.has(t)) {
        nextN.add(t);
        nextE.add(l);
        visited.add(t);
      }
      if (frontier.has(t) && !visited.has(s)) {
        nextN.add(s);
        nextE.add(l);
        visited.add(s);
      }
    });
    if (!nextN.size) break;
    layers.push(nextN);
    edgeSets.push(nextE);
    frontier = nextN;
  }
  return { layers, edgeSets, allIds: visited };
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function GraphSearchViz({ height = 680 }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const sceneRef = useRef(null); // { svg, nodeSel, linkSel, zoom, W, H, particleG, nodes, links }
  const nodeMap = useRef(new Map());
  const linkMap = useRef(new Map());
  const aliveRef = useRef(true);
  const runRef = useRef(0);
  const logRef = useRef(null);

  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [scanPct, setScanPct] = useState(0);

  const pushLog = useCallback((t) => setLogs((p) => [...p.slice(-18), t]), []);

  // ── D3 Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    aliveRef.current = true;
    const el = svgRef.current;
    const wrap = wrapRef.current;
    const W = wrap.clientWidth || 800;
    const H = typeof height === "number" ? height : 680;

    const svg = d3.select(el).attr("viewBox", `0 0 ${W} ${H}`);
    svg.selectAll("*").remove();

    // ── Defs ──────────────────────────────────────────────────────────────────
    const defs = svg.append("defs");

    defs
      .append("marker")
      .attr("id", "gsv-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#0e2236");

    // Particle trail gradient (horizontal)
    const tg = defs
      .append("linearGradient")
      .attr("id", "tg")
      .attr("x1", "0")
      .attr("x2", "1");
    tg.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#fbbf24")
      .attr("stop-opacity", 0);
    tg.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#fbbf24")
      .attr("stop-opacity", 1);

    // ── Grid ──────────────────────────────────────────────────────────────────
    const gridG = svg.append("g");
    for (let x = 0; x < W; x += 42)
      gridG
        .append("line")
        .attr("x1", x)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", H)
        .attr("stroke", "#060f1c")
        .attr("stroke-width", 0.5);
    for (let y = 0; y < H; y += 42)
      gridG
        .append("line")
        .attr("x1", 0)
        .attr("y1", y)
        .attr("x2", W)
        .attr("y2", y)
        .attr("stroke", "#060f1c")
        .attr("stroke-width", 0.5);

    // Diagonal accent lines (cyberpunk feel)
    [
      [0, 0, 120, 60],
      [W - 120, 0, W, 50],
      [0, H - 50, 100, H],
      [W - 100, H, W, H - 50],
    ].forEach(([x1, y1, x2, y2]) => {
      gridG
        .append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", "#091828")
        .attr("stroke-width", 1);
    });

    // ── Scan beam + glow ─────────────────────────────────────────────────────
    svg
      .append("rect")
      .attr("class", "scan-beam")
      .attr("x", 0)
      .attr("y", -6)
      .attr("width", W)
      .attr("height", 4)
      .attr("fill", "#38bdf8")
      .attr("opacity", 0);
    svg
      .append("rect")
      .attr("class", "scan-glow")
      .attr("x", 0)
      .attr("y", -60)
      .attr("width", W)
      .attr("height", 60)
      .attr("fill", "#38bdf8")
      .attr("fill-opacity", 0.04)
      .attr("opacity", 0);

    // ── Corner brackets (HUD) ─────────────────────────────────────────────────
    const bLen = 20,
      bW = 1.5,
      bColor = "#091e38";
    [
      [0, 0, 1, 1],
      [W, 0, -1, 1],
      [0, H, 1, -1],
      [W, H, -1, -1],
    ].forEach(([cx, cy, dx, dy]) => {
      svg
        .append("path")
        .attr(
          "d",
          `M${cx + dx * bLen},${cy} L${cx},${cy} L${cx},${cy + dy * bLen}`,
        )
        .attr("fill", "none")
        .attr("stroke", bColor)
        .attr("stroke-width", bW);
    });

    // ── Zoom layer ────────────────────────────────────────────────────────────
    const g = svg.append("g").attr("class", "zoom-layer");
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 8])
      .on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    const linkG = g.append("g").attr("class", "link-layer");
    const particleG = g.append("g").attr("class", "particle-layer");
    const nodeG = g.append("g").attr("class", "node-layer");

    // ── Build graph data ──────────────────────────────────────────────────────
    const nodes = NODES.map((n) => ({ ...n }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const links = LINKS.map((l) => ({
      ...l,
      source: byId[l.source],
      target: byId[l.target],
    }));

    // ── Simulation ───────────────────────────────────────────────────────────
    const sim = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(120)
          .strength((d) => d.strength || 0.5),
      )
      .force("charge", d3.forceManyBody().strength(-340))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force(
        "collide",
        d3.forceCollide().radius((d) => d.size + 16),
      )
      .alphaDecay(0.025)
      .on("tick", () => {
        linkSel
          .select("line")
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);
        linkSel
          .select("text")
          .attr("x", (d) => (d.source.x + d.target.x) / 2)
          .attr("y", (d) => (d.source.y + d.target.y) / 2 - 5);
        nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

    // ── Draw links ────────────────────────────────────────────────────────────
    const linkSel = linkG
      .selectAll("g.lgrp")
      .data(links)
      .join("g")
      .attr("class", "lgrp");

    linkSel
      .append("line")
      .attr("class", "link-line")
      .attr("stroke", "#0b1d30")
      .attr("stroke-opacity", 0.75)
      .attr("stroke-width", (d) => Math.max(0.8, (d.strength || 0.5) * 2.4))
      .attr("marker-end", "url(#gsv-arrow)");

    linkSel
      .append("text")
      .attr("class", "link-lbl")
      .attr("text-anchor", "middle")
      .attr("font-size", "7.5px")
      .attr("font-family", "JetBrains Mono,Fira Code,monospace")
      .attr("fill", "#0e2438")
      .attr("pointer-events", "none")
      .text((d) => d.label);

    // Build linkMap keyed by "sourceId-targetId"
    linkMap.current.clear();
    linkSel.each(function (d) {
      linkMap.current.set(`${d.source.id}-${d.target.id}`, d3.select(this));
    });

    // ── Draw nodes ────────────────────────────────────────────────────────────
    const nodeSel = nodeG
      .selectAll("g.ngrp")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("class", "ngrp")
      .style("cursor", "pointer")
      .call(
        d3
          .drag()
          .on("start", (e, d) => {
            if (!e.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (e, d) => {
            d.fx = e.x;
            d.fy = e.y;
          })
          .on("end", (e, d) => {
            if (!e.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    // Outer ambient halo
    nodeSel
      .append("circle")
      .attr("class", "n-halo")
      .attr("r", (d) => d.size + 9)
      .attr("fill", (d) => GC[d.group] || GC.default)
      .attr("fill-opacity", 0.06)
      .attr("stroke", (d) => GC[d.group] || GC.default)
      .attr("stroke-opacity", 0.12)
      .attr("stroke-width", 0.8);

    // Scan pulse ring
    nodeSel
      .append("circle")
      .attr("class", "n-scan")
      .attr("r", (d) => d.size + 4)
      .attr("fill", "none")
      .attr("stroke", "#38bdf8")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0);

    // Match ring (golden)
    nodeSel
      .append("circle")
      .attr("class", "n-match")
      .attr("r", (d) => d.size + 6)
      .attr("fill", "none")
      .attr("stroke", "#fbbf24")
      .attr("stroke-width", 2)
      .attr("opacity", 0);

    // Body
    nodeSel
      .append("circle")
      .attr("class", "n-body")
      .attr("r", (d) => d.size)
      .attr("fill", (d) => GC[d.group] || GC.default)
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#020c1b")
      .attr("stroke-width", 2);

    // Label below
    nodeSel
      .append("text")
      .attr("class", "n-lbl")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.size + 14)
      .attr("font-size", "10px")
      .attr("font-family", "JetBrains Mono,Fira Code,monospace")
      .attr("fill", "#1a4a6a")
      .attr("pointer-events", "none")
      .text((d) => d.label);

    // Build nodeMap
    nodeMap.current.clear();
    nodeSel.each(function (d) {
      nodeMap.current.set(d.id, d3.select(this));
    });

    // Store everything for the search fn
    sceneRef.current = {
      svg,
      nodeSel,
      linkSel,
      zoom,
      W,
      H,
      particleG,
      nodes,
      links,
    };

    return () => {
      aliveRef.current = false;
      sim.stop();
    };
  }, [height]);

  // ── Search Pipeline ──────────────────────────────────────────────────────────
  const runSearch = useCallback(
    (term) => {
      if (!sceneRef.current) return;
      const run = ++runRef.current;
      const { svg, nodeSel, linkSel, zoom, W, H, particleG, nodes, links } =
        sceneRef.current;
      const ok = () => aliveRef.current && runRef.current === run;

      // ── Helpers ────────────────────────────────────────────────────────────────
      const after = (ms, fn) =>
        setTimeout(() => {
          if (ok()) fn();
        }, ms);

      // ── Reset visuals ──────────────────────────────────────────────────────────
      particleG.selectAll("*").remove();

      nodeSel
        .select(".n-body")
        .transition()
        .duration(200)
        .attr("fill", (d) => GC[d.group] || GC.default)
        .attr("fill-opacity", 0.85)
        .attr("r", (d) => d.size);
      nodeSel
        .select(".n-halo")
        .transition()
        .duration(200)
        .attr("fill-opacity", 0.06)
        .attr("stroke-opacity", 0.12);
      nodeSel.select(".n-match").attr("opacity", 0);
      nodeSel.select(".n-scan").attr("opacity", 0);

      linkSel
        .select(".link-line")
        .transition()
        .duration(200)
        .attr("stroke", "#0b1d30")
        .attr("stroke-opacity", 0.75)
        .attr("stroke-dasharray", null)
        .attr("stroke-dashoffset", null);

      svg.select(".scan-beam").interrupt().attr("opacity", 0);
      svg.select(".scan-glow").interrupt().attr("opacity", 0);
      setScanPct(0);

      // ── Idle reset ─────────────────────────────────────────────────────────────
      if (!term.trim()) {
        setPhase("idle");
        setLogs([]);
        svg
          .transition()
          .duration(700)
          .ease(d3.easeCubicInOut)
          .call(zoom.transform, d3.zoomIdentity);
        return;
      }

      const tl = term.toLowerCase();
      const matched = nodes.filter((n) => n.label.toLowerCase().includes(tl));
      const mids = new Set(matched.map((n) => n.id));

      // ══════════════════════════════════════════════════════════════════════════
      // PHASE 1 · SCAN
      // ══════════════════════════════════════════════════════════════════════════
      setPhase("scanning");
      setLogs([]);
      pushLog(`neo4j> MATCH (n)`);
      pushLog(`...    WHERE toLower(n.label)`);
      pushLog(`...    CONTAINS "${tl}"`);
      pushLog(`       [scanning ${nodes.length} nodes]`);

      // Dim everything
      nodeSel
        .select(".n-body")
        .transition()
        .duration(150)
        .attr("fill-opacity", 0.14);
      nodeSel
        .select(".n-halo")
        .transition()
        .duration(150)
        .attr("stroke-opacity", 0.04);
      linkSel
        .select(".link-line")
        .transition()
        .duration(150)
        .attr("stroke-opacity", 0.05);

      // Sweep beam top → bottom
      const beam = svg.select(".scan-beam");
      const glow = svg.select(".scan-glow");
      beam.attr("y", -6).attr("opacity", 0.9);
      glow.attr("y", -60).attr("opacity", 1);
      beam.transition().duration(820).ease(d3.easeLinear).attr("y", H);
      glow
        .transition()
        .duration(820)
        .ease(d3.easeLinear)
        .attr("y", H - 60);

      // Per-node scan pulses sorted top→bottom
      const scanOrder = [...nodes].sort((a, b) => a.y - b.y);
      const step = 740 / scanOrder.length;
      scanOrder.forEach((nd, i) => {
        setTimeout(
          () => {
            if (!ok()) return;
            setScanPct(Math.round(((i + 1) / scanOrder.length) * 100));
            const ng = nodeMap.current.get(nd.id);
            if (!ng) return;
            ng.select(".n-scan")
              .attr("r", nd.size + 3)
              .attr("opacity", 0.9)
              .attr("stroke", mids.has(nd.id) ? "#fbbf24" : "#38bdf8")
              .transition()
              .duration(230)
              .attr("r", nd.size + 20)
              .attr("opacity", 0);
            if (i % 3 === 0) pushLog(`  checking: ${nd.label}`);
          },
          30 + i * step,
        );
      });

      // ══════════════════════════════════════════════════════════════════════════
      // After scan
      // ══════════════════════════════════════════════════════════════════════════
      after(850, () => {
        beam.transition().duration(250).attr("opacity", 0);
        glow.transition().duration(250).attr("opacity", 0);

        // ── NOT FOUND ──────────────────────────────────────────────────────────
        if (!matched.length) {
          setPhase("notfound");
          pushLog(`> 0 results`);
          pushLog(`  [NULL]`);
          nodeSel
            .select(".n-body")
            .transition()
            .duration(500)
            .attr("fill-opacity", 0.85);
          nodeSel
            .select(".n-halo")
            .transition()
            .duration(500)
            .attr("stroke-opacity", 0.12);
          linkSel
            .select(".link-line")
            .transition()
            .duration(500)
            .attr("stroke-opacity", 0.75);
          setScanPct(0);
          return;
        }

        // ══════════════════════════════════════════════════════════════════════
        // PHASE 2 · MATCH REVEAL
        // ══════════════════════════════════════════════════════════════════════
        setPhase("matching");
        pushLog(`> ${matched.length} node(s) found:`);
        matched.forEach((n) => pushLog(`  ↳ (${n.id}:${n.group}) ${n.label}`));

        matched.forEach((n) => {
          const ng = nodeMap.current.get(n.id);
          if (!ng) return;

          // Expand body + halo
          ng.select(".n-body")
            .transition()
            .duration(380)
            .attr("fill-opacity", 1)
            .attr("r", n.size * 1.22);
          ng.select(".n-halo")
            .transition()
            .duration(380)
            .attr("fill-opacity", 0.22)
            .attr("stroke-opacity", 0.75);
          ng.select(".n-match").attr("opacity", 1);

          // 4 outward burst rings
          [0, 160, 310, 480].forEach((delay, wi) => {
            after(delay, () => {
              ng.append("circle")
                .attr("r", n.size)
                .attr("fill", "none")
                .attr("stroke", "#fbbf24")
                .attr("stroke-width", wi === 0 ? 2.5 : wi === 1 ? 2 : 1.2)
                .attr("opacity", 1)
                .transition()
                .duration(750)
                .attr("r", n.size + 44)
                .attr("opacity", 0)
                .on("end", function () {
                  d3.select(this).remove();
                });
            });
          });
        });

        // ══════════════════════════════════════════════════════════════════════
        // PHASE 3 · BFS ROUTING
        // ══════════════════════════════════════════════════════════════════════
        after(600, () => {
          if (!ok()) return;
          setPhase("routing");
          pushLog(`> TRAVERSING CONNECTIONS...`);

          const { layers, edgeSets, allIds } = bfs(mids, links);

          // ── Depth 1: direct connections (gold) ─────────────────────────────
          edgeSets[1]?.forEach((l) => {
            const key = `${l.source.id}-${l.target.id}`;
            const lsel = linkMap.current.get(key);
            if (!lsel) return;
            lsel
              .select(".link-line")
              .attr("stroke", "#fbbf24")
              .attr("stroke-opacity", 1)
              .attr("stroke-width", Math.max(1.5, (l.strength || 0.5) * 3))
              .attr("stroke-dasharray", "6,3")
              .attr("stroke-dashoffset", "0")
              .transition()
              .duration(1400)
              .ease(d3.easeLinear)
              .attr("stroke-dashoffset", "-90");
          });

          after(300, () => {
            pushLog(`  depth-1: ${layers[1]?.size || 0} reachable`);
            layers[1]?.forEach((nid) => {
              const nd = nodes.find((n) => n.id === nid);
              const ng = nodeMap.current.get(nid);
              if (!ng || !nd) return;
              ng.select(".n-body")
                .transition()
                .duration(350)
                .attr("fill", "#7dd3fc")
                .attr("fill-opacity", 0.75);
              ng.select(".n-halo")
                .transition()
                .duration(350)
                .attr("stroke", "#7dd3fc")
                .attr("stroke-opacity", 0.55);
              // Ping ring
              ng.append("circle")
                .attr("r", nd.size)
                .attr("fill", "none")
                .attr("stroke", "#7dd3fc")
                .attr("stroke-width", 1.8)
                .attr("opacity", 0.9)
                .transition()
                .duration(600)
                .attr("r", nd.size + 30)
                .attr("opacity", 0)
                .on("end", function () {
                  d3.select(this).remove();
                });
            });
          });

          // ── Depth 2: two-hop connections (indigo) ──────────────────────────
          after(700, () => {
            pushLog(`  depth-2: ${layers[2]?.size || 0} reachable`);
            edgeSets[2]?.forEach((l) => {
              const key = `${l.source.id}-${l.target.id}`;
              const lsel = linkMap.current.get(key);
              if (!lsel) return;
              lsel
                .select(".link-line")
                .attr("stroke", "#818cf8")
                .attr("stroke-opacity", 0.75)
                .attr("stroke-dasharray", "3,4")
                .attr("stroke-dashoffset", "0")
                .transition()
                .duration(1100)
                .ease(d3.easeLinear)
                .attr("stroke-dashoffset", "-56");
            });
            layers[2]?.forEach((nid) => {
              const nd = nodes.find((n) => n.id === nid);
              const ng = nodeMap.current.get(nid);
              if (!ng || !nd) return;
              ng.select(".n-body")
                .transition()
                .duration(300)
                .attr("fill", "#818cf8")
                .attr("fill-opacity", 0.5);
              ng.append("circle")
                .attr("r", nd.size)
                .attr("fill", "none")
                .attr("stroke", "#818cf8")
                .attr("stroke-width", 1.2)
                .attr("opacity", 0.8)
                .transition()
                .duration(500)
                .attr("r", nd.size + 22)
                .attr("opacity", 0)
                .on("end", function () {
                  d3.select(this).remove();
                });
            });
          });

          // ════════════════════════════════════════════════════════════════════
          // PHASE 4 · ZOOM TO SUBGRAPH
          // ════════════════════════════════════════════════════════════════════
          after(layers.length * 380 + 350, () => {
            if (!ok()) return;
            setPhase("zooming");
            pushLog(`> FOCUSING SUBGRAPH (${allIds.size} nodes)...`);

            const involved = nodes.filter((n) => allIds.has(n.id));
            if (involved.length > 1) {
              const xs = involved.map((n) => n.x);
              const ys = involved.map((n) => n.y);
              const pad = 80;
              const x0 = Math.min(...xs) - pad;
              const x1 = Math.max(...xs) + pad;
              const y0 = Math.min(...ys) - pad;
              const y1 = Math.max(...ys) + pad;
              const scale = Math.min(
                4.2,
                0.78 * Math.min(W / (x1 - x0), H / (y1 - y0)),
              );
              const cx = (x0 + x1) / 2;
              const cy = (y0 + y1) / 2;

              svg
                .transition()
                .duration(1000)
                .ease(d3.easeCubicInOut)
                .call(
                  zoom.transform,
                  d3.zoomIdentity
                    .translate(W / 2, H / 2)
                    .scale(scale)
                    .translate(-cx, -cy),
                );
            }

            // ══════════════════════════════════════════════════════════════════
            // PHASE 5 · PARTICLE FLOW
            // ══════════════════════════════════════════════════════════════════
            after(950, () => {
              if (!ok()) return;
              setPhase("complete");
              setScanPct(100);
              pushLog(`> STREAMING DATA`);
              pushLog(
                `  ${allIds.size} nodes · ${edgeSets.reduce((s, e) => s + (e?.size || 0), 0)} edges`,
              );

              // Collect all active edges (within subgraph)
              const activeEdges = links.filter(
                (l) => allIds.has(l.source.id) && allIds.has(l.target.id),
              );

              activeEdges.forEach((l, ei) => {
                after(ei * 55, () => {
                  if (!ok()) return;
                  const isSrc = mids.has(l.source.id);
                  const color = isSrc ? "#fbbf24" : "#38bdf8";
                  const speed = 0.005 + Math.random() * 0.006;
                  const radius = isSrc ? 3.8 : 2.6;
                  let prog = Math.random();

                  const dot = particleG
                    .append("circle")
                    .attr("r", radius)
                    .attr("fill", color)
                    .attr("fill-opacity", 0.92)
                    .attr("cx", l.source.x)
                    .attr("cy", l.source.y);

                  // Tiny trail circle
                  const trail = particleG
                    .append("circle")
                    .attr("r", radius * 0.55)
                    .attr("fill", color)
                    .attr("fill-opacity", 0.3)
                    .attr("cx", l.source.x)
                    .attr("cy", l.source.y);

                  const tick = () => {
                    if (!ok()) {
                      dot.remove();
                      trail.remove();
                      return;
                    }
                    prog = (prog + speed) % 1;
                    const trailProg = Math.max(0, prog - 0.06);
                    const sx = l.source.x,
                      sy = l.source.y;
                    const tx = l.target.x,
                      ty = l.target.y;
                    dot
                      .attr("cx", sx + (tx - sx) * prog)
                      .attr("cy", sy + (ty - sy) * prog);
                    trail
                      .attr("cx", sx + (tx - sx) * trailProg)
                      .attr("cy", sy + (ty - sy) * trailProg);
                    requestAnimationFrame(tick);
                  };
                  requestAnimationFrame(tick);
                });
              });
            });
          });
        });
      });
    },
    [pushLog],
  );

  // ── Debounced search trigger ─────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => runSearch(query), 280);
    return () => clearTimeout(id);
  }, [query, runSearch]);

  // ── Auto-scroll log ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const pc = PHASE_COLOR[phase] || "#1e3a5a";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: "#020c1b",
        borderRadius: 12,
        overflow: "hidden",
        fontFamily: "JetBrains Mono,Fira Code,Courier New,monospace",
        boxShadow: "0 0 0 1px #071422",
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #071422",
          background: "#010810",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        {/* macOS dots */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {["#2a2a2a", "#2a2a2a", "#2a2a2a"].map((c, i) => (
            <div
              key={i}
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: c,
              }}
            />
          ))}
        </div>

        {/* Search box */}
        <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: pc,
              fontSize: 15,
              pointerEvents: "none",
              transition: "color 0.3s",
            }}
          >
            ⌕
          </span>
          <input
            type="text"
            placeholder="search graph nodes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              background: "#040f1e",
              border: `1px solid ${query ? pc + "60" : "#071828"}`,
              borderRadius: 6,
              color: "#7dd3fc",
              fontSize: 12,
              padding: "7px 28px 7px 32px",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.25s",
              fontFamily: "inherit",
              letterSpacing: "0.3px",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#1a4060",
                cursor: "pointer",
                fontSize: 17,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Scan progress bar */}
        <div style={{ flex: 1, maxWidth: 140 }}>
          <div
            style={{
              height: 2,
              background: "#071422",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${scanPct}%`,
                background: pc,
                transition: "width 0.08s, background 0.3s",
                borderRadius: 1,
              }}
            />
          </div>
          <div style={{ fontSize: 8, color: "#0d2035", marginTop: 2 }}>
            {scanPct}% indexed
          </div>
        </div>

        {/* Phase badge */}
        <div
          style={{
            fontSize: 9,
            padding: "3px 12px",
            borderRadius: 3,
            border: `1px solid ${pc}35`,
            color: pc,
            background: `${pc}0e`,
            letterSpacing: "0.7px",
            transition: "all 0.3s",
            minWidth: 90,
            textAlign: "center",
          }}
        >
          {phase.toUpperCase()}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          {Object.entries(GC)
            .filter(([k]) => k !== "default")
            .map(([g, c]) => (
              <span
                key={g}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 8.5,
                  color: "#0d2035",
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: c,
                    opacity: 0.65,
                    display: "inline-block",
                  }}
                />
                {g}
              </span>
            ))}
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ display: "flex", height }}>
        {/* Graph canvas */}
        <div
          ref={wrapRef}
          style={{ flex: 1, position: "relative", overflow: "hidden" }}
        >
          <svg
            ref={svgRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />

          {/* Hint overlay (idle) */}
          {phase === "idle" && !query && (
            <div
              style={{
                position: "absolute",
                bottom: 14,
                left: 14,
                fontSize: 9,
                color: "#0d2035",
                lineHeight: 1.9,
                pointerEvents: "none",
              }}
            >
              scroll to zoom · drag to pan · drag node to pin
            </div>
          )}
        </div>

        {/* ── Log panel ── */}
        <div
          style={{
            width: 220,
            borderLeft: "1px solid #071422",
            display: "flex",
            flexDirection: "column",
            background: "#010810",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: "5px 12px",
              borderBottom: "1px solid #071422",
              fontSize: 8.5,
              color: "#0b2535",
              letterSpacing: "0.6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>CYPHER LOG</span>
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                style={{
                  background: "none",
                  border: "none",
                  color: "#0b1e30",
                  cursor: "pointer",
                  fontSize: 10,
                  padding: 0,
                }}
              >
                clr
              </button>
            )}
          </div>

          {/* Log lines */}
          <div
            ref={logRef}
            style={{
              flex: 1,
              overflow: "auto",
              padding: "8px 12px",
              fontSize: "10px",
              lineHeight: 2.05,
              scrollbarWidth: "thin",
              scrollbarColor: "#071422 transparent",
            }}
          >
            {logs.length === 0 && (
              <div style={{ color: "#091828", fontSize: 9, marginTop: 4 }}>
                {"// type to begin search..."}
              </div>
            )}
            {logs.map((l, i) => (
              <div
                key={i}
                style={{
                  color: l.startsWith("neo4j>")
                    ? "#38bdf8"
                    : l.startsWith(">")
                      ? "#4ade80"
                      : l.startsWith("  ↳")
                        ? "#fbbf24"
                        : l.startsWith("  depth")
                          ? "#a78bfa"
                          : l.startsWith("  [NULL]")
                            ? "#f87171"
                            : l.startsWith("  checking")
                              ? "#0e2c45"
                              : "#0e2c45",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {l}
              </div>
            ))}
            {phase !== "idle" &&
              phase !== "complete" &&
              phase !== "notfound" && (
                <span
                  style={{
                    color: "#4ade80",
                    display: "inline-block",
                    animation: "gsvcaret 1s step-start infinite",
                  }}
                >
                  ▌
                </span>
              )}
          </div>

          {/* Quick-search chips */}
          <div
            style={{
              padding: "8px 12px",
              borderTop: "1px solid #071422",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {["alice", "api", "db", "mobile", "cache"].map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                style={{
                  fontSize: 8.5,
                  padding: "3px 9px",
                  borderRadius: 3,
                  background:
                    query === q ? `${PHASE_COLOR.matching}15` : "#040f1e",
                  border: `1px solid ${query === q ? PHASE_COLOR.matching + "60" : "#0e1e30"}`,
                  color: query === q ? PHASE_COLOR.matching : "#1a4060",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gsvcaret { 0%,100%{opacity:1} 50%{opacity:0} }
        input::placeholder { color: #0d2535 !important; }
      `}</style>
    </div>
  );
}
