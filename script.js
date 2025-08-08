import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// --- DOM ELEMENTS ---
const canvasContainer = document.getElementById('canvas-container');
const walletEl = document.getElementById('wallet-amount');
const betAmountEl = document.getElementById('bet-amount');
const pointValueEl = document.getElementById('point-value');
const messageEl = document.getElementById('message');
const betInput = document.getElementById('bet-input');
const betButton = document.getElementById('bet-button');
const rollButton = document.getElementById('roll-button');

// --- GAME STATE ---
const GameState = {
    AWAITING_BET: 'AWAITING_BET',
    COME_OUT_ROLL: 'COME_OUT_ROLL',
    POINT_ROLL: 'POINT_ROLL',
};

let wallet = 1000;
let currentBet = 0;
let point = null;
let gameState = GameState.AWAITING_BET;

// --- 3D SCENE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
canvasContainer.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(0, 10, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// --- PHYSICS WORLD ---
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -30, 0) });
const dice = [];
const diceBodies = [];

// Create Craps Table (ground and walls)
createTable();

// --- DICE CREATION ---
const diceMaterial = new CANNON.Material('diceMaterial');
const tableMaterial = new CANNON.Material('tableMaterial');
const diceTableContactMaterial = new CANNON.ContactMaterial(diceMaterial, tableMaterial, {
    friction: 0.1,
    restitution: 0.5,
});
world.addContactMaterial(diceTableContactMaterial);

createDice();

// --- GAME LOGIC FUNCTIONS ---
function updateUI() {
    walletEl.textContent = wallet;
    betAmountEl.textContent = currentBet;
    pointValueEl.textContent = point ? point : 'OFF';

    betButton.disabled = gameState !== GameState.AWAITING_BET;
    betInput.disabled = gameState !== GameState.AWAITING_BET;
    rollButton.disabled = gameState === GameState.AWAITING_BET;
}

function displayMessage(msg, duration = 0) {
    messageEl.textContent = msg;
    if (duration > 0) {
        setTimeout(() => {
            if (gameState === GameState.AWAITING_BET) {
                messageEl.textContent = "Place your Pass Line bet to start.";
            } else if (gameState === GameState.COME_OUT_ROLL) {
                messageEl.textContent = `Rolling for the Come Out...`;
            } else {
                 messageEl.textContent = `Point is ${point}. Roll again!`;
            }
        }, duration);
    }
}

betButton.addEventListener('click', () => {
    const betValue = parseInt(betInput.value, 10);
    if (isNaN(betValue) || betValue <= 0) {
        displayMessage("Please enter a valid bet amount.", 2000);
        return;
    }
    if (betValue > wallet) {
        displayMessage("You don't have enough money!", 2000);
        return;
    }

    currentBet = betValue;
    wallet -= currentBet;
    gameState = GameState.COME_OUT_ROLL;
    displayMessage(`Bet of $${currentBet} placed. Roll for the Come Out.`);
    updateUI();
});

rollButton.addEventListener('click', () => {
    rollButton.disabled = true;
    displayMessage(gameState === GameState.COME_OUT_ROLL ? "Come Out Roll..." : `Rolling for the point (${point})...`);
    throwDice();
});

function handleRollResult(total) {
    if (gameState === GameState.COME_OUT_ROLL) {
        if (total === 7 || total === 11) {
            // Win (Natural)
            wallet += currentBet * 2;
            displayMessage(`You rolled a ${total}. Natural! You win $${currentBet}!`, 4000);
            resetRound();
        } else if (total === 2 || total === 3 || total === 12) {
            // Lose (Craps)
            displayMessage(`You rolled a ${total}. Craps! You lose.`, 4000);
            resetRound();
        } else {
            // Establish Point
            point = total;
            gameState = GameState.POINT_ROLL;
            displayMessage(`Point is set to ${point}. Roll a ${point} to win. Roll a 7 to lose.`, 4000);
        }
    } else if (gameState === GameState.POINT_ROLL) {
        if (total === point) {
            // Win
            wallet += currentBet * 2;
            displayMessage(`You rolled a ${total}! You win $${currentBet}!`, 4000);
            resetRound();
        } else if (total === 7) {
            // Lose (Seven Out)
            displayMessage(`You rolled a 7. Seven-out! You lose.`, 4000);
            resetRound();
        } else {
            // Keep rolling
            displayMessage(`You rolled a ${total}. Roll again.`, 2000);
        }
    }
    
    // Only re-enable roll button if the round is not over
    if (gameState !== GameState.AWAITING_BET) {
        rollButton.disabled = false;
    }
    updateUI();
}

function resetRound() {
    currentBet = 0;
    point = null;
    gameState = GameState.AWAITING_BET;
    if (wallet === 0) {
        displayMessage("Game Over! You're out of money. Refresh to play again.", 10000);
        betButton.disabled = true;
        betInput.disabled = true;
        rollButton.disabled = true;
    }
}


// --- PHYSICS & 3D FUNCTIONS ---

