/**
 * TimeBloom — Three.js WebGL radial tree animation.
 * Root at center, directories as branches, files as leaf nodes.
 * Force-directed elastic layout with bloom/pulse/shrink animations.
 * Playback controls and camera controls.
 * Fetches from /api/v1/commits.
 */
(function () {
  'use strict';

  var THREE = window.THREE;

  function TimeBloom(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this._scene = null;
    this._camera = null;
    this._renderer = null;
    this._animId = null;
    this._nodes = {};
    this._edges = [];
    this._commits = [];
    this._currentIdx = 0;
    this._playing = false;
    this._speed = 1;
    this._lastTick = 0;
    this._raycaster = null;
    this._mouse = null;
    this._controls = null;
  }

  TimeBloom.prototype = Object.create(window.VisualizationBase.prototype);
  TimeBloom.prototype.constructor = TimeBloom;

  TimeBloom.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._fetchData();
  };

  TimeBloom.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._fetchData();
  };

  TimeBloom.prototype.scrubTo = function (idx) {
    if (idx == null || !this._commits.length) return;
    this._currentIdx = Math.min(idx, this._commits.length - 1);
    this._applyCommit(this._commits[this._currentIdx]);
  };

  TimeBloom.prototype.resize = function () {
    if (!this._renderer || !this._camera) return;
    var dims = this._dims();
    this._camera.aspect = dims.width / dims.height;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(dims.width, dims.height);
  };

  TimeBloom.prototype.destroy = function () {
    this._playing = false;
    if (this._animId) cancelAnimationFrame(this._animId);
    if (this._renderer) {
      this._renderer.dispose();
      this._renderer.domElement.remove();
    }
    this._scene = null;
    this._camera = null;
    this._renderer = null;
    window.VisualizationBase.prototype.destroy.call(this);
  };

  TimeBloom.prototype.exportSVG = function () { return null; }; // WebGL — no SVG

  TimeBloom.prototype._fetchData = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/commits', { limit: 1000 })).then(function (data) {
      self._commits = data.commits || data.items || [];
      self._initScene();
      self._buildControls();
      self._animate();
    }).catch(function (err) {
      console.error('TimeBloom fetch error:', err);
    });
  };

  TimeBloom.prototype._initScene = function () {
    var dims = this._dims();

    // Cleanup previous
    if (this._renderer) {
      this._renderer.dispose();
      this._renderer.domElement.remove();
    }
    if (this._animId) cancelAnimationFrame(this._animId);
    this.container.innerHTML = '';

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x0d1117);

    this._camera = new THREE.PerspectiveCamera(60, dims.width / dims.height, 0.1, 2000);
    this._camera.position.set(0, 0, 300);

    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.setSize(dims.width, dims.height);
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this._renderer.domElement);

    // Ambient + directional light
    this._scene.add(new THREE.AmbientLight(0x404040, 2));
    var dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(100, 100, 100);
    this._scene.add(dirLight);

    // Root node
    var rootGeo = new THREE.SphereGeometry(5, 16, 16);
    var rootMat = new THREE.MeshPhongMaterial({ color: 0x6366f1 });
    var rootMesh = new THREE.Mesh(rootGeo, rootMat);
    this._scene.add(rootMesh);
    this._nodes = { root: { mesh: rootMesh, pos: new THREE.Vector3(0, 0, 0), children: {} } };
    this._edges = [];

    // Raycaster for hover
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    // Simple orbit-like controls via mouse
    this._setupMouseControls();

    // Reset state
    this._currentIdx = 0;
    this._playing = false;
  };

  TimeBloom.prototype._setupMouseControls = function () {
    var self = this;
    var isDragging = false;
    var prevX = 0, prevY = 0;
    var canvas = this._renderer.domElement;

    canvas.addEventListener('mousedown', function (e) {
      isDragging = true; prevX = e.clientX; prevY = e.clientY;
    });
    canvas.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      var dx = e.clientX - prevX;
      var dy = e.clientY - prevY;
      self._camera.position.x -= dx * 0.5;
      self._camera.position.y += dy * 0.5;
      self._camera.lookAt(0, 0, 0);
      prevX = e.clientX; prevY = e.clientY;
    });
    canvas.addEventListener('mouseup', function () { isDragging = false; });
    canvas.addEventListener('wheel', function (e) {
      self._camera.position.z += e.deltaY * 0.3;
      self._camera.position.z = Math.max(50, Math.min(800, self._camera.position.z));
    });
  };

  TimeBloom.prototype._buildControls = function () {
    var self = this;
    // Remove existing controls
    var existing = this.container.querySelector('.tb-controls');
    if (existing) existing.remove();

    var bar = document.createElement('div');
    bar.className = 'tb-controls';
    bar.style.cssText = 'position:absolute;bottom:10px;left:50%;transform:translateX(-50%);' +
      'display:flex;gap:8px;align-items:center;background:rgba(0,0,0,0.7);padding:6px 14px;border-radius:8px;z-index:10;';

    var playBtn = document.createElement('button');
    playBtn.textContent = '▶ Play';
    playBtn.style.cssText = 'color:#fff;background:none;border:1px solid #555;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;';
    playBtn.addEventListener('click', function () {
      self._playing = !self._playing;
      playBtn.textContent = self._playing ? '⏸ Pause' : '▶ Play';
    });
    bar.appendChild(playBtn);

    [0.5, 1, 2, 4].forEach(function (s) {
      var btn = document.createElement('button');
      btn.textContent = s + 'x';
      btn.style.cssText = 'color:#fff;background:none;border:1px solid #555;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;';
      btn.addEventListener('click', function () { self._speed = s; });
      bar.appendChild(btn);
    });

    // Progress indicator
    var prog = document.createElement('span');
    prog.className = 'tb-progress';
    prog.style.cssText = 'color:#aaa;font-size:11px;min-width:60px;text-align:center;';
    prog.textContent = '0 / ' + this._commits.length;
    bar.appendChild(prog);

    this.container.style.position = 'relative';
    this.container.appendChild(bar);
  };

  TimeBloom.prototype._applyCommit = function (commit) {
    if (!commit) return;
    var files = commit.changedFiles || [];
    var self = this;

    files.forEach(function (f) {
      var parts = f.path.split('/');
      var parentNode = self._nodes.root;
      var fullPath = '';

      // Build directory tree
      parts.forEach(function (part, depth) {
        fullPath += (fullPath ? '/' : '') + part;
        var isLeaf = depth === parts.length - 1;

        if (!parentNode.children[part]) {
          // Create new node
          var angle = Math.random() * Math.PI * 2;
          var dist = 20 + depth * 15 + Math.random() * 10;
          var pos = new THREE.Vector3(
            parentNode.pos.x + Math.cos(angle) * dist,
            parentNode.pos.y + Math.sin(angle) * dist,
            parentNode.pos.z + (Math.random() - 0.5) * 10
          );

          var geo = isLeaf
            ? new THREE.SphereGeometry(2, 8, 8)
            : new THREE.SphereGeometry(3, 10, 10);

          var color = isLeaf
            ? (f.changeType === 'added' ? 0x22c55e : f.changeType === 'deleted' ? 0xef4444 : 0x3b82f6)
            : 0x8b5cf6;

          var mat = new THREE.MeshPhongMaterial({ color: color, transparent: true, opacity: 0 });
          var mesh = new THREE.Mesh(geo, mat);
          mesh.position.copy(pos);
          mesh.userData = { path: fullPath, type: f.changeType };
          self._scene.add(mesh);

          // Edge to parent
          var edgeGeo = new THREE.BufferGeometry().setFromPoints([parentNode.pos, pos]);
          var edgeMat = new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0 });
          var edge = new THREE.Line(edgeGeo, edgeMat);
          self._scene.add(edge);
          self._edges.push({ line: edge, mat: edgeMat });

          parentNode.children[part] = { mesh: mesh, pos: pos, children: {}, mat: mat, edgeMat: edgeMat };

          // Bloom animation — fade in
          self._tweenOpacity(mat, 0, 0.9, 500);
          self._tweenOpacity(edgeMat, 0, 0.4, 500);
        } else if (isLeaf) {
          // Existing file — pulse on modify, shrink on delete
          var node = parentNode.children[part];
          if (f.changeType === 'deleted') {
            self._tweenOpacity(node.mat, node.mat.opacity, 0.1, 800);
            self._tweenScale(node.mesh, 1, 0.3, 800);
          } else {
            // Pulse
            self._tweenScale(node.mesh, 1, 1.5, 200, function () {
              self._tweenScale(node.mesh, 1.5, 1, 200);
            });
            node.mat.color.setHex(f.changeType === 'added' ? 0x22c55e : 0x3b82f6);
          }
        }

        parentNode = parentNode.children[part];
      });
    });
  };

  TimeBloom.prototype._tweenOpacity = function (mat, from, to, duration) {
    var start = performance.now();
    function step() {
      var t = Math.min(1, (performance.now() - start) / duration);
      mat.opacity = from + (to - from) * t;
      if (t < 1) requestAnimationFrame(step);
    }
    step();
  };

  TimeBloom.prototype._tweenScale = function (mesh, from, to, duration, cb) {
    var start = performance.now();
    function step() {
      var t = Math.min(1, (performance.now() - start) / duration);
      var s = from + (to - from) * t;
      mesh.scale.set(s, s, s);
      if (t < 1) requestAnimationFrame(step);
      else if (cb) cb();
    }
    step();
  };

  TimeBloom.prototype._animate = function () {
    var self = this;
    var interval = 1000; // ms between commits at 1x

    function loop(time) {
      self._animId = requestAnimationFrame(loop);

      if (self._playing && self._commits.length > 0) {
        var elapsed = time - self._lastTick;
        if (elapsed > interval / self._speed) {
          self._lastTick = time;
          if (self._currentIdx < self._commits.length) {
            self._applyCommit(self._commits[self._currentIdx]);
            self._currentIdx++;
            // Update progress
            var prog = self.container.querySelector('.tb-progress');
            if (prog) prog.textContent = self._currentIdx + ' / ' + self._commits.length;
          } else {
            self._playing = false;
          }
        }
      }

      if (self._renderer && self._scene && self._camera) {
        self._renderer.render(self._scene, self._camera);
      }
    }

    this._lastTick = performance.now();
    loop(this._lastTick);
  };

  window.TimeBloom = TimeBloom;
})();
