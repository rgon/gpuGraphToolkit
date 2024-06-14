
/**
 * Shader util class. Used to create shaders.
 * 
 * Some parts of this code are taken from webgl2fundamentals.org
 */
export class Shader {
    /**
     * Creates and compiles a shader.
     * @param {string} shaderSource The GLSL source code for the shader.
     * @param {number} shaderType The type of shader, VERTEX_SHADER or
     *     FRAGMENT_SHADER.
     * @return {!WebGLShader} The shader.
     */
    _compileShader(shaderSource, shaderType) {
        // Create the shader object
        const shader = this.gl.createShader(shaderType);

        // Set the shader source code.
        this.gl.shaderSource(shader, shaderSource);

        // Compile the shader
        this.gl.compileShader(shader);

        // Check if it compiled
        const success = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
        if (!success) {
            // Something went wrong during compilation; get the error
            throw "could not compile shader:" + this.gl.getShaderInfoLog(shader);
        }

        return shader;
    }

    /**
     * Creates a program from 2 shaders.
     * @param {!WebGLShader} vertexShader A vertex shader.
     * @param {!WebGLShader} fragmentShader A fragment shader.
     * @return {!WebGLProgram} A program.
     */
    _createProgram(vertexShader, fragmentShader) {
        // create a program.
        const program = this.gl.createProgram();
        
        // attach the shaders.
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        
        // link the program.
        this.gl.linkProgram(program);
        
        // Check if it linked.
        const success = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
        if (!success) {
            // something went wrong with the link
            throw ("program filed to link:" + this.gl.getProgramInfoLog (program));
        }
        
        return program;
    };

    /**
     * Creates a new shader.
     * @param {string} vertexShaderSource the code for the vertex shader
     * @param {string} fragmentShaderCode the code for the fragment shader
     */
    constructor(gl, vertexShaderSource, fragmentShaderCode) {
        this.gl = gl;
        const vertexShader = this._compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this._compileShader(fragmentShaderCode, this.gl.FRAGMENT_SHADER);
        this._program = this._createProgram(vertexShader, fragmentShader);
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);
    }

    /**
     * Sets the value of a vec2 uniform
     * @param {string} name the name of the uniform
     * @param {Float32Array} value the value used to set the uniform
     */
    setVec2(name, value) {
        const location = this.getUniformLocationFor(name)
        this.gl.uniform2fv(location, value);
    }

    /**
     * Sets the value of a vec2 uniform given its index
     * @param {WebGLUniformLocation} index index of the uniform 
     * @param {Float32Array} value the value used to set the uniform
     */
    setVec2Index(index, value) {
        this.gl.uniform2fv(index, value);
    }

    /**
     * Sets the value of a i/uvec2 uniform
     * @param {string} name the name of the uniform
     * @param {IntArray} value the value used to set the uniform
     */
    setIntVec2(name, value) {
        const location = this.getUniformLocationFor(name);
        this.gl.uniform2iv(location, value);
    }

    /**
     * Sets the value of a float uniform
     * @param {string} name the name of the uniform 
     * @param {*} value the value used to set the uniform
     */
    setFloat(name, value) {
        const location = this.getUniformLocationFor(name);
        this.gl.uniform1f(location, value);
    }

    setFloatIndex(index, value) {
        this.gl.uniform1f(index, value);
    }

    setInt(name, value) {
        const location = this.getUniformLocationFor(name);
        this.gl.uniform1i(location, value);
    }

    setIntIndex(index, value) {
        this.gl.uniform1i(index, value);
    }

    /**
     * Sets the value of a mat3 uniform
     * @param {string} name the name of the uniform
     * @param {mat3} value the value used to set the uniform
     */
    setMat3(name, value) {
        const location = this.getUniformLocationFor(name);
        this.gl.uniformMatrix3fv(location, false, value);
    }

    /**
     * Sets the value of a mat3 uniform given its index
     * @param {number} index the location of the uniform
     * @param {mat3} value the value used to set the uniform
     */
    setMat3Index(index, value) {
        this.gl.uniformMatrix3fv(index, false, value);
    }

    /**
     * Returns the location of a uniform variable.
     * @param {string} name the name of the uniform variable
     * @returns {WebGLUniformLocation} the location of the variable
     * @throws {Error} if there is no variable with the given name
     */
    getUniformLocationFor(name) {
        const location = this.gl.getUniformLocation(this._program, name);
        if (location === null) {
            throw new Error(`No such uniform with name ${name}`);
        }

        return location;
    }

    /**
     * Sets this shader as the current one.
     */
    use() {
        this.gl.useProgram(this._program);
    }

    /**
     * This shader is no longer the current one.
     */
    stop() {
        this.gl.useProgram(null);
    }

    /**
     * Deletes this Shader.
     */
    delete() {
        this.gl.deleteProgram(this._program);
        this._program = null;
    }
}