function createTable() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0f8a39, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const floorBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        material: tableMaterial,
    });
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(floorBody);

    // Walls
    const wallOptions = { mass: 0, material: tableMaterial };
    const wallHeight = 2;
    const wallThickness = 1;
    const wallLength = 15;

    const wallShape = new CANNON.Box(new CANNON.Vec3(wallLength, wallHeight, wallThickness));
    
    const wall1 = new CANNON.Body(wallOptions);
    wall1.addShape(wallShape);
    wall1.position.set(0, 0, -wallLength);
    world.addBody(wall1);

    const wall2 = new CANNON.Body(wallOptions);
    wall2.addShape(wallShape);
    wall2.position.set(0, 0, wallLength);
    world.addBody(wall2);
    
    const wall3 = new CANNON.Body(wallOptions);
    wall3.addShape(wallShape);
    wall3.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
    wall3.position.set(-wallLength, 0, 0);
    world.addBody(wall3);

    const wall4 = new CANNON.Body(wallOptions);
    wall4.addShape(wallShape);
    wall4.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
    wall4.position.set(wallLength, 0, 0);
    world.addBody(wall4);
}

function createDice() {
    const diceSize = 1;
    const halfSize = diceSize / 2;
    const mass = 0.1;
    
    const diceGeo = new THREE.BoxGeometry(diceSize, diceSize, diceSize);
    const dotGeo = new THREE.CircleGeometry(0.15, 16);

    const diceTextures = createDiceTextures();
    const diceMaterials = diceTextures.map(texture => new THREE.MeshStandardMaterial({ map: texture }));

    for (let i = 0; i < 2; i++) {
        const die = new THREE.Mesh(diceGeo, diceMaterials);
        die.castShadow = true;
        scene.add(die);
        dice.push(die);

        const dieBody = new CANNON.Body({
            mass,
            shape: new CANNON.Box(new CANNON.Vec3(halfSize, halfSize, halfSize)),
            material: diceMaterial,
        });
        world.addBody(dieBody);
        diceBodies.push(dieBody);
    }
}

function createDiceTextures() {
    const textures = [];
    const pips = [
        [], // 0
        [{x: 0.5, y: 0.5}], // 1
        [{x: 0.25, y: 0.25}, {x: 0.75, y: 0.75}], // 2
        [{x: 0.25, y: 0.25}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.75}], // 3
        [{x: 0.25, y: 0.25}, {x: 0.75, y: 0.25}, {x: 0.25, y: 0.75}, {x: 0.75, y: 0.75}], // 4
        [{x: 0.25, y: 0.25}, {x: 0.75, y: 0.25}, {x: 0.5, y: 0.5}, {x: 0.25, y: 0.75}, {x: 0.75, y: 0.75}], // 5
        [{x: 0.25, y: 0.25}, {x: 0.75, y: 0.25}, {x: 0.25, y: 0.5}, {x: 0.75, y: 0.5}, {x: 0.25, y: 0.75}, {x: 0.75, y: 0.75}] // 6
    ];

    const faceOrder = [6, 1, 5, 2, 4, 3]; // Standard die layout: Right, Left, Top, Bottom, Front, Back

    for(let i = 0; i < 6; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        
        context.fillStyle = 'white';
        context.fillRect(0, 0, 128, 128);
        
        context.fillStyle = 'black';
        const numPips = faceOrder[i];
        pips[numPips].forEach(pip => {
            context.beginPath();
            context.arc(pip.x * 128, pip.y * 128, 10, 0, 2 * Math.PI);
            context.fill();
        });

        textures.push(new THREE.CanvasTexture(canvas));
    }
    return textures;
}

function throwDice() {
    diceBodies.forEach((body, i) => {
        // Reset position and velocity
        body.position.set((Math.random() - 0.5) * 4, 5 + i * 2, (Math.random() - 0.5) * 4);
        body.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        
        // Apply random force and torque
        const force = new CANNON.Vec3(
            (Math.random() - 0.5) * 20, 
            0, 
            (Math.random() - 0.5) * 20
        );
        body.applyImpulse(force, new CANNON.Vec3(0, 0, 0));
        
        const torque = new CANNON.Vec3(
            Math.random() * 10 - 5, 
            Math.random() * 10 - 5, 
            Math.random() * 10 - 5
        );
        body.applyTorque(torque);
    });
}

function getDiceValue(dieBody) {
    const faceVectors = [
        new CANNON.Vec3(0, 0, 1),  // 3
        new CANNON.Vec3(0, 0, -1), // 4
        new CANNON.Vec3(0, 1, 0),  // 5
        new CANNON.Vec3(0, -1, 0), // 2
        new CANNON.Vec3(1, 0, 0),  // 6
        new CANNON.Vec3(-1, 0, 0)  // 1
    ];
    const faceValues = [3, 4, 5, 2, 6, 1];

    let highestDot = -1;
    let value = -1;

    for (let i = 0; i < faceVectors.length; i++) {
        const worldVector = dieBody.quaternion.vmult(faceVectors[i]);
        const dot = worldVector.dot(new CANNON.Vec3(0, 1, 0)); // Dot product with world up vector

        if (dot > highestDot) {
            highestDot = dot;
            value = faceValues[i];
        }
    }
    return value;
}


// --- ANIMATION LOOP ---
let diceSettled = true;

function animate() {
    requestAnimationFrame(animate);

    world.step(1 / 60);

    let allSleeping = true;
    for (let i = 0; i < dice.length; i++) {
        dice[i].position.copy(diceBodies[i].position);
        dice[i].quaternion.copy(diceBodies[i].quaternion);
        
        if (!diceBodies[i].sleepState.toString().includes('SLEEPING')) {
            allSleeping = false;
        }
    }

    if (!allSleeping) {
        diceSettled = false;
    }

    if (allSleeping && !diceSettled) {
        diceSettled = true;
        const val1 = getDiceValue(diceBodies[0]);
        const val2 = getDiceValue(diceBodies[1]);
        handleRollResult(val1 + val2);
    }
    
    renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initial setup
updateUI();
animate();
