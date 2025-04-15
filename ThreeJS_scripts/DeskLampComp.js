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
let matB2 = null, pointLight2 = null;
let matB1 = null, pointLight1 = null;
let selectedMode = "3D Model Viewer";
let lowerThres = 0.6;

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
    camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(-7, 1, 8);

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
    floor.position.y = -11;
    scene.add(floor);

    const geoWall = new THREE.BoxGeometry(0.1, 2000, 2000);
    const matWall = new THREE.MeshStandardMaterial({ color: 0xfffff0, roughness: 0.4, metalness: 0 });
    const wall = new THREE.Mesh(geoWall, matWall);
    wall.position.x = -11;
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
    controls.target.set(-0.5, 0.6, 0);

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
                    matB2 = obj.material; // Save reference
                    matB2.color = new THREE.Color(0xF5F5F5);
                    matB2.emissive = new THREE.Color(0xFF0005);
                    matB2.emissiveIntensity = 1.0;
                    pointLight2 = new THREE.PointLight(0xFF0005, 3.0, 50, 0.7);
                    pointLight2.position.copy(obj.position);
                    scene.add(pointLight2);
                }
                if (obj.material.name === 'Mat_B1') {
                    matB1 = obj.material; // Save reference
                    matB1.color = new THREE.Color(0xF5F5F5);
                    matB1.emissive = new THREE.Color(0x0073cf);
                    matB1.emissiveIntensity = 1.0;
                    pointLight1 = new THREE.PointLight(0x0073cf, 1.95, 50, 0.7);
                    pointLight1.position.copy(obj.position);
                    scene.add(pointLight1);
                }
            }
        });
        setupColorInputs(); // Call after model is loaded
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

function getKelvinColorInfo(value) {
    const stops = [
        { stop: 0, color: "#FFDAB3", kelvin: 2700 },   // Soft White
        { stop: 40, color: "#F2E6D8", kelvin: 4000 },  // Warm White
        { stop: 100, color: "#F5F5F5", kelvin: 5000 }  // Neutral White
    ];

    let lower, upper;
    for (let i = 0; i < stops.length - 1; i++) {
        if (value >= stops[i].stop && value <= stops[i + 1].stop) {
            lower = stops[i];
            upper = stops[i + 1];
            break;
        }
    }

    const t = (value - lower.stop) / (upper.stop - lower.stop);

    const hexToRgb = hex => {
        const n = parseInt(hex.replace("#", ""), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };

    const rgbToHex = ({ r, g, b }) =>
        "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");

    const interpolate = (a, b, t) => ({
        r: Math.round(a.r + (b.r - a.r) * t),
        g: Math.round(a.g + (b.g - a.g) * t),
        b: Math.round(a.b + (b.b - a.b) * t)
    });

    const color = interpolate(hexToRgb(lower.color), hexToRgb(upper.color), t);
    const kelvin = Math.round(lower.kelvin + (upper.kelvin - lower.kelvin) * t);

    return {
        hex: rgbToHex(color),
        kelvin: kelvin
    };
}

