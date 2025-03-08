class JApp {
	appName = 'JApp';
	appDescription = 'the premier interactive tool';

	/**
	 * there can only be a single instance of JApp at any one time, and this property 
	 * is that instance
	 */
	static app;

	// internal variables
	camera;
	renderer;
	effect;	// allows effects such as displaying an anaglyph image -- see https://github.com/mrdoob/three.js/blob/master/examples/webgl_effects_anaglyph.html
	rendererOrEffect;	// either renderer or effect:  if renderer then rendered image is "normal", otherwise it has the effect applied
	gui;

	// the status text area
	statusField;	// = document.createElement('div');
	statusTime;	// the time the last status was posted

	// the info text area
	info;	// = document.createElement('div');

	// true if stored photo is showing
	showingStoredPhoto = false;
	storedPhoto;
	storedPhotoDescription;
	storedPhotoInfoString;

	// my Canon EOS450D
	static click = new Audio('./assets/click.m4a');

	/**
	 * Represents a color material.
	 * @constructor
	 * @param {string} appName - The app's name
	 * @param {string} appDescription - The app's (brief) description
	 */
	constructor( appName, appDescription ) {

		// super();

		this.appName = appName;
		this.appDescription = appDescription;

		this.addEventListenersEtc();

		this.createStatus();
		this.createInfo();
		this.refreshInfo();

		JApp.app = this;
	}	

	render() {
		// if(this.rendererOrEffect) this.rendererOrEffect.render( this.scene, this.camera );

		// if( !this.showingStoredPhoto ) requestAnimationFrame( render );
	}

	/**
	 * see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
	 * @param {*} toObject - the object to which the method belongs
	 * @param {*} methodName - the method to call
	 * @returns a function that calls the method of the object
	 */
	static bind(toObject, methodName) {
		return function(){toObject[methodName]()}
	}

	addEventListenersEtc() {
		// handle device orientation
		// window.addEventListener("deviceorientation", handleOrientation, true);
		
		// for some reason, the "JApp.bind( this, "method name" )" method doesn't work properly on my Android phone,
		// which didn't go back to showing the live image after taking a photo

		// handle window resize
		window.addEventListener("resize", 
			onWindowResize,	// JApp.bind( this, "onWindowResize" ), 
			false);

		// share button functionality
		document.getElementById('takePhotoButton').addEventListener('click', takePhoto);	// JApp.bind( this, "takePhoto") );

		// toggle fullscreen button functionality
		document.getElementById('fullscreenButton').addEventListener('click', toggleFullscreen);	// JApp.bind( this, "toggleFullscreen" ));

		// info button functionality
		document.getElementById('infoButton').addEventListener('click', toggleInfoVisibility);	// JApp.bind( this, "toggleInfoVisibility" ));

		// back button functionality
		document.getElementById('backButton').addEventListener('click', showLivePhoto);	// JApp.bind( this, "showLivePhoto" ));
		document.getElementById('backButton').style.visibility = "hidden";

		// share button
		document.getElementById('shareButton').addEventListener('click', share);	// JApp.bind( this, "share" ));
		document.getElementById('shareButton').style.visibility = "hidden";
		if(!(navigator.share)) document.getElementById('shareButton').src="./shareButtonUnavailable.png";
		// if(!(navigator.share)) document.getElementById('shareButton').style.opacity = 0.3;

		// delete button
		document.getElementById('deleteButton').addEventListener('click', deleteStoredPhoto);	// JApp.bind( this, "deleteStoredPhoto" ));
		document.getElementById('deleteButton').style.visibility = "hidden";

		// hide the thumbnail for the moment
		document.getElementById('storedPhotoThumbnail').addEventListener('click', showStoredPhoto);	// JApp.bind( this, "showStoredPhoto" ));
		document.getElementById('storedPhotoThumbnail').style.visibility = "hidden";
		document.getElementById('storedPhoto').addEventListener('click', JApp.bind( this, "showLivePhoto" ));
		document.getElementById('storedPhoto').style.visibility = "hidden";
		// showingStoredPhoto = false;
	}

	onWindowResize() {
		// in case the screen size has changed
		if( this.renderer ) this.renderer.setSize(window.innerWidth, window.innerHeight);
		if( this.effect ) this.effect.setSize(window.innerWidth, window.innerHeight);

		// if the screen orientation changes, width and height swap places, so the aspect ratio changes
		if( this.camera ) {
			this.camera.aspect = window.innerWidth / window.innerHeight;

			// make sure the camera changes take effect
			this.camera.updateProjectionMatrix();
		}

		this.postStatus(`window size ${window.innerWidth} &times; ${window.innerHeight}`);	// debug
	}

	async toggleFullscreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().catch((err) => {
				postStatus(
					`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`,
				);
			});
		} else {
			document.exitFullscreen();
		}
	}

	showStoredPhoto() {
		if( this.gui ) this.gui.hide();
		this.renderer.domElement.style.visibility = "hidden";
		document.getElementById('takePhotoButton').style.visibility = "hidden";
		// document.getElementById('changePositionButton').style.visibility = "hidden";
		document.getElementById('storedPhotoThumbnail').style.visibility = "hidden";
		document.getElementById('backButton').style.visibility = "visible";
		document.getElementById('shareButton').style.visibility = "visible";
		document.getElementById('deleteButton').style.visibility = "visible";
		document.getElementById('storedPhoto').style.visibility = "visible";
		this.showingStoredPhoto = true;

		this.postStatus('Showing stored photo, '+this.storedPhotoDescription);
	}

	showLivePhoto() {
		if(this.gui) this.gui.show();
		this.renderer.domElement.style.visibility = "visible";
		document.getElementById('takePhotoButton').style.visibility = "visible";
		// document.getElementById('changePositionButton').style.visibility = "visible";
		if(this.storedPhoto) document.getElementById('storedPhotoThumbnail').style.visibility = "visible";
		document.getElementById('backButton').style.visibility = "hidden";
		document.getElementById('shareButton').style.visibility = "hidden";
		document.getElementById('deleteButton').style.visibility = "hidden";
		document.getElementById('storedPhoto').style.visibility = "hidden";
		this.showingStoredPhoto = false;

		this.postStatus('Showing live image');

		requestAnimationFrame( render );
	}

	deleteStoredPhoto() {
		this.storedPhoto = null;

		this.showLivePhoto();

		this.postStatus('Stored photo deleted; showing live image');
	}

	takePhoto() {
		try {
			JApp.click.play();

			this.storedPhoto = this.renderer.domElement.toDataURL('image/png');
			this.storedPhotoInfoString = this.getInfoString();

			this.storedPhotoDescription = 
				this.appName 
				// + `_deltaPhi=${(deltaPhi*180.0/Math.PI).toPrecision(4)}`
				;
			// 
			document.getElementById('storedPhoto').src = this.storedPhoto;
			document.getElementById('storedPhotoThumbnail').src = this.storedPhoto;
			document.getElementById('storedPhotoThumbnail').style.visibility = "visible";
		
			this.postStatus('Photo taken; click thumbnail to view and share');
		} catch (error) {
			console.error('Error:', error);
		}	
	}

	async share() {
		try {
			fetch(this.storedPhoto)
			.then(response => response.blob())
			.then(blob => {
				const file = new File([blob], this.storedPhotoDescription+'.png', { type: blob.type });

				// create an html blob containing the parameter values
				const blobParams = new Blob(["<html>"+this.storedPhotoInfoString+"</html>"], { type: "text/html" });
				const fileParams = new File([blobParams], this.storedPhotoDescription+'.html', { type: blob.type });

				// Use the Web Share API to share the screenshot
				if (navigator.share) {
					navigator.share({
						title: this.storedPhotoDescription,
						// text: storedPhotoInfoString,
						files: [file, fileParams],
					});
				} else {
					this.postStatus('Sharing is not supported by this browser.');
				}	
			})
			.catch(error => {
				console.error('Error:', error);
				this.postStatus(`Error: ${error}`);
			});
		} catch (error) {
			console.error('Error:', error);
		}
	}

	/** 
	 * Add a text field to the bottom left corner of the screen
	 */
	createStatus() {
		this.statusField = document.getElementById('status');
		this.postStatus("Welcome to "+this.appName+", "+this.appDescription);
	}

	postStatus(text) {
		this.statusField.innerHTML = '&nbsp;'+text;
		console.log('status: '+text);

		// show the text only for 3 seconds
		this.statusTime = new Date().getTime();
		setTimeout( () => { if(new Date().getTime() - this.statusTime > 2999) this.statusField.innerHTML = '&nbsp;'+this.appName+', University of Glasgow, <a href="https://github.com/jkcuk/'+this.appName+'">https://github.com/jkcuk/'+this.appName+'</a>' }, 3000);
	}

	getInfoString() {
		return '' +
			`<h4>${this.appName}</h4>\n` +
			`${this.appName} is ${this.appDescription}.`
			;
	}

	refreshInfo() {
		if(this.showingStoredPhoto) this.setInfo( this.storedPhotoInfoString );
		else this.setInfo( this.getInfoString() );

		if(this.info.style.visibility === "visible") setTimeout( JApp.bind( this, "refreshInfo") , 100);	// refresh again a while
	}

	/** 
	 * Add a text field to the top left corner of the screen
	 */
	createInfo() {
		this.info = document.getElementById('info');
		this.info.innerHTML = "-- nothing to show (yet) --";
	}

	setInfo(text) {
		this.info.innerHTML = text;
		// console.log('info: '+text);
	}

	toggleInfoVisibility() {
		switch(info.style.visibility) {
			case "visible":
				info.style.visibility = "hidden";
				break;
			case "hidden":
			default:
				info.style.visibility = "visible";
				this.refreshInfo();
		}
	}

}

