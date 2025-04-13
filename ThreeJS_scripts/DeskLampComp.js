/*import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { LightProbeGenerator } from 'three/addons/lights/LightProbeGenerator.js';
import { LightProbeHelper } from 'three/addons/helpers/LightProbeHelper.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';*/


import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/loaders/DRACOLoader.js';
import { LightProbeGenerator } from 'https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/lights/LightProbeGenerator.js';
import { LightProbeHelper } from 'https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/helpers/LightProbeHelper.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/environments/RoomEnvironment.js';


// Create scene, camera, and renderer

//Camera
let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 8);

//renderer
/*let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);*/


//Renderer
const container = document.getElementById('JSThreeModel');
let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);


//Scene
let scene = new THREE.Scene();

// Set up post-processing for bloom effect
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.1;
bloomPass.strength = 1.0; // Adjust bloom intensity
bloomPass.radius = 2;
composer.addPass(bloomPass);

// probe
let lightProbe;
lightProbe = new THREE.LightProbe();
scene.add(lightProbe);

//Create a Floor
const geoFloor = new THREE.BoxGeometry(2000, 0.1, 2000);
const matStdFloor = new THREE.MeshStandardMaterial({
    color: 0xFFFFF0, roughness: 0.4, metalness: 0
});
const mshStdFloor = new THREE.Mesh(geoFloor, matStdFloor);
mshStdFloor.position.set(0, -9, 0);
scene.add(mshStdFloor);

//backwards wall
const geoWall = new THREE.BoxGeometry(0.1, 2000, 2000);
const matStdWall = new THREE.MeshStandardMaterial({
    color: 0xFFFFF0, roughness: 0.4, metalness: 0
});
const mshStdWall = new THREE.Mesh(geoWall, matStdWall);
mshStdWall.position.set(-9, 0, 0);
scene.add(mshStdWall);

// Load GLTF model
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('https://RolandThsive.github.io/3D_models/DeskLampComp.glb', (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    // Find the material named "mat_B2" and add a point light to its position

    model.traverse((object) => {
        if (object.isMesh && object.material.name === 'Mat_B2') {
            object.material.emissive = new THREE.Color(0xFF0005); // Red glow
            object.material.emissiveIntensity = 1.0; // Adjust intensity
        }
        if (object.isMesh && object.material.name === 'Mat_B1') {
            object.material.emissive = new THREE.Color(0x00FF00); // Green glow
            object.material.emissiveIntensity = 1.0; // Adjust intensity
        }
    });
    model.traverse((object) => {
        if (object.isMesh && object.material.name === 'Mat_B2') {
            const pointLight = new THREE.PointLight(0xFF0005, 1.5, 50, 0.7);
            pointLight.position.copy(object.position);
            scene.add(pointLight);
        }
        if (object.isMesh && object.material.name === 'Mat_B1') {
            const pointLight = new THREE.PointLight(0x00FF00, 1.5, 50, 0.7);
            pointLight.position.copy(object.position);
            scene.add(pointLight);
        }
    });
}, undefined, (error) => {
    console.error('Error loading GLTF model:', error);
});

// Add controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.maxDistance = 8;  // Maximum zoom-out distance
controls.minDistance = 4;   // Minimum zoom-in distance

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    composer.render(); // Use composer to apply the bloom effect
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight); // Update composer size
});
