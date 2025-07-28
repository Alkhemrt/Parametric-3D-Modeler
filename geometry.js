class GeometryUtils {
    static checkGeometry(geometry) {
        const warnings = [];
        const positions = geometry.attributes.position.array;
        const index = geometry.index?.array;
        
        // Check for degenerate triangles
        if (index) {
            for (let i = 0; i < index.length; i += 3) {
                const a = index[i], b = index[i + 1], c = index[i + 2];
                if (a === b || b === c || a === c) {
                    warnings.push(`Degenerate triangle at face ${i/3}`);
                }
            }
        } else {
            for (let i = 0; i < positions.length; i += 9) {
                const x1 = positions[i], y1 = positions[i+1], z1 = positions[i+2];
                const x2 = positions[i+3], y2 = positions[i+4], z2 = positions[i+5];
                const x3 = positions[i+6], y3 = positions[i+7], z3 = positions[i+8];
                
                if ((x1 === x2 && y1 === y2 && z1 === z2) ||
                    (x2 === x3 && y2 === y3 && z2 === z3) ||
                    (x1 === x3 && y1 === y3 && z1 === z3)) {
                    warnings.push(`Degenerate triangle at face ${i/9}`);
                }
            }
        }
        
        // Check for non-manifold edges (simplified check)
        const edgeMap = new Map();
        
        const getEdgeKey = (a, b) => {
            return a < b ? `${a}-${b}` : `${b}-${a}`;
        };
        
        if (index) {
            for (let i = 0; i < index.length; i += 3) {
                const a = index[i], b = index[i + 1], c = index[i + 2];
                
                const edge1 = getEdgeKey(a, b);
                const edge2 = getEdgeKey(b, c);
                const edge3 = getEdgeKey(c, a);
                
                edgeMap.set(edge1, (edgeMap.get(edge1) || 0) + 1);
                edgeMap.set(edge2, (edgeMap.get(edge2) || 0) + 1);
                edgeMap.set(edge3, (edgeMap.get(edge3) || 0) + 1);
            }
        } else {
            const vertexCount = positions.length / 3;
            for (let i = 0; i < vertexCount; i += 3) {
                const a = i, b = i + 1, c = i + 2;
                
                const edge1 = getEdgeKey(a, b);
                const edge2 = getEdgeKey(b, c);
                const edge3 = getEdgeKey(c, a);
                
                edgeMap.set(edge1, (edgeMap.get(edge1) || 0) + 1);
                edgeMap.set(edge2, (edgeMap.get(edge2) || 0) + 1);
                edgeMap.set(edge3, (edgeMap.get(edge3) || 0) + 1);
            }
        }
        
        // Check for edges shared by more than 2 faces
        for (const [edge, count] of edgeMap.entries()) {
            if (count > 2) {
                warnings.push(`Non-manifold edge detected: ${edge} (shared by ${count} faces)`);
            }
        }
        
        return warnings;
    }
    
    // Parametric shape generators
    static createParametricGear(teeth = 10, outerRadius = 1, innerRadius = 0.7, height = 0.2) {
        const shape = new THREE.Shape();
        const toothDepth = (outerRadius - innerRadius) * 0.5;
        const angleStep = (Math.PI * 2) / teeth;
        
        for (let i = 0; i <= teeth; i++) {
            const angle = i * angleStep;
            const angleNext = (i + 0.5) * angleStep;
            const angleNext2 = (i + 1) * angleStep;
            
            const x1 = Math.cos(angle) * outerRadius;
            const y1 = Math.sin(angle) * outerRadius;
            
            const x2 = Math.cos(angleNext) * (outerRadius - toothDepth);
            const y2 = Math.sin(angleNext) * (outerRadius - toothDepth);
            
            const x3 = Math.cos(angleNext2) * outerRadius;
            const y3 = Math.sin(angleNext2) * outerRadius;
            
            if (i === 0) {
                shape.moveTo(x1, y1);
            } else {
                shape.lineTo(x1, y1);
            }
            
            shape.lineTo(x2, y2);
            shape.lineTo(x3, y3);
        }
        
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: height,
            bevelEnabled: false
        });
        
        return geometry;
    }
    
    static createParametricVase(profile = [], segments = 32) {
        if (profile.length === 0) {
            // Default vase profile
            profile = [
                [0, 0],
                [0.3, 0.2],
                [0.5, 0.5],
                [0.7, 1.0],
                [0.6, 1.5],
                [0.4, 1.8],
                [0.3, 2.0]
            ];
        }
        
        const points = profile.map(p => new THREE.Vector2(p[0], p[1]));
        const geometry = new THREE.LatheGeometry(points, segments);
        return geometry;
    }
    
    static createParametricSpiral(turns = 2, radius = 1, height = 1, thickness = 0.1, segments = 32) {
        const points = [];
        const steps = turns * segments;
        
        for (let i = 0; i <= steps; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const r = radius + Math.sin(angle * turns) * thickness * 0.5;
            const y = (i / steps) * height;
            
            points.push(new THREE.Vector3(
                Math.cos(angle) * r,
                y - height * 0.5,
                Math.sin(angle) * r
            ));
        }
        
        const path = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(path, steps, thickness, 8, false);
        
        return tubeGeometry;
    }
    
    static createParametricBracket(width = 2, height = 1.5, depth = 0.5, thickness = 0.2, filletRadius = 0.1) {
        const shape = new THREE.Shape();
        
        // Main bracket shape
        shape.moveTo(-width/2 + filletRadius, -height/2);
        shape.lineTo(width/2 - filletRadius, -height/2);
        shape.absarc(width/2 - filletRadius, -height/2 + filletRadius, filletRadius, Math.PI * 1.5, 0, false);
        shape.lineTo(width/2, height/2 - filletRadius);
        shape.absarc(width/2 - filletRadius, height/2 - filletRadius, filletRadius, 0, Math.PI * 0.5, false);
        shape.lineTo(-width/2 + filletRadius, height/2);
        shape.absarc(-width/2 + filletRadius, height/2 - filletRadius, filletRadius, Math.PI * 0.5, Math.PI, false);
        shape.lineTo(-width/2, -height/2 + filletRadius);
        shape.absarc(-width/2 + filletRadius, -height/2 + filletRadius, filletRadius, Math.PI, Math.PI * 1.5, false);
        
        // Inner cutout
        const hole = new THREE.Path();
        const innerWidth = width - thickness * 2;
        const innerHeight = height - thickness * 2;
        
        hole.moveTo(-innerWidth/2 + filletRadius, -innerHeight/2);
        hole.lineTo(innerWidth/2 - filletRadius, -innerHeight/2);
        hole.absarc(innerWidth/2 - filletRadius, -innerHeight/2 + filletRadius, filletRadius, Math.PI * 1.5, 0, false);
        hole.lineTo(innerWidth/2, innerHeight/2 - filletRadius);
        hole.absarc(innerWidth/2 - filletRadius, innerHeight/2 - filletRadius, filletRadius, 0, Math.PI * 0.5, false);
        hole.lineTo(-innerWidth/2 + filletRadius, innerHeight/2);
        hole.absarc(-innerWidth/2 + filletRadius, innerHeight/2 - filletRadius, filletRadius, Math.PI * 0.5, Math.PI, false);
        hole.lineTo(-innerWidth/2, -innerHeight/2 + filletRadius);
        hole.absarc(-innerWidth/2 + filletRadius, -innerHeight/2 + filletRadius, filletRadius, Math.PI, Math.PI * 1.5, false);
        
        shape.holes.push(hole);
        
        const extrudeSettings = {
            depth: depth,
            bevelEnabled: false,
            steps: 1
        };
        
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        return geometry;
    }
}

// Make GeometryUtils available globally for user code
window.GeometryUtils = GeometryUtils;