
import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';	// see https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content

import { InterferenceMaterial, maxNoOfSources } from './interferenceMaterial.js';
import { JApp, render } from './JApp.js';

class Instaferogram extends JApp {
	interferenceMaterial;
	scene;
	xPlane;
	yPlane;
	zPlane;
	sphere;
	plotRange = 10;

	f = 1;	// frequency
	
    /**
	 * @constructor
	 */
	constructor(  ) {
        super( 'Instaferogram', 'the premier interactive tool ...' );

		this.interferenceMaterial = 
			new InterferenceMaterial(2, 0, 2, 0);

        this.createRendererEtc();

        this.addGUI();
    }

	createRendererEtc() {
		// create scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 'skyblue' );

		// create camera
		this.camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 0.0001, 100 );
		this.camera.position.z = 20;
		
		this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.xr.enabled = true;	// see https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content
		document.body.appendChild( VRButton.createButton( this.renderer ) );	// see https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content
		document.body.appendChild( this.renderer.domElement );
		
		// this.interferenceMaterial = ;
		this.addPlanes();
		this.addSphere();

		this.addOrbitControls();
    	// this.controls = new OrbitControls( this.camera, this.renderer.domElement );
	}

	addPlanes() {
		let geometry;
	
		// Define indices to form triangles
		const indices = [
			0, 1, 2,  // Triangle 1
			0, 2, 3   // Triangle 2
		];
		
		// xPlane
		let vertices = [
			0, -.5,  .5,  // Top left
			0, -.5, -.5,  // Bottom left
			0,  .5, -.5,  // Bottom right
			0,  .5,  .5,  // Top right
		];
		geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setIndex(indices);
		this.xPlane = new THREE.Mesh( geometry, this.interferenceMaterial );
		this.xPlane.scale.set(this.plotRange, this.plotRange, this.plotRange);
		this.scene.add( this.xPlane );
	
		// yPlane
		vertices = [
			-.5, 0,  .5,  // Top left
			-.5, 0, -.5,  // Bottom left
			 .5, 0, -.5,  // Bottom right
			 .5, 0,  .5,  // Top right
		];
		geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setIndex(indices);
		this.yPlane = new THREE.Mesh( geometry, this.interferenceMaterial );
		this.yPlane.scale.set(this.plotRange, this.plotRange, this.plotRange);
		this.scene.add( this.yPlane );
	
		// zPlane
		vertices = [
			-.5,  .5, 0,  // Top left
			-.5, -.5, 0,  // Bottom left
			 .5, -.5, 0,  // Bottom right
			 .5,  .5, 0,  // Top right
		];
		geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setIndex(indices);
		this.zPlane = new THREE.Mesh( geometry, this.interferenceMaterial );
		this.zPlane.scale.set(this.plotRange, this.plotRange, this.plotRange);
		this.scene.add( this.zPlane );
	}
	
	/** create sphere, textures, transformation matrix */
	addSphere() {
		// the lookalike sphere
		let geometry = new THREE.SphereGeometry( 1, 200, 200 );
		this.sphere = new THREE.Mesh( geometry, this.interferenceMaterial );
		this.sphere.visible = false;
		// lookalikeSphere.matrixAutoUpdate = false;	// we will update the matrix ourselves
		this.scene.add( this.sphere );
	}

	addOrbitControls() {
		// controls
	
		this.controls = new OrbitControls( this.camera, this.renderer.domElement );
		// controls = new OrbitControls( cameraOutside, renderer.domElement );
		this.controls.listenToKeyEvents( window ); // optional
	
		this.controls.enableDamping = false; // an animation loop is required when either damping or auto-rotation are enabled
		this.controls.dampingFactor = 0.05;
	
		this.controls.enablePan = true;
		this.controls.enableZoom = true;
	
		this.controls.maxDistance = 50;
	
		// controls.maxPolarAngle = Math.PI;
	}
	

	clock = new THREE.Clock();

    render() {
		this.interferenceMaterial.uniforms.omegaT.value += 2*Math.PI*this.f*this.clock.getDelta();

		// console.log("this.scene="+this.scene+", this.camera="+this.camera);
		if(this.renderer) this.renderer.render( this.scene,  this.camera );
	}

	// gui

	getPlotTypeString() {
		switch( this.interferenceMaterial.uniforms.plotType.value ) {
			case 0: return 'Intensity';
			case 1: return 'Phase & intensity';
			case 2: return 'Phase';
			case 3: return 'Re(amplitude)';
		}
	}

	getFieldTypeString() {
		switch( this.fieldType ) {
			case 0: return 'Line';
			case 1: return 'Circle';
		}
	}

	static getBaseLog(x, y) {
		return Math.log(y) / Math.log(x);
	}


	guiVariables;

    addGUI() {
		this.guiVariables = {
			f: this.f,
			lambda: 2*Math.PI/this.interferenceMaterial.uniforms.k.value,
			fieldType: this.interferenceMaterial.fieldType,
			noOfSources: this.interferenceMaterial.noOfSources,
			m: this.interferenceMaterial.m,
			sourceExtent: this.interferenceMaterial.sourceExtent,
			plotType: this.interferenceMaterial.uniforms.plotType.value,
			brightness: Instaferogram.getBaseLog(2, this.interferenceMaterial.uniforms.brightnessFactor.value), // exposure compensation
			showXPlane: this.xPlane.visible,
			showYPlane: this.yPlane.visible,
			showZPlane: this.zPlane.visible,
			showSphere: this.sphere.visible,
			x: this.xPlane.position.x,
			y: this.yPlane.position.y,
			z: this.zPlane.position.z,
			r: this.sphere.scale.x,
			plotRange: 10,
			defaultCameraDirection: () => {
				let r = this.camera.position.length();
				this.camera.position.x = 0;
				this.camera.position.y = 0;
				this.camera.position.z = r;
				this.controls.update();
				this.postStatus('Pointing camera forwards, in -<b>z</b> direction');
			},
			// 'Point backward (in +<b>z</b> direction)': pointBackward
			fov: this.camera.fov,
		};

		if( this.gui) this.gui.destroy();
		this.gui = new GUI();
		// gui.hide();

		let fieldTypeString = ( this.fieldType == 0?`Length of line`:`Diameter of circle`);

		const folderPhysics = this.gui.addFolder( 'Physics' );

		folderPhysics.add( this.guiVariables, 'f', -10, 10, 0.1 )
			.name('Frequency <i>f</i>')
			.onChange( (f) => { this.f = f; } );

		folderPhysics.add( this.guiVariables, 'lambda', 0.01, 2, 0.01 )
			.name('Wavelength &lambda;')
			.onChange( (lambda) => { 
				this.interferenceMaterial.uniforms.k.value = 2*Math.PI/lambda; 
			} );

		folderPhysics.add( this.guiVariables, 'fieldType', { 'Line': 0, 'Circle': 1 } )
			.name('Field type')
			.onChange( (a) => { 
				this.interferenceMaterial.fieldType = a; 
				this.interferenceMaterial.updateSources();
				// recreateGUI(); 
			} );
		
		folderPhysics.add( this.guiVariables, 'm', -10, 10, 1)
			.name('Topolog. charge <i>m</i>')
			.onChange( (m) => { 
				this.interferenceMaterial.m = m; 
				this.interferenceMaterial.updateSources();
			} );
		
		folderPhysics.add( this.guiVariables, 'sourceExtent', 0, 20)
			.name('source extent')
			.onChange( (d) => { 
				this.interferenceMaterial.sourceExtent = d;
				this.interferenceMaterial.updateSources();
			} );
		
		folderPhysics.add( this.guiVariables, 'noOfSources', 1, maxNoOfSources, 1)
			.name('No of sources')
			.onChange( (noOfSources) => { 
				this.interferenceMaterial.noOfSources = noOfSources;
				this.interferenceMaterial.uniforms.noOfSources.value = noOfSources;
				this.interferenceMaterial.updateSources();
			} );
		
		// change menu according to field type
		// switch(fieldType) {
		// 	case 0:
		// 		gui.addFolder( '0' );
		// 		break;
		// 	case 1:
		// 		gui.addFolder( '1' );
		// }
		
		const folderPlot = this.gui.addFolder( 'Plot' );
		folderPlot.add( this.guiVariables, 'plotType', { 'Intensity': 0, 'Phase & intensity': 1, 'Phase': 2, 'Re(amplitude)': 3 } )
			.name('Plot type')
			.onChange( (t) => { this.interferenceMaterial.uniforms.plotType.value = t; } );

		folderPlot.add( this.guiVariables, 'brightness', -5, 10, 1/3)
			.name('Brightness')
			.onChange( (b) => {
				this.interferenceMaterial.uniforms.brightnessFactor.value = Math.pow(2, b);
			} );

		folderPlot.add( this.guiVariables, 'showXPlane' )
			.name('Show <i>x</i> plane')
			.onChange( (s) => { 
				this.xPlane.visible = s;
			} );
		
		folderPlot.add( this.guiVariables, 'x', -5, 5, 0.01 )
			.name('<i>x</i> =')
			.onChange( (x) => {
				this.xPlane.position.set(x, 0, 0);
			} );
		
		folderPlot.add( this.guiVariables, 'showYPlane' )
			.name('Show <i>y</i> plane')
			.onChange( (s) => {
				this.yPlane.visible = s;
			} );
		
		folderPlot.add( this.guiVariables, 'y', -5, 5, 0.01 )
			.name('<i>y</i> =')
			.onChange( (y) => {
				this.yPlane.position.set(0, y, 0);
			} );
		
		folderPlot.add( this.guiVariables, 'showZPlane' )
			.name('Show <i>z</i> plane')
			.onChange( (s) => {
				this.zPlane.visible = s;
			} );

		folderPlot.add( this.guiVariables, 'z', -5, 5, 0.01 )
			.name('<i>z</i> =')
			.onChange( (z) => {
				this.zPlane.position.set(0, 0, z);
			} );

		folderPlot.add( this.guiVariables, 'showSphere' )
			.name('Show sphere')
			.onChange( (s) => {
				this.sphere.visible = s;
			} );

		folderPlot.add( this.guiVariables, 'r', 0, 5, 0.01 )
			.name('<i>r</i> =')
			.onChange( (r) => {
				this.sphere.scale.setScalar(r);
			} );	

		folderPlot.add( this.guiVariables, 'plotRange', 0, 1000, 1)
			.name('Square sidelength')
			.onChange( (plotRange) => {
				this.plotRange = plotRange;
				this.xPlane.scale.set(plotRange, plotRange, plotRange);
				this.yPlane.scale.set(plotRange, plotRange, plotRange);
				this.zPlane.scale.set(plotRange, plotRange, plotRange);
			} );

		// folderPlot.add( this.guiVariables, '<i>x</i> =', -5, 5, 0.01 ).onChange( (x) => { xPlane.position.set(x, 0, 0); } );
		// folderPlot.add( this.guiVariables, 'Show <i>y</i> plane' ).onChange( (s) => {yPlane.visible = s;} );
		// folderPlot.add( this.guiVariables, '<i>y</i> =', -5, 5, 0.01 ).onChange( (y) => { yPlane.position.set(0, y, 0); } );
		// folderPlot.add( this.guiVariables, 'Show <i>z</i> plane' ).onChange( (s) => {zPlane.visible = s;} );
		// folderPlot.add( this.guiVariables, '<i>z</i> =', -5, 5, 0.01 ).onChange( (z) => { zPlane.position.set(0, 0, z); } );
		// folderPlot.add( this.guiVariables, 'Show sphere' ).onChange( (s) => { sphere.visible = s; } );
		// folderPlot.add( this.guiVariables, '<i>r</i> =', 0, 5, 0.01 ).onChange( (r) => { sphere.scale.setScalar(r); } );

		const folderCamera = this.gui.addFolder( 'Virtual camera' );
		folderCamera.add( this.guiVariables, 'defaultCameraDirection' )
			.name('Default camera direction');
		// folderCamera.add( this.guiVariables, 'Point backward (in +<b>z</b> direction)');
		folderCamera.add( this.guiVariables, 'fov', 1, 170, 1)
			.name('Field of view (&deg;)')
			.onChange( (fov) => {
				this.camera.fov = fov;
				this.camera.updateProjectionMatrix();
			} );   
		folderCamera.close();
	}

	getInfoString() {
		if(!this.interferenceMaterial) return "";
		return `Frequency <i>f</i> = ${ this.f.toPrecision(4) } Hz<br>`+
		`Wavelength &lambda; = ${(2*Math.PI/this.interferenceMaterial.uniforms.k.value).toPrecision(4)}<br>` +
		'Sources arrangement = '+ this.getFieldTypeString() + '<br>' +
		`No of sources = ${this.interferenceMaterial.noOfSources}<br>` +
		`Topological charge <i>m</i> = ${this.interferenceMaterial.m}<br>` +
		(this.fieldType == 0?`Length of line`:`Radius of circle`) + ` <i>d</i> = ${this.interferenceMaterial.sourceExtent.toPrecision(4)}<br>` +
		`Plot type = ` + this.getPlotTypeString() + '<br>' +
		`Exposure compensation = ${Instaferogram.getBaseLog(2, this.interferenceMaterial.uniforms.brightnessFactor.value).toPrecision(4)}<br>` +
		(this.xPlane.visible?'Show':'Hide')+` plane <i>x</i> = ${this.xPlane.position.x.toPrecision(4)}<br>` +
		(this.yPlane.visible?'Show':'Hide')+` plane <i>y</i> = ${this.yPlane.position.y.toPrecision(4)}<br>` +
		(this.zPlane.visible?'Show':'Hide')+` plane <i>z</i> = ${this.zPlane.position.z.toPrecision(4)}<br>` +
		`square sidelength = ${this.plotRange}<br>` +
		(this.sphere.visible?'Show':'Hide')+` sphere <i>r</i> = ${this.sphere.scale.x.toPrecision(4)}<br>` +
		`Virtual camera<br>` +
		`&nbsp;&nbsp;Position = (${this.camera.position.x.toPrecision(4)}, ${this.camera.position.y.toPrecision(4)}, ${this.camera.position.z.toPrecision(4)})<br>` +
		`&nbsp;&nbsp;Horiz. FOV = ${this.camera.fov.toPrecision(4)}&deg;<br>` 
		// 	// `Frequency <i>f</i> = ${ this.f.toPrecision(4) } Hz<br>`+
		// 	`Wavelength &lambda; = ${(2*Math.PI/this.interferenceMaterial.uniforms.k.value).toPrecision(4)}<br>` + 
		// 	'Sources arrangement = '+ getFieldTypeString() + '<br>' +
		// 	`No of sources = ${noOfSources}<br>` +
		// 	`Topological charge <i>m</i> = ${m}<br>` +
		// 	(fieldType == 0?`Length of line`:`Radius of circle`) + ` <i>d</i> = ${d.toPrecision(4)}<br>` +
		// 	`Plot type = ` + getPlotTypeString() + '<br>' +
		// 	`Exposure compensation = ${getBaseLog(2, interferenceMaterial.uniforms.brightnessFactor.value).toPrecision(4)}<br>` +
		// // `Show <i>x</i> plane': xPlane.visible,
		// // `Show <i>y</i> plane': yPlane.visible,
		// // `Show <i>z</i> plane': zPlane.visible,
		// // `Show sphere': sphere.visible,
		// 	(xPlane.visible?'Show':'Hide')+` plane <i>x</i> = ${xPlane.position.x.toPrecision(4)}<br>` +
		// 	(yPlane.visible?'Show':'Hide')+` plane <i>y</i> = ${yPlane.position.y.toPrecision(4)}<br>` +
		// 	(zPlane.visible?'Show':'Hide')+` plane <i>z</i> = ${zPlane.position.z.toPrecision(4)}<br>` +
		// 	(sphere.visible?'Show':'Hide')+` sphere <i>r</i> = ${sphere.scale.x.toPrecision(4)}<br>` +
		// 	`Virtual camera<br>` +
		// 	`&nbsp;&nbsp;Position = (${camera.position.x.toPrecision(4)}, ${camera.position.y.toPrecision(4)}, ${camera.position.z.toPrecision(4)})<br>` +
		// 	`&nbsp;&nbsp;Horiz. FOV = ${fovS.toPrecision(4)}&deg;<br>`
		// 	;
		// 	console.log("*");
	}
}

new Instaferogram();

requestAnimationFrame( render );
