"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChangedFile {
  path: string;
  changeType: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
}

interface Commit {
  commitHash: string;
  authorName: string;
  authorEmail: string;
  commitDate: string;
  message: string;
  changedFiles: ChangedFile[];
}

interface TreeNode {
  id: string;
  name: string;
  fullPath: string;
  isFile: boolean;
  children: Map<string, TreeNode>;
  parent: TreeNode | null;
  // 3D objects
  mesh: THREE.Mesh | null;
  edge: THREE.Line | null;
  label: THREE.Sprite | null;
  // Fixed position (set once, never changes)
  position: THREE.Vector3;
  // Visual state for animations
  alive: boolean;
  opacity: number;
  currentScale: number;
  targetScale: number;
  lastChangeType: "added" | "modified" | "deleted" | null;
  animationTimer: number;
  depth: number;
  angle: number;
  // Color state
  baseColor: number;
  flashColor: number | null;
  flashTimer: number;
}

interface ContributorDot {
  name: string;
  color: THREE.Color;
  mesh: THREE.Mesh;
  label: THREE.Sprite;
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  opacity: number;
  fadeTimer: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = {
  background: 0x0a0a1a,
  root: 0x8b5cf6,
  directory: 0x3b82f6,
  fileIdle: 0x6b7280,
  added: 0x22c55e,
  modified: 0xf59e0b,
  deleted: 0xef4444,
  edge: 0x374151,
};

const CONTRIBUTOR_COLORS = [
  0xe879f9, 0x38bdf8, 0xfb923c, 0x4ade80, 0xf87171,
  0xa78bfa, 0x2dd4bf, 0xfbbf24, 0xf472b6, 0x60a5fa,
  0x34d399, 0xc084fc, 0x22d3ee, 0xfb7185, 0xa3e635,
];

const SPEED_OPTIONS = [0.5, 1, 2, 4];
const COMMIT_INTERVAL_BASE = 1200;
const STAR_COUNT = 500;
const RADIUS_STEP = 55;
const LABEL_SHOW_DISTANCE = 400;

const NODE_RADIUS = {
  root: 6,
  directory: 3.5,
  file: 1.5,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getContributorColor(name: string): number {
  return CONTRIBUTOR_COLORS[hashString(name) % CONTRIBUTOR_COLORS.length];
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}


// ─── Text label creation (Canvas → Sprite) ──────────────────────────────────

function createTextSprite(
  text: string,
  fontSize: number,
  color: string = "#ffffff",
  bold: boolean = false
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `${bold ? "bold " : ""}${fontSize}px "SF Mono", "Fira Code", "Consolas", monospace`;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;

  const padding = 8;
  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = Math.ceil(fontSize * 1.4 + padding * 2);

  // Re-set font after resize
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, padding, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  // Scale sprite to world units — roughly 1 world unit per 4 canvas pixels
  const scale = 0.25;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);

  return sprite;
}

// ─── File tree builder ───────────────────────────────────────────────────────

function createTreeNode(
  id: string,
  name: string,
  fullPath: string,
  isFile: boolean,
  parent: TreeNode | null,
  depth: number
): TreeNode {
  return {
    id,
    name,
    fullPath,
    isFile,
    children: new Map(),
    parent,
    mesh: null,
    edge: null,
    label: null,
    position: new THREE.Vector3(),
    alive: false,
    opacity: 0,
    currentScale: 0,
    targetScale: 1,
    lastChangeType: null,
    animationTimer: 0,
    depth,
    angle: 0,
    baseColor: isFile ? COLORS.fileIdle : (depth === 0 ? COLORS.root : COLORS.directory),
    flashColor: null,
    flashTimer: 0,
  };
}

function ensurePath(root: TreeNode, filePath: string): TreeNode {
  const parts = filePath.split("/");
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    const fullPath = parts.slice(0, i + 1).join("/");
    if (!current.children.has(part)) {
      const node = createTreeNode(fullPath, part, fullPath, isLast, current, current.depth + 1);
      current.children.set(part, node);
    }
    current = current.children.get(part)!;
  }
  return current;
}

function findNode(root: TreeNode, filePath: string): TreeNode | null {
  const parts = filePath.split("/");
  let current: TreeNode | undefined = root;
  for (const part of parts) {
    current = current.children.get(part);
    if (!current) return null;
  }
  return current;
}

