import { CircleShader } from '../shaders/CircleShader.js';
import { LineShader } from '../shaders/LineShader.js';
import { Texture } from '../kernels/Texture.js';
import { Camera } from './Camera.js';

import { mat3 } from 'gl-matrix-esm';

/**
 * WebGL renderer.
 * This renderer batches together nodes and edges.
 * Moreover, this renderer can read nodes positions directly from a Texture
 * so that GPU based algorithm do not have to retrieve their data from the GPU.
 * Node positions texture should be set before calling the render method
 * by using the setPositionTexture method. If the position texture is not set
 * the nodes position will be taken from the graph provided using setGraph.
 */
export class WebGLRenderer {

    /**
     * Vertices of a quad, used as the only mesh for rendering
     */
    static _QUAD_VERTICES = new Float32Array([
        -1.0, -1.0,
        1.0, -1.0, 
        1.0,  1.0,
        1.0,  1.0,
        -1.0,  1.0,
        -1.0, -1.0
    ]);

    constructor(canvas) {
        this._canvas = canvas
        this.gl = canvas.getContext("webgl2");
        this._camera = new Camera(this._canvas);

        this._graph = null;

        this._width = 0;
        this._height = 0;
        this._clipMatrix = mat3.create();

        /** A texture that contains the positions of the nodes, received from algorithm */
        this._positionsTexture = null;

        /** A texture that contains the positions of the nodes, created from graph */
        this._fallbackPositionsTexture = null;

        /** VAO for nodes */
        this._circleVAO = null;

        /** VAO for edges */
        this._lineVAO = null;
        
        // so that they can be easily removed
        this._VBOs = [];

        this._circleShader = new CircleShader(this.gl);
        this._lineShader = new LineShader(this.gl);
    }

    _createFallbackPositionsTextureFromGraph() {
        const graph = this._graph;

        // We encode N nodes in a matrix whose size is sqrt(n) x sqrt(n)
        const nodesMatrixSize = Math.ceil(Math.sqrt(graph.nodes.length));

        // the position matrix nodesMatrixSize x nodesMatrixSize x 2: just store x and y
        const positionsMatrix = new Float32Array(nodesMatrixSize * nodesMatrixSize * 2);
        positionsMatrix.fill(-10000.0); // a default value that should not interfere with valid nodes

        for (let i = 0; i < graph.nodes.length; i++) {
            const currentNode = graph.nodes[i];
            const currentNodePositionIndex = i * 2;

            // store the initial positions
            positionsMatrix.set([currentNode.x, currentNode.y], currentNodePositionIndex);
        }

        if (this._fallbackPositionsTexture === null) {
            this._fallbackPositionsTexture = Texture.createTextureFloat32_2(this.gl, nodesMatrixSize, nodesMatrixSize, positionsMatrix, true);
        }
        else {
            this._fallbackPositionsTexture.updateData(positionsMatrix);
        }

        return this._fallbackPositionsTexture;
    }

    /**
     * Creates a VBO
     */
    _createVBO(data, dataPerUnit, type, stride, offset, attribute, useForInstance) {
        const vbo = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);

        this.gl.enableVertexAttribArray(attribute);
        this.gl.vertexAttribPointer(attribute, dataPerUnit, type, false, stride, offset);

        if (useForInstance === true) {
            this.gl.vertexAttribDivisor(attribute, 1);
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

        return vbo;
    }

    _indexToMatrixCoordinates(index, rows, columns) {
        const row = Math.floor(index / rows);
        const col = index % columns;
        return [col, row];
    }

    _setupShaders() {
        this._circleShader.use();
        this._circleShader.setInt("positionsTexture", 0);
        this._circleShader.stop();

        this._lineShader.use();
        this._lineShader.setInt("positionsTexture", 0);
        this._lineShader.stop();
    }

    _createCircleVAO() {
        const positionsMatrixSize = Math.ceil(Math.sqrt(this._graph.nodes.length));

        // build the buffer containing, for every node instance
        // the coordinates in the positions texture (see kernel)
        // from which the position of the node should be read.
        const positionsTextureNodeCoords = new Int16Array(this._graph.nodes.length * 2); // x y for each node

        this._graph.nodes.forEach((node, i) => {
            const coords = this._indexToMatrixCoordinates(i, positionsMatrixSize, positionsMatrixSize);

            positionsTextureNodeCoords.set(coords, i * 2);
        });

        this._circleVAO = this.gl.createVertexArray();
        this.gl.bindVertexArray(this._circleVAO);

        // puts the vertex coordinates of the quad in vertex attrib 0
        const quadVBO = this._createVBO(WebGLRenderer._QUAD_VERTICES, 2, this.gl.FLOAT, 0, 0, 0, false);

        // puts the coordinates where the shader can retrieve the node position
        // fom the positions texture into vertex attrib 1
        const posTextureVBO = this._createVBO(positionsTextureNodeCoords, 2, this.gl.SHORT, 0, 0, 1, true);

        this.gl.bindVertexArray(null);

        this._VBOs.push(quadVBO);
        this._VBOs.push(posTextureVBO);
    }

