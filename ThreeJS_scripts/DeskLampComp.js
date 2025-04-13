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

let camera, scene, renderer, composer, controls;
let isAnimating = false;

function initScene() {
    const container = document.getElementById('JSThreeModel');
    if (!container || getComputedStyle(container).display === 'none') return;

    // Prevent duplicate canvas
    if (container.querySelector('canvas')) {
        console.log("Canvas already exists, skipping init.");
        return;
    }

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Camera
    camera = new THREE.PerspectiveCamera(47, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(-2, 1, 8);

    // Scene
    scene = new THREE.Scene();

    // Composer (Bloom)
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        1.5, 0.4, 0.85
    );
    bloomPass.threshold = 0.1;
    bloomPass.strength = 1.0;
    bloomPass.radius = 2;
    composer.addPass(bloomPass);

    // Floor and wall
    const geoFloor = new THREE.BoxGeometry(2000, 0.1, 2000);
    const matFloor = new THREE.MeshStandardMaterial({ color: 0xfffff0, roughness: 0.4, metalness: 0 });
    const floor = new THREE.Mesh(geoFloor, matFloor);
    floor.position.y = -9;
    scene.add(floor);

    const geoWall = new THREE.BoxGeometry(0.1, 2000, 2000);
    const matWall = new THREE.MeshStandardMaterial({ color: 0xfffff0, roughness: 0.4, metalness: 0 });
    const wall = new THREE.Mesh(geoWall, matWall);
    wall.position.x = -9;
    scene.add(wall);

    // Light Probe
    const lightProbe = new THREE.LightProbe();
    scene.add(lightProbe);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.maxDistance = 12;
    controls.minDistance = 4;
    scene.rotation.y = -Math.PI / 2.0;
    controls.target.set(-0.5, 0.3, 0);

    // Model
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/libs/draco/gltf/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load('https://RolandThsive.github.io/3D_models/DeskLampComp.glb', (gltf) => {
        const model = gltf.scene;
        scene.add(model);
        model.traverse((obj) => {
            if (obj.isMesh) {
                if (obj.material.name === 'Mat_B2') {
                    obj.material.emissive = new THREE.Color(0xFF0005);
                    obj.material.emissiveIntensity = 1.0;
                    const pointLight = new THREE.PointLight(0xFF0005, 1.5, 50, 0.7);
                    pointLight.position.copy(obj.position);
                    scene.add(pointLight);
                }
                if (obj.material.name === 'Mat_B1') {
                    obj.material.emissive = new THREE.Color(0x00FF00);
                    obj.material.emissiveIntensity = 1.0;
                    const pointLight = new THREE.PointLight(0x00FF00, 1.5, 50, 0.7);
                    pointLight.position.copy(obj.position);
                    scene.add(pointLight);
                }
            }
        });
    });

    // Resize Handler
    window.addEventListener('resize', onResize);

    function onResize() {
        if (!container || getComputedStyle(container).display === 'none') return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        composer.setSize(container.clientWidth, container.clientHeight);
    }

    // Animation Loop
    if (!isAnimating) {
        isAnimating = true;
        animate();
    }
}

function animate() {
    if (!isAnimating) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    composer.render();
}

// Trigger when visible
const observer = new MutationObserver(() => {
    const container = document.getElementById('JSThreeModel');
    if (container && getComputedStyle(container).display !== 'none') {
        initScene();
    }
});
observer.observe(document.body, { attributes: true, childList: true, subtree: true });

// Also manually call once on load
window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('JSThreeModel');
    if (container && getComputedStyle(container).display !== 'none') {
        initScene();
    }
});
