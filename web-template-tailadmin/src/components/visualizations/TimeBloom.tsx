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
  // 3D state
  mesh: THREE.Mesh | null;
  line: THREE.Line | null;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  // visual state
  alive: boolean;
  opacity: number;
  scale: number;
  glowIntensity: number;
  lastChangeType: "added" | "modified" | "deleted" | null;
  animationTimer: number;
  depth: number;
  angle: number;
  targetRadius: number;
}

interface ContributorDot {
  name: string;
  color: THREE.Color;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  opacity: number;
  fadeTimer: number;
  label: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = {
  background: 0x0a0a1a,
  root: 0x8b5cf6,
  directory: 0x3b82f6,
  added: 0x22c55e,
  modified: 0xf59e0b,
  deleted: 0xef4444,
  edge: 0x333333,
};

const CONTRIBUTOR_COLORS = [
  0xe879f9, 0x38bdf8, 0xfb923c, 0x4ade80, 0xf87171,
  0xa78bfa, 0x2dd4bf, 0xfbbf24, 0xf472b6, 0x60a5fa,
  0x34d399, 0xc084fc, 0x22d3ee, 0xfb7185, 0xa3e635,
];

const SPEED_OPTIONS = [0.5, 1, 2, 4];
const COMMIT_INTERVAL_BASE = 1200; // ms at 1x speed
const STAR_COUNT = 600;

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
    line: null,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    alive: true,
    opacity: 1,
    scale: 1,
    glowIntensity: 0,
    lastChangeType: null,
    animationTimer: 0,
    depth,
    angle: 0,
    targetRadius: 0,
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
      const node = createTreeNode(
        fullPath,
        part,
        fullPath,
        isLast,
        current,
        current.depth + 1
      );
      current.children.set(part, node);
    }
    current = current.children.get(part)!;
  }
  return current;
}

function collectAllNodes(root: TreeNode): TreeNode[] {
  const result: TreeNode[] = [root];
  function walk(node: TreeNode) {
    for (const child of node.children.values()) {
      result.push(child);
      walk(child);
    }
  }
  walk(root);
  return result;
}

// ─── Radial layout ──────────────────────────────────────────────────────────

function layoutRadialTree(root: TreeNode) {
  const RADIUS_STEP = 60;

  function layoutChildren(node: TreeNode, startAngle: number, endAngle: number) {
    const children = Array.from(node.children.values());
    if (children.length === 0) return;

    const angleSpan = endAngle - startAngle;
    const angleStep = angleSpan / children.length;

    children.forEach((child, i) => {
      const angle = startAngle + angleStep * (i + 0.5);
      const radius = child.depth * RADIUS_STEP;
      child.angle = angle;
      child.targetRadius = radius;
      child.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        (Math.random() - 0.5) * 15
      );
      layoutChildren(child, startAngle + angleStep * i, startAngle + angleStep * (i + 1));
    });
  }

  root.position.set(0, 0, 0);
  layoutChildren(root, 0, Math.PI * 2);
}

// ─── Force simulation (lightweight) ─────────────────────────────────────────

function applyForces(nodes: TreeNode[], _dt: number) {
  const REPULSION = 200;
  const SPRING = 0.02;
  const DAMPING = 0.85;
  const RADIUS_STEP = 60;

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    if (a.depth === 0) continue;

    // Spring toward radial target
    const targetR = a.depth * RADIUS_STEP;
    const targetX = Math.cos(a.angle) * targetR;
    const targetY = Math.sin(a.angle) * targetR;
    a.velocity.x += (targetX - a.position.x) * SPRING;
    a.velocity.y += (targetY - a.position.y) * SPRING;

    // Repulsion from siblings
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (a.depth !== b.depth) continue;
      const dx = a.position.x - b.position.x;
      const dy = a.position.y - b.position.y;
      const distSq = dx * dx + dy * dy + 1;
      if (distSq < REPULSION * REPULSION) {
        const force = REPULSION / distSq;
        a.velocity.x += dx * force;
        a.velocity.y += dy * force;
        b.velocity.x -= dx * force;
        b.velocity.y -= dy * force;
      }
    }

    // Damping
    a.velocity.multiplyScalar(DAMPING);
    a.position.add(a.velocity);
  }
}

