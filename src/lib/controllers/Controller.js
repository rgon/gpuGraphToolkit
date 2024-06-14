import { Graph } from "../dataStructures/graph/Graph.js";
import { GraphLoader } from "../dataStructures/graph/GraphLoader.js";
import { WebGLRenderer } from "../rendering/WebGLRenderer.js";
// import { D3Renderer } from "../rendering/D3Renderer.js";
import { RaphsonNewtonAlgorithm } from "../algorithms/RaphsonNewtonAlgorithm.js";
import { SpringEmbeddersAlgorithm } from "../algorithms/springEmbedders/SpringEmbeddersAlgorithm.js";
import { SpringEmbeddersTransferrable } from "../algorithms/springEmbedders/SpringEmbeddersWorkerTransferrable.js";
import { SpringEmbeddersGPUAlgorithm } from "../algorithms/springEmbedders/SpringEmbeddersGPUAlgorithm.js";
import { BarnesHut } from "../algorithms/barnesHut/BarnesHut.js";

export class Controller {
  compatibility = {
    webGL2: false,
    colorBufferFloatExtension: false,
  }

  constructor(canvas, width, height) {
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
    
    this.currentProperties = {}
    this.algorithm = new RaphsonNewtonAlgorithm(
      this.graph,
      this.width,
      this.height
    );

    this.loader = new GraphLoader();

    this._animationFrameId = null;

    this._timeStamp = 0;
  }
  onWindowSizeChange(width, height) {
    this.width = width;
    this.height = height;

    this.renderer.setSize(width, height);
    this.algorithm.onCanvasSizeChanged(width, height);
  }

  setAlgorithmProperties(props) {
    this.currentProperties = props;
    this.algorithm.setProperties(props);
  }

  _updateStats(totalTime, timeToCompute, timeToRender) {
    // document.getElementById("totalTime").innerText = totalTime.toFixed(3);
    // document.getElementById("algoTime").innerText = timeToCompute.toFixed(3);
    // document.getElementById("renderTime").innerText = timeToRender.toFixed(3);
  }

  _resetStats() {
    // document.getElementById("totalTime").innerText = "";
    // document.getElementById("algoTime").innerText = "";
    // document.getElementById("renderTime").innerText = "";
  }

  showError(err) {
    alert(err);
  }

  onPredefinedGraphSelectChange(value) {
    this.loader
      .loadEncodedFromServer(value)
      .then((graph) => this.drawGraph(graph))
      .catch((err) =>
        this
          .showError(`You need to run this website on a server to use this feature.
                    You can still open predefined graphs by loading them from file.`)
      );
  }

  onAlgorithmChanged(value) {
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
      this._addTheta();

      this.algorithm = new BarnesHut(
        this.graph,
        this.width,
        this.height
      );
    }

    this.algorithm.setProperties(this.currentProperties);
  }

  onRendererChanged(value) {
    if (this.renderer) {
      this.renderer.onRemove();
    }

    if (value === "d3") {
      // this.renderer = new D3Renderer();
      alert("D3 renderer is not available at the moment.");
    } else if (value === "webgl") {
      this.renderer = new WebGLRenderer(this.canvas);
    }

    this.renderer.setGraph(this.graph);
    this.renderer.setSize(this.width, this.height);
  }

  onFileSelect(evt) {
    const files = evt.target.files;
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

  drawGraph(graph) {
    cancelAnimationFrame(this._animationFrameId);
    if (this.algorithm.reset) {
      this.algorithm.reset();
    }
    this._resetStats();

    this.graph = graph;

    this.renderer.setGraph(graph);
    this.algorithm.setGraph(graph);

    let numberOfFrames = 0;
    let totalTimeToCompute = 0;
    let totalTimeToRender = 0;
    let totalTime = 0;
    const renderFunction = async (now) => {
      totalTime += now - this._timeStamp;
      this._timeStamp = now;

      const timeBeforeComputing = performance.now();
      await this.algorithm.computeNextPositions();
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
