import * as THREE from 'three';

const maxNoOfSources = 100;

class InterferenceMaterial extends THREE.ShaderMaterial {

    fieldType = 0;	// 0 = line of point sources, 1 = ring of point sources
	noOfSources = 2;
	sourceExtent = 1.1;	// diameter of ring of sources / length of line
	m = 0;
	
    /**
     * Represents a color material.
     * @constructor
     * @param {int} noOfSources - The number of sources that interfere to create the colour
     * @param {float} m - The azimuthal index of the source array
     * @param {float} omegaT - The phase
     */
    constructor( noOfSources, fieldType, sourceExtent, m ) {
        super({
            side: THREE.DoubleSide,
            uniforms: { 
                sourcePositions: { value: InterferenceMaterial.createSourcePositions( noOfSources, fieldType, sourceExtent ) },
                sourceAmplitudes: { value: InterferenceMaterial.createSourceAmplitudes( noOfSources, m ) },
                noOfSources: { value: noOfSources },
                maxAmplitude: { value: .5*noOfSources },
                maxIntensity: { value: .25*noOfSources*noOfSources },
                k: { value: 2*Math.PI },	// lambda = 1
                omegaT: { value: 0.0 },
                plotType: { value: 3 },	// 0 = intensity, 1 = intensity & phase, 2 = phase, 3 = real part only
                brightnessFactor: { value: 1 },
                // xPlaneMatrix: { value: xPlane.matrix },
            },
            // wireframe: true,
            vertexShader: `
                varying vec3 v_position;
                void main()	{
                    // projectionMatrix, modelViewMatrix, position -> passed in from Three.js
                    gl_Position = projectionMatrix
                        * modelViewMatrix
                        * vec4(position, 1.0);
                    // v_position = position;
                    v_position = (modelMatrix * vec4(position, 1.0)).xyz;	// set v_pos to the actual world position of the vertex
                    // v_position = gl_Position.xyz;
                }
            `,
            fragmentShader: `
                precision highp float;

                #define M_PI 3.1415926535897932384626433832795;

                varying vec3 v_position;

                uniform vec3 sourcePositions[${maxNoOfSources}];
                uniform vec2 sourceAmplitudes[${maxNoOfSources}];
                uniform int noOfSources;
                uniform float maxAmplitude;
                uniform float maxIntensity;
                uniform float k;
                uniform float omegaT;
                uniform int plotType;	// 0 = intensity, 1 = intensity & phase, 2 = phase, 3 = real part only
                uniform float brightnessFactor;

                // from https://gist.github.com/983/e170a24ae8eba2cd174f
                vec3 hsv2rgb(vec3 c) {
                    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                }

                float calculatePhase(vec2 amplitude) {
                    return atan(amplitude.y, amplitude.x);	//  mod(atan(amplitude.y, amplitude.x) + omegaT, 2.0*pi);	// -pi .. pi
                }

                float calculateHue(vec2 amplitude) {
                    return 0.5 + 0.5*calculatePhase(amplitude)/M_PI;	// 0 .. 1
                }

                float calculateIntensity(vec2 amplitude) {
                    return dot(amplitude, amplitude)/maxIntensity;
                }

                void main() {
                    // this is where the sum of the amplitudes of all individual sources goes
                    vec2 amplitude = vec2(0, 0);
                    for(int i=0; i<noOfSources; i++) {
                        float d = distance(v_position, sourcePositions[i]);
                        float kd = k*d - omegaT;
                        float c = cos(kd);
                        float s = sin(kd);
                        // add to the sum of amplitudes the amplitude due to 
                        amplitude += vec2(
                            sourceAmplitudes[i].x*c - sourceAmplitudes[i].y*s,	// real part = r1 r2 - i1 i2
                            sourceAmplitudes[i].x*s + sourceAmplitudes[i].y*c	// imaginary part = r1 i2 + r2 i1
                        )/d;
                        // amplitude += sourcePositions[i].xy;	// sourceAmplitudes[i]/d;
                    }

                    switch(plotType) {
                        case 3:	// real part
                        float a = brightnessFactor*amplitude.x/maxAmplitude;
                            gl_FragColor = vec4(a, 0, -a, 1);
                            break;
                        case 2:	// phase only
                            // float phase = atan(amplitude.y, amplitude.x);	//  mod(atan(amplitude.y, amplitude.x) + omegaT, 2.0*pi);	// -pi .. pi
                            // float hue = 0.5 + 0.5*phase/M_PI;	// 0 .. 1
                            gl_FragColor = vec4(hsv2rgb(vec3(calculateHue(amplitude), 1.0, 1.0)), 1.0);
                            break;
                        case 1:	// phase & intensity
                            // float intensity = dot(amplitude, amplitude)/maxIntensity;
                            // float phase = atan(amplitude.y, amplitude.x);	//  mod(atan(amplitude.y, amplitude.x) + omegaT, 2.0*pi);	// -pi .. pi
                            // float hue = 0.5 + 0.5*phase/M_PI;	// 0 .. 1
                            gl_FragColor = vec4(hsv2rgb(vec3(calculateHue(amplitude), 1.0, brightnessFactor*calculateIntensity(amplitude))), 1.0);
                            break;
                        case 0:	// intensity only
                        default:
                            // float intensity = dot(amplitude, amplitude)/maxIntensity;
                            float intensity = brightnessFactor*calculateIntensity(amplitude);
                            gl_FragColor = vec4(intensity, intensity, intensity, 1);
                    }
                    // amplitude.y = 0.0;
                    // gl_FragColor = vec4(abs(v_pos), 1);
                    // gl_FragColor = vec4(abs(sourcePositions[99]), 1.0);
                    // gl_FragColor = vec4(amplitude/maxAmplitude, 0.0, 1.0);
                    // float intensity = length(amplitude)/maxIntensity;
                    // float pi = 3.14159265359;
                    // float phase = atan(amplitude.y, amplitude.x);	//  mod(atan(amplitude.y, amplitude.x) + omegaT, 2.0*pi);	// -pi .. pi
                    // float hue = 0.5 + 0.5*phase/pi;	// 0 .. 1
                    // gl_FragColor = vec4(intensity, 0, 0, 1);
                    // gl_FragColor = vec4(hsv2rgb(vec3(hue, 1.0, intensity)), 1.0);
                    // gl_FragColor = vec4(amplitude.x/maxAmplitude, 0, 0, 1);
                }
            `
        });

        this.noOfSources = noOfSources;
        this.m = m;
        this.fieldType = fieldType;
        this.sourceExtent = sourceExtent;

        // console.log("interferenceMaterial::constructor: Hi!");
    }