function render() {
	JApp.app
		? JApp.app.render()
		: console.error('JApp.app not defined');

	if( !JApp.app.showingStoredPhoto ) requestAnimationFrame( render );
}

function onWindowResize() {
	JApp.app
		? JApp.app.onWindowResize()
		: console.error('JApp.app not defined');
}

function takePhoto() {
	JApp.app
		? JApp.app.takePhoto()
		: console.error('JApp.app not defined');
}

function toggleFullscreen() {
	JApp.app
		? JApp.app.toggleFullscreen()
		: console.error('JApp.app not defined');
}

function toggleInfoVisibility() {
	JApp.app
		? JApp.app.toggleInfoVisibility()
		: console.error('JApp.app not defined');
}

function share() {
	JApp.app
		? JApp.app.share()
		: console.error('JApp.app not defined');
}

function deleteStoredPhoto() {
	JApp.app
		? JApp.app.deleteStoredPhoto()
		: console.error('JApp.app not defined');
}

function showStoredPhoto() {
	JApp.app
		? JApp.app.showStoredPhoto()
		: console.error('JApp.app not defined');
}

function showLivePhoto() {
	JApp.app
		? JApp.app.showLivePhoto()
		: console.error('JApp.app not defined');
}

export { JApp, render, onWindowResize, takePhoto, toggleFullscreen, toggleInfoVisibility, share, deleteStoredPhoto, showStoredPhoto, showLivePhoto };