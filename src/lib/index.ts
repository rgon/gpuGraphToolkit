import { Graph } from "./dataStructures/graph/Graph.js";
import { GraphLoader } from "./dataStructures/graph/GraphLoader.js";
import { WebGLRenderer } from "./rendering/WebGLRenderer.js";
// import { D3Renderer } from "./rendering/D3Renderer.js";
import { RaphsonNewtonAlgorithm } from "./algorithms/RaphsonNewtonAlgorithm.js";
import { SpringEmbeddersAlgorithm } from "./algorithms/springEmbedders/SpringEmbeddersAlgorithm.js";
import { SpringEmbeddersTransferrable } from "./algorithms/springEmbedders/SpringEmbeddersWorkerTransferrable.js";
import { SpringEmbeddersGPUAlgorithm } from "./algorithms/springEmbedders/SpringEmbeddersGPUAlgorithm.js";
import { BarnesHut } from "./algorithms/barnesHut/BarnesHut.js";

import type { AlgorithmProperties, Stats } from './types.js'
interface APICompatibility {
    webGL2: boolean,
    colorBufferFloatExtension: boolean
}

export class GraphController {
    
    compatibility:APICompatibility = {
        webGL2: false,
        colorBufferFloatExtension: false,
    }
    width: number
    height: number

    canvas: HTMLCanvasElement
    gl: WebGL2RenderingContext|null
    graph: Graph
    renderer: WebGLRenderer
    algorithm: RaphsonNewtonAlgorithm | SpringEmbeddersAlgorithm | SpringEmbeddersTransferrable | SpringEmbeddersGPUAlgorithm | BarnesHut | undefined

    algorithmProperties: AlgorithmProperties = {
        speed: 1000,
        springRestLength: 15,
        springDampening: 0.125,
        charge: 75,
        theta: 0.5
    }
    onStatsChange: (stats: Stats) => void = () => {}

    loader: GraphLoader

    _animationFrameId: number|null = null
    _timeStamp: number = 0
    
    constructor(canvas:HTMLCanvasElement, width:number, height:number) {
        this.width = width;
        this.height = height;
                
        this.canvas = canvas;
        this.gl = canvas.getContext("webgl2");
        if (this.gl) {
            this.compatibility.webGL2 = true;
            this.gl.disable(this.gl.DEPTH_TEST);
            this.gl.pixelStorei(this.gl.PACK_ALIGNMENT, 1);
            this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
            
            if (this.gl.getExtension("EXT_color_buffer_float")) {
                this.compatibility.colorBufferFloatExtension = true;
            }
        }
        
        this.graph = new Graph();
        this.renderer = new WebGLRenderer(this.canvas); // D3Renderer();
        
        this.loader = new GraphLoader();
    }

    onWindowSizeChange(width:number, height:number) {
        this.width = width;
        this.height = height;
        
        this.renderer.setSize(width, height);
        this.algorithm?.onCanvasSizeChanged(width, height);
    }
        
    _updateStats(totalTime:number, algoTime:number, renderTime:number) {
        this.onStatsChange({
            totalTime,
            algoTime,
            renderTime
        })
        // document.getElementById("totalTime").innerText = totalTime.toFixed(3);
        // document.getElementById("algoTime").innerText = timeToCompute.toFixed(3);
        // document.getElementById("renderTime").innerText = timeToRender.toFixed(3);
    }
    
    _resetStats() {
        this.onStatsChange({
            totalTime: 0,
            algoTime: 0,
            renderTime: 0
        })
        // document.getElementById("totalTime").innerText = "";
        // document.getElementById("algoTime").innerText = "";
        // document.getElementById("renderTime").innerText = "";
    }
    
    showError(err:string) {
        alert(err);
    }
    
    onPredefinedGraphSelectChange(value:string) {
        this.loader
        .loadEncodedFromServer(value)
        .then((graph) => this.drawGraph(graph))
        .catch((err) => {
            console.error(err)
            this.showError(`You need to run this website on a server to use this feature.
                    You can still open predefined graphs by loading them from file.`)
            });
    }
        