    updateSources() {
        this.uniforms.sourcePositions.value  = InterferenceMaterial.createSourcePositions ( this.noOfSources, this.fieldType, this.sourceExtent );
        this.uniforms.sourceAmplitudes.value = InterferenceMaterial.createSourceAmplitudes( this.noOfSources, this.m );
    }

    static createSourcePositions( noOfSources, fieldType, sourceExtent ) {

        console.log("createSourcePositions: noOfSources = " + noOfSources + ", fieldType = " + fieldType + ", sourceExtent = " + sourceExtent);

        // create an array of sources
        let sourcePositions = [];

        // fill in the elements of all three arrays
    	let i=0;
	    for(; i<noOfSources; i++) {
            switch( fieldType ) {
                case 0:	// line
                    sourcePositions.push(new THREE.Vector3(sourceExtent*(noOfSources == 1?0:(i/(noOfSources-1)-0.5)), 0, 0));
                    break;			
                case 1:	// ring
                default:
                    let phi = 2.0*Math.PI*i/noOfSources;	// azimuthal angle
                    sourcePositions.push(new THREE.Vector3(0.5*sourceExtent*Math.cos(phi), 0.5*sourceExtent*Math.sin(phi), 0));
            }
        }
        
        for(; i<maxNoOfSources; i++) {
            sourcePositions.push(new THREE.Vector3(0, 0, 0));
        }

        return sourcePositions;
    }

    static createSourceAmplitudes( noOfSources, m ) {

        let sourceAmplitudes = [];	// (complex) amplitudes

        // fill in the elements of all three arrays
        let i=0;
        for(; i<noOfSources; i++) {
            let phi = 2.0*Math.PI*i/noOfSources;	// azimuthal angle
            sourceAmplitudes.push(new THREE.Vector2(Math.cos(m*phi), Math.sin(m*phi)));
        }
        for(; i<maxNoOfSources; i++) {
            sourceAmplitudes.push(new THREE.Vector2(1, 0));
        }

        return sourceAmplitudes;
    }

    updateOmegaT( omegaT ) {
        this.uniforms.omegaT.value = omegaT;
    }

}

export { InterferenceMaterial, maxNoOfSources };