
export interface AlgorithmProperties {
    speed: number,
    springRestLength: number,
    
    springDampening: number, // the lower, the more dampening. 0.05 ok
    charge: number,
    theta: number
}
export interface Stats {
    algoTime: number,
    renderTime: number,
    totalTime: number
}