    _createLineVAO() {
        const positionsMatrixSize = Math.ceil(Math.sqrt(this._graph.nodes.length));

        // creates two buffer representing the coordinates in _positionsTexture where it is possible
        // to find the start and end coordinates of an edge
        const sourcePositionsTexturesNodeCoords = new Int16Array(this._graph.edges.length * 2); // x y for each node
        const targetPositionsTexturesNodeCoords = new Int16Array(this._graph.edges.length * 2); // x y for each node

        this._graph.edges.forEach((edge, i) => {
            const sourceIndex = this._graph.nodes.indexOf(edge.source);
            const targetIndex = this._graph.nodes.indexOf(edge.target);

            const sourceCoords = this._indexToMatrixCoordinates(sourceIndex, positionsMatrixSize, positionsMatrixSize);
            const targetCoords = this._indexToMatrixCoordinates(targetIndex, positionsMatrixSize, positionsMatrixSize);

            sourcePositionsTexturesNodeCoords.set(sourceCoords, i * 2);
            targetPositionsTexturesNodeCoords.set(targetCoords, i * 2);
        });

        this._lineVAO = this.gl.createVertexArray();
        this.gl.bindVertexArray(this._lineVAO);

        // puts the vertex coordinates of the quad in vertex attrib 0
        const quadVBO = this._createVBO(WebGLRenderer._QUAD_VERTICES, 2, this.gl.FLOAT, 0, 0, 0, false);

        // puts the coordinates where the shader can retrieve the edge start position
        // fom the positions texture into vertex attrib 1
        const sourceTextureVBO = this._createVBO(sourcePositionsTexturesNodeCoords, 2, this.gl.SHORT, 0, 0, 1, true);

        // puts the coordinates where the shader can retrieve the edge end position
        // fom the positions texture into vertex attrib 2
        const targetTextureVBO = this._createVBO(targetPositionsTexturesNodeCoords, 2, this.gl.SHORT, 0, 0, 2, true);

        this.gl.bindVertexArray(null);

        this._VBOs.push(quadVBO);
        this._VBOs.push(sourceTextureVBO);
        this._VBOs.push(targetTextureVBO);
    }

    onRemove() {
        // hides the webgl canvas
        this._canvas.classList.remove("fullscreenCanvas");
        this._canvas.style.display = "none";

        if (this._fallbackPositionsTexture !== null) {
            this._fallbackPositionsTexture.delete();
        }

        // deletes buffers
        for (let buffer of this._VBOs) {
            this.gl.deleteBuffer(buffer);
        }

        this.gl.deleteVertexArray(this._lineVAO);
        this.gl.deleteVertexArray(this._circleVAO);
        this._circleShader.delete();
        this._lineShader.delete();
    }

    setRenderNodeLabels(value) {
        // not implemented
    }

    setRenderEdgeLabels(value) {
        // not implemented
    }

    setGraph(graph) {
        this._graph = graph;

        if (this._fallbackPositionsTexture !== null) { // new graph, invalidate fallback texture
            this._fallbackPositionsTexture.delete();
            this._fallbackPositionsTexture = null;
        }
        this._createCircleVAO();
        this._createLineVAO();
        this._setupShaders()
    }

    setSize(width, height) {
        // we need to update the size of the canvas. Using css 100% will just
        // scale the canvas without changing the size of the framebuffer https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html                
        
        this._canvas.width = width * window.devicePixelRatio;
        this._canvas.height = height * window.devicePixelRatio;

        this._width = width;
        this._height = height;

        // converts from canvas space (0, 0) -> (width, height)
        // to ndc coordinates (-1, -1) -> (1, 1) flipping the y axis
        this._clipMatrix = mat3.fromValues(2.0 / width, 0.0, 0.0,
                                            0.0, 2.0 / -height, 0.0,
                                            -1.0, 1.0, 1.0);

        this._camera.updateClipMatrix(this._clipMatrix);
    }

    setPositionsTexture(texture) {
        this._positionsTexture = texture;
    }

    _renderNodes(viewClipMatrix) {
        this._circleShader.use();

        this._circleShader.updateViewClipMatrix(viewClipMatrix);

        this.gl.bindVertexArray(this._circleVAO);

        this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, 6, this._graph.nodes.length);

        this.gl.bindVertexArray(null);
        this._circleShader.stop();
    }

    _renderEdges(viewClipMatrix) {
        this._lineShader.use();

        this._lineShader.updateViewClipMatrix(viewClipMatrix);

        this.gl.bindVertexArray(this._lineVAO);

        this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, 6, this._graph.edges.length);

        this.gl.bindVertexArray(null);
        this._lineShader.stop();
    }

    render() {
        // enable alpha blending
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        if (this._positionsTexture === null) {
            this._positionsTexture = this._createFallbackPositionsTextureFromGraph();
        }
        const viewClipMatrix = mat3.create();
        mat3.mul(viewClipMatrix, this._clipMatrix, this._camera.getViewMatrix());

        // bind position texture
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this._positionsTexture.getTextureId());

        this.gl.viewport(0, 0,
            this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this._renderEdges(viewClipMatrix);
        this._renderNodes(viewClipMatrix);

        this.gl.bindTexture(this.gl.TEXTURE_2D, null);

        // used and now expired
        this._positionsTexture = null;

        // disable alpha blending
        this.gl.disable(this.gl.BLEND);
    }

    /**
     * Direct rendering means that this algorithm can render nodes and edges 
     * by reading their positions direcly from a texture.
     * If this method returns true, GPU based algorithm do not need to transfer data
     * from the GPU to the CPU to update the graph before rendering
     * @returns whether this renderer supports direct rendering.
     */
    supportsDirectRendering() {
        return true;
    }
}
