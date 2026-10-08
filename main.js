
import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';	// see https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content
import { installCanvasContextMenu } from './canvasContextMenu.js';

import { InterferenceMaterial, maxNoOfSources } from './interferenceMaterial.js';
import { JApp, render } from './JApp.js';

class Instaferogram extends JApp {
	interferenceMaterialOpaque;
	interferenceMaterialSemiTransparent;
	scene;
	sourceZPlane;
	xPlane;
	yPlane;
	zPlane;
	xPlaneGroup = new THREE.Group();;
	yPlaneGroup = new THREE.Group();
	zPlaneGroup = new THREE.Group();
	sphere;
	plotRange = 10;
	noOfXPlanes = 100;
	noOfYPlanes = 100;
	noOfZPlanes = 100;

	opacity = 0.02;
	f = 1;	// frequency
	
    /**
	 * @constructor
	 */
	constructor(  ) {
        super( 'Instaferogram', 'the premier interactive tool ...' );

		this.interferenceMaterialSemiTransparent = 
			new InterferenceMaterial(0, 2, 0, 2, 0, 0, this.opacity);
		this.interferenceMaterialSemiTransparent.updateSources();
		this.interferenceMaterialOpaque = 
			new InterferenceMaterial(0, 2, 0, 2, 0, 0, 1);
		this.interferenceMaterialOpaque.updateSources();
		this.interferenceMaterialOpaque.transparent = false;
		this.interferenceMaterialOpaque.blending = THREE.NoBlending;
		this.interferenceMaterialOpaque.depthWrite = true;

        this.createRendererEtc();

        this.addGUI();
    }

	createRendererEtc() {
		// create scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 'rgb(64, 64, 64)' );

		// create camera
		this.camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 0.0001, 151 );
		this.camera.position.z = 20;
		
		this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.xr.enabled = true;	// see https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content
		document.body.appendChild( VRButton.createButton( this.renderer ) );	// see https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content
		document.body.appendChild( this.renderer.domElement );
		installCanvasContextMenu(this.renderer.domElement, { filename: 'Instaferogram.png' });

		// this.interferenceMaterialSemiTransparent= ;
		this.addPlanes();
		this.addSphere();