// ─── Three.js scene builder ─────────────────────────────────────────────────

function createGlowMaterial(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

function createNodeMesh(node: TreeNode, scene: THREE.Scene) {
  let radius: number;
  let color: number;

  if (node.depth === 0) {
    radius = 5;
    color = COLORS.root;
  } else if (!node.isFile) {
    radius = Math.max(2, 4 - node.depth * 0.5);
    color = COLORS.directory;
  } else {
    radius = 1.8;
    color = 0x6b7280; // neutral gray until animated
  }

  const geometry = new THREE.SphereGeometry(radius, 16, 16);
  const material = createGlowMaterial(color);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(node.position);
  scene.add(mesh);
  node.mesh = mesh;

  // Glow halo for root and directories
  if (node.depth === 0 || !node.isFile) {
    const haloGeo = new THREE.SphereGeometry(radius * 2.2, 16, 16);
    const haloMat = createGlowMaterial(color, 0.08);
    const halo = new THREE.Mesh(haloGeo, haloMat);
    mesh.add(halo);
  }

  // Edge to parent
  if (node.parent && node.parent.mesh) {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      node.parent.position.clone(),
      node.position.clone(),
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: COLORS.edge,
      transparent: true,
      opacity: 0.3,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    node.line = line;
  }
}

function updateNodeVisuals(node: TreeNode, time: number) {
  if (!node.mesh) return;
  const mat = node.mesh.material as THREE.MeshBasicMaterial;

  // Position
  node.mesh.position.copy(node.position);

  // Breathing effect
  const breathe = 1 + Math.sin(time * 1.5 + node.angle * 3) * 0.03;

  // Animation timer
  if (node.animationTimer > 0) {
    node.animationTimer = Math.max(0, node.animationTimer - 0.016);
    const t = node.animationTimer;

    if (node.lastChangeType === "added") {
      // Bloom: scale up from 0 with glow
      const progress = 1 - Math.min(t / 0.8, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.scale = eased * 1.3;
      node.glowIntensity = (1 - progress) * 2;
      mat.color.setHex(COLORS.added);
      mat.opacity = eased;
    } else if (node.lastChangeType === "modified") {
      // Pulse
      const pulse = Math.sin(t * 12) * 0.4 + 1;
      node.scale = pulse;
      node.glowIntensity = Math.abs(Math.sin(t * 8));
      mat.color.setHex(COLORS.modified);
      mat.opacity = 1;
    } else if (node.lastChangeType === "deleted") {
      // Shrink and fade
      const progress = Math.min(t / 0.8, 1);
      node.scale = progress * 0.8;
      mat.color.setHex(COLORS.deleted);
      mat.opacity = progress * 0.6;
    }
  } else {
    // Idle state
    node.scale = 1;
    node.glowIntensity = Math.max(0, node.glowIntensity - 0.02);
    if (node.isFile && node.lastChangeType !== "deleted") {
      mat.opacity = Math.min(1, mat.opacity + 0.01);
    }
  }

  const finalScale = node.scale * breathe;
  node.mesh.scale.setScalar(finalScale);

  // Emissive-like glow via brightness
  if (node.glowIntensity > 0) {
    const base = mat.color.clone();
    base.lerp(new THREE.Color(0xffffff), node.glowIntensity * 0.3);
    mat.color.copy(base);
  }

  // Update edge line
  if (node.line && node.parent) {
    const positions = node.line.geometry.attributes.position;
    if (positions && node.parent.position) {
      const arr = positions.array as Float32Array;
      arr[0] = node.parent.position.x;
      arr[1] = node.parent.position.y;
      arr[2] = node.parent.position.z;
      arr[3] = node.position.x;
      arr[4] = node.position.y;
      arr[5] = node.position.z;
      positions.needsUpdate = true;
    }
  }
}

// ─── Starfield ──────────────────────────────────────────────────────────────

function createStarfield(scene: THREE.Scene): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2000;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 600 - 200;
    sizes[i] = Math.random() * 1.5 + 0.3;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  return stars;
}

// ─── Contributor dots ───────────────────────────────────────────────────────

function createContributorDot(
  name: string,
  scene: THREE.Scene
): ContributorDot {
  const color = new THREE.Color(getContributorColor(name));
  const geo = new THREE.SphereGeometry(2.5, 12, 12);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);

  // Ring around contributor
  const ringGeo = new THREE.RingGeometry(3.2, 3.8, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  mesh.add(ring);

  scene.add(mesh);

  return {
    name,
    color,
    mesh,
    position: new THREE.Vector3(
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 100,
      10
    ),
    targetPosition: new THREE.Vector3(),
    opacity: 0,
    fadeTimer: 0,
    label: name,
  };
}

function updateContributorDot(dot: ContributorDot) {
  // Move toward target
  dot.position.lerp(dot.targetPosition, 0.06);
  dot.mesh.position.copy(dot.position);

  // Fade
  if (dot.fadeTimer > 0) {
    dot.fadeTimer = Math.max(0, dot.fadeTimer - 0.016);
    dot.opacity = Math.min(1, dot.opacity + 0.05);
  } else {
    dot.opacity = Math.max(0, dot.opacity - 0.01);
  }

  const mat = dot.mesh.material as THREE.MeshBasicMaterial;
  mat.opacity = dot.opacity;

  // Ring
  if (dot.mesh.children[0]) {
    const ringMat = (dot.mesh.children[0] as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    ringMat.opacity = dot.opacity * 0.5;
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TimeBloom({ repoId }: { repoId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentCommit, setCurrentCommit] = useState<Commit | null>(null);

  // Refs for animation loop access
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
    allNodes: TreeNode[];
    contributors: Map<string, ContributorDot>;
    animFrameId: number;
    stars: THREE.Points;
    clock: THREE.Clock;
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

    fetch(
      `/api/v1/commits?repoId=${encodeURIComponent(repoId)}&limit=500`,
      { credentials: "include" }
    )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch commits");
        return r.json();
      })
      .then((data) => {
        // Sort chronologically (oldest first)
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

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);
    scene.fog = new THREE.FogExp2(COLORS.background, 0.0015);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
    camera.position.set(0, 0, 350);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const point1 = new THREE.PointLight(0x8b5cf6, 1, 800);
    point1.position.set(100, 100, 200);
    scene.add(point1);
    const point2 = new THREE.PointLight(0x3b82f6, 0.6, 600);
    point2.position.set(-100, -80, 150);
    scene.add(point2);

    // Starfield
    const stars = createStarfield(scene);

    // Build file tree from ALL commits
    const root = createTreeNode("root", "root", "", false, null, 0);
    for (const commit of commits) {
      for (const file of commit.changedFiles) {
        ensurePath(root, file.path);
      }
    }

    // Layout
    layoutRadialTree(root);

    // Create meshes
    const allNodes = collectAllNodes(root);

    // Sort by depth so parents are created before children
    allNodes.sort((a, b) => a.depth - b.depth);
    for (const node of allNodes) {
      createNodeMesh(node, scene);
    }

    // Initially hide file nodes (they'll bloom in during playback)
    for (const node of allNodes) {
      if (node.isFile && node.mesh) {
        node.mesh.scale.setScalar(0);
        (node.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
        node.alive = false;
      }
    }

    // Contributors
    const contributors = new Map<string, ContributorDot>();

    // Camera state
    const cameraTarget = new THREE.Vector3(0, 0, 0);
    let isDragging = false;
    let lastMouse = { x: 0, y: 0 };
    let autoFollow = true;

    const clock = new THREE.Clock();

    const state = {
      scene,
      camera,
      renderer,
      root,
      allNodes,
      contributors,
      animFrameId: 0,
      stars,
      clock,
      isDragging,
      lastMouse,
      cameraTarget,
      autoFollow,
    };
    sceneRef.current = state;

    // ─── Mouse controls ───────────────────────────────────────────────────

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.max(50, Math.min(800, camera.position.z + e.deltaY * 0.5));
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
      state.cameraTarget.x -= dx * 0.5;
      state.cameraTarget.y += dy * 0.5;
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

    const animate = () => {
      state.animFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const pb = playbackRef.current;

      // ── Playback: advance commits ──
      if (pb.isPlaying && pb.commits.length > 0) {
        const interval = COMMIT_INTERVAL_BASE / pb.speed;
        const now = performance.now();

        if (now - pb.lastCommitTime > interval && pb.currentIndex < pb.commits.length) {
          const commit = pb.commits[pb.currentIndex];

          // Animate changed files
          for (const file of commit.changedFiles) {
            const node = findNode(root, file.path);
            if (node) {
              node.alive = true;
              node.lastChangeType = file.changeType;
              node.animationTimer = file.changeType === "deleted" ? 1.2 : 0.8;
            }
          }

          // Contributor dot
          if (commit.authorName) {
            let dot = contributors.get(commit.authorName);
            if (!dot) {
              dot = createContributorDot(commit.authorName, scene);
              contributors.set(commit.authorName, dot);
            }
            dot.fadeTimer = 2;

            // Move toward average position of changed files
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
                avg.z = 15; // float above the tree
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
              state.cameraTarget.lerp(avg, 0.1);
            }
          }

          pb.currentIndex++;
          pb.lastCommitTime = now;

          // Update React state (throttled)
          setCurrentIndex(pb.currentIndex);
          setCurrentCommit(commit);

          // Auto-pause at end
          if (pb.currentIndex >= pb.commits.length) {
            pb.isPlaying = false;
            setIsPlaying(false);
          }
        }
      }

      // ── Force simulation ──
      applyForces(allNodes, 0.016);

      // ── Update visuals ──
      for (const node of allNodes) {
        updateNodeVisuals(node, time);
      }

      // ── Update contributors ──
      for (const dot of contributors.values()) {
        updateContributorDot(dot);
      }

      // ── Camera smooth follow ──
      camera.position.x += (state.cameraTarget.x - camera.position.x) * 0.03;
      camera.position.y += (state.cameraTarget.y - camera.position.y) * 0.03;
      camera.lookAt(state.cameraTarget.x, state.cameraTarget.y, 0);

      // ── Subtle star rotation ──
      stars.rotation.z += 0.00005;

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

      // Dispose Three.js resources
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
      // Reset to beginning
      playbackRef.current.currentIndex = 0;
      setCurrentIndex(0);
      setCurrentCommit(null);

      // Reset file node visuals
      if (sceneRef.current) {
        for (const node of sceneRef.current.allNodes) {
          if (node.isFile && node.mesh) {
            node.mesh.scale.setScalar(0);
            (node.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
            node.alive = false;
            node.animationTimer = 0;
            node.lastChangeType = null;
          }
        }
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
      {/* Three.js canvas container */}
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
            {/* Play/Pause */}
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

            {/* Speed selector */}
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

            {/* Spacer */}
            <div className="flex-1" />

            {/* Auto-follow toggle */}
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
                      {added > 0 && (
                        <span className="text-green-400">+{added}</span>
                      )}
                      {modified > 0 && (
                        <span className="text-amber-400">~{modified}</span>
                      )}
                      {deleted > 0 && (
                        <span className="text-red-400">-{deleted}</span>
                      )}
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

// ─── Utility: find node by path ─────────────────────────────────────────────

function findNode(root: TreeNode, filePath: string): TreeNode | null {
  const parts = filePath.split("/");
  let current: TreeNode | undefined = root;
  for (const part of parts) {
    current = current.children.get(part);
    if (!current) return null;
  }
  return current;
}