// ─── Deterministic radial tree layout ────────────────────────────────────────
// Positions are computed ONCE and never change. No physics, no jitter.

function layoutRadialTree(root: TreeNode) {
  function countLeaves(node: TreeNode): number {
    if (node.children.size === 0) return 1;
    let total = 0;
    for (const child of node.children.values()) {
      total += countLeaves(child);
    }
    return total;
  }

  function layoutChildren(node: TreeNode, startAngle: number, endAngle: number) {
    const children = Array.from(node.children.values());
    if (children.length === 0) return;

    // Distribute angle proportional to subtree leaf count
    const totalLeaves = children.reduce((sum, c) => sum + countLeaves(c), 0);
    let currentAngle = startAngle;

    for (const child of children) {
      const leafCount = countLeaves(child);
      const angleSpan = ((endAngle - startAngle) * leafCount) / totalLeaves;
      const midAngle = currentAngle + angleSpan / 2;
      const radius = child.depth * RADIUS_STEP;

      child.angle = midAngle;
      child.position.set(
        Math.cos(midAngle) * radius,
        Math.sin(midAngle) * radius,
        0
      );

      layoutChildren(child, currentAngle, currentAngle + angleSpan);
      currentAngle += angleSpan;
    }
  }

  root.position.set(0, 0, 0);
  root.angle = 0;
  layoutChildren(root, 0, Math.PI * 2);
}


// ─── Three.js object creation ────────────────────────────────────────────────

function createNodeMesh(node: TreeNode, scene: THREE.Scene) {
  // Determine radius and color
  let radius: number;
  let color: number;

  if (node.depth === 0) {
    radius = NODE_RADIUS.root;
    color = COLORS.root;
  } else if (!node.isFile) {
    radius = NODE_RADIUS.directory;
    color = COLORS.directory;
  } else {
    radius = NODE_RADIUS.file;
    color = COLORS.fileIdle;
  }

  // Sphere
  const segments = node.isFile ? 12 : 16;
  const geometry = new THREE.SphereGeometry(radius, segments, segments);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(node.position);
  scene.add(mesh);
  node.mesh = mesh;

  // Glow halo for root
  if (node.depth === 0) {
    const haloGeo = new THREE.SphereGeometry(radius * 2.5, 16, 16);
    const haloMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    mesh.add(halo);
  }

  // Text label
  const isRoot = node.depth === 0;
  const fontSize = isRoot ? 48 : (!node.isFile ? 36 : 28);
  const labelColor = isRoot ? "#c4b5fd" : (!node.isFile ? "#93c5fd" : "#d1d5db");
  const label = createTextSprite(node.name, fontSize, labelColor, isRoot || !node.isFile);
  // Position label offset from node
  const labelOffset = radius + 2;
  label.position.copy(node.position);
  label.position.x += labelOffset;
  label.position.y += labelOffset * 0.5;
  label.material.opacity = 0;
  scene.add(label);
  node.label = label;

  // Edge line to parent
  if (node.parent) {
    const points = [node.parent.position.clone(), node.position.clone()];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: COLORS.edge,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    node.edge = line;
  }
}

// ─── Node animation update (called every frame) ─────────────────────────────