function setupColorInputs() {
    const inputB2 = document.getElementById('colorPicker2');
    const inputB1 = document.getElementById('colorPicker1');
    const intensityB2 = document.getElementById('brightnessSlider2');
    const intensityB1 = document.getElementById('brightnessSlider1');
    const slider2 = document.getElementById("ILCSlider2");
    const slider1 = document.getElementById("ILCSlider1");

    if (inputB2) {
        inputB2.addEventListener('input', () => {
            if (matB2) {
                const color = new THREE.Color(inputB2.value);
                matB2.emissive.set(color);
                if (pointLight2) pointLight2.color.set(color);
            }
        });
    }

    if (inputB1) {
        inputB1.addEventListener('input', () => {
            if (matB1) {
                const color = new THREE.Color(inputB1.value);
                matB1.emissive.set(color);
                if (pointLight1) pointLight1.color.set(color);
            }
        });
    }

    if (intensityB2) {
        intensityB2.addEventListener('input', () => {
            if (selectedMode == "R.G.B. Light Configuration") {
                if (pointLight2) pointLight2.intensity = parseFloat(intensityB2.value);
                if (matB2) matB2.emissiveIntensity = parseFloat(intensityB2.value);
            }
            else if (selectedMode == "Incandescent Light Configuration") {
                if (pointLight2) pointLight2.intensity = parseFloat((intensityB2.value * lowerThres));
                if (matB2) matB2.emissiveIntensity = parseFloat((intensityB2.value * lowerThres));
            }
        });
    }

    if (intensityB1) {
        intensityB1.addEventListener('input', () => {
            if (selectedMode == "R.G.B. Light Configuration") {
                if (pointLight1) pointLight1.intensity = parseFloat(intensityB1.value);
                if (matB1) matB1.emissiveIntensity = parseFloat(intensityB1.value);
            }
            else if (selectedMode == "Incandescent Light Configuration") {
                if (pointLight1) pointLight1.intensity = parseFloat((intensityB1.value * lowerThres));
                if (matB1) matB1.emissiveIntensity = parseFloat((intensityB1.value * lowerThres));
            }
        });
    }
    if (slider2) {
        slider2.addEventListener('input', () => {
            if (matB2) {
                const { hex, kelvin } = getKelvinColorInfo(slider2.value);
                const color = new THREE.Color(hex);
                matB2.emissive.set(color);
                if (pointLight2) pointLight2.color.set(color);
            }
        });
    }
    if (slider1) {
        slider1.addEventListener('input', () => {
            if (matB1) {
                const { hex, kelvin } = getKelvinColorInfo(slider1.value);
                const color = new THREE.Color(hex);
                matB1.emissive.set(color);
                if (pointLight1) pointLight1.color.set(color);
            }
        });
    }
}

function changeBulbMode() {
    const intensityB2 = document.getElementById('brightnessSlider2');
    const intensityB1 = document.getElementById('brightnessSlider1');

    const inputB2 = document.getElementById('colorPicker2');
    const inputB1 = document.getElementById('colorPicker1');

    const slider2 = document.getElementById('ILCSlider2');
    const slider1 = document.getElementById('ILCSlider1');

    if (selectedMode == 'R.G.B. Light Configuration') {
        const color2 = new THREE.Color(inputB2.value);
        const color1 = new THREE.Color(inputB1.value);
        matB2.emissive.set(color2);
        matB1.emissive.set(color1);
        if (pointLight2) { pointLight2.color.set(color2); }
        if (pointLight1) { pointLight1.color.set(color1); }
    }
    else if (selectedMode == 'Incandescent Light Configuration') {
        const { hex2, kelvin2 } = getKelvinColorInfo(slider2.value);
        const { hex1, kelvin1 } = getKelvinColorInfo(slider1.value);
        const color2 = new THREE.Color(hex2);
        const color1 = new THREE.Color(hex1);
        matB2.emissive.set(color2);
        matB1.emissive.set(color1);
        if (pointLight2) { pointLight2.color.set(color2); }
        if (pointLight1) { pointLight1.color.set(color1); }

        //Tone down intensity
        if (pointLight2) pointLight2.intensity = parseFloat((intensityB2.value * lowerThres));
        if (matB2) matB2.emissiveIntensity = parseFloat((intensityB2.value * lowerThres));

        if (pointLight1) pointLight1.intensity = parseFloat((intensityB1.value * lowerThres));
        if (matB1) matB1.emissiveIntensity = parseFloat((intensityB1.value * lowerThres));
    }
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

// Attach dropdownchange event
document.querySelector('.dropdown').addEventListener('dropdownchange', function (e) {
    selectedMode = e.detail.value;
    //console.log("Dropdown changed to:", selectedMode);
    changeBulbMode();
});