		this.addOrbitControls();
    	// this.controls = new OrbitControls( this.camera, this.renderer.domElement );
	}

	// Define indices to form triangles
	indices = [
		0, 1, 2,  // Triangle 1
		0, 2, 3   // Triangle 2
	];

	addPlanes() {
		this.sourceZPlane = this.createZPlane( this.interferenceMaterialOpaque.sourceZ, this.interferenceMaterialOpaque );
		this.scene.add( this.sourceZPlane );

		this.xPlane = this.createXPlane( 0, this.interferenceMaterialOpaque );
		this.yPlane = this.createYPlane( 0, this.interferenceMaterialOpaque );
		this.zPlane = this.createZPlane( 0, this.interferenceMaterialOpaque );
		this.scene.add( this.xPlane );
		this.scene.add( this.yPlane );
		this.scene.add( this.zPlane );

		// xPlanes
		this.rebuildPlaneGroup( this.xPlaneGroup, this.noOfXPlanes, (position) => this.createXPlane( position, this.interferenceMaterialSemiTransparent ) );
		this.xPlaneGroup.visible = false;
		this.scene.add( this.xPlaneGroup );
	
		// yPlanes
		this.rebuildPlaneGroup( this.yPlaneGroup, this.noOfYPlanes, (position) => this.createYPlane( position, this.interferenceMaterialSemiTransparent ) );
		this.yPlaneGroup.visible = false;
		this.scene.add( this.yPlaneGroup );
	
		// zPlanes
		this.rebuildPlaneGroup( this.zPlaneGroup, this.noOfZPlanes, (position) => this.createZPlane( position, this.interferenceMaterialSemiTransparent ) );
		this.zPlaneGroup.visible = false;
		this.scene.add( this.zPlaneGroup );

		this.sourceZPlane.material = this.interferenceMaterialOpaque;
		this.xPlane.material = this.interferenceMaterialOpaque;
		this.yPlane.material = this.interferenceMaterialOpaque;
		this.zPlane.material = this.interferenceMaterialOpaque;
	}

	rebuildPlaneGroup(group, count, createPlane) {
		for (const plane of group.children) plane.geometry.dispose();
		group.clear();

		for (let i = 0; i < count; i++) {
			const position = count === 1 ? 0 : -.5 + i / (count - 1);
			group.add( createPlane(position) );
		}
	}

	createXPlane(x, material) {
		return this.createPlane( [
			x, -.5,  .5,  // Top left
			x, -.5, -.5,  // Bottom left
			x,  .5, -.5,  // Bottom right
			x,  .5,  .5,  // Top right
		] );
	}

	createYPlane(y, material) {
		return this.createPlane( [
			-.5, y,  .5,  // Top left
			-.5, y, -.5,  // Bottom left
			 .5, y, -.5,  // Bottom right
			 .5, y,  .5,  // Top right
		] );
	}

	createZPlane(z, material) {
		return this.createPlane( [
			-.5,  .5, z,  // Top left
			-.5, -.5, z,  // Bottom left
			.5, -.5, z,  // Bottom right
			.5,  .5, z,  // Top right
		] );
	}

	createPlane(vertices, material) {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setIndex( this.indices);
		const plane = new THREE.Mesh( geometry, this.interferenceMaterialSemiTransparent );
		plane.scale.set(this.plotRange, this.plotRange, this.plotRange);
		// this.scene.add( plane );
		return plane
	}

	/** create sphere, textures, transformation matrix */
	addSphere() {
		let geometry = new THREE.SphereGeometry( 1, 200, 200 );
		this.sphere = new THREE.Mesh( geometry, this.interferenceMaterialOpaque );
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
	
	timer = new THREE.Timer();
	
    render() {
		this.timer.update();
		let deltaOmegaT = 2*Math.PI*this.f*this.timer.getDelta();
		this.interferenceMaterialSemiTransparent.uniforms.omegaT.value += deltaOmegaT;
		this.interferenceMaterialOpaque.uniforms.omegaT.value += deltaOmegaT;

		// console.log("this.scene="+this.scene+", this.camera="+this.camera);
		if(this.renderer) this.renderer.render( this.scene,  this.camera );
	}

	// gui

	pointsOnLineType = 0;
	pointsOnCircleType = 1;
	parallelLinesType = 2;
	uniformPlaneWavesType = 3;
	beamHGType = 4;
	beamLGType = 5;
	beamBesselType = 6;
	fieldTypes = {
		'Points on line': 0, 
		'Points on circle': 1, 
		'Parallel lines': 2
		// 'Uniform plane waves', 
		// 'Hermite-Gaussian beam', 
		// 'Laguerre-Gaussian beam', 
		// 'Bessel beam'
	};
	
	getFieldTypeString() {
		return Object.keys(this.fieldTypes).find(k => this.interferenceMaterialSemiTransparent.fieldType[k] === this.interferenceMaterialSemiTransparent.fieldType);
		// return this.fieldTypes[ this.interferenceMaterialSemiTransparent.fieldType ];
	}

	intensityType = 0;
	phaseAndIntensityType = 1;
	phaseType = 2;
	reAmplitudeType = 3;
	plotTypes = ['Intensity', 'Phase & intensity', 'Phase', 'Re(amplitude)'];

	getPlotTypeString() {
		return this.plotTypes[ this.interferenceMaterialSemiTransparent.uniforms.plotType.value ];
	}

	static getBaseLog(x, y) {
		return Math.log(y) / Math.log(x);
	}


	guiVariables;

    addGUI() {
		this.guiVariables = {
			f: this.f,
			lambda: 2*Math.PI/this.interferenceMaterialSemiTransparent.uniforms.k.value,
			fieldType: this.interferenceMaterialSemiTransparent.fieldType,
			noOfSources: this.interferenceMaterialSemiTransparent.noOfSources,
			m: this.interferenceMaterialSemiTransparent.m,
			sourceExtent: this.interferenceMaterialSemiTransparent.sourceExtent,
			sqrtSourceExtent: Math.sqrt(this.interferenceMaterialSemiTransparent.sourceExtent),
			sourceZ: this.interferenceMaterialSemiTransparent.sourceZ,
			atanSourceZ: Math.atan(this.interferenceMaterialSemiTransparent.sourceZ),
			plotType: this.interferenceMaterialSemiTransparent.uniforms.plotType.value,
			brightness: Instaferogram.getBaseLog(2, this.interferenceMaterialSemiTransparent.uniforms.brightnessFactor.value), // exposure compensation
			showSourcePlane: this.sourceZPlane.visible,
			showXPlane: this.xPlane.visible,
			showYPlane: this.yPlane.visible,
			showZPlane: this.zPlane.visible,
			showSphere: this.sphere.visible,
			showXYZPlanes: this.xPlaneGroup.visible && this.yPlaneGroup.visible && this.zPlaneGroup.visible,
			showXPlaneGroup: this.xPlaneGroup.visible,
			showYPlaneGroup: this.yPlaneGroup.visible,
			showZPlaneGroup: this.zPlaneGroup.visible,
			noOfXPlanes: this.noOfXPlanes,
			noOfYPlanes: this.noOfYPlanes,
			noOfZPlanes: this.noOfZPlanes,
			x: this.xPlane.position.x,
			atanX: Math.atan(this.xPlane.position.x),
			atanY: Math.atan(this.yPlane.position.y),
			atanZ: Math.atan(this.zPlane.position.z),
			y: this.yPlane.position.y,
			z: this.zPlane.position.z,
			r: this.sphere.scale.x,
			plotRange: this.plotRange,
			sqrtPlotRange: Math.sqrt(this.plotRange),
			backgroundColor: '#404040',
			opacity: this.interferenceMaterialSemiTransparent.uniforms.opacity.value,
			sqrtOpacity: Math.sqrt(this.interferenceMaterialSemiTransparent.uniforms.opacity.value),
			semiTransparent: this.interferenceMaterialSemiTransparent.transparent,
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

		// let fieldTypeString = ( this.fieldType == 0?`Length of line`:`Diameter of circle`);

		const folderPhysics = this.gui.addFolder( 'Physics' );

		folderPhysics.add( this.guiVariables, 'f', -10, 10, 0.1 )
			.name('Frequency <i>f</i>')
			.onChange( (f) => { this.f = f; } );

		folderPhysics.add( this.guiVariables, 'lambda', 0.01, 2, 0.01 )
			.name('Wavelength &lambda;')
			.onChange( (lambda) => { 
				this.interferenceMaterialSemiTransparent.uniforms.k.value = 2*Math.PI/lambda; 
				this.interferenceMaterialOpaque.uniforms.k.value = 2*Math.PI/lambda;
			} );

		folderPhysics.add( this.guiVariables, 'fieldType', 
				this.fieldTypes // Object.fromEntries( this.fieldTypes.map((str, i) => [str, i]) )	// { 'Line': 0, 'Circle': 1 } 
			)
			.name('Field type')
			.onChange( (a) => { 
				this.interferenceMaterialSemiTransparent.fieldType = a; 
				this.interferenceMaterialSemiTransparent.updateSources();
				this.interferenceMaterialOpaque.fieldType = a;
				this.interferenceMaterialOpaque.updateSources();
				// recreateGUI(); 
			} );
		
		folderPhysics.add( this.guiVariables, 'm', -10, 10, 1)
			.name('Topolog. charge <i>m</i>')
			.onChange( (m) => { 
				this.interferenceMaterialSemiTransparent.m = m; 
				this.interferenceMaterialSemiTransparent.updateSources();
				this.interferenceMaterialOpaque.m = m;
				this.interferenceMaterialOpaque.updateSources();
			} );
		
		this.addSqrtSlider(
			folderPhysics,
			this.guiVariables, 'sqrtSourceExtent',
			0,	// Math.atan(-10),
			Math.sqrt(100),	// Math.atan(10),
			(sqrtSourceExtent) => { 
				this.guiVariables.sqrtSourceExtent = sqrtSourceExtent;
				this.interferenceMaterialSemiTransparent.sourceExtent = Math.pow(sqrtSourceExtent, 2);
				this.interferenceMaterialSemiTransparent.updateSources();
				this.interferenceMaterialOpaque.sourceExtent = Math.pow(sqrtSourceExtent, 2);
				this.interferenceMaterialOpaque.updateSources();}
		).name('Source size');

		// folderPhysics.add( this.guiVariables, 'sourceExtent', 0, 20)
		// 	.name('source extent')
		// 	.onChange( (d) => { 
		// 		this.interferenceMaterialSemiTransparent.sourceExtent = d;
		// 		this.interferenceMaterialSemiTransparent.updateSources();
		// 		this.interferenceMaterialOpaque.sourceExtent = d;
		// 		this.interferenceMaterialOpaque.updateSources();
		// 	} );

		this.addAtanSlider(
			folderPhysics,
			this.guiVariables, 'atanSourceZ',
			Math.atan(-100),	// Math.atan(-10),
			Math.atan(100),	// Math.atan(10),
			(atanSourceZ) => { 
				this.guiVariables.atanSourceZ = atanSourceZ;
				let sourceZ = Math.tan(atanSourceZ);
				this.interferenceMaterialSemiTransparent.sourceZ = sourceZ;
				this.interferenceMaterialSemiTransparent.updateSources();
				this.interferenceMaterialOpaque.sourceZ = sourceZ;
				this.interferenceMaterialOpaque.updateSources();
				this.sourceZPlane.position.set(0, 0, sourceZ);
			}
		).name('<i>z</i><sub>source</sub>');

		// folderPhysics.add( this.guiVariables, 'sourceZ', -10, 10, 0.01 )
		// 	.name('Source <i>z</i>')
		// 	.onChange( (sourceZ) => {
		// 		this.interferenceMaterialSemiTransparent.sourceZ = sourceZ;
		// 		this.interferenceMaterialSemiTransparent.updateSources();
		// 		this.interferenceMaterialOpaque.sourceZ = sourceZ;
		// 		this.interferenceMaterialOpaque.updateSources();
		// 	} );
		
		folderPhysics.add( this.guiVariables, 'noOfSources', 1, maxNoOfSources, 1)
			.name('No of sources')
			.onChange( (noOfSources) => { 
				this.interferenceMaterialSemiTransparent.noOfSources = noOfSources;
				this.interferenceMaterialSemiTransparent.uniforms.noOfSources.value = noOfSources;
				this.interferenceMaterialSemiTransparent.updateSources();
				this.interferenceMaterialOpaque.noOfSources = noOfSources;
				this.interferenceMaterialOpaque.uniforms.noOfSources.value = noOfSources;
				this.interferenceMaterialOpaque.updateSources();
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
			.onChange( (t) => { 
				this.interferenceMaterialSemiTransparent.uniforms.plotType.value = t; 
				this.interferenceMaterialOpaque.uniforms.plotType.value = t;
			} );

		folderPlot.add( this.guiVariables, 'brightness', -7, 20, 1/3)
			.name('Brightness')
			.onChange( (b) => {
				this.interferenceMaterialSemiTransparent.uniforms.brightnessFactor.value = Math.pow(2, b);
				this.interferenceMaterialOpaque.uniforms.brightnessFactor.value = Math.pow(2, b);
			} );

		folderPlot.add( this.guiVariables, 'showSourcePlane' )
			.name('Show source plane')
			.onChange( (s) => {
				this.sourceZPlane.visible = s;
			} );
		
		folderPlot.add( this.guiVariables, 'showXPlane' )
			.name('Show <i>x</i> plane')
			.onChange( (s) => { 
				this.xPlane.visible = s;
			} );

		this.addAtanSlider(
			folderPlot,
			this.guiVariables, 'atanX',
			Math.atan(-10),	// Math.atan(-10),
			Math.atan(10),	// Math.atan(10),
			(atanX) => { 
				this.guiVariables.atanX = atanX;
				this.xPlane.position.set(Math.tan(atanX), 0, 0);
			}
		).name('<i>x</i>');

		// folderPlot.add( this.guiVariables, 'x', -5, 5, 0.01 )
		// 	.name('<i>x</i> =')
		// 	.onChange( (x) => {
		// 		this.xPlane.position.set(x, 0, 0);
		// 	} );
		
		folderPlot.add( this.guiVariables, 'showYPlane' )
			.name('Show <i>y</i> plane')
			.onChange( (s) => {
				this.yPlane.visible = s;
			} );
		
		this.addAtanSlider(
			folderPlot,
			this.guiVariables, 'atanY',
			Math.atan(-10),	// Math.atan(-10),
			Math.atan(10),	// Math.atan(10),
			(atanY) => { 
				this.guiVariables.atanY = atanY;
				this.yPlane.position.set(0, Math.tan(atanY), 0);
			}
		).name('<i>y</i>');

		// folderPlot.add( this.guiVariables, 'y', -5, 5, 0.01 )
		// 	.name('<i>y</i> =')
		// 	.onChange( (y) => {
		// 		this.yPlane.position.set(0, y, 0);
		// 	} );
		
		folderPlot.add( this.guiVariables, 'showZPlane' )
			.name('Show <i>z</i> plane')
			.onChange( (s) => {
				this.zPlane.visible = s;
			} );

		this.addAtanSlider(
			folderPlot,
			this.guiVariables, 'atanZ',
			Math.atan(-10),	// Math.atan(-10),
			Math.atan(10),	// Math.atan(10),
			(atanZ) => { 
				this.guiVariables.atanZ = atanZ;
				this.zPlane.position.set(0, 0, Math.tan(atanZ));
			}
		).name('<i>z</i>');

		// folderPlot.add( this.guiVariables, 'z', -5, 5, 0.01 )
		// 	.name('<i>z</i> =')
		// 	.onChange( (z) => {
		// 		this.zPlane.position.set(0, 0, z);
		// 	} );

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

		this.addSqrtSlider(
			folderPlot,
			this.guiVariables, 'sqrtPlotRange',
			0.1,
			Math.sqrt(100),
			(sqrtPlotRange) => { 
				this.guiVariables.sqrtPlotRange = sqrtPlotRange; 
				this.plotRange = Math.pow(sqrtPlotRange, 2);
				this.sourceZPlane.scale.set(this.plotRange, this.plotRange, this.plotRange);
				this.xPlane.scale.set(this.plotRange, this.plotRange, this.plotRange);
				this.yPlane.scale.set(this.plotRange, this.plotRange, this.plotRange);
				this.zPlane.scale.set(this.plotRange, this.plotRange, this.plotRange);
				this.xPlaneGroup.scale.set(this.plotRange/10, this.plotRange/10, this.plotRange/10);
				this.yPlaneGroup.scale.set(this.plotRange/10, this.plotRange/10, this.plotRange/10);
				this.zPlaneGroup.scale.set(this.plotRange/10, this.plotRange/10, this.plotRange/10);
			}
		).name('Square sidelength');

		folderPlot.addColor( this.guiVariables, 'backgroundColor' )
			.name('Background color')
			.onChange( (color) => {
				this.scene.background = new THREE.Color(color);
			} );

		// folderPlot.add( this.guiVariables, 'plotRange', 0, 1000, 1)
		// 	.name('Square sidelength')
		// 	.onChange( (plotRange) => {
		// 		this.plotRange = plotRange;
		// 		this.xPlane.scale.set(plotRange, plotRange, plotRange);
		// 		this.yPlane.scale.set(plotRange, plotRange, plotRange);
		// 		this.zPlane.scale.set(plotRange, plotRange, plotRange);
		// 	} );

		const folderPlandCloud = this.gui.addFolder( 'Plane Cloud' );

		folderPlandCloud.add( this.guiVariables, 'showXYZPlanes' )
			.name('Show <i>xyz</i> plane cloud')
			.onChange( (s) => {
				this.xPlaneGroup.visible = s;
				this.yPlaneGroup.visible = s;
				this.zPlaneGroup.visible = s;
			} );

		folderPlandCloud.add( this.guiVariables, 'noOfXPlanes', 1, 500, 1 )
			.name('No. of <i>x</i> planes')
			.onFinishChange( (count) => {
				this.noOfXPlanes = count;
				this.rebuildPlaneGroup( this.xPlaneGroup, count, (position) => this.createXPlane( position, this.interferenceMaterialSemiTransparent ) );
			} );

		folderPlandCloud.add( this.guiVariables, 'noOfYPlanes', 1, 500, 1 )
			.name('No. of <i>y</i> planes')
			.onFinishChange( (count) => {
				this.noOfYPlanes = count;
				this.rebuildPlaneGroup( this.yPlaneGroup, count, (position) => this.createYPlane( position, this.interferenceMaterialSemiTransparent ) );
			} );

		folderPlandCloud.add( this.guiVariables, 'noOfZPlanes', 1, 500, 1 )
			.name('No. of <i>z</i> planes')
			.onFinishChange( (count) => {
				this.noOfZPlanes = count;
				this.rebuildPlaneGroup( this.zPlaneGroup, count, (position) => this.createZPlane( position, this.interferenceMaterialSemiTransparent ) );
			} );

		folderPlandCloud.close();

		// folderPlot.add( this.guiVariables, 'showXPlaneGroup' )
		// 	.name('Show <i>x</i> plane group')
		// 	.onChange( (s) => {
		// 		this.xPlaneGroup.visible = s;
		// 	} );
		
		// folderPlot.add( this.guiVariables, 'showYPlaneGroup' )
		// 	.name('Show <i>y</i> plane group')
		// 	.onChange( (s) => {
		// 		this.yPlaneGroup.visible = s;
		// 	} );
		
		// folderPlot.add( this.guiVariables, 'showZPlaneGroup' )
		// 	.name('Show <i>z</i> plane group')
		// 	.onChange( (s) => {
		// 		this.zPlaneGroup.visible = s;
		// 	} );

		// folderPlot.add( this.guiVariables, 'opacity', 0, 1, 0.01)
		// 	.name('Opacity')
		// 	.onChange( (o) => {
		// 		this.interferenceMaterialSemiTransparent.uniforms.opacity.value = o;
		// 	} );

		this.addSqrtSlider(
			folderPlandCloud,
			this.guiVariables, 'sqrtOpacity',
			0,
			1,
			(a) => { 
				this.guiVariables.sqrtOpacity = a; 
				this.guiVariables.opacity = Math.pow(a, 2);
				this.interferenceMaterialSemiTransparent.uniforms.opacity.value = this.guiVariables.opacity;
			}
		).name('Opacity');


		// folderPlot.add( this.guiVariables, 'semiTransparent' )
		// 	.name('Semi-transparent')
		// 	.onChange( (s) => {
		// 		this.interferenceMaterialSemiTransparent.transparent = s;
		// 		this.interferenceMaterialSemiTransparent.depthWrite = !s;
		// 		this.interferenceMaterialSemiTransparent.uniforms.opacity.value = s?0.5:1;
		// 		// this.interferenceMaterialSemiTransparent.needsUpdate = true;
		// 	} );



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

	addLogSlider(gui, params, property, minNumber, maxNumber, onChange) {
		const controller = gui.add(
			params,
			property,
			minNumber,
			maxNumber,
			0.001
		).onChange(onChange);
		const numberInput = controller.domElement.querySelector('input[type="number"]');
		const originalUpdateDisplay = controller.updateDisplay.bind(controller);

		function updateDisplay() {
			originalUpdateDisplay();
			if (numberInput) numberInput.value = Math.pow(10, params[property]).toFixed(2);// String(Math.tan(GUIParams[property]));
		}

		controller.updateDisplay = updateDisplay;

		if (numberInput) {
			numberInput.removeAttribute('min');
			numberInput.removeAttribute('max');
			numberInput.addEventListener('input', (event) => {
				event.stopImmediatePropagation();
				const x = Number(numberInput.value);
				if (Number.isFinite(x)) controller.setValue(Math.log10(x));
			}, true);
			numberInput.addEventListener('change', (event) => {
				event.stopImmediatePropagation();
				const x = Number(numberInput.value);
				if (Number.isFinite(x)) controller.setValue(Math.log10(x));
			}, true);
		}

		controller.updateDisplay();
		return controller;
	}

	addAtanSlider(gui, params, property, minNumber, maxNumber, onChange) {
		const controller = gui.add(
			params,
			property,
			minNumber,
			maxNumber,
			0.001
		).onChange(onChange);
		const numberInput = controller.domElement.querySelector('input[type="number"]');
		const originalUpdateDisplay = controller.updateDisplay.bind(controller);

		function updateDisplay() {
			originalUpdateDisplay();
			if (numberInput) numberInput.value = Math.tan(params[property]).toFixed(2);// String(Math.tan(GUIParams[property]));
		}

		controller.updateDisplay = updateDisplay;

		if (numberInput) {
			numberInput.removeAttribute('min');
			numberInput.removeAttribute('max');
			numberInput.addEventListener('input', (event) => {
				event.stopImmediatePropagation();
				const x = Number(numberInput.value);
				if (Number.isFinite(x)) controller.setValue(Math.atan(x));
			}, true);
			numberInput.addEventListener('change', (event) => {
				event.stopImmediatePropagation();
				const x = Number(numberInput.value);
				if (Number.isFinite(x)) controller.setValue(Math.atan(x));
			}, true);
		}

		controller.updateDisplay();
		return controller;
	}

	addSqrtSlider(gui, params, property, minNumber, maxNumber, onChange) {
		const controller = gui.add(
			params,
			property,
			minNumber,
			maxNumber,
			0.001
		).onChange(onChange);
		const numberInput = controller.domElement.querySelector('input[type="number"]');
		const originalUpdateDisplay = controller.updateDisplay.bind(controller);

		function updateDisplay() {
			originalUpdateDisplay();
			if (numberInput) numberInput.value = Math.pow(params[property],2).toFixed(2);// String(Math.tan(GUIParams[property]));
		}

		controller.updateDisplay = updateDisplay;

		if (numberInput) {
			numberInput.removeAttribute('min');
			numberInput.removeAttribute('max');
			numberInput.addEventListener('input', (event) => {
				event.stopImmediatePropagation();
				const x = Number(numberInput.value);
				if (Number.isFinite(x)) controller.setValue(Math.sqrt(x));
			}, true);
			numberInput.addEventListener('change', (event) => {
				event.stopImmediatePropagation();
				const x = Number(numberInput.value);
				if (Number.isFinite(x)) controller.setValue(Math.sqrt(x));
			}, true);
		}

		controller.updateDisplay();
		return controller;
	}

	addPowerSlider(power, gui, params, property, minNumber, maxNumber, onChange) {
		const controller = gui.add(
			params,
			property,
			minNumber,
			maxNumber,
			0.001
		).onChange(onChange);
		const numberInput = controller.domElement.querySelector('input[type="number"]');
		const originalUpdateDisplay = controller.updateDisplay.bind(controller);

		function updateDisplay() {
			originalUpdateDisplay();
			if (numberInput) numberInput.value = Math.pow(params[property],1/power).toFixed(2);// String(Math.tan(GUIParams[property]));
		}

		controller.updateDisplay = updateDisplay;

		if (numberInput) {
			numberInput.removeAttribute('min');
			numberInput.removeAttribute('max');
			numberInput.addEventListener('input', (event) => {
				event.stopImmediatePropagation();
				const x = Number(numberInput.value);
				if (Number.isFinite(x)) controller.setValue(Math.pow(x, power));
			}, true);
			numberInput.addEventListener('change', (event) => {
				event.stopImmediatePropagation();
				const x = Number(numberInput.value);
				if (Number.isFinite(x)) controller.setValue(Math.pow(x, power));
			}, true);
		}

		controller.updateDisplay();
		return controller;
	}

	getInfoString() {
		if(!this.interferenceMaterialSemiTransparent) return "";
		return `Frequency <i>f</i> = ${ this.f.toPrecision(4) } Hz<br>`+
		`Wavelength &lambda; = ${(2*Math.PI/this.interferenceMaterialSemiTransparent.uniforms.k.value).toPrecision(4)}<br>` +
		'Sources arrangement = '+ this.getFieldTypeString() + '<br>' +
		`No of sources = ${this.interferenceMaterialSemiTransparent.noOfSources}<br>` +
		`Topological charge <i>m</i> = ${this.interferenceMaterialSemiTransparent.m}<br>` +
		(this.fieldType == 0?`Length of line`:`Radius of circle`) + ` <i>d</i> = ${this.interferenceMaterialSemiTransparent.sourceExtent.toPrecision(4)}<br>` +
		`Plot type = ` + this.getPlotTypeString() + '<br>' +
		`Exposure compensation = ${Instaferogram.getBaseLog(2, this.interferenceMaterialSemiTransparent.uniforms.brightnessFactor.value).toPrecision(4)}<br>` +
		(this.xPlane.visible?'Show':'Hide')+` plane <i>x</i> = ${this.xPlane.position.x.toPrecision(4)}<br>` +
		(this.yPlane.visible?'Show':'Hide')+` plane <i>y</i> = ${this.yPlane.position.y.toPrecision(4)}<br>` +
		(this.zPlane.visible?'Show':'Hide')+` plane <i>z</i> = ${this.zPlane.position.z.toPrecision(4)}<br>` +
		`square sidelength = ${this.plotRange}<br>` +
		(this.sphere.visible?'Show':'Hide')+` sphere <i>r</i> = ${this.sphere.scale.x.toPrecision(4)}<br>` +
		`Virtual camera<br>` +
		`&nbsp;&nbsp;Position = (${this.camera.position.x.toPrecision(4)}, ${this.camera.position.y.toPrecision(4)}, ${this.camera.position.z.toPrecision(4)})<br>` +
		`&nbsp;&nbsp;Horiz. FOV = ${this.camera.fov.toPrecision(4)}&deg;<br>` 
		// 	// `Frequency <i>f</i> = ${ this.f.toPrecision(4) } Hz<br>`+
		// 	`Wavelength &lambda; = ${(2*Math.PI/this.interferenceMaterialSemiTransparent.uniforms.k.value).toPrecision(4)}<br>` + 
		// 	'Sources arrangement = '+ getFieldTypeString() + '<br>' +
		// 	`No of sources = ${noOfSources}<br>` +
		// 	`Topological charge <i>m</i> = ${m}<br>` +
		// 	(fieldType == 0?`Length of line`:`Radius of circle`) + ` <i>d</i> = ${d.toPrecision(4)}<br>` +
		// 	`Plot type = ` + getPlotTypeString() + '<br>' +
		// 	`Exposure compensation = ${getBaseLog(2, interferenceMaterialSemiTransparent.uniforms.brightnessFactor.value).toPrecision(4)}<br>` +
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

let instaferogram = new Instaferogram();

requestAnimationFrame( render );