function updateNodeVisuals(node: TreeNode, dt: number, cameraZ: number) {
  if (!node.mesh) return;
  const mat = node.mesh.material as THREE.MeshBasicMaterial;

  // ── Flash timer (modified files pulse) ──
  if (node.flashTimer > 0) {
    node.flashTimer = Math.max(0, node.flashTimer - dt);
    if (node.flashColor !== null) {
      mat.color.setHex(node.flashColor);
    }
    if (node.flashTimer <= 0) {
      node.flashColor = null;
      mat.color.setHex(node.baseColor);
    }
  }

  // ── Animation timer (bloom in / fade out) ──
  if (node.animationTimer > 0) {
    node.animationTimer = Math.max(0, node.animationTimer - dt);

    if (node.lastChangeType === "added") {
      // Bloom: scale 0→1 over 500ms
      const progress = 1 - node.animationTimer / 0.5;
      const eased = 1 - Math.pow(1 - Math.min(progress, 1), 3); // ease-out cubic
      node.currentScale = eased;
      node.opacity = eased;
      mat.color.setHex(COLORS.added);
      // After bloom completes, fade to idle color
      if (node.animationTimer <= 0) {
        node.baseColor = COLORS.fileIdle;
        mat.color.setHex(COLORS.fileIdle);
        node.currentScale = 1;
        node.opacity = 1;
      }
    } else if (node.lastChangeType === "deleted") {
      // Fade out over 500ms
      const progress = node.animationTimer / 0.5;
      node.opacity = Math.max(0, progress);
      node.currentScale = Math.max(0.01, progress);
      mat.color.setHex(COLORS.deleted);
      if (node.animationTimer <= 0) {
        node.alive = false;
        node.opacity = 0;
        node.currentScale = 0;
      }
    }
  }

  // ── Apply visual state ──
  mat.opacity = node.opacity;
  node.mesh.scale.setScalar(Math.max(0.001, node.currentScale));

  // ── Label visibility (LOD based on camera distance) ──
  if (node.label) {
    const labelMat = node.label.material as THREE.SpriteMaterial;
    if (node.alive && node.opacity > 0.1) {
      // Show labels when camera is close enough
      const showLabel = cameraZ < LABEL_SHOW_DISTANCE || node.depth <= 1;
      const targetOpacity = showLabel ? node.opacity * 0.9 : 0;
      // Smooth fade
      labelMat.opacity += (targetOpacity - labelMat.opacity) * 0.1;
    } else {
      labelMat.opacity *= 0.9;
    }
  }

  // ── Edge opacity matches node ──
  if (node.edge) {
    const edgeMat = node.edge.material as THREE.LineBasicMaterial;
    edgeMat.opacity = node.opacity * 0.4;
  }
}

// ─── Make a node visible (bloom it in) ───────────────────────────────────────

function bloomNode(node: TreeNode) {
  if (node.alive) return; // Already visible
  node.alive = true;
  node.currentScale = 0;
  node.opacity = 0;
  node.lastChangeType = "added";
  node.animationTimer = 0.5;

  // Also ensure all ancestor directories are visible
  let parent = node.parent;
  while (parent && !parent.alive) {
    parent.alive = true;
    parent.currentScale = 0;
    parent.opacity = 0;
    parent.lastChangeType = "added";
    parent.animationTimer = 0.5;
    parent = parent.parent;
  }
}

// ─── Flash a node (modified) ─────────────────────────────────────────────────

function flashNode(node: TreeNode) {
  if (!node.alive) {
    bloomNode(node);
    return;
  }
  node.flashColor = COLORS.modified;
  node.flashTimer = 0.3;
}

// ─── Delete a node (fade out) ────────────────────────────────────────────────

function deleteNode(node: TreeNode) {
  if (!node.alive) return;
  node.lastChangeType = "deleted";
  node.animationTimer = 0.5;
}


// ─── Starfield ──────────────────────────────────────────────────────────────

function createStarfield(scene: THREE.Scene): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 3000;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 3000;
    positions[i * 3 + 2] = -200 - Math.random() * 300;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.2,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  return stars;
}

// ─── Contributor dots ───────────────────────────────────────────────────────

function createContributorDot(name: string, scene: THREE.Scene): ContributorDot {
  const color = new THREE.Color(getContributorColor(name));

  // Dot sphere
  const geo = new THREE.SphereGeometry(2.5, 12, 12);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);

  // Ring
  const ringGeo = new THREE.RingGeometry(3.5, 4.0, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  mesh.add(new THREE.Mesh(ringGeo, ringMat));
  scene.add(mesh);

  // Name label
  const label = createTextSprite(name, 32, `#${color.getHexString()}`, true);
  label.position.set(0, 6, 0);
  label.material.opacity = 0;
  mesh.add(label);

  return {
    name,
    color,
    mesh,
    label,
    position: new THREE.Vector3(0, 0, 15),
    targetPosition: new THREE.Vector3(0, 0, 15),
    opacity: 0,
    fadeTimer: 0,
  };
}

