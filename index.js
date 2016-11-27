/* global AFRAME */

if (typeof AFRAME === 'undefined') {
    throw new Error('Component attempted to register before AFRAME was available.');
}

var MAX_DELTA = 200;

/**
 * Step Controls component.
 *
 * Control your entities by using the mobile device accelerometor by stepping with your feets.
 *
 * @namespace step-controls
 * @param {number} [acceleration=65] - Determines the acceleration given
 * to the entity when stepping.
 * @param {number} [angularAcceleration=Math.PI*0.25] - Determines the angular
 * acceleration given to the entity when pressing the keys. Only applied when
 * mode == 'fps'. Measured in Radians.
 * @param {bool} [enabled=true] - To completely enable or disable the controls
 * @param {string} [mode='default'] -
 *   'default' enforces the direction of the movement to stick to the plane
 *   where the entity started off.
 *   'fps' extends 'default' by enabling "First Person Shooter" controls: W/S =
 *   Forward/Back, Q/E = Strafe left/right, A/D = Rotate left/right
 *   'fly' enables 6 degrees of freedom as a diver underwater or a plane flying.
 * @param {string} [rollAxis='z'] - The front-to-back axis.
 * @param {string} [pitchAxis='x'] - The left-to-right axis.
 * @param {bool} [rollAxisInverted=false] - Roll axis is inverted
 * @param {bool} [pitchAxisInverted=false] - Pitch axis is inverted
 * @param {bool} [yawAxisInverted=false] - Yaw axis is inverted. Used when
 * mode == 'fps'
 */
