<script lang="ts">
    import { GraphController } from "$lib/index.js";
    import { onMount } from "svelte";
    import type { Stats, AlgorithmProperties } from "$lib/types.js";
    
    let canvasElement: HTMLCanvasElement;
    let ctrl:GraphController
    
    const DEFAULT_GRAPH_BASE = './defaultGraphs'
    
    let defaultGraphs:Record<string, string> = {
        "adam": DEFAULT_GRAPH_BASE + "/adam.json",
        "adam directed": DEFAULT_GRAPH_BASE + "/adam_directed.json",
        "rect": DEFAULT_GRAPH_BASE + "/rect.json",
        "100 nodes": DEFAULT_GRAPH_BASE + "/100_nodes.json",
        "500 nodes": DEFAULT_GRAPH_BASE + "/500_nodes.json",
        "1k nodes": DEFAULT_GRAPH_BASE + "/1k_nodes.json",
        "5k nodes": DEFAULT_GRAPH_BASE + "/5k_nodes.json",
        "10k nodes": DEFAULT_GRAPH_BASE + "/10k_nodes.json",
        "20k nodes": DEFAULT_GRAPH_BASE + "/20k_nodes.json",
        "30k nodes": DEFAULT_GRAPH_BASE + "/30k_nodes.json",
        "40k nodes": DEFAULT_GRAPH_BASE + "/40k_nodes.json",
        "50k nodes": DEFAULT_GRAPH_BASE + "/50k_nodes.json"
    }
    
    let algorithmOptions: Record<string, string> = {
        "Tutte": "Tutte Barycenter",
        "SpringEmbedders": "Spring Embedders",
        "SpringEmbeddersTrans": "Spring Embedders Transferrable",
        "SpringEmbeddersGPU": "Spring Embedders GPU",
        "BarnesHut": "Barnes Hut"
    }
    let selectedAlgorithm: string = "SpringEmbeddersGPU"
    $: ctrl?.onAlgorithmChanged(selectedAlgorithm)
        
    let stats:Stats = {
        algoTime: 0,
        renderTime: 0,
        totalTime: 0
    }

    let algorithmProperties: AlgorithmProperties = {
        speed: 1,
        springRestLength: 100,
        springDampening: 0.1,
        charge: 100,
        theta: 0.5
    }
    $: if (ctrl) ctrl.algorithmProperties = algorithmProperties

    let w:number, h:number
    $: ctrl?.onWindowSizeChange(w, h)

    // --- Side menu ---
    let errorMsg: string|undefined = undefined
    let sideMenuVisible: boolean = true

    onMount(() => {
        ctrl = new GraphController(canvasElement, w, h);

        ctrl.onStatsChange = (newStats:Stats) => {
            stats = newStats
        }

        if (!ctrl.compatibility.webGL2) {
            errorMsg = "Your browser does not support WebGL2. GPU based algorithms and rendering will not be available"
        } else {
            // webgl2 enabled, select batch renderer
            if (!ctrl.compatibility.colorBufferFloatExtension) {
                errorMsg = `Your browser does not support floating point buffers.
                            GPU based algorithm will not be available`
                delete algorithmOptions["SpringEmbeddersGPU"];
                selectedAlgorithm = "SpringEmbedders";
            }
        }
        
        sideMenuVisible = true
    })

    function closeNav() {
        sideMenuVisible = false
    }

    function selectGraph (event: any) {
        ctrl?.onPredefinedGraphSelectChange(event.target?.value)
    }
</script>

<div class="canvasParent" bind:clientWidth={w} bind:clientHeight={h}>
    <canvas bind:this={canvasElement} on:click={() => closeNav()} width={w} height={h}></canvas>
</div>

