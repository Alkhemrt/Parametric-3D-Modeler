class ParametricModeler {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1e1e2e);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth * 0.6 / (window.innerHeight * 0.4), 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.mesh = null;
        this.debugMode = false;
        this.sliceMode = false;
        this.measureMode = false;
        this.currentGeometry = null;
        this.defaultCameraPosition = new THREE.Vector3(0, 2, 5);
        this.isViewerFocused = false;
        
        // Measurement variables
        this.measurementState = 'idle'; // 'idle', 'first-point', 'second-point', 'angle-point'
        this.measurementPoints = [];
        this.measurementElements = [];
        this.measurementLine = null;
        this.measurementAngle = null;
        this.measurementRaycaster = new THREE.Raycaster();
        this.measurementMouse = new THREE.Vector2();
        
        this.initRenderer();
        this.initCamera();
        this.initLights();
        this.initControls();
        this.initEventListeners();
        this.loadDefaultExample();
        
        this.animate();
    }
    
    initRenderer() {
        const container = document.getElementById('renderer-container');
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);
        
        window.addEventListener('resize', () => {
            const container = document.getElementById('renderer-container');
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
            
            // Update measurement positions on resize
            this.updateAllMeasurements();
        });
    }
    
    initCamera() {
        this.camera.position.copy(this.defaultCameraPosition);
        this.camera.lookAt(0, 0, 0);
    }
    
    initLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);
        
        // Fill light
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
        directionalLight2.position.set(-1, -1, -1);
        this.scene.add(directionalLight2);
        
        // Hemisphere light for natural lighting
        const hemisphereLight = new THREE.HemisphereLight(0x4488ff, 0xff8844, 0.2);
        this.scene.add(hemisphereLight);
    }
    
    initControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        const container = document.getElementById('renderer-container');
        
        container.addEventListener('mousedown', (e) => {
            // Only allow dragging when not in measurement mode
            if (!this.measureMode) {
                isDragging = true;
                container.style.cursor = 'grabbing';
                previousMousePosition = { x: e.clientX, y: e.clientY };
                this.isViewerFocused = true;
            }
        });
        
        window.addEventListener('mouseup', () => {
            isDragging = false;
            container.style.cursor = this.measureMode ? 'crosshair' : 'grab';
        });
        
        container.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaMove = {
                    x: e.clientX - previousMousePosition.x,
                    y: e.clientY - previousMousePosition.y
                };
                
                this.camera.position.x -= deltaMove.x * 0.01;
                this.camera.position.y += deltaMove.y * 0.01;
                this.camera.lookAt(0, 0, 0);
                
                previousMousePosition = { x: e.clientX, y: e.clientY };
                
                // Update measurements when camera moves
                this.updateAllMeasurements();
            }
        });
        
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.position.z += e.deltaY * 0.01;
            this.isViewerFocused = true;
            
            // Update measurements when zooming
            this.updateAllMeasurements();
        });
        
        container.addEventListener('click', () => {
            this.isViewerFocused = true;
        });
        
        // Set initial cursor style
        container.style.cursor = 'grab';
        
        // Keyboard controls for view
        document.addEventListener('keydown', (e) => {
            // Only process arrow keys if viewer is focused and editor is not focused
            if (!this.isViewerFocused || document.querySelector('.CodeMirror-focused')) {
                return;
            }
            
            switch(e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    this.setView('top');
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.setView('right');
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.setView('left');
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.setView('bottom');
                    break;
                case 'Escape':
                    this.cancelMeasurement();
                    break;
            }
        });
        
        // Track when editor gets focus
        document.querySelector('.CodeMirror').addEventListener('mousedown', () => {
            this.isViewerFocused = false;
        });
    }
    
    initEventListeners() {
        document.getElementById('run-code').addEventListener('click', () => this.executeCode());
        document.getElementById('export-stl').addEventListener('click', () => this.exportSTL());
        document.getElementById('toggle-debug').addEventListener('click', () => {
            this.toggleDebugMode();
            document.getElementById('toggle-debug').classList.toggle('active');
        });
        document.getElementById('toggle-slice').addEventListener('click', () => {
            this.toggleSliceMode();
            document.getElementById('toggle-slice').classList.toggle('active');
        });
        document.getElementById('toggle-measure').addEventListener('click', () => {
            this.toggleMeasureMode();
            document.getElementById('toggle-measure').classList.toggle('active');
        });
        document.getElementById('examples').addEventListener('change', (e) => this.loadExample(e.target.value));
        document.getElementById('slice-height').addEventListener('input', (e) => this.updateSlicePreview(e.target.value));
        document.getElementById('reset-view').addEventListener('click', () => this.resetView());
        document.getElementById('clear-measurements').addEventListener('click', () => this.clearMeasurements());
        
        // Measurement mouse events
        const container = document.getElementById('renderer-container');
        container.addEventListener('mousedown', (e) => this.handleMeasurementMouseDown(e));
        container.addEventListener('mousemove', (e) => this.handleMeasurementMouseMove(e));
        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.cancelMeasurement();
        });
    }
    
    toggleMeasureMode() {
        this.measureMode = !this.measureMode;
        const container = document.getElementById('renderer-container');
        
        if (this.measureMode) {
            this.showToast('Measurement mode: Click to measure distances. Right-click to cancel.');
            container.style.cursor = 'crosshair';
        } else {
            this.cancelMeasurement();
            container.style.cursor = 'grab';
            this.clearMeasurements();
        }
    }
    
    handleMeasurementMouseDown(e) {
        if (!this.measureMode || !this.mesh) return;
        
        e.preventDefault();
        
        // Get mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.measurementMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.measurementMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the raycaster
        this.measurementRaycaster.setFromCamera(this.measurementMouse, this.camera);
        
        // Check for intersections with the mesh
        const intersects = this.measurementRaycaster.intersectObject(this.mesh);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            
            if (this.measurementState === 'idle') {
                // First point
                this.measurementPoints = [point];
                this.measurementState = 'first-point';
                this.createMeasurementPointMarker(point);
            } else if (this.measurementState === 'first-point') {
                // Second point - create distance measurement
                this.measurementPoints.push(point);
                this.createMeasurementPointMarker(point);
                this.createDistanceMeasurement(this.measurementPoints[0], this.measurementPoints[1]);
                this.measurementState = 'idle';
                this.measurementPoints = [];
            }
        }
    }
    
    handleMeasurementMouseMove(e) {
        if (!this.measureMode || !this.mesh || this.measurementState !== 'first-point') return;
        
        // Get mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.measurementMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.measurementMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the raycaster
        this.measurementRaycaster.setFromCamera(this.measurementMouse, this.camera);
        
        // Check for intersections with the mesh
        const intersects = this.measurementRaycaster.intersectObject(this.mesh);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            
            // Update temporary measurement line
            if (!this.measurementLine) {
                this.measurementLine = this.createTemporaryMeasurementLine(this.measurementPoints[0], point);
            } else {
                this.updateTemporaryMeasurementLine(this.measurementPoints[0], point);
            }
        }
    }
    
    createMeasurementPointMarker(point) {
        // Create a small sphere at the measurement point
        const geometry = new THREE.SphereGeometry(0.02, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(point);
        this.scene.add(marker);
        this.measurementElements.push(marker);
    }
    
    createTemporaryMeasurementLine(startPoint, endPoint) {
        // Create a line element for the DOM
        const lineElement = document.createElement('div');
        lineElement.className = 'measurement-line';
        document.getElementById('renderer-container').appendChild(lineElement);
        
        // Position the line
        this.updateMeasurementLinePosition(lineElement, startPoint, endPoint);
        
        return {
            element: lineElement,
            start: startPoint,
            end: endPoint
        };
    }
    
    updateTemporaryMeasurementLine(startPoint, endPoint) {
        if (!this.measurementLine) return;
        
        this.measurementLine.start = startPoint;
        this.measurementLine.end = endPoint;
        this.updateMeasurementLinePosition(this.measurementLine.element, startPoint, endPoint);
    }
    
    createDistanceMeasurement(startPoint, endPoint) {
        // Remove temporary line
        if (this.measurementLine) {
            this.measurementLine.element.remove();
            this.measurementLine = null;
        }
        
        // Create permanent measurement line
        const lineElement = document.createElement('div');
        lineElement.className = 'measurement-line';
        document.getElementById('renderer-container').appendChild(lineElement);
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'measurement-tooltip';
        document.getElementById('renderer-container').appendChild(tooltip);
        
        // Calculate distance
        const distance = startPoint.distanceTo(endPoint);
        tooltip.textContent = distance.toFixed(2) + ' units';
        
        // Position elements
        this.updateMeasurementLinePosition(lineElement, startPoint, endPoint);
        
        // Position tooltip in the middle of the line
        const middlePoint = new THREE.Vector3().lerpVectors(startPoint, endPoint, 0.5);
        this.updateTooltipPosition(tooltip, middlePoint);
        
        // Store measurement
        this.measurementElements.push({
            type: 'distance',
            line: lineElement,
            tooltip: tooltip,
            start: startPoint,
            end: endPoint
        });
    }
    
    updateMeasurementLinePosition(lineElement, startPoint, endPoint) {
        // Convert 3D points to screen coordinates
        const startScreen = this.toScreenPosition(startPoint);
        const endScreen = this.toScreenPosition(endPoint);
        
        // Calculate line properties
        const length = Math.sqrt(
            Math.pow(endScreen.x - startScreen.x, 2) + 
            Math.pow(endScreen.y - startScreen.y, 2)
        );
        
        const angle = Math.atan2(
            endScreen.y - startScreen.y, 
            endScreen.x - startScreen.x
        ) * 180 / Math.PI;
        
        // Apply styles
        lineElement.style.width = `${length}px`;
        lineElement.style.left = `${startScreen.x}px`;
        lineElement.style.top = `${startScreen.y}px`;
        lineElement.style.transform = `rotate(${angle}deg)`;
    }
    
    updateTooltipPosition(tooltip, point) {
        const screenPos = this.toScreenPosition(point);
        tooltip.style.left = `${screenPos.x}px`;
        tooltip.style.top = `${screenPos.y}px`;
    }
    
    toScreenPosition(vector3) {
        const vector = vector3.clone();
        vector.project(this.camera);
        
        const widthHalf = this.renderer.domElement.clientWidth / 2;
        const heightHalf = this.renderer.domElement.clientHeight / 2;
        
        return {
            x: (vector.x * widthHalf) + widthHalf,
            y: -(vector.y * heightHalf) + heightHalf
        };
    }
    
    updateAllMeasurements() {
        this.measurementElements.forEach(measurement => {
            if (measurement.type === 'distance') {
                this.updateMeasurementLinePosition(measurement.line, measurement.start, measurement.end);
                
                // Update tooltip position
                const middlePoint = new THREE.Vector3().lerpVectors(measurement.start, measurement.end, 0.5);
                this.updateTooltipPosition(measurement.tooltip, middlePoint);
            }
        });
    }
    
    cancelMeasurement() {
        if (this.measurementState !== 'idle') {
            this.measurementState = 'idle';
            this.measurementPoints = [];
            
            if (this.measurementLine) {
                this.measurementLine.element.remove();
                this.measurementLine = null;
            }
        }
    }
    
    clearMeasurements() {
        // Remove all measurement elements from DOM
        this.measurementElements.forEach(measurement => {
            if (measurement.element) {
                measurement.element.remove();
            }
            if (measurement.line) {
                measurement.line.remove();
            }
            if (measurement.tooltip) {
                measurement.tooltip.remove();
            }
            if (measurement.isMesh) {
                this.scene.remove(measurement);
                measurement.geometry.dispose();
                measurement.material.dispose();
            }
        });
        
        this.measurementElements = [];
        
        // Also clear temporary measurement if active
        if (this.measurementLine) {
            this.measurementLine.element.remove();
            this.measurementLine = null;
        }
    }
    
    resetView() {
        this.camera.position.copy(this.defaultCameraPosition);
        this.camera.lookAt(0, 0, 0);
        this.showToast('View reset to default');
        this.updateAllMeasurements();
    }
    
    setView(view) {
        switch(view) {
            case 'top':
                this.camera.position.set(0, 5, 0.001);
                this.camera.lookAt(0, 0, 0);
                this.showToast('View from top');
                break;
            case 'right':
                this.camera.position.set(5, 0, 0.001);
                this.camera.lookAt(0, 0, 0);
                this.showToast('View from right');
                break;
            case 'left':
                this.camera.position.set(-5, 0, 0.001);
                this.camera.lookAt(0, 0, 0);
                this.showToast('View from left');
                break;
            case 'bottom':
                this.camera.position.set(0, -5, 0.001);
                this.camera.lookAt(0, 0, 0);
                this.showToast('View from bottom');
                break;
            default:
                this.resetView();
        }
        
        this.updateAllMeasurements();
    }
    
    loadDefaultExample() {
        // Load spiral example by default
        this.loadExample('spiral');
    }
    
    loadExample(exampleName) {
        if (!exampleName) return;
        
        try {
            let exampleCode;
            
            switch(exampleName) {
                case 'gear':
                    exampleCode = `// Parametric Gear Example
const teeth = 20;
const outerRadius = 2;
const innerRadius = 1.5;
const height = 0.5;

const geometry = GeometryUtils.createParametricGear(
    teeth, 
    outerRadius, 
    innerRadius, 
    height
);

return geometry;`;
                    break;
                case 'vase':
                    exampleCode = `// Parametric Vase Example
const profile = [
    [0.0, 0.0],  // Bottom center
    [0.3, 0.2],  // Base curve
    [0.7, 0.5],  // Body start
    [1.0, 1.5],  // Widest point
    [0.8, 2.0],  // Neck curve
    [0.5, 2.3],  // Top curve
    [0.3, 2.5]   // Rim
];

const segments = 64;
const geometry = GeometryUtils.createParametricVase(profile, segments);
return geometry;`;
                    break;
                case 'spiral':
                    exampleCode = `// Parametric Spiral Example
const turns = 3;
const radius = 1.5;
const height = 2;
const thickness = 0.2;
const segments = 64;

const geometry = GeometryUtils.createParametricSpiral(
    turns,
    radius,
    height,
    thickness,
    segments
);

return geometry;`;
                    break;
                case 'bracket':
                    exampleCode = `// Parametric Bracket Example
const width = 2;
const height = 1.5;
const depth = 0.5;
const thickness = 0.2;
const filletRadius = 0.1;

const geometry = GeometryUtils.createParametricBracket(
    width,
    height,
    depth,
    thickness,
    filletRadius
);

return geometry;`;
                    break;
                default:
                    throw new Error('Example not found');
            }
            
            editor.setValue(exampleCode);
            this.executeCode();
            
            // Update dropdown selection
            document.getElementById('examples').value = exampleName;
            this.showToast(`Loaded ${exampleName} example`);
        } catch (error) {
            console.error('Error loading example:', error);
            this.showToast(`Error loading example: ${error.message}`, 'error');
        }
    }
    
    executeCode() {
        try {
            // Clear previous mesh
            if (this.mesh) {
                this.scene.remove(this.mesh);
                if (this.mesh.geometry) this.mesh.geometry.dispose();
                if (this.mesh.material) this.mesh.material.dispose();
            }
            
            // Clear debug lines if any
            this.scene.children.filter(obj => obj.isLineSegments).forEach(line => {
                this.scene.remove(line);
                line.geometry.dispose();
                line.material.dispose();
            });
            
            // Clear measurements
            this.clearMeasurements();
            
            const code = editor.getValue();
            const userFunction = new Function('THREE', 'GeometryUtils', code + '\nreturn geometry;');
            const geometry = userFunction(THREE, GeometryUtils);
            
            if (!geometry || !geometry.isBufferGeometry) {
                throw new Error('Code must return a THREE.BufferGeometry object');
            }
            
            this.currentGeometry = geometry;
            
            const material = new THREE.MeshPhongMaterial({
                color: 0x89b4fa,
                side: THREE.DoubleSide,
                flatShading: false,
                transparent: true,
                opacity: 0.95,
                specular: 0x111111,
                shininess: 30,
                emissive: 0x000000,
                emissiveIntensity: 0.1
            });
            
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.castShadow = true;
            this.mesh.receiveShadow = true;
            this.scene.add(this.mesh);
            
            this.updateStats(geometry);
            
            if (this.sliceMode) {
                this.updateSlicePreview(document.getElementById('slice-height').value);
            }
            
            if (this.debugMode) {
                this.highlightProblemEdges(geometry);
            }
            
            this.showToast('Code executed successfully', 'success');
            
        } catch (error) {
            console.error('Error executing code:', error);
            this.showToast(`Error: ${error.message}`, 'error');
        }
    }
    
    updateStats(geometry) {
        const vertices = geometry.attributes.position.count;
        const faces = vertices / 3;
        
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const sizeX = (bbox.max.x - bbox.min.x).toFixed(2);
        const sizeY = (bbox.max.y - bbox.min.y).toFixed(2);
        const sizeZ = (bbox.max.z - bbox.min.z).toFixed(2);
        
        document.getElementById('vertex-count').textContent = vertices.toLocaleString();
        document.getElementById('face-count').textContent = faces.toLocaleString();
        document.getElementById('model-size').textContent = `${sizeX}×${sizeY}×${sizeZ}`;
    }
    
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        
        if (this.debugMode && this.currentGeometry) {
            this.highlightProblemEdges(this.currentGeometry);
        } else {
            this.scene.children.filter(obj => obj.isLineSegments).forEach(line => {
                this.scene.remove(line);
                line.geometry.dispose();
                line.material.dispose();
            });
            document.getElementById('warnings').textContent = '0';
        }
    }
    
    highlightProblemEdges(geometry) {
        // Remove existing debug lines
        this.scene.children.filter(obj => obj.isLineSegments).forEach(line => {
            this.scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        });
        
        // Add edges
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0xf38ba8, linewidth: 1 })
        );
        this.scene.add(line);
        
        // Check for geometry issues
        const warnings = GeometryUtils.checkGeometry(geometry);
        document.getElementById('warnings').textContent = warnings.length.toString();
        
        if (warnings.length > 0) {
            console.warn('Geometry issues detected:', warnings);
            this.showToast(`Found ${warnings.length} geometry issues`, 'warning');
        }
    }
    
    toggleSliceMode() {
        this.sliceMode = !this.sliceMode;
        const slicePreview = document.getElementById('slice-preview');
        slicePreview.style.display = this.sliceMode ? 'flex' : 'none';
        
        if (this.sliceMode && this.currentGeometry) {
            this.updateSlicePreview(document.getElementById('slice-height').value);
        }
    }
    
    updateSlicePreview(heightPercent) {
        if (!this.currentGeometry) return;
        
        const canvas = document.getElementById('slice-canvas');
        const ctx = canvas.getContext('2d');
        const heightValue = parseFloat(heightPercent);
        document.getElementById('slice-value').textContent = `${heightValue}%`;
        
        // Set canvas dimensions
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        
        this.currentGeometry.computeBoundingBox();
        const bbox = this.currentGeometry.boundingBox;
        const sliceHeight = bbox.min.y + (bbox.max.y - bbox.min.y) * (heightValue / 100);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const positions = this.currentGeometry.attributes.position.array;
        const scale = Math.min(canvas.width, canvas.height) / Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z) * 0.8;
        const centerX = canvas.width / 2;
        const centerZ = canvas.height / 2;
        
        // Draw slice
        ctx.strokeStyle = '#89b4fa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        
        for (let i = 0; i < positions.length; i += 9) {
            const y1 = positions[i + 1];
            const y2 = positions[i + 4];
            const y3 = positions[i + 7];
            
            if ((y1 <= sliceHeight && y2 >= sliceHeight) || 
                (y1 >= sliceHeight && y2 <= sliceHeight) ||
                (y2 <= sliceHeight && y3 >= sliceHeight) || 
                (y2 >= sliceHeight && y3 <= sliceHeight)) {
                
                const x1 = positions[i];
                const z1 = positions[i + 2];
                const x2 = positions[i + 3];
                const z2 = positions[i + 5];
                const x3 = positions[i + 6];
                const z3 = positions[i + 8];
                
                ctx.moveTo(centerX + x1 * scale, centerZ + z1 * scale);
                ctx.lineTo(centerX + x2 * scale, centerZ + z2 * scale);
                ctx.lineTo(centerX + x3 * scale, centerZ + z3 * scale);
                ctx.lineTo(centerX + x1 * scale, centerZ + z1 * scale);
            }
        }
        
        ctx.stroke();
        
        // Draw slice plane indicator
        ctx.strokeStyle = '#f38ba8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerZ - (sliceHeight - bbox.min.y) * scale);
        ctx.lineTo(canvas.width, centerZ - (sliceHeight - bbox.min.y) * scale);
        ctx.stroke();
    }
    
    exportSTL() {
        if (!this.mesh) {
            this.showToast('No geometry to export', 'error');
            return;
        }
        
        const stlString = STLExporter.export(this.mesh);
        const blob = new Blob([stlString], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'model.stl';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        this.showToast('STL exported successfully', 'success');
    }
    
    showToast(message, type = 'info') {
        const options = {
            text: message,
            duration: 3000,
            gravity: 'top',
            position: 'right',
            stopOnFocus: true
        };
        
        if (type === 'success') {
            options.className = 'toast-success';
        } else if (type === 'error') {
            options.className = 'toast-error';
        }
        
        Toastify(options).showToast();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.modeler = new ParametricModeler();
});