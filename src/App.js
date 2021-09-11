
import { useEffect } from 'react';
import './App.css';
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import joystickblue from './assets/joystickblue.png'
import joystickbase from './assets/joystickbase.png'

function App() {
  let _APP = null;
  useEffect(() => {
    _APP = new CharacterControllerDemo();
    // localStorage.setItem('_APP', new CharacterControllerDemo());
    // localStorage.getItem('_APP')
  }, [])

  class BasicCharacterControllerProxy {
    constructor(animations) {
      this._animations = animations;
    }

    get animations() {
      return this._animations;
    }
  };


  class BasicCharacterController {
    constructor(params) {
      this._Init(params);
    }

    _Init(params) {
      this._params = params;
      this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
      this._acceleration = new THREE.Vector3(1, 0.25, 50.0);
      this._velocity = new THREE.Vector3(0, 0, 0);

      this._animations = {};
      this._input = new BasicCharacterControllerInput();
      this._stateMachine = new CharacterFSM(
        new BasicCharacterControllerProxy(this._animations));

      this._LoadModels();
    }

    _LoadModels() {
      const loader = new FBXLoader();
      loader.setPath('./resources/dancer/');
      loader.load('girl.fbx', (fbx) => {
        fbx.scale.setScalar(0.1);
        fbx.traverse(c => {
          c.castShadow = true;
        });

        this._target = fbx;
        this._params.scene.add(this._target);

        this._mixer = new THREE.AnimationMixer(this._target);

        this._manager = new THREE.LoadingManager();
        this._manager.onLoad = () => {
          this._stateMachine.SetState('idle');
        };

        const _OnLoad = (animName, anim) => {
          const clip = anim.animations[0];
          const action = this._mixer.clipAction(clip);

          this._animations[animName] = {
            clip: clip,
            action: action,
          };
        };

        const loader = new FBXLoader(this._manager);
        loader.setPath('./resources/zombie/');
        loader.load('walk.fbx', (a) => { _OnLoad('walk', a); });
        loader.load('run.fbx', (a) => { _OnLoad('run', a); });
        loader.load('idle.fbx', (a) => { _OnLoad('idle', a); });
        loader.load('dance.fbx', (a) => { _OnLoad('dance', a); });
      });
    }

    Update(timeInSeconds) {
      if (!this._target) {
        return;
      }

      this._stateMachine.Update(timeInSeconds, this._input);

      const velocity = this._velocity;
      const frameDecceleration = new THREE.Vector3(
        velocity.x * this._decceleration.x,
        velocity.y * this._decceleration.y,
        velocity.z * this._decceleration.z
      );
      frameDecceleration.multiplyScalar(timeInSeconds);
      frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
        Math.abs(frameDecceleration.z), Math.abs(velocity.z));

      velocity.add(frameDecceleration);

      const controlObject = this._target;
      const _Q = new THREE.Quaternion();
      const _A = new THREE.Vector3();
      const _R = controlObject.quaternion.clone();

      const acc = this._acceleration.clone();
      if (this._input._keys.shift) {
        acc.multiplyScalar(2.0);
      }

      if (this._stateMachine._currentState.Name === 'dance') {
        acc.multiplyScalar(0.0);
      }

      if (this._input._keys.forward) {
        velocity.z += acc.z * timeInSeconds;
      }
      if (this._input._keys.backward) {
        velocity.z -= acc.z * timeInSeconds;
      }
      if (this._input._keys.left) {
        _A.set(0, 1, 0);
        _Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this._acceleration.y);
        _R.multiply(_Q);
      }
      if (this._input._keys.right) {
        _A.set(0, 1, 0);
        _Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this._acceleration.y);
        _R.multiply(_Q);
      }

      controlObject.quaternion.copy(_R);

      const oldPosition = new THREE.Vector3();
      oldPosition.copy(controlObject.position);

      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyQuaternion(controlObject.quaternion);
      forward.normalize();

      const sideways = new THREE.Vector3(1, 0, 0);
      sideways.applyQuaternion(controlObject.quaternion);
      sideways.normalize();

      sideways.multiplyScalar(velocity.x * timeInSeconds);
      forward.multiplyScalar(velocity.z * timeInSeconds);

      controlObject.position.add(forward);
      controlObject.position.add(sideways);

      oldPosition.copy(controlObject.position);

      if (this._mixer) {
        this._mixer.update(timeInSeconds);
      }
    }
  };
  class JoystickController {
    constructor(stickID, maxDistance, deadzone) {
      this.id = stickID;
      let stick = document.getElementById(stickID);

      // location from which drag begins, used to calculate offsets
      this.dragStart = null;

      // track touch identifier in case multiple joysticks present
      this.touchId = null;

      this.active = false;
      this.value = { x: 0, y: 0 };

      let self = this;

      function handleDown(event) {
        self.active = true;

        // all drag movements are instantaneous
        stick.style.transition = '0s';

        // touch event fired before mouse event; prevent redundant mouse event from firing
        event.preventDefault();

        if (event.changedTouches)
          self.dragStart = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
        else
          self.dragStart = { x: event.clientX, y: event.clientY };

        // if this is a touch event, keep track of which one
        if (event.changedTouches)
          self.touchId = event.changedTouches[0].identifier;
      }

      function handleMove(event) {
        if (!self.active) return;

        // if this is a touch event, make sure it is the right one
        // also handle multiple simultaneous touchmove events
        let touchmoveId = null;
        if (event.changedTouches) {
          for (let i = 0; i < event.changedTouches.length; i++) {
            if (self.touchId === event.changedTouches[i].identifier) {
              touchmoveId = i;
              event.clientX = event.changedTouches[i].clientX;
              event.clientY = event.changedTouches[i].clientY;
            }
          }

          if (touchmoveId == null) return;
        }

        const xDiff = event.clientX - self.dragStart.x;
        const yDiff = event.clientY - self.dragStart.y;
        const angle = Math.atan2(yDiff, xDiff);
        const distance = Math.min(maxDistance, Math.hypot(xDiff, yDiff));
        const xPosition = distance * Math.cos(angle);
        const yPosition = distance * Math.sin(angle);

        // move stick image to new position
        stick.style.transform = `translate3d(${xPosition}px, ${yPosition}px, 0px)`;

        // deadzone adjustment
        const distance2 = (distance < deadzone) ? 0 : maxDistance / (maxDistance - deadzone) * (distance - deadzone);
        const xPosition2 = distance2 * Math.cos(angle);
        const yPosition2 = distance2 * Math.sin(angle);
        const xPercent = parseFloat((xPosition2 / maxDistance).toFixed(4));
        const yPercent = parseFloat((yPosition2 / maxDistance).toFixed(4));

        self.value = { x: xPercent, y: yPercent };
      }

      function handleUp(event) {
        if (!self.active) return;

        // if this is a touch event, make sure it is the right one
        if (event.changedTouches && self.touchId !== event.changedTouches[0].identifier) return;

        // transition the joystick position back to center
        stick.style.transition = '.2s';
        stick.style.transform = `translate3d(0px, 0px, 0px)`;

        // reset everything
        self.value = { x: 0, y: 0 };
        self.touchId = null;
        self.active = false;
      }

      stick.addEventListener('mousedown', handleDown);
      stick.addEventListener('touchstart', handleDown);
      document.addEventListener('mousemove', handleMove, { passive: false });
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('mouseup', handleUp);
      document.addEventListener('touchend', handleUp);
    }
  }
  class BasicCharacterControllerInput {
    constructor() {
      this._Init();
    }

    _Init() {
      this._keys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        space: false,
        shift: false,
      };
      this.myStick = new JoystickController("stick", 64, 8);

      let joystick = document.getElementById("joystick")


      document.addEventListener("mouseover", (e) => this._joyOn(this.myStick), false);
      document.addEventListener("touchend", (e) => this._joyOff(), false);
      document.addEventListener("mouseleave", (e) => this._joyOff(), false);
      document.addEventListener("touchmove", (e) => this._joyOn(this.myStick), false);
      document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
      document.addEventListener('keyup', (e) => this._onKeyUp(e), false);

    }

    _joyOn = (myStick) => {
      let x = this.myStick.value.x;
      let y = this.myStick.value.y;
      console.log(x, ",", y);
      if (x > .708) {
        this._keys.left = true;
      } else if (x < -.708) {
        this._keys.right = true;
      } else if (y > .708) {
        this._keys.backward = true;
      } else if (y < -0.708) {
        this._keys.forward = true;
      } else {
        this._keys.backward = false;
        this._keys.forward = false;
        this._keys.right = false;
        this._keys.left = false;
      }
    }
    _joyOff = () => {
      this._keys.backward = false;
      this._keys.forward = false;
      this._keys.right = false;
      this._keys.left = false;
    }
    _onKeyDown(event) {
      switch (event.keyCode) {
        case 87: // w
          this._keys.forward = true;
          break;
        case 65: // a
          this._keys.left = true;
          break;
        case 83: // s
          this._keys.backward = true;
          break;
        case 68: // d
          this._keys.right = true;
          break;
        case 32: // SPACE
          this._keys.space = true;
          break;
        case 16: // SHIFT
          this._keys.shift = true;
          break;
        case 38: // up arw
          this._keys.forward = true;
          break;
        case 40: //down arw
          this._keys.backward = true;
          break;
        case 37: // left arw
          this._keys.left = true;
          break;
        case 39: // right arw
          this._keys.right = true;
          break;
      }
    }

    _onKeyUp(event) {
      switch (event.keyCode) {
        case 87: // w
          this._keys.forward = false;
          break;
        case 65: // a
          this._keys.left = false;
          break;
        case 83: // s
          this._keys.backward = false;
          break;
        case 68: // d
          this._keys.right = false;
          break;
        case 32: // SPACE
          this._keys.space = false;
          break;
        case 16: // SHIFT
          this._keys.shift = false;
          break;
        case 38: // up arw
          this._keys.forward = false;
          break;
        case 40: //down arw
          this._keys.backward = false;
          break;
        case 37: // left arw
          this._keys.left = false;
          break;
        case 39: // right arw
          this._keys.right = false;
          break;
      }
    }
  };


  class FiniteStateMachine {
    constructor() {
      this._states = {};
      this._currentState = null;
    }

    _AddState(name, type) {
      this._states[name] = type;
    }

    SetState(name) {
      const prevState = this._currentState;

      if (prevState) {
        if (prevState.Name == name) {
          return;
        }
        prevState.Exit();
      }

      const state = new this._states[name](this);

      this._currentState = state;
      state.Enter(prevState);
    }

    Update(timeElapsed, input) {
      if (this._currentState) {
        this._currentState.Update(timeElapsed, input);
      }
    }
  };


  class CharacterFSM extends FiniteStateMachine {
    constructor(proxy) {
      super();
      this._proxy = proxy;
      this._Init();
    }

    _Init() {
      this._AddState('idle', IdleState);
      this._AddState('walk', WalkState);
      this._AddState('run', RunState);
      this._AddState('dance', DanceState);
    }
  };


  class State {
    constructor(parent) {
      this._parent = parent;
    }

    Enter() { }
    Exit() { }
    Update() { }
  };


  class DanceState extends State {
    constructor(parent) {
      super(parent);

      this._FinishedCallback = () => {
        this._Finished();
      }
    }

    get Name() {
      return 'dance';
    }

    Enter(prevState) {
      const curAction = this._parent._proxy._animations['dance'].action;
      const mixer = curAction.getMixer();
      mixer.addEventListener('finished', this._FinishedCallback);

      if (prevState) {
        const prevAction = this._parent._proxy._animations[prevState.Name].action;

        curAction.reset();
        curAction.setLoop(THREE.LoopOnce, 1);
        curAction.clampWhenFinished = true;
        curAction.crossFadeFrom(prevAction, 0.2, true);
        curAction.play();
      } else {
        curAction.play();
      }
    }

    _Finished() {
      this._Cleanup();
      this._parent.SetState('idle');
    }

    _Cleanup() {
      const action = this._parent._proxy._animations['dance'].action;

      action.getMixer().removeEventListener('finished', this._CleanupCallback);
    }

    Exit() {
      this._Cleanup();
    }

    Update(_) {
    }
  };


  class WalkState extends State {
    constructor(parent) {
      super(parent);
    }

    get Name() {
      return 'walk';
    }

    Enter(prevState) {
      const curAction = this._parent._proxy._animations['walk'].action;
      if (prevState) {
        const prevAction = this._parent._proxy._animations[prevState.Name].action;

        curAction.enabled = true;

        if (prevState.Name == 'run') {
          const ratio = curAction.getClip().duration / prevAction.getClip().duration;
          curAction.time = prevAction.time * ratio;
        } else {
          curAction.time = 0.0;
          curAction.setEffectiveTimeScale(1.0);
          curAction.setEffectiveWeight(1.0);
        }

        curAction.crossFadeFrom(prevAction, 0.5, true);
        curAction.play();
      } else {
        curAction.play();
      }
    }

    Exit() {
    }

    Update(timeElapsed, input) {
      if (input._keys.forward || input._keys.backward) {
        if (input._keys.shift) {
          this._parent.SetState('run');
        }
        return;
      }

      this._parent.SetState('idle');
    }
  };


  class RunState extends State {
    constructor(parent) {
      super(parent);
    }

    get Name() {
      return 'run';
    }

    Enter(prevState) {
      const curAction = this._parent._proxy._animations['run'].action;
      if (prevState) {
        const prevAction = this._parent._proxy._animations[prevState.Name].action;

        curAction.enabled = true;

        if (prevState.Name === 'walk') {
          const ratio = curAction.getClip().duration / prevAction.getClip().duration;
          curAction.time = prevAction.time * ratio;
        } else {
          curAction.time = 0.0;
          curAction.setEffectiveTimeScale(1.0);
          curAction.setEffectiveWeight(1.0);
        }

        curAction.crossFadeFrom(prevAction, 0.5, true);
        curAction.play();
      } else {
        curAction.play();
      }
    }

    Exit() {
    }

    Update(timeElapsed, input) {
      if (input._keys.forward || input._keys.backward) {
        if (!input._keys.shift) {
          this._parent.SetState('walk');
        }
        return;
      }

      this._parent.SetState('idle');
    }
  };


  class IdleState extends State {
    constructor(parent) {
      super(parent);
    }

    get Name() {
      return 'idle';
    }

    Enter(prevState) {
      const idleAction = this._parent._proxy._animations['idle'].action;
      if (prevState) {
        const prevAction = this._parent._proxy._animations[prevState.Name].action;
        idleAction.time = 0.0;
        idleAction.enabled = true;
        idleAction.setEffectiveTimeScale(1.0);
        idleAction.setEffectiveWeight(1.0);
        idleAction.crossFadeFrom(prevAction, 0.5, true);
        idleAction.play();
      } else {
        idleAction.play();
      }
    }

    Exit() {
    }

    Update(_, input) {
      if (input._keys.forward || input._keys.backward) {
        this._parent.SetState('walk');
      } else if (input._keys.space) {
        this._parent.SetState('dance');
      }
    }
  };


  class CharacterControllerDemo {
    constructor() {
      this._Initialize();
    }

    _Initialize() {
      this._threejs = new THREE.WebGLRenderer({
        antialias: true,
      });
      this._threejs.outputEncoding = THREE.sRGBEncoding;
      this._threejs.shadowMap.enabled = true;
      this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
      this._threejs.setPixelRatio(window.devicePixelRatio);
      this._threejs.setSize(window.innerWidth, window.innerHeight);

      document.body.appendChild(this._threejs.domElement);

      window.addEventListener('resize', () => {
        this._OnWindowResize();
      }, false);

      const fov = 60;
      const aspect = 1920 / 1080;
      const near = 1.0;
      const far = 1000.0;
      this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
      this._camera.position.set(25, 10, 25);

      this._scene = new THREE.Scene();

      let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
      light.position.set(-100, 100, 100);
      light.target.position.set(0, 0, 0);
      light.castShadow = true;
      light.shadow.bias = -0.001;
      light.shadow.mapSize.width = 4096;
      light.shadow.mapSize.height = 4096;
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = 500.0;
      light.shadow.camera.near = 0.5;
      light.shadow.camera.far = 500.0;
      light.shadow.camera.left = 50;
      light.shadow.camera.right = -50;
      light.shadow.camera.top = 50;
      light.shadow.camera.bottom = -50;
      this._scene.add(light);

      light = new THREE.AmbientLight(0xFFFFFF, 0.25);
      this._scene.add(light);

      const controls = new OrbitControls(
        this._camera, this._threejs.domElement);
      controls.target.set(0, 10, 0);
      controls.update();

      // const loader = new THREE.CubeTextureLoader();
      // const texture = loader.load([
      //   './resources/posx.jpg',
      //   './resources/negx.jpg',
      //   './resources/posy.jpg',
      //   './resources/negy.jpg',
      //   './resources/posz.jpg',
      //   './resources/negz.jpg',
      // ]);
      // texture.encoding = THREE.sRGBEncoding;
      // this._scene.background = texture;

      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100, 10, 10),
        new THREE.MeshStandardMaterial({
          color: 0x808080,
        }));
      plane.castShadow = false;
      plane.receiveShadow = true;
      plane.rotation.x = -Math.PI / 2;
      this._scene.add(plane);

      this._mixers = [];
      this._previousRAF = null;

      this._LoadAnimatedModel();
      this._RAF();
    }

    _LoadAnimatedModel() {
      const params = {
        camera: this._camera,
        scene: this._scene,
      }
      this._controls = new BasicCharacterController(params);
    }

    _LoadAnimatedModelAndPlay(path, modelFile, animFile, offset) {
      const loader = new FBXLoader();
      loader.setPath(path);
      loader.load(modelFile, (fbx) => {
        fbx.scale.setScalar(0.1);
        fbx.traverse(c => {
          c.castShadow = true;
        });
        fbx.position.copy(offset);

        const anim = new FBXLoader();
        anim.setPath(path);
        anim.load(animFile, (anim) => {
          const m = new THREE.AnimationMixer(fbx);
          this._mixers.push(m);
          const idle = m.clipAction(anim.animations[0]);
          idle.play();
        });
        this._scene.add(fbx);
      });
    }

    // _LoadModel() {
    //   const loader = new GLTFLoader();
    //   loader.load('./resources/thing.glb', (gltf) => {
    //     gltf.scene.traverse(c => {
    //       c.castShadow = true;
    //     });
    //     this._scene.add(gltf.scene);
    //   });
    // }

    _OnWindowResize() {
      this._camera.aspect = window.innerWidth / window.innerHeight;
      this._camera.updateProjectionMatrix();
      this._threejs.setSize(window.innerWidth, window.innerHeight);
    }

    _RAF() {
      requestAnimationFrame((t) => {
        if (this._previousRAF === null) {
          this._previousRAF = t;
        }

        this._RAF();

        this._threejs.render(this._scene, this._camera);
        this._Step(t - this._previousRAF);
        this._previousRAF = t;
      });
    }

    _Step(timeElapsed) {
      const timeElapsedS = timeElapsed * 0.001;
      if (this._mixers) {
        this._mixers.map(m => m.update(timeElapsedS));
      }

      if (this._controls) {
        this._controls.Update(timeElapsedS);
      }
    }
  }

  return (
    <div className="App">
      <div id="joystick-container">
        <div id="joystick">
          <img src={joystickbase} />
          <div id="stick">
            <img src={joystickblue} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
