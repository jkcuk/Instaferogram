
// This code is based on three.js, which comes with the following license:
//
// The MIT License
//
// Copyright © 2010-2024 three.js authors
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// import { int } from 'three/examples/jsm/nodes/Nodes.js';

let name = 'Instaferogram';

let scene;
let renderer;
let camera;
let sourcePositions, sourceAmplitudes;
let noOfSources = 100;
let m = 1;
let d = 1;	// diameter of ring of sources / length of line
let interferenceMaterial, xPlane, yPlane, zPlane, sphere;

let fieldType = 0;	// 0 = line of point sources, 1 = ring of point sources
let lastOmegaTTime = Date.now();
let omega = 1;
	
let fovS = 68;

// GUI stuff

// the status text area
let status = document.createElement('div');
let statusTime;	// the time the last status was posted

// the info text area
let info = document.createElement('div');

// orbitControls
let controls;

// menu
let gui;

let storedPhoto;
let storedPhotoDescription;
let storedPhotoInfoString;
let showingStoredPhoto = false;

// my Canon EOS450D camera
const click = new Audio('./click.m4a');

init();
animate();

function init() {
	// create the info element first so that any problems can be communicated
	createStatus();

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 'skyblue' );
	let windowAspectRatio = window.innerWidth / window.innerHeight;
	camera = new THREE.PerspectiveCamera( fovS, windowAspectRatio, 0.0001, 50 );
	camera.position.z = 20;
	screenChanged();
	
	renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
	// renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );
	// document.getElementById('livePhoto').appendChild( renderer.domElement );

	createInterferenceMaterial();
	addPlanes();
	addLookalikeSphere();

	// user interface

	addEventListenersEtc();

	// add orbit controls to outside camera
	addOrbitControls();	// add to outside camera

	// the controls menu
	recreateGUI();

	createInfo();
	refreshInfo();
}

function animate() {
	requestAnimationFrame( animate );

	if(!showingStoredPhoto) {
		setUniforms();
		renderer.render( scene,  camera );
	}
}

function setUniforms() {
	interferenceMaterial.uniforms.omegaT.value += omega*0.001*(Date.now()-lastOmegaTTime);
	lastOmegaTTime = Date.now();
	// postStatus(`omegaT = ${shaderMaterial.uniforms.omegaT.value}`);
}

function createSources() {
	// create an array of sources
	sourcePositions = [];
	sourceAmplitudes = [];	// (complex) amplitudes

	// fill in the elements of all three arrays
	// noOfSources = 100;	// no of elements
	let i=0;
	for(; i<noOfSources; i++) {
		let phi = 2.0*Math.PI*i/noOfSources;	// azimuthal angle
		switch( fieldType ) {
			case 0:	// line
				sourcePositions.push(new THREE.Vector3(d*(noOfSources == 0?0:(i/(noOfSources-1)-0.5)), 0, 0));
				sourceAmplitudes.push(new THREE.Vector2(Math.cos(m*phi), Math.sin(m*phi)));
				break;			
			case 1:	// ring
			default:
				sourcePositions.push(new THREE.Vector3(d*Math.cos(phi), d*Math.sin(phi), 0));
				sourceAmplitudes.push(new THREE.Vector2(Math.cos(m*phi), Math.sin(m*phi)));
		}
	}
	for(; i<100; i++) {
		sourcePositions.push(new THREE.Vector3(0, 0, 0));
		sourceAmplitudes.push(new THREE.Vector2(1, 0));
	}

	if(interferenceMaterial) {
		interferenceMaterial.uniforms.sourcePositions.value = sourcePositions;
		interferenceMaterial.uniforms.sourceAmplitudes.value = sourceAmplitudes;
		interferenceMaterial.uniforms.noOfSources.value = noOfSources;
	}
}

