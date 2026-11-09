import * as THREE from 'three';

const maxNoOfSources = 100;

class InterferenceMaterial extends THREE.ShaderMaterial {

    // parameters
	noOfSources = 2;
	sourceExtent = 1.0;	// length of line of point sources or diameter of ring of point sources
	m = 0;
    keepPowerConstant = true;

    // variables
    // sourceTypes;    // 0 = point source, 1 = line source, 2 = uniform plane wave, 3 = Hermite-Gaussian (HG) beam, 4 = Laguerre-Gaussian (LG) beam, 5 = Bessel beam
    sourcePositions;
    sourceAmplitudes; // array of {real, imaginary} parts of complex amplitudes
    // sourceDirections;   // for line source: line direction; for other beams: propagation direction
    // sourceAdditionalFloats1;	// for HG & LG beams: beam waist, w0; for Bessel beams: cone angle, theta
    // sourceAdditionalInts1;	// for Hermite-Gaussian beams: horizontal index, m; for Laguerre-Gaussian beams & Bessel beams: azimuthal index, l
    // sourceAdditionalInts2;	// for Hermite-Gaussian beams: vertical index, n; for Laguerre-Gaussian beams: radial index, p
    
    /**
     * Represents a color material.
     * @constructor
     * @param {int} noOfSources - The number of sources that interfere to create the colour
     * @param {float} m - The azimuthal index of the source array
     * @param {float} sourceZ 
     * @param {float} omegaT - The phase
     * @param {float} opacity 
     */
    constructor( 
        sourceType, // 0 = point sources, 1 = line sources
        noOfSources, fieldType, sourceExtent, m, sourceZ, opacity ) {
        super({
            side: THREE.DoubleSide,
            uniforms: { 
                // sourceTypes: { value: Array.from( 
                //     { length: maxNoOfSources },
                //     () => 0.0
                // ) },
                sourceType: { value: sourceType },
                sourcePositions: { value: Array.from( 
                    { length: maxNoOfSources },
                    () => new THREE.Vector3(0, 0, 0)
                ) },
                sourceAmplitudes: { value: Array.from( 
                    { length: maxNoOfSources },
                    () => new THREE.Vector2(0, 0)
                ) },
                noOfSources: { value: noOfSources },
                maxAmplitude: { value: .5*noOfSources },
                maxIntensity: { value: .25*noOfSources*noOfSources },
                k: { value: 2*Math.PI },	// lambda = 1
                omegaT: { value: 0.0 },
                plotType: { value: 3 },	// 0 = intensity, 1 = intensity & phase, 2 = phase, 3 = real part only
                brightnessFactor: { value: 1 },
                opacity: { value: opacity }
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

                // uniform int sourceTypes[${maxNoOfSources}];
                uniform int sourceType;
                uniform vec3 sourcePositions[${maxNoOfSources}];
                uniform vec2 sourceAmplitudes[${maxNoOfSources}];
                uniform int noOfSources;
                uniform float maxAmplitude;
                uniform float maxIntensity;
                uniform float k;
                uniform float omegaT;
                uniform int plotType;	// 0 = intensity, 1 = intensity & phase, 2 = phase, 3 = real part only
                uniform float brightnessFactor;
                uniform float opacity;

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
                
                vec2 calculateSourceAmplitude(int i) {
                    float d;
                    float kd;
                    float a;
                    switch(sourceType) {
                    case 0: // point source
                        float d = distance(v_position, sourcePositions[i]);
                        kd = k*d - omegaT;
                        a = 1./d;
                        break;
                    case 1: // line source
                        vec3 r = v_position - sourcePositions[i];
                        d = sqrt(r.x*r.x + r.z*r.z);
                        kd = k*d - omegaT;
                        a = 1./sqrt(d);
                    }
                    float c = cos(kd);
                    float s = sin(kd);
                    // add to the sum of amplitudes the amplitude due to 
                    return a*vec2(
                        sourceAmplitudes[i].x*c - sourceAmplitudes[i].y*s,	// real part = r1 r2 - i1 i2
                        sourceAmplitudes[i].x*s + sourceAmplitudes[i].y*c	// imaginary part = r1 i2 + r2 i1
                    );
                }

                void main() {
                    // this is where the sum of the amplitudes of all individual sources goes
                    vec2 amplitude = vec2(0, 0);
                    for(int i=0; i<noOfSources; i++) {
                        // add to the sum of amplitudes the amplitude due to source no. i
                        amplitude += calculateSourceAmplitude(i);
                        // amplitude += sourcePositions[i].xy;	// sourceAmplitudes[i]/d;
                    }

                    switch(plotType) {
                        case 3:	// real part
                        float a = brightnessFactor*amplitude.x/maxAmplitude;
                            gl_FragColor = vec4(a, 0, -a, opacity);
                            break;
                        case 2:	// phase only
                            // float phase = atan(amplitude.y, amplitude.x);	//  mod(atan(amplitude.y, amplitude.x) + omegaT, 2.0*pi);	// -pi .. pi
                            // float hue = 0.5 + 0.5*phase/M_PI;	// 0 .. 1
                            gl_FragColor = vec4(hsv2rgb(vec3(calculateHue(amplitude), 1.0, 1.0)), opacity);
                            break;
                        case 1:	// phase & intensity
                            // float intensity = dot(amplitude, amplitude)/maxIntensity;
                            // float phase = atan(amplitude.y, amplitude.x);	//  mod(atan(amplitude.y, amplitude.x) + omegaT, 2.0*pi);	// -pi .. pi
                            // float hue = 0.5 + 0.5*phase/M_PI;	// 0 .. 1
                            gl_FragColor = vec4(hsv2rgb(vec3(calculateHue(amplitude), 1.0, brightnessFactor*calculateIntensity(amplitude))), opacity);
                            break;
                        case 0:	// intensity only
                        default:
                            // float intensity = dot(amplitude, amplitude)/maxIntensity;
                            float intensity = brightnessFactor*calculateIntensity(amplitude);
                            gl_FragColor = vec4(intensity, intensity, intensity, opacity);
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
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.noOfSources = noOfSources;
        this.m = m;
        this.fieldType = fieldType;
        this.sourceExtent = sourceExtent;
        this.sourceZ = sourceZ;

        // console.log("interferenceMaterial::constructor: Hi!");
    }

    updateSources() {
        switch( this.fieldType ) {
            case 2: // parallel line sources
                this.uniforms.sourceType.value = 1;
                break;
            case 0:	// line of point sources
            case 1: // circle of point sources
            default:
                this.uniforms.sourceType.value = 0;
                break;
        }
        this.uniforms.sourcePositions.value  = InterferenceMaterial.createSourcePositions ( this.noOfSources, this.fieldType, this.sourceExtent, this.sourceZ );
        this.uniforms.sourceAmplitudes.value = InterferenceMaterial.createSourceAmplitudes( this.noOfSources, this.m, this.keepPowerConstant );
    }

    static createSourcePositions( noOfSources, fieldType, sourceExtent, sourceZ ) {

        console.log("createSourcePositions: noOfSources = " + noOfSources + ", fieldType = " + fieldType + ", sourceExtent = " + sourceExtent);

        // create an array of sources
        let sourcePositions = [];

        // fill in the elements of all three arrays
    	let i=0;
	    for(; i<noOfSources; i++) {
            switch( fieldType ) {
                case 0:	// line of point sources
                case 2: // parallel line sources
                    sourcePositions.push(new THREE.Vector3(sourceExtent*(noOfSources == 1?0:(i/(noOfSources-1)-0.5)), 0, sourceZ));
                    break;			
                case 1:	// ring of point sources
                default:
                    let phi = 2.0*Math.PI*i/noOfSources;	// azimuthal angle
                    sourcePositions.push(new THREE.Vector3(0.5*sourceExtent*Math.cos(phi), 0.5*sourceExtent*Math.sin(phi), sourceZ));
            }
        }
        
        for(; i<maxNoOfSources; i++) {
            sourcePositions.push(new THREE.Vector3(0, 0, sourceZ));
        }

        return sourcePositions;
    }

    static createSourceAmplitudes( noOfSources, m, keepPowerConstant ) {

        let sourceAmplitudes = [];	// (complex) amplitudes

        // fill in the elements of all three arrays
        let i=0;
        let a;
        if( keepPowerConstant ) { a = 1./noOfSources; } else { a = 1 };
        for(; i<noOfSources; i++) {
            let phi = 2.0*Math.PI*i/noOfSources;	// azimuthal angle
            sourceAmplitudes.push(new THREE.Vector2(a*Math.cos(m*phi), a*Math.sin(m*phi)));
        }
        for(; i<maxNoOfSources; i++) {
            sourceAmplitudes.push(new THREE.Vector2(0, 0));
        }

        return sourceAmplitudes;
    }

    updateOmegaT( omegaT ) {
        this.uniforms.omegaT.value = omegaT;
    }

}

export { InterferenceMaterial, maxNoOfSources };