    onAlgorithmChanged(value:string) {
        if (this.algorithm) {
            this.algorithm.onRemove();
        }
        if (value === "Tutte") {
            this.algorithm = new RaphsonNewtonAlgorithm(
                this.graph,
                this.width,
                this.height
            );
        } else if (value === "SpringEmbedders") {
            this.algorithm = new SpringEmbeddersAlgorithm(
                this.graph,
                this.width,
                this.height
            );
        } else if (value === "SpringEmbeddersTrans") {
            this.algorithm = new SpringEmbeddersTransferrable(
                this.graph,
                this.width,
                this.height
            );
        } else if (value === "SpringEmbeddersGPU") {
            this.algorithm = new SpringEmbeddersGPUAlgorithm(
                this.gl,
                this.renderer,
                this.graph,
                this.width,
                this.height
            );
        } else if (value === "BarnesHut") {
            this.algorithm = new BarnesHut(
                this.graph,
                this.width,
                this.height
            );
        }
        
        this.algorithm?.setProperties(this.algorithmProperties);
    }
    
    // onRendererChanged(value) {
    //     if (this.renderer) {
    //         this.renderer.onRemove();
    //     }
        
    //     if (value === "d3") {
    //         // this.renderer = new D3Renderer();
    //         alert("D3 renderer is not available at the moment.");
    //     } else if (value === "webgl") {
    //         this.renderer = new WebGLRenderer(this.canvas);
    //     }
        
    //     this.renderer.setGraph(this.graph);
    //     this.renderer.setSize(this.width, this.height);
    // }
    
    onFileSelect(evt:Event) {
        const files = (evt.target as HTMLInputElement)?.files;
        if (!files || files.length === 0) {
            return;
        }
        const file = files[0];
        
        this.loader
        .loadFromFile(file)
        .then((graph) => this.drawGraph(graph))
        .catch((err) => this.showError(err));
        
        // this.loader
        // .loadGLMFromServer(requestQuery)
        // .then((graph) => this.drawGraph(graph))
        // .catch((err) => this.showError(err));
    }
    
    // onShowNodeLabelsChange(chkbox) {
    //   this.renderer.setRenderNodeLabels(chkbox.checked);
    // }
    
    // onShowEdgeLabelsChange(chkbox) {
    //   this.renderer.setRenderEdgeLabels(chkbox.checked);
    // }
    
    drawGraph(graph:Graph) {
        if (this._animationFrameId !== null) cancelAnimationFrame(this._animationFrameId);
        
        if (!this.algorithm) {
            this.showError("No algorithm selected.");
            return;
        }

        if ((this.algorithm as any)?.reset) {
            (this.algorithm as any).reset();
        }
        this._resetStats();
        
        this.graph = graph;
        
        this.renderer.setGraph(graph);
        this.algorithm.setGraph(graph);
        
        let numberOfFrames = 0;
        let totalTimeToCompute = 0;
        let totalTimeToRender = 0;
        let totalTime = 0;
        const renderFunction = async (now:number) => {
            totalTime += now - this._timeStamp;
            this._timeStamp = now;
            
            const timeBeforeComputing = performance.now();
            await this.algorithm?.computeNextPositions();
            totalTimeToCompute += performance.now() - timeBeforeComputing;
            
            const timeBeforeRendering = performance.now();
            this.renderer.render();
            totalTimeToRender += performance.now() - timeBeforeRendering;
            
            numberOfFrames++;
            if (numberOfFrames % 10 === 0) {
                // update stats every 10 frames
                this._updateStats(
                    totalTime / numberOfFrames,
                    totalTimeToCompute / numberOfFrames,
                    totalTimeToRender / numberOfFrames
                );
                numberOfFrames = 0;
                totalTimeToCompute = 0;
                totalTimeToRender = 0;
                totalTime = 0;
            }
            this._animationFrameId = requestAnimationFrame(renderFunction);
        };
        
        this._animationFrameId = requestAnimationFrame(renderFunction);
    }
    
}
    