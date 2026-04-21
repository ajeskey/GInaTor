/**
 * CityBlock — Three.js 3D city visualization.
 * Files as buildings (height = line count, footprint = change frequency).
 * Directory grouping as city blocks with streets.
 * Fetches from /api/v1/city-block.
 */
(function () {
  'use strict';

  var THREE = window.THREE;

  function CityBlock(containerId, appState) {
    window.VisualizationBase.call(this, containerId, appState);
    this._scene = null;
    this._camera = null;
    this._renderer = null;
    this._animId = null;
    this._raycaster = null;
    this._mouse = null;
    this.colorBy = 'filetype'; // 'contributor' | 'filetype' | 'age'
    this._buildings = [];
  }

  CityBlock.prototype = Object.create(window.VisualizationBase.prototype);
  CityBlock.prototype.constructor = CityBlock;

  CityBlock.prototype.load = function (repoId, dateRange) {
    window.VisualizationBase.prototype.load.call(this, repoId, dateRange);
    this._fetchData();
  };

  CityBlock.prototype.update = function (dateRange) {
    window.VisualizationBase.prototype.update.call(this, dateRange);
    this._fetchData();
  };

  CityBlock.prototype.resize = function () {
    if (!this._renderer || !this._camera) return;
    var dims = this._dims();
    this._camera.aspect = dims.width / dims.height;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(dims.width, dims.height);
  };

  CityBlock.prototype.destroy = function () {
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

  CityBlock.prototype.exportSVG = function () {
    return null;
  }; // WebGL

  CityBlock.prototype.setColorBy = function (c) {
    this.colorBy = c;
    this._fetchData();
  };

  CityBlock.prototype._fetchData = function () {
    var self = this;
    if (!this.repoId) return;

    this._fetch(this._apiUrl('/api/v1/city-block', { colorBy: this.colorBy }))
      .then(function (data) {
        self.data = data;
        self._initScene();
        self._buildCity(data);
        self._buildLegend(data);
        self._animate();
      })
      .catch(function (err) {
        console.error('CityBlock fetch error:', err);
      });
  };

  CityBlock.prototype._initScene = function () {
    var dims = this._dims();

    if (this._renderer) {
      this._renderer.dispose();
      this._renderer.domElement.remove();
    }
    if (this._animId) cancelAnimationFrame(this._animId);
    this.container.innerHTML = '';

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x1a1a2e);
    this._scene.fog = new THREE.FogExp2(0x1a1a2e, 0.002);

    this._camera = new THREE.PerspectiveCamera(50, dims.width / dims.height, 0.1, 2000);
    this._camera.position.set(100, 120, 200);
    this._camera.lookAt(0, 0, 0);

    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.setSize(dims.width, dims.height);
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.shadowMap.enabled = true;
    this.container.appendChild(this._renderer.domElement);

    // Lights
    this._scene.add(new THREE.AmbientLight(0x404060, 1.5));
    var sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(80, 150, 100);
    sun.castShadow = true;
    this._scene.add(sun);

    var pointLight = new THREE.PointLight(0x6366f1, 0.5, 400);
    pointLight.position.set(0, 80, 0);
    this._scene.add(pointLight);

    // Ground plane
    var groundGeo = new THREE.PlaneGeometry(600, 600);
    var groundMat = new THREE.MeshPhongMaterial({ color: 0x16213e });
    var ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this._scene.add(ground);

    // Raycaster
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._buildings = [];

    // Mouse controls
    this._setupMouseControls();
  };

  CityBlock.prototype._setupMouseControls = function () {
    var self = this;
    var isDragging = false;
    var prevX = 0,
      prevY = 0;
    var rotY = 0,
      rotX = 0.5;
    var dist = 250;
    var canvas = this._renderer.domElement;

    function updateCamera() {
      self._camera.position.x = Math.sin(rotY) * Math.cos(rotX) * dist;
      self._camera.position.y = Math.sin(rotX) * dist;
      self._camera.position.z = Math.cos(rotY) * Math.cos(rotX) * dist;
      self._camera.lookAt(0, 0, 0);
    }

    canvas.addEventListener('mousedown', function (e) {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    });
    canvas.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      rotY += (e.clientX - prevX) * 0.005;
      rotX = Math.max(0.1, Math.min(1.4, rotX + (e.clientY - prevY) * 0.005));
      prevX = e.clientX;
      prevY = e.clientY;
      updateCamera();
    });
    canvas.addEventListener('mouseup', function () {
      isDragging = false;
    });
    canvas.addEventListener('wheel', function (e) {
      dist = Math.max(50, Math.min(600, dist + e.deltaY * 0.3));
      updateCamera();
    });

    // Tooltip on hover
    var tipEl = document.createElement('div');
    tipEl.style.cssText =
      'position:absolute;pointer-events:none;background:rgba(0,0,0,0.85);color:#fff;' +
      'padding:6px 10px;border-radius:4px;font-size:12px;display:none;z-index:1000;';
    self.container.style.position = 'relative';
    self.container.appendChild(tipEl);

    canvas.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      self._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      self._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      self._raycaster.setFromCamera(self._mouse, self._camera);
      var meshes = self._buildings.map(function (b) {
        return b.mesh;
      });
      var intersects = self._raycaster.intersectObjects(meshes);
      if (intersects.length > 0) {
        var d = intersects[0].object.userData;
        tipEl.innerHTML =
          '<b>' + d.path + '</b><br>Lines: ' + d.lines + '<br>Changes: ' + d.frequency;
        tipEl.style.display = 'block';
        tipEl.style.left = e.clientX - rect.left + 12 + 'px';
        tipEl.style.top = e.clientY - rect.top - 10 + 'px';
      } else {
        tipEl.style.display = 'none';
      }
    });

    canvas.addEventListener('click', function (e) {
      var rect = canvas.getBoundingClientRect();
      self._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      self._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      self._raycaster.setFromCamera(self._mouse, self._camera);
      var meshes = self._buildings.map(function (b) {
        return b.mesh;
      });
      var intersects = self._raycaster.intersectObjects(meshes);
      if (intersects.length > 0) {
        var d = intersects[0].object.userData;
        window.dispatchEvent(new CustomEvent('viz:file-selected', { detail: { file: d.path } }));
      }
    });

    updateCamera();
  };

  CityBlock.prototype._buildCity = function (data) {
    var files = data.files || [];
    var self = this;

    // Group files by top-level directory
    var dirs = {};
    files.forEach(function (f) {
      var parts = f.path.split('/');
      var dir = parts.length > 1 ? parts[0] : '_root';
      if (!dirs[dir]) dirs[dir] = [];
      dirs[dir].push(f);
    });

    var dirNames = Object.keys(dirs).sort();
    var gridSize = Math.ceil(Math.sqrt(dirNames.length));
    var blockSpacing = 60;

    var colorPalette = [
      0x3b82f6, 0x22c55e, 0xf59e0b, 0xef4444, 0x8b5cf6, 0x06b6d4, 0xec4899, 0x84cc16
    ];
    var extColors = {};
    var extIdx = 0;

    dirNames.forEach(function (dir, di) {
      var row = Math.floor(di / gridSize);
      var col = di % gridSize;
      var blockX = (col - gridSize / 2) * blockSpacing;
      var blockZ = (row - gridSize / 2) * blockSpacing;

      var dirFiles = dirs[dir];
      var subGrid = Math.ceil(Math.sqrt(dirFiles.length));
      var fileSpacing = 8;

      dirFiles.forEach(function (f, fi) {
        var fr = Math.floor(fi / subGrid);
        var fc = fi % subGrid;
        var x = blockX + (fc - subGrid / 2) * fileSpacing;
        var z = blockZ + (fr - subGrid / 2) * fileSpacing;

        var height = Math.max(1, Math.log2((f.lines || 1) + 1) * 5);
        var footprint = Math.max(2, Math.sqrt(f.frequency || 1) * 2);

        // Color by file extension
        var ext = f.path.split('.').pop() || 'other';
        if (!extColors[ext]) {
          extColors[ext] = colorPalette[extIdx % colorPalette.length];
          extIdx++;
        }

        var geo = new THREE.BoxGeometry(footprint, height, footprint);
        var mat = new THREE.MeshPhongMaterial({
          color: extColors[ext],
          transparent: true,
          opacity: 0.85
        });
        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, height / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { path: f.path, lines: f.lines || 0, frequency: f.frequency || 0 };
        self._scene.add(mesh);
        self._buildings.push({ mesh: mesh, mat: mat, data: f });
      });

      // Street label
      // (Rendered as a simple plane with text would require a texture — skip for simplicity)
    });
  };

  CityBlock.prototype._buildLegend = function (_data) {
    var existing = this.container.querySelector('.cb-legend');
    if (existing) existing.remove();

    var legend = document.createElement('div');
    legend.className = 'cb-legend';
    legend.style.cssText =
      'position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.7);' +
      'padding:8px 12px;border-radius:6px;color:#fff;font-size:11px;z-index:10;';
    legend.innerHTML =
      '<b>City Block</b><br>' +
      '🏢 Height = Line count<br>' +
      '📐 Footprint = Change frequency<br>' +
      '🎨 Color = File type';
    this.container.appendChild(legend);
  };

  CityBlock.prototype._animate = function () {
    var self = this;

    function loop() {
      self._animId = requestAnimationFrame(loop);
      if (self._renderer && self._scene && self._camera) {
        self._renderer.render(self._scene, self._camera);
      }
    }
    loop();
  };

  window.CityBlock = CityBlock;
})();