function updateContributorDot(dot: ContributorDot, dt: number) {
  // Smooth move toward target
  dot.position.lerp(dot.targetPosition, 0.08);
  dot.mesh.position.copy(dot.position);

  // Fade logic
  if (dot.fadeTimer > 0) {
    dot.fadeTimer = Math.max(0, dot.fadeTimer - dt);
    dot.opacity = Math.min(1, dot.opacity + dt * 3);
  } else {
    dot.opacity = Math.max(0, dot.opacity - dt * 0.5);
  }

  const mat = dot.mesh.material as THREE.MeshBasicMaterial;
  mat.opacity = dot.opacity;

  // Ring
  if (dot.mesh.children[0]) {
    const ringMat = (dot.mesh.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    ringMat.opacity = dot.opacity * 0.5;
  }

  // Label
  dot.label.material.opacity = dot.opacity * 0.8;
}


// ─── Main Component ─────────────────────────────────────────────────────────

export default function TimeBloom({ repoId, from, to }: { repoId: string; from?: string; to?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentCommit, setCurrentCommit] = useState<Commit | null>(null);

  // Refs for animation loop
  const playbackRef = useRef({
    isPlaying: false,
    speed: 1,
    currentIndex: 0,
    lastCommitTime: 0,
    commits: [] as Commit[],
  });

  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    root: TreeNode;
    nodeMap: Map<string, TreeNode>;
    contributors: Map<string, ContributorDot>;
    animFrameId: number;
    stars: THREE.Points;
    isDragging: boolean;
    lastMouse: { x: number; y: number };
    cameraTarget: THREE.Vector3;
    autoFollow: boolean;
  } | null>(null);

  // ─── Fetch commits ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/v1/commits?repoId=${encodeURIComponent(repoId)}&limit=500`, {
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch commits");
        return r.json();
      })
      .then((data) => {
        const sorted = (data.items || []).sort(
          (a: Commit, b: Commit) =>
            new Date(a.commitDate).getTime() - new Date(b.commitDate).getTime()
        );
        setCommits(sorted);
        playbackRef.current.commits = sorted;
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [repoId]);

  // ─── Three.js scene setup ─────────────────────────────────────────────────

  useEffect(() => {
    if (loading || error || commits.length === 0 || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 600;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
    camera.position.set(0, 0, 500);
    camera.lookAt(0, 0, 0);

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── Starfield ──
    const stars = createStarfield(scene);

    // ── Build the FULL file tree from all commits (for layout) ──
    // We pre-compute the tree structure so positions are deterministic.
    // Nodes start invisible and bloom in during playback.
    const root = createTreeNode("root", "root", "", false, null, 0);
    root.alive = true;
    root.opacity = 1;
    root.currentScale = 1;

    for (const commit of commits) {
      for (const file of commit.changedFiles) {
        ensurePath(root, file.path);
      }
    }

    // ── Compute fixed layout ──
    layoutRadialTree(root);

    // ── Collect all nodes into a flat map for fast lookup ──
    const nodeMap = new Map<string, TreeNode>();
    function collectNodes(node: TreeNode) {
      nodeMap.set(node.fullPath || "root", node);
      for (const child of node.children.values()) {
        collectNodes(child);
      }
    }
    collectNodes(root);

    // ── Create all Three.js objects (sorted by depth so parents first) ──
    const allNodes = Array.from(nodeMap.values()).sort((a, b) => a.depth - b.depth);
    for (const node of allNodes) {
      createNodeMesh(node, scene);
    }

    // ── Root starts visible, everything else hidden ──
    if (root.mesh) {
      (root.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
      root.mesh.scale.setScalar(1);
    }
    if (root.label) {
      root.label.material.opacity = 0.9;
    }

    // ── Contributors ──
    const contributors = new Map<string, ContributorDot>();

    // ── Camera state ──
    const cameraTarget = new THREE.Vector3(0, 0, 0);
    let isDragging = false;
    let lastMouse = { x: 0, y: 0 };

    const state = {
      scene,
      camera,
      renderer,
      root,
      nodeMap,
      contributors,
      animFrameId: 0,
      stars,
      isDragging,
      lastMouse,
      cameraTarget,
      autoFollow: true,
    };
    sceneRef.current = state;

    // ─── Mouse controls ───────────────────────────────────────────────────

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.max(60, Math.min(1500, camera.position.z + e.deltaY * 0.8));
    };

    const onMouseDown = (e: MouseEvent) => {
      state.isDragging = true;
      state.lastMouse = { x: e.clientX, y: e.clientY };
      state.autoFollow = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!state.isDragging) return;
      const dx = e.clientX - state.lastMouse.x;
      const dy = e.clientY - state.lastMouse.y;
      const panScale = camera.position.z * 0.002;
      state.cameraTarget.x -= dx * panScale;
      state.cameraTarget.y += dy * panScale;
      state.lastMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      state.isDragging = false;
    };

    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // ─── Resize ───────────────────────────────────────────────────────────

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // ─── Animation loop ─────────────────────────────────────────────────────

    let lastTime = performance.now();

    const animate = () => {
      state.animFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05); // cap delta
      lastTime = now;

      const pb = playbackRef.current;

      // ── Playback: advance commits ──
      if (pb.isPlaying && pb.commits.length > 0) {
        const interval = COMMIT_INTERVAL_BASE / pb.speed;

        if (now - pb.lastCommitTime > interval && pb.currentIndex < pb.commits.length) {
          const commit = pb.commits[pb.currentIndex];

          // Process changed files
          for (const file of commit.changedFiles) {
            const node = findNode(root, file.path);
            if (!node) continue;

            if (file.changeType === "added") {
              bloomNode(node);
            } else if (file.changeType === "modified") {
              flashNode(node);
            } else if (file.changeType === "deleted") {
              deleteNode(node);
            }
          }

          // Contributor dot
          if (commit.authorName) {
            let dot = contributors.get(commit.authorName);
            if (!dot) {
              dot = createContributorDot(commit.authorName, scene);
              contributors.set(commit.authorName, dot);
            }
            dot.fadeTimer = 2.5;

            // Move toward centroid of affected files
            if (commit.changedFiles.length > 0) {
              const avg = new THREE.Vector3();
              let count = 0;
              for (const file of commit.changedFiles) {
                const node = findNode(root, file.path);
                if (node) {
                  avg.add(node.position);
                  count++;
                }
              }
              if (count > 0) {
                avg.divideScalar(count);
                avg.z = 15;
                dot.targetPosition.copy(avg);
              }
            }
          }

          // Auto-follow camera
          if (state.autoFollow && commit.changedFiles.length > 0) {
            const avg = new THREE.Vector3();
            let count = 0;
            for (const file of commit.changedFiles) {
              const node = findNode(root, file.path);
              if (node) {
                avg.add(node.position);
                count++;
              }
            }
            if (count > 0) {
              avg.divideScalar(count);
              state.cameraTarget.lerp(avg, 0.08);
            }
          }

          pb.currentIndex++;
          pb.lastCommitTime = now;
          setCurrentIndex(pb.currentIndex);
          setCurrentCommit(commit);

          if (pb.currentIndex >= pb.commits.length) {
            pb.isPlaying = false;
            setIsPlaying(false);
          }
        }
      }

      // ── Update all node visuals ──
      const cameraZ = camera.position.z;
      for (const node of allNodes) {
        updateNodeVisuals(node, dt, cameraZ);
      }

      // ── Update contributors ──
      for (const dot of contributors.values()) {
        updateContributorDot(dot, dt);
      }

      // ── Camera smooth follow ──
      camera.position.x += (state.cameraTarget.x - camera.position.x) * 0.04;
      camera.position.y += (state.cameraTarget.y - camera.position.y) * 0.04;
      camera.lookAt(state.cameraTarget.x, state.cameraTarget.y, 0);

      // ── Subtle star drift ──
      stars.rotation.z += 0.00003;

      renderer.render(scene, camera);
    };

    animate();

    // ─── Cleanup ──────────────────────────────────────────────────────────

    return () => {
      cancelAnimationFrame(state.animFrameId);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", onResize);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
        if (obj instanceof THREE.Line) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
        if (obj instanceof THREE.Points) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
        if (obj instanceof THREE.Sprite) {
          (obj.material as THREE.SpriteMaterial).map?.dispose();
          obj.material.dispose();
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commits, loading, error]);


  // ─── Sync playback ref ──────────────────────────────────────────────────

  useEffect(() => {
    playbackRef.current.isPlaying = isPlaying;
    if (isPlaying) {
      playbackRef.current.lastCommitTime = performance.now();
    }
  }, [isPlaying]);

  useEffect(() => {
    playbackRef.current.speed = speed;
  }, [speed]);

  // ─── Playback controls ─────────────────────────────────────────────────

  const handlePlayPause = useCallback(() => {
    if (playbackRef.current.currentIndex >= commits.length) {
      // Reset
      playbackRef.current.currentIndex = 0;
      setCurrentIndex(0);
      setCurrentCommit(null);

      // Reset all nodes to hidden (except root)
      if (sceneRef.current) {
        for (const node of sceneRef.current.nodeMap.values()) {
          if (node.depth === 0) continue;
          node.alive = false;
          node.opacity = 0;
          node.currentScale = 0;
          node.animationTimer = 0;
          node.lastChangeType = null;
          node.flashColor = null;
          node.flashTimer = 0;
          node.baseColor = node.isFile ? COLORS.fileIdle : COLORS.directory;
          if (node.mesh) {
            (node.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
            node.mesh.scale.setScalar(0.001);
          }
          if (node.label) {
            node.label.material.opacity = 0;
          }
          if (node.edge) {
            (node.edge.material as THREE.LineBasicMaterial).opacity = 0;
          }
        }
        // Reset camera
        sceneRef.current.cameraTarget.set(0, 0, 0);
        sceneRef.current.autoFollow = true;
      }
    }
    setIsPlaying((p) => !p);
  }, [commits.length]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
  }, []);

  const handleAutoFollow = useCallback(() => {
    if (sceneRef.current) {
      sceneRef.current.autoFollow = !sceneRef.current.autoFollow;
    }
  }, []);

  const progressPercent =
    commits.length > 0 ? (currentIndex / commits.length) * 100 : 0;

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading commit history…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-gray-500">No commits found for this repository.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ height: "calc(100vh - 200px)", minHeight: 500 }}>
      {/* Three.js canvas */}
      <div ref={containerRef} className="h-full w-full" />

      {/* ── Controls overlay ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4">
        <div className="pointer-events-auto mx-auto max-w-2xl rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
          {/* Progress bar */}
          <div className="mb-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>{currentIndex} / {commits.length} commits</span>
              {currentCommit && (
                <span>{new Date(currentCommit.commitDate).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-500"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="2" width="4" height="12" rx="1" />
                  <rect x="9" y="2" width="4" height="12" rx="1" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2l10 6-10 6V2z" />
                </svg>
              )}
            </button>

            <div className="flex items-center gap-1">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    speed === s
                      ? "bg-violet-600 text-white"
                      : "bg-white/10 text-gray-300 hover:bg-white/20"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <button
              onClick={handleAutoFollow}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                sceneRef.current?.autoFollow
                  ? "bg-blue-600 text-white"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              Auto-follow
            </button>
          </div>

          {/* Current commit info */}
          {currentCommit && (
            <div className="mt-3 border-t border-white/10 pt-2">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: `#${getContributorColor(currentCommit.authorName).toString(16).padStart(6, "0")}`,
                  }}
                />
                <span className="font-medium text-gray-200">
                  {currentCommit.authorName}
                </span>
                <span className="font-mono text-gray-500">
                  {currentCommit.commitHash.slice(0, 7)}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-gray-400">
                {truncate(currentCommit.message, 80)}
              </p>
              <div className="mt-1 flex gap-2 text-xs text-gray-500">
                {(() => {
                  const added = currentCommit.changedFiles.filter(
                    (f) => f.changeType === "added"
                  ).length;
                  const modified = currentCommit.changedFiles.filter(
                    (f) => f.changeType === "modified"
                  ).length;
                  const deleted = currentCommit.changedFiles.filter(
                    (f) => f.changeType === "deleted"
                  ).length;
                  return (
                    <>
                      {added > 0 && <span className="text-green-400">+{added}</span>}
                      {modified > 0 && <span className="text-amber-400">~{modified}</span>}
                      {deleted > 0 && <span className="text-red-400">-{deleted}</span>}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Legend (top-right) ── */}
      <div className="absolute right-4 top-4 z-10 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs backdrop-blur-sm">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
            <span className="text-gray-300">Root</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-gray-300">Directory</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-gray-300">Added</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-gray-300">Modified</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-gray-300">Deleted</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-500" />
            <span className="text-gray-300">File (idle)</span>
          </div>
        </div>
      </div>

      {/* ── Title (top-left) ── */}
      <div className="absolute left-4 top-4 z-10">
        <h3 className="text-sm font-semibold text-white/80">TimeBloom</h3>
        <p className="text-xs text-gray-500">Scroll to zoom · Drag to pan · Click Play to begin</p>
      </div>
    </div>
  );
}
