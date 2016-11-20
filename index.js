/* global AFRAME */

if (typeof AFRAME === 'undefined') {
    throw new Error('Component attempted to register before AFRAME was available.');
}

var MIN = 0;
var MAX = 100;

AFRAME.registerComponent('step-controls', {
    schema: {
        acceleration: {
            default: 65
        },
        sensitivty: {
          default: 1
        },
        enabled: {
            default: true
        }
    },

    /**
     * Set if component needs multiple instancing.
     */
    multiple: false,

    /**
     * Called once when component is attached. Generally for initial setup.
     */
    init: function() {
        this.alphaOffsetAngle = 0;
        this.velocity = new THREE.Vector3();
        this.deviceOrientation = null;
        this.deviceMotion = null;

        this.lastStep = 0;


        this.attachEventListeners();

        this.last = 0;
        this.min = MAX;
        this.max = MIN;
        this.threshold = 0;
        this.lastThreshold = 0;
        this.sampleCounter = 0;
        this.faultStep = false;
        this.thresholds = []
    },

    /**
     * Called when component is attached and when component data changes.
     * Generally modifies the entity based on the data.
     */
    update: function(oldData) {},

    /**
     * Called when a component is removed (e.g., via removeAttribute).
     * Generally undoes all modifications to the entity.
     */
    remove: function() {
      this.removeEventListeners();
    },

    /**
     * Called on each scene tick.
     */
    tick: function(time, delta) {
      var data = this.data;
      //console.log(this.deviceMotion)

      if (data.enabled && this.deviceMotion) {
        var acceleration = this.deviceMotion.acceleration;
        var rotation = this.deviceMotion.rotationRate;

        var alpha = rotation.alpha ? THREE.Math.degToRad( rotation.alpha ) + this.alphaOffsetAngle : 0; // Z
		    var beta = rotation.beta ? THREE.Math.degToRad( rotation.beta ) : 0; // X'
		    var gamma = rotation.gamma ? THREE.Math.degToRad( rotation.gamma ) : 0; // Y''


        var euler = new THREE.Euler();
        euler.set( beta, alpha, - gamma, 'YXZ' ); // 'ZXY' for the device, but 'YXZ' for us

        var x = acceleration.x ? acceleration.x : 0;  // if device is in landscape mode than we use this value
        var y = acceleration.y ? acceleration.y : 0;
        var z = acceleration.z ? acceleration.z : 0;
        //console.log(x + '  ' + y + ' ' + z)

        if (x > this.max) {
          this.max = x
        }
        if (x < this.min) {
          this.min = x
        }
        console.log(x-this.last)
        if (x - this.last <= 0.1) {
          return;
        }

        this.last = x;

        var threshold = (this.max + this.min) / 2;

        this.thresholds.push(threshold)

        if (threshold < this.lastThreshold) {
          console.log("STEP")
        }

        this.sampleCounter++;
        if (this.sampleCounter >= 50) {
          this.sampleCounter = 0;

          this.lastThreshold = this.thresholds.reduce((c,l) => c+l, 0) / this.thresholds.length;

          this.min = MAX;
          this.max = MIN;

          this.faultStep = false;
        }
      }
    },

    /**
     * Called when entity pauses.
     * Use to stop or remove any dynamic or background behavior such as events.
     */
    pause: function() {
        this.removeEventListeners();
    },

    /**
     * Called when entity resumes.
     * Use to continue or add any dynamic or background behavior such as events.
     */
    play: function() {
        this.attachEventListeners();
    },

    onDeviceOrientationChangeEvent: function (event) {
      this.deviceOrientation = event;
    },

    onDeviceMotionChangeEvent: function (event) {
      this.deviceMotion = event;
    },

    attachEventListeners: function() {
        //window.addEventListener('deviceorientation', this.onDeviceOrientationChangeEvent.bind(this), false);
        window.addEventListener('devicemotion', this.onDeviceMotionChangeEvent.bind(this), false);
    },

    removeEventListeners: function() {
        //window.removeEventListener('deviceorientation', this.onDeviceOrientationChangeEvent.bind(this));
        window.removeEventListener('devicemotion', this.onDeviceMotionChangeEvent.bind(this));
    },
});