AFRAME.registerComponent('step-controls', {
    schema: {
        acceleration: {
            default: 15
        },
        accThreshold: {
            default: 0.8
        },
        rollThreshold: {
            default: 1.0
        },
        timeThreshold: {
            default: 350
        },
        rollAxis: {
            default: 'z',
            oneOf: ['x', 'y', 'z']
        },
        pitchAxis: {
            default: 'x',
            oneOf: ['x', 'y', 'z']
        },
        enabled: {
            default: true
        }
    },

    multiple: false,

    init: function() {
        this.alphaOffsetAngle = 0;
        this.velocity = new THREE.Vector3();
        this.acceleration = 0;

        this.deviceOrientation = null;
        this.deviceMotion = null;

        this.attachEventListeners();

        this.sumDelta = 0;
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

    tick: function(time, delta) {
        var data = this.data;
        var el = this.el;
        var velocity = this.velocity;

        if (isNaN(delta) || delta > MAX_DELTA) {
            velocity[data.pitchAxis] = 0;
            velocity[data.rollAxis] = 0;
            return;
        }

        if (data.enabled && this.deviceMotion && this.deviceOrientation) {
            var deviceAcceleration = this.deviceMotion.acceleration;
            //var deviceRotation = this.deviceMotion.rotationRate;
            var deviceRotation = this.deviceOrientation;


            var alpha = deviceRotation.alpha ? THREE.Math.degToRad(deviceRotation.alpha) + this.alphaOffsetAngle : 0; // Z
            var beta = deviceRotation.beta ? THREE.Math.degToRad(deviceRotation.beta) : 0; // X'
            var gamma = deviceRotation.gamma ? THREE.Math.degToRad(deviceRotation.gamma) : 0; // Y''

            var rotation = new THREE.Euler();
            rotation.set(beta, alpha, -gamma, 'YXZ'); // 'ZXY' for the device, but 'YXZ' for us

            var x = deviceAcceleration.x ? deviceAcceleration.x : 0; // yaw if device is in landscape mode than we use this value
            var y = deviceAcceleration.y ? deviceAcceleration.y : 0; // pitch
            var z = deviceAcceleration.z ? deviceAcceleration.z : 0; // roll

            var acceleration = new THREE.Vector3(x, y, z);

            // http://stanford.edu/class/ee267/Spring2016/report_mago_karaouni.pdf
            var position = el.getAttribute('position');

            this.acceleration = 0;

            //threshold 350ms between steps
            this.sumDelta += delta;
            if (this.sumDelta >= data.timeThreshold) {
                //console.log(x +  '  ' + y  +  '  '  + z)
                // TODO just use x axis?
                //const mag = Math.sqrt(x*x + y*y + z*z);
                var mag = Math.abs(acceleration[data.pitchAxis]);

                // set threshold for noise
                //if (mag <  threshold) return
                //console.log(mag)
                // acceleration maginute over 12,5 m/s² including gravity
                if (mag > data.accThreshold) {
                    console.log("STEP: " + mag)
                    this.acceleration = mag * data.acceleration;

                    var dirSign = 1;
                    var rollSubtract = 0;
                    var roll = Math.abs(rotation[data.rollAxis]);
                    if (roll <= data.rollThreshold) {
                      console.log("BACKWARDS " + roll);
                      // TODO correct
                      dirSign = -1;
                      rollSubtract = roll;
                    } else {
                      console.log("FORWARD");
                    }

                    this.acceleration *= dirSign;


                    // Use seconds.
                    delta = delta / 1000;
                    this.updateVelocity(delta);

                    var movementVector = this.getMovementVector(delta, rollSubtract);
                    console.log(movementVector)

                    var el = this.el;
                    el.object3D.translateX(movementVector.x);
                    el.object3D.translateY(movementVector.y);
                    el.object3D.translateZ(movementVector.z);

                    el.setAttribute('position', {
                        x: position.x + movementVector.x,
                        y: position.y + movementVector.y,
                        z: position.z + movementVector.z
                    });
                }

                this.sumDelta = 0;
            }
        }
    },

    updateVelocity: function(delta) {

        var data = this.data;
        var keys = this.keys;
        var velocity = this.velocity;
        var acceleration = this.acceleration;

        // If FPS too low, reset velocity.
        if (delta > MAX_DELTA) {
            velocity[data.pitchAxis] = 0;
            velocity[data.rollAxis] = 0;
            return;
        }

        // Decay velocity.
        /*
        if (velocity[adAxis] !== 0) {
            velocity[adAxis] -= velocity[adAxis] * data.easing * delta;
        }
        if (velocity[wsAxis] !== 0) {
            velocity[wsAxis] -= velocity[wsAxis] * data.easing * delta;
        }
        */
        if (!data.enabled) {
            return;
        }

        velocity[data.rollAxis] -= acceleration * delta;
    },

    getMovementVector: (function() {
        var directionVector = new THREE.Vector3(0, 0, 0);
        var rotationEuler = new THREE.Euler(0, 0, 0, 'YXZ');

        return function(delta, rollSubtract) {
            var rotation = this.el.getAttribute('rotation');
            var velocity = this.velocity;

            directionVector.copy(velocity);
            directionVector.multiplyScalar(delta);

            // Absolute.
            if (!rotation) {
                return directionVector;
            }

            // Transform direction relative to heading.
            rotationEuler.set(THREE.Math.degToRad(rotation.x), THREE.Math.degToRad(rotation.y), 0);
            console.log(rotationEuler)
            rotationEuler.x -= rollSubtract;
            directionVector.applyEuler(rotationEuler);
            return directionVector;
        };
    })(),

    pause: function() {
        this.removeEventListeners();
    },

    play: function() {
        this.attachEventListeners();
    },

    onDeviceOrientationChangeEvent: function(event) {
        this.deviceOrientation = event;
    },

    onDeviceMotionChangeEvent: function(event) {
        this.deviceMotion = event;
    },

    attachEventListeners: function() {
        window.addEventListener('deviceorientation', this.onDeviceOrientationChangeEvent.bind(this), false);
        window.addEventListener('devicemotion', this.onDeviceMotionChangeEvent.bind(this), false);
    },

    removeEventListeners: function() {
        window.removeEventListener('deviceorientation', this.onDeviceOrientationChangeEvent.bind(this));
        window.removeEventListener('devicemotion', this.onDeviceMotionChangeEvent.bind(this));
    },
});