function createInterferenceMaterial() {
	createSources();

	interferenceMaterial = new THREE.ShaderMaterial({
		side: THREE.DoubleSide,
		uniforms: { 
			sourcePositions: { value: sourcePositions },
			sourceAmplitudes: { value: sourceAmplitudes },
			noOfSources: { value: noOfSources },
			maxAmplitude: { value: .5*noOfSources },
			maxIntensity: { value: .25*noOfSources*noOfSources },
			k: { value: 2*Math.PI },
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

			uniform vec3 sourcePositions[100];
			uniform vec2 sourceAmplitudes[100];
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
						gl_FragColor = vec4(brightnessFactor*amplitude.x/maxAmplitude, 0, 0, 1);
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
}

// see https://github.com/mrdoob/three.js/blob/master/examples/webgl_animation_skinning_additive_blending.html
function recreateGUI() {
	if(gui) gui.destroy();
	gui = new GUI();
	// gui.hide();

	const params = {
		'&omega;': omega,
		'&lambda;': 2*Math.PI/interferenceMaterial.uniforms.k.value,
		'Sources arrangement': getFieldTypeString(),
		'No of sources': noOfSources,
		'<i>m</i>': m,
		'<i>d</i>': d,
		'Plot type': getPlotTypeString(),
		'Exposure compensation': getBaseLog(2, interferenceMaterial.uniforms.brightnessFactor.value),
		'Show <i>x</i> plane': xPlane.visible,
		'Show <i>y</i> plane': yPlane.visible,
		'Show <i>z</i> plane': zPlane.visible,
		'Show sphere': sphere.visible,
		'<i>x</i> =': 0,
		'<i>y</i> =': 0,
		'<i>z</i> =': 0,
		'<i>r</i> =': 1,
		'Field of view (&deg;)': fovS,
		'Point forward (in -<b>z</b> direction)': pointForward,
		'Point backward (in +<b>z</b> direction)': pointBackward
	}

	const folderPhysics = gui.addFolder( 'Physics' );
	folderPhysics.add( params, '&omega;', -20, 20, 0.1 ).onChange( (o) => {omega = o;} );
	folderPhysics.add( params, '&lambda;', 0.01, 2, 0.01 ).onChange( (l) => {interferenceMaterial.uniforms.k.value = 2*Math.PI/l;} );
	folderPhysics.add( params, 'Sources arrangement', { 'Line': 0, 'Ring': 1 } ).onChange( (t) => { fieldType = t; createSources(); recreateGUI(); });
	folderPhysics.add( params, '<i>m</i>', -10, 10, 1).onChange( (i) => { m = i; createSources(); } );
	folderPhysics.add( params, '<i>d</i>', 0, 20, 0.01).onChange( (f) => { d = f; createSources(); } );
	folderPhysics.add( params, 'No of sources', 1, 100, 1).onChange( (n) => { noOfSources = n; createSources(); } );
	// change menu according to field type
	// switch(fieldType) {
	// 	case 0:
	// 		gui.addFolder( '0' );
	// 		break;
	// 	case 1:
	// 		gui.addFolder( '1' );
	// }
	const folderPlot = gui.addFolder( 'Plot' );
	folderPlot.add( params, 'Plot type', { 'Intensity': 0, 'Phase & intensity': 1, 'Phase': 2, 'Re(amplitude)': 3 } ).onChange( (t) => { interferenceMaterial.uniforms.plotType.value = t; });
	folderPlot.add( params, 'Exposure compensation', -1, 10, 1/3).onChange( (b) => {interferenceMaterial.uniforms.brightnessFactor.value = Math.pow(2, b);} );
	folderPlot.add( params, 'Show <i>x</i> plane' ).onChange( (s) => {xPlane.visible = s;} );
	folderPlot.add( params, '<i>x</i> =', -5, 5, 0.01 ).onChange( (x) => { xPlane.position.set(x, 0, 0); } );
	folderPlot.add( params, 'Show <i>y</i> plane' ).onChange( (s) => {yPlane.visible = s;} );
	folderPlot.add( params, '<i>y</i> =', -5, 5, 0.01 ).onChange( (y) => { yPlane.position.set(0, y, 0); } );
	folderPlot.add( params, 'Show <i>z</i> plane' ).onChange( (s) => {zPlane.visible = s;} );
	folderPlot.add( params, '<i>z</i> =', -5, 5, 0.01 ).onChange( (z) => { zPlane.position.set(0, 0, z); } );
	folderPlot.add( params, 'Show sphere' ).onChange( (s) => { sphere.visible = s; } );
	folderPlot.add( params, '<i>r</i> =', 0, 5, 0.01 ).onChange( (r) => { sphere.scale.setScalar(r); } );

	const folderCamera = gui.addFolder( 'Virtual camera' );
	folderCamera.add( params, 'Point forward (in -<b>z</b> direction)');
	folderCamera.add( params, 'Point backward (in +<b>z</b> direction)');
	folderCamera.add( params, 'Field of view (&deg;)', 10, 170, 1).onChange( setScreenFOV );   
	folderCamera.close();
}

function getPlotTypeString() {
	switch(interferenceMaterial.uniforms.plotType.value) {
		case 0: return 'Intensity';
		case 1: return 'Phase & intensity';
		case 2: return 'Phase';
		case 3: return 'Re(amplitude)';
	}
}

function getFieldTypeString() {
	switch(fieldType) {
		case 0: return 'Line';
		case 1: return 'Ring';
	}
}

function getBaseLog(x, y) {
	return Math.log(y) / Math.log(x);
}

function addPlanes() {
	let geometry;

	// Define indices to form triangles
	const indices = [
		0, 1, 2,  // Triangle 1
		0, 2, 3   // Triangle 2
	];
	
	// xPlane
	let xPlaneX = 0;
	let vertices = [
		xPlaneX, -5,  5,  // Top left
		xPlaneX, -5, -5,  // Bottom left
		xPlaneX,  5, -5,  // Bottom right
		xPlaneX,  5,  5,  // Top right
	];
	geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
	geometry.setIndex(indices);
	xPlane = new THREE.Mesh( geometry, interferenceMaterial );
	scene.add( xPlane );

	// yPlane
	let yPlaneY = 0;
	vertices = [
		-5, yPlaneY,  5,  // Top left
		-5, yPlaneY, -5,  // Bottom left
		 5, yPlaneY, -5,  // Bottom right
		 5, yPlaneY,  5,  // Top right
	];
	geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
	geometry.setIndex(indices);
	yPlane = new THREE.Mesh( geometry, interferenceMaterial );
	scene.add( yPlane );

	// zPlane
	let zPlaneZ = 0;
	vertices = [
		-5,  5, zPlaneZ,  // Top left
		-5, -5, zPlaneZ,  // Bottom left
		 5, -5, zPlaneZ,  // Bottom right
		 5,  5, zPlaneZ,  // Top right
	];
	geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
	geometry.setIndex(indices);
	zPlane = new THREE.Mesh( geometry, interferenceMaterial );
	scene.add( zPlane );
}

/** create lookalike sphere, textures, transformation matrix */
function addLookalikeSphere() {
	// the lookalike sphere
	let geometry = new THREE.SphereGeometry( 1, 200, 200 );
	sphere = new THREE.Mesh( geometry, interferenceMaterial );
	sphere.visible = false;
	// lookalikeSphere.matrixAutoUpdate = false;	// we will update the matrix ourselves
	scene.add( sphere );
}

function addOrbitControls() {
	// controls

	controls = new OrbitControls( camera, renderer.domElement );
	// controls = new OrbitControls( cameraOutside, renderer.domElement );
	controls.listenToKeyEvents( window ); // optional

	controls.enableDamping = false; // an animation loop is required when either damping or auto-rotation are enabled
	controls.dampingFactor = 0.05;

	controls.enablePan = true;
	controls.enableZoom = true;

	controls.maxDistance = 40;

	// controls.maxPolarAngle = Math.PI;
}

function addEventListenersEtc() {
	// handle window resize
	window.addEventListener("resize", onWindowResize, false);

	// share button functionality
	document.getElementById('takePhotoButton').addEventListener('click', takePhoto);

	// toggle fullscreen button functionality
	document.getElementById('fullscreenButton').addEventListener('click', toggleFullscreen);

	// changePositionButton
	// document.getElementById('changePositionButton').addEventListener('click', changePosition);

	// info button functionality
	document.getElementById('infoButton').addEventListener('click', toggleInfoVisibility);

	// back button functionality
	document.getElementById('backButton').addEventListener('click', showLivePhoto);
	document.getElementById('backButton').style.visibility = "hidden";

	// share button
	document.getElementById('shareButton').addEventListener('click', share);
	document.getElementById('shareButton').style.visibility = "hidden";
	if(!(navigator.share)) document.getElementById('shareButton').src="./shareButtonUnavailable.png";
	// if(!(navigator.share)) document.getElementById('shareButton').style.opacity = 0.3;

	// delete button
	document.getElementById('deleteButton').addEventListener('click', deleteStoredPhoto);
	document.getElementById('deleteButton').style.visibility = "hidden";

	// hide the thumbnail for the moment
	document.getElementById('storedPhotoThumbnail').addEventListener('click', showStoredPhoto);
	document.getElementById('storedPhotoThumbnail').style.visibility = "hidden";
	document.getElementById('storedPhoto').addEventListener('click', showLivePhoto);
	document.getElementById('storedPhoto').style.visibility = "hidden";
	showingStoredPhoto = false;
}

/**
 * @param {*} fov	The larger of the camera's horizontal and vertical FOV, in degrees
 * 
 * Set the larger FOV of the screen/window to fov.
 * 
 * Depending on the screen/window's FOV, fov is either the horizontal fov (if screen width > screen height)
 * or the vertical fov (if screen width < screen height).
 */
function setScreenFOV(fov) {
	fovS = fov;

	screenChanged();
}

/** 
 * Reset the aspect ratio and FOV of the virtual cameras.
 * 
 * Call if the window size has changed (which also happens when the screen orientation changes)
 * or if camera's FOV has changed
 */
function screenChanged() {
	// alert(`new window size ${window.innerWidth} x ${window.innerHeight}`);

	// in case the screen size has changed
	if(renderer) renderer.setSize(window.innerWidth, window.innerHeight);

	// if the screen orientation changes, width and height swap places, so the aspect ratio changes
	let windowAspectRatio = window.innerWidth / window.innerHeight;
	camera.aspect = windowAspectRatio;
	//cameraInside.aspect = windowAspectRatio;
	//cameraOutside.aspect = windowAspectRatio;

	// fovS is the screen's horizontal or vertical FOV, whichever is greater;
	// re-calculate the camera FOV, which is the *vertical* fov
	let verticalFOV;
	if(windowAspectRatio > 1.0) {
		// fovS is horizontal FOV; convert to get correct vertical FOV
		verticalFOV = 2.0*Math.atan(Math.tan(0.5*fovS*Math.PI/180.0)/windowAspectRatio)*180.0/Math.PI;
	} else {
		// fovS is already vertical FOV
		verticalFOV = fovS;
		// alert(`vertical FOV ${verticalFOV}`);
	}
	camera.fov = verticalFOV;
	//cameraOutside.fov = verticalFOV;
	//cameraInside.fov = verticalFOV;

	// make sure the camera changes take effect
	camera.updateProjectionMatrix();
	//cameraOutside.updateProjectionMatrix();
	//cameraInside.updateProjectionMatrix();
}

function onWindowResize() {
	screenChanged();
	postStatus(`window size ${window.innerWidth} &times; ${window.innerHeight}`);	// debug
}

function  pointForward() {
	let r = camera.position.length();
	camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = r;
	controls.update();
	postStatus('Pointing camera forwards, in -<b>z</b> direction');
}

function  pointBackward() {
	let r = camera.position.length();
	camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = -r;
	controls.update();
	postStatus('Pointing camera backwards, in +<b>z</b> direction');
}

async function toggleFullscreen() {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen().catch((err) => {
			postStatus(
				`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`,
			);
		});
		// allow screen orientation changes
		// screen.orientation.unlock();
	} else {
		document.exitFullscreen();
	}
}

function showStoredPhoto() {
	gui.hide();
	renderer.domElement.style.visibility = "hidden";
	document.getElementById('takePhotoButton').style.visibility = "hidden";
	// document.getElementById('changePositionButton').style.visibility = "hidden";
	document.getElementById('storedPhotoThumbnail').style.visibility = "hidden";
	document.getElementById('backButton').style.visibility = "visible";
	document.getElementById('shareButton').style.visibility = "visible";
	document.getElementById('deleteButton').style.visibility = "visible";
	document.getElementById('storedPhoto').style.visibility = "visible";
	showingStoredPhoto = true;

	postStatus('Showing stored photo, '+storedPhotoDescription);
}

function showLivePhoto() {
	gui.show();
	renderer.domElement.style.visibility = "visible";
	document.getElementById('takePhotoButton').style.visibility = "visible";
	// document.getElementById('changePositionButton').style.visibility = "visible";
	if(storedPhoto) document.getElementById('storedPhotoThumbnail').style.visibility = "visible";
	document.getElementById('backButton').style.visibility = "hidden";
	document.getElementById('shareButton').style.visibility = "hidden";
	document.getElementById('deleteButton').style.visibility = "hidden";
	document.getElementById('storedPhoto').style.visibility = "hidden";
	showingStoredPhoto = false;

	postStatus('Showing live image');
}

function deleteStoredPhoto() {
	storedPhoto = null;

	showLivePhoto();

	postStatus('Stored photo deleted; showing live image');
}

function takePhoto() {
	try {
		click.play();

		storedPhoto = renderer.domElement.toDataURL('image/png');
		storedPhotoInfoString = getInfoString();

		storedPhotoDescription = name;
		// 
		document.getElementById('storedPhoto').src=storedPhoto;
		document.getElementById('storedPhotoThumbnail').src=storedPhoto;
		document.getElementById('storedPhotoThumbnail').style.visibility = "visible";
	
		postStatus('Photo taken; click thumbnail to view and share');
	} catch (error) {
		console.error('Error:', error);
	}	
}

async function share() {
	try {
		fetch(storedPhoto)
		.then(response => response.blob())
		.then(blob => {
			const file = new File([blob], name+storedPhotoDescription+'.png', { type: blob.type });

			// Use the Web Share API to share the screenshot
			if (navigator.share) {
				navigator.share({
					title: storedPhotoDescription,
					files: [file],
				});
			} else {
				postStatus('Sharing is not supported by this browser.');
			}	
		})
		.catch(error => {
			console.error('Error:', error);
			postStatus(`Error: ${error}`);
		});
	} catch (error) {
		console.error('Error:', error);
	}
}

/** 
 * Add a text field to the bottom left corner of the screen
 */
function createStatus() {
	// see https://stackoverflow.com/questions/15248872/dynamically-create-2d-text-in-three-js
	status.style.position = 'absolute';
	status.style.backgroundColor = "rgba(0, 0, 0, 0.3)";	// semi-transparent black
	status.style.color = "White";
	status.style.fontFamily = "Arial";
	status.style.fontSize = "9pt";
	postStatus("Welcome!");
	status.style.bottom = 0 + 'px';
	status.style.left = 0 + 'px';
	status.style.zIndex = 1;
	document.body.appendChild(status);	
}

function postStatus(text) {
	status.innerHTML = '&nbsp;'+text;
	console.log('status: '+text);

	// show the text only for 3 seconds
	statusTime = new Date().getTime();
	setTimeout( () => { if(new Date().getTime() - statusTime > 2999) status.innerHTML = '&nbsp;'+name+', University of Glasgow, <a href="https://github.com/jkcuk/'+name+'">https://github.com/jkcuk/'+name+'</a>' }, 3000);
}

function getInfoString() {
	// return `Lenslet array 1 (the closer array, when seen in "forward" direction)<br>` +
	// 	`&nbsp;&nbsp;Visible `+ (raytracingSphereShaderMaterial.uniforms.visible1.value?'&check;':'&cross;')+`<br>` +
	// 	`&nbsp;&nbsp;Period = ${raytracingSphereShaderMaterial.uniforms.period1.value.toPrecision(4)}<br>` +
	// 	`&nbsp;&nbsp;Rotation angle = ${(alpha1*180.0/Math.PI).toPrecision(4)}&deg;<br>` +
	// 	`&nbsp;&nbsp;Focal length = ${raytracingSphereShaderMaterial.uniforms.lensletsF1.value.toPrecision(4)}<br>` +
	// 	`&nbsp;&nbsp;Radius = ${raytracingSphereShaderMaterial.uniforms.radius1.value.toPrecision(4)}<br>` +
	// 	`&nbsp;&nbsp;Centre of array = (${raytracingSphereShaderMaterial.uniforms.centreOfArray1.value.x.toPrecision(4)}, ${raytracingSphereShaderMaterial.uniforms.centreOfArray1.value.y.toPrecision(4)}, ${raytracingSphereShaderMaterial.uniforms.centreOfArray1.value.z.toPrecision(4)})<br>` +
	// 	`&nbsp;&nbsp;Focal length of additional lens in same plane = ${raytracingSphereShaderMaterial.uniforms.additionalF1.value.toPrecision(4)}<br>` +		
	// 	`Lenslet array 2 (the farther array, when seen in "forward" direction)<br>` +
	// 	`&nbsp;&nbsp;Visible `+ (raytracingSphereShaderMaterial.uniforms.visible2.value?'&check;':'&cross;')+`<br>` +
	// 	`&nbsp;&nbsp;Period = ${raytracingSphereShaderMaterial.uniforms.period2.value.toPrecision(4)} (&Delta;<i>p</i> = ${deltaPeriod.toPrecision(4)})<br>` +
	// 	`&nbsp;&nbsp;Rotation angle = ${(alpha2*180.0/Math.PI).toPrecision(4)}&deg;<br>` +
	// 	`&nbsp;&nbsp;Focal length = ${raytracingSphereShaderMaterial.uniforms.lensletsF2.value.toPrecision(4)}<br>` +
	// 	`&nbsp;&nbsp;Radius = ${raytracingSphereShaderMaterial.uniforms.radius2.value.toPrecision(4)}<br>` +
	// 	`&nbsp;&nbsp;Centre of array = (${raytracingSphereShaderMaterial.uniforms.centreOfArray2.value.x.toPrecision(4)}, ${raytracingSphereShaderMaterial.uniforms.centreOfArray2.value.y.toPrecision(4)}, ${raytracingSphereShaderMaterial.uniforms.centreOfArray2.value.z.toPrecision(4)}) (offset from confocal = ${offsetFromConfocal.toPrecision(4)})<br>` +
	// 	`&nbsp;&nbsp;Focal length of additional lens in same plane = ${raytracingSphereShaderMaterial.uniforms.additionalF2.value.toPrecision(4)}<br>` +		
	// 	'Lenslet type: '+(raytracingSphereShaderMaterial.uniforms.idealLenses.value?'Ideal thin lenses':'Phase holograms') + "<br>" +
	// 	`Video feeds<br>` +
	// 	`&nbsp;&nbsp;Distance from origin = ${raytracingSphereShaderMaterial.uniforms.videoDistance.value.toPrecision(4)}<br>` +	// (user-facing) camera
	// 	`&nbsp;&nbsp;Horizontal fields of view (when seen from the origin)<br>` +
	// 	`&nbsp;&nbsp;&nbsp;&nbsp;User-facing camera = ${fovVideoFeedU.toPrecision(4)}&deg;<br>` +	// (user-facing) camera
	// 	`&nbsp;&nbsp;&nbsp;&nbsp;Environment-facing camera = ${fovVideoFeedE.toPrecision(4)}&deg;<br>` +	// (environment-facing) camera
	// 	`Virtual camera<br>` +
	// 	`&nbsp;&nbsp;Position = (${camera.position.x.toPrecision(4)}, ${camera.position.y.toPrecision(4)}, ${camera.position.z.toPrecision(4)})<br>` +
	// 	`&nbsp;&nbsp;Horiz. FOV = ${fovScreen.toPrecision(4)}<br>` +
	// 	`&nbsp;&nbsp;Aperture radius = ${apertureRadius.toPrecision(4)}<br>` +
	// 	`&nbsp;&nbsp;Focussing distance = ${focusDistance.toPrecision(4)}<br>` +
	// 	`&nbsp;&nbsp;Number of rays = ${noOfRays}`
	// 	// `apertureXHat = (${raytracingSphereShaderMaterial.uniforms.apertureXHat.value.x.toPrecision(4)}, ${raytracingSphereShaderMaterial.uniforms.apertureXHat.value.y.toPrecision(4)}, ${raytracingSphereShaderMaterial.uniforms.apertureXHat.value.z.toPrecision(4)})<br>` +
	// 	// `apertureYHat = (${raytracingSphereShaderMaterial.uniforms.apertureYHat.value.x.toPrecision(4)}, ${raytracingSphereShaderMaterial.uniforms.apertureYHat.value.y.toPrecision(4)}, ${raytracingSphereShaderMaterial.uniforms.apertureYHat.value.z.toPrecision(4)})`
	// 	;
	// 	console.log("*");
	return 'test';
}

function refreshInfo() {
	if(showingStoredPhoto) setInfo( storedPhotoInfoString );
	else setInfo( getInfoString() );

	if(info.style.visibility == "visible") setTimeout( refreshInfo , 100);	// refresh again in a while
}

/** 
 * Add a text field to the top left corner of the screen
 */
function createInfo() {
	// see https://stackoverflow.com/questions/15248872/dynamically-create-2d-text-in-three-js
	info.style.position = 'absolute';
	info.style.backgroundColor = "rgba(0, 0, 0, 0.3)";	// semi-transparent black
	info.style.color = "White";
	info.style.fontFamily = "Arial";
	info.style.fontSize = "9pt";
	info.innerHTML = "-- nothing to show (yet) --";
	info.style.top = 60 + 'px';
	info.style.left = 0 + 'px';
	info.style.zIndex = 1;
	document.body.appendChild(info);
	info.style.visibility = "hidden";
}

function setInfo(text) {
	info.innerHTML = text;
	console.log('info: '+text);
	// // show the text only for 3 seconds
	// infoTime = new Date().getTime();
	// setTimeout( () => { if(new Date().getTime() - infoTime > 2999) info.innerHTML = `` }, 3000);
	// info.style.visibility = "visible";
}

function toggleInfoVisibility() {
	switch(info.style.visibility) {
		case "visible":
			info.style.visibility = "hidden";
			break;
		case "hidden":
		default:
			info.style.visibility = "visible";
			refreshInfo();
	}
}