{#if sideMenuVisible}
<div class="sidenav">
    <div class="sidenavContent">
        <button on:click={() => closeNav()}>&times;</button>
        
        <section>
            <h3>Choose a graph</h3>
            <!-- Triggers error -->
            <!-- <h4>Load graph</h4>
            <input
                type="file"
                value="Choose a graph"
                on:change={(event) => ctrl?.onFileSelect(event)}
                />
             -->
            <h4>Predefined graphs</h4>
            <select on:change={selectGraph}>
                <option value="" selected disabled>
                    Choose a predefined graph
                </option>

                {#each Object.entries(defaultGraphs) as [name, value]}
                <option value={value}>{name}</option>
                {/each}
            </select>
        </section>
        
        <section>
            <h3>Algorithm</h3>
            <select bind:value={selectedAlgorithm}>
                {#each Object.entries(algorithmOptions) as [name, value]}
                <option value={name}>{value}</option>
                {/each}
            </select>
        
            <h4>Algorithm Settings</h4>
            
            <span>Speed:</span>
            <br />
            <input
            type="range"
            min="1"
            max="1000"
            bind:value={algorithmProperties.speed}
            />
            <span>{Math.round((algorithmProperties.speed + Number.EPSILON) * 100) / 100}%</span>
            
            {#if selectedAlgorithm === "SpringEmbeddersGPU" || selectedAlgorithm === "SpringEmbedders"}
            <div style="margin-top: 15px">
                <span>Spring Rest Length: </span>
                <input
                    class="controllerInput"
                    type="number"
                    bind:value={algorithmProperties.springRestLength}
                    />
                <br />
                <span>Spring Dampening: </span>
                <input
                    class="controllerInput"
                    type="number"
                    bind:value={algorithmProperties.springDampening}
                    step="0.01"
                    />
                <br />
                <span>Charge: </span>
                <input
                    class="controllerInput"
                    type="number"
                    bind:value={algorithmProperties.charge}
                    />
                <br />
            </div>
            {:else if selectedAlgorithm === "BarnesHut"}
            <input
                type="number"
                class="controllerInput"
                bind:value={algorithmProperties.theta}
                />
            {/if}

            <!-- {#if selectedAlgorithm === "SpringEmbeddersGPU" || selectedAlgorithm === "SpringEmbedders" || selectedAlgorithm === "BarnesHut"}
            <input
            type="button"
            value="Apply"
            on:click={() => ctrl?.setalgorithmProperties(algorithmProperties)}
            />
            {/if} -->
        </section>
                
        <section>
            <h3>Stats</h3>
            <p>Algorithm time: {stats.algoTime.toFixed(3)} ms</p>
            <p>Render time: {stats.renderTime.toFixed(3)} ms</p>
            <p>Total time: {stats.totalTime.toFixed(3)} ms</p>
            <!-- calc fps from totalTime in ms -->
            <p>FPS: {(1000 / stats.totalTime).toFixed(3)}</p>
        </section>
    </div>
</div>
{:else}
<div class="optionsbtn" on:click={() => sideMenuVisible = true}>&#9776;</div>
{/if}
    
{#if errorMsg}
<div class="errorDialog">
    <h1>Ops!</h1>
    <p>{errorMsg}</p>
    <button class="closebtn" on:click={() => errorMsg = undefined}>&times;</button>
</div>
{/if}

<style>
    .canvasParent { position:fixed; top:0; left:0; height:100%; width:100% }
    
    .controllerInput {
        width: 3em;
    }
    
    .optionsbtn {
        position: fixed;
        top: 5px;
        left: 5px;
        cursor: pointer;
        font-size: 15px;
    }
    
    input.optionText {
        width: 3em;
    }
    
    .errorDialog {
        color: white;
        background-color: darkslategrey;
        text-align: center;
        width: 25%;
        /* opacity: 0; */
        overflow-y: hidden;
        transition: 0.5s;
        top: -100%;
        left: 50%;
        position: fixed;
        border: 2px solid darkgray;
        transform: translate(-50%, 0);
        border-radius: 5px;
    }
    
    .errorDialog h1 {
        color: coral;
        font-size: 24px;
    }
    
    .errorDialog a {
        color: white;
        font-size: 24px;
        text-decoration: none;
    }
    
    
    .sidenav {
        color: white;
        height: 100%;
        position: fixed;
        z-index: 1;
        top: 0;
        left: 0;
        background-color: #121f1f;
        overflow-x: hidden;
        transition: 0.5s;
    }
    
    .sidenavContent {
        margin-left: 5px;
    }
    
    .sidenav select {
        width: 80%;
    }
    
    .sidenav section {
        margin-bottom: 0.5em;
        padding-bottom: 0.75em;
        border-bottom-color: rgba(240, 255, 240, 0.4);
        border-bottom-width: 0.05em;
        border-bottom-style: solid;
    }
    
    .sidenav section h3 {
        margin-top: 0.5em;
    }
    
    .sidenav section h4 {
        margin-bottom: 0.25em;
    }
    
    .sidenav a {
        padding: 8px 8px 8px 32px;
        text-decoration: none;
        font-size: 25px;
        color: #818181;
        display: block;
    }
    
    .sidenav a:hover {
        color: #f1f1f1;
    }
    
    .sidenav .closebtn {
        position: absolute;
        top: 0;
        right: 25px;
        font-size: 36px;
        margin-left: 50px;
    }
    
    @media screen and (max-height: 450px) {
        .sidenav {padding-top: 15px;}
        .sidenav a {font-size: 18px;}
    }
</style>
