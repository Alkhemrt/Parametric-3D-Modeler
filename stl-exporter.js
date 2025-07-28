class STLExporter {
    static export(object) {
        let result = 'solid Exported\n';
        const tempVec3 = new THREE.Vector3();
        
        object.traverse(function(child) {
            if (child.isMesh) {
                const geometry = child.geometry;
                const matrix = child.matrixWorld;
                
                if (geometry.index !== null) {
                    // Indexed geometry
                    const indices = geometry.index.array;
                    const positions = geometry.attributes.position.array;
                    
                    for (let i = 0, il = indices.length; i < il; i += 3) {
                        const a = indices[i] * 3;
                        const b = indices[i + 1] * 3;
                        const c = indices[i + 2] * 3;
                        
                        writeFace(
                            positions[a], positions[a + 1], positions[a + 2],
                            positions[b], positions[b + 1], positions[b + 2],
                            positions[c], positions[c + 1], positions[c + 2],
                            matrix
                        );
                    }
                } else {
                    // Non-indexed geometry
                    const positions = geometry.attributes.position.array;
                    
                    for (let i = 0, il = positions.length; i < il; i += 9) {
                        writeFace(
                            positions[i], positions[i + 1], positions[i + 2],
                            positions[i + 3], positions[i + 4], positions[i + 5],
                            positions[i + 6], positions[i + 7], positions[i + 8],
                            matrix
                        );
                    }
                }
            }
        });
        
        result += 'endsolid Exported\n';
        return result;
        
        function writeFace(x1, y1, z1, x2, y2, z2, x3, y3, z3, matrix) {
            tempVec3.set(x1, y1, z1).applyMatrix4(matrix);
            const ax = tempVec3.x, ay = tempVec3.y, az = tempVec3.z;
            
            tempVec3.set(x2, y2, z2).applyMatrix4(matrix);
            const bx = tempVec3.x, by = tempVec3.y, bz = tempVec3.z;
            
            tempVec3.set(x3, y3, z3).applyMatrix4(matrix);
            const cx = tempVec3.x, cy = tempVec3.y, cz = tempVec3.z;
            
            // Calculate normal
            const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
            const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
            const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
            
            result += `  facet normal ${nx / nl} ${ny / nl} ${nz / nl}\n`;
            result += '    outer loop\n';
            result += `      vertex ${ax} ${ay} ${az}\n`;
            result += `      vertex ${bx} ${by} ${bz}\n`;
            result += `      vertex ${cx} ${cy} ${cz}\n`;
            result += '    endloop\n';
            result += '  endfacet\n';
        }
    }
}

// Make STLExporter available globally
window.STLExporter = STLExporter;